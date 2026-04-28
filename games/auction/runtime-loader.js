      const auctionIntro = document.getElementById("auctionIntro");
      const auctionRuntimeHost = document.getElementById("auctionRuntimeHost");
      const AUCTION_RUNTIME_FRAGMENT_URL = "/games/auction/runtime-fragment.html";
      const AUCTION_DEPENDENCY_LOAD_ERROR = "تعذر تجهيز اللعبة. حاول تحديث الصفحة أو فتحها مرة أخرى.";
      const AUCTION_LOCAL_DEPENDENCY_SCRIPTS = [
        "/games/auction/data.js",
        "/games/shared/recent-history.js",
      ];
      const AUCTION_ONLINE_DEPENDENCY_SCRIPTS = [
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
        "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js",
        "/firebase-config.js",
        "/games/shared/game-rooms.js",
      ];
      const scriptLoadPromises = new Map();
      let auctionRuntimeMounted = false;
      let auctionRuntimeMounting = false;
      let auctionAppInitialized = false;

      async function mountAuctionRuntime() {
        if (auctionRuntimeMounted || auctionRuntimeMounting) return;
        auctionRuntimeMounting = true;
        try {
          const response = await fetch(AUCTION_RUNTIME_FRAGMENT_URL, { cache: "no-store" });
          if (!response.ok) throw new Error(`AUCTION_RUNTIME_LOAD_FAILED_${response.status}`);
          auctionRuntimeHost.innerHTML = await response.text();
          auctionRuntimeMounted = true;
        } finally {
          auctionRuntimeMounting = false;
        }
      }

      function loadScriptOnce(src) {
        if (scriptLoadPromises.has(src)) return scriptLoadPromises.get(src);
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing && existing.dataset.loaded === "true") return Promise.resolve();
        if (existing && !existing.dataset.auctionLoaderManaged) return Promise.resolve();

        const script = existing || document.createElement("script");
        const promise = new Promise((resolve, reject) => {
          const done = () => {
            script.dataset.loaded = "true";
            scriptLoadPromises.delete(src);
            resolve();
          };
          const fail = () => {
            script.dataset.loaded = "false";
            scriptLoadPromises.delete(src);
            reject(new Error(`AUCTION_SCRIPT_LOAD_FAILED: ${src}`));
          };

          script.addEventListener("load", done, { once: true });
          script.addEventListener("error", fail, { once: true });

          if (!existing) {
            script.src = src;
            script.async = false;
            script.dataset.auctionLoaderManaged = "true";
            document.head.appendChild(script);
          }
        });

        scriptLoadPromises.set(src, promise);
        return promise;
      }

      async function loadDependencyChain(sources, label) {
        for (const src of sources) {
          try {
            await loadScriptOnce(src);
          } catch (error) {
            console.error(`[auction] Failed loading ${label} dependency: ${src}`, error);
            throw error;
          }
        }
      }

      async function loadAuctionLocalDependencies() {
        await loadDependencyChain(AUCTION_LOCAL_DEPENDENCY_SCRIPTS, "local");
      }

      async function loadAuctionOnlineDependencies() {
        await loadDependencyChain(AUCTION_ONLINE_DEPENDENCY_SCRIPTS, "online");
      }

      document.getElementById("enterAuctionSetupBtn").addEventListener("click", async () => {
        const cta = document.getElementById("enterAuctionSetupBtn");
        cta.disabled = true;
        try {
          await mountAuctionRuntime();
          if (!auctionRuntimeMounted) throw new Error("AUCTION_RUNTIME_MOUNT_ABORTED");
          await loadAuctionLocalDependencies();
          auctionIntro.classList.add("hidden");
          const runtimeRoot = document.getElementById("auctionRuntime");
          if (!runtimeRoot) throw new Error("AUCTION_RUNTIME_ROOT_MISSING");
          runtimeRoot.classList.remove("hidden");
          initAuctionApp();
        } catch (error) {
          console.error("[auction] Failed to prepare auction runtime", error);
          window.alert(AUCTION_DEPENDENCY_LOAD_ERROR);
          cta.disabled = false;
        }
      });

      function initAuctionApp() {
        if (auctionAppInitialized) return;
        auctionAppInitialized = true;

      let gameRooms = window.TasleyaGameRooms || null;
      const recentHistory = window.TasleyaRecentHistory || null;
      let onlineDependenciesReady = Boolean(gameRooms);

      function setOnlineDependencyMessage(text) {
        setMessage(el.onlineDepsMessage, text || "");
      }

      async function ensureOnlineDependencies() {
        if (onlineDependenciesReady && gameRooms) return true;
        try {
          await loadAuctionOnlineDependencies();
          gameRooms = window.TasleyaGameRooms || null;
          if (!gameRooms) throw new Error("AUCTION_ONLINE_GAME_ROOMS_MISSING");
          onlineDependenciesReady = true;
          setOnlineDependencyMessage("");
          return true;
        } catch (error) {
          onlineDependenciesReady = false;
          const detail = error?.message || "تعذر تحميل خدمة اللعب الجماعي.";
          setOnlineDependencyMessage(`اللعب على أجهزة مختلفة غير متاح مؤقتًا. أعد المحاولة. (${detail})`);
          console.error("[auction] Online mode unavailable due to dependency failure", error);
          return false;
        }
      }

      const TOTAL_QUESTIONS = 10;
      const DEFAULT_TEAMS = ["الفريق الأول", "الفريق الثاني"];
      const GAME_KEY = "auction";
      const AUCTION_LOCAL_RESUME_KEY = "tasleya_auction_local_state_v1";
      const AUCTION_LOCAL_RESUME_VERSION = 1;
      const RECENT_LIMIT = 200;
      const EXHAUSTION_NOTICE_TEXT = "أعدنا خلط الأسئلة بعد استخدام معظم الأسئلة المتاحة، وقد تظهر بعض الأسئلة مرة أخرى.";
      const BID_WINDOW_MS = 5000;
      const ATTEMPT_WINDOW_MS = 60000;

      const state = {
        mode: null,
        questionIndex: 0,
        scores: [0, 0],
        questions: [],
        phase: "roleSelection",
        round: { categoryRevealed: false, readyForQuestion: { 0: false, 1: false } },
        bid: { current: 0, turnTeam: 0, leadingTeam: null, stoppedTeam: null },
        attempt: { team: null, target: 0, endsAt: null },
        attemptProgress: { countedKeys: [], isSubmitting: false },
        timerValue: 60,
        timerId: null,
        questionBank: [],
        pendingLocalResume: null,
        teamNames: [...DEFAULT_TEAMS],
        judgeAssistOpen: false,
      };

      const onlineState = {
        enabled: false,
        session: null,
        roomData: null,
        unsubscribeRoom: null,
        unsubscribePresence: null,
        processingActions: false,
        hostClockId: null,
        uiClockId: null,
      };

      const el = {
        modeScreen: document.getElementById("modeScreen"),
        singleDeviceModeBtn: document.getElementById("singleDeviceModeBtn"),
        onlineModeBtn: document.getElementById("onlineModeBtn"),
        localStartWrap: document.getElementById("localStartWrap"),
        team1NameInput: document.getElementById("team1NameInput"),
        team2NameInput: document.getElementById("team2NameInput"),
        startLocalBtn: document.getElementById("startLocalBtn"),
        localResumeWrap: document.getElementById("localResumeWrap"),
        resumeLocalBtn: document.getElementById("resumeLocalBtn"),
        discardLocalBtn: document.getElementById("discardLocalBtn"),
        onlineRoomScreen: document.getElementById("onlineRoomScreen"),
        playerNameInput: document.getElementById("playerNameInput"),
        createRoomBtn: document.getElementById("createRoomBtn"),
        showJoinRoomBtn: document.getElementById("showJoinRoomBtn"),
        joinRoomPanel: document.getElementById("joinRoomPanel"),
        roomCodeInput: document.getElementById("roomCodeInput"),
        joinRoomBtn: document.getElementById("joinRoomBtn"),
        onlineRoomMessage: document.getElementById("onlineRoomMessage"),
        onlineDepsMessage: document.getElementById("onlineDepsMessage"),
        onlineLobbyScreen: document.getElementById("onlineLobbyScreen"),
        roomCodeLabel: document.getElementById("roomCodeLabel"),
        playersList: document.getElementById("playersList"),
        onlineLobbyMessage: document.getElementById("onlineLobbyMessage"),
        startOnlineBtn: document.getElementById("startOnlineBtn"),
        leaveRoomBtn: document.getElementById("leaveRoomBtn"),
        teamOneBtn: document.getElementById("teamOneBtn"),
        teamTwoBtn: document.getElementById("teamTwoBtn"),
        gameScreen: document.getElementById("gameScreen"),
        questionCounter: document.getElementById("questionCounter"),
        currentBid: document.getElementById("currentBid"),
        turnLabel: document.getElementById("turnLabel"),
        leadingLabel: document.getElementById("leadingLabel"),
        team1Score: document.getElementById("team1Score"),
        team2Score: document.getElementById("team2Score"),
        team1ScoreLabel: document.getElementById("team1ScoreLabel"),
        team2ScoreLabel: document.getElementById("team2ScoreLabel"),
        revealBtn: document.getElementById("revealBtn"),
        categoryRevealBox: document.getElementById("categoryRevealBox"),
        categoryOnlyText: document.getElementById("categoryOnlyText"),
        questionReadyRow: document.getElementById("questionReadyRow"),
        team1ReadyBtn: document.getElementById("team1ReadyBtn"),
        team2ReadyBtn: document.getElementById("team2ReadyBtn"),
        questionCategory: document.getElementById("questionCategory"),
        questionPrompt: document.getElementById("questionPrompt"),
        startBidBtn: document.getElementById("startBidBtn"),
        turnPill: document.getElementById("turnPill"),
        activeTeamText: document.getElementById("activeTeamText"),
        leadingTeamText: document.getElementById("leadingTeamText"),
        bidInfo: document.getElementById("bidInfo"),
        bidInput: document.getElementById("bidInput"),
        raiseBidBtn: document.getElementById("raiseBidBtn"),
        stopBidBtn: document.getElementById("stopBidBtn"),
        countdownWrap: document.getElementById("countdownWrap"),
        bidCountdownBtn: document.getElementById("bidCountdownBtn"),
        bidCountdownText: document.getElementById("bidCountdownText"),
        attemptTeamText: document.getElementById("attemptTeamText"),
        attemptTargetText: document.getElementById("attemptTargetText"),
        startAttemptBtn: document.getElementById("startAttemptBtn"),
        timerText: document.getElementById("timerText"),
        timerTarget: document.getElementById("timerTarget"),
        attemptNowTeam: document.getElementById("attemptNowTeam"),
        timerQuestionCategory: document.getElementById("timerQuestionCategory"),
        timerQuestionPrompt: document.getElementById("timerQuestionPrompt"),
        acceptedProgressText: document.getElementById("acceptedProgressText"),
        manualAdvanceBtn: document.getElementById("manualAdvanceBtn"),
        judgeHint: document.getElementById("judgeHint"),
        correctBtn: document.getElementById("correctBtn"),
        otherPointBtn: document.getElementById("otherPointBtn"),
        betweenText: document.getElementById("betweenText"),
        nextQuestionBtn: document.getElementById("nextQuestionBtn"),
        finalText: document.getElementById("finalText"),
        restartBtn: document.getElementById("restartBtn"),
        phaseRole: document.getElementById("phaseRole"),
        phaseReveal: document.getElementById("phaseReveal"),
        phaseBidding: document.getElementById("phaseBidding"),
        phaseAttemptReady: document.getElementById("phaseAttemptReady"),
        phaseAttempt: document.getElementById("phaseAttempt"),
        phaseJudge: document.getElementById("phaseJudge"),
        phaseBetween: document.getElementById("phaseBetween"),
        phaseFinal: document.getElementById("phaseFinal"),
        phaseLoading: document.getElementById("phaseLoading"),
        phaseDataState: document.getElementById("phaseDataState"),
        dataStateTitle: document.getElementById("dataStateTitle"),
        dataStateMessage: document.getElementById("dataStateMessage"),
        retryLoadBtn: document.getElementById("retryLoadBtn"),
        judgeAssistToggle: document.getElementById("judgeAssistToggle"),
        judgeAssistPanel: document.getElementById("judgeAssistPanel"),
        judgeAssistCategory: document.getElementById("judgeAssistCategory"),
        judgeAssistPrompt: document.getElementById("judgeAssistPrompt"),
        judgeAssistAnswers: document.getElementById("judgeAssistAnswers"),
        judgeAssistNotes: document.getElementById("judgeAssistNotes"),
        flowStepCategory: document.getElementById("flowStepCategory"),
        flowStepReady: document.getElementById("flowStepReady"),
        flowStepQuestionBid: document.getElementById("flowStepQuestionBid"),
        flowStepStartAttempt: document.getElementById("flowStepStartAttempt"),
        flowStepTimer: document.getElementById("flowStepTimer"),
        flowStepJudge: document.getElementById("flowStepJudge"),
        flowStepResult: document.getElementById("flowStepResult"),
        flowStepNext: document.getElementById("flowStepNext"),
      };

      const normalizeText = (v) => (typeof v === "string" ? v.trim() : "");
      const normalizeTeamName = (value, teamIndex) => normalizeText(value) || DEFAULT_TEAMS[teamIndex];
      const teamNameAt = (teamIndex) => state.teamNames[teamIndex] || DEFAULT_TEAMS[teamIndex];
      const now = () => Date.now();
      const isHost = () => onlineState.session?.role === "host";
      const getPlayerList = (roomData) => Object.entries(roomData?.players || {}).map(([uid, p]) => ({ uid, ...p }));
      const setMessage = (node, text) => { node.textContent = text || ""; node.classList.toggle("hidden", !text); };

      function showScreen(name) {
        el.modeScreen.classList.add("hidden");
        el.onlineRoomScreen.classList.add("hidden");
        el.onlineLobbyScreen.classList.add("hidden");
        el.gameScreen.classList.add("hidden");
        if (name === "mode") el.modeScreen.classList.remove("hidden");
        if (name === "onlineRoom") el.onlineRoomScreen.classList.remove("hidden");
        if (name === "onlineLobby") el.onlineLobbyScreen.classList.remove("hidden");
        if (name === "game") el.gameScreen.classList.remove("hidden");
      }

      function applyTeamNamesToUi() {
        const team1 = teamNameAt(0);
        const team2 = teamNameAt(1);
        el.team1ScoreLabel.textContent = team1;
        el.team2ScoreLabel.textContent = team2;
        if (el.team1ReadyBtn) el.team1ReadyBtn.textContent = `${team1} جاهز لرؤية السؤال`;
        if (el.team2ReadyBtn) el.team2ReadyBtn.textContent = `${team2} جاهز لرؤية السؤال`;
      }

      function setTeamNamesForLocal(name1, name2) {
        state.teamNames = [normalizeTeamName(name1, 0), normalizeTeamName(name2, 1)];
        if (!onlineState.enabled) {
          el.team1NameInput.value = state.teamNames[0];
          el.team2NameInput.value = state.teamNames[1];
        }
        applyTeamNamesToUi();
      }

      function getAcceptedAnswers(question) {
        if (!question || typeof question !== "object") return [];
        const source = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : Array.isArray(question.accepted_answers) ? question.accepted_answers : [];
        return source.map((item) => String(item ?? "").trim()).filter(Boolean);
      }

      function normalizeAnswerKey(value) {
        return normalizeText(String(value ?? "")).toLowerCase();
      }

      function getQuestionAnswerCap(question) {
        if (!question || typeof question !== "object") return 0;
        const rawCap = Number(question.totalAnswerCount ?? question.total_answer_count);
        const acceptedLength = getAcceptedAnswers(question).length;
        if (Number.isFinite(rawCap) && rawCap >= 1) return Math.floor(rawCap);
        return Math.max(1, acceptedLength);
      }

      function getCountedAnswerSet() {
        return new Set(Array.isArray(state.attemptProgress?.countedKeys) ? state.attemptProgress.countedKeys : []);
      }

      function renderAttemptAnswerProgress(question = getQuestion()) {
        const cap = getQuestionAnswerCap(question);
        const counted = getCountedAnswerSet().size;
        el.acceptedProgressText.textContent = `الإجابات المقبولة: ${counted} / ${cap}`;
      }

      function hasNextPromptInSameCategory() {
        const currentQuestion = getQuestion();
        const nextQuestion = state.questions[state.questionIndex + 1];
        if (!currentQuestion || !nextQuestion) return false;
        return normalizeText(currentQuestion.category) && normalizeText(currentQuestion.category) === normalizeText(nextQuestion.category);
      }

      function hasNextPromptInSameCategoryOnline(gs) {
        if (!gs || !Array.isArray(gs.questionOrder)) return false;
        const currentIdx = toInt(gs.questionIndex, 0);
        const nextOrderIndex = currentIdx + 1;
        if (nextOrderIndex >= gs.questionOrder.length) return false;
        const currentQuestion = resolveQuestion(gs);
        const nextQuestion = state.questionBank[toInt(gs.questionOrder[nextOrderIndex], -1)] || null;
        if (!currentQuestion || !nextQuestion) return false;
        return normalizeText(currentQuestion.category) && normalizeText(currentQuestion.category) === normalizeText(nextQuestion.category);
      }

      function updateManualAdvanceButton() {
        const hasNext = state.questionIndex < Math.max(0, state.questions.length - 1);
        el.manualAdvanceBtn.disabled = !hasNext || (onlineState.enabled && !isHost());
        el.manualAdvanceBtn.textContent = hasNextPromptInSameCategory() ? "السؤال التالي" : "الفئة التالية";
      }

      function setJudgePanelExpanded(expanded) {
        state.judgeAssistOpen = Boolean(expanded);
        el.judgeAssistPanel.classList.toggle("hidden", !expanded);
        el.judgeAssistToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        el.judgeAssistToggle.textContent = expanded ? "إخفاء مرجع الحكم" : "إظهار مرجع الحكم";
      }

      function renderJudgeAssistReference(question) {
        if (!question) return;
        const acceptedAnswers = getAcceptedAnswers(question);
        el.judgeAssistCategory.textContent = question.category || "-";
        el.judgeAssistPrompt.textContent = question.prompt || "-";
        el.judgeAssistAnswers.innerHTML = "";
        if (!acceptedAnswers.length) {
          const li = document.createElement("li");
          li.textContent = "لا توجد إجابات مقبولة مسجلة.";
          el.judgeAssistAnswers.appendChild(li);
        } else {
          acceptedAnswers.forEach((a) => {
            const li = document.createElement("li");
            li.textContent = a;
            el.judgeAssistAnswers.appendChild(li);
          });
        }
        el.judgeAssistNotes.textContent = normalizeText(question.notes) || "لا توجد ملاحظات إضافية.";
      }

      function shuffle(arr) { const clone = [...arr]; for (let i = clone.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [clone[i], clone[j]] = [clone[j], clone[i]]; } return clone; }
      function getQuestion() { return state.questions[state.questionIndex]; }
      function getLocalQuestionTarget() { return Math.max(0, state.questions.length); }
      function getOnlineQuestionTarget(gs) {
        if (!gs || !Array.isArray(gs.questionOrder)) return TOTAL_QUESTIONS;
        return Math.max(0, gs.questionOrder.length);
      }
      function getQuestionUniqueKey(question) {
        if (!question || typeof question !== "object") return null;
        const rawId = normalizeText(question.id == null ? "" : String(question.id));
        if (rawId) return `id:${rawId}`;
        const category = normalizeText(question.category);
        const prompt = normalizeText(question.prompt);
        if (!prompt) return null;
        return `text:${category}|${prompt}`;
      }
      function buildUniqueQuestionPool(source) {
        const unique = [];
        const seen = new Set();
        source.forEach((question) => {
          const key = getQuestionUniqueKey(question);
          if (!key || seen.has(key)) return;
          seen.add(key);
          unique.push(question);
        });
        return unique;
      }
      function hasDuplicateQuestionEntries(list) {
        if (!Array.isArray(list)) return true;
        const seen = new Set();
        for (const question of list) {
          const key = getQuestionUniqueKey(question);
          if (!key || seen.has(key)) return true;
          seen.add(key);
        }
        return false;
      }

      function buildRecentScopeKey(question) {
        if (!recentHistory || typeof recentHistory.buildScopeKey !== "function") return "";
        return recentHistory.buildScopeKey("auction", {
          category: normalizeText(question?.category || "all"),
          difficulty: question?.difficulty == null ? "all" : String(question.difficulty),
        });
      }

      function isQuestionRecentlyUsed(question) {
        const questionKey = getQuestionUniqueKey(question);
        const scopeKey = buildRecentScopeKey(question);
        if (!questionKey || !scopeKey || !recentHistory) return false;
        return recentHistory.getRecentIds(scopeKey).includes(questionKey);
      }

      function markQuestionAsRecent(question) {
        const questionKey = getQuestionUniqueKey(question);
        const scopeKey = buildRecentScopeKey(question);
        if (!questionKey || !scopeKey || !recentHistory) return;
        recentHistory.markRecentId(scopeKey, questionKey, RECENT_LIMIT);
      }

      function clearQuestionScopes(questions) {
        if (!recentHistory || typeof recentHistory.clearRecentIds !== "function") return;
        const uniqueScopes = new Set((questions || []).map((question) => buildRecentScopeKey(question)).filter(Boolean));
        uniqueScopes.forEach((scopeKey) => recentHistory.clearRecentIds(scopeKey));
      }

      function showExhaustionNotice() {
        let node = document.getElementById("auctionNoRepeatNotice");
        if (!node) {
          node = document.createElement("div");
          node.id = "auctionNoRepeatNotice";
          node.style.cssText = "position:fixed;bottom:16px;left:16px;right:16px;z-index:60;padding:10px 12px;border-radius:10px;background:rgba(9,22,54,.92);border:1px solid rgba(255,225,140,.42);color:#fff2c3;font-size:.92rem;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,.35);";
          document.body.appendChild(node);
        }
        node.textContent = EXHAUSTION_NOTICE_TEXT;
        node.classList.remove("hidden");
        window.clearTimeout(showExhaustionNotice._timerId);
        showExhaustionNotice._timerId = window.setTimeout(() => {
          node.classList.add("hidden");
        }, 3200);
      }

      function clearLocalResume() {
        try { localStorage.removeItem(AUCTION_LOCAL_RESUME_KEY); } catch (_) {}
      }

      function saveLocalResume() {
        if (onlineState.enabled || state.mode !== "local") return;
        if (!state.questions.length || state.phase === "final") {
          clearLocalResume();
          return;
        }
        try {
          localStorage.setItem(AUCTION_LOCAL_RESUME_KEY, JSON.stringify({
            version: AUCTION_LOCAL_RESUME_VERSION,
            mode: "local",
            questionIndex: state.questionIndex,
            scores: state.scores,
            questions: state.questions,
            phase: state.phase,
            teamNames: state.teamNames,
            round: state.round,
            bid: state.bid,
            attempt: state.attempt,
            attemptProgress: state.attemptProgress,
            timerValue: state.timerValue,
            judgeHint: normalizeText(el.judgeHint.textContent),
            betweenText: normalizeText(el.betweenText.textContent),
            savedAt: Date.now(),
          }));
        } catch (_) {}
      }

      function parseResumePhase(value) {
        const allowed = new Set(["roleSelection", "reveal", "bidding", "attemptReady", "attempt", "judge", "between"]);
        return allowed.has(value) ? value : null;
      }

      function sanitizeLocalResume(parsed) {
        if (!parsed || typeof parsed !== "object") return null;
        const phase = parseResumePhase(parsed.phase);
        if (!phase) return null;
        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
        if (!questions.length || hasDuplicateQuestionEntries(questions)) return null;
        const maxQuestionIndex = Math.max(0, questions.length - 1);
        const questionIndex = Math.max(0, Math.min(toInt(parsed.questionIndex, 0), maxQuestionIndex));
        const scoresRaw = Array.isArray(parsed.scores) ? parsed.scores : [0, 0];
        const scores = [Math.max(0, toInt(scoresRaw[0], 0)), Math.max(0, toInt(scoresRaw[1], 0))];
        const round = parsed.round && typeof parsed.round === "object"
          ? { categoryRevealed: Boolean(parsed.round.categoryRevealed), readyForQuestion: normalizeReadyMap(parsed.round.readyForQuestion) }
          : { categoryRevealed: false, readyForQuestion: { 0: false, 1: false } };
        const bid = parsed.bid && typeof parsed.bid === "object"
          ? {
            current: Math.max(0, toInt(parsed.bid.current, 0)),
            turnTeam: toInt(parsed.bid.turnTeam, 0) === 1 ? 1 : 0,
            leadingTeam: parsed.bid.leadingTeam === 0 || parsed.bid.leadingTeam === 1 ? toInt(parsed.bid.leadingTeam, 0) : null,
            stoppedTeam: parsed.bid.stoppedTeam === 0 || parsed.bid.stoppedTeam === 1 ? toInt(parsed.bid.stoppedTeam, 0) : null,
          }
          : { current: 0, turnTeam: 0, leadingTeam: null, stoppedTeam: null };
        const attempt = parsed.attempt && typeof parsed.attempt === "object"
          ? {
            team: parsed.attempt.team === 0 || parsed.attempt.team === 1 ? toInt(parsed.attempt.team, 0) : null,
            target: Math.max(0, toInt(parsed.attempt.target, 0)),
            endsAt: toInt(parsed.attempt.endsAt, 0) > 0 ? toInt(parsed.attempt.endsAt, 0) : null,
          }
          : { team: null, target: 0, endsAt: null };

        if (phase === "reveal" && !(round.categoryRevealed && round.readyForQuestion[0] && round.readyForQuestion[1])) return null;
        if (phase === "bidding" && !round.categoryRevealed) return null;
        if (["attemptReady", "attempt", "judge", "between"].includes(phase) && (attempt.team !== 0 && attempt.team !== 1)) return null;
        if (["attemptReady", "attempt", "judge", "between"].includes(phase) && attempt.target < 1) return null;
        if (phase === "attempt" && !attempt.endsAt) return null;

        return {
          ...parsed,
          phase,
          questions,
          questionIndex,
          scores,
          round,
          bid,
          attempt,
        };
      }

      function readLocalResume() {
        try {
          const raw = localStorage.getItem(AUCTION_LOCAL_RESUME_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.version !== AUCTION_LOCAL_RESUME_VERSION || parsed.mode !== "local") return null;
          return sanitizeLocalResume(parsed);
        } catch (_) {
          return null;
        }
      }

      function setPhase(name) {
        state.phase = name;
        const map = {
          roleSelection: el.phaseRole,
          reveal: el.phaseReveal,
          bidding: el.phaseBidding,
          attemptReady: el.phaseAttemptReady,
          attempt: el.phaseAttempt,
          judge: el.phaseJudge,
          between: el.phaseBetween,
          final: el.phaseFinal,
          loading: el.phaseLoading,
          dataState: el.phaseDataState,
        };
        Object.values(map).forEach((node) => { node.classList.add("hidden"); node.classList.remove("visible"); });
        const currentNode = map[name];
        if (currentNode) { currentNode.classList.remove("hidden"); requestAnimationFrame(() => currentNode.classList.add("visible")); }
        setJudgePanelExpanded(state.judgeAssistOpen);
        if (name === "roleSelection") renderRoundPreparationUI();
        if (name === "attemptReady" || name === "judge") updateJudgeButtons();
        if (name === "reveal") setPrimaryFocusButton(el.startBidBtn, [el.startBidBtn]);
        if (name === "attemptReady") setPrimaryFocusButton(el.startAttemptBtn, [el.startAttemptBtn]);
        if (name === "attempt") {
          renderAttemptAnswerProgress();
          updateManualAdvanceButton();
        }
        if (name === "judge") setPrimaryFocusButton(el.correctBtn, [el.correctBtn, el.otherPointBtn]);
        if (name === "between") setPrimaryFocusButton(el.nextQuestionBtn, [el.nextQuestionBtn]);
        updateFlowSteps();
      }

      function setPrimaryFocusButton(targetButton, inScopeButtons) {
        inScopeButtons.forEach((button) => {
          if (!button) return;
          button.classList.toggle("btn-focus", button === targetButton);
        });
      }

      function updateFlowSteps() {
        const stepOrder = [
          el.flowStepCategory,
          el.flowStepReady,
          el.flowStepQuestionBid,
          el.flowStepStartAttempt,
          el.flowStepTimer,
          el.flowStepJudge,
          el.flowStepResult,
          el.flowStepNext,
        ];

        let activeIndex = 0;
        if (state.phase === "roleSelection") {
          if (state.round?.categoryRevealed && bothTeamsReady()) activeIndex = 2;
          else if (state.round?.categoryRevealed) activeIndex = 1;
          else activeIndex = 0;
        } else if (state.phase === "reveal" || state.phase === "bidding") activeIndex = 2;
        else if (state.phase === "attemptReady") activeIndex = 3;
        else if (state.phase === "attempt") activeIndex = 4;
        else if (state.phase === "judge") activeIndex = 5;
        else if (state.phase === "between") activeIndex = 6;
        else if (state.phase === "final") activeIndex = 7;

        stepOrder.forEach((node, idx) => {
          if (!node) return;
          node.classList.toggle("active", idx === activeIndex);
          node.classList.toggle("done", idx < activeIndex);
        });
      }

      function updateHeader() {
        const target = onlineState.enabled
          ? getOnlineQuestionTarget(onlineState.roomData?.public?.gameState)
          : getLocalQuestionTarget();
        el.questionCounter.textContent = `${Math.min(state.questionIndex + 1, Math.max(1, target))} / ${Math.max(1, target)}`;
        el.currentBid.textContent = String(state.bid.current);
        el.team1Score.textContent = String(state.scores[0]);
        el.team2Score.textContent = String(state.scores[1]);
        el.turnLabel.textContent = state.phase === "bidding" ? teamNameAt(state.bid.turnTeam) : "-";
        el.leadingLabel.textContent = state.bid.leadingTeam == null ? "-" : teamNameAt(state.bid.leadingTeam);
      }

      function normalizeReadyMap(source) {
        return {
          0: Boolean(source?.[0]),
          1: Boolean(source?.[1]),
        };
      }

      function bothTeamsReady() {
        return Boolean(state.round?.readyForQuestion?.[0]) && Boolean(state.round?.readyForQuestion?.[1]);
      }

      function renderRoundPreparationUI() {
        const q = getQuestion();
        const categoryShown = Boolean(state.round?.categoryRevealed);
        const readyMap = normalizeReadyMap(state.round?.readyForQuestion);
        if (!onlineState.enabled) {
          el.revealBtn.disabled = categoryShown;
          el.team1ReadyBtn.disabled = !categoryShown || readyMap[0];
          el.team2ReadyBtn.disabled = !categoryShown || readyMap[1];
        }
        el.revealBtn.classList.toggle("hidden", categoryShown);
        el.categoryRevealBox.classList.toggle("hidden", !categoryShown);
        el.questionReadyRow.classList.toggle("hidden", !categoryShown);
        el.categoryOnlyText.textContent = q?.category || "-";
        el.team1ReadyBtn.classList.toggle("active", readyMap[0]);
        el.team2ReadyBtn.classList.toggle("active", readyMap[1]);
        setPrimaryFocusButton(
          categoryShown ? null : el.revealBtn,
          [el.revealBtn, el.team1ReadyBtn, el.team2ReadyBtn]
        );
        if (categoryShown) {
          if (!readyMap[0] && !readyMap[1]) {
            setPrimaryFocusButton(el.team1ReadyBtn, [el.team1ReadyBtn, el.team2ReadyBtn]);
          } else if (!readyMap[0]) {
            setPrimaryFocusButton(el.team1ReadyBtn, [el.team1ReadyBtn, el.team2ReadyBtn]);
          } else if (!readyMap[1]) {
            setPrimaryFocusButton(el.team2ReadyBtn, [el.team1ReadyBtn, el.team2ReadyBtn]);
          } else {
            setPrimaryFocusButton(null, [el.team1ReadyBtn, el.team2ReadyBtn]);
          }
        }
        updateFlowSteps();
      }

      function updateJudgeButtons() {
        const attemptTeam = state.attempt.team;
        if (attemptTeam !== 0 && attemptTeam !== 1) {
          el.correctBtn.textContent = "إجابة صحيحة للفريق المستجيب";
          el.otherPointBtn.textContent = "النقطة للفريق الآخر";
          return;
        }
        el.correctBtn.textContent = `إجابة صحيحة لـ ${teamNameAt(attemptTeam)}`;
        el.otherPointBtn.textContent = `النقطة لـ ${teamNameAt(1 - attemptTeam)}`;
      }

      function startRound() {
        state.judgeAssistOpen = false;
        state.round = { categoryRevealed: false, readyForQuestion: { 0: false, 1: false } };
        state.bid = { current: 0, turnTeam: 0, leadingTeam: null, stoppedTeam: null };
        state.attempt = { team: null, target: 0, endsAt: null };
        state.attemptProgress = { countedKeys: [], isSubmitting: false };
        const q = getQuestion();
        if (!q) {
          setPhase("final");
          const diff = state.scores[0] - state.scores[1];
          el.finalText.textContent = diff === 0 ? `تعادل! ${teamNameAt(0)} ${state.scores[0]} - ${teamNameAt(1)} ${state.scores[1]}` : `${diff > 0 ? teamNameAt(0) : teamNameAt(1)} فاز! النتيجة: ${state.scores[0]} - ${state.scores[1]}`;
          clearLocalResume();
          updateHeader();
          return;
        }
        el.questionCategory.textContent = q.category || "-";
        el.questionPrompt.textContent = q.prompt;
        renderJudgeAssistReference(q);
        renderAttemptAnswerProgress(q);
        updateManualAdvanceButton();
        renderRoundPreparationUI();
        setPhase("roleSelection");
        updateHeader();
        saveLocalResume();
      }

      function resetGame() {
        const source = Array.isArray(state.questionBank) ? state.questionBank : [];
        if (!source.length) {
          setDataState({
            title: "تعذر بدء اللعبة",
            message: "تعذر تحميل بنك الأسئلة من خدمة البيانات. حاول مرة أخرى.",
            canRetry: true,
          });
          return;
        }
        const uniqueSource = buildUniqueQuestionPool(source);
        let available = uniqueSource.filter((question) => !isQuestionRecentlyUsed(question));
        if (!available.length) {
          clearQuestionScopes(uniqueSource);
          available = uniqueSource.slice();
          if (available.length) showExhaustionNotice();
        }
        state.questions = shuffle(available).slice(0, TOTAL_QUESTIONS);
        if (!state.questions.length) {
          setDataState({
            title: "لا توجد أسئلة فريدة كافية",
            message: "تعذر بدء المباراة لأن بنك الأسئلة لا يحتوي على أسئلة فريدة صالحة حاليًا.",
            canRetry: false,
          });
          return;
        }
        state.questionIndex = 0;
        state.scores = [0, 0];
        state.questions.forEach((question) => markQuestionAsRecent(question));
        clearInterval(state.timerId);
        state.timerId = null;
        clearLocalResume();
        startRound();
      }

      function renderBidding() {
        const teamName = teamNameAt(state.bid.turnTeam);
        const minValue = state.bid.current + 1;
        const leadingText = state.bid.leadingTeam == null ? "لا يوجد بعد" : teamNameAt(state.bid.leadingTeam);
        el.turnPill.textContent = `دور المزايدة: ${teamName}`;
        el.activeTeamText.textContent = teamName;
        el.leadingTeamText.textContent = leadingText;
        el.raiseBidBtn.textContent = `تأكيد مزايدة ${teamName}`;
        el.bidInfo.innerHTML = `<small>أعلى مزايدة مسجلة</small>${state.bid.current}`;
        el.bidInput.min = String(minValue);
        el.bidInput.value = String(minValue);
        updateHeader();
      }

      function beginBidding() {
        state.bid = { current: 0, turnTeam: 0, leadingTeam: null, stoppedTeam: null };
        el.bidInput.value = "1";
        el.raiseBidBtn.classList.remove("hidden");
        el.stopBidBtn.classList.remove("hidden");
        el.bidInput.parentElement.classList.remove("hidden");
        el.countdownWrap.classList.add("hidden");
        renderBidding();
        setPhase("bidding");
        setPrimaryFocusButton(el.raiseBidBtn, [el.raiseBidBtn, el.stopBidBtn]);
        saveLocalResume();
      }

      function lockAttemptFromBidStop() {
        const winner = state.bid.current === 0 ? 1 - state.bid.turnTeam : 1 - state.bid.stoppedTeam;
        const target = Math.max(1, state.bid.current);
        state.judgeAssistOpen = false;
        state.attempt = { team: winner, target, endsAt: null };
        el.attemptTeamText.textContent = `${teamNameAt(winner)} يبدأ التحدي الآن`;
        el.attemptTargetText.textContent = `الهدف ${target}`;
        updateJudgeButtons();
        setPhase("attemptReady");
        setPrimaryFocusButton(el.startAttemptBtn, [el.startAttemptBtn]);
        updateHeader();
        saveLocalResume();
      }

      function startAttemptTimer() {
        if (state.phase !== "attemptReady" || state.attempt.team == null || state.attempt.target <= 0) return;
        if (state.timerId) return;
        const q = getQuestion();
        state.judgeAssistOpen = false;
        state.attempt.endsAt = now() + ATTEMPT_WINDOW_MS;
        state.timerValue = 60;
        el.timerText.textContent = "60";
        el.timerTarget.textContent = `الهدف ${state.attempt.target}`;
        el.attemptNowTeam.textContent = `المحاولة الآن: ${teamNameAt(state.attempt.team)}`;
        el.timerQuestionCategory.textContent = q.category || "-";
        el.timerQuestionPrompt.textContent = q.prompt;
        renderAttemptAnswerProgress(q);
        updateManualAdvanceButton();
        setPhase("attempt");
        clearInterval(state.timerId);
        state.timerId = setInterval(() => {
          state.timerValue = Math.max(0, Math.ceil((state.attempt.endsAt - now()) / 1000));
          el.timerText.textContent = String(state.timerValue);
          saveLocalResume();
          if (state.timerValue <= 0) {
            clearInterval(state.timerId);
            state.timerId = null;
            state.attempt.endsAt = null;
            el.judgeHint.textContent = buildJudgeHintText(state.attempt.team, state.attempt.target);
            setPhase("judge");
            setPrimaryFocusButton(el.correctBtn, [el.correctBtn, el.otherPointBtn]);
            saveLocalResume();
          }
        }, 1000);
        saveLocalResume();
      }

      function skipPreAuctionQuestionLocal() {
        if (state.questionIndex >= state.questions.length - 1) return;
        clearInterval(state.timerId);
        state.timerId = null;
        state.attempt.endsAt = null;
        const currentQuestion = state.questions[state.questionIndex];
        state.questions.splice(state.questionIndex, 1);
        state.questions.push(currentQuestion);
        startRound();
        saveLocalResume();
      }

      function applyJudgeResult(success) {
        if (state.phase !== "judge") return;
        const attemptTeam = state.attempt.team;
        if (attemptTeam !== 0 && attemptTeam !== 1) return;
        state.judgeAssistOpen = false;
        const pointTeam = success ? attemptTeam : 1 - attemptTeam;
        state.scores[pointTeam] += 1;
        updateHeader();
        const totalQuestions = getLocalQuestionTarget();
        if (state.questionIndex >= totalQuestions - 1) {
          const diff = state.scores[0] - state.scores[1];
          el.finalText.textContent = diff === 0 ? `تعادل! ${teamNameAt(0)} ${state.scores[0]} - ${teamNameAt(1)} ${state.scores[1]}` : `${diff > 0 ? teamNameAt(0) : teamNameAt(1)} فاز! النتيجة: ${state.scores[0]} - ${state.scores[1]}`;
          setPhase("final");
          clearLocalResume();
          return;
        }
        el.betweenText.textContent = [success ? `✅ نقطة لـ ${teamNameAt(pointTeam)} بعد تحقيق الهدف ${state.attempt.target}.` : `❌ لم يتحقق الهدف ${state.attempt.target}. النقطة تذهب إلى ${teamNameAt(pointTeam)}.`, `النتيجة الآن: ${state.scores[0]} - ${state.scores[1]} | السؤال ${state.questionIndex + 1} من ${Math.max(1, totalQuestions)}`, "جاهزون للسؤال التالي؟"].join(" ");
        setPhase("between");
        saveLocalResume();
      }

      function makeOnlineState(order) {
        return {
          phase: "lobby",
          questionIndex: 0,
          scores: { 0: 0, 1: 0 },
          categoryRevealed: false,
          questionReadiness: { 0: false, 1: false },
          currentQuestion: null,
          currentBid: 0,
          leadingTeam: null,
          activeBidderTeam: 0,
          bidWindowEndsAt: null,
          attemptingTeam: null,
          targetNumber: 0,
          attemptEndsAt: null,
          roundFinished: false,
          questionOrder: order,
          teamAssignments: {},
          processedClientRequestIds: [],
          winnerText: "",
          updatedAt: now(),
        };
      }

      function buildFreshQuestionOrderFromBank() {
        const indices = [...Array(state.questionBank.length).keys()];
        let availableIndices = indices.filter((index) => !isQuestionRecentlyUsed(state.questionBank[index]));
        if (!availableIndices.length) {
          clearQuestionScopes(state.questionBank);
          availableIndices = indices;
          if (availableIndices.length) showExhaustionNotice();
        }
        const chosen = shuffle(availableIndices).slice(0, TOTAL_QUESTIONS);
        chosen.forEach((index) => markQuestionAsRecent(state.questionBank[index]));
        return chosen;
      }

      async function submitOnlineAction(type, payload = {}) {
        if (!onlineState.session || !gameRooms) return;
        await gameRooms.submitGameRoomAction(onlineState.session.roomCode, { type, payload });
      }

      function sanitizeProcessed(ids) {
        return Array.isArray(ids) ? ids.slice(-150) : [];
      }

      function toInt(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : d; }
      function getPlayerTeam(uid, gs) { return toInt(gs?.teamAssignments?.[uid], -1); }

      function resolveQuestion(gs) {
        const idx = toInt(gs.questionIndex, 0);
        const qIndex = Array.isArray(gs.questionOrder) ? gs.questionOrder[idx] : idx;
        return state.questionBank[qIndex] || null;
      }

      async function patchHostGameState(patch) {
        if (!isHost() || !onlineState.session) return;
        await gameRooms.updateGameRoomPublicState(onlineState.session.roomCode, { gameState: patch });
      }

      async function hostHandleAction(action, gs) {
        if (!action || !gs) return gs;
        const ids = sanitizeProcessed(gs.processedClientRequestIds);
        if (ids.includes(action.clientRequestId)) return gs;
        ids.push(action.clientRequestId);

        const actorTeam = getPlayerTeam(action.fromUid, gs);
        const n = now();
        const next = { ...gs, processedClientRequestIds: ids, updatedAt: n };

        if (action.type === "SELECT_TEAM" && gs.phase === "lobby") {
          const teamId = toInt(action.payload?.teamId, -1);
          if (teamId === 0 || teamId === 1) next.teamAssignments = { ...(next.teamAssignments || {}), [action.fromUid]: teamId };
          return next;
        }
        if (action.type === "START_GAME" && gs.phase === "lobby" && action.fromUid === onlineState.session.uid) {
          const teams = Object.values(next.teamAssignments || {});
          if (!teams.includes(0) || !teams.includes(1)) return next;
          next.phase = "role_selection";
          return next;
        }
        if (action.type === "REVEAL_CATEGORY" && gs.phase === "role_selection" && action.fromUid === onlineState.session.uid) {
          next.categoryRevealed = true;
          next.questionReadiness = { 0: false, 1: false };
          return next;
        }
        if (action.type === "TEAM_READY_FOR_QUESTION" && gs.phase === "role_selection") {
          if (!next.categoryRevealed || (actorTeam !== 0 && actorTeam !== 1)) return next;
          const readiness = normalizeReadyMap(next.questionReadiness);
          readiness[actorTeam] = true;
          next.questionReadiness = readiness;
          if (readiness[0] && readiness[1]) {
            const q = resolveQuestion(next);
            if (!q) return next;
            next.currentQuestion = q;
            next.phase = "question_reveal";
          }
          return next;
        }
        if (action.type === "START_BIDDING" && gs.phase === "question_reveal" && action.fromUid === onlineState.session.uid) {
          next.phase = "bidding";
          next.currentBid = 0;
          next.leadingTeam = null;
          next.activeBidderTeam = 0;
          next.bidWindowEndsAt = n + BID_WINDOW_MS;
          return next;
        }
        if (action.type === "BID" && gs.phase === "bidding") {
          const actionCreatedAt = toInt(action.createdAt, n);
          if (actorTeam !== toInt(gs.activeBidderTeam, -1)) return next;
          if (actionCreatedAt > toInt(gs.bidWindowEndsAt, 0)) return next;
          next.currentBid = toInt(gs.currentBid, 0) + 1;
          next.leadingTeam = actorTeam;
          next.activeBidderTeam = 1 - actorTeam;
          next.bidWindowEndsAt = n + BID_WINDOW_MS;
          return next;
        }
        if (action.type === "START_ATTEMPT" && gs.phase === "attempt_ready" && action.fromUid === onlineState.session.uid) {
          next.phase = "attempt";
          next.attemptEndsAt = n + ATTEMPT_WINDOW_MS;
          return next;
        }
        if (action.type === "JUDGE_SUCCESS" && gs.phase === "judging" && action.fromUid === onlineState.session.uid) {
          const t = toInt(gs.attemptingTeam, -1);
          if (t !== 0 && t !== 1) return next;
          next.scores = { ...(next.scores || {}), [t]: toInt(gs.scores?.[t], 0) + 1 };
          next.phase = "result";
          next.roundFinished = true;
          return next;
        }
        if (action.type === "JUDGE_FAIL" && gs.phase === "judging" && action.fromUid === onlineState.session.uid) {
          const t = toInt(gs.attemptingTeam, -1);
          if (t !== 0 && t !== 1) return next;
          const other = 1 - t;
          next.scores = { ...(next.scores || {}), [other]: toInt(gs.scores?.[other], 0) + 1 };
          next.phase = "result";
          next.roundFinished = true;
          return next;
        }
        if (action.type === "NEXT_QUESTION" && gs.phase === "result" && action.fromUid === onlineState.session.uid) {
          const qIndex = toInt(gs.questionIndex, 0) + 1;
          const totalQuestions = getOnlineQuestionTarget(gs);
          if (qIndex >= totalQuestions) {
            next.phase = "finished";
            const s0 = toInt(next.scores?.[0], 0); const s1 = toInt(next.scores?.[1], 0);
            next.winnerText = s0 === s1 ? `تعادل! ${s0} - ${s1}` : `${s0 > s1 ? DEFAULT_TEAMS[0] : DEFAULT_TEAMS[1]} فاز! ${s0} - ${s1}`;
            return next;
          }
          next.questionIndex = qIndex;
          next.phase = "role_selection";
          next.categoryRevealed = false;
          next.questionReadiness = { 0: false, 1: false };
          next.currentQuestion = null;
          next.currentBid = 0;
          next.leadingTeam = null;
          next.activeBidderTeam = 0;
          next.bidWindowEndsAt = null;
          next.attemptingTeam = null;
          next.targetNumber = 0;
          next.attemptEndsAt = null;
          next.roundFinished = false;
          return next;
        }
        if (action.type === "ADVANCE_PROMPT" && gs.phase === "question_reveal" && action.fromUid === onlineState.session.uid) {
          const currentIndex = toInt(gs.questionIndex, 0);
          const order = Array.isArray(gs.questionOrder) ? [...gs.questionOrder] : [];
          if (currentIndex >= 0 && currentIndex < order.length - 1) {
            const [currentQuestionId] = order.splice(currentIndex, 1);
            order.push(currentQuestionId);
            next.questionOrder = order;
          }
          return next;
        }
        if (action.type === "RESET_GAME" && action.fromUid === onlineState.session.uid) {
          return makeOnlineState(buildFreshQuestionOrderFromBank());
        }
        return next;
      }

      async function processOnlineActions(roomData) {
        if (!isHost() || onlineState.processingActions || !roomData?.actions || !roomData?.public?.gameState) return;
        onlineState.processingActions = true;
        try {
          let gs = roomData.public.gameState;
          const pending = Object.values(roomData.actions).filter((a) => a?.status !== "processed").sort((a, b) => toInt(a.createdAt) - toInt(b.createdAt));
          for (const action of pending) {
            const next = await hostHandleAction(action, gs);
            if (next && JSON.stringify(next) !== JSON.stringify(gs)) {
              gs = next;
              await patchHostGameState(gs);
            }
            await gameRooms.markGameRoomActionProcessed(onlineState.session.roomCode, action.actionId, { ok: true });
          }
        } finally {
          onlineState.processingActions = false;
        }
      }

      async function hostTickDeadlines() {
        if (!isHost() || onlineState.processingActions) return;
        const gs = onlineState.roomData?.public?.gameState;
        if (!gs) return;
        const t = now();
        if (gs.phase === "bidding" && toInt(gs.bidWindowEndsAt, 0) > 0 && t >= toInt(gs.bidWindowEndsAt, 0)) {
          const hasPendingActions = Object.values(onlineState.roomData?.actions || {}).some((action) => action?.status !== "processed");
          if (hasPendingActions) return;
          const leader = toInt(gs.leadingTeam, -1);
          const attemptTeam = leader === 0 || leader === 1 ? leader : 1 - toInt(gs.activeBidderTeam, 0);
          await patchHostGameState({ ...gs, phase: "attempt_ready", attemptingTeam: attemptTeam, targetNumber: Math.max(1, toInt(gs.currentBid, 0)), attemptEndsAt: null, bidWindowEndsAt: null });
          return;
        }
        if (gs.phase === "attempt" && toInt(gs.attemptEndsAt, 0) > 0 && t >= toInt(gs.attemptEndsAt, 0)) {
          await patchHostGameState({ ...gs, phase: "judging", attemptEndsAt: null });
        }
      }

      function applyOnlineToUI(gs) {
        if (!onlineState.enabled || state.mode !== "online" || !gs) return;
        if (["attempt_ready", "attempt", "result", "role_selection"].includes(gs.phase)) {
          state.judgeAssistOpen = false;
        }
        state.teamNames = [...DEFAULT_TEAMS];
        applyTeamNamesToUi();
        const q = gs.currentQuestion || resolveQuestion(gs) || getQuestion();
        if (q) renderJudgeAssistReference(q);
        state.questionIndex = toInt(gs.questionIndex, 0);
        state.scores = [toInt(gs.scores?.[0], 0), toInt(gs.scores?.[1], 0)];
        state.round = {
          categoryRevealed: Boolean(gs.categoryRevealed),
          readyForQuestion: normalizeReadyMap(gs.questionReadiness),
        };
        state.bid.current = toInt(gs.currentBid, 0);
        state.bid.turnTeam = toInt(gs.activeBidderTeam, 0);
        state.bid.leadingTeam = gs.leadingTeam == null ? null : toInt(gs.leadingTeam, 0);
        state.attempt.team = gs.attemptingTeam == null ? null : toInt(gs.attemptingTeam, 0);
        state.attempt.target = toInt(gs.targetNumber, 0);
        state.attempt.endsAt = toInt(gs.attemptEndsAt, 0);
        if (q) {
          el.questionCategory.textContent = q.category || "-";
          el.questionPrompt.textContent = q.prompt || "";
          el.timerQuestionCategory.textContent = q.category || "-";
          el.timerQuestionPrompt.textContent = q.prompt || "";
        }
        el.attemptTeamText.textContent = state.attempt.team == null ? "" : `${teamNameAt(state.attempt.team)} يبدأ التحدي الآن`;
        el.attemptTargetText.textContent = `الهدف ${Math.max(1, state.attempt.target || 0)}`;
        el.attemptNowTeam.textContent = state.attempt.team == null ? "" : `المحاولة الآن: ${teamNameAt(state.attempt.team)}`;
        el.timerTarget.textContent = `الهدف ${Math.max(1, state.attempt.target || 0)}`;
        state.attemptProgress = { countedKeys: [], isSubmitting: false };
        renderAttemptAnswerProgress(q);
        updateManualAdvanceButton();

        renderRoundPreparationUI();
        if (gs.phase === "role_selection") setPhase("roleSelection");
        else if (gs.phase === "question_reveal") setPhase("reveal");
        else if (gs.phase === "bidding") setPhase("bidding");
        else if (gs.phase === "attempt_ready") setPhase("attemptReady");
        else if (gs.phase === "attempt") setPhase("attempt");
        else if (gs.phase === "judging") setPhase("judge");
        else if (gs.phase === "result") { setPhase("between"); el.betweenText.textContent = `النتيجة الآن: ${state.scores[0]} - ${state.scores[1]}`; }
        else if (gs.phase === "finished") { setPhase("final"); el.finalText.textContent = gs.winnerText || "انتهت اللعبة"; }

        renderBidding();
        updateHeader();

        const myTeam = getPlayerTeam(onlineState.session?.uid, gs);
        const canBid = gs.phase === "bidding" && myTeam === toInt(gs.activeBidderTeam, -1);
        const canRevealCategory = gs.phase === "role_selection" && isHost() && !gs.categoryRevealed;
        const canMarkReady = gs.phase === "role_selection" && Boolean(gs.categoryRevealed) && (myTeam === 0 || myTeam === 1);
        el.revealBtn.disabled = !canRevealCategory;
        el.team1ReadyBtn.disabled = !canMarkReady || myTeam !== 0 || Boolean(gs.questionReadiness?.[0]);
        el.team2ReadyBtn.disabled = !canMarkReady || myTeam !== 1 || Boolean(gs.questionReadiness?.[1]);
        el.countdownWrap.classList.toggle("hidden", gs.phase !== "bidding");
        el.raiseBidBtn.classList.toggle("hidden", true);
        el.stopBidBtn.classList.toggle("hidden", true);
        el.bidInput.parentElement.classList.add("hidden");
        el.bidCountdownBtn.disabled = !canBid;
        el.startAttemptBtn.disabled = !(gs.phase === "attempt_ready" && isHost());
        const canHostJudgeDecision = gs.phase === "judging" && isHost();
        el.correctBtn.disabled = !canHostJudgeDecision;
        el.otherPointBtn.disabled = !canHostJudgeDecision;
        el.correctBtn.classList.toggle("hidden", !isHost());
        el.otherPointBtn.classList.toggle("hidden", !isHost());
        const onlineHasNext = state.questionIndex < Math.max(0, getOnlineQuestionTarget(gs) - 1);
        el.manualAdvanceBtn.disabled = !(isHost() && onlineHasNext);
        el.manualAdvanceBtn.textContent = hasNextPromptInSameCategoryOnline(gs) ? "السؤال التالي" : "الفئة التالية";
        const canHostNextQuestion = gs.phase === "result" && isHost();
        el.nextQuestionBtn.disabled = !canHostNextQuestion;
        el.nextQuestionBtn.classList.toggle("hidden", !isHost());
      }

      function updateCountdownUI() {
        const gs = onlineState.roomData?.public?.gameState;
        if (!onlineState.enabled || !gs) return;
        if (gs.phase === "bidding") {
          const remain = Math.max(0, toInt(gs.bidWindowEndsAt, 0) - now());
          const sec = (remain / 1000).toFixed(1);
          const progress = (remain / BID_WINDOW_MS) * 360;
          el.bidCountdownBtn.style.setProperty("--progress", `${progress}deg`);
          el.bidCountdownText.textContent = `${sec}ث`;
        }
        if (gs.phase === "attempt") {
          const remain = Math.max(0, toInt(gs.attemptEndsAt, 0) - now());
          el.timerText.textContent = String(Math.ceil(remain / 1000));
        }
      }

      function renderLobby(roomData) {
        el.roomCodeLabel.textContent = onlineState.session?.roomCode || "------";
        const players = getPlayerList(roomData);
        const gs = roomData?.public?.gameState || {};
        el.playersList.innerHTML = players.map((p) => {
          const teamId = getPlayerTeam(p.uid, gs);
          const teamText = teamId === 0 || teamId === 1 ? ` — ${DEFAULT_TEAMS[teamId]}` : "";
          return `<li>${p.name || "لاعب"}${p.uid === roomData?.meta?.hostUid ? " (المضيف)" : ""}${teamText}</li>`;
        }).join("");
        const isHostNow = isHost();
        el.startOnlineBtn.disabled = !isHostNow;
        setMessage(el.onlineLobbyMessage, isHostNow ? "اختروا الفرق ثم ابدأوا اللعبة." : "في انتظار المضيف لبدء اللعبة.");
      }

      async function startRoomListeners(session) {
        if (!gameRooms) return;
        if (onlineState.unsubscribeRoom) onlineState.unsubscribeRoom();
        if (onlineState.unsubscribePresence) onlineState.unsubscribePresence();

        onlineState.unsubscribeRoom = gameRooms.listenToGameRoom(session.roomCode, async (roomData) => {
          if (!onlineState.enabled || state.mode !== "online") return;
          onlineState.roomData = roomData || null;
          if (!roomData) return;
          if (roomData?.meta?.gameKey !== GAME_KEY) {
            setMessage(el.onlineLobbyMessage, "هذه الغرفة ليست للعبة المزاد.");
            return;
          }
          if (roomData.public?.gameState?.phase && roomData.public.gameState.phase !== "lobby") {
            showScreen("game");
            applyOnlineToUI(roomData.public.gameState);
          } else {
            showScreen("onlineLobby");
            renderLobby(roomData);
          }
          if (isHost()) {
            await processOnlineActions(roomData);
          }
        });

        onlineState.unsubscribePresence = await gameRooms.attachGameRoomPresence(session.roomCode, { sessionId: session.sessionId || "" });
        if (onlineState.hostClockId) clearInterval(onlineState.hostClockId);
        onlineState.hostClockId = setInterval(hostTickDeadlines, 300);
      }

      async function createRoomFlow() {
        try {
          state.mode = "online";
          const hostName = normalizeText(el.playerNameInput.value) || "Host";
          const session = await gameRooms.createGameRoom({ gameType: GAME_KEY, hostName, maxTeams: 2 });
          onlineState.enabled = true;
          onlineState.session = session;
          const order = buildFreshQuestionOrderFromBank();
          await gameRooms.updateGameRoomPublicState(session.roomCode, { gameState: makeOnlineState(order) });
          await startRoomListeners(session);
          showScreen("onlineLobby");
        } catch (error) {
          setMessage(el.onlineRoomMessage, error.message || "تعذر إنشاء الغرفة.");
        }
      }

      async function joinRoomFlow() {
        try {
          state.mode = "online";
          const code = normalizeText(el.roomCodeInput.value).toUpperCase();
          const playerName = normalizeText(el.playerNameInput.value) || "Player";
          const session = await gameRooms.joinGameRoom({ roomCode: code, playerName });
          onlineState.enabled = true;
          onlineState.session = { ...session, gameType: GAME_KEY };
          gameRooms.saveGameRoomSession(onlineState.session);
          await startRoomListeners(onlineState.session);
          showScreen("onlineLobby");
        } catch (error) {
          setMessage(el.onlineRoomMessage, error.message || "تعذر الانضمام.");
        }
      }

      function setDataState({ title, message, canRetry }) {
        showScreen("game");
        el.dataStateTitle.textContent = title;
        el.dataStateMessage.textContent = message;
        el.retryLoadBtn.classList.toggle("hidden", !canRetry);
        setPhase("dataState");
      }

      function buildJudgeHintText(attemptTeam, target) {
        if (attemptTeam !== 0 && attemptTeam !== 1) return "انتهى الوقت. احسموا النتيجة الآن.";
        return `${teamNameAt(attemptTeam)} كان هدفه ${Math.max(1, toInt(target, 0))}. احسموا النتيجة الآن.`;
      }

      function buildBetweenTextFallback() {
        const totalQuestions = Math.max(1, getLocalQuestionTarget());
        return `النتيجة الآن: ${state.scores[0]} - ${state.scores[1]} | السؤال ${state.questionIndex + 1} من ${totalQuestions}. جاهزون للسؤال التالي؟`;
      }

      async function initializeQuestions() {
        setPhase("loading");
        try {
          const dataSource = window.AuctionQuestionDataSource;
          if (!dataSource || typeof dataSource.loadAuctionQuestions !== "function") throw new Error("AUCTION_DATA_SOURCE_MISSING");
          const loaded = await dataSource.loadAuctionQuestions();
          state.questionBank = buildUniqueQuestionPool(Array.isArray(loaded) ? loaded : []);
          if (!state.questionBank.length) {
            setDataState({ title: "لا توجد أسئلة متاحة", message: "تم تحميل الملف، لكن لا توجد صفوف نشطة وصالحة للعب حاليًا.", canRetry: false });
            return;
          }
          if (state.mode === "local") resetGame();
          else showScreen("mode");
        } catch (error) {
          console.error("[auction] Failed to load questions", error);
          setDataState({ title: "تعذر بدء اللعبة", message: "تعذر تحميل بنك الأسئلة من خدمة البيانات. حاول مرة أخرى.", canRetry: true });
        }
      }

      function applyLocalResume(saved) {
        if (!saved) return false;
        const sanitized = sanitizeLocalResume(saved);
        if (!sanitized) return false;
        state.mode = "local";
        setTeamNamesForLocal(sanitized.teamNames?.[0], sanitized.teamNames?.[1]);
        state.questions = sanitized.questions;
        state.questionIndex = sanitized.questionIndex;
        state.scores = sanitized.scores;
        state.round = sanitized.round;
        state.bid = sanitized.bid;
        state.attempt = sanitized.attempt;
        const savedCountedKeys = Array.isArray(sanitized.attemptProgress?.countedKeys)
          ? sanitized.attemptProgress.countedKeys.map((item) => normalizeAnswerKey(item)).filter(Boolean)
          : [];
        state.attemptProgress = { countedKeys: [...new Set(savedCountedKeys)], isSubmitting: false };
        state.timerValue = toInt(sanitized.timerValue, 60);
        el.correctBtn.classList.remove("hidden");
        el.otherPointBtn.classList.remove("hidden");
        el.nextQuestionBtn.classList.remove("hidden");
        showScreen("game");
        const q = getQuestion();
        if (q) {
          el.questionCategory.textContent = q.category || "-";
          el.questionPrompt.textContent = q.prompt || "";
          el.timerQuestionCategory.textContent = q.category || "-";
          el.timerQuestionPrompt.textContent = q.prompt || "";
          renderJudgeAssistReference(q);
        }
        el.attemptTeamText.textContent = state.attempt.team == null ? "" : `${teamNameAt(state.attempt.team)} يبدأ التحدي الآن`;
        el.attemptTargetText.textContent = `الهدف ${Math.max(1, state.attempt.target || 0)}`;
        el.attemptNowTeam.textContent = state.attempt.team == null ? "" : `المحاولة الآن: ${teamNameAt(state.attempt.team)}`;
        el.timerTarget.textContent = `الهدف ${Math.max(1, state.attempt.target || 0)}`;
        renderAttemptAnswerProgress(q);
        updateManualAdvanceButton();
        if (sanitized.phase === "attempt" && toInt(state.attempt.endsAt, 0) > 0) {
          const remain = Math.max(0, Math.ceil((toInt(state.attempt.endsAt, 0) - now()) / 1000));
          state.timerValue = remain;
          el.timerText.textContent = String(remain);
          setPhase(remain > 0 ? "attempt" : "judge");
          if (remain > 0) {
            clearInterval(state.timerId);
            state.timerId = setInterval(() => {
              state.timerValue = Math.max(0, Math.ceil((toInt(state.attempt.endsAt, 0) - now()) / 1000));
              el.timerText.textContent = String(state.timerValue);
              saveLocalResume();
              if (state.timerValue <= 0) {
                clearInterval(state.timerId);
                state.timerId = null;
                state.attempt.endsAt = null;
                el.judgeHint.textContent = buildJudgeHintText(state.attempt.team, state.attempt.target);
                setPhase("judge");
                saveLocalResume();
              }
            }, 1000);
          } else {
            state.attempt.endsAt = null;
            el.judgeHint.textContent = buildJudgeHintText(state.attempt.team, state.attempt.target);
          }
        } else if (sanitized.phase === "roleSelection") { renderRoundPreparationUI(); setPhase("roleSelection"); }
        else if (sanitized.phase === "reveal") setPhase("reveal");
        else if (sanitized.phase === "bidding") { setPhase("bidding"); renderBidding(); }
        else if (sanitized.phase === "attemptReady") setPhase("attemptReady");
        else if (sanitized.phase === "judge") {
          el.judgeHint.textContent = normalizeText(sanitized.judgeHint) || buildJudgeHintText(state.attempt.team, state.attempt.target);
          setPhase("judge");
        } else if (sanitized.phase === "between") {
          el.betweenText.textContent = normalizeText(sanitized.betweenText) || buildBetweenTextFallback();
          setPhase("between");
        }
        else setPhase("roleSelection");
        updateHeader();
        saveLocalResume();
        return true;
      }

      el.revealBtn.addEventListener("click", () => {
        if (onlineState.enabled) {
          submitOnlineAction("REVEAL_CATEGORY");
          return;
        }
        if (state.phase !== "roleSelection" || state.round.categoryRevealed) return;
        state.round.categoryRevealed = true;
        state.round.readyForQuestion = { 0: false, 1: false };
        renderRoundPreparationUI();
        saveLocalResume();
      });
      el.team1ReadyBtn.addEventListener("click", () => {
        if (onlineState.enabled) { submitOnlineAction("TEAM_READY_FOR_QUESTION"); return; }
        if (state.phase !== "roleSelection" || !state.round.categoryRevealed) return;
        state.round.readyForQuestion[0] = true;
        renderRoundPreparationUI();
        if (bothTeamsReady()) setPhase("reveal");
        saveLocalResume();
      });
      el.team2ReadyBtn.addEventListener("click", () => {
        if (onlineState.enabled) { submitOnlineAction("TEAM_READY_FOR_QUESTION"); return; }
        if (state.phase !== "roleSelection" || !state.round.categoryRevealed) return;
        state.round.readyForQuestion[1] = true;
        renderRoundPreparationUI();
        if (bothTeamsReady()) setPhase("reveal");
        saveLocalResume();
      });
      el.startBidBtn.addEventListener("click", () => {
        if (onlineState.enabled) {
          submitOnlineAction("START_BIDDING");
          return;
        }
        if (state.phase !== "reveal") return;
        beginBidding();
      });
      el.raiseBidBtn.addEventListener("click", () => {
        if (onlineState.enabled || state.phase !== "bidding") return;
        state.bid.current += 1;
        state.bid.leadingTeam = state.bid.turnTeam;
        state.bid.turnTeam = 1 - state.bid.turnTeam;
        el.bidInput.value = String(state.bid.current + 1);
        renderBidding();
        saveLocalResume();
      });
      el.bidCountdownBtn.addEventListener("click", () => submitOnlineAction("BID"));
      el.stopBidBtn.addEventListener("click", () => {
        if (onlineState.enabled || state.phase !== "bidding") return;
        if (window.confirm("هل أنتم متأكدون من إيقاف المزاد عند هذا الرقم؟")) { state.bid.stoppedTeam = state.bid.turnTeam; lockAttemptFromBidStop(); }
      });
      el.startAttemptBtn.addEventListener("click", () => (onlineState.enabled ? submitOnlineAction("START_ATTEMPT") : startAttemptTimer()));
      el.manualAdvanceBtn.addEventListener("click", () => {
        if (onlineState.enabled) {
          if (!isHost()) return;
          submitOnlineAction("ADVANCE_PROMPT");
          return;
        }
        if (state.phase !== "reveal") return;
        skipPreAuctionQuestionLocal();
      });
      el.correctBtn.addEventListener("click", () => {
        if (onlineState.enabled) {
          if (!isHost()) return;
          submitOnlineAction("JUDGE_SUCCESS");
          return;
        }
        applyJudgeResult(true);
      });
      el.otherPointBtn.addEventListener("click", () => {
        if (onlineState.enabled) {
          if (!isHost()) return;
          submitOnlineAction("JUDGE_FAIL");
          return;
        }
        applyJudgeResult(false);
      });
      el.nextQuestionBtn.addEventListener("click", () => {
        if (onlineState.enabled) {
          if (!isHost()) return;
          submitOnlineAction("NEXT_QUESTION");
          return;
        }
        if (state.phase !== "between") return;
        state.questionIndex += 1;
        startRound();
        saveLocalResume();
      });
      el.restartBtn.addEventListener("click", () => onlineState.enabled ? submitOnlineAction("RESET_GAME") : resetGame());

      el.retryLoadBtn.addEventListener("click", initializeQuestions);
      el.judgeAssistToggle.addEventListener("click", () => setJudgePanelExpanded(el.judgeAssistToggle.getAttribute("aria-expanded") !== "true"));

      el.singleDeviceModeBtn.addEventListener("click", () => {
        el.localResumeWrap.classList.add("hidden");
        el.localStartWrap.classList.remove("hidden");
        el.team1NameInput.focus();
      });
      el.startLocalBtn.addEventListener("click", () => {
        state.mode = "local";
        if (onlineState.unsubscribeRoom) onlineState.unsubscribeRoom();
        if (onlineState.unsubscribePresence) onlineState.unsubscribePresence();
        if (onlineState.hostClockId) clearInterval(onlineState.hostClockId);
        onlineState.enabled = false;
        onlineState.session = null;
        onlineState.roomData = null;
        onlineState.processingActions = false;
        onlineState.unsubscribeRoom = null;
        onlineState.unsubscribePresence = null;
        onlineState.hostClockId = null;
        if (gameRooms) gameRooms.clearGameRoomSession();
        el.correctBtn.classList.remove("hidden");
        el.otherPointBtn.classList.remove("hidden");
        el.nextQuestionBtn.classList.remove("hidden");
        setTeamNamesForLocal(el.team1NameInput.value, el.team2NameInput.value);
        clearLocalResume();
        el.localResumeWrap.classList.add("hidden");
        el.localStartWrap.classList.add("hidden");
        showScreen("game");
        resetGame();
      });
      el.onlineModeBtn.addEventListener("click", async () => {
        el.onlineModeBtn.disabled = true;
        const ready = await ensureOnlineDependencies();
        el.onlineModeBtn.disabled = false;
        if (!ready) return;
        state.mode = "online";
        state.teamNames = [...DEFAULT_TEAMS];
        applyTeamNamesToUi();
        el.correctBtn.classList.remove("hidden");
        el.otherPointBtn.classList.remove("hidden");
        el.nextQuestionBtn.classList.remove("hidden");
        clearLocalResume();
        state.pendingLocalResume = null;
        el.localResumeWrap.classList.add("hidden");
        el.localStartWrap.classList.add("hidden");
        showScreen("onlineRoom");
      });
      el.resumeLocalBtn.addEventListener("click", () => {
        el.localResumeWrap.classList.add("hidden");
        el.localStartWrap.classList.add("hidden");
        if (!applyLocalResume(state.pendingLocalResume)) {
          clearLocalResume();
        }
        state.pendingLocalResume = null;
      });
      el.discardLocalBtn.addEventListener("click", () => {
        clearLocalResume();
        state.pendingLocalResume = null;
        el.localResumeWrap.classList.add("hidden");
        el.localStartWrap.classList.remove("hidden");
      });
      el.showJoinRoomBtn.addEventListener("click", () => el.joinRoomPanel.classList.toggle("hidden"));
      el.createRoomBtn.addEventListener("click", createRoomFlow);
      el.joinRoomBtn.addEventListener("click", joinRoomFlow);
      el.teamOneBtn.addEventListener("click", () => submitOnlineAction("SELECT_TEAM", { teamId: 0 }));
      el.teamTwoBtn.addEventListener("click", () => submitOnlineAction("SELECT_TEAM", { teamId: 1 }));
      el.startOnlineBtn.addEventListener("click", () => submitOnlineAction("START_GAME"));
      el.leaveRoomBtn.addEventListener("click", () => {
        if (onlineState.unsubscribeRoom) onlineState.unsubscribeRoom();
        if (onlineState.unsubscribePresence) onlineState.unsubscribePresence();
        if (onlineState.hostClockId) clearInterval(onlineState.hostClockId);
        state.mode = null;
        onlineState.enabled = false;
        onlineState.session = null;
        onlineState.roomData = null;
        state.teamNames = [...DEFAULT_TEAMS];
        applyTeamNamesToUi();
        el.correctBtn.classList.remove("hidden");
        el.otherPointBtn.classList.remove("hidden");
        el.nextQuestionBtn.classList.remove("hidden");
        if (gameRooms) gameRooms.clearGameRoomSession();
        showScreen("mode");
      });

      onlineState.uiClockId = setInterval(updateCountdownUI, 100);
      initializeQuestions().then(async () => {
        applyTeamNamesToUi();
        setTeamNamesForLocal(DEFAULT_TEAMS[0], DEFAULT_TEAMS[1]);
        state.pendingLocalResume = readLocalResume();
        if (state.pendingLocalResume) {
          el.localResumeWrap.classList.remove("hidden");
          showScreen("mode");
        }
        if (state.mode === "local") return;
        const onlineReady = await ensureOnlineDependencies();
        if (!onlineReady || !gameRooms) return;
        const restored = gameRooms.restoreGameRoomSession();
        if (!restored || restored.gameType !== GAME_KEY) return;
        state.mode = "online";
        onlineState.enabled = true;
        onlineState.session = restored;
        await startRoomListeners(restored);
      });
      }
