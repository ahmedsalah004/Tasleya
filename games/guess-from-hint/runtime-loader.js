(function () {
  const contentView = document.getElementById("guessHintContentView");
  const gameplayView = document.getElementById("guessHintGameplayView");
  const backToIntroBtn = document.getElementById("backToGuessHintIntroBtn");
  const runtimeHost = document.getElementById("guessHintRuntimeHost");
  const enterBtn = document.getElementById("enterModeScreenBtn");
  const shell = document.querySelector(".shell");
  const runtimeUrl = "/games/guess-from-hint/runtime-fragment.html";
  const deps = [
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js",
    "/firebase-config.js",
    "/games/shared/game-rooms.js",
    "/games/shared/recent-history.js",
    "/games/guess-from-hint/data.js",
  ];
  let mounted = false;
  let mounting = false;
  let initialized = false;

  function showContentView() {
    if (contentView) contentView.classList.remove("hidden");
    if (gameplayView) gameplayView.classList.add("hidden");
    if (shell) shell.classList.remove("gameplay-active");
  }

  function showGameplayView() {
    if (contentView) contentView.classList.add("hidden");
    if (gameplayView) gameplayView.classList.remove("hidden");
    if (shell) shell.classList.add("gameplay-active");
  }

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
      const response = await fetch(runtimeUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`RUNTIME_LOAD_FAILED_${response.status}`);
      runtimeHost.innerHTML = await response.text();
      mounted = true;
    } finally {
      mounting = false;
    }
  }

  async function initRuntime() {
    if (initialized) return;
    initialized = true;
      (function () {
        const WORKER_URL_PLACEHOLDER = "https://REPLACE_WITH_YOUR_WORKER_URL";
        const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";
        const POINTS = [5, 4, 3, 2, 1];
        const GAME_KEY = "guess-from-hint";
        const LOCAL_RESUME_KEY = "tasleya_guess_from_hint_local_state_v1";
        const LOCAL_RESUME_VERSION = 1;
        const RECENT_LIMIT = 200;
        const EXHAUSTION_NOTICE_TEXT = "أعدنا خلط الأسئلة بعد استخدام معظم الأسئلة المتاحة، وقد تظهر بعض الأسئلة مرة أخرى.";
        const gameRooms = window.TasleyaGameRooms || null;
        const recentHistory = window.TasleyaRecentHistory || null;

        const modeScreen = document.getElementById("modeScreen");
        const singleDeviceModeBtn = document.getElementById("singleDeviceModeBtn");
        const onlineModeBtn = document.getElementById("onlineModeBtn");
        const localResumeBox = document.getElementById("localResumeBox");
        const resumeLocalBtn = document.getElementById("resumeLocalBtn");
        const discardLocalBtn = document.getElementById("discardLocalBtn");
        const onlineRoomScreen = document.getElementById("onlineRoomScreen");
        const playerNameInput = document.getElementById("playerNameInput");
        const createRoomBtn = document.getElementById("createRoomBtn");
        const showJoinRoomBtn = document.getElementById("showJoinRoomBtn");
        const joinRoomPanel = document.getElementById("joinRoomPanel");
        const roomCodeInput = document.getElementById("roomCodeInput");
        const joinRoomBtn = document.getElementById("joinRoomBtn");
        const backToModeBtn = document.getElementById("backToModeBtn");
        const onlineRoomMessage = document.getElementById("onlineRoomMessage");
        const onlineLobbyScreen = document.getElementById("onlineLobbyScreen");
        const roomCodeLabel = document.getElementById("roomCodeLabel");
        const playersList = document.getElementById("playersList");
        const startOnlineBtn = document.getElementById("startOnlineBtn");
        const onlineLobbyMessage = document.getElementById("onlineLobbyMessage");
        const leaveRoomBtn = document.getElementById("leaveRoomBtn");
        const setupScreen = document.getElementById("setupScreen");
        const roundScreen = document.getElementById("roundScreen");
        const resultScreen = document.getElementById("resultScreen");
        const finalScreen = document.getElementById("finalScreen");

        const teamOneInput = document.getElementById("teamOneInput");
        const teamTwoInput = document.getElementById("teamTwoInput");
        const startBtn = document.getElementById("startBtn");
        const setupMessage = document.getElementById("setupMessage");
        const fallbackNotice = document.getElementById("fallbackNotice");

        const scoreGrid = document.getElementById("scoreGrid");
        const roundMeta = document.getElementById("roundMeta");
        const categoryMeta = document.getElementById("categoryMeta");
        const hintMeta = document.getElementById("hintMeta");
        const pointsMeta = document.getElementById("pointsMeta");
        const hintText = document.getElementById("hintText");
        const teamsActions = document.getElementById("teamsActions");
        const roundMessage = document.getElementById("roundMessage");

        const resultTitle = document.getElementById("resultTitle");
        const resultText = document.getElementById("resultText");
        const nextRoundBtn = document.getElementById("nextRoundBtn");

        const finalText = document.getElementById("finalText");
        const playAgainBtn = document.getElementById("playAgainBtn");

        const guessModal = document.getElementById("guessModal");
        const guessModalTitle = document.getElementById("guessModalTitle");
        const guessInput = document.getElementById("guessInput");
        const guessError = document.getElementById("guessError");
        const checkGuessBtn = document.getElementById("checkGuessBtn");
        const cancelGuessBtn = document.getElementById("cancelGuessBtn");

        const state = {
          rounds: [],
          usingFallback: false,
          currentRoundIndex: 0,
          currentHintIndex: 0,
          teams: [
            { name: "الفريق الأول", score: 0, blockedHintIndex: null, waitedHintIndex: null, wrongHintIndex: null },
            { name: "الفريق الثاني", score: 0, blockedHintIndex: null, waitedHintIndex: null, wrongHintIndex: null }
          ],
          selectedTeamIndex: null
        };
        const onlineState = {
          enabled: false,
          session: null,
          unsubscribeRoom: null,
          unsubscribePresence: null,
          roomData: null,
          processingActions: false,
        };
        const uiState = {
          activeGuessTeamIndex: null,
          pendingGuessTeams: new Set(),
          pendingWaitTeams: new Set(),
          statusPulseTeams: new Set(),
        };
        let pendingLocalResume = null;

        function setMessage(el, text, tone) {
          if (!text) {
            el.textContent = "";
            el.classList.add("hidden");
            el.classList.remove("good", "bad");
            return;
          }
          el.textContent = text;
          el.classList.remove("hidden");
          el.classList.toggle("good", tone === "good");
          el.classList.toggle("bad", tone === "bad");
        }

        function normalizeArabic(value) {
          return String(value || "")
            .replace(/[أإآٱ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .replace(/ؤ/g, "و")
            .replace(/ئ/g, "ي")
            .replace(/[\u064B-\u065F\u0670]/g, "")
            .replace(/ـ/g, "")
            .replace(/[\u200E\u200F]/g, "")
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
        }

        function parseAliases(rawAliases) {
          if (!rawAliases) return [];
          return String(rawAliases)
            .split(/[،,]/)
            .map((item) => item.trim())
            .filter(Boolean);
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
          const response = await fetch(buildApiUrl(path), { cache: "no-store" });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            const message = normalizeCell(payload?.error) || "تعذر تحميل بيانات اللعبة.";
            throw new Error(message);
          }
          return payload;
        }

        function levenshtein(a, b) {
          if (a === b) return 0;
          const rows = a.length + 1;
          const cols = b.length + 1;
          const matrix = Array.from({ length: rows }, (_, i) => {
            const line = new Array(cols).fill(0);
            line[0] = i;
            return line;
          });
          for (let j = 0; j < cols; j++) matrix[0][j] = j;
          for (let i = 1; i < rows; i++) {
            for (let j = 1; j < cols; j++) {
              const cost = a[i - 1] === b[j - 1] ? 0 : 1;
              matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
              );
            }
          }
          return matrix[rows - 1][cols - 1];
        }

        function isAcceptedAnswer(guess, acceptedList) {
          const normalizedGuess = normalizeArabic(guess);
          if (!normalizedGuess) return false;

          for (const accepted of acceptedList) {
            const normalizedAccepted = normalizeArabic(accepted);
            if (!normalizedAccepted) continue;
            if (normalizedGuess === normalizedAccepted) return true;

            const minLen = Math.min(normalizedGuess.length, normalizedAccepted.length);
            if (minLen < 5) continue;

            const distance = levenshtein(normalizedGuess, normalizedAccepted);
            const maxLen = Math.max(normalizedGuess.length, normalizedAccepted.length);
            const allowed = maxLen >= 10 ? 2 : 1;
            if (distance <= allowed) return true;
          }
          return false;
        }

        function isRowActive(activeValue) {
          const value = String(activeValue || "").trim().toLowerCase();
          return value === "" || value === "true" || value === "1" || value === "yes";
        }

        function normalizeRow(raw, index) {
          const answer = (raw.answer || "").trim();
          const hints = [raw.hint_1, raw.hint_2, raw.hint_3, raw.hint_4, raw.hint_5].map((h) => String(h || "").trim());
          if (!answer || hints.some((hint) => !hint)) return null;
          if (!isRowActive(raw.active)) return null;
          return {
            id: normalizeCell(raw.id) || `row-${index + 1}`,
            category: (raw.category || "").trim(),
            answer,
            aliases: parseAliases(raw.aliases),
            hints
          };
        }

        function buildRecentScopeKey() {
          if (!recentHistory || typeof recentHistory.buildScopeKey !== "function") return "";
          return recentHistory.buildScopeKey("guess-from-hint", { mode: "default" });
        }

        function showExhaustionNotice() {
          if (!roundMessage) return;
          setMessage(roundMessage, EXHAUSTION_NOTICE_TEXT, "");
          window.setTimeout(() => {
            if (roundMessage.textContent === EXHAUSTION_NOTICE_TEXT) {
              setMessage(roundMessage, "", "");
            }
          }, 3200);
        }

        function shuffle(items) {
          const arr = items.slice();
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        async function loadRounds() {
          fallbackNotice.classList.add("hidden");
          const normalizedSet = new Set();

          try {
            const payload = await apiFetchJson("/guess-from-hint/questions");
            const rows = Array.isArray(payload?.questions) ? payload.questions : [];
            const valid = [];
            for (let i = 0; i < rows.length; i++) {
              const row = normalizeRow(rows[i], i);
              if (!row) continue;
              const normalizedAnswer = normalizeArabic(row.answer);
              if (!normalizedAnswer || normalizedSet.has(normalizedAnswer)) continue;
              normalizedSet.add(normalizedAnswer);
              valid.push(row);
            }
            if (valid.length < 1) throw new Error("No valid rows");
            state.usingFallback = false;
            const scopeKey = buildRecentScopeKey();
            const recentIds = scopeKey && recentHistory ? new Set(recentHistory.getRecentIds(scopeKey)) : new Set();
            let available = valid.filter((row) => !recentIds.has(row.id));
            if (!available.length) {
              if (scopeKey && recentHistory) recentHistory.clearRecentIds(scopeKey);
              available = valid.slice();
              showExhaustionNotice();
            }
            const selected = shuffle(available).slice(0, 10);
            if (scopeKey && recentHistory) {
              selected.forEach((row) => recentHistory.markRecentId(scopeKey, row.id, RECENT_LIMIT));
            }
            return selected;
          } catch (error) {
            const fallback = Array.isArray(window.GUESS_FROM_HINT_FALLBACK_DATA)
              ? window.GUESS_FROM_HINT_FALLBACK_DATA
              : [];
            const validFallback = [];
            for (let i = 0; i < fallback.length; i++) {
              const source = fallback[i];
              const row = normalizeRow(
                {
                  id: source.id,
                  category: source.category,
                  answer: source.answer,
                  aliases: Array.isArray(source.aliases) ? source.aliases.join(",") : source.aliases,
                  hint_1: source.hint_1,
                  hint_2: source.hint_2,
                  hint_3: source.hint_3,
                  hint_4: source.hint_4,
                  hint_5: source.hint_5,
                  active: "true"
                },
                i
              );
              if (!row) continue;
              const normalizedAnswer = normalizeArabic(row.answer);
              if (!normalizedAnswer || normalizedSet.has(normalizedAnswer)) continue;
              normalizedSet.add(normalizedAnswer);
              validFallback.push(row);
            }
            state.usingFallback = true;
            fallbackNotice.classList.remove("hidden");
            const scopeKey = buildRecentScopeKey();
            const recentIds = scopeKey && recentHistory ? new Set(recentHistory.getRecentIds(scopeKey)) : new Set();
            let available = validFallback.filter((row) => !recentIds.has(row.id));
            if (!available.length) {
              if (scopeKey && recentHistory) recentHistory.clearRecentIds(scopeKey);
              available = validFallback.slice();
              showExhaustionNotice();
            }
            const selected = shuffle(available).slice(0, 10);
            if (scopeKey && recentHistory) {
              selected.forEach((row) => recentHistory.markRecentId(scopeKey, row.id, RECENT_LIMIT));
            }
            return selected;
          }
        }

        function resetWaitStatesForHint(hintIndex) {
          state.teams.forEach((team) => {
            if (team.waitedHintIndex !== hintIndex) team.waitedHintIndex = null;
          });
        }

        function isBlockedNow(team) {
          return team.blockedHintIndex === state.currentHintIndex;
        }

        function triggerStatusPulse(teamIndex) {
          uiState.statusPulseTeams.add(teamIndex);
          window.setTimeout(() => {
            uiState.statusPulseTeams.delete(teamIndex);
            if (!roundScreen.classList.contains("hidden")) renderRound();
          }, 720);
        }

        function acknowledgeButton(btn) {
          if (!btn) return;
          btn.classList.add("action-ack");
          window.setTimeout(() => btn.classList.remove("action-ack"), 300);
        }

        function getTeamStatusConfig(team, idx) {
          if (uiState.activeGuessTeamIndex === idx) {
            return { text: "يكتب الإجابة الآن", tone: "active" };
          }
          if (team.wrongHintIndex === state.currentHintIndex) {
            return { text: "إجابة غير صحيحة", tone: "bad" };
          }
          if (uiState.pendingGuessTeams.has(idx)) {
            return { text: "تم إرسال التخمين", tone: "pending" };
          }
          if (team.waitedHintIndex === state.currentHintIndex) {
            return { text: "بانتظار التلميح التالي", tone: "waiting" };
          }
          if (uiState.pendingWaitTeams.has(idx)) {
            return { text: "تم اختيار التلميح التالي", tone: "pending" };
          }
          if (isBlockedNow(team)) {
            return { text: "بانتظار حسم الفريق الآخر", tone: "blocked" };
          }
          return { text: "جاهز للتخمين", tone: "" };
        }

        function renderRound() {
          const round = state.rounds[state.currentRoundIndex];
          if (!round || !Array.isArray(round.hints) || !state.teams?.length) {
            setMessage(roundMessage, "تعذر عرض الجولة الحالية.", "bad");
            return;
          }
          const hintNumber = state.currentHintIndex + 1;
          const points = POINTS[state.currentHintIndex] || 1;

          scoreGrid.innerHTML = state.teams
            .map((team) =>
              `<article class="team-score"><h3>${team.name}</h3><p>${team.score}</p></article>`
            )
            .join("");

          roundMeta.textContent = `الجولة ${state.currentRoundIndex + 1} / ${state.rounds.length}`;
          categoryMeta.textContent = round.category ? `الفئة: ${round.category}` : "الفئة: غير محددة";
          hintMeta.textContent = `التلميح ${hintNumber} / 5`;
          pointsMeta.textContent = `النقاط المتاحة: ${points}`;
          hintText.textContent = round.hints[state.currentHintIndex];

          teamsActions.innerHTML = state.teams
            .map((team, idx) => {
              const blocked = isBlockedNow(team);
              const waitedNow = team.waitedHintIndex === state.currentHintIndex;
              const status = getTeamStatusConfig(team, idx);
              const cardClasses = [
                "team-card",
                waitedNow ? "wait-selected" : "",
                blocked ? "locked" : "",
                uiState.statusPulseTeams.has(idx) ? "guess-active" : "",
                uiState.activeGuessTeamIndex === idx ? "guess-active" : "",
              ].filter(Boolean).join(" ");
              return `
                <article class="${cardClasses}">
                  <h4>${team.name}</h4>
                  <p class="team-status"><span class="team-status-chip ${status.tone}">${status.text}</span></p>
                  <div class="actions">
                    <button class="btn${uiState.activeGuessTeamIndex === idx ? " guess-active" : ""}" data-action="guess" data-team="${idx}" ${blocked ? "disabled" : ""}>تخمين</button>
                    <button class="btn${waitedNow ? " wait-active" : ""}" data-action="wait" data-team="${idx}">انتظار / التلميح التالي</button>
                  </div>
                </article>
              `;
            })
            .join("");
        }

        function showScreen(screen) {
          modeScreen.classList.add("hidden");
          onlineRoomScreen.classList.add("hidden");
          onlineLobbyScreen.classList.add("hidden");
          setupScreen.classList.add("hidden");
          roundScreen.classList.add("hidden");
          resultScreen.classList.add("hidden");
          finalScreen.classList.add("hidden");
          screen.classList.remove("hidden");
        }

        function getLocalPhase() {
          if (!roundScreen.classList.contains("hidden")) return "round";
          if (!resultScreen.classList.contains("hidden")) return "result";
          if (!finalScreen.classList.contains("hidden")) return "final";
          if (!setupScreen.classList.contains("hidden")) return "setup";
          return "mode";
        }

        function clearLocalResume() {
          try {
            localStorage.removeItem(LOCAL_RESUME_KEY);
          } catch (_) {}
        }

        function saveLocalResume() {
          if (onlineState.enabled) return;
          const phase = getLocalPhase();
          if (phase === "setup" || phase === "mode") {
            clearLocalResume();
            return;
          }
          try {
            localStorage.setItem(LOCAL_RESUME_KEY, JSON.stringify({
              version: LOCAL_RESUME_VERSION,
              rounds: state.rounds,
              currentRoundIndex: state.currentRoundIndex,
              currentHintIndex: state.currentHintIndex,
              teams: state.teams,
              phase,
              resultTitle: resultTitle.textContent,
              resultText: resultText.textContent,
              finalTextValue: finalText.textContent,
              savedAt: Date.now(),
            }));
          } catch (_) {}
        }

        function readLocalResume() {
          try {
            const raw = localStorage.getItem(LOCAL_RESUME_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== LOCAL_RESUME_VERSION || !Array.isArray(parsed.rounds) || !parsed.rounds.length) return null;
            return parsed;
          } catch (_) {
            return null;
          }
        }

        function applyLocalResume(saved) {
          if (!saved) return false;
          state.rounds = saved.rounds;
          state.currentRoundIndex = Number(saved.currentRoundIndex) || 0;
          state.currentHintIndex = Number(saved.currentHintIndex) || 0;
          state.teams = Array.isArray(saved.teams) ? saved.teams : state.teams;
          uiState.activeGuessTeamIndex = null;
          uiState.pendingGuessTeams.clear();
          uiState.pendingWaitTeams.clear();
          uiState.statusPulseTeams.clear();
          setMessage(roundMessage, "");
          if (saved.phase === "round") {
            showScreen(roundScreen);
            renderRound();
          } else if (saved.phase === "result") {
            resultTitle.textContent = saved.resultTitle || "نتيجة الجولة";
            resultText.textContent = saved.resultText || "";
            showScreen(resultScreen);
          } else if (saved.phase === "final") {
            finalText.textContent = saved.finalTextValue || "";
            showScreen(finalScreen);
          } else {
            return false;
          }
          saveLocalResume();
          return true;
        }

        function openGuessModal(teamIndex) {
          state.selectedTeamIndex = teamIndex;
          uiState.activeGuessTeamIndex = teamIndex;
          guessModalTitle.textContent = `اكتب تخمين فريق ${state.teams[teamIndex].name}`;
          guessInput.value = "";
          setMessage(guessError, "");
          guessModal.classList.remove("hidden");
          renderRound();
          window.setTimeout(() => guessInput.focus(), 50);
        }

        function closeGuessModal() {
          guessModal.classList.add("hidden");
          state.selectedTeamIndex = null;
          uiState.activeGuessTeamIndex = null;
          setMessage(guessError, "");
          if (!roundScreen.classList.contains("hidden")) renderRound();
        }

        function resetGuessInteractionState() {
          guessModal.classList.add("hidden");
          state.selectedTeamIndex = null;
          uiState.activeGuessTeamIndex = null;
          uiState.pendingGuessTeams.clear();
          setMessage(guessError, "");
        }

        function endRoundAsNoAnswer() {
          const round = state.rounds[state.currentRoundIndex];
          resultTitle.textContent = "انتهت التلميحات";
          resultText.textContent = `الإجابة: ${round.answer} — لم يحصل أي فريق على نقاط`;
          showScreen(resultScreen);
          saveLocalResume();
        }

        function shouldAdvanceHint(teams, currentHintIndex) {
          const waiters = teams.filter((team) => team.waitedHintIndex === currentHintIndex).length;
          const wrongTeams = teams.filter((team) => team.wrongHintIndex === currentHintIndex).length;
          const blockedTeams = teams.filter((team) => team.blockedHintIndex === currentHintIndex).length;
          return (waiters === 2) || (wrongTeams === 1 && waiters === 1) || (blockedTeams === 2);
        }

        function progressHintIfAllowed() {
          if (!shouldAdvanceHint(state.teams, state.currentHintIndex)) return false;
          const previousHintIndex = state.currentHintIndex;
          state.currentHintIndex += 1;
          uiState.pendingWaitTeams.clear();
          uiState.pendingGuessTeams.clear();
          uiState.statusPulseTeams.clear();
          state.teams.forEach((team) => {
            if (team.blockedHintIndex !== null && team.blockedHintIndex < state.currentHintIndex) {
              team.blockedHintIndex = null;
            }
            if (team.wrongHintIndex === previousHintIndex) {
              team.wrongHintIndex = null;
            }
            team.waitedHintIndex = null;
          });

          if (state.currentHintIndex > 4) {
            endRoundAsNoAnswer();
          } else {
            resetWaitStatesForHint(state.currentHintIndex);
            renderRound();
          }
          return true;
        }

        function handleWrongGuess(teamIndex) {
          const team = state.teams[teamIndex];
          team.wrongHintIndex = state.currentHintIndex;
          team.blockedHintIndex = state.currentHintIndex + 1;
          uiState.pendingGuessTeams.delete(teamIndex);
          triggerStatusPulse(teamIndex);
          setMessage(roundMessage, "إجابة خاطئة. لا يمكن لهذا الفريق التخمين في التلميح التالي.", "bad");
        }

        function checkGuess() {
          const guess = guessInput.value;
          if (!guess.trim()) {
            setMessage(guessError, "اكتب إجابة أولًا.", "bad");
            return;
          }

          const round = state.rounds[state.currentRoundIndex];
          if (!round) {
            closeGuessModal();
            setMessage(roundMessage, "تعذر التحقق من الإجابة حاليًا.", "bad");
            return;
          }
          const accepted = [round.answer, ...(round.aliases || [])];
          const correct = isAcceptedAnswer(guess, accepted);
          const teamIndex = state.selectedTeamIndex;
          if (!Number.isInteger(teamIndex) || !state.teams[teamIndex]) {
            closeGuessModal();
            return;
          }
          closeGuessModal();

          if (correct) {
            const points = POINTS[state.currentHintIndex] || 1;
            state.teams[teamIndex].score += points;
            uiState.pendingGuessTeams.delete(teamIndex);
            resultTitle.textContent = "إجابة صحيحة";
            resultText.textContent = `الفريق الفائز: ${state.teams[teamIndex].name} — النقاط: ${points} — الإجابة: ${round.answer}`;
            showScreen(resultScreen);
            saveLocalResume();
            return;
          }

          handleWrongGuess(teamIndex);
          const advanced = progressHintIfAllowed();
          if (!advanced) {
            renderRound();
          }
          saveLocalResume();
        }

        function handleTeamAction(event) {
          const btn = event.target.closest("button[data-action]");
          if (!btn) return;
          const action = btn.getAttribute("data-action");
          const teamIndex = Number(btn.getAttribute("data-team"));

          if (action === "guess") {
            if (isBlockedNow(state.teams[teamIndex])) return;
            openGuessModal(teamIndex);
            return;
          }

          if (action === "wait") {
            state.teams[teamIndex].waitedHintIndex = state.currentHintIndex;
            uiState.pendingWaitTeams.delete(teamIndex);
            triggerStatusPulse(teamIndex);
            setMessage(roundMessage, "تم تسجيل الانتظار لهذا الفريق.");
            progressHintIfAllowed();
          }
        }

        function prepareNextRound() {
          state.currentRoundIndex += 1;
          if (state.currentRoundIndex >= state.rounds.length) {
            const [teamA, teamB] = state.teams;
            let winnerText = "تعادل";
            if (teamA.score > teamB.score) winnerText = `الفائز: ${teamA.name}`;
            if (teamB.score > teamA.score) winnerText = `الفائز: ${teamB.name}`;

            finalText.textContent = `${teamA.name}: ${teamA.score} نقطة | ${teamB.name}: ${teamB.score} نقطة — ${winnerText}`;
            showScreen(finalScreen);
            saveLocalResume();
            return;
          }

          state.currentHintIndex = 0;
          state.teams.forEach((team) => {
            team.blockedHintIndex = null;
            team.waitedHintIndex = null;
          });
          uiState.activeGuessTeamIndex = null;
          uiState.pendingGuessTeams.clear();
          uiState.pendingWaitTeams.clear();
          uiState.statusPulseTeams.clear();
          setMessage(roundMessage, "");
          showScreen(roundScreen);
          renderRound();
          saveLocalResume();
        }

        async function startGame() {
          const t1 = teamOneInput.value.trim() || "الفريق الأول";
          const t2 = teamTwoInput.value.trim() || "الفريق الثاني";
          resetLocalRoundState(t1, t2);
          setMessage(setupMessage, "جاري تحميل الأسئلة...");

          const rounds = await loadRounds();
          if (!rounds.length) {
            setMessage(setupMessage, "تعذر تحميل بيانات اللعبة.", "bad");
            return;
          }

          state.rounds = rounds;
          setMessage(setupMessage, "");
          setMessage(roundMessage, "");
          showScreen(roundScreen);
          renderRound();
          saveLocalResume();
        }

        function resetLocalRoundState(teamOneName, teamTwoName) {
          state.teams = [
            { name: teamOneName, score: 0, blockedHintIndex: null, waitedHintIndex: null, wrongHintIndex: null },
            { name: teamTwoName, score: 0, blockedHintIndex: null, waitedHintIndex: null, wrongHintIndex: null }
          ];
          state.currentRoundIndex = 0;
          state.currentHintIndex = 0;
        }

        function syncStateFromGameState(gameState) {
          if (!gameState) return;
          state.rounds = Array.isArray(gameState.rounds) ? gameState.rounds : [];
          state.currentRoundIndex = Number(gameState.currentRoundIndex) || 0;
          state.currentHintIndex = Number(gameState.currentHintIndex) || 0;
          if (Array.isArray(gameState.teams) && gameState.teams.length >= 2) {
            state.teams = gameState.teams;
            state.teams.forEach((team, idx) => {
              if (team.waitedHintIndex === state.currentHintIndex) {
                uiState.pendingWaitTeams.delete(idx);
              }
              if (team.wrongHintIndex === state.currentHintIndex) {
                uiState.pendingGuessTeams.delete(idx);
              }
            });
          }
        }

        function getOnlinePlayerName() {
          return playerNameInput.value.trim() || "لاعب";
        }

        function getPlayerList(roomData) {
          return Object.entries(roomData?.players || {}).map(([uid, player]) => ({ uid, ...(player || {}) }));
        }

        function renderLobby(roomData) {
          roomCodeLabel.textContent = onlineState.session?.roomCode || "";
          const players = getPlayerList(roomData);
          playersList.innerHTML = players
            .map((player) => {
              const roleLabel = player.role === "host" ? " (المنشئ)" : "";
              const status = player.isConnected ? "متصل" : "غير متصل";
              return `<li>${player.name || "لاعب"}${roleLabel} — ${status}</li>`;
            })
            .join("");

          const isHost = onlineState.session?.role === "host";
          const enoughPlayers = players.length >= 2;
          startOnlineBtn.classList.toggle("hidden", !isHost);
          startOnlineBtn.disabled = !enoughPlayers;

          if (isHost) {
            setMessage(
              onlineLobbyMessage,
              enoughPlayers ? "تم الانضمام إلى الغرفة. يمكنك بدء اللعبة." : "في انتظار انضمام اللاعب الآخر"
            );
          } else {
            setMessage(onlineLobbyMessage, "تم الانضمام إلى الغرفة");
            if (roomData?.public?.gameState?.phase === "lobby") {
              setMessage(onlineLobbyMessage, "فقط منشئ الغرفة يمكنه بدء اللعبة");
            }
          }
        }

        async function submitOnlineAction(type, payload) {
          if (!onlineState.session || !gameRooms) return;
          await gameRooms.submitGameRoomAction(onlineState.session.roomCode, { type, payload });
        }

        async function hostUpdateGameState(patch) {
          if (!onlineState.session || onlineState.session.role !== "host") return;
          await gameRooms.updateGameRoomPublicState(onlineState.session.roomCode, { gameState: patch });
        }

        async function bootstrapOnlineGame(teamsFromRoom) {
          const rounds = await loadRounds();
          if (!rounds.length) throw new Error("تعذر تحميل بيانات اللعبة.");
          const gameState = {
            phase: "round",
            status: "playing",
            rounds,
            currentRoundIndex: 0,
            currentHintIndex: 0,
            teams: teamsFromRoom.map((team) => ({
              name: team.name || "فريق",
              score: 0,
              blockedHintIndex: null,
              waitedHintIndex: null,
              wrongHintIndex: null,
            })),
            roundResult: null,
            finalResult: null,
            processedClientRequestIds: [],
            updatedAt: Date.now(),
          };
          await hostUpdateGameState(gameState);
        }

        function withProcessedAction(gameState, action) {
          const processed = Array.isArray(gameState.processedClientRequestIds)
            ? gameState.processedClientRequestIds.slice(-100)
            : [];
          if (processed.includes(action.clientRequestId)) return null;
          processed.push(action.clientRequestId);
          return { ...gameState, processedClientRequestIds: processed, updatedAt: Date.now() };
        }

        function calculateAfterWait(gameState, teamIndex) {
          const nextState = structuredClone(gameState);
          if (nextState.phase !== "round") return nextState;
          if (!Number.isInteger(teamIndex) || !nextState.teams?.[teamIndex]) return nextState;
          nextState.teams[teamIndex].waitedHintIndex = nextState.currentHintIndex;
          const previousHintIndex = nextState.currentHintIndex;
          if (shouldAdvanceHint(nextState.teams, nextState.currentHintIndex)) {
            nextState.currentHintIndex += 1;
            nextState.teams.forEach((team) => {
              if (team.blockedHintIndex !== null && team.blockedHintIndex < nextState.currentHintIndex) {
                team.blockedHintIndex = null;
              }
              if (team.wrongHintIndex === previousHintIndex) {
                team.wrongHintIndex = null;
              }
              team.waitedHintIndex = null;
            });
            if (nextState.currentHintIndex > 4) {
              nextState.phase = "result";
              nextState.roundResult = {
                title: "انتهت التلميحات",
                text: `الإجابة: ${nextState.rounds[nextState.currentRoundIndex].answer} — لم يحصل أي فريق على نقاط`,
              };
            }
          }
          return nextState;
        }

        function calculateAfterGuess(gameState, teamIndex, guess) {
          const nextState = structuredClone(gameState);
          if (nextState.phase !== "round") return nextState;
          if (!Number.isInteger(teamIndex) || !nextState.teams?.[teamIndex]) return nextState;
          const round = nextState.rounds[nextState.currentRoundIndex];
          if (!round) return nextState;
          const accepted = [round.answer, ...(round.aliases || [])];
          const correct = isAcceptedAnswer(guess, accepted);
          if (correct) {
            const points = POINTS[nextState.currentHintIndex] || 1;
            nextState.teams[teamIndex].score += points;
            nextState.phase = "result";
            nextState.roundResult = {
              title: "إجابة صحيحة",
              text: `الفريق الفائز: ${nextState.teams[teamIndex].name} — النقاط: ${points} — الإجابة: ${round.answer}`,
            };
            return nextState;
          }
          nextState.teams[teamIndex].wrongHintIndex = nextState.currentHintIndex;
          nextState.teams[teamIndex].blockedHintIndex = nextState.currentHintIndex + 1;
          if (shouldAdvanceHint(nextState.teams, nextState.currentHintIndex)) {
            const previousHintIndex = nextState.currentHintIndex;
            nextState.currentHintIndex += 1;
            nextState.teams.forEach((team) => {
              if (team.blockedHintIndex !== null && team.blockedHintIndex < nextState.currentHintIndex) {
                team.blockedHintIndex = null;
              }
              if (team.wrongHintIndex === previousHintIndex) {
                team.wrongHintIndex = null;
              }
              team.waitedHintIndex = null;
            });
            if (nextState.currentHintIndex > 4) {
              nextState.phase = "result";
              nextState.roundResult = {
                title: "انتهت التلميحات",
                text: `الإجابة: ${nextState.rounds[nextState.currentRoundIndex].answer} — لم يحصل أي فريق على نقاط`,
              };
            }
          }
          return nextState;
        }

        function calculateAfterNextRound(gameState) {
          const nextState = structuredClone(gameState);
          nextState.currentRoundIndex += 1;
          if (nextState.currentRoundIndex >= nextState.rounds.length) {
            const [teamA, teamB] = nextState.teams;
            let winnerText = "تعادل";
            if (teamA.score > teamB.score) winnerText = `الفائز: ${teamA.name}`;
            if (teamB.score > teamA.score) winnerText = `الفائز: ${teamB.name}`;
            nextState.phase = "final";
            nextState.finalResult = `${teamA.name}: ${teamA.score} نقطة | ${teamB.name}: ${teamB.score} نقطة — ${winnerText}`;
            return nextState;
          }
          nextState.phase = "round";
          nextState.currentHintIndex = 0;
          nextState.roundResult = null;
          nextState.teams.forEach((team) => {
            team.blockedHintIndex = null;
            team.waitedHintIndex = null;
            team.wrongHintIndex = null;
          });
          return nextState;
        }

        async function processRoomActions(roomData) {
          if (!roomData || onlineState.session?.role !== "host" || onlineState.processingActions) return;
          const gameState = roomData.public?.gameState;
          if (!gameState || gameState.phase === "lobby") return;
          onlineState.processingActions = true;
          try {
            const actions = Object.values(roomData.actions || {})
              .filter((action) => action && action.status === "pending")
              .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            let workingState = gameState;
            for (const action of actions) {
              const withMeta = withProcessedAction(workingState, action);
              if (!withMeta) {
                await gameRooms.markGameRoomActionProcessed(onlineState.session.roomCode, action.actionId, { skipped: true });
                continue;
              }
              if (withMeta.phase !== "round" && action.type !== "nextRoundRequest") {
                workingState = withMeta;
                await gameRooms.markGameRoomActionProcessed(onlineState.session.roomCode, action.actionId, { skipped: true });
                continue;
              }
              let nextState = withMeta;
              if (action.type === "submitGuess") {
                nextState = calculateAfterGuess(nextState, Number(action.payload?.teamIndex), action.payload?.guess || "");
              } else if (action.type === "waitAction") {
                nextState = calculateAfterWait(nextState, Number(action.payload?.teamIndex));
              } else if (action.type === "nextRoundRequest") {
                nextState = calculateAfterNextRound(nextState);
              }
              workingState = { ...nextState, updatedAt: Date.now() };
              await gameRooms.markGameRoomActionProcessed(onlineState.session.roomCode, action.actionId, { ok: true });
            }
            if (actions.length) {
              await hostUpdateGameState(workingState);
            }
          } finally {
            onlineState.processingActions = false;
          }
        }

        async function startOnlineRoomListeners(session) {
          if (onlineState.unsubscribeRoom) onlineState.unsubscribeRoom();
          if (onlineState.unsubscribePresence) onlineState.unsubscribePresence();
          onlineState.unsubscribeRoom = gameRooms.listenToGameRoom(session.roomCode, async (roomData) => {
            onlineState.roomData = roomData || null;
            if (!roomData) {
              setMessage(onlineLobbyMessage, "الغرفة غير متاحة حاليًا.", "bad");
              showScreen(onlineLobbyScreen);
              return;
            }
            if (roomData.meta?.gameKey !== GAME_KEY) {
              setMessage(onlineLobbyMessage, "هذه الغرفة ليست للعبة خمنها من التلميح.", "bad");
              showScreen(onlineLobbyScreen);
              return;
            }
            renderLobby(roomData);
            const gs = roomData.public?.gameState;
            if (gs?.phase === "lobby") {
              resetGuessInteractionState();
              showScreen(onlineLobbyScreen);
            } else if (gs) {
              syncStateFromGameState(gs);
              if (gs.phase === "round") {
                showScreen(roundScreen);
                renderRound();
              } else if (gs.phase === "result") {
                resetGuessInteractionState();
                resultTitle.textContent = gs.roundResult?.title || "نتيجة الجولة";
                resultText.textContent = gs.roundResult?.text || "";
                showScreen(resultScreen);
              } else if (gs.phase === "final") {
                resetGuessInteractionState();
                finalText.textContent = gs.finalResult || "";
                showScreen(finalScreen);
              }
            }
            await processRoomActions(roomData);
          });
          onlineState.unsubscribePresence = await gameRooms.attachGameRoomPresence(session.roomCode, {
            sessionId: session.sessionId,
          });
        }

        async function createRoomFlow() {
          try {
            if (!gameRooms) throw new Error("خدمة اللعب الأونلاين غير متاحة الآن.");
            setMessage(onlineRoomMessage, "جاري إنشاء الغرفة...");
            const session = await gameRooms.createGameRoom({
              gameType: GAME_KEY,
              hostName: getOnlinePlayerName(),
              maxTeams: 2,
            });
            onlineState.enabled = true;
            onlineState.session = session;
            await startOnlineRoomListeners(session);
            showScreen(onlineLobbyScreen);
          } catch (error) {
            setMessage(onlineRoomMessage, error.message || "تعذر إنشاء الغرفة.", "bad");
          }
        }

        async function joinRoomFlow() {
          try {
            if (!gameRooms) throw new Error("خدمة اللعب الأونلاين غير متاحة الآن.");
            const roomCode = roomCodeInput.value.trim().toUpperCase();
            if (!roomCode) {
              setMessage(onlineRoomMessage, "أدخل كود الغرفة أولًا.", "bad");
              return;
            }
            setMessage(onlineRoomMessage, "جاري الانضمام...");
            const session = await gameRooms.joinGameRoom({
              roomCode,
              playerName: getOnlinePlayerName(),
            });
            onlineState.enabled = true;
            onlineState.session = { ...session, gameType: GAME_KEY };
            gameRooms.saveGameRoomSession(onlineState.session);
            await startOnlineRoomListeners(onlineState.session);
            showScreen(onlineLobbyScreen);
          } catch (error) {
            setMessage(onlineRoomMessage, error.message || "تعذر الانضمام للغرفة.", "bad");
          }
        }

        async function startOnlineGameByHost() {
          if (onlineState.session?.role !== "host") return;
          const phase = onlineState.roomData?.public?.gameState?.phase;
          if (phase && phase !== "lobby") {
            setMessage(onlineLobbyMessage, "اللعبة بدأت بالفعل.");
            return;
          }
          const players = getPlayerList(onlineState.roomData);
          const hostPlayer = players.find((player) => player.role === "host");
          const guestPlayer = players.find((player) => player.role !== "host" && player.isConnected);
          if (!hostPlayer || !guestPlayer) {
            setMessage(onlineLobbyMessage, "في انتظار انضمام اللاعب الآخر", "bad");
            return;
          }
          setMessage(onlineLobbyMessage, "جاري بدء اللعبة...");
          await bootstrapOnlineGame([hostPlayer, guestPlayer]);
        }

        async function restoreSessionIfAvailable() {
          if (!gameRooms) return;
          const restored = gameRooms.restoreGameRoomSession();
          if (!restored || restored.gameType !== GAME_KEY) return;
          onlineState.enabled = true;
          onlineState.session = restored;
          playerNameInput.value = restored.playerName || "";
          try {
            await startOnlineRoomListeners(restored);
          } catch (_error) {
            gameRooms.clearGameRoomSession();
          }
        }

        function openGuess(teamIndex) {
          if (!onlineState.enabled) {
            if (isBlockedNow(state.teams[teamIndex])) return;
            openGuessModal(teamIndex);
            return;
          }
          if (isBlockedNow(state.teams[teamIndex])) return;
          openGuessModal(teamIndex);
        }

        async function submitGuessFromModal() {
          const guess = guessInput.value;
          if (!guess.trim()) {
            setMessage(guessError, "اكتب إجابة أولًا.", "bad");
            return;
          }
          if (!onlineState.enabled) {
            checkGuess();
            return;
          }
          const teamIndex = state.selectedTeamIndex;
          uiState.pendingGuessTeams.add(teamIndex);
          triggerStatusPulse(teamIndex);
          closeGuessModal();
          renderRound();
          await submitOnlineAction("submitGuess", { teamIndex, guess });
        }

        startBtn.addEventListener("click", startGame);
        teamsActions.addEventListener("click", async (event) => {
          const btn = event.target.closest("button[data-action]");
          if (!btn) return;
          acknowledgeButton(btn);
          const action = btn.getAttribute("data-action");
          const teamIndex = Number(btn.getAttribute("data-team"));
          if (action === "guess") {
            openGuess(teamIndex);
            return;
          }
          if (action === "wait") {
            if (!onlineState.enabled) {
              uiState.pendingWaitTeams.delete(teamIndex);
              state.teams[teamIndex].waitedHintIndex = state.currentHintIndex;
              triggerStatusPulse(teamIndex);
              setMessage(roundMessage, "تم تسجيل الانتظار لهذا الفريق.");
              progressHintIfAllowed();
              renderRound();
              return;
            }
            uiState.pendingWaitTeams.add(teamIndex);
            triggerStatusPulse(teamIndex);
            renderRound();
            await submitOnlineAction("waitAction", { teamIndex });
          }
        });
        nextRoundBtn.addEventListener("click", async () => {
          if (!onlineState.enabled) {
            prepareNextRound();
            return;
          }
          await submitOnlineAction("nextRoundRequest", {});
        });
        playAgainBtn.addEventListener("click", () => {
          if (onlineState.enabled) {
            showScreen(onlineLobbyScreen);
            return;
          }
          clearLocalResume();
          showScreen(setupScreen);
        });
        cancelGuessBtn.addEventListener("click", closeGuessModal);
        checkGuessBtn.addEventListener("click", submitGuessFromModal);
        guessInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitGuessFromModal();
          }
          if (event.key === "Escape") closeGuessModal();
        });

        singleDeviceModeBtn.addEventListener("click", () => {
          onlineState.enabled = false;
          clearLocalResume();
          localResumeBox.classList.add("hidden");
          showScreen(setupScreen);
        });
        onlineModeBtn.addEventListener("click", () => {
          clearLocalResume();
          localResumeBox.classList.add("hidden");
          showScreen(onlineRoomScreen);
          setMessage(onlineRoomMessage, "");
        });
        showJoinRoomBtn.addEventListener("click", () => {
          joinRoomPanel.classList.toggle("hidden");
        });
        backToModeBtn.addEventListener("click", () => showScreen(modeScreen));
        createRoomBtn.addEventListener("click", createRoomFlow);
        joinRoomBtn.addEventListener("click", joinRoomFlow);
        startOnlineBtn.addEventListener("click", startOnlineGameByHost);
        leaveRoomBtn.addEventListener("click", () => {
          if (onlineState.unsubscribeRoom) onlineState.unsubscribeRoom();
          if (onlineState.unsubscribePresence) onlineState.unsubscribePresence();
          onlineState.enabled = false;
          onlineState.session = null;
          onlineState.roomData = null;
          if (gameRooms) gameRooms.clearGameRoomSession();
          showScreen(modeScreen);
        });

        resumeLocalBtn.addEventListener("click", () => {
          localResumeBox.classList.add("hidden");
          if (!applyLocalResume(pendingLocalResume)) {
            clearLocalResume();
            showScreen(modeScreen);
          }
          pendingLocalResume = null;
        });
        discardLocalBtn.addEventListener("click", () => {
          pendingLocalResume = null;
          clearLocalResume();
          localResumeBox.classList.add("hidden");
        });

        restoreSessionIfAvailable();
        pendingLocalResume = readLocalResume();
        if (pendingLocalResume) {
          localResumeBox.classList.remove("hidden");
          showScreen(modeScreen);
        }
      })();
  }

  enterBtn.addEventListener("click", async () => {
    enterBtn.disabled = true;
    try {
      await mountRuntime();
      await Promise.all(deps.map(loadScript));
      showGameplayView();
      await initRuntime();
      const modeScreen = document.getElementById("modeScreen");
      if (modeScreen) modeScreen.classList.remove("hidden");
    } catch (error) {
      console.error("[guess-from-hint] Failed to start runtime", error);
      enterBtn.disabled = false;
    }
  });

  if (backToIntroBtn) {
    backToIntroBtn.addEventListener("click", () => {
      showContentView();
    });
  }
})();
