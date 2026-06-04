// ─── Vendor Directory ─────────────────────────────────────────────────────────

let _allVendors  = [];
let _editingVndId = null;
let _vndFilter   = 'all';

const VND_CATEGORIES = ['Supplier','Contractor','Service Provider','Consultant','Logistics','IT','Other'];
const VND_CURRENCIES = ['IQD','USD','EUR','GBP','AED','SAR'];
const VND_PAYMENT_TERMS = ['Immediate','Net 15','Net 30','Net 60','Net 90','COD','Custom'];
const VND_STATUSES = ['Active','Inactive','Blocked'];

// ── Load vendors ──────────────────────────────────────────────────────────────
async function loadVendors() {
  const wrap = document.getElementById('vnd-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="filter-bar glass" style="margin-bottom:1rem;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        ${VND_STATUSES.concat(['all']).map(s => `
          <button class="inv-filter-btn${_vndFilter===(s==='all'?'all':s)?' active':''}" onclick="setVndFilter('${s}')">${s==='all'?'All':s}</button>
        `).join('')}
      </div>
      <div style="flex:1;min-width:0;"></div>
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="vnd-search" placeholder="Search vendors…" class="filter-input" oninput="renderVendorGrid()"/>
      </div>
      <span class="row-count" id="vnd-row-count"></span>
    </div>
    <div id="vnd-grid-wrap"></div>`;

  try {
    const res   = await callAPI('getVendors');
    _allVendors = res.rows || [];
    window._allVendors = _allVendors;
    renderVendorGrid();
    renderVendorDashboardCards(_allVendors);
    const panel = document.getElementById('vnd-dash-panel');
    if (panel && _allVendors.length) panel.style.display = '';
    const sub = document.getElementById('vendors-subtitle');
    if (sub) sub.textContent = _allVendors.length + ' vendor' + (_allVendors.length !== 1 ? 's' : '');
  } catch(e) {
    document.getElementById('vnd-grid-wrap').innerHTML =
      `<div style="padding:2rem;text-align:center;color:var(--accent-red);">Failed to load vendors: ${escapeHtml(e.message)}</div>`;
  }
}

// ── Filter ────────────────────────────────────────────────────────────────────
function setVndFilter(status) {
  _vndFilter = status;
  document.querySelectorAll('#vnd-wrap .inv-filter-btn').forEach(b => {
    const label = b.textContent.trim();
    b.classList.toggle('active', (status === 'all' && label === 'All') || label === status);
  });
  renderVendorGrid();
}

// ── Render vendor grid ────────────────────────────────────────────────────────
function renderVendorGrid() {
  const wrap = document.getElementById('vnd-grid-wrap');
  if (!wrap) return;

  const search = (document.getElementById('vnd-search')?.value || '').toLowerCase();
  let rows = _allVendors.filter(v => {
    if (_vndFilter !== 'all' && v.status !== _vndFilter) return false;
    if (search) {
      const hay = [v.vendor_name, v.category, v.contact_person, v.email, v.phone, v.notes].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const cntEl = document.getElementById('vnd-row-count');
  if (cntEl) cntEl.textContent = rows.length + ' of ' + _allVendors.length;

  if (!rows.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:var(--text-3);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
          style="margin:0 auto 1rem;display:block;opacity:0.35;">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
        <div style="font-size:15px;font-weight:600;color:var(--text-2);margin-bottom:6px;">No vendors found</div>
        <div style="font-size:13px;">${_vndFilter !== 'all' ? `No ${_vndFilter} vendors.` : 'Click + New Vendor to add one.'}</div>
      </div>`;
    return;
  }

  rows.sort((a, b) => (a.vendor_name || '').localeCompare(b.vendor_name || ''));

  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;">
      ${rows.map(v => renderVendorCard(v)).join('')}
    </div>`;
}

function vndStatusColor(s) {
  return { Active:'var(--accent-green)', Inactive:'var(--text-3)', Blocked:'var(--accent-red)' }[s] || 'var(--text-3)';
}
function vndStatusBg(s) {
  return { Active:'rgba(16,185,129,0.15)', Inactive:'rgba(107,114,128,0.12)', Blocked:'rgba(239,68,68,0.15)' }[s] || 'rgba(107,114,128,0.12)';
}

function renderVendorCard(v) {
  const initials = (v.vendor_name || '?').split(/\s+/).map(w => w[0]).join('').substring(0,2).toUpperCase();
  const logoHtml = v.logo_url
    ? `<img src="${escapeHtml(v.logo_url)}" style="width:40px;height:40px;border-radius:var(--r-sm);object-fit:contain;background:rgba(255,255,255,0.08);border:1px solid var(--border);" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div style="display:none;width:40px;height:40px;border-radius:var(--r-sm);background:rgba(167,139,250,0.18);align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#a78bfa;flex-shrink:0;">${initials}</div>`
    : `<div style="width:40px;height:40px;border-radius:var(--r-sm);background:rgba(167,139,250,0.18);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#a78bfa;flex-shrink:0;">${initials}</div>`;

  return `
    <div class="glass glass-card" style="border-radius:var(--r-md);padding:1.1rem;cursor:pointer;" ondblclick="showVendorModal('${escapeHtml(v.id)}')">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        ${logoHtml}
        <div style="min-width:0;flex:1;">
          <div style="font-size:14px;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(v.vendor_name||'—')}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:1px;">${escapeHtml(v.category||'')}</div>
        </div>
        <span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--r-full);font-size:10px;font-weight:600;color:${vndStatusColor(v.status)};background:${vndStatusBg(v.status)};flex-shrink:0;">${v.status||'Active'}</span>
      </div>
      ${v.contact_person ? `<div style="font-size:12px;color:var(--text-2);display:flex;align-items:center;gap:5px;margin-bottom:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${escapeHtml(v.contact_person)}</div>` : ''}
      ${v.email ? `<div style="font-size:12px;color:var(--text-2);display:flex;align-items:center;gap:5px;margin-bottom:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:${escapeHtml(v.email)}" style="color:var(--accent);text-decoration:none;" onclick="event.stopPropagation()">${escapeHtml(v.email)}</a></div>` : ''}
      ${v.phone ? `<div style="font-size:12px;color:var(--text-2);display:flex;align-items:center;gap:5px;margin-bottom:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.22 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.58-1.58a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${escapeHtml(v.phone)}</div>` : ''}
      ${v.currency ? `<div style="font-size:11px;color:var(--text-3);margin-top:6px;">Currency: <span style="color:var(--accent);font-weight:600;">${escapeHtml(v.currency)}</span>${v.payment_terms ? ` · ${escapeHtml(v.payment_terms)}` : ''}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button class="btn-edit" style="flex:1;font-size:11px;" onclick="event.stopPropagation();showVendorModal('${escapeHtml(v.id)}')">Edit</button>
        <button class="btn-delete" style="font-size:11px;" onclick="event.stopPropagation();deleteVendorById('${escapeHtml(v.id)}')">Delete</button>
      </div>
    </div>`;
}

// ── Dashboard widget ──────────────────────────────────────────────────────────
function renderVendorDashboardCards(vendors) {
  const totalEl  = document.getElementById('vnd-dash-total');
  const activeEl = document.getElementById('vnd-dash-active');
  const last2El  = document.getElementById('vnd-dash-last2');
  if (totalEl)  totalEl.textContent  = vendors.length;
  if (activeEl) activeEl.textContent = vendors.filter(v => v.status === 'Active').length;
  if (last2El) {
    const recent = vendors.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0,2);
    if (!recent.length) { last2El.innerHTML = '<p style="font-size:12px;color:var(--text-3);">No vendors yet</p>'; return; }
    last2El.innerHTML = recent.map(v => `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border);">
        <div style="width:24px;height:24px;border-radius:5px;background:rgba(167,139,250,0.18);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#a78bfa;flex-shrink:0;">
          ${(v.vendor_name||'?').charAt(0).toUpperCase()}
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:12px;font-weight:600;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(v.vendor_name||'—')}</div>
          <div style="font-size:10px;color:var(--text-3);">${escapeHtml(v.category||'')}</div>
        </div>
        <span style="font-size:10px;color:${vndStatusColor(v.status)};font-weight:600;">${v.status||'Active'}</span>
      </div>`).join('');
  }
}

// ── Vendor options HTML for selects in invoices/POs ──────────────────────────
function getVendorOptionsHTML(selectedName) {
  const vendors = window._allVendors || [];
  const active  = vendors.filter(v => v.status !== 'Blocked' && v.status !== 'Inactive');
  let html = `<option value="">Select vendor…</option>`;
  html += active.map(v =>
    `<option value="${escapeHtml(v.vendor_name)}" ${v.vendor_name === selectedName ? 'selected' : ''} data-currency="${escapeHtml(v.currency||'')}">${escapeHtml(v.vendor_name)}</option>`
  ).join('');
  if (active.length) html += `<option value="__new__" style="color:var(--accent);">+ Add new vendor…</option>`;
  return html;
}

// ── onInvVendorSelect and onPOVendorSelect are defined in invoices.js / tables.js ──

function onPOVendorSelect(sel) {
  const val = sel.value;
  if (val === '__new__') { sel.value = ''; if (typeof showVendorModal === 'function') showVendorModal(null); return; }
  const nameInput = document.getElementById('po-vendor');
  if (nameInput && val) nameInput.value = val;
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset.currency) {
    const curField = document.getElementById('po-currency');
    if (curField) curField.value = opt.dataset.currency;
  }
}

// ── renderVendorCell — used in tables.js for PO rows ─────────────────────────
function renderVendorCell(vendorName) {
  const vendors = window._allVendors || [];
  const vendor  = vendors.find(v => v.vendor_name === vendorName);
  const logoSrc = vendor ? (vendor.logo_url || null) : null;
  if (logoSrc) {
    return `<div style="display:flex;align-items:center;gap:6px;">
      <img src="${escapeHtml(logoSrc)}" style="height:18px;width:auto;max-width:36px;object-fit:contain;border-radius:3px;background:rgba(255,255,255,0.06);border:1px solid var(--border);" onerror="this.style.display='none'"/>
      <span>${escapeHtml(vendorName||'—')}</span>
    </div>`;
  }
  return escapeHtml(vendorName || '—');
}

// ── Delete vendor ─────────────────────────────────────────────────────────────
async function deleteVendorById(id) {
  if (!confirm('Delete this vendor? This cannot be undone.')) return;
  try {
    await callAPI('deleteVendor', { id });
    _allVendors = _allVendors.filter(v => v.id !== id);
    window._allVendors = _allVendors;
    renderVendorGrid();
    renderVendorDashboardCards(_allVendors);
    showToast('Vendor deleted', 'info');
  } catch(e) { showToast('Delete failed: ' + e.message, 'error'); }
}

// ── Vendor Modal ──────────────────────────────────────────────────────────────
function showVendorModal(id) {
  _editingVndId = id;
  const v      = id ? (_allVendors.find(v => v.id === id) || {}) : {};
  const isEdit = !!id;

  const html = `
    <div id="vnd-modal-overlay" onclick="closeVendorModal()" style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.52);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:1rem;animation:overlayFadeIn 0.2s ease;">
      <div onclick="event.stopPropagation()" style="position:relative;width:100%;max-width:600px;max-height:92vh;overflow-y:auto;border-radius:var(--r-lg);padding:1.5rem;background:var(--glass-bg-strong);backdrop-filter:var(--glass-blur);border:1px solid var(--border);box-shadow:0 24px 64px rgba(0,0,0,0.45);animation:modalSpringIn var(--dur-enter) var(--spring-bounce) both;">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
          <div>
            <h2 style="font-size:17px;font-weight:700;color:var(--text-1);">${isEdit?'Edit Vendor':'New Vendor'}</h2>
            <p style="font-size:12px;color:var(--text-3);margin-top:2px;">${isEdit?`Editing ${escapeHtml(v.vendor_name||id)}`:'Fill in the vendor details below'}</p>
          </div>
          <button onclick="closeVendorModal()" style="background:var(--glass-bg);border:1px solid var(--border);color:var(--text-3);width:30px;height:30px;border-radius:var(--r-sm);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;font-family:Inter,sans-serif;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Vendor Name *</label><input id="vnd-f-name" type="text" placeholder="Company or person name" value="${escapeHtml(v.vendor_name||'')}"/></div>
          <div class="form-group"><label>Category</label>
            <select id="vnd-f-category" class="pref-select" style="width:100%;">
              <option value="">Select…</option>
              ${VND_CATEGORIES.map(c=>`<option value="${c}" ${v.category===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Contact Person</label><input id="vnd-f-contact" type="text" placeholder="Contact name" value="${escapeHtml(v.contact_person||'')}"/></div>
          <div class="form-group"><label>Phone</label><input id="vnd-f-phone" type="tel" placeholder="+964…" value="${escapeHtml(v.phone||'')}"/></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Email</label><input id="vnd-f-email" type="email" placeholder="vendor@example.com" value="${escapeHtml(v.email||'')}"/></div>
          <div class="form-group"><label>Website</label><input id="vnd-f-website" type="url" placeholder="https://…" value="${escapeHtml(v.website||'')}"/></div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label>Address</label><input id="vnd-f-address" type="text" placeholder="Full address" value="${escapeHtml(v.address||'')}"/>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Currency</label>
            <select id="vnd-f-currency" class="pref-select" style="width:100%;">
              ${VND_CURRENCIES.map(c=>`<option value="${c}" ${(v.currency||'IQD')===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Payment Terms</label>
            <select id="vnd-f-terms" class="pref-select" style="width:100%;">
              <option value="">Select…</option>
              ${VND_PAYMENT_TERMS.map(t=>`<option value="${t}" ${v.payment_terms===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group"><label>Status</label>
            <select id="vnd-f-status" class="pref-select" style="width:100%;">
              ${VND_STATUSES.map(s=>`<option value="${s}" ${(v.status||'Active')===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Logo URL</label><input id="vnd-f-logo" type="url" placeholder="https://…" value="${escapeHtml(v.logo_url||'')}"/></div>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label>Notes</label>
          <textarea id="vnd-f-notes" rows="2" placeholder="Additional notes…" style="resize:vertical;">${escapeHtml(v.notes||'')}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn-export" onclick="closeVendorModal()">Cancel</button>
          <button class="btn-primary" onclick="submitVendorForm()">${isEdit?'Save Changes':'Create Vendor'}</button>
        </div>

      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function closeVendorModal() {
  const el = document.getElementById('vnd-modal-overlay');
  if (el) el.remove();
  _editingVndId = null;
}

async function submitVendorForm() {
  const g = id => document.getElementById(id)?.value?.trim();
  const name = g('vnd-f-name');
  if (!name) { showToast('Vendor name is required', 'error'); return; }

  const user    = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  const payload = {
    vendor_name:   name,
    category:      document.getElementById('vnd-f-category')?.value || '',
    contact_person: g('vnd-f-contact'),
    phone:         g('vnd-f-phone'),
    email:         g('vnd-f-email'),
    website:       g('vnd-f-website'),
    address:       g('vnd-f-address'),
    currency:      document.getElementById('vnd-f-currency')?.value || 'IQD',
    payment_terms: document.getElementById('vnd-f-terms')?.value || '',
    status:        document.getElementById('vnd-f-status')?.value || 'Active',
    logo_url:      g('vnd-f-logo'),
    notes:         document.getElementById('vnd-f-notes')?.value?.trim() || '',
    created_by:    user.email || '',
  };

  const btn = document.querySelector('#vnd-modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    if (_editingVndId) {
      payload.id = _editingVndId;
      await callAPI('updateVendor', payload);
      const idx = _allVendors.findIndex(v => v.id === _editingVndId);
      if (idx !== -1) Object.assign(_allVendors[idx], payload);
      showToast('Vendor updated ✓', 'success');
    } else {
      const res  = await callAPI('saveVendor', payload);
      payload.id = res.id;
      _allVendors.unshift(payload);
      showToast('Vendor created ✓', 'success');
    }
    window._allVendors = _allVendors;
    closeVendorModal();
    renderVendorGrid();
    renderVendorDashboardCards(_allVendors);
    const panel = document.getElementById('vnd-dash-panel');
    if (panel && _allVendors.length) panel.style.display = '';
    const sub = document.getElementById('vendors-subtitle');
    if (sub) sub.textContent = _allVendors.length + ' vendor' + (_allVendors.length !== 1 ? 's' : '');
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = _editingVndId ? 'Save Changes' : 'Create Vendor'; }
  }
}
