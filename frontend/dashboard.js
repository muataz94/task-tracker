let taskChart = null;
let poChart   = null;
let dashboardRefreshTimer = null;

function startDashboardRefresh() {
  stopDashboardRefresh();
  const prefs    = JSON.parse(localStorage.getItem('tt_prefs') || '{}');
  const interval = parseInt(prefs.refreshInterval || '0', 10);
  if (interval > 0) {
    dashboardRefreshTimer = setInterval(loadDashboard, interval * 1000);
  }
}

function stopDashboardRefresh() {
  if (dashboardRefreshTimer) { clearInterval(dashboardRefreshTimer); dashboardRefreshTimer = null; }
}

async function loadDashboard() {
  const statIds = ['stat-open','stat-overdue','stat-spend','stat-progress','stat-expenses'];
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '...';
  });

  try {
    const dashData = await getDashboard();

    // Populate table caches from dashboard data — visiting Tasks/Expenses/Milestones tabs is instant
    if (dashData.tasks)      { cacheSet('Tasks',      { rows: dashData.tasks });      if (typeof tableData !== 'undefined') tableData['Tasks']      = dashData.tasks; }
    if (dashData.expenses)   { cacheSet('Expenses',   { rows: dashData.expenses });   if (typeof tableData !== 'undefined') tableData['Expenses']   = dashData.expenses; }
    if (dashData.milestones) { cacheSet('Milestones', { rows: dashData.milestones }); if (typeof tableData !== 'undefined') tableData['Milestones'] = dashData.milestones; }

    const prefs = JSON.parse(localStorage.getItem('tt_prefs') || '{}');
    const _cPre = { USD: '$', EUR: '€', GBP: '£', IQD: '' };
    const _cSuf = { IQD: ' IQD' };
    const cPre  = _cPre[prefs.currency] !== undefined ? _cPre[prefs.currency] : ((prefs.currency || 'USD') + ' ');
    const cSuf  = _cSuf[prefs.currency] || '';

    animateCountUp('stat-open',    dashData.taskSummary.open);
    animateCountUp('stat-overdue', dashData.taskSummary.overdue);
    animateCountUp('stat-spend',      dashData.poSpend || 0,       cPre, cSuf);
    animateCountUp('stat-progress',   dashData.avgProgress || 0,   '',   '%');
    animateCountUp('stat-expenses',   dashData.totalExpenses || 0, cPre, cSuf);

    window._lastDashData = dashData;
    renderTaskChart(dashData.taskSummary);
    renderPOChart(dashData.poByStatus);
    startDashboardRefresh();

    const tasks      = dashData.tasks      || [];
    const expenses   = dashData.expenses   || [];
    const milestones = dashData.milestones || [];

    const recentTasks = tasks.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8);
    renderRecentTasks(recentTasks);

    const recentExpenses = expenses.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);
    renderRecentExpenses(recentExpenses);

    renderMilestoneProgress(milestones.slice(0, 5));
    renderPivotTasks(tasks);
    renderPivotExpenses(expenses);
    renderPivotActivity(tasks, expenses, milestones);
    updateOverdueBadge(tasks);

    const countEl = document.getElementById('pivot-count');
    if (countEl) countEl.textContent = Math.min(tasks.length, 7) + ' ' + t('records');

    const tasksSub = document.getElementById('tasks-subtitle');
    if (tasksSub) tasksSub.textContent = (tasks.length || 0) + ' total tasks';

    renderActivityFeed(tasks, expenses);
    renderDashboardOverdueReminders(tasks);
    // Background-fetch POs for overdue panel
    const cachedPOs = tableData['POs'];
    if (cachedPOs && cachedPOs.length) {
      renderDashOverduePanel('pos', cachedPOs, false);
      syncOverdueRowVisibility();
    } else {
      getAll('POs').then(r => {
        tableData['POs'] = r.rows || [];
        renderDashOverduePanel('pos', tableData['POs'], false);
        syncOverdueRowVisibility();
      }).catch(() => {});
    }

  } catch (e) {
    console.error('Dashboard error:', e);
    statIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = 'API Error';
        el.style.fontSize = '13px';
      }
    });
    // Show retry button in first stat card area
    const firstStat = document.getElementById('stat-open');
    if (firstStat) {
      const retryEl = document.createElement('div');
      retryEl.style.cssText = 'margin-top:8px';
      retryEl.innerHTML = '<button onclick="loadDashboard()" style="background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);color:#c4b5fd;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-family:Inter,sans-serif;">Retry</button>';
      firstStat.parentNode.appendChild(retryEl);
    }
  }
}

