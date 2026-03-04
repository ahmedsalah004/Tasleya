const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkJrYhyba86QOQooWig5SveDZXxrp_ERypkLZlslSzp2KtTK4gwUqqIWYTqwq0bQHETiUI_Z2b8gvd/pub?gid=0&single=true&output=csv";
const CATEGORIES_TO_SELECT = 5;
const POINT_ROWS_COUNT = 5;
const POINT_LEVELS = [100, 200, 300, 400, 500];
const USED_STORAGE_KEY = "tasleya_used_v1";
const TEAM_NAMES_STORAGE_KEY = "tasleya_team_names_v1";
const CURRENT_PASSWORD = "123";
const PASSWORD_VERSION = "v1";
const AUTH_TIME_STORAGE_KEY = "tasleya_auth_time";
const AUTH_VERSION_STORAGE_KEY = "tasleya_auth_version";
const AUTH_EXPIRY_MS = 24 * 60 * 60 * 1000;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let lifelineUsed = false;
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
  questionImage: document.getElementById("questionImage"),
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
};


function resetAuth() {
  localStorage.removeItem(AUTH_TIME_STORAGE_KEY);
  localStorage.removeItem(AUTH_VERSION_STORAGE_KEY);
}

function isAuthValid() {
  const storedAuthTime = Number.parseInt(localStorage.getItem(AUTH_TIME_STORAGE_KEY) ?? "", 10);
  const storedVersion = localStorage.getItem(AUTH_VERSION_STORAGE_KEY);

  if (!Number.isFinite(storedAuthTime) || storedAuthTime <= 0) {
    return false;
  }

  if (storedVersion !== PASSWORD_VERSION) {
    resetAuth();
    return false;
  }

  if (Date.now() - storedAuthTime > AUTH_EXPIRY_MS) {
    resetAuth();
    return false;
  }

  return true;
}

function unlockSession() {
  localStorage.setItem(AUTH_TIME_STORAGE_KEY, String(Date.now()));
  localStorage.setItem(AUTH_VERSION_STORAGE_KEY, PASSWORD_VERSION);
  el.passwordGate.classList.add("hidden");
  el.passwordError.classList.add("hidden");
}

function showPasswordError() {
  el.passwordError.classList.remove("hidden");
}

function handlePasswordSubmit() {
  const enteredPassword = el.passwordInput.value;
  if (enteredPassword === CURRENT_PASSWORD) {
    unlockSession();
    el.passwordInput.value = "";
    return;
  }
  showPasswordError();
}

function setupPasswordGate() {
  if (isAuthValid()) {
    unlockSession();
    return;
  }

  resetAuth();
  el.passwordGate.classList.remove("hidden");
  el.passwordError.classList.add("hidden");
  el.passwordInput.focus();
}

window.resetAuth = resetAuth;

function formatElapsedTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTimerUI() {
  const elapsed = timerStart ? Date.now() - timerStart : 0;
  const isOverMinute = elapsed >= 60000;
  el.questionTimer.textContent = formatElapsedTime(elapsed);
  el.questionTimer.classList.toggle("timer-red", isOverMinute);
}

function startTimer() {
  stopTimer();
  timerStart = Date.now();
  updateTimerUI();
  timerInterval = window.setInterval(updateTimerUI, 250);
}

function stopTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetTimer() {
  timerStart = null;
  updateTimerUI();
}

function stopAndResetTimer() {
  stopTimer();
  resetTimer();
}

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
};

function showError(message) {
  el.errorBanner.textContent = message;
  el.errorBanner.classList.remove("hidden");
}

function clearError() {
  el.errorBanner.textContent = "";
  el.errorBanner.classList.add("hidden");
}

