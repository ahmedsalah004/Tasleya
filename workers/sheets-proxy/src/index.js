const DEFAULT_CACHE_TTL_SECONDS = 300;
const sheetMemoryCache = new Map();
const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'y', 'on', 'active', 'enabled']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
    }

    try {
      if (url.pathname === '/categories' && request.method === 'GET') {
        const bank = await getQuestionBank(request, env, ctx);
        return json({ categories: bank.categories }, 200, request, env);
      }

      if (url.pathname === '/question' && request.method === 'GET') {
        const bank = await getQuestionBank(request, env, ctx);
        const byId = normalizeCell(url.searchParams.get('id'));

        if (byId) {
          const question = bank.byId.get(byId);
          if (!question) return error('السؤال غير موجود.', 'QUESTION_NOT_FOUND', 404, request, env);
          return json({ question: sanitizeQuestion(question, bank.questions) }, 200, request, env);
        }

        const category = normalizeCell(url.searchParams.get('category'));
        const requestedPoints = toInteger(url.searchParams.get('points'));
        const requestedDifficulty = toInteger(url.searchParams.get('difficulty'));
        const excludeIds = new Set(splitCsvParam(url.searchParams.get('exclude_ids')));

        const candidates = bank.questions.filter((question) => {
          if (category && question.category !== category) return false;
          if (requestedPoints !== null && question.points !== requestedPoints) return false;
          if (requestedDifficulty !== null && question.difficulty !== requestedDifficulty) return false;
          return true;
        });

        if (!candidates.length) {
          return error('لا يوجد سؤال مطابق للمرشحات المطلوبة.', 'QUESTION_NOT_FOUND', 404, request, env);
        }

        const available = candidates.filter((question) => !excludeIds.has(question.id));
        const questionMeta = {
          pool_size: candidates.length,
          excluded_count: excludeIds.size,
          remaining_after_exclude: available.length,
          exhausted: available.length === 0,
        };
        if (!available.length) {
          return error('تم استهلاك جميع الأسئلة المطابقة لهذه الخانة.', 'QUESTION_POOL_EXHAUSTED', 404, request, env, { meta: questionMeta });
        }

        const chosen = available[Math.floor(Math.random() * available.length)];
        return json({ question: sanitizeQuestion(chosen, bank.questions), meta: questionMeta }, 200, request, env);
      }

      if (url.pathname === '/validate-answer' && request.method === 'POST') {
        const bank = await getQuestionBank(request, env, ctx);
        const body = await readJsonBody(request);
        const questionId = normalizeCell(body.questionId);
        const submittedAnswer = normalizeCell(body.submittedAnswer);

        if (!questionId) return error('questionId مطلوب.', 'INVALID_REQUEST', 400, request, env);

        const question = bank.byId.get(questionId);
        if (!question) return error('السؤال غير موجود.', 'QUESTION_NOT_FOUND', 404, request, env);

        return json({
          questionId,
          correctAnswer: question.answer,
          isCorrect: submittedAnswer ? normalizeForComparison(submittedAnswer) === normalizeForComparison(question.answer) : null,
        }, 200, request, env);
      }

      if (url.pathname === '/films/questions' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'FILMS_SHEET_CSV_URL',
          cacheKeyPrefix: 'films-questions',
        });
        const films = buildFilms(rows);
        return json({ films, diagnostics: buildIdDiagnostics(films, (item) => item.id, 'films') }, 200, request, env);
      }

      if (url.pathname === '/map-game/questions' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'MAP_GAME_SHEET_CSV_URL',
          cacheKeyPrefix: 'map-game-questions',
        });
        const questions = buildMapGameQuestions(rows);
        return json({ questions, diagnostics: buildIdDiagnostics(questions, (item) => item.id, 'map-game') }, 200, request, env);
      }

      if (url.pathname === '/map-game/language-questions' && request.method === 'GET') {
        const mapRows = await getSheetRows(request, env, ctx, {
          envVarName: 'MAP_GAME_SHEET_CSV_URL',
          cacheKeyPrefix: 'map-game-questions',
        });
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'MAP_LANGUAGE_MODE_SHEET_CSV_URL',
          cacheKeyPrefix: 'map-language-mode-questions',
        });
        const questions = buildMapLanguageModeQuestions(rows, buildMapCountryCoordinatesLookup(mapRows));
        return json({ questions, diagnostics: buildIdDiagnostics(questions, (item) => item.id, 'map-game-language') }, 200, request, env);
      }

      if (url.pathname === '/map-game/image-questions' && request.method === 'GET') {
        const mapRows = await getSheetRows(request, env, ctx, {
          envVarName: 'MAP_GAME_SHEET_CSV_URL',
          cacheKeyPrefix: 'map-game-questions',
        });
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'MAP_GEOGUESS_MODE_SHEET_CSV_URL',
          cacheKeyPrefix: 'map-geoguess-mode-questions',
        });
        const questions = buildMapGeoguessModeQuestions(rows, buildMapCountryCoordinatesLookup(mapRows));
        return json({ questions, diagnostics: buildIdDiagnostics(questions, (item) => item.id, 'map-game-image') }, 200, request, env);
      }

      if (url.pathname === '/guess-from-hint/questions' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'GUESS_FROM_HINT_SHEET_CSV_URL',
          cacheKeyPrefix: 'guess-from-hint-questions',
        });
        const questions = buildGuessFromHintQuestions(rows);
        return json({ questions, diagnostics: buildIdDiagnostics(questions, (item) => item.id, 'guess-from-hint') }, 200, request, env);
      }

      if (url.pathname === '/forbidden-words/cards' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'FORBIDDEN_WORDS_SHEET_CSV_URL',
          cacheKeyPrefix: 'forbidden-words-cards',
        });
        const cards = buildForbiddenWordsCards(rows);
        return json({ cards, diagnostics: buildIdDiagnostics(cards, (item) => item.id, 'forbidden-words') }, 200, request, env);
      }

      if (url.pathname === '/emoji-movies/cards' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'EMOJI_MOVIES_SHEET_CSV_URL',
          cacheKeyPrefix: 'emoji-movies-cards',
        });
        const cards = buildEmojiMoviesCards(rows);
        return json({ cards, diagnostics: buildIdDiagnostics(cards, (item) => item.id, 'emoji-movies') }, 200, request, env);
      }

      if (url.pathname === '/mazad/questions' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'MAZAD_SHEET_CSV_URL',
          cacheKeyPrefix: 'mazad-questions',
        });
        const questions = buildMazadQuestions(rows);
        return json({ questions, diagnostics: buildIdDiagnostics(questions, (item) => item.id, 'auction') }, 200, request, env);
      }

      if (url.pathname === '/xo-intersection/boards' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'XO_INTERSECTION_SHEET_CSV_URL',
          cacheKeyPrefix: 'xo-intersection-boards',
        });
        const boards = buildXoIntersectionBoards(rows);
        return json({ boards, diagnostics: buildIdDiagnostics(boards, (item) => item.board_id, 'xo-intersection') }, 200, request, env);
      }

      return error('المسار غير موجود.', 'NOT_FOUND', 404, request, env);
    } catch (err) {
      console.error('[sheets-proxy] Request failed', err);
      return error(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.', 'INTERNAL_ERROR', 500, request, env);
    }
  },
};

