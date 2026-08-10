/* Dashboard V2 — live procurement and operations command center */

const dashboardV2State = {
  loading: false,
  refreshing: false,
  requestId: 0,
  lastUpdatedAt: null,
  range: sessionStorage.getItem('tt_dash_range') || '7d',
  selectedCurrency: sessionStorage.getItem('tt_dash_currency') || '',
  selectedCalendarDate: '',
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  deadlineFilter: 'all',
  raw: {
    dashboard: null,
    tasks: [],
    pos: [],
    prs: [],
    invoices: [],
    vendors: [],
    expenses: [],
    milestones: [],
    activity: []
  },
  errors: {},
  derived: {}
};

const dashboardV2Charts = {
  trend: null,
  status: null,
  spend: null
};

let dashboardV2SearchResults = [];
let dashboardV2SearchIndex = -1;
let dashboardV2EventsBound = false;
let dashboardV2PendingFilters = {};

const DASH_V2_DAY_MS = 86400000;
const DASH_V2_RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

function dashboardV2T(key) {
  return typeof t === 'function' ? t(key) : key;
}

function dashboardV2Escape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dashboardV2Attr(value) {
  return dashboardV2Escape(value).replace(/`/g, '&#96;');
}

function dashboardV2Icon(name, size = 16) {
  const paths = {
    tasks: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-5"/>',
    requests: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    spend: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h2"/>',
    progress: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
    expenses: '<path d="M12 2v20M17 6.5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7"/>',
    po: '<path d="M6 3h12l2 4v14H4V7l2-4z"/><path d="M4 8h16M9 12h6"/>',
    deadline: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    activity: '<path d="M4 12h3l2-5 4 10 2-5h5"/>',
    milestone: '<path d="M5 21V4M5 5h12l-2 4 2 4H5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    vendor: '<path d="M3 21V8l9-5 9 5v13M8 21v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    retry: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
    empty: '<path d="M4 7h16v12H4zM8 3h8v4M8 12h8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'
  };
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.empty}</svg>`;
}

function dashboardV2NormalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function dashboardV2Number(value) {
  const number = typeof value === 'number' ? value : parseFloat(String(value || '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function dashboardV2LocalDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function dashboardV2Timestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dashboardV2DateKey(value) {
  const date = value instanceof Date ? value : dashboardV2LocalDate(value);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dashboardV2Today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dashboardV2IsTaskCompleted(task) {
  return ['done', 'completed', 'closed', 'cancelled'].includes(dashboardV2NormalizeStatus(task.status));
}

function dashboardV2IsTaskOverdue(task, today = dashboardV2Today()) {
  if (dashboardV2IsTaskCompleted(task)) return false;
  const due = dashboardV2LocalDate(task.due_date);
  return !!(due && due < today);
}

function dashboardV2IsPOOverdue(po, today = dashboardV2Today()) {
  const terminal = ['received', 'completed', 'closed', 'cancelled'].includes(dashboardV2NormalizeStatus(po.status));
  const due = dashboardV2LocalDate(po.expected_delivery || po.delivery_date || po.due_date);
  return !terminal && !!(due && due < today);
}

function dashboardV2POAmount(po) {
  const explicit = dashboardV2Number(po.total_value ?? po.total_amount ?? po.amount);
  if (explicit != null) return explicit;
  const quantity = dashboardV2Number(po.quantity) || 0;
  const unitPrice = dashboardV2Number(po.unit_price) || 0;
  return quantity * unitPrice;
}

function dashboardV2IsSpendPO(po) {
  const status = dashboardV2NormalizeStatus(po.status || 'draft');
  return ['approved', 'submitted', 'received', 'partially_received', 'partial', 'in_progress'].includes(status);
}

function dashboardV2FormatMoney(amount, currency) {
  const code = String(currency || '').trim().toUpperCase();
  const value = dashboardV2Number(amount) || 0;
  if (!code) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  try {
    return new Intl.NumberFormat(currentLang === 'ar' ? 'ar-IQ' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'IQD' ? 0 : 2
    }).format(value);
  } catch (_) {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${code}`;
  }
}

function dashboardV2GroupCurrency(rows, amountGetter) {
  const totals = {};
  (rows || []).forEach(row => {
    const amount = dashboardV2Number(amountGetter(row));
    if (amount == null) return;
    const currency = String(row.currency || 'USD').trim().toUpperCase() || 'USD';
    totals[currency] = (totals[currency] || 0) + amount;
  });
  return totals;
}

function dashboardV2CurrencyDisplay(totals) {
  const currencies = Object.keys(totals).filter(currency => Math.abs(totals[currency]) > 0);
  if (!currencies.length) {
    return { value: '—', meta: dashboardV2T('dash_no_spend_data'), title: '' };
  }
  if (currencies.length === 1) {
    const currency = currencies[0];
    return {
      value: dashboardV2FormatMoney(totals[currency], currency),
      meta: dashboardV2T('dash_live_total'),
      title: dashboardV2FormatMoney(totals[currency], currency)
    };
  }
  return {
    value: dashboardV2T('dash_multiple_currencies'),
    meta: `${currencies.length} ${dashboardV2T('dash_currencies')}`,
    title: currencies.map(currency => dashboardV2FormatMoney(totals[currency], currency)).join(' • ')
  };
}

function dashboardV2PriorityRank(priority) {
  return { urgent: 4, critical: 4, high: 3, medium: 2, normal: 2, low: 1 }[dashboardV2NormalizeStatus(priority)] || 0;
}

function dashboardV2PriorityColor(priority) {
  const rank = dashboardV2PriorityRank(priority);
  if (rank >= 4) return 'var(--dash-red)';
  if (rank === 3) return 'var(--dash-amber)';
  if (rank === 2) return 'var(--dash-blue)';
  return 'var(--dash-text-4)';
}

function dashboardV2Can(permission, fallback = true) {
  if (typeof currentUserIsAdmin !== 'undefined' && currentUserIsAdmin) return true;
  if (typeof currentUserPermissions === 'undefined') return fallback;
  const value = currentUserPermissions[permission];
  return value === undefined ? fallback : value !== false;
}

function dashboardV2RelativeTime(value) {
  const date = dashboardV2Timestamp(value);
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return dashboardV2T('dash_just_now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${dashboardV2T('dash_minutes_short')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${dashboardV2T('dash_hours_short')}`;
  const days = Math.floor(hours / 24);
  return `${days}${dashboardV2T('dash_days_short')}`;
}

function dashboardV2FormatDate(value, options) {
  const date = dashboardV2LocalDate(value);
  return date ? date.toLocaleDateString(undefined, options || { day: '2-digit', month: 'short' }) : '—';
}

function dashboardV2ModuleHeader(icon, titleKey, count, color, actionKey, action) {
  return `
    <div class="dash-module-header">
      <div class="dash-module-title">
        <span class="dash-module-title-icon" style="--dash-module-color:${color}">${dashboardV2Icon(icon, 15)}</span>
        <h2>${dashboardV2Escape(dashboardV2T(titleKey))}</h2>
        ${count == null ? '' : `<span class="dash-module-count">${dashboardV2Escape(count)}</span>`}
      </div>
      ${actionKey ? `<button type="button" class="dash-link-button" data-dash-action="${dashboardV2Attr(action)}">${dashboardV2Escape(dashboardV2T(actionKey))}</button>` : ''}
    </div>`;
}

function dashboardV2StateMarkup(titleKey, bodyKey, retryDataset) {
  return `
    <div class="dash-state">
      ${dashboardV2Icon(retryDataset ? 'retry' : 'empty', 24)}
      <strong>${dashboardV2Escape(dashboardV2T(titleKey))}</strong>
      <span>${dashboardV2Escape(dashboardV2T(bodyKey))}</span>
      ${retryDataset ? `<button type="button" class="dash-link-button" data-dash-action="retry" data-dataset="${dashboardV2Attr(retryDataset)}">${dashboardV2Escape(dashboardV2T('dash_retry'))}</button>` : ''}
    </div>`;
}

function dashboardV2SkeletonRows(count = 3) {
  return Array.from({ length: count }, (_, index) => `
    <div class="dash-skeleton dash-skeleton-line" style="width:${index % 2 ? '76%' : '92%'}"></div>
  `).join('');
}

function renderDashboardV2Loading() {
  const kpis = document.getElementById('dash-kpi-grid');
  if (kpis) {
    kpis.innerHTML = Array.from({ length: 4 }, () => `
      <div class="dash-skeleton-card" aria-hidden="true">
        <div class="dash-skeleton dash-skeleton-line"></div>
        <div class="dash-skeleton dash-skeleton-value"></div>
      </div>`).join('');
  }
  const pr = document.getElementById('dash-pr-content');
  if (pr) pr.innerHTML = `<div class="dash-pr-grid">${Array.from({ length: 4 }, () => `<div class="dash-skeleton-card"></div>`).join('')}</div>`;
  [
    'dash-overdue-tasks-card',
    'dash-overdue-pos-card',
    'dash-deadlines-card',
    'dash-activity-card',
    'dash-milestones-card',
    'dash-calendar-card',
    'dash-vendors-card'
  ].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.innerHTML = `<div class="dash-state">${dashboardV2SkeletonRows()}</div>`;
  });
}

function setGreeting() {
  const profile = (() => {
    try { return JSON.parse(localStorage.getItem('tt_user_profile') || '{}'); }
    catch (_) { return {}; }
  })();
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'dash_good_morning' : hour < 18 ? 'dash_good_afternoon' : 'dash_good_evening';
  const name = String(profile.name || profile.email || dashboardV2T('dash_team')).trim().split(/\s+/)[0];
  const kicker = document.getElementById('dash-greeting-kicker');
  const title = document.getElementById('dashboard-title');
  if (kicker) kicker.textContent = dashboardV2T('dash_command_center');
  if (title) title.textContent = `${dashboardV2T(greetingKey)}, ${name}`;
  const createButton = document.getElementById('dash-create-task');
  if (createButton) createButton.disabled = !dashboardV2Can('can_edit_tasks', true);
}

async function dashboardV2CachedCall(cacheKey, loader, forceRefresh) {
  if (forceRefresh && typeof cacheClear === 'function') cacheClear(cacheKey);
  if (typeof cachedFetch === 'function') return cachedFetch(cacheKey, loader);
  return loader();
}

async function dashboardV2LoadSource(name, forceRefresh) {
  switch (name) {
    case 'dashboard':
      return getDashboard(forceRefresh);
    case 'pos':
      return getAll('POs', forceRefresh);
    case 'prs':
      return dashboardV2CachedCall('PurchaseRequests', () => callAPI('getPRs'), forceRefresh);
    case 'invoices':
      return dashboardV2CachedCall('Invoices', () => callAPI('getInvoices'), forceRefresh);
    case 'vendors':
      return dashboardV2CachedCall('Vendors', () => callAPI('getVendors'), forceRefresh);
    case 'activity':
      if (typeof isOwner === 'function' && isOwner()) return callAPI('getAuditLog', {});
      return { rows: [] };
    default:
      return { rows: [] };
  }
}

async function loadDashboard(forceRefresh = false) {
  const root = document.getElementById('dashboard-v2-root');
  if (!root) return;
  if (!dashboardV2Can('can_view_dashboard', true)) {
    root.innerHTML = dashboardV2StateMarkup('dash_access_restricted', 'dash_access_restricted_body');
    return;
  }
  if (dashboardV2State.refreshing && forceRefresh) return;

  const requestId = ++dashboardV2State.requestId;
  const isInitial = !dashboardV2State.raw.dashboard;
  dashboardV2State.loading = isInitial;
  dashboardV2State.refreshing = !!forceRefresh;
  dashboardV2State.errors = {};
  dashboardV2SetRefreshState(true);
  if (isInitial) renderDashboardV2Loading();
  setGreeting();
  dashboardV2BindEvents();

  if (forceRefresh && typeof cacheClear === 'function') {
    ['dashboard', 'POs', 'PurchaseRequests', 'Invoices', 'Vendors'].forEach(key => cacheClear(key));
  }

  const sources = ['dashboard', 'pos', 'prs', 'invoices', 'vendors', 'activity'];
  const results = await Promise.allSettled(sources.map(source => dashboardV2LoadSource(source, forceRefresh)));
  if (requestId !== dashboardV2State.requestId) return;

  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === 'rejected' || result.value?.error) {
      dashboardV2State.errors[source] = result.status === 'rejected' ? result.reason : new Error(result.value.error);
      console.warn(`[dashboard-v2] ${source} failed`, dashboardV2State.errors[source]);
      return;
    }
    const value = result.value || {};
    if (source === 'dashboard') {
      dashboardV2State.raw.dashboard = value;
      dashboardV2State.raw.tasks = value.tasks || [];
      dashboardV2State.raw.expenses = value.expenses || [];
      dashboardV2State.raw.milestones = value.milestones || [];
    } else {
      dashboardV2State.raw[source] = value.rows || [];
    }
  });

  dashboardV2SyncCaches();
  dashboardV2RunExistingAutomations();
  dashboardV2State.derived = dashboardV2Derive();
  dashboardV2State.lastUpdatedAt = new Date();
  dashboardV2RenderAll();

  dashboardV2State.loading = false;
  dashboardV2State.refreshing = false;
  dashboardV2SetRefreshState(false);
  dashboardV2UpdateRefreshLabel();
  window._lastDashData = dashboardV2State.raw.dashboard;
  startDashboardRefresh();
}

