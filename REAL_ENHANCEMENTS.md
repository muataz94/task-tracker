# Task Tracker — Enhancement Plan (grounded in actual codebase)
# Claude Code (VS Code): This plan was written after reading the real
# Code.gs, index.html, tables.js, dashboard.js, invoices.js, vendors.js,
# purchasereqs.js, quotations.js, cache.js, api.js, messaging.js, kanban.js,
# chat.js, ai-chat.js, i18n.js, style.css in full.
#
# DO NOT recreate anything listed under "ALREADY BUILT — DO NOT TOUCH".
# Read the actual files yourself before starting each phase — this doc
# references real function/column names but line numbers may have shifted.
# Test each phase before moving to the next. List every file modified.

---

## ALREADY BUILT — DO NOT RECREATE

- `Tasks` sheet is real and configured (`SHEET_FIELDS.Tasks` in tables.js)
- Generic CRUD: `addRow/updateRow/deleteRow(sheet, id, data)` works on any sheet with an `id` column (Code.gs)
- Per-entity backends with `ensureXSheet()` pattern: `ensureInvoicesSheet`, `ensureVendorsSheet`, `ensurePRSheets` — `ensureInvoicesSheet` already auto-adds missing columns to existing sheets, the other two do not (fix in Phase 1)
- PR ↔ PO: `createPOFromPR()`, PO form has `initPOPRDropdown()` / `onPOPRRefSelect()`, `initPOComparisonDropdown()` / `onPOComparisonSelect()` (all in vendors.js / tables.js)
- Auto-invoice from PO: `autoCreateInvoiceFromPO()` (tables.js, called from PO submit handler)
- Partial payment: `quickMarkPartial()`, `updateInvRemaining()`, `amount_paid` column already in `ensureInvoicesSheet()` headers
- PR line items: `renderPRLineItemsForm()`, `addPRLineItem()`, `removePRLineItem()`, `updatePRTotal()` (purchasereqs.js) — already styled to match app
- Owner permissions: `OWNER_EMAIL = 'muatazthaaer@gmail.com'`, `isOwner()`, `isAdmin()`, full `#view-permissions` tab, `getUserPermissions`/`updateUserPermissions` actions
- Vendor cross-tab: `getVendorOptionsHTML()`, `getVendorContactInfo()`, `onPOVendorSelect()`, `onInvVendorSelect()`, `renderVendorCell()`
- Messaging: `renderMsgButtons()`, `showComposeModal()` already wired into invoice/PO/task rows via `messaging.js`
- Browser notifications for overdue Tasks/POs: `requestNotifPermission()`, `updateNotifBtn()` (dashboard.js) — uses native `Notification` API, foreground only
- Mobile: `toggleSidebar()`, `#sidebar-overlay`, `.hamburger-btn`, 20 `@media` breakpoints in style.css
- Quotation exports: `_exportExcelFromData()`, `_exportPDFFromData()` — full formulas, styling, committee signatures
- Dashboard panels: Invoice Summary (`#inv-dash-panel`), PR Summary (inline in dashboard view), Vendor Summary (`#vnd-dash-panel`), `renderActivityFeed()` (task/expense-derived, client-side)
- Monthly budget: `renderBudgetTracker()` — single flat number in `localStorage.tt_budget`, Expenses tab only (Phase 6 replaces this with real per-department budgets)
- AI Chat: full `ai-chat.js`, floating FAB at `bottom:5rem; right:1.5rem; z-index:150`

**Real Google Sheets:** Tasks, POs, Milestones, Expenses, Users, Chat, Comparisons, ComparisonVendors, Invoices, Vendors, PurchaseRequests, PRLineItems

**Real script load order (index.html):** i18n.js → config.js → cache.js → api.js → tables.js → dashboard.js → kanban.js → chat.js → quotations.js → invoices.js → vendors.js → messaging.js → purchasereqs.js → ai-chat.js → inline script

---

## PHASE 1 — Backend foundation (Code.gs)

### 1A. Generic column-adder (new, small, reusable)

```javascript
function addColumnsIfMissing(sheetName, columnNames) {
  const sh = getSpreadsheet().getSheetByName(sheetName);
  if (!sh) return;
  const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  columnNames.forEach(col => {
    if (!existing.includes(col)) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
      existing.push(col);
    }
  });
}
```

### 1B. Upgrade `ensureVendorsSheet()` and `ensurePRSheets()`

Both currently only create the sheet if missing — they don't backfill columns on
existing sheets (unlike `ensureInvoicesSheet`, which already does this). Add the
same auto-add-missing-columns block used in `ensureInvoicesSheet` to both.

### 1C. New columns on existing sheets — call once via a setup action

```javascript
function setupPhase1Columns() {
  addColumnsIfMissing('Tasks', ['dependency_ids','recurring','time_logged_minutes','subtasks_json']);
  addColumnsIfMissing('POs',   ['received_quantity','amendment_log']);
  addColumnsIfMissing('Invoices', ['recurring','recurring_day']); // amount_paid already exists
  addColumnsIfMissing('Vendors', ['performance_score','total_spend','blacklist_reason','contract_expiry']);
  addColumnsIfMissing('PurchaseRequests', ['approval_stage','dept_head_approval','finance_approval','gm_approval','aging_notified']);
  // budget_code already exists on PurchaseRequests — do NOT re-add
}
```

Add to doPost switch: `case 'setupPhase1Columns': setupPhase1Columns(); return respond({success:true});`
Call this ONCE from the browser console or a temporary button, then remove the call.

### 1D. New sheets — Budgets, Notifications, AuditLog

Follow the exact `ensureInvoicesSheet()` pattern (create-if-missing + auto-add-columns):

