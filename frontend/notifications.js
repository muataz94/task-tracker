// In-app notification center. Browser notification permission remains a
// separate concern in tables.js/dashboard.js.
const notificationState = {
  loading: false,
  error: null,
  items: [],
  unreadCount: 0,
  isOpen: false,
  lastLoadedAt: 0,
  requestId: 0,
};

let notificationCenterInitialized = false;
let notificationPollingTimer = null;
let notificationPreviousFocus = null;

function notificationText(key, replacements = {}) {
  let value = typeof t === 'function' ? t(key) : key;
  Object.entries(replacements).forEach(([name, replacement]) => {
    value = value.replace(`{${name}}`, String(replacement));
  });
  return value;
}

function getNotificationProfile() {
  try {
    return JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  } catch (error) {
    console.warn('[notifications] Stored profile could not be read:', error.message);
    return {};
  }
}

function getDerivedReadStorageKey() {
  const profile = getNotificationProfile();
  return `tt_notif_read_${profile.sub || 'current'}`;
}

function getDerivedReadIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(getDerivedReadStorageKey()) || '[]');
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch (error) {
    console.warn('[notifications] Read markers could not be restored:', error.message);
    return new Set();
  }
}

function saveDerivedReadIds(ids) {
  localStorage.setItem(getDerivedReadStorageKey(), JSON.stringify(Array.from(ids).slice(-500)));
}