async function getQuestionBank(request, env, ctx) {
  const rows = await getSheetRows(request, env, ctx, {
    envVarName: 'SHEET_CSV_URL',
    cacheKeyPrefix: 'question-bank',
  });

  const bank = buildQuestionBank(rows);
  return {
    ...bank,
    byId: new Map(bank.questions.map((question) => [question.id, question])),
  };
}

async function getSheetRows(request, env, ctx, { envVarName, cacheKeyPrefix }) {
  const ttlSeconds = getCacheTtl(env);
  const sheetUrl = normalizeCell(env[envVarName]);
  if (!sheetUrl) {
    throw new Error(`Missing ${envVarName} environment variable.`);
  }

  const memoryKey = `${cacheKeyPrefix}:${sheetUrl}`;
  const now = Date.now();
  const memoryEntry = sheetMemoryCache.get(memoryKey);
  if (memoryEntry && memoryEntry.expiresAt > now) {
    return memoryEntry.rows;
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://tasleya-worker-cache.local/${cacheKeyPrefix}?sheet=${encodeURIComponent(sheetUrl)}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const cachedRows = await cached.json();
    const hydratedRows = Array.isArray(cachedRows?.rows) ? cachedRows.rows : [];
    sheetMemoryCache.set(memoryKey, { rows: hydratedRows, expiresAt: now + ttlSeconds * 1000 });
    return hydratedRows;
  }

  const response = await fetch(sheetUrl, {
    headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8' },
    cf: { cacheTtl: ttlSeconds, cacheEverything: true },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('Google Sheet CSV does not contain enough rows.');
  }

  sheetMemoryCache.set(memoryKey, { rows, expiresAt: now + ttlSeconds * 1000 });

  const serialized = JSON.stringify({ rows });
  ctx.waitUntil(cache.put(cacheKey, new Response(serialized, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ttlSeconds}`,
    },
  })));

  return rows;
}

function buildQuestionBank(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  const questions = dataRows
    .map((row, index) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      const difficulty = toInteger(raw.difficulty);
      const points = toInteger(raw.points) ?? (difficulty !== null && difficulty >= 1 && difficulty <= 5 ? difficulty * 100 : null);
      const hint = firstNonEmpty(raw['تلميح'], raw['تلميح_(hint)'], raw.hint, raw.hint_text);
      const question = {
        id: raw.id || String(index + 1),
        category: raw.category,
        difficulty,
        points,
        question: raw.question,
        answer: raw.answer,
        type: normalizeCell(raw.type).toLowerCase() || 'text',
        image_url: raw.image_url,
        choice_a: raw.choice_a,
        choice_b: raw.choice_b,
        choice_c: raw.choice_c,
        choice_d: raw.choice_d,
        hint,
      };

      if (!question.id || !question.category || !question.question || !question.answer) {
        return null;
      }

      return question;
    })
    .filter(Boolean);

  const categories = [];
  questions.forEach((question) => {
    if (!categories.includes(question.category)) categories.push(question.category);
  });

  return {
    questions,
    categories,
  };
}

function buildFilms(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  return dataRows
    .map((row) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      const title = normalizeCell(raw.title);
      if (!title) return null;

      return {
        id: normalizeCell(raw.id),
        title,
        difficulty: normalizeCell(raw.difficulty),
        points: toInteger(raw.points) ?? 0,
      };
    })
    .filter(Boolean);
}

function buildMapGameQuestions(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  const requiredHeaders = ['country_code', 'country_name_ar', 'country_name_en', 'difficulty', 'points', 'lat', 'lng'];
  const missingHeaders = requiredHeaders.filter((header) => !headerMap.includes(header));
  if (missingHeaders.length) {
    throw new Error(`CSV headers are missing required columns: ${missingHeaders.join(', ')}`);
  }

  return dataRows
    .map((row) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      const countryCode = normalizeCell(raw.country_code).toUpperCase();
      const countryNameAr = normalizeCell(raw.country_name_ar);
      const countryNameEn = normalizeCell(raw.country_name_en);
      const difficulty = normalizeCell(raw.difficulty).toLowerCase();
      const points = toInteger(raw.points);
      const lat = Number.parseFloat(raw.lat);
      const lng = Number.parseFloat(raw.lng);
      const id = firstNonEmpty(raw.id, raw.question_id, raw.questionid);

      if (!countryCode || !countryNameAr || !countryNameEn || !['easy', 'medium', 'hard'].includes(difficulty)) return null;
      if (!Number.isFinite(points) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        id,
        mode: 'map',
        promptType: 'map',
        sourceId: id,
        targetCountryCode: countryCode,
        targetCountryNameAr: countryNameAr,
        targetCountryNameEn: countryNameEn,
        countryCode,
        countryNameAr,
        countryNameEn,
        difficulty,
        points,
        imageUrl: '',
        audioUrl: '',
        placeNameAr: '',
        placeNameEn: '',
        status: 'approved_v1',
        lat,
        lng,
      };
    })
    .filter(Boolean);
}

function buildMapCountryCoordinatesLookup(rows) {
  const questions = buildMapGameQuestions(rows);
  const byCode = new Map();
  questions.forEach((question) => {
    byCode.set(normalizeMapCountryCode(question.countryCode), {
      lat: question.lat,
      lng: question.lng,
    });
  });
  return byCode;
}

function buildMapLanguageModeQuestions(rows, countryCoordinates = new Map()) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  const requiredHeaderGroups = [
    ['source_id', 'sourceid', 'id'],
    ['audio_url', 'audiourl'],
    ['target_country_code', 'targetcountrycode', 'country_code', 'countrycode'],
    ['target_country_name_ar', 'targetcountrynamear', 'country_name_ar', 'countrynamear'],
    ['target_country_name_en', 'targetcountrynameen', 'country_name_en', 'countrynameen'],
    ['difficulty'],
    ['points'],
    ['status'],
  ];
  const missingHeaders = requiredHeaderGroups
    .filter((group) => !group.some((header) => headerMap.includes(header)))
    .map((group) => group[0]);
  if (missingHeaders.length) {
    throw new Error(`CSV headers are missing required columns: ${missingHeaders.join(', ')}`);
  }

  return dataRows
    .map((row, index) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      if (!isApprovedV1Status(raw.status)) return null;

      const countryCode = normalizeMapCountryCode(firstNonEmpty(raw.target_country_code, raw.targetcountrycode, raw.country_code, raw.countrycode));
      const countryNameAr = normalizeCell(firstNonEmpty(raw.target_country_name_ar, raw.targetcountrynamear, raw.country_name_ar, raw.countrynamear));
      const countryNameEn = normalizeCell(firstNonEmpty(raw.target_country_name_en, raw.targetcountrynameen, raw.country_name_en, raw.countrynameen));
      const { difficulty, points } = resolveMapDifficultyAndPoints(raw.difficulty, raw.points);
      const audioUrl = normalizeCell(firstNonEmpty(raw.audio_url, raw.audiourl));
      const id = firstNonEmpty(raw.source_id, raw.sourceid, raw.id, `language-row-${index + 1}`);
      const sourceLanguageAnswer = normalizeCell(firstNonEmpty(raw.source_language_answer, raw.sourcelanguageanswer));
      const coords = countryCoordinates.get(countryCode);

      if (!countryCode || !countryNameAr || !countryNameEn) return null;
      if (!audioUrl || !difficulty || !Number.isFinite(points)) return null;

      return {
        id,
        mode: 'language',
        promptType: 'audio',
        sourceId: id,
        targetCountryCode: countryCode,
        targetCountryNameAr: countryNameAr,
        targetCountryNameEn: countryNameEn,
        countryCode,
        countryNameAr,
        countryNameEn,
        difficulty,
        points,
        audioUrl,
        sourceLanguageAnswer,
        imageUrl: '',
        placeNameAr: '',
        placeNameEn: '',
        status: normalizeCell(raw.status),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      };
    })
    .filter(Boolean);
}

function buildMapGeoguessModeQuestions(rows, countryCoordinates = new Map()) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  const requiredHeaders = [
    'source_id',
    'image_url',
    'target_country_code',
    'target_country_name_ar',
    'target_country_name_en',
    'place_name_ar',
    'place_name_en',
    'difficulty',
    'points',
    'status',
  ];
  const missingHeaders = requiredHeaders.filter((header) => !headerMap.includes(header));
  if (missingHeaders.length) {
    throw new Error(`CSV headers are missing required columns: ${missingHeaders.join(', ')}`);
  }

  return dataRows
    .map((row, index) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      if (!isApprovedV1Status(raw.status)) return null;

      const sourceId = firstNonEmpty(raw.source_id, raw.id, `geoguess-row-${index + 1}`);
      const imageUrl = normalizeCell(raw.image_url);
      const targetCountryCode = normalizeMapCountryCode(raw.target_country_code);
      const targetCountryNameAr = normalizeCell(raw.target_country_name_ar);
      const targetCountryNameEn = normalizeCell(raw.target_country_name_en);
      const placeNameAr = normalizeCell(raw.place_name_ar);
      const placeNameEn = normalizeCell(raw.place_name_en);
      const { difficulty, points } = resolveMapDifficultyAndPoints(raw.difficulty, raw.points);
      const coords = countryCoordinates.get(targetCountryCode);

      if (!targetCountryCode || !targetCountryNameAr || !targetCountryNameEn) return null;
      if (!difficulty || !Number.isFinite(points)) return null;

      return {
        id: sourceId,
        mode: 'image',
        promptType: 'image',
        sourceId,
        targetCountryCode,
        targetCountryNameAr,
        targetCountryNameEn,
        countryCode: targetCountryCode,
        countryNameAr: targetCountryNameAr,
        countryNameEn: targetCountryNameEn,
        difficulty,
        points,
        imageUrl,
        audioUrl: '',
        placeNameAr,
        placeNameEn,
        status: normalizeCell(raw.status),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      };
    })
    .filter(Boolean);
}

function buildGuessFromHintQuestions(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  return dataRows
    .map((row, index) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      return {
        id: normalizeCell(raw.id) || String(index + 1),
        category: normalizeCell(raw.category),
        answer: normalizeCell(raw.answer),
        aliases: normalizeCell(raw.aliases),
        hint_1: normalizeCell(raw.hint_1),
        hint_2: normalizeCell(raw.hint_2),
        hint_3: normalizeCell(raw.hint_3),
        hint_4: normalizeCell(raw.hint_4),
        hint_5: normalizeCell(raw.hint_5),
        active: normalizeCell(raw.active),
      };
    })
    .filter((question) => question.answer);
}

function buildForbiddenWordsCards(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  const columns = {
    id: firstMatchedHeaderIndex(headerMap, ['id', 'card_id', 'term_id']),
    word: firstMatchedHeaderIndex(headerMap, ['word', 'term', 'الكلمة']),
    active: firstMatchedHeaderIndex(headerMap, ['active', 'is_active', 'enabled']),
    difficulty: firstMatchedHeaderIndex(headerMap, ['difficulty', 'level', 'الصعوبة']),
    points: firstMatchedHeaderIndex(headerMap, ['points', 'score', 'point', 'النقاط']),
    forbidden1: firstMatchedHeaderIndex(headerMap, ['forbidden_1', 'forbidden1', 'forbidden_1']),
    forbidden2: firstMatchedHeaderIndex(headerMap, ['forbidden_2', 'forbidden2', 'forbidden_2']),
    forbidden3: firstMatchedHeaderIndex(headerMap, ['forbidden_3', 'forbidden3', 'forbidden_3']),
    forbidden4: firstMatchedHeaderIndex(headerMap, ['forbidden_4', 'forbidden4', 'forbidden_4']),
    forbidden5: firstMatchedHeaderIndex(headerMap, ['forbidden_5', 'forbidden5', 'forbidden_5']),
  };

  if (
    columns.word === -1
    || columns.forbidden1 === -1
    || columns.forbidden2 === -1
    || columns.forbidden3 === -1
    || columns.forbidden4 === -1
    || columns.forbidden5 === -1
  ) {
    return [];
  }

  return dataRows
    .map((row) => row.map((value) => normalizeCell(value)))
    .filter((row) => row.some(Boolean))
    .filter((row) => {
      if (columns.active === -1) return true;
      return normalizeCell(row[columns.active]).toLowerCase() !== 'false';
    })
    .map((row) => {
      const difficultyRaw = toInteger(row[columns.difficulty]);
      const difficulty = difficultyRaw && difficultyRaw >= 1 && difficultyRaw <= 5 ? difficultyRaw : 1;
      const pointsRaw = toInteger(row[columns.points]);
      const points = pointsRaw && pointsRaw > 0 ? pointsRaw : difficulty;

      return {
        id: columns.id === -1 ? '' : normalizeCell(row[columns.id]),
        word: normalizeCell(row[columns.word]),
        difficulty,
        points,
        forbidden: [
          normalizeCell(row[columns.forbidden1]),
          normalizeCell(row[columns.forbidden2]),
          normalizeCell(row[columns.forbidden3]),
          normalizeCell(row[columns.forbidden4]),
          normalizeCell(row[columns.forbidden5]),
        ],
      };
    })
    .filter((card) => card.word && card.forbidden.every(Boolean));
}

function buildEmojiMoviesCards(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  return dataRows
    .map((row, index) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      const emoji = normalizeCell(raw.emoji);
      const answer = normalizeCell(raw.answer);
      if (!emoji || !answer) return null;

      const difficulty = toInteger(raw.difficulty);
      const parsedPoints = toInteger(raw.points);
      const points = parsedPoints && parsedPoints > 0
        ? parsedPoints
        : (difficulty && difficulty >= 1 && difficulty <= 5 ? difficulty * 100 : 100);
      const aliases = [raw.alias_1, raw.alias_2, raw.alias_3, raw.alias_4, raw.alias_5]
        .map(normalizeCell)
        .filter(Boolean);
      const hint = firstNonEmpty(raw.hint, raw['تلميح'], raw['تلميح_(hint)'], raw.hint_text, raw.clue);

      return {
        id: normalizeCell(raw.id) || `row-${index + 1}`,
        difficulty,
        emoji,
        answer,
        content_type: normalizeCell(raw.content_type),
        points,
        hint,
        aliases,
      };
    })
    .filter(Boolean);
}

function buildMazadQuestions(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);

  return dataRows
    .map((row, index) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      const category = normalizeCell(raw.category);
      const prompt = normalizeCell(raw.prompt);
      const acceptedAnswers = normalizeCell(raw.accepted_answers)
        .split('|')
        .map((item) => normalizeCell(item))
        .filter(Boolean);
      if (!isTruthyCell(raw.is_active)) return null;
      if (!category || !prompt || !acceptedAnswers.length) return null;

      const difficulty = toInteger(raw.difficulty);

      return {
        id: normalizeCell(raw.id) || `row-${index + 1}`,
        category,
        prompt,
        difficulty: Number.isFinite(difficulty) ? difficulty : null,
        accepted_answers: acceptedAnswers,
        notes: normalizeCell(raw.notes),
      };
    })
    .filter(Boolean);
}

function buildXoIntersectionBoards(rows) {
  const [headers, ...dataRows] = rows;
  const headerMap = headers.map(normalizeHeader);
  const requiredFields = [
    'board_id',
    'category_key',
    'category_name_ar',
    'mode_key',
    'mode_name_ar',
    'rule_text_ar',
    'column_1',
    'column_2',
    'column_3',
    'row_1',
    'row_2',
    'row_3',
  ];

  return dataRows
    .map((row) => {
      const raw = {};
      headerMap.forEach((key, columnIndex) => {
        raw[key] = normalizeCell(row[columnIndex]);
      });

      if (!isTruthyCell(raw.is_active)) return null;
      const hasAllRequiredFields = requiredFields.every((field) => normalizeCell(raw[field]));
      if (!hasAllRequiredFields) return null;

      return {
        board_id: normalizeCell(raw.board_id),
        category_key: normalizeCell(raw.category_key),
        category_name_ar: normalizeCell(raw.category_name_ar),
        mode_key: normalizeCell(raw.mode_key),
        mode_name_ar: normalizeCell(raw.mode_name_ar),
        rule_text_ar: normalizeCell(raw.rule_text_ar),
        column_1: normalizeCell(raw.column_1),
        column_2: normalizeCell(raw.column_2),
        column_3: normalizeCell(raw.column_3),
        row_1: normalizeCell(raw.row_1),
        row_2: normalizeCell(raw.row_2),
        row_3: normalizeCell(raw.row_3),
        is_active: normalizeCell(raw.is_active),
        sort_order: toInteger(raw.sort_order),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aSort = Number.isFinite(a.sort_order) ? a.sort_order : Number.POSITIVE_INFINITY;
      const bSort = Number.isFinite(b.sort_order) ? b.sort_order : Number.POSITIVE_INFINITY;
      return aSort - bSort;
    });
}

function sanitizeQuestion(question, allQuestions) {
  return {
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    points: question.points,
    question: question.question,
    type: question.type,
    image_url: question.image_url,
    hint: question.hint,
    choices: buildChoices(question, allQuestions),
  };
}

function buildChoices(question, allQuestions) {
  const directChoices = [question.choice_a, question.choice_b, question.choice_c, question.choice_d]
    .map(normalizeCell)
    .filter(Boolean);
  if (directChoices.length === 4) {
    return shuffle(directChoices);
  }

  const sameCategoryAnswers = allQuestions
    .filter((entry) => entry.category === question.category && entry.id !== question.id)
    .map((entry) => entry.answer);
  const allAnswers = allQuestions
    .filter((entry) => entry.id !== question.id)
    .map((entry) => entry.answer);
  const wrongChoices = uniqueByText([...sameCategoryAnswers, ...allAnswers])
    .filter((answer) => normalizeForComparison(answer) !== normalizeForComparison(question.answer));

  const choices = uniqueByText([question.answer, ...shuffle(wrongChoices).slice(0, 3)]);
  while (choices.length < 4) {
    choices.push(`خيار ${choices.length + 1}`);
  }
  return shuffle(choices.slice(0, 4));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(normalizeCell(value));
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(normalizeCell(value));
      value = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(normalizeCell(value));
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return normalizeCell(header).toLowerCase().replace(/\s+/g, '_');
}

function isApprovedV1Status(value) {
  return normalizeCell(value).toLowerCase() === 'approved_v1';
}

function normalizeMapCountryCode(value) {
  const code = normalizeCell(value).toUpperCase();
  if (code === 'UK') return 'GB';
  return code;
}

function resolveMapDifficultyAndPoints(rawDifficulty, rawPoints) {
  const normalizedDifficulty = normalizeCell(rawDifficulty).toLowerCase();
  const parsedPoints = toInteger(rawPoints);
  const parsedDifficultyNumber = toInteger(rawDifficulty);

  const difficultyFromPoints = (() => {
    if (parsedPoints === 100) return 'easy';
    if (parsedPoints === 300) return 'medium';
    if (parsedPoints === 500) return 'hard';
    return '';
  })();

  const difficultyFromNumericLevel = (() => {
    if (parsedDifficultyNumber === 1) return 'easy';
    if (parsedDifficultyNumber === 2) return 'medium';
    if (parsedDifficultyNumber === 3) return 'hard';
    return '';
  })();

  const difficulty = ['easy', 'medium', 'hard'].includes(normalizedDifficulty)
    ? normalizedDifficulty
    : (difficultyFromNumericLevel || difficultyFromPoints);

  const points = Number.isFinite(parsedPoints)
    ? parsedPoints
    : (difficulty === 'easy' ? 100 : difficulty === 'medium' ? 300 : difficulty === 'hard' ? 500 : null);

  return { difficulty, points };
}

function normalizeCell(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function normalizeForComparison(value) {
  return normalizeCell(value).toLowerCase();
}

function isTruthyCell(value) {
  return TRUTHY_VALUES.has(normalizeCell(value).toLowerCase());
}

function splitCsvParam(value) {
  return normalizeCell(value)
    .split(',')
    .map((item) => normalizeCell(item))
    .filter(Boolean);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeCell(value);
    if (normalized) return normalized;
  }
  return '';
}

function toInteger(value) {
  const parsed = Number.parseInt(String(value ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCacheTtl(env) {
  const ttl = toInteger(env.CACHE_TTL_SECONDS);
  return ttl && ttl > 0 ? ttl : DEFAULT_CACHE_TTL_SECONDS;
}

function uniqueByText(items) {
  const seen = new Set();
  return items.filter((item) => {
    const normalized = normalizeCell(item);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function buildIdDiagnostics(items, pickId, scope) {
  const diagnostics = {
    scope: normalizeCell(scope) || 'unknown',
    total_rows: Array.isArray(items) ? items.length : 0,
    missing_id_count: 0,
    duplicate_id_count: 0,
    duplicate_ids: [],
    warnings: [],
  };
  if (!Array.isArray(items) || typeof pickId !== 'function') {
    diagnostics.warnings.push('id_diagnostics_unavailable');
    return diagnostics;
  }

  const seen = new Set();
  const duplicates = new Set();
  items.forEach((item) => {
    const id = normalizeCell(pickId(item));
    if (!id) {
      diagnostics.missing_id_count += 1;
      return;
    }
    if (seen.has(id)) {
      diagnostics.duplicate_id_count += 1;
      duplicates.add(id);
      return;
    }
    seen.add(id);
  });
  diagnostics.duplicate_ids = Array.from(duplicates).slice(0, 20);
  if (diagnostics.missing_id_count > 0) diagnostics.warnings.push('missing_ids_detected');
  if (diagnostics.duplicate_id_count > 0) diagnostics.warnings.push('duplicate_ids_detected');
  return diagnostics;
}

function firstMatchedHeaderIndex(headers, aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
}

function shuffle(input) {
  const array = [...input];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function buildCorsHeaders(request, env) {
  const allowedOrigins = normalizeCell(env.ALLOWED_ORIGIN || '*');
  const allowedOriginList = splitCsvParam(allowedOrigins);
  const requestOrigin = request.headers.get('Origin');
  const allowOrigin = allowedOrigins === '*'
    ? '*'
    : allowedOriginList.includes(requestOrigin)
      ? requestOrigin
      : allowedOriginList[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(payload, status, request, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(request, env),
    },
  });
}

function error(message, code, status, request, env, extra = null) {
  return json({ error: message, code, ...(extra && typeof extra === 'object' ? extra : {}) }, status, request, env);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}
