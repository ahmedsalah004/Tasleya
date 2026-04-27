(function () {
  const runtimeVersion =
    (document.currentScript?.src
      ? new URL(document.currentScript.src, window.location.href).searchParams.get("v")
      : null) || "1.2.12";
  const runtimeFragmentUrl = `/map-game/runtime-fragment.html?v=${encodeURIComponent(runtimeVersion)}`;
  const intro = document.getElementById('introScreen');
  const host = document.getElementById('mapGameRuntimeHost');
  const enterBtn = document.getElementById('enterSetupBtn');
  let mounted = false;
  let mounting = false;
  let initialized = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-runtime-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.runtimeSrc = src;
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
      script.addEventListener('error', () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
      document.body.appendChild(script);
    });
  }

  async function mountRuntime() {
    if (mounted || mounting) return;
    mounting = true;
    try {
      const response = await fetch(runtimeFragmentUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`MAP_RUNTIME_LOAD_FAILED_${response.status}`);
      host.innerHTML = await response.text();
      mounted = true;
    } finally {
      mounting = false;
    }
  }

  function initRuntime() {
    if (initialized) return;
    initialized = true;
      const POINTS = { easy: 100, medium: 300, hard: 500 };
      const DIFFICULTY_AR = { easy: "سهل", medium: "متوسط", hard: "صعب" };
      const WORKER_URL_PLACEHOLDER = "https://REPLACE_WITH_YOUR_WORKER_URL";
      const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";
      const CSV_LOAD_ERROR_AR = "تعذر تحميل بيانات الخريطة. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.";
      const SELECTION_CONFIRM_DELAY_MS = 420;
      const MOBILE_RESULT_REVEAL_DELAY_MS = 1700;
      const MOBILE_VIEWPORT_QUERY = "(max-width: 840px)";
      const MAP_MIN_ZOOM = 1;
      const MAP_MAX_ZOOM_DESKTOP = 8;
      const MAP_MAX_ZOOM_MOBILE = 20;
      const UNSUPPORTED_COUNTRY_MESSAGE = "هذه الدولة غير متاحة حالياً في أسئلة اللعبة. اختر دولة أخرى.";
      const MAP_GAME_USED_STORAGE_KEY = "tasleya_map_game_used_v1";
      const MAP_GAME_USED_STORAGE_VERSION = 1;
      const MAP_GAME_STATE_STORAGE_KEY = "tasleya_map_game_state_v1";
      const MAP_GAME_STATE_STORAGE_VERSION = 1;
      const MAP_GAME_MODE_MAP = "map";
      const MAP_GAME_MODE_IMAGE = "image";
      const MAP_GAME_MODE_LANGUAGE = "language";
      const LANGUAGE_MODE_INSTRUCTION = "استمع إلى اللغة ثم اختر الدولة على الخريطة";
      const IMAGE_MODE_INSTRUCTION = "شاهد الصورة وحدد الدولة على الخريطة.";
      const IMAGE_LOAD_ERROR_AR = "تعذر تحميل الصورة.";
      const ROUND_REQUIREMENTS = [
        { difficulty: "easy", points: 100, count: 4 },
        { difficulty: "medium", points: 300, count: 8 },
        { difficulty: "hard", points: 500, count: 8 },
      ];
      const ROUND_REQUIREMENTS_BY_MODE = {
        [MAP_GAME_MODE_MAP]: ROUND_REQUIREMENTS,
        [MAP_GAME_MODE_IMAGE]: [
          { difficulty: "easy", count: 4 },
          { difficulty: "medium", count: 8 },
          { difficulty: "hard", count: 8 },
        ],
        [MAP_GAME_MODE_LANGUAGE]: ROUND_REQUIREMENTS,
      };
      const WORLD_MAP_URL =
        "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";
      const NAME_NORMALIZATION_ALIASES = new Map([
        ["unitedstatesofamerica", "unitedstates"],
        ["usa", "unitedstates"],
        ["russianfederation", "russia"],
        ["bosniaandherz", "bosniaandherzegovina"],
        ["bosniaherzegovina", "bosniaandherzegovina"],
        ["dominicanrep", "dominicanrepublic"],
        ["centralafricanrep", "centralafricanrepublic"],
        ["eqguinea", "equatorialguinea"],
        ["ssudan", "southsudan"],
        ["eswatini", "swaziland"],
        ["vietname", "vietnam"],
        ["vietnam", "vietnam"],
        ["laopdr", "laos"],
        ["laopeoplesdemocraticrepublic", "laos"],
        ["cotedivoire", "ivorycoast"],
        ["myanmarburma", "myanmar"],
        ["republicofthecongo", "congo"],
        ["congobrazzaville", "congo"],
        ["drcongo", "democraticrepublicofthecongo"],
        ["democraticrepublicofthecongo", "democraticrepublicofthecongo"],
        ["republicofserbia", "serbia"],
        ["capeverde", "caboverde"],
        ["czechia", "czechrepublic"],
        ["syrianarabrepublic", "syria"],
        ["unitedrepublicoftanzania", "tanzania"],
        ["thegambia", "gambia"],
        ["timorleste", "easttimor"],
        ["brunei", "brunei"],
        ["bruneidarussalam", "brunei"],
        ["statesofpalestine", "palestine"],
      ]);

      const state = {
        started: false,
        questions: [],
        questionPool: [],
        questionIndex: 0,
        teamNames: ["الفريق الأول", "الفريق الثاني"],
        scores: [0, 0],
        teamPicks: [null, null],
        otherTeamAcceptedActiveAnswer: false,
        pendingPick: null,
        pendingTeamIndex: null,
        phase: "active_pick", // active_pick | other_response | ready_reveal | revealed | finished
        mapReady: false,
        mapLoadPromise: null,
        mapLoadError: "",
        centroids: new Map(),
        mapCentroids: new Map(),
        mapFeaturesByCode: new Map(),
        questionByCountryCode: new Map(),
        countryCodeByNormalizedName: new Map(),
        countryCodeByNormalizedNameAllModes: new Map(),
        pointerTapThreshold: 18,
        activePointer: null,
        unsupportedCountriesLogged: new Set(),
        mapDiagnostics: {
          missingByCode: [],
          unmatchedByName: [],
          smallCountryCodes: [],
        },
        usedQuestionHistory: {
          easy: new Set(),
          medium: new Set(),
          hard: new Set(),
        },
        isRevealingAnswer: false,
        resultRevealTimeoutId: null,
        pendingResume: null,
        initializing: false,
        selectedMode: MAP_GAME_MODE_MAP,
        questionPoolByMode: {
          [MAP_GAME_MODE_MAP]: [],
          [MAP_GAME_MODE_IMAGE]: [],
          [MAP_GAME_MODE_LANGUAGE]: [],
        },
        questionsReadyByMode: {
          [MAP_GAME_MODE_MAP]: false,
          [MAP_GAME_MODE_IMAGE]: false,
          [MAP_GAME_MODE_LANGUAGE]: false,
        },
        modeLoadErrorByMode: {
          [MAP_GAME_MODE_MAP]: "",
          [MAP_GAME_MODE_IMAGE]: "",
          [MAP_GAME_MODE_LANGUAGE]: "",
        },
        questionsLoadPromiseByMode: {
          [MAP_GAME_MODE_MAP]: null,
          [MAP_GAME_MODE_IMAGE]: null,
          [MAP_GAME_MODE_LANGUAGE]: null,
        },
        audioPlayer: null,
        audioErrorByQuestionId: new Map(),
        imageLoadStateByQuestionId: new Map(),
        imageLoadTimeoutId: null,
        currentImageRequestId: 0,
        imagePreloader: null,
      };

      const el = {
        introScreen: document.getElementById("introScreen"),
        enterSetupBtn: document.getElementById("enterSetupBtn"),
        setupScreen: document.getElementById("setupScreen"),
        gameScreen: document.getElementById("gameScreen"),
        startBtn: document.getElementById("startBtn"),
        setupErrorText: document.getElementById("setupErrorText"),
        team1Name: document.getElementById("team1Name"),
        team2Name: document.getElementById("team2Name"),
        team1Label: document.getElementById("team1Label"),
        team2Label: document.getElementById("team2Label"),
        team1Score: document.getElementById("team1Score"),
        team2Score: document.getElementById("team2Score"),
        team1Card: document.getElementById("team1Card"),
        team2Card: document.getElementById("team2Card"),
        questionMeta: document.getElementById("questionMeta"),
        questionNumberMeta: document.getElementById("questionNumberMeta"),
        questionDifficultyMeta: document.getElementById("questionDifficultyMeta"),
        questionPointsMeta: document.getElementById("questionPointsMeta"),
        targetCountry: document.getElementById("targetCountry"),
        turnIndicator: document.getElementById("turnIndicator"),
        turnValue: document.getElementById("turnValue"),
        turnInstruction: document.getElementById("turnInstruction"),
        acceptActiveAnswerBtn: document.getElementById("acceptActiveAnswerBtn"),
        mapStage: document.getElementById("mapStage"),
        mapLoading: document.getElementById("mapLoading"),
        overlay: document.getElementById("overlay"),
        overlayTitle: document.getElementById("overlayTitle"),
        overlayText: document.getElementById("overlayText"),
        overlayActions: document.getElementById("overlayActions"),
        resumePrompt: document.getElementById("resumePrompt"),
        resumeBtn: document.getElementById("resumeBtn"),
        discardResumeBtn: document.getElementById("discardResumeBtn"),
        modeMap: document.getElementById("modeMap"),
        modeImage: document.getElementById("modeImage"),
        modeLanguage: document.getElementById("modeLanguage"),
        modeStatus: document.getElementById("modeStatus"),
        modeStatusText: document.getElementById("modeStatusText"),
        retryModeLoadBtn: document.getElementById("retryModeLoadBtn"),
        switchToMapModeBtn: document.getElementById("switchToMapModeBtn"),
        targetTitle: document.getElementById("targetTitle"),
        targetHintText: document.getElementById("targetHintText"),
        audioControls: document.getElementById("audioControls"),
        playAudioBtn: document.getElementById("playAudioBtn"),
        audioStatusText: document.getElementById("audioStatusText"),
        imagePromptWrap: document.getElementById("imagePromptWrap"),
        imageQuestionText: document.getElementById("imageQuestionText"),
        imageLoading: document.getElementById("imageLoading"),
        imageError: document.getElementById("imageError"),
        questionImage: document.getElementById("questionImage"),
      };
      const modeRadioInputs = [el.modeMap, el.modeImage, el.modeLanguage].filter(Boolean);
      const modeSelector = document.querySelector(".mode-selector");


      function normalizeCell(value) {
        return String(value || "").replace(/^\uFEFF/, "").trim();
      }

      function normalizeImageUrl(value) {
        const raw = normalizeCell(value);
        if (!raw) return "";
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.startsWith("/")) return raw;
        if (raw.startsWith("assets/")) return `/${raw}`;
        return "";
      }

      function normalizeAudioUrl(value) {
        const raw = normalizeCell(value);
        if (!raw) return "";
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.startsWith("/")) return raw;
        if (raw.startsWith("assets/")) return `/${raw}`;
        return "";
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
        const requestUrl = buildApiUrl(path);
        let response;
        try {
          response = await fetch(requestUrl);
        } catch (error) {
          console.error("[MapGame] API request failed", { path, url: requestUrl.toString(), error });
          throw new Error(CSV_LOAD_ERROR_AR);
        }

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = normalizeCell(payload?.error) || CSV_LOAD_ERROR_AR;
          console.error("[MapGame] API returned non-OK response", {
            path,
            url: requestUrl.toString(),
            status: response.status,
            payload,
          });
          throw new Error(message);
        }
        return payload;
      }

      const shuffle = (list) => {
        const arr = [...list];
        for (let i = arr.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      function normalizeName(name) {
        if (!name) return "";
        const baseName = name
          .replace(/\s*\([^)]*\)/g, "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/&/g, "and")
          .replace(/[^a-z0-9]+/g, "");
        return NAME_NORMALIZATION_ALIASES.get(baseName) || baseName;
      }

      function normalizeCountryCode(value) {
        return String(value || "").trim().toUpperCase();
      }

      const COUNTRY_CODE_ALIASES = new Map([
        ["UK", "GB"],
        ["EL", "GR"],
        ["GL", "GL"],
        ["DK", "DK"],
      ]);
      const SELECTION_COUNTRY_CODE_ALIASES = new Map([
        ["UK", "GB"],
        ["USA", "US"],
        ["ARE", "AE"],
        ["CHN", "CN"],
        ["GBR", "GB"],
        ["JPN", "JP"],
        ["ESP", "ES"],
        ["IND", "IN"],
        ["EGY", "EG"],
        ["FRA", "FR"],
        ["UAE", "AE"],
      ]);

      function normalizeQuestionCountryCode(value) {
        const code = normalizeCountryCode(value);
        return COUNTRY_CODE_ALIASES.get(code) || code;
      }

      function normalizeSelectionCountryCode(value) {
        const code = normalizeCountryCode(value);
        if (!code) return "";
        if (SELECTION_COUNTRY_CODE_ALIASES.has(code)) {
          return SELECTION_COUNTRY_CODE_ALIASES.get(code);
        }
        return COUNTRY_CODE_ALIASES.get(code) || code;
      }

      function normalizeQuestionDifficulty(value) {
        const normalized = String(value || "").trim().toLowerCase();
        if (["easy", "medium", "hard"].includes(normalized)) return normalized;
        const numeric = Number(normalized);
        if (Number.isFinite(numeric)) {
          if (numeric <= 2) return "easy";
          if (numeric === 3) return "medium";
          if (numeric >= 4) return "hard";
        }
        return "";
      }

      function normalizeIdentityPart(value) {
        return String(value || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "_");
      }

      function buildQuestionKey(question) {
        const stableId = String(question.id || "").trim();
        if (stableId) return `id:${stableId}`;
        const normalizedCountry = normalizeIdentityPart(
          question.targetCountryNameEn || question.countryNameEn || question.targetCountryNameAr || question.countryNameAr || question.targetCountryCode || question.countryCode
        );
        const normalizedPrompt = normalizeIdentityPart(question.imageUrl || question.audioUrl || question.placeNameEn || "");
        return `fallback:${normalizedCountry}|${normalizedPrompt}|${question.difficulty}|${question.points}`;
      }

      function getEmptyUsedHistory() {
        return {
          easy: new Set(),
          medium: new Set(),
          hard: new Set(),
        };
      }

      function loadUsedQuestionHistory() {
        const empty = getEmptyUsedHistory();
        try {
          const raw = localStorage.getItem(MAP_GAME_USED_STORAGE_KEY);
          if (!raw) return empty;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return empty;
          if (parsed.version !== MAP_GAME_USED_STORAGE_VERSION || !parsed.usedByBucket || typeof parsed.usedByBucket !== "object") {
            return empty;
          }
          ["easy", "medium", "hard"].forEach((bucket) => {
            const values = parsed.usedByBucket[bucket];
            if (!Array.isArray(values)) return;
            values.forEach((value) => {
              if (typeof value === "string" && value) empty[bucket].add(value);
            });
          });
          return empty;
        } catch (error) {
          console.warn("[MapGame] Failed to parse used history. Resetting.", error);
          return empty;
        }
      }

      function saveUsedQuestionHistory(history = state.usedQuestionHistory) {
        try {
          const payload = {
            version: MAP_GAME_USED_STORAGE_VERSION,
            usedByBucket: {
              easy: Array.from(history.easy),
              medium: Array.from(history.medium),
              hard: Array.from(history.hard),
            },
          };
          localStorage.setItem(MAP_GAME_USED_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
          console.warn("[MapGame] Failed to save used history.", error);
        }
      }

      function pickUniqueQuestions(candidates, count, roundUsedKeys, roundUsedCountryCodes) {
        const picked = [];
        const shuffled = shuffle(candidates);
        for (const item of shuffled) {
          if (picked.length >= count) break;
          if (roundUsedKeys.has(item.questionKey)) continue;
          const targetCode = item.targetCountryCode || item.countryCode;
          if (targetCode && roundUsedCountryCodes && roundUsedCountryCodes.has(targetCode)) continue;
          roundUsedKeys.add(item.questionKey);
          if (targetCode && roundUsedCountryCodes) roundUsedCountryCodes.add(targetCode);
          picked.push(item);
        }
        return picked;
      }

      function clearSavedGameState() {
        try {
          localStorage.removeItem(MAP_GAME_STATE_STORAGE_KEY);
        } catch (_) {}
      }

      function createPersistedGameState() {
        if (!state.started || state.phase === "finished") return null;
        return {
          version: MAP_GAME_STATE_STORAGE_VERSION,
          started: true,
          questions: state.questions,
          questionIndex: state.questionIndex,
          teamNames: state.teamNames,
          scores: state.scores,
          teamPicks: state.teamPicks,
          otherTeamAcceptedActiveAnswer: state.otherTeamAcceptedActiveAnswer,
          pendingPick: state.pendingPick,
          pendingTeamIndex: state.pendingTeamIndex,
          phase: state.phase,
          selectedMode: state.selectedMode,
          savedAt: Date.now(),
        };
      }

      function persistGameState() {
        const snapshot = createPersistedGameState();
        if (!snapshot) {
          clearSavedGameState();
          return;
        }
        try {
          localStorage.setItem(MAP_GAME_STATE_STORAGE_KEY, JSON.stringify(snapshot));
        } catch (_) {}
      }

      function readSavedGameState() {
        try {
          const raw = localStorage.getItem(MAP_GAME_STATE_STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.version !== MAP_GAME_STATE_STORAGE_VERSION || !parsed.started) return null;
          if (!Array.isArray(parsed.questions) || !parsed.questions.length) return null;
          return parsed;
        } catch (_) {
          return null;
        }
      }

      function restoreSavedGameState(saved) {
        if (!saved) return false;
        if (!Array.isArray(saved.questions) || !saved.questions.length) return false;
        state.selectedMode = [MAP_GAME_MODE_MAP, MAP_GAME_MODE_IMAGE, MAP_GAME_MODE_LANGUAGE].includes(saved.selectedMode) ? saved.selectedMode : MAP_GAME_MODE_MAP;
        el.modeMap.checked = state.selectedMode === MAP_GAME_MODE_MAP;
        el.modeImage.checked = state.selectedMode === MAP_GAME_MODE_IMAGE;
        el.modeLanguage.checked = state.selectedMode === MAP_GAME_MODE_LANGUAGE;
        applyModeUiState();
        state.questions = saved.questions;
        state.questionIndex = Math.max(0, Math.min(saved.questions.length - 1, Number(saved.questionIndex) || 0));
        state.teamNames = Array.isArray(saved.teamNames) ? [String(saved.teamNames[0] || "الفريق الأول"), String(saved.teamNames[1] || "الفريق الثاني")] : ["الفريق الأول", "الفريق الثاني"];
        state.scores = Array.isArray(saved.scores) ? [Number(saved.scores[0]) || 0, Number(saved.scores[1]) || 0] : [0, 0];
        state.teamPicks = Array.isArray(saved.teamPicks) ? [saved.teamPicks[0] || null, saved.teamPicks[1] || null] : [null, null];
        state.otherTeamAcceptedActiveAnswer = Boolean(saved.otherTeamAcceptedActiveAnswer);
        state.pendingPick = saved.pendingPick || null;
        state.pendingTeamIndex = Number.isInteger(saved.pendingTeamIndex) ? saved.pendingTeamIndex : null;
        state.phase = ["active_pick", "other_response", "ready_reveal", "revealed"].includes(saved.phase) ? saved.phase : "active_pick";
        state.started = true;
        el.team1Name.value = state.teamNames[0];
        el.team2Name.value = state.teamNames[1];
        el.setupScreen.style.display = "none";
        el.gameScreen.classList.add("active");
        clearPendingResultReveal();
        hideOverlay();
        updateHeader();
        updateMapHighlights();
        updateAudioUi();
        persistGameState();
        return true;
      }

      function buildQuestions() {
        const modeKey = [MAP_GAME_MODE_MAP, MAP_GAME_MODE_IMAGE, MAP_GAME_MODE_LANGUAGE].includes(state.selectedMode)
          ? state.selectedMode
          : MAP_GAME_MODE_MAP;
        const requirements = ROUND_REQUIREMENTS_BY_MODE[modeKey] || ROUND_REQUIREMENTS;
        const strictDistribution = modeKey === MAP_GAME_MODE_MAP;
        const mapFeatureCodes = new Set(
          Array.from(el.mapStage?.querySelectorAll?.(".country[data-country-code]") || [])
            .map((node) => normalizeQuestionCountryCode(node.dataset.countryCode))
            .filter(Boolean)
        );
        const diagnostics = {
          mode: modeKey,
          totalRows: state.questionPool.length,
          withCountryCode: 0,
          withMapFeature: 0,
          withLatLng: 0,
          withAudioUrl: 0,
          validRows: 0,
          rejectedRows: 0,
          rejectedReasons: {
            missingCountryCode: 0,
            missingCountryNameAr: 0,
            missingAudioUrl: 0,
            missingLatLng: 0,
            invalidPoints: 0,
            invalidDifficulty: 0,
            missingMapFeature: 0,
          },
          byDifficulty: { easy: 0, medium: 0, hard: 0, unknown: 0 },
          byPoints: {},
          byDifficultyPoints: {},
          perBucketPool: [],
          duplicateCountrySkipped: 0,
          duplicateQuestionKeySkipped: 0,
        };
        const rejectedRowSamples = [];
        const buildFailureSamples = [];
        const buildFailureReasonCounts = {};
        const trackBuildFailure = (item, reason) => {
          const safeReason = normalizeCell(reason) || "unknown";
          buildFailureReasonCounts[safeReason] = (buildFailureReasonCounts[safeReason] || 0) + 1;
          if (buildFailureSamples.length < 12) {
            const targetCode = item?.targetCountryCode || item?.countryCode || "";
            const rowId = String(item?.id || item?.sourceId || item?.questionKey || targetCode || "").trim() || "(unknown)";
            buildFailureSamples.push({ rowId, reason: safeReason });
          }
        };

        const allRowsWithCountryCode = state.questionPool.filter((item) => {
          const hasCountryCode = Boolean(item.targetCountryCode || item.countryCode);
          if (!hasCountryCode) {
            diagnostics.rejectedRows += 1;
            diagnostics.rejectedReasons.missingCountryCode += 1;
            return false;
          }

          diagnostics.withCountryCode += 1;
          const targetCode = item.targetCountryCode || item.countryCode;
          const hasMapFeature = !mapFeatureCodes.size || mapFeatureCodes.has(targetCode);
          const hasLatLng = Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng));
          const hasCountryNameAr = Boolean(normalizeCell(item.targetCountryNameAr || item.countryNameAr));
          const hasAudioUrl = Boolean(normalizeCell(item.audioUrl || item.audio_url));
          const hasValidPoints = Number.isFinite(Number(item.points));
          const hasDifficulty = Boolean(normalizeQuestionDifficulty(item.difficulty));

          if (hasMapFeature) diagnostics.withMapFeature += 1;
          if (hasLatLng) diagnostics.withLatLng += 1;
          if (hasAudioUrl) diagnostics.withAudioUrl += 1;
          const diff = normalizeQuestionDifficulty(item.difficulty);
          if (diff) diagnostics.byDifficulty[diff] += 1;
          else diagnostics.byDifficulty.unknown += 1;
          const pointsKey = String(item.points);
          diagnostics.byPoints[pointsKey] = (diagnostics.byPoints[pointsKey] || 0) + 1;
          const diffPointsKey = `${diff || "unknown"}:${pointsKey}`;
          diagnostics.byDifficultyPoints[diffPointsKey] = (diagnostics.byDifficultyPoints[diffPointsKey] || 0) + 1;

          const isLanguageMode = modeKey === MAP_GAME_MODE_LANGUAGE;
          const languageRowValid = hasCountryCode && hasCountryNameAr && hasAudioUrl && hasLatLng && hasValidPoints && hasDifficulty;
          const nonLanguageRowValid = hasCountryCode && hasMapFeature;
          const rowId = String(item.id || item.sourceId || item.questionKey || targetCode || "").trim();

          if (isLanguageMode) {
            if (!languageRowValid) {
              diagnostics.rejectedRows += 1;
              const missingFields = [];
              if (!hasCountryNameAr) diagnostics.rejectedReasons.missingCountryNameAr += 1;
              if (!hasCountryNameAr) missingFields.push("targetCountryNameAr|countryNameAr");
              if (!hasAudioUrl) diagnostics.rejectedReasons.missingAudioUrl += 1;
              if (!hasAudioUrl) missingFields.push("audioUrl|audio_url");
              if (!hasLatLng) diagnostics.rejectedReasons.missingLatLng += 1;
              if (!hasLatLng) missingFields.push("lat|lng");
              if (!hasValidPoints) diagnostics.rejectedReasons.invalidPoints += 1;
              if (!hasValidPoints) missingFields.push("points");
              if (!hasDifficulty) diagnostics.rejectedReasons.invalidDifficulty += 1;
              if (!hasDifficulty) missingFields.push("difficulty");
              if (rejectedRowSamples.length < 8) {
                rejectedRowSamples.push({ rowId, missingFields });
              }
              return false;
            }
          } else {
            if (!nonLanguageRowValid) {
              diagnostics.rejectedRows += 1;
              diagnostics.rejectedReasons.missingMapFeature += 1;
              if (rejectedRowSamples.length < 8) {
                rejectedRowSamples.push({ rowId, missingFields: ["mapFeature"] });
              }
              return false;
            }
          }

          diagnostics.validRows += 1;
          return true;
        }).map((item, index) => {
          const existingQuestionKey = normalizeCell(item.questionKey);
          if (existingQuestionKey) return item;
          const fallbackId = String(item.id || item.sourceId || item.targetCountryCode || item.countryCode || `row-${index + 1}`).trim();
          return {
            ...item,
            questionKey: `mode:${modeKey}:row:${index + 1}:${fallbackId}`,
          };
        });

        const roundUsedKeys = new Set();
        const roundUsedRowIds = new Set();
        const roundUsedCountryCodes = new Set();
        const questions = [];
        let historyUpdatedByReset = false;
        let fillFromFallbackCount = 0;

        const getRowId = (item) => {
          const stableId = normalizeCell(item?.id || item?.sourceId);
          if (stableId) return `id:${stableId}`;
          const fallbackKey = normalizeCell(item?.questionKey);
          if (fallbackKey) return `qk:${fallbackKey}`;
          const targetCode = normalizeCell(item?.targetCountryCode || item?.countryCode);
          const audioKey = normalizeCell(item?.audioUrl || item?.audio_url);
          return `fallback:${targetCode || "unknown"}:${audioKey || "unknown"}`;
        };

        const pickWithDiagnostics = (candidates, count, { avoidCountries = true, avoidQuestionKeys = true, avoidRowIds = true } = {}) => {
          const picked = [];
          const shuffled = shuffle(candidates);
          for (const item of shuffled) {
            if (picked.length >= count) break;
            const rowId = getRowId(item);
            if (avoidRowIds && roundUsedRowIds.has(rowId)) {
              trackBuildFailure(item, "duplicateRowId");
              continue;
            }
            if (avoidQuestionKeys && roundUsedKeys.has(item.questionKey)) {
              diagnostics.duplicateQuestionKeySkipped += 1;
              trackBuildFailure(item, "duplicateQuestionKey");
              continue;
            }
            const targetCode = item.targetCountryCode || item.countryCode;
            if (avoidCountries && targetCode && roundUsedCountryCodes.has(targetCode)) {
              diagnostics.duplicateCountrySkipped += 1;
              trackBuildFailure(item, "duplicateCountryCode");
              continue;
            }
            roundUsedKeys.add(item.questionKey);
            roundUsedRowIds.add(rowId);
            if (targetCode) roundUsedCountryCodes.add(targetCode);
            picked.push(item);
          }
          return picked;
        };

        for (const bucket of requirements) {
          const bucketPool = allRowsWithCountryCode.filter((item) => {
            const sameDifficulty = normalizeQuestionDifficulty(item.difficulty) === bucket.difficulty;
            if (!sameDifficulty) return false;
            if (typeof bucket.points === "number") return Number(item.points) === bucket.points;
            return true;
          });
          diagnostics.perBucketPool.push({
            difficulty: bucket.difficulty,
            points: typeof bucket.points === "number" ? bucket.points : "any",
            required: bucket.count,
            available: bucketPool.length,
          });
          if (bucketPool.length < bucket.count) {
            if (strictDistribution) {
              console.error("[MapGame] Question build diagnostics", diagnostics);
              throw new Error("Not enough valid rows in CSV to build 20 questions");
            }
          }

          const bucketHistory = state.usedQuestionHistory[bucket.difficulty];
          const unused = bucketPool.filter((item) => !bucketHistory.has(item.questionKey));
          let selected = pickWithDiagnostics(unused, bucket.count, { avoidCountries: true });

          if (selected.length < bucket.count) {
            bucketHistory.clear();
            historyUpdatedByReset = true;
            selected = pickWithDiagnostics(bucketPool, bucket.count, { avoidCountries: true });
          }

          if (selected.length < bucket.count) {
            const needed = bucket.count - selected.length;
            const fallback = pickWithDiagnostics(bucketPool, needed, { avoidCountries: false });
            if (fallback.length < needed && strictDistribution) {
              console.error("[MapGame] Question build diagnostics", diagnostics);
              throw new Error("Not enough unique rows in CSV to build 20 questions");
            }
            selected = selected.concat(fallback);
          }

          questions.push(...selected);
        }

        const buildPlayableQuestion = (item) => {
          if (!item || typeof item !== "object") {
            trackBuildFailure(item, "invalidRowObject");
            return null;
          }
          if (modeKey !== MAP_GAME_MODE_LANGUAGE) {
            return item;
          }
          const targetCountryCode = normalizeQuestionCountryCode(item.targetCountryCode || item.countryCode);
          const targetCountryNameAr = normalizeCell(item.targetCountryNameAr || item.countryNameAr);
          const audioUrl = normalizeAudioUrl(item.audioUrl || item.audio_url);
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          const difficulty = normalizeQuestionDifficulty(item.difficulty);
          const points = Number(item.points);
          const id = String(item.id || item.sourceId || item.questionKey || targetCountryCode || "").trim();

          if (!targetCountryCode) {
            trackBuildFailure(item, "missingTargetCountryCode");
            return null;
          }
          if (!targetCountryNameAr) {
            trackBuildFailure(item, "missingTargetCountryNameAr");
            return null;
          }
          if (!audioUrl) {
            trackBuildFailure(item, "missingAudioUrl");
            return null;
          }
          if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
            trackBuildFailure(item, "missingLatLng");
            return null;
          }
          if (!difficulty) {
            trackBuildFailure(item, "invalidDifficulty");
            return null;
          }
          if (!Number.isFinite(points)) {
            trackBuildFailure(item, "invalidPoints");
            return null;
          }

          return {
            ...item,
            mode: MAP_GAME_MODE_LANGUAGE,
            promptType: "audio",
            id: id || item.questionKey,
            targetCountryCode,
            targetCountryNameAr,
            audioUrl,
            lat,
            lng,
            points,
            difficulty,
          };
        };

        if (questions.length < 20) {
          const needed = 20 - questions.length;
          const globalUnused = allRowsWithCountryCode.filter(
            (item) => !roundUsedKeys.has(item.questionKey) && !state.usedQuestionHistory[normalizeQuestionDifficulty(item.difficulty)]?.has(item.questionKey)
          );
          const fillBestEffort = pickWithDiagnostics(globalUnused, needed, { avoidCountries: true });
          questions.push(...fillBestEffort);
        }
        if (questions.length < 20) {
          const needed = 20 - questions.length;
          const globalPool = allRowsWithCountryCode.filter((item) => !roundUsedKeys.has(item.questionKey));
          const fillAny = pickWithDiagnostics(globalPool, needed, { avoidCountries: false });
          questions.push(...fillAny);
        }
        if (modeKey === MAP_GAME_MODE_LANGUAGE && questions.length < 20) {
          const needed = 20 - questions.length;
          const unusedByRowId = allRowsWithCountryCode.filter((item) => !roundUsedRowIds.has(getRowId(item)));
          const fillLanguageFallback = pickWithDiagnostics(unusedByRowId, needed, {
            avoidCountries: false,
            avoidQuestionKeys: false,
            avoidRowIds: true,
          });
          fillFromFallbackCount += fillLanguageFallback.length;
          questions.push(...fillLanguageFallback);
        }
        if (modeKey === MAP_GAME_MODE_LANGUAGE && questions.length < 20) {
          const uniqueRowIdCount = new Set(allRowsWithCountryCode.map((item) => getRowId(item))).size;
          if (uniqueRowIdCount < 20) {
            const needed = 20 - questions.length;
            const fillAllowRowReuse = pickWithDiagnostics(allRowsWithCountryCode, needed, {
              avoidCountries: false,
              avoidQuestionKeys: false,
              avoidRowIds: false,
            });
            fillFromFallbackCount += fillAllowRowReuse.length;
            questions.push(...fillAllowRowReuse);
          }
        }
        const builtQuestions = questions
          .map((item) => buildPlayableQuestion(item))
          .filter(Boolean);

        console.info("[MapGame] Built questions count", {
          mode: modeKey,
          finalPoolLength: allRowsWithCountryCode.length,
          builtQuestionsLength: builtQuestions.length,
          firstFailedBuildRows: buildFailureSamples,
          failureReasonCounts: buildFailureReasonCounts,
          fillFromFallbackCount,
        });

        if (builtQuestions.length < 20) {
          const selectedKeys = new Set(builtQuestions.map((item) => item.questionKey).filter(Boolean));
          allRowsWithCountryCode.forEach((item) => {
            if (!selectedKeys.has(item.questionKey) && !buildFailureSamples.some((entry) => entry.rowId === String(item.id || item.sourceId || item.questionKey || item.targetCountryCode || "").trim())) {
              trackBuildFailure(item, "notSelectedByDistribution");
            }
          });
          console.error("[MapGame] Final build pool", {
            mode: modeKey,
            totalRows: diagnostics.totalRows,
            finalPoolLength: allRowsWithCountryCode.length,
            firstRejectedRows: rejectedRowSamples,
            rejectedReasonCounts: diagnostics.rejectedReasons,
          });
          console.error("[MapGame] Question build diagnostics", diagnostics);
          throw new Error("Not enough valid rows in CSV to build 20 questions");
        }

        if (historyUpdatedByReset) {
          saveUsedQuestionHistory();
        }
        console.info("[MapGame] Question build diagnostics", diagnostics);
        return builtQuestions;
      }

      function markQuestionAsUsed(question) {
        if (!question) return;
        const bucket = question.difficulty;
        if (!["easy", "medium", "hard"].includes(bucket)) return;
        const key = question.questionKey;
        if (!key) return;
        const bucketSet = state.usedQuestionHistory[bucket];
        if (bucketSet.has(key)) return;
        bucketSet.add(key);
        saveUsedQuestionHistory();
      }

      function markCurrentQuestionAsUsed() {
        markQuestionAsUsed(getQuestion());
      }

      function getQuestion() {
        return state.questions[state.questionIndex];
      }

      function isLanguageMode() {
        return state.selectedMode === MAP_GAME_MODE_LANGUAGE;
      }

      function isImageMode() {
        return state.selectedMode === MAP_GAME_MODE_IMAGE;
      }

      function stopCurrentAudio() {
        if (!state.audioPlayer) return;
        try {
          state.audioPlayer.pause();
          state.audioPlayer.currentTime = 0;
        } catch (_) {}
      }

      function setAudioStatus(text = "") {
        const normalized = normalizeCell(text);
        if (!normalized) {
          el.audioStatusText.textContent = "";
          el.audioStatusText.classList.add("hidden");
          return;
        }
        el.audioStatusText.textContent = normalized;
        el.audioStatusText.classList.remove("hidden");
      }

      function updateAudioUi() {
        if (!isLanguageMode()) {
          stopCurrentAudio();
          el.audioControls.classList.remove("active");
          setAudioStatus("");
          return;
        }
        const q = getQuestion();
        el.audioControls.classList.add("active");
        const hasError = q && state.audioErrorByQuestionId.has(String(q.id || q.audioUrl || ""));
        setAudioStatus(hasError ? "تعذر تحميل الصوت. اضغط لإعادة المحاولة." : "");
      }

      function resetImageUi() {
        state.currentImageRequestId += 1;
        if (state.imageLoadTimeoutId) {
          clearTimeout(state.imageLoadTimeoutId);
          state.imageLoadTimeoutId = null;
        }
        if (state.imagePreloader) {
          state.imagePreloader.onload = null;
          state.imagePreloader.onerror = null;
          state.imagePreloader = null;
        }
        el.imagePromptWrap.classList.add("hidden");
        el.imageLoading.classList.add("hidden");
        el.imageError.classList.add("hidden");
        el.imageError.textContent = IMAGE_LOAD_ERROR_AR;
        el.questionImage.classList.add("hidden");
        el.questionImage.onload = null;
        el.questionImage.onerror = null;
        delete el.questionImage.dataset.currentSrc;
        el.questionImage.removeAttribute("src");
      }

      function updateImageUi() {
        if (!isImageMode()) {
          resetImageUi();
          return;
        }
        state.currentImageRequestId += 1;
        const requestId = state.currentImageRequestId;
        if (state.imageLoadTimeoutId) {
          clearTimeout(state.imageLoadTimeoutId);
          state.imageLoadTimeoutId = null;
        }
        if (state.imagePreloader) {
          state.imagePreloader.onload = null;
          state.imagePreloader.onerror = null;
          state.imagePreloader = null;
        }
        const q = getQuestion();
        el.imagePromptWrap.classList.remove("hidden");
        el.imageQuestionText.textContent = "ما هي الدولة التي تظهر في الصورة؟";

        const finalSrc = normalizeImageUrl(q?.imageUrl);
        if (!finalSrc) {
          el.imageLoading.classList.add("hidden");
          el.questionImage.classList.add("hidden");
          el.imageError.textContent = IMAGE_LOAD_ERROR_AR;
          el.imageError.classList.remove("hidden");
          return;
        }

        const questionKey = String(q?.id || q?.sourceId || finalSrc);
        const knownState = state.imageLoadStateByQuestionId.get(questionKey);
        if (knownState === "loaded" && el.questionImage.dataset.currentSrc === finalSrc) {
          el.imageLoading.classList.add("hidden");
          el.imageError.classList.add("hidden");
          el.questionImage.classList.remove("hidden");
          return;
        }
        if (knownState === "error" && el.questionImage.dataset.currentSrc === finalSrc) {
          el.imageLoading.classList.add("hidden");
          el.questionImage.classList.add("hidden");
          el.imageError.classList.remove("hidden");
          return;
        }

        el.imageLoading.classList.remove("hidden");
        el.imageError.classList.add("hidden");
        el.questionImage.classList.add("hidden");
        el.questionImage.onload = null;
        el.questionImage.onerror = null;
        delete el.questionImage.dataset.currentSrc;

        const preload = new Image();
        state.imagePreloader = preload;
        preload.onload = () => {
          if (state.currentImageRequestId !== requestId) return;
          if (state.imageLoadTimeoutId) {
            clearTimeout(state.imageLoadTimeoutId);
            state.imageLoadTimeoutId = null;
          }
          state.imageLoadStateByQuestionId.set(questionKey, "loaded");
          el.questionImage.dataset.currentSrc = finalSrc;
          if (el.questionImage.src !== finalSrc) {
            el.questionImage.src = finalSrc;
          }
          el.imageLoading.classList.add("hidden");
          el.imageError.classList.add("hidden");
          el.questionImage.classList.remove("hidden");
          state.imagePreloader = null;
        };
        preload.onerror = () => {
          if (state.currentImageRequestId !== requestId) return;
          if (state.imageLoadTimeoutId) {
            clearTimeout(state.imageLoadTimeoutId);
            state.imageLoadTimeoutId = null;
          }
          state.imageLoadStateByQuestionId.set(questionKey, "error");
          el.imageLoading.classList.add("hidden");
          el.questionImage.classList.add("hidden");
          el.imageError.textContent = IMAGE_LOAD_ERROR_AR;
          el.imageError.classList.remove("hidden");
          console.warn("Map image failed to preload:", finalSrc);
          state.imagePreloader = null;
        };
        state.imageLoadTimeoutId = setTimeout(() => {
          if (state.currentImageRequestId !== requestId) return;
          state.imageLoadStateByQuestionId.set(questionKey, "error");
          if (state.imagePreloader) {
            state.imagePreloader.onload = null;
            state.imagePreloader.onerror = null;
            state.imagePreloader = null;
          }
          state.imageLoadTimeoutId = null;
          el.imageLoading.classList.add("hidden");
          el.questionImage.classList.add("hidden");
          el.imageError.textContent = IMAGE_LOAD_ERROR_AR;
          el.imageError.classList.remove("hidden");
          console.warn("Map image preload timed out:", finalSrc);
        }, 15000);
        preload.src = finalSrc;
      }

      function ensureAudioPlayer() {
        if (!state.audioPlayer) {
          state.audioPlayer = new Audio();
          state.audioPlayer.preload = "none";
          state.audioPlayer.addEventListener("ended", () => {
            if (!isLanguageMode()) return;
            el.playAudioBtn.textContent = "↻ إعادة تشغيل الصوت";
          });
          state.audioPlayer.addEventListener("error", () => {
            const q = getQuestion();
            if (!q) return;
            const key = String(q.id || q.audioUrl || "");
            if (key) state.audioErrorByQuestionId.set(key, true);
            setAudioStatus("تعذر تحميل الصوت. اضغط لإعادة المحاولة.");
          });
        }
        return state.audioPlayer;
      }

      async function playCurrentAudio() {
        const q = getQuestion();
        if (!q || !isLanguageMode()) return;
        const audioUrl = normalizeAudioUrl(q.audioUrl);
        if (!audioUrl) {
          setAudioStatus("ملف الصوت غير متوفر لهذا السؤال.");
          return;
        }
        const player = ensureAudioPlayer();
        stopCurrentAudio();
        const key = String(q.id || q.audioUrl || "");
        state.audioErrorByQuestionId.delete(key);
        setAudioStatus("");
        try {
          if (player.src !== audioUrl) {
            player.src = audioUrl;
          }
          player.currentTime = 0;
          await player.play();
          el.playAudioBtn.textContent = "↻ إعادة تشغيل الصوت";
        } catch (error) {
          state.audioErrorByQuestionId.set(key, true);
          setAudioStatus("تعذر تشغيل الصوت. حاول مرة أخرى.");
          console.error(error);
        }
      }

      function showModeLoadMessage(message) {
        const text = normalizeCell(message);
        if (!text) {
          el.modeStatus.classList.add("hidden");
          el.modeStatusText.textContent = "";
          return;
        }
        el.modeStatusText.textContent = text;
        el.modeStatus.classList.remove("hidden");
      }

      function showSetupError(message) {
        const text = normalizeCell(message);
        if (!el.setupErrorText) return;
        if (!text) {
          el.setupErrorText.textContent = "";
          el.setupErrorText.classList.add("hidden");
          return;
        }
        el.setupErrorText.textContent = text;
        el.setupErrorText.classList.remove("hidden");
      }

      function applyModeUiState() {
        if (isLanguageMode()) {
          el.targetTitle.textContent = "تعليمات السؤال";
          el.targetCountry.textContent = "—";
          el.targetHintText.textContent = LANGUAGE_MODE_INSTRUCTION;
          el.targetHintText.classList.add("mode-instruction");
        } else if (isImageMode()) {
          el.targetTitle.textContent = "تعليمات السؤال";
          el.targetCountry.textContent = "—";
          el.targetHintText.textContent = IMAGE_MODE_INSTRUCTION;
          el.targetHintText.classList.add("mode-instruction");
        } else {
          el.targetTitle.textContent = "الدولة المطلوبة";
          el.targetHintText.textContent = "اختر هذه الدولة على الخريطة";
          el.targetHintText.classList.remove("mode-instruction");
        }
        updateImageUi();
      }

      function setSelectedMode(mode, { syncInput = true } = {}) {
        const nextMode = [MAP_GAME_MODE_MAP, MAP_GAME_MODE_IMAGE, MAP_GAME_MODE_LANGUAGE].includes(mode) ? mode : MAP_GAME_MODE_MAP;
        state.selectedMode = nextMode;
        if (syncInput) {
          el.modeMap.checked = nextMode === MAP_GAME_MODE_MAP;
          el.modeImage.checked = nextMode === MAP_GAME_MODE_IMAGE;
          el.modeLanguage.checked = nextMode === MAP_GAME_MODE_LANGUAGE;
        }
        applyModeUiState();
      }

      function handleModeSelection(mode) {
        if (mode === MAP_GAME_MODE_MAP) {
          setSelectedMode(MAP_GAME_MODE_MAP, { syncInput: false });
          showModeLoadMessage("");
          el.startBtn.disabled = !state.mapReady || !state.questionsReadyByMode[state.selectedMode];
          return;
        }
        if (mode === MAP_GAME_MODE_IMAGE) {
          setSelectedMode(MAP_GAME_MODE_IMAGE, { syncInput: false });
          ensureQuestionsForMode(MAP_GAME_MODE_IMAGE);
          return;
        }
        if (mode === MAP_GAME_MODE_LANGUAGE) {
          setSelectedMode(MAP_GAME_MODE_LANGUAGE, { syncInput: false });
          ensureQuestionsForMode(MAP_GAME_MODE_LANGUAGE);
        }
      }

      function currentPoints() {
        return getQuestion().points;
      }

      function activeTeamIndex() {
        return state.questionIndex % 2 === 0 ? 0 : 1;
      }

      function otherTeamIndex() {
        return activeTeamIndex() === 0 ? 1 : 0;
      }

      function selectionTeamIndex() {
        if (state.phase === "active_pick") return activeTeamIndex();
        if (state.phase === "other_response") return otherTeamIndex();
        return null;
      }

      function refreshModeDerivedIndexes(modeQuestions) {
        state.questionByCountryCode = new Map(modeQuestions.map((item) => [item.targetCountryCode, item]));
        state.countryCodeByNormalizedName = new Map(modeQuestions.map((item) => [normalizeName(item.targetCountryNameEn), item.targetCountryCode]));
        const questionCentroids = modeQuestions
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
          .map((item) => [item.targetCountryCode, [item.lng, item.lat]]);
        state.centroids = new Map(questionCentroids);
        state.mapCentroids.forEach((coords, countryCode) => {
          if (!state.centroids.has(countryCode)) state.centroids.set(countryCode, coords);
        });
      }

      function evaluateCountrySelection(countryCode, diagnostics = null) {
        const question = getQuestion() || {};
        const selectedMode = state.selectedMode;
        const currentQuestionMode = normalizeCell(question.mode).toLowerCase();
        const currentQuestionPromptType = normalizeCell(question.promptType).toLowerCase();
        const imageModeActive =
          selectedMode === MAP_GAME_MODE_IMAGE ||
          currentQuestionMode === MAP_GAME_MODE_IMAGE ||
          currentQuestionPromptType === MAP_GAME_MODE_IMAGE;

        const candidateCodes = [
          countryCode,
          diagnostics?.featureCodes?.countryCode,
          diagnostics?.featureCodes?.country_code,
          diagnostics?.featureCodes?.iso_a2,
          diagnostics?.featureCodes?.iso_a3,
          diagnostics?.featureCodes?.iso2,
          diagnostics?.featureCodes?.id,
        ]
          .map((value) => normalizeSelectionCountryCode(value))
          .filter(Boolean);
        const normalizedCountryCode = candidateCodes.find((code) => state.mapFeaturesByCode.has(code))
          || candidateCodes.find((code) => state.mapCentroids.has(code))
          || candidateCodes[0]
          || "";

        const hasMapFeature = Boolean(normalizedCountryCode && state.mapFeaturesByCode.has(normalizedCountryCode));
        const hasMapCentroid = Boolean(normalizedCountryCode && state.mapCentroids.has(normalizedCountryCode));
        const inQuestionPool = Boolean(normalizedCountryCode && state.questionByCountryCode.has(normalizedCountryCode));
        const hasValidClickedFeature = Boolean(diagnostics?.hasClickedFeature);
        const selectable = imageModeActive
          ? Boolean(normalizedCountryCode && (hasMapFeature || hasMapCentroid || hasValidClickedFeature))
          : inQuestionPool;

        return {
          selectedMode,
          currentQuestionMode,
          currentQuestionPromptType,
          featureName: diagnostics?.featureName || "",
          resolvedCountryCode: normalizeCountryCode(countryCode),
          normalizedCountryCode,
          hasMapFeature,
          hasMapCentroid,
          inQuestionPool,
          selectable,
        };
      }

      function showOverlay(title, text, actions) {
        el.overlayTitle.parentElement.classList.remove("result-popup");
        el.overlay.classList.remove("result-overlay");
        el.overlayTitle.textContent = title;
        el.overlayText.innerHTML = "";
        el.overlayText.textContent = text;
        el.overlayActions.innerHTML = "";
        actions.forEach((action) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `btn ${action.kind || "btn-light"}`;
          button.textContent = action.label;
          button.addEventListener("click", action.onClick, { once: true });
          el.overlayActions.appendChild(button);
        });
        el.overlay.classList.add("active");
      }

      function showQuestionResultOverlay(payload) {
        const popup = el.overlayTitle.parentElement;
        popup.classList.add("result-popup");
        el.overlay.classList.add("result-overlay");
        el.overlayTitle.textContent = "نتيجة السؤال";
        el.overlayText.innerHTML = "";

        const summary = document.createElement("div");
        summary.className = "result-summary";

        const mainLine = document.createElement("p");
        mainLine.className = "result-main-line";
        const statusIcon = payload.status === "correct" ? "✅" : payload.status === "incorrect" ? "✖" : "⚖";
        const statusLabel = payload.status === "correct" ? "صحيحة" : payload.status === "incorrect" ? "خاطئة" : "تعادل";
        mainLine.innerHTML = `إجابة <span class="team-highlight">${payload.teamName}</span> <span class="status-chip ${payload.status}">${statusIcon} ${statusLabel}</span>`;
        summary.appendChild(mainLine);

        const points = document.createElement("p");
        points.className = "result-points";
        points.innerHTML = `<span class="points-value">${payload.pointsLabel}</span><span class="points-note">${payload.pointsNote}</span>`;
        summary.appendChild(points);

        if (payload.secondaryText) {
          const secondary = document.createElement("p");
          secondary.className = "result-secondary";
          secondary.textContent = payload.secondaryText;
          summary.appendChild(secondary);
        }

        const country = document.createElement("p");
        country.className = "result-correct-country";
        country.innerHTML = `الإجابة الصحيحة: <strong>${payload.correctCountry}</strong>`;
        summary.appendChild(country);
        el.overlayText.appendChild(summary);

        el.overlayActions.innerHTML = "";
        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.className = "btn btn-primary";
        nextBtn.textContent = "السؤال التالي";
        nextBtn.addEventListener("click", goNextQuestion, { once: true });
        el.overlayActions.appendChild(nextBtn);
        el.overlay.classList.add("active");
      }

      function isMobileViewport() {
        return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
      }

      function clearPendingResultReveal() {
        if (state.resultRevealTimeoutId !== null) {
          window.clearTimeout(state.resultRevealTimeoutId);
          state.resultRevealTimeoutId = null;
        }
        state.isRevealingAnswer = false;
      }

      function openResultOverlay(payload) {
        clearPendingResultReveal();
        showQuestionResultOverlay(payload);
      }

      function hideOverlay() {
        el.overlay.classList.remove("active");
        el.overlay.classList.remove("result-overlay");
      }

      function updateHeader() {
        const q = getQuestion();
        const activeIdx = activeTeamIndex();
        const otherIdx = otherTeamIndex();
        el.team1Label.textContent = state.teamNames[0];
        el.team2Label.textContent = state.teamNames[1];
        el.team1Score.textContent = String(state.scores[0]);
        el.team2Score.textContent = String(state.scores[1]);
        el.questionNumberMeta.textContent = `${state.questionIndex + 1} من 20`;
        el.questionDifficultyMeta.textContent = DIFFICULTY_AR[q.difficulty];
        el.questionPointsMeta.textContent = `${q.points}`;
        el.targetCountry.textContent = (isLanguageMode() || isImageMode()) ? "—" : (q.targetCountryNameAr || q.countryNameAr);
        applyModeUiState();
        updateAudioUi();
        const currentTurnIdx = state.phase === "other_response" ? otherIdx : activeIdx;
        const shouldShowTurnHighlight = ["active_pick", "other_response"].includes(state.phase);
        el.team1Card.classList.toggle("active", shouldShowTurnHighlight && currentTurnIdx === 0);
        el.team2Card.classList.toggle("active", shouldShowTurnHighlight && currentTurnIdx === 1);

        if (state.phase === "active_pick") {
          el.turnValue.textContent = state.teamNames[activeIdx];
          el.turnInstruction.textContent = "اختر دولة على الخريطة";
          el.acceptActiveAnswerBtn.classList.remove("show");
        } else if (state.phase === "other_response") {
          el.turnValue.textContent = state.teamNames[otherIdx];
          el.turnInstruction.textContent = "اختر دولة أخرى أو أكّد الإجابة";
          el.acceptActiveAnswerBtn.textContent = `إجابة فريق ${state.teamNames[activeIdx]} صحيحة`;
          el.acceptActiveAnswerBtn.classList.add("show");
        } else if (state.phase === "ready_reveal") {
          el.turnValue.textContent = "جاهز لإظهار الإجابة";
          el.turnInstruction.textContent = "تم تأكيد الاختيارات. اضغط إظهار الإجابة.";
          el.acceptActiveAnswerBtn.classList.remove("show");
        } else {
          el.turnValue.textContent = "—";
          el.turnInstruction.textContent = "—";
          el.acceptActiveAnswerBtn.classList.remove("show");
        }
      }

      function updateMapHighlights() {
        if (!state.mapReady) return;
        const countryNodes = el.mapStage.querySelectorAll(".country");
        const target = getQuestion();
        countryNodes.forEach((node) => {
          const code = node.dataset.countryCode;
          node.classList.remove("team1", "team2", "correct");
          if (state.teamPicks[0]?.countryCode === code) node.classList.add("team1");
          if (state.teamPicks[1]?.countryCode === code) node.classList.add("team2");
          if (state.pendingPick === code) {
            if (state.pendingTeamIndex === 0) node.classList.add("team1");
            if (state.pendingTeamIndex === 1) node.classList.add("team2");
          }
          if (state.phase === "revealed" && (target.targetCountryCode || target.countryCode) === code) node.classList.add("correct");
        });
      }

      function logMapCoverageDiagnostics(features) {
        const featureCodes = new Set(features.map((feature) => feature.properties.countryCode).filter(Boolean));
        const mappedNameToCode = new Set(
          features.map((feature) => `${feature.properties.normalizedName}:${feature.properties.countryCode}`).filter((value) => !value.endsWith(":"))
        );

        const missingByCode = [];
        const unmatchedByName = [];

        state.questionPool.forEach((question) => {
          const normalizedName = normalizeName(question.targetCountryNameEn || question.countryNameEn);
          const targetCode = question.targetCountryCode || question.countryCode;
          const mappedByCode = featureCodes.has(targetCode);
          const mappedByName = mappedNameToCode.has(`${normalizedName}:${targetCode}`);
          if (!mappedByCode) {
            missingByCode.push({
              countryCode: targetCode,
              countryNameEn: question.targetCountryNameEn || question.countryNameEn,
              countryNameAr: question.targetCountryNameAr || question.countryNameAr,
            });
            return;
          }
          if (!mappedByName) {
            unmatchedByName.push({
              countryCode: targetCode,
              countryNameEn: question.targetCountryNameEn || question.countryNameEn,
              countryNameAr: question.targetCountryNameAr || question.countryNameAr,
            });
          }
        });

        state.mapDiagnostics.missingByCode = missingByCode;
        state.mapDiagnostics.unmatchedByName = unmatchedByName;

        if (missingByCode.length || unmatchedByName.length) {
          console.groupCollapsed("[MapGame] Coverage diagnostics");
          if (missingByCode.length) console.table(missingByCode);
          if (unmatchedByName.length) console.table(unmatchedByName);
          console.groupEnd();
        }
      }

      function haversineKm(a, b) {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(b[1] - a[1]);
        const dLon = toRad(b[0] - a[0]);
        const lat1 = toRad(a[1]);
        const lat2 = toRad(b[1]);
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
        return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
      }

      function revealAnswer() {
        const q = getQuestion();
        const points = q.points;
        const half = Math.floor(points / 2);
        const activeIdx = activeTeamIndex();
        const otherIdx = otherTeamIndex();
        const targetCode = q.targetCountryCode || q.countryCode;
        const targetCountryAr = q.targetCountryNameAr || q.countryNameAr;
        const pickedCorrect = [state.teamPicks[0]?.countryCode === targetCode, state.teamPicks[1]?.countryCode === targetCode];

        const resultState = {
          status: "tie",
          teamName: "الفريقان",
          pointsLabel: "+0",
          pointsNote: "لا نقاط لهذا السؤال",
          secondaryText: "",
          correctCountry: targetCountryAr,
        };

        if (state.otherTeamAcceptedActiveAnswer) {
          if (pickedCorrect[activeIdx]) {
            state.scores[activeIdx] += points;
            resultState.status = "correct";
            resultState.teamName = state.teamNames[activeIdx];
            resultState.pointsLabel = `+${points}`;
            resultState.pointsNote = "نقاط مكتسبة";
            resultState.secondaryText = "تم تأكيد الإجابة من الفريق الآخر.";
          } else {
            resultState.status = "incorrect";
            resultState.teamName = state.teamNames[activeIdx];
            resultState.pointsLabel = "+0";
            resultState.pointsNote = "لا نقاط لهذا السؤال";
          }
        } else if (pickedCorrect[activeIdx]) {
          state.scores[activeIdx] += points;
          resultState.status = "correct";
          resultState.teamName = state.teamNames[activeIdx];
          resultState.pointsLabel = `+${points}`;
          resultState.pointsNote = "نقاط مكتسبة";
        } else if (pickedCorrect[otherIdx]) {
          state.scores[otherIdx] += points;
          resultState.status = "correct";
          resultState.teamName = state.teamNames[otherIdx];
          resultState.pointsLabel = `+${points}`;
          resultState.pointsNote = "نقاط مكتسبة";
        } else {
          const target = state.centroids.get(targetCode);
          const c1 = state.centroids.get(state.teamPicks[0]?.countryCode);
          const c2 = state.centroids.get(state.teamPicks[1]?.countryCode);
          if (target && c1 && c2) {
            const d1 = haversineKm(c1, target);
            const d2 = haversineKm(c2, target);
            const tieTolerance = 0.05;
            if (Math.abs(d1 - d2) <= tieTolerance) {
              resultState.status = "tie";
              resultState.teamName = "الفريقان";
              resultState.pointsLabel = "+0";
              resultState.pointsNote = "تعادل في القرب";
            } else if (d1 < d2) {
              state.scores[0] += half;
              resultState.status = "correct";
              resultState.teamName = state.teamNames[0];
              resultState.pointsLabel = `+${half}`;
              resultState.pointsNote = "نقاط قرب";
              resultState.secondaryText = "الأقرب يحصل على نصف النقاط.";
            } else {
              state.scores[1] += half;
              resultState.status = "correct";
              resultState.teamName = state.teamNames[1];
              resultState.pointsLabel = `+${half}`;
              resultState.pointsNote = "نقاط قرب";
              resultState.secondaryText = "الأقرب يحصل على نصف النقاط.";
            }
          } else {
            resultState.status = "tie";
            resultState.teamName = "الفريقان";
            resultState.pointsLabel = "+0";
            resultState.pointsNote = "تعادل في القرب";
          }
        }

        state.phase = "revealed";
        updateHeader();
        updateMapHighlights();
        if (isImageMode() && normalizeCell(q.placeNameAr)) {
          resultState.secondaryText = resultState.secondaryText
            ? `${resultState.secondaryText} — المكان: ${q.placeNameAr}`
            : `المكان: ${q.placeNameAr}`;
        }

        if (!isMobileViewport()) {
          showQuestionResultOverlay(resultState);
          persistGameState();
          return;
        }

        clearPendingResultReveal();
        state.isRevealingAnswer = true;
        state.resultRevealTimeoutId = window.setTimeout(() => {
          openResultOverlay(resultState);
          persistGameState();
        }, MOBILE_RESULT_REVEAL_DELAY_MS);
      }

      function goNextQuestion() {
        clearPendingResultReveal();
        hideOverlay();
        stopCurrentAudio();
        markCurrentQuestionAsUsed();

        if (state.questionIndex >= 19) {
          state.phase = "finished";
          finishGame();
          return;
        }

        state.questionIndex += 1;
        state.phase = "active_pick";
        state.teamPicks = [null, null];
        state.otherTeamAcceptedActiveAnswer = false;
        state.pendingPick = null;
        state.pendingTeamIndex = null;
        updateHeader();
        updateMapHighlights();
        persistGameState();
      }

      function finishGame() {
        stopCurrentAudio();
        clearSavedGameState();
        clearPendingResultReveal();
        const [s1, s2] = state.scores;
        let finalLine = "تعادل رائع بين الفريقين";
        if (s1 > s2) finalLine = `الفائز: ${state.teamNames[0]}`;
        if (s2 > s1) finalLine = `الفائز: ${state.teamNames[1]}`;

        showOverlay(
          "انتهت الجولة",
          `${finalLine}\n${state.teamNames[0]}: ${s1} نقطة — ${state.teamNames[1]}: ${s2} نقطة`,
          [
            {
              label: "إعادة اللعب",
              kind: "btn-primary",
              onClick: () => {
                hideOverlay();
                stopCurrentAudio();
                state.started = false;
                clearSavedGameState();
                el.gameScreen.classList.remove("active");
                el.setupScreen.style.display = "block";
              },
            },
            { label: "العودة للألعاب", kind: "btn-light", onClick: () => (window.location.href = "/games/") },
          ]
        );
      }

      function confirmPendingPick() {
        const q = getQuestion();
        const teamIdx = state.pendingTeamIndex;
        if (teamIdx === null) return;

        state.teamPicks[teamIdx] = {
          countryCode: state.pendingPick,
          isCorrect: state.pendingPick === (q.targetCountryCode || q.countryCode),
        };

        state.pendingPick = null;
        state.pendingTeamIndex = null;
        hideOverlay();
        updateMapHighlights();

        if (state.phase === "active_pick") {
          state.phase = "other_response";
          updateHeader();
          persistGameState();
          return;
        }

        state.phase = "ready_reveal";
        updateHeader();
        showOverlay("جاهز لإظهار الإجابة", "تم تأكيد اختيار الفريقين.", [
          { label: "إظهار الإجابة", kind: "btn-accent", onClick: () => { hideOverlay(); revealAnswer(); } },
        ]);
        persistGameState();
      }

      function cancelPendingPick() {
        state.pendingPick = null;
        state.pendingTeamIndex = null;
        hideOverlay();
        updateMapHighlights();
      }

      function handleCountrySelection(countryCode, diagnostics = null) {
        if (el.overlay.classList.contains("active")) return;
        if (state.isRevealingAnswer) return;
        if (!["active_pick", "other_response"].includes(state.phase)) return;
        const activeIdx = activeTeamIndex();
        const teamIdx = selectionTeamIndex();
        if (teamIdx === null) return;
        const selectionValidation = evaluateCountrySelection(countryCode, diagnostics);
        if (diagnostics) {
          console.info("[MapGame] Selection diagnostics", { ...diagnostics, ...selectionValidation });
        }
        if (!selectionValidation.selectable) {
          console.info("[MapGame] Country rejected", selectionValidation);
          showOverlay("تنبيه", UNSUPPORTED_COUNTRY_MESSAGE, [{ label: "حسنًا", kind: "btn-light", onClick: hideOverlay }]);
          return;
        }
        countryCode = selectionValidation.normalizedCountryCode;

        if (state.phase === "other_response" && state.teamPicks[activeIdx]?.countryCode === countryCode) {
          showOverlay("تنبيه", "لا يمكن اختيار نفس دولة الفريق الآخر", [{ label: "حسنًا", kind: "btn-light", onClick: hideOverlay }]);
          return;
        }

        state.pendingPick = countryCode;
        state.pendingTeamIndex = teamIdx;
        updateMapHighlights();
        const teamName = state.teamNames[teamIdx];

        window.setTimeout(() => {
          if (state.pendingPick !== countryCode || state.pendingTeamIndex !== teamIdx) return;
          if (!["active_pick", "other_response"].includes(state.phase)) return;

          showOverlay(`تأكيد اختيار ${teamName}`, "هل تريد تأكيد هذه الدولة؟", [
            { label: "تأكيد", kind: "btn-primary", onClick: confirmPendingPick },
            { label: "تغيير الاختيار", kind: "btn-light", onClick: cancelPendingPick },
          ]);
        }, SELECTION_CONFIRM_DELAY_MS);
      }

      function acceptActiveAnswer() {
        if (state.phase !== "other_response") return;
        state.teamPicks[otherTeamIndex()] = null;
        state.otherTeamAcceptedActiveAnswer = true;
        state.pendingPick = null;
        state.pendingTeamIndex = null;
        state.phase = "ready_reveal";
        updateHeader();
        updateMapHighlights();
        showOverlay("جاهز لإظهار الإجابة", "تم اعتماد إجابة الفريق النشط من الفريق الآخر.", [
          { label: "إظهار الإجابة", kind: "btn-accent", onClick: () => { hideOverlay(); revealAnswer(); } },
        ]);
        persistGameState();
      }

      async function loadMap() {
        if (state.mapReady) return true;
        if (state.mapLoadPromise) return state.mapLoadPromise;
        state.mapLoadPromise = (async () => {
          try {
          const [d3] = await Promise.all([import("https://cdn.jsdelivr.net/npm/d3@7/+esm")]);
          const response = await fetch(WORLD_MAP_URL, { cache: "force-cache" });
          if (!response.ok) throw new Error("Map download failed");
          const geojson = await response.json();

          const width = 1280;
          const height = 760;

          const svg = d3
            .create("svg")
            .attr("class", "map-svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "img")
            .attr("aria-label", "خريطة العالم التفاعلية");

          const projection = d3.geoNaturalEarth1().fitExtent(
            [
              [20, 20],
              [width - 20, height - 20],
            ],
            geojson
          );

          const path = d3.geoPath(projection);
          const mapLayer = svg.append("g");
          const countriesLayer = mapLayer.append("g").attr("class", "countries-layer");

          const clearActivePointer = () => {
            state.activePointer = null;
          };

          const startPointer = (event) => {
            if (!event.isPrimary) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const currentTransform = d3.zoomTransform(svg.node());
            state.activePointer = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              k: currentTransform.k,
              tx: currentTransform.x,
              ty: currentTransform.y,
              moved: false,
            };
          };

          const FEATURE_NAME_CODE_OVERRIDES = new Map([
            ["france", "FR"],
            ["norway", "NO"],
            ["kosovo", "XK"],
          ]);
          const FEATURE_ALPHA3_TO_ALPHA2_OVERRIDES = new Map([
            ["TWN", "TW"],
          ]);

          const resolveCountryCodeFromFeature = (feature) => {
            const properties = feature.properties || {};
            const normalizedName = normalizeName(properties.name || "");
            const rawCandidateCodes = [
              properties.country_code,
              properties.countryCode,
              properties.iso_a2,
              properties.ISO_A2,
              properties.iso2,
              properties.ISO3166_1_Alpha_2,
              properties["ISO3166-1-Alpha-2"],
              properties.ISO_A3,
              properties.iso_a3,
              properties["ISO3166-1-Alpha-3"],
              properties.id,
            ].filter(Boolean);

            const candidateCodes = rawCandidateCodes
              .flatMap((value) => {
                const raw = String(value).trim().toUpperCase();
                if (!raw || raw === "-99") return [];
                const variants = [raw];
                if (FEATURE_ALPHA3_TO_ALPHA2_OVERRIDES.has(raw)) {
                  variants.push(FEATURE_ALPHA3_TO_ALPHA2_OVERRIDES.get(raw));
                }
                const splitTokens = raw.split(/[^A-Z0-9]+/).filter(Boolean);
                splitTokens.forEach((token) => {
                  variants.push(token);
                  if (FEATURE_ALPHA3_TO_ALPHA2_OVERRIDES.has(token)) {
                    variants.push(FEATURE_ALPHA3_TO_ALPHA2_OVERRIDES.get(token));
                  }
                });
                return variants;
              })
              .map((value) => normalizeCountryCode(value))
              .filter(Boolean);

            const directCode = candidateCodes.find((code) => /^[A-Z]{2}$/.test(code));
            if (directCode) return directCode;

            if (rawCandidateCodes.some((value) => String(value).trim().toUpperCase() === "-99")) {
              const overrideCode = FEATURE_NAME_CODE_OVERRIDES.get(normalizedName);
              if (overrideCode) {
                return overrideCode;
              }
            }

            return (
              state.countryCodeByNormalizedNameAllModes.get(normalizedName) ||
              state.countryCodeByNormalizedName.get(normalizedName) ||
              ""
            );
          };

          const logUnmappedCountry = (feature) => {
            const props = feature.properties || {};
            const name = props.name || "(unknown)";
            if (state.unsupportedCountriesLogged.has(name)) return;
            state.unsupportedCountriesLogged.add(name);
            console.warn("[MapGame] Unmapped country feature", {
              name,
              properties: props,
            });
          };

          const trySelectCountryFromEvent = (event) => {
            const targetPath = event.target?.closest?.(".country");
            const hitPath =
              targetPath ||
              document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".country");
            if (!hitPath) return;
            const feature = hitPath.__data__ || null;
            const code = hitPath.dataset.countryCode || "";
            if (!code && feature) {
              logUnmappedCountry(feature);
            }
            const properties = feature?.properties || {};
            const diagnostics = {
              mode: state.selectedMode,
              featureName: properties.name || "",
              hasClickedFeature: Boolean(feature),
              featureCodes: {
                country_code: properties.country_code || "",
                countryCode: properties.countryCode || "",
                iso_a2: properties.iso_a2 || properties.ISO_A2 || "",
                iso_a3: properties.iso_a3 || properties.ISO_A3 || "",
                iso2: properties.iso2 || "",
                id: properties.id || "",
              },
              resolvedCountryCode: code,
              existsInMapFeaturesByCode: Boolean(code && state.mapFeaturesByCode.has(code)),
              existsInCurrentQuestionPool: Boolean(code && state.questionByCountryCode.has(code)),
            };
            handleCountrySelection(code, diagnostics);
          };

          const isTapPointer = (event) => {
            if (!state.activePointer || state.activePointer.pointerId !== event.pointerId) return false;
            const moved = Math.hypot(event.clientX - state.activePointer.x, event.clientY - state.activePointer.y);
            const currentTransform = d3.zoomTransform(svg.node());
            const transformMoved = Math.hypot(currentTransform.x - state.activePointer.tx, currentTransform.y - state.activePointer.ty);
            const scaled = Math.abs(currentTransform.k - state.activePointer.k) > 0.0001;
            return moved <= state.pointerTapThreshold && transformMoved <= state.pointerTapThreshold && !scaled;
          };

          const mapFeaturesByCode = new Map();
          const mapCentroids = new Map();
          geojson.features.forEach((feature) => {
            const normalized = normalizeName(feature.properties.name);
            feature.properties.normalizedName = normalized;
            feature.properties.countryCode = resolveCountryCodeFromFeature(feature);
            if (!feature.properties.countryCode) {
              logUnmappedCountry(feature);
              return;
            }
            if (!mapFeaturesByCode.has(feature.properties.countryCode)) {
              mapFeaturesByCode.set(feature.properties.countryCode, feature);
            }
            const featureCentroid = d3.geoCentroid(feature);
            if (
              Array.isArray(featureCentroid) &&
              Number.isFinite(featureCentroid[0]) &&
              Number.isFinite(featureCentroid[1]) &&
              !mapCentroids.has(feature.properties.countryCode)
            ) {
              mapCentroids.set(feature.properties.countryCode, featureCentroid);
            }
          });
          state.mapFeaturesByCode = mapFeaturesByCode;
          state.mapCentroids = mapCentroids;
          refreshModeDerivedIndexes(state.questionPool);

          logMapCoverageDiagnostics(geojson.features);

          countriesLayer
            .selectAll("path")
            .data(geojson.features)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("data-name", (d) => d.properties.normalizedName)
            .attr("data-country-code", (d) => d.properties.countryCode)
            .attr("d", path)
            .on("pointerdown", (event) => {
              startPointer(event);
            })
            .on("pointermove", (event) => {
              if (!state.activePointer || state.activePointer.pointerId !== event.pointerId) return;
              const moved = Math.hypot(event.clientX - state.activePointer.x, event.clientY - state.activePointer.y);
              if (moved > state.pointerTapThreshold) state.activePointer.moved = true;
            })
            .on("pointerup", (event, d) => {
              if (event.pointerType === "mouse") {
                clearActivePointer();
                return;
              }
              if (!isTapPointer(event) || state.activePointer?.moved) {
                clearActivePointer();
                return;
              }
              clearActivePointer();
              if (!d.properties.countryCode) {
                logUnmappedCountry(d);
              }
              trySelectCountryFromEvent(event);
            })
            .on("pointercancel", clearActivePointer)
            .on("click", (event, d) => {
              if (event.pointerType && event.pointerType !== "mouse") return;
              if (state.activePointer) return;
              if (!d.properties.countryCode) {
                logUnmappedCountry(d);
              }
              trySelectCountryFromEvent(event);
            });

          state.mapDiagnostics.smallCountryCodes = [];

          const zoomMax = window.matchMedia(MOBILE_VIEWPORT_QUERY).matches ? MAP_MAX_ZOOM_MOBILE : MAP_MAX_ZOOM_DESKTOP;

          const zoomBehavior = d3
            .zoom()
            .scaleExtent([MAP_MIN_ZOOM, zoomMax])
            .filter((event) => {
              if (event.type === "dblclick") return false;
              if (state.isRevealingAnswer) return false;
              return !el.overlay.classList.contains("active");
            })
            .on("zoom", (event) => {
              mapLayer.attr("transform", event.transform);
            })
            .on("end", clearActivePointer);

          svg.call(zoomBehavior);

          if (!el.mapStage.querySelector(".map-svg")) {
            el.mapStage.appendChild(svg.node());
          }
          if (el.mapLoading && el.mapLoading.parentElement) {
            el.mapLoading.remove();
          }
          state.mapReady = true;
          state.mapLoadError = "";
          updateMapHighlights();
          return true;
        } catch (error) {
          state.mapReady = false;
          state.mapLoadError = "تعذر تحميل الخريطة التفاعلية. تأكد من الإنترنت ثم أعد المحاولة.";
          if (el.mapLoading) {
            el.mapLoading.className = "error";
            el.mapLoading.textContent = state.mapLoadError;
          }
          console.error("[MapGame] Failed to load map data", {
            mapDataUrl: WORLD_MAP_URL,
            error,
          });
          return false;
        } finally {
          state.mapLoadPromise = null;
        }
        })();
        return state.mapLoadPromise;
      }

      function startGame(mode = state.selectedMode) {
        const modeToStart = [MAP_GAME_MODE_MAP, MAP_GAME_MODE_IMAGE, MAP_GAME_MODE_LANGUAGE].includes(mode) ? mode : MAP_GAME_MODE_MAP;
        const modeQuestionCount = Array.isArray(state.questionPoolByMode[modeToStart]) ? state.questionPoolByMode[modeToStart].length : 0;
        const lastModeError = normalizeCell(state.modeLoadErrorByMode[modeToStart]);
        console.debug("[MapGame][start-flow] startGame called", {
          modeToStart,
          mapReady: state.mapReady,
          questionsReady: state.questionsReadyByMode[modeToStart],
          modeQuestionCount,
          lastModeError,
        });
        if (!state.mapReady || !state.questionsReadyByMode[modeToStart]) {
          console.warn("[MapGame][start-flow] startGame blocked due to unmet readiness", {
            modeToStart,
            mapReady: state.mapReady,
            questionsReady: state.questionsReadyByMode[modeToStart],
            modeQuestionCount,
            lastModeError,
            mapLoadError: state.mapLoadError,
          });
          if (!state.mapReady) {
            showSetupError(state.mapLoadError || "تعذر تحميل الخريطة التفاعلية. تأكد من الإنترنت ثم أعد المحاولة.");
          } else if (!state.questionsReadyByMode[modeToStart]) {
            const modeError =
              lastModeError ||
              (modeToStart === MAP_GAME_MODE_LANGUAGE
                ? "فشل تحميل أسئلة وضع اللغة."
                : modeToStart === MAP_GAME_MODE_IMAGE
                  ? "فشل تحميل أسئلة وضع الصورة."
                  : "فشل تحميل أسئلة وضع الخريطة.");
            showSetupError(modeError);
          }
          return false;
        }
        setSelectedMode(modeToStart);
        clearPendingResultReveal();
        clearSavedGameState();
        stopCurrentAudio();

        state.teamNames = [el.team1Name.value.trim() || "الفريق الأول", el.team2Name.value.trim() || "الفريق الثاني"];
        state.scores = [0, 0];
        state.questionIndex = 0;
        try {
          state.questionPool = state.questionPoolByMode[modeToStart];
          state.questions = buildQuestions();
        } catch (error) {
          const modeSpecificError =
            modeToStart === MAP_GAME_MODE_LANGUAGE
              ? "تعذر تحميل وضع اللغة. يمكنك إعادة المحاولة أو الرجوع لوضع الخريطة."
              : modeToStart === MAP_GAME_MODE_IMAGE
                ? "تعذر تحميل وضع الصورة. يمكنك إعادة المحاولة أو اختيار وضع آخر."
                : CSV_LOAD_ERROR_AR;
          showOverlay("خطأ", modeSpecificError, [{ label: "حسنًا", kind: "btn-light", onClick: hideOverlay }]);
          console.error(error);
          showSetupError(modeSpecificError);
          return false;
        }
        state.phase = "active_pick";
        state.teamPicks = [null, null];
        state.otherTeamAcceptedActiveAnswer = false;
        state.pendingPick = null;
        state.pendingTeamIndex = null;
        state.started = true;
        markCurrentQuestionAsUsed();

        el.setupScreen.style.display = "none";
        el.gameScreen.classList.add("active");
        updateHeader();
        updateMapHighlights();
        updateAudioUi();
        persistGameState();
        showSetupError("");
        return true;
      }

      el.startBtn.addEventListener("click", async () => {
        console.debug("[MapGame][start-flow] start button click fired", {
          startBtnDisabled: el.startBtn.disabled,
          selectedMode: state.selectedMode,
          mapReady: state.mapReady,
          questionsReadyByMode: { ...state.questionsReadyByMode },
        });
        showSetupError("");
        const checkedMode = modeRadioInputs.find((radioInput) => radioInput.checked)?.value;
        const effectiveMode = state.selectedMode || checkedMode || MAP_GAME_MODE_MAP;
        const team1Name = el.team1Name.value.trim();
        const team2Name = el.team2Name.value.trim();
        const hasValidTeamNames = Boolean(team1Name && team2Name);
        console.debug("[MapGame][start-flow] computed start inputs", {
          checkedMode,
          effectiveMode,
          hasValidTeamNames,
          team1Provided: Boolean(team1Name),
          team2Provided: Boolean(team2Name),
          mapReady: state.mapReady,
          questionsReadyForMode: state.questionsReadyByMode[effectiveMode],
        });
        if (!hasValidTeamNames) {
          showSetupError("يرجى إدخال اسم الفريقين قبل البدء.");
          console.warn("[MapGame][start-flow] blocked start due to missing team names", {
            team1Provided: Boolean(team1Name),
            team2Provided: Boolean(team2Name),
          });
          return;
        }
        if (effectiveMode !== state.selectedMode) {
          handleModeSelection(effectiveMode);
        }

        try {
          el.startBtn.disabled = true;
          el.startBtn.textContent = "جاري تحميل البيانات...";
          const [questionsReady, mapReady] = await Promise.all([
            ensureQuestionsForMode(effectiveMode, { forceReload: !state.questionsReadyByMode[effectiveMode] }),
            loadMap(),
          ]);
          const questionCountForMode = Array.isArray(state.questionPoolByMode[effectiveMode])
            ? state.questionPoolByMode[effectiveMode].length
            : 0;
          const lastModeError = normalizeCell(state.modeLoadErrorByMode[effectiveMode]);
          const readinessSnapshot = {
            mode: effectiveMode,
            mapReady: state.mapReady,
            mapLoadResult: mapReady,
            mapLoadError: state.mapLoadError,
            questionsReady: state.questionsReadyByMode[effectiveMode],
            questionsLoadResult: questionsReady,
            questionCountForMode,
            lastModeError,
          };
          console.debug("[MapGame][start-flow] dependency load result", readinessSnapshot);

          if (!state.mapReady || !state.questionsReadyByMode[effectiveMode] || questionCountForMode <= 0) {
            let blockerMessage = "";
            if (!state.mapReady) {
              blockerMessage = state.mapLoadError || "فشل تحميل تفاعل الخريطة.";
            } else if (!state.questionsReadyByMode[effectiveMode]) {
              blockerMessage =
                lastModeError ||
                (effectiveMode === MAP_GAME_MODE_LANGUAGE
                  ? "فشل تحميل أسئلة وضع اللغة."
                  : effectiveMode === MAP_GAME_MODE_IMAGE
                    ? "فشل تحميل أسئلة وضع الصورة."
                    : "فشل تحميل أسئلة وضع الخريطة.");
            } else {
              blockerMessage =
                effectiveMode === MAP_GAME_MODE_LANGUAGE
                  ? "وضع اللغة لا يحتوي حالياً على أسئلة صالحة للاستخدام."
                  : effectiveMode === MAP_GAME_MODE_IMAGE
                    ? "وضع الصورة لا يحتوي حالياً على أسئلة صالحة للاستخدام."
                    : "وضع الخريطة لا يحتوي حالياً على أسئلة صالحة للاستخدام.";
            }
            console.error("[MapGame][start-flow] blocked after awaiting dependencies", readinessSnapshot);
            showModeLoadMessage(blockerMessage);
            showSetupError(blockerMessage);
            el.startBtn.textContent = "إعادة المحاولة";
            el.startBtn.disabled = false;
            return;
          }

          const started = startGame(effectiveMode);
          if (!started) {
            const modeError = normalizeCell(state.modeLoadErrorByMode[effectiveMode]);
            showSetupError(modeError || "تعذر بدء اللعبة بسبب عدم جاهزية البيانات المطلوبة.");
            el.startBtn.textContent = "إعادة المحاولة";
            el.startBtn.disabled = false;
            return;
          }
          el.startBtn.textContent = "ابدأ اللعبة";
        } catch (error) {
          console.error("[MapGame][start-flow] unexpected start failure", error);
          showSetupError("حدث خطأ غير متوقع أثناء بدء اللعبة. حاول مرة أخرى.");
          el.startBtn.textContent = "إعادة المحاولة";
          el.startBtn.disabled = false;
        }
      });
      el.enterSetupBtn.addEventListener("click", () => {
        el.introScreen.style.display = "none";
        el.setupScreen.style.display = "block";
        el.team1Name.focus();
      });
      el.resumeBtn.addEventListener("click", () => {
        const saved = state.pendingResume;
        el.resumePrompt.classList.add("hidden");
        if (!saved) return;
        const resumeMode = [MAP_GAME_MODE_MAP, MAP_GAME_MODE_IMAGE, MAP_GAME_MODE_LANGUAGE].includes(saved.selectedMode)
          ? saved.selectedMode
          : MAP_GAME_MODE_MAP;
        setSelectedMode(resumeMode);
        ensureQuestionsForMode(resumeMode).then((ready) => {
          if (!ready || !restoreSavedGameState(saved)) {
            clearSavedGameState();
            showModeLoadMessage("تعذر استعادة اللعبة المحفوظة لهذا الوضع. يمكنك بدء لعبة جديدة.");
          }
          state.pendingResume = null;
        });
      });
      el.discardResumeBtn.addEventListener("click", () => {
        clearSavedGameState();
        state.pendingResume = null;
        el.resumePrompt.classList.add("hidden");
      });
      el.acceptActiveAnswerBtn.addEventListener("click", acceptActiveAnswer);
      el.playAudioBtn.addEventListener("click", () => {
        playCurrentAudio();
      });
      modeRadioInputs.forEach((radioInput) => {
        radioInput.addEventListener("change", () => {
          if (!radioInput.checked) return;
          handleModeSelection(radioInput.value);
        });
      });
      let lastDelegatedModeActivationAt = 0;
      let lastDelegatedMode = "";
      function selectModeFromOption(option, sourceEventType = "") {
        if (!option) return;
        const mode = option.dataset.modeOption;
        if (![MAP_GAME_MODE_MAP, MAP_GAME_MODE_IMAGE, MAP_GAME_MODE_LANGUAGE].includes(mode)) return;
        if (sourceEventType === "click" && mode === lastDelegatedMode && Date.now() - lastDelegatedModeActivationAt < 300) {
          return;
        }
        const radioInput = option.querySelector('input[type="radio"]');
        if (radioInput) {
          radioInput.checked = true;
        }
        lastDelegatedMode = mode;
        lastDelegatedModeActivationAt = Date.now();
        handleModeSelection(mode);
      }
      function selectModeFromEvent(event) {
        const option = event.target.closest("[data-mode-option]");
        if (!option || (modeSelector && !modeSelector.contains(option))) return;
        selectModeFromOption(option, event.type);
      }
      if (modeSelector) {
        modeSelector.addEventListener("click", selectModeFromEvent);
        modeSelector.addEventListener("pointerup", (event) => {
          if (event.pointerType === "mouse") return;
          selectModeFromEvent(event);
        });
      }
      el.retryModeLoadBtn.addEventListener("click", () => {
        const mode = state.selectedMode;
        ensureQuestionsForMode(mode, { forceReload: true });
      });
      el.switchToMapModeBtn.addEventListener("click", () => {
        setSelectedMode(MAP_GAME_MODE_MAP);
        showModeLoadMessage("");
        el.startBtn.disabled = !state.mapReady || !state.questionsReadyByMode[MAP_GAME_MODE_MAP];
      });
      window.addEventListener("beforeunload", () => {
        clearPendingResultReveal();
        stopCurrentAudio();
      });

      async function loadQuestionsFromApi(mode, { forceReload = false } = {}) {
        const modeKey = [MAP_GAME_MODE_MAP, MAP_GAME_MODE_IMAGE, MAP_GAME_MODE_LANGUAGE].includes(mode) ? mode : MAP_GAME_MODE_MAP;
        if (!forceReload && state.questionsReadyByMode[modeKey] && state.questionPoolByMode[modeKey].length) {
          return true;
        }
        if (state.questionsLoadPromiseByMode[modeKey]) {
          return state.questionsLoadPromiseByMode[modeKey];
        }
        const loadPromise = (async () => {
          try {
          const endpoint =
            modeKey === MAP_GAME_MODE_LANGUAGE
              ? "/map-game/language-questions"
              : modeKey === MAP_GAME_MODE_IMAGE
                ? "/map-game/image-questions"
                : "/map-game/questions";
          const payload = await apiFetchJson(endpoint);
          const rawQuestions = Array.isArray(payload?.questions) ? payload.questions : [];
          const mapFeatureCodes = new Set(
            Array.from(el.mapStage?.querySelectorAll?.(".country[data-country-code]") || [])
              .map((node) => normalizeQuestionCountryCode(node.dataset.countryCode))
              .filter(Boolean)
          );
          const loadDiagnostics = {
            mode: modeKey,
            endpoint,
            receivedRows: rawQuestions.length,
            normalizedRows: 0,
            validRows: 0,
            filteredOut: {
              missingCountryCode: 0,
              missingRequiredField: 0,
              missingAudioUrl: 0,
              missingLatLng: 0,
              invalidDifficulty: 0,
              invalidPoints: 0,
              countryCodeNotOnMap: 0,
            },
          };
          const questions = rawQuestions
            .map((question, index) => {
              const sourceId = String(
                question.sourceId ||
                question.source_id ||
                question.id ||
                question.ID ||
                ""
              ).trim();
              const targetCountryCode = normalizeQuestionCountryCode(
                question.targetCountryCode ||
                question.target_country_code ||
                question.countryCode ||
                question.country_code
              );
              const targetCountryNameAr = question.targetCountryNameAr || question.target_country_name_ar || question.countryNameAr || question.country_name_ar || "";
              const targetCountryNameEn = question.targetCountryNameEn || question.target_country_name_en || question.countryNameEn || question.country_name_en || "";
              const audioUrl = normalizeAudioUrl(question.audioUrl || question.audio_url);
              const imageUrl = normalizeImageUrl(question.imageUrl || question.image_url);
              const normalizedQuestion = {
                id: sourceId,
                mode: modeKey,
                promptType: question.promptType || question.prompt_type || (modeKey === MAP_GAME_MODE_LANGUAGE ? "audio" : modeKey === MAP_GAME_MODE_IMAGE ? "image" : "map"),
                sourceId,
                targetCountryCode,
                targetCountryNameAr,
                targetCountryNameEn,
                countryCode: targetCountryCode,
                countryNameAr: targetCountryNameAr,
                countryNameEn: targetCountryNameEn,
                difficulty: normalizeQuestionDifficulty(question.difficulty),
                points: Number.isFinite(Number(question.points)) ? Number(question.points) : POINTS[normalizeQuestionDifficulty(question.difficulty)] || 0,
                imageUrl,
                audioUrl,
                placeNameAr: question.placeNameAr || question.place_name_ar || "",
                placeNameEn: question.placeNameEn || question.place_name_en || "",
                sourceLanguageAnswer: question.sourceLanguageAnswer || question.source_language_answer || "",
                status: question.status || "",
                lat: Number(question.lat),
                lng: Number(question.lng),
              };
              normalizedQuestion.questionKey = buildQuestionKey(normalizedQuestion);

              if (!normalizedQuestion.targetCountryCode) {
                loadDiagnostics.filteredOut.missingCountryCode += 1;
                return null;
              }
              if (!normalizedQuestion.targetCountryNameAr || !normalizedQuestion.targetCountryNameEn) {
                loadDiagnostics.filteredOut.missingRequiredField += 1;
                return null;
              }
              if (modeKey === MAP_GAME_MODE_LANGUAGE && !normalizedQuestion.audioUrl) {
                loadDiagnostics.filteredOut.missingAudioUrl += 1;
                return null;
              }
              if (modeKey === MAP_GAME_MODE_LANGUAGE && !(Number.isFinite(normalizedQuestion.lat) && Number.isFinite(normalizedQuestion.lng))) {
                loadDiagnostics.filteredOut.missingLatLng += 1;
                return null;
              }
              if (modeKey === MAP_GAME_MODE_LANGUAGE && !normalizeQuestionDifficulty(normalizedQuestion.difficulty)) {
                loadDiagnostics.filteredOut.invalidDifficulty += 1;
                return null;
              }
              if (modeKey === MAP_GAME_MODE_LANGUAGE && !Number.isFinite(Number(normalizedQuestion.points))) {
                loadDiagnostics.filteredOut.invalidPoints += 1;
                return null;
              }
              if (modeKey !== MAP_GAME_MODE_LANGUAGE && mapFeatureCodes.size && !mapFeatureCodes.has(normalizedQuestion.targetCountryCode)) {
                loadDiagnostics.filteredOut.countryCodeNotOnMap += 1;
                console.warn("[MapGame][mode-load] question country code is not present on map", {
                  mode: modeKey,
                  index,
                  sourceId,
                  targetCountryCode: normalizedQuestion.targetCountryCode,
                });
                return null;
              }
              loadDiagnostics.normalizedRows += 1;
              loadDiagnostics.validRows += 1;
              return normalizedQuestion;
            })
            .filter(Boolean);
          if (!questions.length) {
            console.error("[MapGame][mode-load] no usable rows after normalization", loadDiagnostics);
            throw new Error(
              modeKey === MAP_GAME_MODE_LANGUAGE
                ? "بيانات وضع اللغة غير متوفرة حالياً."
                : modeKey === MAP_GAME_MODE_IMAGE
                  ? "بيانات وضع الصورة غير متوفرة حالياً."
                  : "No valid map-game rows in API response"
            );
          }
          console.info("[MapGame][mode-load] mode questions loaded", loadDiagnostics);

          state.questionPoolByMode[modeKey] = questions;
          state.questionsReadyByMode[modeKey] = questions.length >= 20;
          state.modeLoadErrorByMode[modeKey] = "";
          questions.forEach((item) => {
            const normalizedName = normalizeName(item.targetCountryNameEn);
            if (normalizedName && item.targetCountryCode && !state.countryCodeByNormalizedNameAllModes.has(normalizedName)) {
              state.countryCodeByNormalizedNameAllModes.set(normalizedName, item.targetCountryCode);
            }
          });
          if (modeKey === state.selectedMode) {
            state.questionPool = questions;
            refreshModeDerivedIndexes(questions);
            showModeLoadMessage("");
          }
          return state.questionsReadyByMode[modeKey];
        } catch (error) {
          console.error("[MapGame][mode-load] endpoint failed", { mode: modeKey, error });
          state.questionsReadyByMode[modeKey] = false;
          state.modeLoadErrorByMode[modeKey] = error instanceof Error ? error.message : CSV_LOAD_ERROR_AR;
          if (modeKey === state.selectedMode) {
            showModeLoadMessage(modeKey === MAP_GAME_MODE_LANGUAGE
              ? "تعذر تحميل وضع اللغة. يمكنك إعادة المحاولة أو الرجوع لوضع الخريطة."
              : modeKey === MAP_GAME_MODE_IMAGE
                ? "تعذر تحميل وضع الصورة. يمكنك إعادة المحاولة أو اختيار وضع آخر."
              : CSV_LOAD_ERROR_AR);
          }
          return false;
        } finally {
          state.questionsLoadPromiseByMode[modeKey] = null;
        }
        })();
        state.questionsLoadPromiseByMode[modeKey] = loadPromise;
        return loadPromise;
      }

      async function ensureQuestionsForMode(mode, { forceReload = false } = {}) {
        const ok = await loadQuestionsFromApi(mode, { forceReload });
        if (ok) {
          if (mode === state.selectedMode) {
            state.questionPool = state.questionPoolByMode[mode];
            refreshModeDerivedIndexes(state.questionPool);
            showModeLoadMessage("");
          }
          el.startBtn.disabled = !state.mapReady || !state.questionsReadyByMode[state.selectedMode];
          return true;
        }
        el.startBtn.disabled = false;
        return false;
      }

      async function initializeMapGame({ forceRetry = false } = {}) {
        if (state.initializing) return;
        state.initializing = true;
        try {
          state.usedQuestionHistory = loadUsedQuestionHistory();
          el.startBtn.disabled = true;
          el.startBtn.textContent = "جاري تحميل البيانات...";
          if (forceRetry && el.mapLoading && !state.mapReady) {
            el.mapLoading.className = "map-loading";
            el.mapLoading.textContent = "جاري تحميل الخريطة...";
          }
          const [questionsLoaded] = await Promise.all([
            ensureQuestionsForMode(MAP_GAME_MODE_MAP, { forceReload: forceRetry }),
            state.mapReady ? Promise.resolve() : loadMap(),
          ]);
          if (state.mapReady && state.questionsReadyByMode[state.selectedMode]) {
            state.pendingResume = readSavedGameState();
            if (state.pendingResume) {
              el.resumePrompt.classList.remove("hidden");
            }
            el.startBtn.disabled = false;
            el.startBtn.textContent = "ابدأ اللعبة";
          } else {
            el.startBtn.disabled = false;
            el.startBtn.textContent = "إعادة المحاولة";
          }
        } finally {
          state.initializing = false;
        }
      }

      initializeMapGame();
  }

  enterBtn.addEventListener('click', async () => {
    enterBtn.disabled = true;
    try {
      await mountRuntime();
      await loadScript('/game-config.js');
      intro.style.display = 'none';
      const setupScreen = document.getElementById('setupScreen');
      if (setupScreen) setupScreen.style.display = 'block';
      initRuntime();
    } catch (error) {
      console.error('[map-game] failed to mount runtime', error);
      enterBtn.disabled = false;
    }
  });
})();
