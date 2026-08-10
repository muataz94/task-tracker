// ── Loading state flag — used by UI to show spinners
let isLoading = false;

// ── Core API function
// Apps Script quirk: must use 'text/plain' as Content-Type
// Using 'application/json' triggers a CORS preflight that Apps Script rejects
async function callAPI(action, params = {}, retryCount = 0, authRetryCount = 0) {
  if (!idToken) {
    const recovered = authRetryCount === 0 && typeof window.ensureFreshSession === 'function'
      ? await window.ensureFreshSession()
      : false;
    if (recovered) return callAPI(action, params, retryCount, authRetryCount + 1);
    const authError = new Error(typeof t === 'function' ? t('auth_session_expired') : 'Session expired.');
    authError.code = 'AUTH_EXPIRED';
    if (typeof handleSessionExpired === 'function') handleSessionExpired({ attemptRecovery: false });
    throw authError;
  }

  isLoading = true;
  const requestToken = idToken;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      // text/plain avoids CORS preflight — critical for Apps Script
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token: idToken, action, ...params })
    });

    if (!res.ok) {
      const httpError = new Error('Server error: ' + res.status);
      httpError.code = res.status === 401
        ? 'AUTH_EXPIRED'
        : res.status === 403 ? 'AUTH_FORBIDDEN' : 'HTTP_ERROR';
      throw httpError;
    }

    const data = await res.json();

    if (data.error === 'Unauthorized' || data.error === 'Not authenticated') {
      const authError = new Error(typeof t === 'function' ? t('auth_session_expired') : 'Session expired.');
      authError.code = 'AUTH_EXPIRED';
      throw authError;
    }

    if (data.error === 'Forbidden' || data.error === 'Not authorized') {
      const authError = new Error(typeof t === 'function' ? t('auth_forbidden') : 'You do not have permission to perform this action.');
      authError.code = 'AUTH_FORBIDDEN';
      throw authError;
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data;

  } catch (err) {
    if (err.code === 'AUTH_FORBIDDEN') throw err;
    if (err.code === 'AUTH_EXPIRED') {
      // A concurrent request may have completed the shared refresh while this
      // response was in flight. Reuse that newer token instead of prompting again.
      if (idToken && idToken !== requestToken && authRetryCount === 0) {
        return callAPI(action, params, retryCount, authRetryCount + 1);
      }
      idToken = null;
      const recovered = authRetryCount === 0 && typeof window.ensureFreshSession === 'function'
        ? await window.ensureFreshSession()
        : false;
      if (recovered) return callAPI(action, params, retryCount, authRetryCount + 1);
      if (typeof handleSessionExpired === 'function') handleSessionExpired({ attemptRecovery: false });
      throw err;
    }
    // Retry once on network failure before giving up
    if (retryCount === 0 && !err.code && err.message !== 'Not signed in. Please refresh and sign in again.') {
      console.warn('API call failed, retrying once...', err.message);
      return callAPI(action, params, 1, authRetryCount);
    }
    // Offline write: queue for later sync instead of just failing
    if (!navigator.onLine && typeof queueOfflineWrite === 'function' && queueOfflineWrite(action, params)) {
      throw new Error('You are offline — this change has been queued and will sync automatically when you reconnect.');
    }
    throw err;

  } finally {
    isLoading = false;
  }
}

// ── Get all rows from a sheet (cached, stale-while-revalidate)
async function getAll(sheet, forceRefresh = false) {
  if (forceRefresh) cacheClear(sheet);
  return cachedFetch(sheet, () => callAPI('getAll', { sheet }));
}

// ── Get aggregated dashboard data (cached)
async function getDashboard(forceRefresh = false) {
  if (forceRefresh) cacheClear('dashboard');
  return cachedFetch('dashboard', () => callAPI('getDashboard'));
}

// ── Add a new row (clears cache)
async function addRow(sheet, data) {
  const result = await callAPI('addRow', { sheet, data });
  cacheClear(sheet);
  cacheClear('dashboard');
  return result;
}

// ── Update an existing row by id (clears cache)
async function updateRow(sheet, id, data) {
  const result = await callAPI('updateRow', { sheet, id, data });
  cacheClear(sheet);
  cacheClear('dashboard');
  return result;
}

// ── Delete a row by id (clears cache)
async function deleteRow(sheet, id) {
  const result = await callAPI('deleteRow', { sheet, id });
  cacheClear(sheet);
  cacheClear('dashboard');
  return result;
}
