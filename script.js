const DEFAULT_CATEGORIES_TO_SELECT = 6;
const SOLO_CATEGORIES_TO_SELECT = 3;
const POINT_ROWS_COUNT = 5;
const POINT_LEVELS = [100, 200, 300, 400, 500];
const WORKER_URL_PLACEHOLDER = "https://REPLACE_WITH_YOUR_WORKER_URL";
const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";
const DEPLOY_VERSION = "1.2.2";
const SUPPORTED_TEAM_COUNTS = [1, 2, 3];
const USED_QUESTIONS_BY_CATEGORY_STORAGE_KEY = "tasleya_used_questions_v1";
const LEGACY_USED_QUESTIONS_BY_CATEGORY_STORAGE_KEY = "tasleya_used_questions_by_category";
const TEAM_NAMES_STORAGE_KEY = "tasleya_team_names_v1";
const ONLINE_SESSION_STORAGE_KEY = "tasleya_online_session_v1";
const INSTRUCTIONS_SEEN_STORAGE_KEY = "tasleya_instructions_seen_v1";
const LOCAL_PROGRESS_STORAGE_KEY = "tasleya_local_progress_v1";
const LOCAL_PROGRESS_SCHEMA_VERSION = 2;
const SOUND_MUTED_STORAGE_KEY = "tasleya_sound_muted_v1";
const ONLINE_CLIENT_ID_STORAGE_KEY = "tasleya_online_client_id_v1";
const FIREBASE_ROOMS_PATH = "rooms";
const ROOM_USED_HISTORY_FIELD = "usedQuestionIdsByCategory";
const LEGACY_ROOM_USED_HISTORY_FIELD = "usedQuestionsByCategory";
const CONTACT_MIN_LENGTH = 3;
const CONTACT_MAX_LENGTH = 1000;
const CONTACT_SUBMIT_COOLDOWN_MS = 5000;
const CONTACT_FORM_ACTION = "https://formspree.io/f/mnjobyeq";
const HOST_ONLY_START_MESSAGE = "فقط منشئ الغرفة يمكنه بدء اللعبة";
const HOST_ONLY_SETUP_MESSAGE = "الفريق الذي أنشأ الغرفة هو الوحيد الذي يمكنه اختيار الفئات";
const NEW_GAME_BUTTON_TEXT = "لعبة جديدة";
const HOST_CATEGORY_CTA_BUTTON_TEXT = "اختيار الفئات";
const ONLINE_PRESENCE_HEARTBEAT_MS = 15000;
const ONLINE_RECONNECT_GRACE_MS = 2 * 60 * 1000;
const ONLINE_ACTIVE_GAME_STALE_MS = 15 * 60 * 1000;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function createEmptyLifelinesUsed() {
  return {
    1: { hint: false, mcq: false },
    2: { hint: false, mcq: false },
    3: { hint: false, mcq: false },
  };
}

function normalizeLifelinesUsed(raw) {
  const normalized = createEmptyLifelinesUsed();
  for (const team of SUPPORTED_TEAM_COUNTS) {
    normalized[team] = {
      hint: !!raw?.[team]?.hint,
      mcq: !!raw?.[team]?.mcq,
    };
  }
  return normalized;
}

function hasUsedLifeline(team, type) {
  return !!lifelinesUsed?.[team]?.[type];
}

let lifelinesUsed = createEmptyLifelinesUsed();
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
    categories: ["ما هي الدولة بالعلم", "ما هي الدولة بالخريطة", "خمن الدولة من المكان GeoGuessr", "خمن اللغة من الصوت", "عواصم", "لون العلم", "عملات"],
  },
  {
    name: "الدول",
    categories: ["مصر", "المغرب", "السعودية", "الإمارات", "الكويت", "فلسطين", "لبنان", "سوريا", "الأردن", "اليمن", "قطر", "العراق", "الجزائر", "تونس", "السودان", "الصومال", "ليبيا", "البحرين", "عُمان", "موريتانيا", "جيبوتي"],
  },
  {
    name: "رياضة",
    categories: ["رياضة", "كرة قدم", "UFC", "مسيرة لاعب", "خمن اللاعب (فرق فقط)", "من هو المعلق من الصوت؟"],
  },
  {
    name: "ثقافة وفن",
    categories: ["فن عربي", "من هو المشهور (جزء من وجه)", "خمن القائل من الصوت", "خمن الفيلم بالتمثيل (فرق فقط)"],
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
const CATEGORY_GROUP_ICON_SVGS = {
  "علوم إسلامية": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.8 5.2a7.7 7.7 0 1 0 0 13.6 6.1 6.1 0 1 1 0-13.6Z"/></svg>',
  "جغرافيا": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5M12 3.5c-2.2 2.4-3.4 5.4-3.4 8.5s1.2 6.1 3.4 8.5"/></svg>',
  "رياضة": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5h8v3.2a4 4 0 0 1-8 0Z"/><path d="M6 7.2h2v1.2a2.4 2.4 0 0 1-2.4 2.4H5.2"/><path d="M18 7.2h-2v1.2a2.4 2.4 0 0 0 2.4 2.4h.4"/><path d="M12 12.7v2.3"/><path d="M9.2 18.5h5.6"/><path d="M10.2 15h3.6v3.5h-3.6Z"/></svg>',
  "ثقافة وفن": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8.2" y="4.5" width="7.6" height="10.2" rx="3.8"/><path d="M12 14.7v3.1"/><path d="M9.3 18h5.4"/></svg>',
  "معلومات عامة": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M12 10.1v5.1"/><circle cx="12" cy="7.3" r=".55" fill="currentColor" stroke="none"/></svg>',
  "تخصصات الجامعة": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3.8 9.2 8.2-3.7 8.2 3.7-8.2 3.7Z"/><path d="M7.3 10.8v3.2c0 1.3 2.1 2.4 4.7 2.4s4.7-1.1 4.7-2.4v-3.2"/><path d="M20.2 9.3v4.6"/></svg>',
  "الدول": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4.5v15"/><path d="M6 5.8h9.3l-1.6 2.7 1.6 2.7H6"/></svg>',
  "مدن": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="10.2" width="6.4" height="8.8" rx="1.1"/><rect x="11.2" y="6" width="8.8" height="13" rx="1.1"/><path d="M6.2 12.7h2M6.2 15.1h2M13.6 8.8h3.8M13.6 11.6h3.8M13.6 14.4h3.8"/></svg>',
};
const DEFAULT_CATEGORY_GROUP_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 8.3h12M6 12h12M6 15.7h8"/><rect x="3.5" y="4.5" width="17" height="15" rx="3"/></svg>';
const CATEGORY_GROUP_GRADIENTS = {
  "علوم إسلامية": "linear-gradient(145deg, rgba(42, 72, 140, 0.92), rgba(20, 38, 90, 0.96))",
  "جغرافيا": "linear-gradient(145deg, rgba(30, 90, 150, 0.9), rgba(16, 50, 110, 0.96))",
  "الدول": "linear-gradient(145deg, rgba(34, 64, 130, 0.9), rgba(18, 40, 92, 0.96))",
  "رياضة": "linear-gradient(145deg, rgba(54, 82, 148, 0.9), rgba(24, 48, 108, 0.96))",
  "ثقافة وفن": "linear-gradient(145deg, rgba(74, 76, 144, 0.9), rgba(31, 39, 103, 0.96))",
  "معلومات عامة": "linear-gradient(145deg, rgba(44, 74, 134, 0.92), rgba(18, 44, 102, 0.97))",
  "تخصصات الجامعة": "linear-gradient(145deg, rgba(36, 86, 136, 0.9), rgba(18, 56, 108, 0.96))",
  "مدن": "linear-gradient(145deg, rgba(42, 74, 142, 0.9), rgba(18, 48, 103, 0.96))",
  [DEFAULT_CATEGORY_GROUP]: "linear-gradient(145deg, rgba(44, 74, 134, 0.92), rgba(18, 44, 102, 0.97))",
};
const CATEGORY_HELP_TEXTS = {
  "خمن الدولة من المكان GeoGuessr": "تظهر لك صورة من مكان حقيقي، وعليك اختيار الدولة الصحيحة.",
  "خمن اللغة من الصوت": "تسمع مقطعًا قصيرًا، ثم تختار اللغة الصحيحة.",
  "ركّز في الفيديو": "ستشاهد فيديو قصير ثم سيظهر سؤال عن شئ متعلق بهذا الفيديو",
  "رتب التالي": "تظهر عناصر متعددة، وعليك ترتيبها بالشكل المطلوب في السؤال.",
  "من هو المشهور (جزء من وجه)": "تظهر لقطة مقرّبة من وجه مشهور، وعليك تحديد اسمه.",
  "خمن اللاعب (فرق فقط)": "يختار الفريق لاعب واحد ليري اسم لاعب كرة قدم قبل اختيار السؤال، ثم يحاول باقي الفريق تخمينه خلال 60 ثانية فقط عبر طرح أسئلة لا تكون إجابتها إلا بنعم أو لا.",
  "خمن الفيلم بالتمثيل (فرق فقط)": "يختار أحد أفراد الفريق لاعباً ليرى اسم الفيلم قبل اختيار السؤال، ثم يحاول تمثيل اسم الفيلم بدون كلام، ويحاول باقي الفريق تخمينه خلال 60 ثانية فقط.",
  "اسم الإصابة من الأشعة": "تُعرض صورة أشعة طبية، و عليك تحديد التشخيص الصحيح.",
};
const CATEGORY_HELP_ALIASES = {
  "خمن الدولة من المكان": "خمن الدولة من المكان GeoGuessr",
  "ركز في الفيديو": "ركّز في الفيديو",
  "خمن اللاعب": "خمن اللاعب (فرق فقط)",
  "من هو المشهور": "من هو المشهور (جزء من وجه)",
  "خمن الفلم بالتمثيل": "خمن الفيلم بالتمثيل (فرق فقط)",
  "خمن الفيلم بالتمثيل": "خمن الفيلم بالتمثيل (فرق فقط)",
};
const CATEGORY_DISPLAY_ALIASES = {
  "خمن الدولة من المكان GeoGuessr": "خمن الدولة من المكان",
  "خمن اللاعب (فرق فقط)": "خمن اللاعب",
  "من هو المشهور (جزء من وجه)": "من هو المشهور",
  "خمن الفيلم بالتمثيل (فرق فقط)": "خمن الفلم بالتمثيل",
};
const CATEGORY_THUMBNAILS = {};
const MOBILE_CATEGORY_HELP_MEDIA_QUERY = "(max-width: 859px), (hover: none), (pointer: coarse)";
const categoryHelpState = {
  desktopPopover: null,
  desktopTitle: null,
  desktopText: null,
  mobileSheet: null,
  mobileTitle: null,
  mobileText: null,
  mobileBackdrop: null,
  activeButton: null,
  activeOption: null,
  desktopOpen: false,
  mobileOpen: false,
  listenersBound: false,
};

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
  hostCategoryCtaHint: document.getElementById("hostCategoryCtaHint"),
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
  otherTeamSelector: document.getElementById("otherTeamSelector"),
  otherTeamChoices: document.getElementById("otherTeamChoices"),
  categoryModal: document.getElementById("categoryModal"),
  categoryModalTitle: document.getElementById("categoryModalTitle"),
  categoryList: document.getElementById("categoryList"),
  categoryTeam1NameInput: document.getElementById("categoryTeam1NameInput"),
  categoryTeam1NameLabel: document.getElementById("categoryTeam1NameLabel"),
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
  homepagePrimaryStep: document.getElementById("homepagePrimaryStep"),
  homepageGroupDeviceStep: document.getElementById("homepageGroupDeviceStep"),
  homepageGroupTeamsStep: document.getElementById("homepageGroupTeamsStep"),
  resumeGamePrompt: document.getElementById("resumeGamePrompt"),
  resumeGameBtn: document.getElementById("resumeGameBtn"),
  discardResumeGameBtn: document.getElementById("discardResumeGameBtn"),
  homeGroupOneDeviceBtn: document.getElementById("homeGroupOneDeviceBtn"),
  homeGroupMultiDeviceBtn: document.getElementById("homeGroupMultiDeviceBtn"),
  homeGroupDeviceBackBtn: document.getElementById("homeGroupDeviceBackBtn"),
  homeGroupTwoTeamsBtn: document.getElementById("homeGroupTwoTeamsBtn"),
  homeGroupThreeTeamsBtn: document.getElementById("homeGroupThreeTeamsBtn"),
  homeGroupTeamsBackBtn: document.getElementById("homeGroupTeamsBackBtn"),
  instructionsBtn: document.getElementById("instructionsBtn"),
  instructionsModal: document.getElementById("instructionsModal"),
  closeInstructionsBtn: document.getElementById("closeInstructionsBtn"),
  contactBtn: document.getElementById("contactBtn"),
  contactModal: document.getElementById("contactModal"),
  contactForm: document.getElementById("contactForm"),
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
  localTeamsModalTitle: document.getElementById("localTeamsModalTitle"),
  localTwoTeamsBtn: document.getElementById("localTwoTeamsBtn"),
  localThreeTeamsBtn: document.getElementById("localThreeTeamsBtn"),
  cancelLocalTeamsBtn: document.getElementById("cancelLocalTeamsBtn"),
  groupModeModal: document.getElementById("groupModeModal"),
  groupOneDeviceBtn: document.getElementById("groupOneDeviceBtn"),
  groupMultiDeviceBtn: document.getElementById("groupMultiDeviceBtn"),
  cancelGroupModeBtn: document.getElementById("cancelGroupModeBtn"),
  };
}

function ensureHomepageFlowModals() {
  const requiredModals = [
    {
      id: "localTeamsModal",
      html: `
        <div id="localTeamsModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="localTeamsModalTitle">
          <div class="modal-content local-teams-modal-content">
            <h2 id="localTeamsModalTitle">كم عدد الفرق؟</h2>
            <div class="local-team-count-actions">
              <button id="localTwoTeamsBtn" class="primary-btn" type="button">فريقان</button>
              <button id="localThreeTeamsBtn" class="secondary-btn" type="button">3 فرق</button>
            </div>
            <div class="modal-actions">
              <button id="cancelLocalTeamsBtn" class="ghost-btn" type="button">إلغاء</button>
            </div>
          </div>
        </div>
      `,
    },
    {
      id: "groupModeModal",
      html: `
        <div id="groupModeModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="groupModeModalTitle">
          <div class="modal-content local-teams-modal-content">
            <h2 id="groupModeModalTitle">اختر طريقة اللعب الجماعي</h2>
            <div class="local-team-count-actions">
              <button id="groupOneDeviceBtn" class="primary-btn" type="button">لعب على جهاز واحد</button>
              <button id="groupMultiDeviceBtn" class="secondary-btn" type="button">لعب على أجهزة مختلفة</button>
            </div>
            <div class="modal-actions">
              <button id="cancelGroupModeBtn" class="ghost-btn" type="button">إلغاء</button>
            </div>
          </div>
        </div>
      `,
    },
  ];

  requiredModals.forEach(({ id, html }) => {
    if (document.getElementById(id)) return;
    document.body.insertAdjacentHTML("beforeend", html);
    console.warn(`[Tasleya] Missing #${id} in HTML; injected fallback modal at runtime.`);
  });
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
  loadingQuestion: false,
  revealRequested: false,
  pendingOtherTeamSelection: false,
  resolvingOtherTeam: false,
  questionSessionId: "",
  videoQuestionPending: false,
  videoPlaybackCompleted: false,
  pendingVideoDeadlineTs: null,
  answeringTeamIndex: null,
  questionTurnOwnerIndex: null,
  pendingScoreTeamIndex: null,
  questionResolutionLocked: false,
  resolvedQuestionSessionId: "",
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
  auth: null,
  firestore: null,
  creatingRoom: false,
  joiningRoom: false,
  selectedTeamCount: 2,
  uid: null,
  clientId: "",
  authReadyPromise: null,
  sessionRestoreInProgress: false,
  restoringFromSavedSession: false,
  connectionStateRef: null,
  connectionStateHandler: null,
  heartbeatTimer: null,
  currentTurnTeam: null,
  usedQuestionsByCategory: {},
  processingTilePickRequestId: "",
  processingRevealRequestId: "",
  processingScoreRequestId: "",
  processingLifelineRequestId: "",
  remoteApplyNonce: 0,
  activeRemoteApplyNonce: 0,
  hostStartInFlight: false,
  hostSetupInFlight: false,
  roomStatus: null,
};

let gameplayPersistDebounceTimer = null;
let gameplayViewportGuardsAttached = false;
let gameplayScrollLockY = 0;
let activeQuestionImageViewport = null;
let pendingHomepageGroupMode = null;
let pendingLocalResumePayload = null;

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
  const players = room.players && typeof room.players === "object" ? room.players : {};
  Object.entries(players).forEach(([uid, rawRecord]) => {
    const slot = Number(rawRecord?.teamIndex);
    if (slot >= 1 && slot <= 3 && !slots[slot]) slots[slot] = normalizeCell(uid) || null;
  });
  return slots;
}

function normalizeParticipantConnections(room = {}) {
  const connections = buildEmptyParticipantConnections();
  const players = room.players && typeof room.players === "object" ? room.players : {};
  Object.values(players).forEach((rawRecord) => {
    const slot = Number(rawRecord?.teamIndex);
    if (slot >= 1 && slot <= 3) connections[slot] = !!rawRecord?.connected;
  });
  return connections;
}

