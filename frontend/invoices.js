// ─── Invoice Tracker ─────────────────────────────────────────────────────────

let _allInvoices  = [];
let _editingInvId = null;
let _invFilter    = 'all';

const INV_STATUSES        = ['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
const INV_CURRENCIES      = ['IQD', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];
const INV_PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'Credit Card', 'Online Payment', 'Other'];

// ── Currency formatter ────────────────────────────────────────────────────────
function fmtInvCurrency(amount, currency) {
  const num      = parseFloat(amount) || 0;
  const cur      = currency || 'IQD';
  const decimals = cur === 'IQD' ? 0 : 2;
  return cur + ' ' + num.toLocaleString('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  });
}

// ── Status colors ─────────────────────────────────────────────────────────────
function invStatusColor(s) {
  return { Paid:'#10b981', Unpaid:'#f59e0b', 'Partially Paid':'#3b82f6', Overdue:'#ef4444', Cancelled:'#6b7280' }[s] || '#a78bfa';
}
function invStatusBg(s) {
  return { Paid:'rgba(16,185,129,0.15)', Unpaid:'rgba(245,158,11,0.15)', 'Partially Paid':'rgba(59,130,246,0.15)', Overdue:'rgba(239,68,68,0.15)', Cancelled:'rgba(107,114,128,0.15)' }[s] || 'rgba(167,139,250,0.15)';
}

// ── Load all invoices ─────────────────────────────────────────────────────────
async function loadInvoices() {
  const wrap = document.getElementById('inv-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:10px;">
      <div class="inv-filter-tabs" id="inv-filter-tabs">
        ${['all','Unpaid','Partially Paid','Paid','Overdue','Cancelled'].map(s => `
          <button class="inv-filter-btn${_invFilter===s?' active':''}" onclick="setInvFilter('${s}')">${s==='all'?'All Invoices':s}</button>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="inv-search" placeholder="Search invoices…" class="filter-select" style="width:190px;" oninput="renderInvoiceTable()"/>
        <button class="btn-export" onclick="exportInvoicesCSV()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
        <button class="btn-primary" onclick="showInvoiceModal(null)">+ New Invoice</button>
      </div>
    </div>
    <div id="inv-table-wrap"></div>`;

  try {
    const res    = await callAPI('getInvoices');
    _allInvoices = res.rows || [];
    autoMarkOverdueInvoices();
    renderInvoiceTable();
    updateInvoiceSidebarBadge();
  } catch(e) {
    document.getElementById('inv-table-wrap').innerHTML =
      `<div style="padding:2rem;text-align:center;color:var(--accent-red);">Failed to load invoices: ${escapeHtml(e.message)}</div>`;
  }
}

// ── Auto-mark overdue ─────────────────────────────────────────────────────────
function autoMarkOverdueInvoices(arr) {
  const list  = arr || _allInvoices;
  const today = new Date(); today.setHours(0,0,0,0);
  list.forEach(inv => {
    if (inv.status === 'Unpaid' && inv.due_date) {
      const due = new Date(inv.due_date);
      if (!isNaN(due) && due < today) inv.status = 'Overdue';
    }
  });
}

// ── Filter ────────────────────────────────────────────────────────────────────
function setInvFilter(status) {
  _invFilter = status;
  document.querySelectorAll('.inv-filter-btn').forEach(b =>
    b.classList.toggle('active', b.textContent.trim() === (status === 'all' ? 'All Invoices' : status))
  );
  renderInvoiceTable();
}

// ── Render table ──────────────────────────────────────────────────────────────
function renderInvoiceTable() {
  const wrap = document.getElementById('inv-table-wrap');
  if (!wrap) return;

  const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
  let rows = _allInvoices.filter(inv => {
    if (_invFilter !== 'all' && inv.status !== _invFilter) return false;
    if (search) {
      const hay = [inv.invoice_number, inv.vendor, inv.po_reference, inv.status, inv.description, inv.approved_by].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (!rows.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:var(--text-3);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
          style="margin:0 auto 1rem;display:block;opacity:0.35;">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <div style="font-size:15px;font-weight:600;color:var(--text-2);margin-bottom:6px;">No invoices found</div>
        <div style="font-size:13px;">${_invFilter !== 'all' ? `No ${_invFilter} invoices.` : 'Click + New Invoice to add one.'}</div>
      </div>`;
    return;
  }

  const order = { Overdue:0, Unpaid:1, 'Partially Paid':2, Paid:3, Cancelled:4 };
  rows.sort((a,b) => {
    const od = ((order[a.status]??5) - (order[b.status]??5));
    return od !== 0 ? od : new Date(b.due_date||0) - new Date(a.due_date||0);
  });

  wrap.innerHTML = `
    <div class="glass" style="border-radius:var(--r-md);overflow:hidden;">
      <table class="data-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="width:32px;padding:10px 12px;"><input type="checkbox" id="inv-check-all" onchange="toggleAllInvChecks(this)"/></th>
            <th>Invoice #</th>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Invoice Date</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>PO Ref</th>
            <th>Payment Method</th>
            <th style="text-align:right;padding-right:12px;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows.map(inv => renderInvoiceRow(inv)).join('')}</tbody>
      </table>
    </div>
    <div id="inv-bulk-bar" class="inv-bulk-bar hidden">
      <span id="inv-bulk-count">0 selected</span>
      <button class="btn-delete" onclick="bulkDeleteInvoices()">Delete Selected</button>
      <button class="btn-export" onclick="bulkExportInvoices()">Export Selected</button>
    </div>`;
}

function renderInvoiceRow(inv) {
  const dueDate  = inv.due_date     ? inv.due_date.split('T')[0]     : '—';
  const invDate  = inv.invoice_date ? inv.invoice_date.split('T')[0] : '—';
  const today    = new Date(); today.setHours(0,0,0,0);
  const daysLeft = inv.due_date ? Math.ceil((new Date(inv.due_date) - today) / 86400000) : null;

  let dueDateDisplay = dueDate;
  if (daysLeft !== null && inv.status === 'Unpaid') {
    if (daysLeft < 0) {
      dueDateDisplay = `<span style="color:var(--accent-red);font-weight:600;">${dueDate}</span><span style="font-size:10px;color:var(--accent-red);display:block;">${Math.abs(daysLeft)}d overdue</span>`;
    } else if (daysLeft <= 7) {
      dueDateDisplay = `<span style="color:#f59e0b;font-weight:600;">${dueDate}</span><span style="font-size:10px;color:#f59e0b;display:block;">Due in ${daysLeft}d</span>`;
    }
  }

  return `
    <tr style="${inv.status==='Overdue'?'background:rgba(239,68,68,0.04);':''}" ondblclick="showInvoiceModal('${inv.id}')">
      <td style="padding:10px 12px;"><input type="checkbox" class="inv-row-check" value="${inv.id}" onchange="onInvCheckChange()"/></td>
      <td>
        <span style="font-weight:600;color:var(--text-1);">${escapeHtml(inv.invoice_number||'—')}</span>
        ${inv.description?`<span style="display:block;font-size:11px;color:var(--text-3);">${escapeHtml(inv.description.substring(0,42))}${inv.description.length>42?'…':''}</span>`:''}
      </td>
      <td style="font-weight:500;">${escapeHtml(inv.vendor||'—')}</td>
      <td style="font-weight:700;color:var(--text-1);">${fmtInvCurrency(inv.amount, inv.currency)}</td>
      <td style="color:var(--text-3);font-size:13px;">${invDate}</td>
      <td style="font-size:13px;">${dueDateDisplay}</td>
      <td>
        <span style="display:inline-flex;align-items:center;padding:3px 9px;border-radius:var(--r-full);font-size:11px;font-weight:600;color:${invStatusColor(inv.status)};background:${invStatusBg(inv.status)};">
          ${inv.status||'—'}
        </span>
      </td>
      <td style="font-size:12px;color:var(--text-3);">${escapeHtml(inv.po_reference||'—')}</td>
      <td style="font-size:12px;color:var(--text-3);">${escapeHtml(inv.payment_method||'—')}</td>
      <td style="text-align:right;padding-right:8px;">
        <div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap;">
          ${(inv.status==='Unpaid'||inv.status==='Overdue')?`<button class="btn-edit" style="font-size:11px;padding:4px 8px;" onclick="quickMarkPaid('${inv.id}')">Mark Paid</button>`:''}
          <button class="btn-edit" onclick="showInvoiceModal('${inv.id}')">Edit</button>
          <button class="btn-delete" onclick="deleteInvoiceById('${inv.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
}

// ── Quick mark paid ───────────────────────────────────────────────────────────
async function quickMarkPaid(id) {
  const inv   = _allInvoices.find(i => i.id === id);
  if (!inv) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    await callAPI('updateInvoice', { id, status:'Paid', payment_date: today });
    inv.status = 'Paid'; inv.payment_date = today;
    renderInvoiceTable();
    updateInvoiceSidebarBadge();
    refreshInvoiceDashboard();
    showToast('Invoice marked as paid ✓', 'success');
  } catch(e) { showToast('Failed: ' + e.message, 'error'); }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteInvoiceById(id) {
  if (!confirm('Delete this invoice? This cannot be undone.')) return;
  try {
    await callAPI('deleteInvoice', { id });
    _allInvoices = _allInvoices.filter(i => i.id !== id);
    renderInvoiceTable();
    updateInvoiceSidebarBadge();
    refreshInvoiceDashboard();
    showToast('Invoice deleted', 'info');
  } catch(e) { showToast('Delete failed: ' + e.message, 'error'); }
}

// ── Bulk actions ──────────────────────────────────────────────────────────────
function onInvCheckChange() {
  const checked = document.querySelectorAll('.inv-row-check:checked');
  const bar     = document.getElementById('inv-bulk-bar');
  const cnt     = document.getElementById('inv-bulk-count');
  if (bar) bar.classList.toggle('hidden', checked.length === 0);
  if (cnt) cnt.textContent = `${checked.length} selected`;
}

function toggleAllInvChecks(master) {
  document.querySelectorAll('.inv-row-check').forEach(cb => { cb.checked = master.checked; });
  onInvCheckChange();
}

async function bulkDeleteInvoices() {
  const ids = [...document.querySelectorAll('.inv-row-check:checked')].map(cb => cb.value);
  if (!ids.length || !confirm(`Delete ${ids.length} invoice(s)?`)) return;
  for (const id of ids) { try { await callAPI('deleteInvoice', { id }); } catch(e) {} }
  _allInvoices = _allInvoices.filter(i => !ids.includes(i.id));
  renderInvoiceTable();
  updateInvoiceSidebarBadge();
  refreshInvoiceDashboard();
  showToast(`${ids.length} invoice(s) deleted`, 'info');
}

function bulkExportInvoices() {
  const ids  = [...document.querySelectorAll('.inv-row-check:checked')].map(cb => cb.value);
  exportInvoicesCSV(_allInvoices.filter(i => ids.includes(i.id)));
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportInvoicesCSV(rows) {
  rows = rows || _allInvoices;
  if (!rows.length) { showToast('No invoices to export', 'info'); return; }
  const headers = ['invoice_number','vendor','amount','currency','invoice_date','due_date','status',
    'po_reference','description','payment_date','payment_method','bank_account','approved_by','notes'];
  const csv = [headers.join(','), ...rows.map(r =>
    headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(',')
  )].join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download= `Invoices_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('CSV exported ✓', 'success');
}

// ── Sidebar badge ─────────────────────────────────────────────────────────────
function updateInvoiceSidebarBadge() {
  const badge = document.getElementById('inv-sidebar-badge');
  if (!badge) return;
  const n = _allInvoices.filter(i => i.status === 'Overdue' || i.status === 'Unpaid').length;
  badge.textContent = n;
  badge.style.display = n > 0 ? 'flex' : 'none';
}

// ── Dashboard widgets ─────────────────────────────────────────────────────────
function refreshInvoiceDashboard() {
  renderInvoiceStatCards(_allInvoices);
  renderInvoiceChart(_allInvoices);
  renderOverdueInvoiceBanner(_allInvoices);
  renderRecentInvoices(_allInvoices);
}

function renderInvoiceStatCards(invoices) {
  const paid    = invoices.filter(i => i.status === 'Paid');
  const unpaid  = invoices.filter(i => i.status === 'Unpaid' || i.status === 'Partially Paid');
  const overdue = invoices.filter(i => i.status === 'Overdue');

  function sumByCur(arr) {
    const t = {};
    arr.forEach(inv => { const c = inv.currency||'IQD'; t[c] = (t[c]||0) + (parseFloat(inv.amount)||0); });
    return Object.entries(t).map(([c,a]) => fmtInvCurrency(a,c)).join(' + ') || '—';
  }

  const map = {
    'inv-stat-total':       { val: invoices.length, color:'var(--accent)' },
    'inv-stat-paid':        { val: sumByCur(paid),  color:'var(--accent-green)' },
    'inv-stat-outstanding': { val: sumByCur(unpaid),color:'#f59e0b' },
    'inv-stat-overdue':     { val: overdue.length,  color:'var(--accent-red)' },
  };
  Object.entries(map).forEach(([id,{val,color}]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div style="font-size:22px;font-weight:800;color:${color};letter-spacing:-0.03em;">${val}</div>`;
  });
}

let _invChart = null;
function renderInvoiceChart(invoices) {
  const canvas = document.getElementById('inv-chart-canvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const buckets = { Paid:0, Unpaid:0, 'Partially Paid':0, Overdue:0, Cancelled:0 };
  invoices.forEach(i => { if (buckets[i.status] !== undefined) buckets[i.status]++; });

  const labels = Object.keys(buckets).filter(k => buckets[k] > 0);
  const data   = labels.map(k => buckets[k]);
  const colors = { Paid:'#10b981', Unpaid:'#f59e0b', 'Partially Paid':'#3b82f6', Overdue:'#ef4444', Cancelled:'#6b7280' };

  if (_invChart) { _invChart.destroy(); _invChart = null; }
  if (!data.length) {
    canvas.parentElement.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-3);font-size:12px;">No invoice data</div>';
    return;
  }

  _invChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: labels.map(l => colors[l]), borderWidth:2, borderColor:'transparent', hoverOffset:4 }] },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '68%',
      plugins: {
        legend: { position:'bottom', labels:{ font:{ size:10, family:'Inter' }, color:'rgba(255,255,255,0.65)', boxWidth:10, padding:8 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } }
      }
    }
  });
}

function renderOverdueInvoiceBanner(invoices) {
  const wrap = document.getElementById('inv-overdue-banner');
  if (!wrap) return;
  const overdue = invoices.filter(i => i.status === 'Overdue');
  if (!overdue.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    <span>
      <strong>${overdue.length} overdue invoice${overdue.length>1?'s':''}</strong>
      — ${overdue.map(i=>`${i.invoice_number||i.id} (${i.vendor||''})`).slice(0,3).join(', ')}${overdue.length>3?` +${overdue.length-3} more`:''}
    </span>
    <button onclick="navigateTo('invoices');setInvFilter('Overdue')" style="margin-left:auto;padding:3px 10px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;border-radius:6px;font-size:11px;cursor:pointer;font-family:Inter,sans-serif;">
      View All
    </button>`;
}

function renderRecentInvoices(invoices) {
  const el = document.getElementById('recent-invoices-list');
  if (!el) return;
  const recent = invoices.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0,5);
  if (!recent.length) { el.innerHTML = '<p class="empty">No invoices yet</p>'; return; }
  el.innerHTML = recent.map(inv => `
    <div class="recent-item" onclick="navigateTo('invoices')" style="cursor:pointer;">
      <div class="recent-item-left">
        <span style="padding:2px 8px;border-radius:var(--r-full);font-size:10px;font-weight:600;color:${invStatusColor(inv.status)};background:${invStatusBg(inv.status)};">${inv.status||'—'}</span>
        <span class="recent-item-title">${escapeHtml(inv.invoice_number||'—')} — ${escapeHtml(inv.vendor||'—')}</span>
      </div>
      <span class="recent-item-meta" style="font-weight:700;">${fmtInvCurrency(inv.amount, inv.currency)}</span>
    </div>`).join('');
}

// ── Invoice Modal ─────────────────────────────────────────────────────────────
async function showInvoiceModal(id) {
  _editingInvId = id;
  const inv    = id ? (_allInvoices.find(i => i.id === id) || {}) : {};
  const isEdit = !!id;

  let poOptions = '<option value="">None (standalone invoice)</option>';
  try {
    const cached = typeof cacheGet === 'function' ? cacheGet('POs') : null;
    const poData = cached?.data || (await callAPI('getAll', { sheet:'POs' }));
    const pos    = poData?.rows || [];
    poOptions   += pos.map(po =>
      `<option value="${po.id}" ${inv.linked_po_id===po.id?'selected':''} data-vendor="${po.vendor||''}" data-amount="${po.total_amount||po.amount||''}" data-currency="${po.currency||'IQD'}">
        ${po.po_number||po.id} — ${po.vendor||''} (${po.currency||'IQD'} ${parseFloat(po.total_amount||po.amount||0).toLocaleString()})
      </option>`
    ).join('');
  } catch(e) {}

  const html = `
    <div class="modal-overlay" id="inv-modal-overlay">
      <div class="modal-backdrop" onclick="closeInvoiceModal()"></div>
      <div class="glass-3" style="position:relative;z-index:1;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;border-radius:var(--r-lg);padding:1.5rem;animation:modalSpringIn var(--dur-enter) var(--spring-bounce) both;">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
          <div>
            <h2 style="font-size:17px;font-weight:700;color:var(--text-1);">${isEdit?'Edit Invoice':'New Invoice'}</h2>
            <p style="font-size:12px;color:var(--text-3);margin-top:2px;">${isEdit?`Editing ${escapeHtml(inv.invoice_number||id)}`:'Fill in the invoice details below'}</p>
          </div>
          <button onclick="closeInvoiceModal()" style="background:var(--glass-bg);border:1px solid var(--border);color:var(--text-3);width:30px;height:30px;border-radius:var(--r-sm);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;font-family:Inter,sans-serif;">✕</button>
        </div>

        <div style="margin-bottom:1rem;">
          <label style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.07em;display:block;margin-bottom:5px;">Link to Purchase Order (optional)</label>
          <select id="inv-linked-po" class="pref-select" style="width:100%;" onchange="onInvPOSelect(this)">${poOptions}</select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Invoice Number *</label><input id="inv-f-number" type="text" placeholder="e.g. INV-2026-001" value="${escapeHtml(inv.invoice_number||'')}"/></div>
          <div class="form-group"><label>Vendor *</label><input id="inv-f-vendor" type="text" placeholder="Vendor name" value="${escapeHtml(inv.vendor||'')}"/></div>
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Amount *</label><input id="inv-f-amount" type="number" min="0" step="any" placeholder="0" value="${inv.amount||''}"/></div>
          <div class="form-group"><label>Currency</label>
            <select id="inv-f-currency" class="pref-select" style="width:100%;">${INV_CURRENCIES.map(c=>`<option value="${c}" ${(inv.currency||'IQD')===c?'selected':''}>${c}</option>`).join('')}</select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Invoice Date *</label><input id="inv-f-invdate" type="date" value="${(inv.invoice_date||'').split('T')[0]}"/></div>
          <div class="form-group"><label>Due Date *</label><input id="inv-f-duedate" type="date" value="${(inv.due_date||'').split('T')[0]}"/></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Status</label>
            <select id="inv-f-status" class="pref-select" style="width:100%;">${INV_STATUSES.map(s=>`<option value="${s}" ${(inv.status||'Unpaid')===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>PO Reference</label><input id="inv-f-poref" type="text" placeholder="e.g. PO-0023" value="${escapeHtml(inv.po_reference||'')}"/></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label>Description</label><input id="inv-f-desc" type="text" placeholder="Brief description of goods/services" value="${escapeHtml(inv.description||'')}"/>
        </div>

        <div id="inv-payment-section" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:var(--r-md);padding:1rem;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:600;color:var(--accent-green);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Payment Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div class="form-group"><label>Payment Date</label><input id="inv-f-paydate" type="date" value="${(inv.payment_date||'').split('T')[0]}"/></div>
            <div class="form-group"><label>Payment Method</label>
              <select id="inv-f-paymethod" class="pref-select" style="width:100%;"><option value="">Select…</option>${INV_PAYMENT_METHODS.map(m=>`<option value="${m}" ${inv.payment_method===m?'selected':''}>${m}</option>`).join('')}</select>
            </div>
          </div>
          <div class="form-group"><label>Bank / Account</label><input id="inv-f-bank" type="text" placeholder="Bank name or account reference" value="${escapeHtml(inv.bank_account||'')}"/></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Approved By</label><input id="inv-f-approvedby" type="text" placeholder="Name" value="${escapeHtml(inv.approved_by||'')}"/></div>
          <div class="form-group"><label>Attachment URL</label><input id="inv-f-attach" type="url" placeholder="https://…" value="${escapeHtml(inv.attachment_url||'')}"/></div>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label>Notes</label>
          <textarea id="inv-f-notes" rows="2" placeholder="Additional notes…" style="resize:vertical;">${escapeHtml(inv.notes||'')}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn-export" onclick="closeInvoiceModal()">Cancel</button>
          <button class="btn-primary" onclick="submitInvoiceForm()">${isEdit?'Save Changes':'Create Invoice'}</button>
        </div>

      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  const statusEl = document.getElementById('inv-f-status');
  if (statusEl) {
    toggleInvPaymentSection(statusEl.value);
    statusEl.addEventListener('change', e => toggleInvPaymentSection(e.target.value));
  }
}

function toggleInvPaymentSection(status) {
  const sec = document.getElementById('inv-payment-section');
  if (sec) sec.style.display = ['Paid','Partially Paid'].includes(status) ? 'block' : 'none';
}

function onInvPOSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt?.value) return;
  const vField = document.getElementById('inv-f-vendor');
  const aField = document.getElementById('inv-f-amount');
  const cField = document.getElementById('inv-f-currency');
  const pField = document.getElementById('inv-f-poref');
  if (vField && !vField.value) vField.value = opt.dataset.vendor  || '';
  if (aField && !aField.value) aField.value = opt.dataset.amount  || '';
  if (cField)                  cField.value = opt.dataset.currency || 'IQD';
  if (pField && !pField.value) pField.value = opt.textContent.split('—')[0].trim();
}

function closeInvoiceModal() {
  const el = document.getElementById('inv-modal-overlay');
  if (el) el.remove();
  _editingInvId = null;
}

async function submitInvoiceForm() {
  const g  = id => document.getElementById(id)?.value?.trim();
  const number   = g('inv-f-number');
  const vendor   = g('inv-f-vendor');
  const amount   = g('inv-f-amount');
  const currency = document.getElementById('inv-f-currency')?.value || 'IQD';

  if (!number) { showToast('Invoice number is required', 'error'); return; }
  if (!vendor) { showToast('Vendor is required', 'error'); return; }
  if (!amount || isNaN(amount)) { showToast('Valid amount is required', 'error'); return; }

  const user    = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  const payload = {
    invoice_number: number,
    vendor,
    amount,
    currency,
    invoice_date:   g('inv-f-invdate'),
    due_date:       g('inv-f-duedate'),
    status:         document.getElementById('inv-f-status')?.value || 'Unpaid',
    po_reference:   g('inv-f-poref'),
    description:    g('inv-f-desc'),
    payment_date:   g('inv-f-paydate'),
    payment_method: document.getElementById('inv-f-paymethod')?.value || '',
    bank_account:   g('inv-f-bank'),
    approved_by:    g('inv-f-approvedby'),
    attachment_url: g('inv-f-attach'),
    notes:          document.getElementById('inv-f-notes')?.value?.trim() || '',
    linked_po_id:   document.getElementById('inv-linked-po')?.value || '',
    created_by:     user.email || '',
  };

  const btn = document.querySelector('#inv-modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    if (_editingInvId) {
      payload.id = _editingInvId;
      await callAPI('updateInvoice', payload);
      const idx = _allInvoices.findIndex(i => i.id === _editingInvId);
      if (idx !== -1) Object.assign(_allInvoices[idx], payload);
      showToast('Invoice updated ✓', 'success');
    } else {
      const res  = await callAPI('saveInvoice', payload);
      payload.id = res.id;
      _allInvoices.unshift(payload);
      showToast('Invoice created ✓', 'success');
    }
    closeInvoiceModal();
    autoMarkOverdueInvoices();
    renderInvoiceTable();
    updateInvoiceSidebarBadge();
    refreshInvoiceDashboard();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = _editingInvId ? 'Save Changes' : 'Create Invoice'; }
  }
}
