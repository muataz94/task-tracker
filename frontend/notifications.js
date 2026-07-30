// ── Notification Center ─────────────────────────────────────────────
let _notifications = [];
let _notifOpen = false;

async function loadNotifications() {
  try {
    const user = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
    const res  = await callAPI('getNotifications', { email: user.email || '' });
    _notifications = res.rows || [];
    renderNotifBadge();
    if (_notifOpen) renderNotifPanel();
  } catch(e) {}
}

function renderNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const unread = _notifications.filter(n => n.read !== 'true').length;
  if (!badge) return;
  badge.textContent = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';
}

function toggleNotifPanel() {
  _notifOpen = !_notifOpen;
  let panel = document.getElementById('notif-panel');
  if (!panel) { buildNotifPanel(); return; }
  panel.style.display = _notifOpen ? 'block' : 'none';
  if (_notifOpen) { renderNotifPanel(); loadNotifications(); }
}

function buildNotifPanel() {
  document.getElementById('notif-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;font-weight:700;color:var(--text-1);">${typeof t==='function'?t('notifications'):'Notifications'}</span>
      <button onclick="markAllNotifsReadUI()" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-family:Inter,sans-serif;">${typeof t==='function'?t('mark_all_read'):'Mark all read'}</button>
    </div>
    <div id="notif-list" style="max-height:380px;overflow-y:auto;"></div>`;
  document.body.appendChild(panel);
  renderNotifPanel();
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== 'notif-bell-btn' && !e.target.closest('#notif-bell-btn')) {
        panel.style.display = 'none'; _notifOpen = false;
        document.removeEventListener('click', handler);
      }
    });
  }, 100);
}

function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!_notifications.length) {
    list.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-3);font-size:13px;">${typeof t==='function'?t('no_notifications'):'No notifications'}</div>`;
    return;
  }
  const typeIcon = { overdue:'🔴', approval:'🔵', budget:'🟡', contract:'🟠', info:'ℹ️', success:'✅' };
  list.innerHTML = _notifications.slice(0,20).map(n => `
    <div onclick="handleNotifClick('${n.id}','${escapeHtml(n.link||'')}')" style="padding:10px 14px;
      border-bottom:1px solid var(--border);cursor:pointer;
      background:${n.read==='true'?'transparent':'rgba(167,139,250,0.05)'};">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="font-size:16px;flex-shrink:0;">${typeIcon[n.type]||'🔔'}</span>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:${n.read==='true'?'400':'600'};color:var(--text-1);">${escapeHtml(n.title||'')}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${escapeHtml(n.message||'')}</div>
        </div>
        ${n.read!=='true'?'<div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></div>':''}
      </div>
    </div>`).join('');
}

async function handleNotifClick(id, link) {
  await callAPI('markNotifRead', { id }).catch(()=>{});
  const n = _notifications.find(x => x.id === id);
  if (n) n.read = 'true';
  renderNotifBadge(); renderNotifPanel();
  if (link && link.startsWith('#')) navigateTo(link.replace('#',''));
}

async function markAllNotifsReadUI() {
  const user = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  await callAPI('markAllNotifsRead', { email: user.email||'' }).catch(()=>{});
  _notifications.forEach(n => n.read='true');
  renderNotifBadge(); renderNotifPanel();
  showToast('All notifications marked as read', 'success');
}

setInterval(loadNotifications, 5 * 60 * 1000);

// ── Global Search ────────────────────────────────────────────────────
let _searchDebounce;
async function handleGlobalSearch(query) {
  clearTimeout(_searchDebounce);
  if (!query || query.length < 2) { closeSearchResults(); return; }
  _searchDebounce = setTimeout(async () => {
    try {
      const res = await callAPI('globalSearch', { query });
      showSearchResults(res.results || [], query);
    } catch(e) {}
  }, 300);
}

function showSearchResults(results, query) {
  let panel = document.getElementById('global-search-results');
  if (!panel) { panel = document.createElement('div'); panel.id = 'global-search-results'; document.body.appendChild(panel); }
  const tabIcon = {Tasks:'✓',POs:'📋',Invoices:'🧾',PurchaseRequests:'📝',Vendors:'🏢',Comparisons:'⚖️',Milestones:'🚩',Expenses:'💰'};
  const viewMap = {Tasks:'tasks',POs:'pos',Invoices:'invoices',PurchaseRequests:'purchasereqs',Vendors:'vendors',Comparisons:'quotations',Milestones:'milestones',Expenses:'expenses'};
  panel.innerHTML = !results.length
    ? `<div style="padding:1rem;color:var(--text-3);font-size:13px;text-align:center;">No results for "${escapeHtml(query)}"</div>`
    : results.map(r => `
      <div onclick="navigateTo('${viewMap[r.sheet]||'dashboard'}');closeSearchResults()"
        style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;border-bottom:1px solid var(--border);">
        <span style="font-size:16px;">${tabIcon[r.sheet]||'📄'}</span>
        <div><div style="font-size:12px;font-weight:600;color:var(--text-1);">${escapeHtml(r.title||'—')}</div>
        <div style="font-size:10px;color:var(--text-3);">${r.sheet}</div></div>
      </div>`).join('');
  panel.style.display = 'block';
}

function closeSearchResults() {
  const p = document.getElementById('global-search-results');
  if (p) p.style.display = 'none';
}
