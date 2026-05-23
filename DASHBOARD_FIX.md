# Task Tracker — Screenshot-Based Fix Prompt
# Paste this ENTIRE file into Claude Code chat in VS Code

Read ALL files in E:\task-tracker\frontend\ before making ANY changes.
List every file you read before starting work.
After all changes, list every file modified or created.

---

## CRITICAL: READ THESE SCREENSHOTS ISSUES FIRST

From the uploaded screenshots, these exact problems were identified:
1. Stat cards too tall (taking 40% of viewport)
2. Charts taking full height, content not visible
3. "Open Google Sheet" button on dashboard — DELETE IT
4. Arabic not applying to tab headers and topbar title
5. Profile dropdown appears on wrong side in Arabic mode
6. Theme switch breaks text colors in Arabic
7. Table columns misaligned in RTL
8. No pivot table with activity tabs
9. No animated hover icons on sidebar
10. RTL not fully applied to whole app

---

## FIX 1 — DELETE "OPEN GOOGLE SHEET" BUTTON

Search index.html for ANY button or element containing text:
- "Open Google Sheet"
- "open-google-sheet"
- "openGoogleSheet"
- Any <a> or <button> linking to docs.google.com/spreadsheets

DELETE every instance found. This button should not exist anywhere in the app.

---

## FIX 2 — COMPACT STAT CARDS

Replace the entire `.stat-grid` and all `.stat-card` HTML in the dashboard view with this compact horizontal layout:

```html
<div class="stat-grid">
  <div class="stat-card glass">
    <div class="stat-icon-wrap" style="background:rgba(99,102,241,0.15);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2">
        <circle cx="12" cy="12" r="9"/><polyline points="12,6 12,12 16,14"/>
      </svg>
    </div>
    <div class="stat-body">
      <div class="stat-label" data-i18n="open_tasks">Open Tasks</div>
      <div class="stat-value" id="stat-open">—</div>
    </div>
    <span class="stat-pill blue" data-i18n="active">Active</span>
  </div>

  <div class="stat-card glass">
    <div class="stat-icon-wrap" style="background:rgba(239,68,68,0.15);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
    <div class="stat-body">
      <div class="stat-label" data-i18n="overdue">Overdue</div>
      <div class="stat-value danger" id="stat-overdue">—</div>
    </div>
    <span class="stat-pill red" data-i18n="attention">Attention</span>
  </div>

  <div class="stat-card glass">
    <div class="stat-icon-wrap" style="background:rgba(139,92,246,0.15);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2">
        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    </div>
    <div class="stat-body">
      <div class="stat-label" data-i18n="po_spend">PO Spend</div>
      <div class="stat-value" id="stat-spend">—</div>
    </div>
    <span class="stat-pill purple" data-i18n="committed">Committed</span>
  </div>

  <div class="stat-card glass">
    <div class="stat-icon-wrap" style="background:rgba(16,185,129,0.15);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    </div>
    <div class="stat-body">
      <div class="stat-label" data-i18n="avg_progress">Avg Progress</div>
      <div class="stat-value" id="stat-progress">—</div>
    </div>
    <span class="stat-pill green" data-i18n="milestones">Milestones</span>
  </div>

  <div class="stat-card glass">
    <div class="stat-icon-wrap" style="background:rgba(245,158,11,0.15);">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    </div>
    <div class="stat-body">
      <div class="stat-label" data-i18n="total_expenses">Total Expenses</div>
      <div class="stat-value" id="stat-expenses">—</div>
    </div>
    <span class="stat-pill amber" data-i18n="all_time">All time</span>
  </div>
</div>
```

Add these i18n keys to TRANSLATIONS in i18n.js:
```javascript
// English
active: 'Active',
attention: 'Attention',
committed: 'Committed',
all_time: 'All time',
milestones_label: 'Milestones',

// Arabic
active: 'نشط',
attention: 'تنبيه',
committed: 'ملتزم',
all_time: 'الإجمالي',
milestones_label: 'المراحل',
```