```javascript
function ensureBudgetsSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('Budgets');
  const headers = ['id','department','fiscal_year','total_budget','spent',
    'currency','cost_center','status','created_at','created_by','updated_at'];
  if (!sh) {
    sh = ss.insertSheet('Budgets');
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    headers.forEach(h => { if (!existing.includes(h)) sh.getRange(1, sh.getLastColumn()+1).setValue(h); });
  }
  return sh;
}

function ensureNotificationsSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('Notifications');
  const headers = ['id','user_email','type','title','message','link','read','created_at'];
  if (!sh) {
    sh = ss.insertSheet('Notifications');
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureAuditSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('AuditLog');
  const headers = ['id','timestamp','user_email','action','sheet','record_id','summary'];
  if (!sh) {
    sh = ss.insertSheet('AuditLog');
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}
```

### 1E. New actions — add to doPost switch

```javascript
case 'getBudgets':       return respond(getBudgets());
case 'saveBudget':       return respond(saveBudget(body));
case 'updateBudget':     return respond(updateBudget(body));
case 'deleteBudget':     return respond(deleteBudget(body.id));
case 'checkBudget':      return respond(checkBudget(body.department, body.amount));

case 'getNotifications': return respond(getNotifications(body.email));
case 'createNotif':      return respond(createNotification(body));
case 'markNotifRead':    return respond(markNotifRead(body.id));
case 'markAllNotifsRead':return respond(markAllNotifsRead(body.email));

case 'logAudit':         return respond(logAudit(body));
case 'getAuditLog':      return respond(getAuditLog(body.sheet, body.record_id));

case 'globalSearch':     return respond(globalSearch(body.query));

case 'rateVendor':       return respond(rateVendor(body.vendor_id, body.scores));
case 'getVendorSpend':   return respond(getVendorSpend(body.vendor_name));

case 'getInvoiceAging':  return respond(getInvoiceAging());
case 'saveUserTheme':    return respond(saveUserTheme(body.email, body.theme));
```

### 1F. Implement the functions

