const DEFAULT_CATEGORIES_TO_SELECT = 6;
const SOLO_CATEGORIES_TO_SELECT = 3;
const POINT_ROWS_COUNT = 5;
const POINT_LEVELS = [100, 200, 300, 400, 500];
const WORKER_URL_PLACEHOLDER = "https://REPLACE_WITH_YOUR_WORKER_URL";
const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";
const SUPPORTED_TEAM_COUNTS = [1, 2, 3];
const USED_STORAGE_KEY = "tasleya_used_v1";
const TEAM_NAMES_STORAGE_KEY = "tasleya_team_names_v1";
const ONLINE_SESSION_STORAGE_KEY = "tasleya_online_session_v1";
const ONLINE_CLIENT_ID_STORAGE_KEY = "tasleya_online_client_id_v1";
const INSTRUCTIONS_SEEN_STORAGE_KEY = "tasleya_instructions_seen_v1";
const LOCAL_PROGRESS_STORAGE_KEY = "tasleya_local_progress_v1";
const SOUND_MUTED_STORAGE_KEY = "tasleya_sound_muted_v1";
const FIREBASE_ROOMS_PATH = "tasleyaRooms";
const CONTACT_MESSAGES_COLLECTION = "contactMessages";
const CONTACT_MIN_LENGTH = 3;
const CONTACT_MAX_LENGTH = 1000;
const CONTACT_SUBMIT_COOLDOWN_MS = 5000;
const HOST_ONLY_START_MESSAGE = "فقط منشئ الغرفة يمكنه بدء اللعبة";
const HOST_ONLY_SETUP_MESSAGE = "الفريق الذي أنشأ الغرفة هو الوحيد الذي يمكنه اختيار الفئات";
const ONLINE_PRESENCE_HEARTBEAT_MS = 15000;
const ONLINE_RECONNECT_GRACE_MS = 2 * 60 * 1000;
const ONLINE_ACTIVE_GAME_STALE_MS = 15 * 60 * 1000;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let mcqHelpUsed = { 1: false, 2: false, 3: false };
let hintHelpUsed = { 1: false, 2: false, 3: false };
let timerInterval = null;
let timerStart = null;
let questionTimeoutToken = null;
let questionDeadlineTs = null;
let appInitialized = false;

const QUESTION_WARNING_MS = 60000;
const QUESTION_TIMEOUT_MS = 75000;
const DEFAULT_CATEGORY_GROUP = "معلومات عامة";
const MAP_QUESTION_CATEGORY = "ما هي الدولة بالخريطة";
const CATEGORY_DISPLAY_GROUPS = [
  {
    name: "علوم إسلامية",
    categories: ["القرآن الكريم", "أحاديث", "السيرة النبوية", "تاريخ إسلامي", "تاريخ اسلامي"],
  },
  {
    name: "جغرافيا",
    categories: ["ما هي الدولة بالعلم", "ما هي الدولة بالخريطة", "خمن الدولة من المكان GeoGuessr", "خمن اللغة من الصوت", "عواصم", "لون العلم"],
  },
  {
    name: "الدول",
    categories: ["مصر", "المغرب", "السعودية", "الكويت", "فلسطين"],
  },
  {
    name: "رياضة",
    categories: ["رياضة", "كرة قدم", "UFC", "مسيرة لاعب", "خمن اللاعب (فرق فقط)"],
  },
  {
    name: "ثقافة وفن",
    categories: ["فن عربي", "من هو المشهور (جزء من وجه)", "خمن القائل من الصوت"],
  },
  {
    name: "معلومات عامة",
    categories: ["معلومات عامة", "أكمل المثل", "رتب التالي"],
  },
  {
    name: "تخصصات الجامعة",
    categories: ["طب", "هندسة", "صيدلة", "بزنس"],
  },
  {
    name: "مدن",
    categories: ["الإسكندرية"],
  },
];

let el = {};

function cacheElements() {
  el = {
  board: document.getElementById("board"),
  errorBanner: document.getElementById("errorBanner"),
  team1Score: document.getElementById("team1Score"),
  team2Score: document.getElementById("team2Score"),
  team1Card: document.getElementById("team1Card"),
  team2Card: document.getElementById("team2Card"),
  team1NameInput: document.getElementById("team1NameInput"),
  team2NameInput: document.getElementById("team2NameInput"),
  team1PlusBtn: document.getElementById("team1PlusBtn"),
  team1MinusBtn: document.getElementById("team1MinusBtn"),
  team2PlusBtn: document.getElementById("team2PlusBtn"),
  team2MinusBtn: document.getElementById("team2MinusBtn"),
  team3Score: document.getElementById("team3Score"),
  team3Card: document.getElementById("team3Card"),
  team3NameInput: document.getElementById("team3NameInput"),
  team3PlusBtn: document.getElementById("team3PlusBtn"),
  team3MinusBtn: document.getElementById("team3MinusBtn"),
  currentTurn: document.getElementById("currentTurn"),
  newGameBtn: document.getElementById("newGameBtn"),
  modal: document.getElementById("questionModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  questionTimer: document.getElementById("questionTimer"),
  lateOtherTeamPrompt: document.getElementById("lateOtherTeamPrompt"),
  questionText: document.getElementById("questionText"),
  questionMedia: document.getElementById("questionMedia"),
  answerText: document.getElementById("answerText"),
  revealBtn: document.getElementById("revealBtn"),
  correctBtn: document.getElementById("correctBtn"),
  wrongBtn: document.getElementById("wrongBtn"),
  otherTeamBtn: document.getElementById("otherTeamBtn"),
  lifelineBtn: document.getElementById("lifelineBtn"),
  hintLifelineBtn: document.getElementById("hintLifelineBtn"),
  choicesBox: document.getElementById("choicesBox"),
  choicesList: document.getElementById("choicesList"),
  hintBox: document.getElementById("hintBox"),
  hintText: document.getElementById("hintText"),
  questionStatus: document.getElementById("questionStatus"),
  categoryModal: document.getElementById("categoryModal"),
  categoryModalTitle: document.getElementById("categoryModalTitle"),
  categoryList: document.getElementById("categoryList"),
  categoryTeam1NameInput: document.getElementById("categoryTeam1NameInput"),
  categoryTeam2NameInput: document.getElementById("categoryTeam2NameInput"),
  categoryTeam2NameLabel: document.getElementById("categoryTeam2NameLabel"),
  categoryTeam3NameInput: document.getElementById("categoryTeam3NameInput"),
  categoryTeam3NameLabel: document.getElementById("categoryTeam3NameLabel"),
  categoryCounter: document.getElementById("categoryCounter"),
  categoryHostOnlyNote: document.getElementById("categoryHostOnlyNote"),
  startGameBtn: document.getElementById("startGameBtn"),
  randomCategoriesBtn: document.getElementById("randomCategoriesBtn"),
  cancelCategoryBtn: document.getElementById("cancelCategoryBtn"),
  podiumModal: document.getElementById("podiumModal"),
  podiumTitle: document.getElementById("podiumTitle"),
  podiumSubtitle: document.getElementById("podiumSubtitle"),
  podiumBoard: document.getElementById("podiumBoard"),
  resultShareSection: document.getElementById("resultShareSection"),
  resultShareSummary: document.getElementById("resultShareSummary"),
  resultShareFeedback: document.getElementById("resultShareFeedback"),
  shareResultBtn: document.getElementById("shareResultBtn"),
  shareWhatsappBtn: document.getElementById("shareWhatsappBtn"),
  copyResultBtn: document.getElementById("copyResultBtn"),
  podiumNewGameBtn: document.getElementById("podiumNewGameBtn"),
  startScreen: document.getElementById("startScreen"),
  gameScreen: document.getElementById("gameScreen"),
  backToHomeBtn: document.getElementById("backToHomeBtn"),
  startLocalBtn: document.getElementById("startLocalBtn"),
  startOnlineBtn: document.getElementById("startOnlineBtn"),
  instructionsBtn: document.getElementById("instructionsBtn"),
  instructionsModal: document.getElementById("instructionsModal"),
  closeInstructionsBtn: document.getElementById("closeInstructionsBtn"),
  contactBtn: document.getElementById("contactBtn"),
  contactModal: document.getElementById("contactModal"),
  contactMessageInput: document.getElementById("contactMessageInput"),
  contactNameInput: document.getElementById("contactNameInput"),
  contactEmailInput: document.getElementById("contactEmailInput"),
  contactFeedback: document.getElementById("contactFeedback"),
  sendContactBtn: document.getElementById("sendContactBtn"),
  closeContactBtn: document.getElementById("closeContactBtn"),
  installGuideBtn: document.getElementById("installGuideBtn"),
  installGuideModal: document.getElementById("installGuideModal"),
  closeInstallGuideBtn: document.getElementById("closeInstallGuideBtn"),
  onlineModal: document.getElementById("onlineModal"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  onlineCreatePanel: document.getElementById("onlineCreatePanel"),
  onlineJoinPanel: document.getElementById("onlineJoinPanel"),
  createdRoomCode: document.getElementById("createdRoomCode"),
  joinLinkInput: document.getElementById("joinLinkInput"),
  copyCodeBtn: document.getElementById("copyCodeBtn"),
  copyLinkBtn: document.getElementById("copyLinkBtn"),
  waitingStatus: document.getElementById("waitingStatus"),
  startOnlineGameBtn: document.getElementById("startOnlineGameBtn"),
  onlineTwoTeamsBtn: document.getElementById("onlineTwoTeamsBtn"),
  onlineThreeTeamsBtn: document.getElementById("onlineThreeTeamsBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  confirmJoinBtn: document.getElementById("confirmJoinBtn"),
  cancelOnlineBtn: document.getElementById("cancelOnlineBtn"),
  onlineStatusCard: document.getElementById("onlineStatusCard"),
  onlineStatusText: document.getElementById("onlineStatusText"),
  onlineRoomCodeText: document.getElementById("onlineRoomCodeText"),
  onlineFeedback: document.getElementById("onlineFeedback"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  localTeamsModal: document.getElementById("localTeamsModal"),
  localOneTeamBtn: document.getElementById("localOneTeamBtn"),
  localTwoTeamsBtn: document.getElementById("localTwoTeamsBtn"),
  localThreeTeamsBtn: document.getElementById("localThreeTeamsBtn"),
  cancelLocalTeamsBtn: document.getElementById("cancelLocalTeamsBtn"),
  };
}

const state = {
  allCategories: [],
  selectedCategories: [],
  boardTiles: [],
  pointLevels: [],
  assignedQuestionIds: new Set(),
  dataLoadFailed: false,
  teamCount: 2,
  scores: { 1: 0, 2: 0, 3: 0 },
  teamNames: { 1: "الفريق الأول", 2: "الفريق الثاني", 3: "الفريق الثالث" },
  currentTeam: 1,
  activeTile: null,
  usedHistory: {},
  displayedScores: { 1: 0, 2: 0, 3: 0 },
  answerRevealed: false,
  currentChoices: [],
  currentHintText: "",
  activeQuestion: null,
  revealRequested: false,
};

const contactState = {
  submitting: false,
  cooldownUntil: 0,
};


const online = {
  mode: "local",
  role: null,
  teamSlot: null,
  resolvedTeamSlot: null,
  roomCode: "",
  roomRef: null,
  roomListener: null,
  connected: { 1: false, 2: false, 3: false },
  participantSlots: { 1: null, 2: null, 3: null },
  participantRecords: { 1: null, 2: null, 3: null },
  listening: false,
  applyingRemote: false,
  firebaseReady: false,
  db: null,
  firestore: null,
  creatingRoom: false,
  joiningRoom: false,
  selectedTeamCount: 2,
  clientId: null,
  sessionRestoreInProgress: false,
  restoringFromSavedSession: false,
  connectionStateRef: null,
  connectionStateHandler: null,
  heartbeatTimer: null,
  currentTurnTeam: null,
};

const soundState = {
  muted: false,
  preferenceLoaded: false,
  correct: null,
  wrong: null,
  timerWarning: null,
  timerWarningPlaying: false,
};

function buildEmptyParticipantSlots() {
  return { 1: null, 2: null, 3: null };
}

function buildEmptyParticipantConnections() {
  return { 1: false, 2: false, 3: false };
}

function buildEmptyParticipantRecords() {
  return { 1: null, 2: null, 3: null };
}

function normalizeParticipantSlots(room = {}) {
  const slots = buildEmptyParticipantSlots();
  if (room.participantSlots && typeof room.participantSlots === "object") {
    [1, 2, 3].forEach((slot) => {
      const clientId = normalizeCell(room.participantSlots[slot]);
      slots[slot] = clientId || null;
    });
    return slots;
  }
  slots[1] = normalizeCell(room.hostClientId) || null;
  slots[2] = normalizeCell(room.guestClientId) || null;
  return slots;
}

function normalizeParticipantConnections(room = {}) {
  const connections = buildEmptyParticipantConnections();
  if (room.participantConnections && typeof room.participantConnections === "object") {
    [1, 2, 3].forEach((slot) => {
      connections[slot] = !!room.participantConnections[slot];
    });
    return connections;
  }
  connections[1] = !!room.hostConnected;
  connections[2] = !!room.guestConnected;
  return connections;
}

function normalizeParticipantRecords(room = {}) {
  const records = buildEmptyParticipantRecords();
  const slots = normalizeParticipantSlots(room);
  const connections = normalizeParticipantConnections(room);
  const rawParticipants = room.participants && typeof room.participants === "object" ? room.participants : {};

  [1, 2, 3].forEach((slot) => {
    const rawRecord = rawParticipants[slot];
    const fallbackClientId = slots[slot] || null;
    if (rawRecord && typeof rawRecord === "object") {
      records[slot] = {
        clientId: normalizeCell(rawRecord.clientId) || fallbackClientId,
        displayName: normalizeCell(rawRecord.displayName),
        connected: rawRecord.connected ?? connections[slot],
        joinedAt: Number(rawRecord.joinedAt) || null,
        lastSeen: Number(rawRecord.lastSeen) || null,
        heartbeatAt: Number(rawRecord.heartbeatAt) || null,
        disconnectedAt: Number(rawRecord.disconnectedAt) || null,
        teamSlot: slot,
      };
      return;
    }

    if (!fallbackClientId) return;
    records[slot] = {
      clientId: fallbackClientId,
      displayName: "",
      connected: connections[slot],
      joinedAt: null,
      lastSeen: null,
      heartbeatAt: null,
      disconnectedAt: null,
      teamSlot: slot,
    };
  });

  return records;
}

function getParticipantCount(slots, teamCount) {
  return Array.from({ length: teamCount }, (_, index) => index + 1).filter((slot) => !!slots[slot]).length;
}



function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let controllerChanged = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controllerChanged) return;
    controllerChanged = true;
    persistLocalProgress();
    console.log("[Tasleya] Service worker controller changed; skipping forced reload to avoid interrupting active games");
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");

      const promptUpdate = (worker) => {
        if (!worker) return;
        worker.postMessage({ type: "SKIP_WAITING" });
      };

      if (registration.waiting) {
        promptUpdate(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            promptUpdate(newWorker);
          }
        });
      });

      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    } catch (error) {
      console.warn("[Tasleya] Service worker registration failed", error);
    }
  });
}

const analyticsState = {
  supported: false,
  analytics: null,
  warnedUnsupported: false,
};

const questionBankCache = {
  categories: null,
  questionsById: new Map(),
  answersById: new Map(),
  loadPromise: null,
};

const mediaWarmupCache = {
  images: new Map(),
  preconnectedOrigins: new Set(),
};

