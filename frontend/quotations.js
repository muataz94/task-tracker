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

    <!-- Compare Action Trigger Block -->
    <div class="qc-sec glass" style="display:flex; justify-content:center; align-items:center; padding:1.5rem 2rem; text-align:center;">
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px; width:100%;">
        <div style="font-size:12px; color:var(--text-3); font-weight:500;">
          ${bl('All vendor quotations entered? Run standard weighted comparison modeling.','هل تم إدخال جميع عروض الموردين؟ قم بتشغيل نموذج المقارنة الموزونة القياسي.')}
        </div>
        <button class="qc-btn-analyze" onclick="startComparing()" style="font-size:14px; padding:10px 24px; border-radius:var(--r-md); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; vertical-align:middle;"><polygon points="5,3 19,12 5,21"/></svg>
          ${bl('Start Bids Analysis & Compare','بدء تحليل العروض والمقارنة')}
        </button>
      </div>
    </div>

    <!-- Final Results Section (lazy-revealed after comparison) -->
    <div id="qc-results-sec" class="qc-sec glass ${comp?.winner_vendor ? 'visible' : 'hidden'}">
      <div class="qc-sec-hd" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:14px;">
        <span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          ${bl('Comparison Analysis Report','تقرير تحليل المقارنة')}
        </span>
        <div style="display:flex; gap:8px;">
          <button class="btn-export" onclick="exportActiveFormExcel()" style="background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.25); color:var(--accent-green); font-weight:600; font-size:11px; padding:4px 10px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px; vertical-align:middle;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            Excel
          </button>
          <button class="btn-export" onclick="exportActiveFormPDF()" style="background:rgba(99,102,241,0.12); border-color:rgba(99,102,241,0.25); color:var(--accent); font-weight:600; font-size:11px; padding:4px 10px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px; vertical-align:middle;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            PDF
          </button>
        </div>
      </div>
      <div id="qf-winner-display" style="margin-bottom:12px;"></div>
      <div class="form-group" style="margin-bottom:14px;">
        <label>${bl('Comment / Recommendation','ملاحظات / توصية')}</label>
        <textarea id="qf-comment" rows="3" placeholder="${bl('e.g. Vendor A offers best value with full specification compliance...','مثال: المورد أ يقدم أفضل قيمة مع امتثال كامل للمواصفات...')}">${escapeHtml(comp?.winner_comment||'')}</textarea>
      </div>
      <div id="qf-scores"></div>
    </div>

    <!-- S6: Committee Signatures (editable) -->
    <div class="qc-sec glass">
      <div class="qc-sec-hd" style="display:flex; justify-content:space-between; align-items:center;">
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
      <button class="btn-export" onclick="manualRecalc()">↻ ${bl('Recalculate','إعادة حساب')}</button>
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

  // Reveal and scroll to results section
  const resultsSec = document.getElementById('qc-results-sec');
  if (resultsSec) {
    resultsSec.classList.remove('hidden');
    resultsSec.classList.add('visible');
    void resultsSec.offsetWidth; // trigger reflow
    resultsSec.scrollIntoView({ behavior:'smooth', block:'start' });
    resultsSec.classList.add('qc-scores-highlight');
    setTimeout(() => resultsSec.classList.remove('qc-scores-highlight'), 1200);
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
  // Re-read all vendor inputs fresh from DOM before calculating
  document.querySelectorAll('.qc-vrow').forEach((row, i) => {
    if (!_compVendors[i]) return;
    const inputs = row.querySelectorAll('input[type="text"], input[type="number"]');
    const keys   = ['vendor_name','annex_ref','total_cost','spec_compliance',
                    'installation_compliance','delivery_days','warranty_months',
                    'payment_compliance','commitment_pct'];
    inputs.forEach((inp, fi) => { if (keys[fi]) _compVendors[i][keys[fi]] = inp.value; });
  });
  const w      = getWeights();
  const scored = scoreVendors(_compVendors, w);
  renderScoresTable(scored);
  updateWinnerDisplay(scored);
  return scored;
}

