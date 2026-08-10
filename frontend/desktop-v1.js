/* Desktop V1 UI orchestration. Business data and mutations remain owned by the existing modules. */
const DESKTOP_V1_BREAKPOINT = 768;
const DESKTOP_V1_COLLAPSE_KEY = 'tt_desktop_sidebar_collapsed';
let desktopV1IntegrationFilter = 'all';
let desktopV1UpdateTimer = 0;

function desktopV1T(key) {
  return typeof t === 'function' ? t(key) : key;
}

function desktopV1Icon(name, size = 20) {
  return typeof window.taskTrackerIcon === 'function'
    ? window.taskTrackerIcon(name, { size })
    : '';
}

function desktopV1Data(sheet) {
  return typeof tableData !== 'undefined' && Array.isArray(tableData[sheet]) ? tableData[sheet] : [];
}

function desktopV1Normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function desktopV1IsOverdue(row) {
  const status = desktopV1Normalize(row.status || row.delivery_status);
  if (['done', 'completed', 'closed', 'received', 'cancelled'].includes(status)) return false;
  const rawDate = row.due_date || row.required_by || row.delivery_date || row.target_date;
  if (!rawDate) return status === 'overdue';
  const due = new Date(rawDate);
  if (Number.isNaN(due.getTime())) return status === 'overdue';
  due.setHours(23, 59, 59, 999);
  return status === 'overdue' || due < new Date();
}

function desktopV1Count(rows, statuses) {
  const accepted = new Set(statuses.map(desktopV1Normalize));
  return rows.filter(row => accepted.has(desktopV1Normalize(row.status || row.delivery_status))).length;
}

function desktopV1MetricMarkup(metrics) {
  return metrics.map(metric => `
    <article class="desktop-kpi-card desktop-kpi-${metric.tone || 'brand'}">
      <span class="desktop-kpi-icon" aria-hidden="true">${desktopV1Icon(metric.icon, 21)}</span>
      <span class="desktop-kpi-copy"><span>${desktopV1T(metric.label)}</span><strong>${Number(metric.value || 0).toLocaleString()}</strong><small>${desktopV1T(metric.context)}</small></span>
    </article>`).join('');
}

function desktopV1EnsureMetrics(view, metrics) {
  const root = document.getElementById(`view-${view}`);
  if (!root || window.innerWidth <= DESKTOP_V1_BREAKPOINT) return;
  let section = root.querySelector(':scope > .desktop-module-kpis');
  if (!section) {
    section = document.createElement('section');
    section.className = 'desktop-module-kpis';
    section.setAttribute('aria-label', desktopV1T('workspace_insights'));
    const header = root.querySelector(':scope > .tab-header, :scope > .settings-page-hd');
    if (header) header.insertAdjacentElement('afterend', section);
    else root.prepend(section);
  }
  const markup = desktopV1MetricMarkup(metrics);
  if (section.innerHTML !== markup) section.innerHTML = markup;
}

function desktopV1TaskMetrics() {
  const rows = desktopV1Data('Tasks');
  desktopV1EnsureMetrics('tasks', [
    { label: 'tasks', value: rows.length, context: 'total_records', icon: 'clipboard-list', tone: 'brand' },
    { label: 'to_do', value: desktopV1Count(rows, ['to do', 'not started', 'open', 'pending']), context: 'open_items', icon: 'square-check', tone: 'blue' },
    { label: 'in_progress', value: desktopV1Count(rows, ['in progress', 'in review', 'blocked']), context: 'open_items', icon: 'clock', tone: 'amber' },
    { label: 'completed', value: desktopV1Count(rows, ['done', 'completed', 'closed']), context: 'total_records', icon: 'square-check', tone: 'green' },
    { label: 'overdue', value: rows.filter(desktopV1IsOverdue).length, context: 'overdue_items', icon: 'clock', tone: 'red' }
  ]);
}

function desktopV1POMetrics() {
  const rows = desktopV1Data('POs');
  desktopV1EnsureMetrics('pos', [
    { label: 'draft', value: desktopV1Count(rows, ['draft']), context: 'purchase_orders', icon: 'file-text', tone: 'brand' },
    { label: 'submitted', value: desktopV1Count(rows, ['submitted', 'pending approval']), context: 'purchase_orders', icon: 'send', tone: 'blue' },
    { label: 'received', value: desktopV1Count(rows, ['received', 'delivered']), context: 'purchase_orders', icon: 'inbox', tone: 'green' },
    { label: 'overdue', value: rows.filter(desktopV1IsOverdue).length, context: 'purchase_orders', icon: 'clock', tone: 'red' }
  ]);
}