function normalizeParticipantRecords(room = {}) {
  const records = buildEmptyParticipantRecords();
  const players = room.players && typeof room.players === "object" ? room.players : {};
  Object.entries(players).forEach(([uid, rawRecord]) => {
    const slot = Number(rawRecord?.teamIndex);
    if (!(slot >= 1 && slot <= 3)) return;
    records[slot] = {
      uid: normalizeCell(uid),
      clientId: normalizeCell(rawRecord?.clientId),
      displayName: normalizeCell(rawRecord?.name),
      connected: !!rawRecord?.connected,
      joinedAt: Number(rawRecord?.joinedAt) || null,
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
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${DEPLOY_VERSION}`, { updateViaCache: "none" });

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
  answerPrefetchPromises: new Map(),
  nextQuestionByTileId: new Map(),
  nextQuestionPromiseByTileId: new Map(),
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
  return true;
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
  const lockByVideo = state.videoQuestionPending;
  const lockByTimeout = !!state.activeTile?.timedOut;
  const lockByTurn = online.mode === "online" && !canCurrentClientAct();
  const lockByReveal = (hasUnresolvedActiveQuestion() && !state.answerRevealed) || lockByVideo;
  const lockByResolution = state.questionResolutionLocked;
  const disableAnsweringActions = lockByTimeout || lockByTurn;
  const disableScoringActions = lockByTimeout || lockByTurn || lockByResolution;
  const lockByOtherTeamSelection = state.pendingOtherTeamSelection || state.resolvingOtherTeam;
  el.revealBtn.disabled = disableAnsweringActions || state.answerRevealed || lockByVideo;
  el.correctBtn.disabled = disableScoringActions || lockByReveal;
  el.wrongBtn.disabled = disableScoringActions || lockByReveal;
  const soloNoOtherTeam = online.mode === "local" && state.teamCount === 1;
  el.otherTeamBtn.disabled = disableScoringActions || lockByReveal || soloNoOtherTeam || lockByOtherTeamSelection;
  el.lifelineBtn.disabled = disableAnsweringActions || state.answerRevealed || hasUsedLifeline(state.currentTeam, "mcq") || lockByVideo;
  el.hintLifelineBtn.disabled = disableAnsweringActions || state.answerRevealed || hasUsedLifeline(state.currentTeam, "hint") || lockByVideo;
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
  if (online.mode === "online" && !isOnlineHostClient()) return;
  const tile = state.activeTile;
  if (!tile || tile.used || !state.activeQuestion || tile.timedOut || state.answerRevealed) return;
  timerStart = Date.now() - QUESTION_TIMEOUT_MS;
  updateTimerUI();
  stopTimer();
  showQuestionStatus("انتهى الوقت");
  resolveActiveQuestion({
    timedOut: true,
    nextTeam: getNextTeamNumber(getQuestionTurnOwnerIndex()),
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
  if (online.mode !== "online" || isOnlineHostClient()) {
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
function getEligibleOtherTeams(currentTeam = state.currentTeam) {
  return getActiveTeamNumbers().filter((team) => team !== currentTeam);
}
function closeOtherTeamSelector() {
  state.pendingOtherTeamSelection = false;
  if (!el.otherTeamSelector || !el.otherTeamChoices) return;
  el.otherTeamSelector.classList.add("hidden");
  el.otherTeamChoices.innerHTML = "";
}
function openOtherTeamSelector() {
  if (!el.otherTeamSelector || !el.otherTeamChoices) return;
  const eligibleTeams = getEligibleOtherTeams(state.currentTeam);
  if (eligibleTeams.length <= 1) return;
  state.pendingOtherTeamSelection = true;
  el.otherTeamChoices.innerHTML = "";
  eligibleTeams.forEach((team) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn";
    button.dataset.team = String(team);
    button.textContent = state.teamNames[team] || `الفريق ${team}`;
    el.otherTeamChoices.appendChild(button);
  });
  el.otherTeamSelector.classList.remove("hidden");
}
function handleOtherTeamSelection(teamNumber) {
  if (online.mode === "online" && !canCurrentClientAct()) return;
  const selectedTeam = Number(teamNumber);
  const eligibleTeams = getEligibleOtherTeams(state.currentTeam);
  if (!eligibleTeams.includes(selectedTeam) || state.resolvingOtherTeam) return;
  if (online.mode === "online" && !isOnlineHostClient()) {
    requestHostScoreAction({ action: "other", targetTeam: selectedTeam });
    closeOtherTeamSelector();
    updateQuestionActionLock();
    return;
  }
  state.resolvingOtherTeam = true;
  state.pendingOtherTeamSelection = false;
  state.pendingScoreTeamIndex = selectedTeam;
  if (el.otherTeamChoices) {
    el.otherTeamChoices.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
  }
  resolveActiveQuestion({
    preventTimeoutAction: true,
    scoreAction: {
      teamIndex: selectedTeam,
      delta: state.activeTile?.points ?? 0,
      reason: "other-team-selection",
    },
    nextTeam: getNextTeamNumber(getQuestionTurnOwnerIndex()),
  });
  state.resolvingOtherTeam = false;
}
function normalizeTeamCount(teamCount) {
  const normalized = Number(teamCount);
  return SUPPORTED_TEAM_COUNTS.includes(normalized) ? normalized : 2;
}
function getRequiredCategoryCount() {
  return (online.mode === "local" && state.teamCount === 1) ? SOLO_CATEGORIES_TO_SELECT : DEFAULT_CATEGORIES_TO_SELECT;
}
function shouldShowHostCategorySelectionCTA() {
  const isOnlineHost = online.mode === "online" && online.role === "host";
  const normalizedRoomStatus = normalizeCell(online.roomStatus);
  const isPreGameRoomState = normalizedRoomStatus !== "playing" && normalizedRoomStatus !== "ended";
  const isPreCategorySelectionState = isPreGameRoomState && state.boardTiles.length === 0;
  const categoriesNotSelected = state.selectedCategories.length === 0;
  const categoryPickerClosed = el.categoryModal.classList.contains("hidden");
  return isOnlineHost && isPreCategorySelectionState && categoriesNotSelected && categoryPickerClosed;
}
function updateHostCategorySelectionCTA() {
  const showHostCategoryCta = shouldShowHostCategorySelectionCTA();
  if (el.newGameBtn) {
    el.newGameBtn.textContent = showHostCategoryCta ? HOST_CATEGORY_CTA_BUTTON_TEXT : NEW_GAME_BUTTON_TEXT;
  }
  if (el.hostCategoryCtaHint) {
    el.hostCategoryCtaHint.classList.toggle("hidden", !showHostCategoryCta);
  }
}
function getCategoryModalTitleText() {
  const required = getRequiredCategoryCount();
  if (online.mode === "local" && state.teamCount === 1) {
    return `اختر ${required} فئات لبدء اللعب الفردي`;
  }
  return `اختر ${required} ${required === 1 ? "فئة" : "فئات"} لبدء اللعبة`;
}
function getNextTeamNumber(team) {
  const activeTeams = getActiveTeamNumbers();
  const index = activeTeams.indexOf(team);
  if (index === -1) return activeTeams[0] || 1;
  return activeTeams[(index + 1) % activeTeams.length];
}
function getQuestionTurnOwnerIndex() {
  const activeTeams = getActiveTeamNumbers();
  const turnOwner = Number(state.questionTurnOwnerIndex);
  if (activeTeams.includes(turnOwner)) return turnOwner;
  const answeringTeam = Number(state.answeringTeamIndex);
  if (activeTeams.includes(answeringTeam)) return answeringTeam;
  return activeTeams.includes(Number(state.currentTeam)) ? Number(state.currentTeam) : (activeTeams[0] || 1);
}
function setLocalTeamCount(teamCount) {
  state.teamCount = normalizeTeamCount(teamCount);
  if (state.teamCount === 1 && normalizeCell(state.teamNames[1]) === "الفريق الأول") {
    state.teamNames[1] = "اللاعب";
  }
  if (state.teamCount !== 1 && normalizeCell(state.teamNames[1]) === "اللاعب") {
    state.teamNames[1] = "الفريق الأول";
  }
  updateOnlineActionPermissions();
}
function updateTeamModeUI() {
  const isOneTeam = state.teamCount === 1;
  const isThreeTeams = state.teamCount === 3;
  if (el.localTeamsModalTitle) {
    el.localTeamsModalTitle.textContent = "كم عدد الفرق في اللعب الجماعي؟";
  }
  document.body.classList.toggle("local-three-teams", isThreeTeams && online.mode !== "online");
  el.team2Card.classList.toggle("hidden", isOneTeam);
  el.team3Card.classList.toggle("hidden", !isThreeTeams);
  if (el.categoryTeam1NameLabel) {
    el.categoryTeam1NameLabel.textContent = isOneTeam ? "اسم اللاعب" : "اسم الفريق الأول";
  }
  if (el.categoryTeam1NameInput) {
    el.categoryTeam1NameInput.placeholder = isOneTeam ? "اللاعب" : "الفريق الأول";
  }
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
function applyScoreToTeam(teamIndex, delta, reason = "manual") {
  const normalizedTeamIndex = Number(teamIndex);
  if (!getActiveTeamNumbers().includes(normalizedTeamIndex)) return false;
  const safeDelta = Number(delta) || 0;
  if (!safeDelta) return false;
  state.scores[normalizedTeamIndex] = Math.max(0, (Number(state.scores[normalizedTeamIndex]) || 0) + safeDelta);
  const questionId = normalizeCell(state.activeQuestion?.id || state.activeTile?.questionId || state.activeTile?.id);
  console.log("[Tasleya][score]", {
    questionId,
    currentTeamIndex: state.currentTeam,
    targetTeamIndex: normalizedTeamIndex,
    delta: safeDelta,
    source: reason,
  });
  return true;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeCell(value);
    if (normalized) return normalized;
  }
  return "";
}

function normalizeUsedHistoryByCategory(rawHistory) {
  if (!rawHistory || typeof rawHistory !== "object" || Array.isArray(rawHistory)) return {};
  const normalized = {};
  Object.entries(rawHistory).forEach(([category, usedIds]) => {
    const normalizedCategory = normalizeCell(category);
    if (!normalizedCategory || !Array.isArray(usedIds)) return;
    normalized[normalizedCategory] = uniqueByText(usedIds.map(normalizeCell).filter(Boolean));
  });
  return normalized;
}
function getRoomUsedQuestionHistory(room = {}) {
  const gameState = room?.public?.gameState;
  return normalizeUsedHistoryByCategory(
    gameState?.[ROOM_USED_HISTORY_FIELD]
    || gameState?.[LEGACY_ROOM_USED_HISTORY_FIELD]
  );
}
function getQuestionHistoryId(question, { category = "", points = null } = {}) {
  const normalizedDirectId = firstNonEmpty(question?.id, question?.questionId);
  if (normalizedDirectId) return normalizedDirectId;
  const normalizedCategory = firstNonEmpty(question?.category, category);
  const normalizedPoints = Number(question?.points ?? points);
  const normalizedPrompt = firstNonEmpty(question?.question, question?.text, question?.prompt, question?.question_text);
  const normalizedAnswer = firstNonEmpty(question?.answer, question?.correctAnswer, question?.correct_answer);
  const normalizedChoices = Array.isArray(question?.choices)
    ? question.choices.map(normalizeCell).filter(Boolean).join("|")
    : "";
  return `fallback:${[normalizedCategory, Number.isFinite(normalizedPoints) ? normalizedPoints : "", normalizedPrompt, normalizedAnswer, normalizedChoices].join("::")}`;
}
function loadUsedHistory() {
  try {
    const currentRaw = safeStorageGet(localStorage, USED_QUESTIONS_BY_CATEGORY_STORAGE_KEY);
    const legacyRaw = safeStorageGet(localStorage, LEGACY_USED_QUESTIONS_BY_CATEGORY_STORAGE_KEY);
    if (!currentRaw && !legacyRaw) return {};
    const sourceRaw = currentRaw || legacyRaw;
    const normalized = normalizeUsedHistoryByCategory(JSON.parse(sourceRaw));
    if (!currentRaw && legacyRaw) {
      safeStorageSet(localStorage, USED_QUESTIONS_BY_CATEGORY_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return {};
  }
}
function saveUsedHistory() {
  safeStorageSet(localStorage, USED_QUESTIONS_BY_CATEGORY_STORAGE_KEY, JSON.stringify(state.usedHistory));
}
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
    localStorage.removeItem(LOCAL_PROGRESS_STORAGE_KEY);
  } catch (_) {
    // Ignore storage errors silently.
  }
}

function loadSavedLocalProgress() {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.mode !== "local") return null;
    if (Number(saved.schemaVersion) !== LOCAL_PROGRESS_SCHEMA_VERSION) return null;
    return saved;
  } catch (_) {
    return null;
  }
}

function isSavedLocalProgressResumable(saved) {
  if (!saved || saved.mode !== "local") return false;
  if (!Array.isArray(saved.selectedCategories) || !saved.selectedCategories.length) return false;
  if (!Array.isArray(saved.boardTiles) || saved.boardTiles.length === 0) return false;
  const hasPlayableTile = saved.boardTiles.some((tile) => tile && !tile.used && !tile.missing);
  const questionInFlight = !!normalizeCell(saved.activeTileId) && !saved.finished;
  return !!(hasPlayableTile || questionInFlight) && !saved.finished;
}

function cleanupQuestionImageZoomViewport() {
  if (!activeQuestionImageViewport || typeof activeQuestionImageViewport.cleanup !== "function") return;
  activeQuestionImageViewport.cleanup();
  activeQuestionImageViewport = null;
}

function clampQuestionImagePan(scale, viewport, image, rawX, rawY) {
  if (!viewport || !image || scale <= 1) return { x: 0, y: 0 };
  const viewportRect = viewport.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  const baseImageWidth = imageRect.width / scale;
  const baseImageHeight = imageRect.height / scale;
  const maxX = Math.max(0, ((baseImageWidth * scale) - viewportRect.width) / 2);
  const maxY = Math.max(0, ((baseImageHeight * scale) - viewportRect.height) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, rawX)),
    y: Math.max(-maxY, Math.min(maxY, rawY)),
  };
}

function createQuestionImageZoomViewport(imageSrc) {
  const viewport = document.createElement("div");
  viewport.className = "question-image-viewport";
  viewport.setAttribute("aria-label", "تكبير وتحريك صورة السؤال");

  const image = document.createElement("img");
  image.id = "questionImage";
  image.alt = "صورة السؤال";
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = "high";
  image.draggable = false;
  image.src = imageSrc;
  viewport.appendChild(image);

  const zoomState = {
    scale: 1,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    pinchDistance: 0,
    pinchScale: 1,
    isDragging: false,
    isPinching: false,
  };

  const applyTransform = () => {
    image.style.transform = `translate3d(${zoomState.x}px, ${zoomState.y}px, 0) scale(${zoomState.scale})`;
  };

  const getTouchDistance = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (event) => {
    if (!event.touches || event.touches.length === 0) return;
    if (event.touches.length === 1) {
      zoomState.isDragging = zoomState.scale > 1;
      zoomState.startX = event.touches[0].clientX - zoomState.x;
      zoomState.startY = event.touches[0].clientY - zoomState.y;
    } else if (event.touches.length >= 2) {
      zoomState.isPinching = true;
      zoomState.pinchDistance = getTouchDistance(event.touches);
      zoomState.pinchScale = zoomState.scale;
    }
  };

  const handleTouchMove = (event) => {
    if (!event.touches || event.touches.length === 0) return;
    if (event.touches.length >= 2) {
      event.preventDefault();
      const distance = getTouchDistance(event.touches);
      if (!distance || !zoomState.pinchDistance) return;
      const nextScale = Math.min(4, Math.max(1, zoomState.pinchScale * (distance / zoomState.pinchDistance)));
      zoomState.scale = nextScale;
      const nextPan = clampQuestionImagePan(zoomState.scale, viewport, image, zoomState.x, zoomState.y);
      zoomState.x = nextPan.x;
      zoomState.y = nextPan.y;
      applyTransform();
      return;
    }
    if (!zoomState.isDragging || zoomState.scale <= 1) return;
    event.preventDefault();
    const touch = event.touches[0];
    const rawX = touch.clientX - zoomState.startX;
    const rawY = touch.clientY - zoomState.startY;
    const nextPan = clampQuestionImagePan(zoomState.scale, viewport, image, rawX, rawY);
    zoomState.x = nextPan.x;
    zoomState.y = nextPan.y;
    applyTransform();
  };

  const handleTouchEnd = (event) => {
    if (!event.touches || event.touches.length === 0) {
      zoomState.isDragging = false;
      zoomState.isPinching = false;
      return;
    }
    if (event.touches.length === 1) {
      zoomState.isPinching = false;
      zoomState.isDragging = zoomState.scale > 1;
      zoomState.startX = event.touches[0].clientX - zoomState.x;
      zoomState.startY = event.touches[0].clientY - zoomState.y;
    }
  };

  viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
  viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
  viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
  viewport.addEventListener("touchcancel", handleTouchEnd, { passive: true });

  activeQuestionImageViewport = {
    cleanup: () => {
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
    },
  };

  return { viewport, image };
}

function scheduleGameplayProgressPersist(delayMs = 120) {
  if (gameplayPersistDebounceTimer !== null) {
    clearTimeout(gameplayPersistDebounceTimer);
  }
  gameplayPersistDebounceTimer = window.setTimeout(() => {
    gameplayPersistDebounceTimer = null;
    persistLocalProgress();
  }, Math.max(0, Number(delayMs) || 0));
}

function handleViewportGeometryChange() {
  if (el.gameScreen?.style.display !== "block") return;
  scheduleGameplayProgressPersist(160);
  if (online.mode === "online" && online.roomRef && online.teamSlot) {
    online.roomRef.update(buildPresencePayload(online.teamSlot)).catch(() => {});
  }
}

function attachGameplayViewportGuards() {
  if (gameplayViewportGuardsAttached) return;
  window.addEventListener("resize", handleViewportGeometryChange, { passive: true });
  window.addEventListener("orientationchange", handleViewportGeometryChange, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportGeometryChange, { passive: true });
    window.visualViewport.addEventListener("scroll", handleViewportGeometryChange, { passive: true });
  }
  gameplayViewportGuardsAttached = true;
}

function detachGameplayViewportGuards() {
  if (!gameplayViewportGuardsAttached) return;
  window.removeEventListener("resize", handleViewportGeometryChange);
  window.removeEventListener("orientationchange", handleViewportGeometryChange);
  if (window.visualViewport) {
    window.visualViewport.removeEventListener("resize", handleViewportGeometryChange);
    window.visualViewport.removeEventListener("scroll", handleViewportGeometryChange);
  }
  gameplayViewportGuardsAttached = false;
}

function lockGameplayPageScroll() {
  gameplayScrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.style.position = "fixed";
  document.body.style.top = `-${gameplayScrollLockY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockGameplayPageScroll() {
  const lockedY = Number(gameplayScrollLockY) || 0;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, lockedY);
}

function ensureStableOnlineClientId() {
  if (online.clientId) return online.clientId;
  const existing = normalizeCell(safeStorageGet(localStorage, ONLINE_CLIENT_ID_STORAGE_KEY));
  if (existing) {
    online.clientId = existing;
    return online.clientId;
  }
  const generated = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  online.clientId = generated;
  safeStorageSet(localStorage, ONLINE_CLIENT_ID_STORAGE_KEY, generated);
  return online.clientId;
}

function persistLocalProgress() {
  if (online.mode !== "local") {
    clearLocalProgress();
    return;
  }
  const hasBoard = state.boardTiles.length > 0 && state.selectedCategories.length === getRequiredCategoryCount();
  if (!hasBoard) return;

  const payload = {
    schemaVersion: LOCAL_PROGRESS_SCHEMA_VERSION,
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
    lifelinesUsed: normalizeLifelinesUsed(lifelinesUsed),
    activeTileId: state.activeTile?.id || null,
    activeQuestionId: state.activeQuestion?.id || state.activeTile?.questionId || null,
    activeCategory: state.activeTile?.category || null,
    questionTurnOwnerIndex: state.activeTile ? Number(state.questionTurnOwnerIndex || state.answeringTeamIndex || state.currentTeam) : null,
    modalOpen: !el.modal?.classList.contains("hidden") && !!state.activeTile,
    questionDeadlineTs: state.activeTile && questionDeadlineTs ? questionDeadlineTs : null,
    questionStartedAt: state.activeTile && timerStart ? timerStart : null,
    timerRemainingMs: state.activeTile && questionDeadlineTs ? Math.max(0, questionDeadlineTs - Date.now()) : null,
    finished: state.boardTiles.length > 0 && state.boardTiles.every((tile) => tile.used || tile.missing),
    lastSavedAt: Date.now(),
  };

  try {
    localStorage.setItem(LOCAL_PROGRESS_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // Ignore storage errors silently.
  }
}

function applySavedLocalProgress(saved) {
  try {
    if (!saved || saved.mode !== "local" || saved.screen !== "game") return false;
    const savedTeamCount = normalizeTeamCount(saved.teamCount);
    const requiredCategories = savedTeamCount === 1 ? SOLO_CATEGORIES_TO_SELECT : DEFAULT_CATEGORIES_TO_SELECT;
    if (!Array.isArray(saved.selectedCategories) || saved.selectedCategories.length !== requiredCategories) return false;
    if (!Array.isArray(saved.boardTiles) || saved.boardTiles.length === 0) return false;

    state.selectedCategories = [...saved.selectedCategories];
    state.pointLevels = Array.isArray(saved.pointLevels) && saved.pointLevels.length ? [...saved.pointLevels] : [...POINT_LEVELS];
    state.boardTiles = [...saved.boardTiles];
    setLocalTeamCount(savedTeamCount);
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
    lifelinesUsed = normalizeLifelinesUsed(saved.lifelinesUsed || {
      1: { hint: !!saved.hintHelpUsed?.[1], mcq: !!saved.mcqHelpUsed?.[1] },
      2: { hint: !!saved.hintHelpUsed?.[2], mcq: !!saved.mcqHelpUsed?.[2] },
      3: { hint: !!saved.hintHelpUsed?.[3], mcq: !!saved.mcqHelpUsed?.[3] },
    });
    state.activeQuestion = null;
    state.questionTurnOwnerIndex = null;
    state.resolvedQuestionSessionId = "";

    showGameScreen();
    updateTeamModeUI();
    syncTeamNameInputs();
    updateScoreboard();
    renderBoard();
    prefetchLikelyNextQuestion();

    const savedActiveId = normalizeCell(saved.activeTileId);
    if (saved.modalOpen && savedActiveId) {
      const timerRemainingMs = Number(saved.timerRemainingMs);
      const restoredDeadline = Number.isFinite(timerRemainingMs)
        ? (Date.now() + Math.min(QUESTION_TIMEOUT_MS, Math.max(1000, timerRemainingMs)))
        : null;
      const restoredStart = Number(saved.questionStartedAt);
      const fallbackDeadline = Number.isFinite(restoredStart) ? (Date.now() + QUESTION_TIMEOUT_MS) : null;
      openQuestion(savedActiveId, {
        restored: true,
        deadlineTs: Number.isFinite(restoredDeadline) ? restoredDeadline : fallbackDeadline,
        questionId: saved.activeQuestionId,
        turnOwnerIndex: Number(saved.questionTurnOwnerIndex),
      });
    }

    return true;
  } catch (_) {
    return false;
  }
}

function restoreLocalProgress() {
  if (new URL(window.location.href).searchParams.get("room")) return false;
  const saved = loadSavedLocalProgress();
  if (!isSavedLocalProgressResumable(saved)) return false;
  return applySavedLocalProgress(saved);
}
function ensureCategoryHistoryBucket(category) {
  const normalizedCategory = normalizeCell(category);
  if (!normalizedCategory) return [];
  if (!Array.isArray(state.usedHistory[normalizedCategory])) state.usedHistory[normalizedCategory] = [];
  return state.usedHistory[normalizedCategory];
}
function ensureOnlineCategoryHistoryBucket(category) {
  const normalizedCategory = normalizeCell(category);
  if (!normalizedCategory) return [];
  if (!online.usedQuestionsByCategory || typeof online.usedQuestionsByCategory !== "object" || Array.isArray(online.usedQuestionsByCategory)) {
    online.usedQuestionsByCategory = {};
  }
  if (!Array.isArray(online.usedQuestionsByCategory[normalizedCategory])) online.usedQuestionsByCategory[normalizedCategory] = [];
  return online.usedQuestionsByCategory[normalizedCategory];
}
async function syncOnlineUsedCategoryHistory(category, { questionId = "", reset = false } = {}) {
  const normalizedCategory = normalizeCell(category);
  const normalizedQuestionId = normalizeCell(questionId);
  if (online.mode !== "online" || !online.roomRef || !normalizedCategory || online.applyingRemote || !isOnlineHostClient()) return;
  const usedHistoryRef = online.roomRef.child(`public/gameState/${ROOM_USED_HISTORY_FIELD}`);
  const result = await usedHistoryRef.transaction((rawHistory) => {
    const history = normalizeUsedHistoryByCategory(rawHistory);
    const bucket = Array.isArray(history[normalizedCategory]) ? history[normalizedCategory] : [];
    if (reset) {
      history[normalizedCategory] = [];
      return history;
    }
    if (!normalizedQuestionId) return history;
    if (!bucket.includes(normalizedQuestionId)) {
      history[normalizedCategory] = [...bucket, normalizedQuestionId];
    }
    return history;
  });
  if (result?.committed) {
    online.usedQuestionsByCategory = normalizeUsedHistoryByCategory(result.snapshot?.val());
  }
}
function markQuestionAsUsed(category, questionId) {
  const normalizedQuestionId = normalizeCell(questionId);
  if (online.mode !== "local" || !normalizedQuestionId) return;
  const bucket = ensureCategoryHistoryBucket(category);
  if (!bucket.includes(normalizedQuestionId)) {
    bucket.push(normalizedQuestionId);
    saveUsedHistory();
  }
}
function clearUsedCategoryHistory(category) {
  const normalizedCategory = normalizeCell(category);
  if (!normalizedCategory || !state.usedHistory[normalizedCategory]) return;
  state.usedHistory[normalizedCategory] = [];
  saveUsedHistory();
}
function getAssignedQuestionIds() {
  return state.boardTiles
    .map((tile) => normalizeCell(tile.questionId))
    .filter(Boolean);
}
function getExcludedQuestionIds(category) {
  const acrossGames = online.mode === "online"
    ? ensureOnlineCategoryHistoryBucket(category)
    : ensureCategoryHistoryBucket(category);
  const inCurrentGame = state.boardTiles
    .filter((tile) => tile.category === category)
    .map((tile) => firstNonEmpty(tile.questionHistoryId, tile.questionId))
    .filter(Boolean);
  return uniqueByText([...acrossGames, ...inCurrentGame]);
}
function getReservedQuestionIds(category, { ignoreTileId = "" } = {}) {
  const normalizedCategory = normalizeCell(category);
  const normalizedIgnoreTileId = normalizeCell(ignoreTileId);
  if (!normalizedCategory) return [];
  return state.boardTiles
    .filter((tile) => tile.category === normalizedCategory && !tile.used && !tile.missing && tile.id !== normalizedIgnoreTileId)
    .map((tile) => normalizeCell(tile.questionId))
    .filter(Boolean);
}
async function fetchQuestionPayload({
  id = "",
  category = "",
  points = null,
  resetUsedBucketOnExhaustion = false,
  ignoreTileId = "",
  preferFullCategoryPool = false,
} = {}) {
  const normalizedId = normalizeCell(id);
  if (normalizedId && questionBankCache.questionsById.has(normalizedId)) {
    return questionBankCache.questionsById.get(normalizedId);
  }

  const normalizedCategory = normalizeCell(category);
  const normalizedPoints = Number(points) || null;
  const shouldExcludeUsedByCategory = online.mode === "local" || online.mode === "online";
  const excludeIds = (!normalizedId && shouldExcludeUsedByCategory)
    ? uniqueByText([...getExcludedQuestionIds(normalizedCategory), ...getReservedQuestionIds(normalizedCategory, { ignoreTileId })])
    : [];
  const requestFullCategoryPool = preferFullCategoryPool || normalizedPoints === null;

  try {
    const response = await apiFetchJson("/question", {
      params: normalizedId
        ? { id: normalizedId }
        : {
          category: normalizedCategory,
          points: requestFullCategoryPool ? null : normalizedPoints,
          exclude_ids: excludeIds.join(","),
        },
    });
    console.log("[Tasleya] Raw /question response", response);
    const question = response?.question ?? null;
    console.log("[Tasleya] Resolved question payload", question);
    if (!question) {
      const invalidShapeError = new Error("تعذّر معالجة استجابة السؤال (بنية غير متوقعة).");
      invalidShapeError.code = "QUESTION_RESPONSE_SHAPE_INVALID";
      throw invalidShapeError;
    }
    const normalizedQuestionId = normalizeCell(question.id);
    if (normalizedQuestionId) {
      questionBankCache.questionsById.set(normalizedQuestionId, question);
    }
    return question;
  } catch (error) {
    const isExhaustedPool = error?.status === 404 && error?.payload?.code === "QUESTION_POOL_EXHAUSTED";
    if (!normalizedId && shouldExcludeUsedByCategory && isExhaustedPool && !resetUsedBucketOnExhaustion) {
      if (!requestFullCategoryPool && normalizedPoints !== null) {
        return fetchQuestionPayload({
          category: normalizedCategory,
          points: normalizedPoints,
          preferFullCategoryPool: true,
        });
      }
      if (online.mode === "online") {
        await syncOnlineUsedCategoryHistory(normalizedCategory, { reset: true });
      } else {
        clearUsedCategoryHistory(normalizedCategory);
      }
      return fetchQuestionPayload({
        category: normalizedCategory,
        points: null,
        preferFullCategoryPool: true,
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
function prefetchAnswerPayload(questionId) {
  const normalizedId = normalizeCell(questionId);
  if (!normalizedId || questionBankCache.answersById.has(normalizedId)) {
    return Promise.resolve(questionBankCache.answersById.get(normalizedId) || null);
  }
  if (questionBankCache.answerPrefetchPromises.has(normalizedId)) {
    return questionBankCache.answerPrefetchPromises.get(normalizedId);
  }
  const promise = fetchAnswerPayload(normalizedId)
    .catch((error) => {
      console.warn("[Tasleya] Answer prefetch failed", { questionId: normalizedId, error });
      return null;
    })
    .finally(() => {
      questionBankCache.answerPrefetchPromises.delete(normalizedId);
    });
  questionBankCache.answerPrefetchPromises.set(normalizedId, promise);
  return promise;
}
function getNextPlayableTile({ excludeTileId = "" } = {}) {
  const normalizedExcludeTileId = normalizeCell(excludeTileId);
  return state.boardTiles.find((tile) => !tile.used && !tile.missing && tile.id !== normalizedExcludeTileId) || null;
}
function prefetchQuestionForTile(tile, { highPriority = false } = {}) {
  if (!tile || tile.used || tile.missing) return Promise.resolve(null);
  const tileId = normalizeCell(tile.id);
  if (!tileId) return Promise.resolve(null);
  if (questionBankCache.nextQuestionByTileId.has(tileId)) {
    return Promise.resolve(questionBankCache.nextQuestionByTileId.get(tileId));
  }
  if (questionBankCache.nextQuestionPromiseByTileId.has(tileId)) {
    return questionBankCache.nextQuestionPromiseByTileId.get(tileId);
  }
  const promise = fetchQuestionPayload({
    id: tile.questionId,
    category: tile.category,
    points: tile.points,
    ignoreTileId: tileId,
  })
    .then((question) => {
      if (!question) return null;
      const normalizedQuestionId = normalizeCell(question.id);
      if (normalizedQuestionId && !normalizeCell(tile.questionId)) {
        tile.questionId = normalizedQuestionId;
      }
      questionBankCache.nextQuestionByTileId.set(tileId, question);
      if (highPriority) {
        warmQuestionMedia(question, { highPriority: true });
        prefetchAnswerPayload(question.id);
      }
      return question;
    })
    .catch((error) => {
      console.warn("[Tasleya] Question prefetch failed", { tileId, error });
      return null;
    })
    .finally(() => {
      questionBankCache.nextQuestionPromiseByTileId.delete(tileId);
    });
  questionBankCache.nextQuestionPromiseByTileId.set(tileId, promise);
  return promise;
}
function prefetchLikelyNextQuestion({ excludeTileId = "" } = {}) {
  const nextTile = getNextPlayableTile({ excludeTileId });
  if (!nextTile) return;
  prefetchQuestionForTile(nextTile, { highPriority: false });
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
        questionHistoryId: null,
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
function isIPhoneSafariBrowser() {
  const ua = navigator.userAgent || "";
  const isIPhone = /iPhone/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(ua);
  return isIPhone && isSafari;
}
function openWhatsappShare() {
  const shareText = buildArabicShareMessage();
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  let pageHidden = document.visibilityState === "hidden";
  const markPageHidden = () => {
    pageHidden = true;
  };
  document.addEventListener("visibilitychange", markPageHidden);
  window.addEventListener("pagehide", markPageHidden);
  const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");

  const showFallbackHint = () => {
    document.removeEventListener("visibilitychange", markPageHidden);
    window.removeEventListener("pagehide", markPageHidden);
    if (pageHidden || isIPhoneSafariBrowser()) return;
    setResultShareFeedback("إذا لم يفتح واتساب، جرّب نسخ النص.", "neutral");
  };

  if (!popup) {
    window.setTimeout(showFallbackHint, 2200);
    return false;
  }

  window.setTimeout(showFallbackHint, 1800);
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
  if (online.mode === "online") {
    console.log("[Tasleya][renderBoard] render run", {
      activeTileId: state.activeTile?.id || null,
      activeQuestionId: state.activeQuestion?.id || null,
      loadingQuestion: !!state.loadingQuestion,
      modalOpen: !el.modal?.classList.contains("hidden"),
    });
  }
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
      const turnLocked = online.mode === "online" && !canCurrentClientAct();
      if (tile.missing) { btn.textContent = "نقص أسئلة"; btn.disabled = true; btn.classList.add("missing", "used"); }
      else if (tile.used) { btn.textContent = ""; btn.disabled = true; btn.classList.add("used"); }
      else { btn.textContent = String(points); btn.disabled = turnLocked; }
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
  const nextTile = getNextPlayableTile();
  if (!nextTile) return;
  const candidate = questionBankCache.nextQuestionByTileId.get(nextTile.id)
    || questionBankCache.questionsById.get(nextTile.questionId);
  if (!candidate) return;
  warmQuestionMedia(candidate, { highPriority: false });
}
function syncDocumentRootStateClass(className, shouldEnable) {
  if (!className) return;
  document.documentElement.classList.toggle(className, !!shouldEnable);
}

function clearQuestionMedia() {
  const currentAudio = el.questionMedia.querySelector("audio");
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
  const currentVideo = el.questionMedia.querySelector("video");
  if (currentVideo) { currentVideo.pause(); }
  cleanupQuestionImageZoomViewport();
  document.body.classList.remove("image-question-active");
  syncDocumentRootStateClass("image-question-active", false);
  el.modal?.classList.remove("image-question-active");
  el.questionMedia.classList.remove("map-question-media");
  el.questionMedia.innerHTML = "";
}
function renderQuestionContent(question, { resetLifecycleState = true } = {}) {
  const normalizedType = normalizeCell(question?.type).toLowerCase();
  const isVideoQuestion = normalizedType === "video";
  state.videoQuestionPending = isVideoQuestion;
  state.videoPlaybackCompleted = !isVideoQuestion;
  state.pendingVideoDeadlineTs = null;
  el.questionText.textContent = isVideoQuestion ? "شاهد الفيديو مرة واحدة، ثم سيظهر السؤال" : question.question;
  if (resetLifecycleState) {
    el.answerText.textContent = "الإجابة: ...";
    el.answerText.classList.add("hidden");
    state.answerRevealed = false;
    state.revealRequested = false;
    el.choicesBox.classList.add("hidden");
    el.choicesList.innerHTML = "";
    state.currentChoices = [];
    state.currentHintText = "";
    state.pendingScoreTeamIndex = null;
    state.questionResolutionLocked = false;
    el.hintText.textContent = "";
    el.hintBox.classList.add("hidden");
  }
  showQuestionStatus("");
  updateLateOtherTeamPrompt();
  if (question.type === "image" && question.image_url) renderQuestionImage(question.image_url, question);
  if (question.type === "audio" && question.image_url) renderQuestionAudio(question.image_url);
  if (isVideoQuestion) renderQuestionVideo(question.image_url, question);
  el.lifelineBtn.disabled = hasUsedLifeline(state.currentTeam, "mcq") || (online.mode === "online" && !canCurrentClientAct());
  el.hintLifelineBtn.disabled = hasUsedLifeline(state.currentTeam, "hint") || (online.mode === "online" && !canCurrentClientAct());
  updateQuestionActionLock();
}

function renderQuestionImage(imagePath, question = null) {
  const imageSrc = toMediaUrl(imagePath); if (!imageSrc) return;
  document.body.classList.add("image-question-active");
  syncDocumentRootStateClass("image-question-active", true);
  el.modal?.classList.add("image-question-active");

  const { viewport, image } = createQuestionImageZoomViewport(imageSrc);
  if (normalizeCell(question?.category) === MAP_QUESTION_CATEGORY) {
    el.questionMedia.classList.add("map-question-media");
    image.classList.add("map-question-image");
  }
  el.questionMedia.appendChild(viewport);

}
function renderQuestionAudio(audioPath) {
  const audioSrc = toMediaUrl(audioPath); if (!audioSrc) return;
  const audio = document.createElement("audio"); audio.id = "questionAudio"; audio.controls = true; audio.preload = "metadata"; audio.setAttribute("aria-label", "مشغل صوت السؤال");
  audio.innerHTML = `<source src="${audioSrc}" type="audio/mpeg">`; el.questionMedia.appendChild(audio);
}
function revealVideoQuestionAfterPlayback(question) {
  if (!state.videoQuestionPending || !question) return;
  state.videoQuestionPending = false;
  state.videoPlaybackCompleted = true;
  el.questionText.textContent = question.question;
  const pendingDeadline = Number(state.pendingVideoDeadlineTs);
  state.pendingVideoDeadlineTs = null;
  if (pendingDeadline && pendingDeadline <= Date.now()) {
    showQuestionStatus("انتهى الوقت");
    startTimer({ deadlineTs: Date.now() + 10 });
    handleQuestionTimeout();
  } else {
    showQuestionStatus("");
    startTimer({ deadlineTs: Number.isFinite(pendingDeadline) ? pendingDeadline : null });
  }
  updateQuestionActionLock();
  persistLocalProgress();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}
function renderQuestionVideo(videoPath, question) {
  const videoSrc = toMediaUrl(videoPath);
  if (!videoSrc) {
    state.videoQuestionPending = false;
    state.videoPlaybackCompleted = true;
    el.questionText.textContent = question.question;
    showQuestionStatus("تعذر تحميل الفيديو لهذا السؤال");
    updateQuestionActionLock();
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "question-video-wrapper";
  const video = document.createElement("video");
  video.id = "questionVideo";
  video.preload = "metadata";
  video.controls = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
  video.controlsList = "nodownload noplaybackrate noremoteplayback nofullscreen";
  video.setAttribute("aria-label", "فيديو السؤال");
  const source = document.createElement("source");
  source.src = videoSrc;
  source.type = "video/mp4";
  video.appendChild(source);
  let maxWatchedTime = 0;
  let playbackCompleted = false;
  video.addEventListener("timeupdate", () => {
    maxWatchedTime = Math.max(maxWatchedTime, video.currentTime || 0);
  });
  video.addEventListener("seeking", () => {
    if (playbackCompleted) {
      video.currentTime = video.duration || maxWatchedTime || 0;
      return;
    }
    if ((video.currentTime || 0) < maxWatchedTime - 0.25) {
      video.currentTime = maxWatchedTime;
    }
  });
  video.addEventListener("play", () => {
    if (!playbackCompleted) return;
    video.pause();
    video.currentTime = video.duration || maxWatchedTime || 0;
  });
  video.addEventListener("ended", () => {
    playbackCompleted = true;
    video.controls = false;
    video.pause();
    video.currentTime = video.duration || maxWatchedTime || 0;
    revealVideoQuestionAfterPlayback(question);
  }, { once: true });
  video.addEventListener("error", () => {
    state.videoQuestionPending = false;
    state.videoPlaybackCompleted = true;
    el.questionText.textContent = question.question;
    showQuestionStatus("تعذر تحميل الفيديو لهذا السؤال");
    updateQuestionActionLock();
  }, { once: true });
  wrapper.appendChild(video);
  el.questionMedia.appendChild(wrapper);
}

function getMyTeamNumber() {
  return getMyControlledTeams()[0] || 1;
}
function resolveOnlineTeamSlot() {
  if (online.mode !== "online") return null;
  const currentUid = normalizeCell(online.uid);
  const participantSlots = online.participantSlots && typeof online.participantSlots === "object"
    ? online.participantSlots
    : buildEmptyParticipantSlots();
  const participantRecords = online.participantRecords && typeof online.participantRecords === "object"
    ? online.participantRecords
    : buildEmptyParticipantRecords();

  for (let slot = 1; slot <= 3; slot += 1) {
    if (currentUid && normalizeCell(participantSlots[slot]) === currentUid) return slot;
  }
  for (let slot = 1; slot <= 3; slot += 1) {
    if (currentUid && normalizeCell(participantRecords[slot]?.uid) === currentUid) return slot;
  }
  return Number(online.resolvedTeamSlot || online.teamSlot) || null;
}
function resolveCurrentTurnTeam() {
  const activeTeams = getActiveTeamNumbers();
  if (online.mode === "online" && activeTeams.includes(Number(online.currentTurnTeam))) {
    return Number(online.currentTurnTeam);
  }
  if (activeTeams.includes(Number(state.currentTeam))) {
    return Number(state.currentTeam);
  }
  return activeTeams[0] || 1;
}
function getMyControlledTeams() {
  if (online.mode !== "online") return [state.currentTeam];
  return [resolveOnlineTeamSlot() || 1];
}
function hasOnlineSeatOccupant(slot) {
  const normalizedSlot = Number(slot);
  if (!(normalizedSlot >= 1 && normalizedSlot <= 3)) return false;
  const slotUid = normalizeCell(online.participantSlots?.[normalizedSlot]);
  const recordUid = normalizeCell(online.participantRecords?.[normalizedSlot]?.uid);
  return !!(slotUid || recordUid);
}
function isOnlineHostClient() {
  if (online.mode !== "online") return true;
  const currentUid = normalizeCell(online.uid);
  const hostUid = normalizeCell(online.participantRecords?.[1]?.uid || online.participantSlots?.[1]);
  if (!currentUid) return online.role === "host";
  return online.role === "host" || (hostUid && hostUid === currentUid);
}
function canCurrentClientAct() {
  if (online.mode !== "online") return true;
  const resolvedCurrentTeam = resolveCurrentTurnTeam();
  const myTeamSlot = Number(resolveOnlineTeamSlot() || online.resolvedTeamSlot || online.teamSlot);
  if (myTeamSlot && myTeamSlot === resolvedCurrentTeam) return true;
  // Fallback for host clients when slot resolution is temporarily missing:
  // the host controls team 1 turn authority.
  if (!myTeamSlot && isOnlineHostClient() && resolvedCurrentTeam === 1) return true;
  return false;
}

function createQuestionSessionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shouldAbortRemoteApply(applyNonce) {
  return online.mode !== "online" || applyNonce !== online.activeRemoteApplyNonce;
}

async function requestHostTilePick(tileId) {
  if (online.mode !== "online" || !online.roomRef || !online.uid) return false;
  const normalizedTileId = normalizeCell(tileId);
  if (!normalizedTileId) return false;
  try {
    await online.roomRef.child(`players/${online.uid}/pendingTilePick`).set({
      id: `${online.uid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tileId: normalizedTileId,
      requestedAt: getFirebaseTimestampValue(),
    });
    return true;
  } catch (error) {
    console.warn("[Tasleya][online] tile-pick request failed", { tileId: normalizedTileId, error });
    return false;
  }
}

async function requestHostRevealAnswer() {
  if (online.mode !== "online" || !online.roomRef || !online.uid) return false;
  try {
    await online.roomRef.child(`players/${online.uid}/pendingRevealAnswer`).set({
      id: `${online.uid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      questionSessionId: normalizeCell(state.questionSessionId) || "",
      requestedAt: getFirebaseTimestampValue(),
    });
    return true;
  } catch (error) {
    console.warn("[Tasleya][online] pending reveal request failed", error);
    return false;
  }
}

async function requestHostScoreAction({ action, targetTeam = null } = {}) {
  if (online.mode !== "online" || !online.roomRef || !online.uid) return false;
  const normalizedAction = normalizeCell(action);
  if (!["correct", "wrong", "other"].includes(normalizedAction)) return false;
  const normalizedTargetTeam = Number(targetTeam);
  const payload = {
    id: `${online.uid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action: normalizedAction,
    questionSessionId: normalizeCell(state.questionSessionId) || "",
    requestedAt: getFirebaseTimestampValue(),
  };
  if (Number.isFinite(normalizedTargetTeam) && normalizedTargetTeam >= 1 && normalizedTargetTeam <= 3) {
    payload.targetTeam = normalizedTargetTeam;
  }
  try {
    await online.roomRef.child(`players/${online.uid}/pendingScoreAction`).set(payload);
    return true;
  } catch (error) {
    console.warn("[Tasleya][online] pending score action request failed", { action: normalizedAction, targetTeam, error });
    return false;
  }
}

async function requestHostLifelineAction({ type } = {}) {
  if (online.mode !== "online" || !online.roomRef || !online.uid) return false;
  const normalizedType = normalizeCell(type);
  if (!["mcq", "hint"].includes(normalizedType)) return false;
  const payload = {
    id: `${online.uid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: normalizedType,
    questionSessionId: normalizeCell(state.questionSessionId) || "",
    requestedAt: getFirebaseTimestampValue(),
  };
  try {
    await online.roomRef.child(`players/${online.uid}/pendingLifelineAction`).set(payload);
    return true;
  } catch (error) {
    console.warn("[Tasleya][online] pending lifeline action request failed", { type: normalizedType, error });
    return false;
  }
}

async function openQuestion(tileId, { restored = false, deadlineTs = null, questionId = "", skipTurnGuard = false, turnOwnerIndex = null } = {}) {
  console.log("[Tasleya][openQuestion] entered", {
    tileId,
    restored,
    questionId: questionId || null,
    mode: online.mode,
    role: online.role,
    applyingRemote: online.applyingRemote,
  });
  if (online.mode === "online" && !skipTurnGuard && !canCurrentClientAct()) return;
  if (online.mode === "online" && !skipTurnGuard && !isOnlineHostClient()) {
    await requestHostTilePick(tileId);
    return;
  }
  if (hasUnresolvedActiveQuestion()) return;
  stopAndResetTimer(); clearQuestionMedia();
  const tile = state.boardTiles.find((t) => t.id === tileId);
  if (!tile || tile.used || tile.missing) return;
  state.questionSessionId = createQuestionSessionId();
  state.activeTile = tile;
  state.loadingQuestion = true;
  const normalizedTurnOwnerIndex = Number(turnOwnerIndex);
  const questionTurnOwnerIndex = getActiveTeamNumbers().includes(normalizedTurnOwnerIndex)
    ? normalizedTurnOwnerIndex
    : state.currentTeam;
  state.answeringTeamIndex = questionTurnOwnerIndex;
  state.questionTurnOwnerIndex = questionTurnOwnerIndex;
  state.pendingScoreTeamIndex = null;
  state.questionResolutionLocked = false;
  state.resolvedQuestionSessionId = "";
  console.log("[Tasleya][openQuestion] loading-question set", {
    tileId,
    activeTileId: state.activeTile?.id || null,
    reason: restored ? "restored-open" : "tile-click-open",
  });
  state.revealRequested = false;
  state.videoQuestionPending = false;
  state.videoPlaybackCompleted = false;
  state.pendingVideoDeadlineTs = null;
  tile.timedOut = false;
  console.log("[Tasleya][openQuestion] preparing modal show", {
    hasModalElement: !!el.modal,
    modalInitiallyHidden: el.modal?.classList.contains("hidden"),
  });
  el.modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    el.modal.classList.remove("is-closing");
    el.modal.classList.add("is-open");
    const modalStyle = window.getComputedStyle(el.modal);
    console.log("[Tasleya][openQuestion] modal show called", {
      classList: Array.from(el.modal.classList),
      display: modalStyle.display,
      visibility: modalStyle.visibility,
      opacity: modalStyle.opacity,
      zIndex: modalStyle.zIndex,
    });
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
  closeOtherTeamSelector();
  state.resolvingOtherTeam = false;
  updateCloseButtonLock();
  try {
    const prefetched = questionBankCache.nextQuestionByTileId.get(tile.id);
    let q = prefetched || null;
    if (!q) {
      q = await fetchQuestionPayload({
        id: questionId || tile.questionId,
        category: tile.category,
        points: tile.points,
        ignoreTileId: tile.id,
      });
    }
    questionBankCache.nextQuestionByTileId.delete(tile.id);
    questionBankCache.nextQuestionPromiseByTileId.delete(tile.id);
    if (!q) {
      tile.missing = true;
      console.log("[Tasleya][openQuestion] clearing question state", {
        reason: "question-not-found",
        activeTileId: state.activeTile?.id || null,
      });
      state.activeTile = null;
      state.activeQuestion = null;
      state.loadingQuestion = false;
      state.questionSessionId = "";
      renderBoard();
      persistLocalProgress();
      showError("لا يوجد سؤال متاح لهذه الخانة حالياً.");
      return;
    }
    const historyQuestionId = getQuestionHistoryId(q, { category: tile.category, points: tile.points });
    const normalizedApiQuestionId = normalizeCell(q.id);
    tile.questionId = normalizedApiQuestionId || tile.questionId;
    tile.questionHistoryId = historyQuestionId;
    if (historyQuestionId) markQuestionAsUsed(tile.category, historyQuestionId);
    if (online.mode === "online") {
      try {
        await syncOnlineUsedCategoryHistory(tile.category, { questionId: historyQuestionId });
      } catch (error) {
        console.warn("[Tasleya] Unable to sync used online question history", { category: tile.category, questionId: historyQuestionId, error });
      }
    }
    state.activeQuestion = q;
    state.loadingQuestion = false;
    console.log("[Tasleya][openQuestion] active question assigned", {
      activeTileId: state.activeTile?.id || null,
      activeQuestionId: state.activeQuestion?.id || null,
      modalHidden: el.modal?.classList.contains("hidden"),
    });
    warmQuestionMedia(q, { highPriority: true });
    prefetchAnswerPayload(q.id);
    prefetchLikelyNextQuestion({ excludeTileId: tile.id });
    preloadLikelyNextQuestionMedia();
    clearError();
    console.log("[Tasleya] Opening question", { id: q.id, type: q.type, hint: q.hint });
    renderQuestionContent(q);
    const modalStyleAfterRender = window.getComputedStyle(el.modal);
    console.log("[Tasleya][openQuestion] question rendered", {
      hasModalElement: !!el.modal,
      modalHidden: el.modal?.classList.contains("hidden"),
      classList: el.modal ? Array.from(el.modal.classList) : [],
      display: modalStyleAfterRender.display,
      visibility: modalStyleAfterRender.visibility,
      opacity: modalStyleAfterRender.opacity,
      zIndex: modalStyleAfterRender.zIndex,
    });
  } catch (error) {
    console.log("[Tasleya][openQuestion] clearing question state", {
      reason: "question-fetch-failed",
      error: error?.message || String(error),
      activeTileId: state.activeTile?.id || null,
    });
    closeModal({ silentSync: true, force: true });
    state.activeTile = null;
    state.activeQuestion = null;
    state.loadingQuestion = false;
    state.questionSessionId = "";
    if (error?.code === "QUESTION_RESPONSE_SHAPE_INVALID") {
      showError(error.message);
      return;
    }
    showError(`تعذّر تحميل السؤال. ${error instanceof Error ? error.message : "خطأ غير متوقع"}`);
    return;
  }
  const safeDeadline = Number(deadlineTs);
  const restoreDeadline = Number.isFinite(safeDeadline) ? safeDeadline : null;
  if (state.videoQuestionPending) {
    state.pendingVideoDeadlineTs = restored ? restoreDeadline : null;
  } else {
    if (restored && restoreDeadline && restoreDeadline <= Date.now()) {
      showQuestionStatus("انتهى الوقت");
      startTimer({ deadlineTs: Date.now() + 10 });
      handleQuestionTimeout();
    } else {
      startTimer({ deadlineTs: restored ? restoreDeadline : null });
    }
  }
  persistLocalProgress();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

async function processPendingTilePickRequest(room, remoteGameState) {
  if (online.mode !== "online" || !isOnlineHostClient() || !online.roomRef) return;
  if (!remoteGameState || !!remoteGameState.modalOpen) return;
  if (hasUnresolvedActiveQuestion() || state.loadingQuestion) return;
  const players = room?.players && typeof room.players === "object" ? room.players : {};
  const activeTeams = getActiveTeamNumbers();
  const currentTeam = activeTeams.includes(Number(remoteGameState.currentTeam))
    ? Number(remoteGameState.currentTeam)
    : (activeTeams[0] || 1);

  let selectedRequest = null;
  Object.entries(players).forEach(([uid, rawRecord]) => {
    if (selectedRequest) return;
    const slot = Number(rawRecord?.teamIndex);
    const request = rawRecord?.pendingTilePick;
    const requestedTileId = normalizeCell(request?.tileId);
    const requestId = normalizeCell(request?.id);
    if (slot !== currentTeam || !requestedTileId || !requestId) return;
    selectedRequest = { uid: normalizeCell(uid), slot, requestedTileId, requestId };
  });

  if (!selectedRequest) return;
  if (online.processingTilePickRequestId === selectedRequest.requestId) return;

  const tile = state.boardTiles.find((candidate) => candidate.id === selectedRequest.requestedTileId);
  const canOpenTile = !!tile && !tile.used && !tile.missing;
  online.processingTilePickRequestId = selectedRequest.requestId;
  try {
    await online.roomRef.child(`players/${selectedRequest.uid}/pendingTilePick`).remove();
    if (!canOpenTile) return;
    await openQuestion(selectedRequest.requestedTileId, { skipTurnGuard: true });
  } finally {
    online.processingTilePickRequestId = "";
  }
}

async function processPendingRevealRequest(room, remoteGameState) {
  if (online.mode !== "online" || !isOnlineHostClient() || !online.roomRef) return;
  if (!remoteGameState || !remoteGameState.modalOpen || remoteGameState.answerRevealed) return;
  if (!hasUnresolvedActiveQuestion() || state.loadingQuestion || !state.activeQuestion) return;

  const players = room?.players && typeof room.players === "object" ? room.players : {};
  const activeTeams = getActiveTeamNumbers();
  const currentTeam = activeTeams.includes(Number(remoteGameState.currentTeam))
    ? Number(remoteGameState.currentTeam)
    : (activeTeams[0] || 1);
  const currentSessionId = normalizeCell(state.questionSessionId);

  let selectedRequest = null;
  Object.entries(players).forEach(([uid, rawRecord]) => {
    if (selectedRequest) return;
    const slot = Number(rawRecord?.teamIndex);
    const request = rawRecord?.pendingRevealAnswer;
    const requestId = normalizeCell(request?.id);
    const requestedSessionId = normalizeCell(request?.questionSessionId);
    if (slot !== currentTeam || !requestId) return;
    if (currentSessionId && requestedSessionId && requestedSessionId !== currentSessionId) return;
    selectedRequest = { uid: normalizeCell(uid), requestId };
  });

  if (!selectedRequest) return;
  if (online.processingRevealRequestId === selectedRequest.requestId) return;

  online.processingRevealRequestId = selectedRequest.requestId;
  try {
    await online.roomRef.child(`players/${selectedRequest.uid}/pendingRevealAnswer`).remove();
    await revealAnswer({ skipTurnGuard: true });
  } finally {
    online.processingRevealRequestId = "";
  }
}

async function processPendingScoreRequest(room, remoteGameState) {
  if (online.mode !== "online" || !isOnlineHostClient() || !online.roomRef) return;
  if (!remoteGameState || !remoteGameState.modalOpen || !remoteGameState.answerRevealed) return;
  if (!hasUnresolvedActiveQuestion() || state.loadingQuestion || !state.activeQuestion) return;

  const players = room?.players && typeof room.players === "object" ? room.players : {};
  const activeTeams = getActiveTeamNumbers();
  const currentTeam = activeTeams.includes(Number(remoteGameState.currentTeam))
    ? Number(remoteGameState.currentTeam)
    : (activeTeams[0] || 1);
  const currentSessionId = normalizeCell(state.questionSessionId);

  let selectedRequest = null;
  Object.entries(players).forEach(([uid, rawRecord]) => {
    if (selectedRequest) return;
    const slot = Number(rawRecord?.teamIndex);
    const request = rawRecord?.pendingScoreAction;
    const requestId = normalizeCell(request?.id);
    const requestedAction = normalizeCell(request?.action);
    const requestedSessionId = normalizeCell(request?.questionSessionId);
    const requestedTargetTeam = Number(request?.targetTeam);
    if (slot !== currentTeam || !requestId || !["correct", "wrong", "other"].includes(requestedAction)) return;
    if (currentSessionId && requestedSessionId && requestedSessionId !== currentSessionId) return;
    selectedRequest = {
      uid: normalizeCell(uid),
      requestId,
      action: requestedAction,
      targetTeam: Number.isFinite(requestedTargetTeam) ? requestedTargetTeam : null,
    };
  });

  if (!selectedRequest) return;
  if (online.processingScoreRequestId === selectedRequest.requestId) return;

  online.processingScoreRequestId = selectedRequest.requestId;
  try {
    await online.roomRef.child(`players/${selectedRequest.uid}/pendingScoreAction`).remove();
    if (selectedRequest.action === "correct") {
      applyScore(true, { skipHostGuard: true, skipTurnGuard: true });
      return;
    }
    if (selectedRequest.action === "wrong") {
      applyScore(false, { skipHostGuard: true, skipTurnGuard: true });
      return;
    }
    awardPointsToOtherTeam({
      skipHostGuard: true,
      skipTurnGuard: true,
      selectedTeam: selectedRequest.targetTeam,
    });
  } finally {
    online.processingScoreRequestId = "";
  }
}

async function processPendingLifelineRequest(room, remoteGameState) {
  if (online.mode !== "online" || !isOnlineHostClient() || !online.roomRef) return;
  if (!remoteGameState || !remoteGameState.modalOpen) return;
  if (!hasUnresolvedActiveQuestion() || state.loadingQuestion || !state.activeQuestion) return;

  const players = room?.players && typeof room.players === "object" ? room.players : {};
  const activeTeams = getActiveTeamNumbers();
  const currentTeam = activeTeams.includes(Number(remoteGameState.currentTeam))
    ? Number(remoteGameState.currentTeam)
    : (activeTeams[0] || 1);
  const currentSessionId = normalizeCell(state.questionSessionId);

  let selectedRequest = null;
  Object.entries(players).forEach(([uid, rawRecord]) => {
    if (selectedRequest) return;
    const slot = Number(rawRecord?.teamIndex);
    const request = rawRecord?.pendingLifelineAction;
    const requestId = normalizeCell(request?.id);
    const requestedType = normalizeCell(request?.type);
    const requestedSessionId = normalizeCell(request?.questionSessionId);
    if (slot !== currentTeam || !requestId || !["mcq", "hint"].includes(requestedType)) return;
    if (currentSessionId && requestedSessionId && requestedSessionId !== currentSessionId) return;
    selectedRequest = { uid: normalizeCell(uid), requestId, type: requestedType };
  });

  if (!selectedRequest) return;
  if (online.processingLifelineRequestId === selectedRequest.requestId) return;

  online.processingLifelineRequestId = selectedRequest.requestId;
  try {
    await online.roomRef.child(`players/${selectedRequest.uid}/pendingLifelineAction`).remove();
    if (selectedRequest.type === "mcq") {
      await useLifeline({ skipHostGuard: true, skipTurnGuard: true });
      return;
    }
    await useHintLifeline({ skipHostGuard: true, skipTurnGuard: true });
  } finally {
    online.processingLifelineRequestId = "";
  }
}

function closeModal({ silentSync = false, force = false } = {}) {
  if (!force && shouldLockQuestionClose()) {
    updateCloseButtonLock();
    return false;
  }
  stopAndResetTimer(); clearQuestionMedia();
  state.revealRequested = false;
  state.videoQuestionPending = false;
  state.videoPlaybackCompleted = false;
  state.pendingVideoDeadlineTs = null;
  state.answeringTeamIndex = null;
  state.questionTurnOwnerIndex = null;
  state.pendingScoreTeamIndex = null;
  state.questionResolutionLocked = false;
  state.resolvedQuestionSessionId = "";
  state.currentHintText = "";
  closeOtherTeamSelector();
  state.resolvingOtherTeam = false;
  el.hintText.textContent = "";
  el.hintBox.classList.add("hidden");
  showQuestionStatus("");
  updateLateOtherTeamPrompt();
  if (el.modal.classList.contains("hidden")) {
    console.log("[Tasleya][question-state] clearing question state", { reason: "closeModal:hidden" });
    state.activeTile = null;
    state.activeQuestion = null;
    state.loadingQuestion = false;
    state.questionSessionId = "";
    return;
  }
  if (prefersReducedMotion) {
    el.modal.classList.add("hidden");
    el.modal.classList.remove("is-open", "is-closing");
    console.log("[Tasleya][question-state] clearing question state", { reason: "closeModal:reduced-motion" });
    state.activeTile = null;
    state.activeQuestion = null;
    state.loadingQuestion = false;
    state.questionSessionId = "";
  } else {
    el.modal.classList.remove("is-open"); el.modal.classList.add("is-closing");
    const onEnd = () => {
      el.modal.classList.add("hidden");
      el.modal.classList.remove("is-closing");
      console.log("[Tasleya][question-state] clearing question state", { reason: "closeModal:animation-end" });
      state.activeTile = null;
      state.activeQuestion = null;
      state.loadingQuestion = false;
      state.questionSessionId = "";
      el.modal.removeEventListener("animationend", onEnd, true);
    };
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
  lifelinesUsed = createEmptyLifelinesUsed();
  state.activeTile = null;
  state.activeQuestion = null;
  state.loadingQuestion = false;
  state.questionSessionId = "";
  state.answerRevealed = false;
  state.revealRequested = false;
  state.currentChoices = [];
  state.currentHintText = "";
  state.answeringTeamIndex = null;
  state.questionTurnOwnerIndex = null;
  state.pendingScoreTeamIndex = null;
  state.questionResolutionLocked = false;
  state.resolvedQuestionSessionId = "";
  questionBankCache.nextQuestionByTileId.clear();
  questionBankCache.nextQuestionPromiseByTileId.clear();
  closeOtherTeamSelector();
  state.resolvingOtherTeam = false;
  closeModal({ silentSync: true });
  closeCategoryPicker();
  closePodiumModal();
  clearError();
  updateScoreboard();
  renderBoard();
}

async function revealAnswer({ skipTurnGuard = false } = {}) {
  const question = getActiveQuestion();
  if (!question || state.answerRevealed || state.activeTile?.timedOut || state.videoQuestionPending) return;
  if (online.mode === "online" && !skipTurnGuard && !canCurrentClientAct()) return;
  if (online.mode === "online" && !skipTurnGuard && !isOnlineHostClient()) {
    const requested = await requestHostRevealAnswer();
    if (requested) {
      el.revealBtn.disabled = true;
      showQuestionStatus("تم إرسال طلب إظهار الإجابة...");
    }
    return;
  }
  console.time("[Tasleya][reveal] click_to_answer_visible");
  console.time("[Tasleya][reveal] local_state_update");
  state.revealRequested = true;
  state.answerRevealed = true;
  stopTimerWarningSound();
  el.revealBtn.disabled = true;
  const cachedResponse = questionBankCache.answersById.get(question.id);
  el.answerText.textContent = `الإجابة: ${cachedResponse?.correctAnswer || "جارٍ التحميل..."}`;
  el.answerText.classList.remove("hidden");
  showQuestionStatus(cachedResponse?.correctAnswer ? "" : "جارٍ إظهار الإجابة...");
  console.timeEnd("[Tasleya][reveal] local_state_update");
  requestAnimationFrame(() => {
    console.timeEnd("[Tasleya][reveal] click_to_answer_visible");
    console.log("[Tasleya][reveal] render_complete");
  });
  try {
    if (online.mode === "online" && !online.applyingRemote) {
      pushOnlineState();
    }
    const response = cachedResponse || await prefetchAnswerPayload(question.id) || await fetchAnswerPayload(question.id);
    el.answerText.textContent = `الإجابة: ${response.correctAnswer || "غير متاحة"}`;
    showQuestionStatus("");
    updateQuestionActionLock();
    if (!prefersReducedMotion) {
      requestAnimationFrame(() => {
        el.answerText.classList.remove("reveal-anim");
        el.answerText.classList.add("reveal-anim");
      });
    }
    if (online.mode === "online" && !online.applyingRemote) {
      console.time("[Tasleya][reveal] firebase_sync");
      requestAnimationFrame(() => {
        pushOnlineState();
        console.timeEnd("[Tasleya][reveal] firebase_sync");
      });
    }
  } catch (error) {
    showQuestionStatus("");
    state.answerRevealed = false;
    el.revealBtn.disabled = false;
    el.answerText.classList.add("hidden");
    state.revealRequested = false;
    updateQuestionActionLock();
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
async function useLifeline({ skipHostGuard = false, skipTurnGuard = false } = {}) {
  const question = getActiveQuestion(); const currentTeam = state.currentTeam;
  if (!question || state.activeTile?.timedOut || state.videoQuestionPending || hasUsedLifeline(currentTeam, "mcq")) return;
  if (online.mode === "online" && !skipTurnGuard && !canCurrentClientAct()) return;
  if (online.mode === "online" && !skipHostGuard && !isOnlineHostClient()) {
    const requested = await requestHostLifelineAction({ type: "mcq" });
    if (requested) showQuestionStatus("تم إرسال طلب المساعدة...");
    return;
  }
  const options = generateChoices(question);
  el.choicesList.innerHTML = "";
  options.forEach((option) => { const div = document.createElement("div"); div.className = "choice-item"; div.textContent = option; el.choicesList.appendChild(div); });
  lifelinesUsed[currentTeam].mcq = true;
  state.currentChoices = options;
  el.lifelineBtn.disabled = true;
  el.choicesBox.classList.remove("hidden");
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}


async function useHintLifeline({ skipHostGuard = false, skipTurnGuard = false } = {}) {
  const question = getActiveQuestion(); const currentTeam = state.currentTeam;
  if (!question || state.activeTile?.timedOut || state.videoQuestionPending || hasUsedLifeline(currentTeam, "hint")) return;
  if (online.mode === "online" && !skipTurnGuard && !canCurrentClientAct()) return;
  if (online.mode === "online" && !skipHostGuard && !isOnlineHostClient()) {
    const requested = await requestHostLifelineAction({ type: "hint" });
    if (requested) showQuestionStatus("تم إرسال طلب التلميح...");
    return;
  }
  const hintText = firstNonEmpty(question.hint, question["تلميح"]);
  lifelinesUsed[currentTeam].hint = true;
  el.hintLifelineBtn.disabled = true;
  if (!hintText) {
    state.currentHintText = "لا يوجد تلميح لهذا السؤال";
    el.hintText.textContent = state.currentHintText;
    el.hintBox.classList.remove("hidden");
    if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
    return;
  }
  logAnalyticsEvent("hint_used", {
    mode: online.mode,
    team: currentTeam,
    has_hint: true,
  });
  state.currentHintText = hintText;
  el.hintText.textContent = state.currentHintText;
  el.hintBox.classList.remove("hidden");
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function applyScore(isCorrect, { skipHostGuard = false, skipTurnGuard = false } = {}) {
  if (state.videoQuestionPending) return;
  if (online.mode === "online" && !skipTurnGuard && !canCurrentClientAct()) return;
  if (online.mode === "online" && !skipHostGuard && !isOnlineHostClient()) {
    requestHostScoreAction({ action: isCorrect ? "correct" : "wrong" });
    return;
  }
  if (state.questionResolutionLocked) return;
  if (!state.answerRevealed) return;
  const questionTurnOwnerIndex = getQuestionTurnOwnerIndex();
  const answeringTeam = Number(state.answeringTeamIndex) || Number(state.currentTeam);
  if (!isCorrect) {
    console.log("[Tasleya][score]", {
      questionId: normalizeCell(state.activeQuestion?.id || state.activeTile?.questionId || state.activeTile?.id),
      currentTeamIndex: state.currentTeam,
      targetTeamIndex: null,
      delta: 0,
      source: "wrong",
    });
  }
  state.pendingScoreTeamIndex = isCorrect ? answeringTeam : null;
  const scoreAction = isCorrect
    ? {
      teamIndex: answeringTeam,
      delta: state.activeTile?.points ?? 0,
      reason: "correct",
    }
    : null;
  const resolved = resolveActiveQuestion({
    scoreAction,
    nextTeam: getNextTeamNumber(questionTurnOwnerIndex),
  });
  if (resolved) playOutcomeSound(isCorrect ? "correct" : "wrong");
}
function awardPointsToOtherTeam({ skipHostGuard = false, skipTurnGuard = false, selectedTeam = null } = {}) {
  if (state.videoQuestionPending) return;
  if (online.mode === "online" && !skipTurnGuard && !canCurrentClientAct()) return;
  if (online.mode === "online" && !skipHostGuard && !isOnlineHostClient()) {
    if (state.teamCount === 3) {
      const eligibleTeams = getEligibleOtherTeams(state.currentTeam);
      if (eligibleTeams.length > 1) {
        if (!state.pendingOtherTeamSelection) openOtherTeamSelector();
        updateQuestionActionLock();
        return;
      }
    }
    const targetTeam = Number.isFinite(Number(selectedTeam)) ? Number(selectedTeam) : getNextTeamNumber(state.currentTeam);
    requestHostScoreAction({ action: "other", targetTeam });
    return;
  }
  if (state.questionResolutionLocked) return;
  if (!state.answerRevealed) return;
  if (state.resolvingOtherTeam) return;
  const questionTurnOwnerIndex = getQuestionTurnOwnerIndex();
  if (state.teamCount === 3) {
    const eligibleTeams = getEligibleOtherTeams(state.currentTeam);
    if (eligibleTeams.length > 1) {
      if (Number.isFinite(Number(selectedTeam)) && eligibleTeams.includes(Number(selectedTeam))) {
        state.resolvingOtherTeam = true;
        state.pendingOtherTeamSelection = false;
        state.pendingScoreTeamIndex = Number(selectedTeam);
        resolveActiveQuestion({
          preventTimeoutAction: true,
          scoreAction: {
            teamIndex: Number(selectedTeam),
            delta: state.activeTile?.points ?? 0,
            reason: "other-team-selected",
          },
          nextTeam: getNextTeamNumber(questionTurnOwnerIndex),
        });
        state.resolvingOtherTeam = false;
        return;
      }
      if (!state.pendingOtherTeamSelection) openOtherTeamSelector();
      updateQuestionActionLock();
      return;
    }
  }
  const eligibleTeams = getEligibleOtherTeams(state.currentTeam);
  const otherTeam = Number.isFinite(Number(selectedTeam)) && eligibleTeams.includes(Number(selectedTeam))
    ? Number(selectedTeam)
    : getNextTeamNumber(state.currentTeam);
  state.pendingScoreTeamIndex = otherTeam;
  state.resolvingOtherTeam = true;
  resolveActiveQuestion({
    preventTimeoutAction: true,
    scoreAction: {
      teamIndex: otherTeam,
      delta: state.activeTile?.points ?? 0,
      reason: "other-team",
    },
    nextTeam: getNextTeamNumber(questionTurnOwnerIndex),
  });
  state.resolvingOtherTeam = false;
}

function resolveActiveQuestion({ scoreAction = null, nextTeam = null, timedOut = false, preventTimeoutAction = false } = {}) {
  const tile = state.activeTile;
  if (!tile || tile.used || !state.activeQuestion) return false;
  if (preventTimeoutAction && tile.timedOut) return false;
  if (state.questionResolutionLocked) return false;
  const sessionId = normalizeCell(state.questionSessionId);
  if (sessionId && state.resolvedQuestionSessionId === sessionId) return false;
  state.questionResolutionLocked = true;
  if (sessionId) state.resolvedQuestionSessionId = sessionId;

  const questionTurnOwnerIndex = getQuestionTurnOwnerIndex();
  const awardedTeamIndex = Number(scoreAction?.teamIndex ?? state.pendingScoreTeamIndex) || null;
  const computedNextTurnIndex = getActiveTeamNumbers().includes(Number(nextTeam))
    ? Number(nextTeam)
    : getNextTeamNumber(questionTurnOwnerIndex);
  console.log("[Tasleya][question-resolution]", {
    questionId: normalizeCell(state.activeQuestion?.id || state.activeTile?.questionId || state.activeTile?.id),
    questionTurnOwnerIndex,
    awardedTeamIndex,
    computedNextTurnIndex,
  });

  if (scoreAction && typeof scoreAction === "object") {
    const targetTeamIndex = Number(scoreAction.teamIndex ?? state.pendingScoreTeamIndex);
    applyScoreToTeam(targetTeamIndex, scoreAction.delta, scoreAction.reason || "resolve");
  }

  if (timedOut) {
    tile.timedOut = true;
  }
  tile.used = true;
  getActiveTeamNumbers().forEach((team) => {
    state.scores[team] = Math.max(0, state.scores[team]);
  });

  if (getActiveTeamNumbers().includes(computedNextTurnIndex)) {
    state.currentTeam = computedNextTurnIndex;
  }

  updateScoreboard();
  renderBoard();
  prefetchLikelyNextQuestion({ excludeTileId: tile.id });
  closeOtherTeamSelector();
  state.questionSessionId = "";
  state.questionTurnOwnerIndex = null;
  state.pendingScoreTeamIndex = null;
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
  el.startGameBtn.textContent = hostOnlyBlocked
    ? "بانتظار منشئ الغرفة"
    : (online.mode === "local" && state.teamCount === 1 ? "ابدأ اللعب الفردي" : "بدء اللعبة");
  if (el.randomCategoriesBtn) el.randomCategoriesBtn.textContent = `اختيار عشوائي (${requiredCategories})`;
  if (el.categoryHostOnlyNote) {
    el.categoryHostOnlyNote.classList.toggle("hidden", !hostOnlyBlocked);
  }
  const checkedSet = new Set(state.selectedCategories); const reachedMax = checkedSet.size >= requiredCategories;
  el.categoryList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.checked = checkedSet.has(checkbox.value);
    checkbox.disabled = hostOnlyBlocked ? false : !checkbox.checked && reachedMax;
    const row = checkbox.closest(".category-option");
    if (row) {
      row.classList.toggle("is-selected", checkbox.checked);
      row.classList.toggle("is-locked", checkbox.disabled && !checkbox.checked);
    }
  });
}
function resolveCategoryHelpText(category) {
  const key = CATEGORY_HELP_TEXTS[category] ? category : (CATEGORY_HELP_ALIASES[category] || "");
  return CATEGORY_HELP_TEXTS[key] || "";
}

function getCategoryVisualMeta(category, groupName) {
  const thumbnail = CATEGORY_THUMBNAILS[category];
  const helpText = resolveCategoryHelpText(category);
  const displayLabel = CATEGORY_DISPLAY_ALIASES[category] || category;
  return {
    displayLabel,
    thumbnail: typeof thumbnail === "string" && thumbnail.trim() ? thumbnail.trim() : "",
    helpText,
    gradient: CATEGORY_GROUP_GRADIENTS[groupName] || CATEGORY_GROUP_GRADIENTS[DEFAULT_CATEGORY_GROUP],
  };
}

function isMobileCategoryHelpMode() {
  return window.matchMedia(MOBILE_CATEGORY_HELP_MEDIA_QUERY).matches;
}

function ensureCategoryHelpUI() {
  if (!categoryHelpState.desktopPopover) {
    const desktopPopover = document.createElement("div");
    desktopPopover.className = "category-help-floating-popover";
    desktopPopover.setAttribute("role", "tooltip");
    desktopPopover.innerHTML = '<strong class="category-help-floating-title"></strong><p class="category-help-floating-text"></p>';
    document.body.appendChild(desktopPopover);
    categoryHelpState.desktopPopover = desktopPopover;
    categoryHelpState.desktopTitle = desktopPopover.querySelector(".category-help-floating-title");
    categoryHelpState.desktopText = desktopPopover.querySelector(".category-help-floating-text");
  }
  if (!categoryHelpState.mobileBackdrop) {
    const mobileBackdrop = document.createElement("div");
    mobileBackdrop.className = "category-help-sheet-backdrop";
    mobileBackdrop.innerHTML = `
      <section class="category-help-sheet" role="dialog" aria-modal="true" aria-label="شرح الفئة">
        <header class="category-help-sheet-header">
          <h3 class="category-help-sheet-title"></h3>
          <button type="button" class="category-help-sheet-close-btn" aria-label="إغلاق">✕</button>
        </header>
        <p class="category-help-sheet-text"></p>
      </section>
    `;
    document.body.appendChild(mobileBackdrop);
    categoryHelpState.mobileBackdrop = mobileBackdrop;
    categoryHelpState.mobileSheet = mobileBackdrop.querySelector(".category-help-sheet");
    categoryHelpState.mobileTitle = mobileBackdrop.querySelector(".category-help-sheet-title");
    categoryHelpState.mobileText = mobileBackdrop.querySelector(".category-help-sheet-text");
    mobileBackdrop.querySelector(".category-help-sheet-close-btn")?.addEventListener("click", closeMobileCategoryHelpSheet);
    mobileBackdrop.addEventListener("click", (event) => {
      if (event.target === mobileBackdrop) closeMobileCategoryHelpSheet();
    });
  }
  if (!categoryHelpState.listenersBound) {
    document.addEventListener("pointerdown", handleCategoryHelpOutsidePointerDown);
    window.addEventListener("resize", handleCategoryHelpViewportChange, { passive: true });
    window.addEventListener("scroll", handleCategoryHelpViewportChange, { passive: true, capture: true });
    categoryHelpState.listenersBound = true;
  }
}

function closeDesktopCategoryHelp() {
  if (!categoryHelpState.desktopOpen) return;
  categoryHelpState.desktopOpen = false;
  categoryHelpState.desktopPopover?.classList.remove("is-open");
  if (categoryHelpState.activeOption) categoryHelpState.activeOption.classList.remove("is-help-open");
  if (categoryHelpState.activeButton) categoryHelpState.activeButton.setAttribute("aria-expanded", "false");
  categoryHelpState.activeButton = null;
  categoryHelpState.activeOption = null;
}

function closeMobileCategoryHelpSheet() {
  if (!categoryHelpState.mobileOpen) return;
  categoryHelpState.mobileOpen = false;
  categoryHelpState.mobileBackdrop?.classList.remove("is-open");
  if (categoryHelpState.activeOption) categoryHelpState.activeOption.classList.remove("is-help-open");
  if (categoryHelpState.activeButton) categoryHelpState.activeButton.setAttribute("aria-expanded", "false");
  categoryHelpState.activeButton = null;
  categoryHelpState.activeOption = null;
}

function closeCategoryHelpOverlays() {
  closeDesktopCategoryHelp();
  closeMobileCategoryHelpSheet();
}

function positionDesktopCategoryHelp(anchorButton) {
  if (!categoryHelpState.desktopPopover || !anchorButton) return;
  const spacing = 10;
  const viewportPadding = 10;
  const anchorRect = anchorButton.getBoundingClientRect();
  const popoverRect = categoryHelpState.desktopPopover.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
  left = Math.max(viewportPadding, Math.min(left, viewportWidth - popoverRect.width - viewportPadding));

  let top = anchorRect.bottom + spacing;
  if (top + popoverRect.height > viewportHeight - viewportPadding) {
    top = anchorRect.top - popoverRect.height - spacing;
  }
  top = Math.max(viewportPadding, Math.min(top, viewportHeight - popoverRect.height - viewportPadding));

  categoryHelpState.desktopPopover.style.left = `${left}px`;
  categoryHelpState.desktopPopover.style.top = `${top}px`;
}

function openDesktopCategoryHelp({ helpButton, option, title, text, toggle = true }) {
  ensureCategoryHelpUI();
  const isSame = categoryHelpState.desktopOpen && categoryHelpState.activeButton === helpButton;
  if (isSame && toggle) {
    closeDesktopCategoryHelp();
    return;
  }
  if (isSame) return;
  closeMobileCategoryHelpSheet();
  closeDesktopCategoryHelp();
  categoryHelpState.activeButton = helpButton;
  categoryHelpState.activeOption = option;
  categoryHelpState.desktopTitle.textContent = title;
  categoryHelpState.desktopText.textContent = text;
  categoryHelpState.desktopOpen = true;
  option.classList.add("is-help-open");
  helpButton.setAttribute("aria-expanded", "true");
  categoryHelpState.desktopPopover.classList.add("is-open");
  positionDesktopCategoryHelp(helpButton);
}

function openMobileCategoryHelpSheet({ helpButton, option, title, text }) {
  ensureCategoryHelpUI();
  const isSame = categoryHelpState.mobileOpen && categoryHelpState.activeButton === helpButton;
  if (isSame) {
    closeMobileCategoryHelpSheet();
    return;
  }
  closeDesktopCategoryHelp();
  closeMobileCategoryHelpSheet();
  categoryHelpState.activeButton = helpButton;
  categoryHelpState.activeOption = option;
  categoryHelpState.mobileTitle.textContent = title;
  categoryHelpState.mobileText.textContent = text;
  categoryHelpState.mobileOpen = true;
  option.classList.add("is-help-open");
  helpButton.setAttribute("aria-expanded", "true");
  categoryHelpState.mobileBackdrop.classList.add("is-open");
}

function handleCategoryHelpOutsidePointerDown(event) {
  if (categoryHelpState.desktopOpen) {
    const insidePopover = categoryHelpState.desktopPopover?.contains(event.target);
    const insideButton = event.target.closest(".category-option-help-btn");
    if (!insidePopover && !insideButton) closeDesktopCategoryHelp();
  }
  if (categoryHelpState.mobileOpen) {
    const insideSheet = categoryHelpState.mobileSheet?.contains(event.target);
    const insideButton = event.target.closest(".category-option-help-btn");
    if (!insideSheet && !insideButton) closeMobileCategoryHelpSheet();
  }
}

function handleCategoryHelpViewportChange() {
  if (categoryHelpState.desktopOpen && categoryHelpState.activeButton) {
    positionDesktopCategoryHelp(categoryHelpState.activeButton);
  }
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
    const section = document.createElement("section");
    section.className = "category-group-section";
    section.style.setProperty("--category-group-accent", CATEGORY_GROUP_GRADIENTS[groupName] || CATEGORY_GROUP_GRADIENTS[DEFAULT_CATEGORY_GROUP]);
    const header = document.createElement("h3");
    header.className = "category-group-title";
    const icon = document.createElement("span");
    icon.className = "category-group-icon";
    icon.innerHTML = CATEGORY_GROUP_ICON_SVGS[groupName] || DEFAULT_CATEGORY_GROUP_ICON_SVG;
    const label = document.createElement("span");
    label.className = "category-group-title-text";
    label.textContent = groupName;
    header.appendChild(icon);
    header.appendChild(label);
    section.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "category-group-grid";
    section.appendChild(grid);

    categories.forEach((category) => {
      const visualMeta = getCategoryVisualMeta(category, groupName);
      const label = document.createElement("label"); label.className = "category-option";
      label.style.setProperty("--category-card-gradient", visualMeta.gradient);
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
        scheduleGameplayProgressPersist();
        if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
      });
      const media = document.createElement("span");
      media.className = "category-option-media";
      if (visualMeta.thumbnail) {
        const thumbnail = document.createElement("img");
        thumbnail.className = "category-option-thumb";
        thumbnail.src = visualMeta.thumbnail;
        thumbnail.alt = "";
        thumbnail.loading = "lazy";
        thumbnail.decoding = "async";
        media.appendChild(thumbnail);
      } else {
        const fallbackIcon = document.createElement("span");
        fallbackIcon.className = "category-option-fallback-icon";
        fallbackIcon.innerHTML = CATEGORY_GROUP_ICON_SVGS[groupName] || DEFAULT_CATEGORY_GROUP_ICON_SVG;
        media.appendChild(fallbackIcon);
      }

      const body = document.createElement("span");
      body.className = "category-option-body";
      const row = document.createElement("span");
      row.className = "category-option-row";
      const title = document.createElement("span");
      title.className = "category-option-label";
      title.textContent = visualMeta.displayLabel;
      row.appendChild(title);

      const hasHelp = Boolean(visualMeta.helpText);
      if (hasHelp) {
        const helpButton = document.createElement("button");
        helpButton.type = "button";
        helpButton.className = "category-option-help-btn";
        helpButton.setAttribute("aria-label", `معلومات حول فئة ${visualMeta.displayLabel}`);
        helpButton.setAttribute("aria-expanded", "false");
        helpButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M12 10v5"/><circle cx="12" cy="7.25" r=".7" fill="currentColor" stroke="none"/></svg>';
        const openHelp = () => {
          const payload = { helpButton, option: label, title: visualMeta.displayLabel, text: visualMeta.helpText };
          if (isMobileCategoryHelpMode()) openMobileCategoryHelpSheet(payload);
          else openDesktopCategoryHelp(payload);
        };

        helpButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openHelp();
        });

        helpButton.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
        });
        helpButton.addEventListener("mouseenter", () => {
          if (isMobileCategoryHelpMode()) return;
          openDesktopCategoryHelp({ helpButton, option: label, title: visualMeta.displayLabel, text: visualMeta.helpText, toggle: false });
        });
        helpButton.addEventListener("mouseleave", () => {
          if (isMobileCategoryHelpMode()) return;
          if (categoryHelpState.activeButton === helpButton) closeDesktopCategoryHelp();
        });
        row.appendChild(helpButton);
        body.appendChild(row);
      } else {
        body.appendChild(row);
      }

      label.appendChild(checkbox);
      label.appendChild(media);
      label.appendChild(body);
      grid.appendChild(label);
    });

    el.categoryList.appendChild(section);
  });
  updateCategoryPickerUI();
  ensureCategoryHelpUI();
}

function getGroupedCategoryDisplay(categories) {
  const grouped = CATEGORY_DISPLAY_GROUPS.map((group) => ({ groupName: group.name, categories: [] }));
  const indexByName = new Map(CATEGORY_DISPLAY_GROUPS.map((group, index) => [group.name, index]));
  const categoryToGroup = new Map();
  const categoryOrderByGroup = new Map();

  CATEGORY_DISPLAY_GROUPS.forEach((group) => {
    categoryOrderByGroup.set(group.name, new Map(group.categories.map((category, index) => [category, index])));
    group.categories.forEach((category) => categoryToGroup.set(category, group.name));
  });

  categories.forEach((category) => {
    const targetGroupName = categoryToGroup.get(category) || DEFAULT_CATEGORY_GROUP;
    const groupIndex = indexByName.get(targetGroupName);
    if (groupIndex === undefined) return;
    grouped[groupIndex].categories.push(category);
  });

  grouped.forEach((group) => {
    const orderMap = categoryOrderByGroup.get(group.groupName);
    if (!orderMap) return;
    group.categories.sort((a, b) => {
      const aIndex = orderMap.has(a) ? orderMap.get(a) : Number.POSITIVE_INFINITY;
      const bIndex = orderMap.has(b) ? orderMap.get(b) : Number.POSITIVE_INFINITY;
      return aIndex - bIndex;
    });
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
  updateHostCategorySelectionCTA();
}
function closeCategoryPicker() {
  if (el.categoryModal.classList.contains("hidden")) return;
  closeCategoryHelpOverlays();
  if (prefersReducedMotion) {
    el.categoryModal.classList.add("hidden");
    el.categoryModal.classList.remove("is-open", "is-closing");
    updateHostCategorySelectionCTA();
    return;
  }
  el.categoryModal.classList.remove("is-open"); el.categoryModal.classList.add("is-closing");
  const onEnd = () => {
    el.categoryModal.classList.add("hidden");
    el.categoryModal.classList.remove("is-closing");
    el.categoryModal.removeEventListener("animationend", onEnd, true);
    updateHostCategorySelectionCTA();
  };
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
  scheduleGameplayProgressPersist();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function serializeGameState() {
  const hasActiveLifecycleQuestion = !!state.activeTile
    && !state.activeTile.used
    && (state.loadingQuestion || !!state.activeQuestion);
  return {
    selectedCategories: state.selectedCategories,
    pointLevels: state.pointLevels,
    boardTiles: state.boardTiles,
    scores: state.scores,
    teamNames: state.teamNames,
    teamCount: state.teamCount,
    currentTeam: state.currentTeam,
    lifelinesUsed: normalizeLifelinesUsed(lifelinesUsed),
    activeTileId: hasActiveLifecycleQuestion ? (state.activeTile?.id || null) : null,
    activeQuestionId: hasActiveLifecycleQuestion ? (state.activeQuestion?.id || state.activeTile?.questionId || null) : null,
    questionSessionId: state.questionSessionId || null,
    questionTurnOwnerIndex: hasActiveLifecycleQuestion ? Number(state.questionTurnOwnerIndex || state.answeringTeamIndex || state.currentTeam) : null,
    modalOpen: !el.modal.classList.contains("hidden") && hasActiveLifecycleQuestion,
    answerRevealed: state.answerRevealed,
    currentChoices: state.currentChoices,
    currentHintText: state.currentHintText,
    questionStartedAt: state.activeTile && timerStart ? timerStart : null,
    questionDeadlineTs: state.activeTile && questionDeadlineTs ? questionDeadlineTs : null,
    finished: state.boardTiles.length > 0 && !hasPlayableTiles(),
    [ROOM_USED_HISTORY_FIELD]: online.mode === "online"
      ? normalizeUsedHistoryByCategory(online.usedQuestionsByCategory)
      : undefined,
  };
}

async function applyRemoteGameState(game, { applyNonce = 0 } = {}) {
  if (!game) return;
  console.log("[Tasleya][sync] applyRemoteGameState run", {
    remoteModalOpen: !!game.modalOpen,
    remoteActiveTileId: game.activeTileId || null,
    remoteActiveQuestionId: game.activeQuestionId || null,
    localActiveTileId: state.activeTile?.id || null,
    localActiveQuestionId: state.activeQuestion?.id || null,
    localLoadingQuestion: !!state.loadingQuestion,
    localModalOpen: !el.modal?.classList.contains("hidden"),
  });
  const localQuestionInFlight = !!state.activeTile && !state.activeTile.used && (
    !!state.activeQuestion || !!state.loadingQuestion || !el.modal?.classList.contains("hidden")
  );
  const staleModalCloseForHost = online.role === "host" && localQuestionInFlight && !game.modalOpen;
  if (staleModalCloseForHost) {
    console.log("[Tasleya][sync] skipped stale remote clear after openQuestion", {
      localActiveTileId: state.activeTile?.id || null,
      localActiveQuestionId: state.activeQuestion?.id || null,
      remoteModalOpen: !!game.modalOpen,
      remoteActiveTileId: game.activeTileId || null,
      localLoadingQuestion: !!state.loadingQuestion,
    });
    return;
  }
  online.activeRemoteApplyNonce = applyNonce;
  online.applyingRemote = true;
  try {
    if (shouldAbortRemoteApply(applyNonce)) return;
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
    online.currentTurnTeam = state.currentTeam;
    lifelinesUsed = normalizeLifelinesUsed(game.lifelinesUsed || {
      1: { hint: !!game.hintHelpUsed?.[1], mcq: !!game.mcqHelpUsed?.[1] },
      2: { hint: !!game.hintHelpUsed?.[2], mcq: !!game.mcqHelpUsed?.[2] },
      3: { hint: !!game.hintHelpUsed?.[3], mcq: !!game.mcqHelpUsed?.[3] },
    });
    const remoteAnswerRevealed = !!game.answerRevealed;
    const preserveLocalReveal = online.role === "host" && state.revealRequested && !remoteAnswerRevealed;
    state.answerRevealed = preserveLocalReveal ? true : remoteAnswerRevealed;
    state.revealRequested = state.answerRevealed;
    state.currentChoices = Array.isArray(game.currentChoices) ? game.currentChoices : [];
    state.currentHintText = normalizeCell(game.currentHintText);
    console.log("[Tasleya][sync] replacing active question from remote baseline", {
      reason: "remote-state-apply-start",
      previousActiveQuestionId: state.activeQuestion?.id || null,
      previousLoadingQuestion: !!state.loadingQuestion,
    });
    state.activeQuestion = null;
    state.loadingQuestion = false;
    state.questionSessionId = "";
    state.questionTurnOwnerIndex = null;
    state.resolvedQuestionSessionId = "";

    syncTeamNameInputs();
    updateTeamModeUI();
    updateScoreboard();
    renderBoard();
    if (shouldAbortRemoteApply(applyNonce)) return;

    const activeId = game.activeTileId;
    const shouldOpen = !!game.modalOpen && activeId;
    let syncedOpenModal = false;
    if (shouldOpen) {
      const tile = state.boardTiles.find((t) => t.id === activeId && !t.used);
      if (tile) {
        try {
          if (shouldAbortRemoteApply(applyNonce)) return;
          const remoteQuestion = await fetchQuestionPayload({
            id: game.activeQuestionId || tile.questionId,
            category: tile.category,
            points: tile.points,
          });
          if (shouldAbortRemoteApply(applyNonce)) return;
          if (remoteQuestion) {
            syncedOpenModal = true;
            state.activeTile = tile;
            tile.questionId = remoteQuestion.id;
            tile.questionHistoryId = getQuestionHistoryId(remoteQuestion, { category: tile.category, points: tile.points });
            state.activeQuestion = remoteQuestion;
            state.loadingQuestion = false;
            state.questionSessionId = normalizeCell(game.questionSessionId) || createQuestionSessionId();
            state.questionTurnOwnerIndex = getActiveTeamNumbers().includes(Number(game.questionTurnOwnerIndex))
              ? Number(game.questionTurnOwnerIndex)
              : state.currentTeam;
            clearQuestionMedia();
            renderQuestionContent(remoteQuestion, { resetLifecycleState: false });
            el.answerText.classList.toggle("hidden", !state.answerRevealed);
            if (state.answerRevealed) {
              const cachedAnswer = questionBankCache.answersById.get(remoteQuestion.id);
              if (cachedAnswer?.correctAnswer) {
                el.answerText.textContent = `الإجابة: ${cachedAnswer.correctAnswer}`;
              } else {
                el.answerText.textContent = "الإجابة: جارٍ التحميل...";
                const answerResponse = await fetchAnswerPayload(remoteQuestion.id);
                el.answerText.textContent = `الإجابة: ${answerResponse.correctAnswer || "غير متاحة"}`;
              }
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
            el.lifelineBtn.disabled = remoteTimedOut || hasUsedLifeline(state.currentTeam, "mcq") || !canCurrentClientAct();
            el.hintLifelineBtn.disabled = remoteTimedOut || hasUsedLifeline(state.currentTeam, "hint") || !canCurrentClientAct();
            updateQuestionActionLock();
            el.modal.classList.remove("hidden");
            el.modal.classList.add("is-open");

            if (remoteTimedOut) {
              stopAndResetTimer();
              timerStart = Date.now() - QUESTION_TIMEOUT_MS;
              questionDeadlineTs = timerStart + QUESTION_TIMEOUT_MS;
              updateTimerUI();
            } else if (state.videoQuestionPending) {
              stopAndResetTimer();
              const remoteDeadline = Number(game.questionDeadlineTs);
              state.pendingVideoDeadlineTs = Number.isFinite(remoteDeadline)
                ? remoteDeadline
                : (game.questionStartedAt ? (Number(game.questionStartedAt) || Date.now()) + QUESTION_TIMEOUT_MS : null);
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
      console.log("[Tasleya][sync] remote state cleared active question/modal", {
        remoteModalOpen: !!game.modalOpen,
        remoteActiveTileId: game.activeTileId || null,
        localActiveTileIdBeforeClear: state.activeTile?.id || null,
        localActiveQuestionIdBeforeClear: state.activeQuestion?.id || null,
      });
      state.activeTile = null;
      state.activeQuestion = null;
      state.loadingQuestion = false;
      state.questionSessionId = "";
      closeModal({ silentSync: true, force: true });
    }

    if (game.finished) showPodiumModal();
  } finally {
    if (online.activeRemoteApplyNonce === applyNonce) {
      online.applyingRemote = false;
    }
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
  const roomTeamCount = normalizeTeamCount(room?.meta?.maxTeams || room?.teamCount);
  const fallbackNames = { 1: "الفريق الأول", 2: "الفريق الثاني", 3: "الفريق الثالث" };
  const nextTeamNames = {};
  const remoteGameState = room?.public?.gameState || {};

  for (let slot = 1; slot <= 3; slot += 1) {
    nextTeamNames[slot] = normalizeCell(remoteGameState?.teamNames?.[slot] ?? remoteGameState?.teamNames?.[`team${slot}`])
      || normalizeCell(records?.[slot]?.displayName)
      || normalizeCell(state.teamNames?.[slot])
      || fallbackNames[slot];
  }

  return {
    teamCount: roomTeamCount,
    teamNames: nextTeamNames,
    selectedCategories: Array.isArray(room?.public?.selectedCategories) ? [...room.public.selectedCategories] : [],
  };
}

function showJoinedGuestSetupPreview(room, records = {}) {
  if (online.mode !== "online" || online.role === "host" || room?.meta?.status === "playing") return;
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
    uid: online.uid,
    clientId: ensureStableOnlineClientId(),
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
    const uid = normalizeCell(parsed.uid);
    const teamSlot = Number(parsed.teamSlot) || null;
    const clientId = normalizeCell(parsed.clientId);
    if (!roomCode || !uid || !teamSlot) return null;
    return {
      mode: "online",
      roomCode,
      role: normalizeCell(parsed.role) || (teamSlot === 1 ? "host" : "guest"),
      teamSlot,
      uid,
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

function buildPresencePayload(slot, { connected = true, includeDisplayName = true } = {}) {
  const timestamp = getFirebaseTimestampValue();
  const updates = {
    [`players/${online.uid}/connected`]: connected,
    [`players/${online.uid}/teamIndex`]: slot,
    [`players/${online.uid}/joinedAt`]: timestamp,
    [`players/${online.uid}/clientId`]: ensureStableOnlineClientId(),
  };
  if (includeDisplayName) {
    updates[`players/${online.uid}/name`] = getOnlinePlayerDisplayName();
  }
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
    online.roomRef.child(`players/${online.uid}/connected`).onDisconnect().set(false);
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
  if (typeof firebase.auth === "function") {
    online.auth = firebase.auth();
  }
  if (typeof firebase.firestore === "function") {
    online.firestore = firebase.firestore();
  }
  online.firebaseReady = true;
  return true;
}

async function ensureOnlineAuth() {
  if (!initFirebase() || !online.auth) {
    throw new Error("يرجى إدخال إعدادات Firebase الصحيحة داخل firebase-config.js أولاً");
  }
  if (online.auth.currentUser?.uid) {
    online.uid = online.auth.currentUser.uid;
    return online.uid;
  }
  if (!online.authReadyPromise) {
    online.authReadyPromise = online.auth.signInAnonymously()
      .then((result) => {
        online.uid = result?.user?.uid || online.auth.currentUser?.uid || null;
        if (!online.uid) throw new Error("تعذّر تفعيل هوية اللاعب.");
        return online.uid;
      })
      .finally(() => {
        online.authReadyPromise = null;
      });
  }
  return online.authReadyPromise;
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
    await ensureOnlineAuth();
    const code = randomRoomCode();
    const ref = roomRefByCode(code);
    const selectedTeamCount = normalizeTeamCount(online.selectedTeamCount);
    const initialGameState = serializeGameState();
    initialGameState.teamCount = selectedTeamCount;
    initialGameState.selectedCategories = [];
    initialGameState.scores = { 1: 0, 2: 0, 3: 0 };
    initialGameState[ROOM_USED_HISTORY_FIELD] = normalizeUsedHistoryByCategory(initialGameState[ROOM_USED_HISTORY_FIELD]);
    const roomPayload = {
      meta: {
        createdAt: getFirebaseTimestampValue(),
        hostUid: online.uid,
        status: "lobby",
        mode: "online",
        maxTeams: selectedTeamCount,
      },
      players: {
        [online.uid]: {
          name: state.teamNames[1],
          teamIndex: 1,
          clientId: ensureStableOnlineClientId(),
          connected: true,
          joinedAt: getFirebaseTimestampValue(),
        },
      },
      public: {
        selectedCategories: [],
        gameState: initialGameState,
        scores: { 1: 0, 2: 0, 3: 0 },
      },
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
    await ensureOnlineAuth();
    const stableClientId = ensureStableOnlineClientId();
    const code = normalizeCell(codeInput).toUpperCase();
    if (!code) throw new Error("أدخل كود الغرفة أولاً.");
    const ref = roomRefByCode(code);
    const maxAttempts = 3;
    let room = null;
    let mySlot = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const snapshot = await ref.get();
      room = snapshot.val();
      if (!room) throw new Error("تعذّر الانضمام: الغرفة غير موجودة.");
      if (room.endedAt || room?.meta?.status === "ended") {
        throw new Error("تعذّر الاستعادة: الغرفة انتهت.");
      }

      const roomTeamCount = normalizeTeamCount(room?.meta?.maxTeams || room?.teamCount);
      const players = room.players && typeof room.players === "object" ? room.players : {};
      const slots = normalizeParticipantSlots(room);
      const existingSlot = Number(players?.[online.uid]?.teamIndex) || null;
      const previousUidForClient = Object.entries(players).find(([uid, rawRecord]) => {
        return uid !== online.uid && normalizeCell(rawRecord?.clientId) === stableClientId;
      })?.[0] || null;
      const existingSlotByClientId = previousUidForClient ? Number(players?.[previousUidForClient]?.teamIndex) || null : null;
      let selectedSlot = existingSlot;
      if (!selectedSlot && existingSlotByClientId) selectedSlot = existingSlotByClientId;

      if (!selectedSlot && preferredTeamSlot >= 1 && preferredTeamSlot <= roomTeamCount) {
        const slotOccupantUid = normalizeCell(slots[preferredTeamSlot]);
        const slotOccupantClientId = normalizeCell(players?.[slotOccupantUid]?.clientId);
        if (!slotOccupantUid || slotOccupantClientId === stableClientId) {
          selectedSlot = preferredTeamSlot;
        }
      }
      if (!selectedSlot) {
        for (let slot = 1; slot <= roomTeamCount; slot += 1) {
          if (!slots[slot]) {
            selectedSlot = slot;
            break;
          }
        }
      }
      if (!selectedSlot) {
        throw new Error("تعذّر الانضمام: الغرفة ممتلئة.");
      }

      const updates = {
        [`players/${online.uid}`]: {
          name: normalizeCell(state.teamNames?.[selectedSlot]) || normalizeCell(players?.[online.uid]?.name) || `الفريق ${selectedSlot}`,
          teamIndex: selectedSlot,
          clientId: stableClientId,
          connected: true,
          joinedAt: players?.[online.uid]?.joinedAt || Date.now(),
        },
      };
      if (previousUidForClient && previousUidForClient !== online.uid) {
        updates[`players/${previousUidForClient}`] = null;
      }
      await ref.update(updates);

      const verification = await ref.get();
      room = verification.val();
      if (!room) throw new Error("تعذّر الانضمام: الغرفة غير موجودة.");
      const verifiedSlots = normalizeParticipantSlots(room);
      if (verifiedSlots[selectedSlot] === online.uid) {
        mySlot = selectedSlot;
        break;
      }
    }

    if (!room) throw new Error("تعذّر الانضمام: الغرفة غير موجودة.");
    if (!mySlot) throw new Error("تعذّر الانضمام: الغرفة ممتلئة.");

    const roomTeamCount = normalizeTeamCount(room?.meta?.maxTeams || room?.teamCount);
    online.roomStatus = normalizeCell(room?.meta?.status) || "lobby";
    online.usedQuestionsByCategory = getRoomUsedQuestionHistory(room);

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
    if (room.endedAt || room?.meta?.status === "ended") {
      handleOnlineRoomUnavailable("انتهت الغرفة.");
      return;
    }

    const roomTeamCount = normalizeTeamCount(room?.meta?.maxTeams || room?.teamCount);
    online.roomStatus = normalizeCell(room?.meta?.status) || "lobby";
    online.usedQuestionsByCategory = getRoomUsedQuestionHistory(room);
    const slots = normalizeParticipantSlots(room);
    const connections = normalizeParticipantConnections(room);
    const records = normalizeParticipantRecords(room);
    const resolvedSlot = Array.from({ length: roomTeamCount }, (_, index) => index + 1).find((slot) => {
      return normalizeCell(slots[slot]) === online.uid || normalizeCell(records[slot]?.uid) === online.uid;
    }) || Number(teamSlot) || null;
    const myRecord = resolvedSlot ? records[resolvedSlot] : null;
    const hostUid = normalizeCell(room?.meta?.hostUid);
    const currentUid = normalizeCell(online.uid);

    online.participantSlots = slots;
    online.participantRecords = records;
    online.connected = connections;
    const validRoomTeams = Array.from({ length: roomTeamCount }, (_, index) => index + 1);
    const remoteGameState = room?.public?.gameState;
    online.currentTurnTeam = remoteGameState && validRoomTeams.includes(Number(remoteGameState.currentTeam))
      ? Number(remoteGameState.currentTeam)
      : null;
    const slotOneUid = normalizeCell(slots[1]) || normalizeCell(records[1]?.uid);
    const isHostClient = (hostUid && hostUid === currentUid) || (!hostUid && slotOneUid && slotOneUid === currentUid);
    online.role = isHostClient ? "host" : "guest";

    if (!resolvedSlot || (slots[resolvedSlot] && slots[resolvedSlot] !== online.uid && normalizeCell(myRecord?.uid) !== online.uid)) {
      handleOnlineRoomUnavailable("تم فقدان مقعدك في الغرفة.");
      return;
    }

    if (online.teamSlot !== resolvedSlot || online.resolvedTeamSlot !== resolvedSlot) {
      online.teamSlot = resolvedSlot;
      online.resolvedTeamSlot = resolvedSlot;
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

    if (room?.meta?.status === "playing") {
      online.hostStartInFlight = false;
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
    updateHostCategorySelectionCTA();

    if (room?.meta?.status === "playing" && remoteGameState) {
      const hostSetupScreenVisible = isOnlineHostClient()
        && !el.categoryModal.classList.contains("hidden")
        && state.boardTiles.length === 0;
      if (online.hostSetupInFlight || hostSetupScreenVisible) {
        saveOnlineSession();
        online.restoringFromSavedSession = false;
        online.sessionRestoreInProgress = false;
        return;
      }
      closeCategoryPicker();
      const applyNonce = ++online.remoteApplyNonce;
      applyRemoteGameState(remoteGameState, { applyNonce })
        .then(() => processPendingTilePickRequest(room, remoteGameState))
        .then(() => processPendingRevealRequest(room, remoteGameState))
        .then(() => processPendingScoreRequest(room, remoteGameState))
        .then(() => processPendingLifelineRequest(room, remoteGameState))
        .catch((error) => {
          console.warn("[Tasleya][online] playing-state sync failed", error);
        });
    } else if (remoteGameState) {
      const shouldSkipHostLobbyHydration = online.role === "host" && online.hostStartInFlight;
      if (!shouldSkipHostLobbyHydration) {
        ensureQuestionBankStateLoaded()
          .then(() => {
            if (online.mode === "online" && !online.applyingRemote) applyRemoteSetupState(remoteGameState);
          })
          .catch(() => {});
      }
    } else if (room?.meta?.status !== "playing" && online.role !== "host") {
      ensureQuestionBankStateLoaded()
        .then(() => {
          if (online.mode === "online" && !online.applyingRemote && online.role !== "host") {
            showJoinedGuestSetupPreview(room, records);
          }
        })
        .catch(() => {});
    } else if (room?.meta?.status !== "playing" && !el.categoryModal.classList.contains("hidden")) {
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
  // In online mode the host is the single writer for the authoritative game lifecycle.
  // Allowing non-host clients to publish full `public/gameState` snapshots can overwrite
  // freshly advanced host state (reveal/score/close/turn handoff) with stale values.
  if (online.mode !== "online" || !online.roomRef || online.applyingRemote || !isOnlineHostClient()) return;
  const isBoardReady = state.selectedCategories.length === getRequiredCategoryCount() && state.boardTiles.length > 0;
  online.roomRef.update({
    "meta/maxTeams": normalizeTeamCount(state.teamCount),
    "meta/status": isBoardReady ? "playing" : "lobby",
    "public/selectedCategories": [...state.selectedCategories],
    "public/gameState": serializeGameState(),
    "public/scores": { ...state.scores },
  }).catch((error) => {
    console.warn("[Tasleya][online] pushOnlineState failed", { error });
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
  online.usedQuestionsByCategory = {};
  online.processingTilePickRequestId = "";
  online.processingRevealRequestId = "";
  online.processingScoreRequestId = "";
  online.processingLifelineRequestId = "";
  online.restoringFromSavedSession = false;
  online.sessionRestoreInProgress = false;
  online.remoteApplyNonce = 0;
  online.activeRemoteApplyNonce = 0;
  online.hostStartInFlight = false;
  online.hostSetupInFlight = false;
  online.roomStatus = null;
  clearSavedOnlineSession();
  el.onlineStatusCard.classList.add("hidden");
  updateRoomCodeTag();
  setOnlineStatus("غير متصل");
  updateOnlineActionPermissions();
  updateHostCategorySelectionCTA();
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
  if (online.mode === "online" && online.role === "host") {
    online.hostStartInFlight = true;
    online.hostSetupInFlight = false;
  }
  setTeamNamesFromCategoryModal();
  closeCategoryPicker();
  state.scores = { 1: 0, 2: 0, 3: 0 };
  state.displayedScores = { 1: 0, 2: 0, 3: 0 };
  state.currentTeam = 1;
  lifelinesUsed = createEmptyLifelinesUsed();
  state.activeTile = null;
  state.questionSessionId = "";
  state.answerRevealed = false;
  state.revealRequested = false;
  state.currentChoices = [];
  state.currentHintText = "";
  state.answeringTeamIndex = null;
  state.questionTurnOwnerIndex = null;
  state.pendingScoreTeamIndex = null;
  state.questionResolutionLocked = false;
  state.resolvedQuestionSessionId = "";
  questionBankCache.nextQuestionByTileId.clear();
  questionBankCache.nextQuestionPromiseByTileId.clear();
  clearError();
  buildBoardAssignment();
  updateScoreboard();
  renderBoard();
  prefetchLikelyNextQuestion();
  checkEndOfGame();
  persistLocalProgress();
  logAnalyticsEvent("game_started", {
    mode: online.mode,
    categories_count: state.selectedCategories.length,
    teams_count: state.teamCount,
  });
  if (online.mode === "online") pushOnlineState();
}

async function startNewGame({ onBeforeOpenCategoryPicker = null, autoOpenCategoryPicker = true } = {}) {
  try {
    clearLocalProgress();
    pendingLocalResumePayload = null;
    updateResumePromptVisibility();
    resetGameState();
    el.newGameBtn.disabled = true;
    state.dataLoadFailed = false;
    await ensureQuestionBankStateLoaded();
    state.pointLevels = [...POINT_LEVELS];
    state.boardTiles = [];
    renderBoard();
    if (typeof onBeforeOpenCategoryPicker === "function") {
      onBeforeOpenCategoryPicker();
    }
    if (autoOpenCategoryPicker) {
      openCategoryPicker({ resetSelection: true });
    } else {
      updateHostCategorySelectionCTA();
    }
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
  document.body.classList.add("gameplay-active");
  syncDocumentRootStateClass("gameplay-active", true);
  lockGameplayPageScroll();
  attachGameplayViewportGuards();
  updateResumePromptVisibility();
}

function showStartScreen() {
  el.gameScreen.style.display = "none";
  el.startScreen.style.display = "flex";
  document.body.classList.remove("gameplay-active");
  syncDocumentRootStateClass("gameplay-active", false);
  unlockGameplayPageScroll();
  detachGameplayViewportGuards();
  resetHomepageFlowToPrimaryStep();
  detectPendingLocalResume();
}

function setHomepageFlowStep(step = "primary") {
  const isPrimaryStep = step === "primary";
  const isGroupDeviceStep = step === "groupDevice";
  const isGroupTeamsStep = step === "groupTeams";

  if (el.homepagePrimaryStep) {
    el.homepagePrimaryStep.classList.toggle("hidden", !isPrimaryStep);
  }
  if (el.homepageGroupDeviceStep) {
    el.homepageGroupDeviceStep.classList.toggle("hidden", !isGroupDeviceStep);
  }
  if (el.homepageGroupTeamsStep) {
    el.homepageGroupTeamsStep.classList.toggle("hidden", !isGroupTeamsStep);
  }
}

function resetHomepageFlowToPrimaryStep() {
  pendingHomepageGroupMode = null;
  setHomepageFlowStep("primary");
}

function updateResumePromptVisibility() {
  const shouldShow = !!pendingLocalResumePayload && el.startScreen?.style.display !== "none";
  if (el.resumeGamePrompt) {
    el.resumeGamePrompt.classList.toggle("hidden", !shouldShow);
  }
}

function detectPendingLocalResume() {
  if (new URL(window.location.href).searchParams.get("room")) {
    pendingLocalResumePayload = null;
    updateResumePromptVisibility();
    return;
  }
  const saved = loadSavedLocalProgress();
  pendingLocalResumePayload = isSavedLocalProgressResumable(saved) ? saved : null;
  if (!pendingLocalResumePayload) clearLocalProgress();
  updateResumePromptVisibility();
}

async function releaseOnlineSeat({ clearSession = true, removeSeat = false } = {}) {
  if (online.mode !== "online" || !online.roomRef || !online.teamSlot || !online.uid) {
    if (clearSession) clearSavedOnlineSession();
    return;
  }

  disconnectOnlinePresence();
  const updates = buildPresencePayload(online.teamSlot, { connected: false, includeDisplayName: false });
  if (removeSeat) {
    updates[`players/${online.uid}`] = null;
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
  closeGroupModeModal();
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

function startSoloFromHomepage() {
  closeGroupModeModal({ force: true });
  closeOnlineModal();
  closeLocalTeamsModal();
  resetHomepageFlowToPrimaryStep();
  resetOnlineMode();
  showGameScreen();
  setLocalTeamCount(1);
  updateTeamModeUI();
  startNewGame();
}

function openHomepageGroupDeviceStep() {
  pendingHomepageGroupMode = null;
  setHomepageFlowStep("groupDevice");
}

function openHomepageGroupTeamsStep(groupMode) {
  pendingHomepageGroupMode = groupMode;
  setHomepageFlowStep("groupTeams");
}

async function chooseHomepageGroupTeamCount(teamCount) {
  if (pendingHomepageGroupMode === "single-device") {
    resetHomepageFlowToPrimaryStep();
    closeOnlineModal();
    closeLocalTeamsModal();
    resetOnlineMode();
    showGameScreen();
    setLocalTeamCount(teamCount);
    updateTeamModeUI();
    await startNewGame();
    return;
  }

  if (pendingHomepageGroupMode === "multi-device") {
    resetHomepageFlowToPrimaryStep();
    setOnlineTeamCount(teamCount);
    await enterGame("online");
  }
}

function openGroupModeModal() {
  if (!el.groupModeModal) return;
  closeOnlineModal();
  closeLocalTeamsModal();
  el.groupModeModal.classList.remove("hidden", "is-closing");
  void el.groupModeModal.offsetWidth;
  el.groupModeModal.classList.add("is-open");
  el.groupModeModal.setAttribute("aria-hidden", "false");
  if (el.groupOneDeviceBtn) {
    window.setTimeout(() => el.groupOneDeviceBtn.focus(), 0);
  }
}
function closeGroupModeModal({ force = false } = {}) {
  if (!el.groupModeModal) return;
  if (force) {
    el.groupModeModal.classList.remove("is-open", "is-closing");
    el.groupModeModal.classList.add("hidden");
    el.groupModeModal.setAttribute("aria-hidden", "true");
    return;
  }
  el.groupModeModal.classList.remove("is-open", "is-closing");
  el.groupModeModal.classList.add("hidden");
  el.groupModeModal.setAttribute("aria-hidden", "true");
}

function openLocalTeamsModal() {
  if (el.localTeamsModalTitle) {
    el.localTeamsModalTitle.textContent = "كم عدد الفرق في اللعب الجماعي؟";
  }
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

  online.uid = savedSession.uid;
  online.clientId = savedSession.clientId || ensureStableOnlineClientId();
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

  if (!el.contactForm) {
    setContactFeedback("تعذّر إرسال الرسالة. حاول مرة أخرى.", "error");
    return;
  }

  contactState.submitting = true;
  if (el.sendContactBtn) el.sendContactBtn.disabled = true;
  setContactFeedback("جارٍ الإرسال...", "info");

  try {
    const formData = new FormData(el.contactForm);
    formData.set("message", message);
    formData.set("name", name);
    formData.set("email", email);

    const response = await fetch(CONTACT_FORM_ACTION, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Formspree request failed with status ${response.status}`);
    }

    contactState.cooldownUntil = Date.now() + CONTACT_SUBMIT_COOLDOWN_MS;
    el.contactForm.reset();
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
  ensureHomepageFlowModals();
  cacheElements();
  ensureSoundPreferenceLoaded();
  ensureStableOnlineClientId();
  document.body.classList.remove("gameplay-active");
  syncDocumentRootStateClass("gameplay-active", false);
  unlockGameplayPageScroll();
  updateHostCategorySelectionCTA();

  bindEvent(el.newGameBtn, "click", () => {
    if (shouldShowHostCategorySelectionCTA()) {
      openCategoryPicker({ resetSelection: true });
      return;
    }
    if (online.mode === "online" && online.role !== "host") return;
    startNewGame();
  }, "newGameBtn");
  bindEvent(el.closeModalBtn, "click", () => closeModal(), "closeModalBtn");
  bindEvent(el.revealBtn, "click", revealAnswer, "revealBtn");
  bindEvent(el.correctBtn, "click", () => applyScore(true), "correctBtn");
  bindEvent(el.wrongBtn, "click", () => applyScore(false), "wrongBtn");
  bindEvent(el.otherTeamBtn, "click", awardPointsToOtherTeam, "otherTeamBtn");
  bindEvent(el.lateOtherTeamPrompt, "click", awardPointsToOtherTeam, "lateOtherTeamPrompt");
  bindEvent(el.otherTeamChoices, "click", (event) => {
    const teamButton = event.target.closest("button[data-team]");
    if (!teamButton) return;
    handleOtherTeamSelection(teamButton.dataset.team);
  }, "otherTeamChoices");
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
    console.log("[Tasleya][board] tile click", {
      tileId: tileBtn.dataset.tileId,
      mode: online.mode,
      role: online.role,
    });
    animateTileSelection(tileBtn);
    openQuestion(tileBtn.dataset.tileId);
  }, "board");
  bindEvent(el.categoryModal, "click", (event) => { if (event.target === el.categoryModal) closeCategoryPicker(); }, "categoryModal");

  bindEvent(el.backToHomeBtn, "click", returnToHomeScreen, "backToHomeBtn");
  bindEvent(el.startLocalBtn, "click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    console.log("[Tasleya] Start solo button clicked");
    logAnalyticsEvent("local_game_started", { mode: "solo" });
    startSoloFromHomepage();
  }, "startLocalBtn");
  bindEvent(el.resumeGameBtn, "click", () => {
    if (!pendingLocalResumePayload) return;
    const resumed = applySavedLocalProgress(pendingLocalResumePayload);
    if (resumed) {
      pendingLocalResumePayload = null;
      updateResumePromptVisibility();
      return;
    }
    clearLocalProgress();
    pendingLocalResumePayload = null;
    updateResumePromptVisibility();
  }, "resumeGameBtn");
  bindEvent(el.discardResumeGameBtn, "click", () => {
    clearLocalProgress();
    pendingLocalResumePayload = null;
    updateResumePromptVisibility();
    resetHomepageFlowToPrimaryStep();
    showStartScreen();
  }, "discardResumeGameBtn");
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
  bindEvent(el.startOnlineBtn, "click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    console.log("[Tasleya] Start group button clicked: switching to in-page group flow");
    openHomepageGroupDeviceStep();
  }, "startOnlineBtn");
  bindEvent(el.homeGroupOneDeviceBtn, "click", () => {
    openHomepageGroupTeamsStep("single-device");
  }, "homeGroupOneDeviceBtn");
  bindEvent(el.homeGroupMultiDeviceBtn, "click", () => {
    openHomepageGroupTeamsStep("multi-device");
  }, "homeGroupMultiDeviceBtn");
  bindEvent(el.homeGroupDeviceBackBtn, "click", resetHomepageFlowToPrimaryStep, "homeGroupDeviceBackBtn");
  bindEvent(el.homeGroupTwoTeamsBtn, "click", async () => {
    if (pendingHomepageGroupMode === "single-device") {
      logAnalyticsEvent("local_game_started", { mode: "single_device_group", teams: 2 });
    }
    if (pendingHomepageGroupMode === "multi-device") {
      logAnalyticsEvent("online_game_started", { mode: "multi_device_group", teams: 2 });
    }
    await chooseHomepageGroupTeamCount(2);
  }, "homeGroupTwoTeamsBtn");
  bindEvent(el.homeGroupThreeTeamsBtn, "click", async () => {
    if (pendingHomepageGroupMode === "single-device") {
      logAnalyticsEvent("local_game_started", { mode: "single_device_group", teams: 3 });
    }
    if (pendingHomepageGroupMode === "multi-device") {
      logAnalyticsEvent("online_game_started", { mode: "multi_device_group", teams: 3 });
    }
    await chooseHomepageGroupTeamCount(3);
  }, "homeGroupThreeTeamsBtn");
  bindEvent(el.homeGroupTeamsBackBtn, "click", () => {
    openHomepageGroupDeviceStep();
  }, "homeGroupTeamsBackBtn");
  bindEvent(el.groupOneDeviceBtn, "click", () => {
    closeGroupModeModal();
    logAnalyticsEvent("local_game_started", { mode: "single_device_group" });
    enterGame("local");
  }, "groupOneDeviceBtn");
  bindEvent(el.groupMultiDeviceBtn, "click", () => {
    closeGroupModeModal();
    logAnalyticsEvent("online_game_started", { mode: "multi_device_group" });
    enterGame("online");
  }, "groupMultiDeviceBtn");
  bindEvent(el.cancelGroupModeBtn, "click", closeGroupModeModal, "cancelGroupModeBtn");
  bindEvent(el.groupModeModal, "click", (event) => {
    if (event.target === el.groupModeModal) closeGroupModeModal();
  }, "groupModeModal");
  bindEvent(el.instructionsBtn, "click", openInstructionsModal, "instructionsBtn");
  bindEvent(el.closeInstructionsBtn, "click", closeInstructionsModal, "closeInstructionsBtn");
  bindEvent(el.instructionsModal, "click", (event) => {
    if (event.target === el.instructionsModal) closeInstructionsModal();
  }, "instructionsModal");
  bindEvent(el.contactBtn, "click", openContactModal, "contactBtn");
  bindEvent(el.contactForm, "submit", (event) => {
    event.preventDefault();
    submitContactMessage();
  }, "contactForm");
  bindEvent(el.closeContactBtn, "click", closeContactModal, "closeContactBtn");
  bindEvent(el.contactModal, "click", (event) => {
    if (event.target === el.contactModal) closeContactModal();
  }, "contactModal");
  bindEvent(el.contactMessageInput, "keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      el.contactForm?.requestSubmit();
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
    if (online.mode === "online" && online.role === "host") {
      online.hostSetupInFlight = true;
    }
    if (online.mode === "online" && online.role === "host" && online.roomRef) {
      const preservedUsedHistory = normalizeUsedHistoryByCategory(online.usedQuestionsByCategory);
      online.roomRef.update({
        "meta/maxTeams": normalizeTeamCount(state.teamCount),
        "meta/status": "lobby",
        "public/selectedCategories": [],
        "public/gameState": {
          [ROOM_USED_HISTORY_FIELD]: preservedUsedHistory,
        },
        "public/scores": { 1: 0, 2: 0, 3: 0 },
      }).catch(() => {});
    }
    try {
      await startNewGame({
        onBeforeOpenCategoryPicker: () => closeOnlineModal(),
        autoOpenCategoryPicker: false,
      });
    } catch (_) {
      if (online.mode === "online" && online.role === "host") {
        online.hostSetupInFlight = false;
      }
    }
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

  detectPendingLocalResume();
  if (el.gameScreen?.style.display === "block") {
    attachGameplayViewportGuards();
  } else {
    detachGameplayViewportGuards();
  }

  window.addEventListener("pagehide", persistLocalProgress);
  window.addEventListener("beforeunload", persistLocalProgress);
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
    if (restored) return;
    if (pendingLocalResumePayload) return;
    tryAutoJoinFromUrl();
  });
  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}