Replace `.stat-card` CSS in style.css with:
```css
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 1rem;
}

.stat-card {
  border-radius: var(--r-md);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-height: 0;
  cursor: default;
}

.stat-card::after {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-specular), transparent);
}

.stat-card:hover { transform: translateY(-2px); }

.stat-icon-wrap {
  width: 36px; height: 36px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.stat-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.04em;
  line-height: 1.1;
}

.stat-value.danger { color: var(--accent-red); }

.stat-pill {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
}

.stat-pill.blue   { background: rgba(99,102,241,0.15); color: #818cf8; }
.stat-pill.red    { background: rgba(239,68,68,0.15);  color: #f87171; }
.stat-pill.purple { background: rgba(139,92,246,0.15); color: #a78bfa; }
.stat-pill.green  { background: rgba(16,185,129,0.15); color: #34d399; }
.stat-pill.amber  { background: rgba(245,158,11,0.15); color: #fbbf24; }
```

---

## FIX 3 — SMALLER CHARTS (30% smaller, side by side)

Replace `.charts-row` CSS:
```css
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 1rem;
}

.chart-box {
  border-radius: var(--r-md);
  padding: 0.875rem;
  position: relative;
  overflow: hidden;
}

.chart-box::after {
  content: '';
  position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-specular), transparent);
}

.chart-box h3 {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.625rem;
}

.chart-box canvas {
  max-height: 140px !important;
}
```

In dashboard.js, update Chart.js options to set maxHeight:
In `renderTaskChart()` add to options: `maintainAspectRatio: false`
In `renderPOChart()`   add to options: `maintainAspectRatio: false`
Wrap each canvas in a div with fixed height:

In index.html, wrap each canvas:
```html
<div style="position:relative;height:140px;">
  <canvas id="chart-tasks"></canvas>
</div>
<div style="position:relative;height:140px;">
  <canvas id="chart-pos"></canvas>
</div>
```

---

## FIX 4 — COMPLETE i18n SYSTEM REWRITE

This is the root cause of Arabic not applying. Replace the entire `applyLanguage()` function in i18n.js:

```javascript
function applyLanguage() {
  const isRTL = currentLang === 'ar';

  // 1. Set HTML attributes
  document.documentElement.lang = currentLang;
  document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', isRTL);

  // 2. Translate ALL data-i18n elements (including hidden ones)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (!val) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      // Preserve child elements (SVGs, badges) — only replace text nodes
      const childNodes = Array.from(el.childNodes);
      const textNodes  = childNodes.filter(n => n.nodeType === Node.TEXT_NODE);
      if (textNodes.length > 0) {
        textNodes.forEach(n => { if (n.textContent.trim()) n.textContent = ' ' + val; });
      } else if (el.children.length === 0) {
        el.textContent = val;
      }
    }
  });

  // 3. Translate placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  // 4. Update topbar title based on current view
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) {
    const view = activeNav.dataset.view;
    const titleEl = document.getElementById('topbar-title');
    const titleMap = {
      dashboard:  'dashboard',
      tasks:      'tasks',
      pos:        'purchase_orders',
      milestones: 'milestones',
      expenses:   'expenses',
      chat:       'team_chat',
      settings:   'settings'
    };
    if (titleEl && titleMap[view]) titleEl.textContent = t(titleMap[view]);
  }

  // 5. Update Add buttons text
  const btnMap = {
    Tasks:      'add_task',
    POs:        'add_po',
    Milestones: 'add_milestone',
    Expenses:   'add_expense'
  };
  document.querySelectorAll('.btn-add[data-sheet]').forEach(btn => {
    const key = btnMap[btn.dataset.sheet];
    if (key) btn.textContent = '+ ' + t(key);
  });

  // 6. Update modal save/cancel buttons
  const saveBtn   = document.getElementById('modal-save');
  const cancelBtn = document.getElementById('modal-cancel');
  if (saveBtn)   saveBtn.textContent   = t('save');
  if (cancelBtn) cancelBtn.textContent = t('cancel');

  // 7. Update sign out button
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    const svgEl = signoutBtn.querySelector('svg');
    signoutBtn.textContent = t('sign_out');
    if (svgEl) signoutBtn.prepend(svgEl);
  }

  // 8. Update chat input placeholder
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.placeholder = t('message_placeholder');

  // 9. Update language selector
  const langSelect = document.getElementById('pref-language');
  if (langSelect) langSelect.value = currentLang;

  // 10. Update greeting
  setGreeting();

  // 11. Update profile dropdown items
  document.querySelectorAll('.pd-item[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
}
```