function parseNotificationDate(value) {
  if (!value) return null;
  const raw = String(value);
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getNotificationDayDelta(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

function getDueText(dayDelta) {
  if (dayDelta === 0) return notificationText('notif_due_today');
  if (dayDelta > 0) return notificationText('notif_due_in_days', { count: dayDelta });
  return notificationText('notif_overdue_days', { count: Math.abs(dayDelta) });
}

function buildDerivedNotification(config) {
  const dueDate = parseNotificationDate(config.dueDate);
  const dayDelta = dueDate ? getNotificationDayDelta(dueDate) : null;
  return {
    id: `derived:${config.view}:${config.recordId}:${config.kind}:${config.dueDate || config.status || ''}`,
    source: 'derived',
    type: config.type,
    kind: config.kind,
    title: config.title,
    detail: config.detail,
    view: config.view,
    recordId: String(config.recordId || ''),
    dueDate,
    dayDelta,
    exactDate: dueDate || parseNotificationDate(config.createdAt),
    sortTime: dueDate ? dueDate.getTime() : parseNotificationDate(config.createdAt)?.getTime() || 0,
    read: false,
  };
}

function deriveActionableNotifications(sources) {
  const items = [];
  const terminalTasks = new Set(['done', 'completed', 'cancelled']);
  const terminalPOs = new Set(['received', 'cancelled', 'completed']);
  const terminalMilestones = new Set(['completed', 'done', 'cancelled']);

  (sources.tasks || []).forEach(task => {
    const dueDate = parseNotificationDate(task.due_date);
    if (!task.id || !dueDate || terminalTasks.has(String(task.status || '').toLowerCase())) return;
    const dayDelta = getNotificationDayDelta(dueDate);
    if (dayDelta > 3) return;
    const overdue = dayDelta < 0 || String(task.status || '').toLowerCase() === 'overdue';
    items.push(buildDerivedNotification({
      view: 'tasks', recordId: task.id, dueDate: task.due_date,
      type: overdue ? 'overdue' : 'due', kind: overdue ? 'notif_task_overdue' : 'notif_task_due_soon',
      title: task.title || task.id,
      detail: `${notificationText(overdue ? 'notif_task_overdue' : 'notif_task_due_soon')} · ${getDueText(dayDelta)}`,
    }));
  });

  (sources.pos || []).forEach(po => {
    const dueDate = parseNotificationDate(po.expected_delivery);
    if (!po.id || !dueDate || terminalPOs.has(String(po.status || '').toLowerCase())) return;
    const dayDelta = getNotificationDayDelta(dueDate);
    if (dayDelta > 7) return;
    const overdue = dayDelta < 0 || String(po.status || '').toLowerCase() === 'overdue';
    const label = po.po_number || po.supplier || po.id;
    items.push(buildDerivedNotification({
      view: 'pos', recordId: po.id, dueDate: po.expected_delivery,
      type: overdue ? 'overdue' : 'due', kind: overdue ? 'notif_po_overdue' : 'notif_po_due_soon',
      title: label,
      detail: `${notificationText(overdue ? 'notif_po_overdue' : 'notif_po_due_soon')} · ${getDueText(dayDelta)}`,
    }));
  });

  (sources.milestones || []).forEach(milestone => {
    const dueDate = parseNotificationDate(milestone.target_date);
    if (!milestone.id || !dueDate || terminalMilestones.has(String(milestone.status || '').toLowerCase())) return;
    const dayDelta = getNotificationDayDelta(dueDate);
    if (dayDelta < 0 || dayDelta > 7) return;
    items.push(buildDerivedNotification({
      view: 'milestones', recordId: milestone.id, dueDate: milestone.target_date,
      type: 'due', kind: 'notif_milestone_due_soon', title: milestone.name || milestone.title || milestone.id,
      detail: `${notificationText('notif_milestone_due_soon')} · ${getDueText(dayDelta)}`,
    }));
  });

  const waitingStatuses = new Set(['pending', 'submitted', 'awaiting approval', 'awaiting_approval', 'in review', 'in_review']);
  (sources.prs || []).forEach(pr => {
    const status = String(pr.status || '').toLowerCase().trim();
    if (!pr.id || !waitingStatuses.has(status)) return;
    items.push(buildDerivedNotification({
      view: 'purchasereqs', recordId: pr.id, status, type: 'approval', kind: 'notif_pr_waiting',
      title: pr.pr_number || pr.description || pr.id,
      detail: notificationText('notif_pr_waiting'), createdAt: pr.created_at,
    }));
  });

  const readIds = getDerivedReadIds();
  items.forEach(item => { item.read = readIds.has(item.id); });
  return items;
}

function normalizeServerNotification(row) {
  const id = String(row.id || '');
  const isBroadcast = String(row.user_email || '').toLowerCase() === 'all';
  const createdAt = parseNotificationDate(row.created_at);
  const link = String(row.link || '');
  const linkValue = link.replace(/^#\/?/, '');
  const [rawView, query = ''] = linkValue.split('?');
  const viewAliases = {
    'purchase-orders': 'pos',
    'purchase-requests': 'purchasereqs',
  };
  const view = viewAliases[rawView] || rawView;
  const queryParams = new URLSearchParams(query);
  return {
    id,
    source: isBroadcast ? 'server-broadcast' : 'server',
    type: String(row.type || 'info'),
    title: String(row.title || notificationText('notifications')),
    detail: String(row.message || ''),
    view,
    recordId: String(row.record_id || queryParams.get('record') || ''),
    exactDate: createdAt,
    sortTime: createdAt?.getTime() || 0,
    read: isBroadcast ? getDerivedReadIds().has(id) : String(row.read).toLowerCase() === 'true',
  };
}

function mergeNotificationItems(serverRows, derivedRows) {
  const byId = new Map();
  [...serverRows.map(normalizeServerNotification), ...derivedRows].forEach(item => {
    if (item.id && !byId.has(item.id)) byId.set(item.id, item);
  });
  return Array.from(byId.values())
    .sort((a, b) => Number(a.read) - Number(b.read) || a.sortTime - b.sortTime)
    .slice(0, 50);
}

async function loadNotifications(options = {}) {
  if (!idToken) return;
  if (!options.force && notificationState.lastLoadedAt && Date.now() - notificationState.lastLoadedAt < 60000) {
    renderNotificationCenter();
    return;
  }

  const requestId = ++notificationState.requestId;
  notificationState.loading = true;
  notificationState.error = null;
  renderNotificationCenter();

  const profile = getNotificationProfile();
  const results = await Promise.allSettled([
    cachedFetch('Notifications', () => callAPI('getNotifications', { email: profile.email || '' })),
    getDashboard(),
    getAll('POs'),
    cachedFetch('PurchaseRequests', () => callAPI('getPRs')),
  ]);
  if (requestId !== notificationState.requestId) return;

  const successful = results.filter(result => result.status === 'fulfilled');
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`[notifications] Source ${index + 1} failed:`, result.reason?.message || result.reason);
    }
  });

  if (!successful.length) {
    notificationState.loading = false;
    notificationState.error = new Error(notificationText('notif_load_failed'));
    renderNotificationCenter();
    return;
  }

  const serverRows = results[0].status === 'fulfilled' ? results[0].value?.rows || [] : [];
  const dashboard = results[1].status === 'fulfilled' ? results[1].value || {} : {};
  const pos = results[2].status === 'fulfilled' ? results[2].value?.rows || [] : [];
  const prs = results[3].status === 'fulfilled' ? results[3].value?.rows || [] : [];
  const derived = deriveActionableNotifications({
    tasks: dashboard.tasks || [],
    milestones: dashboard.milestones || [],
    pos,
    prs,
  });

  notificationState.items = mergeNotificationItems(serverRows, derived);
  notificationState.loading = false;
  notificationState.error = null;
  notificationState.lastLoadedAt = Date.now();
  renderNotifBadge();
  renderNotificationCenter();
}

function renderNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const bell = document.getElementById('notif-bell-btn');
  const unread = Math.max(0, notificationState.items.filter(item => !item.read).length);
  notificationState.unreadCount = unread;
  if (badge) {
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
  if (bell) {
    bell.setAttribute('aria-label', unread
      ? notificationText('notif_unread_count', { count: unread })
      : notificationText('notifications'));
  }
}

function buildNotifPanel() {
  if (document.getElementById('notif-panel')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'notif-backdrop';
  backdrop.hidden = true;
  backdrop.addEventListener('click', closeNotifPanel);

  const panel = document.createElement('section');
  panel.id = 'notif-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'notif-panel-title');
  panel.setAttribute('aria-modal', 'false');
  panel.hidden = true;
  panel.innerHTML = `
    <div class="notif-panel-handle" aria-hidden="true"></div>
    <header class="notif-panel-header">
      <div>
        <h2 id="notif-panel-title"></h2>
        <p id="notif-panel-count" aria-live="polite"></p>
      </div>
      <div class="notif-panel-actions">
        <button type="button" id="notif-mark-all"></button>
        <button type="button" id="notif-close-btn" class="notif-close-btn" aria-label="">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </div>
    </header>
    <div id="notif-list" class="notif-list" aria-live="polite"></div>`;

  panel.querySelector('#notif-mark-all').addEventListener('click', markAllNotifsReadUI);
  panel.querySelector('#notif-close-btn').addEventListener('click', closeNotifPanel);
  panel.addEventListener('keydown', handleNotificationPanelKeydown);
  document.body.append(backdrop, panel);
}

function renderNotificationIcon(type) {
  const icon = document.createElement('span');
  icon.className = `notif-item-icon notif-item-icon-${type}`;
  icon.setAttribute('aria-hidden', 'true');
  const paths = {
    overdue: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    due: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    approval: '<path d="M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Z"/><path d="m9 13 2 2 4-5"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  };
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${paths[type] || paths.info}</svg>`;
  return icon;
}

function renderNotificationItem(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `notif-item${item.read ? '' : ' unread'}`;
  button.dataset.notificationId = item.id;
  button.addEventListener('click', () => handleNotifClick(item.id));

  const content = document.createElement('span');
  content.className = 'notif-item-content';
  const title = document.createElement('span');
  title.className = 'notif-item-title';
  title.textContent = item.title;
  const detail = document.createElement('span');
  detail.className = 'notif-item-detail';
  detail.textContent = item.detail;
  content.append(title, detail);

  if (item.exactDate) {
    const time = document.createElement('time');
    time.className = 'notif-item-time';
    time.dateTime = item.exactDate.toISOString();
    time.title = item.exactDate.toLocaleString(document.documentElement.lang || undefined);
    time.textContent = item.dayDelta == null
      ? item.exactDate.toLocaleDateString(document.documentElement.lang || undefined, { month: 'short', day: 'numeric' })
      : getDueText(item.dayDelta);
    content.append(time);
  }

  button.append(renderNotificationIcon(item.type), content);
  if (!item.read) {
    const unreadDot = document.createElement('span');
    unreadDot.className = 'notif-unread-dot';
    unreadDot.setAttribute('aria-label', notificationText('notif_unread'));
    button.append(unreadDot);
  }
  return button;
}

function renderNotificationCenter() {
  const panel = document.getElementById('notif-panel');
  const list = document.getElementById('notif-list');
  if (!panel || !list) return;

  panel.querySelector('#notif-panel-title').textContent = notificationText('notifications');
  panel.querySelector('#notif-panel-count').textContent = notificationState.unreadCount
    ? notificationText('notif_unread_count', { count: notificationState.unreadCount })
    : notificationText('notif_all_read');
  panel.querySelector('#notif-mark-all').textContent = notificationText('mark_all_read');
  panel.querySelector('#notif-mark-all').hidden = notificationState.unreadCount === 0;
  panel.querySelector('#notif-close-btn').setAttribute('aria-label', notificationText('notif_close'));
  list.replaceChildren();

  if (notificationState.loading && !notificationState.items.length) {
    const loading = document.createElement('div');
    loading.className = 'notif-state notif-loading-state';
    loading.setAttribute('role', 'status');
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = notificationText('notif_loading');
    loading.append(label);
    for (let index = 0; index < 3; index += 1) {
      const skeleton = document.createElement('span');
      skeleton.className = 'notif-skeleton';
      loading.append(skeleton);
    }
    list.append(loading);
    return;
  }

  if (notificationState.error && !notificationState.items.length) {
    const errorState = document.createElement('div');
    errorState.className = 'notif-state';
    const heading = document.createElement('strong');
    heading.textContent = notificationText('notif_load_failed');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'notif-retry-btn';
    retry.textContent = notificationText('notif_retry');
    retry.addEventListener('click', () => loadNotifications({ force: true }));
    errorState.append(renderNotificationIcon('info'), heading, retry);
    list.append(errorState);
    return;
  }

  if (!notificationState.items.length) {
    const empty = document.createElement('div');
    empty.className = 'notif-state';
    const heading = document.createElement('strong');
    heading.textContent = notificationText('notif_all_caught_up');
    const detail = document.createElement('span');
    detail.textContent = notificationText('notif_all_caught_up_body');
    empty.append(renderNotificationIcon('success'), heading, detail);
    list.append(empty);
    return;
  }

  notificationState.items.forEach(item => list.append(renderNotificationItem(item)));
}

async function toggleNotifPanel() {
  if (notificationState.isOpen) {
    closeNotifPanel();
    return;
  }
  buildNotifPanel();
  const panel = document.getElementById('notif-panel');
  const backdrop = document.getElementById('notif-backdrop');
  const bell = document.getElementById('notif-bell-btn');
  notificationState.isOpen = true;
  notificationPreviousFocus = document.activeElement;
  panel.hidden = false;
  backdrop.hidden = false;
  panel.classList.add('open');
  document.body.classList.add('notif-panel-open');
  panel.setAttribute('aria-modal', window.matchMedia('(max-width: 768px)').matches ? 'true' : 'false');
  bell?.setAttribute('aria-expanded', 'true');
  renderNotificationCenter();
  panel.querySelector('#notif-close-btn')?.focus();
  await loadNotifications();
}

function closeNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const backdrop = document.getElementById('notif-backdrop');
  notificationState.isOpen = false;
  panel?.classList.remove('open');
  if (panel) panel.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove('notif-panel-open');
  document.getElementById('notif-bell-btn')?.setAttribute('aria-expanded', 'false');
  if (notificationPreviousFocus instanceof HTMLElement) notificationPreviousFocus.focus();
  notificationPreviousFocus = null;
}

function handleNotificationPanelKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeNotifPanel();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(event.currentTarget.querySelectorAll('button:not([hidden]):not(:disabled)'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function handleNotifClick(id) {
  const item = notificationState.items.find(candidate => candidate.id === id);
  if (!item) return;

  if (item.source === 'server') {
    callAPI('markNotifRead', { id: item.id }).catch(error => {
      console.warn('[notifications] Could not mark notification as read:', error.message);
    });
  } else {
    const readIds = getDerivedReadIds();
    readIds.add(item.id);
    saveDerivedReadIds(readIds);
  }
  item.read = true;
  renderNotifBadge();
  renderNotificationCenter();
  closeNotifPanel();

  if (item.view && typeof navigateTo === 'function') {
    navigateTo(item.view);
    if (item.recordId && typeof focusNavigationRecord === 'function') focusNavigationRecord(item.recordId);
  }
}

async function markAllNotifsReadUI() {
  const unreadServerItems = notificationState.items.filter(item => !item.read && item.source === 'server');
  const derivedIds = getDerivedReadIds();
  notificationState.items.filter(item => item.source !== 'server').forEach(item => derivedIds.add(item.id));
  saveDerivedReadIds(derivedIds);

  if (unreadServerItems.length) {
    const profile = getNotificationProfile();
    try {
      await callAPI('markAllNotifsRead', { email: profile.email || '' });
    } catch (error) {
      console.warn('[notifications] Mark-all request failed:', error.message);
      if (typeof showToast === 'function') showToast(notificationText('notif_mark_failed'), 'error');
      return;
    }
  }

  notificationState.items.forEach(item => { item.read = true; });
  renderNotifBadge();
  renderNotificationCenter();
  if (typeof showToast === 'function') showToast(notificationText('notif_marked_read'), 'success');
}

function startNotificationPolling() {
  if (notificationPollingTimer) return;
  notificationPollingTimer = window.setInterval(() => loadNotifications({ force: true }), 5 * 60 * 1000);
}

function stopNotificationPolling() {
  if (notificationPollingTimer) window.clearInterval(notificationPollingTimer);
  notificationPollingTimer = null;
  notificationState.requestId += 1;
}

function initNotificationCenter() {
  if (notificationCenterInitialized) return;
  const bell = document.getElementById('notif-bell-btn');
  if (!bell) return;
  notificationCenterInitialized = true;
  buildNotifPanel();
  bell.addEventListener('click', toggleNotifPanel);
  renderNotifBadge();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationCenter, { once: true });
} else {
  initNotificationCenter();
}

// Global search remains colocated with the topbar utilities.
let _searchDebounce;
async function handleGlobalSearch(query) {
  clearTimeout(_searchDebounce);
  if (!query || query.length < 2) { closeSearchResults(); return; }
  _searchDebounce = setTimeout(async () => {
    try {
      const res = await callAPI('globalSearch', { query });
      showSearchResults(res.results || [], query);
    } catch (error) {
      console.warn('[search] Global search failed:', error.message);
    }
  }, 300);
}

function showSearchResults(results, query) {
  let panel = document.getElementById('global-search-results');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'global-search-results';
    document.body.appendChild(panel);
  }
  const tabIcon = { Tasks: '✓', POs: 'PO', Invoices: 'INV', PurchaseRequests: 'PR', Vendors: 'V', Comparisons: 'Q', Milestones: 'M', Expenses: 'E' };
  const viewMap = { Tasks: 'tasks', POs: 'pos', Invoices: 'invoices', PurchaseRequests: 'purchasereqs', Vendors: 'vendors', Comparisons: 'quotations', Milestones: 'milestones', Expenses: 'expenses' };
  panel.replaceChildren();
  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'global-search-empty';
    empty.textContent = notificationText('search_no_results', { query });
    panel.append(empty);
  } else {
    results.forEach(result => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'global-search-result';
      const icon = document.createElement('span');
      icon.textContent = tabIcon[result.sheet] || '•';
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = result.title || '—';
      const sheet = document.createElement('small');
      sheet.textContent = result.sheet || '';
      copy.append(title, sheet);
      button.append(icon, copy);
      button.addEventListener('click', () => {
        navigateTo(viewMap[result.sheet] || 'dashboard');
        closeSearchResults();
      });
      panel.append(button);
    });
  }
  panel.style.display = 'block';
}

function closeSearchResults() {
  const panel = document.getElementById('global-search-results');
  if (panel) panel.style.display = 'none';
}
