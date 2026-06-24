// ─── Purchase Requests ───────────────────────────────────────────────────────

let _allPRs     = [];
let _editingPRId = null;
let _prFilter   = 'all';

const PR_STATUSES   = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Closed'];
const PR_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const PR_CURRENCIES = ['IQD', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];
const PR_UNITS      = ['pcs', 'box', 'set', 'kg', 'm', 'roll', 'ltr', 'sqm'];

// ── Status helpers ─────────────────────────────────────────────────────────
function prStatusColor(s) {
  return {
    Draft:'#6b7280', Submitted:'#3b82f6', Approved:'#10b981',
    Rejected:'#ef4444', Closed:'#a78bfa'
  }[s] || '#6b7280';
}
function prStatusBg(s) {
  return {
    Draft:'rgba(107,114,128,0.15)', Submitted:'rgba(59,130,246,0.15)',
    Approved:'rgba(16,185,129,0.15)', Rejected:'rgba(239,68,68,0.15)',
    Closed:'rgba(167,139,250,0.15)'
  }[s] || 'rgba(107,114,128,0.15)';
}
function prPriorityColor(p) {
  return { Low:'#10b981', Medium:'#f59e0b', High:'#ef4444', Urgent:'#dc2626' }[p] || '#6b7280';
}

// ── Load PRs ───────────────────────────────────────────────────────────────
async function loadPRs() {
  const wrap = document.getElementById('pr-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="filter-bar glass" style="margin-bottom:1rem;">
      <div class="inv-filter-tabs" id="pr-filter-tabs">
        ${['all','Draft','Submitted','Approved','Rejected','Closed'].map(s => `
          <button class="inv-filter-btn${_prFilter===s?' active':''}" onclick="setPRFilter('${s}')">${s==='all'?'All':s}</button>
        `).join('')}
      </div>
      <div style="flex:1;min-width:0;"></div>
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="pr-search" placeholder="Search purchase requests…" class="filter-input" oninput="renderPRTable()"/>
      </div>
      <button class="btn-primary" style="font-size:12px;padding:6px 14px;" onclick="showPRModal(null)">+ New PR</button>
      <span class="row-count" id="pr-row-count"></span>
    </div>
    <div id="pr-table-wrap"></div>`;

  try {
    const res = await callAPI('getPRs');
    _allPRs   = res.rows || [];
    renderPRTable();
    const sub = document.getElementById('pr-subtitle');
    if (sub) sub.textContent = _allPRs.length + ' request' + (_allPRs.length !== 1 ? 's' : '');
  } catch(e) {
    const tw = document.getElementById('pr-table-wrap');
    if (tw) tw.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--accent-red);">Failed to load: ${escapeHtml(e.message)}</div>`;
  }
}

function setPRFilter(f) {
  _prFilter = f;
  document.querySelectorAll('#pr-filter-tabs .inv-filter-btn').forEach(b => b.classList.remove('active'));
  const btn = [...document.querySelectorAll('#pr-filter-tabs .inv-filter-btn')].find(b => b.textContent === (f==='all'?'All':f));
  if (btn) btn.classList.add('active');
  renderPRTable();
}