```javascript
// ── BUDGETS ──────────────────────────────────────────────────────
function getBudgets() {
  ensureBudgetsSheet();
  const sh = getSpreadsheet().getSheetByName('Budgets');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  const headers = data[0];
  const rows = data.slice(1).map(r => { const o={}; headers.forEach((h,i)=>o[h]=String(r[i]||'')); return o; }).filter(r=>r.id);
  return { rows };
}

function saveBudget(data) {
  ensureBudgetsSheet();
  const sh = getSpreadsheet().getSheetByName('Budgets');
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const id = 'BDG-' + Date.now();
  const now = new Date().toISOString();
  if (!data.spent) data.spent = 0;
  if (!data.status) data.status = 'Active';
  const rowObj = Object.assign({ id, created_at: now, updated_at: now }, data);
  sh.appendRow(headers.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
  return { success: true, id };
}

function updateBudget(data) {
  const sh = getSpreadsheet().getSheetByName('Budgets');
  if (!sh) return { error: 'Not found' };
  const allData = sh.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');
  const rowIdx = allData.findIndex((r,i) => i>0 && String(r[idCol])===String(data.id));
  if (rowIdx === -1) return { error: 'Not found' };
  data.updated_at = new Date().toISOString();
  headers.forEach((h,ci) => { if (data[h]!==undefined) sh.getRange(rowIdx+1,ci+1).setValue(data[h]); });
  return { success: true };
}

function deleteBudget(id) {
  const sh = getSpreadsheet().getSheetByName('Budgets');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const idCol = data[0].indexOf('id');
  const idx = data.findIndex((r,i) => i>0 && String(r[idCol])===String(id));
  if (idx === -1) return { error: 'Not found' };
  sh.deleteRow(idx+1);
  return { success: true };
}

function checkBudget(department, amount) {
  const budgets = getBudgets().rows || [];
  const year = String(new Date().getFullYear());
  const dept = budgets.find(b => b.department === department && b.fiscal_year === year);
  if (!dept) return { available: true, message: 'No budget set for this department' };
  const total = parseFloat(dept.total_budget||0);
  const spent = parseFloat(dept.spent||0);
  const amt   = parseFloat(amount||0);
  const pctAfter = total > 0 ? ((spent+amt)/total)*100 : 0;
  return {
    available: (spent+amt) <= total,
    total, spent, remaining: total-spent, pct_after: pctAfter,
    alert_level: pctAfter>=100 ? 'exceeded' : pctAfter>=90 ? 'critical' : pctAfter>=75 ? 'warning' : 'ok'
  };
}

// ── NOTIFICATIONS ────────────────────────────────────────────────
function createNotification(data) {
  ensureNotificationsSheet();
  const sh = getSpreadsheet().getSheetByName('Notifications');
  const id = 'NTF-' + Date.now();
  sh.appendRow([id, data.user_email||'all', data.type||'info', data.title||'',
    data.message||'', data.link||'', 'false', new Date().toISOString()]);
  return { success: true, id };
}

function getNotifications(email) {
  ensureNotificationsSheet();
  const sh = getSpreadsheet().getSheetByName('Notifications');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  const headers = data[0];
  const rows = data.slice(1)
    .map(r => { const o={}; headers.forEach((h,i)=>o[h]=String(r[i]||'')); return o; })
    .filter(r => r.id && (!email || r.user_email===email || r.user_email==='all'))
    .sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
    .slice(0,50);
  return { rows };
}

function markNotifRead(id) {
  const sh = getSpreadsheet().getSheetByName('Notifications');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id'), readCol = headers.indexOf('read');
  const idx = data.findIndex((r,i) => i>0 && String(r[idCol])===String(id));
  if (idx === -1) return { error: 'Not found' };
  sh.getRange(idx+1, readCol+1).setValue('true');
  return { success: true };
}

function markAllNotifsRead(email) {
  const sh = getSpreadsheet().getSheetByName('Notifications');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('user_email'), readCol = headers.indexOf('read');
  data.forEach((r,i) => {
    if (i>0 && (r[emailCol]===email || r[emailCol]==='all')) sh.getRange(i+1, readCol+1).setValue('true');
  });
  return { success: true };
}

// ── AUDIT LOG ────────────────────────────────────────────────────
function logAudit(data) {
  try {
    ensureAuditSheet();
    const sh = getSpreadsheet().getSheetByName('AuditLog');
    sh.appendRow(['AUD-'+Date.now(), new Date().toISOString(),
      data.user_email||'', data.action||'', data.sheet||'', data.record_id||'', data.summary||'']);
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

function getAuditLog(sheetName, recordId) {
  ensureAuditSheet();
  const sh = getSpreadsheet().getSheetByName('AuditLog');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  const headers = data[0];
  const rows = data.slice(1)
    .map(r => { const o={}; headers.forEach((h,i)=>o[h]=String(r[i]||'')); return o; })
    .filter(r => (!sheetName || r.sheet===sheetName) && (!recordId || r.record_id===recordId))
    .sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))
    .slice(0,200);
  return { rows };
}

// ── GLOBAL SEARCH ────────────────────────────────────────────────
function globalSearch(query) {
  if (!query || String(query).length < 2) return { results: [] };
  const q = String(query).toLowerCase();
  const results = [];
  const sheets = ['Tasks','POs','Invoices','PurchaseRequests','Vendors','Comparisons','Milestones','Expenses'];
  sheets.forEach(sheetName => {
    try {
      const sh = getSpreadsheet().getSheetByName(sheetName);
      if (!sh) return;
      const data = sh.getDataRange().getValues();
      if (data.length < 2) return;
      const headers = data[0];
      data.slice(1).forEach(row => {
        const combined = row.join(' ').toLowerCase();
        if (combined.includes(q)) {
          const obj = {}; headers.forEach((h,i) => obj[h]=String(row[i]||''));
          results.push({
            sheet: sheetName, id: obj.id||'',
            title: obj.title || obj.po_number || obj.invoice_number || obj.pr_number ||
                   obj.vendor_name || obj.milestone_name || obj.category || '',
          });
        }
      });
    } catch(e) {}
  });
  return { results: results.slice(0, 30) };
}

// ── VENDOR RATING + SPEND ────────────────────────────────────────
function rateVendor(vendorId, scores) {
  const sh = getSpreadsheet().getSheetByName('Vendors');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id'), scoreCol = headers.indexOf('performance_score');
  const rowIdx = data.findIndex((r,i) => i>0 && String(r[idCol])===String(vendorId));
  if (rowIdx === -1) return { error: 'Vendor not found' };
  const avg = (parseFloat(scores.delivery||0)+parseFloat(scores.quality||0)+parseFloat(scores.price||0))/3;
  const existing = parseFloat(data[rowIdx][scoreCol]||0);
  const newScore = existing > 0 ? (existing+avg)/2 : avg;
  sh.getRange(rowIdx+1, scoreCol+1).setValue(newScore.toFixed(1));
  return { success: true, score: newScore };
}

function getVendorSpend(vendorName) {
  let total = 0;
  ['POs','Invoices'].forEach(sheetName => {
    const sh = getSpreadsheet().getSheetByName(sheetName);
    if (!sh) return;
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return;
    const headers = data[0];
    const vendorCol = headers.indexOf(sheetName==='POs' ? 'supplier' : 'vendor');
    const amtCol = headers.indexOf(sheetName==='POs' ? 'total_value' : 'amount');
    if (vendorCol<0 || amtCol<0) return;
    data.slice(1).forEach(r => {
      if (String(r[vendorCol]).toLowerCase() === String(vendorName).toLowerCase()) {
        total += parseFloat(r[amtCol]) || 0;
      }
    });
  });
  // Write back to vendor row
  const sh = getSpreadsheet().getSheetByName('Vendors');
  if (sh) {
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    const nameCol = headers.indexOf('vendor_name'), spendCol = headers.indexOf('total_spend');
    const rowIdx = data.findIndex((r,i) => i>0 && String(r[nameCol]).toLowerCase()===String(vendorName).toLowerCase());
    if (rowIdx > -1 && spendCol > -1) sh.getRange(rowIdx+1, spendCol+1).setValue(total);
  }
  return { total_spend: total };
}

// ── INVOICE AGING ────────────────────────────────────────────────
function getInvoiceAging() {
  const sh = getSpreadsheet().getSheetByName('Invoices');
  if (!sh) return { buckets: { current:[], d30:[], d60:[], d90:[] } };
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { buckets: { current:[], d30:[], d60:[], d90:[] } };
  const headers = data[0];
  const today = new Date(); today.setHours(0,0,0,0);
  const buckets = { current: [], d30: [], d60: [], d90: [] };
  data.slice(1).forEach(row => {
    const obj = {}; headers.forEach((h,i) => obj[h]=String(row[i]||''));
    if (obj.status==='Paid' || obj.status==='Cancelled') return;
    const due = new Date(obj.due_date);
    if (isNaN(due)) return;
    const days = Math.floor((today-due)/86400000);
    if (days <= 0) buckets.current.push(obj);
    else if (days <= 30) buckets.d30.push(obj);
    else if (days <= 60) buckets.d60.push(obj);
    else buckets.d90.push(obj);
  });
  return { buckets };
}

// ── THEME TO SERVER (Users sheet, keyed by email — not id) ───────
function saveUserTheme(email, theme) {
  const sh = getSpreadsheet().getSheetByName('Users');
  if (!sh) return { error: 'Users sheet not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('email');
  let themeCol = headers.indexOf('theme');
  if (themeCol === -1) { themeCol = headers.length; sh.getRange(1, themeCol+1).setValue('theme'); }
  const rowIdx = data.findIndex((r,i) => i>0 && String(r[emailCol]).toLowerCase()===String(email).toLowerCase());
  if (rowIdx === -1) return { error: 'User row not found' };
  sh.getRange(rowIdx+1, themeCol+1).setValue(theme);
  return { success: true };
}
```

**Redeploy Code.gs as New version after Phase 1.**

---

## PHASE 2 — Notification Center (frontend)

Add to `cache.js` CACHE_TTL map: `['Notifications', 15 * 1000]`

Create **new** `frontend/notifications.js`:

