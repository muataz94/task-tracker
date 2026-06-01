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

    const pScore      = (cost>0 && minCost>0)     ? (minCost/cost)*weights.price         : 0;
    const specScore   = (spec    / 100)             * (weights.requirements / 2);
    const installScore= (install / 100)             * (weights.requirements / 2);
    const rScore      = specScore + installScore;
    const dScore      = (deliv>0 && minDelivery>0)  ? (minDelivery/deliv)*weights.delivery : 0;
    const wScore      = (warr>0 && maxWarranty>0)   ? (warr/maxWarranty)*weights.warranty  : 0;
    const payScore    = (pay/100)                   * weights.payment;
    const commitScore = (commit/100)                * weights.commitment;

    const total = pScore+rScore+dScore+wScore+payScore+commitScore;
    return {
      ...v,
      price_score:          parseFloat(pScore.toFixed(4)),
      requirements_score:   parseFloat(rScore.toFixed(4)),
      spec_score:           parseFloat(specScore.toFixed(4)),
      install_score:        parseFloat(installScore.toFixed(4)),
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

  const company  = typeof getCompanyName === 'function' ? getCompanyName() : 'Sama Babil';
  const currency = comp.currency || 'IQD';
  const w = {
    price:        parseFloat(comp.w_price        ?? 40),
    requirements: parseFloat(comp.w_requirements ?? 30),
    delivery:     parseFloat(comp.w_delivery     ?? 10),
    warranty:     parseFloat(comp.w_warranty     ?? 10),
    payment:      parseFloat(comp.w_payment      ??  5),
    commitment:   parseFloat(comp.w_commitment   ??  5),
  };
  const halfReq = w.requirements / 2;
  const currFmt = currency === 'IQD' ? '#,##0 "IQD"' :
                  currency === 'USD' ? '"$ "#,##0.00'  :
                  currency === 'EUR' ? '"EUR "#,##0.00' : `#,##0 "${currency}"`;
  const fmtDate = d => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return String(d).split('T')[0]; }
  };
  const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const NCOLS = 9;
  const aoa   = [];
  const epad  = () => Array(NCOLS).fill(null);
  const row   = (...cells) => {
    const r = epad();
    cells.forEach(([ci, val]) => { if (ci < NCOLS) r[ci] = val; });
    aoa.push(r);
    return aoa.length;
  };

  // Rows 1-3: Banner, Title, Subtitle
  const R1 = row([0, `${company}  |  Final Bids Comparison Table  |  Generated: ${genDate}`]);
  const R2 = row([0, 'FINAL BIDS COMPARISON TABLE']);
  const R3 = row([0, 'Equipment & Services  -  Weighted Procurement Evaluation Report']);
  aoa.push(epad()); const R4 = aoa.length;

  // Info header (R5-R8)
  const R5 = row([0,'Request Description:'], [1, comp.request_description||''],
                  [4,'Requesting Dept.:'],   [5, comp.requesting_dept||'']);
  const R6 = row([0,'PR Number:'],           [1, comp.pr_number||''],
                  [4,'Awarding Date:'],      [5, fmtDate(comp.awarding_date)]);
  const R7 = row([0,'Request Date:'],        [1, fmtDate(comp.request_date)],
                  [4,'Total PR Value:'],     [5, parseFloat(comp.total_pr_value)||0]);
  const R8 = row([0,'Delivery Term:'],       [1, `${comp.delivery_term_days||35} days`],
                  [4,'Warranty Term:'],      [5, `${comp.warranty_term_months||12} months`]);
  aoa.push(epad()); const R9 = aoa.length;

  // Section 1: Vendors Data
  const R_S1  = row([0, '  1.  VENDORS DATA TABLE']);
  const R_VH1 = row(
    [0,'Vendor Name'], [1,'Total Cost'], [2,'Fulfillment'],
    [4,'Delivery (Days)'], [5,'Warranty (Mo.)'], [6,'Payment (%)'], [7,'Commitment (%)']
  );
  const R_VH2 = row([2, 'Specification (%)'], [3, 'Installation (%)']);

  const VD_START = aoa.length + 1;
  scored.forEach(v => {
    aoa.push([
      v.vendor_name + (v.annex_ref ? `\n(${v.annex_ref})` : ''),
      parseFloat(v.total_cost)              || 0,
      parseFloat(v.spec_compliance)         / 100,
      parseFloat(v.installation_compliance) / 100,
      parseFloat(v.delivery_days)           || 0,
      parseFloat(v.warranty_months)         || 0,
      parseFloat(v.payment_compliance)      / 100,
      parseFloat(v.commitment_pct)          / 100,
      null
    ]);
  });
  const VD_END = aoa.length;
  aoa.push(epad());

  // Section 2: Scoring Weights — label row + value row (numbers, not text)
  const R_S2 = row([0, '  2.  SCORING WEIGHTS  (must total 100)']);
  const R_WL = row(
    [0,'PRICE'], [1,'REQUIREMENTS'], [2,'DELIVERY'], [3,'WARRANTY'],
    [4,'PAYMENT'], [5,'COMMITMENT'], [7,'TOTAL']
  );
  const R_WV = row(
    [0, w.price], [1, w.requirements], [2, w.delivery], [3, w.warranty],
    [4, w.payment], [5, w.commitment],
    [7, w.price + w.requirements + w.delivery + w.warranty + w.payment + w.commitment]
  );
  aoa.push(epad());

  // Section 3: Scores Table — ALL FORMULAS
  const R_S3  = row([0, '  3.  VENDORS SCORES TABLE']);
  const R_SH1 = row(
    [0, 'Vendor Name'],
    [1, `Price Score (W=${w.price})`], [2, `Requirements (W=${w.requirements})`],
    [4, `Delivery (W=${w.delivery})`], [5, `Warranty (W=${w.warranty})`],
    [6, `Payment (W=${w.payment})`],   [7, `Commitment (W=${w.commitment})`],
    [8, 'TOTAL SCORE']
  );
  const R_SH2 = row([2, 'Spec. Component'], [3, 'Install. Component']);

  const COST_R = `B${VD_START}:B${VD_END}`;
  const DEL_R  = `E${VD_START}:E${VD_END}`;
  const WAR_R  = `F${VD_START}:F${VD_END}`;

  const SD_START = aoa.length + 1;
  scored.forEach((v, i) => {
    const vr = VD_START + i;
    const sr = aoa.length + 1;
    aoa.push([
      `=A${vr}`,
      `=(MIN(${COST_R})/B${vr})*${w.price}`,
      `=C${vr}*${halfReq}`,
      `=D${vr}*${halfReq}`,
      `=(MIN(${DEL_R})/E${vr})*${w.delivery}`,
      `=(F${vr}/MAX(${WAR_R}))*${w.warranty}`,
      `=G${vr}*${w.payment}`,
      `=H${vr}*${w.commitment}`,
      `=SUM(B${sr}:H${sr})`,
    ]);
  });
  const SD_END = aoa.length;

  // Score statistics rows
  aoa.push(epad());
  const R_STATS = aoa.length + 1;
  aoa.push([
    'SCORE STATISTICS',
    `=MAX(B${SD_START}:B${SD_END})`, null, null,
    `=MAX(E${SD_START}:E${SD_END})`,
    `=MAX(F${SD_START}:F${SD_END})`,
    `=MAX(G${SD_START}:G${SD_END})`,
    `=MAX(H${SD_START}:H${SD_END})`,
    `=MAX(I${SD_START}:I${SD_END})`,
  ]);
  const R_COST_DIFF = aoa.length + 1;
  aoa.push([
    'COST DIFFERENTIAL',
    null, null, null, null, null, null, null,
    `=MAX(${COST_R})-MIN(${COST_R})`,
  ]);
  aoa.push(epad());

  // Section 4: Winning Bid
  const R_S4 = row([0, '  4.  WINNING BID']);
  const R_WH = row(
    [0, 'Winning Supplier'], [3, 'Total Score'],
    [4, `Total Amount (${currency})`], [7, 'Comment / Recommendation']
  );
  const WIN_ROW = SD_START;
  const R_WD = row(
    [0, `=A${WIN_ROW}`], [3, `=I${WIN_ROW}`],
    [4, `=B${VD_START}`], [7, comp.winner_comment || '']
  );

  // Runner-up row (if multiple vendors)
  let R_RU = null;
  if (scored.length > 1) {
    const RU_SR = SD_START + 1;
    const RU_VR = VD_START + 1;
    R_RU = aoa.length + 1;
    aoa.push([
      `=A${RU_SR}`, null, null,
      `=I${RU_SR}`,
      `=B${RU_VR}`,
      null, null,
      `=B${RU_VR}-B${VD_START}`,
      null
    ]);
  }
  aoa.push(epad());

  // Section 5: Signatures
  const R_S5 = row([0, '  5.  COMMITTEE SIGNATURES']);
  const R_ST = row(
    [0, sigs[0]?.role || 'Head of Committee'], [2, sigs[1]?.role || 'Requester'],
    [4, sigs[2]?.role || 'Requester Management'], [6, sigs[3]?.role || 'Supply Chain Officer'],
    [8, sigs[4]?.role || 'Head of Supply Chain']
  );
  const R_SN = row(
    [0, sigs[0]?.name || ''], [2, sigs[1]?.name || ''],
    [4, sigs[2]?.name || ''], [6, sigs[3]?.name || ''],
    [8, sigs[4]?.name || '']
  );
  const R_SL = row([0,''], [2,''], [4,''], [6,''], [8,'']);
  aoa.push(epad());

  const R_FT = row(
    [0, `${company}  |  Confidential Procurement Document`],
    [5, `PR: ${comp.pr_number||'—'}  |  Generated: ${genDate}`]
  );

  // ── Create worksheet ──────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Fix formula cells — SheetJS needs explicit {t,f}
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < NCOLS; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (typeof cell.v === 'string' && cell.v.startsWith('=')) {
        const fml = cell.v.slice(1);
        ws[addr] = (c === 0 || fml.match(/^A\d+$/))
          ? { t: 's', f: fml, v: '' }
          : { t: 'n', f: fml, v: 0 };
      }
    }
  }

  // Number formats — vendor rows
  for (let r = VD_START - 1; r < VD_END; r++) {
    const fmts = { 1: currFmt, 2:'0.0%', 3:'0.0%', 4:'0', 5:'0', 6:'0.0%', 7:'0.0%' };
    Object.entries(fmts).forEach(([ci, fmt]) => {
      const addr = XLSX.utils.encode_cell({ r, c: parseInt(ci) });
      if (ws[addr]) ws[addr].z = fmt;
    });
  }

  // Number formats — weight value row
  for (let c = 0; c <= 7; c++) {
    const addr = XLSX.utils.encode_cell({ r: R_WV - 1, c });
    if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = '0.0';
  }

  // Number formats — score rows B-I
  for (let r = SD_START - 1; r < SD_END; r++) {
    for (let c = 1; c <= 8; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].z = '0.00';
    }
  }

  // Number formats — stats rows
  for (let c = 1; c <= 8; c++) {
    const a1 = XLSX.utils.encode_cell({ r: R_STATS - 1, c });
    if (ws[a1]) ws[a1].z = '0.00';
  }
  const costDiffAddr = XLSX.utils.encode_cell({ r: R_COST_DIFF - 1, c: 8 });
  if (ws[costDiffAddr]) ws[costDiffAddr].z = currFmt;

  // Total PR Value, winner score+amount
  const prValAddr = XLSX.utils.encode_cell({ r: R7 - 1, c: 5 });
  if (ws[prValAddr]) ws[prValAddr].z = currFmt;
  const wScAddr = XLSX.utils.encode_cell({ r: R_WD - 1, c: 3 });
  const wAmAddr = XLSX.utils.encode_cell({ r: R_WD - 1, c: 4 });
  if (ws[wScAddr]) ws[wScAddr].z = '0.00';
  if (ws[wAmAddr]) ws[wAmAddr].z = currFmt;

  // Runner-up number formats
  if (R_RU) {
    const ruSc = XLSX.utils.encode_cell({ r: R_RU - 1, c: 3 });
    const ruAm = XLSX.utils.encode_cell({ r: R_RU - 1, c: 4 });
    const ruDf = XLSX.utils.encode_cell({ r: R_RU - 1, c: 7 });
    if (ws[ruSc]) ws[ruSc].z = '0.00';
    if (ws[ruAm]) ws[ruAm].z = currFmt;
    if (ws[ruDf]) ws[ruDf].z = currFmt;
  }

  // ── Merged cells ──────────────────────────────────────────────────────────
  const merges = [];
  const addM = (r1, c1, r2, c2) =>
    merges.push({ s: {r: r1-1, c: c1-1}, e: {r: r2-1, c: c2-1} });

  addM(R1,1, R1,9); addM(R2,1, R2,9); addM(R3,1, R3,9);
  [R5,R6,R7,R8].forEach(r => { addM(r,2, r,4); addM(r,6, r,9); });
  [R_S1, R_S2, R_S3, R_S4, R_S5].forEach(r => addM(r,1, r,9));
  addM(R_VH1,3, R_VH1,4);
  addM(R_VH2,1, R_VH2,2); addM(R_VH2,5, R_VH2,9);
  addM(R_WL,8, R_WL,9); addM(R_WV,8, R_WV,9);
  addM(R_SH1,3, R_SH1,4);
  addM(R_SH2,1, R_SH2,2); addM(R_SH2,5, R_SH2,9);
  addM(R_STATS,1, R_STATS,2); addM(R_STATS,3, R_STATS,5);
  addM(R_COST_DIFF,1, R_COST_DIFF,8);
  addM(R_WH,1, R_WH,3); addM(R_WH,5, R_WH,6); addM(R_WH,8, R_WH,9);
  addM(R_WD,1, R_WD,3); addM(R_WD,5, R_WD,6); addM(R_WD,8, R_WD,9);
  if (R_RU) { addM(R_RU,1, R_RU,3); addM(R_RU,6, R_RU,7); }
  const sigCols = [[1,2],[3,4],[5,6],[7,8],[9,9]];
  [R_ST, R_SN, R_SL].forEach(r => {
    sigCols.forEach(([c1,c2]) => { if (c1 !== c2) addM(r,c1,r,c2); });
  });
  addM(R_FT,1, R_FT,5); addM(R_FT,6, R_FT,9);
  ws['!merges'] = merges;

  // ── Column widths ─────────────────────────────────────────────────────────
  ws['!cols'] = [
    {wch:30},{wch:18},{wch:12},{wch:12},
    {wch:11},{wch:11},{wch:11},{wch:11},{wch:14},
  ];

  // ── Row heights ───────────────────────────────────────────────────────────
  ws['!rows'] = [];
  const rh = (r, h) => { ws['!rows'][r-1] = { hpt: h }; };
  rh(R1, 22); rh(R2, 28); rh(R3, 16); rh(R4, 5);
  rh(R5, 17); rh(R6, 17); rh(R7, 17); rh(R8, 17); rh(R9, 6);
  rh(R_S1, 20); rh(R_VH1, 30); rh(R_VH2, 18);
  for (let r = VD_START; r <= VD_END; r++) rh(r, 24);
  rh(R_S2, 20); rh(R_WL, 20); rh(R_WV, 22);
  rh(R_S3, 20); rh(R_SH1, 30); rh(R_SH2, 18);
  for (let r = SD_START; r <= SD_END; r++) rh(r, 22);
  rh(R_STATS, 18); rh(R_COST_DIFF, 18);
  rh(R_S4, 20); rh(R_WH, 22); rh(R_WD, 28);
  if (R_RU) rh(R_RU, 18);
  rh(R_S5, 20); rh(R_ST, 30); rh(R_SN, 22); rh(R_SL, 40); rh(R_FT, 16);

  ws['!freeze'] = { xSplit: 0, ySplit: 4 };

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'Final Bids Comparison', Author: company, Company: company };
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
  XLSX.writeFile(wb, `Comparison_${(comp.pr_number||'PR').replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exported with formulas ✓', 'success');
}

function _exportPDFFromData(comp, scored, sigs) {
  if (!window.jspdf) { showToast('jsPDF not loaded', 'error'); return; }

  const company  = typeof getCompanyName === 'function' ? getCompanyName() : 'Sama Babil';
  const currency = comp.currency || 'IQD';
  const w = {
    price:        parseFloat(comp.w_price        ?? 40),
    requirements: parseFloat(comp.w_requirements ?? 30),
    delivery:     parseFloat(comp.w_delivery     ?? 10),
    warranty:     parseFloat(comp.w_warranty     ?? 10),
    payment:      parseFloat(comp.w_payment      ??  5),
    commitment:   parseFloat(comp.w_commitment   ??  5),
  };
  const nV = scored.length;

  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const ML  = 11, MR = 11, CW = pw - ML - MR;

  // ── Palette ──────────────────────────────────────────────────────────────
  const NAVY   = [10,  18,  55];
  const INDIGO = [37,  58, 150];
  const BLUE   = [55,  90, 205];
  const GREEN  = [8,   95,  55];
  const AMBER  = [160, 105, 10];
  const RED    = [180, 35,  35];
  const VIOLET = [120, 80, 210];
  const LGRAY  = [244, 246, 255];
  const MGRAY  = [220, 226, 245];
  const SIGG   = [232, 236, 255];
  const WHITE  = [255, 255, 255];
  const DARK   = [15,  20,  45];
  const GRAY   = [95, 105, 130];

  const fmtDate  = d => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
    catch { return String(d).split('T')[0]; }
  };
  const fmtMoney = n => {
    const num = parseFloat(n);
    if (isNaN(num)) return '-';
    const dec = currency === 'IQD' ? 0 : 2;
    return `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits:dec, maximumFractionDigits:dec })}`;
  };
  const fmtNum = (n, dec=0) => isNaN(parseFloat(n)) ? '-' :
    parseFloat(n).toLocaleString('en-US', { minimumFractionDigits:dec, maximumFractionDigits:dec });
  const genDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

  let y = 0;

  // ── HEADER BAND ──────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 42, 'F');
  doc.setFillColor(...INDIGO);
  doc.rect(0, 36, pw, 6, 'F');

  // Company top-left
  doc.setTextColor(...VIOLET);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(company.toUpperCase(), ML, 8);

  // Confidential label top-right
  doc.setTextColor(150, 160, 200);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('CONFIDENTIAL - PROCUREMENT', pw - MR, 8, { align:'right' });

  // Main title
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Final Bids Comparison Table', pw/2, 18, { align:'center' });

  // Subtitle
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Equipment & Services - Weighted Procurement Evaluation', pw/2, 25, { align:'center' });

  // Info line in header
  doc.setFontSize(7.5);
  doc.setTextColor(180, 190, 220);
  const metaParts = [
    comp.pr_number       ? `PR: ${comp.pr_number}` : null,
    comp.requesting_dept ? `Dept: ${comp.requesting_dept}` : null,
    comp.request_description || null,
    `Generated: ${genDate}`,
  ].filter(Boolean);
  doc.text(metaParts.join('  |  '), pw/2, 31, { align:'center', maxWidth: CW });

  y = 48;

  // ── INFO CARD ─────────────────────────────────────────────────────────────
  doc.setFillColor(...LGRAY);
  doc.setDrawColor(...MGRAY);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 30, 2, 2, 'FD');

  const ic1 = ML + 4, ic2 = ML + CW/2 + 4;
  const infoRows = [
    ['REQUEST DESCRIPTION', comp.request_description||'-',   'REQUESTING DEPT',  comp.requesting_dept||'-'],
    ['PR NUMBER',           comp.pr_number||'-',              'AWARDING DATE',    fmtDate(comp.awarding_date)],
    ['REQUEST DATE',        fmtDate(comp.request_date),       'TOTAL PR VALUE',   fmtMoney(comp.total_pr_value)],
    ['DELIVERY TERM',       `${comp.delivery_term_days||35} days`, 'WARRANTY TERM', `${comp.warranty_term_months||12} months`],
  ];
  infoRows.forEach((r, i) => {
    const ly = y + 6 + i * 6.5;
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...GRAY);
    doc.text(r[0], ic1, ly);
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text(String(r[1]), ic1, ly + 3.5, { maxWidth: CW/2 - 8 });
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...GRAY);
    doc.text(r[2], ic2, ly);
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text(String(r[3]), ic2, ly + 3.5, { maxWidth: CW/2 - 8 });
  });
  y += 36;

  // ── SECTION HEADER HELPER (full-width colored band) ───────────────────────
  let secNum = 0;
  const sectionHeader = (label, color) => {
    color = color || BLUE;
    if (y > ph - 50) { doc.addPage(); y = 14; }
    secNum++;
    doc.setFillColor(...color);
    doc.rect(ML, y, CW, 9, 'F');
    // Number pill
    doc.setFillColor(...WHITE);
    doc.roundedRect(ML + 2, y + 1.5, 7, 6, 1, 1, 'F');
    doc.setTextColor(...color);
    doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.text(String(secNum), ML + 5.5, y + 5.8, { align:'center' });
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica','bold'); doc.setFontSize(10.5);
    doc.text(label, ML + 13, y + 6.3);
    y += 12;
  };

  // ── 1. VENDORS DATA ───────────────────────────────────────────────────────
  sectionHeader('VENDORS DATA', INDIGO);

  // Weights strip — amber tinted
  doc.setFillColor(255, 248, 220);
  doc.setDrawColor(200, 160, 50);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, y, CW, 7, 1, 1, 'FD');
  doc.setTextColor(...AMBER);
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
  doc.text(
    `WEIGHTS  |  Price: ${w.price}  |  Requirements: ${w.requirements}  |  Delivery: ${w.delivery}  |  Warranty: ${w.warranty}  |  Payment: ${w.payment}  |  Commitment: ${w.commitment}`,
    ML + 3, y + 4.5
  );
  y += 10;

  doc.autoTable({
    startY: y,
    head: [[
      { content:'Vendor', styles:{halign:'left'} },
      { content:`Total Cost\n(${currency})`, styles:{halign:'right'} },
      { content:'Spec\n%', styles:{halign:'center'} },
      { content:'Install\n%', styles:{halign:'center'} },
      { content:'Delivery\n(Days)', styles:{halign:'center'} },
      { content:'Warranty\n(Mo.)', styles:{halign:'center'} },
      { content:'Payment\n%', styles:{halign:'center'} },
      { content:'Commit\n%', styles:{halign:'center'} },
    ]],
    body: scored.map((v, i) => [
      { content: v.vendor_name + (v.annex_ref ? `\n${v.annex_ref}` : ''),
        styles:{ halign:'left', fontStyle:'bold', fontSize:8.5 } },
      { content: fmtMoney(v.total_cost),
        styles:{ halign:'right', fontStyle:'bold', fontSize:8.5,
                 textColor: i === 0 ? [0,120,60] : [160,80,10] } },
      { content:`${fmtNum(v.spec_compliance)}%`,           styles:{halign:'center'} },
      { content:`${fmtNum(v.installation_compliance)}%`,  styles:{halign:'center'} },
      { content:fmtNum(v.delivery_days),                   styles:{halign:'center'} },
      { content:fmtNum(v.warranty_months),                 styles:{halign:'center'} },
      { content:`${fmtNum(v.payment_compliance)}%`,        styles:{halign:'center'} },
      { content:`${fmtNum(v.commitment_pct)}%`,            styles:{halign:'center'} },
    ]),
    headStyles:{
      fillColor:BLUE, textColor:WHITE, fontSize:8, fontStyle:'bold',
      halign:'center', cellPadding:{top:3,bottom:3,left:2,right:2},
      lineWidth:0.3, lineColor:INDIGO,
    },
    bodyStyles:{
      fontSize:8.5, textColor:DARK,
      cellPadding:{top:4,bottom:4,left:3,right:2},
      lineWidth:0.2, lineColor:[190,200,230],
    },
    columnStyles:{
      0:{cellWidth:46}, 1:{cellWidth:27,halign:'right'},
      2:{cellWidth:14,halign:'center'}, 3:{cellWidth:14,halign:'center'},
      4:{cellWidth:16,halign:'center'}, 5:{cellWidth:15,halign:'center'},
      6:{cellWidth:14,halign:'center'}, 7:{cellWidth:14,halign:'center'},
    },
    alternateRowStyles:{ fillColor:LGRAY },
    margin:{left:ML, right:MR},
    tableLineColor:INDIGO, tableLineWidth:0.3,
    didParseCell(d) {
      if (d.section !== 'body') return;
      if (d.row.index === 0) {
        d.cell.styles.fillColor = [220, 252, 231];
        d.cell.styles.textColor = GREEN;
      }
    },
    didDrawCell: data => {
      if (data.section === 'body' && data.column.index === 0) {
        const col = data.row.index === 0 ? GREEN : INDIGO;
        doc.setFillColor(...col);
        doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F');
      }
    },
  });
  y = doc.lastAutoTable.finalY + 6;
  if (y > 210) { doc.addPage(); y = 14; }

  // ── 2. EVALUATION SCORES ──────────────────────────────────────────────────
  sectionHeader('EVALUATION SCORES', BLUE);

  // Legend
  doc.setFillColor(230,255,238); doc.setDrawColor(60,160,80); doc.setLineWidth(0.25);
  doc.roundedRect(ML, y, CW/2 - 2, 6, 1, 1, 'FD');
  doc.setTextColor(0, 120, 60); doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
  doc.text('Best score per column', ML + 3, y + 4);
  doc.setFillColor(255,240,240); doc.setDrawColor(160,50,50);
  doc.roundedRect(ML + CW/2 + 2, y, CW/2 - 2, 6, 1, 1, 'FD');
  doc.setTextColor(170, 40, 40); doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
  doc.text('Lowest score per column', ML + CW/2 + 5, y + 4);
  y += 9;

  const scoreKeys = ['price_score','requirements_score','delivery_score',
                     'warranty_score','payment_score','commitment_score','total_score'];
  const colMaxV = scoreKeys.map(k => Math.max(...scored.map(s => parseFloat(s[k]||0))));
  const colMinV = scoreKeys.map(k => Math.min(...scored.map(s => parseFloat(s[k]||0))));

  doc.autoTable({
    startY: y,
    head: [[
      { content:'Vendor', styles:{halign:'left'} },
      { content:`Price\n(${w.price})`,          styles:{halign:'center'} },
      { content:`Req.\n(${w.requirements})`,     styles:{halign:'center'} },
      { content:`Del.\n(${w.delivery})`,         styles:{halign:'center'} },
      { content:`War.\n(${w.warranty})`,         styles:{halign:'center'} },
      { content:`Pay.\n(${w.payment})`,          styles:{halign:'center'} },
      { content:`Com.\n(${w.commitment})`,       styles:{halign:'center'} },
      { content:'TOTAL',  styles:{halign:'center', fontStyle:'bold'} },
      { content:'Rank',   styles:{halign:'center'} },
    ]],
    body: scored.map((v, ri) => [
      { content:(ri===0 ? '#1  ' : '') + v.vendor_name + (v.annex_ref ? '\n'+v.annex_ref : ''),
        styles:{halign:'left', fontStyle:'bold', fontSize:8.5} },
      { content:fmtNum(v.price_score,2),        styles:{halign:'center'} },
      { content:fmtNum(v.requirements_score,2), styles:{halign:'center'} },
      { content:fmtNum(v.delivery_score,2),     styles:{halign:'center'} },
      { content:fmtNum(v.warranty_score,2),     styles:{halign:'center'} },
      { content:fmtNum(v.payment_score,2),      styles:{halign:'center'} },
      { content:fmtNum(v.commitment_score,2),   styles:{halign:'center'} },
      { content:fmtNum(v.total_score,2), styles:{halign:'center', fontStyle:'bold'} },
      { content:`#${ri+1}`,              styles:{halign:'center'} },
    ]),
    headStyles:{
      fillColor:BLUE, textColor:WHITE, fontSize:8, fontStyle:'bold',
      halign:'center', cellPadding:{top:3,bottom:3,left:2,right:2},
      lineWidth:0.3, lineColor:INDIGO,
    },
    bodyStyles:{
      fontSize:8.5, textColor:DARK, halign:'center',
      cellPadding:{top:4,bottom:4,left:2,right:2},
      lineWidth:0.2, lineColor:[190,200,230],
    },
    columnStyles:{ 0:{cellWidth:48, halign:'left'}, 7:{fontStyle:'bold'} },
    alternateRowStyles:{ fillColor:LGRAY },
    margin:{left:ML, right:MR},
    tableLineColor:INDIGO, tableLineWidth:0.3,
    didParseCell: data => {
      if (data.section !== 'body') return;
      const ri = data.row.index, ci = data.column.index;
      if (ri === 0) {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.textColor = GREEN;
        return;
      }
      if (ci >= 1 && ci <= 6 && nV > 1) {
        const ki  = ci - 1;
        const val = parseFloat(scored[ri][scoreKeys[ki]] || 0);
        const mx  = colMaxV[ki], mn = colMinV[ki];
        if (Math.abs(mx - mn) > 0.001) {
          if (Math.abs(val - mx) < 0.001) {
            data.cell.styles.textColor = [0, 130, 60];
            data.cell.styles.fontStyle = 'bold';
          } else if (Math.abs(val - mn) < 0.001) {
            data.cell.styles.textColor = [180, 30, 30];
          }
        }
      }
      if (ci === 7) data.cell.styles.fontStyle = 'bold';
      if (ci === 8) data.cell.styles.textColor = GRAY;
    },
    didDrawCell: data => {
      if (data.section === 'body' && data.column.index === 0) {
        const col = data.row.index === 0 ? GREEN : INDIGO;
        doc.setFillColor(...col);
        doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F');
      }
    },
  });

  // Score summary strip
  const ft = doc.lastAutoTable.finalY;
  doc.setFillColor(235, 238, 255);
  doc.setDrawColor(...INDIGO);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, ft + 3, CW, 8, 1, 1, 'FD');
  doc.setTextColor(...INDIGO);
  doc.setFont('helvetica','bold'); doc.setFontSize(7);
  const topScore = fmtNum(scored[0]?.total_score || 0, 2);
  const costVals = scored.map(s => parseFloat(s.total_cost || 0));
  const costSpread = costVals.length > 1 ? Math.abs(Math.max(...costVals) - Math.min(...costVals)) : 0;
  doc.text(
    `Winner: ${scored[0]?.vendor_name || '-'}  |  Score: ${topScore} / 100  |  Cost spread: ${fmtMoney(costSpread)}`,
    ML + 3, ft + 7.5
  );
  y = ft + 14;
  if (y > 210) { doc.addPage(); y = 14; }

  // ── 3. WINNING BID ────────────────────────────────────────────────────────
  sectionHeader('WINNING BID', GREEN);

  const winV    = scored[0] || {};
  const runnerV = scored[1] || null;
  const winName = comp.winner_vendor || winV.vendor_name || '-';

  const cardH = runnerV ? 34 : 24;
  doc.setFillColor(220, 252, 231);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, cardH, 3, 3, 'FD');

  // Circle #1 badge
  doc.setFillColor(...GREEN);
  doc.circle(ML + 14, y + 12, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text('#1', ML + 14, y + 15.5, { align:'center' });

  // Vendor name + details
  const wx = ML + 27;
  doc.setTextColor(5, 60, 35);
  doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text('AWARDED VENDOR', wx, y + 7);
  doc.setFontSize(14);
  doc.text(winName, wx, y + 16, { maxWidth: pw - MR - 60 - wx });

  // Score + amount (right side)
  const rx = pw - MR - 4;
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
  doc.setTextColor(60, 100, 70);
  doc.text('TOTAL SCORE', rx, y + 6, { align:'right' });
  doc.setFontSize(22); doc.setTextColor(...GREEN);
  doc.text(fmtNum(winV.total_score || 0, 2), rx, y + 16, { align:'right' });
  doc.setFontSize(7.5); doc.setTextColor(60, 100, 70);
  doc.text('CONTRACT AMOUNT', rx, y + 20, { align:'right' });
  doc.setFontSize(10); doc.setTextColor(...DARK);
  doc.text(fmtMoney(winV.total_cost || 0), rx, y + 26, { align:'right' });

  if (runnerV) {
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.3);
    doc.line(ML + 4, y + cardH - 12, ML + CW - 4, y + cardH - 12);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(60, 100, 70);
    doc.text(
      `Runner-Up:  ${runnerV.vendor_name || '-'}  |  Score: ${fmtNum(runnerV.total_score || 0, 2)}  |  Cost: ${fmtMoney(runnerV.total_cost || 0)}`,
      ML + 6, y + cardH - 5
    );
  }
  y += cardH + 6;

  // Comment box if present
  if (comp.winner_comment) {
    doc.setFillColor(245, 248, 255);
    doc.setDrawColor(180, 195, 235);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, 12, 1, 1, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text('RECOMMENDATION', ML + 4, y + 5);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...DARK);
    const cLines = doc.splitTextToSize(comp.winner_comment, CW - 8);
    doc.text(cLines.slice(0, 2), ML + 4, y + 9);
    y += 16;
  }

  if (y > 210) { doc.addPage(); y = 14; }

  // ── 4. COMMITTEE SIGNATURES ───────────────────────────────────────────────
  sectionHeader('COMMITTEE SIGNATURES', [70, 80, 170]);

  const sigW = CW / Math.min(sigs.length || 5, 5);
  const renderSigTable = (cols, startY) => {
    doc.autoTable({
      startY,
      head: [cols.map(s => ({
        content: s.role || '-',
        styles: { halign:'center', fontStyle:'bold', fontSize:7.5 },
      }))],
      body: [
        cols.map(s => ({
          content: s.name || '',
          styles: { halign:'center', fontSize:9, fontStyle: s.name ? 'bold' : 'normal' },
        })),
        Array(cols.length).fill({ content:'', styles:{ minCellHeight:18 } }),
        Array(cols.length).fill({
          content:'________________________',
          styles:{ halign:'center', textColor:[180,185,200], fontSize:8 },
        }),
      ],
      headStyles:{
        fillColor:SIGG, textColor:DARK, fontSize:7.5, fontStyle:'bold',
        halign:'center', cellPadding:{top:4,bottom:4,left:2,right:2},
        lineWidth:0.2, lineColor:[180,190,220],
      },
      bodyStyles:{
        textColor:DARK, cellPadding:{top:3,bottom:3,left:2,right:2},
        lineWidth:0.2, lineColor:[180,190,220],
      },
      columnStyles: Object.fromEntries(cols.map((_,i) => [i, { cellWidth: sigW }])),
      margin:{left:ML, right:MR},
      tableLineColor:[180,190,220], tableLineWidth:0.2,
    });
  };

  renderSigTable(sigs.slice(0, 5), y);
  if (sigs.length > 5) {
    renderSigTable(sigs.slice(5), doc.lastAutoTable.finalY + 5);
  }

  // ── FOOTER ON ALL PAGES ───────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...INDIGO); doc.setLineWidth(0.5);
    doc.line(ML, ph - 12, pw - MR, ph - 12);
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...VIOLET);
    doc.text(company, ML, ph - 7.5);
    doc.setTextColor(...GRAY); doc.setFont('helvetica','normal');
    doc.text(`PR: ${comp.pr_number || '-'}  |  Confidential Procurement Document`, pw/2, ph - 7.5, { align:'center' });
    doc.text(`${i} / ${totalPages}`, pw - MR, ph - 7.5, { align:'right' });
  }

  doc.save(`Comparison_${(comp.pr_number||'PR').replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().split('T')[0]}.pdf`);
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
  const scored = scoreVendors(vds, w);
  const sigs   = _sigsFromComp(comp);
  _exportExcelFromData(comp, scored, sigs);
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