function dashboardV2SyncCaches() {
  const raw = dashboardV2State.raw;
  if (typeof tableData !== 'undefined') {
    tableData.Tasks = raw.tasks;
    tableData.POs = raw.pos;
    tableData.Expenses = raw.expenses;
    tableData.Milestones = raw.milestones;
  }
  if (typeof cacheSet === 'function') {
    cacheSet('Tasks', { rows: raw.tasks });
    cacheSet('POs', { rows: raw.pos });
    cacheSet('Expenses', { rows: raw.expenses });
    cacheSet('Milestones', { rows: raw.milestones });
    cacheSet('PurchaseRequests', { rows: raw.prs });
    cacheSet('Invoices', { rows: raw.invoices });
    cacheSet('Vendors', { rows: raw.vendors });
  }
  if (typeof _allPRs !== 'undefined') {
    _allPRs.length = 0;
    raw.prs.forEach(row => _allPRs.push(row));
  }
  if (typeof _allInvoices !== 'undefined') {
    _allInvoices.length = 0;
    raw.invoices.forEach(row => _allInvoices.push(row));
  }
  if (typeof _allVendors !== 'undefined') {
    _allVendors.length = 0;
    raw.vendors.forEach(row => _allVendors.push(row));
    window._allVendors = _allVendors;
  }
}

function dashboardV2RunExistingAutomations() {
  const raw = dashboardV2State.raw;
  if (typeof autoMarkOverdue === 'function') {
    if (dashboardV2Can('can_edit_tasks', true)) autoMarkOverdue(raw.tasks, 'Tasks');
    if (dashboardV2Can('can_edit_pos', true)) autoMarkOverdue(raw.pos, 'POs');
  }
  if (typeof updateOverdueBadge === 'function') updateOverdueBadge(raw.tasks);
  if (typeof autoMarkOverdueInvoices === 'function' && dashboardV2Can('can_edit_invoices', true)) {
    autoMarkOverdueInvoices(raw.invoices);
  }
  if (typeof updateInvoiceSidebarBadge === 'function') updateInvoiceSidebarBadge();
  if (typeof checkVendorContractExpiry === 'function' && dashboardV2Can('can_edit_vendors', true)) {
    checkVendorContractExpiry(raw.vendors);
  }
}

function dashboardV2Derive() {
  const raw = dashboardV2State.raw;
  const today = dashboardV2Today();
  const tasks = raw.tasks || [];
  const pos = raw.pos || [];
  const expenses = raw.expenses || [];
  const milestones = raw.milestones || [];
  const openTasks = tasks.filter(task => !dashboardV2IsTaskCompleted(task));
  const overdueTasks = tasks.filter(task => dashboardV2IsTaskOverdue(task, today));
  const overduePOs = pos.filter(po => dashboardV2IsPOOverdue(po, today));
  const spendPOs = pos.filter(dashboardV2IsSpendPO);
  const poCurrencies = dashboardV2GroupCurrency(spendPOs, dashboardV2POAmount);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthToDatePOs = spendPOs.filter(po => {
    const date = dashboardV2LocalDate(po.created_at || po.order_date || po.date);
    return !!(date && date >= monthStart && date < nextMonth);
  });
  const monthToDatePOCurrencies = dashboardV2GroupCurrency(monthToDatePOs, dashboardV2POAmount);
  const expenseCurrencies = dashboardV2GroupCurrency(expenses, row => row.amount);
  const progressValues = milestones
    .map(row => dashboardV2Number(row.completion_pct))
    .filter(value => value != null)
    .map(value => Math.min(100, Math.max(0, value)));
  const averageProgress = progressValues.length
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
    : null;
  const statuses = dashboardV2TaskStatuses(tasks, today);
  const deadlines = dashboardV2BuildDeadlines(raw, today);
  const activity = dashboardV2BuildActivity(raw);
  const prSummary = dashboardV2PRSummary(raw.prs);
  const currencies = Object.keys(poCurrencies).sort();
  if (!dashboardV2State.selectedCurrency || !currencies.includes(dashboardV2State.selectedCurrency)) {
    dashboardV2State.selectedCurrency = currencies[0] || '';
    if (dashboardV2State.selectedCurrency) sessionStorage.setItem('tt_dash_currency', dashboardV2State.selectedCurrency);
  }
  return {
    today,
    openTasks,
    overdueTasks,
    overduePOs,
    spendPOs,
    poCurrencies,
    monthToDatePOs,
    monthToDatePOCurrencies,
    expenseCurrencies,
    averageProgress,
    statuses,
    deadlines,
    activity,
    prSummary,
    currencies
  };
}