Also add these missing keys to TRANSLATIONS in i18n.js:

English additions:
```javascript
active:           'Active',
attention:        'Attention',
committed:        'Committed',
all_time:         'All time',
task_status:      'Task Status',
po_status:        'PO Status',
recent_tasks:     'Recent Tasks',
recent_expenses:  'Recent Expenses',
recent_activity:  'Recent Activity',
view_all:         'View all',
good_morning:     'Good morning',
good_afternoon:   'Good afternoon',
good_evening:     'Good evening',
add_task:         '+ Add Task',
add_po:           '+ Add PO',
add_milestone:    '+ Add Milestone',
add_expense:      '+ Add Expense',
save:             'Save',
cancel:           'Cancel',
sign_out:         'Sign out',
message_placeholder: 'Message your team...',
tasks_tab:        'Tasks',
expenses_tab:     'Expenses',
activity_tab:     'Activity',
who:              'Who',
what:             'What',
when:             'When',
```

Arabic additions:
```javascript
active:           'نشط',
attention:        'تنبيه',
committed:        'ملتزم',
all_time:         'الإجمالي',
task_status:      'حالة المهام',
po_status:        'حالة الطلبات',
recent_tasks:     'أحدث المهام',
recent_expenses:  'أحدث المصروفات',
recent_activity:  'النشاط الأخير',
view_all:         'عرض الكل',
good_morning:     'صباح الخير',
good_afternoon:   'مساء الخير',
good_evening:     'مساء النور',
add_task:         '+ إضافة مهمة',
add_po:           '+ إضافة طلب',
add_milestone:    '+ إضافة مرحلة',
add_expense:      '+ إضافة مصروف',
save:             'حفظ',
cancel:           'إلغاء',
sign_out:         'تسجيل الخروج',
message_placeholder: 'أرسل رسالة للفريق...',
tasks_tab:        'المهام',
expenses_tab:     'المصروفات',
activity_tab:     'النشاط',
who:              'من',
what:             'ماذا',
when:             'متى',
```

---

## FIX 5 — FULL APP RTL (complete CSS)

Replace the entire RTL section in style.css with this comprehensive version:

