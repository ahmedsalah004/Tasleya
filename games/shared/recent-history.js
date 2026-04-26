(function () {
  const STORAGE_KEY = "tasleya_recent_history_v1";
  const DEFAULT_LIMIT = 200;

  function canUseLocalStorage() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      const testKey = "__tasleya_recent_history_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeToken(value) {
    return String(value || "").trim();
  }

  function normalizeScopePart(value) {
    return normalizeToken(value).toLowerCase().replace(/\s+/g, "_") || "all";
  }

  function readStore() {
    if (!canUseLocalStorage()) return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeStore(store) {
    if (!canUseLocalStorage()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  function sanitizeIdList(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    list.forEach((item) => {
      const id = normalizeToken(item);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(id);
    });
    return out;
  }

  function getRecentIds(scopeKey) {
    const key = normalizeToken(scopeKey);
    if (!key) return [];
    const store = readStore();
    return sanitizeIdList(store[key]);
  }

  function markRecentId(scopeKey, id, limit = DEFAULT_LIMIT) {
    const key = normalizeToken(scopeKey);
    const normalizedId = normalizeToken(id);
    const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
    if (!key || !normalizedId) return [];

    const store = readStore();
    const existing = sanitizeIdList(store[key]);
    const next = [normalizedId, ...existing.filter((entry) => entry !== normalizedId)].slice(0, cap);
    store[key] = next;
    writeStore(store);
    return next;
  }

  function clearRecentIds(scopeKey) {
    const key = normalizeToken(scopeKey);
    if (!key) return;
    const store = readStore();
    if (!Object.prototype.hasOwnProperty.call(store, key)) return;
    delete store[key];
    writeStore(store);
  }

  function buildScopeKey(gameName, details) {
    const gamePart = normalizeScopePart(gameName || "game");
    if (!details || typeof details !== "object") return `${gamePart}:all`;

    const segments = Object.keys(details)
      .sort()
      .map((key) => {
        const normalizedValue = normalizeScopePart(details[key]);
        return `${normalizeScopePart(key)}=${normalizedValue}`;
      })
      .filter(Boolean);

    return segments.length ? `${gamePart}:${segments.join("|")}` : `${gamePart}:all`;
  }

  window.TasleyaRecentHistory = {
    getRecentIds,
    markRecentId,
    clearRecentIds,
    buildScopeKey,
  };
})();