```javascript
let _notifications = [];
let _notifOpen = false;

async function loadNotifications() {
  try {
    const user = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
    const res  = await callAPI('getNotifications', { email: user.email || '' });
    _notifications = res.rows || [];
    renderNotifBadge();
    if (_notifOpen) renderNotifPanel();
  } catch(e) {}
}

function renderNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const unread = _notifications.filter(n => n.read !== 'true').length;
  if (!badge) return;
  badge.textContent = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';
}

function toggleNotifPanel() {
  _notifOpen = !_notifOpen;
  let panel = document.getElementById('notif-panel');
  if (!panel) { buildNotifPanel(); return; }
  panel.style.display = _notifOpen ? 'block' : 'none';
  if (_notifOpen) { renderNotifPanel(); loadNotifications(); }
}

function buildNotifPanel() {
  document.getElementById('notif-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;font-weight:700;color:var(--text-1);">Notifications</span>
      <button onclick="markAllNotifsReadUI()" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-family:Inter,sans-serif;">Mark all read</button>
    </div>
    <div id="notif-list" style="max-height:380px;overflow-y:auto;"></div>`;
  document.body.appendChild(panel);
  renderNotifPanel();
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== 'notif-bell-btn' && !e.target.closest('#notif-bell-btn')) {
        panel.style.display = 'none'; _notifOpen = false;
        document.removeEventListener('click', handler);
      }
    });
  }, 100);
}

function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!_notifications.length) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-3);font-size:13px;">No notifications</div>';
    return;
  }
  const typeIcon = { overdue:'🔴', approval:'🔵', budget:'🟡', contract:'🟠', info:'ℹ️', success:'✅' };
  list.innerHTML = _notifications.slice(0,20).map(n => `
    <div onclick="handleNotifClick('${n.id}','${escapeHtml(n.link||'')}')" style="padding:10px 14px;
      border-bottom:1px solid var(--border);cursor:pointer;
      background:${n.read==='true'?'transparent':'rgba(167,139,250,0.05)'};">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="font-size:16px;flex-shrink:0;">${typeIcon[n.type]||'🔔'}</span>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:${n.read==='true'?'400':'600'};color:var(--text-1);">${escapeHtml(n.title||'')}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${escapeHtml(n.message||'')}</div>
        </div>
        ${n.read!=='true'?'<div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></div>':''}
      </div>
    </div>`).join('');
}

async function handleNotifClick(id, link) {
  await callAPI('markNotifRead', { id }).catch(()=>{});
  const n = _notifications.find(x => x.id === id);
  if (n) n.read = 'true';
  renderNotifBadge(); renderNotifPanel();
  if (link && link.startsWith('#')) navigateTo(link.replace('#',''));
}

async function markAllNotifsReadUI() {
  const user = JSON.parse(localStorage.getItem('tt_user_profile') || '{}');
  await callAPI('markAllNotifsRead', { email: user.email||'' }).catch(()=>{});
  _notifications.forEach(n => n.read='true');
  renderNotifBadge(); renderNotifPanel();
  showToast('All notifications marked as read', 'success');
}

setInterval(loadNotifications, 5 * 60 * 1000);
```

### Add to `index.html`

Script tag — insert AFTER `ai-chat.js`:
```html
<script src="notifications.js"></script>
```

Bell button — insert into `#topbar-right`, BEFORE the existing `#theme-toggle` button:
```html
<div style="position:relative;">
  <button id="notif-bell-btn" onclick="toggleNotifPanel()" style="width:36px;height:36px;
    border-radius:var(--r-sm);background:var(--glass-bg);border:1px solid var(--border);
    color:var(--text-2);cursor:pointer;display:flex;align-items:center;justify-content:center;
    position:relative;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
    <span id="notif-badge" style="position:absolute;top:-4px;right:-4px;background:var(--accent-red);
      color:white;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;
      display:none;align-items:center;justify-content:center;padding:0 3px;">0</span>
  </button>
</div>
```

CSS — add to style.css:
```css
#notif-panel {
  position: fixed; top: calc(56px + 8px); right: 1rem; width: 340px; max-height: 480px;
  z-index: 500; border-radius: var(--r-md); overflow: hidden;
  background: var(--glass-bg-strong); backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border); box-shadow: 0 24px 64px rgba(0,0,0,0.35);
}
```

Call `loadNotifications()` in the same place `prefetchAll()` runs after sign-in.

**Wire real notifications** — add `createNotification()` calls (client-side, fire-and-forget) at these existing points:
- After `savePR` success in `purchasereqs.js`, if status is 'Submitted' → notify approvers
- After `checkBudget` returns `alert_level !== 'ok'` (Phase 6) → notify department head
- Vendor `contract_expiry` within 30 days (checked once on dashboard load, Phase 10)

---

## PHASE 3 — Global Search

Add search input to topbar, between the hamburger button and `#topbar-title`... actually place it in `#topbar-right` before the notif bell, OR as a dedicated bar — simplest: add a search icon button that expands an overlay input (keeps topbar compact on mobile).

```html
<!-- In #topbar-right, before notif bell -->
<div style="position:relative;">
  <input id="global-search-input" type="text" placeholder="Search… (Ctrl+K)"
    style="width:200px;padding:7px 10px;font-size:12px;background:var(--glass-bg);
      border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text-1);
      font-family:Inter,sans-serif;"
    oninput="handleGlobalSearch(this.value)"
    onfocus="this.style.width='260px'" onblur="this.style.width='200px'"/>
</div>
```

Add to inline script or a new small block in `notifications.js`:

