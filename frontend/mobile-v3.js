// Mobile App V3 presentation layer. It renders phone-native cards from the
// same records used by the desktop tables and delegates mutations to the
// existing create/edit/delete workflows.

const mobileV3State = {
  taskFilter: 'all',
  prFilter: 'all',
};

function mobileV3T(key) {
  return typeof t === 'function' ? t(key) : key;
}

function mobileV3Escape(value) {
  if (typeof escapeHtml === 'function') return escapeHtml(value == null ? '' : value);
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mobileV3Attr(value) {
  return mobileV3Escape(value).replace(/`/g, '&#96;');
}

function mobileV3Normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function mobileV3Date(value) {
  if (!value) return null;
  const raw = String(value).split('T')[0];
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mobileV3Today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function mobileV3FormatDate(value) {
  const date = mobileV3Date(value);
  if (!date) return mobileV3T('no_date');
  return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
    month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  }).format(date);
}

function mobileV3FormatMoney(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return mobileV3T('not_available');
  try {
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency', currency: String(currency || 'IQD').toUpperCase(),
      maximumFractionDigits: String(currency || '').toUpperCase() === 'IQD' ? 0 : 2,
    }).format(amount);
  } catch (_) {
    return `${String(currency || 'IQD').toUpperCase()} ${amount.toLocaleString()}`;
  }
}

function mobileV3Initials(value) {
  return String(value || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}

function mobileV3StatusClass(value) {
  const status = mobileV3Normalize(value);
  if (['done', 'completed', 'received', 'approved', 'active', 'closed'].includes(status)) return 'is-success';
  if (['overdue', 'rejected', 'cancelled', 'blocked'].includes(status)) return 'is-danger';
  if (['in_progress', 'submitted', 'ordered', 'pending'].includes(status)) return 'is-progress';
  if (['draft', 'open', 'not_started', 'inactive'].includes(status)) return 'is-neutral';
  return 'is-accent';
}

function mobileV3StatusLabel(value) {
  const status = mobileV3Normalize(value || 'open');
  const translated = mobileV3T(status === 'done' ? 'completed' : status);
  return translated === status ? status.replace(/_/g, ' ') : translated;
}

function mobileV3IsCompleted(row) {
  return ['done', 'completed', 'closed', 'received'].includes(mobileV3Normalize(row.status));
}

function mobileV3IsOverdue(row, field = 'due_date') {
  const date = mobileV3Date(row[field]);
  return !mobileV3IsCompleted(row) && !!date && date < mobileV3Today();
}

function mobileV3Can(permission, fallback = true) {
  return typeof dashboardV2Can === 'function' ? dashboardV2Can(permission, fallback) : fallback;
}

function mobileV3SummaryItem(labelKey, value, tone, filter = '') {
  return `<button type="button" class="mobile-v3-summary-item ${tone}"${filter ? ` data-mobile-summary-filter="${mobileV3Attr(filter)}"` : ''}>
    <span class="mobile-v3-summary-dot" aria-hidden="true"></span>
    <strong>${mobileV3Escape(value)}</strong>
    <span>${mobileV3Escape(mobileV3T(labelKey))}</span>
  </button>`;
}

function mobileV3TaskRows() {
  const rows = typeof tableData !== 'undefined' ? (tableData.Tasks || []) : [];
  return rows.filter(row => typeof dashboardV2TableFilterMatches !== 'function' || dashboardV2TableFilterMatches('Tasks', row));
}

function renderMobileV3Tasks() {
  const summary = document.getElementById('mobile-v3-task-summary');
  const list = document.getElementById('mobile-v3-task-list');
  if (!summary || !list) return;
  const rows = mobileV3TaskRows();
  const counts = {
    open: rows.filter(row => ['open', 'not_started', 'pending', ''].includes(mobileV3Normalize(row.status))).length,
    in_progress: rows.filter(row => ['in_progress', 'in_review', 'blocked'].includes(mobileV3Normalize(row.status))).length,
    completed: rows.filter(mobileV3IsCompleted).length,
    overdue: rows.filter(row => mobileV3IsOverdue(row)).length,
  };
  summary.innerHTML = [
    mobileV3SummaryItem('open', counts.open, 'is-accent', 'all'),
    mobileV3SummaryItem('in_progress', counts.in_progress, 'is-progress', 'all'),
    mobileV3SummaryItem('completed', counts.completed, 'is-success', 'completed'),
    mobileV3SummaryItem('overdue', counts.overdue, 'is-danger', 'overdue'),
  ].join('');

  const projectSelect = document.getElementById('mobile-v3-task-project');
  if (projectSelect) {
    const selected = projectSelect.value;
    const projects = [...new Set(rows.map(row => row.project).filter(Boolean))].sort();
    projectSelect.innerHTML = `<option value="">${mobileV3Escape(mobileV3T('all_projects'))}</option>${projects.map(project => `<option value="${mobileV3Attr(project)}">${mobileV3Escape(project)}</option>`).join('')}`;
    projectSelect.value = projects.includes(selected) ? selected : '';
  }

  const query = (document.getElementById('mobile-v3-task-search')?.value || '').trim().toLowerCase();
  const project = projectSelect?.value || '';
  const from = document.getElementById('mobile-v3-task-from')?.value || '';
  const to = document.getElementById('mobile-v3-task-to')?.value || '';
  const today = mobileV3Today();
  const todayKey = today.toISOString().slice(0, 10);
  const filtered = rows.filter(row => {
    const status = mobileV3Normalize(row.status);
    const dateKey = row.due_date ? String(row.due_date).split('T')[0] : '';
    if (mobileV3State.taskFilter === 'today' && dateKey !== todayKey) return false;
    if (mobileV3State.taskFilter === 'overdue' && !mobileV3IsOverdue(row)) return false;
    if (mobileV3State.taskFilter === 'completed' && !mobileV3IsCompleted(row)) return false;
    if (query && ![row.title, row.assignee, row.id, row.project, row.category].join(' ').toLowerCase().includes(query)) return false;
    if (project && row.project !== project) return false;
    if (from && (!dateKey || dateKey < from)) return false;
    if (to && (!dateKey || dateKey > to)) return false;
    return !(mobileV3State.taskFilter === 'all' && status === '__never__');
  });
  list.innerHTML = filtered.length ? filtered.map(mobileV3TaskCard).join('') : mobileV3Empty('no_tasks_found');
  mobileV3SyncTaskFilterButtons();
  mobileV3ApplyPermissions();
}

function mobileV3TaskCard(row) {
  const status = mobileV3IsOverdue(row) ? 'overdue' : (row.status || 'open');
  const assignee = row.assignee || mobileV3T('unassigned');
  const priority = mobileV3Normalize(row.priority || 'normal');
  const id = mobileV3Attr(row.id);
  const reference = [row.project, row.category].filter(Boolean).join(' · ');
  return `<article class="mobile-v3-record mobile-v3-task-card priority-${mobileV3Attr(priority)}" data-record-id="${id}">
    <button type="button" class="mobile-v3-record-main" data-mobile-edit-sheet="Tasks" data-id="${id}">
      <span class="mobile-v3-priority" aria-label="${mobileV3Attr(mobileV3T('priority'))}: ${mobileV3Attr(mobileV3StatusLabel(priority))}"></span>
      <span class="mobile-v3-record-copy">
        <strong>${mobileV3Escape(row.title || mobileV3T('untitled_task'))}</strong>
        <span>${mobileV3Escape(reference || row.id || mobileV3T('task'))}</span>
      </span>
      <span class="mobile-v3-assignee"><span class="mobile-v3-avatar">${mobileV3Escape(mobileV3Initials(assignee))}</span><span>${mobileV3Escape(assignee)}</span></span>
      <span class="mobile-v3-date ${mobileV3IsOverdue(row) ? 'is-danger' : ''}">${mobileV3Escape(mobileV3FormatDate(row.due_date))}</span>
      <span class="mobile-v3-status ${mobileV3StatusClass(status)}">${mobileV3Escape(mobileV3StatusLabel(status))}</span>
    </button>
    <button type="button" class="mobile-v3-more" data-mobile-menu="${id}" aria-expanded="false" aria-label="${mobileV3Attr(mobileV3T('more_actions'))}">•••</button>
    <div class="mobile-v3-record-actions" hidden>
      <button type="button" data-mobile-edit-sheet="Tasks" data-id="${id}">${mobileV3Escape(mobileV3T('edit'))}</button>
      <button type="button" data-mobile-log-task="${id}">${mobileV3Escape(mobileV3T('log_time'))}</button>
      <button type="button" class="is-danger" data-mobile-delete-sheet="Tasks" data-id="${id}">${mobileV3Escape(mobileV3T('delete'))}</button>
    </div>
  </article>`;
}

function renderMobileV3POs() {
  const summary = document.getElementById('mobile-v3-po-summary');
  const list = document.getElementById('mobile-v3-po-list');
  if (!summary || !list) return;
  const rows = (typeof tableData !== 'undefined' ? (tableData.POs || []) : [])
    .filter(row => typeof dashboardV2TableFilterMatches !== 'function' || dashboardV2TableFilterMatches('POs', row));
  const overdue = rows.filter(row => mobileV3IsOverdue(row, 'expected_delivery'));
  summary.innerHTML = [
    mobileV3SummaryItem('draft', rows.filter(row => mobileV3Normalize(row.status) === 'draft').length, 'is-neutral'),
    mobileV3SummaryItem('submitted', rows.filter(row => mobileV3Normalize(row.status) === 'submitted').length, 'is-progress'),
    mobileV3SummaryItem('received', rows.filter(row => mobileV3Normalize(row.status) === 'received').length, 'is-success'),
    mobileV3SummaryItem('overdue', overdue.length, 'is-danger'),
  ].join('');
  const query = (document.getElementById('mobile-v3-po-search')?.value || '').trim().toLowerCase();
  const filter = document.getElementById('mobile-v3-po-status')?.value || '';
  const filtered = rows.filter(row => {
    if (filter === 'overdue' && !mobileV3IsOverdue(row, 'expected_delivery')) return false;
    if (filter && filter !== 'overdue' && mobileV3Normalize(row.status) !== filter) return false;
    return !query || [row.po_number, row.supplier, row.item_description, row.category, row.requester].join(' ').toLowerCase().includes(query);
  });
  list.innerHTML = filtered.length ? filtered.map(mobileV3POCard).join('') : mobileV3Empty('no_purchase_orders_found');
  mobileV3ApplyPermissions();
}

function mobileV3POCard(row) {
  const overdue = mobileV3IsOverdue(row, 'expected_delivery');
  const status = overdue ? 'overdue' : (row.status || 'draft');
  const id = mobileV3Attr(row.id);
  const amount = row.total_value ?? row.amount;
  return `<article class="mobile-v3-record" data-record-id="${id}">
    <button type="button" class="mobile-v3-record-main mobile-v3-procurement-main" data-mobile-edit-sheet="POs" data-id="${id}">
      <span class="mobile-v3-record-icon is-blue" aria-hidden="true">PO</span>
      <span class="mobile-v3-record-copy">
        <span class="mobile-v3-record-id">${mobileV3Escape(row.po_number || row.id || mobileV3T('purchase_order'))}</span>
        <strong>${mobileV3Escape(row.item_description || row.supplier || mobileV3T('purchase_order'))}</strong>
        <span>${mobileV3Escape(row.supplier || mobileV3T('vendor_not_set'))}</span>
        <span class="mobile-v3-date ${overdue ? 'is-danger' : ''}">${mobileV3Escape(mobileV3FormatDate(row.expected_delivery))}</span>
      </span>
      <span class="mobile-v3-record-side"><strong>${mobileV3Escape(mobileV3FormatMoney(amount, row.currency))}</strong><span class="mobile-v3-status ${mobileV3StatusClass(status)}">${mobileV3Escape(mobileV3StatusLabel(status))}</span></span>
      <span class="mobile-v3-chevron" aria-hidden="true">›</span>
    </button>
  </article>`;
}

function renderMobileV3PRs() {
  const summary = document.getElementById('mobile-v3-pr-summary');
  const list = document.getElementById('mobile-v3-pr-list');
  if (!summary || !list) return;
  const rows = typeof _allPRs !== 'undefined' ? _allPRs : [];
  const isOrdered = row => !!row.linked_po_ids || ['ordered', 'closed'].includes(mobileV3Normalize(row.status));
  summary.innerHTML = [
    mobileV3SummaryItem('draft', rows.filter(row => mobileV3Normalize(row.status) === 'draft').length, 'is-neutral'),
    mobileV3SummaryItem('submitted', rows.filter(row => ['submitted', 'pending', 'in_review'].includes(mobileV3Normalize(row.status))).length, 'is-progress'),
    mobileV3SummaryItem('approved', rows.filter(row => mobileV3Normalize(row.status) === 'approved' && !isOrdered(row)).length, 'is-success'),
    mobileV3SummaryItem('ordered', rows.filter(isOrdered).length, 'is-warning'),
  ].join('');
  const query = (document.getElementById('mobile-v3-pr-search')?.value || '').trim().toLowerCase();
  const filtered = rows.filter(row => {
    const status = mobileV3Normalize(row.status);
    if (mobileV3State.prFilter === 'pending' && !['draft', 'submitted', 'pending', 'in_review', 'awaiting_approval'].includes(status)) return false;
    if (mobileV3State.prFilter === 'approved' && !['approved', 'ordered', 'closed'].includes(status) && !row.linked_po_ids) return false;
    if (mobileV3State.prFilter === 'rejected' && !['rejected', 'cancelled'].includes(status)) return false;
    return !query || [row.pr_number, row.description, row.requested_by, row.department, row.id].join(' ').toLowerCase().includes(query);
  });
  list.innerHTML = filtered.length ? filtered.map(mobileV3PRCard).join('') : mobileV3Empty('no_purchase_requests_found');
  document.querySelectorAll('[data-mobile-pr-filter]').forEach(button => {
    const active = button.dataset.mobilePrFilter === mobileV3State.prFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  mobileV3ApplyPermissions();
}

function mobileV3PRCard(row) {
  const id = mobileV3Attr(row.id);
  const status = row.linked_po_ids ? 'ordered' : (row.status || 'draft');
  return `<article class="mobile-v3-record" data-record-id="${id}">
    <button type="button" class="mobile-v3-record-main mobile-v3-procurement-main" data-mobile-edit-pr="${id}">
      <span class="mobile-v3-record-icon ${mobileV3StatusClass(status)}" aria-hidden="true">PR</span>
      <span class="mobile-v3-record-copy">
        <span class="mobile-v3-record-id">${mobileV3Escape(row.pr_number || row.id || mobileV3T('purchase_request'))}</span>
        <strong>${mobileV3Escape(row.description || mobileV3T('purchase_request'))}</strong>
        <span>${mobileV3Escape(row.department || row.requested_by || mobileV3T('department_not_set'))}</span>
        <span class="mobile-v3-date">${mobileV3Escape(mobileV3FormatDate(row.required_by_date || row.created_at))}</span>
      </span>
      <span class="mobile-v3-record-side"><strong>${mobileV3Escape(mobileV3FormatMoney(row.total_estimated, row.currency))}</strong><span class="mobile-v3-status ${mobileV3StatusClass(status)}">${mobileV3Escape(mobileV3StatusLabel(status))}</span></span>
      <span class="mobile-v3-chevron" aria-hidden="true">›</span>
    </button>
  </article>`;
}

function renderMobileV3Vendors() {
  const list = document.getElementById('mobile-v3-vendor-list');
  if (!list) return;
  const rows = typeof _allVendors !== 'undefined' ? _allVendors : (window._allVendors || []);
  const query = (document.getElementById('mobile-v3-vendor-search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('mobile-v3-vendor-status')?.value || '';
  const filtered = rows.filter(row => {
    if (status && row.status !== status) return false;
    return !query || [row.vendor_name, row.category, row.contact_person, row.email, row.phone, row.location].join(' ').toLowerCase().includes(query);
  }).sort((a, b) => String(a.vendor_name || '').localeCompare(String(b.vendor_name || '')));
  list.innerHTML = filtered.length ? filtered.map(mobileV3VendorCard).join('') : mobileV3Empty('no_vendors_found');
  mobileV3ApplyPermissions();
}

function mobileV3VendorCard(row) {
  const id = mobileV3Attr(row.id);
  const status = row.status || 'Active';
  const details = [row.category, row.location, row.contact_person].filter(Boolean).join(' · ');
  return `<article class="mobile-v3-record" data-record-id="${id}">
    <button type="button" class="mobile-v3-record-main mobile-v3-vendor-main" data-mobile-edit-vendor="${id}">
      <span class="mobile-v3-vendor-avatar">${mobileV3Escape(mobileV3Initials(row.vendor_name))}</span>
      <span class="mobile-v3-record-copy">
        <strong>${mobileV3Escape(row.vendor_name || mobileV3T('vendor'))}</strong>
        <span>${mobileV3Escape(details || mobileV3T('vendor_details_unavailable'))}</span>
        <span>${mobileV3Escape(row.email || row.phone || mobileV3T('contact_not_set'))}</span>
      </span>
      <span class="mobile-v3-record-side"><span class="mobile-v3-status ${mobileV3StatusClass(status)}">${mobileV3Escape(mobileV3StatusLabel(status))}</span>${Number(row.performance_score) > 0 ? `<span class="mobile-v3-score">★ ${mobileV3Escape(Number(row.performance_score).toFixed(1))}</span>` : ''}</span>
      <span class="mobile-v3-chevron" aria-hidden="true">›</span>
    </button>
  </article>`;
}

function mobileV3Empty(key) {
  return `<div class="mobile-v3-empty"><span aria-hidden="true">◇</span><strong>${mobileV3Escape(mobileV3T(key))}</strong><p>${mobileV3Escape(mobileV3T('adjust_filters_or_create'))}</p></div>`;
}

function mobileV3SyncTaskFilterButtons() {
  document.querySelectorAll('[data-mobile-task-filter]').forEach(button => {
    const active = button.dataset.mobileTaskFilter === mobileV3State.taskFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function mobileV3ApplyPermissions() {
  const permissions = { Tasks: 'can_edit_tasks', POs: 'can_edit_pos', PRs: 'can_edit_prs', Vendors: 'can_edit_vendors' };
  document.querySelectorAll('[data-mobile-create]').forEach(button => {
    const allowed = mobileV3Can(permissions[button.dataset.mobileCreate]);
    button.hidden = !allowed;
  });
  document.querySelectorAll('[data-mobile-edit-sheet]').forEach(button => {
    const allowed = mobileV3Can(permissions[button.dataset.mobileEditSheet]);
    button.disabled = !allowed;
  });
  document.querySelectorAll('[data-mobile-edit-pr]').forEach(button => { button.disabled = !mobileV3Can('can_edit_prs'); });
  document.querySelectorAll('[data-mobile-edit-vendor]').forEach(button => { button.disabled = !mobileV3Can('can_edit_vendors'); });
  document.querySelectorAll('[data-mobile-log-task]').forEach(button => { button.hidden = !mobileV3Can('can_edit_tasks'); });
  document.querySelectorAll('[data-mobile-delete-sheet="Tasks"]').forEach(button => { button.hidden = !mobileV3Can('can_delete_tasks', false); });
}

function renderMobileV3Table(sheetName) {
  if (sheetName === 'Tasks') renderMobileV3Tasks();
  if (sheetName === 'POs') renderMobileV3POs();
}

function mobileV3ToggleAdvanced() {
  const panel = document.getElementById('mobile-v3-task-advanced');
  const button = document.getElementById('mobile-v3-task-filter-toggle');
  if (!panel || !button) return;
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !opening);
  button.setAttribute('aria-expanded', String(opening));
}

function mobileV3HandleClick(event) {
  const taskFilter = event.target.closest('[data-mobile-task-filter]');
  if (taskFilter) {
    mobileV3State.taskFilter = taskFilter.dataset.mobileTaskFilter;
    renderMobileV3Tasks();
    return;
  }
  const prFilter = event.target.closest('[data-mobile-pr-filter]');
  if (prFilter) {
    mobileV3State.prFilter = prFilter.dataset.mobilePrFilter;
    renderMobileV3PRs();
    return;
  }
  const summaryFilter = event.target.closest('[data-mobile-summary-filter]');
  if (summaryFilter) {
    mobileV3State.taskFilter = summaryFilter.dataset.mobileSummaryFilter;
    renderMobileV3Tasks();
    return;
  }
  const create = event.target.closest('[data-mobile-create]');
  if (create) {
    const type = create.dataset.mobileCreate;
    if (type === 'PRs' && typeof showPRModal === 'function') showPRModal(null);
    else if (type === 'Vendors' && typeof showVendorModal === 'function') showVendorModal(null);
    else if (typeof openAddModal === 'function') openAddModal(type);
    return;
  }
  const edit = event.target.closest('[data-mobile-edit-sheet]');
  if (edit && typeof openEditModal === 'function') {
    openEditModal(edit.dataset.mobileEditSheet, edit.dataset.id);
    return;
  }
  const editPR = event.target.closest('[data-mobile-edit-pr]');
  if (editPR && typeof showPRModal === 'function') {
    showPRModal(editPR.dataset.mobileEditPr);
    return;
  }
  const editVendor = event.target.closest('[data-mobile-edit-vendor]');
  if (editVendor && typeof showVendorModal === 'function') {
    showVendorModal(editVendor.dataset.mobileEditVendor);
    return;
  }
  const menu = event.target.closest('[data-mobile-menu]');
  if (menu) {
    const card = menu.closest('.mobile-v3-record');
    const actions = card?.querySelector('.mobile-v3-record-actions');
    const opening = !!actions?.hidden;
    document.querySelectorAll('.mobile-v3-record-actions').forEach(element => { element.hidden = true; });
    document.querySelectorAll('[data-mobile-menu]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (actions) actions.hidden = !opening;
    menu.setAttribute('aria-expanded', String(opening));
    return;
  }
  const logTask = event.target.closest('[data-mobile-log-task]');
  if (logTask && typeof logTaskTime === 'function') {
    logTaskTime(logTask.dataset.mobileLogTask);
    return;
  }
  const deleteButton = event.target.closest('[data-mobile-delete-sheet]');
  if (deleteButton && typeof confirmDelete === 'function') {
    confirmDelete(deleteButton.dataset.mobileDeleteSheet, deleteButton.dataset.id);
  }
}

function initMobileV3() {
  document.addEventListener('click', mobileV3HandleClick);
  document.getElementById('mobile-v3-task-filter-toggle')?.addEventListener('click', mobileV3ToggleAdvanced);
  document.getElementById('mobile-v3-task-clear')?.addEventListener('click', () => {
    ['mobile-v3-task-project', 'mobile-v3-task-from', 'mobile-v3-task-to'].forEach(id => {
      const control = document.getElementById(id);
      if (control) control.value = '';
    });
    renderMobileV3Tasks();
  });
  [
    ['mobile-v3-task-search', 'input', renderMobileV3Tasks],
    ['mobile-v3-task-project', 'change', renderMobileV3Tasks],
    ['mobile-v3-task-from', 'change', renderMobileV3Tasks],
    ['mobile-v3-task-to', 'change', renderMobileV3Tasks],
    ['mobile-v3-po-search', 'input', renderMobileV3POs],
    ['mobile-v3-po-status', 'change', renderMobileV3POs],
    ['mobile-v3-pr-search', 'input', renderMobileV3PRs],
    ['mobile-v3-vendor-search', 'input', renderMobileV3Vendors],
    ['mobile-v3-vendor-status', 'change', renderMobileV3Vendors],
  ].forEach(([id, type, handler]) => document.getElementById(id)?.addEventListener(type, handler));
  mobileV3ApplyPermissions();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMobileV3, { once: true });
else initMobileV3();
