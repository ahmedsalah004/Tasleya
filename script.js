const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkJrYhyba86QOQooWig5SveDZXxrp_ERypkLZlslSzp2KtTK4gwUqqIWYTqwq0bQHETiUI_Z2b8gvd/pub?gid=0&single=true&output=csv";
const CATEGORIES_TO_SELECT = 6;
const POINT_ROWS_COUNT = 5;
const POINT_LEVELS = [100, 200, 300, 400, 500];
const USED_STORAGE_KEY = "tasleya_used_v1";
const TEAM_NAMES_STORAGE_KEY = "tasleya_team_names_v1";
const CURRENT_PASSWORD = "salaheldin";
const PASSWORD_VERSION = "v2";
const AUTH_TIME_STORAGE_KEY = "tasleya_auth_time";
const AUTH_VERSION_STORAGE_KEY = "tasleya_auth_version";
const AUTH_EXPIRY_MS = 24 * 60 * 60 * 1000;
const ONLINE_SESSION_STORAGE_KEY = "tasleya_online_session_v1";
const FIREBASE_ROOMS_PATH = "tasleyaRooms";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let mcqHelpUsed = { 1: false, 2: false };
let timerInterval = null;
let timerStart = null;

const el = {
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
  choicesBox: document.getElementById("choicesBox"),
  choicesList: document.getElementById("choicesList"),
  categoryModal: document.getElementById("categoryModal"),
  categoryList: document.getElementById("categoryList"),
  categoryTeam1NameInput: document.getElementById("categoryTeam1NameInput"),
  categoryTeam2NameInput: document.getElementById("categoryTeam2NameInput"),
  categoryCounter: document.getElementById("categoryCounter"),
  startGameBtn: document.getElementById("startGameBtn"),
  randomCategoriesBtn: document.getElementById("randomCategoriesBtn"),
  cancelCategoryBtn: document.getElementById("cancelCategoryBtn"),
  podiumModal: document.getElementById("podiumModal"),
  podiumTitle: document.getElementById("podiumTitle"),
  podiumSubtitle: document.getElementById("podiumSubtitle"),
  podiumBoard: document.getElementById("podiumBoard"),
  podiumNewGameBtn: document.getElementById("podiumNewGameBtn"),
  passwordGate: document.getElementById("passwordGate"),
  passwordInput: document.getElementById("passwordInput"),
  passwordSubmitBtn: document.getElementById("passwordSubmitBtn"),
  passwordError: document.getElementById("passwordError"),
  startScreen: document.getElementById("startScreen"),
  gameScreen: document.getElementById("gameScreen"),
  startLocalBtn: document.getElementById("startLocalBtn"),
  startOnlineBtn: document.getElementById("startOnlineBtn"),
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
};

const state = {
  allQuestions: [],
  allCategories: [],
  selectedCategories: [],
  boardTiles: [],
  pointLevels: [],
  assignedQuestionIds: new Set(),
  dataLoadFailed: false,
  scores: { 1: 0, 2: 0 },
  teamNames: { 1: "الفريق الأول", 2: "الفريق الثاني" },
  currentTeam: 1,
  activeTile: null,
  usedHistory: {},
  displayedScores: { 1: 0, 2: 0 },
  answerRevealed: false,
  currentChoices: [],
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
  clientId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
};

function normalizeCell(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}
function showError(message) { el.errorBanner.textContent = message; el.errorBanner.classList.remove("hidden"); }
function clearError() { el.errorBanner.textContent = ""; el.errorBanner.classList.add("hidden"); }