function normalizeCell(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(normalizeCell(value));
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(normalizeCell(value));
      value = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(normalizeCell(value));
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeHeader(header) {
  return normalizeCell(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toPoints(question) {
  const explicit = Number.parseInt(String(question.points ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(explicit) ? explicit : null;
}

function rowsToQuestions(rows) {
  const [headers, ...dataRows] = rows;
  const mapHeaders = headers.map(normalizeHeader);

  return dataRows
    .map((row, index) => {
      const q = {};
      mapHeaders.forEach((key, i) => {
        q[key] = normalizeCell(row[i]);
      });

      const difficulty = Number.parseInt(String(q.difficulty ?? "").replace(/[^\d]/g, ""), 10);
      const computedPoints = toPoints(q) ?? (difficulty >= 1 && difficulty <= 5 ? difficulty * 100 : null);

      return {
        id: q.id || String(index + 1),
        category: q.category || "",
        points: computedPoints,
        question: q.question || "",
        answer: q.answer || "",
        type: (q.type || "text").toLowerCase(),
        image_url: q.image_url || "",
        media: q.media || "",
        choice_a: q.choice_a || "",
        choice_b: q.choice_b || "",
        choice_c: q.choice_c || "",
        choice_d: q.choice_d || "",
      };
    })
    .filter((q) => q.question && q.answer && q.category);
}

function resolveMediaUrl(path) {
  const normalizedPath = String(path ?? "").trim();
  if (!normalizedPath) {
    return "";
  }

  const isAbsolute = /^(https?:|data:|blob:|\/\/)/i.test(normalizedPath);
  if (isAbsolute) {
    return encodeURI(normalizedPath);
  }

  const basePath = window.location.pathname.includes("/Tasleya/") ? "/Tasleya/" : "/";
  const relativePath = normalizedPath.replace(/^\/+/, "");
  return encodeURI(`${basePath}${relativePath}`);
}

function clearQuestionAudio() {
  const audio = el.modal.querySelector(".question-audio");
  if (!audio) {
    return;
  }
  audio.pause();
  audio.currentTime = 0;
  audio.remove();
}

function renderQuestionAudio(question) {
  clearQuestionAudio();

  const mediaPath = String(question.media ?? "").trim();
  const hasAudioByType = question.type === "audio";
  const hasAudioByMedia = /\.(mp3|wav|ogg)(?:\?|#|$)/i.test(mediaPath);

  if (!mediaPath || (!hasAudioByType && !hasAudioByMedia)) {
    return;
  }

  const src = resolveMediaUrl(mediaPath);
  if (!src) {
    return;
  }

  const audio = document.createElement("audio");
  audio.className = "question-audio";
  audio.controls = true;
  audio.preload = "none";
  audio.src = src;

  const actions = el.modal.querySelector(".modal-actions");
  if (actions?.parentNode) {
    actions.parentNode.insertBefore(audio, actions);
  }
}

function loadUsedHistory() {
  try {
    const raw = localStorage.getItem(USED_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to read used history:", error);
    return {};
  }
}

function saveUsedHistory() {
  localStorage.setItem(USED_STORAGE_KEY, JSON.stringify(state.usedHistory));
}

function loadTeamNames() {
  state.teamNames = { 1: "الفريق الأول", 2: "الفريق الثاني" };

  try {
    const raw = localStorage.getItem(TEAM_NAMES_STORAGE_KEY);
    if (!raw) {
      saveTeamNames();
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const team1 = normalizeCell(parsed[1] ?? parsed.team1);
      const team2 = normalizeCell(parsed[2] ?? parsed.team2);
      if (team1) {
        state.teamNames[1] = team1;
      }
      if (team2) {
        state.teamNames[2] = team2;
      }
    }
  } catch (error) {
    console.warn("Failed to read team names:", error);
    saveTeamNames();
  }
}

function saveTeamNames() {
  localStorage.setItem(TEAM_NAMES_STORAGE_KEY, JSON.stringify(state.teamNames));
}

function ensureBucket(category, points) {
  if (!state.usedHistory[category]) {
    state.usedHistory[category] = {};
  }
  const key = String(points);
  if (!Array.isArray(state.usedHistory[category][key])) {
    state.usedHistory[category][key] = [];
  }
  return state.usedHistory[category][key];
}

function markQuestionAsUsed(category, points, questionId) {
  if (!questionId) {
    return;
  }
  const bucket = ensureBucket(category, points);
  if (!bucket.includes(questionId)) {
    bucket.push(questionId);
    saveUsedHistory();
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

function getUniqueCategories(questions) {
  const unique = [];
  questions.forEach((q) => {
    if (!unique.includes(q.category)) {
      unique.push(q.category);
    }
  });
  return unique;
}

async function fetchQuestions() {
  let statusCode = "غير متاح";

  try {
    const csvUrl = `${CSV_URL}${CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
    const res = await fetch(csvUrl, { cache: "no-store" });
    statusCode = String(res.status);

    if (!res.ok) {
      throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      throw new Error("ملف CSV لا يحتوي بيانات كافية.");
    }

    return rowsToQuestions(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("CSV fetch error:", error);
    const fetchStatusMatch = message.match(/CSV fetch failed:\s*(\d+)/);
    const finalStatus = fetchStatusMatch?.[1] || statusCode;
    throw new Error(`تعذّر تحميل ملف CSV من Google Sheets. الحالة: ${finalStatus}. التفاصيل: ${message}`);
  }
}

function getQuestionForTile(category, points, usedIds) {
  const candidates = state.allQuestions.filter((q) => q.category === category && q.points === points);
  if (!candidates.length) {
    return null;
  }

  const bucket = ensureBucket(category, points);
  const unusedAcrossGames = candidates.filter((q) => !bucket.includes(q.id));
  const scopedCandidates = (unusedAcrossGames.length ? unusedAcrossGames : candidates).filter(
    (q) => !usedIds.has(q.id),
  );

  if (!unusedAcrossGames.length) {
    state.usedHistory[category][String(points)] = [];
    saveUsedHistory();
  }

  if (!scopedCandidates.length) {
    return null;
  }

  const chosen = scopedCandidates[Math.floor(Math.random() * scopedCandidates.length)];
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
      tiles.push({
        id: `${category}-${points}`,
        category,
        points,
        question,
        used: !question,
        missing: !question,
      });
    });
  });

  state.boardTiles = tiles;
}

function animateScoreValue(team, target) {
  const scoreEl = team === 1 ? el.team1Score : el.team2Score;
  const start = Number(state.displayedScores[team] ?? 0);

  if (prefersReducedMotion || start === target) {
    state.displayedScores[team] = target;
    scoreEl.textContent = String(target);
    return;
  }

  const duration = 420;
  const startAt = performance.now();

  function step(now) {
    const progress = Math.min((now - startAt) / duration, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    const value = Math.round(start + (target - start) * eased);
    scoreEl.textContent = String(value);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      state.displayedScores[team] = target;
      scoreEl.classList.remove("score-pop");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("score-pop");
    }
  }

  requestAnimationFrame(step);
}

function updateScoreboard() {
  animateScoreValue(1, state.scores[1]);
  animateScoreValue(2, state.scores[2]);
  const currentText = state.teamNames[state.currentTeam];
  el.currentTurn.textContent = currentText;
  el.team1Card.classList.toggle("active", state.currentTeam === 1);
  el.team2Card.classList.toggle("active", state.currentTeam === 2);
}

function syncTeamNameInputs() {
  el.team1NameInput.value = state.teamNames[1];
  el.team2NameInput.value = state.teamNames[2];
}

function animateButtonClick(button) {
  if (!button || prefersReducedMotion) {
    return;
  }
  button.classList.remove("click-pop");
  void button.offsetWidth;
  button.classList.add("click-pop");
}

function adjustScore(team, delta, triggerButton) {
  if (!(team in state.scores)) {
    return;
  }
  state.scores[team] = Math.max(0, state.scores[team] + delta);
  animateButtonClick(triggerButton);
  updateScoreboard();
}

function setTeamName(team, value, { commit = false } = {}) {
  const fallback = team === 1 ? "الفريق الأول" : "الفريق الثاني";
  const normalized = commit ? normalizeCell(value) || fallback : String(value ?? "");
  state.teamNames[team] = normalized;
  saveTeamNames();
  if (commit) {
    syncTeamNameInputs();
  }
  updateScoreboard();
}

function setTeamNamesFromCategoryModal() {
  setTeamName(1, el.categoryTeam1NameInput.value, { commit: true });
  setTeamName(2, el.categoryTeam2NameInput.value, { commit: true });
}

function hasPlayableTiles() {
  return state.boardTiles.some((tile) => !tile.used && !tile.missing && tile.question);
}

function closePodiumModal() {
  el.podiumModal.classList.add("hidden");
  el.podiumModal.classList.remove("is-open");
}

function buildPodiumColumn(name, score, label, placeClass) {
  return `
    <div class="podium-column ${placeClass}">
      <p class="podium-label">${label}</p>
      <p class="podium-team-name">${name}</p>
      <p class="podium-score">${score}</p>
      <div class="podium-step"></div>
    </div>
  `;
}

function showPodiumModal() {
  const score1 = state.scores[1];
  const score2 = state.scores[2];
  const team1 = state.teamNames[1];
  const team2 = state.teamNames[2];

  if (score1 === score2) {
    el.podiumTitle.textContent = "تعادل!";
    el.podiumSubtitle.textContent = "منافسة قوية.. استمروا";
    el.podiumBoard.innerHTML =
      buildPodiumColumn(team1, score1, "نتيجة الفريق", "tie") + buildPodiumColumn(team2, score2, "نتيجة الفريق", "tie");
  } else {
    const winnerTeam = score1 > score2 ? 1 : 2;
    const loserTeam = winnerTeam === 1 ? 2 : 1;
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
  }
}

function renderBoard() {
  if (
    state.dataLoadFailed ||
    state.selectedCategories.length !== CATEGORIES_TO_SELECT ||
    state.pointLevels.length === 0
  ) {
    el.board.innerHTML = "";
    return;
  }

  el.board.innerHTML = "";

  state.selectedCategories.forEach((category) => {
    const header = document.createElement("div");
    header.className = "board-cell category";
    header.textContent = category;
    el.board.appendChild(header);
  });

  state.pointLevels.forEach((points) => {
    state.selectedCategories.forEach((category) => {
      const tile = state.boardTiles.find((t) => t.category === category && t.points === points);
      if (!tile) {
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "board-cell tile";
      btn.dataset.tileId = tile.id;
      btn.setAttribute("aria-label", `${category} ${points}`);

      if (tile.missing) {
        btn.textContent = "نقص أسئلة";
        btn.disabled = true;
        btn.classList.add("missing", "used");
      } else if (tile.used) {
        btn.textContent = "";
        btn.disabled = true;
        btn.classList.add("used");
      } else {
        btn.textContent = String(points);
        btn.disabled = false;
      }

      btn.addEventListener("click", () => openQuestion(tile.id));
      el.board.appendChild(btn);
    });
  });
}

function getActiveQuestion() {
  return state.activeTile?.question || null;
}

function openQuestion(tileId) {
  stopAndResetTimer();
  clearQuestionAudio();
  if (state.dataLoadFailed) {
    showError("تعذّر فتح السؤال لأن تحميل ملف CSV فشل. اضغط على لعبة جديدة بعد إصلاح الرابط.");
    return;
  }

  const tile = state.boardTiles.find((t) => t.id === tileId);
  if (!tile || tile.used || !tile.question) {
    if (tile && tile.missing) {
      showError("نقص أسئلة");
    }
    return;
  }

  state.activeTile = tile;
  const q = tile.question;

  el.questionText.textContent = q.question;
  el.answerText.textContent = `الإجابة: ${q.answer}`;
  el.answerText.classList.add("hidden");
  el.choicesBox.classList.add("hidden");
  el.choicesList.innerHTML = "";

  if (q.type === "image" && q.image_url) {
    el.questionImage.hidden = false;
    el.questionImage.src = resolveMediaUrl(q.image_url);
  } else {
    el.questionImage.hidden = true;
    el.questionImage.removeAttribute("src");
  }

  renderQuestionAudio(q);

  el.lifelineBtn.disabled = lifelineUsed;

  const tileButton = el.board.querySelector(`[data-tile-id="${tileId}"]`);
  if (tileButton && !prefersReducedMotion) {
    tileButton.classList.remove("tile-pulse");
    void tileButton.offsetWidth;
    tileButton.classList.add("tile-pulse");
  }

  startTimer();

  el.modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    el.modal.classList.remove("is-closing");
    el.modal.classList.add("is-open");
  });
}

function closeModal() {
  stopAndResetTimer();
  clearQuestionAudio();

  if (el.modal.classList.contains("hidden")) {
    state.activeTile = null;
    return;
  }

  if (prefersReducedMotion) {
    el.modal.classList.add("hidden");
    el.modal.classList.remove("is-open", "is-closing");
    state.activeTile = null;
    return;
  }

  el.modal.classList.remove("is-open");
  el.modal.classList.add("is-closing");
  const onEnd = () => {
    el.modal.classList.add("hidden");
    el.modal.classList.remove("is-closing");
    state.activeTile = null;
    el.modal.removeEventListener("animationend", onEnd, true);
  };
  el.modal.addEventListener("animationend", onEnd, true);
}

function resetGameState() {
  state.selectedCategories = [];
  state.boardTiles = [];
  state.pointLevels = [...POINT_LEVELS];
  state.assignedQuestionIds = new Set();
  state.scores = { 1: 0, 2: 0 };
  state.displayedScores = { 1: 0, 2: 0 };
  state.currentTeam = 1;
  lifelineUsed = false;
  state.activeTile = null;
  closeModal();
  closeCategoryPicker();
  closePodiumModal();
  clearError();
  updateScoreboard();
  renderBoard();
}

function revealAnswer() {
  if (!getActiveQuestion()) {
    return;
  }
  el.answerText.classList.remove("hidden");
  if (!prefersReducedMotion) {
    el.answerText.classList.remove("reveal-anim");
    void el.answerText.offsetWidth;
    el.answerText.classList.add("reveal-anim");
  }
}

function uniqueByText(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function generateChoices(question) {
  const direct = [question.choice_a, question.choice_b, question.choice_c, question.choice_d].filter(Boolean);
  if (direct.length === 4) {
    return shuffle(direct);
  }

  const sameCategoryWrong = state.allQuestions
    .filter((q) => q.category === question.category && q.id !== question.id)
    .map((q) => q.answer);
  const allWrong = state.allQuestions.filter((q) => q.id !== question.id).map((q) => q.answer);

  const wrongPool = uniqueByText([...sameCategoryWrong, ...allWrong]).filter((ans) => ans !== question.answer);
  const wrongChoices = shuffle(wrongPool).slice(0, 3);
  const built = uniqueByText([question.answer, ...wrongChoices]);

  while (built.length < 4) {
    built.push(`خيار ${built.length + 1}`);
  }

  return shuffle(built.slice(0, 4));
}

function useLifeline() {
  const question = getActiveQuestion();
  if (!question || lifelineUsed) {
    return;
  }

  const options = generateChoices(question);
  el.choicesList.innerHTML = "";

  options.forEach((option) => {
    const div = document.createElement("div");
    div.className = "choice-item";
    div.textContent = option;
    el.choicesList.appendChild(div);
  });

  lifelineUsed = true;
  el.lifelineBtn.disabled = true;
  el.choicesBox.classList.remove("hidden");
}

function applyScore(isCorrect) {
  const tile = state.activeTile;
  if (!tile || tile.used || !tile.question) {
    return;
  }

  if (isCorrect) {
    state.scores[state.currentTeam] += tile.points;
  }

  stopAndResetTimer();

  state.scores[1] = Math.max(0, state.scores[1]);
  state.scores[2] = Math.max(0, state.scores[2]);
  tile.used = true;

  state.currentTeam = state.currentTeam === 1 ? 2 : 1;
  updateScoreboard();
  renderBoard();
  closeModal();
  checkEndOfGame();
}


function awardPointsToOtherTeam() {
  const tile = state.activeTile;
  if (!tile || tile.used || !tile.question) {
    return;
  }

  const otherTeam = state.currentTeam === 1 ? 2 : 1;
  state.scores[otherTeam] += tile.points;
  state.scores[1] = Math.max(0, state.scores[1]);
  state.scores[2] = Math.max(0, state.scores[2]);
  tile.used = true;

  stopAndResetTimer();

  state.currentTeam = state.currentTeam === 1 ? 2 : 1;
  updateScoreboard();
  renderBoard();
  closeModal();
  checkEndOfGame();
}

function updateCategoryPickerUI() {
  el.categoryCounter.textContent = `المحدد: ${state.selectedCategories.length} / ${CATEGORIES_TO_SELECT}`;
  el.startGameBtn.disabled = state.selectedCategories.length !== CATEGORIES_TO_SELECT;

  const checkedSet = new Set(state.selectedCategories);
  const reachedMax = checkedSet.size >= CATEGORIES_TO_SELECT;
  el.categoryList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.checked = checkedSet.has(checkbox.value);
    checkbox.disabled = !checkbox.checked && reachedMax;
  });
}

function renderCategoryOptions() {
  el.categoryList.innerHTML = "";

  state.allCategories.forEach((category) => {
    const label = document.createElement("label");
    label.className = "category-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = category;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (state.selectedCategories.length < CATEGORIES_TO_SELECT) {
          state.selectedCategories.push(category);
        }
      } else {
        state.selectedCategories = state.selectedCategories.filter((c) => c !== category);
      }
      updateCategoryPickerUI();
    });

    const span = document.createElement("span");
    span.textContent = category;

    label.appendChild(checkbox);
    label.appendChild(span);
    el.categoryList.appendChild(label);
  });

  updateCategoryPickerUI();
}

function openCategoryPicker() {
  state.selectedCategories = [];
  el.categoryTeam1NameInput.value = "";
  el.categoryTeam2NameInput.value = "";
  renderCategoryOptions();
  el.categoryModal.classList.remove("hidden");
  requestAnimationFrame(() => {
    el.categoryModal.classList.remove("is-closing");
    el.categoryModal.classList.add("is-open");
  });
}

function closeCategoryPicker() {
  if (el.categoryModal.classList.contains("hidden")) {
    return;
  }

  if (prefersReducedMotion) {
    el.categoryModal.classList.add("hidden");
    el.categoryModal.classList.remove("is-open", "is-closing");
    return;
  }

  el.categoryModal.classList.remove("is-open");
  el.categoryModal.classList.add("is-closing");
  const onEnd = () => {
    el.categoryModal.classList.add("hidden");
    el.categoryModal.classList.remove("is-closing");
    el.categoryModal.removeEventListener("animationend", onEnd, true);
  };
  el.categoryModal.addEventListener("animationend", onEnd, true);
}

function pickRandomCategories() {
  state.selectedCategories = shuffle(state.allCategories).slice(0, CATEGORIES_TO_SELECT);
  updateCategoryPickerUI();
}

function startGameFromSelection() {
  if (state.selectedCategories.length !== CATEGORIES_TO_SELECT) {
    return;
  }

  setTeamNamesFromCategoryModal();

  closeCategoryPicker();
  state.scores = { 1: 0, 2: 0 };
  state.displayedScores = { 1: 0, 2: 0 };
  state.currentTeam = 1;
  lifelineUsed = false;
  state.activeTile = null;
  clearError();

  buildBoardAssignment();
  updateScoreboard();
  renderBoard();
  checkEndOfGame();
}

async function startNewGame() {
  try {
    resetGameState();
    el.newGameBtn.disabled = true;
    state.dataLoadFailed = false;

    state.allQuestions = await fetchQuestions();

    if (state.allQuestions.length === 0) {
      throw new Error("لا توجد أسئلة صالحة في الملف.");
    }

    state.allCategories = getUniqueCategories(state.allQuestions);
    if (state.allCategories.length < CATEGORIES_TO_SELECT) {
      throw new Error("يلزم وجود 5 فئات مختلفة على الأقل في ملف CSV.");
    }

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
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء تحميل البيانات.";
    showError(`تعذّر بدء لعبة جديدة. ${message}`);
    console.error("Failed to start new game:", error);
    el.board.innerHTML = "";
  } finally {
    el.newGameBtn.disabled = false;
  }
}

el.newGameBtn.addEventListener("click", startNewGame);
el.closeModalBtn.addEventListener("click", closeModal);
el.revealBtn.addEventListener("click", revealAnswer);
el.correctBtn.addEventListener("click", () => applyScore(true));
el.wrongBtn.addEventListener("click", () => applyScore(false));
el.otherTeamBtn.addEventListener("click", awardPointsToOtherTeam);
el.lifelineBtn.addEventListener("click", useLifeline);
el.startGameBtn.addEventListener("click", startGameFromSelection);
el.randomCategoriesBtn.addEventListener("click", pickRandomCategories);
el.cancelCategoryBtn.addEventListener("click", closeCategoryPicker);
el.podiumNewGameBtn.addEventListener("click", startNewGame);

el.team1NameInput.addEventListener("input", () => setTeamName(1, el.team1NameInput.value));
el.team2NameInput.addEventListener("input", () => setTeamName(2, el.team2NameInput.value));
el.team1NameInput.addEventListener("blur", () => setTeamName(1, el.team1NameInput.value, { commit: true }));
el.team2NameInput.addEventListener("blur", () => setTeamName(2, el.team2NameInput.value, { commit: true }));

el.team1PlusBtn.addEventListener("click", () => adjustScore(1, 100, el.team1PlusBtn));
el.team1MinusBtn.addEventListener("click", () => adjustScore(1, -100, el.team1MinusBtn));
el.team2PlusBtn.addEventListener("click", () => adjustScore(2, 100, el.team2PlusBtn));
el.team2MinusBtn.addEventListener("click", () => adjustScore(2, -100, el.team2MinusBtn));

el.modal.addEventListener("click", (event) => {
  if (event.target === el.modal) {
    closeModal();
  }
});

el.categoryModal.addEventListener("click", (event) => {
  if (event.target === el.categoryModal) {
    closeCategoryPicker();
  }
});

el.passwordSubmitBtn.addEventListener("click", handlePasswordSubmit);
el.passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handlePasswordSubmit();
  }
});
el.passwordInput.addEventListener("input", () => {
  el.passwordError.classList.add("hidden");
});

document.getElementById("startBtn").addEventListener("click", function() {
  document.getElementById("startScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";
});

updateScoreboard();
loadTeamNames();
syncTeamNameInputs();
setupPasswordGate();
updateScoreboard();
startNewGame();