function dashboardV2TaskStatuses(tasks, today) {
  const groups = { open: [], in_progress: [], completed: [], overdue: [], other: [] };
  tasks.forEach(task => {
    const status = dashboardV2NormalizeStatus(task.status);
    if (dashboardV2IsTaskOverdue(task, today) || status === 'overdue') groups.overdue.push(task);
    else if (dashboardV2IsTaskCompleted(task)) groups.completed.push(task);
    else if (['in_progress', 'in_review', 'blocked'].includes(status)) groups.in_progress.push(task);
    else if (['', 'open', 'new', 'not_started', 'pending'].includes(status)) groups.open.push(task);
    else groups.other.push(task);
  });
  return groups;
}

function dashboardV2PRSummary(prs) {
  const groups = { total: prs.length, draft: 0, submitted: 0, approved: 0, ordered: 0, rejected: 0, other: 0 };
  prs.forEach(pr => {
    const status = dashboardV2NormalizeStatus(pr.status);
    if (pr.linked_po_ids || ['ordered', 'closed'].includes(status)) groups.ordered++;
    else if (status === 'draft') groups.draft++;
    else if (['pending', 'submitted', 'in_review', 'awaiting_approval'].includes(status)) groups.submitted++;
    else if (['approved', 'awarded'].includes(status)) groups.approved++;
    else if (['rejected', 'cancelled'].includes(status)) groups.rejected++;
    else groups.other++;
  });
  return groups;
}

function dashboardV2BuildDeadlines(raw, today) {
  const deadlineRows = [];
  const end = new Date(today);
  end.setDate(end.getDate() + 14);
  const add = (rows, type, view, dateFields, labelFields) => {
    (rows || []).forEach(row => {
      const field = dateFields.find(key => row[key]);
      const date = field ? dashboardV2LocalDate(row[field]) : null;
      if (!date) return;
      const label = labelFields.map(key => row[key]).find(Boolean) || row.id || dashboardV2T('dash_record');
      deadlineRows.push({ type, view, date, row, label: String(label) });
    });
  };
  add(raw.tasks, 'tasks', 'tasks', ['due_date'], ['title', 'id']);
  add(raw.pos, 'pos', 'pos', ['expected_delivery', 'delivery_date'], ['po_number', 'supplier', 'id']);
  add(raw.prs, 'prs', 'purchasereqs', ['required_by_date', 'response_date'], ['pr_number', 'description', 'id']);
  add(raw.invoices, 'invoices', 'invoices', ['due_date'], ['invoice_number', 'vendor', 'id']);
  add(raw.milestones, 'milestones', 'milestones', ['target_date'], ['milestone_name', 'project', 'id']);
  add(raw.vendors, 'vendors', 'vendors', ['contract_expiry', 'review_date'], ['vendor_name', 'id']);
  return deadlineRows
    .filter(item => item.date >= today && item.date <= end)
    .sort((a, b) => a.date - b.date);
}

function dashboardV2BuildActivity(raw) {
  if (raw.activity && raw.activity.length) {
    return raw.activity.map(row => ({
      user: row.user_email || '',
      action: row.action || '',
      record: [row.sheet, row.record_id].filter(Boolean).join(' #'),
      summary: row.summary || '',
      timestamp: row.timestamp,
      id: row.record_id || '',
      view: dashboardV2ViewForSheet(row.sheet)
    })).filter(item => item.timestamp).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  const activity = [];
  const addRows = (rows, view, labelFields) => {
    (rows || []).forEach(row => {
      const label = labelFields.map(key => row[key]).find(Boolean) || row.id || dashboardV2T('dash_record');
      if (row.created_at) activity.push({
        user: row.created_by || '',
        action: dashboardV2T('dash_created'),
        record: String(label),
        summary: '',
        timestamp: row.created_at,
        id: row.id || '',
        view
      });
      if (row.updated_at && String(row.updated_at) !== String(row.created_at)) activity.push({
        user: row.updated_by || row.created_by || '',
        action: dashboardV2T('dash_updated'),
        record: String(label),
        summary: '',
        timestamp: row.updated_at,
        id: row.id || '',
        view
      });
    });
  };
  addRows(raw.tasks, 'tasks', ['title']);
  addRows(raw.pos, 'pos', ['po_number', 'supplier']);
  addRows(raw.prs, 'purchasereqs', ['pr_number', 'description']);
  addRows(raw.invoices, 'invoices', ['invoice_number', 'vendor']);
  addRows(raw.milestones, 'milestones', ['milestone_name', 'project']);
  return activity.filter(item => dashboardV2Timestamp(item.timestamp))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function dashboardV2ViewForSheet(sheet) {
  return {
    Tasks: 'tasks',
    POs: 'pos',
    PurchaseRequests: 'purchasereqs',
    Invoices: 'invoices',
    Vendors: 'vendors',
    Milestones: 'milestones',
    Expenses: 'expenses',
    Comparisons: 'quotations'
  }[sheet] || 'dashboard';
}

function dashboardV2RenderAll() {
  setGreeting();
  dashboardV2RenderKPIs();
  dashboardV2RenderPRSummary();
  dashboardV2RenderRangeControl();
  dashboardV2RenderCharts();
  dashboardV2RenderOverdueTasks();
  dashboardV2RenderOverduePOs();
  dashboardV2RenderDeadlines();
  dashboardV2RenderActivity();
  dashboardV2RenderMilestones();
  dashboardV2RenderCalendar();
  dashboardV2RenderVendors();
}

function dashboardV2RenderKPIs() {
  const grid = document.getElementById('dash-kpi-grid');
  if (!grid) return;
  const derived = dashboardV2State.derived;
  const monthToDateDisplay = dashboardV2CurrencyDisplay(derived.monthToDatePOCurrencies);
  const cards = [
    {
      key: 'open_tasks',
      value: derived.openTasks.length,
      meta: dashboardV2T('dash_active_tasks'),
      icon: 'tasks',
      color: 'var(--dash-blue)',
      action: 'open-tasks'
    },
    {
      key: 'overdue',
      value: derived.overdueTasks.length,
      meta: dashboardV2T('dash_due_before_today'),
      icon: 'alert',
      color: 'var(--dash-red)',
      action: 'overdue-tasks'
    },
    {
      key: 'purchase_requests',
      value: derived.prSummary.total,
      meta: `${derived.prSummary.submitted} ${dashboardV2T('submitted')}`,
      icon: 'requests',
      color: 'var(--dash-violet)',
      action: 'all-prs'
    },
    {
      key: 'po_spend_mtd',
      value: monthToDateDisplay.value,
      meta: dashboardV2T('month_to_date'),
      title: monthToDateDisplay.title,
      icon: 'spend',
      color: 'var(--dash-green)',
      action: 'all-pos',
      isText: Object.keys(derived.monthToDatePOCurrencies).length > 1
    }
  ];
  grid.innerHTML = cards.map(card => `
    <button type="button" class="dash-kpi-card" data-dash-action="${card.action}"
      style="--dash-kpi-color:${card.color}" title="${dashboardV2Attr(card.title || dashboardV2T(card.key))}">
      <span class="dash-kpi-icon">${dashboardV2Icon(card.icon, 17)}</span>
      <span class="dash-kpi-copy">
        <span class="dash-kpi-label">${dashboardV2Escape(dashboardV2T(card.key))}</span>
        <span class="dash-kpi-value${card.isText ? ' is-text' : ''}">${dashboardV2Escape(card.value)}</span>
        <span class="dash-kpi-meta">${dashboardV2Escape(card.meta)}</span>
      </span>
    </button>`).join('');
}

function dashboardV2RenderPRSummary() {
  const content = document.getElementById('dash-pr-content');
  const updated = document.getElementById('dash-pr-updated');
  if (!content) return;
  if (dashboardV2State.errors.prs) {
    content.innerHTML = dashboardV2StateMarkup('dash_pr_load_failed', 'dash_module_error_body', 'prs');
    return;
  }
  const summary = dashboardV2State.derived.prSummary;
  if (!summary.total) {
    content.innerHTML = dashboardV2StateMarkup('dash_no_purchase_requests', 'dash_no_purchase_requests_body');
    return;
  }
  const segments = [
    ['draft', 'draft', 'var(--dash-text-3)', 'Draft'],
    ['submitted', 'submitted', 'var(--dash-violet)', 'Submitted'],
    ['approved', 'approved', 'var(--dash-green)', 'Approved'],
    ['ordered', 'ordered', 'var(--dash-amber)', 'Closed']
  ];
  content.innerHTML = `<div class="dash-pr-grid">${segments.map(([key, labelKey, color, filter]) => `
    <button type="button" class="dash-pr-segment" style="--dash-segment-color:${color}"
      data-dash-action="pr-filter" data-filter="${dashboardV2Attr(filter)}">
      <span class="dash-pr-number">${summary[key]}</span>
      <span class="dash-pr-label">${dashboardV2Escape(dashboardV2T(labelKey))}</span>
    </button>`).join('')}</div>`;
  if (updated) updated.textContent = dashboardV2State.lastUpdatedAt
    ? `${dashboardV2T('dash_updated')} ${dashboardV2RelativeTime(dashboardV2State.lastUpdatedAt)}`
    : dashboardV2T('dash_live_data');
}

function dashboardV2RenderRangeControl() {
  const control = document.getElementById('dash-range-control');
  if (!control) return;
  control.innerHTML = ['7d', '30d', '90d'].map(range => `
    <button type="button" class="${dashboardV2State.range === range ? 'active' : ''}"
      data-dash-action="range" data-range="${range}" aria-pressed="${dashboardV2State.range === range}">
      ${range.replace('d', '')}
    </button>`).join('');
}

function dashboardV2Css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function dashboardV2ChartColors() {
  return {
    text: dashboardV2Css('--dash-text-2'),
    muted: dashboardV2Css('--dash-text-3'),
    grid: dashboardV2Css('--dash-border'),
    panel: dashboardV2Css('--dash-panel-strong'),
    border: dashboardV2Css('--dash-border-strong'),
    blue: dashboardV2Css('--dash-blue'),
    violet: dashboardV2Css('--dash-violet'),
    green: dashboardV2Css('--dash-green'),
    amber: dashboardV2Css('--dash-amber'),
    red: dashboardV2Css('--dash-red'),
    cyan: dashboardV2Css('--dash-cyan')
  };
}

function dashboardV2DestroyChart(key) {
  if (dashboardV2Charts[key]) {
    dashboardV2Charts[key].destroy();
    dashboardV2Charts[key] = null;
  }
}

function dashboardV2RenderCharts() {
  dashboardV2RenderTrendChart();
  dashboardV2RenderStatusChart();
  dashboardV2RenderSpendChart();
}

function dashboardV2ChartBaseOptions() {
  const colors = dashboardV2ChartColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 220 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: colors.text,
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 14,
          font: { family: 'Inter, sans-serif', size: 11, weight: '500' }
        }
      },
      tooltip: {
        backgroundColor: colors.panel,
        borderColor: colors.border,
        borderWidth: 1,
        titleColor: colors.text,
        bodyColor: colors.text,
        padding: 10
      }
    }
  };
}