function resetAuth() { localStorage.removeItem(AUTH_TIME_STORAGE_KEY); localStorage.removeItem(AUTH_VERSION_STORAGE_KEY); }
function isAuthValid() {
  const storedAuthTime = Number.parseInt(localStorage.getItem(AUTH_TIME_STORAGE_KEY) ?? "", 10);
  const storedVersion = localStorage.getItem(AUTH_VERSION_STORAGE_KEY);
  if (!Number.isFinite(storedAuthTime) || storedAuthTime <= 0) return false;
  if (storedVersion !== PASSWORD_VERSION) { resetAuth(); return false; }
  if (Date.now() - storedAuthTime > AUTH_EXPIRY_MS) { resetAuth(); return false; }
  return true;
}
function unlockSession() {
  localStorage.setItem(AUTH_TIME_STORAGE_KEY, String(Date.now()));
  localStorage.setItem(AUTH_VERSION_STORAGE_KEY, PASSWORD_VERSION);
  el.passwordGate.classList.add("hidden");
  el.passwordError.classList.add("hidden");
}
function handlePasswordSubmit() {
  if (el.passwordInput.value === CURRENT_PASSWORD) { unlockSession(); el.passwordInput.value = ""; return; }
  el.passwordError.classList.remove("hidden");
}
function setupPasswordGate() {
  if (isAuthValid()) { unlockSession(); return; }
  resetAuth();
  el.passwordGate.classList.remove("hidden");
  el.passwordError.classList.add("hidden");
  el.passwordInput.focus();
}
window.resetAuth = resetAuth;

function formatElapsedTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
function updateTimerUI() {
  const elapsed = timerStart ? Date.now() - timerStart : 0;
  el.questionTimer.textContent = formatElapsedTime(elapsed);
  el.questionTimer.classList.toggle("timer-red", elapsed >= 60000);
}
function stopTimer() { if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; } }
function resetTimer() { timerStart = null; updateTimerUI(); }
function stopAndResetTimer() { stopTimer(); resetTimer(); }
function startTimer() { stopAndResetTimer(); timerStart = Date.now(); updateTimerUI(); timerInterval = setInterval(updateTimerUI, 250); }

function shuffle(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
    const difficulty = Number.parseInt(String(q.difficulty ?? "").replace(/[^\d]/g, ""), 10);
    const computedPoints = toPoints(q) ?? (difficulty >= 1 && difficulty <= 5 ? difficulty * 100 : null);
    return {
      id: q.id || String(index + 1), category: q.category || "", points: computedPoints,
      question: q.question || "", answer: q.answer || "", type: (q.type || "text").toLowerCase(),
      image_url: q.image_url || "", choice_a: q.choice_a || "", choice_b: q.choice_b || "", choice_c: q.choice_c || "", choice_d: q.choice_d || "",
    };
  }).filter((q) => q.question && q.answer && q.category);
}