```css
/* ═══════════════════════════════════════
   FULL RTL LAYOUT
   Applied when body.rtl is set
═══════════════════════════════════════ */

/* Flip the main layout — sidebar moves to right */
body.rtl {
  direction: rtl;
}

body.rtl #app {
  flex-direction: row-reverse;
}

/* Sidebar on right side */
body.rtl #sidebar {
  border-right: none;
  border-left: 1px solid var(--border);
}

/* Sidebar internals */
body.rtl .nav-logo { flex-direction: row-reverse; }
body.rtl .nav-item {
  flex-direction: row-reverse;
  text-align: right;
}
body.rtl .nav-item.active::before {
  left:  auto;
  right: 0;
  border-radius: 2px 0 0 2px;
}
body.rtl .nav-badge { margin-left: 0; margin-right: auto; }
body.rtl .user-row  { flex-direction: row-reverse; }
body.rtl .user-info-text { text-align: right; }

/* Topbar */
body.rtl #topbar { flex-direction: row-reverse; }
body.rtl .topbar-right { flex-direction: row-reverse; }

/* Main content */
body.rtl #main { direction: rtl; }
body.rtl .view { direction: rtl; }
body.rtl .view-header { flex-direction: row-reverse; }
body.rtl .tab-header  { flex-direction: row-reverse; }
body.rtl .tab-header-left  { flex-direction: row-reverse; }
body.rtl .tab-header-right { flex-direction: row-reverse; }
body.rtl .tab-header h2 { text-align: right; }

/* Dashboard */
body.rtl .dashboard-header { text-align: right; }
body.rtl .stat-card { flex-direction: row-reverse; }
body.rtl .stat-body { text-align: right; }
body.rtl .panel-header { flex-direction: row-reverse; }
body.rtl .panel-header h3 { text-align: right; }
body.rtl .recent-item { flex-direction: row-reverse; }
body.rtl .recent-item-left { flex-direction: row-reverse; }
body.rtl .milestone-header { flex-direction: row-reverse; }

/* Tables */
body.rtl table { direction: rtl; }
body.rtl th, body.rtl td { text-align: right; }
body.rtl .table-toolbar { flex-direction: row-reverse; }
body.rtl .filter-input  { direction: rtl; text-align: right; }
body.rtl .filter-bar    { flex-direction: row-reverse; }
body.rtl .actions-cell  { text-align: left; }

/* Modal */
body.rtl #modal         { direction: rtl; }
body.rtl #modal-header  { flex-direction: row-reverse; }
body.rtl #modal-footer  { flex-direction: row-reverse; }
body.rtl .form-group    { direction: rtl; }
body.rtl .form-group label { text-align: right; }
body.rtl .form-group input,
body.rtl .form-group select { direction: rtl; text-align: right; }

/* Chat */
body.rtl .chat-message.mine   { flex-direction: row; }
body.rtl .chat-message.theirs { flex-direction: row-reverse; }
body.rtl .mine .msg-content   { align-items: flex-start; }
body.rtl .mine .msg-bubble {
  border-radius: 16px 16px 16px 4px;
}
body.rtl .theirs .msg-bubble {
  border-radius: 16px 16px 4px 16px;
}
body.rtl .chat-input-bar { flex-direction: row-reverse; }
body.rtl #chat-input { direction: rtl; text-align: right; }
body.rtl .chat-panel { right: auto; left: 1.5rem; }
body.rtl .chat-bubble { right: auto; left: 1.5rem; }

/* Settings */
body.rtl .settings-section { direction: rtl; text-align: right; }
body.rtl .pref-item { flex-direction: row-reverse; }
body.rtl .team-member-row { flex-direction: row-reverse; }
body.rtl .add-member-row { flex-direction: row-reverse; }

/* Arabic font */
body.rtl,
body.rtl * {
  font-family: 'Segoe UI', 'Tahoma', 'Arial', system-ui, sans-serif;
  letter-spacing: 0;
}
```

---

## FIX 6 — PROFILE DROPDOWN SMART POSITIONING

Replace the profile button click handler in the inline script with:

```javascript
document.getElementById('profile-btn')?.addEventListener('click', function(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  const isHidden = dropdown.classList.contains('hidden');

  if (!isHidden) {
    dropdown.classList.add('hidden');
    return;
  }

  // Smart positioning — always visible on screen
  dropdown.classList.remove('hidden');

  const btn    = this.getBoundingClientRect();
  const dd     = dropdown.getBoundingClientRect();
  const vw     = window.innerWidth;
  const isRTL  = document.body.classList.contains('rtl');

  // Default: align to right edge of button
  let left = btn.right - dd.width;
  let top  = btn.bottom + 8;

  // If RTL: align to left edge of button
  if (isRTL) {
    left = btn.left;
  }

  // Clamp to viewport
  left = Math.max(8, Math.min(left, vw - dd.width - 8));

  dropdown.style.position = 'fixed';
  dropdown.style.top      = top  + 'px';
  dropdown.style.left     = left + 'px';
  dropdown.style.right    = 'auto';
});

// Close on outside click
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('profile-dropdown');
  const btn      = document.getElementById('profile-btn');
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});
```

