// ─── Offline mode: banner + write queue (honest scope — see plan notes) ──────
// Realistic ceiling for an Apps Script backend: no true offline writes, no
// real push. This gives: (1) a visible offline indicator, (2) a queue for
// write actions attempted while offline, replayed manually via "Sync Now".

const OFFLINE_QUEUE_KEY = 'tt_offline_queue';
const OFFLINE_WRITE_ACTIONS = new Set([
  'addRow','updateRow','deleteRow',
  'saveInvoice','updateInvoice','deleteInvoice',
  'saveVendor','updateVendor','deleteVendor',
  'savePR','updatePR','deletePR','savePRLineItems','updatePRLineQty',
  'saveComparison','updateComparison','deleteComparison',
  'saveBudget','updateBudget','deleteBudget',
  'markNotifRead','markAllNotifsRead','createNotif','logAudit',
]);

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
  catch(e) { return []; }
}

function setOfflineQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  renderOfflineBanner();
}

function queueOfflineWrite(action, params) {
  if (!OFFLINE_WRITE_ACTIONS.has(action)) return false;
  const queue = getOfflineQueue();
  queue.push({ action, params, queued_at: new Date().toISOString() });
  setOfflineQueue(queue);
  return true;
}

async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  if (!queue.length) return;
  const btn = document.getElementById('offline-sync-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }

  const remaining = [];
  let synced = 0;
  for (const item of queue) {
    try {
      await callAPI(item.action, item.params);
      synced++;
    } catch(e) {
      remaining.push(item);
    }
  }
  setOfflineQueue(remaining);
  if (typeof showToast === 'function') {
    showToast(remaining.length
      ? `Synced ${synced} change(s), ${remaining.length} still pending`
      : `All ${synced} queued change(s) synced ✓`, remaining.length ? 'error' : 'success');
  }
}

// ── Banner UI ──────────────────────────────────────────────────────────────
function buildOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.innerHTML = `
    <span id="offline-banner-text"></span>
    <button id="offline-sync-btn" onclick="syncOfflineQueue()" style="display:none;">Sync Now</button>`;
  document.body.appendChild(banner);
}

function renderOfflineBanner() {
  buildOfflineBanner();
  const banner = document.getElementById('offline-banner');
  const text   = document.getElementById('offline-banner-text');
  const btn    = document.getElementById('offline-sync-btn');
  if (!banner || !text || !btn) return;

  const queue = getOfflineQueue();
  const offline = !navigator.onLine;

  if (offline) {
    banner.style.display = 'flex';
    text.textContent = "You're offline — showing cached data.";
    btn.style.display = 'none';
  } else if (queue.length) {
    banner.style.display = 'flex';
    text.textContent = `${queue.length} change(s) pending sync.`;
    btn.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Sync Now';
  } else {
    banner.style.display = 'none';
  }
}

window.addEventListener('online', renderOfflineBanner);
window.addEventListener('offline', renderOfflineBanner);
document.addEventListener('DOMContentLoaded', renderOfflineBanner);

// Register the app-shell service worker (caches static files only — no data)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=8').catch(() => {});
  });
}