function loadUsedHistory() {
  try { const raw = localStorage.getItem(USED_STORAGE_KEY); if (!raw) return {}; const parsed = JSON.parse(raw); return parsed && typeof parsed === "object" ? parsed : {}; }
  catch { return {}; }
}
function saveUsedHistory() { localStorage.setItem(USED_STORAGE_KEY, JSON.stringify(state.usedHistory)); }
function loadTeamNames() {
  state.teamNames = { 1: "الفريق الأول", 2: "الفريق الثاني" };
  try {
    const raw = localStorage.getItem(TEAM_NAMES_STORAGE_KEY);
    if (!raw) { saveTeamNames(); return; }
    const parsed = JSON.parse(raw);
    const team1 = normalizeCell(parsed?.[1] ?? parsed?.team1);
    const team2 = normalizeCell(parsed?.[2] ?? parsed?.team2);
    if (team1) state.teamNames[1] = team1;
    if (team2) state.teamNames[2] = team2;
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
  const csvUrl = `${CSV_URL}${CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const rows = parseCSV(await res.text());
  if (rows.length < 2) throw new Error("ملف CSV لا يحتوي بيانات كافية.");
  return rowsToQuestions(rows);
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
  const scoreEl = team === 1 ? el.team1Score : el.team2Score;
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
  animateScoreValue(1, state.scores[1]);
  animateScoreValue(2, state.scores[2]);
  el.currentTurn.textContent = state.teamNames[state.currentTeam];
  el.team1Card.classList.toggle("active", state.currentTeam === 1);
  el.team2Card.classList.toggle("active", state.currentTeam === 2);
}
function syncTeamNameInputs() {
  el.team1NameInput.value = state.teamNames[1];
  el.team2NameInput.value = state.teamNames[2];
  el.categoryTeam1NameInput.value = state.teamNames[1];
  el.categoryTeam2NameInput.value = state.teamNames[2];
}
function setTeamName(team, value, { commit = false } = {}) {
  const fallback = team === 1 ? "الفريق الأول" : "الفريق الثاني";
  state.teamNames[team] = commit ? normalizeCell(value) || fallback : String(value ?? "");
  if (commit) syncTeamNameInputs();
  saveTeamNames();
  updateScoreboard();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}
function setTeamNamesFromCategoryModal() {
  setTeamName(1, el.categoryTeam1NameInput.value, { commit: true });
  setTeamName(2, el.categoryTeam2NameInput.value, { commit: true });
}

function hasPlayableTiles() { return state.boardTiles.some((tile) => !tile.used && !tile.missing && tile.question); }
function closePodiumModal() { el.podiumModal.classList.add("hidden"); el.podiumModal.classList.remove("is-open"); }
function buildPodiumColumn(name, score, label, placeClass) {
  return `<div class="podium-column ${placeClass}"><p class="podium-label">${label}</p><p class="podium-team-name">${name}</p><p class="podium-score">${score}</p><div class="podium-step"></div></div>`;
}
function showPodiumModal() {
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
  el.podiumModal.classList.remove("hidden");
  requestAnimationFrame(() => el.podiumModal.classList.add("is-open"));
}
function checkEndOfGame() {
  if (state.boardTiles.length > 0 && !hasPlayableTiles()) {
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
  stopAndResetTimer(); clearQuestionMedia();
  const tile = state.boardTiles.find((t) => t.id === tileId);
  if (!tile || tile.used || !tile.question) return;
  state.activeTile = tile;
  const q = tile.question;
  el.questionText.textContent = q.question;
  el.answerText.textContent = `الإجابة: ${q.answer}`;
  el.answerText.classList.add("hidden");
  state.answerRevealed = false;
  el.choicesBox.classList.add("hidden");
  el.choicesList.innerHTML = "";
  state.currentChoices = [];
  if (q.type === "image" && q.image_url) renderQuestionImage(q.image_url);
  if (q.type === "audio" && q.image_url) renderQuestionAudio(q.image_url);
  el.lifelineBtn.disabled = mcqHelpUsed[state.currentTeam] || (online.mode === "online" && !canCurrentClientAct());
  startTimer();
  el.modal.classList.remove("hidden");
  requestAnimationFrame(() => { el.modal.classList.remove("is-closing"); el.modal.classList.add("is-open"); });
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function closeModal({ silentSync = false } = {}) {
  stopAndResetTimer(); clearQuestionMedia();
  if (el.modal.classList.contains("hidden")) { state.activeTile = null; return; }
  if (prefersReducedMotion) {
    el.modal.classList.add("hidden"); el.modal.classList.remove("is-open", "is-closing"); state.activeTile = null;
  } else {
    el.modal.classList.remove("is-open"); el.modal.classList.add("is-closing");
    const onEnd = () => { el.modal.classList.add("hidden"); el.modal.classList.remove("is-closing"); state.activeTile = null; el.modal.removeEventListener("animationend", onEnd, true); };
    el.modal.addEventListener("animationend", onEnd, true);
  }
  if (online.mode === "online" && !online.applyingRemote && !silentSync) pushOnlineState();
}

function resetGameState() {
  state.selectedCategories = [];
  state.boardTiles = [];
  state.pointLevels = [...POINT_LEVELS];
  state.assignedQuestionIds = new Set();
  state.scores = { 1: 0, 2: 0 };
  state.displayedScores = { 1: 0, 2: 0 };
  state.currentTeam = 1;
  mcqHelpUsed = { 1: false, 2: false };
  state.activeTile = null;
  state.answerRevealed = false;
  state.currentChoices = [];
  closeModal({ silentSync: true });
  closeCategoryPicker();
  closePodiumModal();
  clearError();
  updateScoreboard();
  renderBoard();
}

function revealAnswer() {
  if (!getActiveQuestion() || (online.mode === "online" && !canCurrentClientAct())) return;
  el.answerText.classList.remove("hidden");
  state.answerRevealed = true;
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
  if (!question || mcqHelpUsed[currentTeam] || (online.mode === "online" && !canCurrentClientAct())) return;
  const options = generateChoices(question);
  el.choicesList.innerHTML = "";
  options.forEach((option) => { const div = document.createElement("div"); div.className = "choice-item"; div.textContent = option; el.choicesList.appendChild(div); });
  mcqHelpUsed[currentTeam] = true;
  state.currentChoices = options;
  el.lifelineBtn.disabled = true;
  el.choicesBox.classList.remove("hidden");
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}

function applyScore(isCorrect) {
  if (online.mode === "online" && !canCurrentClientAct()) return;
  const tile = state.activeTile;
  if (!tile || tile.used || !tile.question) return;
  if (isCorrect) state.scores[state.currentTeam] += tile.points;
  state.scores[1] = Math.max(0, state.scores[1]); state.scores[2] = Math.max(0, state.scores[2]);
  tile.used = true;
  state.currentTeam = state.currentTeam === 1 ? 2 : 1;
  updateScoreboard(); renderBoard(); closeModal({ silentSync: true }); checkEndOfGame();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
}
function awardPointsToOtherTeam() {
  if (online.mode === "online" && !canCurrentClientAct()) return;
  const tile = state.activeTile;
  if (!tile || tile.used || !tile.question) return;
  const otherTeam = state.currentTeam === 1 ? 2 : 1;
  state.scores[otherTeam] += tile.points;
  state.scores[1] = Math.max(0, state.scores[1]); state.scores[2] = Math.max(0, state.scores[2]);
  tile.used = true;
  state.currentTeam = otherTeam;
  updateScoreboard(); renderBoard(); closeModal({ silentSync: true }); checkEndOfGame();
  if (online.mode === "online" && !online.applyingRemote) pushOnlineState();
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
  el.categoryList.innerHTML = "";
  state.allCategories.forEach((category) => {
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
  updateCategoryPickerUI();
}
function openCategoryPicker() {
  state.selectedCategories = [];
  el.categoryTeam1NameInput.value = state.teamNames[1];
  el.categoryTeam2NameInput.value = state.teamNames[2];
  renderCategoryOptions();
  if (online.mode === "online" && online.role !== "host") {
    el.startGameBtn.disabled = true;
    el.randomCategoriesBtn.disabled = true;
    el.categoryTeam1NameInput.disabled = true;
    el.categoryTeam2NameInput.disabled = true;
  } else {
    el.randomCategoriesBtn.disabled = false;
    el.categoryTeam1NameInput.disabled = false;
    el.categoryTeam2NameInput.disabled = false;
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
    currentTeam: state.currentTeam,
    mcqHelpUsed,
    activeTileId: state.activeTile?.id || null,
    modalOpen: !el.modal.classList.contains("hidden") && !!state.activeTile,
    answerRevealed: state.answerRevealed,
    currentChoices: state.currentChoices,
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
    state.scores = game.scores || { 1: 0, 2: 0 };
    state.teamNames = game.teamNames || { 1: "الفريق الأول", 2: "الفريق الثاني" };
    state.currentTeam = Number(game.currentTeam) === 2 ? 2 : 1;
    mcqHelpUsed = game.mcqHelpUsed || { 1: false, 2: false };
    state.answerRevealed = !!game.answerRevealed;
    state.currentChoices = Array.isArray(game.currentChoices) ? game.currentChoices : [];

    syncTeamNameInputs();
    updateScoreboard();
    renderBoard();

    const activeId = game.activeTileId;
    const shouldOpen = !!game.modalOpen && activeId;
    if (shouldOpen) {
      const tile = state.boardTiles.find((t) => t.id === activeId && !t.used && t.question);
      if (tile) {
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
        el.lifelineBtn.disabled = mcqHelpUsed[state.currentTeam] || !canCurrentClientAct();
        el.modal.classList.remove("hidden");
        el.modal.classList.add("is-open");
      }
    } else {
      closeModal({ silentSync: true });
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
  el.createRoomBtn.textContent = isLoading ? "جارٍ إنشاء الغرفة..." : "إنشاء غرفة";
}

function saveOnlineSession() {
  if (online.mode !== "online") {
    localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ONLINE_SESSION_STORAGE_KEY, JSON.stringify({ roomCode: online.roomCode, role: online.role, clientId: online.clientId }));
}

function initFirebase() {
  if (online.firebaseReady) return true;
  if (!window.firebase || !window.FIREBASE_CONFIG) return false;
  const requiredConfigKeys = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
  const isConfigComplete = requiredConfigKeys.every((key) => normalizeCell(window.FIREBASE_CONFIG[key]));
  if (!isConfigComplete) return false;
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  online.db = firebase.database();
  online.firebaseReady = true;
  return true;
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
  if (online.creatingRoom) return;
  setOnlineFeedback("جارٍ إنشاء الغرفة...", "info");
  setCreateRoomLoading(true);
  try {
    if (!initFirebase()) throw new Error("يرجى التأكد من إعداد Firebase بالكامل داخل firebase-config.js");
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
    el.createdRoomCode.textContent = `كود الغرفة: ${code}`;
    el.joinLinkInput.value = getJoinLink(code);
    el.onlineCreatePanel.classList.remove("hidden");
    el.waitingStatus.textContent = "بانتظار انضمام الفريق الثاني...";
    setOnlineFeedback("تم إنشاء الغرفة بنجاح.", "success");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء إنشاء الغرفة.";
    setOnlineFeedback(`تعذّر إنشاء الغرفة. ${errorMessage}`, "error");
  } finally {
    setCreateRoomLoading(false);
  }
}

async function joinOnlineRoom(codeInput) {
  if (!initFirebase()) { showError("يرجى إعداد Firebase أولاً داخل firebase-config.js"); return; }
  const code = normalizeCell(codeInput).toUpperCase();
  if (!code) return;
  const ref = roomRefByCode(code);
  const snap = await ref.get();
  if (!snap.exists()) { showError("الغرفة غير موجودة."); return; }
  const room = snap.val();
  if (room.guestClientId && room.guestClientId !== online.clientId) { showError("الغرفة ممتلئة."); return; }
  await ref.update({ guestClientId: room.guestClientId || online.clientId, guestConnected: true });
  await connectToRoom(code, "guest");
  closeOnlineModal();
}

async function connectToRoom(code, role) {
  online.mode = "online";
  online.role = role;
  online.roomCode = code;
  online.roomRef = roomRefByCode(code);
  saveOnlineSession();
  updateRoomCodeTag();
  el.onlineStatusCard.classList.remove("hidden");
  setOnlineStatus("متصل");
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
        el.waitingStatus.textContent = bothConnected ? "الفريق الثاني متصل" : "بانتظار انضمام الفريق الثاني...";
      }
      setOnlineStatus(room.gameStarted ? "بدأت اللعبة" : online.connected[2] ? "متصل" : "بانتظار الفريق الثاني");
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
  el.team1NameInput.disabled = hostOnly;
  el.team2NameInput.disabled = hostOnly;
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
  state.scores = { 1: 0, 2: 0 };
  state.displayedScores = { 1: 0, 2: 0 };
  state.currentTeam = 1;
  mcqHelpUsed = { 1: false, 2: false };
  state.activeTile = null;
  state.answerRevealed = false;
  state.currentChoices = [];
  clearError();
  buildBoardAssignment();
  updateScoreboard();
  renderBoard();
  checkEndOfGame();
  if (online.mode === "online") pushOnlineState();
}

async function startNewGame() {
  try {
    resetGameState();
    el.newGameBtn.disabled = true;
    state.dataLoadFailed = false;
    state.allQuestions = await fetchQuestions();
    if (state.allQuestions.length === 0) throw new Error("لا توجد أسئلة صالحة في الملف.");
    state.allCategories = getUniqueCategories(state.allQuestions);
    if (state.allCategories.length < CATEGORIES_TO_SELECT) throw new Error(`يلزم وجود ${CATEGORIES_TO_SELECT} فئات مختلفة على الأقل في ملف CSV.`);
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
    openOnlineModal();
    await startNewGame();
  } else {
    resetOnlineMode();
    await startNewGame();
  }
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

el.newGameBtn.addEventListener("click", () => {
  if (online.mode === "online" && online.role !== "host") return;
  startNewGame();
});
el.closeModalBtn.addEventListener("click", () => closeModal());
el.revealBtn.addEventListener("click", revealAnswer);
el.correctBtn.addEventListener("click", () => applyScore(true));
el.wrongBtn.addEventListener("click", () => applyScore(false));
el.otherTeamBtn.addEventListener("click", awardPointsToOtherTeam);
el.lifelineBtn.addEventListener("click", useLifeline);
el.startGameBtn.addEventListener("click", startGameFromSelection);
el.randomCategoriesBtn.addEventListener("click", pickRandomCategories);
el.cancelCategoryBtn.addEventListener("click", closeCategoryPicker);
el.podiumNewGameBtn.addEventListener("click", () => {
  if (online.mode === "online" && online.role !== "host") return;
  startNewGame();
});

el.team1NameInput.addEventListener("input", () => setTeamName(1, el.team1NameInput.value));
el.team2NameInput.addEventListener("input", () => setTeamName(2, el.team2NameInput.value));
el.team1NameInput.addEventListener("blur", () => setTeamName(1, el.team1NameInput.value, { commit: true }));
el.team2NameInput.addEventListener("blur", () => setTeamName(2, el.team2NameInput.value, { commit: true }));

el.team1PlusBtn.addEventListener("click", () => { if (online.mode !== "online") { state.scores[1] = Math.max(0, state.scores[1] + 100); updateScoreboard(); } });
el.team1MinusBtn.addEventListener("click", () => { if (online.mode !== "online") { state.scores[1] = Math.max(0, state.scores[1] - 100); updateScoreboard(); } });
el.team2PlusBtn.addEventListener("click", () => { if (online.mode !== "online") { state.scores[2] = Math.max(0, state.scores[2] + 100); updateScoreboard(); } });
el.team2MinusBtn.addEventListener("click", () => { if (online.mode !== "online") { state.scores[2] = Math.max(0, state.scores[2] - 100); updateScoreboard(); } });

el.modal.addEventListener("click", (event) => { if (event.target === el.modal) closeModal(); });
el.categoryModal.addEventListener("click", (event) => { if (event.target === el.categoryModal) closeCategoryPicker(); });
el.passwordSubmitBtn.addEventListener("click", handlePasswordSubmit);
el.passwordInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); handlePasswordSubmit(); } });
el.passwordInput.addEventListener("input", () => { el.passwordError.classList.add("hidden"); });

el.startLocalBtn.addEventListener("click", () => enterGame("local"));
el.startOnlineBtn.addEventListener("click", () => enterGame("online"));
el.createRoomBtn.addEventListener("click", createOnlineRoom);
el.joinRoomBtn.addEventListener("click", () => { el.onlineJoinPanel.classList.remove("hidden"); });
el.confirmJoinBtn.addEventListener("click", () => joinOnlineRoom(el.roomCodeInput.value));
el.cancelOnlineBtn.addEventListener("click", () => {
  if (online.mode === "online" && online.roomCode) {
    closeOnlineModal();
    return;
  }
  el.gameScreen.style.display = "none";
  el.startScreen.style.display = "flex";
  closeOnlineModal();
});
el.startOnlineGameBtn.addEventListener("click", () => {
  closeOnlineModal();
  startNewGame();
});
el.copyCodeBtn.addEventListener("click", async () => { if (online.roomCode) await navigator.clipboard.writeText(online.roomCode); });
el.copyLinkBtn.addEventListener("click", async () => { if (el.joinLinkInput.value) await navigator.clipboard.writeText(el.joinLinkInput.value); });

updateScoreboard();
loadTeamNames();
syncTeamNameInputs();
setupPasswordGate();
updateOnlineActionPermissions();
tryAutoJoinFromUrl();
