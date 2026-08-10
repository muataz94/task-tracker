// ─── Budget Control ──────────────────────────────────────────────────────────

let _allBudgets   = [];
let _editingBudgetId = null;

const BUDGET_CURRENCIES = ['IQD', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];

function budgetPct(b) {
  const total = parseFloat(b.total_budget || 0);
  const spent = parseFloat(b.spent || 0);
  return total > 0 ? Math.round((spent / total) * 100) : 0;
}

function budgetColor(pct) {
  return pct >= 90 ? 'var(--accent-red)' : pct >= 75 ? 'var(--accent-amber)' : 'var(--accent-green)';
}

async function loadBudgets() {
  const wrap = document.getElementById('budget-wrap');
  if (!wrap) return;

  wrap.innerHTML = `<div id="budget-alert-banner"></div><div id="budget-grid"></div>`;

  try {
    const res    = await callAPI('getBudgets');
    _allBudgets  = res.rows || [];
    renderBudgetAlertBanner();
    renderBudgetGrid();
  } catch(e) {
    document.getElementById('budget-grid').innerHTML =
      `<div style="padding:2rem;text-align:center;color:var(--accent-red);">Failed to load budgets: ${escapeHtml(e.message)}</div>`;
  }
}

function renderBudgetAlertBanner() {
  const el = document.getElementById('budget-alert-banner');
  if (!el) return;
  const alerting = _allBudgets.filter(b => budgetPct(b) >= 75);
  if (!alerting.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="glass" style="border-radius:var(--r-md);padding:0.85rem 1rem;margin-bottom:1rem;
      border-left:3px solid var(--accent-amber);">
      <div style="font-size:12px;font-weight:600;color:var(--text-1);">⚠️ ${alerting.length} budget${alerting.length!==1?'s':''} at or above 75% utilization</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">
        ${alerting.map(b => `${escapeHtml(b.department)} (${budgetPct(b)}%)`).join(', ')}
      </div>
    </div>`;
}

function renderBudgetGrid() {
  const grid = document.getElementById('budget-grid');
  if (!grid) return;
  if (!_allBudgets.length) {
    grid.innerHTML = '<div class="glass" style="border-radius:var(--r-md);padding:2rem;text-align:center;color:var(--text-3);">No budgets set up yet. Click "+ New Budget" to add one.</div>';
    return;
  }
  grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
    ${_allBudgets.map(b => renderBudgetCard(b)).join('')}
  </div>`;
}

function renderBudgetCard(b) {
  const pct   = budgetPct(b);
  const color = budgetColor(pct);
  const total = parseFloat(b.total_budget||0);
  const spent = parseFloat(b.spent||0);
  const cur   = b.currency || 'IQD';
  return `
    <div class="glass-card" style="border-radius:var(--r-md);padding:1rem;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text-1);">${escapeHtml(b.department||'—')}</div>
          <div style="font-size:11px;color:var(--text-3);">FY ${escapeHtml(b.fiscal_year||'—')}${b.cost_center?' · '+escapeHtml(b.cost_center):''}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button onclick="showBudgetModal('${b.id}')" title="Edit" style="background:var(--glass-bg);border:1px solid var(--border);color:var(--text-3);width:26px;height:26px;border-radius:8px;cursor:pointer;">✎</button>
          <button onclick="deleteBudgetById('${b.id}')" title="Delete" style="background:var(--glass-bg);border:1px solid var(--border);color:var(--accent-red);width:26px;height:26px;border-radius:8px;cursor:pointer;">✕</button>
        </div>
      </div>
      <div style="font-size:22px;font-weight:800;color:${color};">${pct}%</div>
      <div style="height:6px;background:var(--border);border-radius:3px;margin:6px 0 10px;overflow:hidden;">
        <div style="height:100%;width:${Math.min(pct,100)}%;background:${color};transition:width 0.6s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);">
        <span>Spent: ${cur} ${spent.toLocaleString()}</span>
        <span>Total: ${cur} ${total.toLocaleString()}</span>
      </div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Remaining: ${cur} ${(total-spent).toLocaleString()}</div>
    </div>`;
}

function getBudgetDepartmentOptions() {
  const seen = new Set();
  const opts = [];
  ((typeof tableData !== 'undefined' && tableData['POs']) || []).forEach(p => { if (p.category) seen.add(p.category); });
  ((typeof _allPRs !== 'undefined' && _allPRs) || []).forEach(p => { if (p.department) seen.add(p.department); });
  seen.forEach(v => opts.push(v));
  return opts;
}

function showBudgetModal(id) {
  _editingBudgetId = id;
  const b = id ? (_allBudgets.find(x => x.id === id) || {}) : {};
  const isEdit = !!id;
  const deptOptions = getBudgetDepartmentOptions();

  const html = `
    <div id="budget-modal-overlay" onclick="closeBudgetModal()" style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.52);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:1rem;animation:overlayFadeIn 0.2s ease;">
      <div onclick="event.stopPropagation()" style="position:relative;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;border-radius:var(--r-lg);padding:1.5rem;background:var(--glass-bg-strong);backdrop-filter:var(--glass-blur);border:1px solid var(--border);box-shadow:0 24px 64px rgba(0,0,0,0.45);animation:modalSpringIn var(--dur-enter) var(--spring-bounce) both;">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">
          <div>
            <h2 style="font-size:17px;font-weight:700;color:var(--text-1);">${isEdit?'Edit Budget':'New Budget'}</h2>
            <p style="font-size:12px;color:var(--text-3);margin-top:2px;">${isEdit?`Editing ${escapeHtml(b.department||id)}`:'Set up an annual departmental budget'}</p>
          </div>
          <button onclick="closeBudgetModal()" style="background:var(--glass-bg);border:1px solid var(--border);color:var(--text-3);width:30px;height:30px;border-radius:var(--r-sm);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;font-family:Inter,sans-serif;">✕</button>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label>Department *</label>
          <input id="bdg-f-dept" list="bdg-dept-list" type="text" placeholder="e.g. Finance" value="${escapeHtml(b.department||'')}"/>
          <datalist id="bdg-dept-list">${deptOptions.map(d=>`<option value="${escapeAttr(d)}"></option>`).join('')}</datalist>
        </div>

        <div class="form-grid" style="margin-bottom:12px;">
          <div class="form-group"><label>Fiscal Year *</label><input id="bdg-f-year" type="number" min="2000" max="2100" step="1" required placeholder="${new Date().getFullYear()}" value="${escapeHtml(b.fiscal_year||String(new Date().getFullYear()))}"/></div>
          <div class="form-group"><label>Cost Center</label><input id="bdg-f-cc" type="text" placeholder="e.g. CC-100" value="${escapeHtml(b.cost_center||'')}"/></div>
        </div>

        <div class="form-grid" style="margin-bottom:12px;">
          <div class="form-group"><label>Total Budget *</label><input id="bdg-f-total" type="number" min="0" step="any" placeholder="0" value="${b.total_budget||''}"/></div>
          <div class="form-group"><label>Currency</label>
            <select id="bdg-f-currency" class="pref-select" style="width:100%;">${BUDGET_CURRENCIES.map(c=>`<option value="${c}" ${(b.currency||'IQD')===c?'selected':''}>${c}</option>`).join('')}</select>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn-export" onclick="closeBudgetModal()">Cancel</button>
          <button class="btn-primary" onclick="submitBudgetForm()">${isEdit?'Save Changes':'Create Budget'}</button>
        </div>

      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function closeBudgetModal() {
  document.getElementById('budget-modal-overlay')?.remove();
  _editingBudgetId = null;
}

async function submitBudgetForm() {
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const formRoot = document.getElementById('budget-modal-overlay');
  if (typeof formV4Validate === 'function' && !formV4Validate(formRoot)) return;
  const department = g('bdg-f-dept');
  const fiscalYear  = g('bdg-f-year');
  const totalBudget = g('bdg-f-total');
  if (!department)  { showToast('Department is required', 'error'); return; }
  if (!fiscalYear)  { showToast('Fiscal year is required', 'error'); return; }
  if (!totalBudget) { showToast('Total budget is required', 'error'); return; }

  const payload = {
    department, fiscal_year: fiscalYear,
    total_budget: totalBudget,
    currency: g('bdg-f-currency') || 'IQD',
    cost_center: g('bdg-f-cc'),
  };

  const btn = document.querySelector('#budget-modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    if (_editingBudgetId) {
      payload.id = _editingBudgetId;
      await callAPI('updateBudget', payload);
      const idx = _allBudgets.findIndex(x => x.id === _editingBudgetId);
      if (idx !== -1) Object.assign(_allBudgets[idx], payload);
      showToast('Budget updated ✓', 'success');
    } else {
      const res = await callAPI('saveBudget', payload);
      payload.id = res.id; payload.spent = 0; payload.status = 'Active';
      _allBudgets.unshift(payload);
      showToast('Budget created ✓', 'success');
    }
    closeBudgetModal();
    renderBudgetAlertBanner();
    renderBudgetGrid();
  } catch(e) {
    showToast(typeof formV4FriendlyError === 'function' ? formV4FriendlyError(e) : t('form_save_failed'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = _editingBudgetId ? 'Save Changes' : 'Create Budget'; }
  }
}

async function deleteBudgetById(id) {
  if (!confirm('Delete this budget?')) return;
  try {
    await callAPI('deleteBudget', { id });
    _allBudgets = _allBudgets.filter(b => b.id !== id);
    renderBudgetAlertBanner();
    renderBudgetGrid();
    showToast('Budget deleted', 'success');
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// Called from PR/PO forms before saving, to warn on budget overruns
async function checkDeptBudget(department, amount) {
  if (!department || !amount) return null;
  try {
    return await callAPI('checkBudget', { department, amount });
  } catch(e) { return null; }
}