function renderPRTable() {
  const wrap = document.getElementById('pr-table-wrap');
  if (!wrap) return;
  const q = (document.getElementById('pr-search')?.value || '').toLowerCase();

  let rows = _allPRs;
  if (_prFilter !== 'all') rows = rows.filter(p => p.status === _prFilter);
  if (q) rows = rows.filter(p =>
    (p.pr_number||'').toLowerCase().includes(q) ||
    (p.description||'').toLowerCase().includes(q) ||
    (p.requested_by||'').toLowerCase().includes(q) ||
    (p.department||'').toLowerCase().includes(q)
  );

  const countEl = document.getElementById('pr-row-count');
  if (countEl) countEl.textContent = rows.length + ' result' + (rows.length !== 1 ? 's' : '');

  if (!rows.length) {
    wrap.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--text-3);">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;opacity:0.4">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>
      </svg>
      <div style="font-size:14px;font-weight:500;margin-bottom:6px;">No purchase requests</div>
      <div style="font-size:12px;margin-bottom:16px;">Create your first PR to get started</div>
      <button class="btn-primary" onclick="showPRModal(null)">+ New Purchase Request</button>
    </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>PR Number</th>
          <th>Description</th>
          <th>Requested By</th>
          <th>Dept</th>
          <th>Priority</th>
          <th>Status</th>
          <th style="text-align:right">Total Est.</th>
          <th>Required By</th>
          <th>Linked PO</th>
          <th style="width:100px;"></th>
        </tr></thead>
        <tbody>
          ${rows.map(pr => `
            <tr style="cursor:pointer;" onclick="showPRModal('${escapeHtml(pr.id)}')">
              <td style="font-weight:600;color:var(--accent);font-size:12px;">${escapeHtml(pr.pr_number||'—')}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${escapeHtml(pr.description||'—')}</td>
              <td style="font-size:12px;">${escapeHtml(pr.requested_by||'—')}</td>
              <td style="font-size:12px;color:var(--text-3);">${escapeHtml(pr.department||'—')}</td>
              <td>
                <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;background:${prPriorityColor(pr.priority)}20;color:${prPriorityColor(pr.priority)};">
                  ${escapeHtml(pr.priority||'—')}
                </span>
              </td>
              <td>
                <span class="inv-status-badge" style="background:${prStatusBg(pr.status)};color:${prStatusColor(pr.status)};font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;">
                  ${escapeHtml(pr.status||'Draft')}
                </span>
              </td>
              <td style="text-align:right;font-size:12px;font-weight:600;">
                ${pr.total_estimated ? (pr.currency||'IQD') + ' ' + parseFloat(pr.total_estimated).toLocaleString() : '—'}
              </td>
              <td style="font-size:12px;color:var(--text-3);">${escapeHtml(pr.required_by_date||'—')}</td>
              <td style="font-size:11px;color:var(--text-3);">${pr.linked_po_ids ? `<span style="color:var(--accent);">Linked</span>` : '—'}</td>
              <td onclick="event.stopPropagation()">
                <div style="display:flex;gap:4px;justify-content:flex-end;">
                  ${typeof renderMsgButtons === 'function' ? renderMsgButtons('pr', pr, 'phone', 'email') : ''}
                  ${pr.status === 'Approved' ? `<button class="btn-edit" title="Create PO from PR" onclick="createPOFromPR('${escapeHtml(pr.id)}')">→PO</button>` : ''}
                  <button class="btn-edit" onclick="showPRModal('${escapeHtml(pr.id)}')">Edit</button>
                  <button class="btn-delete" onclick="deletePRById('${escapeHtml(pr.id)}')">Del</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── PR Modal ───────────────────────────────────────────────────────────────
async function showPRModal(id) {
  _editingPRId = id;
  const pr     = id ? (_allPRs.find(p => p.id === id) || {}) : {};
  const isEdit = !!id;

  let lineItemsHtml = '';
  let existingItems = [];
  if (isEdit && id) {
    try {
      const res   = await callAPI('getPRLineItems', { pr_id: id });
      existingItems = res.rows || [];
    } catch(e) {}
  }

  const prev = document.getElementById('pr-modal-overlay');
  if (prev) prev.remove();

  const html = `
    <div id="pr-modal-overlay" onclick="closePRModal()" style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.52);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:1rem;animation:overlayFadeIn 0.2s ease;">
      <div onclick="event.stopPropagation()" style="position:relative;width:100%;max-width:700px;max-height:92vh;overflow-y:auto;border-radius:var(--r-lg);padding:1.5rem;background:var(--glass-bg-strong);backdrop-filter:var(--glass-blur);border:1px solid var(--border);box-shadow:0 24px 64px rgba(0,0,0,0.45);animation:modalSpringIn var(--dur-enter) var(--spring-bounce) both;">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
          <div>
            <h2 style="font-size:17px;font-weight:700;color:var(--text-1);">${isEdit?'Edit Purchase Request':'New Purchase Request'}</h2>
            <p style="font-size:12px;color:var(--text-3);margin-top:2px;">${isEdit?'Editing '+escapeHtml(pr.pr_number||id):'Fill in the request details below'}</p>
          </div>
          <button onclick="closePRModal()" style="background:var(--glass-bg);border:1px solid var(--border);color:var(--text-3);width:30px;height:30px;border-radius:var(--r-sm);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;font-family:Inter,sans-serif;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>PR Number *</label><input id="pr-f-number" type="text" placeholder="e.g. PR-2026-001" value="${escapeHtml(pr.pr_number||'')}"/></div>
          <div class="form-group"><label>Status</label>
            <select id="pr-f-status" class="pref-select" style="width:100%;">
              ${PR_STATUSES.map(s=>`<option value="${s}" ${(pr.status||'Draft')===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label>Description *</label>
          <input id="pr-f-desc" type="text" placeholder="Brief description of what is needed" value="${escapeHtml(pr.description||'')}"/>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Requested By *</label><input id="pr-f-reqby" type="text" placeholder="Name" value="${escapeHtml(pr.requested_by||'')}"/></div>
          <div class="form-group"><label>Department</label><input id="pr-f-dept" type="text" placeholder="e.g. Finance" value="${escapeHtml(pr.department||'')}"/></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Priority</label>
            <select id="pr-f-priority" class="pref-select" style="width:100%;">
              ${PR_PRIORITIES.map(p=>`<option value="${p}" ${(pr.priority||'Medium')===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Required By Date</label><input id="pr-f-reqdate" type="date" value="${escapeHtml(pr.required_by_date||'')}"/></div>
          <div class="form-group"><label>Currency</label>
            <select id="pr-f-currency" class="pref-select" style="width:100%;">
              ${PR_CURRENCIES.map(c=>`<option value="${c}" ${(pr.currency||'IQD')===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Budget Code</label><input id="pr-f-budget" type="text" value="${escapeHtml(pr.budget_code||'')}"/></div>
          <div class="form-group"><label>Delivery Location</label><input id="pr-f-location" type="text" value="${escapeHtml(pr.delivery_location||'')}"/></div>
        </div>

        ${renderPRLineItemsForm(existingItems)}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Approved By</label><input id="pr-f-approvedby" type="text" value="${escapeHtml(pr.approved_by||'')}"/></div>
          <div class="form-group"><label>Approval Date</label><input id="pr-f-approvaldate" type="date" value="${escapeHtml(pr.approval_date||'')}"/></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label>Notes</label>
          <textarea id="pr-f-notes" rows="2" style="resize:vertical;">${escapeHtml(pr.notes||'')}</textarea>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label>Attachment URL</label>
          <input id="pr-f-attach" type="url" placeholder="https://…" value="${escapeHtml(pr.attachment_url||'')}"/>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn-export" onclick="closePRModal()">Cancel</button>
          <button class="btn-primary" onclick="submitPRForm()">${isEdit?'Save Changes':'Create Request'}</button>
        </div>

      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  _attachPRLineItemListeners();
  updatePRTotal();
}

function renderPRLineItemsForm(items) {
  items = items && items.length ? items : [{ item_name:'', quantity:'', unit:'pcs', estimated_price:'' }];
  return `
    <div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.15);
      border-radius:var(--r-md);padding:1rem;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:600;color:#3b82f6;
          text-transform:uppercase;letter-spacing:0.07em;">Line Items</div>
        <button type="button" class="btn-add" style="padding:4px 10px;font-size:11px;"
          onclick="addPRLineItem()">+ Add Item</button>
      </div>
      <div id="pr-line-items-list" style="display:flex;flex-direction:column;gap:10px;">
        ${items.map((item, i) => renderSinglePRLineItem(item, i)).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;
        margin-top:12px;padding-top:10px;border-top:1px solid rgba(59,130,246,0.12);">
        <span style="font-size:12px;font-weight:600;color:var(--text-3);text-transform:uppercase;
          letter-spacing:0.06em;">Total Estimated:</span>
        <span id="pr-total-estimated" style="font-size:16px;font-weight:800;color:var(--text-1);">0</span>
      </div>
    </div>`;
}

function renderSinglePRLineItem(item, index) {
  return `
    <div class="pr-line-item glass" style="border-radius:var(--r-sm);padding:10px 12px;
      position:relative;" data-line-index="${index}">
      <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:10px;">Item Description</label>
        <input type="text" class="pr-li-name" placeholder="e.g. Office furniture, IT equipment…"
          value="${escapeHtml(item.item_name||'')}" oninput="updatePRTotal()"/>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1.5fr auto;gap:8px;align-items:end;">
        <div class="form-group">
          <label style="font-size:10px;">Quantity</label>
          <input type="number" class="pr-li-qty" min="0" step="any"
            placeholder="0" value="${item.quantity||''}" oninput="updatePRTotal()"/>
        </div>
        <div class="form-group">
          <label style="font-size:10px;">Unit</label>
          <select class="pr-li-unit pref-select" style="width:100%;padding:8px 10px;">
            ${['pcs','box','set','kg','m','roll','unit','lot','pair','ltr','sqm'].map(u =>
              `<option value="${u}" ${(item.unit||'pcs')===u?'selected':''}>${u}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label style="font-size:10px;">Estimated Price</label>
          <input type="number" class="pr-li-price" min="0" step="any"
            placeholder="0" value="${item.estimated_price||''}" oninput="updatePRTotal()"/>
        </div>
        <button type="button" onclick="removePRLineItem(this)" title="Remove item"
          style="padding:6px 8px;border-radius:var(--r-xs);
            background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.18);
            color:var(--accent-red);cursor:pointer;font-size:14px;
            font-family:Inter,sans-serif;margin-bottom:1px;">✕</button>
      </div>
    </div>`;
}

function _attachPRLineItemListeners() {
  // Delegated via oninput in HTML — updatePRTotal handles everything
}

function addPRLineItem() {
  const list = document.getElementById('pr-line-items-list');
  if (!list) return;
  const index = list.children.length;
  list.insertAdjacentHTML('beforeend',
    renderSinglePRLineItem({ item_name:'', quantity:'', unit:'pcs', estimated_price:'' }, index));
}

function removePRLineItem(btn) {
  const item = btn.closest('.pr-line-item');
  if (!item) return;
  const list = document.getElementById('pr-line-items-list');
  if (list && list.children.length <= 1) {
    showToast('At least one line item is required', 'info');
    return;
  }
  item.remove();
  updatePRTotal();
}

function updatePRTotal() {
  const items  = document.querySelectorAll('.pr-line-item');
  const cur    = document.getElementById('pr-f-currency')?.value || 'IQD';
  const dec    = cur === 'IQD' ? 0 : 2;
  let total    = 0;
  items.forEach(item => {
    const qty   = parseFloat(item.querySelector('.pr-li-qty')?.value) || 0;
    const price = parseFloat(item.querySelector('.pr-li-price')?.value) || 0;
    total += qty * price;
  });
  const el = document.getElementById('pr-total-estimated');
  if (el) el.textContent = `${cur} ${total.toLocaleString('en-US', {minimumFractionDigits:dec, maximumFractionDigits:dec})}`;
}

function getPRLineItemsFromForm() {
  const items = [];
  document.querySelectorAll('.pr-line-item').forEach(el => {
    const name  = el.querySelector('.pr-li-name')?.value?.trim() || '';
    const qty   = el.querySelector('.pr-li-qty')?.value || '';
    const unit  = el.querySelector('.pr-li-unit')?.value || 'pcs';
    const price = el.querySelector('.pr-li-price')?.value || '';
    if (name || qty || price) {
      items.push({ item_name:name, quantity:qty, unit, estimated_price:price });
    }
  });
  return items;
}

function closePRModal() {
  document.getElementById('pr-modal-overlay')?.remove();
  _editingPRId = null;
}

async function submitPRForm() {
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const number    = g('pr-f-number');
  const desc      = g('pr-f-desc');
  const requestedBy = g('pr-f-reqby');
  if (!number)      { showToast('PR number is required', 'error'); return; }
  if (!desc)        { showToast('Description is required', 'error'); return; }
  if (!requestedBy) { showToast('Requested by is required', 'error'); return; }

  // Collect line items
  const items = getPRLineItemsFromForm();
  let totalEst = 0;
  items.forEach(it => {
    totalEst += (parseFloat(it.quantity)||0) * (parseFloat(it.estimated_price)||0);
    it.currency = g('pr-f-currency') || 'IQD';
  });

  const user = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  const payload = {
    pr_number:        number,
    description:      desc,
    requested_by:     requestedBy,
    department:       g('pr-f-dept'),
    priority:         document.getElementById('pr-f-priority')?.value || 'Medium',
    status:           document.getElementById('pr-f-status')?.value || 'Draft',
    budget_code:      g('pr-f-budget'),
    delivery_location: g('pr-f-location'),
    required_by_date: g('pr-f-reqdate'),
    approval_date:    g('pr-f-approvaldate'),
    approved_by:      g('pr-f-approvedby'),
    notes:            document.getElementById('pr-f-notes')?.value?.trim() || '',
    attachment_url:   g('pr-f-attach'),
    total_estimated:  totalEst || '',
    currency:         g('pr-f-currency') || 'IQD',
    created_by:       user.email || '',
  };

  const btn = document.querySelector('#pr-modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    let prId;
    if (_editingPRId) {
      payload.id = _editingPRId;
      await callAPI('updatePR', payload);
      const idx = _allPRs.findIndex(p => p.id === _editingPRId);
      if (idx !== -1) Object.assign(_allPRs[idx], payload);
      prId = _editingPRId;
      showToast('PR updated ✓', 'success');
    } else {
      const res = await callAPI('savePR', payload);
      prId = res.id;
      payload.id = prId;
      _allPRs.unshift(payload);
      showToast('PR created ✓', 'success');
    }
    // Save line items
    if (items.length && prId) {
      await callAPI('savePRLineItems', { pr_id: prId, items }).catch(() => {});
    }
    closePRModal();
    renderPRTable();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = _editingPRId ? 'Save Changes' : 'Create Request'; }
  }
}

async function deletePRById(id) {
  if (!confirm('Delete this purchase request and all its line items? This cannot be undone.')) return;
  try {
    await callAPI('deletePR', { id });
    _allPRs = _allPRs.filter(p => p.id !== id);
    renderPRTable();
    showToast('PR deleted', 'info');
  } catch(e) { showToast('Delete failed: ' + e.message, 'error'); }
}

// ── Create PO from PR ──────────────────────────────────────────────────────
async function createPOFromPR(prId) {
  const pr = _allPRs.find(p => p.id === prId);
  if (!pr) { showToast('PR not found', 'error'); return; }
  let items = [];
  try {
    const res = await callAPI('getPRLineItems', { pr_id: prId });
    items = res.rows || [];
  } catch(e) {}

  const desc = [pr.description, ...items.map(i => i.item_name + ' ×' + i.quantity)].filter(Boolean).join('; ');
  navigateTo('pos');
  setTimeout(() => {
    if (typeof openAddModal === 'function') {
      openAddModal('POs');
      setTimeout(() => {
        const descInput = document.querySelector('[name="item_description"]');
        if (descInput) descInput.value = desc;
        const prLinkedSelect = document.getElementById('po-pr-reference');
        if (prLinkedSelect) prLinkedSelect.value = prId;
        showToast('PO form opened — review and save to link this PR', 'info');
      }, 300);
    } else {
      showToast('Navigate to POs tab and create a PO for PR: ' + (pr.pr_number||prId), 'info');
    }
  }, 400);
}

// ── PR Dashboard summary ─────────────────────────────────────────────────────
function renderPRDashboard(prs) {
  const total     = prs.length;
  const draft     = prs.filter(p => p.status === 'Draft').length;
  const submitted = prs.filter(p => p.status === 'Submitted').length;
  const approved  = prs.filter(p => p.status === 'Approved').length;
  const rejected  = prs.filter(p => p.status === 'Rejected').length;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('pr-dash-total',     total);
  set('pr-dash-draft',     draft);
  set('pr-dash-submitted', submitted);
  set('pr-dash-approved',  approved);
  set('pr-dash-rejected',  rejected);
}
