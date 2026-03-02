const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkJrYhyba86QOQooWig5SveDZXxrp_ERypkLZlslSzp2KtTK4gwUqqIWYTqwq0bQHETiUI_Z2b8gvd/pub?gid=0&single=true&output=csv";
const POINT_VALUES = [200, 400, 600, 800, 1000];
const DIFFICULTY_TO_POINTS = {
  easy: 200,
  medium: 600,
  hard: 1000,
  سهل: 200,
  متوسط: 600,
  صعب: 1000,
};

const el = {
  board: document.getElementById("board"),
  errorBanner: document.getElementById("errorBanner"),
  team1Score: document.getElementById("team1Score"),
  team2Score: document.getElementById("team2Score"),
  team1Card: document.getElementById("team1Card"),
  team2Card: document.getElementById("team2Card"),
  currentTurn: document.getElementById("currentTurn"),
  newGameBtn: document.getElementById("newGameBtn"),
  modal: document.getElementById("questionModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  questionText: document.getElementById("questionText"),
  questionImage: document.getElementById("questionImage"),
  answerText: document.getElementById("answerText"),
  revealBtn: document.getElementById("revealBtn"),
  correctBtn: document.getElementById("correctBtn"),
  wrongBtn: document.getElementById("wrongBtn"),
  lifelineBtn: document.getElementById("lifelineBtn"),
  choicesBox: document.getElementById("choicesBox"),
  choicesList: document.getElementById("choicesList"),
};

const state = {
  allQuestions: [],
  categories: [],
  boardTiles: [],
  scores: { 1: 0, 2: 0 },
  currentTeam: 1,
  lifelineUsed: false,
  activeTile: null,
};

function showError(message) {
  el.errorBanner.textContent = message;
  el.errorBanner.classList.remove("hidden");
}

function clearError() {
  el.errorBanner.textContent = "";
  el.errorBanner.classList.add("hidden");
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
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(value.trim());
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
    row.push(value.trim());
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeHeader(header) {
  return header.toLowerCase().trim().replace(/\s+/g, "_");
}

function toPoints(question) {
  const explicit = Number(String(question.points || "").replace(/[^\d]/g, ""));
  if (POINT_VALUES.includes(explicit)) {
    return explicit;
  }

  const difficulty = String(question.difficulty || "").trim().toLowerCase();
  return DIFFICULTY_TO_POINTS[difficulty] || 200;
}

function rowsToQuestions(rows) {
  const [headers, ...dataRows] = rows;
  const mapHeaders = headers.map(normalizeHeader);

  return dataRows
    .map((row, index) => {
      const q = {};
      mapHeaders.forEach((key, i) => {
        q[key] = (row[i] || "").trim();
      });

      return {
        id: q.id || String(index + 1),
        category: q.category || "عام",
        difficulty: q.difficulty || "",
        points: toPoints(q),
        question: q.question || "",
        answer: q.answer || "",
        type: (q.type || "text").toLowerCase(),
        image_url: q.image_url || "",
        choice_a: q.choice_a || "",
        choice_b: q.choice_b || "",
        choice_c: q.choice_c || "",
        choice_d: q.choice_d || "",
      };
    })
    .filter((q) => q.question && q.answer && q.category);
}

function shuffle(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchQuestions() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("تعذّر تحميل ملف CSV من Google Sheets.");
  }

  const csv = await res.text();
  const rows = parseCSV(csv);
  if (rows.length < 2) {
    throw new Error("ملف CSV لا يحتوي بيانات كافية.");
  }
  return rowsToQuestions(rows);
}

function pickCategories(questions) {
  const unique = [];
  questions.forEach((q) => {
    if (!unique.includes(q.category)) {
      unique.push(q.category);
    }
  });
  return unique.slice(0, 5);
}

function getQuestionForTile(category, points, usedIds) {
  const candidates = state.allQuestions.filter(
    (q) => q.category === category && q.points === points && !usedIds.has(q.id),
  );

  if (!candidates.length) {
    return null;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  usedIds.add(chosen.id);
  return chosen;
}

function buildBoardAssignment() {
  const usedIds = new Set();
  const tiles = [];

  state.categories.forEach((category) => {
    POINT_VALUES.forEach((points) => {
      const question = getQuestionForTile(category, points, usedIds);
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

function updateScoreboard() {
  el.team1Score.textContent = String(state.scores[1]);
  el.team2Score.textContent = String(state.scores[2]);
  const currentText = state.currentTeam === 1 ? "الفريق الأول" : "الفريق الثاني";
  el.currentTurn.textContent = currentText;
  el.team1Card.classList.toggle("active", state.currentTeam === 1);
  el.team2Card.classList.toggle("active", state.currentTeam === 2);
}

function renderBoard() {
  el.board.innerHTML = "";

  state.categories.forEach((category) => {
    const header = document.createElement("div");
    header.className = "board-cell category";
    header.textContent = category;
    el.board.appendChild(header);
  });

  POINT_VALUES.forEach((points) => {
    state.categories.forEach((category) => {
      const tile = state.boardTiles.find((t) => t.category === category && t.points === points);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "board-cell tile";
      btn.dataset.tileId = tile.id;

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
  const tile = state.boardTiles.find((t) => t.id === tileId);
  if (!tile || tile.used || !tile.question) {
    return;
  }

  state.activeTile = tile;
  const q = tile.question;

  el.questionText.textContent = q.question;
  el.answerText.textContent = `الإجابة: ${q.answer}`;
  el.answerText.classList.add("hidden");
  el.choicesBox.classList.add("hidden");
  el.choicesList.innerHTML = "";

  const basePath = window.location.pathname.includes("/Tasleya/") ? "/Tasleya/" : "/";
  if (q.type === "image" && q.image_url) {
    el.questionImage.hidden = false;
    el.questionImage.src = encodeURI(basePath + q.image_url);
  } else {
    el.questionImage.hidden = true;
    el.questionImage.removeAttribute("src");
  }

  el.lifelineBtn.disabled = state.lifelineUsed;
  el.modal.classList.remove("hidden");
}

function closeModal() {
  el.modal.classList.add("hidden");
  state.activeTile = null;
}

function revealAnswer() {
  if (!getActiveQuestion()) {
    return;
  }
  el.answerText.classList.remove("hidden");
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
  if (!question || state.lifelineUsed) {
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

  state.lifelineUsed = true;
  el.lifelineBtn.disabled = true;
  el.choicesBox.classList.remove("hidden");
}

function applyScore(isCorrect) {
  const tile = state.activeTile;
  if (!tile || tile.used || !tile.question) {
    return;
  }

  const delta = isCorrect ? tile.points : -tile.points;
  state.scores[state.currentTeam] += delta;
  tile.used = true;

  state.currentTeam = state.currentTeam === 1 ? 2 : 1;
  updateScoreboard();
  renderBoard();
  closeModal();
}

function resetGameState() {
  state.scores = { 1: 0, 2: 0 };
  state.currentTeam = 1;
  state.lifelineUsed = false;
  state.activeTile = null;

  state.categories = pickCategories(state.allQuestions);
  if (state.categories.length < 5) {
    throw new Error("يلزم وجود 5 فئات مختلفة على الأقل في ملف CSV.");
  }

  buildBoardAssignment();
  updateScoreboard();
  renderBoard();
}

async function startNewGame() {
  try {
    clearError();
    el.newGameBtn.disabled = true;

    if (!state.allQuestions.length) {
      state.allQuestions = await fetchQuestions();
    }

    if (state.allQuestions.length === 0) {
      throw new Error("لا توجد أسئلة صالحة في الملف.");
    }

    resetGameState();
  } catch (error) {
    showError(error.message || "حدث خطأ غير متوقع أثناء تحميل البيانات.");
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
el.lifelineBtn.addEventListener("click", useLifeline);

el.modal.addEventListener("click", (event) => {
  if (event.target === el.modal) {
    closeModal();
  }
});

updateScoreboard();
startNewGame();
