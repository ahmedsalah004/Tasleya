(function () {
  // Temporary browser-side Google Sheets CSV source for المزاد.
  // Swap only `loadRawSheetRows` to Worker JSON later; keep the rest unchanged.
  const DEFAULT_AUCTION_SHEET_CSV_URL = "";
  const TRUTHY_VALUES = new Set(["1", "true", "yes", "y", "on", "active", "enabled"]);

  function normalizeCell(value) {
    return String(value ?? "").trim();
  }

  function isActiveCell(value) {
    return TRUTHY_VALUES.has(normalizeCell(value).toLowerCase());
  }

  function splitAcceptedAnswers(value) {
    return normalizeCell(value)
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === ",") {
        currentRow.push(currentCell);
        currentCell = "";
        continue;
      }

      if (!inQuotes && (char === "\n" || char === "\r")) {
        if (char === "\r" && nextChar === "\n") {
          i += 1;
        }
        currentRow.push(currentCell);
        currentCell = "";
        rows.push(currentRow);
        currentRow = [];
        continue;
      }

      currentCell += char;
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    return rows;
  }

  function mapRowsToObjects(csvRows) {
    if (!csvRows.length) return [];
    const headers = csvRows[0].map((header) => normalizeCell(header).toLowerCase());

    return csvRows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = normalizeCell(row[index]);
      });
      return obj;
    });
  }

  async function loadRawSheetRows(options = {}) {
    const configuredUrl = normalizeCell(window.TASLEYA_AUCTION_SHEET_CSV_URL || DEFAULT_AUCTION_SHEET_CSV_URL);
    const csvUrl = normalizeCell(options.csvUrl || configuredUrl);

    if (!csvUrl) {
      throw new Error("AUCTION_SHEET_CSV_URL_NOT_CONFIGURED");
    }

    const response = await fetch(csvUrl, {
      method: "GET",
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`AUCTION_SHEET_FETCH_FAILED_${response.status}`);
    }

    const csvText = await response.text();
    return mapRowsToObjects(parseCsv(csvText));
  }

  function transformRowsToAuctionQuestions(rawRows) {
    return rawRows
      .filter((row) => isActiveCell(row.is_active))
      .map((row) => {
        const acceptedAnswers = splitAcceptedAnswers(row.accepted_answers);
        return {
          id: normalizeCell(row.id),
          category: normalizeCell(row.category),
          prompt: normalizeCell(row.prompt),
          difficulty: normalizeCell(row.difficulty),
          acceptedAnswers,
          notes: normalizeCell(row.notes),
        };
      })
      .filter((question) => question.category && question.prompt);
  }

  async function loadAuctionQuestions(options = {}) {
    const rawRows = await loadRawSheetRows(options);
    return transformRowsToAuctionQuestions(rawRows);
  }

  window.AuctionQuestionDataSource = {
    loadRawSheetRows,
    transformRowsToAuctionQuestions,
    loadAuctionQuestions,
  };
})();
