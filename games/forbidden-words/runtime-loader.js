(function () {
  const contentView = document.getElementById('forbiddenWordsContentView');
  const gameplayView = document.getElementById('forbiddenWordsGameplayView');
  const backToIntroBtn = document.getElementById('backToForbiddenWordsIntroBtn');
  const host = document.getElementById('forbiddenRuntimeHost');
  const enterBtn = document.getElementById('enterForbiddenSetupBtn');
  let mounted = false;
  let mounting = false;
  let initialized = false;

  function showContentView() {
    if (contentView) contentView.classList.remove('hidden');
    if (gameplayView) gameplayView.classList.add('hidden');
  }

  function showGameplayView() {
    if (contentView) contentView.classList.add('hidden');
    if (gameplayView) gameplayView.classList.remove('hidden');
  }

  async function mountRuntime() {
    if (mounted || mounting) return;
    mounting = true;
    try {
      const response = await fetch('/games/forbidden-words/runtime-fragment.html', { cache: 'no-store' });
      if (!response.ok) throw new Error(`FORBIDDEN_RUNTIME_LOAD_FAILED_${response.status}`);
      host.innerHTML = await response.text();
      mounted = true;
    } finally {
      mounting = false;
    }
  }

  function initRuntime() {
    if (initialized) return;
    initialized = true;
      const WORKER_URL_PLACEHOLDER = "https://REPLACE_WITH_YOUR_WORKER_URL";
      const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";

      const fallbackCards = [
        {
          word: "بيتزا",
          difficulty: 1,
          points: 1,
          forbidden: ["جبن", "إيطاليا", "عجينة", "فرن", "مطعم"]
        },
        {
          word: "كرة القدم",
          difficulty: 2,
          points: 2,
          forbidden: ["هدف", "ملعب", "لاعب", "حكم", "فريق"]
        }
      ];

      const TERMS_PER_TEAM = 10;
      const TURN_TIME_SECONDS = 30;
      const REQUIRED_PER_DIFFICULTY = 2;
      const DIFFICULTIES = [1, 2, 3, 4, 5];
      const STORAGE_KEY = "tasleya_forbidden_words_state";
      const STORAGE_VERSION = 1;
      const USED_HISTORY_KEY = "tasleya_forbidden_words_used_v1";
      const USED_HISTORY_VERSION = 1;

      let cards = [];

      const state = {
        teams: [
          { name: "الفريق 1", score: 0, deck: [], usedCount: 0 },
          { name: "الفريق 2", score: 0, deck: [], usedCount: 0 }
        ],
        activeTeamIndex: 0,
        revealed: false,
        timerRunning: false,
        timerId: null,
        remaining: TURN_TIME_SECONDS,
        currentCard: null,
        gameStarted: false,
        gameFinished: false,
        timerStarted: false,
        termTimeExpired: false
      };

      const setupScreen = document.getElementById("setup-screen");
      const resumeScreen = document.getElementById("resume-screen");
      const turnScreen = document.getElementById("turn-screen");
      const finalScreen = document.getElementById("final-screen");

      const cardsStatus = document.getElementById("cards-status");
      const startGameBtn = document.getElementById("start-game");
      const scoreStrip = document.getElementById("score-strip");
      const activeTeamMeta = document.getElementById("active-team-meta");
      const termMeta = document.getElementById("term-meta");
      const difficultyMeta = document.getElementById("difficulty-meta");
      const preRevealText = document.getElementById("pre-reveal-text");
      const preRevealPanel = document.getElementById("pre-reveal-panel");
      const revealedPanel = document.getElementById("revealed-panel");
      const btnReveal = document.getElementById("btn-reveal");
      const mainWord = document.getElementById("main-word");
      const forbiddenList = document.getElementById("forbidden-list");
      const timerEl = document.getElementById("timer");
      const timerValueEl = timerEl.querySelector("span:last-child");
      const btnCorrect = document.getElementById("btn-correct");
      const btnWrong = document.getElementById("btn-wrong");
      const btnOtherTeam = document.getElementById("btn-other-team");
      const winnerLine = document.getElementById("winner-line");
      const finalBoard = document.getElementById("final-board");
      const playAgainBtn = document.getElementById("play-again");
      const resumeGameBtn = document.getElementById("resume-game");
      const newGameBtn = document.getElementById("new-game");

      let pendingResumeState = null;

      const soundFiles = {
        timerWarning: "/assets/sounds/timer-warning.mp3"
      };

      const audioState = {
        enabled: true,
        unlocked: false,
        timerWarning: null,
        timerWarningPlaying: false
      };

      function normalizeValue(value) {
        return (value || "").replace(/^\uFEFF/, "").trim();
      }

      function getConfiguredApiBaseUrl() {
        const configuredBaseUrl = normalizeValue(window.TASLEYA_API_BASE_URL);
        if (!configuredBaseUrl || configuredBaseUrl === WORKER_URL_PLACEHOLDER) {
          return DEFAULT_WORKER_API_BASE_URL;
        }
        return configuredBaseUrl.replace(/\/+$/, "");
      }

      function buildApiUrl(path) {
        return new URL(`${getConfiguredApiBaseUrl()}${path}`, window.location.origin);
      }

      async function apiFetchJson(path) {
        const response = await fetch(buildApiUrl(path), { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = normalizeValue(payload?.error) || "تعذر تحميل كلمات اللعبة.";
          throw new Error(message);
        }
        return payload;
      }

      function shuffle(array) {
        for (let i = array.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      }

      async function loadCards() {
        cardsStatus.className = "status-text";
        cardsStatus.textContent = "جاري تحميل كلمات اللعبة...";
        startGameBtn.disabled = true;

        try {
          const payload = await apiFetchJson("/forbidden-words/cards");
          const parsed = Array.isArray(payload?.cards) ? payload.cards : [];
          if (!parsed.length) {
            throw new Error("No valid rows");
          }
          cards = parsed;
          cardsStatus.textContent = "تم تحميل الكلمات بنجاح.";
        } catch (error) {
          cards = [...fallbackCards];
          cardsStatus.className = "status-text error";
          cardsStatus.textContent = "تعذر تحميل كلمات Google Sheet. تم تفعيل بيانات احتياطية محدودة جدًا.";
        } finally {
          startGameBtn.disabled = false;
        }
      }

      function stopTimerWarningSound() {
        if (!audioState.timerWarning) return;
        audioState.timerWarning.pause();
        audioState.timerWarning.currentTime = 0;
        audioState.timerWarningPlaying = false;
      }

      function ensureAudioReady() {
        if (audioState.unlocked || !audioState.enabled) return;
        try {
          audioState.timerWarning = new Audio(soundFiles.timerWarning);
          audioState.timerWarning.preload = "auto";
          audioState.timerWarning.loop = true;
          audioState.unlocked = true;
        } catch (error) {
          audioState.enabled = false;
          stopTimerWarningSound();
        }
      }

      function playTimerWarning() {
        if (!audioState.enabled || !audioState.timerWarning || audioState.timerWarningPlaying) return;
        const promise = audioState.timerWarning.play();
        audioState.timerWarningPlaying = true;
        if (promise && typeof promise.catch === "function") {
          promise.catch(() => {
            audioState.timerWarningPlaying = false;
          });
        }
      }

      function stopTimer() {
        if (state.timerId) {
          clearInterval(state.timerId);
          state.timerId = null;
        }
        state.timerRunning = false;
        stopTimerWarningSound();
      }

      function cloneCard(card) {
        if (!card || typeof card !== "object") return null;
        if (!card.word || !Array.isArray(card.forbidden)) return null;
        return {
          id: card.id == null ? "" : String(card.id),
          word: String(card.word),
          difficulty: Number(card.difficulty) || 1,
          points: Number(card.points) || 1,
          forbidden: card.forbidden.map((item) => String(item || ""))
        };
      }

      function difficultyKey(difficulty) {
        const normalized = Number(difficulty);
        if (!Number.isInteger(normalized) || normalized < 1 || normalized > 5) return null;
        return String(normalized);
      }

      function createEmptyUsedHistory() {
        return {
          version: USED_HISTORY_VERSION,
          byDifficulty: {
            "1": [],
            "2": [],
            "3": [],
            "4": [],
            "5": []
          }
        };
      }

      function normalizeUsedHistory(raw) {
        const history = createEmptyUsedHistory();
        if (!raw || typeof raw !== "object") return { history, changed: true };
        if (raw.version !== USED_HISTORY_VERSION || !raw.byDifficulty || typeof raw.byDifficulty !== "object") {
          return { history, changed: true };
        }

        let changed = false;
        DIFFICULTIES.forEach((difficulty) => {
          const key = String(difficulty);
          const list = raw.byDifficulty[key];
          if (!Array.isArray(list)) {
            changed = true;
            return;
          }
          const normalized = [];
          const seen = new Set();
          list.forEach((item) => {
            if (typeof item !== "string") {
              changed = true;
              return;
            }
            const trimmed = item.trim();
            if (!trimmed || seen.has(trimmed)) {
              changed = true;
              return;
            }
            seen.add(trimmed);
            normalized.push(trimmed);
          });
          history.byDifficulty[key] = normalized;
        });

        return {
          history,
          changed
        };
      }

      function readUsedHistory() {
        let raw = null;
        try {
          raw = localStorage.getItem(USED_HISTORY_KEY);
        } catch (error) {
          return createEmptyUsedHistory();
        }

        if (!raw) return createEmptyUsedHistory();

        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          const empty = createEmptyUsedHistory();
          writeUsedHistory(empty);
          return empty;
        }

        const normalized = normalizeUsedHistory(parsed);
        if (!normalized || !normalized.history) {
          const empty = createEmptyUsedHistory();
          writeUsedHistory(empty);
          return empty;
        }
        if (normalized.changed) {
          writeUsedHistory(normalized.history);
        }
        return normalized.history;
      }

      function writeUsedHistory(history) {
        try {
          localStorage.setItem(USED_HISTORY_KEY, JSON.stringify(history));
        } catch (error) {
          // Ignore storage failures.
        }
      }

      function getCardPersistentId(card) {
        const difficulty = difficultyKey(card?.difficulty) || "1";
        const rawId = card?.id == null ? "" : String(card.id).trim();
        if (rawId) return `id:${rawId}`;
        return `fallback:${String(card?.word || "").trim()}|${difficulty}`;
      }

      function markCardAsUsed(card) {
        if (!card) return;
        const key = difficultyKey(card.difficulty);
        if (!key) return;
        const termId = getCardPersistentId(card);
        const history = readUsedHistory();
        const bucket = history.byDifficulty[key];
        if (!Array.isArray(bucket)) {
          history.byDifficulty[key] = [termId];
          writeUsedHistory(history);
          return;
        }
        if (bucket.includes(termId)) return;
        bucket.push(termId);
        writeUsedHistory(history);
      }

      function clearSavedGameState() {
        localStorage.removeItem(STORAGE_KEY);
      }

      function createPersistedState() {
        if (!state.gameStarted) return null;
        return {
          version: STORAGE_VERSION,
          game: "forbidden-words",
          gameStarted: state.gameStarted,
          gameFinished: state.gameFinished,
          activeTeamIndex: state.activeTeamIndex,
          revealed: state.revealed,
          timerRunning: state.timerRunning,
          timerStarted: state.timerStarted,
          termTimeExpired: state.termTimeExpired,
          remaining: state.remaining,
          lastSavedAt: Date.now(),
          currentCard: cloneCard(state.currentCard),
          teams: state.teams.map((team) => ({
            name: team.name,
            score: team.score,
            usedCount: team.usedCount,
            deck: team.deck.map((card) => cloneCard(card))
          }))
        };
      }

      function persistGameState() {
        const snapshot = createPersistedState();
        if (!snapshot || state.gameFinished) {
          clearSavedGameState();
          return;
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch (error) {
          // Ignore storage failures.
        }
      }

      function readSavedGameState() {
        let raw = null;
        try {
          raw = localStorage.getItem(STORAGE_KEY);
        } catch (error) {
          return null;
        }
        if (!raw) return null;

        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          clearSavedGameState();
          return null;
        }

        const isValidGame = parsed && parsed.game === "forbidden-words" && parsed.version === STORAGE_VERSION;
        const validTeams = Array.isArray(parsed?.teams) && parsed.teams.length === 2;
        const validActive = Number.isInteger(parsed?.activeTeamIndex) && parsed.activeTeamIndex >= 0 && parsed.activeTeamIndex <= 1;
        const validRemaining = Number.isFinite(parsed?.remaining) && parsed.remaining >= 0;
        const validStarted = parsed?.gameStarted === true && parsed?.gameFinished !== true;

        if (!isValidGame || !validTeams || !validActive || !validRemaining || !validStarted) {
          clearSavedGameState();
          return null;
        }

        const normalizedTeams = parsed.teams.map((team, index) => {
          const validDeck = Array.isArray(team?.deck);
          const validUsedCount = Number.isInteger(team?.usedCount) && team.usedCount >= 0 && team.usedCount <= TERMS_PER_TEAM;
          const validScore = Number.isFinite(team?.score) && team.score >= 0;
          const validName = typeof team?.name === "string" && team.name.trim();
          if (!validDeck || !validUsedCount || !validScore || !validName || team.deck.length !== TERMS_PER_TEAM) return null;

          const normalizedDeck = team.deck.map((card) => cloneCard(card));
          if (normalizedDeck.some((card) => !card || card.forbidden.length !== 5 || card.forbidden.some((item) => !item))) return null;

          return {
            name: index === 0 ? "الفريق 1" : "الفريق 2",
            score: Math.floor(team.score),
            usedCount: team.usedCount,
            deck: normalizedDeck
          };
        });

        if (normalizedTeams.some((team) => team === null)) {
          clearSavedGameState();
          return null;
        }
        const seenTermIds = new Set();
        for (const team of normalizedTeams) {
          for (const card of team.deck) {
            const termId = getCardPersistentId(card);
            if (seenTermIds.has(termId)) {
              clearSavedGameState();
              return null;
            }
            seenTermIds.add(termId);
          }
        }

        const currentCard = cloneCard(parsed.currentCard);
        const timerStarted = parsed.timerStarted === true;
        const termTimeExpired = parsed.termTimeExpired === true;
        const timerRunning = parsed.timerRunning === true;
        const revealed = parsed.revealed === true;
        const allCompleted = normalizedTeams.every((team) => team.usedCount >= TERMS_PER_TEAM);
        if (allCompleted) {
          clearSavedGameState();
          return null;
        }

        return {
          teams: normalizedTeams,
          activeTeamIndex: parsed.activeTeamIndex,
          remaining: Math.max(0, Math.floor(parsed.remaining)),
          revealed,
          timerRunning,
          timerStarted,
          termTimeExpired,
          currentCard,
          lastSavedAt: Number(parsed.lastSavedAt) || Date.now()
        };
      }

      function showSetupScreen() {
        resumeScreen.classList.add("hidden");
        turnScreen.classList.add("hidden");
        finalScreen.classList.add("hidden");
        setupScreen.classList.remove("hidden");
      }

      function showResumeScreen() {
        setupScreen.classList.add("hidden");
        turnScreen.classList.add("hidden");
        finalScreen.classList.add("hidden");
        resumeScreen.classList.remove("hidden");
      }

      function formatTime(seconds) {
        const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
        const secs = String(seconds % 60).padStart(2, "0");
        return `${mins}:${secs}`;
      }

      function getOtherTeamIndex(index) {
        return index === 0 ? 1 : 0;
      }

      function activeTeam() {
        return state.teams[state.activeTeamIndex];
      }

      function termNumberForTeam(teamIndex) {
        return state.teams[teamIndex].usedCount + 1;
      }

      function remainingTermsForTeam(teamIndex) {
        return TERMS_PER_TEAM - state.teams[teamIndex].usedCount;
      }

      function renderScoreboard() {
        scoreStrip.innerHTML = "";
        state.teams.forEach((team, index) => {
          const li = document.createElement("li");
          if (index === state.activeTeamIndex && !state.gameFinished) {
            li.classList.add("current-team");
          }

          const name = document.createElement("span");
          name.className = "team-name";
          name.textContent = team.name;

          const score = document.createElement("span");
          score.className = "team-score";
          score.textContent = `${team.score} نقطة`;

          const meta = document.createElement("span");
          meta.className = "team-meta";
          meta.textContent = `المتبقي: ${remainingTermsForTeam(index)} مصطلح`;

          li.append(name, score, meta);
          scoreStrip.appendChild(li);
        });
      }

      function renderCurrentTurn() {
        renderScoreboard();
        const team = activeTeam();
        if (!state.currentCard) {
          updateCurrentCardFromDeck();
        }
        const card = state.currentCard;
        const hasCard = !!card;

        btnReveal.disabled = !hasCard || state.revealed;
        btnCorrect.disabled = !hasCard || !state.revealed;
        btnWrong.disabled = !hasCard || !state.revealed;
        btnOtherTeam.disabled = !hasCard || !state.revealed;

        activeTeamMeta.textContent = team.name;
        termMeta.textContent = `${termNumberForTeam(state.activeTeamIndex)} / ${TERMS_PER_TEAM}`;
        difficultyMeta.textContent = hasCard ? `${card.difficulty} / ${card.points}` : "— / —";
        preRevealText.textContent = `${team.name} — مصطلح رقم ${termNumberForTeam(state.activeTeamIndex)} من ${TERMS_PER_TEAM}`;

        timerValueEl.textContent = formatTime(state.remaining);
        timerEl.classList.toggle("low-time", state.remaining <= 10 && state.remaining > 0);

        if (!hasCard) {
          preRevealPanel.classList.remove("hidden");
          revealedPanel.classList.add("hidden");
          mainWord.textContent = "";
          forbiddenList.innerHTML = "";
          return;
        }

        if (state.revealed) {
          preRevealPanel.classList.add("hidden");
          revealedPanel.classList.remove("hidden");

          mainWord.textContent = card.word;
          forbiddenList.innerHTML = "";
          card.forbidden.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            forbiddenList.appendChild(li);
          });
        } else {
          preRevealPanel.classList.remove("hidden");
          revealedPanel.classList.add("hidden");
        }
      }

      function validateSourcePoolForGame() {
        const byDifficulty = new Map(DIFFICULTIES.map((d) => [d, []]));
        cards.forEach((card, index) => {
          if (byDifficulty.has(card.difficulty)) {
            byDifficulty.get(card.difficulty).push(index);
          }
        });

        const shortages = [];
        DIFFICULTIES.forEach((difficulty) => {
          const available = byDifficulty.get(difficulty).length;
          const requiredTotal = REQUIRED_PER_DIFFICULTY * 2;
          if (available < requiredTotal) {
            shortages.push(`المستوى ${difficulty}: المتاح ${available}، المطلوب ${requiredTotal}`);
          }
        });

        return {
          byDifficulty,
          shortages
        };
      }

      function buildDecksOrThrow() {
        const { byDifficulty, shortages } = validateSourcePoolForGame();
        if (shortages.length) {
          throw new Error(`لا توجد كلمات فريدة كافية لبدء هذه المباراة بدون تكرار.\n${shortages.join("\n")}`);
        }

        const usedHistory = readUsedHistory();
        const teamDecks = [[], []];
        const selectedTermIds = new Set();
        let usedHistoryChanged = false;

        DIFFICULTIES.forEach((difficulty) => {
          const difficultyId = String(difficulty);
          const usedBucket = new Set(usedHistory.byDifficulty[difficultyId] || []);
          const rawPool = shuffle([...byDifficulty.get(difficulty)]);
          const uniquePool = [];
          const seenInPool = new Set();
          rawPool.forEach((cardIndex) => {
            const termId = getCardPersistentId(cards[cardIndex]);
            if (seenInPool.has(termId)) return;
            seenInPool.add(termId);
            uniquePool.push(cardIndex);
          });

          const requiredTotal = REQUIRED_PER_DIFFICULTY * 2;
          if (uniquePool.length < requiredTotal) {
            throw new Error(`لا توجد كلمات كافية لبدء اللعبة.\nالمستوى ${difficulty}: المتاح ${uniquePool.length}، المطلوب ${requiredTotal}`);
          }

          let available = uniquePool.filter((cardIndex) => {
            const termId = getCardPersistentId(cards[cardIndex]);
            return !selectedTermIds.has(termId) && !usedBucket.has(termId);
          });

          if (available.length < requiredTotal) {
            usedHistory.byDifficulty[difficultyId] = [];
            usedHistoryChanged = true;
            available = uniquePool.filter((cardIndex) => {
              const termId = getCardPersistentId(cards[cardIndex]);
              return !selectedTermIds.has(termId);
            });
          }

          if (available.length < requiredTotal) {
            throw new Error(`لا توجد كلمات كافية لبدء اللعبة.\nالمستوى ${difficulty}: المتاح ${available.length}، المطلوب ${requiredTotal}`);
          }

          const selected = available.slice(0, requiredTotal);
          selected.forEach((cardIndex) => {
            selectedTermIds.add(getCardPersistentId(cards[cardIndex]));
          });
          const teamOneCards = shuffle(selected.slice(0, REQUIRED_PER_DIFFICULTY));
          const teamTwoCards = shuffle(selected.slice(REQUIRED_PER_DIFFICULTY, REQUIRED_PER_DIFFICULTY * 2));
          teamDecks[0].push(...teamOneCards);
          teamDecks[1].push(...teamTwoCards);
        });

        if (usedHistoryChanged) {
          writeUsedHistory(usedHistory);
        }
        state.teams[0].deck = shuffle(teamDecks[0]).map((cardIndex) => cards[cardIndex]);
        state.teams[1].deck = shuffle(teamDecks[1]).map((cardIndex) => cards[cardIndex]);
      }

      function updateCurrentCardFromDeck() {
        const team = activeTeam();
        state.currentCard = team.deck[team.usedCount] || null;
      }

      function isGameFinished() {
        return state.teams.every((team) => team.usedCount >= TERMS_PER_TEAM);
      }

      function goToNextTurn() {
        if (isGameFinished()) {
          finishGame();
          return;
        }

        state.activeTeamIndex = getOtherTeamIndex(state.activeTeamIndex);
        state.revealed = false;
        state.remaining = TURN_TIME_SECONDS;
        state.timerStarted = false;
        state.termTimeExpired = false;
        stopTimer();
        updateCurrentCardFromDeck();
        renderCurrentTurn();
        persistGameState();
      }

      function registerTermResult(resultType) {
        if (!state.gameStarted || !state.currentCard) return;
        stopTimer();

        const points = state.currentCard.points;
        const activeIndex = state.activeTeamIndex;
        const otherIndex = getOtherTeamIndex(activeIndex);

        if (resultType === "correct") {
          state.teams[activeIndex].score += points;
        } else if (resultType === "other") {
          state.teams[otherIndex].score += points;
        }

        state.teams[activeIndex].usedCount += 1;
        persistGameState();
        goToNextTurn();
      }

      function startRevealedTermTimer() {
        stopTimer();
        state.timerRunning = true;
        state.timerId = setInterval(() => {
          if (!state.timerRunning) return;
          state.remaining -= 1;
          timerValueEl.textContent = formatTime(Math.max(0, state.remaining));
          timerEl.classList.toggle("low-time", state.remaining <= 10 && state.remaining > 0);
          persistGameState();

          if (state.remaining <= 10 && state.remaining > 0) {
            playTimerWarning();
          }

          if (state.remaining <= 0) {
            state.remaining = 0;
            state.termTimeExpired = true;
            stopTimer();
            timerValueEl.textContent = formatTime(0);
            timerEl.classList.remove("low-time");
            persistGameState();
          }
        }, 1000);
      }

      function startGame() {
        ensureAudioReady();
        stopTimer();

        state.teams = [
          { name: "الفريق 1", score: 0, deck: [], usedCount: 0 },
          { name: "الفريق 2", score: 0, deck: [], usedCount: 0 }
        ];
        state.activeTeamIndex = 0;
        state.revealed = false;
        state.remaining = TURN_TIME_SECONDS;
        state.gameStarted = false;
        state.gameFinished = false;
        state.timerStarted = false;
        state.termTimeExpired = false;

        buildDecksOrThrow();
        updateCurrentCardFromDeck();
        state.gameStarted = true;

        setupScreen.classList.add("hidden");
        resumeScreen.classList.add("hidden");
        finalScreen.classList.add("hidden");
        turnScreen.classList.remove("hidden");
        renderCurrentTurn();
        persistGameState();
      }

      function finishGame() {
        stopTimer();
        state.gameFinished = true;

        turnScreen.classList.add("hidden");
        finalScreen.classList.remove("hidden");

        const teamOne = state.teams[0];
        const teamTwo = state.teams[1];

        if (teamOne.score === teamTwo.score) {
          winnerLine.textContent = "التعادل";
        } else {
          winnerLine.textContent = teamOne.score > teamTwo.score ? teamOne.name : teamTwo.name;
        }

        finalBoard.innerHTML = "";
        state.teams.forEach((team) => {
          const li = document.createElement("li");
          const name = document.createElement("span");
          name.className = "team-name";
          name.textContent = team.name;

          const score = document.createElement("span");
          score.className = "team-score";
          score.textContent = `${team.score} نقطة`;

          const meta = document.createElement("span");
          meta.className = "team-meta";
          meta.textContent = `مصطلحات منجزة: ${team.usedCount} / ${TERMS_PER_TEAM}`;

          li.append(name, score, meta);
          finalBoard.appendChild(li);
        });

        clearSavedGameState();
      }

      function restoreSavedGame(saved) {
        stopTimer();
        state.teams = saved.teams;
        state.activeTeamIndex = saved.activeTeamIndex;
        state.revealed = saved.revealed;
        state.gameStarted = true;
        state.gameFinished = false;
        state.timerStarted = saved.timerStarted;
        state.termTimeExpired = saved.termTimeExpired;
        state.remaining = saved.remaining;
        state.currentCard = saved.currentCard;

        const elapsed = Math.max(0, Math.floor((Date.now() - saved.lastSavedAt) / 1000));
        if (saved.timerRunning && state.timerStarted && !state.termTimeExpired && state.remaining > 0) {
          state.remaining = Math.max(0, state.remaining - elapsed);
          if (state.remaining === 0) {
            state.termTimeExpired = true;
            state.timerRunning = false;
          }
        }

        if (!state.currentCard) {
          updateCurrentCardFromDeck();
        }
        const activeDeckCard = state.teams[state.activeTeamIndex].deck[state.teams[state.activeTeamIndex].usedCount] || null;
        if (!activeDeckCard || !state.currentCard || activeDeckCard.word !== state.currentCard.word) {
          state.currentCard = activeDeckCard;
        }

        setupScreen.classList.add("hidden");
        resumeScreen.classList.add("hidden");
        finalScreen.classList.add("hidden");
        turnScreen.classList.remove("hidden");
        renderCurrentTurn();

        if (saved.timerRunning && state.timerStarted && !state.termTimeExpired && state.revealed && state.remaining > 0) {
          startRevealedTermTimer();
        } else {
          state.timerRunning = false;
          stopTimerWarningSound();
        }

        persistGameState();
      }

      btnReveal.addEventListener("click", () => {
        if (!state.currentCard) return;
        ensureAudioReady();
        markCardAsUsed(state.currentCard);
        state.revealed = true;
        state.remaining = TURN_TIME_SECONDS;
        state.timerStarted = true;
        state.termTimeExpired = false;
        renderCurrentTurn();
        persistGameState();
        startRevealedTermTimer();
      });

      btnCorrect.addEventListener("click", () => registerTermResult("correct"));
      btnWrong.addEventListener("click", () => registerTermResult("wrong"));
      btnOtherTeam.addEventListener("click", () => registerTermResult("other"));

      startGameBtn.addEventListener("click", () => {
        try {
          startGame();
          cardsStatus.className = "status-text";
          cardsStatus.textContent = "";
        } catch (error) {
          cardsStatus.className = "status-text error";
          cardsStatus.textContent = error.message;
        }
      });

      playAgainBtn.addEventListener("click", () => {
        clearSavedGameState();
        try {
          startGame();
        } catch (error) {
          setupScreen.classList.remove("hidden");
          turnScreen.classList.add("hidden");
          finalScreen.classList.add("hidden");
          cardsStatus.className = "status-text error";
          cardsStatus.textContent = error.message;
        }
      });

      resumeGameBtn.addEventListener("click", () => {
        if (!pendingResumeState) {
          showSetupScreen();
          return;
        }
        restoreSavedGame(pendingResumeState);
        pendingResumeState = null;
      });

      newGameBtn.addEventListener("click", () => {
        pendingResumeState = null;
        clearSavedGameState();
        showSetupScreen();
      });

      window.addEventListener("pagehide", () => {
        persistGameState();
        stopTimer();
      });
      window.addEventListener("beforeunload", () => {
        persistGameState();
        stopTimer();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopTimerWarningSound();
      });

      loadCards().then(() => {
        pendingResumeState = readSavedGameState();
        if (pendingResumeState) {
          showResumeScreen();
        } else {
          showSetupScreen();
        }
      });
  }

  enterBtn.addEventListener('click', async () => {
    enterBtn.disabled = true;
    try {
      await mountRuntime();
      showGameplayView();
      initRuntime();
      const setupScreen = document.getElementById('setup-screen');
      if (setupScreen) setupScreen.classList.remove('hidden');
    } catch (error) {
      console.error('[forbidden-words] failed to mount runtime', error);
      enterBtn.disabled = false;
      showContentView();
    }
  });

  if (backToIntroBtn) {
    backToIntroBtn.addEventListener('click', () => {
      showContentView();
    });
  }
})();