function renderRecentTasks(tasks) {
  const el = document.getElementById('recent-tasks-list');
  if (!el) return;
  if (!tasks.length) { el.innerHTML = '<p class="empty">No tasks yet</p>'; return; }
  const SM = { overdue: 'overdue_status' };
  el.innerHTML = tasks.map(task => {
    const priority = task.priority || '';
    const dueDate  = task.due_date ? String(task.due_date).split('T')[0] : '';
    const sk = SM[task.status || 'open'] || (task.status || 'open');
    const sLabel = typeof window.t === 'function' ? window.t(sk) || sk.replace(/_/g,' ') : sk.replace(/_/g,' ');
    const pLabel = priority && typeof window.t === 'function' ? window.t(priority) || priority : priority;
    return `
    <div class="recent-item">
      <div class="recent-item-left">
        <span class="badge badge-${task.status || 'open'}">${sLabel}</span>
        ${priority ? `<span class="badge badge-${priority}" style="font-size:10px;">${pLabel}</span>` : ''}
        <span class="recent-item-title">${task.title || '—'}</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;margin-left:8px;">
        ${task.assignee ? `<span class="recent-item-meta">${task.assignee}</span>` : ''}
        ${dueDate       ? `<span class="recent-item-meta" style="font-size:11px;">${dueDate}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderRecentExpenses(expenses) {
  const el = document.getElementById('recent-expenses-list');
  if (!el) return;
  if (!expenses.length) { el.innerHTML = '<p class="empty">No expenses yet</p>'; return; }
  el.innerHTML = expenses.map(e => `
    <div class="recent-item">
      <div class="recent-item-left">
        <span class="recent-item-category">${e.category || '—'}</span>
        <span class="recent-item-title">${e.description || ''}</span>
      </div>
      <span class="recent-item-amount">${e.currency || ''} ${Number(e.amount || 0).toLocaleString()}</span>
    </div>`).join('');
}

function renderMilestoneProgress(milestones) {
  const el = document.getElementById('milestone-progress-list');
  if (!el) return;
  if (!milestones.length) { el.innerHTML = '<p class="empty">No milestones yet</p>'; return; }
  el.innerHTML = milestones.map(m => {
    const pct        = Math.min(Math.max(parseInt(m.completion_pct) || 0, 0), 100);
    const targetDate = m.target_date ? String(m.target_date).split('T')[0] : '';
    // Color-code fill: red if overdue/blocked, green if done, purple otherwise
    const status = (m.status || '').toLowerCase();
    let fillColor = 'var(--grad-violet)';
    if (status === 'completed')                   fillColor = 'var(--grad-green)';
    else if (status === 'blocked')                fillColor = 'linear-gradient(135deg,#ef4444,#dc2626)';
    return `
      <div class="milestone-item">
        <div class="milestone-header">
          <div style="min-width:0;">
            <div class="milestone-name">${m.milestone_name || '—'}</div>
            ${m.project     ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px;">${m.project}</div>` : ''}
            ${targetDate    ? `<div style="font-size:11px;color:var(--text-3);">Due: ${targetDate}</div>` : ''}
          </div>
          <span class="milestone-pct">${pct}%</span>
        </div>
        <div class="milestone-bar">
          <div class="milestone-fill" style="width:${pct}%;background:${fillColor}"></div>
        </div>
      </div>`;
  }).join('');
}

function getChartColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text:  isLight ? 'rgba(10,10,30,0.55)'    : 'rgba(255,255,255,0.55)',
    tick:  isLight ? 'rgba(10,10,30,0.45)'    : 'rgba(255,255,255,0.4)',
    grid:  isLight ? 'rgba(99,102,241,0.10)'  : 'rgba(255,255,255,0.06)',
    ttBg:  isLight ? 'rgba(245,246,255,0.98)' : 'rgba(15,10,30,0.92)',
    ttBdr: isLight ? 'rgba(99,102,241,0.20)'  : 'rgba(255,255,255,0.15)',
    ttTtl: isLight ? 'rgba(10,10,30,0.9)'     : 'rgba(255,255,255,0.9)',
    ttBdy: isLight ? 'rgba(10,10,30,0.65)'    : 'rgba(255,255,255,0.65)',
  };
}

function refreshChartsFromCache() {
  if (!window._lastDashData) return;
  renderTaskChart(window._lastDashData.taskSummary);
  renderPOChart(window._lastDashData.poByStatus);
}

function renderTaskChart(summary) {
  const canvas = document.getElementById('chart-tasks');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const c = getChartColors();
  if (taskChart) taskChart.destroy();
  taskChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [t('open'), t('in_progress'), t('done'), t('overdue_status')],
      datasets: [{
        data: [
          summary.open        || 0,
          summary.in_progress || 0,
          summary.done        || 0,
          summary.overdue     || 0
        ],
        backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#ef4444'],
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.05)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: { size: 10, family: 'Inter, sans-serif' },
            color: c.text,
            padding: 10,
            usePointStyle: true,
            pointStyleWidth: 7
          }
        },
        tooltip: {
          backgroundColor: c.ttBg,
          borderColor: c.ttBdr,
          borderWidth: 1,
          titleColor: c.ttTtl,
          bodyColor: c.ttBdy,
          padding: 10
        }
      },
      cutout: '65%'
    }
  });
}

function renderPOChart(byStatus) {
  const canvas = document.getElementById('chart-pos');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const c = getChartColors();
  if (poChart) poChart.destroy();
  poChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [t('draft'), t('submitted'), t('received'), t('cancelled')],
      datasets: [{
        label: 'POs',
        data: [
          byStatus.draft     || 0,
          byStatus.submitted || 0,
          byStatus.received  || 0,
          byStatus.cancelled || 0
        ],
        backgroundColor: [
          'rgba(255,255,255,0.12)',
          '#6366f1',
          '#10b981',
          '#ef4444'
        ],
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: { size: 10, family: 'Inter, sans-serif' },
            color: c.text,
            padding: 10,
            usePointStyle: true,
            pointStyleWidth: 7
          }
        },
        tooltip: {
          backgroundColor: c.ttBg,
          borderColor: c.ttBdr,
          borderWidth: 1,
          titleColor: c.ttTtl,
          bodyColor: c.ttBdy,
          padding: 10
        }
      },
      scales: {
        x: {
          ticks: { color: c.tick, font: { size: 11 } },
          grid:  { color: c.grid, drawBorder: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: c.tick, font: { size: 11 } },
          grid:  { color: c.grid, drawBorder: false }
        }
      }
    }
  });
}

let pivotTasksData    = [];
let pivotExpensesData = [];
let pivotActivityLog  = [];

function switchPivotTab(tab, btn) {
  document.querySelectorAll('.pivot-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pivot-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
  btn.classList.add('active');
  const content = document.getElementById('pivot-' + tab);
  if (content) { content.classList.remove('hidden'); content.classList.add('active'); }
  const counts = { tasks: pivotTasksData.length, expenses: pivotExpensesData.length, activity: pivotActivityLog.length };
  const countEl = document.getElementById('pivot-count');
  if (countEl) countEl.textContent = (counts[tab] || 0) + ' ' + t('records');
}

function renderPivotTasks(tasks) {
  pivotTasksData = (tasks || [])
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 7);
  const tbody = document.getElementById('pivot-tasks-body');
  if (!tbody) return;
  if (!pivotTasksData.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center;padding:1rem;">No tasks yet</td></tr>';
    return;
  }
  const today = new Date();
  tbody.innerHTML = pivotTasksData.map(task => {
    const due    = task.due_date ? new Date(task.due_date) : null;
    const isLate = due && due < today && task.status !== 'done';
    const statusKey   = task.status === 'overdue' ? 'overdue_status' : (task.status || '');
    const statusLabel = t(statusKey) || (task.status || '').replace(/_/g, ' ');
    const priorityLabel = t(task.priority || '') || (task.priority || '—');
    return `<tr style="${isLate ? 'background:rgba(239,68,68,0.04);' : ''}">
      <td style="font-weight:500;color:var(--text-1);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${task.title || '—'}</td>
      <td><span class="badge badge-${task.status}">${statusLabel}</span></td>
      <td><span class="badge badge-${task.priority}">${priorityLabel}</span></td>
      <td style="color:var(--text-2);">${task.assignee || '—'}</td>
      <td style="color:${isLate ? 'var(--accent-red)' : 'var(--text-2)'};">${due ? due.toLocaleDateString() : '—'}</td>
    </tr>`;
  }).join('');
}

function renderPivotExpenses(expenses) {
  pivotExpensesData = (expenses || [])
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    .slice(0, 7);
  const tbody = document.getElementById('pivot-expenses-body');
  if (!tbody) return;
  if (!pivotExpensesData.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty" style="text-align:center;padding:1rem;">No expenses yet</td></tr>';
    return;
  }
  tbody.innerHTML = pivotExpensesData.map(e => `
    <tr>
      <td style="color:var(--text-1);font-weight:500;">${e.category || '—'}</td>
      <td style="color:var(--text-2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.description || '—'}</td>
      <td style="color:var(--accent-amber);font-weight:600;">${e.currency || ''} ${Number(e.amount || 0).toLocaleString()}</td>
      <td style="color:var(--text-3);">${e.date ? new Date(e.date).toLocaleDateString() : '—'}</td>
    </tr>`).join('');
}

function renderPivotActivity(tasks, expenses, milestones) {
  const items = [];
  (tasks || []).forEach(r => {
    if (r.created_by && r.created_at) items.push({ who: r.created_by, what: '✓ ' + (r.title || 'Task'), when: r.created_at });
    if (r.updated_at && r.updated_at !== r.created_at) items.push({ who: r.created_by || '—', what: '✎ ' + (r.title || 'Task'), when: r.updated_at });
  });
  (expenses || []).forEach(r => {
    if (r.created_by && r.created_at) items.push({ who: r.created_by, what: '$ ' + (r.description || r.category || 'Expense'), when: r.created_at });
  });
  (milestones || []).forEach(r => {
    if (r.created_by && r.created_at) items.push({ who: r.created_by, what: '◆ ' + (r.milestone_name || 'Milestone'), when: r.created_at });
  });
  pivotActivityLog = items.sort((a, b) => new Date(b.when) - new Date(a.when)).slice(0, 10);
  const tbody = document.getElementById('pivot-activity-body');
  if (!tbody) return;
  if (!pivotActivityLog.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty" style="text-align:center;padding:1rem;">No activity yet</td></tr>';
    return;
  }
  tbody.innerHTML = pivotActivityLog.map(a => {
    const when    = a.when ? new Date(a.when) : null;
    const timeStr = when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + when.toLocaleDateString() : '—';
    const emailShort = (a.who || '').split('@')[0];
    return `<tr>
      <td style="color:var(--accent);font-weight:500;font-size:11px;">${emailShort}</td>
      <td style="color:var(--text-2);">${a.what}</td>
      <td style="color:var(--text-3);white-space:nowrap;font-size:11px;">${timeStr}</td>
    </tr>`;
  }).join('');
}

function updateOverdueBadge(tasks) {
  const count = (tasks || []).filter(t => t.status === 'overdue').length;
  ['overdue-badge', 'tasks-overdue-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function renderActivityFeed(tasks, expenses) {
  const el = document.getElementById('activity-feed');
  if (!el) return;

  const taskItems = (tasks || []).map(t => ({
    type: 'task',
    title: t.title || '—',
    sub: (t.status || 'open').replace(/_/g, ' '),
    created_at: t.created_at || ''
  }));

  const expenseItems = (expenses || []).map(e => ({
    type: 'expense',
    title: e.description || e.category || '—',
    sub: `${e.currency || ''} ${Number(e.amount || 0).toLocaleString()}`.trim(),
    created_at: e.created_at || ''
  }));

  const combined = [...taskItems, ...expenseItems]
    .filter(item => item.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  if (!combined.length) {
    el.innerHTML = '<p class="empty">No recent activity</p>';
    return;
  }

  el.innerHTML = combined.map(item => {
    const timeStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';
    const icon = item.type === 'task'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`;
    return `
      <div class="activity-item">
        <div class="activity-icon activity-icon-${item.type}">${icon}</div>
        <div class="activity-text">
          <span class="activity-title">${item.title}</span>
          <span class="activity-sub">${item.sub}</span>
        </div>
        <span class="activity-time">${timeStr}</span>
      </div>`;
  }).join('');
}

// ── Dashboard overdue reminder panels ───────────────────────────────────────

function renderDashboardOverdueReminders(tasks) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = (tasks || []).filter(r =>
    r.status !== 'done' && r.due_date &&
    new Date(String(r.due_date).split('T')[0]) < today
  );
  renderDashOverduePanel('tasks', overdue, true);
  syncOverdueRowVisibility();
  // Show enable-notifications button if permission not granted
  updateNotifBtn('Tasks');
}

function renderDashOverduePanel(type, rows, isTaskPanel) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let overdue;
  if (isTaskPanel) {
    overdue = rows; // already filtered by caller
  } else {
    overdue = (rows || []).filter(r =>
      !['received', 'cancelled'].includes(r.status) &&
      r.expected_delivery &&
      new Date(String(r.expected_delivery).split('T')[0]) < today
    );
  }

  const countEl = document.getElementById('dop-' + type + '-count');
  const listEl  = document.getElementById('dop-' + type + '-list');
  if (!countEl || !listEl) return;

  countEl.textContent = overdue.length;
  countEl.style.color = overdue.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)';

  if (!overdue.length) {
    listEl.innerHTML = '<div class="dop-empty">No overdue items</div>';
    if (type === 'pos') updateNotifBtn('POs');
    return;
  }

  const shown = overdue.slice(0, 4);
  listEl.innerHTML = shown.map(r => {
    const dateStr = isTaskPanel ? (r.due_date || '') : (r.expected_delivery || '');
    const daysAgo = dateStr
      ? Math.floor((today - new Date(String(dateStr).split('T')[0])) / 86400000)
      : 0;
    const name = isTaskPanel
      ? (r.title || '—')
      : (r.po_number ? r.po_number + (r.supplier ? ' · ' + r.supplier : '') : (r.supplier || '—'));
    return `
      <div class="dop-item">
        <div class="dop-item-name">${escapeHtml(String(name))}</div>
        <span class="dop-days-badge">${daysAgo}d overdue</span>
      </div>`;
  }).join('');

  if (overdue.length > 4) {
    listEl.innerHTML += `<div class="dop-more">+${overdue.length - 4} more</div>`;
  }

  if (type === 'pos') updateNotifBtn('POs');
}

function syncOverdueRowVisibility() {
  const row = document.getElementById('dash-overdue-row');
  if (!row) return;
  const tasksCount = parseInt(document.getElementById('dop-tasks-count')?.textContent || '0') || 0;
  const posCount   = parseInt(document.getElementById('dop-pos-count')?.textContent   || '0') || 0;
  // Always show the row — even 0 is informative
  row.style.display = '';
}

function updateNotifBtn(sheetName) {
  if (!('Notification' in window)) return;
  const btnId = sheetName === 'Tasks' ? 'dop-notif-tasks' : 'dop-notif-pos';
  const btn   = document.getElementById(btnId);
  if (!btn) return;
  if (Notification.permission === 'granted') {
    btn.classList.add('hidden');
  } else {
    btn.classList.remove('hidden');
  }
}

function requestNotifPermission(sheetName) {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    if (perm === 'granted') {
      localStorage.setItem('tt_notif_granted', 'true');
      new Notification('Task Tracker', { body: 'Overdue notifications enabled ✓' });
      updateNotifBtn(sheetName);
    }
  });
}
