const cacheStore = new Map();

const now = () => Date.now();

const normalizeTtl = (ttlMs) => {
  const value = Number(ttlMs);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
};

const buildCacheKey = (...parts) =>
  parts
    .flat()
    .map((part) =>
      typeof part === "string" ? part : JSON.stringify(part ?? null)
    )
    .join(":");

const getCachedValue = (key) => {
  const entry = cacheStore.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= now()) {
    cacheStore.delete(key);
    return undefined;
  }

  return entry.value;
};

const setCachedValue = (key, value, ttlMs) => {
  const normalizedTtl = normalizeTtl(ttlMs);

  if (!normalizedTtl) {
    return value;
  }

  cacheStore.set(key, {
    value,
    expiresAt: now() + normalizedTtl,
  });

  return value;
};

const remember = async (key, ttlMs, factory) => {
  const cachedValue = getCachedValue(key);

  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const nextValue = await factory();
  return setCachedValue(key, nextValue, ttlMs);
};

const invalidateCacheByPrefix = (prefix) => {
  if (!prefix) {
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};

const clearCache = () => {
  cacheStore.clear();
};

module.exports = {
  buildCacheKey,
  clearCache,
  getCachedValue,
  invalidateCacheByPrefix,
  remember,
  setCachedValue,
};
