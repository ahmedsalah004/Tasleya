(function () {
  const intro = document.getElementById("introScreen");
  const host = document.getElementById("filmsRuntimeHost");
  const enterBtn = document.getElementById("introStartBtn");
  let mounted = false;
  let mounting = false;
  let initialized = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-runtime-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.runtimeSrc = src;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
      document.body.appendChild(script);
    });
  }

  async function mountRuntime() {
    if (mounted || mounting) return;
    mounting = true;
    try {
      const response = await fetch('/films/runtime-fragment.html', { cache: 'no-store' });
      if (!response.ok) throw new Error(`FILMS_RUNTIME_LOAD_FAILED_${response.status}`);
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
      const ROUND_SECONDS = 90;
      const FILMS_USED_STORAGE_KEY = "tasleya_films_used_v1";
      const FILMS_STATE_STORAGE_KEY = "tasleya_films_state_v1";
      const FILMS_STATE_STORAGE_VERSION = 1;

      const gameState = {
        teams: ["الفريق الأول", "الفريق الثاني"],
        scores: [0, 0],
        currentTeam: 0,
        cards: [],
        activeCard: null,
        timerValue: ROUND_SECONDS,
        timerDeadlineTs: null,
        timerInterval: null,
        timerWarningTriggered: false,
        persistedUsedFilmIds: new Set(),
        currentScreen: "intro",
      };
      let pendingResumePayload = null;

      const audioState = {
        timerWarning: null,
        timerWarningPlaying: false,
      };

      const elements = {
        screens: {
          intro: document.getElementById("introScreen"),
          setup: document.getElementById("setupScreen"),
          resume: document.getElementById("resumeScreen"),
          board: document.getElementById("boardScreen"),
          reveal: document.getElementById("revealScreen"),
          timer: document.getElementById("timerScreen"),
          steal: document.getElementById("stealScreen"),
          end: document.getElementById("endScreen"),
        },
        introStartBtn: document.getElementById("introStartBtn"),
        setupStartBtn: document.getElementById("setupStartBtn"),
        resumeGameBtn: document.getElementById("resumeGameBtn"),
        discardGameBtn: document.getElementById("discardGameBtn"),
        teamOneInput: document.getElementById("teamOneInput"),
        teamTwoInput: document.getElementById("teamTwoInput"),
        teamOneLabel: document.getElementById("teamOneLabel"),
        teamTwoLabel: document.getElementById("teamTwoLabel"),
        teamOneScore: document.getElementById("teamOneScore"),
        teamTwoScore: document.getElementById("teamTwoScore"),
        turnLabel: document.getElementById("turnLabel"),
        filmsBoard: document.getElementById("filmsBoard"),
        revealTurnText: document.getElementById("revealTurnText"),
        revealPointsText: document.getElementById("revealPointsText"),
        shownMovieState: document.getElementById("shownMovieState"),
        movieTitle: document.getElementById("movieTitle"),
        startActingBtn: document.getElementById("startActingBtn"),
        timerTurnText: document.getElementById("timerTurnText"),
        timerPointsText: document.getElementById("timerPointsText"),
        timerMovieTitle: document.getElementById("timerMovieTitle"),
        timerValue: document.getElementById("timerValue"),
        correctBtn: document.getElementById("correctBtn"),
        stealBtn: document.getElementById("stealBtn"),
        stealPromptText: document.getElementById("stealPromptText"),
        stealCurrentCorrectBtn: document.getElementById("stealCurrentCorrectBtn"),
        stealOtherCorrectBtn: document.getElementById("stealOtherCorrectBtn"),
        stealNoOneBtn: document.getElementById("stealNoOneBtn"),
        finalResult: document.getElementById("finalResult"),
        finalScores: document.getElementById("finalScores"),
        playAgainBtn: document.getElementById("playAgainBtn"),
      };

      function ensureTimerWarningAudio() {
        if (!audioState.timerWarning) {
          const audio = new Audio("/assets/sounds/timer-warning.mp3");
          audio.preload = "none";
          audio.loop = true;
          audio.volume = 0.5;
          audioState.timerWarning = audio;
        }
        return audioState.timerWarning;
      }

      function startTimerWarningSound() {
        if (audioState.timerWarningPlaying) return;
        const timerWarningAudio = ensureTimerWarningAudio();
        if (!timerWarningAudio) return;
        try {
          const maybePromise = timerWarningAudio.play();
          audioState.timerWarningPlaying = true;
          if (maybePromise && typeof maybePromise.catch === "function") {
            maybePromise.catch(() => {
              audioState.timerWarningPlaying = false;
            });
          }
        } catch (_) {
          audioState.timerWarningPlaying = false;
        }
      }

      function stopTimerWarningSound() {
        if (!audioState.timerWarning) {
          audioState.timerWarningPlaying = false;
          return;
        }
        audioState.timerWarning.pause();
        audioState.timerWarning.currentTime = 0;
        audioState.timerWarningPlaying = false;
      }

      function showScreen(name) {
        gameState.currentScreen = name;
        Object.entries(elements.screens).forEach(([key, node]) => {
          node.classList.toggle("active", key === name);
        });
        if (name !== "timer") {
          stopTimerWarningSound();
        }
      }

      function clearSavedProgress() {
        try {
          localStorage.removeItem(FILMS_STATE_STORAGE_KEY);
        } catch (_) {}
      }

      function persistProgress() {
        if (["intro", "setup", "end", "resume"].includes(gameState.currentScreen)) {
          clearSavedProgress();
          return;
        }
        try {
          const payload = {
            version: FILMS_STATE_STORAGE_VERSION,
            teams: gameState.teams,
            scores: gameState.scores,
            currentTeam: gameState.currentTeam,
            cards: gameState.cards,
            activeCard: gameState.activeCard,
            timerValue: gameState.timerValue,
            timerDeadlineTs: gameState.timerDeadlineTs,
            currentScreen: gameState.currentScreen,
            savedAt: Date.now(),
          };
          localStorage.setItem(FILMS_STATE_STORAGE_KEY, JSON.stringify(payload));
        } catch (_) {}
      }

      function readSavedProgress() {
        try {
          const raw = localStorage.getItem(FILMS_STATE_STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.version !== FILMS_STATE_STORAGE_VERSION || !Array.isArray(parsed.cards) || !parsed.cards.length) return null;
          return parsed;
        } catch (_) {
          return null;
        }
      }

      function sanitizeTeamName(value, fallback) {
        const trimmed = String(value || "").trim();
        return trimmed ? trimmed.slice(0, 24) : fallback;
      }

      function normalizeCell(value) {
        return String(value || "").replace(/^\uFEFF/, "").trim();
      }

      function getConfiguredApiBaseUrl() {
        const configuredBaseUrl = normalizeCell(window.TASLEYA_API_BASE_URL);
        if (!configuredBaseUrl || configuredBaseUrl === WORKER_URL_PLACEHOLDER) {
          return DEFAULT_WORKER_API_BASE_URL;
        }
        return configuredBaseUrl.replace(/\/+$/, "");
      }

      function buildApiUrl(path) {
        return new URL(`${getConfiguredApiBaseUrl()}${path}`, window.location.origin);
      }

      async function apiFetchJson(path) {
        const response = await fetch(buildApiUrl(path));
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = normalizeCell(payload?.error) || "تعذر تحميل بنك الأفلام.";
          throw new Error(message);
        }
        return payload;
      }

      function updateStatusBar() {
        elements.teamOneLabel.textContent = gameState.teams[0];
        elements.teamTwoLabel.textContent = gameState.teams[1];
        elements.teamOneScore.textContent = String(gameState.scores[0]);
        elements.teamTwoScore.textContent = String(gameState.scores[1]);
        elements.turnLabel.textContent = gameState.teams[gameState.currentTeam];
      }

      function difficultyLabel(value) {
        const normalized = String(value || "").trim().toLowerCase();
        if (["easy", "e", "سهل"].includes(normalized)) return "سهل";
        if (["medium", "m", "متوسط"].includes(normalized)) return "متوسط";
        if (["hard", "h", "صعب"].includes(normalized)) return "صعب";
        return "غير محدد";
      }

      function normalizeDifficulty(value) {
        const normalized = String(value || "").trim().toLowerCase();
        if (["easy", "e", "سهل"].includes(normalized)) return "easy";
        if (["medium", "m", "متوسط"].includes(normalized)) return "medium";
        if (["hard", "h", "صعب"].includes(normalized)) return "hard";
        return "unknown";
      }

      function normalizeFilmKeyPart(value) {
        return String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      }

      function buildFilmFallbackId(item) {
        const titlePart = normalizeFilmKeyPart(item.title) || "untitled";
        const difficultyPart = normalizeDifficulty(item.difficulty) || "unknown";
        const pointsPart = Number(item.points) || 0;
        return `fallback:${titlePart}|${difficultyPart}|${pointsPart}`;
      }

      function resolveFilmId(item) {
        const explicitId = String(item.id || "").trim();
        if (explicitId) return explicitId;
        return buildFilmFallbackId(item);
      }

      function readPersistedFilmUsedIds() {
        try {
          const raw = window.localStorage.getItem(FILMS_USED_STORAGE_KEY);
          if (!raw) return new Set();
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return new Set();

          const sanitized = parsed
            .map((value) => String(value || "").trim())
            .filter((value) => value.length > 0);

          return new Set(sanitized);
        } catch (_) {
          return new Set();
        }
      }

      function writePersistedFilmUsedIds(usedIds) {
        try {
          window.localStorage.setItem(FILMS_USED_STORAGE_KEY, JSON.stringify([...usedIds]));
        } catch (_) {
          // Ignore storage write failures safely.
        }
      }

      function randomPick(list, count) {
        const shuffled = [...list];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count);
      }

      function buildRoundDeckWithPersistentFilter(films, persistedUsedIds) {
        const config = [
          { difficulty: "easy", points: 100, count: 6 },
          { difficulty: "medium", points: 300, count: 6 },
          { difficulty: "hard", points: 500, count: 6 },
        ];

        const roundUsedIds = new Set();
        const selected = [];

        for (const bucket of config) {
          const strictPool = films.filter(
            (film) =>
              normalizeDifficulty(film.difficulty) === bucket.difficulty &&
              Number(film.points) === bucket.points &&
              !persistedUsedIds.has(film.id) &&
              !roundUsedIds.has(film.id)
          );

          let picks = randomPick(strictPool, bucket.count);

          if (picks.length < bucket.count) {
            const fallbackPool = films.filter(
              (film) =>
                normalizeDifficulty(film.difficulty) === bucket.difficulty &&
                !persistedUsedIds.has(film.id) &&
                !roundUsedIds.has(film.id) &&
                !picks.some((picked) => picked.id === film.id)
            );
            picks = picks.concat(randomPick(fallbackPool, bucket.count - picks.length));
          }

          if (picks.length < bucket.count) {
            const openPool = films.filter(
              (film) =>
                !persistedUsedIds.has(film.id) &&
                !roundUsedIds.has(film.id) &&
                !picks.some((picked) => picked.id === film.id)
            );
            picks = picks.concat(randomPick(openPool, bucket.count - picks.length));
          }

          if (picks.length < bucket.count) {
            return null;
          }

          picks.forEach((pick) => {
            roundUsedIds.add(pick.id);
            selected.push({
              ...pick,
              difficulty: bucket.difficulty,
              points: bucket.points,
              used: false,
            });
          });
        }

        return selected;
      }

      function finalizeRoundSelection(films, persistedUsedIds) {
        let selected = buildRoundDeckWithPersistentFilter(films, persistedUsedIds);
        if (selected) return selected;

        persistedUsedIds.clear();
        writePersistedFilmUsedIds(persistedUsedIds);

        selected = buildRoundDeckWithPersistentFilter(films, persistedUsedIds);
        if (selected) return selected;

        throw new Error("عدد أفلام غير كافٍ لبدء الجولة.");
      }

      async function loadFilmsBank() {
        const payload = await apiFetchJson("/films/questions");
        const parsed = Array.isArray(payload?.films)
          ? payload.films
              .filter((item) => item?.title)
              .map((item) => ({
                id: resolveFilmId(item),
                title: item.title,
                difficulty: item.difficulty,
                points: Number(item.points) || 0,
              }))
          : [];

        if (parsed.length < 18) {
          throw new Error("عدد أفلام غير كافٍ لبدء الجولة.");
        }

        const persistedUsedIds = readPersistedFilmUsedIds();
        gameState.persistedUsedFilmIds = persistedUsedIds;
        return finalizeRoundSelection(parsed, persistedUsedIds);
      }

      function renderBoard() {
        elements.filmsBoard.innerHTML = "";
        const sections = [
          { points: 100, heading: "سهل - 100 نقطة" },
          { points: 300, heading: "متوسط - 300 نقطة" },
          { points: 500, heading: "صعب - 500 نقطة" },
        ];

        sections.forEach((section) => {
          const title = document.createElement("h3");
          title.className = "board-section-title";
          title.textContent = section.heading;
          elements.filmsBoard.appendChild(title);

          gameState.cards.forEach((card, index) => {
            if (card.points !== section.points) return;

            const button = document.createElement("button");
            button.type = "button";
            button.className = `film-card${card.used ? " used" : ""}`;
            button.disabled = card.used;
            button.setAttribute("role", "listitem");
            button.innerHTML = `<small>${difficultyLabel(card.difficulty)}</small><div>${card.points} نقطة</div>`;
            button.addEventListener("click", () => handleCardClick(index));
            elements.filmsBoard.appendChild(button);
          });
        });
      }

      function handleCardClick(index) {
        const card = gameState.cards[index];
        if (!card || card.used) return;
        gameState.activeCard = index;

        elements.revealTurnText.textContent = `الدور الآن: ${gameState.teams[gameState.currentTeam]}`;
        elements.revealPointsText.textContent = `قيمة البطاقة: ${card.points} نقطة`;
        elements.movieTitle.textContent = card.title;
        elements.shownMovieState.hidden = false;

        showScreen("reveal");
        persistProgress();
      }

      function startTimerRound() {
        const card = gameState.cards[gameState.activeCard];
        if (!card) return;

        stopTimerWarningSound();
        gameState.timerWarningTriggered = false;
        gameState.timerValue = ROUND_SECONDS;
        gameState.timerDeadlineTs = Date.now() + ROUND_SECONDS * 1000;
        elements.timerTurnText.textContent = `الفريق الحالي: ${gameState.teams[gameState.currentTeam]}`;
        elements.timerPointsText.textContent = `النقاط: ${card.points}`;
        elements.timerMovieTitle.textContent = card.title;
        elements.timerValue.textContent = String(gameState.timerValue);

        clearInterval(gameState.timerInterval);
        gameState.timerInterval = window.setInterval(() => {
          gameState.timerValue = Math.max(0, Math.ceil((gameState.timerDeadlineTs - Date.now()) / 1000));
          elements.timerValue.textContent = String(gameState.timerValue);
          persistProgress();

          if (gameState.timerValue <= 30 && !gameState.timerWarningTriggered && gameState.timerValue > 0) {
            gameState.timerWarningTriggered = true;
            startTimerWarningSound();
          }

          if (gameState.timerValue <= 0) {
            clearInterval(gameState.timerInterval);
            stopTimerWarningSound();
            openStealScreen();
          }
        }, 1000);

        showScreen("timer");
        persistProgress();
      }

      function consumeCardAndAdvance() {
        if (gameState.activeCard === null) return;

        stopTimerWarningSound();

        const consumedCard = gameState.cards[gameState.activeCard];
        consumedCard.used = true;
        if (consumedCard.id) {
          gameState.persistedUsedFilmIds.add(consumedCard.id);
          writePersistedFilmUsedIds(gameState.persistedUsedFilmIds);
        }
        gameState.activeCard = null;
        gameState.timerDeadlineTs = null;
        gameState.currentTeam = gameState.currentTeam === 0 ? 1 : 0;

        updateStatusBar();
        renderBoard();

        if (gameState.cards.every((card) => card.used)) {
          openEndScreen();
        } else {
          showScreen("board");
          persistProgress();
        }
      }

      function applyCurrentTeamCorrect() {
        const card = gameState.cards[gameState.activeCard];
        if (!card) return;
        gameState.scores[gameState.currentTeam] += card.points;
        clearInterval(gameState.timerInterval);
        stopTimerWarningSound();
        consumeCardAndAdvance();
      }

      function openStealScreen() {
        clearInterval(gameState.timerInterval);
        stopTimerWarningSound();
        const otherTeam = gameState.currentTeam === 0 ? 1 : 0;
        elements.stealPromptText.textContent = `${gameState.teams[otherTeam]} لديه فرصة سرقة ${
          gameState.cards[gameState.activeCard].points
        } نقطة.`;
        showScreen("steal");
        persistProgress();
      }

      function applyStealResult(mode) {
        const card = gameState.cards[gameState.activeCard];
        if (!card) return;

        stopTimerWarningSound();

        if (mode === "current") {
          gameState.scores[gameState.currentTeam] += card.points;
        }

        if (mode === "other") {
          const otherTeam = gameState.currentTeam === 0 ? 1 : 0;
          gameState.scores[otherTeam] += card.points;
        }

        consumeCardAndAdvance();
      }

      function openEndScreen() {
        const [teamOne, teamTwo] = gameState.scores;
        let result = "تعادل";

        if (teamOne > teamTwo) {
          result = `${gameState.teams[0]} فاز!`;
        } else if (teamTwo > teamOne) {
          result = `${gameState.teams[1]} فاز!`;
        }

        elements.finalResult.textContent = result;
        elements.finalScores.textContent = `${gameState.teams[0]}: ${teamOne} — ${gameState.teams[1]}: ${teamTwo}`;
        showScreen("end");
        clearSavedProgress();
      }

      async function startGameRound() {
        gameState.teams = [
          sanitizeTeamName(elements.teamOneInput.value, "الفريق الأول"),
          sanitizeTeamName(elements.teamTwoInput.value, "الفريق الثاني"),
        ];
        gameState.scores = [0, 0];
        gameState.currentTeam = 0;
        gameState.activeCard = null;
        gameState.timerDeadlineTs = null;
        clearSavedProgress();

        elements.setupStartBtn.disabled = true;
        elements.setupStartBtn.textContent = "جاري تحميل بنك الأفلام...";

        try {
          gameState.cards = await loadFilmsBank();
          updateStatusBar();
          renderBoard();
          showScreen("board");
          persistProgress();
        } catch (error) {
          window.alert(error.message || "حصل خطأ أثناء تحميل الأفلام.");
          showScreen("setup");
        } finally {
          elements.setupStartBtn.disabled = false;
          elements.setupStartBtn.textContent = "ابدأ اللعبة";
        }
      }

      function resetToSetup() {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
        gameState.timerDeadlineTs = null;
        stopTimerWarningSound();
        clearSavedProgress();
        showScreen("setup");
      }

      function restoreSavedProgress(saved) {
        if (!saved) return false;
        gameState.teams = Array.isArray(saved.teams) ? [sanitizeTeamName(saved.teams[0], "الفريق الأول"), sanitizeTeamName(saved.teams[1], "الفريق الثاني")] : ["الفريق الأول", "الفريق الثاني"];
        gameState.scores = Array.isArray(saved.scores) ? [Number(saved.scores[0]) || 0, Number(saved.scores[1]) || 0] : [0, 0];
        gameState.currentTeam = Number(saved.currentTeam) === 1 ? 1 : 0;
        gameState.cards = saved.cards;
        gameState.activeCard = Number.isInteger(saved.activeCard) ? saved.activeCard : null;
        updateStatusBar();
        renderBoard();
        const screen = String(saved.currentScreen || "board");
        if (screen === "board") {
          showScreen("board");
          persistProgress();
          return true;
        }
        const card = gameState.cards[gameState.activeCard];
        if (!card) return false;
        elements.revealTurnText.textContent = `الدور الآن: ${gameState.teams[gameState.currentTeam]}`;
        elements.revealPointsText.textContent = `قيمة البطاقة: ${card.points} نقطة`;
        elements.movieTitle.textContent = card.title;
        elements.shownMovieState.hidden = false;
        if (screen === "reveal") {
          showScreen("reveal");
          persistProgress();
          return true;
        }
        if (screen === "timer") {
          const deadline = Number(saved.timerDeadlineTs);
          gameState.timerDeadlineTs = Number.isFinite(deadline) ? deadline : (Date.now() + ROUND_SECONDS * 1000);
          gameState.timerValue = Math.max(0, Math.ceil((gameState.timerDeadlineTs - Date.now()) / 1000));
          elements.timerTurnText.textContent = `الفريق الحالي: ${gameState.teams[gameState.currentTeam]}`;
          elements.timerPointsText.textContent = `النقاط: ${card.points}`;
          elements.timerMovieTitle.textContent = card.title;
          elements.timerValue.textContent = String(gameState.timerValue);
          if (gameState.timerValue <= 0) {
            openStealScreen();
            return true;
          }
          showScreen("timer");
          clearInterval(gameState.timerInterval);
          gameState.timerInterval = window.setInterval(() => {
            gameState.timerValue = Math.max(0, Math.ceil((gameState.timerDeadlineTs - Date.now()) / 1000));
            elements.timerValue.textContent = String(gameState.timerValue);
            persistProgress();
            if (gameState.timerValue <= 30 && !gameState.timerWarningTriggered && gameState.timerValue > 0) {
              gameState.timerWarningTriggered = true;
              startTimerWarningSound();
            }
            if (gameState.timerValue <= 0) {
              clearInterval(gameState.timerInterval);
              stopTimerWarningSound();
              openStealScreen();
            }
          }, 1000);
          persistProgress();
          return true;
        }
        if (screen === "steal") {
          openStealScreen();
          return true;
        }
        return false;
      }

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          stopTimerWarningSound();
        }
      });
      window.addEventListener("pagehide", stopTimerWarningSound);
      window.addEventListener("beforeunload", stopTimerWarningSound);

      elements.introStartBtn.addEventListener("click", () => showScreen("setup"));
      elements.setupStartBtn.addEventListener("click", startGameRound);
      elements.startActingBtn.addEventListener("click", startTimerRound);
      elements.correctBtn.addEventListener("click", applyCurrentTeamCorrect);
      elements.stealBtn.addEventListener("click", openStealScreen);
      elements.stealCurrentCorrectBtn.addEventListener("click", () => applyStealResult("current"));
      elements.stealOtherCorrectBtn.addEventListener("click", () => applyStealResult("other"));
      elements.stealNoOneBtn.addEventListener("click", () => applyStealResult("none"));
      elements.playAgainBtn.addEventListener("click", resetToSetup);
      elements.resumeGameBtn.addEventListener("click", () => {
        if (!restoreSavedProgress(pendingResumePayload)) {
          clearSavedProgress();
          showScreen("setup");
        }
        pendingResumePayload = null;
      });
      elements.discardGameBtn.addEventListener("click", () => {
        pendingResumePayload = null;
        clearSavedProgress();
        showScreen("setup");
      });

      pendingResumePayload = readSavedProgress();
      if (pendingResumePayload) {
        showScreen("resume");
      }
  }

  enterBtn.addEventListener('click', async () => {
    enterBtn.disabled = true;
    try {
      await mountRuntime();
      await loadScript('/game-config.js');
      intro.classList.remove('active');
      initRuntime();
      const setupScreen = document.getElementById('setupScreen');
      if (setupScreen) setupScreen.classList.add('active');
    } catch (error) {
      console.error('[films] failed to mount runtime', error);
      enterBtn.disabled = false;
    }
  });
})();