function desktopV1PRMetrics() {
  const rows = typeof _allPRs !== 'undefined' && Array.isArray(_allPRs) ? _allPRs : [];
  desktopV1EnsureMetrics('purchasereqs', [
    { label: 'draft', value: desktopV1Count(rows, ['draft']), context: 'purchase_requests', icon: 'file-text', tone: 'blue' },
    { label: 'submitted', value: desktopV1Count(rows, ['submitted']), context: 'purchase_requests', icon: 'send', tone: 'amber' },
    { label: 'approved', value: desktopV1Count(rows, ['approved']), context: 'purchase_requests', icon: 'square-check', tone: 'green' },
    { label: 'closed', value: desktopV1Count(rows, ['closed']), context: 'purchase_requests', icon: 'inbox', tone: 'brand' }
  ]);
}

function desktopV1VendorMetrics() {
  const rows = typeof _allVendors !== 'undefined' && Array.isArray(_allVendors) ? _allVendors : [];
  desktopV1EnsureMetrics('vendors', [
    { label: 'vendors', value: rows.length, context: 'total_records', icon: 'building', tone: 'brand' },
    { label: 'active', value: desktopV1Count(rows, ['active']), context: 'active_vendors', icon: 'square-check', tone: 'green' },
    { label: 'inactive', value: desktopV1Count(rows, ['inactive']), context: 'vendors', icon: 'clock', tone: 'amber' },
    { label: 'blocked', value: desktopV1Count(rows, ['blocked']), context: 'vendors', icon: 'x', tone: 'red' }
  ]);
}

function desktopV1AnalyticsMetrics() {
  const tasks = desktopV1Data('Tasks');
  const pos = desktopV1Data('POs');
  const vendors = typeof _allVendors !== 'undefined' && Array.isArray(_allVendors) ? _allVendors : [];
  const spend = pos.reduce((total, row) => total + (Number(row.total_value) || (Number(row.quantity) || 0) * (Number(row.unit_price) || 0)), 0);
  desktopV1EnsureMetrics('analytics', [
    { label: 'total_spend', value: Math.round(spend), context: 'purchase_orders', icon: 'receipt', tone: 'brand' },
    { label: 'completed', value: desktopV1Count(tasks, ['done', 'completed', 'closed']), context: 'tasks', icon: 'square-check', tone: 'green' },
    { label: 'purchase_orders', value: pos.length, context: 'total_records', icon: 'file-text', tone: 'blue' },
    { label: 'active_vendors', value: desktopV1Count(vendors, ['active']), context: 'vendors', icon: 'building', tone: 'amber' }
  ]);
}

function desktopV1PermissionMetrics() {
  const cards = [...document.querySelectorAll('#perms-view-wrap .perm-user-card')];
  if (!cards.length) return;
  const roles = cards.map(card => card.querySelector('select')?.value || 'editor');
  desktopV1EnsureMetrics('permissions', [
    { label: 'team_members', value: cards.length + 1, context: 'total_records', icon: 'user', tone: 'brand' },
    { label: 'admin', value: roles.filter(role => role === 'admin').length + 1, context: 'users_roles', icon: 'settings', tone: 'green' },
    { label: 'editor', value: roles.filter(role => role === 'editor').length, context: 'users_roles', icon: 'file-text', tone: 'blue' },
    { label: 'viewer', value: roles.filter(role => role === 'viewer').length, context: 'users_roles', icon: 'search', tone: 'amber' }
  ]);
}

function desktopV1UpdateMetrics() {
  desktopV1TaskMetrics();
  desktopV1POMetrics();
  desktopV1PRMetrics();
  desktopV1VendorMetrics();
  desktopV1AnalyticsMetrics();
  desktopV1PermissionMetrics();
  desktopV1RenderAIInsights();
}