function dashboardV2RenderTrendChart() {
  const canvas = document.getElementById('dash-trend-chart');
  const body = document.getElementById('dash-trend-body');
  const summary = document.getElementById('dash-trend-summary');
  if (!canvas || !body || typeof Chart === 'undefined') return;
  dashboardV2DestroyChart('trend');
  body.querySelector('.dash-chart-empty')?.remove();
  if (dashboardV2State.errors.dashboard) {
    body.insertAdjacentHTML('beforeend', `<div class="dash-chart-empty">${dashboardV2StateMarkup('dash_tasks_load_failed', 'dash_module_error_body', 'dashboard')}</div>`);
    return;
  }
  const days = DASH_V2_RANGE_DAYS[dashboardV2State.range] || 7;
  const today = dashboardV2Today();
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return date;
  });
  const created = new Array(days).fill(0);
  const completed = new Array(days).fill(0);
  const indexByKey = new Map(dates.map((date, index) => [dashboardV2DateKey(date), index]));
  let usedCompletionEstimate = false;
  dashboardV2State.raw.tasks.forEach(task => {
    const createdIndex = indexByKey.get(dashboardV2DateKey(task.created_at));
    if (createdIndex !== undefined) created[createdIndex]++;
    if (!dashboardV2IsTaskCompleted(task)) return;
    const completionValue = task.completed_at || task.closed_at || task.updated_at;
    if (!task.completed_at && !task.closed_at && task.updated_at) usedCompletionEstimate = true;
    const completionIndex = indexByKey.get(dashboardV2DateKey(completionValue));
    if (completionIndex !== undefined) completed[completionIndex]++;
  });
  if (![...created, ...completed].some(Boolean)) {
    body.insertAdjacentHTML('beforeend', `<div class="dash-chart-empty">${dashboardV2StateMarkup('dash_no_trend_data', 'dash_no_trend_data_body')}</div>`);
    if (summary) summary.textContent = dashboardV2T('dash_no_trend_data_body');
    return;
  }
  const colors = dashboardV2ChartColors();
  const options = dashboardV2ChartBaseOptions();
  options.interaction = { intersect: false, mode: 'index' };
  options.scales = {
    x: { grid: { display: false }, ticks: { color: colors.muted, maxTicksLimit: 8, font: { size: 11 } } },
    y: { beginAtZero: true, ticks: { color: colors.muted, precision: 0, font: { size: 11 } }, grid: { color: colors.grid } }
  };
  dashboardV2Charts.trend = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: dates.map(date => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: dashboardV2T('dash_created_tasks'),
          data: created,
          borderColor: colors.blue,
          backgroundColor: colors.blue,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: .35,
          borderWidth: 2
        },
        {
          label: usedCompletionEstimate ? dashboardV2T('dash_completed_estimate') : dashboardV2T('dash_completed_tasks'),
          data: completed,
          borderColor: colors.green,
          backgroundColor: colors.green,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: .35,
          borderWidth: 2
        }
      ]
    },
    options
  });
  if (summary) {
    summary.textContent = `${created.reduce((a, b) => a + b, 0)} ${dashboardV2T('dash_created_tasks')}; ${completed.reduce((a, b) => a + b, 0)} ${usedCompletionEstimate ? dashboardV2T('dash_completed_estimate') : dashboardV2T('dash_completed_tasks')}.`;
  }
}

function dashboardV2CenterTextPlugin(total) {
  return {
    id: 'dashboardV2CenterText',
    afterDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta.data.length) return;
      const point = meta.data[0];
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = dashboardV2Css('--dash-text-1');
      ctx.font = '700 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(total), point.x, point.y - 4);
      ctx.fillStyle = dashboardV2Css('--dash-text-3');
      ctx.font = '500 11px Inter, sans-serif';
      ctx.fillText(dashboardV2T('total'), point.x, point.y + 16);
      ctx.restore();
    }
  };
}

function dashboardV2RenderStatusChart() {
  const canvas = document.getElementById('dash-status-chart');
  const body = document.getElementById('dash-status-body');
  const summary = document.getElementById('dash-status-summary');
  if (!canvas || !body || typeof Chart === 'undefined') return;
  dashboardV2DestroyChart('status');
  body.querySelector('.dash-chart-empty')?.remove();
  const groups = dashboardV2State.derived.statuses;
  const categories = [
    ['open', 'open', 'blue'],
    ['in_progress', 'in_progress', 'amber'],
    ['completed', 'completed', 'green'],
    ['overdue', 'overdue', 'red']
  ];
  if (groups.other.length) categories.push(['other', 'other', 'cyan']);
  const total = dashboardV2State.raw.tasks.length;
  if (!total) {
    body.insertAdjacentHTML('beforeend', `<div class="dash-chart-empty">${dashboardV2StateMarkup('dash_no_tasks', 'dash_no_tasks_body')}</div>`);
    if (summary) summary.textContent = dashboardV2T('dash_no_tasks_body');
    return;
  }
  const colors = dashboardV2ChartColors();
  const options = dashboardV2ChartBaseOptions();
  options.cutout = '68%';
  options.onClick = (_, elements) => {
    if (!elements.length) return;
    dashboardV2NavigateTaskCategory(categories[elements[0].index][0]);
  };
  dashboardV2Charts.status = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: categories.map(([, key]) => dashboardV2T(key)),
      datasets: [{
        data: categories.map(([key]) => groups[key].length),
        backgroundColor: categories.map(([, , color]) => colors[color]),
        borderColor: dashboardV2Css('--dash-panel-strong'),
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options,
    plugins: [dashboardV2CenterTextPlugin(total)]
  });
  if (summary) summary.textContent = categories.map(([key, label]) => `${dashboardV2T(label)}: ${groups[key].length}`).join('; ');
}

function dashboardV2SpendGrouping(rows) {
  const candidates = ['category', 'procurement_type', 'department', 'supplier_category', 'status'];
  const field = candidates.find(candidate => rows.some(row => String(row[candidate] || '').trim())) || 'status';
  const groups = {};
  rows.forEach(row => {
    const label = String(row[field] || dashboardV2T('other')).trim() || dashboardV2T('other');
    groups[label] = (groups[label] || 0) + dashboardV2POAmount(row);
  });
  return { field, groups };
}

