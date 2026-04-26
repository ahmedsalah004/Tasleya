(function () {
  let initialized = false;

  window.initEmojiMoviesRuntime = function initEmojiMoviesRuntime() {
    if (initialized) return;
    initialized = true;


      const TURN_SECONDS = 60;
      const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";
      const EMOJI_MOVIES_STORAGE_KEY = "tasleya_emoji_movies_state_v1";
      const EMOJI_MOVIES_STORAGE_VERSION = 1;
      const RECENT_LIMIT = 200;
      const EXHAUSTION_NOTICE_TEXT = "أعدنا خلط الأسئلة بعد استخدام معظم الأسئلة المتاحة، وقد تظهر بعض الأسئلة مرة أخرى.";
      const recentHistory = window.TasleyaRecentHistory || null;

      const elements = {
        team1Score: document.getElementById("team1Score"),
        team2Score: document.getElementById("team2Score"),
        team1ScoreCard: document.getElementById("team1ScoreCard"),
        team2ScoreCard: document.getElementById("team2ScoreCard"),
        loadingScreen: document.getElementById("loadingScreen"),
        errorScreen: document.getElementById("errorScreen"),
        playScreen: document.getElementById("playScreen"),
        revealScreen: document.getElementById("revealScreen"),
        finalScreen: document.getElementById("finalScreen"),
        resumePrompt: document.getElementById("resumePrompt"),
        resumeBtn: document.getElementById("resumeBtn"),
        discardResumeBtn: document.getElementById("discardResumeBtn"),
        turnTitle: document.getElementById("turnTitle"),
        timerLabel: document.getElementById("timerLabel"),
        emojiText: document.getElementById("emojiText"),
        answerForm: document.getElementById("answerForm"),
        answerInput: document.getElementById("answerInput"),
        hintBtn: document.getElementById("hintBtn"),
        showAnswerBtn: document.getElementById("showAnswerBtn"),
        skipTurnBtn: document.getElementById("skipTurnBtn"),
        hintBox: document.getElementById("hintBox"),
        hintText: document.getElementById("hintText"),
        showAnswerBox: document.getElementById("showAnswerBox"),
        showAnswerText: document.getElementById("showAnswerText"),
        turnStatus: document.getElementById("turnStatus"),
        answerReveal: document.getElementById("answerReveal"),
        revealResult: document.getElementById("revealResult"),
        nextCardBtn: document.getElementById("nextCardBtn"),
        finalScoreLine: document.getElementById("finalScoreLine"),
        winnerLine: document.getElementById("winnerLine"),
        restartBtn: document.getElementById("restartBtn"),
      };

      const state = {
        cards: [],
        currentIndex: 0,
        phase: "loading",
        scores: [0, 0],
        teamCorrect: [false, false],
        currentTeam: 0,
        timerValue: TURN_SECONDS,
        timerInterval: null,
        timerDeadlineTs: null,
        hintVisible: false,
        showAnswerVisible: false,
        statusText: "",
        statusTone: "",
        isAdvancing: false,
      };
      let pendingResumeState = null;

      function normalizeCell(value) {
        return String(value || "").trim();
      }

      function resolveApiBaseUrl() {
        const configuredBaseUrl = normalizeCell(window.TASLEYA_API_BASE_URL);
        if (!configuredBaseUrl) {
          return DEFAULT_WORKER_API_BASE_URL;
        }
        return configuredBaseUrl.replace(/\/+$/, "");
      }

      async function apiFetchJson(path) {
        const baseUrl = resolveApiBaseUrl();
        const response = await fetch(`${baseUrl}${path}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch (_) {
          payload = null;
        }

        if (!response.ok) {
          const message = payload && payload.error ? payload.error : "تعذر تحميل بيانات اللعبة.";
          throw new Error(message);
        }

        return payload;
      }

      async function loadEmojiMoviesCards() {
        const payload = await apiFetchJson("/emoji-movies/cards");
        const cards = Array.isArray(payload && payload.cards) ? payload.cards : [];
        return cards
          .map((card) => {
            const answer = normalizeCell(card && card.answer);
            const aliases = Array.isArray(card && card.aliases)
              ? card.aliases.map((alias) => normalizeCell(alias)).filter(Boolean)
              : [];

            return {
              id: normalizeCell(card && card.id),
              emoji: normalizeCell(card && card.emoji),
              answer,
              difficulty: Number.isFinite(card && card.difficulty) ? card.difficulty : null,
              contentType: normalizeCell(card && card.content_type),
              hint: normalizeCell(card && card.hint),
              points: Number.isFinite(card && card.points) ? card.points : 100,
              acceptedAnswers: [answer, ...aliases],
            };
          })
          .filter((card) => card.emoji && card.answer);
      }

      function normalizeArabicAnswer(value) {
        return String(value || "")
          .trim()
          .toLowerCase()
          .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
          .replace(/\u0640/g, "")
          .replace(/[أإآٱ]/g, "ا")
          .replace(/ى/g, "ي")
          .replace(/ة/g, "ه")
          .replace(/["'“”‘’«»`´]/g, "")
          .replace(/[\p{P}\p{S}]/gu, " ")
          .replace(/\s+/g, " ")
          .trim();
      }

      function buildCardContentKey(card) {
        const normalizedAnswer = normalizeArabicAnswer(card && card.answer);
        const normalizedEmoji = normalizeCell(card && card.emoji);
        return `${normalizedAnswer}||${normalizedEmoji}`;
      }

      function dedupePlayableCards(cards) {
        const validCards = Array.isArray(cards) ? cards.filter((card) => card && card.emoji && card.answer) : [];
        const seenById = new Set();
        const seenByContent = new Set();
        const deduped = [];

        validCards.forEach((card) => {
          const normalizedId = normalizeCell(card.id);
          const contentKey = buildCardContentKey(card);
          if (!contentKey) return;

          if (normalizedId) {
            if (seenById.has(normalizedId)) return;
            seenById.add(normalizedId);
          }
          if (seenByContent.has(contentKey)) return;
          seenByContent.add(contentKey);
          deduped.push(card);
        });

        return deduped;
      }

      function getRecentScopeKey() {
        if (!recentHistory || typeof recentHistory.buildScopeKey !== "function") return "";
        return recentHistory.buildScopeKey("emoji-movies", { level: "all" });
      }

      function setTurnStatus(text, tone) {
        state.statusText = text || "";
        state.statusTone = tone || "";
        elements.turnStatus.textContent = state.statusText;
        elements.turnStatus.className = `status${state.statusTone ? ` ${state.statusTone}` : ""}`;
      }

      function showBriefStatus(text, tone = "") {
        setTurnStatus(text, tone);
        window.setTimeout(() => {
          if (state.statusText === text) {
            setTurnStatus("", "");
            saveGameSnapshot();
          }
        }, 1800);
      }

      function showExhaustionNotice() {
        setTurnStatus(EXHAUSTION_NOTICE_TEXT, "");
        window.setTimeout(() => {
          if (state.statusText === EXHAUSTION_NOTICE_TEXT) {
            setTurnStatus("", "");
            saveGameSnapshot();
          }
        }, 3200);
      }

      function isCorrectAnswer(submittedAnswer, card) {
        const normalizedSubmitted = normalizeArabicAnswer(submittedAnswer);
        if (!normalizedSubmitted) return false;

        const validAnswers = new Set(card.acceptedAnswers.map((item) => normalizeArabicAnswer(item)).filter(Boolean));
        return validAnswers.has(normalizedSubmitted);
      }

      function shuffleArray(items) {
        const clone = [...items];
        for (let i = clone.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [clone[i], clone[j]] = [clone[j], clone[i]];
        }
        return clone;
      }

      function clearTimer() {
        if (state.timerInterval) {
          clearInterval(state.timerInterval);
          state.timerInterval = null;
        }
        state.timerDeadlineTs = null;
      }

      function clearSavedGame() {
        try {
          localStorage.removeItem(EMOJI_MOVIES_STORAGE_KEY);
        } catch (_) {}
      }

      function saveGameSnapshot() {
        if (state.phase === "loading" || state.phase === "error" || state.phase === "final") {
          clearSavedGame();
          return;
        }
        try {
          const payload = {
            version: EMOJI_MOVIES_STORAGE_VERSION,
            phase: state.phase,
            cards: state.cards,
            currentIndex: state.currentIndex,
            scores: state.scores,
            teamCorrect: state.teamCorrect,
            currentTeam: state.currentTeam,
            timerValue: state.timerValue,
            timerDeadlineTs: state.timerDeadlineTs,
            hintVisible: state.hintVisible,
            showAnswerVisible: state.showAnswerVisible,
            statusText: state.statusText,
            statusTone: state.statusTone,
            savedAt: Date.now(),
          };
          localStorage.setItem(EMOJI_MOVIES_STORAGE_KEY, JSON.stringify(payload));
        } catch (_) {}
      }

      function loadSavedGame() {
        try {
          const raw = localStorage.getItem(EMOJI_MOVIES_STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.version !== EMOJI_MOVIES_STORAGE_VERSION || !Array.isArray(parsed.cards) || !parsed.cards.length) return null;
          return parsed;
        } catch (_) {
          return null;
        }
      }

      function updateScoreboard() {
        elements.team1Score.textContent = String(state.scores[0]);
        elements.team2Score.textContent = String(state.scores[1]);

        elements.team1ScoreCard.classList.toggle("active", state.phase === "team1");
        elements.team2ScoreCard.classList.toggle("active", state.phase === "team2");
      }

      function setVisibleScreen(name) {
        elements.loadingScreen.classList.toggle("hidden", name !== "loading");
        elements.errorScreen.classList.toggle("hidden", name !== "error");
        elements.playScreen.classList.toggle("hidden", name !== "play");
        elements.revealScreen.classList.toggle("hidden", name !== "reveal");
        elements.finalScreen.classList.toggle("hidden", name !== "final");
      }

      function getCurrentCard() {
        return state.cards[state.currentIndex] || null;
      }

      function shouldShowSkipTurnButton() {
        if (state.phase !== "team1" && state.phase !== "team2") return false;
        return state.showAnswerVisible || state.statusTone === "success";
      }

      function updateSkipTurnButtonVisibility() {
        const shouldShow = shouldShowSkipTurnButton();
        elements.skipTurnBtn.classList.toggle("hidden", !shouldShow);
        elements.skipTurnBtn.disabled = !shouldShow || state.isAdvancing;
      }

      function advanceAfterCurrentTurn() {
        if (state.isAdvancing || (state.phase !== "team1" && state.phase !== "team2")) return;
        state.isAdvancing = true;
        updateSkipTurnButtonVisibility();
        clearTimer();

        if (state.showAnswerVisible) {
          const nextTeam = state.currentTeam === 0 ? 1 : 0;
          advanceToTeamTurnWithFreshCard(nextTeam);
          return;
        }

        if (state.currentTeam === 0) {
          startTeamTurn(1);
        } else {
          revealCurrentCard();
        }
      }

      function startTeamTurn(teamIndex) {
        const card = getCurrentCard();
        if (!card) return;

        state.isAdvancing = false;
        state.phase = teamIndex === 0 ? "team1" : "team2";
        state.currentTeam = teamIndex;
        state.timerValue = TURN_SECONDS;
        clearTimer();
        updateScoreboard();

        elements.turnTitle.textContent = teamIndex === 0 ? "دور الفريق 1" : "دور الفريق 2";
        elements.emojiText.textContent = card.emoji;
        elements.timerLabel.textContent = `${state.timerValue} ثانية`;
        setTurnStatus("", "");
        elements.hintBox.classList.add("hidden");
        elements.hintText.textContent = "";
        state.hintVisible = false;
        elements.showAnswerBox.classList.add("hidden");
        elements.showAnswerText.textContent = "";
        state.showAnswerVisible = false;
        elements.answerInput.value = "";
        updateSkipTurnButtonVisibility();

        setVisibleScreen("play");
        elements.answerInput.focus();
        state.timerDeadlineTs = Date.now() + TURN_SECONDS * 1000;

        state.timerInterval = window.setInterval(() => {
          state.timerValue = Math.max(0, Math.ceil((state.timerDeadlineTs - Date.now()) / 1000));
          elements.timerLabel.textContent = `${state.timerValue} ثانية`;
          saveGameSnapshot();

          if (state.timerValue <= 0) {
            clearTimer();
            if (teamIndex === 0) {
              startTeamTurn(1);
            } else {
              revealCurrentCard();
            }
          }
        }, 1000);
      }

      function getRevealMessage(points, team1Correct, team2Correct) {
        if (team1Correct && team2Correct) {
          return `حصل الفريقان على ${points} نقطة`;
        }
        if (team1Correct) {
          return `حصل الفريق 1 على ${points} نقطة`;
        }
        if (team2Correct) {
          return `حصل الفريق 2 على ${points} نقطة`;
        }
        return "لم يحصل أي فريق على نقاط";
      }

      function revealCurrentCard() {
        const card = getCurrentCard();
        if (!card) return;

        state.isAdvancing = false;
        state.phase = "reveal";
        clearTimer();

        if (state.teamCorrect[0]) {
          state.scores[0] += card.points;
        }
        if (state.teamCorrect[1]) {
          state.scores[1] += card.points;
        }

        updateScoreboard();
        elements.answerReveal.textContent = `الإجابة: ${card.answer}`;
        elements.revealResult.textContent = getRevealMessage(card.points, state.teamCorrect[0], state.teamCorrect[1]);
        setVisibleScreen("reveal");
        updateSkipTurnButtonVisibility();
        saveGameSnapshot();
      }

      function advanceToTeamTurnWithFreshCard(nextTeamIndex) {
        state.currentIndex += 1;
        state.teamCorrect = [false, false];

        if (state.currentIndex >= state.cards.length) {
          showFinalScreen();
          return;
        }

        startTeamTurn(nextTeamIndex);
      }

      function goToNextCard() {
        advanceToTeamTurnWithFreshCard(0);
      }

      function showFinalScreen() {
        clearTimer();
        state.isAdvancing = false;
        state.phase = "final";
        const [team1, team2] = state.scores;

        elements.finalScoreLine.textContent = `الفريق 1: ${team1} — الفريق 2: ${team2}`;
        if (team1 > team2) {
          elements.winnerLine.textContent = "فاز الفريق 1";
        } else if (team2 > team1) {
          elements.winnerLine.textContent = "فاز الفريق 2";
        } else {
          elements.winnerLine.textContent = "تعادل";
        }

        setVisibleScreen("final");
        updateScoreboard();
        updateSkipTurnButtonVisibility();
        clearSavedGame();
      }

      function startNewGame(cards) {
        clearSavedGame();
        clearTimer();
        const source = Array.isArray(cards) ? cards : [];
        const scopeKey = getRecentScopeKey();
        const recentIds = scopeKey && recentHistory ? new Set(recentHistory.getRecentIds(scopeKey)) : new Set();
        let available = source.filter((card) => {
          const cardId = normalizeCell(card && card.id);
          return cardId && !recentIds.has(cardId);
        });
        if (!available.length) {
          if (scopeKey && recentHistory) recentHistory.clearRecentIds(scopeKey);
          available = source.slice();
          if (available.length) showExhaustionNotice();
        }
        state.cards = shuffleArray(available);
        if (scopeKey && recentHistory) {
          state.cards.forEach((card) => recentHistory.markRecentId(scopeKey, normalizeCell(card.id), RECENT_LIMIT));
        }
        state.currentIndex = 0;
        state.scores = [0, 0];
        state.teamCorrect = [false, false];
        startTeamTurn(0);
        saveGameSnapshot();
      }

      function renderRestoredPlayingState() {
        const card = getCurrentCard();
        if (!card) return false;
        updateScoreboard();
        elements.turnTitle.textContent = state.currentTeam === 0 ? "دور الفريق 1" : "دور الفريق 2";
        elements.emojiText.textContent = card.emoji;
        elements.timerLabel.textContent = `${state.timerValue} ثانية`;
        elements.turnStatus.textContent = state.statusText || "";
        elements.turnStatus.className = `status${state.statusTone ? ` ${state.statusTone}` : ""}`;
        elements.hintText.textContent = state.hintVisible ? normalizeCell(card.hint) || "لا يوجد تلميح متاح لهذه البطاقة." : "";
        elements.hintBox.classList.toggle("hidden", !state.hintVisible);
        elements.showAnswerText.textContent = state.showAnswerVisible ? card.answer : "";
        elements.showAnswerBox.classList.toggle("hidden", !state.showAnswerVisible);
        state.isAdvancing = false;
        updateSkipTurnButtonVisibility();
        setVisibleScreen("play");
        if (state.timerValue > 0) {
          state.timerInterval = window.setInterval(() => {
            state.timerValue = Math.max(0, Math.ceil((state.timerDeadlineTs - Date.now()) / 1000));
            elements.timerLabel.textContent = `${state.timerValue} ثانية`;
            saveGameSnapshot();
            if (state.timerValue <= 0) {
              clearTimer();
              if (state.currentTeam === 0) startTeamTurn(1);
              else revealCurrentCard();
            }
          }, 1000);
        } else if (state.currentTeam === 0) {
          startTeamTurn(1);
        } else {
          revealCurrentCard();
        }
        return true;
      }

      function restoreSavedGame(saved) {
        state.cards = saved.cards;
        state.currentIndex = Number(saved.currentIndex) || 0;
        state.phase = String(saved.phase || "");
        state.scores = Array.isArray(saved.scores) ? [Number(saved.scores[0]) || 0, Number(saved.scores[1]) || 0] : [0, 0];
        state.teamCorrect = Array.isArray(saved.teamCorrect) ? [Boolean(saved.teamCorrect[0]), Boolean(saved.teamCorrect[1])] : [false, false];
        state.currentTeam = Number(saved.currentTeam) === 1 ? 1 : 0;
        state.statusText = normalizeCell(saved.statusText);
        state.statusTone = normalizeCell(saved.statusTone);
        state.hintVisible = Boolean(saved.hintVisible);
        state.showAnswerVisible = Boolean(saved.showAnswerVisible);
        if (state.currentIndex < 0 || state.currentIndex >= state.cards.length) return false;
        if (state.phase === "reveal") {
          updateScoreboard();
          const card = getCurrentCard();
          elements.answerReveal.textContent = `الإجابة: ${card.answer}`;
          elements.revealResult.textContent = getRevealMessage(card.points, state.teamCorrect[0], state.teamCorrect[1]);
          setVisibleScreen("reveal");
          saveGameSnapshot();
          return true;
        }
        if (state.phase !== "team1" && state.phase !== "team2") return false;
        const deadline = Number(saved.timerDeadlineTs);
        state.timerDeadlineTs = Number.isFinite(deadline) ? deadline : Date.now() + TURN_SECONDS * 1000;
        state.timerValue = Math.max(0, Math.ceil((state.timerDeadlineTs - Date.now()) / 1000));
        return renderRestoredPlayingState();
      }

      elements.answerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const card = getCurrentCard();
        if (!card || (state.phase !== "team1" && state.phase !== "team2")) return;

        const answer = elements.answerInput.value;
        const correct = isCorrectAnswer(answer, card);

        if (!correct) {
          elements.turnStatus.textContent = "غير صحيح، جرّب مرة أخرى";
          elements.turnStatus.className = "status error";
          state.statusText = elements.turnStatus.textContent;
          state.statusTone = "error";
          elements.answerInput.value = "";
          elements.answerInput.focus();
          updateSkipTurnButtonVisibility();
          saveGameSnapshot();
          return;
        }

        state.teamCorrect[state.currentTeam] = true;
        clearTimer();
        elements.answerInput.value = "";

        if (state.currentTeam === 0) {
          elements.turnStatus.textContent = "تم تسجيل إجابة الفريق";
          elements.turnStatus.className = "status success";
          state.statusText = elements.turnStatus.textContent;
          state.statusTone = "success";
          updateSkipTurnButtonVisibility();
          saveGameSnapshot();
          window.setTimeout(() => startTeamTurn(1), 450);
          return;
        }

        revealCurrentCard();
      });

      elements.hintBtn.addEventListener("click", () => {
        const card = getCurrentCard();
        if (!card || (state.phase !== "team1" && state.phase !== "team2")) return;

        const hint = normalizeCell(card.hint);
        elements.hintText.textContent = hint || "لا يوجد تلميح متاح لهذه البطاقة.";
        elements.hintBox.classList.remove("hidden");
        state.hintVisible = true;
        showBriefStatus("تم إظهار التلميح.");
        saveGameSnapshot();
      });

      elements.showAnswerBtn.addEventListener("click", () => {
        const card = getCurrentCard();
        if (!card || (state.phase !== "team1" && state.phase !== "team2")) return;

        elements.showAnswerText.textContent = card.answer;
        elements.showAnswerBox.classList.remove("hidden");
        state.showAnswerVisible = true;
        showBriefStatus("تم إظهار الإجابة.");
        updateSkipTurnButtonVisibility();
        saveGameSnapshot();
      });

      elements.skipTurnBtn.addEventListener("click", () => {
        advanceAfterCurrentTurn();
      });

      elements.nextCardBtn.addEventListener("click", () => {
        goToNextCard();
      });

      elements.restartBtn.addEventListener("click", () => {
        startNewGame(state.cards);
      });

      async function init() {
        try {
          const cards = dedupePlayableCards(await loadEmojiMoviesCards());
          if (!cards.length) {
            throw new Error("لم يتم العثور على بطاقات صالحة في ملف البيانات.");
          }
          pendingResumeState = loadSavedGame();
          if (pendingResumeState) {
            elements.resumePrompt.classList.remove("hidden");
            state.cards = cards;
            setVisibleScreen("loading");
          } else {
            startNewGame(cards);
          }
        } catch (error) {
          clearTimer();
          elements.errorScreen.textContent = error && error.message ? error.message : "حدث خطأ أثناء تحميل اللعبة.";
          setVisibleScreen("error");
        }
      }

      elements.resumeBtn.addEventListener("click", () => {
        if (!pendingResumeState || !restoreSavedGame(pendingResumeState)) {
          clearSavedGame();
          startNewGame(state.cards);
        }
        pendingResumeState = null;
        elements.resumePrompt.classList.add("hidden");
      });
      elements.discardResumeBtn.addEventListener("click", () => {
        clearSavedGame();
        pendingResumeState = null;
        elements.resumePrompt.classList.add("hidden");
        startNewGame(state.cards);
      });


    init();
  };
})();