function manualRecalc() {
  recalcScores();
  showToast(bl('Scores recalculated ✓', 'تم إعادة حساب النقاط ✓'), 'success');
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

// ── CORE EXPORT HELPERS ────────────────────────────────

function _exportExcelFromData(comp, scored, sigs) {
  if (!window.XLSX) { showToast('SheetJS not loaded', 'error'); return; }

  const company  = typeof getCompanyName === 'function' ? getCompanyName() : 'Task Tracker';
  const currency = comp.currency || 'IQD';
  const w = {
    price:        parseFloat(comp.w_price        ?? 40),
    requirements: parseFloat(comp.w_requirements ?? 30),
    delivery:     parseFloat(comp.w_delivery     ?? 10),
    warranty:     parseFloat(comp.w_warranty     ?? 10),
    payment:      parseFloat(comp.w_payment      ??  5),
    commitment:   parseFloat(comp.w_commitment   ??  5),
  };
  const currFmt = currency === 'IQD' ? '"IQD "#,##0' :
                  currency === 'USD' ? '"USD $"#,##0.00' :
                  currency === 'EUR' ? '"EUR €"#,##0.00' : `"${currency} "#,##0`;
  const fmtDate = d => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}); }
    catch { return String(d).split('T')[0]; }
  };

  const R = [];
  // Row 0–1: title
  R.push([`★ ${company}  —  Final Bids Comparison Table`,'','','','','','','','']);
  R.push(['Equipment & Services — Final Evaluation Report','','','','','','','','']);
  R.push(new Array(9).fill(''));
  // Rows 3–6: header info
  R.push(['Request Description:', comp.request_description||'','','','Department:',    comp.requesting_dept||'','','','']);
  R.push(['PR Number:',           comp.pr_number||'',          '','','Awarding Date:', fmtDate(comp.awarding_date),'','','']);
  R.push(['Request Date:',        fmtDate(comp.request_date),  '','','Total PR Value:',parseFloat(comp.total_pr_value)||0,'','','']);
  R.push(['Delivery Term:',       `${parseFloat(comp.delivery_term_days)||35} days`,'','','Warranty Term:',`${parseFloat(comp.warranty_term_months)||12} months`,'','','']);
  R.push(new Array(9).fill(''));

  // Vendors section
  const secV = R.length;
  R.push(['VENDORS DATA TABLE','','','','','','','','']);
  R.push([`Vendor Name`,`Total Cost (${currency})`,'Spec %','Install %','Delivery (Days)','Warranty (Mo.)','Payment %','Commitment %','Annex Ref.']);
  const vS = R.length;
  scored.forEach(v => R.push([
    v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),
    parseFloat(v.total_cost)||0,
    parseFloat(v.spec_compliance)||0,
    parseFloat(v.installation_compliance)||0,
    parseFloat(v.delivery_days)||0,
    parseFloat(v.warranty_months)||0,
    parseFloat(v.payment_compliance)||0,
    parseFloat(v.commitment_pct)||0,
    v.annex_ref||''
  ]));
  const vE = R.length - 1;
  R.push(new Array(9).fill(''));
  R.push([`SCORING WEIGHTS:`,`Price:${w.price}`,`Req:${w.requirements}`,`Del:${w.delivery}`,`War:${w.warranty}`,`Pay:${w.payment}`,`Com:${w.commitment}`,'Total:100','']);
  R.push(new Array(9).fill(''));

  // Scores section
  const secS = R.length;
  R.push(['EVALUATION SCORES TABLE','','','','','','','','']);
  R.push([`Vendor Name`,`Price (${w.price})`,`Req (${w.requirements})`,`Del (${w.delivery})`,`War (${w.warranty})`,`Pay (${w.payment})`,`Com (${w.commitment})`,'TOTAL SCORE','Rank']);
  const sS = R.length;
  scored.forEach((v,i) => R.push([
    (i===0?'★ ':'')+v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''),
    parseFloat(v.price_score||0), parseFloat(v.requirements_score||0),
    parseFloat(v.delivery_score||0), parseFloat(v.warranty_score||0),
    parseFloat(v.payment_score||0), parseFloat(v.commitment_score||0),
    parseFloat(v.total_score||0), i+1
  ]));
  const sE = R.length - 1;
  R.push(new Array(9).fill(''));

  // Winner section
  const secW = R.length;
  R.push(['WINNING BID','','','','','','','','']);
  const wHdr = R.length;
  R.push([`Winning Supplier`,'Total Score','',`Amount (${currency})`,'','Comment / Recommendation','','','']);
  const wData = R.length;
  const wRec = scored[0]||{};
  R.push([
    comp.winner_vendor||wRec.vendor_name||'',
    parseFloat(comp.winner_score||wRec.total_score||0), '',
    parseFloat(comp.winner_amount||wRec.total_cost||0), '',
    comp.winner_comment||'', '','',''
  ]);
  R.push(new Array(9).fill(''));

  // Signatures section
  const secSig = R.length;
  R.push(['COMMITTEE SIGNATURES','','','','','','','','']);
  const pad = n => [...new Array(Math.max(0, n))].map(()=>'');
  R.push([...sigs.map(s=>s.role||''),  ...pad(9-sigs.length)]);
  R.push([...sigs.map(s=>s.name||''),  ...pad(9-sigs.length)]);
  R.push(new Array(9).fill(''));
  R.push([...sigs.map(()=>'________________'), ...pad(9-sigs.length)]);
  R.push(new Array(9).fill(''));
  const footR = R.length;
  R.push([`★ ${company}`,'',`PR: ${comp.pr_number||'—'}`,'',`Generated: ${new Date().toLocaleDateString('en-GB')}`,'','','','']);

  // Build worksheet
  const ws = XLSX.utils.aoa_to_sheet(R);
  ws['!cols'] = [{wch:42},{wch:20},{wch:16},{wch:16},{wch:14},{wch:14},{wch:14},{wch:14},{wch:12}];

  // Merges
  const sectionMerges = [secV, secS, secW, secSig].map(r => ({s:{r,c:0},e:{r,c:8}}));
  ws['!merges'] = [
    {s:{r:0,c:0},e:{r:0,c:8}}, {s:{r:1,c:0},e:{r:1,c:8}},
    {s:{r:3,c:1},e:{r:3,c:3}}, {s:{r:3,c:5},e:{r:3,c:8}},
    {s:{r:4,c:1},e:{r:4,c:3}}, {s:{r:4,c:5},e:{r:4,c:8}},
    {s:{r:5,c:1},e:{r:5,c:3}},
    {s:{r:6,c:1},e:{r:6,c:3}}, {s:{r:6,c:5},e:{r:6,c:8}},
    ...sectionMerges,
    {s:{r:wHdr, c:2},e:{r:wHdr, c:3}}, {s:{r:wHdr, c:5},e:{r:wHdr, c:8}},
    {s:{r:wData,c:2},e:{r:wData,c:3}}, {s:{r:wData,c:5},e:{r:wData,c:8}},
    {s:{r:footR,c:0},e:{r:footR,c:1}}, {s:{r:footR,c:2},e:{r:footR,c:3}},
    {s:{r:footR,c:4},e:{r:footR,c:8}},
  ];

  // Number formats: vendor Total Cost
  for (let r = vS; r <= vE; r++) {
    const costCell = XLSX.utils.encode_cell({r, c:1});
    if (ws[costCell] && typeof ws[costCell].v === 'number') { ws[costCell].t='n'; ws[costCell].z=currFmt; }
    for (let c = 2; c <= 7; c++) {
      const a = XLSX.utils.encode_cell({r, c});
      if (ws[a] && typeof ws[a].v === 'number') { ws[a].t='n'; ws[a].z='0.0'; }
    }
  }
  // Score columns
  for (let r = sS; r <= sE; r++) {
    for (let c = 1; c <= 7; c++) {
      const a = XLSX.utils.encode_cell({r, c});
      if (ws[a] && typeof ws[a].v === 'number') { ws[a].t='n'; ws[a].z='0.00'; }
    }
    const rank = XLSX.utils.encode_cell({r, c:8});
    if (ws[rank]) { ws[rank].t='n'; ws[rank].z='0'; }
  }
  // Winner score + amount + PR value
  [[wData,1,'0.00'],[wData,3,currFmt],[5,5,currFmt]].forEach(([r,c,z]) => {
    const a = XLSX.utils.encode_cell({r, c});
    if (ws[a] && typeof ws[a].v === 'number') { ws[a].t='n'; ws[a].z=z; }
  });

  ws['!freeze'] = {xSplit:0, ySplit:2};

  const wb = XLSX.utils.book_new();
  wb.Props = {Title:'Final Bids Comparison', Author:company};
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
  XLSX.writeFile(wb, `Comparison_${comp.pr_number||'PR'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exported ✓', 'success');
}

function _exportPDFFromData(comp, scored, sigs) {
  if (!window.jspdf) { showToast('jsPDF not loaded', 'error'); return; }

  const company  = typeof getCompanyName === 'function' ? getCompanyName() : 'Task Tracker';
  const currency = comp.currency || 'IQD';
  const w = {
    price:        parseFloat(comp.w_price        ?? 40),
    requirements: parseFloat(comp.w_requirements ?? 30),
    delivery:     parseFloat(comp.w_delivery     ?? 10),
    warranty:     parseFloat(comp.w_warranty     ?? 10),
    payment:      parseFloat(comp.w_payment      ??  5),
    commitment:   parseFloat(comp.w_commitment   ??  5),
  };

  const {jsPDF} = window.jspdf;
  // Portrait A4
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  const pw  = doc.internal.pageSize.getWidth();   // 210mm
  const ph  = doc.internal.pageSize.getHeight();  // 297mm
  const ML  = 12, MR = 12, CW = pw - ML - MR;

  const BLUE   = [79,70,229];
  const INDIGO = [55,48,163];
  const GREEN  = [5,150,105];
  const DARK   = [17,24,39];
  const GRAY   = [107,114,128];
  const LGRAY  = [249,250,255];
  const WHITE  = [255,255,255];

  const fmtDate = d => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}); }
    catch { return String(d).split('T')[0]; }
  };
  const fmtMoney = n => {
    const num = parseFloat(n);
    if (isNaN(num)) return '—';
    return currency + ' ' + num.toLocaleString('en-US', {
      minimumFractionDigits: currency==='IQD'?0:2,
      maximumFractionDigits: currency==='IQD'?0:2
    });
  };
  const fmtN = (n, d=0) => {
    const num = parseFloat(n);
    return isNaN(num) ? '—' : num.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  };

  // ── HEADER BAND ───────────────────────────────────────
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pw, 34, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text(`★ ${company}`, ML, 8);
  doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text('Final Bids Comparison Table', pw/2, 16, {align:'center'});
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('Equipment & Services — Final Evaluation Report', pw/2, 22, {align:'center'});
  doc.setFontSize(7);
  doc.text(
    `PR: ${comp.pr_number||'—'}   |   ${comp.request_description||'—'}   |   Dept: ${comp.requesting_dept||'—'}`,
    pw/2, 29, {align:'center'}
  );

  let y = 40;

  // ── INFO CARD ─────────────────────────────────────────
  doc.setFillColor(...LGRAY); doc.setDrawColor(200,204,230);
  doc.roundedRect(ML, y, CW, 24, 2, 2, 'FD');
  const c1 = ML+5, c2 = ML+CW/2+5;
  const info = [
    ['Request Date:',   fmtDate(comp.request_date),                'Awarding Date:',    fmtDate(comp.awarding_date)],
    ['Total PR Value:', fmtMoney(comp.total_pr_value),             'Currency:',         currency],
    ['Delivery Term:',  fmtN(comp.delivery_term_days)+' days',    'Warranty Term:',    fmtN(comp.warranty_term_months)+' months'],
  ];
  info.forEach((row, i) => {
    const ly = y + 7 + i*7;
    doc.setTextColor(...GRAY);  doc.setFont('helvetica','bold');  doc.setFontSize(7.5);
    doc.text(row[0], c1, ly);
    doc.setTextColor(...DARK);  doc.setFont('helvetica','normal');
    doc.text(row[1], c1+28, ly);
    doc.setTextColor(...GRAY);  doc.setFont('helvetica','bold');
    doc.text(row[2], c2, ly);
    doc.setTextColor(...DARK);  doc.setFont('helvetica','normal');
    doc.text(row[3], c2+28, ly);
  });
  y += 30;

  // Section helper
  const drawSection = (title, num, color) => {
    color = color || BLUE;
    doc.setFillColor(...color); doc.rect(ML, y, 3, 7, 'F');
    doc.setFillColor(...color); doc.roundedRect(ML+5, y+0.5, 6, 6, 1, 1, 'F');
    doc.setTextColor(...WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.text(String(num), ML+8, y+5, {align:'center'});
    doc.setTextColor(...color); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(title, ML+14, y+5.5);
    y += 10;
  };

  // ── 1. VENDORS DATA ──────────────────────────────────
  drawSection('VENDORS DATA', 1, BLUE);
  doc.autoTable({
    startY: y,
    head:[[
      {content:'Vendor',          styles:{halign:'left'}},
      {content:'Total Cost',      styles:{halign:'right'}},
      'Spec %','Install %','Del\n(Days)','War\n(Mo.)','Pay\n%','Com\n%',
    ]],
    body: scored.map(v => [
      {content: v.vendor_name+(v.annex_ref?`\n${v.annex_ref}`:''), styles:{halign:'left'}},
      {content: fmtMoney(v.total_cost),   styles:{halign:'right', fontStyle:'bold'}},
      {content: fmtN(v.spec_compliance,0)+'%',         styles:{halign:'center'}},
      {content: fmtN(v.installation_compliance,0)+'%', styles:{halign:'center'}},
      {content: fmtN(v.delivery_days,0),               styles:{halign:'center'}},
      {content: fmtN(v.warranty_months,0),             styles:{halign:'center'}},
      {content: fmtN(v.payment_compliance,0)+'%',      styles:{halign:'center'}},
      {content: fmtN(v.commitment_pct,0)+'%',          styles:{halign:'center'}},
    ]),
    headStyles:{fillColor:BLUE,textColor:WHITE,fontSize:8,fontStyle:'bold',halign:'center',cellPadding:{top:3,bottom:3,left:2,right:2}},
    bodyStyles:{fontSize:8.5,textColor:DARK,cellPadding:{top:3,bottom:3,left:3,right:3}},
    columnStyles:{0:{cellWidth:52},1:{cellWidth:26,halign:'right'},2:{cellWidth:14,halign:'center'},3:{cellWidth:14,halign:'center'},4:{cellWidth:14,halign:'center'},5:{cellWidth:14,halign:'center'},6:{cellWidth:13,halign:'center'},7:{cellWidth:13,halign:'center'}},
    alternateRowStyles:{fillColor:[248,249,255]},
    tableLineColor:[210,215,235],tableLineWidth:0.25,
    margin:{left:ML,right:MR},
  });
  y = doc.lastAutoTable.finalY + 4;

  // Weights pill
  doc.setFillColor(235,237,255); doc.setDrawColor(180,190,220);
  doc.roundedRect(ML, y, CW, 7, 1, 1, 'FD');
  doc.setTextColor(...GRAY); doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
  doc.text(
    `Weights:  Price=${w.price}  |  Req=${w.requirements}  |  Del=${w.delivery}  |  War=${w.warranty}  |  Pay=${w.payment}  |  Com=${w.commitment}  |  Total=100`,
    ML+3, y+4.5
  );
  y += 11;

  if (y > 200) { doc.addPage(); y = 16; }

  // ── 2. EVALUATION SCORES ─────────────────────────────
  drawSection('EVALUATION SCORES', 2, [79,70,229]);
  doc.autoTable({
    startY: y,
    head:[[
      {content:'Vendor', styles:{halign:'left'}},
      `Price\n(${w.price})`,`Req\n(${w.requirements})`,`Del\n(${w.delivery})`,
      `War\n(${w.warranty})`,`Pay\n(${w.payment})`,`Com\n(${w.commitment})`,
      {content:'TOTAL',styles:{fontStyle:'bold'}}, 'Rank'
    ]],
    body: scored.map((v,i) => [
      {content:(i===0?'★ ':'')+v.vendor_name+(v.annex_ref?` (${v.annex_ref})`:''), styles:{halign:'left',fontStyle:i===0?'bold':'normal'}},
      fmtN(v.price_score,2), fmtN(v.requirements_score,2), fmtN(v.delivery_score,2),
      fmtN(v.warranty_score,2), fmtN(v.payment_score,2), fmtN(v.commitment_score,2),
      {content:fmtN(v.total_score,2), styles:{fontStyle:'bold',halign:'center'}},
      {content:'#'+(i+1), styles:{halign:'center'}},
    ]),
    headStyles:{fillColor:[79,70,229],textColor:WHITE,fontSize:8,fontStyle:'bold',halign:'center',cellPadding:{top:3,bottom:3,left:2,right:2}},
    bodyStyles:{fontSize:8.5,textColor:DARK,halign:'center',cellPadding:{top:3,bottom:3,left:2,right:2}},
    columnStyles:{0:{cellWidth:52,halign:'left'}},
    didParseCell:d=>{if(d.section==='body'&&d.row.index===0){d.cell.styles.fillColor=[236,253,245];d.cell.styles.fontStyle='bold';d.cell.styles.textColor=[6,95,70];}},
    alternateRowStyles:{fillColor:[248,249,255]},
    tableLineColor:[210,215,235],tableLineWidth:0.25,
    margin:{left:ML,right:MR},
  });
  y = doc.lastAutoTable.finalY + 6;

  if (y > 215) { doc.addPage(); y = 16; }

  // ── 3. WINNING BID ───────────────────────────────────
  drawSection('WINNING BID', 3, GREEN);
  const wRec = scored[0]||{};
  doc.autoTable({
    startY: y,
    head:[[
      {content:'Winning Supplier',styles:{halign:'left'}},
      {content:'Total Score',     styles:{halign:'center'}},
      {content:'Total Amount',    styles:{halign:'right'}},
      {content:'Comment / Recommendation',styles:{halign:'left'}},
    ]],
    body:[[
      {content: comp.winner_vendor||wRec.vendor_name||'—', styles:{fontStyle:'bold',halign:'left',  fontSize:10}},
      {content: fmtN(comp.winner_score||wRec.total_score||0,2), styles:{fontStyle:'bold',halign:'center',fontSize:10}},
      {content: fmtMoney(comp.winner_amount||wRec.total_cost||0), styles:{fontStyle:'bold',halign:'right', fontSize:10,textColor:[5,120,80]}},
      {content: comp.winner_comment||'—', styles:{halign:'left',fontSize:9}},
    ]],
    headStyles:{fillColor:GREEN,textColor:WHITE,fontSize:8.5,fontStyle:'bold',cellPadding:{top:3,bottom:3,left:4,right:4}},
    bodyStyles:{fillColor:[240,255,249],fontSize:10,textColor:DARK,cellPadding:{top:5,bottom:5,left:4,right:4}},
    columnStyles:{0:{cellWidth:50},1:{cellWidth:22},2:{cellWidth:38}},
    tableLineColor:[150,210,180],tableLineWidth:0.4,
    margin:{left:ML,right:MR},
  });
  y = doc.lastAutoTable.finalY + 6;

  if (y > 220) { doc.addPage(); y = 16; }

  // ── 4. COMMITTEE SIGNATURES ──────────────────────────
  drawSection('COMMITTEE SIGNATURES', 4, [100,116,200]);
  const sigCols = sigs.slice(0, 5); // max 5 per row
  doc.autoTable({
    startY: y,
    head: [sigCols.map(s => ({content: s.role||'—', styles:{halign:'center',fontStyle:'bold',fontSize:7.5}}))],
    body: [
      sigCols.map(s => ({content: s.name||'', styles:{halign:'center',fontSize:9,fontStyle:s.name?'bold':'normal'}})),
      sigCols.map(() => ({content:'', styles:{minCellHeight:10}})),
      sigCols.map(() => ({content:'______________________', styles:{halign:'center',textColor:[150,150,170],fontSize:8}})),
    ],
    headStyles:{fillColor:[230,232,255],textColor:DARK,fontSize:7.5,fontStyle:'bold',halign:'center',cellPadding:{top:3,bottom:3,left:2,right:2}},
    bodyStyles:{textColor:DARK,cellPadding:{top:2,bottom:2,left:2,right:2}},
    tableLineColor:[210,215,235],tableLineWidth:0.2,
    margin:{left:ML,right:MR},
  });
  // Extra signature rows if more than 5
  if (sigs.length > 5) {
    y = doc.lastAutoTable.finalY + 4;
    const sigCols2 = sigs.slice(5);
    doc.autoTable({
      startY: y,
      head:[sigCols2.map(s=>({content:s.role||'—',styles:{halign:'center',fontStyle:'bold',fontSize:7.5}}))],
      body:[
        sigCols2.map(s=>({content:s.name||'',styles:{halign:'center',fontSize:9,fontStyle:s.name?'bold':'normal'}})),
        sigCols2.map(()=>({content:'',styles:{minCellHeight:10}})),
        sigCols2.map(()=>({content:'______________________',styles:{halign:'center',textColor:[150,150,170],fontSize:8}})),
      ],
      headStyles:{fillColor:[230,232,255],textColor:DARK,fontSize:7.5,fontStyle:'bold',halign:'center'},
      bodyStyles:{textColor:DARK,cellPadding:{top:2,bottom:2,left:2,right:2}},
      tableLineColor:[210,215,235],tableLineWidth:0.2,
      margin:{left:ML,right:MR},
    });
  }

  // ── FOOTER ON ALL PAGES ──────────────────────────────
  const tp = doc.internal.getNumberOfPages();
  for (let i = 1; i <= tp; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BLUE); doc.setLineWidth(0.4);
    doc.line(ML, ph-11, pw-MR, ph-11);
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.setTextColor(...INDIGO);
    doc.text(`★ ${company}`, ML, ph-7);
    doc.setTextColor(...GRAY); doc.setFont('helvetica','normal');
    doc.text(`PR: ${comp.pr_number||'—'}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`, pw/2, ph-7, {align:'center'});
    doc.text(`Page ${i} of ${tp}`, pw-MR, ph-7, {align:'right'});
  }

  doc.save(`Comparison_${comp.pr_number||'PR'}_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF exported ✓', 'success');
}