function dashboardV2RenderSpendChart() {
  const canvas = document.getElementById('dash-spend-chart');
  const body = document.getElementById('dash-spend-body');
  const summary = document.getElementById('dash-spend-summary');
  const select = document.getElementById('dash-spend-currency');
  if (!canvas || !body || !select || typeof Chart === 'undefined') return;
  dashboardV2DestroyChart('spend');
  body.querySelector('.dash-chart-empty')?.remove();
  const currencies = dashboardV2State.derived.currencies;
  select.innerHTML = currencies.map(currency => `<option value="${dashboardV2Attr(currency)}" ${currency === dashboardV2State.selectedCurrency ? 'selected' : ''}>${dashboardV2Escape(currency)}</option>`).join('');
  select.hidden = currencies.length < 2;
  if (dashboardV2State.errors.pos) {
    body.insertAdjacentHTML('beforeend', `<div class="dash-chart-empty">${dashboardV2StateMarkup('dash_spend_load_failed', 'dash_module_error_body', 'pos')}</div>`);
    return;
  }
  const rows = dashboardV2State.derived.spendPOs.filter(row => String(row.currency || 'USD').toUpperCase() === dashboardV2State.selectedCurrency);
  const grouping = dashboardV2SpendGrouping(rows);
  const entries = Object.entries(grouping.groups).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) {
    body.insertAdjacentHTML('beforeend', `<div class="dash-chart-empty">${dashboardV2StateMarkup('dash_no_spend_data', 'dash_no_spend_data_body')}</div>`);
    if (summary) summary.textContent = dashboardV2T('dash_no_spend_data_body');
    return;
  }
  const colors = dashboardV2ChartColors();
  const palette = [colors.violet, colors.blue, colors.cyan, colors.green, colors.amber, colors.red, colors.text, colors.muted];
  const options = dashboardV2ChartBaseOptions();
  options.indexAxis = 'y';
  options.plugins.legend.display = false;
  options.scales = {
    x: {
      beginAtZero: true,
      grid: { color: colors.grid },
      ticks: { color: colors.muted, callback: value => dashboardV2FormatMoney(value, dashboardV2State.selectedCurrency), font: { size: 10 } }
    },
    y: { grid: { display: false }, ticks: { color: colors.text, font: { size: 11 } } }
  };
  options.onClick = (_, elements) => {
    if (!elements.length) return;
    dashboardV2Navigate('pos', { type: 'field', field: grouping.field, value: entries[elements[0].index][0], currency: dashboardV2State.selectedCurrency });
  };
  dashboardV2Charts.spend = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: entries.map(([label]) => label),
      datasets: [{
        label: dashboardV2T('po_spend'),
        data: entries.map(([, amount]) => amount),
        backgroundColor: entries.map((_, index) => palette[index % palette.length]),
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options
  });
  if (summary) {
    summary.textContent = entries.map(([label, amount]) => `${label}: ${dashboardV2FormatMoney(amount, dashboardV2State.selectedCurrency)}`).join('; ');
  }
}

function dashboardV2RenderOverdueTasks() {
  const card = document.getElementById('dash-overdue-tasks-card');
  if (!card) return;
  const rows = dashboardV2State.derived.overdueTasks.slice().sort((a, b) => {
    const aDue = dashboardV2LocalDate(a.due_date);
    const bDue = dashboardV2LocalDate(b.due_date);
    const aDays = aDue ? (dashboardV2State.derived.today - aDue) / DASH_V2_DAY_MS : 0;
    const bDays = bDue ? (dashboardV2State.derived.today - bDue) / DASH_V2_DAY_MS : 0;
    return bDays - aDays || dashboardV2PriorityRank(b.priority) - dashboardV2PriorityRank(a.priority) || aDue - bDue;
  });
  card.innerHTML = dashboardV2ModuleHeader('alert', 'dash_overdue_tasks', rows.length, 'var(--dash-red)', 'dash_view_all_tasks', 'overdue-tasks');
  if (dashboardV2State.errors.dashboard) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_tasks_load_failed', 'dash_module_error_body', 'dashboard'));
    return;
  }
  if (!rows.length) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_no_overdue_tasks', 'dash_no_overdue_tasks_body'));
    return;
  }
  card.insertAdjacentHTML('beforeend', `<div class="dash-list">${rows.slice(0, 5).map(task => {
    const due = dashboardV2LocalDate(task.due_date);
    const days = due ? Math.max(1, Math.floor((dashboardV2State.derived.today - due) / DASH_V2_DAY_MS)) : 0;
    return `
      <button type="button" class="dash-list-item" data-dash-action="record" data-view="tasks" data-id="${dashboardV2Attr(task.id)}">
        <span class="dash-list-main">
          <span class="dash-list-title">${dashboardV2Escape(task.title || task.id || '—')}</span>
          <span class="dash-list-sub">${dashboardV2Escape([task.id, task.assignee].filter(Boolean).join(' • ') || dashboardV2T('dash_unassigned'))}</span>
        </span>
        <span class="dash-list-side">
          <span class="dash-danger-text">${days} ${dashboardV2Escape(dashboardV2T('dash_days_overdue'))}</span>
          <span class="dash-priority" style="--dash-priority-color:${dashboardV2PriorityColor(task.priority)}">${dashboardV2Escape(task.priority || dashboardV2T('dash_no_priority'))}</span>
        </span>
      </button>`;
  }).join('')}</div>`);
}

function dashboardV2RenderOverduePOs() {
  const card = document.getElementById('dash-overdue-pos-card');
  if (!card) return;
  const rows = dashboardV2State.derived.overduePOs.slice().sort((a, b) => {
    return dashboardV2LocalDate(a.expected_delivery) - dashboardV2LocalDate(b.expected_delivery);
  });
  card.innerHTML = dashboardV2ModuleHeader('po', 'dash_overdue_pos', rows.length, 'var(--dash-amber)', 'dash_view_all_pos', 'overdue-pos');
  if (dashboardV2State.errors.pos) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_pos_load_failed', 'dash_module_error_body', 'pos'));
    return;
  }
  if (!rows.length) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_no_overdue_pos', 'dash_no_overdue_pos_body'));
    return;
  }
  card.insertAdjacentHTML('beforeend', `<div class="dash-list">${rows.slice(0, 5).map(po => {
    const due = dashboardV2LocalDate(po.expected_delivery || po.delivery_date);
    const days = due ? Math.max(1, Math.floor((dashboardV2State.derived.today - due) / DASH_V2_DAY_MS)) : 0;
    const currency = String(po.currency || 'USD').toUpperCase();
    return `
      <button type="button" class="dash-list-item" data-dash-action="record" data-view="pos" data-id="${dashboardV2Attr(po.id)}">
        <span class="dash-list-main">
          <span class="dash-list-title">${dashboardV2Escape(po.po_number || po.id || '—')}</span>
          <span class="dash-list-sub">${dashboardV2Escape(po.supplier || dashboardV2T('dash_unknown_vendor'))}</span>
        </span>
        <span class="dash-list-side">
          <span class="dash-danger-text">${days} ${dashboardV2Escape(dashboardV2T('dash_days_overdue'))}</span>
          <span class="dash-amount-text">${dashboardV2Escape(dashboardV2FormatMoney(dashboardV2POAmount(po), currency))}</span>
        </span>
      </button>`;
  }).join('')}</div>`);
}

function dashboardV2DeadlineLabel(type) {
  return {
    tasks: dashboardV2T('tasks'),
    pos: dashboardV2T('purchase_orders'),
    prs: dashboardV2T('dash_purchase_requests'),
    invoices: dashboardV2T('invoices'),
    milestones: dashboardV2T('milestones'),
    vendors: dashboardV2T('vendors')
  }[type] || type;
}

function dashboardV2RenderDeadlines() {
  const card = document.getElementById('dash-deadlines-card');
  if (!card) return;
  const allRows = dashboardV2State.derived.deadlines;
  const rows = dashboardV2State.deadlineFilter === 'all'
    ? allRows
    : allRows.filter(row => row.type === dashboardV2State.deadlineFilter);
  card.innerHTML = dashboardV2ModuleHeader('deadline', 'dash_upcoming_deadlines', allRows.length, 'var(--dash-cyan)');
  const filters = ['all', 'tasks', 'pos', 'prs', 'invoices', 'milestones'];
  card.insertAdjacentHTML('beforeend', `<div class="dash-deadline-filters dash-segmented" aria-label="${dashboardV2Attr(dashboardV2T('dash_deadline_filter'))}">
    ${filters.map(filter => `<button type="button" class="${filter === dashboardV2State.deadlineFilter ? 'active' : ''}" data-dash-action="deadline-filter" data-filter="${filter}" aria-pressed="${filter === dashboardV2State.deadlineFilter}">${dashboardV2Escape(filter === 'all' ? dashboardV2T('all') : dashboardV2DeadlineLabel(filter))}</button>`).join('')}
  </div>`);
  if (!rows.length) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_no_upcoming_deadlines', 'dash_no_upcoming_deadlines_body'));
    return;
  }
  card.insertAdjacentHTML('beforeend', `<div class="dash-list">${rows.slice(0, 8).map(item => `
    <button type="button" class="dash-list-item" data-dash-action="record" data-view="${dashboardV2Attr(item.view)}" data-id="${dashboardV2Attr(item.row.id)}">
      <span class="dash-list-main">
        <span class="dash-list-title">${dashboardV2Escape(item.label)}</span>
        <span class="dash-list-sub">${dashboardV2Escape(dashboardV2DeadlineLabel(item.type))} • ${dashboardV2Escape(item.row.id || '')}</span>
      </span>
      <span class="dash-list-side">${dashboardV2Escape(dashboardV2FormatDate(item.date, { weekday: 'short', day: '2-digit', month: 'short' }))}</span>
    </button>`).join('')}</div>`);
}

