(function () {
  const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";

  function normalizeCell(value) {
    return String(value ?? "").trim();
  }

  function resolveApiBaseUrl() {
    const configuredBaseUrl = normalizeCell(window.TASLEYA_API_BASE_URL);
    if (!configuredBaseUrl) return DEFAULT_WORKER_API_BASE_URL;
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  async function apiFetchJson(path) {
    const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      const message = normalizeCell(payload && payload.error) || `AUCTION_QUESTIONS_FETCH_FAILED_${response.status}`;
      throw new Error(message);
    }

    return payload;
  }

  function transformApiQuestions(rawQuestions) {
    return rawQuestions
      .map((row) => {
        const acceptedAnswers = Array.isArray(row && row.accepted_answers)
          ? row.accepted_answers.map((item) => normalizeCell(item)).filter(Boolean)
          : [];
        const difficultyValue = Number.parseInt(normalizeCell(row && row.difficulty), 10);

        return {
          id: normalizeCell(row && row.id),
          category: normalizeCell(row && row.category),
          prompt: normalizeCell(row && row.prompt),
          difficulty: Number.isFinite(difficultyValue) ? difficultyValue : null,
          acceptedAnswers,
          notes: normalizeCell(row && row.notes),
        };
      })
      .filter((question) => question.category && question.prompt && question.acceptedAnswers.length);
  }

  async function loadAuctionQuestions() {
    const payload = await apiFetchJson("/mazad/questions");
    const rawQuestions = Array.isArray(payload && payload.questions) ? payload.questions : [];
    return transformApiQuestions(rawQuestions);
  }

  window.AuctionQuestionDataSource = {
    loadAuctionQuestions,
  };
})();