function normalizeCell(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}
function getConfiguredApiBaseUrl() {
  const configuredBaseUrl = normalizeCell(window.TASLEYA_API_BASE_URL);
  if (!configuredBaseUrl || configuredBaseUrl === WORKER_URL_PLACEHOLDER) {
    return DEFAULT_WORKER_API_BASE_URL;
  }
  return configuredBaseUrl.replace(/\/+$/, "");
}
function buildApiUrl(path, params = {}) {
  const url = new URL(`${getConfiguredApiBaseUrl()}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url;
}
async function apiFetchJson(path, { params = {}, method = "GET", body = null } = {}) {
  const response = await fetch(buildApiUrl(path, params), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const message = normalizeCell(payload?.error) || `API request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
function safeStorageGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch (_) {
    return null;
  }
}
function safeStorageSet(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}
function safeStorageRemove(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}
function createRandomId() {
  return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function getOrCreateStableClientId() {
  const existing = normalizeCell(safeStorageGet(localStorage, ONLINE_CLIENT_ID_STORAGE_KEY));
  if (existing) return existing;
  const created = createRandomId();
  safeStorageSet(localStorage, ONLINE_CLIENT_ID_STORAGE_KEY, created);
  return created;
}
function showError(message) { el.errorBanner.textContent = message; el.errorBanner.classList.remove("hidden"); }
function clearError() { el.errorBanner.textContent = ""; el.errorBanner.classList.add("hidden"); }

function ensureSoundPreferenceLoaded() {
  if (soundState.preferenceLoaded) return;
  soundState.muted = safeStorageGet(localStorage, SOUND_MUTED_STORAGE_KEY) === "1";
  soundState.preferenceLoaded = true;
  updateSoundToggleUI();
}

function ensureSoundClip(type) {
  ensureSoundPreferenceLoaded();
  if (type === "correct") {
    if (!soundState.correct) {
      const audio = new Audio(toMediaUrl("assets/sounds/correct.mp3"));
      audio.preload = "none";
      audio.volume = 0.85;
      soundState.correct = audio;
    }
    return soundState.correct;
  }
  if (type === "wrong") {
    if (!soundState.wrong) {
      const audio = new Audio(toMediaUrl("assets/sounds/wrong.mp3"));
      audio.preload = "none";
      audio.volume = 0.85;
      soundState.wrong = audio;
    }
    return soundState.wrong;
  }
  if (!soundState.timerWarning) {
    const audio = new Audio(toMediaUrl("assets/sounds/timer-warning.mp3"));
    audio.preload = "none";
    audio.loop = true;
    audio.volume = 0.5;
    soundState.timerWarning = audio;
  }
  return soundState.timerWarning;
}

function updateSoundToggleUI() {
  if (!el.soundToggleBtn) return;
  const muted = !!soundState.muted;
  el.soundToggleBtn.textContent = muted ? "🔇 الصوت: مكتوم" : "🔊 الصوت: يعمل";
  el.soundToggleBtn.setAttribute("aria-pressed", muted ? "true" : "false");
}

function setMutedSound(muted) {
  ensureSoundPreferenceLoaded();
  soundState.muted = !!muted;
  safeStorageSet(localStorage, SOUND_MUTED_STORAGE_KEY, soundState.muted ? "1" : "0");
  if (soundState.muted) stopTimerWarningSound();
  updateSoundToggleUI();
}

function playOutcomeSound(type) {
  if (soundState.muted) return;
  const audio = ensureSoundClip(type === "correct" ? "correct" : "wrong");
  if (!audio) return;
  try {
    audio.currentTime = 0;
    const maybePromise = audio.play();
    if (maybePromise && typeof maybePromise.catch === "function") maybePromise.catch(() => {});
  } catch (_) {}
}

function startTimerWarningSound() {
  if (soundState.muted || soundState.timerWarningPlaying) return;
  const timerWarning = ensureSoundClip("timerWarning");
  if (!timerWarning) return;
  try {
    const maybePromise = timerWarning.play();
    soundState.timerWarningPlaying = true;
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => { soundState.timerWarningPlaying = false; });
    }
  } catch (_) {
    soundState.timerWarningPlaying = false;
  }
}

function stopTimerWarningSound() {
  if (!soundState.timerWarning || !soundState.timerWarningPlaying) return;
  soundState.timerWarning.pause();
  soundState.timerWarning.currentTime = 0;
  soundState.timerWarningPlaying = false;
}

function shouldPlayTimerWarning(elapsedMs) {
  return hasUnresolvedActiveQuestion()
    && !state.answerRevealed
    && !state.revealRequested
    && !state.activeTile?.timedOut
    && elapsedMs >= QUESTION_WARNING_MS
    && elapsedMs < QUESTION_TIMEOUT_MS;
}

function syncTimerWarningSound(elapsedMs) {
  if (shouldPlayTimerWarning(elapsedMs)) {
    startTimerWarningSound();
    return;
  }
  stopTimerWarningSound();
}


function formatElapsedTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
function showQuestionStatus(message = "") {
  if (!el.questionStatus) return;
  el.questionStatus.textContent = message;
  el.questionStatus.classList.toggle("hidden", !message);
}

function hasUnresolvedActiveQuestion() {
  const modalOpen = !el.modal?.classList.contains("hidden");
  return !!(modalOpen && state.activeTile && !state.activeTile.used && state.activeQuestion);
}

function shouldLockQuestionClose() {
  if (!hasUnresolvedActiveQuestion()) return false;
  if (online.mode !== "online") return true;
  return canCurrentClientAct();
}

function updateCloseButtonLock() {
  if (!el.closeModalBtn) return;
  if (online.mode !== "online") {
    el.closeModalBtn.disabled = true;
    el.closeModalBtn.classList.add("hidden");
    return;
  }
  const lockClose = shouldLockQuestionClose();
  el.closeModalBtn.disabled = lockClose;
  el.closeModalBtn.classList.toggle("hidden", lockClose);
}

function updateQuestionActionLock() {
  const lockByTimeout = !!state.activeTile?.timedOut;
  const lockByTurn = online.mode === "online" && !canCurrentClientAct();
  const lockByReveal = hasUnresolvedActiveQuestion() && !state.answerRevealed;
  const disableActions = lockByTimeout || lockByTurn;
  el.revealBtn.disabled = disableActions || state.answerRevealed;
  el.correctBtn.disabled = disableActions || lockByReveal;
  el.wrongBtn.disabled = disableActions || lockByReveal;
  const soloNoOtherTeam = online.mode === "local" && state.teamCount === 1;
  el.otherTeamBtn.disabled = disableActions || lockByReveal || soloNoOtherTeam;
  el.lifelineBtn.disabled = disableActions || state.answerRevealed || mcqHelpUsed[state.currentTeam];
  el.hintLifelineBtn.disabled = disableActions || state.answerRevealed || hintHelpUsed[state.currentTeam];
  updateLateOtherTeamPrompt();
  updateCloseButtonLock();
}

function updateLateOtherTeamPrompt() {
  if (!el.lateOtherTeamPrompt) return;
  const hasQuestion = !!getActiveQuestion() && !state.activeTile?.used && !state.activeTile?.timedOut && !(online.mode === "local" && state.teamCount === 1);
  const elapsed = timerStart ? Date.now() - timerStart : 0;
  const shouldShow = hasQuestion && elapsed >= QUESTION_WARNING_MS;
  el.lateOtherTeamPrompt.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    el.lateOtherTeamPrompt.disabled = true;
    el.lateOtherTeamPrompt.classList.remove("is-disabled");
    el.lateOtherTeamPrompt.setAttribute("aria-disabled", "true");
    return;
  }
  const isDisabled = el.otherTeamBtn.disabled;
  el.lateOtherTeamPrompt.disabled = isDisabled;
  el.lateOtherTeamPrompt.classList.toggle("is-disabled", isDisabled);
  el.lateOtherTeamPrompt.setAttribute("aria-disabled", isDisabled ? "true" : "false");
}

function updateTimerUI() {
  const elapsed = timerStart ? Date.now() - timerStart : 0;
  el.questionTimer.textContent = formatElapsedTime(Math.max(0, elapsed));
  el.questionTimer.classList.toggle("timer-red", elapsed >= QUESTION_WARNING_MS);
  syncTimerWarningSound(elapsed);
  updateLateOtherTeamPrompt();
}
function stopTimer() { if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; } }
function stopQuestionTimeout() { if (questionTimeoutToken !== null) { clearTimeout(questionTimeoutToken); questionTimeoutToken = null; } }
function resetTimer() { timerStart = null; questionDeadlineTs = null; stopTimerWarningSound(); updateTimerUI(); }
function stopAndResetTimer() { stopTimer(); stopQuestionTimeout(); resetTimer(); }
function handleQuestionTimeout() {
  if (questionTimeoutToken === null) return;
  questionTimeoutToken = null;
  if (online.mode === "online" && !canCurrentClientAct()) return;
  const tile = state.activeTile;
  if (!tile || tile.used || !state.activeQuestion || tile.timedOut || state.answerRevealed) return;
  timerStart = Date.now() - QUESTION_TIMEOUT_MS;
  updateTimerUI();
  stopTimer();
  showQuestionStatus("انتهى الوقت");
  resolveActiveQuestion({
    timedOut: true,
    nextTeam: getNextTeamNumber(state.currentTeam),
  });
}
function startTimer({ deadlineTs = null } = {}) {
  stopAndResetTimer();
  const now = Date.now();
  const normalizedDeadline = Number(deadlineTs);
  questionDeadlineTs = Number.isFinite(normalizedDeadline) && normalizedDeadline > now
    ? normalizedDeadline
    : now + QUESTION_TIMEOUT_MS;
  timerStart = questionDeadlineTs - QUESTION_TIMEOUT_MS;
  updateTimerUI();
  timerInterval = setInterval(updateTimerUI, 250);
  const timeoutInMs = Math.max(0, questionDeadlineTs - now);
  if (online.mode !== "online" || canCurrentClientAct()) {
    questionTimeoutToken = setTimeout(handleQuestionTimeout, timeoutInMs);
  }
}

function shuffle(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


function getActiveTeamNumbers() {
  return Array.from({ length: state.teamCount }, (_, index) => index + 1);
}
function normalizeTeamCount(teamCount) {
  const normalized = Number(teamCount);
  return SUPPORTED_TEAM_COUNTS.includes(normalized) ? normalized : 2;
}
function getRequiredCategoryCount() {
  return (online.mode === "local" && state.teamCount === 1) ? SOLO_CATEGORIES_TO_SELECT : DEFAULT_CATEGORIES_TO_SELECT;
}
function getCategoryModalTitleText() {
  const required = getRequiredCategoryCount();
  return `اختر ${required} ${required === 1 ? "فئة" : "فئات"} لبدء اللعبة`;
}
function getNextTeamNumber(team) {
  const activeTeams = getActiveTeamNumbers();
  const index = activeTeams.indexOf(team);
  if (index === -1) return activeTeams[0] || 1;
  return activeTeams[(index + 1) % activeTeams.length];
}
function setLocalTeamCount(teamCount) {
  state.teamCount = normalizeTeamCount(teamCount);
  updateOnlineActionPermissions();
}
function updateTeamModeUI() {
  const isOneTeam = state.teamCount === 1;
  const isThreeTeams = state.teamCount === 3;
  document.body.classList.toggle("local-three-teams", isThreeTeams && online.mode !== "online");
  el.team2Card.classList.toggle("hidden", isOneTeam);
  el.team3Card.classList.toggle("hidden", !isThreeTeams);
  el.categoryTeam2NameInput.classList.toggle("hidden", isOneTeam);
  el.categoryTeam2NameLabel.classList.toggle("hidden", isOneTeam);
  el.categoryTeam3NameInput.classList.toggle("hidden", !isThreeTeams);
  el.categoryTeam3NameLabel.classList.toggle("hidden", !isThreeTeams);
}

function getTeamControlEntries() {
  return [
    { team: 1, plusBtn: el.team1PlusBtn, minusBtn: el.team1MinusBtn, nameInput: el.team1NameInput },
    { team: 2, plusBtn: el.team2PlusBtn, minusBtn: el.team2MinusBtn, nameInput: el.team2NameInput },
    { team: 3, plusBtn: el.team3PlusBtn, minusBtn: el.team3MinusBtn, nameInput: el.team3NameInput },
  ];
}

function isTeamActive(team) {
  return getActiveTeamNumbers().includes(team);
}

function adjustTeamScore(team, delta) {
  if (online.mode === "online" || !isTeamActive(team)) return;
  state.scores[team] = Math.max(0, (Number(state.scores[team]) || 0) + delta);
  updateScoreboard();
  persistLocalProgress();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeCell(value);
    if (normalized) return normalized;
  }
  return "";
}

function loadUsedHistory() {
  try { const raw = localStorage.getItem(USED_STORAGE_KEY); if (!raw) return {}; const parsed = JSON.parse(raw); return parsed && typeof parsed === "object" ? parsed : {}; }
  catch { return {}; }
}
function saveUsedHistory() { localStorage.setItem(USED_STORAGE_KEY, JSON.stringify(state.usedHistory)); }
function loadTeamNames() {
  state.teamNames = { 1: "الفريق الأول", 2: "الفريق الثاني", 3: "الفريق الثالث" };
  try {
    const raw = localStorage.getItem(TEAM_NAMES_STORAGE_KEY);
    if (!raw) { saveTeamNames(); return; }
    const parsed = JSON.parse(raw);
    const team1 = normalizeCell(parsed?.[1] ?? parsed?.team1);
    const team2 = normalizeCell(parsed?.[2] ?? parsed?.team2);
    const team3 = normalizeCell(parsed?.[3] ?? parsed?.team3);
    if (team1) state.teamNames[1] = team1;
    if (team2) state.teamNames[2] = team2;
    if (team3) state.teamNames[3] = team3;
  } catch { saveTeamNames(); }
}
function saveTeamNames() { localStorage.setItem(TEAM_NAMES_STORAGE_KEY, JSON.stringify(state.teamNames)); }


function clearLocalProgress() {
  try {
    sessionStorage.removeItem(LOCAL_PROGRESS_STORAGE_KEY);
  } catch (_) {
    // Ignore storage errors silently.
  }
}