function dashboardV2RenderActivity() {
  const card = document.getElementById('dash-activity-card');
  if (!card) return;
  const rows = dashboardV2State.derived.activity.slice(0, 6);
  card.innerHTML = dashboardV2ModuleHeader('activity', 'dash_recent_activity', rows.length, 'var(--dash-blue)');
  if (!rows.length) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_no_recent_activity', 'dash_no_recent_activity_body'));
    return;
  }
  card.insertAdjacentHTML('beforeend', `<div class="dash-list">${rows.map(item => {
    const exact = dashboardV2Timestamp(item.timestamp)?.toLocaleString() || '';
    const initials = String(item.user || '?').split('@')[0].slice(0, 2).toUpperCase();
    return `
      <button type="button" class="dash-list-item" data-dash-action="record" data-view="${dashboardV2Attr(item.view)}" data-id="${dashboardV2Attr(item.id)}" title="${dashboardV2Attr(exact)}">
        <span class="dash-list-main">
          <span class="dash-list-title">${dashboardV2Escape(item.action)} ${dashboardV2Escape(item.record)}</span>
          <span class="dash-list-sub">${dashboardV2Escape(initials)}${item.summary ? ` • ${dashboardV2Escape(item.summary)}` : ''}</span>
        </span>
        <span class="dash-list-side">${dashboardV2Escape(dashboardV2RelativeTime(item.timestamp))}</span>
      </button>`;
  }).join('')}</div>`);
}

function dashboardV2RenderMilestones() {
  const card = document.getElementById('dash-milestones-card');
  if (!card) return;
  const rows = dashboardV2State.raw.milestones.slice().sort((a, b) => {
    const aDate = dashboardV2LocalDate(a.target_date);
    const bDate = dashboardV2LocalDate(b.target_date);
    return (aDate || Infinity) - (bDate || Infinity);
  }).slice(0, 5);
  card.innerHTML = dashboardV2ModuleHeader('milestone', 'dash_milestone_progress', rows.length, 'var(--dash-green)', 'view_all', 'all-milestones');
  if (dashboardV2State.errors.dashboard) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_milestones_load_failed', 'dash_module_error_body', 'dashboard'));
    return;
  }
  if (!rows.length) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_no_milestones', 'dash_no_milestones_body'));
    return;
  }
  card.insertAdjacentHTML('beforeend', `<div class="dash-list">${rows.map(row => {
    const progress = Math.min(100, Math.max(0, dashboardV2Number(row.completion_pct) || 0));
    return `
      <button type="button" class="dash-list-item" data-dash-action="record" data-view="milestones" data-id="${dashboardV2Attr(row.id)}">
        <span class="dash-list-main">
          <span class="dash-list-title">${dashboardV2Escape(row.milestone_name || row.project || row.id || '—')}</span>
          <span class="dash-list-sub">${dashboardV2Escape([row.project, row.owner, dashboardV2FormatDate(row.target_date)].filter(Boolean).join(' • '))}</span>
          <span class="dash-progress-row dash-progress-track"><span class="dash-progress-fill" style="width:${progress}%"></span></span>
        </span>
        <span class="dash-list-side"><span class="dash-amount-text">${progress}%</span>${dashboardV2Escape(row.status || '')}</span>
      </button>`;
  }).join('')}</div>`);
}

function dashboardV2CalendarDeadlines() {
  const raw = dashboardV2State.raw;
  const rows = [];
  const add = (collection, type, view, dateFields, labelFields) => {
    (collection || []).forEach(row => {
      const field = dateFields.find(key => row[key]);
      const date = field ? dashboardV2LocalDate(row[field]) : null;
      if (!date) return;
      rows.push({
        key: dashboardV2DateKey(date),
        date,
        type,
        view,
        row,
        label: labelFields.map(key => row[key]).find(Boolean) || row.id || dashboardV2T('dash_record')
      });
    });
  };
  add(raw.tasks, 'tasks', 'tasks', ['due_date'], ['title', 'id']);
  add(raw.pos, 'pos', 'pos', ['expected_delivery'], ['po_number', 'supplier', 'id']);
  add(raw.prs, 'prs', 'purchasereqs', ['required_by_date'], ['pr_number', 'description', 'id']);
  add(raw.invoices, 'invoices', 'invoices', ['due_date'], ['invoice_number', 'vendor', 'id']);
  add(raw.milestones, 'milestones', 'milestones', ['target_date'], ['milestone_name', 'project', 'id']);
  return rows;
}

function dashboardV2RenderCalendar() {
  const card = document.getElementById('dash-calendar-card');
  if (!card) return;
  const month = dashboardV2State.calendarMonth;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const deadlines = dashboardV2CalendarDeadlines();
  const deadlineKeys = new Set(deadlines.map(item => item.key));
  const todayKey = dashboardV2DateKey(dashboardV2Today());
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 7, 2 + index);
    return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-IQ' : undefined, { weekday: 'narrow' }).format(date);
  });
  const cells = [];
  for (let index = 0; index < firstWeekday; index++) cells.push('<span class="dash-calendar-day is-outside" aria-hidden="true"></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const key = dashboardV2DateKey(date);
    const classes = [
      'dash-calendar-day',
      key === todayKey ? 'is-today' : '',
      key === dashboardV2State.selectedCalendarDate ? 'is-selected' : '',
      deadlineKeys.has(key) ? 'has-deadline' : ''
    ].filter(Boolean).join(' ');
    cells.push(`<button type="button" class="${classes}" data-dash-action="calendar-day" data-date="${key}" aria-label="${dashboardV2Attr(date.toLocaleDateString(undefined, { dateStyle: 'full' }))}">${day}</button>`);
  }
  const selectedRows = dashboardV2State.selectedCalendarDate
    ? deadlines.filter(item => item.key === dashboardV2State.selectedCalendarDate)
    : [];
  card.innerHTML = `
    <div class="dash-calendar-toolbar">
      <strong>${dashboardV2Escape(month.toLocaleDateString(currentLang === 'ar' ? 'ar-IQ' : undefined, { month: 'long', year: 'numeric' }))}</strong>
      <div class="dash-calendar-nav">
        <button type="button" class="dash-icon-button" data-dash-action="calendar-prev" aria-label="${dashboardV2Attr(dashboardV2T('dash_previous_month'))}">‹</button>
        <button type="button" class="dash-icon-button" data-dash-action="calendar-next" aria-label="${dashboardV2Attr(dashboardV2T('dash_next_month'))}">›</button>
      </div>
    </div>
    <div class="dash-calendar-weekdays">${weekdayLabels.map(label => `<span>${dashboardV2Escape(label)}</span>`).join('')}</div>
    <div class="dash-calendar-grid" role="grid">${cells.join('')}</div>
    <div class="dash-calendar-selection">
      ${dashboardV2State.selectedCalendarDate
        ? selectedRows.length
          ? `<div class="dash-list">${selectedRows.slice(0, 4).map(item => `
              <button type="button" class="dash-list-item" data-dash-action="record" data-view="${dashboardV2Attr(item.view)}" data-id="${dashboardV2Attr(item.row.id)}">
                <span class="dash-list-main"><span class="dash-list-title">${dashboardV2Escape(item.label)}</span><span class="dash-list-sub">${dashboardV2Escape(dashboardV2DeadlineLabel(item.type))}</span></span>
              </button>`).join('')}</div>`
          : dashboardV2StateMarkup('dash_no_deadlines_day', 'dash_no_deadlines_day_body')
        : `<div class="dash-state"><span>${dashboardV2Escape(dashboardV2T('dash_select_calendar_day'))}</span></div>`}
    </div>`;
}

function dashboardV2TopVendors() {
  const currency = dashboardV2State.selectedCurrency;
  const groups = {};
  dashboardV2State.derived.spendPOs
    .filter(row => String(row.currency || 'USD').toUpperCase() === currency)
    .forEach(po => {
      const vendor = String(po.supplier || po.vendor || '').trim();
      if (!vendor) return;
      const stable = String(po.vendor_id || vendor.toLowerCase());
      if (!groups[stable]) groups[stable] = { name: vendor, amount: 0, count: 0, currency };
      groups[stable].amount += dashboardV2POAmount(po);
      groups[stable].count++;
    });
  return Object.values(groups).sort((a, b) => b.amount - a.amount).slice(0, 5);
}