function desktopV1RenderAIInsights() {
  const list = document.getElementById('desktop-ai-insight-list');
  if (!list) return;
  const tasks = desktopV1Data('Tasks');
  const pos = desktopV1Data('POs');
  const prs = typeof _allPRs !== 'undefined' && Array.isArray(_allPRs) ? _allPRs : [];
  const insights = [
    { label: 'overdue_items', value: tasks.filter(desktopV1IsOverdue).length + pos.filter(desktopV1IsOverdue).length, icon: 'clock', tone: 'red' },
    { label: 'open_items', value: tasks.filter(row => !['done', 'completed', 'closed'].includes(desktopV1Normalize(row.status))).length, icon: 'clipboard-list', tone: 'blue' },
    { label: 'pending_approvals', value: desktopV1Count(prs, ['submitted']), icon: 'square-check', tone: 'amber' }
  ];
  const markup = insights.map(item => `<div class="desktop-ai-insight desktop-kpi-${item.tone}"><span aria-hidden="true">${desktopV1Icon(item.icon, 18)}</span><div><strong>${item.value.toLocaleString()}</strong><small>${desktopV1T(item.label)}</small></div></div>`).join('');
  if (list.innerHTML !== markup) list.innerHTML = markup;
}

function desktopV1AIConfigured() {
  const metaGateway = document.querySelector('meta[name="task-tracker-ai-gateway"]')?.content.trim();
  const runtimeGateway = typeof window.TASK_TRACKER_AI_GATEWAY_URL === 'string' ? window.TASK_TRACKER_AI_GATEWAY_URL.trim() : '';
  return Boolean(metaGateway || runtimeGateway);
}

function desktopV1IntegrationDefinitions() {
  const notificationAvailable = 'Notification' in window;
  return [
    { key: 'sheets', name: 'google_sheets', description: 'google_sheets_description', icon: 'layout-grid', connected: typeof API_URL !== 'undefined' && Boolean(API_URL), action: 'settings' },
    { key: 'identity', name: 'google_identity', description: 'google_identity_description', icon: 'user', connected: typeof CLIENT_ID !== 'undefined' && Boolean(CLIENT_ID) },
    { key: 'ai', name: 'cloudflare_ai', description: 'cloudflare_ai_description', icon: 'sparkles', connected: desktopV1AIConfigured(), action: 'ai' },
    { key: 'notifications', name: 'notifications', description: 'notifications_description', icon: 'bell', connected: notificationAvailable && Notification.permission === 'granted', available: notificationAvailable, action: 'settings' },
    { key: 'pwa', name: 'pwa', description: 'pwa_description', icon: 'inbox', connected: false, available: 'serviceWorker' in navigator, status: 'available' }
  ];
}

function loadDesktopIntegrations() {
  const grid = document.getElementById('desktop-integrations-grid');
  if (!grid) return;
  const definitions = desktopV1IntegrationDefinitions().filter(item => {
    if (desktopV1IntegrationFilter === 'connected') return item.connected;
    if (desktopV1IntegrationFilter === 'available') return !item.connected;
    return true;
  });
  grid.replaceChildren(...definitions.map(item => {
    const card = document.createElement('article');
    card.className = 'desktop-integration-card';
    const heading = document.createElement('div');
    heading.className = 'desktop-integration-heading';
    const icon = document.createElement('span');
    icon.className = 'desktop-integration-icon';
    icon.innerHTML = desktopV1Icon(item.icon, 24);
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = desktopV1T(item.name);
    const description = document.createElement('p');
    description.textContent = desktopV1T(item.description);
    copy.append(title, description);
    heading.append(icon, copy);
    const footer = document.createElement('div');
    footer.className = 'desktop-integration-footer';
    const status = document.createElement('span');
    status.className = `desktop-integration-status ${item.connected ? 'is-connected' : 'is-available'}`;
    status.textContent = desktopV1T(item.connected ? 'configured' : (item.status || 'needs_configuration'));
    footer.append(status);
    if (item.action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'desktop-secondary-action';
      button.textContent = desktopV1T(item.action === 'settings' ? 'open_settings' : 'configure');
      button.addEventListener('click', () => {
        navigateTo(item.action);
        if (item.action === 'ai') window.setTimeout(() => toggleAIChatSettings(true), 80);
      });
      footer.append(button);
    }
    card.append(heading, footer);
    return card;
  }));
}