// ── SAVED RECORD EXPORTS ───────────────────────────────

async function exportCompExcel(id) {
  const comp = _allComparisons.find(c => c.id === id);
  if (!comp) { showToast('Comparison not found', 'error'); return; }

  let vds = _compVendors.filter(v => v.comparison_id === id);
  if (!vds.length) {
    try {
      const r = await callAPI('getAll', { sheet: 'ComparisonVendors' });
      vds = (r.rows || []).filter(v => String(v.comparison_id) === String(id));
    } catch(e) { showToast('Failed to load vendors: ' + e.message, 'error'); return; }
  }
  if (!vds.length) { showToast('No vendor data found', 'info'); return; }

  const w = {
    price:        parseFloat(comp.w_price        ?? 40),
    requirements: parseFloat(comp.w_requirements ?? 30),
    delivery:     parseFloat(comp.w_delivery     ?? 10),
    warranty:     parseFloat(comp.w_warranty     ?? 10),
    payment:      parseFloat(comp.w_payment      ??  5),
    commitment:   parseFloat(comp.w_commitment   ??  5),
  };

  const scored   = scoreVendors(vds, w);
  const nVendors = scored.length;

  if (!window.XLSX) { showToast('SheetJS not loaded', 'error'); return; }

  // ── Meta ──────────────────────────────────────────────────────────────────
  const company  = typeof getCompanyName === 'function' ? getCompanyName() : 'Sama Babil';
  const currency = comp.currency || 'IQD';
  const currFmt  = currency === 'IQD' ? '#,##0 "IQD"' :
                   currency === 'USD' ? '"$ "#,##0.00'  :
                   currency === 'EUR' ? '"€ "#,##0.00'  : `#,##0 "${currency}"`;

  const fmtDate = d => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB',
      { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return String(d).split('T')[0]; }
  };

  const genDate = new Date().toLocaleDateString('en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Build rows as array-of-arrays ─────────────────────────────────────────
  // 9 columns: A-I (indices 0-8)
  const NCOLS = 9;
  const aoa   = [];
  const pad   = () => Array(NCOLS).fill(null);

  function row(...cells) {
    const r = pad();
    cells.forEach(([ci, val]) => { r[ci] = val; });
    aoa.push(r);
    return aoa.length; // 1-based Excel row number
  }

  // ── ROWS ──────────────────────────────────────────────────────────────────

  // R1: Banner
  const R1 = row([0, `★ ${company}                                    Generated: ${genDate}`]);

  // R2: Title
  const R2 = row([0, 'FINAL BIDS COMPARISON TABLE']);

  // R3: Subtitle
  const R3 = row([0, 'Equipment & Services  —  Procurement Evaluation Report']);

  // R4: spacer
  aoa.push(pad()); const R4 = aoa.length;

  // R5-R8: Header info
  const R5 = row([0,'Request Description:'], [1, comp.request_description||''],
                  [4,'Requesting Department:'], [5, comp.requesting_dept||'']);
  const R6 = row([0,'PR Number:'],            [1, comp.pr_number||''],
                  [4,'Awarding Date:'],        [5, fmtDate(comp.awarding_date)]);
  const R7 = row([0,'Request Date:'],         [1, fmtDate(comp.request_date)],
                  [4,'Total PR Value:'],       [5, parseFloat(comp.total_pr_value)||0]);
  const R8 = row([0,'Delivery Term:'],        [1, `${comp.delivery_term_days||35} days`],
                  [4,'Warranty Term:'],        [5, `${comp.warranty_term_months||12} months`]);

  // R9: spacer
  aoa.push(pad()); const R9 = aoa.length;

  // ── SECTION 1: VENDORS DATA ───────────────────────────────────────────────
  const R_S1 = row([0, '  1.  VENDORS DATA TABLE']);

  // Header row 1
  const R_VH1 = row(
    [0,'Vendor Name'],
    [1,'Total Cost'],
    [2,'Fulfillment'],
    [4,`Delivery\n(Days)`],
    [5,`Warranty\n(Mo.)`],
    [6,`Payment\n(%)`],
    [7,`Commitment\n(%)`]
  );

  // Header row 2 (sub-header for Fulfillment)
  const R_VH2 = row(
    [2, 'Specification (%)'],
    [3, 'Installation (%)']
  );

  // Vendor data rows — ACTUAL NUMBERS
  const VD_START = aoa.length + 1;
  scored.forEach(v => {
    aoa.push([
      v.vendor_name + (v.annex_ref ? `  (${v.annex_ref})` : ''),  // A: name
      parseFloat(v.total_cost)             || 0,   // B: cost (number)
      parseFloat(v.spec_compliance)        / 100,  // C: spec as decimal → 0.0% format
      parseFloat(v.installation_compliance)/ 100,  // D: install as decimal
      parseFloat(v.delivery_days)          || 0,   // E: days (integer)
      parseFloat(v.warranty_months)        || 0,   // F: months (integer)
      parseFloat(v.payment_compliance)     / 100,  // G: payment as decimal
      parseFloat(v.commitment_pct)         / 100,  // H: commit as decimal
      null                                         // I: empty
    ]);
  });
  const VD_END = aoa.length;

  // spacer
  aoa.push(pad());

  // ── SECTION 2: SCORING WEIGHTS ────────────────────────────────────────────
  const R_S2 = row([0, '  2.  STANDARD SCORING WEIGHTS']);

  const R_WT = row(
    [0, `Price\n${w.price}`],
    [1, `Requirements\n${w.requirements}`],
    [2, `Delivery\n${w.delivery}`],
    [3, `Warranty\n${w.warranty}`],
    [4, `Payment\n${w.payment}`],
    [5, `Commitment\n${w.commitment}`],
    [6, `TOTAL\n${(w.price+w.requirements+w.delivery+w.warranty+w.payment+w.commitment).toFixed(1)}`]
  );

  // spacer
  aoa.push(pad());

  // ── SECTION 3: SCORES TABLE ───────────────────────────────────────────────
  const R_S3 = row([0, '  3.  VENDORS SCORES TABLE']);

  // Score header row 1
  const R_SH1 = row(
    [0, 'Vendor Name'],
    [1, `Price Score\n(W=${w.price})`],
    [2, `Requirements\n(W=${w.requirements})`],
    [4, `Delivery\n(W=${w.delivery})`],
    [5, `Warranty\n(W=${w.warranty})`],
    [6, `Payment\n(W=${w.payment})`],
    [7, `Commitment\n(W=${w.commitment})`],
    [8, 'TOTAL SCORE']
  );

  // Score header row 2 (sub)
  const R_SH2 = row(
    [2, 'Spec.\nComponent'],
    [3, 'Install.\nComponent']
  );

  // Score data rows — ALL FORMULAS referencing vendor data rows
  const COST_R = `B${VD_START}:B${VD_END}`;
  const DEL_R  = `E${VD_START}:E${VD_END}`;
  const WAR_R  = `F${VD_START}:F${VD_END}`;

  const SD_START = aoa.length + 1;
  scored.forEach((v, i) => {
    const vr = VD_START + i;   // corresponding vendor data row
    const sr = aoa.length + 1; // this score row (Excel 1-based)

    aoa.push([
      `=A${vr}`,                                           // A: name ref
      `=(MIN(${COST_R})/B${vr})*${w.price}`,              // B: price score
      `=C${vr}*${w.requirements / 2}`,                    // C: spec component
      `=D${vr}*${w.requirements / 2}`,                    // D: install component
      `=(MIN(${DEL_R})/E${vr})*${w.delivery}`,            // E: delivery score
      `=(F${vr}/MAX(${WAR_R}))*${w.warranty}`,            // F: warranty score
      `=G${vr}*${w.payment}`,                             // G: payment score
      `=H${vr}*${w.commitment}`,                          // H: commit score
      `=SUM(B${sr}:H${sr})`,                              // I: TOTAL
    ]);
  });
  const SD_END = aoa.length;

  // spacer
  aoa.push(pad());

  // ── SECTION 4: WINNING BID ────────────────────────────────────────────────
  const R_S4 = row([0, '  4.  WINNING BID']);

  const R_WH = row(
    [0, 'Winning Supplier'],
    [3, 'Total Score'],
    [4, `Total Amount (${currency})`],
    [7, 'Comment / Recommendation']
  );

  const WIN_ROW = SD_START;  // first score row = winner (sorted desc by JS)
  const R_WD = row(
    [0, `=A${WIN_ROW}`],
    [3, `=I${WIN_ROW}`],
    [4, `=B${VD_START}`],
    [7, comp.winner_comment || '']
  );

  // spacer
  aoa.push(pad());

  // ── SECTION 5: COMMITTEE SIGNATURES ──────────────────────────────────────
  const R_S5 = row([0, '  5.  COMMITTEE SIGNATURES']);

  const sigs = _sigsFromComp(comp);

  // Titles (2 cols each)
  const R_ST = row(
    [0, sigs[0]?.role || 'Head of Committee'],
    [2, sigs[1]?.role || 'Requester'],
    [4, sigs[2]?.role || 'Requester Management'],
    [6, sigs[3]?.role || 'Supply Chain Officer'],
    [8, sigs[4]?.role || 'Head of Supply Chain']
  );

  // Names
  const R_SN = row(
    [0, sigs[0]?.name || ''],
    [2, sigs[1]?.name || ''],
    [4, sigs[2]?.name || ''],
    [6, sigs[3]?.name || ''],
    [8, sigs[4]?.name || '']
  );

  // Signature line
  const R_SL = row([0,''], [2,''], [4,''], [6,''], [8,'']);

  // spacer
  aoa.push(pad());

  // Footer
  const R_FT = row(
    [0, `★ ${company}  |  Confidential Procurement Document`],
    [5, `PR: ${comp.pr_number||'—'}  |  Generated: ${genDate}`]
  );

  // ── Create worksheet ──────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Fix formula cells (SheetJS needs explicit formula type) ───────────────
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < NCOLS; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (typeof cell.v === 'string' && cell.v.startsWith('=')) {
        const fml = cell.v.slice(1);
        if (c === 0 || fml.startsWith('A')) {
          ws[addr] = { t: 's', f: fml, v: '' };   // text formula (name ref)
        } else {
          ws[addr] = { t: 'n', f: fml, v: 0 };    // numeric formula
        }
      }
    }
  }

  // ── Number formats ────────────────────────────────────────────────────────
  for (let r = VD_START - 1; r < VD_END; r++) {
    const fmts = { 1: currFmt, 2:'0.0%', 3:'0.0%', 4:'0', 5:'0', 6:'0.0%', 7:'0.0%' };
    Object.entries(fmts).forEach(([ci, fmt]) => {
      const addr = XLSX.utils.encode_cell({ r, c: parseInt(ci) });
      if (ws[addr]) ws[addr].z = fmt;
    });
  }

  for (let r = SD_START - 1; r < SD_END; r++) {
    for (let c = 1; c <= 8; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].z = '0.00';
    }
  }

  // Total PR Value (R7, col F = index 5)
  const prValAddr = XLSX.utils.encode_cell({ r: R7 - 1, c: 5 });
  if (ws[prValAddr]) ws[prValAddr].z = currFmt;

  // Winner: score (col D=3) and amount (col E=4)
  const wScAddr = XLSX.utils.encode_cell({ r: R_WD - 1, c: 3 });
  const wAmAddr = XLSX.utils.encode_cell({ r: R_WD - 1, c: 4 });
  if (ws[wScAddr]) ws[wScAddr].z = '0.00';
  if (ws[wAmAddr]) ws[wAmAddr].z = currFmt;

  // ── Merged cells ──────────────────────────────────────────────────────────
  const merges = [];
  const addM = (r1, c1, r2, c2) =>
    merges.push({ s: {r: r1-1, c: c1-1}, e: {r: r2-1, c: c2-1} });

  // Banner, title, subtitle: full width A-I
  addM(R1,1, R1,9);
  addM(R2,1, R2,9);
  addM(R3,1, R3,9);

  // Info grid: value spans B-D, label2 at E, value2 spans F-I
  [R5,R6,R7,R8].forEach(r => {
    addM(r,2, r,4);
    addM(r,6, r,9);
  });

  // Section headers: full width
  [R_S1, R_S2, R_S3, R_S4, R_S5].forEach(r => addM(r,1, r,9));

  // Vendors table header: Fulfillment spans C+D (cols 3-4)
  addM(R_VH1,3, R_VH1,4);
  addM(R_VH2,1, R_VH2,2);
  addM(R_VH2,5, R_VH2,9);

  // Weights row: last cell spans G-I (7-9)
  addM(R_WT,7, R_WT,9);

  // Scores header: Requirements spans C+D (cols 3-4)
  addM(R_SH1,3, R_SH1,4);
  addM(R_SH2,1, R_SH2,2);
  addM(R_SH2,5, R_SH2,9);

  // Winner header
  addM(R_WH,1, R_WH,3);
  addM(R_WH,5, R_WH,6);
  addM(R_WH,8, R_WH,9);

  // Winner data
  addM(R_WD,1, R_WD,3);
  addM(R_WD,5, R_WD,6);
  addM(R_WD,8, R_WD,9);

  // Signature columns: each title/name spans 2 cols
  const sigCols = [[1,2],[3,4],[5,6],[7,8],[9,9]];
  [R_ST, R_SN, R_SL].forEach(r => {
    sigCols.forEach(([c1,c2]) => { if (c1!==c2) addM(r,c1,r,c2); });
  });

  // Footer
  addM(R_FT,1, R_FT,5);
  addM(R_FT,6, R_FT,9);

  ws['!merges'] = merges;

  // ── Column widths ─────────────────────────────────────────────────────────
  ws['!cols'] = [
    {wch:28}, // A
    {wch:18}, // B
    {wch:12}, // C
    {wch:12}, // D
    {wch:11}, // E
    {wch:11}, // F
    {wch:11}, // G
    {wch:11}, // H
    {wch:13}, // I
  ];

  // ── Row heights ───────────────────────────────────────────────────────────
  ws['!rows'] = [];
  const rh = (r, h) => { ws['!rows'][r-1] = { hpt: h }; };
  rh(R1, 22); rh(R2, 26); rh(R3, 15); rh(R4, 5);
  rh(R5, 17); rh(R6, 17); rh(R7, 17); rh(R8, 17);
  rh(R9, 6);
  rh(R_S1, 19);
  rh(R_VH1, 28); rh(R_VH2, 16);
  for (let r = VD_START; r <= VD_END; r++) rh(r, 20);
  rh(R_S2, 19); rh(R_WT, 24);
  rh(R_S3, 19);
  rh(R_SH1, 28); rh(R_SH2, 16);
  for (let r = SD_START; r <= SD_END; r++) rh(r, 20);
  rh(R_S4, 20); rh(R_WH, 22); rh(R_WD, 24);
  rh(R_S5, 19);
  rh(R_ST, 28); rh(R_SN, 22); rh(R_SL, 32);
  rh(R_FT, 16);

  // ── Freeze panes ──────────────────────────────────────────────────────────
  ws['!freeze'] = { xSplit: 0, ySplit: 4 };

  // ── Workbook ──────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'Final Bids Comparison', Author: company, Company: company };
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');

  const fname = `Comparison_${(comp.pr_number||'PR').replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fname);
  showToast('Excel exported with formulas ✓', 'success');
}

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
  _exportPDFFromData(comp, scored, sigs);
}

// ── ACTIVE FORM EXPORTS (UNSAVED / DIRTY STATE) ────────

function getActiveFormCompData(scored) {
  const desc = document.getElementById('qf-desc')?.value.trim() || 'Active Bids Comparison';
  const pr   = document.getElementById('qf-pr')?.value.trim() || 'DRAFT';
  const w    = getWeights();
  const winner = scored.filter(s => s.vendor_name)[0] || {};

  return {
    request_description:  desc,
    pr_number:            pr,
    requesting_dept:      document.getElementById('qf-dept')?.value || '',
    request_date:         document.getElementById('qf-rdate')?.value || '',
    awarding_date:        document.getElementById('qf-adate')?.value || '',
    total_pr_value:       parseFloat(document.getElementById('qf-val')?.value) || 0,
    currency:             document.getElementById('qf-cur')?.value || 'IQD',
    delivery_term_days:   parseInt(document.getElementById('qf-dterm')?.value) || 35,
    warranty_term_months: parseInt(document.getElementById('qf-wterm')?.value) || 12,
    w_price:              w.price,
    w_requirements:       w.requirements,
    w_delivery:           w.delivery,
    w_warranty:           w.warranty,
    w_payment:            w.payment,
    w_commitment:         w.commitment,
    winner_vendor:        winner.vendor_name || '',
    winner_score:         parseFloat(winner.total_score || 0),
    winner_amount:        parseFloat(winner.total_cost || 0),
    winner_comment:       document.getElementById('qf-comment')?.value || '',
  };
}

function exportActiveFormExcel() {
  const w = getWeights();
  const activeVendors = _compVendors.filter(v => v.vendor_name);
  if (!activeVendors.length) {
    showToast(bl('Please enter at least one vendor name first','الرجاء إدخال اسم مورد واحد على الأقل أولاً'), 'info');
    return;
  }
  const scored = scoreVendors(_compVendors, w);
  const comp = getActiveFormCompData(scored);
  const sigs = _compSignatures.length ? _compSignatures : defaultSignatures();
  _exportExcelFromData(comp, scored, sigs);
}

function exportActiveFormPDF() {
  const w = getWeights();
  const activeVendors = _compVendors.filter(v => v.vendor_name);
  if (!activeVendors.length) {
    showToast(bl('Please enter at least one vendor name first','الرجاء إدخال اسم مورد واحد على الأقل أولاً'), 'info');
    return;
  }
  const scored = scoreVendors(_compVendors, w);
  const comp = getActiveFormCompData(scored);
  const sigs = _compSignatures.length ? _compSignatures : defaultSignatures();
  _exportPDFFromData(comp, scored, sigs);
}
