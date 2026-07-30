// ─── Procurement Analytics ───────────────────────────────────────────────────

let _spendByVendorChart = null;
let _monthlySpendChart  = null;
let _poStatusChart      = null;

function loadAnalytics() {
  const wrap = document.getElementById('analytics-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="analytics-grid-2col" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="glass" style="border-radius:var(--r-md);padding:1rem;">
        <div style="font-size:12px;font-weight:700;color:var(--text-1);margin-bottom:10px;">Spend by Vendor (Top 10)</div>
        <div style="height:280px;"><canvas id="chart-spend-vendor"></canvas></div>
      </div>
      <div class="glass" style="border-radius:var(--r-md);padding:1rem;">
        <div style="font-size:12px;font-weight:700;color:var(--text-1);margin-bottom:10px;">PO Status Distribution</div>
        <div style="height:280px;"><canvas id="chart-po-status"></canvas></div>
      </div>
    </div>
    <div class="glass" style="border-radius:var(--r-md);padding:1rem;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text-1);margin-bottom:10px;">Monthly Spend Trend (Last 12 Months)</div>
      <div style="height:280px;"><canvas id="chart-monthly-spend"></canvas></div>
    </div>
    <div class="glass" style="border-radius:var(--r-md);padding:1rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--text-1);">Top 5 Vendors by Spend</div>
        <button class="btn-export" onclick="typeof exportFullWorkbook==='function' && exportFullWorkbook()">Export Full Workbook</button>
      </div>
      <div id="analytics-top-vendors"></div>
    </div>`;

  renderSpendByVendorChart();
  renderPOStatusChart();
  renderMonthlySpendChart();
  renderTopVendorsTable();
}

function _analyticsVendorSpendMap() {
  const map = {};
  const pos = (typeof tableData !== 'undefined' && tableData['POs']) || [];
  pos.forEach(p => {
    const vendor = p.supplier || p.vendor || 'Unknown';
    const val = parseFloat(p.total_value) > 0 ? parseFloat(p.total_value) : (parseFloat(p.quantity)||0) * (parseFloat(p.unit_price)||0);
    map[vendor] = (map[vendor] || 0) + val;
  });
  (typeof _allInvoices !== 'undefined' ? _allInvoices : []).forEach(inv => {
    const vendor = inv.vendor || 'Unknown';
    map[vendor] = (map[vendor] || 0) + (parseFloat(inv.amount) || 0);
  });
  return map;
}

function renderSpendByVendorChart() {
  const canvas = document.getElementById('chart-spend-vendor');
  if (!canvas || typeof Chart === 'undefined') return;
  const c = typeof getChartColors === 'function' ? getChartColors() : { text:'#888', tick:'#888', grid:'rgba(128,128,128,0.1)' };
  const map = _analyticsVendorSpendMap();
  const top = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 10);

  if (_spendByVendorChart) _spendByVendorChart.destroy();
  _spendByVendorChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: top.map(([v]) => v),
      datasets: [{ data: top.map(([,v]) => v), backgroundColor: '#818cf8', borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: c.tick }, grid: { color: c.grid } },
        y: { ticks: { color: c.tick }, grid: { display: false } }
      }
    }
  });
}

function renderPOStatusChart() {
  const canvas = document.getElementById('chart-po-status');
  if (!canvas || typeof Chart === 'undefined') return;
  const c = typeof getChartColors === 'function' ? getChartColors() : { text:'#888' };
  const dash = (typeof cacheGet === 'function' ? cacheGet('dashboard') : null)?.data || window._lastDashData || {};
  const byStatus = dash.poByStatus || { draft:0, submitted:0, received:0, cancelled:0 };

  if (_poStatusChart) _poStatusChart.destroy();
  _poStatusChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Draft','Submitted','Received','Cancelled'],
      datasets: [{
        data: [byStatus.draft||0, byStatus.submitted||0, byStatus.received||0, byStatus.cancelled||0],
        backgroundColor: ['#6b7280','#3b82f6','#10b981','#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: c.text, padding: 12, font: { size: 11 } } } }
    }
  });
}

function renderMonthlySpendChart() {
  const canvas = document.getElementById('chart-monthly-spend');
  if (!canvas || typeof Chart === 'undefined') return;
  const c = typeof getChartColors === 'function' ? getChartColors() : { text:'#888', tick:'#888', grid:'rgba(128,128,128,0.1)' };

  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), label: d.toLocaleDateString('en-US',{month:'short',year:'2-digit'}) });
  }
  const totals = Object.fromEntries(months.map(m => [m.key, 0]));
  (typeof _allInvoices !== 'undefined' ? _allInvoices : []).forEach(inv => {
    if (!inv.invoice_date) return;
    const d = new Date(inv.invoice_date);
    if (isNaN(d)) return;
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if (key in totals) totals[key] += parseFloat(inv.amount) || 0;
  });

  if (_monthlySpendChart) _monthlySpendChart.destroy();
  _monthlySpendChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        data: months.map(m => totals[m.key]),
        borderColor: '#818cf8', backgroundColor: 'rgba(129,140,248,0.15)',
        fill: true, tension: 0.35, pointRadius: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: c.tick }, grid: { display: false } },
        y: { ticks: { color: c.tick }, grid: { color: c.grid } }
      }
    }
  });
}

function renderTopVendorsTable() {
  const el = document.getElementById('analytics-top-vendors');
  if (!el) return;
  const map = _analyticsVendorSpendMap();
  const top = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 5);
  if (!top.length) { el.innerHTML = '<p style="color:var(--text-3);font-size:12px;">No spend data yet.</p>'; return; }
  el.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Vendor</th><th style="text-align:right;">Total Spend</th></tr></thead>
        <tbody>
          ${top.map(([vendor, total]) => `
            <tr>
              <td style="font-size:12px;font-weight:600;">${escapeHtml(vendor)}</td>
              <td style="text-align:right;font-size:12px;">${total.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