Also update profile dropdown CSS — remove fixed right positioning:
```css
#profile-dropdown {
  position: fixed;
  /* top and left set dynamically by JS above */
  width: 260px;
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow-lg);
  border-radius: var(--r-md);
  z-index: 300;
  overflow: hidden;
  animation: dropdownIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
}
```

---

## FIX 7 — TABBED PIVOT TABLE (Tasks | Expenses | Activity)

Replace the existing pivot/recent section in dashboard HTML with:

```html
<div class="pivot-section glass" style="border-radius:var(--r-md);margin-bottom:1rem;overflow:hidden;">
  <!-- Tab bar -->
  <div class="pivot-tabs">
    <button class="pivot-tab active" onclick="switchPivotTab('tasks', this)" data-i18n="tasks_tab">Tasks</button>
    <button class="pivot-tab" onclick="switchPivotTab('expenses', this)" data-i18n="expenses_tab">Expenses</button>
    <button class="pivot-tab" onclick="switchPivotTab('activity', this)" data-i18n="activity_tab">Activity</button>
    <span class="pivot-count" id="pivot-count"></span>
  </div>

  <!-- Tasks pivot -->
  <div id="pivot-tasks" class="pivot-content active">
    <div class="table-scroll">
      <table id="pivot-tasks-table" style="font-size:12px;">
        <thead>
          <tr>
            <th data-i18n="title">Title</th>
            <th data-i18n="status">Status</th>
            <th data-i18n="priority">Priority</th>
            <th data-i18n="assignee">Assignee</th>
            <th data-i18n="due_date">Due Date</th>
          </tr>
        </thead>
        <tbody id="pivot-tasks-body">
          <tr><td colspan="5" class="loading" data-i18n="loading">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Expenses pivot -->
  <div id="pivot-expenses" class="pivot-content hidden">
    <div class="table-scroll">
      <table style="font-size:12px;">
        <thead>
          <tr>
            <th data-i18n="category">Category</th>
            <th data-i18n="description">Description</th>
            <th data-i18n="amount">Amount</th>
            <th data-i18n="date">Date</th>
          </tr>
        </thead>
        <tbody id="pivot-expenses-body">
          <tr><td colspan="4" class="loading">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Activity pivot -->
  <div id="pivot-activity" class="pivot-content hidden">
    <div class="table-scroll">
      <table style="font-size:12px;">
        <thead>
          <tr>
            <th data-i18n="who">Who</th>
            <th data-i18n="what">What</th>
            <th data-i18n="when">When</th>
          </tr>
        </thead>
        <tbody id="pivot-activity-body">
          <tr><td colspan="3" class="loading">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

Add CSS for pivot tabs:
```css
.pivot-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0.625rem 0.875rem 0;
  border-bottom: 1px solid var(--border);
}

.pivot-tab {
  background: none;
  border: none;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  cursor: pointer;
  border-radius: var(--r-sm) var(--r-sm) 0 0;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.pivot-tab:hover { color: var(--text-1); }

.pivot-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: rgba(99,102,241,0.06);
}

.pivot-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-3);
  padding: 0 4px;
}

.pivot-content { display: none; padding: 0.5rem 0; }
.pivot-content.active { display: block; }
```

Add to dashboard.js:

```javascript
let pivotTasksData    = [];
let pivotExpensesData = [];
let pivotActivityLog  = [];

function switchPivotTab(tab, btn) {
  // Deactivate all
  document.querySelectorAll('.pivot-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pivot-content').forEach(c => c.classList.add('hidden'));
  // Activate selected
  btn.classList.add('active');
  const content = document.getElementById('pivot-' + tab);
  if (content) {
    content.classList.remove('hidden');
    content.classList.add('active');
  }
  // Update count
  const counts = { tasks: pivotTasksData.length, expenses: pivotExpensesData.length, activity: pivotActivityLog.length };
  const countEl = document.getElementById('pivot-count');
  if (countEl) countEl.textContent = (counts[tab] || 0) + ' ' + t('records');
}

