const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkJrYhyba86QOQooWig5SveDZXxrp_ERypkLZlslSzp2KtTK4gwUqqIWYTqwq0bQHETiUI_Z2b8gvd/pub?gid=0&single=true&output=csv";

const state = {
  allQuestions: [],
  sessionQuestions: [],
  index: 0,
  currentTeam: 1,
  teamScores: { 1: 0, 2: 0 },
  timer: 30,
  timerHandle: null,
  answerRevealed: false,
};

const el = {
  questionText: document.getElementById("questionText"),
  answerText: document.getElementById("answerText"),
  choices: document.getElementById("choices"),
  questionImage: document.getElementById("questionImage"),
  timer: document.getElementById("timer"),
  metaInfo: document.getElementById("metaInfo"),
  questionCounter: document.getElementById("questionCounter"),
  currentTeam: document.getElementById("currentTeam"),
  team1Score: document.getElementById("team1Score"),
  team2Score: document.getElementById("team2Score"),
  team1Card: document.getElementById("team1Card"),
  team2Card: document.getElementById("team2Card"),
  revealBtn: document.getElementById("revealBtn"),
  correctBtn: document.getElementById("correctBtn"),
  nextBtn: document.getElementById("nextBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
};

function parseCSV(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell.trim());
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return header
    .toLowerCase()
    .trim()
    .replace(/\ufeff/g, "")
    .replace(/\s+/g, "_");
}

function rowsToQuestions(rows) {
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map(normalizeHeader);

  return dataRows
    .map((columns, idx) => {
      const map = Object.fromEntries(headers.map((h, i) => [h, columns[i] ?? ""]));
      const points = Number.parseInt(map.points, 10);

      return {
        id: map.id || String(idx + 1),
        category: map.category || "عام",
        difficulty: map.difficulty || "—",
        question: map.question || "",
        answer: map.answer || "",
        type: map.type || "text",
        image_url: map.image_url || "",
        choice_a: map.choice_a || "",
        choice_b: map.choice_b || "",
        choice_c: map.choice_c || "",
        choice_d: map.choice_d || "",
        points: Number.isFinite(points) ? points : 1,
      };
    })
    .filter((q) => q.question && q.answer);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function fetchQuestions() {
  const response = await fetch(CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("فشل تحميل ملف الأسئلة.");
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);
  if (!rows.length) {
    throw new Error("ملف CSV فارغ أو غير صالح.");
  }

  return rowsToQuestions(rows);
}

function resetTimer() {
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
  }

  state.timer = 30;
  renderTimer();

  state.timerHandle = setInterval(() => {
    state.timer -= 1;
    renderTimer();

    if (state.timer <= 0) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
      revealAnswer();
      el.correctBtn.disabled = true;
    }
  }, 1000);
}

function renderTimer() {
  el.timer.textContent = String(state.timer);
  el.timer.classList.toggle("warning", state.timer <= 10 && state.timer > 5);
  el.timer.classList.toggle("danger", state.timer <= 5);
}

function updateScoreboard() {
  el.team1Score.textContent = state.teamScores[1];
  el.team2Score.textContent = state.teamScores[2];
  el.currentTeam.textContent = state.currentTeam === 1 ? "الفريق الأول" : "الفريق الثاني";
  el.team1Card.classList.toggle("active", state.currentTeam === 1);
  el.team2Card.classList.toggle("active", state.currentTeam === 2);
}

function currentQuestion() {
  return state.sessionQuestions[state.index];
}

function hasChoices(question) {
  return [question.choice_a, question.choice_b, question.choice_c, question.choice_d].some(Boolean);
}

function renderQuestion() {
  const q = currentQuestion();
  if (!q) {
    finishGame();
    return;
  }

  state.answerRevealed = false;
  el.questionText.textContent = q.question;
  el.answerText.hidden = true;
  el.answerText.textContent = `الإجابة: ${q.answer}`;
  el.metaInfo.textContent = `الفئة: ${q.category} | الصعوبة: ${q.difficulty} | النقاط: ${q.points}`;
  el.questionCounter.textContent = `${state.index + 1} / ${state.sessionQuestions.length}`;

  if (q.image_url) {
    el.questionImage.hidden = false;
    el.questionImage.src = q.image_url;
  } else {
    el.questionImage.hidden = true;
    el.questionImage.removeAttribute("src");
  }

  renderChoices(q);
  el.revealBtn.disabled = false;
  el.correctBtn.disabled = true;
  el.nextBtn.disabled = true;
  resetTimer();
  updateScoreboard();
}

function renderChoices(q) {
  el.choices.innerHTML = "";

  const choices = [q.choice_a, q.choice_b, q.choice_c, q.choice_d].filter(Boolean);
  if (!choices.length) {
    return;
  }

  choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.type = "button";
    btn.textContent = choice;
    btn.addEventListener("click", () => {
      [...el.choices.children].forEach((node) => {
        node.disabled = true;
        node.style.borderColor = "#3a446b";
      });
      btn.style.borderColor = "#7b9cff";
      revealAnswer();
    });
    el.choices.appendChild(btn);
  });
}

function revealAnswer() {
  if (state.answerRevealed) {
    return;
  }

  state.answerRevealed = true;
  el.answerText.hidden = false;
  el.revealBtn.disabled = true;
  el.correctBtn.disabled = false;
  el.nextBtn.disabled = false;

  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
}

function awardPointsToCurrentTeam() {
  const q = currentQuestion();
  if (!q || !state.answerRevealed) {
    return;
  }

  state.teamScores[state.currentTeam] += q.points;
  updateScoreboard();
  el.correctBtn.disabled = true;
}

function nextQuestion() {
  state.currentTeam = state.currentTeam === 1 ? 2 : 1;
  state.index += 1;
  renderQuestion();
}

function finishGame() {
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  el.questionText.textContent = "انتهت اللعبة! اضغط لعبة جديدة لإعادة التشغيل.";
  el.answerText.hidden = true;
  el.choices.innerHTML = "";
  el.questionImage.hidden = true;
  el.metaInfo.textContent = "الفئة: — | الصعوبة: — | النقاط: —";
  el.revealBtn.disabled = true;
  el.correctBtn.disabled = true;
  el.nextBtn.disabled = true;
  el.questionCounter.textContent = `${state.sessionQuestions.length} / ${state.sessionQuestions.length}`;
}

async function startNewGame() {
  try {
    el.newGameBtn.disabled = true;
    el.questionText.textContent = "جارٍ تحميل الأسئلة...";

    if (!state.allQuestions.length) {
      state.allQuestions = await fetchQuestions();
    }

    state.sessionQuestions = shuffle([...state.allQuestions]);
    state.index = 0;
    state.currentTeam = 1;
    state.teamScores = { 1: 0, 2: 0 };
    updateScoreboard();
    renderQuestion();
  } catch (error) {
    el.questionText.textContent = `حدث خطأ: ${error.message}`;
  } finally {
    el.newGameBtn.disabled = false;
  }
}

el.revealBtn.addEventListener("click", revealAnswer);
el.correctBtn.addEventListener("click", awardPointsToCurrentTeam);
el.nextBtn.addEventListener("click", nextQuestion);
el.newGameBtn.addEventListener("click", startNewGame);

updateScoreboard();
renderTimer();
