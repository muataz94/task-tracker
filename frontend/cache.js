// Stale-while-revalidate cache for Apps Script data
const CACHE_TTL = {
  Tasks:               30 * 1000,
  POs:                 60 * 1000,
  Milestones:          60 * 1000,
  Expenses:            60 * 1000,
  Users:              300 * 1000,
  dashboard:           30 * 1000,
  Chat:                 5 * 1000,
  Comparisons:        120 * 1000,
  ComparisonVendors:  120 * 1000,
};

const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  const ttl = CACHE_TTL[key] || 30000;
  if (age > ttl * 3) { _cache.delete(key); return null; }
  return { data: entry.data, stale: age > ttl };
}

function cacheSet(key, data) {
  _cache.set(key, { data, timestamp: Date.now() });
}

function cacheClear(key) {
  if (key) _cache.delete(key);
  else _cache.clear();
}

// Stale-while-revalidate: return cached data immediately, refresh in background
async function cachedFetch(key, fetchFn, onUpdate) {
  const cached = cacheGet(key);
  if (cached) {
    if (cached.stale) {
      fetchFn().then(fresh => {
        cacheSet(key, fresh);
        if (onUpdate) onUpdate(fresh);
      }).catch(() => {});
    }
    return cached.data;
  }
  const data = await fetchFn();
  cacheSet(key, data);
  return data;
}

// Warm the cache after sign-in — 2 calls instead of 5
// getDashboard returns tasks/milestones/expenses rows so we can warm those caches too
function prefetchAll() {
  callAPI('getDashboard').then(d => {
    cacheSet('dashboard', d);
    if (d.tasks)      cacheSet('Tasks',      { rows: d.tasks });
    if (d.milestones) cacheSet('Milestones', { rows: d.milestones });
    if (d.expenses)   cacheSet('Expenses',   { rows: d.expenses });
  }).catch(() => {});
  callAPI('getAll', { sheet: 'POs' }).then(d => cacheSet('POs', d)).catch(() => {});
  
  // Prefetch quotation comparisons and vendors in parallel for instant data load
  callAPI('getAll', { sheet: 'Comparisons' }).then(d => cacheSet('Comparisons', d)).catch(() => {});
  callAPI('getAll', { sheet: 'ComparisonVendors' }).then(d => cacheSet('ComparisonVendors', d)).catch(() => {});
}