function renderPivotTasks(tasks) {
  pivotTasksData = (tasks || [])
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 7);
  const tbody = document.getElementById('pivot-tasks-body');
  if (!tbody) return;
  const today = new Date();
  if (!pivotTasksData.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center;padding:1rem;">No tasks yet</td></tr>';
    return;
  }
  tbody.innerHTML = pivotTasksData.map(t => {
    const due    = t.due_date ? new Date(t.due_date) : null;
    const isLate = due && due < today && t.status !== 'done';
    return `<tr style="${isLate ? 'background:rgba(239,68,68,0.04);' : ''}">
      <td style="font-weight:500;color:var(--text-1);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title||'—'}</td>
      <td><span class="badge badge-${t.status}">${(t.status||'').replace(/_/g,' ')}</span></td>
      <td><span class="badge badge-${t.priority}">${t.priority||'—'}</span></td>
      <td style="color:var(--text-2);">${t.assignee||'—'}</td>
      <td style="color:${isLate?'var(--accent-red)':'var(--text-2)'};">${due?due.toLocaleDateString():'—'}</td>
    </tr>`;
  }).join('');
}

function renderPivotExpenses(expenses) {
  pivotExpensesData = (expenses || [])
    .sort((a,b) => new Date(b.created_at||b.date) - new Date(a.created_at||a.date))
    .slice(0, 7);
  const tbody = document.getElementById('pivot-expenses-body');
  if (!tbody) return;
  if (!pivotExpensesData.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty" style="text-align:center;padding:1rem;">No expenses yet</td></tr>';
    return;
  }
  tbody.innerHTML = pivotExpensesData.map(e => `
    <tr>
      <td style="color:var(--text-1);font-weight:500;">${e.category||'—'}</td>
      <td style="color:var(--text-2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.description||'—'}</td>
      <td style="color:var(--accent-amber);font-weight:600;">${e.currency||''} ${Number(e.amount||0).toLocaleString()}</td>
      <td style="color:var(--text-3);">${e.date?new Date(e.date).toLocaleDateString():'—'}</td>
    </tr>`).join('');
}

function renderPivotActivity(tasks, expenses, milestones) {
  // Build activity from created_by + created_at across all sheets
  const items = [];
  (tasks||[]).forEach(r => {
    if (r.created_by && r.created_at) items.push({ who: r.created_by, what: '✓ ' + (r.title||'Task'), when: r.created_at });
    if (r.updated_at && r.updated_at !== r.created_at) items.push({ who: r.created_by||'—', what: '✎ ' + (r.title||'Task'), when: r.updated_at });
  });
  (expenses||[]).forEach(r => {
    if (r.created_by && r.created_at) items.push({ who: r.created_by, what: '$ ' + (r.description||r.category||'Expense'), when: r.created_at });
  });
  (milestones||[]).forEach(r => {
    if (r.created_by && r.created_at) items.push({ who: r.created_by, what: '◆ ' + (r.milestone_name||'Milestone'), when: r.created_at });
  });
  pivotActivityLog = items.sort((a,b) => new Date(b.when) - new Date(a.when)).slice(0, 10);
  const tbody = document.getElementById('pivot-activity-body');
  if (!tbody) return;
  if (!pivotActivityLog.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty" style="text-align:center;padding:1rem;">No activity yet</td></tr>';
    return;
  }
  tbody.innerHTML = pivotActivityLog.map(a => {
    const when = a.when ? new Date(a.when) : null;
    const timeStr = when ? when.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + ' ' + when.toLocaleDateString() : '—';
    const emailShort = (a.who||'').split('@')[0];
    return `<tr>
      <td style="color:var(--accent);font-weight:500;font-size:11px;">${emailShort}</td>
      <td style="color:var(--text-2);">${a.what}</td>
      <td style="color:var(--text-3);white-space:nowrap;font-size:11px;">${timeStr}</td>
    </tr>`;
  }).join('');
}
```

Update `loadDashboard()` in dashboard.js to call all three render functions:
```javascript
// After existing data loading, add:
renderPivotTasks(tasksData.rows);
renderPivotExpenses(expensesData.rows);
renderPivotActivity(tasksData.rows, expensesData.rows, milestonesData.rows);
// Initialize count display
const countEl = document.getElementById('pivot-count');
if (countEl) countEl.textContent = Math.min((tasksData.rows||[]).length, 7) + ' ' + t('records');
```

Add to i18n.js translations:
```javascript
// English
records: 'records',
loading: 'Loading...',
category: 'Category',
description: 'Description',