function dashboardV2RenderVendors() {
  const card = document.getElementById('dash-vendors-card');
  if (!card) return;
  const rows = dashboardV2TopVendors();
  card.innerHTML = dashboardV2ModuleHeader('vendor', 'dash_top_vendors', rows.length, 'var(--dash-violet)', 'view_all', 'all-vendors');
  if (dashboardV2State.errors.pos) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_vendors_load_failed', 'dash_module_error_body', 'pos'));
    return;
  }
  if (!rows.length) {
    card.insertAdjacentHTML('beforeend', dashboardV2StateMarkup('dash_no_vendor_spend', 'dash_no_vendor_spend_body'));
    return;
  }
  const max = Math.max(...rows.map(row => row.amount), 1);
  card.insertAdjacentHTML('beforeend', rows.map(row => `
    <button type="button" class="dash-vendor-row" data-dash-action="vendor" data-vendor="${dashboardV2Attr(row.name)}">
      <span>
        <span class="dash-vendor-name">${dashboardV2Escape(row.name)}</span>
        <span class="dash-vendor-meta">${row.count} ${dashboardV2Escape(dashboardV2T(row.count === 1 ? 'dash_purchase_order' : 'dash_purchase_orders'))}</span>
      </span>
      <span class="dash-vendor-amount">${dashboardV2Escape(dashboardV2FormatMoney(row.amount, row.currency))}</span>
      <span class="dash-vendor-bar"><span style="width:${Math.round((row.amount / max) * 100)}%"></span></span>
    </button>`).join(''));
}

function dashboardV2SetRefreshState(isLoading) {
  const button = document.getElementById('dash-refresh-btn');
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
  button.setAttribute('aria-busy', String(isLoading));
}

function dashboardV2UpdateRefreshLabel() {
  const label = document.getElementById('dash-last-refresh');
  if (!label || !dashboardV2State.lastUpdatedAt) return;
  label.textContent = `${dashboardV2T('dash_updated')} ${dashboardV2RelativeTime(dashboardV2State.lastUpdatedAt)}`;
  label.title = dashboardV2State.lastUpdatedAt.toLocaleString();
}

async function refreshDashboardV2() {
  if (dashboardV2State.refreshing) return;
  const scrollHost = document.getElementById('main');
  const scrollTop = scrollHost?.scrollTop || 0;
  await loadDashboard(true);
  if (scrollHost) scrollHost.scrollTop = scrollTop;
}

function refreshChartsFromCache() {
  if (!dashboardV2State.raw.dashboard) return;
  requestAnimationFrame(() => dashboardV2RenderCharts());
}

function dashboardV2SelectCurrency(currency) {
  dashboardV2State.selectedCurrency = currency;
  sessionStorage.setItem('tt_dash_currency', currency);
  dashboardV2RenderSpendChart();
  dashboardV2RenderVendors();
}

function dashboardV2CreateTask() {
  if (!dashboardV2Can('can_edit_tasks', true)) return;
  navigateTo('tasks');
  setTimeout(() => {
    if (typeof openAddModal === 'function') openAddModal('Tasks');
  }, 120);
}

function dashboardV2NavigateTaskCategory(category) {
  const filters = {
    open: { type: 'statuses', values: ['open', 'not_started', 'pending'] },
    in_progress: { type: 'statuses', values: ['in_progress', 'in_review', 'blocked'] },
    completed: { type: 'statuses', values: ['done', 'completed', 'closed'] },
    overdue: { type: 'overdue' },
    other: { type: 'other-task-status' }
  };
  dashboardV2Navigate('tasks', filters[category] || null);
}

function dashboardV2Navigate(view, filter) {
  if (filter) dashboardV2PendingFilters[view] = filter;
  else delete dashboardV2PendingFilters[view];
  navigateTo(view);
  dashboardV2ApplyPendingFilter(view, 0);
}

function dashboardV2ApplyPendingFilter(view, attempt) {
  const filter = dashboardV2PendingFilters[view];
  if (!filter) return;
  const retry = () => {
    if (attempt < 8) setTimeout(() => dashboardV2ApplyPendingFilter(view, attempt + 1), 80);
  };
  if (view === 'tasks' || view === 'pos' || view === 'milestones' || view === 'expenses') {
    const sheet = { tasks: 'Tasks', pos: 'POs', milestones: 'Milestones', expenses: 'Expenses' }[view];
    const input = document.getElementById(`filter-${sheet}`);
    if (!input || typeof renderTable !== 'function') { retry(); return; }
    input.value = filter.type === 'record' ? filter.id || '' : '';
    renderTable(sheet);
    return;
  }
  if (view === 'purchasereqs') {
    if (typeof setPRFilter !== 'function' || !document.getElementById('pr-filter-tabs')) { retry(); return; }
    setPRFilter(filter.status || 'all');
    if (filter.id) {
      const input = document.getElementById('pr-search');
      if (input) input.value = filter.id;
      if (typeof renderPRTable === 'function') renderPRTable();
    }
    delete dashboardV2PendingFilters[view];
    return;
  }
  if (view === 'invoices') {
    const input = document.getElementById('inv-search');
    if (!input) { retry(); return; }
    input.value = filter.id || filter.value || '';
    if (typeof renderInvoiceTable === 'function') renderInvoiceTable();
    delete dashboardV2PendingFilters[view];
    return;
  }
  if (view === 'vendors') {
    const input = document.getElementById('vnd-search');
    if (!input) { retry(); return; }
    input.value = filter.value || '';
    if (typeof renderVendorGrid === 'function') renderVendorGrid();
    delete dashboardV2PendingFilters[view];
  }
}

function dashboardV2TableFilterMatches(sheetName, row) {
  const view = { Tasks: 'tasks', POs: 'pos', Milestones: 'milestones', Expenses: 'expenses' }[sheetName];
  const filter = dashboardV2PendingFilters[view];
  if (!filter) return true;
  if (filter.type === 'record') return String(row.id || '') === String(filter.id || '');
  if (filter.type === 'statuses') return filter.values.includes(dashboardV2NormalizeStatus(row.status));
  if (filter.type === 'overdue') return sheetName === 'Tasks' ? dashboardV2IsTaskOverdue(row) : dashboardV2IsPOOverdue(row);
  if (filter.type === 'other-task-status') {
    const known = ['open', 'not_started', 'pending', 'in_progress', 'in_review', 'blocked', 'done', 'completed', 'closed', 'overdue'];
    return !known.includes(dashboardV2NormalizeStatus(row.status));
  }
  if (filter.type === 'field') {
    const fieldMatches = String(row[filter.field] || dashboardV2T('other')).toLowerCase() === String(filter.value || '').toLowerCase();
    const currencyMatches = !filter.currency || String(row.currency || 'USD').toUpperCase() === filter.currency;
    return fieldMatches && currencyMatches;
  }
  return true;
}

function dashboardV2HandleAction(element) {
  const action = element.dataset.dashAction;
  if (action === 'open-tasks') dashboardV2NavigateTaskCategory('open');
  else if (action === 'overdue-tasks') dashboardV2NavigateTaskCategory('overdue');
  else if (action === 'all-prs') dashboardV2Navigate('purchasereqs');
  else if (action === 'all-pos') dashboardV2Navigate('pos');
  else if (action === 'all-expenses') dashboardV2Navigate('expenses');
  else if (action === 'all-milestones') dashboardV2Navigate('milestones');
  else if (action === 'all-vendors') dashboardV2Navigate('vendors');
  else if (action === 'overdue-pos') dashboardV2Navigate('pos', { type: 'overdue' });
  else if (action === 'pr-filter') dashboardV2Navigate('purchasereqs', { status: element.dataset.filter || 'all' });
  else if (action === 'range') {
    dashboardV2State.range = element.dataset.range || '7d';
    sessionStorage.setItem('tt_dash_range', dashboardV2State.range);
    dashboardV2RenderRangeControl();
    dashboardV2RenderTrendChart();
  } else if (action === 'deadline-filter') {
    dashboardV2State.deadlineFilter = element.dataset.filter || 'all';
    dashboardV2RenderDeadlines();
  } else if (action === 'calendar-prev' || action === 'calendar-next') {
    const offset = action === 'calendar-prev' ? -1 : 1;
    const month = dashboardV2State.calendarMonth;
    dashboardV2State.calendarMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    dashboardV2RenderCalendar();
  } else if (action === 'calendar-day') {
    dashboardV2State.selectedCalendarDate = element.dataset.date || '';
    dashboardV2RenderCalendar();
  } else if (action === 'record') {
    const view = element.dataset.view || 'dashboard';
    const id = element.dataset.id || '';
    if (view === 'purchasereqs') dashboardV2Navigate(view, { status: 'all', id });
    else dashboardV2Navigate(view, { type: 'record', id });
  } else if (action === 'vendor') {
    dashboardV2Navigate('vendors', { value: element.dataset.vendor || '' });
  } else if (action === 'retry') {
    refreshDashboardV2();
  }
}

