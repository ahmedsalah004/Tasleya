const DEFAULT_CACHE_TTL_SECONDS = 300;
const sheetMemoryCache = new Map();

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
        if (!available.length) {
          return error('تم استهلاك جميع الأسئلة المطابقة لهذه الخانة.', 'QUESTION_POOL_EXHAUSTED', 404, request, env);
        }

        const chosen = available[Math.floor(Math.random() * available.length)];
        return json({ question: sanitizeQuestion(chosen, bank.questions) }, 200, request, env);
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
        return json({ films }, 200, request, env);
      }

      if (url.pathname === '/map-game/questions' && request.method === 'GET') {
        const rows = await getSheetRows(request, env, ctx, {
          envVarName: 'MAP_GAME_SHEET_CSV_URL',
          cacheKeyPrefix: 'map-game-questions',
        });
        const questions = buildMapGameQuestions(rows);
        return json({ questions }, 200, request, env);
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
        countryCode,
        countryNameAr,
        countryNameEn,
        difficulty,
        points,
        lat,
        lng,
      };
    })
    .filter(Boolean);
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

function normalizeCell(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function normalizeForComparison(value) {
  return normalizeCell(value).toLowerCase();
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
  const requestOrigin = request.headers.get('Origin');
  const allowOrigin = allowedOrigins === '*'
    ? '*'
    : splitCsvParam(allowedOrigins).includes(requestOrigin)
      ? requestOrigin
      : splitCsvParam(allowedOrigins)[0] || '*';

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

function error(message, code, status, request, env) {
  return json({ error: message, code }, status, request, env);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}
