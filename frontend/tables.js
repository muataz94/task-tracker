function escapeAttr(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SHEET_FIELDS = {
  Tasks: [
    { key: 'title',    label: 'Title',    type: 'text',     required: true },
    { key: 'status',   label: 'Status',   type: 'select',   options: ['open','in_progress','done','overdue'], required: true },
    { key: 'priority', label: 'Priority', type: 'select',   options: ['low','medium','high'], required: true },
    { key: 'assignee', label: 'Assignee', type: 'datalist', sources: [['Tasks','assignee'], ['Users','name'], ['Users','email']] },
    { key: 'due_date', label: 'Due Date', type: 'date' },
    { key: 'project',  label: 'Project',  type: 'datalist', sources: [['Tasks','project'], ['Milestones','project']], required: true }
  ],
  POs: [
    { key: 'po_number',         label: 'PO Number',         type: 'text',     required: true },
    { key: 'supplier',          label: 'Supplier',          type: 'datalist', sources: [['POs','supplier']],         required: true },
    { key: 'item_description',  label: 'Description',       type: 'datalist', sources: [['POs','item_description']] },
    { key: 'quantity',          label: 'Quantity',          type: 'number' },
    { key: 'unit_price',        label: 'Unit Price',        type: 'number' },
    { key: 'currency',          label: 'Currency',          type: 'select',   options: ['USD','IQD','EUR'] },
    { key: 'status',            label: 'Status',            type: 'select',   options: ['draft','submitted','received','cancelled'] },
    { key: 'expected_delivery', label: 'Expected Delivery', type: 'date' }
  ],
  Milestones: [
    { key: 'project',        label: 'Project',    type: 'datalist', sources: [['Tasks','project'], ['Milestones','project']], required: true },
    { key: 'milestone_name', label: 'Milestone',  type: 'text',     required: true },
    { key: 'owner',          label: 'Owner',      type: 'datalist', sources: [['Users','name'], ['Users','email'], ['Milestones','owner']] },
    { key: 'start_date',     label: 'Start Date', type: 'date' },
    { key: 'target_date',    label: 'Target Date',type: 'date' },
    { key: 'completion_pct', label: 'Progress %', type: 'number' },
    { key: 'status',         label: 'Status',     type: 'select',   options: ['not_started','in_progress','completed','blocked'] }
  ],
  Expenses: [
    { key: 'category',    label: 'Category',    type: 'datalist', sources: [['Expenses','category']],                                      required: true },
    { key: 'description', label: 'Description', type: 'datalist', sources: [['Expenses','description'], ['POs','item_description']] },
    { key: 'amount',      label: 'Amount',      type: 'number',   required: true },
    { key: 'currency',    label: 'Currency',    type: 'select',   options: ['USD','IQD','EUR'] },
    { key: 'date',        label: 'Date',        type: 'date' },
    { key: 'budget_line', label: 'Budget Line', type: 'datalist', sources: [['Expenses','budget_line']] },
    { key: 'approved_by', label: 'Approved By', type: 'datalist', sources: [['Users','name'], ['Users','email'], ['Expenses','approved_by']] }
  ]
};

// Collect unique non-empty values from tableData for datalist sources
function getDynamicOptions(field) {
  const seen = new Set();
  const opts = [];
  (field.sources || []).forEach(([sheet, col]) => {
    (tableData[sheet] || []).forEach(r => {
      const v = String(r[col] || '').trim();
      if (v && !seen.has(v)) { seen.add(v); opts.push(v); }
    });
  });
  return opts.sort((a, b) => a.localeCompare(b));
}

let currentSheet  = null;
let currentEditId = null;
let tableData     = {};
let sortState     = { col: null, dir: 'asc' };

// ── Load table data from API
async function loadTable(sheetName) {
  currentSheet = sheetName;
  const wrap = document.getElementById('table-' + sheetName.toLowerCase());
  if (!wrap) return;
  wrap.innerHTML = '<p class="loading">Loading...</p>';
  try {
    // Warm Users cache for datalist options (fire-and-forget)
    if (!tableData['Users']) {
      getAll('Users').then(r => { tableData['Users'] = r.rows || []; }).catch(() => {});
    }
    const result = await getAll(sheetName);
    tableData[sheetName] = result.rows || [];
    renderTable(sheetName);
  } catch (e) {
    wrap.innerHTML = '<p class="error">Failed to load: ' + e.message + '</p>';
  }
}

// ── Render the table
function renderTable(sheetName) {
  const rows   = tableData[sheetName] || [];
  const fields = SHEET_FIELDS[sheetName];
  const wrap   = document.getElementById('table-' + sheetName.toLowerCase());
  if (!wrap) return;

  const filterEl  = document.getElementById('filter-' + sheetName);
  const filterVal = filterEl ? filterEl.value.toLowerCase() : '';

  const filtered = rows.filter(row =>
    fields.some(f => String(row[f.key] || '').toLowerCase().includes(filterVal))
  );

  if (!rows.length) {
    wrap.innerHTML = '<p class="empty">No records yet. Click + Add to create one.</p>';
    return;
  }

  let html = `
    <div class="table-toolbar">
      <input id="filter-${sheetName}" type="text" placeholder="Search..."
        value="${filterVal}" oninput="renderTable('${sheetName}')" class="filter-input" />
      <span class="row-count">${filtered.length} of ${rows.length} records</span>
      <button class="refresh-btn" onclick="refreshTable('${sheetName}')" title="Refresh">
        <svg class="refresh-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            ${fields.map(f => `
              <th onclick="sortTable('${sheetName}','${f.key}')">
                ${f.label} ${getSortIcon(f.key)}
              </th>`).join('')}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length ? filtered.map(row => `
            <tr>
              ${fields.map(f => `<td>${formatCell(f, row[f.key])}</td>`).join('')}
              <td class="actions-cell">
                <button class="btn-edit"
                  data-sheet="${escapeAttr(sheetName)}" data-id="${escapeAttr(row.id)}"
                  onclick="openEditModal(this.dataset.sheet, this.dataset.id)">Edit</button>
                <button class="btn-delete"
                  data-sheet="${escapeAttr(sheetName)}" data-id="${escapeAttr(row.id)}"
                  onclick="confirmDelete(this.dataset.sheet, this.dataset.id)">Delete</button>
              </td>
            </tr>`).join('') : `
            <tr>
              <td colspan="${fields.length + 1}" style="text-align:center;color:#94a3b8;padding:1.5rem;">
                No results match your search.
              </td>
            </tr>`}
        </tbody>
      </table>
    </div>`;

  wrap.innerHTML = html;
}

// ── Format cell display
function formatCell(field, value) {
  if (value === null || value === undefined || value === '') {
    return '<span class="empty-cell">—</span>';
  }
  // Handle Date objects (e.g. from Google Sheets serialization)
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (field.key === 'status' || field.key === 'priority') {
    return `<span class="badge badge-${value}">${String(value).replace(/_/g,' ')}</span>`;
  }
  if (field.key === 'completion_pct') {
    const pct = Math.min(Math.max(parseInt(value) || 0, 0), 100);
    return `
      <div style="display:flex;align-items:center;gap:6px;">
        <div class="mini-progress"><div style="width:${pct}%"></div></div>
        <span style="font-size:11px;color:var(--text-3);">${pct}%</span>
      </div>`;
  }
  if (field.type === 'date' && value) {
    return String(value).split('T')[0];
  }
  if (field.type === 'number') {
    return Number(value).toLocaleString();
  }
  return String(value);
}

// ── Sort icon
function getSortIcon(col) {
  if (sortState.col !== col) return '<span class="sort-icon">↕</span>';
  return sortState.dir === 'asc'
    ? '<span class="sort-icon asc">↑</span>'
    : '<span class="sort-icon desc">↓</span>';
}

// ── Sort table by column
function sortTable(sheetName, col) {
  sortState = sortState.col === col
    ? { col, dir: sortState.dir === 'asc' ? 'desc' : 'asc' }
    : { col, dir: 'asc' };
  tableData[sheetName].sort((a, b) => {
    const va = String(a[col] || '');
    const vb = String(b[col] || '');
    return sortState.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  renderTable(sheetName);
}

// ── Open Add modal
function openAddModal(sheetName) {
  currentEditId = null;
  currentSheet  = sheetName;
  document.getElementById('modal-title').textContent = 'Add ' + sheetName.slice(0, -1);
  buildModalForm(sheetName, {});
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// ── Open Edit modal
function openEditModal(sheetName, id) {
  currentEditId = id;
  currentSheet  = sheetName;
  const row = (tableData[sheetName] || []).find(r => String(r.id) === String(id));
  if (!row) return;
  document.getElementById('modal-title').textContent = 'Edit ' + sheetName.slice(0, -1);
  buildModalForm(sheetName, row);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// ── Build modal form fields dynamically
function buildModalForm(sheetName, data) {
  const fields = SHEET_FIELDS[sheetName];
  const body   = document.getElementById('modal-body');
  const prefs  = JSON.parse(localStorage.getItem('tt_prefs') || '{}');
  body.innerHTML = fields.map(f => {
    let val = data[f.key] !== undefined ? data[f.key] : '';
    // Apply defaults from prefs for new (empty) records
    if (!val && sheetName === 'Tasks') {
      if (f.key === 'assignee' && prefs.defaultAssignee) val = prefs.defaultAssignee;
      if (f.key === 'project'  && prefs.defaultProject)  val = prefs.defaultProject;
    }
    // Handle Date objects
    if (val instanceof Date) val = val.toISOString().split('T')[0];
    if (f.type === 'select') {
      const opts = f.options.map(o =>
        `<option value="${o}" ${String(val) === o ? 'selected' : ''}>${o.replace(/_/g,' ')}</option>`
      ).join('');
      return `
        <div class="form-group">
          <label>${f.label}${f.required ? ' <span class="req">*</span>' : ''}</label>
          <select name="${f.key}">${opts}</select>
        </div>`;
    }
    if (f.type === 'datalist') {
      const dlId   = 'dl-' + f.key + '-' + sheetName;
      const dlOpts = getDynamicOptions(f).map(o => `<option value="${escapeAttr(o)}">`).join('');
      return `
        <div class="form-group">
          <label>${f.label}${f.required ? ' <span class="req">*</span>' : ''}</label>
          <input type="text" name="${f.key}" value="${escapeAttr(val)}"
            list="${dlId}" autocomplete="off" ${f.required ? 'required' : ''} />
          <datalist id="${dlId}">${dlOpts}</datalist>
        </div>`;
    }
    return `
      <div class="form-group">
        <label>${f.label}${f.required ? ' <span class="req">*</span>' : ''}</label>
        <input type="${f.type || 'text'}" name="${f.key}"
          value="${escapeAttr(val)}" ${f.required ? 'required' : ''} />
      </div>`;
  }).join('');
}

// ── Save modal (add or update)
async function saveModal() {
  const fields  = SHEET_FIELDS[currentSheet];
  const body    = document.getElementById('modal-body');
  const payload = {};

  for (const f of fields) {
    const el = body.querySelector(`[name="${f.key}"]`);
    if (!el) continue;
    if (f.required && !el.value.trim()) {
      el.classList.add('invalid');
      el.focus();
      return;
    }
    el.classList.remove('invalid');
    payload[f.key] = el.value;
  }

  const saveBtn = document.getElementById('modal-save');
  saveBtn.textContent = 'Saving…';
  saveBtn.disabled    = true;

  try {
    if (currentEditId) {
      await updateRow(currentSheet, currentEditId, payload);
      const idx = (tableData[currentSheet] || []).findIndex(r => String(r.id) === String(currentEditId));
      if (idx > -1) {
        tableData[currentSheet][idx] = { ...tableData[currentSheet][idx], ...payload };
      }
    } else {
      const result = await addRow(currentSheet, payload);
      payload.id   = result.id;
      if (!tableData[currentSheet]) tableData[currentSheet] = [];
      tableData[currentSheet].push(payload);
    }
    closeModal();
    renderTable(currentSheet);
  } catch (e) {
    alert('Save failed: ' + e.message);
  } finally {
    saveBtn.textContent = 'Save';
    saveBtn.disabled    = false;
  }
}

// ── Confirm and delete
async function confirmDelete(sheetName, id) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  try {
    await deleteRow(sheetName, id);
    tableData[sheetName] = (tableData[sheetName] || []).filter(r => String(r.id) !== String(id));
    renderTable(sheetName);
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
}

// ── Close modal
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  currentEditId = null;
}

// ── Refresh table data (clears cache and reloads)
async function refreshTable(sheetName) {
  try {
    const result = await getAll(sheetName, true);
    tableData[sheetName] = result.rows || [];
    renderTable(sheetName);
  } catch (e) {
    alert('Refresh failed: ' + e.message);
  }
}