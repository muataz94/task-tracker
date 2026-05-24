// ══════════════════════════════════════════════════════
// QUOTATION COMPARISON MODULE
// Uses generic API (getAll/addRow/updateRow/deleteRow)
// — no custom backend actions needed
// ══════════════════════════════════════════════════════

let _allComparisons  = [];
let _compVendors     = [];
let _compSignatures  = [];
let _editingCompId   = null;
let _recalcDebounce  = null;

// Returns text in current language — avoids hardcoded Arabic in English mode
function bl(en, ar) { return currentLang === 'ar' ? ar : en; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function defaultSignatures() {
  return [
    { role: 'Head of Committee',      name: '' },
    { role: 'Requester',              name: '' },
    { role: 'Requester Management',   name: '' },
    { role: 'Supply Chain Officer',   name: '' },
    { role: 'Head of Supply Chain',   name: '' },
  ];
}

// ── LOAD LIST ─────────────────────────────────────────

async function loadQuotations() {
  const wrap = document.getElementById('qc-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p class="loading" style="padding:2rem;text-align:center;">' + t('loading') + '</p>';
  try {
    const r = await getAll('Comparisons');
    _allComparisons = r.rows || [];
    renderCompList();
  } catch(e) {
    wrap.innerHTML = `<p class="error" style="padding:1rem;color:var(--accent-red);">Error: ${escapeHtml(e.message)}</p>`;
    console.error('loadQuotations error:', e);
  }
}

function renderCompList() {
  const wrap = document.getElementById('qc-wrap');
  if (!wrap) return;
  if (!_allComparisons.length) {
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:4rem 2rem;text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--text-4);margin-bottom:1rem;">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
          <line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
        <p style="color:var(--text-3);font-size:14px;">${bl('No comparison tables yet.','لا توجد جداول مقارنة بعد.')}</p>
        <p style="color:var(--text-4);font-size:12px;margin-top:4px;">${bl('Click "+ New Comparison" to start.','انقر على "+ مقارنة جديدة" للبدء.')}</p>
      </div>`;
    return;
  }
  wrap.innerHTML = `<div class="qc-list">${_allComparisons.map(c => `
    <div class="qc-card glass" onclick="viewComp('${c.id}')">
      <div class="qc-card-top">
        <div>
          <span class="qc-pr-badge">${escapeHtml(c.pr_number||'—')}</span>
          <div class="qc-card-title">${escapeHtml(c.request_description||'—')}</div>
          <div class="qc-card-meta">${escapeHtml(c.requesting_dept||'')}${c.requesting_dept&&c.request_date?' · ':''}${c.request_date?new Date(c.request_date).toLocaleDateString():''}</div>
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
  _editingCompId   = null;
  _compVendors     = [emptyVendor(), emptyVendor()];
  _compSignatures  = defaultSignatures();
  renderCompForm(null);
}

function emptyVendor() {
  return { vendor_name:'', annex_ref:'', total_cost:'',
    spec_compliance:100, installation_compliance:100,
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
        ${bl('Request Information','معلومات الطلب')}
      </div>
      <div class="qc-grid">
        <div class="form-group"><label>${bl('Request Description','وصف الطلب')} <span class="req">*</span></label>
          <input id="qf-desc" type="text" value="${escapeHtml(comp?.request_description||'')}" placeholder="${bl('e.g. Provision of UX/UI Services','مثال: توفير خدمات التصميم')}"/></div>
        <div class="form-group"><label>${bl('PR Number','رقم طلب الشراء')} <span class="req">*</span></label>
          <input id="qf-pr" type="text" value="${escapeHtml(comp?.pr_number||'')}" placeholder="e.g. SW3104"/></div>
        <div class="form-group"><label>${bl('Requesting Department','الجهة الطالبة')}</label>
          <input id="qf-dept" type="text" value="${escapeHtml(comp?.requesting_dept||'')}" placeholder="${bl('IT - Technology','تكنولوجيا المعلومات')}"/></div>
        <div class="form-group"><label>${bl('Request Date','تاريخ الطلب')}</label>
          <input id="qf-rdate" type="date" value="${comp?.request_date?String(comp.request_date).split('T')[0]:''}"/></div>
        <div class="form-group"><label>${bl('Awarding Date','تاريخ الترسية')}</label>
          <input id="qf-adate" type="date" value="${comp?.awarding_date?String(comp.awarding_date).split('T')[0]:''}"/></div>
        <div class="form-group"><label>${bl('Total PR Value','القيمة الإجمالية للطلب')}</label>
          <input id="qf-val" type="number" value="${comp?.total_pr_value||''}" placeholder="0" min="0"/></div>
        <div class="form-group"><label>${bl('Currency','العملة')}</label>
          <select id="qf-cur">${['IQD','USD','EUR','GBP'].map(c=>`<option ${(comp?.currency||'IQD')===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>${bl('Delivery Term (Days)','مدة التسليم (أيام)')}</label>
          <input id="qf-dterm" type="number" value="${comp?.delivery_term_days??35}" min="1"/></div>
        <div class="form-group"><label>${bl('Warranty Term (Months)','مدة الضمان (شهر)')}</label>
          <input id="qf-wterm" type="number" value="${comp?.warranty_term_months??12}" min="0"/></div>
        <div class="form-group"><label>${bl('Linked PO (optional)','طلب الشراء المرتبط (اختياري)')}</label>
          <select id="qf-po"><option value="">— ${bl('None','لا يوجد')} —</option>${poOptions}</select></div>
        <div class="form-group"><label>${bl('Status','الحالة')}</label>
          <select id="qf-status">${['draft','in_review','approved','awarded'].map(s=>`<option value="${s}" ${(comp?.status||'draft')===s?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}</select></div>
      </div>
    </div>

    <!-- S2: Scoring Weights -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd" style="justify-content:space-between;">
        <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> ${bl('Scoring Weights','أوزان التقييم')}</span>
        <span id="qf-wtotal" class="qc-wtotal"></span>
      </div>
      <p style="font-size:12px;color:var(--text-3);margin-bottom:12px;">${bl('Weights must total exactly 100. Adjust per comparison requirements.','يجب أن تساوي الأوزان 100 بالضبط. اضبط حسب متطلبات المقارنة.')}</p>
      <div class="qc-wgrid">
        ${[
          {k:'price',        en:'Price',        ar:'السعر'},
          {k:'requirements', en:'Requirements', ar:'المتطلبات'},
          {k:'delivery',     en:'Delivery',     ar:'التسليم'},
          {k:'warranty',     en:'Warranty',     ar:'الضمان'},
          {k:'payment',      en:'Payment',      ar:'الدفع'},
          {k:'commitment',   en:'Commitment',   ar:'الالتزام'}
        ].map((x,i)=>`<div class="form-group">
          <label style="font-size:11px;">${bl(x.en, x.ar)}</label>
          <input type="number" id="qf-w-${x.k}" class="qc-winput" value="${[w.price,w.requirements,w.delivery,w.warranty,w.payment,w.commitment][i]}" min="0" max="100" step="0.5" oninput="updateWTotal()"/>
        </div>`).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn-export" onclick="normalizeWeights()" style="font-size:12px;">↺ ${bl('Auto-normalize to 100','تطبيع تلقائي إلى 100')}</button>
      </div>
    </div>

    <!-- S3: Vendors -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd" style="justify-content:space-between;">
        <span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> ${bl('Vendor Quotations','عروض الموردين')}</span>
        <button class="btn-add" onclick="addVendor()" style="font-size:12px;padding:6px 12px;">+ ${bl('Add Vendor','إضافة مورد')}</button>
      </div>
      <div id="qf-vendors"></div>
    </div>

    <!-- S4: Live Scores -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd" style="justify-content:space-between;">
        <span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          ${bl('Live Scores Preview','معاينة النقاط المباشرة')}
        </span>
        <button class="qc-btn-analyze" onclick="startComparing()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5,3 19,12 5,21"/></svg>
          ${bl('Start Comparing','بدء المقارنة')}
        </button>
      </div>
      <div id="qf-scores"></div>
    </div>

    <!-- S5: Auto Winner -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
        ${bl('Winner (Auto-Selected by Score)','الفائز (محدد تلقائياً بالنقاط)')}
      </div>
      <div id="qf-winner-display" style="margin-bottom:12px;">
        <p style="color:var(--text-3);font-size:13px;">${bl('Enter vendor data above to see the winner.','أدخل بيانات الموردين أعلاه لمعرفة الفائز.')}</p>
      </div>
      <div class="form-group">
        <label>${bl('Comment / Recommendation','ملاحظات / توصية')}</label>
        <textarea id="qf-comment" rows="3" placeholder="${bl('e.g. Vendor A offers best value with full specification compliance...','مثال: المورد أ يقدم أفضل قيمة مع امتثال كامل للمواصفات...')}">${escapeHtml(comp?.winner_comment||'')}</textarea>
      </div>
    </div>

    <!-- S6: Committee Signatures (editable) -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd" style="justify-content:space-between;">
        <span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${bl('Committee Signatures','توقيعات اللجنة')}
        </span>
        <button class="btn-add" onclick="addSig()" style="font-size:12px;padding:5px 10px;">+ ${bl('Add Member','إضافة عضو')}</button>
      </div>
      <p style="font-size:12px;color:var(--text-3);margin-bottom:12px;">${bl('Edit role titles and names to match your committee structure.','عدّل المسميات والأسماء لتتوافق مع هيكل لجنتك.')}</p>
      <div id="qf-signatures"></div>
    </div>

    <!-- Actions -->
    <div class="qc-actions">
      <button class="btn-export" onclick="cancelCompForm()">${bl('Cancel','إلغاء')}</button>
      <button class="btn-export" onclick="recalcScores()">↻ ${bl('Recalculate','إعادة حساب')}</button>
      <button class="btn-primary" id="qf-save-btn" onclick="saveCompForm()">
        ${comp ? bl('Update Comparison','تحديث المقارنة') : bl('Save Comparison','حفظ المقارنة')}
      </button>
    </div>
  </div>`;

  renderVendorRows();
  renderSignatureRows();
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
        <span class="qc-vnum">${bl('Vendor','مورد')} ${i+1}</span>
        ${_compVendors.length > 1 ?
          `<button class="btn-delete" onclick="removeVendor(${i})" style="font-size:11px;padding:2px 8px;">${bl('Remove','إزالة')}</button>`:'' }
      </div>
      <div class="qc-vgrid">
        <div class="form-group"><label>${bl('Vendor Name','اسم المورد')} <span class="req">*</span></label>
          <input type="text" value="${escapeHtml(v.vendor_name||'')}" placeholder="${bl('Company name','اسم الشركة')}"
            oninput="_compVendors[${i}].vendor_name=this.value;dRecalc()"/></div>
        <div class="form-group"><label>${bl('Annex / Reference','المرفق / المرجع')}</label>
          <input type="text" value="${escapeHtml(v.annex_ref||'')}" placeholder="Annex A"
            oninput="_compVendors[${i}].annex_ref=this.value"/></div>
        <div class="form-group"><label>${bl('Total Cost','التكلفة الإجمالية')} <span class="req">*</span></label>
          <input type="number" value="${v.total_cost||''}" placeholder="0" min="0"
            oninput="_compVendors[${i}].total_cost=this.value;dRecalc()"/></div>
        <div class="form-group"><label>${bl('Spec Compliance %','امتثال المواصفات %')}</label>
          <input type="number" value="${v.spec_compliance??100}" min="0" max="100"
            oninput="_compVendors[${i}].spec_compliance=this.value;dRecalc()"/></div>
        <div class="form-group"><label>${bl('Install Compliance %','امتثال التركيب %')}</label>
          <input type="number" value="${v.installation_compliance??100}" min="0" max="100"
            oninput="_compVendors[${i}].installation_compliance=this.value;dRecalc()"/></div>
        <div class="form-group"><label>${bl('Delivery (Days)','التسليم (أيام)')} <span class="req">*</span></label>
          <input type="number" value="${v.delivery_days||''}" min="1" placeholder="e.g. 35"
            oninput="_compVendors[${i}].delivery_days=this.value;dRecalc()"/></div>
        <div class="form-group"><label>${bl('Warranty (Months)','الضمان (شهر)')}</label>
          <input type="number" value="${v.warranty_months||''}" min="0" placeholder="e.g. 12"
            oninput="_compVendors[${i}].warranty_months=this.value;dRecalc()"/></div>
        <div class="form-group"><label>${bl('Payment Compliance %','امتثال الدفع %')}</label>
          <input type="number" value="${v.payment_compliance??100}" min="0" max="100"
            oninput="_compVendors[${i}].payment_compliance=this.value;dRecalc()"/></div>
        <div class="form-group"><label>${bl('Commitment / Experience %','الالتزام / الخبرة %')}</label>
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
  if (_compVendors.length <= 1) { showToast(bl('At least one vendor required','مطلوب مورد واحد على الأقل'), 'info'); return; }
  _compVendors.splice(idx, 1);
  renderVendorRows();
  recalcScores();
}

// ── SIGNATURE ROWS ─────────────────────────────────────

function renderSignatureRows() {
  const wrap = document.getElementById('qf-signatures');
  if (!wrap) return;
  wrap.innerHTML = _compSignatures.map((s, i) => `
    <div class="qc-sig-row" id="qcs-${i}">
      <div class="form-group" style="flex:1;min-width:0;">
        <label style="font-size:11px;">${bl('Role / Position','الدور / المنصب')}</label>
        <input type="text" value="${escapeHtml(s.role||'')}"
          placeholder="${bl('e.g. Head of Committee','مثال: رئيس اللجنة')}"
          oninput="_compSignatures[${i}].role=this.value"/>
      </div>
      <div class="form-group" style="flex:1;min-width:0;">
        <label style="font-size:11px;">${bl('Full Name','الاسم الكامل')}</label>
        <input type="text" value="${escapeHtml(s.name||'')}"
          placeholder="${bl('Name','الاسم')}"
          oninput="_compSignatures[${i}].name=this.value"/>
      </div>
      ${_compSignatures.length > 1
        ? `<button class="btn-delete qc-sig-remove" onclick="removeSig(${i})" title="${bl('Remove','إزالة')}">×</button>`
        : '<span class="qc-sig-remove-placeholder"></span>'}
    </div>`).join('');
}

function addSig() {
  _compSignatures.push({ role: '', name: '' });
  renderSignatureRows();
  const last = document.getElementById(`qcs-${_compSignatures.length-1}`);
  if (last) last.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function removeSig(idx) {
  if (_compSignatures.length <= 1) return;
  _compSignatures.splice(idx, 1);
  renderSignatureRows();
}

// ── START COMPARING — ANIMATED SPLASH ─────────────────

async function startComparing() {
  const hasVendors = _compVendors.some(v => v.vendor_name);
  if (!hasVendors) {
    showToast(bl('Enter at least one vendor name first','أدخل اسم مورد واحد أولاً'), 'info');
    return;
  }

  const scored = recalcScores();
  const winner = scored.filter(s => s.vendor_name)[0];

  const steps = [
    { en: 'Loading vendor quotations',       ar: 'تحميل عروض الموردين' },
    { en: 'Analyzing price competitiveness',  ar: 'تحليل تنافسية الأسعار' },
    { en: 'Evaluating technical compliance',  ar: 'تقييم الامتثال التقني' },
    { en: 'Applying scoring weights',         ar: 'تطبيق أوزان التقييم' },
    { en: 'Ranking vendors by total score',   ar: 'ترتيب الموردين بحسب الدرجات' },
    { en: 'Determining winning bid',          ar: 'تحديد العطاء الفائز' },
  ];

  const overlay = document.createElement('div');
  overlay.className = 'qc-splash-overlay';
  overlay.innerHTML = `
    <div class="qc-splash-inner glass">
      <div class="qc-splash-orbit">
        <div class="qc-splash-ring qc-ring-outer"></div>
        <div class="qc-splash-ring qc-ring-inner"></div>
        <div class="qc-splash-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
        </div>
      </div>
      <div class="qc-splash-title">${bl('Analyzing Quotations','جار تحليل العروض')}</div>
      <div class="qc-splash-subtitle">${bl('Applying weighted scoring model','تطبيق نموذج التقييم الموزون')}</div>
      <div class="qc-splash-steps" id="qcss-wrap">
        ${steps.map((s,i) => `
          <div class="qc-splash-step" id="qcss-${i}">
            <span class="qcss-icon">
              <svg class="icon-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20,6 9,17 4,12"/></svg>
              <svg class="icon-dot"   width="8"  height="8"  viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>
            </span>
            <span>${bl(s.en, s.ar)}</span>
          </div>`).join('')}
      </div>
      <div class="qc-splash-bar"><div class="qc-splash-bar-fill" id="qcss-bar"></div></div>
      <div id="qcss-winner" class="qc-splash-winner" style="display:none;"></div>
    </div>`;
  document.body.appendChild(overlay);

  // Animate steps
  const delays = [300, 480, 420, 400, 380, 500];
  for (let i = 0; i < steps.length; i++) {
    await sleep(delays[i]);
    if (i > 0) {
      const prev = document.getElementById(`qcss-${i-1}`);
      if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
    }
    const cur = document.getElementById(`qcss-${i}`);
    if (cur) cur.classList.add('active');
    const bar = document.getElementById('qcss-bar');
    if (bar) bar.style.width = `${Math.round((i+1)/steps.length*100)}%`;
  }

  await sleep(400);
  const last = document.getElementById(`qcss-${steps.length-1}`);
  if (last) { last.classList.remove('active'); last.classList.add('done'); }
  const bar = document.getElementById('qcss-bar');
  if (bar) bar.style.width = '100%';

  // Winner reveal
  await sleep(250);
  const winEl = document.getElementById('qcss-winner');
  if (winEl && winner) {
    const rank2 = scored.filter(s=>s.vendor_name)[1];
    winEl.style.display = 'flex';
    winEl.innerHTML = `
      <div class="qcss-win-trophy">🏆</div>
      <div class="qcss-win-info">
        <div class="qcss-win-label">${bl('Winner','الفائز')}</div>
        <div class="qcss-win-name">${escapeHtml(winner.vendor_name)}</div>
        <div class="qcss-win-detail">
          ${bl('Score','النقاط')}: <strong>${parseFloat(winner.total_score||0).toFixed(2)}</strong>
          &nbsp;·&nbsp; ${bl('Cost','التكلفة')}: <strong>${Number(winner.total_cost||0).toLocaleString()}</strong>
          ${rank2 ? `&nbsp;·&nbsp; ${bl('Runner-up','المركز الثاني')}: ${escapeHtml(rank2.vendor_name)} (${parseFloat(rank2.total_score||0).toFixed(2)})` : ''}
        </div>
      </div>
      <div class="qcss-win-score">${parseFloat(winner.total_score||0).toFixed(2)}<span>/ 100</span></div>`;
    void winEl.offsetWidth; // trigger reflow for animation
    winEl.classList.add('visible');
  }

  await sleep(2200);

  // Dismiss
  overlay.classList.add('qc-splash-out');
  await sleep(380);
  overlay.remove();

  // Scroll to scores section
  const scoresEl = document.getElementById('qf-scores');
  if (scoresEl) {
    scoresEl.scrollIntoView({ behavior:'smooth', block:'start' });
    scoresEl.classList.add('qc-scores-highlight');
    setTimeout(() => scoresEl.classList.remove('qc-scores-highlight'), 1200);
  }
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
    saveBtn.title = isOk ? '' : bl('Weights must total 100','يجب أن تساوي الأوزان 100');
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
    const spec    = parseFloat(v.spec_compliance) ?? 100;
    const install = parseFloat(v.installation_compliance) ?? 100;
    const pay     = parseFloat(v.payment_compliance) ?? 100;
    const commit  = parseFloat(v.commitment_pct) ?? 100;

    const pScore      = (cost>0 && minCost>0)         ? (minCost/cost)*weights.price                : 0;
    const rScore      = ((spec+install)/2/100)         * weights.requirements;
    const dScore      = (deliv>0 && minDelivery>0)     ? (minDelivery/deliv)*weights.delivery        : 0;
    const wScore      = (warr>0 && maxWarranty>0)      ? (warr/maxWarranty)*weights.warranty         : 0;
    const payScore    = (pay/100)                      * weights.payment;
    const commitScore = (commit/100)                   * weights.commitment;

    const total = pScore+rScore+dScore+wScore+payScore+commitScore;
    return {
      ...v,
      price_score:          parseFloat(pScore.toFixed(4)),
      requirements_score:   parseFloat(rScore.toFixed(4)),
      delivery_score:       parseFloat(dScore.toFixed(4)),
      warranty_score:       parseFloat(wScore.toFixed(4)),
      payment_score:        parseFloat(payScore.toFixed(4)),
      commitment_score:     parseFloat(commitScore.toFixed(4)),
      total_score:          parseFloat(total.toFixed(4)),
    };
  })
  .sort((a,b) => b.total_score - a.total_score)
  .map((v,i) => ({...v, rank:i+1}));
}

function recalcScores() {
  const w      = getWeights();
  const scored = scoreVendors(_compVendors, w);
  renderScoresTable(scored);
  updateWinnerDisplay(scored);
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
    el.innerHTML = `<p class="empty" style="padding:1rem;text-align:center;">${bl('Enter vendor data above to see live scores.','أدخل بيانات الموردين أعلاه لمشاهدة النقاط المباشرة.')}</p>`;
    return;
  }

  const SCORE_KEYS = ['price_score','requirements_score','delivery_score','warranty_score','payment_score','commitment_score','total_score'];
  const LABELS     = [bl('Price','السعر'),bl('Requirements','المتطلبات'),bl('Delivery','التسليم'),
                      bl('Warranty','الضمان'),bl('Payment','الدفع'),bl('Commitment','الالتزام'),'TOTAL'];

  const colorMap = SCORE_KEYS.map(key => {
    const vals = scored.map(s => parseFloat(s[key])||0);
    return scored.map((_,i) => colColor(vals, i));
  });

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="qc-stbl">
        <thead>
          <tr>
            <th style="text-align:left;">${bl('Vendor','المورد')}</th>
            <th>${bl('Cost','التكلفة')}</th>
            ${LABELS.map(l=>`<th>${l}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${scored.map((s,ri) => `
            <tr ${ri===0?'class="qc-winner-tr"':''}>
              <td style="text-align:left;">
                ${ri===0?'<span style="font-size:14px;">🏆 </span>':''}
                <strong>${escapeHtml(s.vendor_name||bl('Vendor','مورد')+' '+(ri+1))}</strong>
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
            ${bl('Weights','الأوزان')}: ${['price','requirements','delivery','warranty','payment','commitment'].map(k=>
              `${k.charAt(0).toUpperCase()}=${getWeights()[k]}`).join(' | ')}
          </td><td colspan="${LABELS.length}"></td></tr>
        </tfoot>
      </table>
    </div>`;
}

function updateWinnerDisplay(scored) {
  const el = document.getElementById('qf-winner-display');
  if (!el) return;
  const winner = scored.filter(s => s.vendor_name)[0];
  if (!winner) {
    el.innerHTML = `<p style="color:var(--text-3);font-size:13px;">${bl('Enter vendor data above to see the winner.','أدخل بيانات الموردين أعلاه لمعرفة الفائز.')}</p>`;
    return;
  }
  const rank2 = scored.filter(s=>s.vendor_name)[1];
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:14px;background:rgba(16,185,129,0.08);border-radius:var(--r-sm);border:1px solid rgba(16,185,129,0.2);margin-bottom:8px;">
      <span style="font-size:28px;">🏆</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:15px;color:var(--accent-green);">${escapeHtml(winner.vendor_name)}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px;">
          ${bl('Score','النقاط')}: <strong style="color:var(--text-1);">${parseFloat(winner.total_score||0).toFixed(2)}</strong>
          &nbsp;·&nbsp; ${bl('Cost','التكلفة')}: <strong style="color:var(--accent-amber);">${Number(winner.total_cost||0).toLocaleString()}</strong>
          ${rank2?`&nbsp;·&nbsp; ${bl('2nd','الثاني')}: ${escapeHtml(rank2.vendor_name)} (${parseFloat(rank2.total_score||0).toFixed(2)})`:''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:20px;font-weight:800;color:var(--accent-green);">${parseFloat(winner.total_score||0).toFixed(2)}</div>
        <div style="font-size:10px;color:var(--text-4);">/ 100</div>
      </div>
    </div>`;
}

// ── SAVE ──────────────────────────────────────────────

async function saveCompForm() {
  const desc = document.getElementById('qf-desc')?.value.trim();
  const pr   = document.getElementById('qf-pr')?.value.trim();
  if (!desc || !pr) { showToast(bl('Description and PR Number are required','الوصف ورقم الطلب مطلوبان'), 'info'); return; }

  const w = getWeights();
  const wtotal = Object.values(w).reduce((s,v)=>s+(isNaN(v)?0:v),0);
  if (Math.abs(wtotal-100) > 0.5) { showToast(bl('Weights must total 100','يجب أن تساوي الأوزان 100'), 'info'); return; }

  const hasVendors = _compVendors.some(v=>v.vendor_name);
  if (!hasVendors) { showToast(bl('Enter at least one vendor name','أدخل اسم مورد واحد على الأقل'), 'info'); return; }

  const scored  = recalcScores();
  const winner  = scored.filter(s=>s.vendor_name)[0] || {};

  // Serialize editable signatures
  const sigsJson = JSON.stringify(_compSignatures.filter(s => s.role || s.name));

  const data = {
    request_description:  desc,
    pr_number:            pr,
    requesting_dept:      document.getElementById('qf-dept')?.value||'',
    request_date:         document.getElementById('qf-rdate')?.value||'',
    awarding_date:        document.getElementById('qf-adate')?.value||'',
    total_pr_value:       parseFloat(document.getElementById('qf-val')?.value)||0,
    currency:             document.getElementById('qf-cur')?.value||'IQD',
    delivery_term_days:   parseInt(document.getElementById('qf-dterm')?.value)||35,
    warranty_term_months: parseInt(document.getElementById('qf-wterm')?.value)||12,
    linked_po_id:         document.getElementById('qf-po')?.value||'',
    status:               document.getElementById('qf-status')?.value||'draft',
    w_price:              w.price,
    w_requirements:       w.requirements,
    w_delivery:           w.delivery,
    w_warranty:           w.warranty,
    w_payment:            w.payment,
    w_commitment:         w.commitment,
    winner_vendor:        winner.vendor_name  || '',
    winner_score:         parseFloat(winner.total_score||0),
    winner_amount:        parseFloat(winner.total_cost||0),
    winner_comment:       document.getElementById('qf-comment')?.value||'',
    signatures_json:      sigsJson,
    // Legacy columns for backward compat
    head_of_committee:    _compSignatures[0]?.name||'',
    requester_name:       _compSignatures[1]?.name||'',
    requester_management: _compSignatures[2]?.name||'',
    supply_chain_officer: _compSignatures[3]?.name||'',
    head_of_supply_chain: _compSignatures[4]?.name||'',
  };

  const btn = document.getElementById('qf-save-btn');
  if (btn) { btn.textContent = bl('Saving...','جار الحفظ...'); btn.disabled = true; }

  try {
    if (_editingCompId) {
      await updateRow('Comparisons', _editingCompId, data);
      const allVds = await callAPI('getAll', { sheet: 'ComparisonVendors' });
      const oldVds = (allVds.rows || []).filter(v => String(v.comparison_id) === String(_editingCompId));
      for (const v of oldVds) {
        await callAPI('deleteRow', { sheet: 'ComparisonVendors', id: v.id });
      }
      for (const v of scored.filter(s=>s.vendor_name)) {
        await addRow('ComparisonVendors', { ...v, comparison_id: _editingCompId });
      }
      cacheClear('ComparisonVendors');
      _allComparisons = _allComparisons.map(c => c.id===_editingCompId ? {...c,...data} : c);
      showToast(bl('Comparison updated ✓','تم تحديث المقارنة ✓'), 'success');
    } else {
      const res = await addRow('Comparisons', data);
      const newId = res.id;
      data.id = newId;
      for (const v of scored.filter(s=>s.vendor_name)) {
        await addRow('ComparisonVendors', { ...v, comparison_id: newId });
      }
      cacheClear('ComparisonVendors');
      _allComparisons.push(data);
      showToast(bl('Comparison saved ✓','تم حفظ المقارنة ✓'), 'success');
    }
    cacheClear('Comparisons');
    _editingCompId = null;
    _compVendors   = [];
    _compSignatures = [];
    renderCompList();
  } catch(e) {
    showToast(bl('Save failed: ','فشل الحفظ: ') + e.message, 'error');
    if (btn) { btn.textContent = _editingCompId ? bl('Update Comparison','تحديث المقارنة') : bl('Save Comparison','حفظ المقارنة'); btn.disabled = false; }
  }
}

function cancelCompForm() {
  _editingCompId  = null;
  _compVendors    = [];
  _compSignatures = [];
  renderCompList();
}

// ── VIEW / EDIT / DELETE ───────────────────────────────

async function viewComp(id) {
  editComp(id);
}

async function editComp(id) {
  const comp = _allComparisons.find(c=>c.id===id);
  if (!comp) return;
  try {
    const r = await getAll('ComparisonVendors');
    _compVendors   = (r.rows || []).filter(v => String(v.comparison_id) === String(id)).map(v=>({...v}));
    _editingCompId = id;

    // Load signatures — prefer new JSON column, fall back to legacy columns
    if (comp.signatures_json) {
      try { _compSignatures = JSON.parse(comp.signatures_json); } catch { _compSignatures = defaultSignatures(); }
    } else {
      _compSignatures = [
        { role: 'Head of Committee',    name: comp.head_of_committee||'' },
        { role: 'Requester',            name: comp.requester_name||'' },
        { role: 'Requester Management', name: comp.requester_management||'' },
        { role: 'Supply Chain Officer', name: comp.supply_chain_officer||'' },
        { role: 'Head of Supply Chain', name: comp.head_of_supply_chain||'' },
      ];
    }
    if (!_compSignatures.length) _compSignatures = defaultSignatures();

    renderCompForm(comp);
  } catch(e) { showToast(bl('Failed to load: ','فشل التحميل: ') + e.message, 'error'); }
}

async function deleteComp(id) {
  showConfirm(
    bl('Delete Comparison','حذف المقارنة'),
    bl('This will permanently delete the comparison and all vendor data.','سيتم حذف المقارنة وجميع بيانات الموردين نهائياً.'),
    async () => {
      try {
        const allVds = await callAPI('getAll', { sheet: 'ComparisonVendors' });
        const oldVds = (allVds.rows || []).filter(v => String(v.comparison_id) === String(id));
        for (const v of oldVds) {
          await callAPI('deleteRow', { sheet: 'ComparisonVendors', id: v.id });
        }
        cacheClear('ComparisonVendors');
        await deleteRow('Comparisons', id);
        _allComparisons = _allComparisons.filter(c=>c.id!==id);
        renderCompList();
        showToast(bl('Deleted','تم الحذف'), 'success');
      } catch(e) { showToast(bl('Delete failed: ','فشل الحذف: ') + e.message, 'error'); }
    }
  );
}

// ── SIGNATURES HELPER FOR EXPORTS ──────────────────────

function _sigsFromComp(comp) {
  if (comp.signatures_json) {
    try { return JSON.parse(comp.signatures_json); } catch {}
  }
  return [
    { role: 'Head of Committee',    name: comp.head_of_committee||'' },
    { role: 'Requester',            name: comp.requester_name||'' },
    { role: 'Requester Management', name: comp.requester_management||'' },
    { role: 'Supply Chain Officer', name: comp.supply_chain_officer||'' },
    { role: 'Head of Supply Chain', name: comp.head_of_supply_chain||'' },
  ];
}

// ── EXCEL EXPORT ───────────────────────────────────────

async function exportCompExcel(id) {
  const comp = _allComparisons.find(c=>c.id===id);
  if (!comp) return;
  let vds;
  try {
    const r = await getAll('ComparisonVendors');
    vds = (r.rows || []).filter(v => String(v.comparison_id) === String(id));
  } catch(e) { vds = []; }
  const w = { price:comp.w_price??40, requirements:comp.w_requirements??30,
    delivery:comp.w_delivery??10, warranty:comp.w_warranty??10,
    payment:comp.w_payment??5, commitment:comp.w_commitment??5 };
  const scored = scoreVendors(vds, w);
  const sigs   = _sigsFromComp(comp);
  if (!window.XLSX){ showToast('SheetJS not loaded','error'); return; }

  const rows = [];
  rows.push(['','جدول مقارنة العطاءات النهائية — Final Bids Comparison Table']);
  rows.push([]);
  rows.push(['','Request Description / وصف الطلب:',comp.request_description||'','','','Dept / الجهة:',comp.requesting_dept||'']);
  rows.push(['','PR Number / رقم الطلب:',comp.pr_number||'','','','Awarding Date / تاريخ الترسية:',comp.awarding_date?String(comp.awarding_date).split('T')[0]:'']);
  rows.push(['','Request Date / تاريخ الطلب:',comp.request_date?String(comp.request_date).split('T')[0]:'','','','Total Value / القيمة:',`${Number(comp.total_pr_value||0).toLocaleString()} ${comp.currency||''}`]);
  rows.push([]);
  rows.push(['','Vendors Data / بيانات الموردين']);
  rows.push(['','Vendor Name / المورد','Total Cost / التكلفة','Spec %','Install %','Delivery Days','Warranty Mo.','Payment %','Commitment %']);
  scored.forEach(v=>rows.push(['',v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),v.total_cost,v.spec_compliance,v.installation_compliance,v.delivery_days,v.warranty_months,v.payment_compliance,v.commitment_pct]));
  rows.push([]);
  rows.push(['','Scores / النقاط']);
  rows.push(['','Vendor / المورد','Price','Requirements','Delivery','Warranty','Payment','Commitment','TOTAL']);
  scored.forEach(v=>rows.push(['',v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),
    parseFloat(v.price_score||0).toFixed(2),parseFloat(v.requirements_score||0).toFixed(2),
    parseFloat(v.delivery_score||0).toFixed(2),parseFloat(v.warranty_score||0).toFixed(2),
    parseFloat(v.payment_score||0).toFixed(2),parseFloat(v.commitment_score||0).toFixed(2),
    parseFloat(v.total_score||0).toFixed(2)]));
  rows.push([]);
  rows.push(['','Winning Bid / العطاء الفائز']);
  rows.push(['','Winner / الفائز','','Score / النقاط','','Amount / المبلغ','Comment / ملاحظة']);
  rows.push(['',comp.winner_vendor||scored[0]?.vendor_name||'','',
    parseFloat(comp.winner_score||scored[0]?.total_score||0).toFixed(2),'',
    Number(comp.winner_amount||scored[0]?.total_cost||0).toLocaleString(),comp.winner_comment||'']);
  rows.push([]);
  rows.push(['','Committee Signatures / توقيعات اللجنة']);
  rows.push(['', ...sigs.map(s => s.role||'')]);
  rows.push(['', ...sigs.map(s => s.name||'')]);
  rows.push(['', ...sigs.map(() => '________________')]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:3},{wch:38},{wch:18},{wch:12},{wch:12},{wch:14},{wch:14},{wch:12},{wch:12},{wch:12}];
  ws['!dir']='rtl';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
  XLSX.writeFile(wb, `Comparison_${comp.pr_number||'PR'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exported ✓','success');
}

// ── PDF EXPORT ─────────────────────────────────────────

async function exportCompPDF(id) {
  const comp = _allComparisons.find(c=>c.id===id);
  if (!comp) return;
  let vds;
  try {
    const r = await getAll('ComparisonVendors');
    vds = (r.rows || []).filter(v => String(v.comparison_id) === String(id));
  } catch(e) { vds = []; }
  const w = { price:comp.w_price??40, requirements:comp.w_requirements??30,
    delivery:comp.w_delivery??10, warranty:comp.w_warranty??10,
    payment:comp.w_payment??5, commitment:comp.w_commitment??5 };
  const scored = scoreVendors(vds, w);
  const sigs   = _sigsFromComp(comp);
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
  doc.text('Vendors Data',14,y); y+=4;
  doc.autoTable({startY:y,
    head:[['Vendor','Total Cost','Spec %','Install %','Delivery Days','Warranty Mo.','Payment %','Commit %']],
    body:scored.map(v=>[v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),
      Number(v.total_cost||0).toLocaleString(),v.spec_compliance??100,v.installation_compliance??100,
      v.delivery_days||'—',v.warranty_months||'—',v.payment_compliance??100,v.commitment_pct??100]),
    headStyles:{fillColor:ac,textColor:[255,255,255],fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:8},alternateRowStyles:{fillColor:[248,247,255]},
    margin:{left:14,right:14}});
  y=doc.lastAutoTable.finalY+8;

  if(y>155){doc.addPage();y=16;}
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...ac);
  doc.text('Score Analysis',14,y); y+=4;
  doc.autoTable({startY:y,
    head:[[`Vendor`,`Price(${w.price})`,`Req(${w.requirements})`,`Del(${w.delivery})`,`War(${w.warranty})`,`Pay(${w.payment})`,`Com(${w.commitment})`,'TOTAL']],
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
  doc.text('Winning Bid',14,y); y+=4;
  const wd=scored[0]||{};
  doc.autoTable({startY:y,
    head:[['Winner','Total Score','Amount','Comment']],
    body:[[comp.winner_vendor||wd.vendor_name||'—',
      parseFloat(comp.winner_score||wd.total_score||0).toFixed(2),
      Number(comp.winner_amount||wd.total_cost||0).toLocaleString()+' '+(comp.currency||''),
      comp.winner_comment||'']],
    headStyles:{fillColor:[16,185,129],textColor:[255,255,255],fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:9,fontStyle:'bold'},margin:{left:14,right:14}});
  y=doc.lastAutoTable.finalY+8;

  if(y>165){doc.addPage();y=16;}
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...ac);
  doc.text('Committee Signatures',14,y); y+=4;
  doc.autoTable({startY:y,
    head:[sigs.map(s=>s.role||'—')],
    body:[sigs.map(s=>s.name||''),sigs.map(()=>''),sigs.map(()=>'________________')],
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