function desktopV1DockAI() {
  const panel = document.getElementById('ai-chat-panel');
  const host = document.getElementById('desktop-ai-chat-host');
  if (!panel || !host) return;
  if (window.innerWidth > DESKTOP_V1_BREAKPOINT) {
    if (panel.parentElement !== host) host.append(panel);
    toggleAIChat(true);
  } else if (panel.parentElement !== document.body) {
    document.body.append(panel);
    toggleAIChat(false);
  }
}

function loadDesktopAIWorkspace() {
  desktopV1DockAI();
  desktopV1RenderAIInsights();
}

function syncDesktopV1Route(view) {
  document.documentElement.dataset.desktopView = view;
  document.querySelectorAll('#sidebar .nav-item').forEach(item => {
    const current = item.dataset.view === view;
    if (current) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  if (view === 'ai') loadDesktopAIWorkspace();
  if (view === 'integrations') loadDesktopIntegrations();
  window.clearTimeout(desktopV1UpdateTimer);
  desktopV1UpdateTimer = window.setTimeout(desktopV1UpdateMetrics, 40);
}

function desktopV1SetCollapsed(collapsed) {
  document.body.classList.toggle('desktop-sidebar-collapsed', collapsed);
  const button = document.getElementById('desktop-sidebar-collapse');
  if (!button) return;
  button.setAttribute('aria-expanded', String(!collapsed));
  const label = desktopV1T(collapsed ? 'expand_sidebar' : 'collapse_sidebar');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.querySelector('span').textContent = desktopV1T(collapsed ? 'expand_sidebar' : 'collapse');
}

function desktopV1InitNavigation() {
  const primary = ['dashboard', 'tasks', 'purchasereqs', 'pos', 'vendors', 'analytics', 'ai', 'settings', 'integrations', 'permissions'];
  document.querySelectorAll('#sidebar .nav-item').forEach(item => {
    item.classList.toggle('desktop-primary-nav-item', primary.includes(item.dataset.view));
    item.classList.toggle('desktop-secondary-nav-item', !primary.includes(item.dataset.view));
    item.title = item.textContent.trim();
  });
  const collapsed = localStorage.getItem(DESKTOP_V1_COLLAPSE_KEY) === 'true';
  desktopV1SetCollapsed(collapsed);
  document.getElementById('desktop-sidebar-collapse')?.addEventListener('click', () => {
    const next = !document.body.classList.contains('desktop-sidebar-collapsed');
    localStorage.setItem(DESKTOP_V1_COLLAPSE_KEY, String(next));
    desktopV1SetCollapsed(next);
  });
}

function desktopV1InitEvents() {
  document.getElementById('desktop-ai-new-chat')?.addEventListener('click', () => {
    clearAIChat();
    document.getElementById('ai-input')?.focus();
  });
  document.querySelectorAll('[data-integration-filter]').forEach(button => {
    button.addEventListener('click', () => {
      desktopV1IntegrationFilter = button.dataset.integrationFilter;
      document.querySelectorAll('[data-integration-filter]').forEach(candidate => {
        const selected = candidate === button;
        candidate.classList.toggle('is-active', selected);
        candidate.setAttribute('aria-selected', String(selected));
      });
      loadDesktopIntegrations();
    });
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('global-search-input')?.focus();
    }
  });
  const main = document.getElementById('main');
  new MutationObserver(() => {
    window.clearTimeout(desktopV1UpdateTimer);
    desktopV1UpdateTimer = window.setTimeout(desktopV1UpdateMetrics, 80);
  }).observe(main, { childList: true, subtree: true });
  new MutationObserver(() => {
    loadDesktopIntegrations();
    desktopV1UpdateMetrics();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir', 'data-theme'] });
  window.addEventListener('resize', () => {
    if (document.documentElement.dataset.desktopView === 'ai') desktopV1DockAI();
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  desktopV1InitNavigation();
  desktopV1InitEvents();
  syncDesktopV1Route(typeof currentView === 'string' ? currentView : 'dashboard');
});

window.loadDesktopAIWorkspace = loadDesktopAIWorkspace;
window.loadDesktopIntegrations = loadDesktopIntegrations;
window.syncDesktopV1Route = syncDesktopV1Route;
