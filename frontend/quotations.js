// ══════════════════════════════════════════════════════
// QUOTATION COMPARISON MODULE
// ══════════════════════════════════════════════════════

let _allComparisons  = [];
let _compVendors     = [];   // vendors for current form
let _editingCompId   = null;
let _recalcDebounce  = null;

// ── LOAD LIST ─────────────────────────────────────────

async function loadQuotations() {
  const wrap = document.getElementById('qc-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p class="loading" style="padding:2rem;text-align:center;">Loading...</p>';
  try {
    const r = await callAPI('getComparisons', {});
    _allComparisons = r.rows || [];
    renderCompList();
  } catch(e) {
    wrap.innerHTML = `<p class="error" style="padding:1rem;">Error: ${escapeHtml(e.message)}</p>`;
  }
}

function renderCompList() {
  const wrap = document.getElementById('qc-wrap');
  if (!wrap) return;
  if (!_allComparisons.length) {
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:4rem 2rem;text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--text-4);margin-bottom:1rem;"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
        <p style="color:var(--text-3);font-size:14px;">No comparison tables yet.</p>
        <p style="color:var(--text-4);font-size:12px;margin-top:4px;">Click "+ New Comparison" to start.</p>
      </div>`;
    return;
  }
  wrap.innerHTML = `<div class="qc-list">${_allComparisons.map(c => `
    <div class="qc-card glass" onclick="viewComp('${c.id}')">
      <div class="qc-card-top">
        <div>
          <span class="qc-pr-badge">${escapeHtml(c.pr_number||'—')}</span>
          <div class="qc-card-title">${escapeHtml(c.request_description||'—')}</div>
          <div class="qc-card-meta">${escapeHtml(c.requesting_dept||'')} · ${c.request_date?new Date(c.request_date).toLocaleDateString():''}</div>
        </div>
        <span class="badge badge-${c.status||'draft'}">${(c.status||'draft').replace(/_/g,' ')}</span>
      </div>
      <div class="qc-card-bottom">
        <span style="font-size:12px;color:var(--text-3);">
          ${c.currency||''} <strong style="color:var(--accent-amber);">${Number(c.total_pr_value||0).toLocaleString()}</strong>
        </span>
        ${c.winner_vendor ? `<span style="font-size:12px;color:var(--accent-green);">🏆 ${escapeHtml(c.winner_vendor)}</span>` : ''}
        <div style="display:flex;gap:6px;margin-left:auto;" onclick="event.stopPropagation()">
          <button class="btn-edit"   onclick="editComp('${c.id}')">Edit</button>
          <button class="btn-export" onclick="exportCompExcel('${c.id}')" style="font-size:11px;padding:3px 8px;">XLS</button>
          <button class="btn-export" onclick="exportCompPDF('${c.id}')" style="font-size:11px;padding:3px 8px;">PDF</button>
          <button class="btn-delete" onclick="deleteComp('${c.id}')">Delete</button>
        </div>
      </div>
    </div>`).join('')}</div>`;
}

// ── FORM ──────────────────────────────────────────────

function showNewCompForm() {
  _editingCompId = null;
  _compVendors = [emptyVendor(), emptyVendor()];
  renderCompForm(null);
}

function emptyVendor() {
  return { vendor_name:'', annex_ref:'', total_cost:'',
    spec_compliance:100, install_compliance:100,
    delivery_days:'', warranty_months:'',
    payment_compliance:100, commitment_pct:100 };
}

function renderCompForm(comp) {
  const wrap = document.getElementById('qc-wrap');
  if (!wrap) return;

  const poOptions = (tableData['POs']||[])
    .map(p=>`<option value="${p.id}" ${comp?.linked_po_id===p.id?'selected':''}>${escapeHtml(p.po_number||p.id)}</option>`)
    .join('');

  const w = {
    price:        parseFloat(comp?.w_price        ?? 40),
    requirements: parseFloat(comp?.w_requirements ?? 30),
    delivery:     parseFloat(comp?.w_delivery     ?? 10),
    warranty:     parseFloat(comp?.w_warranty     ?? 10),
    payment:      parseFloat(comp?.w_payment      ??  5),
    commitment:   parseFloat(comp?.w_commitment   ??  5),
  };

  wrap.innerHTML = `
  <div class="qc-form">

    <!-- S1: Request Info -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        Request Information
      </div>
      <div class="qc-grid">
        <div class="form-group"><label>Request Description <span class="req">*</span></label>
          <input id="qf-desc" type="text" value="${escapeHtml(comp?.request_description||'')}" placeholder="e.g. Provision of UX/UI Services"/></div>
        <div class="form-group"><label>PR Number <span class="req">*</span></label>
          <input id="qf-pr" type="text" value="${escapeHtml(comp?.pr_number||'')}" placeholder="e.g. SW3104"/></div>
        <div class="form-group"><label>Requesting Department</label>
          <input id="qf-dept" type="text" value="${escapeHtml(comp?.requesting_dept||'')}" placeholder="IT - Technology"/></div>
        <div class="form-group"><label>Request Date</label>
          <input id="qf-rdate" type="date" value="${comp?.request_date?String(comp.request_date).split('T')[0]:''}"/></div>
        <div class="form-group"><label>Awarding Date</label>
          <input id="qf-adate" type="date" value="${comp?.awarding_date?String(comp.awarding_date).split('T')[0]:''}"/></div>
        <div class="form-group"><label>Total PR Value</label>
          <input id="qf-val" type="number" value="${comp?.total_pr_value||''}" placeholder="0" min="0"/></div>
        <div class="form-group"><label>Currency</label>
          <select id="qf-cur">${['IQD','USD','EUR','GBP'].map(c=>`<option ${(comp?.currency||'IQD')===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Delivery Term (Days)</label>
          <input id="qf-dterm" type="number" value="${comp?.delivery_term_days??35}" min="1"/></div>
        <div class="form-group"><label>Warranty Term (Months)</label>
          <input id="qf-wterm" type="number" value="${comp?.warranty_term_months??12}" min="0"/></div>
        <div class="form-group"><label>Linked PO (optional)</label>
          <select id="qf-po"><option value="">— None —</option>${poOptions}</select></div>
        <div class="form-group"><label>Status</label>
          <select id="qf-status">${['draft','in_review','approved','awarded'].map(s=>`<option value="${s}" ${(comp?.status||'draft')===s?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}</select></div>
      </div>
    </div>

    <!-- S2: Scoring Weights -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd" style="justify-content:space-between;">
        <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Scoring Weights</span>
        <span id="qf-wtotal" class="qc-wtotal"></span>
      </div>
      <p style="font-size:12px;color:var(--text-3);margin-bottom:12px;">Weights must total exactly 100. Adjust per comparison requirements.</p>
      <div class="qc-wgrid">
        ${[{k:'price',l:'Price / السعر',v:w.price},{k:'requirements',l:'Requirements / المتطلبات',v:w.requirements},
           {k:'delivery',l:'Delivery / التسليم',v:w.delivery},{k:'warranty',l:'Warranty / الضمان',v:w.warranty},
           {k:'payment',l:'Payment / الدفع',v:w.payment},{k:'commitment',l:'Commitment / الالتزام',v:w.commitment}
        ].map(x=>`<div class="form-group">
          <label style="font-size:11px;">${x.l}</label>
          <input type="number" id="qf-w-${x.k}" class="qc-winput" value="${x.v}" min="0" max="100" step="0.5" oninput="updateWTotal()"/>
        </div>`).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn-export" onclick="normalizeWeights()" style="font-size:12px;">↺ Auto-normalize to 100</button>
      </div>
    </div>

    <!-- S3: Vendors -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd" style="justify-content:space-between;">
        <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> Vendor Quotations</span>
        <button class="btn-add" onclick="addVendor()" style="font-size:12px;padding:6px 12px;">+ Add Vendor</button>
      </div>
      <div id="qf-vendors"></div>
    </div>

    <!-- S4: Live Scores -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
        Live Scores Preview
      </div>
      <div id="qf-scores"></div>
    </div>

    <!-- S5: Winner -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
        Winner Selection
      </div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;flex-wrap:wrap;">
        <div class="form-group">
          <label>Winning Vendor</label>
          <select id="qf-winner"><option value="">— Auto (highest score) —</option></select>
        </div>
        <div class="form-group">
          <label>Comment / Recommendation (ملاحظات / توصية)</label>
          <textarea id="qf-comment" rows="3" placeholder="e.g. Vendor A offers best value with full specification compliance...">${escapeHtml(comp?.winner_comment||'')}</textarea>
        </div>
      </div>
    </div>

    <!-- S6: Signatures -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Committee Signatures / توقيعات اللجنة
      </div>
      <div class="qc-grid">
        ${[{id:'qf-s1',l:'Head of Committee / رئيس اللجنة',v:comp?.head_of_committee||''},
           {id:'qf-s2',l:'Requester / الطالب',v:comp?.requester_name||''},
           {id:'qf-s3',l:'Requester Management / إدارة الطالب',v:comp?.requester_management||''},
           {id:'qf-s4',l:'Supply Chain Officer / مسؤول التوريد',v:comp?.supply_chain_officer||''},
           {id:'qf-s5',l:'Head of Supply Chain / رئيس التوريد',v:comp?.head_of_supply_chain||''}
        ].map(s=>`<div class="form-group"><label style="font-size:11px;">${s.l}</label>
          <input type="text" id="${s.id}" value="${escapeHtml(s.v)}" placeholder="Full name / الاسم الكامل"/></div>`).join('')}
      </div>
    </div>

    <!-- Actions -->
    <div class="qc-actions">
      <button class="btn-export" onclick="cancelCompForm()">Cancel</button>
      <button class="btn-export" onclick="recalcScores()">↻ Recalculate</button>
      <button class="btn-primary" id="qf-save-btn" onclick="saveCompForm()">
        ${comp ? 'Update Comparison' : 'Save Comparison'}
      </button>
    </div>
  </div>`;

  renderVendorRows();
  updateWTotal();
  recalcScores();
}

// ── VENDOR ROWS ────────────────────────────────────────

function renderVendorRows() {
  const wrap = document.getElementById('qf-vendors');
  if (!wrap) return;
  wrap.innerHTML = _compVendors.map((v, i) => `
    <div class="qc-vrow glass" id="qcv-${i}">
      <div class="qc-vrow-hd">
        <span class="qc-vnum">Vendor ${i+1} / المورد ${i+1}</span>
        ${_compVendors.length > 1 ?
          `<button class="btn-delete" onclick="removeVendor(${i})" style="font-size:11px;padding:2px 8px;">Remove</button>`:'' }
      </div>
      <div class="qc-vgrid">
        <div class="form-group"><label>Vendor Name <span class="req">*</span></label>
          <input type="text" value="${escapeHtml(v.vendor_name||'')}" placeholder="Company name"
            oninput="_compVendors[${i}].vendor_name=this.value;dRecalc()"/></div>
        <div class="form-group"><label>Annex / Reference</label>
          <input type="text" value="${escapeHtml(v.annex_ref||'')}" placeholder="Annex A"
            oninput="_compVendors[${i}].annex_ref=this.value"/></div>
        <div class="form-group"><label>Total Cost <span class="req">*</span></label>
          <input type="number" value="${v.total_cost||''}" placeholder="0" min="0"
            oninput="_compVendors[${i}].total_cost=this.value;dRecalc()"/></div>
        <div class="form-group"><label>Spec Compliance %</label>
          <input type="number" value="${v.spec_compliance??100}" min="0" max="100"
            oninput="_compVendors[${i}].spec_compliance=this.value;dRecalc()"/></div>
        <div class="form-group"><label>Install Compliance %</label>
          <input type="number" value="${v.install_compliance??100}" min="0" max="100"
            oninput="_compVendors[${i}].install_compliance=this.value;dRecalc()"/></div>
        <div class="form-group"><label>Delivery (Days) <span class="req">*</span></label>
          <input type="number" value="${v.delivery_days||''}" min="1" placeholder="e.g. 35"
            oninput="_compVendors[${i}].delivery_days=this.value;dRecalc()"/></div>
        <div class="form-group"><label>Warranty (Months)</label>
          <input type="number" value="${v.warranty_months||''}" min="0" placeholder="e.g. 12"
            oninput="_compVendors[${i}].warranty_months=this.value;dRecalc()"/></div>
        <div class="form-group"><label>Payment Compliance %</label>
          <input type="number" value="${v.payment_compliance??100}" min="0" max="100"
            oninput="_compVendors[${i}].payment_compliance=this.value;dRecalc()"/></div>
        <div class="form-group"><label>Commitment / Experience %</label>
          <input type="number" value="${v.commitment_pct??100}" min="0" max="100"
            oninput="_compVendors[${i}].commitment_pct=this.value;dRecalc()"/></div>
      </div>
    </div>`).join('');
}

function addVendor() {
  _compVendors.push(emptyVendor());
  renderVendorRows();
  recalcScores();
  const lastVrow = document.getElementById(`qcv-${_compVendors.length-1}`);
  if (lastVrow) lastVrow.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function removeVendor(idx) {
  if (_compVendors.length <= 1) { showToast('At least one vendor required', 'info'); return; }
  _compVendors.splice(idx, 1);
  renderVendorRows();
  recalcScores();
}

// ── WEIGHT VALIDATION ─────────────────────────────────

function getWeights() {
  return {
    price:        parseFloat(document.getElementById('qf-w-price')?.value        ?? 40),
    requirements: parseFloat(document.getElementById('qf-w-requirements')?.value ?? 30),
    delivery:     parseFloat(document.getElementById('qf-w-delivery')?.value     ?? 10),
    warranty:     parseFloat(document.getElementById('qf-w-warranty')?.value     ?? 10),
    payment:      parseFloat(document.getElementById('qf-w-payment')?.value      ??  5),
    commitment:   parseFloat(document.getElementById('qf-w-commitment')?.value   ??  5),
  };
}

function updateWTotal() {
  const w     = getWeights();
  const total = Object.values(w).reduce((s,v)=>s+(isNaN(v)?0:v),0);
  const el    = document.getElementById('qf-wtotal');
  const saveBtn = document.getElementById('qf-save-btn');
  const isOk  = Math.abs(total-100) < 0.01;
  if (el) {
    el.textContent = `Total: ${total.toFixed(1)}`;
    el.style.color = isOk ? 'var(--accent-green)' : 'var(--accent-red)';
    el.style.background = isOk ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
  }
  if (saveBtn) {
    saveBtn.disabled = !isOk;
    saveBtn.style.opacity = isOk ? '1' : '0.5';
    saveBtn.title = isOk ? '' : 'Weights must total 100';
  }
}

function normalizeWeights() {
  const w     = getWeights();
  const total = Object.values(w).reduce((s,v)=>s+(isNaN(v)?0:v),0);
  if (total === 0) return;
  const factor = 100 / total;
  Object.keys(w).forEach(k => {
    const el = document.getElementById('qf-w-' + k);
    if (el) el.value = parseFloat((w[k] * factor).toFixed(2));
  });
  updateWTotal();
  recalcScores();
}

// ── SCORING ENGINE ─────────────────────────────────────

function dRecalc() {
  clearTimeout(_recalcDebounce);
  _recalcDebounce = setTimeout(recalcScores, 350);
}

function scoreVendors(vendors, weights) {
  if (!vendors.length) return [];

  const costs      = vendors.map(v => parseFloat(v.total_cost)     ||0).filter(x=>x>0);
  const deliveries = vendors.map(v => parseFloat(v.delivery_days)  ||0).filter(x=>x>0);
  const warranties = vendors.map(v => parseFloat(v.warranty_months)||0).filter(x=>x>0);

  const minCost     = costs.length      ? Math.min(...costs)      : 0;
  const minDelivery = deliveries.length ? Math.min(...deliveries) : 0;
  const maxWarranty = warranties.length ? Math.max(...warranties) : 0;

  return vendors.map(v => {
    const cost    = parseFloat(v.total_cost)||0;
    const deliv   = parseFloat(v.delivery_days)||0;
    const warr    = parseFloat(v.warranty_months)||0;
    const spec    = parseFloat(v.spec_compliance)??100;
    const install = parseFloat(v.install_compliance)??100;
    const pay     = parseFloat(v.payment_compliance)??100;
    const commit  = parseFloat(v.commitment_pct)??100;

    const pScore = (cost>0 && minCost>0) ? (minCost/cost)*weights.price : 0;
    const rScore = ((spec+install)/2/100) * weights.requirements;
    const dScore = (deliv>0 && minDelivery>0) ? (minDelivery/deliv)*weights.delivery : 0;
    const wScore = (warr>0 && maxWarranty>0) ? (warr/maxWarranty)*weights.warranty : 0;
    const payScore    = (pay/100)*weights.payment;
    const commitScore = (commit/100)*weights.commitment;

    const total = pScore+rScore+dScore+wScore+payScore+commitScore;
    return {
      ...v,
      price_score:        parseFloat(pScore.toFixed(4)),
      requirements_score: parseFloat(rScore.toFixed(4)),
      delivery_score:     parseFloat(dScore.toFixed(4)),
      warranty_score:     parseFloat(wScore.toFixed(4)),
      payment_score:      parseFloat(payScore.toFixed(4)),
      commitment_score:   parseFloat(commitScore.toFixed(4)),
      total_score:        parseFloat(total.toFixed(4)),
    };
  })
  .sort((a,b) => b.total_score - a.total_score)
  .map((v,i) => ({...v, rank:i+1}));
}

function recalcScores() {
  const w      = getWeights();
  const scored = scoreVendors(_compVendors, w);
  renderScoresTable(scored);
  updateWinnerSelect(scored);
  return scored;
}

// ── COLOR CODING ───────────────────────────────────────

function colColor(values, idx) {
  const filtered = values.filter(v => !isNaN(v) && v > 0);
  if (filtered.length < 2) return 'neutral';
  const maxV = Math.max(...filtered);
  const minV = Math.min(...filtered);
  if (Math.abs(maxV - minV) < 0.001) return 'neutral';
  if (Math.abs(values[idx] - maxV) < 0.001) return 'best';
  if (Math.abs(values[idx] - minV) < 0.001) return 'worst';
  return 'mid';
}

function renderScoresTable(scored) {
  const el = document.getElementById('qf-scores');
  if (!el) return;
  if (!scored.length || scored.every(s=>!s.vendor_name)) {
    el.innerHTML = '<p class="empty" style="padding:1rem;text-align:center;">Enter vendor data above to see live scores.</p>';
    return;
  }

  const SCORE_KEYS = ['price_score','requirements_score','delivery_score','warranty_score','payment_score','commitment_score','total_score'];
  const LABELS     = ['Price','Requirements','Delivery','Warranty','Payment','Commitment','TOTAL'];

  const colorMap = SCORE_KEYS.map(key => {
    const vals = scored.map(s => parseFloat(s[key])||0);
    return scored.map((_,i) => colColor(vals, i));
  });

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="qc-stbl">
        <thead>
          <tr>
            <th style="text-align:left;">Vendor / المورد</th>
            <th>Cost / التكلفة</th>
            ${LABELS.map(l=>`<th>${l}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${scored.map((s,ri) => `
            <tr ${ri===0?'class="qc-winner-tr"':''}>
              <td style="text-align:left;">
                ${ri===0?'<span style="font-size:14px;">🏆 </span>':''}
                <strong>${escapeHtml(s.vendor_name||'Vendor '+(ri+1))}</strong>
                ${s.annex_ref?`<span style="font-size:10px;color:var(--text-3);"> (${escapeHtml(s.annex_ref)})</span>`:''}
              </td>
              <td style="font-weight:600;color:var(--accent-amber);">${Number(s.total_cost||0).toLocaleString()}</td>
              ${SCORE_KEYS.map((key,ci) => {
                const c = colorMap[ci][ri];
                const isTotal = key==='total_score';
                const style = c==='best' ? 'color:var(--accent-green);font-weight:700;' :
                              c==='worst'? 'color:var(--accent-red);' :
                              isTotal    ? 'font-weight:700;color:var(--text-1);' : '';
                return `<td style="${style}">${parseFloat(s[key]||0).toFixed(isTotal?2:1)}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="2" style="font-size:10px;color:var(--text-4);">
            Weights: ${['price','requirements','delivery','warranty','payment','commitment'].map(k=>
              `${k.charAt(0).toUpperCase()}=${getWeights()[k]}`).join(' | ')}
          </td><td colspan="${LABELS.length}"></td></tr>
        </tfoot>
      </table>
    </div>`;
}

function updateWinnerSelect(scored) {
  const sel = document.getElementById('qf-winner');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Auto (highest score) —</option>' +
    scored.filter(s=>s.vendor_name).map(s=>
      `<option value="${escapeHtml(s.vendor_name)}" ${cur===s.vendor_name?'selected':''}>
        ${escapeHtml(s.vendor_name)} — Score: ${parseFloat(s.total_score||0).toFixed(2)}
      </option>`).join('');
}

// ── SAVE ──────────────────────────────────────────────

async function saveCompForm() {
  const desc = document.getElementById('qf-desc')?.value.trim();
  const pr   = document.getElementById('qf-pr')?.value.trim();
  if (!desc || !pr) { showToast('Description and PR Number are required', 'info'); return; }

  const w = getWeights();
  const wtotal = Object.values(w).reduce((s,v)=>s+(isNaN(v)?0:v),0);
  if (Math.abs(wtotal-100) > 0.5) { showToast('Weights must total 100', 'info'); return; }

  const hasVendors = _compVendors.some(v=>v.vendor_name);
  if (!hasVendors) { showToast('Enter at least one vendor name', 'info'); return; }

  const scored   = recalcScores();
  const winnerSel = document.getElementById('qf-winner')?.value;
  const winner   = winnerSel || scored[0]?.vendor_name || '';
  const winnerRec = scored.find(s=>s.vendor_name===winner) || scored[0] || {};

  const data = {
    request_description: desc,
    pr_number:           pr,
    requesting_dept:     document.getElementById('qf-dept')?.value||'',
    request_date:        document.getElementById('qf-rdate')?.value||'',
    awarding_date:       document.getElementById('qf-adate')?.value||'',
    total_pr_value:      parseFloat(document.getElementById('qf-val')?.value)||0,
    currency:            document.getElementById('qf-cur')?.value||'IQD',
    delivery_term_days:  parseInt(document.getElementById('qf-dterm')?.value)||35,
    warranty_term_months:parseInt(document.getElementById('qf-wterm')?.value)||12,
    linked_po_id:        document.getElementById('qf-po')?.value||'',
    status:              document.getElementById('qf-status')?.value||'draft',
    w_price:             w.price,
    w_requirements:      w.requirements,
    w_delivery:          w.delivery,
    w_warranty:          w.warranty,
    w_payment:           w.payment,
    w_commitment:        w.commitment,
    winner_vendor:       winner,
    winner_score:        parseFloat(winnerRec.total_score||0),
    winner_amount:       parseFloat(winnerRec.total_cost||0),
    winner_comment:      document.getElementById('qf-comment')?.value||'',
    head_of_committee:   document.getElementById('qf-s1')?.value||'',
    requester_name:      document.getElementById('qf-s2')?.value||'',
    requester_management:document.getElementById('qf-s3')?.value||'',
    supply_chain_officer:document.getElementById('qf-s4')?.value||'',
    head_of_supply_chain:document.getElementById('qf-s5')?.value||'',
  };

  const btn = document.getElementById('qf-save-btn');
  if (btn) { btn.textContent='Saving...'; btn.disabled=true; }

  try {
    if (_editingCompId) {
      await callAPI('updateComparison', { id:_editingCompId, data, vendors:scored });
      _allComparisons = _allComparisons.map(c=>c.id===_editingCompId?{...c,...data}:c);
      showToast('Comparison updated ✓','success');
    } else {
      const res = await callAPI('saveComparison', { data, vendors:scored });
      data.id = res.id;
      _allComparisons.push(data);
      showToast('Comparison saved ✓','success');
    }
    cacheClear('Comparisons');
    _editingCompId = null;
    _compVendors   = [];
    renderCompList();
  } catch(e) {
    showToast('Save failed: '+e.message,'error');
    if (btn) { btn.textContent=_editingCompId?'Update Comparison':'Save Comparison'; btn.disabled=false; }
  }
}

function cancelCompForm() {
  _editingCompId=null; _compVendors=[];
  renderCompList();
}

// ── VIEW / EDIT / DELETE ───────────────────────────────

async function viewComp(id) {
  const comp = _allComparisons.find(c=>c.id===id);
  if (!comp) return;
  tableData['Comparisons'] = _allComparisons;
  openDetailPanel('Comparisons', id);
}

async function editComp(id) {
  const comp = _allComparisons.find(c=>c.id===id);
  if (!comp) return;
  try {
    const r = await callAPI('getCompVendors',{comparison_id:id});
    _compVendors   = r.rows.map(v=>({...v}));
    _editingCompId = id;
    renderCompForm(comp);
  } catch(e) { showToast('Failed to load: '+e.message,'error'); }
}

async function deleteComp(id) {
  showConfirm('Delete Comparison','This will permanently delete the comparison and all vendor data.',
    async () => {
      try {
        await callAPI('deleteComparison',{id});
        _allComparisons = _allComparisons.filter(c=>c.id!==id);
        renderCompList();
        showToast('Deleted','success');
      } catch(e){ showToast('Delete failed: '+e.message,'error'); }
    });
}

// ── EXCEL EXPORT ───────────────────────────────────────

async function exportCompExcel(id) {
  const comp = _allComparisons.find(c=>c.id===id);
  if (!comp) return;
  let vds = _compVendors.filter(v=>v.comparison_id===id);
  if (!vds.length) {
    const r = await callAPI('getCompVendors',{comparison_id:id});
    vds = r.rows||[];
  }
  const w = {
    price:comp.w_price??40, requirements:comp.w_requirements??30,
    delivery:comp.w_delivery??10, warranty:comp.w_warranty??10,
    payment:comp.w_payment??5, commitment:comp.w_commitment??5
  };
  const scored = scoreVendors(vds, w);
  if (!window.XLSX){ showToast('SheetJS not loaded','error'); return; }

  const rows = [];
  rows.push(['','جدول مقارنة العطاءات النهائية — Final Bids Comparison Table (Equipment + Service)']);
  rows.push([]);
  rows.push(['','وصف الطلب / Request Description:',comp.request_description||'','','','الجهة الطالبة / Dept:',comp.requesting_dept||'']);
  rows.push(['','رقم الطلب / PR Number:',comp.pr_number||'','','','تاريخ الترسية / Awarding Date:',comp.awarding_date?String(comp.awarding_date).split('T')[0]:'']);
  rows.push(['','تاريخ الطلب / Request Date:',comp.request_date?String(comp.request_date).split('T')[0]:'','','','القيمة الإجمالية / Total PR Value:',`${Number(comp.total_pr_value||0).toLocaleString()} ${comp.currency||''}`]);
  rows.push(['','مدة التسليم (أيام) / Delivery Term (Days):',comp.delivery_term_days||35,'','','مدة الضمان (شهر) / Warranty (Months):',comp.warranty_term_months||12]);
  rows.push([]);
  rows.push(['','جدول بيانات الموردين / Vendors\' Data Table']);
  rows.push(['','اسم المورد / Vendor Name','التكلفة / Total Cost','امتثال المواصفات % / Spec %','امتثال التركيب % / Install %','التسليم (أيام) / Delivery Days','الضمان (شهر) / Warranty Months','الدفع % / Payment %','الالتزام % / Commitment %']);
  scored.forEach(v=>rows.push(['',v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),v.total_cost,v.spec_compliance,v.install_compliance,v.delivery_days,v.warranty_months,v.payment_compliance,v.commitment_pct]));
  rows.push([]);
  rows.push(['','جدول النقاط / Vendors\' Scores Table']);
  rows.push(['','الأوزان / Standard Scoring',w.price,w.requirements,'',w.delivery,w.warranty,w.payment,w.commitment]);
  rows.push(['','اسم المورد / Vendor Name','السعر / Price','المتطلبات / Requirements','','التسليم / Delivery','الضمان / Warranty','الدفع / Payment','الالتزام / Commitment','المجموع / Total']);
  scored.forEach(v=>rows.push(['',v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),
    parseFloat(v.price_score||0).toFixed(2),parseFloat(v.requirements_score||0).toFixed(2),'',
    parseFloat(v.delivery_score||0).toFixed(2),parseFloat(v.warranty_score||0).toFixed(2),
    parseFloat(v.payment_score||0).toFixed(2),parseFloat(v.commitment_score||0).toFixed(2),
    parseFloat(v.total_score||0).toFixed(2)]));
  rows.push([]);
  rows.push(['','العطاء الفائز / Winning Bid']);
  rows.push(['','المورد الفائز / Winning Supplier','','المجموع / Total Score','','المبلغ / Amount','ملاحظات / Comment']);
  rows.push(['',comp.winner_vendor||scored[0]?.vendor_name||'','',
    parseFloat(comp.winner_score||scored[0]?.total_score||0).toFixed(2),'',
    Number(comp.winner_amount||scored[0]?.total_cost||0).toLocaleString(),comp.winner_comment||'']);
  rows.push([]);
  rows.push(['','توقيعات اللجنة / Committee Signatures']);
  rows.push(['','رئيس اللجنة\nHead of Committee','الطالب\nRequester','إدارة الطالب\nRequester Mgmt','مسؤول التوريد\nSupply Chain Officer','رئيس التوريد\nHead of Supply Chain']);
  rows.push(['',comp.head_of_committee||'',comp.requester_name||'',comp.requester_management||'',comp.supply_chain_officer||'',comp.head_of_supply_chain||'']);
  rows.push(['','________________','________________','________________','________________','________________']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:3},{wch:38},{wch:18},{wch:16},{wch:16},{wch:14},{wch:14},{wch:14},{wch:14},{wch:12}];
  ws['!dir']='rtl';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Comparison / مقارنة');
  XLSX.writeFile(wb,`Comparison_${comp.pr_number||'PR'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exported ✓','success');
}

// ── PDF EXPORT ─────────────────────────────────────────

async function exportCompPDF(id) {
  const comp = _allComparisons.find(c=>c.id===id);
  if (!comp) return;
  let vds = _compVendors.filter(v=>v.comparison_id===id);
  if (!vds.length) {
    const r = await callAPI('getCompVendors',{comparison_id:id});
    vds = r.rows||[];
  }
  const w = {price:comp.w_price??40,requirements:comp.w_requirements??30,
    delivery:comp.w_delivery??10,warranty:comp.w_warranty??10,
    payment:comp.w_payment??5,commitment:comp.w_commitment??5};
  const scored = scoreVendors(vds,w);
  if (!window.jspdf){ showToast('jsPDF not loaded','error'); return; }

  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const pw  = doc.internal.pageSize.getWidth();
  const ac  = [99,102,241];

  doc.setFillColor(...ac);
  doc.rect(0,0,pw,26,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(12); doc.setFont('helvetica','bold');
  doc.text('Final Bids Comparison — جدول مقارنة العطاءات النهائية', pw/2, 10, {align:'center'});
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text(`PR: ${comp.pr_number||'—'} | ${comp.request_description||'—'} | ${comp.requesting_dept||'—'}`, pw/2, 18, {align:'center'});
  doc.text(`Date: ${comp.request_date?String(comp.request_date).split('T')[0]:'—'} | Value: ${Number(comp.total_pr_value||0).toLocaleString()} ${comp.currency||''}`, pw/2, 23, {align:'center'});

  let y=32; doc.setTextColor(30,30,50);

  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...ac);
  doc.text('Vendors Data / بيانات الموردين',14,y); y+=4;
  doc.autoTable({startY:y,
    head:[['Vendor / المورد','Total Cost / التكلفة','Spec %','Install %','Delivery Days / أيام','Warranty Mo. / شهر','Payment %','Commit %']],
    body:scored.map(v=>[v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),
      Number(v.total_cost||0).toLocaleString(),v.spec_compliance??100,v.install_compliance??100,
      v.delivery_days||'—',v.warranty_months||'—',v.payment_compliance??100,v.commitment_pct??100]),
    headStyles:{fillColor:ac,textColor:[255,255,255],fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:8},alternateRowStyles:{fillColor:[248,247,255]},
    margin:{left:14,right:14}});
  y=doc.lastAutoTable.finalY+8;

  if(y>155){doc.addPage();y=16;}
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...ac);
  doc.text('Scores / النقاط',14,y); y+=4;
  doc.autoTable({startY:y,
    head:[[`Vendor`,`Price(${w.price})`,`Req(${w.requirements})`,`Del(${w.delivery})`,`War(${w.warranty})`,`Pay(${w.payment})`,`Com(${w.commitment})`,'TOTAL / المجموع']],
    body:scored.map((s,i)=>[(i===0?'🏆 ':'')+s.vendor_name+(s.annex_ref?` (${s.annex_ref})`:''),
      parseFloat(s.price_score||0).toFixed(1),parseFloat(s.requirements_score||0).toFixed(1),
      parseFloat(s.delivery_score||0).toFixed(1),parseFloat(s.warranty_score||0).toFixed(1),
      parseFloat(s.payment_score||0).toFixed(1),parseFloat(s.commitment_score||0).toFixed(1),
      parseFloat(s.total_score||0).toFixed(2)]),
    headStyles:{fillColor:ac,textColor:[255,255,255],fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:8},
    didParseCell:d=>{if(d.section==='body'&&d.row.index===0){d.cell.styles.fillColor=[232,255,240];d.cell.styles.fontStyle='bold';}},
    alternateRowStyles:{fillColor:[248,247,255]},
    margin:{left:14,right:14}});
  y=doc.lastAutoTable.finalY+8;

  if(y>155){doc.addPage();y=16;}
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...ac);
  doc.text('Winning Bid / العطاء الفائز',14,y); y+=4;
  const wd=scored[0]||{};
  doc.autoTable({startY:y,
    head:[['Winner / الفائز','Total Score / المجموع','Amount / المبلغ','Comment / ملاحظة']],
    body:[[comp.winner_vendor||wd.vendor_name||'—',
      parseFloat(comp.winner_score||wd.total_score||0).toFixed(2),
      Number(comp.winner_amount||wd.total_cost||0).toLocaleString()+' '+(comp.currency||''),
      comp.winner_comment||'']],
    headStyles:{fillColor:[16,185,129],textColor:[255,255,255],fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:9,fontStyle:'bold'},margin:{left:14,right:14}});
  y=doc.lastAutoTable.finalY+8;

  if(y>165){doc.addPage();y=16;}
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...ac);
  doc.text('Committee Signatures / توقيعات أعضاء اللجنة',14,y); y+=4;
  doc.autoTable({startY:y,
    head:[['رئيس اللجنة\nHead of Committee','الطالب\nRequester','إدارة الطالب\nRequester Mgmt','مسؤول التوريد\nSC Officer','رئيس التوريد\nHead of SC']],
    body:[[comp.head_of_committee||'',comp.requester_name||'',comp.requester_management||'',comp.supply_chain_officer||'',comp.head_of_supply_chain||''],
          ['','','','',''],
          ['________________','________________','________________','________________','________________']],
    headStyles:{fillColor:[230,228,255],textColor:[60,50,120],fontSize:7},
    bodyStyles:{fontSize:8,minCellHeight:10},margin:{left:14,right:14}});

  const tp=doc.internal.getNumberOfPages();
  for(let i=1;i<=tp;i++){
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(160,160,180); doc.setFont('helvetica','normal');
    doc.text(`Task Tracker · PR ${comp.pr_number||'—'} · Page ${i} of ${tp}`,pw/2,200,{align:'center'});
  }
  doc.save(`Comparison_${comp.pr_number||'PR'}_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exported ✓','success');
}