function dashboardV2BindEvents() {
  if (dashboardV2EventsBound) return;
  dashboardV2EventsBound = true;
  const root = document.getElementById('dashboard-v2-root');
  const search = document.getElementById('global-search-input');
  root?.addEventListener('click', event => {
    const target = event.target.closest('[data-dash-action]');
    if (target) dashboardV2HandleAction(target);
  });
  root?.addEventListener('keydown', event => {
    const dayButton = event.target.closest('.dash-calendar-day[data-date]');
    if (!dayButton || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const isRTL = document.documentElement.dir === 'rtl';
    const offsets = {
      ArrowLeft: isRTL ? 1 : -1,
      ArrowRight: isRTL ? -1 : 1,
      ArrowUp: -7,
      ArrowDown: 7
    };
    const current = dashboardV2LocalDate(dayButton.dataset.date);
    if (!current) return;
    current.setDate(current.getDate() + offsets[event.key]);
    dashboardV2State.calendarMonth = new Date(current.getFullYear(), current.getMonth(), 1);
    dashboardV2State.selectedCalendarDate = dashboardV2DateKey(current);
    dashboardV2RenderCalendar();
    requestAnimationFrame(() => {
      document.querySelector(`.dash-calendar-day[data-date="${dashboardV2State.selectedCalendarDate}"]`)?.focus();
    });
  });
  search?.addEventListener('keydown', dashboardV2SearchKeydown);
  document.addEventListener('keydown', event => {
    const tag = document.activeElement?.tagName;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      event.preventDefault();
      search?.focus();
    }
  });
  document.addEventListener('click', event => {
    const searchWrap = document.querySelector('.dash-global-search');
    if (searchWrap && !searchWrap.contains(event.target)) closeSearchResults();
  });
}

function dashboardV2SearchDatasets() {
  const raw = dashboardV2State.raw;
  const datasets = [
    {
      key: 'tasks',
      label: dashboardV2T('tasks'),
      rows: raw.tasks.length ? raw.tasks : (typeof tableData !== 'undefined' ? tableData.Tasks || [] : []),
      fields: ['title', 'assignee', 'project', 'id'],
      title: row => row.title || row.id,
      sub: row => [row.id, row.assignee, row.project].filter(Boolean).join(' • '),
      view: 'tasks'
    },
    {
      key: 'pos',
      label: dashboardV2T('purchase_orders'),
      rows: raw.pos.length ? raw.pos : (typeof tableData !== 'undefined' ? tableData.POs || [] : []),
      fields: ['po_number', 'supplier', 'item_description', 'id'],
      title: row => row.po_number || row.id,
      sub: row => [row.supplier, row.item_description].filter(Boolean).join(' • '),
      view: 'pos'
    },
    {
      key: 'prs',
      label: dashboardV2T('dash_purchase_requests'),
      rows: raw.prs.length ? raw.prs : (typeof _allPRs !== 'undefined' ? _allPRs : []),
      fields: ['pr_number', 'requested_by', 'department', 'description', 'id'],
      title: row => row.pr_number || row.id,
      sub: row => [row.requested_by, row.department, row.description].filter(Boolean).join(' • '),
      view: 'purchasereqs'
    },
    {
      key: 'invoices',
      label: dashboardV2T('invoices'),
      rows: raw.invoices.length ? raw.invoices : (typeof _allInvoices !== 'undefined' ? _allInvoices : []),
      fields: ['invoice_number', 'vendor', 'supplier', 'id'],
      title: row => row.invoice_number || row.id,
      sub: row => row.vendor || row.supplier || '',
      view: 'invoices'
    },
    {
      key: 'vendors',
      label: dashboardV2T('vendors'),
      rows: raw.vendors.length ? raw.vendors : (typeof _allVendors !== 'undefined' ? _allVendors : []),
      fields: ['vendor_name', 'category', 'email', 'phone', 'id'],
      title: row => row.vendor_name || row.id,
      sub: row => [row.category, row.email, row.phone].filter(Boolean).join(' • '),
      view: 'vendors'
    }
  ];
  return datasets;
}

function handleGlobalSearch(query) {
  clearTimeout(handleGlobalSearch._timer);
  const value = String(query || '').trim();
  if (value.length < 2) {
    closeSearchResults();
    return;
  }
  handleGlobalSearch._timer = setTimeout(() => dashboardV2RunSearch(value), 250);
}

function dashboardV2RunSearch(query) {
  const normalized = query.toLowerCase();
  const groups = dashboardV2SearchDatasets().map(dataset => {
    const rows = dataset.rows.filter(row => dataset.fields.some(field => String(row[field] || '').toLowerCase().includes(normalized))).slice(0, 5);
    return { ...dataset, rows };
  }).filter(group => group.rows.length);
  dashboardV2SearchResults = [];
  const panel = document.getElementById('global-search-results');
  if (!panel) return;
  if (!groups.length) {
    panel.innerHTML = `<div class="dash-state">${dashboardV2Icon('search', 22)}<strong>${dashboardV2Escape(dashboardV2T('dash_no_search_results'))}</strong><span>${dashboardV2Escape(dashboardV2T('dash_try_another_search'))}</span></div>`;
    panel.classList.add('is-open');
    return;
  }
  panel.innerHTML = groups.map(group => `
    <section class="dash-search-group">
      <div class="dash-search-group-label">${dashboardV2Escape(group.label)}</div>
      ${group.rows.map(row => {
        const index = dashboardV2SearchResults.length;
        dashboardV2SearchResults.push({ group, row });
        return `
          <button type="button" class="dash-search-result" role="option" data-search-index="${index}">
            <span class="dash-search-result-icon">${dashboardV2Icon(group.key === 'prs' ? 'po' : group.key === 'vendors' ? 'vendor' : group.key === 'tasks' ? 'tasks' : 'search', 14)}</span>
            <span><strong>${dashboardV2Escape(group.title(row) || '—')}</strong><span>${dashboardV2Escape(group.sub(row) || group.label)}</span></span>
          </button>`;
      }).join('')}
    </section>`).join('');
  panel.querySelectorAll('[data-search-index]').forEach(button => {
    button.addEventListener('click', () => dashboardV2OpenSearchResult(Number(button.dataset.searchIndex)));
  });
  dashboardV2SearchIndex = 0;
  dashboardV2UpdateSearchSelection();
  panel.classList.add('is-open');
}

function dashboardV2SearchKeydown(event) {
  if (!dashboardV2SearchResults.length) {
    if (event.key === 'Escape') closeSearchResults();
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    dashboardV2SearchIndex = (dashboardV2SearchIndex + 1) % dashboardV2SearchResults.length;
    dashboardV2UpdateSearchSelection();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    dashboardV2SearchIndex = (dashboardV2SearchIndex - 1 + dashboardV2SearchResults.length) % dashboardV2SearchResults.length;
    dashboardV2UpdateSearchSelection();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    dashboardV2OpenSearchResult(dashboardV2SearchIndex);
  } else if (event.key === 'Escape') {
    closeSearchResults();
  }
}

function dashboardV2UpdateSearchSelection() {
  const panel = document.getElementById('global-search-results');
  panel?.querySelectorAll('[data-search-index]').forEach(button => {
    const active = Number(button.dataset.searchIndex) === dashboardV2SearchIndex;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    if (active) button.scrollIntoView({ block: 'nearest' });
  });
}

function dashboardV2OpenSearchResult(index) {
  const item = dashboardV2SearchResults[index];
  if (!item) return;
  closeSearchResults();
  const input = document.getElementById('global-search-input');
  if (input) input.value = '';
  const id = item.row.id || '';
  if (item.group.view === 'purchasereqs') dashboardV2Navigate('purchasereqs', { status: 'all', id });
  else if (item.group.view === 'vendors') dashboardV2Navigate('vendors', { value: item.row.vendor_name || id });
  else if (item.group.view === 'invoices') dashboardV2Navigate('invoices', { id: item.row.invoice_number || id });
  else dashboardV2Navigate(item.group.view, { type: 'record', id });
}

function closeSearchResults() {
  const panel = document.getElementById('global-search-results');
  if (panel) panel.classList.remove('is-open');
  dashboardV2SearchResults = [];
  dashboardV2SearchIndex = -1;
}

document.addEventListener('DOMContentLoaded', () => {
  dashboardV2BindEvents();
  setGreeting();
  const refresh = document.getElementById('dash-refresh-btn');
  if (refresh) refresh.setAttribute('aria-label', dashboardV2T('refresh'));
});