// Arabic
records: 'سجل',
loading: 'جار التحميل...',
category: 'التصنيف',
description: 'الوصف',
```

---

## FIX 8 — ANIMATED HOVER SVG ICONS ON SIDEBAR

Add these CSS animations to style.css. Each icon type has its own animation:

```css
/* ── BASE NAV ICON ANIMATION ── */
.nav-svg {
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
              color 0.15s ease;
  transform-origin: center;
  will-change: transform;
}

/* Dashboard — grid pulse */
.nav-item[data-view="dashboard"]:hover .nav-svg {
  animation: iconGridPulse 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes iconGridPulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.3) rotate(5deg); }
  70%  { transform: scale(0.95) rotate(-2deg); }
  100% { transform: scale(1.1); }
}

/* Tasks — checkbox bounce */
.nav-item[data-view="tasks"]:hover .nav-svg {
  animation: iconCheckBounce 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes iconCheckBounce {
  0%   { transform: scale(1) translateY(0); }
  50%  { transform: scale(1.2) translateY(-3px); }
  75%  { transform: scale(1.05) translateY(1px); }
  100% { transform: scale(1.1) translateY(0); }
}

/* POs — bag swing */
.nav-item[data-view="pos"]:hover .nav-svg {
  animation: iconBagSwing 0.5s ease forwards;
}
@keyframes iconBagSwing {
  0%   { transform: rotate(0deg); }
  25%  { transform: rotate(-12deg); }
  50%  { transform: rotate(10deg); }
  75%  { transform: rotate(-5deg); }
  100% { transform: rotate(0deg) scale(1.1); }
}

/* Milestones — star spin */
.nav-item[data-view="milestones"]:hover .nav-svg {
  animation: iconStarSpin 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes iconStarSpin {
  0%   { transform: rotate(0deg) scale(1); }
  60%  { transform: rotate(72deg) scale(1.25); }
  100% { transform: rotate(72deg) scale(1.1); }
}

/* Expenses — coin bounce */
.nav-item[data-view="expenses"]:hover .nav-svg {
  animation: iconCoinBounce 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes iconCoinBounce {
  0%   { transform: scale(1) translateY(0); }
  30%  { transform: scale(1.3) translateY(-4px); }
  60%  { transform: scale(0.95) translateY(1px); }
  100% { transform: scale(1.1) translateY(0); }
}

/* Chat — bubble pop */
.nav-item[data-view="chat"]:hover .nav-svg {
  animation: iconChatPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes iconChatPop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3) translateY(-2px); }
  75%  { transform: scale(0.95); }
  100% { transform: scale(1.1); }
}

/* Settings — gear spin */
.nav-item[data-view="settings"]:hover .nav-svg {
  animation: iconGearSpin 0.6s linear forwards;
}
@keyframes iconGearSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(90deg); }
}
```

---

## FIX 9 — LIGHT MODE TEXT COLORS (Arabic fix)

Update `[data-theme="light"]` in style.css to include EXPLICIT text colors:

```css
[data-theme="light"] {
  /* ... existing variables ... */
  --text-1: rgba(8, 8, 20, 0.95);
  --text-2: rgba(8, 8, 20, 0.65);
  --text-3: rgba(8, 8, 20, 0.42);
  --text-4: rgba(8, 8, 20, 0.25);
}