```javascript
let _searchDebounce;
async function handleGlobalSearch(query) {
  clearTimeout(_searchDebounce);
  if (!query || query.length < 2) { closeSearchResults(); return; }
  _searchDebounce = setTimeout(async () => {
    try {
      const res = await callAPI('globalSearch', { query });
      showSearchResults(res.results || [], query);
    } catch(e) {}
  }, 300);
}

function showSearchResults(results, query) {
  let panel = document.getElementById('global-search-results');
  if (!panel) { panel = document.createElement('div'); panel.id = 'global-search-results'; document.body.appendChild(panel); }
  const tabIcon = {Tasks:'✓',POs:'📋',Invoices:'🧾',PurchaseRequests:'📝',Vendors:'🏢',Comparisons:'⚖️',Milestones:'🚩',Expenses:'💰'};
  const viewMap = {Tasks:'tasks',POs:'pos',Invoices:'invoices',PurchaseRequests:'purchasereqs',Vendors:'vendors',Comparisons:'quotations',Milestones:'milestones',Expenses:'expenses'};
  panel.innerHTML = !results.length
    ? `<div style="padding:1rem;color:var(--text-3);font-size:13px;text-align:center;">No results for "${escapeHtml(query)}"</div>`
    : results.map(r => `
      <div onclick="navigateTo('${viewMap[r.sheet]||'dashboard'}');closeSearchResults()"
        style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;border-bottom:1px solid var(--border);">
        <span style="font-size:16px;">${tabIcon[r.sheet]||'📄'}</span>
        <div><div style="font-size:12px;font-weight:600;color:var(--text-1);">${escapeHtml(r.title||'—')}</div>
        <div style="font-size:10px;color:var(--text-3);">${r.sheet}</div></div>
      </div>`).join('');
  panel.style.display = 'block';
}

function closeSearchResults() {
  const p = document.getElementById('global-search-results');
  if (p) p.style.display = 'none';
}
```

CSS:
```css
#global-search-results {
  position: fixed; top: 64px; right: 1rem; width: min(380px, 90vw); max-height: 400px;
  overflow-y: auto; z-index: 500; border-radius: var(--r-md);
  background: var(--glass-bg-strong); backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border); box-shadow: 0 24px 64px rgba(0,0,0,0.35); display: none;
}
```

---

## PHASE 4 — Keyboard Shortcuts

Add to the inline script in index.html (near other document-level listeners):

```javascript
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search-input')?.focus();
  }
  if (e.key === 'Escape') {
    closeSearchResults();
    document.getElementById('msg-modal-overlay')?.remove();
    document.getElementById('vnd-modal-overlay')?.remove();
    document.getElementById('pr-modal-overlay')?.remove();
    document.getElementById('inv-modal-overlay')?.remove();
    const notifPanel = document.getElementById('notif-panel');
    if (notifPanel) { notifPanel.style.display='none'; _notifOpen=false; }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    const map = {
      invoices:     () => showInvoiceModal?.(null),
      vendors:      () => showVendorModal?.(null),
      purchasereqs: () => showPRModal?.(null),
    };
    map[currentView]?.();
  }
  if (e.altKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const views = ['dashboard','tasks','pos','quotations','invoices','vendors','purchasereqs','milestones','expenses'];
    navigateTo(views[parseInt(e.key)-1] || 'dashboard');
  }
});
```

Verify `currentView` is tracked somewhere in `navigateTo()` already (check first — if not present, add `let currentView = view;` at the top of that function).

---

## PHASE 5 — Dashboard KPIs + Quick Actions

Insert into `#view-dashboard`, right after the `dash-quote-card` div and before `.stat-grid`:

```html
<!-- Quick Actions -->
<div class="glass" style="border-radius:var(--r-md);padding:1rem;margin-bottom:1rem;">
  <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Quick Actions</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <button class="quick-action-btn" onclick="navigateTo('purchasereqs');setTimeout(()=>showPRModal&&showPRModal(null),300)">📝 New PR</button>
    <button class="quick-action-btn" onclick="navigateTo('pos')">📋 New PO</button>
    <button class="quick-action-btn" onclick="navigateTo('invoices');setTimeout(()=>showInvoiceModal&&showInvoiceModal(null),300)">🧾 New Invoice</button>
    <button class="quick-action-btn" onclick="navigateTo('vendors');setTimeout(()=>showVendorModal&&showVendorModal(null),300)">🏢 New Vendor</button>
    <button class="quick-action-btn" onclick="showComposeModal&&showComposeModal({})">💬 Send Message</button>
    <button class="quick-action-btn" onclick="navigateTo('quotations')">⚖️ New Comparison</button>
  </div>
</div>
```

Add KPI row after it (uses new Phase-1/6/10 data — budget %, on-time delivery, vendor score):
```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:1rem;">
  <div class="glass-card" style="border-radius:var(--r-md);padding:1rem;">
    <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Budget Utilization</div>
    <div id="kpi-budget-pct" style="font-size:26px;font-weight:800;color:var(--accent-amber);">—</div>
    <div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px;overflow:hidden;">
      <div id="kpi-budget-fill" style="height:100%;background:var(--accent-amber);width:0%;transition:width 0.6s;"></div>
    </div>
  </div>
  <div class="glass-card" style="border-radius:var(--r-md);padding:1rem;">
    <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">On-Time Delivery</div>
    <div id="kpi-otd-rate" style="font-size:26px;font-weight:800;color:var(--accent-green);">—</div>
  </div>
  <div class="glass-card" style="border-radius:var(--r-md);padding:1rem;">
    <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Avg Vendor Score</div>
    <div id="kpi-vendor-score" style="font-size:26px;font-weight:800;color:var(--accent);">—</div>
  </div>
</div>
```

CSS:
```css
.quick-action-btn { padding:7px 14px;border-radius:var(--r-sm);border:1px solid var(--border);
  background:var(--glass-bg);color:var(--text-2);font-size:12px;font-weight:500;
  font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.15s ease; }
.quick-action-btn:hover { background:var(--glass-bg-hover);color:var(--text-1); }
```

