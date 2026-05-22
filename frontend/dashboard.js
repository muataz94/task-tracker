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

    animateCountUp('stat-open',     dashData.taskSummary.open);
    animateCountUp('stat-overdue',  dashData.taskSummary.overdue);
    animateCountUp('stat-spend',    dashData.poSpend || 0,       cPre, cSuf);
    animateCountUp('stat-progress', dashData.avgProgress || 0,   '',   '%');
    animateCountUp('stat-expenses', dashData.totalExpenses || 0, cPre, cSuf);

    renderTaskChart(dashData.taskSummary);
    renderPOChart(dashData.poByStatus);
    startDashboardRefresh();

    const tasks    = dashData.tasks    || [];
    const expenses = dashData.expenses || [];

    const recentTasks = tasks
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 5);
    renderRecentTasks(recentTasks);

    const recentExpenses = expenses
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 5);
    renderRecentExpenses(recentExpenses);

    const milestones = (dashData.milestones || []).slice(0, 5);
    renderMilestoneProgress(milestones);

    renderActivityFeed(tasks, expenses);

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
  el.innerHTML = tasks.map(t => {
    const priority = t.priority || '';
    const dueDate  = t.due_date ? String(t.due_date).split('T')[0] : '';
    return `
    <div class="recent-item">
      <div class="recent-item-left">
        <span class="badge badge-${t.status || 'open'}">${(t.status || 'open').replace(/_/g,' ')}</span>
        ${priority ? `<span class="badge badge-${priority}" style="font-size:10px;">${priority}</span>` : ''}
        <span class="recent-item-title">${t.title || '—'}</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;margin-left:8px;">
        ${t.assignee ? `<span class="recent-item-meta">${t.assignee}</span>` : ''}
        ${dueDate    ? `<span class="recent-item-meta" style="font-size:11px;">${dueDate}</span>` : ''}
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

function renderTaskChart(summary) {
  const canvas = document.getElementById('chart-tasks');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (taskChart) taskChart.destroy();
  taskChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Open', 'In Progress', 'Done', 'Overdue'],
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
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: { size: 11, family: 'Inter, sans-serif' },
            color: 'rgba(255,255,255,0.55)',
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15,10,30,0.92)',
          borderColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          titleColor: 'rgba(255,255,255,0.9)',
          bodyColor: 'rgba(255,255,255,0.65)',
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
  if (poChart) poChart.destroy();
  poChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Draft', 'Submitted', 'Received', 'Cancelled'],
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
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: { size: 11, family: 'Inter, sans-serif' },
            color: 'rgba(255,255,255,0.55)',
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15,10,30,0.92)',
          borderColor: 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          titleColor: 'rgba(255,255,255,0.9)',
          bodyColor: 'rgba(255,255,255,0.65)',
          padding: 10
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.04)', drawBorder: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.06)', drawBorder: false }
        }
      }
    }
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