/* Force text colors in light mode explicitly */
[data-theme="light"] .stat-label,
[data-theme="light"] .stat-value,
[data-theme="light"] th,
[data-theme="light"] td,
[data-theme="light"] .nav-item,
[data-theme="light"] .view h2,
[data-theme="light"] .panel-header h3,
[data-theme="light"] .chart-box h3,
[data-theme="light"] .tab-header h2,
[data-theme="light"] .settings-section h3,
[data-theme="light"] .form-group label,
[data-theme="light"] .pivot-tab,
[data-theme="light"] .kanban-card-title,
[data-theme="light"] #topbar-title,
[data-theme="light"] .login-title,
[data-theme="light"] .msg-bubble {
  color: var(--text-1);
}

[data-theme="light"] .stat-label,
[data-theme="light"] .tab-subtitle,
[data-theme="light"] .text-secondary,
[data-theme="light"] td {
  color: var(--text-2);
}

/* Fix chart text in light mode */
[data-theme="light"] .chart-box canvas {
  filter: none;
}
```

Also update Chart.js color options in dashboard.js.
In both `renderTaskChart()` and `renderPOChart()`, add to options:
```javascript
plugins: {
  legend: {
    labels: {
      color: getComputedStyle(document.documentElement)
        .getPropertyValue('--text-2').trim() || '#64748b'
    }
  }
},
scales: {
  x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-3').trim() } },
  y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-3').trim() } }
}
```

---

## FIX 10 — navigateTo() UPDATE

Update `navigateTo()` in the inline script to always apply i18n and update topbar:

```javascript
function navigateTo(view) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show selected view
  const viewEl  = document.getElementById('view-' + view);
  const navItem = document.querySelector(`[data-view="${view}"]`);
  if (viewEl)  viewEl.classList.add('active');
  if (navItem) navItem.classList.add('active');

  // Update topbar title with translation
  const titleMap = {
    dashboard:  'dashboard',
    tasks:      'tasks',
    pos:        'purchase_orders',
    milestones: 'milestones',
    expenses:   'expenses',
    chat:       'team_chat',
    settings:   'settings'
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl && titleMap[view]) titleEl.textContent = t(titleMap[view]);

  // Load data for view
  const sheetMap = {
    tasks:      'Tasks',
    pos:        'POs',
    milestones: 'Milestones',
    expenses:   'Expenses'
  };

  if (view === 'dashboard')      loadDashboard();
  else if (sheetMap[view])       loadTable(sheetMap[view]);
  else if (view === 'chat')      loadChat();
  else if (view === 'settings')  loadSettings();

  // Re-apply translations to the newly shown view
  applyLanguage();
}
```

---

## FINAL CHECKS

After ALL changes above, do these verification steps:

1. Search for any hardcoded color `#ffffff` or `white` on text elements — replace with `var(--text-1)`
2. Search for any hardcoded color `#000000` or `black` on text elements — replace with `var(--text-1)`
3. Confirm `applyLanguage()` is called in `setLanguage()`, `navigateTo()`, and `handleCredentialResponse()`
4. Confirm `initLanguage()` is the FIRST function called in `window.onload`
5. Confirm `initTheme()` applies dark by default: `const saved = localStorage.getItem('tt_theme') || 'dark'`
6. Confirm profile dropdown has NO hardcoded `right: 1.25rem` in CSS (it uses JS positioning now)
7. Confirm "Open Google Sheet" button is completely gone from index.html

## SCRIPT LOAD ORDER (verify this is correct in index.html)
```
i18n.js → config.js → cache.js → api.js → tables.js → dashboard.js → kanban.js → chat.js → inline script
```

## AFTER ALL CHANGES
List every file modified. Then remind user to:
- Run: `git add . && git commit -m "dashboard fix + RTL + compact cards" && git push`
- Netlify will auto-deploy in ~30 seconds