Wire calculations — add to `loadDashboard()` in dashboard.js, after existing data loads:
```javascript
callAPI('getBudgets').then(res => {
  const budgets = res.rows || [];
  if (!budgets.length) return;
  const total = budgets.reduce((s,b)=>s+parseFloat(b.total_budget||0),0);
  const spent = budgets.reduce((s,b)=>s+parseFloat(b.spent||0),0);
  const pct = total>0 ? Math.round((spent/total)*100) : 0;
  const el = document.getElementById('kpi-budget-pct');
  const fill = document.getElementById('kpi-budget-fill');
  if (el) el.textContent = pct + '%';
  if (fill) { fill.style.width = Math.min(pct,100)+'%';
    fill.style.background = pct>=90?'var(--accent-red)':pct>=75?'var(--accent-amber)':'var(--accent-green)'; }
}).catch(()=>{});

// On-time delivery from POs already in cache
const posRows = tableData['POs'] || [];
const completed = posRows.filter(p => p.status === 'received' && p.actual_delivery && p.expected_delivery);
if (completed.length) {
  const onTime = completed.filter(p => new Date(p.actual_delivery) <= new Date(p.expected_delivery));
  const rate = Math.round((onTime.length/completed.length)*100);
  const el = document.getElementById('kpi-otd-rate');
  if (el) el.textContent = rate + '%';
}

// Vendor score
if (window._allVendors && window._allVendors.length) {
  const scored = window._allVendors.filter(v => parseFloat(v.performance_score||0) > 0);
  if (scored.length) {
    const avg = scored.reduce((s,v)=>s+parseFloat(v.performance_score||0),0)/scored.length;
    const el = document.getElementById('kpi-vendor-score');
    if (el) el.textContent = avg.toFixed(1);
  }
}
```

---

## PHASE 6 — Budget Tab

### Nav item — add to sidebar `<ul>`, after Purchase Requests:
```html
<li class="nav-item" data-view="budget">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
  <span>Budget</span>
</li>
```

### View div — add near other view divs:
```html
<div id="view-budget" class="view">
  <div class="tab-header glass">
    <div class="tab-header-left">
      <div class="tab-header-icon" style="background:rgba(251,191,36,0.15);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      </div>
      <div><h2>Budget Control</h2><p class="tab-subtitle">Annual departmental budgets and utilization</p></div>
    </div>
    <div class="tab-header-right"><button class="btn-primary" onclick="showBudgetModal(null)">+ New Budget</button></div>
  </div>
  <div id="budget-wrap"></div>
</div>
```

### New `frontend/budget.js` — build following the exact structure of `invoices.js`
(same load/render/modal/submit pattern). Required pieces:
- `loadBudgets()` → `callAPI('getBudgets')`, render cards grid
- Budget card: Department, Fiscal Year, progress bar (colors match Phase 5 logic: green<75%, amber 75-90%, red>90%), Total/Spent/Remaining, Cost Center
- `showBudgetModal(id)` → fields: Department (datalist from POs.category + PurchaseRequests.department), Fiscal Year, Total Budget, Currency, Cost Center
- `submitBudgetForm()` → `saveBudget`/`updateBudget`
- Alert banner at top of tab when any budget is ≥75%

### Wire budget checks into existing forms

In `purchasereqs.js` `submitPRForm()`, before the `savePR`/`updatePR` call, add:
```javascript
if (department && totalEstimated) {
  const check = await callAPI('checkBudget', { department, amount: totalEstimated }).catch(()=>null);
  if (check && check.alert_level && check.alert_level !== 'ok') {
    const proceed = confirm(`Budget ${check.alert_level.toUpperCase()}: this PR will bring ${department} to ${check.pct_after.toFixed(0)}% of budget. Continue?`);
    if (!proceed) return;
  }
}
```

Add script tag to index.html after `purchasereqs.js`: `<script src="budget.js"></script>`
Add `navigateTo()` case: `else if (view === 'budget') loadBudgets?.();`
Add `titleMap` entry: `budget: 'Budget'`

---

## PHASE 7 — Analytics Tab

### Nav item + view — same pattern as Phase 6, icon: bar chart lines, color `#34d399`

### New `frontend/analytics.js`
Reuses Chart.js (already loaded via CDN in index.html). Build:
- `loadAnalytics()` — fetch `tableData['POs']`, `_allInvoices`, `window._allVendors` (already cached, no new API needed for most of this)
- Spend by Vendor — horizontal bar (top 10 by `total_value`/`amount` summed per vendor)
- Monthly Spend Trend — line chart, last 12 months from Invoices `invoice_date`
- PO Status Distribution — doughnut from `poByStatus` (already computed server-side in `getDashboard()` — reuse `cacheGet('dashboard')`)
- Top 5 Vendors table — sortable by spend, pulls `total_spend` column populated by Phase 1 `getVendorSpend`

Add script tag after `budget.js`, nav item, view div, `navigateTo` case, `titleMap` entry.

---

## PHASE 8 — Audit Log

