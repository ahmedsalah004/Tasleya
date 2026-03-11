const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkJrYhyba86QOQooWig5SveDZXxrp_ERypkLZlslSzp2KtTK4gwUqqIWYTqwq0bQHETiUI_Z2b8gvd/pub?gid=0&single=true&output=csv";
const CATEGORIES_TO_SELECT = 6;
const POINT_ROWS_COUNT = 5;
const POINT_LEVELS = [100, 200, 300, 400, 500];
const SUPPORTED_TEAM_COUNTS = [2, 3];
const USED_STORAGE_KEY = "tasleya_used_v1";
const TEAM_NAMES_STORAGE_KEY = "tasleya_team_names_v1";
const ONLINE_SESSION_STORAGE_KEY = "tasleya_online_session_v1";
const INSTRUCTIONS_SEEN_STORAGE_KEY = "tasleya_instructions_seen_v1";
const FIREBASE_ROOMS_PATH = "tasleyaRooms";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let mcqHelpUsed = { 1: false, 2: false, 3: false };
let hintHelpUsed = { 1: false, 2: false, 3: false };
let timerInterval = null;
let timerStart = null;
let questionTimeoutToken = null;

const QUESTION_WARNING_MS = 60000;
const QUESTION_TIMEOUT_MS = 75000;
const DEFAULT_CATEGORY_GROUP = "معلومات عامة";
const CATEGORY_DISPLAY_GROUPS = [
  {
    name: "علوم إسلامية",
    categories: ["القرآن الكريم", "أحاديث", "السيرة النبوية", "تاريخ اسلامي"],
  },
  {
    name: "جغرافيا",
    categories: ["ما هي الدولة بالعلم", "ما هي الدولة بالخريطة", "عواصم", "لون العلم"],
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
    categories: ["طب", "هندسة"],
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
  categoryList: document.getElementById("categoryList"),
  categoryTeam1NameInput: document.getElementById("categoryTeam1NameInput"),
  categoryTeam2NameInput: document.getElementById("categoryTeam2NameInput"),
  categoryTeam3NameInput: document.getElementById("categoryTeam3NameInput"),
  categoryTeam3NameLabel: document.getElementById("categoryTeam3NameLabel"),
  categoryCounter: document.getElementById("categoryCounter"),
  startGameBtn: document.getElementById("startGameBtn"),
  randomCategoriesBtn: document.getElementById("randomCategoriesBtn"),
  cancelCategoryBtn: document.getElementById("cancelCategoryBtn"),
  podiumModal: document.getElementById("podiumModal"),
  podiumTitle: document.getElementById("podiumTitle"),
  podiumSubtitle: document.getElementById("podiumSubtitle"),
  podiumBoard: document.getElementById("podiumBoard"),
  podiumNewGameBtn: document.getElementById("podiumNewGameBtn"),
  startScreen: document.getElementById("startScreen"),
  gameScreen: document.getElementById("gameScreen"),
  startLocalBtn: document.getElementById("startLocalBtn"),
  startOnlineBtn: document.getElementById("startOnlineBtn"),
  instructionsBtn: document.getElementById("instructionsBtn"),
  instructionsModal: document.getElementById("instructionsModal"),
  closeInstructionsBtn: document.getElementById("closeInstructionsBtn"),
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
  roomCodeInput: document.getElementById("roomCodeInput"),
  confirmJoinBtn: document.getElementById("confirmJoinBtn"),
  cancelOnlineBtn: document.getElementById("cancelOnlineBtn"),
  onlineStatusCard: document.getElementById("onlineStatusCard"),
  onlineStatusText: document.getElementById("onlineStatusText"),
  onlineRoomCodeText: document.getElementById("onlineRoomCodeText"),
  onlineFeedback: document.getElementById("onlineFeedback"),
  localTeamsModal: document.getElementById("localTeamsModal"),
  localTwoTeamsBtn: document.getElementById("localTwoTeamsBtn"),
  localThreeTeamsBtn: document.getElementById("localThreeTeamsBtn"),
  cancelLocalTeamsBtn: document.getElementById("cancelLocalTeamsBtn"),
  };
}

const state = {
  allQuestions: [],
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
  displayedScores: { 1: 0, 2: 0 },
  answerRevealed: false,
  currentChoices: [],
  currentHintText: "",
};

const online = {
  mode: "local",
  role: null,
  roomCode: "",
  roomRef: null,
  connected: { 1: false, 2: false },
  listening: false,
  applyingRemote: false,
  firebaseReady: false,
  db: null,
  creatingRoom: false,
  joiningRoom: false,
  clientId: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : String(Date.now()),
};



function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
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
  questions: null,
  categories: null,
  loadPromise: null,
};

function normalizeCell(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}
function showError(message) { el.errorBanner.textContent = message; el.errorBanner.classList.remove("hidden"); }
function clearError() { el.errorBanner.textContent = ""; el.errorBanner.classList.add("hidden"); }


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
  return !!(modalOpen && state.activeTile && !state.activeTile.used && state.activeTile.question);
}

function shouldLockQuestionClose() {
  if (!hasUnresolvedActiveQuestion()) return false;
  if (online.mode !== "online") return true;
  return canCurrentClientAct();
}

