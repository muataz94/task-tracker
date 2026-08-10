// Stale-while-revalidate cache for Apps Script data
const CACHE_TTL = new Map([
  ['Tasks',               30 * 1000],
  ['POs',                 60 * 1000],
  ['Milestones',          60 * 1000],
  ['Expenses',            60 * 1000],
  ['Users',              300 * 1000],
  ['dashboard',           30 * 1000],
  ['Chat',                 5 * 1000],
  ['Comparisons',        120 * 1000],
  ['ComparisonVendors',  120 * 1000],
  ['Invoices',            60 * 1000],
  ['Vendors',            120 * 1000],
  ['PurchaseRequests',    60 * 1000],
  ['PRLineItems',         60 * 1000],
  ['Notifications',      15 * 1000]
]);

const _cache = new Map();
const _inflight = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  const ttl = CACHE_TTL.get(key) || 30000;
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
      if (!_inflight.has(key)) {
        const refresh = Promise.resolve()
          .then(fetchFn)
          .then(fresh => {
            cacheSet(key, fresh);
            if (onUpdate) onUpdate(fresh);
            return fresh;
          })
          .finally(() => _inflight.delete(key));
        _inflight.set(key, refresh);
        refresh.catch(() => {});
      }
    }
    return cached.data;
  }
  if (_inflight.has(key)) return _inflight.get(key);
  const request = Promise.resolve()
    .then(fetchFn)
    .then(data => {
      cacheSet(key, data);
      return data;
    })
    .finally(() => _inflight.delete(key));
  _inflight.set(key, request);
  return request;
}

// Warm only shared critical data after the current view has started rendering.
// getDashboard returns tasks/milestones/expenses rows so we can warm those caches too
function prefetchAll() {
  getDashboard().then(d => {
    cacheSet('dashboard', d);
    if (d.tasks)      cacheSet('Tasks',      { rows: d.tasks });
    if (d.milestones) cacheSet('Milestones', { rows: d.milestones });
    if (d.expenses)   cacheSet('Expenses',   { rows: d.expenses });
  }).catch(() => {});
  getAll('POs').catch(() => {});
}