Wrap the existing generic write functions on the **frontend** (do not touch `callAPI` internals in api.js — add a thin logging layer in the calling functions instead, since api.js's `addRow`/`updateRow`/`deleteRow` wrappers already centralize sheet writes):

In `api.js`, after each successful write in `addRow`, `updateRow`, `deleteRow`, add a fire-and-forget audit call:

```javascript
async function addRow(sheet, data) {
  const result = await callAPI('addRow', { sheet, data });
  cacheClear(sheet); cacheClear('dashboard');
  const user = JSON.parse(localStorage.getItem('tt_user_profile')||'{}');
  callAPI('logAudit', { user_email:user.email||'', action:'create', sheet, record_id:result.id||'', summary:`Created record in ${sheet}` }).catch(()=>{});
  return result;
}
// same pattern added to updateRow (action:'update') and deleteRow (action:'delete')
```

Do the same inside `invoices.js` (`submitInvoiceForm`, `deleteInvoiceById`), `vendors.js` (`submitVendorForm`, `deleteVendorById`), `purchasereqs.js` (`submitPRForm`, `deletePRById`) — one `logAudit` call after each successful save/delete.

### Display — add a card to `#view-permissions` (owner-only, reuse existing `isOwner()` gate already used to show/hide that entire tab):

```html
<div id="audit-section" style="margin-top:1.5rem;">
  <div class="tab-header glass" style="margin-bottom:1rem;">
    <div class="tab-header-left">
      <div class="tab-header-icon" style="background:rgba(239,68,68,0.12);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
        </svg>
      </div>
      <div><h2 style="font-size:14px;">Audit Log</h2><p class="tab-subtitle">Who changed what and when</p></div>
    </div>
  </div>
  <div id="audit-log-list" style="max-height:400px;overflow-y:auto;"></div>
</div>
```

Add a `loadAuditSection()` call inside whatever function currently populates `#perms-view-wrap` (find it — likely triggered from `navigateTo('permissions')`).

---

## PHASE 9 — Task Enhancements (dependencies, recurring, time tracking, subtasks)

Extend `SHEET_FIELDS.Tasks` in tables.js with:
```javascript
{ key: 'recurring', label: 'Recurring', type: 'select', options: ['none','daily','weekly','monthly'], layout: 'half' },
{ key: 'dependency_ids', label: 'Blocked By (task titles, comma-separated)', type: 'datalist', sources: [['Tasks','title']], layout: 'half' },
```
(Add these to the existing array — do not replace the array, insert alongside `tags`/`description`.)

**Time tracking** — add a small "Log Time" quick-action button to task rows (same pattern as the existing `_msgBtns` inline button injection in `renderTable()` for Tasks). On click, `prompt()` for minutes, then `updateRow('Tasks', id, { time_logged_minutes: newTotal })` (generic CRUD — no new backend action needed).

**Subtasks** — add a checklist editor inside the task edit modal. Since Tasks uses the generic field-driven modal (not a custom one like PR/Invoice), the cleanest approach without forking the whole modal system: add a `subtasks_json` textarea-based mini-editor injected via a DOM hook right after the modal is built for Tasks specifically (mirror how `initPOComparisonDropdown`/`initPOPRDropdown` are injected for POs after modal render — find that injection point in `tables.js` and add an equivalent one gated on `sheetName === 'Tasks'`).

---

## PHASE 10 — Vendor Enhancements

**Rating** — add a "Rate" button to `renderVendorCard()` (vendors.js) opening a small inline form (delivery/quality/price sliders 1-5) → `callAPI('rateVendor', { vendor_id, scores })`.

**Total spend** — add a "Recalculate Spend" action on the vendor card (or auto-run on load for all vendors, throttled) → `callAPI('getVendorSpend', { vendor_name })`, display `total_spend` on the card.

**Blacklist alert** — `VND_STATUSES` already includes `'Blocked'`. In `onPOVendorSelect()` and `onInvVendorSelect()` (both already exist), add a check: if selected vendor's `status === 'Blocked'`, show a red inline warning banner in the form (`showToast('⚠️ This vendor is blocked: ' + reason, 'error')` using the new `blacklist_reason` column) — do not block the save, just warn.

**Contract expiry** — add `contract_expiry` date field to the vendor modal form (vendors.js `showVendorModal`). On dashboard load, check vendors with `contract_expiry` within 30 days → `createNotification()` (Phase 1/2) once per vendor per day (dedupe via a `localStorage` flag keyed by date, same pattern already used in `dashboard.js`'s `autoMarkOverdue()` dedup logic).

---

## PHASE 11 — Invoice Enhancements

**Aging report** — add a collapsible section inside `#view-invoices` (invoices.js), below the filter tabs: 4 buckets (Current / 1-30 / 31-60 / 61+) as clickable stat pills that filter the existing table. Data from `callAPI('getInvoiceAging')`.

**Batch approve/mark paid** — the bulk-select infrastructure already exists (`onInvCheckChange`, `toggleAllInvChecks`, `bulkDeleteInvoices`, `bulkExportInvoices`). Add a sibling function:
```javascript
async function bulkMarkPaid() {
  const ids = [...document.querySelectorAll('.inv-row-check:checked')].map(cb => cb.value);
  if (!ids.length) return;
  for (const id of ids) {
    await callAPI('updateInvoice', { id, status: 'Paid' }).catch(()=>{});
    const inv = _allInvoices.find(i => i.id === id);
    if (inv) inv.status = 'Paid';
  }
  renderInvoiceTable(); refreshInvoiceDashboard();
  showToast(`${ids.length} invoice(s) marked paid`, 'success');
}
```
Add a button next to the existing bulk delete/export buttons in the bulk-action bar.

**Recurring invoices** — add `recurring` (none/monthly) + `recurring_day` fields to the invoice modal. Add a button in the Invoices tab header: "Generate This Month's Recurring Invoices" — loops `_allInvoices.filter(i => i.recurring==='monthly')`, checks if an invoice for the current month already exists (by matching `invoice_number` pattern or a `source_recurring_id`), and calls `saveInvoice()` for missing ones. This is a manual trigger, not a true cron — note in the UI that it must be clicked (or optionally: Claude Code can add an Apps Script installable time-driven trigger calling a new `generateRecurringInvoices()` Code.gs function daily, if the person wants full automation — flag this as an optional follow-up, it requires manual trigger setup in the Apps Script editor which can't be done from code alone).

---

## PHASE 12 — PO Delivery Tracking + Amendment Log

Add "Record Delivery" quick action to PO rows (tables.js, in the same spot where `_msgBtns` are injected for POs). Opens a small prompt/modal for `received_quantity`. On save:
```javascript
async function recordPODelivery(id, receivedQty) {
  const po = tableData['POs'].find(p => p.id === id);
  if (!po) return;
  const qty = parseFloat(po.quantity) || 0;
  const newStatus = receivedQty >= qty ? 'received' : po.status;
  const amendment = JSON.parse(po.amendment_log || '[]');
  amendment.push({ field:'received_quantity', old:po.received_quantity||0, new:receivedQty, at:new Date().toISOString() });
  await updateRow('POs', id, { received_quantity: receivedQty, status: newStatus, amendment_log: JSON.stringify(amendment) });
  showToast('Delivery recorded' + (newStatus==='received' ? ' — PO closed ✓' : ''), 'success');
  loadTable('POs');
}
```
Setting `status: 'received'` automatically triggers the EXISTING `autoCreateExpense()` in Code.gs's `updateRow` handler — no backend change needed, this is a genuine reuse of existing automation.

Show amendment history as an expandable row detail (small "History" link that toggles a `<pre>` of parsed `amendment_log`).

---

## PHASE 13 — PR Multi-Stage Approval + Aging Alerts

Extend `showPRModal()` in purchasereqs.js to show 3 approval checkboxes (Dept Head / Finance / GM) when status is 'Submitted' or beyond, each settable only by users with `can_approve` permission (already exists as a permission key pattern in the existing permissions system — verify exact key name in `#view-permissions` code and reuse it, don't invent a new one).

`approval_stage` column (0=none, 1=dept head done, 2=finance done, 3=GM done → auto status='Approved'). Update via generic `updateRow('PurchaseRequests', id, {...})`.

**Aging alert** — add a check in `loadPRs()`: any PR with `status==='Submitted'` and `created_at` older than 5 days and `aging_notified !== 'true'` → `createNotification()` + set `aging_notified` via `updateRow`. Run this check once per session load, not on every render.

---

## PHASE 14 — Side-by-Side Quotation Comparison View

In quotations.js, add a view toggle button near `renderScoresTable()`'s output. New function `renderSideBySideView(scored)` — renders vendors as columns, criteria as rows (transpose of the existing table), reusing the same `colColor()` best/worst logic already computed. Pure rendering addition, zero backend change, zero new data.

---

## PHASE 15 — Full Workbook Excel Export (all tabs)

Add a button to the existing Data Management section in Settings (`#view-settings`, find the section with the current export buttons — mirror its style). New function (put in a shared spot — top of `tables.js` or a new `reports.js`):

```javascript
async function exportFullWorkbook() {
  if (!window.XLSX) { showToast('Excel library not loaded', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const sheets = ['Tasks','POs','Invoices','Vendors','PurchaseRequests','Comparisons','Milestones','Expenses'];
  for (const name of sheets) {
    try {
      const res = await callAPI('getAll', { sheet: name === 'Invoices' ? undefined : name });
      const rows = name === 'Invoices' ? (await callAPI('getInvoices')).rows
                 : name === 'Vendors'  ? (await callAPI('getVendors')).rows
                 : name === 'PurchaseRequests' ? (await callAPI('getPRs')).rows
                 : (res.rows || []);
      if (!rows.length) continue;
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
    } catch(e) {}
  }
  XLSX.writeFile(wb, `TaskTracker_FullExport_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Full workbook exported ✓', 'success');
}
```

---

## PHASE 16 — Theme Preference to Server

In `toggleTheme()` (find in inline script), after the existing `localStorage.setItem` call, add:
```javascript
const user = JSON.parse(localStorage.getItem('tt_user_profile')||'{}');
if (user.email) callAPI('saveUserTheme', { email: user.email, theme: newTheme }).catch(()=>{});
```
On login, after fetching user profile, check `getUserPermissions` response — extend it or add one field read to also pull `theme` from the Users row (or add a tiny dedicated read; simplest: extend `getUserPermissions` in Code.gs to also return `theme` from the row, since it already reads that row).

---

## PHASE 17 — Mobile Polish (verification pass, not a new system)

Mobile responsiveness is already substantial (hamburger, sidebar overlay, 20 media queries). This phase is a **verification and targeted fix pass**, not new infrastructure:
- Open the app at 375px width and check: Invoices table, Vendors card grid, PurchaseRequests table, Permissions tab, new Budget/Analytics tabs, Notification panel, Global search results panel
- Fix any that overflow horizontally or have sub-32px tap targets
- Ensure `#notif-panel` and `#global-search-results` collapse to near-full-width on mobile (add a `@media (max-width:480px)` override for both, matching the pattern of the other 20 existing breakpoints)

---

## PHASE 18 — Arabic Coverage Audit

`i18n.js` already has ~100 `data-i18n` keys covering the older tabs. The newer tabs (Invoices, Vendors, PurchaseRequests, Permissions) and everything built in Phases 2-16 use hardcoded English strings. Go through each new/recent view and:
1. Add `data-i18n="key_name"` attributes to static labels
2. Add matching `en`/`ar` entries to `i18n.js`
3. Verify RTL layout doesn't break the newer glass cards (check `dir="rtl"` handling already present for older tabs, apply same pattern)

---

## PHASE 19 — Offline Mode: honest scope note (read before building)

True offline writes are not realistically achievable against an Apps Script backend —
there is no queue/replay infrastructure Apps Script can provide, and Apps Script Web
Apps require a live HTTPS round-trip for every write. A responsible MVP:
- Service worker that caches the last successful `GET`-equivalent (`getDashboard`,
  `getAll`) responses so the app still *displays* data when offline
- A visible "You're offline — showing cached data" banner
- Writes attempted while offline get queued in `localStorage` (not IndexedDB needed
  at this scale) and a "Sync Now" button appears when connectivity returns, replaying
  queued `addRow`/`updateRow` calls in order
- Do NOT attempt true background push notifications — that requires a push server
  Apps Script cannot act as. Keep the existing in-tab `Notification` API pattern
  (Phase 2's persisted Notifications sheet + bell already covers "notified when the
  tab is open," which is the realistic ceiling here)

Only build this phase if the person confirms they accept these limits.

---

## TESTING — after each phase

Do not batch all 19 phases into one untested commit. After every phase:
1. Reload the app, exercise the new UI path end to end
2. Check DevTools console for errors
3. Verify no existing feature regressed (especially: PO form dropdowns, invoice partial payment, PR line items, permissions tab, mobile sidebar)
4. Commit with a phase-scoped message, then move to the next phase

Final deployment after all phases pass:
```bash
git add .
git commit -m "notifications, search, shortcuts, budget, analytics, audit log, task/vendor/invoice/PO/PR enhancements, i18n coverage"
git push
```
Redeploy Code.gs as New version (required — Phase 1 added many backend functions).

---

## RULES
1. Read the actual current files before each phase — do not assume line numbers from this doc are exact
2. Do not recreate anything in the "ALREADY BUILT" list at the top
3. Do not modify config.js
4. `ensureVendorsSheet`/`ensurePRSheets` upgrades (Phase 1B) must not break existing data — only append missing columns, never reorder/delete
5. List every file modified after each phase