function updateCloseButtonLock() {
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
  el.otherTeamBtn.disabled = disableActions || lockByReveal;
  el.lifelineBtn.disabled = disableActions || state.answerRevealed || mcqHelpUsed[state.currentTeam];
  el.hintLifelineBtn.disabled = disableActions || state.answerRevealed || hintHelpUsed[state.currentTeam];
  updateCloseButtonLock();
}

function updateTimerUI() {
  const elapsed = timerStart ? Date.now() - timerStart : 0;
  el.questionTimer.textContent = formatElapsedTime(Math.min(elapsed, QUESTION_TIMEOUT_MS));
  el.questionTimer.classList.toggle("timer-red", elapsed >= QUESTION_WARNING_MS);
}
function stopTimer() { if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; } }
function stopQuestionTimeout() { if (questionTimeoutToken !== null) { clearTimeout(questionTimeoutToken); questionTimeoutToken = null; } }
function resetTimer() { timerStart = null; updateTimerUI(); }
function stopAndResetTimer() { stopTimer(); stopQuestionTimeout(); resetTimer(); }
function handleQuestionTimeout() {
  if (questionTimeoutToken === null) return;
  questionTimeoutToken = null;
  if (online.mode === "online" && !canCurrentClientAct()) return;
  const tile = state.activeTile;
  if (!tile || tile.used || !tile.question || tile.timedOut) return;
  timerStart = Date.now() - QUESTION_TIMEOUT_MS;
  updateTimerUI();
  stopTimer();
  showQuestionStatus("انتهى الوقت");
  resolveActiveQuestion({
    timedOut: true,
    nextTeam: getNextTeamNumber(state.currentTeam),
  });
}
function startTimer() {
  stopAndResetTimer();
  timerStart = Date.now();
  updateTimerUI();
  timerInterval = setInterval(updateTimerUI, 250);
  if (online.mode !== "online" || canCurrentClientAct()) {
    questionTimeoutToken = setTimeout(handleQuestionTimeout, QUESTION_TIMEOUT_MS);
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
function getNextTeamNumber(team) {
  const activeTeams = getActiveTeamNumbers();
  const index = activeTeams.indexOf(team);
  if (index === -1) return activeTeams[0] || 1;
  return activeTeams[(index + 1) % activeTeams.length];
}
function setLocalTeamCount(teamCount) {
  const normalized = Number(teamCount);
  state.teamCount = SUPPORTED_TEAM_COUNTS.includes(normalized) ? normalized : 2;
}
function updateTeamModeUI() {
  const isThreeTeams = state.teamCount === 3;
  document.body.classList.toggle("local-three-teams", isThreeTeams && online.mode !== "online");
  el.team3Card.classList.toggle("hidden", !isThreeTeams);
  el.categoryTeam3NameInput.classList.toggle("hidden", !isThreeTeams);
  el.categoryTeam3NameLabel.classList.toggle("hidden", !isThreeTeams);
}

function parseCSV(text) {
  const rows = []; let row = []; let value = ""; let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]; const next = text[i + 1];
    if (char === '"') { if (inQuotes && next === '"') { value += '"'; i += 1; } else { inQuotes = !inQuotes; } continue; }
    if (char === "," && !inQuotes) { row.push(normalizeCell(value)); value = ""; continue; }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(normalizeCell(value)); value = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = []; continue;
    }
    value += char;
  }
  if (value.length || row.length) { row.push(normalizeCell(value)); if (row.some((cell) => cell !== "")) rows.push(row); }
  return rows;
}
function normalizeHeader(header) { return normalizeCell(header).trim().toLowerCase().replace(/\s+/g, "_"); }
function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeCell(value);
    if (normalized) return normalized;
  }
  return "";
}
function toPoints(question) {
  const explicit = Number.parseInt(String(question.points ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(explicit) ? explicit : null;
}
function rowsToQuestions(rows) {
  const [headers, ...dataRows] = rows;
  const mapHeaders = headers.map(normalizeHeader);
  return dataRows.map((row, index) => {
    const q = {};
    mapHeaders.forEach((key, i) => { q[key] = normalizeCell(row[i]); });
    const hintValue = firstNonEmpty(
      q["تلميح"],
      q["تلميح_(hint)"],
      q.hint,
      q.hint_text,
    );
    const difficulty = Number.parseInt(String(q.difficulty ?? "").replace(/[^\d]/g, ""), 10);
    const computedPoints = toPoints(q) ?? (difficulty >= 1 && difficulty <= 5 ? difficulty * 100 : null);
    const question = {
      id: q.id || String(index + 1), category: q.category || "", points: computedPoints,
      question: q.question || "", answer: q.answer || "", type: (q.type || "text").toLowerCase(),
      image_url: q.image_url || "", choice_a: q.choice_a || "", choice_b: q.choice_b || "", choice_c: q.choice_c || "", choice_d: q.choice_d || "",
      hint: hintValue,
      "تلميح": hintValue,
    };
    console.log("[Tasleya] Loaded question hint", {
      id: question.id,
      type: question.type,
      question: question.question,
      hint: question.hint,
    });
    return question;
  }).filter((q) => q.question && q.answer && q.category);
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

async function fetchQuestions() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const rows = parseCSV(await res.text());
  if (rows.length < 2) throw new Error("ملف CSV لا يحتوي بيانات كافية.");
  return rowsToQuestions(rows);
}

async function preloadQuestionBank() {
  if (questionBankCache.questions && questionBankCache.categories) {
    return {
      questions: questionBankCache.questions,
      categories: questionBankCache.categories,
    };
  }

  if (questionBankCache.loadPromise) return questionBankCache.loadPromise;

  questionBankCache.loadPromise = (async () => {
    const questions = await fetchQuestions();
    if (questions.length === 0) throw new Error("لا توجد أسئلة صالحة في الملف.");
    const categories = getUniqueCategories(questions);
    if (categories.length < CATEGORIES_TO_SELECT) throw new Error(`يلزم وجود ${CATEGORIES_TO_SELECT} فئات مختلفة على الأقل في ملف CSV.`);

    questionBankCache.questions = questions;
    questionBankCache.categories = categories;
    return { questions, categories };
  })();

  try {
    return await questionBankCache.loadPromise;
  } catch (error) {
    questionBankCache.questions = null;
    questionBankCache.categories = null;
    throw error;
  } finally {
    questionBankCache.loadPromise = null;
  }
}
function getUniqueCategories(questions) {
  const unique = [];
  questions.forEach((q) => { if (!unique.includes(q.category)) unique.push(q.category); });
  return unique;
}
function getQuestionForTile(category, points, usedIds) {
  const candidates = state.allQuestions.filter((q) => q.category === category && q.points === points);
  if (!candidates.length) return null;
  const bucket = ensureBucket(category, points);
  const unusedAcrossGames = candidates.filter((q) => !bucket.includes(q.id));
  const scoped = (unusedAcrossGames.length ? unusedAcrossGames : candidates).filter((q) => !usedIds.has(q.id));
  if (!unusedAcrossGames.length) { state.usedHistory[category][String(points)] = []; saveUsedHistory(); }
  if (!scoped.length) return null;
  const chosen = scoped[Math.floor(Math.random() * scoped.length)];
  usedIds.add(chosen.id);
  markQuestionAsUsed(category, points, chosen.id);
  return chosen;
}
function buildBoardAssignment() {
  state.assignedQuestionIds = new Set();
  const tiles = [];
  state.selectedCategories.forEach((category) => {
    state.pointLevels.forEach((points) => {
      const question = getQuestionForTile(category, points, state.assignedQuestionIds);
      tiles.push({ id: `${category}-${points}`, category, points, question, used: !question, missing: !question });
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
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}
function setTeamNamesFromCategoryModal() {
  setTeamName(1, el.categoryTeam1NameInput.value, { commit: true });
  setTeamName(2, el.categoryTeam2NameInput.value, { commit: true });
  if (state.teamCount === 3) setTeamName(3, el.categoryTeam3NameInput.value, { commit: true });
}

function hasPlayableTiles() { return state.boardTiles.some((tile) => !tile.used && !tile.missing && tile.question); }
function closePodiumModal() { el.podiumModal.classList.add("hidden"); el.podiumModal.classList.remove("is-open"); }
function buildPodiumColumn(name, score, label, placeClass) {
  return `<div class="podium-column ${placeClass}"><p class="podium-label">${label}</p><p class="podium-team-name">${name}</p><p class="podium-score">${score}</p><div class="podium-step"></div></div>`;
}
function showPodiumModal() {
  const activeTeams = getActiveTeamNumbers();
  const rankedTeams = [...activeTeams].sort((a, b) => state.scores[b] - state.scores[a]);
  if (state.teamCount === 3) {
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
  if (state.dataLoadFailed || state.selectedCategories.length !== CATEGORIES_TO_SELECT || state.pointLevels.length === 0) { el.board.innerHTML = ""; return; }
  el.board.innerHTML = "";
  state.selectedCategories.forEach((category) => {
    const header = document.createElement("div"); header.className = "board-cell category"; header.textContent = category; el.board.appendChild(header);
  });
  state.pointLevels.forEach((points) => {
    state.selectedCategories.forEach((category) => {
      const tile = state.boardTiles.find((t) => t.category === category && t.points === points);
      if (!tile) return;
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "board-cell tile"; btn.dataset.tileId = tile.id; btn.setAttribute("aria-label", `${category} ${points}`);
      if (tile.missing) { btn.textContent = "نقص أسئلة"; btn.disabled = true; btn.classList.add("missing", "used"); }
      else if (tile.used) { btn.textContent = ""; btn.disabled = true; btn.classList.add("used"); }
      else { btn.textContent = String(points); btn.disabled = false; }
      btn.addEventListener("click", () => openQuestion(tile.id));
      el.board.appendChild(btn);
    });
  });
}

function getActiveQuestion() { return state.activeTile?.question || null; }
function getBasePath() { return window.location.pathname.includes("/Tasleya/") ? "/Tasleya/" : "/"; }
function toMediaUrl(mediaPath) {
  const normalized = normalizeCell(mediaPath);
  if (!normalized) return "";
  if (/^(?:https?:)?\/\//i.test(normalized) || normalized.startsWith("data:")) return encodeURI(normalized);
  const cleanedPath = normalized.replace(/^\.\//, "").replace(/^\//, "");
  return encodeURI(`${getBasePath()}${cleanedPath}`);
}
function clearQuestionMedia() {
  const currentAudio = el.questionMedia.querySelector("audio");
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
  el.questionMedia.innerHTML = "";
}
function renderQuestionImage(imagePath) {
  const imageSrc = toMediaUrl(imagePath); if (!imageSrc) return;
  const image = document.createElement("img"); image.id = "questionImage"; image.alt = "صورة السؤال"; image.src = imageSrc; el.questionMedia.appendChild(image);
}
function renderQuestionAudio(audioPath) {
  const audioSrc = toMediaUrl(audioPath); if (!audioSrc) return;
  const audio = document.createElement("audio"); audio.id = "questionAudio"; audio.controls = true; audio.preload = "none"; audio.setAttribute("aria-label", "مشغل صوت السؤال");
  audio.innerHTML = `<source src="${audioSrc}" type="audio/mpeg">`; audio.load(); el.questionMedia.appendChild(audio);
}

function getMyTeamNumber() {
  if (online.mode !== "online") return state.currentTeam;
  return online.role === "host" ? 1 : 2;
}
function canCurrentClientAct() {
  if (online.mode !== "online") return true;
  if (!state.activeTile) return getMyTeamNumber() === state.currentTeam;
  return getMyTeamNumber() === state.currentTeam;
}

function openQuestion(tileId) {
  if (online.mode === "online" && !canCurrentClientAct()) return;
  if (hasUnresolvedActiveQuestion()) return;
  stopAndResetTimer(); clearQuestionMedia();
  const tile = state.boardTiles.find((t) => t.id === tileId);
  if (!tile || tile.used || !tile.question) return;
  state.activeTile = tile;
  tile.timedOut = false;
  const q = tile.question;
  console.log("[Tasleya] Opening question", { id: q.id, type: q.type, hint: q.hint, rawHint: q["تلميح"] });
  el.questionText.textContent = q.question;
  el.answerText.textContent = `الإجابة: ${q.answer}`;
  el.answerText.classList.add("hidden");
  state.answerRevealed = false;
  el.choicesBox.classList.add("hidden");
  el.choicesList.innerHTML = "";
  state.currentChoices = [];
  state.currentHintText = "";
  el.hintText.textContent = "";
  el.hintBox.classList.add("hidden");
  showQuestionStatus("");
  if (q.type === "image" && q.image_url) renderQuestionImage(q.image_url);
  if (q.type === "audio" && q.image_url) renderQuestionAudio(q.image_url);
  el.lifelineBtn.disabled = mcqHelpUsed[state.currentTeam] || (online.mode === "online" && !canCurrentClientAct());
  el.hintLifelineBtn.disabled = hintHelpUsed[state.currentTeam] || (online.mode === "online" && !canCurrentClientAct());
  updateQuestionActionLock();
  startTimer();
  el.modal.classList.remove("hidden");
  requestAnimationFrame(() => { el.modal.classList.remove("is-closing"); el.modal.classList.add("is-open"); });
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function closeModal({ silentSync = false, force = false } = {}) {
  if (!force && shouldLockQuestionClose()) {
    updateCloseButtonLock();
    return false;
  }
  stopAndResetTimer(); clearQuestionMedia();
  state.currentHintText = "";
  el.hintText.textContent = "";
  el.hintBox.classList.add("hidden");
  showQuestionStatus("");
  if (el.modal.classList.contains("hidden")) { state.activeTile = null; return; }
  if (prefersReducedMotion) {
    el.modal.classList.add("hidden"); el.modal.classList.remove("is-open", "is-closing"); state.activeTile = null;
  } else {
    el.modal.classList.remove("is-open"); el.modal.classList.add("is-closing");
    const onEnd = () => { el.modal.classList.add("hidden"); el.modal.classList.remove("is-closing"); state.activeTile = null; el.modal.removeEventListener("animationend", onEnd, true); };
    el.modal.addEventListener("animationend", onEnd, true);
  }
  updateCloseButtonLock();
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
  state.answerRevealed = false;
  state.currentChoices = [];
  state.currentHintText = "";
  closeModal({ silentSync: true });
  closeCategoryPicker();
  closePodiumModal();
  clearError();
  updateScoreboard();
  renderBoard();
}

function revealAnswer() {
  if (!getActiveQuestion() || state.answerRevealed || state.activeTile?.timedOut || (online.mode === "online" && !canCurrentClientAct())) return;
  el.answerText.classList.remove("hidden");
  state.answerRevealed = true;
  updateQuestionActionLock();
  if (!prefersReducedMotion) { el.answerText.classList.remove("reveal-anim"); void el.answerText.offsetWidth; el.answerText.classList.add("reveal-anim"); }
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}
function uniqueByText(items) { const seen = new Set(); return items.filter((item) => { const key = item.trim(); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
function generateChoices(question) {
  const direct = [question.choice_a, question.choice_b, question.choice_c, question.choice_d].filter(Boolean);
  if (direct.length === 4) return shuffle(direct);
  const sameCategoryWrong = state.allQuestions.filter((q) => q.category === question.category && q.id !== question.id).map((q) => q.answer);
  const allWrong = state.allQuestions.filter((q) => q.id !== question.id).map((q) => q.answer);
  const wrongPool = uniqueByText([...sameCategoryWrong, ...allWrong]).filter((ans) => ans !== question.answer);
  const wrongChoices = shuffle(wrongPool).slice(0, 3);
  const built = uniqueByText([question.answer, ...wrongChoices]);
  while (built.length < 4) built.push(`خيار ${built.length + 1}`);
  return shuffle(built.slice(0, 4));
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
  resolveActiveQuestion({
    scoreDelta,
    nextTeam: getNextTeamNumber(state.currentTeam),
  });
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
  if (!tile || tile.used || !tile.question) return false;
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
  getActiveTeamNumbers().forEach((team) => {
    state.scores[team] = Math.max(0, state.scores[team]);
  });

  if (getActiveTeamNumbers().includes(nextTeam)) {
    state.currentTeam = nextTeam;
  }

  updateScoreboard();
  renderBoard();
  closeModal({ silentSync: true });
  checkEndOfGame();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
  return true;
}

function updateCategoryPickerUI() {
  el.categoryCounter.textContent = `المحدد: ${state.selectedCategories.length} / ${CATEGORIES_TO_SELECT}`;
  el.startGameBtn.disabled = state.selectedCategories.length !== CATEGORIES_TO_SELECT;
  const checkedSet = new Set(state.selectedCategories); const reachedMax = checkedSet.size >= CATEGORIES_TO_SELECT;
  el.categoryList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.checked = checkedSet.has(checkbox.value);
    checkbox.disabled = !checkbox.checked && reachedMax;
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
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) { if (state.selectedCategories.length < CATEGORIES_TO_SELECT) state.selectedCategories.push(category); }
        else state.selectedCategories = state.selectedCategories.filter((c) => c !== category);
        updateCategoryPickerUI();
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
function openCategoryPicker() {
  state.selectedCategories = [];
  el.categoryTeam1NameInput.value = state.teamNames[1];
  el.categoryTeam2NameInput.value = state.teamNames[2];
  el.categoryTeam3NameInput.value = state.teamNames[3];
  updateTeamModeUI();
  renderCategoryOptions();
  if (online.mode === "online" && online.role !== "host") {
    el.startGameBtn.disabled = true;
    el.randomCategoriesBtn.disabled = true;
    el.categoryTeam1NameInput.disabled = true;
    el.categoryTeam2NameInput.disabled = true;
    el.categoryTeam3NameInput.disabled = true;
  } else {
    el.randomCategoriesBtn.disabled = false;
    el.categoryTeam1NameInput.disabled = false;
    el.categoryTeam2NameInput.disabled = false;
    el.categoryTeam3NameInput.disabled = state.teamCount !== 3;
  }
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
function pickRandomCategories() { state.selectedCategories = shuffle(state.allCategories).slice(0, CATEGORIES_TO_SELECT); updateCategoryPickerUI(); }

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
    modalOpen: !el.modal.classList.contains("hidden") && !!state.activeTile,
    answerRevealed: state.answerRevealed,
    currentChoices: state.currentChoices,
    currentHintText: state.currentHintText,
    questionStartedAt: state.activeTile && timerStart ? timerStart : null,
    finished: state.boardTiles.length > 0 && !hasPlayableTiles(),
  };
}

function applyRemoteGameState(game) {
  if (!game) return;
  online.applyingRemote = true;
  try {
    state.selectedCategories = Array.isArray(game.selectedCategories) ? [...game.selectedCategories] : [];
    state.pointLevels = Array.isArray(game.pointLevels) ? [...game.pointLevels] : [...POINT_LEVELS];
    state.boardTiles = Array.isArray(game.boardTiles) ? [...game.boardTiles] : [];
    state.teamCount = 2;
    state.scores = game.scores || { 1: 0, 2: 0, 3: 0 };
    state.teamNames = game.teamNames || { 1: "الفريق الأول", 2: "الفريق الثاني", 3: "الفريق الثالث" };
    state.currentTeam = Number(game.currentTeam) === 2 ? 2 : 1;
    mcqHelpUsed = game.mcqHelpUsed || { 1: false, 2: false, 3: false };
    hintHelpUsed = game.hintHelpUsed || { 1: false, 2: false, 3: false };
    state.answerRevealed = !!game.answerRevealed;
    state.currentChoices = Array.isArray(game.currentChoices) ? game.currentChoices : [];
    state.currentHintText = normalizeCell(game.currentHintText);

    syncTeamNameInputs();
    updateScoreboard();
    renderBoard();

    const activeId = game.activeTileId;
    const shouldOpen = !!game.modalOpen && activeId;
    let syncedOpenModal = false;
    if (shouldOpen) {
      const tile = state.boardTiles.find((t) => t.id === activeId && !t.used && t.question);
      if (tile) {
        syncedOpenModal = true;
        state.activeTile = tile;
        clearQuestionMedia();
        el.questionText.textContent = tile.question.question;
        el.answerText.textContent = `الإجابة: ${tile.question.answer}`;
        el.answerText.classList.toggle("hidden", !state.answerRevealed);
        if (tile.question.type === "image" && tile.question.image_url) renderQuestionImage(tile.question.image_url);
        if (tile.question.type === "audio" && tile.question.image_url) renderQuestionAudio(tile.question.image_url);
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
          updateTimerUI();
        } else if (game.questionStartedAt) {
          stopAndResetTimer();
          timerStart = Number(game.questionStartedAt) || Date.now();
          updateTimerUI();
          stopTimer();
          timerInterval = setInterval(updateTimerUI, 250);
          const remaining = Math.max(0, QUESTION_TIMEOUT_MS - (Date.now() - timerStart));
          if (online.mode !== "online" || canCurrentClientAct()) {
            questionTimeoutToken = setTimeout(handleQuestionTimeout, remaining);
          }
        } else {
          startTimer();
        }
      }
    }

    if (!syncedOpenModal) {
      state.activeTile = null;
      closeModal({ silentSync: true, force: true });
    }

    if (game.finished) showPodiumModal();
  } finally {
    online.applyingRemote = false;
  }
}

function setOnlineStatus(text) { el.onlineStatusText.textContent = text; }
function updateRoomCodeTag() { el.onlineRoomCodeText.textContent = online.roomCode ? `الغرفة: ${online.roomCode}` : ""; }
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

function saveOnlineSession() {
  if (online.mode !== "online") {
    localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ONLINE_SESSION_STORAGE_KEY, JSON.stringify({ roomCode: online.roomCode, role: online.role, clientId: online.clientId }));
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
    const roomPayload = {
      roomCode: code,
      createdAt: Date.now(),
      hostClientId: online.clientId,
      guestClientId: null,
      hostConnected: true,
      guestConnected: false,
      gameStarted: false,
      game: null,
    };
    await ref.set(roomPayload);
    await connectToRoom(code, "host");
    logAnalyticsEvent("room_created", { room_code: code });
    el.createdRoomCode.textContent = code;
    el.joinLinkInput.value = getJoinLink(code);
    el.onlineCreatePanel.classList.remove("hidden");
    setWaitingState("بانتظار انضمام الفريق الثاني...", false);
    setOnlineFeedback("تم إنشاء الغرفة بنجاح. شارك الكود الآن.", "success");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء إنشاء الغرفة.";
    setOnlineFeedback(`تعذّر إنشاء الغرفة. ${errorMessage}`, "error");
  } finally {
    setCreateRoomLoading(false);
  }
}

async function joinOnlineRoom(codeInput) {
  if (online.joiningRoom || online.creatingRoom) return;
  setOnlineFeedback("جارٍ الانضمام إلى الغرفة...", "info");
  setJoinRoomLoading(true);
  try {
    if (!initFirebase()) throw new Error("يرجى إدخال إعدادات Firebase الصحيحة داخل firebase-config.js أولاً");
    const code = normalizeCell(codeInput).toUpperCase();
    if (!code) throw new Error("أدخل كود الغرفة أولاً.");
    const ref = roomRefByCode(code);
    const snap = await ref.get();
    if (!snap.exists()) throw new Error("تعذّر الانضمام: الغرفة غير موجودة.");
    const room = snap.val();
    if (room.guestClientId && room.guestClientId !== online.clientId) throw new Error("تعذّر الانضمام: الغرفة ممتلئة.");
    await ref.update({ guestClientId: room.guestClientId || online.clientId, guestConnected: true });
    await connectToRoom(code, "guest");
    logAnalyticsEvent("room_joined", { room_code: code });
    setOnlineFeedback("تم الانضمام بنجاح. جارٍ الدخول إلى الغرفة...", "success");
    closeOnlineModal();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "تعذّر الانضمام إلى الغرفة.";
    setOnlineFeedback(errorMessage, "error");
  } finally {
    setJoinRoomLoading(false);
  }
}

async function connectToRoom(code, role) {
  online.mode = "online";
  online.role = role;
  online.roomCode = code;
  online.roomRef = roomRefByCode(code);
  saveOnlineSession();
  updateRoomCodeTag();
  el.onlineStatusCard.classList.remove("hidden");
  setOnlineStatus(role === "host" ? "تم إنشاء الغرفة" : "تم الانضمام بنجاح");
  updateOnlineActionPermissions();

  const connectionKey = role === "host" ? "hostConnected" : "guestConnected";
  online.roomRef.child(connectionKey).set(true);
  online.roomRef.child(connectionKey).onDisconnect().set(false);

  if (!online.listening) {
    online.roomRef.on("value", (snapshot) => {
      const room = snapshot.val();
      if (!room) return;
      online.connected = { 1: !!room.hostConnected, 2: !!room.guestConnected };
      if (online.role === "host") {
        const bothConnected = !!room.hostConnected && !!room.guestConnected;
        el.startOnlineGameBtn.disabled = !bothConnected;
        setWaitingState(bothConnected ? "تم اتصال الفريق الثاني. يمكنك بدء اللعبة." : "بانتظار انضمام الفريق الثاني...", bothConnected);
      }
      if (room.gameStarted) {
        setOnlineStatus("بدأت اللعبة");
      } else if (online.role === "host") {
        setOnlineStatus(online.connected[2] ? "اللاعب متصل" : "بانتظار اللاعب");
      } else {
        setOnlineStatus("تم الدخول إلى الغرفة");
      }
      if (room.gameStarted && room.game) {
        closeCategoryPicker();
        applyRemoteGameState(room.game);
      }
    });
    online.listening = true;
  }

  const isHost = role === "host";
  el.onlineCreatePanel.classList.toggle("hidden", !isHost);
  if (!isHost) el.onlineJoinPanel.classList.add("hidden");
}

function disconnectOnlineListeners() {
  if (online.roomRef && online.listening) online.roomRef.off();
  online.listening = false;
}

function pushOnlineState() {
  if (online.mode !== "online" || !online.roomRef || online.applyingRemote) return;
  online.roomRef.update({ gameStarted: true, game: serializeGameState() });
}

function updateOnlineActionPermissions() {
  const locked = online.mode === "online";
  const hostOnly = locked && online.role !== "host";
  el.team1PlusBtn.disabled = locked;
  el.team1MinusBtn.disabled = locked;
  el.team2PlusBtn.disabled = locked;
  el.team2MinusBtn.disabled = locked;
  el.team3PlusBtn.disabled = locked || state.teamCount !== 3;
  el.team3MinusBtn.disabled = locked || state.teamCount !== 3;
  el.team1NameInput.disabled = hostOnly;
  el.team2NameInput.disabled = hostOnly;
  el.team3NameInput.disabled = hostOnly || state.teamCount !== 3;
}

function resetOnlineMode() {
  disconnectOnlineListeners();
  online.mode = "local";
  online.role = null;
  online.roomCode = "";
  online.roomRef = null;
  online.connected = { 1: false, 2: false };
  localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
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
  setOnlineStatus("غير متصل");
  requestAnimationFrame(() => el.onlineModal.classList.add("is-open"));
}
function closeOnlineModal() {
  el.onlineModal.classList.remove("is-open");
  el.onlineModal.classList.add("hidden");
}

async function startGameFromSelection() {
  if (state.selectedCategories.length !== CATEGORIES_TO_SELECT) return;
  if (online.mode === "online" && online.role !== "host") return;
  setTeamNamesFromCategoryModal();
  closeCategoryPicker();
  state.scores = { 1: 0, 2: 0, 3: 0 };
  state.displayedScores = { 1: 0, 2: 0, 3: 0 };
  state.currentTeam = 1;
  mcqHelpUsed = { 1: false, 2: false, 3: false };
  hintHelpUsed = { 1: false, 2: false, 3: false };
  state.activeTile = null;
  state.answerRevealed = false;
  state.currentChoices = [];
  state.currentHintText = "";
  clearError();
  buildBoardAssignment();
  updateScoreboard();
  renderBoard();
  checkEndOfGame();
  logAnalyticsEvent("game_started", {
    mode: online.mode,
    categories_count: state.selectedCategories.length,
    teams_count: state.teamCount,
  });
  if (online.mode === "online") pushOnlineState();
}

async function startNewGame() {
  try {
    resetGameState();
    el.newGameBtn.disabled = true;
    state.dataLoadFailed = false;
    const { questions, categories } = await preloadQuestionBank();
    state.allQuestions = questions;
    state.allCategories = categories;
    state.pointLevels = [...POINT_LEVELS];
    state.usedHistory = loadUsedHistory();
    state.boardTiles = [];
    renderBoard();
    openCategoryPicker();
  } catch (error) {
    state.dataLoadFailed = true;
    state.allQuestions = [];
    state.allCategories = [];
    state.pointLevels = [];
    resetGameState();
    showError(`تعذّر بدء لعبة جديدة. ${error instanceof Error ? error.message : "خطأ غير متوقع"}`);
    el.board.innerHTML = "";
  } finally {
    el.newGameBtn.disabled = false;
  }
}

async function enterGame(mode) {
  el.startScreen.style.display = "none";
  el.gameScreen.style.display = "block";
  if (mode === "online") {
    setLocalTeamCount(2);
    updateTeamModeUI();
    openOnlineModal();
    await startNewGame();
  } else {
    resetOnlineMode();
    preloadQuestionBank().catch(() => {});
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
    joinOnlineRoom(room);
  });
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

function isMobileDevice() {
  return window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
}

function updateInstallGuideVisibility() {
  if (!el.installGuideBtn) return;
  el.installGuideBtn.classList.toggle("hidden", isStandaloneMode());
}

function updateInstallGuideContent() {
  const mobileIntro = document.getElementById("installGuideMobileIntro");
  const mobileSteps = document.getElementById("installGuideMobileSteps");
  const desktopMessage = document.getElementById("installGuideDesktopMessage");
  if (!mobileIntro || !mobileSteps || !desktopMessage) return;

  const isMobile = isMobileDevice();
  mobileIntro.classList.toggle("hidden", !isMobile);
  mobileSteps.classList.toggle("hidden", !isMobile);
  desktopMessage.classList.toggle("hidden", isMobile);
}

function openInstallGuide() {
  if (!el.installGuideModal) return;
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

function bindEvent(element, eventName, handler, elementName) {
  if (!element) {
    console.error(`[Tasleya] Missing element: ${elementName}`);
    return;
  }
  element.addEventListener(eventName, handler);
}

function initializeApp() {
  cacheElements();

  bindEvent(el.newGameBtn, "click", () => {
    if (online.mode === "online" && online.role !== "host") return;
    startNewGame();
  }, "newGameBtn");
  bindEvent(el.closeModalBtn, "click", () => closeModal(), "closeModalBtn");
  bindEvent(el.revealBtn, "click", revealAnswer, "revealBtn");
  bindEvent(el.correctBtn, "click", () => applyScore(true), "correctBtn");
  bindEvent(el.wrongBtn, "click", () => applyScore(false), "wrongBtn");
  bindEvent(el.otherTeamBtn, "click", awardPointsToOtherTeam, "otherTeamBtn");
  bindEvent(el.lifelineBtn, "click", useLifeline, "lifelineBtn");
  bindEvent(el.hintLifelineBtn, "click", useHintLifeline, "hintLifelineBtn");
  bindEvent(el.startGameBtn, "click", startGameFromSelection, "startGameBtn");
  bindEvent(el.randomCategoriesBtn, "click", pickRandomCategories, "randomCategoriesBtn");
  bindEvent(el.cancelCategoryBtn, "click", closeCategoryPicker, "cancelCategoryBtn");
  bindEvent(el.podiumNewGameBtn, "click", () => {
    if (online.mode === "online" && online.role !== "host") return;
    startNewGame();
  }, "podiumNewGameBtn");

  bindEvent(el.team1NameInput, "input", () => setTeamName(1, el.team1NameInput.value), "team1NameInput");
  bindEvent(el.team2NameInput, "input", () => setTeamName(2, el.team2NameInput.value), "team2NameInput");
  bindEvent(el.team3NameInput, "input", () => setTeamName(3, el.team3NameInput.value), "team3NameInput");
  bindEvent(el.team1NameInput, "blur", () => setTeamName(1, el.team1NameInput.value, { commit: true }), "team1NameInput");
  bindEvent(el.team2NameInput, "blur", () => setTeamName(2, el.team2NameInput.value, { commit: true }), "team2NameInput");
  bindEvent(el.team3NameInput, "blur", () => setTeamName(3, el.team3NameInput.value, { commit: true }), "team3NameInput");

  bindEvent(el.team1PlusBtn, "click", () => { if (online.mode !== "online") { state.scores[1] = Math.max(0, state.scores[1] + 100); updateScoreboard(); } }, "team1PlusBtn");
  bindEvent(el.team1MinusBtn, "click", () => { if (online.mode !== "online") { state.scores[1] = Math.max(0, state.scores[1] - 100); updateScoreboard(); } }, "team1MinusBtn");
  bindEvent(el.team2PlusBtn, "click", () => { if (online.mode !== "online") { state.scores[2] = Math.max(0, state.scores[2] + 100); updateScoreboard(); } }, "team2PlusBtn");
  bindEvent(el.team2MinusBtn, "click", () => { if (online.mode !== "online") { state.scores[2] = Math.max(0, state.scores[2] - 100); updateScoreboard(); } }, "team2MinusBtn");
  bindEvent(el.team3PlusBtn, "click", () => { if (online.mode !== "online" && state.teamCount === 3) { state.scores[3] = Math.max(0, state.scores[3] + 100); updateScoreboard(); } }, "team3PlusBtn");
  bindEvent(el.team3MinusBtn, "click", () => { if (online.mode !== "online" && state.teamCount === 3) { state.scores[3] = Math.max(0, state.scores[3] - 100); updateScoreboard(); } }, "team3MinusBtn");

  bindEvent(el.modal, "click", (event) => { if (event.target === el.modal) closeModal(); }, "questionModal");
  bindEvent(el.categoryModal, "click", (event) => { if (event.target === el.categoryModal) closeCategoryPicker(); }, "categoryModal");

  bindEvent(el.startLocalBtn, "click", () => {
    console.log("[Tasleya] Start local button clicked");
    logAnalyticsEvent("local_game_started", { mode: "single_device" });
    enterGame("local");
  }, "startLocalBtn");
  bindEvent(el.localTwoTeamsBtn, "click", () => chooseLocalTeamCount(2), "localTwoTeamsBtn");
  bindEvent(el.localThreeTeamsBtn, "click", () => chooseLocalTeamCount(3), "localThreeTeamsBtn");
  bindEvent(el.cancelLocalTeamsBtn, "click", () => {
    closeLocalTeamsModal();
    el.gameScreen.style.display = "none";
    el.startScreen.style.display = "flex";
  }, "cancelLocalTeamsBtn");
  bindEvent(el.localTeamsModal, "click", (event) => {
    if (event.target !== el.localTeamsModal) return;
    closeLocalTeamsModal();
    el.gameScreen.style.display = "none";
    el.startScreen.style.display = "flex";
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
  bindEvent(el.installGuideBtn, "click", handleInstallGuidePointerOpen, "installGuideBtn");
  bindEvent(el.installGuideBtn, "touchstart", handleInstallGuidePointerOpen, "installGuideBtn");
  bindEvent(el.closeInstallGuideBtn, "click", closeInstallGuide, "closeInstallGuideBtn");
  bindEvent(el.installGuideModal, "click", (event) => {
    if (event.target === el.installGuideModal) closeInstallGuide();
  }, "installGuideModal");
  bindEvent(el.createRoomBtn, "click", createOnlineRoom, "createRoomBtn");
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
    el.gameScreen.style.display = "none";
    el.startScreen.style.display = "flex";
    closeOnlineModal();
  }, "cancelOnlineBtn");
  bindEvent(el.startOnlineGameBtn, "click", () => {
    closeOnlineModal();
    startNewGame();
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

  initAnalytics();
  logAnalyticsEvent("page_view", { page_title: document.title, page_location: window.location.href });

  preloadQuestionBank().catch(() => {});

  tryAutoJoinFromUrl();
  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}
