const memoryCache = new Map();

export function getCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return item.value;
}

export function setCache(key, value, ttlMs = 10 * 60 * 1000) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function roundedCoordKey(lat, lon, precision = 2) {
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
}