function persistLocalProgress() {
  if (online.mode !== "local") {
    clearLocalProgress();
    return;
  }
  const hasBoard = state.boardTiles.length > 0 && state.selectedCategories.length === getRequiredCategoryCount();
  if (!hasBoard) return;

  const payload = {
    mode: "local",
    screen: el.gameScreen?.style.display === "block" ? "game" : "start",
    selectedCategories: [...state.selectedCategories],
    pointLevels: [...state.pointLevels],
    boardTiles: state.boardTiles,
    teamCount: state.teamCount,
    teamNames: { ...state.teamNames },
    scores: { ...state.scores },
    usedQuestionIds: state.boardTiles.filter((tile) => tile.used && tile.questionId).map((tile) => tile.questionId),
    currentTeam: state.currentTeam,
    mcqHelpUsed: { ...mcqHelpUsed },
    hintHelpUsed: { ...hintHelpUsed },
    activeTileId: state.activeTile?.id || null,
    activeQuestionId: state.activeQuestion?.id || state.activeTile?.questionId || null,
    activeCategory: state.activeTile?.category || null,
    modalOpen: !el.modal?.classList.contains("hidden") && !!state.activeTile,
    questionDeadlineTs: state.activeTile && questionDeadlineTs ? questionDeadlineTs : null,
    questionStartedAt: state.activeTile && timerStart ? timerStart : null,
    lastSavedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(LOCAL_PROGRESS_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // Ignore storage errors silently.
  }
}

function restoreLocalProgress() {
  if (new URL(window.location.href).searchParams.get("room")) return false;
  try {
    const raw = sessionStorage.getItem(LOCAL_PROGRESS_STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || saved.mode !== "local" || saved.screen !== "game") return false;
    if (!Array.isArray(saved.selectedCategories) || saved.selectedCategories.length !== getRequiredCategoryCount()) return false;
    if (!Array.isArray(saved.boardTiles) || saved.boardTiles.length === 0) return false;

    state.selectedCategories = [...saved.selectedCategories];
    state.pointLevels = Array.isArray(saved.pointLevels) && saved.pointLevels.length ? [...saved.pointLevels] : [...POINT_LEVELS];
    state.boardTiles = [...saved.boardTiles];
    setLocalTeamCount(saved.teamCount);
    state.teamNames = {
      1: normalizeCell(saved.teamNames?.[1]) || "الفريق الأول",
      2: normalizeCell(saved.teamNames?.[2]) || "الفريق الثاني",
      3: normalizeCell(saved.teamNames?.[3]) || "الفريق الثالث",
    };
    state.scores = {
      1: Math.max(0, Number(saved.scores?.[1]) || 0),
      2: Math.max(0, Number(saved.scores?.[2]) || 0),
      3: Math.max(0, Number(saved.scores?.[3]) || 0),
    };
    state.displayedScores = { ...state.scores };
    state.currentTeam = getActiveTeamNumbers().includes(Number(saved.currentTeam)) ? Number(saved.currentTeam) : 1;
    mcqHelpUsed = {
      1: !!saved.mcqHelpUsed?.[1],
      2: !!saved.mcqHelpUsed?.[2],
      3: !!saved.mcqHelpUsed?.[3],
    };
    hintHelpUsed = {
      1: !!saved.hintHelpUsed?.[1],
      2: !!saved.hintHelpUsed?.[2],
      3: !!saved.hintHelpUsed?.[3],
    };
    state.activeQuestion = null;

    el.startScreen.style.display = "none";
    el.gameScreen.style.display = "block";
    updateTeamModeUI();
    syncTeamNameInputs();
    updateScoreboard();
    renderBoard();

    const savedActiveId = normalizeCell(saved.activeTileId);
    if (saved.modalOpen && savedActiveId) {
      const restoredDeadline = Number(saved.questionDeadlineTs);
      const restoredStart = Number(saved.questionStartedAt);
      const fallbackDeadline = Number.isFinite(restoredStart)
        ? restoredStart + QUESTION_TIMEOUT_MS
        : null;
      openQuestion(savedActiveId, {
        restored: true,
        deadlineTs: Number.isFinite(restoredDeadline) ? restoredDeadline : fallbackDeadline,
        questionId: saved.activeQuestionId,
      });
    }

    return true;
  } catch (_) {
    return false;
  }
}
function ensureBucket(category, points) {
  if (!state.usedHistory[category]) state.usedHistory[category] = {};
  const key = String(points);
  if (!Array.isArray(state.usedHistory[category][key])) state.usedHistory[category][key] = [];
  return state.usedHistory[category][key];
}
function markQuestionAsUsed(category, points, questionId) {
  if (!questionId) return;
  const bucket = ensureBucket(category, points);
  if (!bucket.includes(questionId)) { bucket.push(questionId); saveUsedHistory(); }
}
function clearUsedBucket(category, points) {
  if (!state.usedHistory[category]) return;
  state.usedHistory[category][String(points)] = [];
  saveUsedHistory();
}
function getAssignedQuestionIds() {
  return state.boardTiles
    .map((tile) => normalizeCell(tile.questionId))
    .filter(Boolean);
}
function getExcludedQuestionIds(category, points) {
  const acrossGames = ensureBucket(category, points);
  const inCurrentGame = state.boardTiles
    .filter((tile) => tile.category === category && tile.points === points)
    .map((tile) => normalizeCell(tile.questionId))
    .filter(Boolean);
  return uniqueByText([...acrossGames, ...inCurrentGame]);
}
async function fetchQuestionPayload({ id = "", category = "", points = null, resetUsedBucketOnExhaustion = false } = {}) {
  const normalizedId = normalizeCell(id);
  if (normalizedId && questionBankCache.questionsById.has(normalizedId)) {
    return questionBankCache.questionsById.get(normalizedId);
  }

  const normalizedCategory = normalizeCell(category);
  const normalizedPoints = Number(points) || null;
  const excludeIds = normalizedId ? [] : getExcludedQuestionIds(normalizedCategory, normalizedPoints);

  try {
    const response = await apiFetchJson("/question", {
      params: normalizedId
        ? { id: normalizedId }
        : {
          category: normalizedCategory,
          points: normalizedPoints,
          exclude_ids: excludeIds.join(","),
        },
    });
    if (!response?.question) return null;
    const question = response.question;
    questionBankCache.questionsById.set(question.id, question);
    return question;
  } catch (error) {
    const isExhaustedPool = error?.status === 404 && error?.payload?.code === "QUESTION_POOL_EXHAUSTED";
    if (!normalizedId && isExhaustedPool && !resetUsedBucketOnExhaustion) {
      clearUsedBucket(normalizedCategory, normalizedPoints);
      return fetchQuestionPayload({
        category: normalizedCategory,
        points: normalizedPoints,
        resetUsedBucketOnExhaustion: true,
      });
    }
    if (!normalizedId && error?.status === 404) return null;
    throw error;
  }
}
async function fetchAnswerPayload(questionId, submittedAnswer = "") {
  const normalizedId = normalizeCell(questionId);
  if (!normalizedId) throw new Error("معرّف السؤال غير صالح.");
  const cacheKey = submittedAnswer ? `${normalizedId}::${submittedAnswer}` : normalizedId;
  if (!submittedAnswer && questionBankCache.answersById.has(cacheKey)) {
    return questionBankCache.answersById.get(cacheKey);
  }

  const response = await apiFetchJson("/validate-answer", {
    method: "POST",
    body: {
      questionId: normalizedId,
      submittedAnswer: normalizeCell(submittedAnswer) || undefined,
    },
  });

  if (!submittedAnswer) {
    questionBankCache.answersById.set(cacheKey, response);
  }
  return response;
}

async function fetchQuestions() {
  const response = await apiFetchJson("/categories");
  return Array.isArray(response.categories) ? response.categories.map(normalizeCell).filter(Boolean) : [];
}

async function preloadQuestionBank() {
  if (questionBankCache.categories) {
    return { categories: questionBankCache.categories };
  }

  if (questionBankCache.loadPromise) return questionBankCache.loadPromise;

  questionBankCache.loadPromise = (async () => {
    const categories = await fetchQuestions();
    if (categories.length === 0) throw new Error("لا توجد فئات صالحة في مصدر الأسئلة.");
    if (categories.length < DEFAULT_CATEGORIES_TO_SELECT) throw new Error(`يلزم وجود ${DEFAULT_CATEGORIES_TO_SELECT} فئات مختلفة على الأقل في ملف CSV.`);

    questionBankCache.categories = categories;
    return { categories };
  })();

  try {
    return await questionBankCache.loadPromise;
  } catch (error) {
    questionBankCache.categories = null;
    throw error;
  } finally {
    questionBankCache.loadPromise = null;
  }
}
async function ensureQuestionBankStateLoaded() {
  const { categories } = await preloadQuestionBank();
  state.allCategories = categories;
  if (!Array.isArray(state.pointLevels) || state.pointLevels.length === 0) {
    state.pointLevels = [...POINT_LEVELS];
  }
  if (!state.usedHistory || typeof state.usedHistory !== "object" || Array.isArray(state.usedHistory)) {
    state.usedHistory = loadUsedHistory();
  }
  if (!el.categoryModal.classList.contains("hidden")) {
    renderCategoryOptions();
  }
  return { categories };
}
function getUniqueCategories(questions) {
  const unique = [];
  questions.forEach((q) => { if (!unique.includes(q.category)) unique.push(q.category); });
  return unique;
}
function buildBoardAssignment() {
  state.assignedQuestionIds = new Set();
  const tiles = [];
  state.selectedCategories.forEach((category) => {
    state.pointLevels.forEach((points) => {
      tiles.push({
        id: `${category}-${points}`,
        category,
        points,
        questionId: null,
        used: false,
        missing: false,
        timedOut: false,
      });
    });
  });
  state.boardTiles = tiles;
}

function animateScoreValue(team, target) {
  const scoreByTeam = { 1: el.team1Score, 2: el.team2Score, 3: el.team3Score };
  const scoreEl = scoreByTeam[team];
  if (!scoreEl) return;
  const start = Number(state.displayedScores[team] ?? 0);
  if (prefersReducedMotion || start === target) { state.displayedScores[team] = target; scoreEl.textContent = String(target); return; }
  const duration = 420; const startAt = performance.now();
  function step(now) {
    const progress = Math.min((now - startAt) / duration, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    const value = Math.round(start + (target - start) * eased);
    scoreEl.textContent = String(value);
    if (progress < 1) requestAnimationFrame(step);
    else { state.displayedScores[team] = target; scoreEl.classList.remove("score-pop"); void scoreEl.offsetWidth; scoreEl.classList.add("score-pop"); }
  }
  requestAnimationFrame(step);
}
function updateScoreboard() {
  getActiveTeamNumbers().forEach((team) => animateScoreValue(team, state.scores[team]));
  el.currentTurn.textContent = state.teamNames[state.currentTeam];
  el.team1Card.classList.toggle("active", state.currentTeam === 1);
  el.team2Card.classList.toggle("active", state.currentTeam === 2);
  el.team3Card.classList.toggle("active", state.currentTeam === 3);
}
function syncTeamNameInputs() {
  el.team1NameInput.value = state.teamNames[1];
  el.team2NameInput.value = state.teamNames[2];
  el.team3NameInput.value = state.teamNames[3];
  el.categoryTeam1NameInput.value = state.teamNames[1];
  el.categoryTeam2NameInput.value = state.teamNames[2];
  el.categoryTeam3NameInput.value = state.teamNames[3];
}
function setTeamName(team, value, { commit = false } = {}) {
  const fallbackByTeam = { 1: "الفريق الأول", 2: "الفريق الثاني", 3: "الفريق الثالث" };
  const fallback = fallbackByTeam[team] || "الفريق";
  state.teamNames[team] = commit ? normalizeCell(value) || fallback : String(value ?? "");
  if (commit) syncTeamNameInputs();
  saveTeamNames();
  updateScoreboard();
  persistLocalProgress();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}
function setTeamNamesFromCategoryModal() {
  const fallbackByTeam = { 1: "الفريق الأول", 2: "الفريق الثاني", 3: "الفريق الثالث" };
  const namesByTeam = {
    1: normalizeCell(el.categoryTeam1NameInput.value) || fallbackByTeam[1],
    2: normalizeCell(el.categoryTeam2NameInput.value) || fallbackByTeam[2],
    3: normalizeCell(el.categoryTeam3NameInput.value) || fallbackByTeam[3],
  };

  getActiveTeamNumbers().forEach((team) => {
    state.teamNames[team] = namesByTeam[team];
  });

  syncTeamNameInputs();
  saveTeamNames();
  updateScoreboard();
  persistLocalProgress();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function hasPlayableTiles() { return state.boardTiles.some((tile) => !tile.used && !tile.missing); }
function closePodiumModal() { el.podiumModal.classList.add("hidden"); el.podiumModal.classList.remove("is-open"); }
function buildPodiumColumn(name, score, label, placeClass) {
  return `<div class="podium-column ${placeClass}"><p class="podium-label">${label}</p><p class="podium-team-name">${name}</p><p class="podium-score">${score}</p><div class="podium-step"></div></div>`;
}
function buildFinalResultSnapshot() {
  const activeTeams = getActiveTeamNumbers();
  const rankedTeams = [...activeTeams].sort((a, b) => state.scores[b] - state.scores[a]);
  const bestScore = rankedTeams.length ? state.scores[rankedTeams[0]] : 0;
  const winners = rankedTeams.filter((team) => state.scores[team] === bestScore);
  const winnerNames = winners.map((team) => state.teamNames[team]);
  const scoreLine = rankedTeams
    .map((team) => `${state.teamNames[team]}: ${state.scores[team]} نقطة`)
    .join(" | ");
  return {
    winners,
    winnerNames,
    bestScore,
    scoreLine,
    rankedTeams,
  };
}
function buildArabicShareMessage() {
  const result = buildFinalResultSnapshot();
  const hasTie = result.winners.length > 1;
  const winnerLine = hasTie
    ? `🤝 انتهت المباراة بتعادل بين: ${result.winnerNames.join(" و ")} (${result.bestScore} نقطة)`
    : `🏆 المتصدر: ${result.winnerNames[0]} (${result.bestScore} نقطة)`;
  return [
    "أنهيت لعبة في تسلية!",
    winnerLine,
    `📊 النتيجة النهائية: ${result.scoreLine}`,
    "هل تقدر تغلبني؟",
    "العب الآن: https://tasleya.online",
  ].join("\n");
}
function setResultShareFeedback(message, type = "neutral") {
  if (!el.resultShareFeedback) return;
  const hasMessage = !!normalizeCell(message);
  el.resultShareFeedback.textContent = hasMessage ? message : "";
  el.resultShareFeedback.classList.toggle("hidden", !hasMessage);
  el.resultShareFeedback.classList.toggle("is-error", hasMessage && type === "error");
  el.resultShareFeedback.classList.toggle("is-success", hasMessage && type === "success");
}
function updateResultShareUI() {
  if (!el.resultShareSummary || !el.resultShareSection) return;
  const result = buildFinalResultSnapshot();
  const winnerText = result.winnerNames.length > 1
    ? `تعادل القمة: ${result.winnerNames.join(" و ")}`
    : `المتصدر: ${result.winnerNames[0]}`;
  el.resultShareSummary.innerHTML = `
    <p class="result-share-summary-title">${winnerText}</p>
    <p class="result-share-summary-score">${result.bestScore} نقطة</p>
    <p class="result-share-summary-line">${result.scoreLine}</p>
  `;
  el.resultShareSection.classList.remove("hidden");
  setResultShareFeedback("");
}
async function copyResultShareText() {
  const shareText = buildArabicShareMessage();
  try {
    await navigator.clipboard.writeText(shareText);
    setResultShareFeedback("تم نسخ النص. شاركه مع التحدي 🔥", "success");
    return true;
  } catch (_) {
    setResultShareFeedback("تعذّر النسخ تلقائيًا. انسخ النص يدويًا.", "error");
    return false;
  }
}
function openWhatsappShare() {
  const shareText = buildArabicShareMessage();
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  if (!popup) {
    setResultShareFeedback("تعذّر فتح واتساب تلقائيًا. جرّب نسخ النص.", "error");
    return false;
  }
  setResultShareFeedback("تم فتح واتساب للمشاركة.", "success");
  return true;
}
async function handlePrimaryShare() {
  const shareText = buildArabicShareMessage();
  const canUseNativeShare = typeof navigator.share === "function";
  if (canUseNativeShare) {
    try {
      await navigator.share({
        title: "نتيجتي في تسلية",
        text: shareText,
        url: "https://tasleya.online",
      });
      setResultShareFeedback("تمت المشاركة بنجاح 👏", "success");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  if (openWhatsappShare()) return;
  await copyResultShareText();
}
function showPodiumModal() {
  const activeTeams = getActiveTeamNumbers();
  const rankedTeams = [...activeTeams].sort((a, b) => state.scores[b] - state.scores[a]);
  if (state.teamCount === 1) {
    el.podiumTitle.textContent = "نهاية اللعبة";
    el.podiumSubtitle.textContent = "نتيجة فريق واحد";
    el.podiumBoard.innerHTML = buildPodiumColumn(state.teamNames[1], state.scores[1], "النتيجة النهائية", "winner");
  } else if (state.teamCount === 3) {
    el.podiumTitle.textContent = "نهاية اللعبة";
    el.podiumSubtitle.textContent = "النتائج النهائية";
    el.podiumBoard.innerHTML = rankedTeams.map((team, index) => {
      const labels = ["المركز الأول", "المركز الثاني", "المركز الثالث"];
      const classes = ["winner", "tie", "loser"];
      return buildPodiumColumn(state.teamNames[team], state.scores[team], labels[index], classes[index]);
    }).join("");
  } else {
    const score1 = state.scores[1], score2 = state.scores[2], team1 = state.teamNames[1], team2 = state.teamNames[2];
    if (score1 === score2) {
    el.podiumTitle.textContent = "تعادل!";
    el.podiumSubtitle.textContent = "منافسة قوية.. استمروا";
    el.podiumBoard.innerHTML = buildPodiumColumn(team1, score1, "نتيجة الفريق", "tie") + buildPodiumColumn(team2, score2, "نتيجة الفريق", "tie");
    } else {
      const winnerTeam = score1 > score2 ? 1 : 2; const loserTeam = winnerTeam === 1 ? 2 : 1;
      el.podiumTitle.textContent = "نهاية اللعبة";
      el.podiumSubtitle.textContent = "النتائج النهائية";
      el.podiumBoard.innerHTML =
        buildPodiumColumn(state.teamNames[winnerTeam], state.scores[winnerTeam], "سعادة الباشا", "winner") +
        buildPodiumColumn(state.teamNames[loserTeam], state.scores[loserTeam], "إشتغل علي نفسك", "loser");
    }
  }
  updateResultShareUI();
  el.podiumModal.classList.remove("hidden");
  requestAnimationFrame(() => el.podiumModal.classList.add("is-open"));
}
function checkEndOfGame() {
  if (state.boardTiles.length > 0 && !hasPlayableTiles()) {
    logAnalyticsEvent("game_finished", {
      mode: online.mode,
      team1_score: state.scores[1],
      team2_score: state.scores[2],
      team3_score: state.teamCount === 3 ? state.scores[3] : 0,
      teams_count: state.teamCount,
    });
    showPodiumModal();
    if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
  }
}

function renderBoard() {
  if (state.dataLoadFailed || state.selectedCategories.length !== getRequiredCategoryCount() || state.pointLevels.length === 0) {
    el.board.innerHTML = "";
    el.board.style.removeProperty("--board-columns");
    return;
  }
  el.board.innerHTML = "";
  el.board.style.setProperty("--board-columns", String(state.selectedCategories.length));
  const tileByCategoryPoints = new Map(state.boardTiles.map((tile) => [`${tile.category}::${tile.points}`, tile]));
  state.selectedCategories.forEach((category) => {
    const header = document.createElement("div"); header.className = "board-cell category"; header.textContent = category; el.board.appendChild(header);
  });
  state.pointLevels.forEach((points) => {
    state.selectedCategories.forEach((category) => {
      const tile = tileByCategoryPoints.get(`${category}::${points}`);
      if (!tile) return;
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "board-cell tile"; btn.dataset.tileId = tile.id; btn.setAttribute("aria-label", `${category} ${points}`);
      if (tile.missing) { btn.textContent = "نقص أسئلة"; btn.disabled = true; btn.classList.add("missing", "used"); }
      else if (tile.used) { btn.textContent = ""; btn.disabled = true; btn.classList.add("used"); }
      else { btn.textContent = String(points); btn.disabled = false; }
      el.board.appendChild(btn);
    });
  });
}

function animateTileSelection(tileButton) {
  if (!tileButton || prefersReducedMotion) return;
  tileButton.classList.remove("tile-pulse");
  void tileButton.offsetWidth;
  tileButton.classList.add("tile-pulse");
}

function getActiveQuestion() { return state.activeQuestion || null; }
function getBasePath() { return window.location.pathname.includes("/Tasleya/") ? "/Tasleya/" : "/"; }
function toMediaUrl(mediaPath) {
  const normalized = normalizeCell(mediaPath);
  if (!normalized) return "";
  if (/^(?:https?:)?\/\//i.test(normalized) || normalized.startsWith("data:")) return encodeURI(normalized);
  const cleanedPath = normalized.replace(/^\.\//, "").replace(/^\//, "");
  return encodeURI(`${getBasePath()}${cleanedPath}`);
}
function ensureMediaOriginPreconnect(mediaUrl) {
  const normalizedUrl = normalizeCell(mediaUrl);
  if (!normalizedUrl) return;
  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl, window.location.origin);
  } catch (_) {
    return;
  }
  const origin = parsedUrl.origin;
  if (!origin || origin === "null" || mediaWarmupCache.preconnectedOrigins.has(origin)) return;
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = origin;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
  mediaWarmupCache.preconnectedOrigins.add(origin);
}
function warmImageResource(mediaUrl, { highPriority = false } = {}) {
  const normalizedUrl = normalizeCell(mediaUrl);
  if (!normalizedUrl) return;
  ensureMediaOriginPreconnect(normalizedUrl);
  if (mediaWarmupCache.images.has(normalizedUrl)) return;
  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = highPriority ? "high" : "auto";
  image.src = normalizedUrl;
  mediaWarmupCache.images.set(normalizedUrl, image);
}
function warmQuestionMedia(question, { highPriority = false } = {}) {
  if (!question) return;
  const mediaUrl = toMediaUrl(question.image_url);
  if (!mediaUrl) return;
  if (question.type === "image") warmImageResource(mediaUrl, { highPriority });
}
function preloadLikelyNextQuestionMedia() {
  const nextTile = state.boardTiles.find((tile) => !tile.used && !tile.missing && normalizeCell(tile.questionId));
  if (!nextTile) return;
  const candidate = questionBankCache.questionsById.get(nextTile.questionId);
  if (!candidate) return;
  warmQuestionMedia(candidate, { highPriority: false });
}
function clearQuestionMedia() {
  const currentAudio = el.questionMedia.querySelector("audio");
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
  el.questionMedia.classList.remove("map-question-media");
  el.questionMedia.innerHTML = "";
}
function renderQuestionContent(question) {
  el.questionText.textContent = question.question;
  el.answerText.textContent = "الإجابة: ...";
  el.answerText.classList.add("hidden");
  state.answerRevealed = false;
  state.revealRequested = false;
  el.choicesBox.classList.add("hidden");
  el.choicesList.innerHTML = "";
  state.currentChoices = [];
  state.currentHintText = "";
  el.hintText.textContent = "";
  el.hintBox.classList.add("hidden");
  showQuestionStatus("");
  updateLateOtherTeamPrompt();
  if (question.type === "image" && question.image_url) renderQuestionImage(question.image_url, question);
  if (question.type === "audio" && question.image_url) renderQuestionAudio(question.image_url);
  el.lifelineBtn.disabled = mcqHelpUsed[state.currentTeam] || (online.mode === "online" && !canCurrentClientAct());
  el.hintLifelineBtn.disabled = hintHelpUsed[state.currentTeam] || (online.mode === "online" && !canCurrentClientAct());
  updateQuestionActionLock();
}

function renderQuestionImage(imagePath, question = null) {
  const imageSrc = toMediaUrl(imagePath); if (!imageSrc) return;
  const image = document.createElement("img");
  image.id = "questionImage";
  image.alt = "صورة السؤال";
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = "high";
  if (normalizeCell(question?.category) === MAP_QUESTION_CATEGORY) {
    el.questionMedia.classList.add("map-question-media");
    image.classList.add("map-question-image");
  }
  image.src = imageSrc;
  el.questionMedia.appendChild(image);

}
function renderQuestionAudio(audioPath) {
  const audioSrc = toMediaUrl(audioPath); if (!audioSrc) return;
  const audio = document.createElement("audio"); audio.id = "questionAudio"; audio.controls = true; audio.preload = "metadata"; audio.setAttribute("aria-label", "مشغل صوت السؤال");
  audio.innerHTML = `<source src="${audioSrc}" type="audio/mpeg">`; el.questionMedia.appendChild(audio);
}

function getMyTeamNumber() {
  return getMyControlledTeams()[0] || 1;
}
function resolveOnlineTeamSlot() {
  if (online.mode !== "online") return null;
  const participantSlots = online.participantSlots && typeof online.participantSlots === "object"
    ? online.participantSlots
    : buildEmptyParticipantSlots();
  const participantRecords = online.participantRecords && typeof online.participantRecords === "object"
    ? online.participantRecords
    : buildEmptyParticipantRecords();

  for (let slot = 1; slot <= 3; slot += 1) {
    if (normalizeCell(participantSlots[slot]) === online.clientId) return slot;
  }
  for (let slot = 1; slot <= 3; slot += 1) {
    if (normalizeCell(participantRecords[slot]?.clientId) === online.clientId) return slot;
  }
  return Number(online.resolvedTeamSlot || online.teamSlot) || null;
}
function getMyControlledTeams() {
  if (online.mode !== "online") return [state.currentTeam];
  return [resolveOnlineTeamSlot() || 1];
}
function canCurrentClientAct() {
  if (online.mode !== "online") return true;
  const controlledTeams = getMyControlledTeams();
  const currentTurnTeam = Number(online.currentTurnTeam || state.currentTeam) || 1;
  return controlledTeams.includes(currentTurnTeam);
}

async function openQuestion(tileId, { restored = false, deadlineTs = null, questionId = "" } = {}) {
  if (online.mode === "online" && !canCurrentClientAct()) return;
  if (hasUnresolvedActiveQuestion()) return;
  stopAndResetTimer(); clearQuestionMedia();
  const tile = state.boardTiles.find((t) => t.id === tileId);
  if (!tile || tile.used || tile.missing) return;
  state.activeTile = tile;
  state.revealRequested = false;
  tile.timedOut = false;
  el.modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    el.modal.classList.remove("is-closing");
    el.modal.classList.add("is-open");
  });
  el.questionText.textContent = "جارٍ تحميل السؤال...";
  el.answerText.textContent = "الإجابة: ...";
  el.answerText.classList.add("hidden");
  showQuestionStatus("");
  el.choicesBox.classList.add("hidden");
  el.hintBox.classList.add("hidden");
  el.lifelineBtn.disabled = true;
  el.hintLifelineBtn.disabled = true;
  el.revealBtn.disabled = true;
  el.correctBtn.disabled = true;
  el.wrongBtn.disabled = true;
  el.otherTeamBtn.disabled = true;
  updateCloseButtonLock();
  try {
    const q = await fetchQuestionPayload({
      id: questionId || tile.questionId,
      category: tile.category,
      points: tile.points,
    });
    if (!q) {
      tile.missing = true;
      state.activeTile = null;
      state.activeQuestion = null;
      renderBoard();
      persistLocalProgress();
      showError("لا يوجد سؤال متاح لهذه الخانة حالياً.");
      return;
    }
    tile.questionId = q.id;
    state.activeQuestion = q;
    warmQuestionMedia(q, { highPriority: true });
    preloadLikelyNextQuestionMedia();
    clearError();
    console.log("[Tasleya] Opening question", { id: q.id, type: q.type, hint: q.hint });
    renderQuestionContent(q);
  } catch (error) {
    closeModal({ silentSync: true, force: true });
    state.activeTile = null;
    state.activeQuestion = null;
    showError(`تعذّر تحميل السؤال. ${error instanceof Error ? error.message : "خطأ غير متوقع"}`);
    return;
  }
  const safeDeadline = Number(deadlineTs);
  const restoreDeadline = Number.isFinite(safeDeadline) ? safeDeadline : null;
  if (restored && restoreDeadline && restoreDeadline <= Date.now()) {
    showQuestionStatus("انتهى الوقت");
    startTimer({ deadlineTs: Date.now() + 10 });
    handleQuestionTimeout();
  } else {
    startTimer({ deadlineTs: restored ? restoreDeadline : null });
  }
  persistLocalProgress();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function closeModal({ silentSync = false, force = false } = {}) {
  if (!force && shouldLockQuestionClose()) {
    updateCloseButtonLock();
    return false;
  }
  stopAndResetTimer(); clearQuestionMedia();
  state.revealRequested = false;
  state.currentHintText = "";
  el.hintText.textContent = "";
  el.hintBox.classList.add("hidden");
  showQuestionStatus("");
  updateLateOtherTeamPrompt();
  if (el.modal.classList.contains("hidden")) { state.activeTile = null; state.activeQuestion = null; return; }
  if (prefersReducedMotion) {
    el.modal.classList.add("hidden"); el.modal.classList.remove("is-open", "is-closing"); state.activeTile = null; state.activeQuestion = null;
  } else {
    el.modal.classList.remove("is-open"); el.modal.classList.add("is-closing");
    const onEnd = () => { el.modal.classList.add("hidden"); el.modal.classList.remove("is-closing"); state.activeTile = null; state.activeQuestion = null; el.modal.removeEventListener("animationend", onEnd, true); };
    el.modal.addEventListener("animationend", onEnd, true);
  }
  updateCloseButtonLock();
  persistLocalProgress();
  if (online.mode === "online" && !online.applyingRemote && !silentSync) pushOnlineState();
  return true;
}

function resetGameState() {
  state.selectedCategories = [];
  state.boardTiles = [];
  state.pointLevels = [...POINT_LEVELS];
  state.assignedQuestionIds = new Set();
  state.scores = { 1: 0, 2: 0, 3: 0 };
  state.displayedScores = { 1: 0, 2: 0, 3: 0 };
  state.currentTeam = 1;
  mcqHelpUsed = { 1: false, 2: false, 3: false };
  hintHelpUsed = { 1: false, 2: false, 3: false };
  state.activeTile = null;
  state.activeQuestion = null;
  state.answerRevealed = false;
  state.revealRequested = false;
  state.currentChoices = [];
  state.currentHintText = "";
  closeModal({ silentSync: true });
  closeCategoryPicker();
  closePodiumModal();
  clearError();
  updateScoreboard();
  renderBoard();
}

async function revealAnswer() {
  const question = getActiveQuestion();
  if (!question || state.answerRevealed || state.activeTile?.timedOut || (online.mode === "online" && !canCurrentClientAct())) return;
  state.revealRequested = true;
  stopTimerWarningSound();
  el.revealBtn.disabled = true;
  showQuestionStatus("جارٍ إظهار الإجابة...");
  try {
    const response = await fetchAnswerPayload(question.id);
    el.answerText.textContent = `الإجابة: ${response.correctAnswer || "غير متاحة"}`;
    el.answerText.classList.remove("hidden");
    state.answerRevealed = true;
    showQuestionStatus("");
    updateQuestionActionLock();
    if (!prefersReducedMotion) { el.answerText.classList.remove("reveal-anim"); void el.answerText.offsetWidth; el.answerText.classList.add("reveal-anim"); }
    if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
  } catch (error) {
    showQuestionStatus("");
    el.revealBtn.disabled = false;
    showError(`تعذّر إظهار الإجابة. ${error instanceof Error ? error.message : "خطأ غير متوقع"}`);
  }
}
function uniqueByText(items) { const seen = new Set(); return items.filter((item) => { const key = item.trim(); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
function generateChoices(question) {
  const workerChoices = Array.isArray(question?.choices) ? uniqueByText(question.choices.map(normalizeCell).filter(Boolean)) : [];
  if (workerChoices.length >= 4) return workerChoices.slice(0, 4);
  const fallback = [...workerChoices];
  while (fallback.length < 4) fallback.push(`خيار ${fallback.length + 1}`);
  return fallback.slice(0, 4);
}
function useLifeline() {
  const question = getActiveQuestion(); const currentTeam = state.currentTeam;
  if (!question || state.activeTile?.timedOut || mcqHelpUsed[currentTeam] || (online.mode === "online" && !canCurrentClientAct())) return;
  const options = generateChoices(question);
  el.choicesList.innerHTML = "";
  options.forEach((option) => { const div = document.createElement("div"); div.className = "choice-item"; div.textContent = option; el.choicesList.appendChild(div); });
  mcqHelpUsed[currentTeam] = true;
  state.currentChoices = options;
  el.lifelineBtn.disabled = true;
  el.choicesBox.classList.remove("hidden");
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}


function useHintLifeline() {
  const question = getActiveQuestion(); const currentTeam = state.currentTeam;
  if (!question || state.activeTile?.timedOut || hintHelpUsed[currentTeam] || (online.mode === "online" && !canCurrentClientAct())) return;
  const hintText = firstNonEmpty(question.hint, question["تلميح"]);
  if (!hintText) {
    state.currentHintText = "لا يوجد تلميح لهذا السؤال";
    el.hintText.textContent = state.currentHintText;
    el.hintBox.classList.remove("hidden");
    if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
    return;
  }
  hintHelpUsed[currentTeam] = true;
  logAnalyticsEvent("hint_used", {
    mode: online.mode,
    team: currentTeam,
    has_hint: true,
  });
  state.currentHintText = hintText;
  el.hintText.textContent = state.currentHintText;
  el.hintBox.classList.remove("hidden");
  el.hintLifelineBtn.disabled = true;
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function applyScore(isCorrect) {
  if (online.mode === "online" && !canCurrentClientAct()) return;
  if (!state.answerRevealed) return;
  const scoreDelta = isCorrect ? { [state.currentTeam]: state.activeTile?.points ?? 0 } : null;
  const resolved = resolveActiveQuestion({
    scoreDelta,
    nextTeam: getNextTeamNumber(state.currentTeam),
  });
  if (resolved) playOutcomeSound(isCorrect ? "correct" : "wrong");
}
function awardPointsToOtherTeam() {
  if (online.mode === "online" && !canCurrentClientAct()) return;
  if (!state.answerRevealed) return;
  const otherTeam = getNextTeamNumber(state.currentTeam);
  resolveActiveQuestion({
    preventTimeoutAction: true,
    scoreDelta: { [otherTeam]: state.activeTile?.points ?? 0 },
    nextTeam: otherTeam,
  });
}

function resolveActiveQuestion({ scoreDelta = null, nextTeam = null, timedOut = false, preventTimeoutAction = false } = {}) {
  const tile = state.activeTile;
  if (!tile || tile.used || !state.activeQuestion) return false;
  if (preventTimeoutAction && tile.timedOut) return false;

  if (scoreDelta && typeof scoreDelta === "object") {
    Object.entries(scoreDelta).forEach(([team, points]) => {
      const teamNumber = Number(team);
      if (!getActiveTeamNumbers().includes(teamNumber)) return;
      const safePoints = Number(points) || 0;
      state.scores[teamNumber] += safePoints;
    });
  }

  if (timedOut) {
    tile.timedOut = true;
  }
  tile.used = true;
  if (tile.questionId) markQuestionAsUsed(tile.category, tile.points, tile.questionId);
  getActiveTeamNumbers().forEach((team) => {
    state.scores[team] = Math.max(0, state.scores[team]);
  });

  if (getActiveTeamNumbers().includes(nextTeam)) {
    state.currentTeam = nextTeam;
  }

  updateScoreboard();
  renderBoard();
  closeModal({ silentSync: true });
  persistLocalProgress();
  checkEndOfGame();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
  return true;
}

function updateCategoryPickerUI() {
  const hostOnlyBlocked = online.mode === "online" && online.role !== "host";
  const requiredCategories = getRequiredCategoryCount();
  el.categoryModal.classList.toggle("is-readonly", hostOnlyBlocked);
  if (el.categoryModalTitle) el.categoryModalTitle.textContent = getCategoryModalTitleText();
  el.categoryCounter.textContent = `المحدد: ${state.selectedCategories.length} / ${requiredCategories}`;
  el.startGameBtn.disabled = !hostOnlyBlocked && state.selectedCategories.length !== requiredCategories;
  el.startGameBtn.textContent = hostOnlyBlocked ? "بانتظار منشئ الغرفة" : "بدء اللعبة";
  if (el.randomCategoriesBtn) el.randomCategoriesBtn.textContent = `اختيار عشوائي (${requiredCategories})`;
  if (el.categoryHostOnlyNote) {
    el.categoryHostOnlyNote.classList.toggle("hidden", !hostOnlyBlocked);
  }
  const checkedSet = new Set(state.selectedCategories); const reachedMax = checkedSet.size >= requiredCategories;
  el.categoryList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.checked = checkedSet.has(checkbox.value);
    checkbox.disabled = hostOnlyBlocked ? false : !checkbox.checked && reachedMax;
  });
}
function renderCategoryOptions() {
  if (el.categoryList.childElementCount > 0) {
    updateCategoryPickerUI();
    return;
  }
  el.categoryList.innerHTML = "";
  const groupedCategories = getGroupedCategoryDisplay(state.allCategories);
  groupedCategories.forEach(({ groupName, categories }) => {
    if (!categories.length) return;
    const header = document.createElement("h3");
    header.className = "category-group-title";
    header.textContent = groupName;
    el.categoryList.appendChild(header);

    categories.forEach((category) => {
      const label = document.createElement("label"); label.className = "category-option";
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = category;
      checkbox.addEventListener("click", (event) => {
        if (online.mode === "online" && online.role !== "host") {
          event.preventDefault();
          showHostOnlySetupMessage();
        }
      });
      checkbox.addEventListener("change", () => {
        if (online.mode === "online" && online.role !== "host") {
          checkbox.checked = state.selectedCategories.includes(category);
          showHostOnlySetupMessage();
          updateCategoryPickerUI();
          return;
        }
        if (checkbox.checked) { if (state.selectedCategories.length < getRequiredCategoryCount()) state.selectedCategories.push(category); }
        else state.selectedCategories = state.selectedCategories.filter((c) => c !== category);
        updateCategoryPickerUI();
        if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
      });
      const span = document.createElement("span"); span.textContent = category;
      label.appendChild(checkbox); label.appendChild(span); el.categoryList.appendChild(label);
    });
  });
  updateCategoryPickerUI();
}

function getGroupedCategoryDisplay(categories) {
  const grouped = CATEGORY_DISPLAY_GROUPS.map((group) => ({ groupName: group.name, categories: [] }));
  const indexByName = new Map(CATEGORY_DISPLAY_GROUPS.map((group, index) => [group.name, index]));
  const categoryToGroup = new Map();

  CATEGORY_DISPLAY_GROUPS.forEach((group) => {
    group.categories.forEach((category) => categoryToGroup.set(category, group.name));
  });

  categories.forEach((category) => {
    const targetGroupName = categoryToGroup.get(category) || DEFAULT_CATEGORY_GROUP;
    const groupIndex = indexByName.get(targetGroupName);
    if (groupIndex === undefined) return;
    grouped[groupIndex].categories.push(category);
  });

  return grouped;
}
function openCategoryPicker({ resetSelection = false } = {}) {
  if (resetSelection) state.selectedCategories = [];
  el.categoryTeam1NameInput.value = state.teamNames[1];
  el.categoryTeam2NameInput.value = state.teamNames[2];
  el.categoryTeam3NameInput.value = state.teamNames[3];
  updateTeamModeUI();
  renderCategoryOptions();
  const hostOnlyBlocked = online.mode === "online" && online.role !== "host";
  el.categoryModal.classList.toggle("is-readonly", hostOnlyBlocked);
  el.randomCategoriesBtn.disabled = false;
  el.randomCategoriesBtn.setAttribute("aria-disabled", String(hostOnlyBlocked));
  el.startGameBtn.setAttribute("aria-disabled", String(hostOnlyBlocked));
  el.categoryTeam1NameInput.readOnly = hostOnlyBlocked;
  el.categoryTeam2NameInput.readOnly = hostOnlyBlocked || state.teamCount === 1;
  el.categoryTeam3NameInput.readOnly = hostOnlyBlocked || state.teamCount !== 3;
  el.categoryTeam1NameInput.disabled = false;
  el.categoryTeam2NameInput.disabled = state.teamCount === 1;
  el.categoryTeam3NameInput.disabled = state.teamCount !== 3;
  el.categoryModal.classList.remove("hidden");
  requestAnimationFrame(() => { el.categoryModal.classList.remove("is-closing"); el.categoryModal.classList.add("is-open"); });
}
function closeCategoryPicker() {
  if (el.categoryModal.classList.contains("hidden")) return;
  if (prefersReducedMotion) { el.categoryModal.classList.add("hidden"); el.categoryModal.classList.remove("is-open", "is-closing"); return; }
  el.categoryModal.classList.remove("is-open"); el.categoryModal.classList.add("is-closing");
  const onEnd = () => { el.categoryModal.classList.add("hidden"); el.categoryModal.classList.remove("is-closing"); el.categoryModal.removeEventListener("animationend", onEnd, true); };
  el.categoryModal.addEventListener("animationend", onEnd, true);
}
function pickRandomCategories() {
  if (online.mode === "online" && online.role !== "host") {
    showHostOnlySetupMessage();
    updateCategoryPickerUI();
    return;
  }
  state.selectedCategories = shuffle(state.allCategories).slice(0, getRequiredCategoryCount());
  updateCategoryPickerUI();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function serializeGameState() {
  return {
    selectedCategories: state.selectedCategories,
    pointLevels: state.pointLevels,
    boardTiles: state.boardTiles,
    scores: state.scores,
    teamNames: state.teamNames,
    teamCount: state.teamCount,
    currentTeam: state.currentTeam,
    mcqHelpUsed,
    hintHelpUsed,
    activeTileId: state.activeTile?.id || null,
    activeQuestionId: state.activeQuestion?.id || state.activeTile?.questionId || null,
    modalOpen: !el.modal.classList.contains("hidden") && !!state.activeTile,
    answerRevealed: state.answerRevealed,
    currentChoices: state.currentChoices,
    currentHintText: state.currentHintText,
    questionStartedAt: state.activeTile && timerStart ? timerStart : null,
    questionDeadlineTs: state.activeTile && questionDeadlineTs ? questionDeadlineTs : null,
    finished: state.boardTiles.length > 0 && !hasPlayableTiles(),
  };
}

async function applyRemoteGameState(game) {
  if (!game) return;
  online.applyingRemote = true;
  try {
    state.selectedCategories = Array.isArray(game.selectedCategories) ? [...game.selectedCategories] : [];
    state.pointLevels = Array.isArray(game.pointLevels) ? [...game.pointLevels] : [...POINT_LEVELS];
    state.boardTiles = Array.isArray(game.boardTiles) ? [...game.boardTiles] : [];
    state.teamCount = normalizeTeamCount(game.teamCount);
    state.scores = {
      1: Number(game?.scores?.[1] ?? game?.scores?.team1 ?? 0) || 0,
      2: Number(game?.scores?.[2] ?? game?.scores?.team2 ?? 0) || 0,
      3: Number(game?.scores?.[3] ?? game?.scores?.team3 ?? 0) || 0,
    };
    state.teamNames = {
      1: normalizeCell(game?.teamNames?.[1] ?? game?.teamNames?.team1) || "الفريق الأول",
      2: normalizeCell(game?.teamNames?.[2] ?? game?.teamNames?.team2) || "الفريق الثاني",
      3: normalizeCell(game?.teamNames?.[3] ?? game?.teamNames?.team3) || "الفريق الثالث",
    };
    state.currentTeam = getActiveTeamNumbers().includes(Number(game.currentTeam)) ? Number(game.currentTeam) : 1;
    mcqHelpUsed = game.mcqHelpUsed || { 1: false, 2: false, 3: false };
    hintHelpUsed = game.hintHelpUsed || { 1: false, 2: false, 3: false };
    state.answerRevealed = !!game.answerRevealed;
    state.revealRequested = state.answerRevealed;
    state.currentChoices = Array.isArray(game.currentChoices) ? game.currentChoices : [];
    state.currentHintText = normalizeCell(game.currentHintText);
    state.activeQuestion = null;

    syncTeamNameInputs();
    updateTeamModeUI();
    updateScoreboard();
    renderBoard();

    const activeId = game.activeTileId;
    const shouldOpen = !!game.modalOpen && activeId;
    let syncedOpenModal = false;
    if (shouldOpen) {
      const tile = state.boardTiles.find((t) => t.id === activeId && !t.used);
      if (tile) {
        try {
          const remoteQuestion = await fetchQuestionPayload({
            id: game.activeQuestionId || tile.questionId,
            category: tile.category,
            points: tile.points,
          });
          if (remoteQuestion) {
            syncedOpenModal = true;
            state.activeTile = tile;
            tile.questionId = remoteQuestion.id;
            state.activeQuestion = remoteQuestion;
            clearQuestionMedia();
            renderQuestionContent(remoteQuestion);
            el.answerText.classList.toggle("hidden", !state.answerRevealed);
            if (state.answerRevealed) {
              const answerResponse = await fetchAnswerPayload(remoteQuestion.id);
              el.answerText.textContent = `الإجابة: ${answerResponse.correctAnswer || "غير متاحة"}`;
            }
            el.choicesList.innerHTML = "";
            if (state.currentChoices.length) {
              state.currentChoices.forEach((option) => {
                const div = document.createElement("div"); div.className = "choice-item"; div.textContent = option; el.choicesList.appendChild(div);
              });
              el.choicesBox.classList.remove("hidden");
            } else {
              el.choicesBox.classList.add("hidden");
            }
            if (state.currentHintText) {
              el.hintText.textContent = state.currentHintText;
              el.hintBox.classList.remove("hidden");
            } else {
              el.hintText.textContent = "";
              el.hintBox.classList.add("hidden");
            }
            const remoteTimedOut = !!tile.timedOut;
            showQuestionStatus(remoteTimedOut ? "انتهى الوقت" : "");
            el.lifelineBtn.disabled = remoteTimedOut || mcqHelpUsed[state.currentTeam] || !canCurrentClientAct();
            el.hintLifelineBtn.disabled = remoteTimedOut || hintHelpUsed[state.currentTeam] || !canCurrentClientAct();
            updateQuestionActionLock();
            el.modal.classList.remove("hidden");
            el.modal.classList.add("is-open");

            if (remoteTimedOut) {
              stopAndResetTimer();
              timerStart = Date.now() - QUESTION_TIMEOUT_MS;
              questionDeadlineTs = timerStart + QUESTION_TIMEOUT_MS;
              updateTimerUI();
            } else {
              const remoteDeadline = Number(game.questionDeadlineTs);
              if (Number.isFinite(remoteDeadline)) {
                startTimer({ deadlineTs: remoteDeadline });
              } else if (game.questionStartedAt) {
                const remoteStart = Number(game.questionStartedAt) || Date.now();
                startTimer({ deadlineTs: remoteStart + QUESTION_TIMEOUT_MS });
              } else {
                startTimer();
              }
            }
          }
        } catch (_) {
          syncedOpenModal = false;
        }
      }
    }

    if (!syncedOpenModal) {
      state.activeTile = null;
      state.activeQuestion = null;
      closeModal({ silentSync: true, force: true });
    }

    if (game.finished) showPodiumModal();
  } finally {
    online.applyingRemote = false;
  }
}
function applyRemoteSetupState(game) {
  if (!game) return;
  online.applyingRemote = true;
  try {
    state.selectedCategories = Array.isArray(game.selectedCategories) ? [...game.selectedCategories] : [];
    state.teamCount = normalizeTeamCount(game.teamCount);
    state.teamNames = {
      1: normalizeCell(game?.teamNames?.[1] ?? game?.teamNames?.team1) || "الفريق الأول",
      2: normalizeCell(game?.teamNames?.[2] ?? game?.teamNames?.team2) || "الفريق الثاني",
      3: normalizeCell(game?.teamNames?.[3] ?? game?.teamNames?.team3) || "الفريق الثالث",
    };
    syncTeamNameInputs();
    updateTeamModeUI();
    updateScoreboard();
    renderCategoryOptions();
    openCategoryPicker();
  } finally {
    online.applyingRemote = false;
  }
}

function buildJoinedGuestSetupPreview(room, records = {}) {
  const roomTeamCount = normalizeTeamCount(room?.teamCount);
  const fallbackNames = { 1: "الفريق الأول", 2: "الفريق الثاني", 3: "الفريق الثالث" };
  const nextTeamNames = {};

  for (let slot = 1; slot <= 3; slot += 1) {
    nextTeamNames[slot] = normalizeCell(room?.game?.teamNames?.[slot] ?? room?.game?.teamNames?.[`team${slot}`])
      || normalizeCell(records?.[slot]?.displayName)
      || normalizeCell(state.teamNames?.[slot])
      || fallbackNames[slot];
  }

  return {
    teamCount: roomTeamCount,
    teamNames: nextTeamNames,
    selectedCategories: Array.isArray(room?.game?.selectedCategories) ? [...room.game.selectedCategories] : [],
  };
}

function showJoinedGuestSetupPreview(room, records = {}) {
  if (online.mode !== "online" || online.role === "host" || room?.gameStarted) return;
  const setupPreview = buildJoinedGuestSetupPreview(room, records);
  online.applyingRemote = true;
  try {
    state.teamCount = setupPreview.teamCount;
    state.teamNames = setupPreview.teamNames;
    state.selectedCategories = setupPreview.selectedCategories;
    syncTeamNameInputs();
    updateTeamModeUI();
    updateScoreboard();
    renderCategoryOptions();
    openCategoryPicker();
  } finally {
    online.applyingRemote = false;
  }
}

function setOnlineStatus(text) { el.onlineStatusText.textContent = text; }
function updateRoomCodeTag() { el.onlineRoomCodeText.textContent = online.roomCode ? `الغرفة: ${online.roomCode}` : ""; }
function showHostOnlyStartMessage() {
  showError(HOST_ONLY_START_MESSAGE);
  setOnlineFeedback(HOST_ONLY_START_MESSAGE, "info");
}
function showHostOnlySetupMessage() {
  showError(HOST_ONLY_SETUP_MESSAGE);
  setOnlineFeedback(HOST_ONLY_SETUP_MESSAGE, "info");
}
function guardHostOnlySetupControl(event) {
  if (online.mode === "online" && online.role !== "host") {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    showHostOnlySetupMessage();
    return true;
  }
  return false;
}
function setOnlineFeedback(message = "", type = "error") {
  if (!el.onlineFeedback) return;
  el.onlineFeedback.textContent = message;
  el.onlineFeedback.classList.remove("hidden", "is-error", "is-success", "is-info");
  if (!message) {
    el.onlineFeedback.classList.add("hidden");
    return;
  }
  el.onlineFeedback.classList.add(`is-${type}`);
}
function setCreateRoomLoading(isLoading) {
  online.creatingRoom = isLoading;
  el.createRoomBtn.disabled = isLoading;
  el.joinRoomBtn.disabled = isLoading || online.joiningRoom;
  el.createRoomBtn.textContent = isLoading ? "جارٍ إنشاء الغرفة..." : "إنشاء غرفة";
}

function setJoinRoomLoading(isLoading) {
  online.joiningRoom = isLoading;
  el.confirmJoinBtn.disabled = isLoading;
  el.createRoomBtn.disabled = isLoading || online.creatingRoom;
  el.joinRoomBtn.disabled = isLoading || online.creatingRoom;
  el.confirmJoinBtn.textContent = isLoading ? "جارٍ الانضمام..." : "انضمام";
}

function setWaitingState(message, isConnected = false) {
  el.waitingStatus.textContent = message;
  el.waitingStatus.classList.toggle("is-connected", isConnected);
}

function getOnlinePlayerDisplayName() {
  const slot = Number(resolveOnlineTeamSlot() || online.teamSlot);
  if (slot && normalizeCell(state.teamNames?.[slot])) return normalizeCell(state.teamNames[slot]);
  return online.role === "host" ? "الفريق الأول" : "الفريق";
}

function saveOnlineSession() {
  if (online.mode !== "online") {
    safeStorageRemove(localStorage, ONLINE_SESSION_STORAGE_KEY);
    return;
  }
  safeStorageSet(localStorage, ONLINE_SESSION_STORAGE_KEY, JSON.stringify({
    mode: "online",
    roomCode: online.roomCode,
    role: online.role,
    teamSlot: resolveOnlineTeamSlot() || online.teamSlot,
    clientId: online.clientId,
    playerDisplayName: getOnlinePlayerDisplayName(),
    savedAt: Date.now(),
  }));
}

function loadSavedOnlineSession() {
  try {
    const raw = safeStorageGet(localStorage, ONLINE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.mode !== "online") return null;
    const roomCode = normalizeCell(parsed.roomCode).toUpperCase();
    const clientId = normalizeCell(parsed.clientId);
    const teamSlot = Number(parsed.teamSlot) || null;
    if (!roomCode || !clientId || !teamSlot) return null;
    return {
      mode: "online",
      roomCode,
      role: normalizeCell(parsed.role) || (teamSlot === 1 ? "host" : "guest"),
      teamSlot,
      clientId,
      playerDisplayName: normalizeCell(parsed.playerDisplayName),
      savedAt: Number(parsed.savedAt) || null,
    };
  } catch (_) {
    return null;
  }
}

function clearSavedOnlineSession() {
  safeStorageRemove(localStorage, ONLINE_SESSION_STORAGE_KEY);
}

function getFirebaseTimestampValue() {
  return firebase.database.ServerValue.TIMESTAMP;
}

function getPlayerStaleTimeoutMs(room = {}) {
  return room.gameStarted ? ONLINE_ACTIVE_GAME_STALE_MS : ONLINE_RECONNECT_GRACE_MS;
}

function isParticipantRecordStale(record, room = {}, now = Date.now()) {
  if (!record?.clientId) return true;
  if (record.connected) return false;
  const staleSince = Number(record.lastSeen || record.heartbeatAt || record.disconnectedAt || record.joinedAt || 0);
  if (!staleSince) return false;
  return (now - staleSince) > getPlayerStaleTimeoutMs(room);
}

function buildParticipantRecord({ slot, clientId, displayName = "", existingRecord = null, connected = true, now = Date.now() }) {
  const previous = existingRecord && typeof existingRecord === "object" ? existingRecord : {};
  return {
    clientId,
    displayName: normalizeCell(displayName) || normalizeCell(previous.displayName),
    connected,
    joinedAt: Number(previous.joinedAt) || now,
    lastSeen: now,
    heartbeatAt: now,
    disconnectedAt: connected ? null : now,
    teamSlot: slot,
  };
}

function cleanupStaleParticipants(room, slots, connections, records, roomTeamCount, now = Date.now()) {
  for (let slot = 1; slot <= roomTeamCount; slot += 1) {
    const record = records[slot];
    if (!record?.clientId) {
      slots[slot] = null;
      connections[slot] = false;
      records[slot] = null;
      continue;
    }
    if (!isParticipantRecordStale(record, room, now)) continue;
    slots[slot] = null;
    connections[slot] = false;
    records[slot] = null;
  }
}

function syncRoomParticipantFields(room, slots, connections, records) {
  room.participantSlots = slots;
  room.participantConnections = connections;
  room.participants = records;
  room.hostClientId = slots[1] || null;
  room.guestClientId = slots[2] || null;
  room.hostConnected = !!connections[1];
  room.guestConnected = !!connections[2];
}

function buildPresencePayload(slot, { connected = true, includeDisplayName = true } = {}) {
  const timestamp = getFirebaseTimestampValue();
  const updates = {
    [`participantConnections/${slot}`]: connected,
    [`participants/${slot}/clientId`]: online.clientId,
    [`participants/${slot}/connected`]: connected,
    [`participants/${slot}/teamSlot`]: slot,
    [`participants/${slot}/lastSeen`]: timestamp,
    [`participants/${slot}/heartbeatAt`]: timestamp,
  };
  if (includeDisplayName) {
    updates[`participants/${slot}/displayName`] = getOnlinePlayerDisplayName();
  }
  if (connected) {
    updates[`participants/${slot}/disconnectedAt`] = null;
  } else {
    updates[`participants/${slot}/disconnectedAt`] = timestamp;
  }
  if (slot === 1) updates.hostConnected = connected;
  if (slot === 2) updates.guestConnected = connected;
  return updates;
}

function stopOnlineHeartbeat() {
  if (online.heartbeatTimer !== null) {
    clearInterval(online.heartbeatTimer);
    online.heartbeatTimer = null;
  }
}

function disconnectPresenceListener() {
  if (online.connectionStateRef && online.connectionStateHandler) {
    online.connectionStateRef.off("value", online.connectionStateHandler);
  }
  online.connectionStateRef = null;
  online.connectionStateHandler = null;
}

function disconnectOnlinePresence() {
  stopOnlineHeartbeat();
  disconnectPresenceListener();
}

function startOnlineHeartbeat() {
  stopOnlineHeartbeat();
  if (online.mode !== "online" || !online.roomRef || !online.teamSlot) return;
  online.heartbeatTimer = window.setInterval(() => {
    online.roomRef.update(buildPresencePayload(online.teamSlot)).catch(() => {});
  }, ONLINE_PRESENCE_HEARTBEAT_MS);
}

function attachOnlinePresence(slot) {
  disconnectOnlinePresence();
  if (!online.db || !online.roomRef) return;

  const connectionStateRef = online.db.ref(".info/connected");
  const connectionStateHandler = (snapshot) => {
    if (snapshot.val() !== true || online.mode !== "online" || !online.roomRef) return;

    online.roomRef.update(buildPresencePayload(slot)).catch(() => {});
    online.roomRef.child(`participantConnections/${slot}`).onDisconnect().set(false);
    online.roomRef.child(`participants/${slot}/connected`).onDisconnect().set(false);
    online.roomRef.child(`participants/${slot}/lastSeen`).onDisconnect().set(getFirebaseTimestampValue());
    online.roomRef.child(`participants/${slot}/heartbeatAt`).onDisconnect().set(getFirebaseTimestampValue());
    online.roomRef.child(`participants/${slot}/disconnectedAt`).onDisconnect().set(getFirebaseTimestampValue());
    if (slot === 1) online.roomRef.child("hostConnected").onDisconnect().set(false);
    if (slot === 2) online.roomRef.child("guestConnected").onDisconnect().set(false);
  };

  connectionStateRef.on("value", connectionStateHandler);
  online.connectionStateRef = connectionStateRef;
  online.connectionStateHandler = connectionStateHandler;
  startOnlineHeartbeat();
}

function hasFirebaseValue(config, key) {
  const value = normalizeCell(config?.[key]);
  return !!value && !value.startsWith("PASTE_FIREBASE_") && !value.endsWith("_HERE");
}

function initFirebase() {
  if (online.firebaseReady) return true;
  if (!window.firebase || !window.FIREBASE_CONFIG) return false;
  const requiredConfigKeys = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
  const isConfigComplete = requiredConfigKeys.every((key) => hasFirebaseValue(window.FIREBASE_CONFIG, key));
  if (!isConfigComplete) return false;
  if (!firebase.apps.length) {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    console.log("[Tasleya] Firebase app initialized");
  }
  online.db = firebase.database();
  if (typeof firebase.firestore === "function") {
    online.firestore = firebase.firestore();
  }
  online.firebaseReady = true;
  return true;
}

function initAnalytics() {
  if (analyticsState.analytics) return analyticsState.analytics;
  if (!initFirebase()) {
    console.warn("[Tasleya] Analytics skipped: Firebase app/config not ready");
    return null;
  }
  if (!window.firebase?.analytics) {
    if (!analyticsState.warnedUnsupported) {
      console.warn("[Tasleya] Analytics unsupported in this context");
      analyticsState.warnedUnsupported = true;
    }
    return null;
  }
  try {
    const analytics = firebase.analytics();
    analyticsState.analytics = analytics;
    analyticsState.supported = true;
    console.log("[Tasleya] Analytics initialized");
    return analytics;
  } catch (error) {
    if (!analyticsState.warnedUnsupported) {
      console.warn("[Tasleya] Analytics unsupported in this context", error);
      analyticsState.warnedUnsupported = true;
    }
    return null;
  }
}

function logAnalyticsEvent(eventName, params = {}) {
  const analytics = initAnalytics();
  if (!analytics) return;
  try {
    analytics.logEvent(eventName, params);
    console.log("[Tasleya] Analytics event sent", { eventName, params });
  } catch (error) {
    console.warn("[Tasleya] Analytics event failed", { eventName, error });
  }
}


function roomRefByCode(code) { return online.db.ref(`${FIREBASE_ROOMS_PATH}/${code}`); }
function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function getJoinLink(code) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", code);
  return url.toString();
}

async function createOnlineRoom() {
  if (online.creatingRoom || online.joiningRoom) return;
  setOnlineFeedback("جارٍ إنشاء الغرفة...", "info");
  setCreateRoomLoading(true);
  try {
    if (!initFirebase()) throw new Error("يرجى إدخال إعدادات Firebase الصحيحة داخل firebase-config.js قبل إنشاء غرفة أونلاين");
    const code = randomRoomCode();
    const ref = roomRefByCode(code);
    const selectedTeamCount = normalizeTeamCount(online.selectedTeamCount);
    const roomPayload = {
      roomCode: code,
      teamCount: selectedTeamCount,
      createdAt: Date.now(),
      participantSlots: {
        1: online.clientId,
        2: null,
        3: null,
      },
      participantConnections: {
        1: true,
        2: false,
        3: false,
      },
      participants: {
        1: buildParticipantRecord({
          slot: 1,
          clientId: online.clientId,
          displayName: state.teamNames[1],
        }),
        2: null,
        3: null,
      },
      hostClientId: online.clientId,
      guestClientId: null,
      hostConnected: true,
      guestConnected: false,
      gameStarted: false,
      game: null,
    };
    await ref.set(roomPayload);
    await connectToRoom(code, 1);
    logAnalyticsEvent("room_created", { room_code: code });
    el.createdRoomCode.textContent = code;
    el.joinLinkInput.value = getJoinLink(code);
    el.onlineCreatePanel.classList.remove("hidden");
    setWaitingState(`بانتظار انضمام الفرق (1/${selectedTeamCount})...`, false);
    setOnlineFeedback("تم إنشاء الغرفة بنجاح. شارك الكود الآن.", "success");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء إنشاء الغرفة.";
    setOnlineFeedback(`تعذّر إنشاء الغرفة. ${errorMessage}`, "error");
  } finally {
    setCreateRoomLoading(false);
  }
}

async function joinOnlineRoom(codeInput) {
  try {
    return await joinOnlineRoomInternal(codeInput, {});
  } catch (_) {
    return null;
  }
}

async function joinOnlineRoomInternal(codeInput, { preferredTeamSlot = null, suppressSuccessFeedback = false } = {}) {
  if (online.joiningRoom || online.creatingRoom) return;
  setOnlineFeedback("جارٍ الانضمام إلى الغرفة...", "info");
  setJoinRoomLoading(true);
  try {
    if (!initFirebase()) throw new Error("يرجى إدخال إعدادات Firebase الصحيحة داخل firebase-config.js أولاً");
    const code = normalizeCell(codeInput).toUpperCase();
    if (!code) throw new Error("أدخل كود الغرفة أولاً.");
    const ref = roomRefByCode(code);
    const transactionResult = await ref.transaction((room) => {
      if (!room) return room;
      if (room.endedAt) return;
      const roomTeamCount = normalizeTeamCount(room.teamCount);
      room.teamCount = roomTeamCount;
      const slots = normalizeParticipantSlots(room);
      const connections = normalizeParticipantConnections(room);
      const records = normalizeParticipantRecords(room);
      const now = Date.now();

      cleanupStaleParticipants(room, slots, connections, records, roomTeamCount, now);

      let mySlot = null;
      for (let slot = 1; slot <= roomTeamCount; slot += 1) {
        if (slots[slot] === online.clientId) {
          mySlot = slot;
          break;
        }
      }
      if (!mySlot && preferredTeamSlot >= 1 && preferredTeamSlot <= roomTeamCount) {
        const preferredRecord = records[preferredTeamSlot];
        if (!slots[preferredTeamSlot] || isParticipantRecordStale(preferredRecord, room, now)) {
          mySlot = preferredTeamSlot;
          slots[preferredTeamSlot] = online.clientId;
        }
      }
      if (!mySlot) {
        for (let slot = 1; slot <= roomTeamCount; slot += 1) {
          if (!slots[slot]) {
            slots[slot] = online.clientId;
            mySlot = slot;
            break;
          }
        }
      }
      if (!mySlot) return;

      records[mySlot] = buildParticipantRecord({
        slot: mySlot,
        clientId: online.clientId,
        displayName: normalizeCell(state.teamNames?.[mySlot]) || normalizeCell(records[mySlot]?.displayName) || `الفريق ${mySlot}`,
        existingRecord: records[mySlot],
        connected: true,
        now,
      });
      connections[mySlot] = true;
      syncRoomParticipantFields(room, slots, connections, records);
      return room;
    });

    const room = transactionResult.snapshot.val();
    if (!transactionResult.committed) {
      if (room?.endedAt) throw new Error("تعذّر الاستعادة: الغرفة انتهت.");
      if (room) throw new Error("تعذّر الانضمام: الغرفة ممتلئة.");
      throw new Error("تعذّر الانضمام: الغرفة غير موجودة.");
    }
    if (!room) throw new Error("تعذّر الانضمام: الغرفة غير موجودة.");

    const roomTeamCount = normalizeTeamCount(room.teamCount);
    const slots = normalizeParticipantSlots(room);
    const mySlot = Array.from({ length: roomTeamCount }, (_, index) => index + 1).find((slot) => slots[slot] === online.clientId);
    if (!mySlot) throw new Error("تعذّر الانضمام: الغرفة ممتلئة.");

    setLocalTeamCount(roomTeamCount);
    updateTeamModeUI();
    await connectToRoom(code, mySlot);
    logAnalyticsEvent("room_joined", { room_code: code, team_slot: mySlot });
    if (!suppressSuccessFeedback) {
      setOnlineFeedback("تم الانضمام بنجاح. جارٍ الدخول إلى الغرفة...", "success");
    }
    closeOnlineModal();
    return { code, room, mySlot };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "تعذّر الانضمام إلى الغرفة.";
    setOnlineFeedback(errorMessage, "error");
    throw error;
  } finally {
    setJoinRoomLoading(false);
  }
}

async function connectToRoom(code, teamSlot) {
  disconnectOnlineListeners();
  disconnectOnlinePresence();
  online.mode = "online";
  online.role = teamSlot === 1 ? "host" : "guest";
  online.teamSlot = teamSlot;
  online.resolvedTeamSlot = teamSlot;
  online.roomCode = code;
  online.roomRef = roomRefByCode(code);
  saveOnlineSession();
  updateRoomCodeTag();
  el.onlineStatusCard.classList.remove("hidden");
  setOnlineStatus(teamSlot === 1 ? "تم إنشاء الغرفة" : "تم الانضمام بنجاح");
  updateOnlineActionPermissions();

  const roomListener = (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      handleOnlineRoomUnavailable("انتهت الغرفة أو لم تعد متاحة.");
      return;
    }
    if (room.endedAt) {
      handleOnlineRoomUnavailable("انتهت الغرفة.");
      return;
    }

    const roomTeamCount = normalizeTeamCount(room.teamCount);
    const slots = normalizeParticipantSlots(room);
    const connections = normalizeParticipantConnections(room);
    const records = normalizeParticipantRecords(room);
    const resolvedSlot = Array.from({ length: roomTeamCount }, (_, index) => index + 1).find((slot) => {
      return normalizeCell(slots[slot]) === online.clientId || normalizeCell(records[slot]?.clientId) === online.clientId;
    }) || Number(teamSlot) || null;
    const myRecord = resolvedSlot ? records[resolvedSlot] : null;

    online.participantSlots = slots;
    online.participantRecords = records;
    online.connected = connections;
    const validRoomTeams = Array.from({ length: roomTeamCount }, (_, index) => index + 1);
    online.currentTurnTeam = room.gameStarted && room.game && validRoomTeams.includes(Number(room.game.currentTeam))
      ? Number(room.game.currentTeam)
      : null;

    if (!resolvedSlot || (slots[resolvedSlot] && slots[resolvedSlot] !== online.clientId && normalizeCell(myRecord?.clientId) !== online.clientId)) {
      handleOnlineRoomUnavailable("تم فقدان مقعدك في الغرفة.");
      return;
    }

    if (online.teamSlot !== resolvedSlot || online.resolvedTeamSlot !== resolvedSlot) {
      online.teamSlot = resolvedSlot;
      online.resolvedTeamSlot = resolvedSlot;
      online.role = resolvedSlot === 1 ? "host" : "guest";
      updateOnlineActionPermissions();
      attachOnlinePresence(resolvedSlot);
      saveOnlineSession();
    }

    online.selectedTeamCount = roomTeamCount;
    setLocalTeamCount(roomTeamCount);
    updateTeamModeUI();
    updateOnlineTeamCountControls();
    saveOnlineSession();

    if (online.role === "host") {
      const joinedCount = getParticipantCount(slots, roomTeamCount);
      const connectedCount = Array.from({ length: roomTeamCount }, (_, index) => index + 1).filter((slot) => connections[slot]).length;
      const allJoined = joinedCount >= roomTeamCount;
      const allConnected = connectedCount >= roomTeamCount;
      el.startOnlineGameBtn.disabled = !allJoined;
      if (!allJoined) {
        setWaitingState(`بانتظار انضمام الفرق (${joinedCount}/${roomTeamCount})...`, false);
      } else if (allConnected) {
        setWaitingState("تم اكتمال اتصال جميع الفرق. يمكنك بدء اللعبة.", true);
      } else {
        setWaitingState("اكتمل الانضمام، جارٍ تثبيت الاتصال النهائي للفرق...", false);
      }
    }

    if (room.gameStarted) {
      closeOnlineModal();
      setOnlineStatus("بدأت اللعبة");
    } else if (online.role === "host") {
      const joinedCount = getParticipantCount(slots, roomTeamCount);
      setOnlineStatus(joinedCount >= roomTeamCount ? "اكتمل دخول جميع اللاعبين" : "بانتظار اللاعبين");
      if (online.restoringFromSavedSession) openOnlineModal();
    } else {
      setOnlineStatus(`أنت في الفريق ${online.resolvedTeamSlot || online.teamSlot || 1}`);
      if (online.restoringFromSavedSession) openOnlineModal();
    }

    if (room.gameStarted && room.game) {
      closeCategoryPicker();
      applyRemoteGameState(room.game);
    } else if (room.game) {
      ensureQuestionBankStateLoaded()
        .then(() => {
          if (online.mode === "online" && !online.applyingRemote) applyRemoteSetupState(room.game);
        })
        .catch(() => {});
    } else if (!room.gameStarted && online.role !== "host") {
      ensureQuestionBankStateLoaded()
        .then(() => {
          if (online.mode === "online" && !online.applyingRemote && online.role !== "host") {
            showJoinedGuestSetupPreview(room, records);
          }
        })
        .catch(() => {});
    } else if (!room.gameStarted && !el.categoryModal.classList.contains("hidden")) {
      updateCategoryPickerUI();
    }

    saveOnlineSession();
    online.restoringFromSavedSession = false;
    online.sessionRestoreInProgress = false;
  };

  online.roomListener = roomListener;
  online.roomRef.on("value", roomListener);
  online.listening = true;
  attachOnlinePresence(teamSlot);

  const isHost = teamSlot === 1;
  el.onlineCreatePanel.classList.toggle("hidden", !isHost);
  if (!isHost) el.onlineJoinPanel.classList.add("hidden");
}

function disconnectOnlineListeners() {
  if (online.roomRef && online.listening && online.roomListener) {
    online.roomRef.off("value", online.roomListener);
  } else if (online.roomRef && online.listening) {
    online.roomRef.off();
  }
  online.listening = false;
  online.roomListener = null;
}

function pushOnlineState() {
  if (online.mode !== "online" || !online.roomRef || online.applyingRemote) return;
  const isBoardReady = state.selectedCategories.length === getRequiredCategoryCount() && state.boardTiles.length > 0;
  online.roomRef.update({
    teamCount: normalizeTeamCount(state.teamCount),
    gameStarted: isBoardReady,
    game: serializeGameState(),
  });
}

function setOnlineTeamCount(teamCount) {
  online.selectedTeamCount = normalizeTeamCount(teamCount);
  if (online.mode !== "online") {
    setLocalTeamCount(online.selectedTeamCount);
    updateTeamModeUI();
  }
  updateOnlineTeamCountControls();
}

function updateOnlineTeamCountControls() {
  const isThree = online.selectedTeamCount === 3;
  const locked = online.mode === "online" && !!online.roomCode;
  if (el.onlineTwoTeamsBtn) {
    el.onlineTwoTeamsBtn.classList.toggle("secondary-btn", isThree);
    el.onlineTwoTeamsBtn.classList.toggle("primary-btn", !isThree);
    el.onlineTwoTeamsBtn.setAttribute("aria-pressed", String(!isThree));
    el.onlineTwoTeamsBtn.disabled = locked;
  }
  if (el.onlineThreeTeamsBtn) {
    el.onlineThreeTeamsBtn.classList.toggle("secondary-btn", !isThree);
    el.onlineThreeTeamsBtn.classList.toggle("primary-btn", isThree);
    el.onlineThreeTeamsBtn.setAttribute("aria-pressed", String(isThree));
    el.onlineThreeTeamsBtn.disabled = locked;
  }
}

function updateOnlineActionPermissions() {
  const locked = online.mode === "online";
  const hostOnly = locked && online.role !== "host";
  getTeamControlEntries().forEach(({ team, plusBtn, minusBtn, nameInput }) => {
    const active = isTeamActive(team);
    if (plusBtn) plusBtn.disabled = locked || !active;
    if (minusBtn) minusBtn.disabled = locked || !active;
    if (nameInput) nameInput.disabled = hostOnly || !active;
  });
}

function resetOnlineMode() {
  disconnectOnlineListeners();
  disconnectOnlinePresence();
  online.mode = "local";
  online.role = null;
  online.teamSlot = null;
  online.resolvedTeamSlot = null;
  online.roomCode = "";
  online.roomRef = null;
  online.connected = { 1: false, 2: false, 3: false };
  online.participantSlots = { 1: null, 2: null, 3: null };
  online.participantRecords = { 1: null, 2: null, 3: null };
  online.currentTurnTeam = null;
  online.restoringFromSavedSession = false;
  online.sessionRestoreInProgress = false;
  clearSavedOnlineSession();
  el.onlineStatusCard.classList.add("hidden");
  updateRoomCodeTag();
  setOnlineStatus("غير متصل");
  updateOnlineActionPermissions();
}

function openOnlineModal() {
  el.onlineModal.classList.remove("hidden");
  el.onlineCreatePanel.classList.add("hidden");
  el.onlineJoinPanel.classList.add("hidden");
  setOnlineFeedback("");
  setCreateRoomLoading(false);
  setJoinRoomLoading(false);
  updateOnlineTeamCountControls();
  if (online.mode !== "online") setOnlineStatus("غير متصل");
  requestAnimationFrame(() => el.onlineModal.classList.add("is-open"));
}
function closeOnlineModal() {
  el.onlineModal.classList.remove("is-open");
  el.onlineModal.classList.add("hidden");
}

async function startGameFromSelection() {
  if (state.selectedCategories.length !== getRequiredCategoryCount()) return;
  if (online.mode === "online" && online.role !== "host") {
    showHostOnlySetupMessage();
    return;
  }
  setTeamNamesFromCategoryModal();
  closeCategoryPicker();
  state.scores = { 1: 0, 2: 0, 3: 0 };
  state.displayedScores = { 1: 0, 2: 0, 3: 0 };
  state.currentTeam = 1;
  mcqHelpUsed = { 1: false, 2: false, 3: false };
  hintHelpUsed = { 1: false, 2: false, 3: false };
  state.activeTile = null;
  state.answerRevealed = false;
  state.revealRequested = false;
  state.currentChoices = [];
  state.currentHintText = "";
  clearError();
  buildBoardAssignment();
  updateScoreboard();
  renderBoard();
  checkEndOfGame();
  persistLocalProgress();
  logAnalyticsEvent("game_started", {
    mode: online.mode,
    categories_count: state.selectedCategories.length,
    teams_count: state.teamCount,
  });
  if (online.mode === "online") pushOnlineState();
}

async function startNewGame() {
  try {
    clearLocalProgress();
    resetGameState();
    el.newGameBtn.disabled = true;
    state.dataLoadFailed = false;
    await ensureQuestionBankStateLoaded();
    state.pointLevels = [...POINT_LEVELS];
    state.boardTiles = [];
    renderBoard();
    openCategoryPicker({ resetSelection: true });
    if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
  } catch (error) {
    state.dataLoadFailed = true;
    state.allCategories = [];
    state.pointLevels = [];
    resetGameState();
    showError(`تعذّر بدء لعبة جديدة. ${error instanceof Error ? error.message : "خطأ غير متوقع"}`);
    el.board.innerHTML = "";
  } finally {
    el.newGameBtn.disabled = false;
  }
}

function showGameScreen() {
  el.startScreen.style.display = "none";
  el.gameScreen.style.display = "block";
}

function showStartScreen() {
  el.gameScreen.style.display = "none";
  el.startScreen.style.display = "flex";
}

async function releaseOnlineSeat({ clearSession = true, removeSeat = false } = {}) {
  if (online.mode !== "online" || !online.roomRef || !online.teamSlot) {
    if (clearSession) clearSavedOnlineSession();
    return;
  }

  disconnectOnlinePresence();
  const updates = buildPresencePayload(online.teamSlot, { connected: false, includeDisplayName: false });
  if (removeSeat) {
    updates[`participantSlots/${online.teamSlot}`] = null;
    updates[`participants/${online.teamSlot}`] = null;
    if (online.teamSlot === 1) updates.hostClientId = null;
    if (online.teamSlot === 2) updates.guestClientId = null;
  }

  try {
    await online.roomRef.update(updates);
  } catch (_) {
    // Ignore cleanup failures on manual exit.
  }

  if (clearSession) clearSavedOnlineSession();
}

function handleOnlineRoomUnavailable(message = "الغرفة لم تعد متاحة.") {
  const shouldReturnHome = online.sessionRestoreInProgress || online.mode === "online";
  resetOnlineMode();
  resetGameState();
  clearLocalProgress();
  if (shouldReturnHome) showStartScreen();
  setOnlineFeedback(message, "info");
}

async function returnToHomeScreen() {
  closeOnlineModal();
  closeLocalTeamsModal();
  resetGameState();
  clearLocalProgress();

  await releaseOnlineSeat({ clearSession: true, removeSeat: true });
  resetOnlineMode();
  showStartScreen();

  const url = new URL(window.location.href);
  if (url.searchParams.has("room")) {
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url);
  }
}

async function enterGame(mode, { bootstrapOnlineGame = true, openOnlineLobby = true } = {}) {
  showGameScreen();
  if (mode === "online") {
    clearLocalProgress();
    if (bootstrapOnlineGame) {
      setOnlineTeamCount(2);
      resetGameState();
      ensureQuestionBankStateLoaded().catch(() => {});
    }
    updateTeamModeUI();
    if (openOnlineLobby) openOnlineModal();
  } else {
    resetOnlineMode();
    ensureQuestionBankStateLoaded().catch(() => {});
    openLocalTeamsModal();
  }
}

function openLocalTeamsModal() {
  el.localTeamsModal.classList.remove("hidden");
  requestAnimationFrame(() => el.localTeamsModal.classList.add("is-open"));
}
function closeLocalTeamsModal() {
  el.localTeamsModal.classList.remove("is-open");
  el.localTeamsModal.classList.add("hidden");
}
async function chooseLocalTeamCount(teamCount) {
  setLocalTeamCount(teamCount);
  updateTeamModeUI();
  closeLocalTeamsModal();
  await startNewGame();
}

function tryAutoJoinFromUrl() {
  const room = normalizeCell(new URL(window.location.href).searchParams.get("room") || "").toUpperCase();
  if (!room) return;
  enterGame("online").then(() => {
    el.onlineJoinPanel.classList.remove("hidden");
    el.roomCodeInput.value = room;
    return joinOnlineRoom(room);
  }).catch(() => {});
}

async function tryRestoreOnlineSession() {
  const savedSession = loadSavedOnlineSession();
  if (!savedSession) return false;

  online.clientId = savedSession.clientId;
  online.sessionRestoreInProgress = true;
  online.restoringFromSavedSession = true;
  resetGameState();
  clearLocalProgress();
  if (savedSession.playerDisplayName && savedSession.teamSlot) {
    state.teamNames[savedSession.teamSlot] = savedSession.playerDisplayName;
    syncTeamNameInputs();
  }

  try {
    await enterGame("online", { bootstrapOnlineGame: false, openOnlineLobby: false });
    await joinOnlineRoomInternal(savedSession.roomCode, {
      preferredTeamSlot: savedSession.teamSlot,
      suppressSuccessFeedback: true,
    });
    return true;
  } catch (_) {
    clearSavedOnlineSession();
    online.sessionRestoreInProgress = false;
    online.restoringFromSavedSession = false;
    resetOnlineMode();
    showStartScreen();
    return false;
  }
}



function openInstructionsModal() {
  if (!el.instructionsModal) return;
  el.instructionsModal.classList.remove("hidden", "is-closing");
  void el.instructionsModal.offsetWidth;
  el.instructionsModal.classList.add("is-open");
  try {
    localStorage.setItem(INSTRUCTIONS_SEEN_STORAGE_KEY, "1");
  } catch (_) {
    // Ignore storage errors silently.
  }
}

function closeInstructionsModal() {
  if (!el.instructionsModal || el.instructionsModal.classList.contains("hidden")) return;
  if (prefersReducedMotion) {
    el.instructionsModal.classList.add("hidden");
    el.instructionsModal.classList.remove("is-open", "is-closing");
    return;
  }

  el.instructionsModal.classList.remove("is-open");
  el.instructionsModal.classList.add("is-closing");
  const onEnd = () => {
    el.instructionsModal.classList.add("hidden");
    el.instructionsModal.classList.remove("is-closing");
    el.instructionsModal.removeEventListener("animationend", onEnd, true);
  };
  el.instructionsModal.addEventListener("animationend", onEnd, true);
}

function maybeOpenInstructionsForFirstVisit() {
  try {
    if (localStorage.getItem(INSTRUCTIONS_SEEN_STORAGE_KEY)) return;
  } catch (_) {
    return;
  }
  openInstructionsModal();
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIPhoneSafariBrowser() {
  const userAgent = window.navigator.userAgent || "";
  const isIPhone = /iPhone/i.test(userAgent);
  const isWebKitEngine = /WebKit/i.test(userAgent);
  const isSafariTokenPresent = /Safari/i.test(userAgent);
  const isKnownAlternativeIOSBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo|Brave|GSA|Coast)/i.test(userAgent);

  return isIPhone && isWebKitEngine && isSafariTokenPresent && !isKnownAlternativeIOSBrowser;
}

function shouldShowInstallGuideEntryPoint() {
  return isIPhoneSafariBrowser() && !isStandaloneMode();
}

function updateInstallGuideVisibility() {
  if (!el.installGuideBtn) return;
  el.installGuideBtn.classList.toggle("hidden", !shouldShowInstallGuideEntryPoint());
}

function updateInstallGuideContent() {
  const mobileIntro = document.getElementById("installGuideMobileIntro");
  const mobileSteps = document.getElementById("installGuideMobileSteps");
  const desktopMessage = document.getElementById("installGuideDesktopMessage");
  if (!mobileIntro || !mobileSteps || !desktopMessage) return;

  const shouldShowInstallFlow = shouldShowInstallGuideEntryPoint();
  mobileIntro.classList.toggle("hidden", !shouldShowInstallFlow);
  mobileSteps.classList.toggle("hidden", !shouldShowInstallFlow);
  desktopMessage.classList.toggle("hidden", shouldShowInstallFlow);
}

function openInstallGuide() {
  if (!el.installGuideModal) return;
  if (!shouldShowInstallGuideEntryPoint()) return;
  updateInstallGuideContent();
  el.installGuideModal.classList.remove("hidden", "is-closing");
  void el.installGuideModal.offsetWidth;
  el.installGuideModal.classList.add("is-open");
}

function handleInstallGuidePointerOpen(event) {
  if (event) {
    event.preventDefault();
  }
  openInstallGuide();
}

function closeInstallGuide() {
  if (!el.installGuideModal || el.installGuideModal.classList.contains("hidden")) return;
  if (prefersReducedMotion) {
    el.installGuideModal.classList.add("hidden");
    el.installGuideModal.classList.remove("is-open", "is-closing");
    return;
  }
  el.installGuideModal.classList.remove("is-open");
  el.installGuideModal.classList.add("is-closing");
  const onEnd = () => {
    el.installGuideModal.classList.add("hidden");
    el.installGuideModal.classList.remove("is-closing");
    el.installGuideModal.removeEventListener("animationend", onEnd, true);
  };
  el.installGuideModal.addEventListener("animationend", onEnd, true);
}

function setContactFeedback(message = "", type = "error") {
  if (!el.contactFeedback) return;
  el.contactFeedback.textContent = message;
  el.contactFeedback.classList.remove("hidden", "is-error", "is-success", "is-info");
  if (!message) {
    el.contactFeedback.classList.add("hidden");
    return;
  }
  el.contactFeedback.classList.add(`is-${type}`);
}

function openContactModal() {
  if (!el.contactModal) return;
  contactState.submitting = false;
  if (el.sendContactBtn) el.sendContactBtn.disabled = false;
  setContactFeedback("");
  el.contactModal.classList.remove("hidden", "is-closing");
  void el.contactModal.offsetWidth;
  el.contactModal.classList.add("is-open");
  if (el.contactMessageInput) {
    requestAnimationFrame(() => el.contactMessageInput.focus());
  }
}

function closeContactModal() {
  if (!el.contactModal || el.contactModal.classList.contains("hidden")) return;
  if (prefersReducedMotion) {
    el.contactModal.classList.add("hidden");
    el.contactModal.classList.remove("is-open", "is-closing");
    return;
  }
  el.contactModal.classList.remove("is-open");
  el.contactModal.classList.add("is-closing");
  const onEnd = () => {
    el.contactModal.classList.add("hidden");
    el.contactModal.classList.remove("is-closing");
    el.contactModal.removeEventListener("animationend", onEnd, true);
  };
  el.contactModal.addEventListener("animationend", onEnd, true);
}

function normalizeContactMessage(rawMessage = "") {
  return String(rawMessage).trim();
}

function normalizeContactName(rawName = "") {
  return String(rawName).trim();
}

function normalizeContactEmail(rawEmail = "") {
  return String(rawEmail).trim();
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateContactMessage(message) {
  if (!message) return "الرجاء كتابة رسالة أولاً.";
  if (message.length < CONTACT_MIN_LENGTH) return "الرسالة يجب أن تحتوي على 3 أحرف على الأقل.";
  if (message.length > CONTACT_MAX_LENGTH) return "الرسالة طويلة جدًا. الحد الأقصى 1000 حرف.";
  return "";
}

async function submitContactMessage() {
  if (contactState.submitting) return;

  const now = Date.now();
  if (now < contactState.cooldownUntil) {
    const waitSeconds = Math.ceil((contactState.cooldownUntil - now) / 1000);
    setContactFeedback(`يرجى الانتظار ${waitSeconds} ثوانٍ قبل إرسال رسالة جديدة.`, "info");
    return;
  }

  const message = normalizeContactMessage(el.contactMessageInput?.value || "");
  const name = normalizeContactName(el.contactNameInput?.value || "");
  const email = normalizeContactEmail(el.contactEmailInput?.value || "");
  const validationError = validateContactMessage(message);
  if (validationError) {
    setContactFeedback(validationError, "error");
    return;
  }
  if (email && !isValidEmail(email)) {
    setContactFeedback("يرجى إدخال بريد إلكتروني صحيح.", "error");
    return;
  }

  if (!initFirebase() || !online.firestore) {
    setContactFeedback("تعذّر الاتصال بالخدمة الآن. حاول مرة أخرى لاحقًا.", "error");
    return;
  }

  contactState.submitting = true;
  if (el.sendContactBtn) el.sendContactBtn.disabled = true;
  setContactFeedback("جارٍ الإرسال...", "info");

  try {
    await online.firestore.collection(CONTACT_MESSAGES_COLLECTION).add({
      message,
      name,
      email,
      wantsReply: !!email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      page: "start-screen",
      userAgent: navigator.userAgent || "",
      language: navigator.language || "",
    });

    contactState.cooldownUntil = Date.now() + CONTACT_SUBMIT_COOLDOWN_MS;
    if (el.contactMessageInput) el.contactMessageInput.value = "";
    if (el.contactNameInput) el.contactNameInput.value = "";
    if (el.contactEmailInput) el.contactEmailInput.value = "";
    setContactFeedback("تم إرسال رسالتك بنجاح", "success");

    window.setTimeout(() => {
      closeContactModal();
    }, 900);
  } catch (error) {
    setContactFeedback("تعذّر إرسال الرسالة. حاول مرة أخرى.", "error");
  } finally {
    contactState.submitting = false;
    if (el.sendContactBtn) el.sendContactBtn.disabled = false;
  }
}

function bindEvent(element, eventName, handler, elementName) {
  if (!element) {
    console.error(`[Tasleya] Missing element: ${elementName}`);
    return;
  }
  element.addEventListener(eventName, handler);
}

function initializeApp() {
  if (appInitialized) return;
  appInitialized = true;
  cacheElements();
  ensureSoundPreferenceLoaded();
  online.clientId = getOrCreateStableClientId();

  bindEvent(el.newGameBtn, "click", () => {
    if (online.mode === "online" && online.role !== "host") return;
    startNewGame();
  }, "newGameBtn");
  bindEvent(el.closeModalBtn, "click", () => closeModal(), "closeModalBtn");
  bindEvent(el.revealBtn, "click", revealAnswer, "revealBtn");
  bindEvent(el.correctBtn, "click", () => applyScore(true), "correctBtn");
  bindEvent(el.wrongBtn, "click", () => applyScore(false), "wrongBtn");
  bindEvent(el.otherTeamBtn, "click", awardPointsToOtherTeam, "otherTeamBtn");
  bindEvent(el.lateOtherTeamPrompt, "click", awardPointsToOtherTeam, "lateOtherTeamPrompt");
  bindEvent(el.lifelineBtn, "click", useLifeline, "lifelineBtn");
  bindEvent(el.hintLifelineBtn, "click", useHintLifeline, "hintLifelineBtn");
  bindEvent(el.soundToggleBtn, "click", () => setMutedSound(!soundState.muted), "soundToggleBtn");
  bindEvent(el.startGameBtn, "click", startGameFromSelection, "startGameBtn");
  bindEvent(el.randomCategoriesBtn, "click", pickRandomCategories, "randomCategoriesBtn");
  bindEvent(el.cancelCategoryBtn, "click", closeCategoryPicker, "cancelCategoryBtn");
  bindEvent(el.categoryTeam1NameInput, "click", guardHostOnlySetupControl, "categoryTeam1NameInput");
  bindEvent(el.categoryTeam2NameInput, "click", guardHostOnlySetupControl, "categoryTeam2NameInput");
  bindEvent(el.categoryTeam3NameInput, "click", guardHostOnlySetupControl, "categoryTeam3NameInput");
  bindEvent(el.categoryTeam1NameInput, "focus", guardHostOnlySetupControl, "categoryTeam1NameInput");
  bindEvent(el.categoryTeam2NameInput, "focus", guardHostOnlySetupControl, "categoryTeam2NameInput");
  bindEvent(el.categoryTeam3NameInput, "focus", guardHostOnlySetupControl, "categoryTeam3NameInput");
  bindEvent(el.categoryTeam1NameInput, "input", () => {
    if (online.mode === "online" && online.role !== "host") return;
    setTeamName(1, el.categoryTeam1NameInput.value);
  }, "categoryTeam1NameInput");
  bindEvent(el.categoryTeam2NameInput, "input", () => {
    if (online.mode === "online" && online.role !== "host") return;
    setTeamName(2, el.categoryTeam2NameInput.value);
  }, "categoryTeam2NameInput");
  bindEvent(el.categoryTeam3NameInput, "input", () => {
    if (online.mode === "online" && online.role !== "host") return;
    setTeamName(3, el.categoryTeam3NameInput.value);
  }, "categoryTeam3NameInput");
  bindEvent(el.categoryTeam1NameInput, "blur", () => {
    if (online.mode === "online" && online.role !== "host") return;
    setTeamName(1, el.categoryTeam1NameInput.value, { commit: true });
  }, "categoryTeam1NameInput");
  bindEvent(el.categoryTeam2NameInput, "blur", () => {
    if (online.mode === "online" && online.role !== "host") return;
    setTeamName(2, el.categoryTeam2NameInput.value, { commit: true });
  }, "categoryTeam2NameInput");
  bindEvent(el.categoryTeam3NameInput, "blur", () => {
    if (online.mode === "online" && online.role !== "host") return;
    setTeamName(3, el.categoryTeam3NameInput.value, { commit: true });
  }, "categoryTeam3NameInput");
  bindEvent(el.podiumNewGameBtn, "click", () => {
    if (online.mode === "online" && online.role !== "host") return;
    startNewGame();
  }, "podiumNewGameBtn");
  bindEvent(el.shareResultBtn, "click", handlePrimaryShare, "shareResultBtn");
  bindEvent(el.shareWhatsappBtn, "click", openWhatsappShare, "shareWhatsappBtn");
  bindEvent(el.copyResultBtn, "click", copyResultShareText, "copyResultBtn");

  bindEvent(el.team1NameInput, "input", () => setTeamName(1, el.team1NameInput.value), "team1NameInput");
  bindEvent(el.team2NameInput, "input", () => setTeamName(2, el.team2NameInput.value), "team2NameInput");
  bindEvent(el.team3NameInput, "input", () => setTeamName(3, el.team3NameInput.value), "team3NameInput");
  bindEvent(el.team1NameInput, "blur", () => setTeamName(1, el.team1NameInput.value, { commit: true }), "team1NameInput");
  bindEvent(el.team2NameInput, "blur", () => setTeamName(2, el.team2NameInput.value, { commit: true }), "team2NameInput");
  bindEvent(el.team3NameInput, "blur", () => setTeamName(3, el.team3NameInput.value, { commit: true }), "team3NameInput");

  getTeamControlEntries().forEach(({ team, plusBtn, minusBtn }) => {
    bindEvent(plusBtn, "click", () => adjustTeamScore(team, 100), `team${team}PlusBtn`);
    bindEvent(minusBtn, "click", () => adjustTeamScore(team, -100), `team${team}MinusBtn`);
  });

  bindEvent(el.modal, "click", (event) => { if (event.target === el.modal) closeModal(); }, "questionModal");
  bindEvent(el.board, "click", (event) => {
    const tileBtn = event.target?.closest?.("[data-tile-id]");
    if (!tileBtn || !el.board.contains(tileBtn)) return;
    animateTileSelection(tileBtn);
    openQuestion(tileBtn.dataset.tileId);
  }, "board");
  bindEvent(el.categoryModal, "click", (event) => { if (event.target === el.categoryModal) closeCategoryPicker(); }, "categoryModal");

  bindEvent(el.backToHomeBtn, "click", returnToHomeScreen, "backToHomeBtn");
  bindEvent(el.startLocalBtn, "click", () => {
    console.log("[Tasleya] Start local button clicked");
    logAnalyticsEvent("local_game_started", { mode: "single_device" });
    enterGame("local");
  }, "startLocalBtn");
  bindEvent(el.localOneTeamBtn, "click", () => chooseLocalTeamCount(1), "localOneTeamBtn");
  bindEvent(el.localTwoTeamsBtn, "click", () => chooseLocalTeamCount(2), "localTwoTeamsBtn");
  bindEvent(el.localThreeTeamsBtn, "click", () => chooseLocalTeamCount(3), "localThreeTeamsBtn");
  bindEvent(el.cancelLocalTeamsBtn, "click", () => {
    closeLocalTeamsModal();
    showStartScreen();
    clearLocalProgress();
  }, "cancelLocalTeamsBtn");
  bindEvent(el.localTeamsModal, "click", (event) => {
    if (event.target !== el.localTeamsModal) return;
    closeLocalTeamsModal();
    showStartScreen();
    clearLocalProgress();
  }, "localTeamsModal");
  bindEvent(el.startOnlineBtn, "click", () => {
    console.log("[Tasleya] Start online button clicked");
    logAnalyticsEvent("online_game_started", { mode: "multi_device" });
    enterGame("online");
  }, "startOnlineBtn");
  bindEvent(el.instructionsBtn, "click", openInstructionsModal, "instructionsBtn");
  bindEvent(el.closeInstructionsBtn, "click", closeInstructionsModal, "closeInstructionsBtn");
  bindEvent(el.instructionsModal, "click", (event) => {
    if (event.target === el.instructionsModal) closeInstructionsModal();
  }, "instructionsModal");
  bindEvent(el.contactBtn, "click", openContactModal, "contactBtn");
  bindEvent(el.sendContactBtn, "click", submitContactMessage, "sendContactBtn");
  bindEvent(el.closeContactBtn, "click", closeContactModal, "closeContactBtn");
  bindEvent(el.contactModal, "click", (event) => {
    if (event.target === el.contactModal) closeContactModal();
  }, "contactModal");
  bindEvent(el.contactMessageInput, "keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitContactMessage();
    }
  }, "contactMessageInput");
  bindEvent(el.installGuideBtn, "click", handleInstallGuidePointerOpen, "installGuideBtn");
  bindEvent(el.closeInstallGuideBtn, "click", closeInstallGuide, "closeInstallGuideBtn");
  bindEvent(el.installGuideModal, "click", (event) => {
    if (event.target === el.installGuideModal) closeInstallGuide();
  }, "installGuideModal");
  bindEvent(el.createRoomBtn, "click", createOnlineRoom, "createRoomBtn");
  bindEvent(el.onlineTwoTeamsBtn, "click", () => setOnlineTeamCount(2), "onlineTwoTeamsBtn");
  bindEvent(el.onlineThreeTeamsBtn, "click", () => setOnlineTeamCount(3), "onlineThreeTeamsBtn");
  bindEvent(el.joinRoomBtn, "click", () => {
    el.onlineJoinPanel.classList.remove("hidden");
    setOnlineFeedback("أدخل كود الغرفة ثم اضغط انضمام.", "info");
    el.roomCodeInput.focus();
  }, "joinRoomBtn");
  bindEvent(el.confirmJoinBtn, "click", () => joinOnlineRoom(el.roomCodeInput.value), "confirmJoinBtn");
  bindEvent(el.roomCodeInput, "keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    joinOnlineRoom(el.roomCodeInput.value);
  }, "roomCodeInput");
  bindEvent(el.cancelOnlineBtn, "click", () => {
    if (online.mode === "online" && online.roomCode) {
      closeOnlineModal();
      return;
    }
    showStartScreen();
    clearLocalProgress();
    closeOnlineModal();
  }, "cancelOnlineBtn");
  bindEvent(el.startOnlineGameBtn, "click", async () => {
    if (online.mode === "online" && online.role !== "host") {
      showHostOnlyStartMessage();
      return;
    }
    if (online.mode === "online" && online.role === "host" && online.roomRef) {
      online.roomRef.update({
        teamCount: normalizeTeamCount(state.teamCount),
        gameStarted: false,
        game: null,
      }).catch(() => {});
    }
    closeOnlineModal();
    await startNewGame();
  }, "startOnlineGameBtn");
  bindEvent(el.copyCodeBtn, "click", async () => {
    if (!online.roomCode) return;
    try {
      await navigator.clipboard.writeText(online.roomCode);
      setOnlineFeedback("تم نسخ كود الغرفة.", "success");
    } catch (_) {
      setOnlineFeedback("تعذّر نسخ الكود. انسخه يدويًا.", "error");
    }
  }, "copyCodeBtn");
  bindEvent(el.copyLinkBtn, "click", async () => {
    if (!el.joinLinkInput.value) return;
    try {
      await navigator.clipboard.writeText(el.joinLinkInput.value);
      setOnlineFeedback("تم نسخ رابط الدعوة.", "success");
    } catch (_) {
      setOnlineFeedback("تعذّر نسخ الرابط. انسخه يدويًا.", "error");
    }
  }, "copyLinkBtn");

  updateInstallGuideVisibility();
  updateOnlineTeamCountControls();
  updateInstallGuideContent();
  maybeOpenInstructionsForFirstVisit();
  const displayModeMedia = window.matchMedia("(display-mode: standalone)");
  if (typeof displayModeMedia.addEventListener === "function") {
    displayModeMedia.addEventListener("change", updateInstallGuideVisibility);
  } else if (typeof displayModeMedia.addListener === "function") {
    displayModeMedia.addListener(updateInstallGuideVisibility);
  }

  loadTeamNames();
  updateTeamModeUI();
  syncTeamNameInputs();
  updateScoreboard();
  updateOnlineActionPermissions();

  restoreLocalProgress();

  window.addEventListener("pagehide", persistLocalProgress);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistLocalProgress();
      if (online.mode === "online" && online.roomRef && online.teamSlot) {
        online.roomRef.update(buildPresencePayload(online.teamSlot)).catch(() => {});
      }
      return;
    }

    if (document.visibilityState === "visible" && online.mode === "online" && online.roomRef && online.teamSlot) {
      online.roomRef.update(buildPresencePayload(online.teamSlot)).catch(() => {});
    }
  });
  window.addEventListener("online", () => {
    if (online.mode === "online" && online.roomRef && online.teamSlot) {
      online.roomRef.update(buildPresencePayload(online.teamSlot)).catch(() => {});
    }
  });

  initAnalytics();
  logAnalyticsEvent("page_view", { page_title: document.title, page_location: window.location.href });

  preloadQuestionBank().catch(() => {});

  tryRestoreOnlineSession().then((restored) => {
    if (!restored) tryAutoJoinFromUrl();
  });
  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}
