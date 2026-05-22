// ── Loading state flag — used by UI to show spinners
let isLoading = false;

// ── Core API function
// Apps Script quirk: must use 'text/plain' as Content-Type
// Using 'application/json' triggers a CORS preflight that Apps Script rejects
async function callAPI(action, params = {}, retryCount = 0) {
  if (!idToken) {
    throw new Error('Not signed in. Please refresh and sign in again.');
  }

  isLoading = true;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      // text/plain avoids CORS preflight — critical for Apps Script
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token: idToken, action, ...params })
    });

    if (!res.ok) {
      throw new Error('Server error: ' + res.status);
    }

    const data = await res.json();

    if (data.error === 'Unauthorized' || data.error === 'Not authenticated') {
      idToken = null;
      document.getElementById('app')?.classList.add('hidden');
      document.getElementById('login-screen')?.classList.remove('hidden');
      throw new Error('Session expired. Please sign in again.');
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data;

  } catch (err) {
    // Retry once on network failure before giving up
    if (retryCount === 0 && err.message !== 'Not signed in. Please refresh and sign in again.') {
      console.warn('API call failed, retrying once...', err.message);
      return callAPI(action, params, 1);
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
