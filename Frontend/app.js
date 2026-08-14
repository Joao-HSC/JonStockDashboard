const API_BASE = window.location.origin;

const summaryFields = {
  date: 'date',
  total: 'total',
  stocks: 'stocks',
  cash: 'cash',
  crypto: 'crypto',
  change: 'change',
};

function isNegative(value) {
  return typeof value === 'string' && value.trim().startsWith('-');
}

async function loadLatest() {
  try {
    const res = await fetch(`${API_BASE}/portfolio/latest`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load latest snapshot');

    for (const [field, key] of Object.entries(summaryFields)) {
      const card = document.querySelector(`.summary-card[data-field="${field}"] .summary-value`);
      if (!card) continue;
      card.textContent = data[key] ?? '—';
      card.classList.remove('positive', 'negative');
      if (field === 'change') {
        card.classList.add(isNegative(data[key]) ? 'negative' : 'positive');
      }
    }
  } catch (err) {
    console.error('Could not load latest snapshot:', err);
  }
}

function setMessage(text, kind) {
  const el = document.getElementById('form-message');
  el.textContent = text;
  el.classList.remove('success', 'error');
  if (kind) el.classList.add(kind);
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = document.getElementById('submit-btn');
  const formData = new FormData(form);

  const body = {};
  for (const [key, value] of formData.entries()) {
    body[key] = key === 'note' ? value : parseFloat(value);
  }

  submitBtn.disabled = true;
  setMessage('Saving…', null);

  try {
    const res = await fetch(`${API_BASE}/portfolio/add-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save snapshot');

    setMessage(`Saved snapshot for ${data.date}.`, 'success');
    form.reset();
    await loadLatest();
    chartsLoaded = false;
    performanceLoaded = false;
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

let chartsLoaded = false;

async function loadCharts() {
  const status = document.getElementById('charts-status');
  const totalContainer = document.getElementById('chart-total-container');
  const assetsContainer = document.getElementById('chart-assets-container');

  status.hidden = false;
  status.textContent = 'Loading history…';
  totalContainer.hidden = true;
  assetsContainer.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/portfolio/history`);
    const history = await res.json();
    if (!res.ok) throw new Error(history.error || 'Failed to load history');

    if (!history.length) {
      status.textContent = 'No snapshots yet — add one to see your growth charts.';
      return;
    }

    renderPortfolioCharts(totalContainer, assetsContainer, history);
    status.hidden = true;
    chartsLoaded = true;
  } catch (err) {
    status.textContent = `Could not load charts: ${err.message}`;
  }
}

let performanceLoaded = false;

function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

async function loadPerformance() {
  const status = document.getElementById('performance-status');
  const tiles = document.getElementById('performance-tiles');
  const period = document.getElementById('performance-period');

  status.hidden = false;
  status.textContent = 'Loading performance…';
  tiles.style.display = 'none';
  period.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/portfolio/performance`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load performance metrics');

    const cagrEl = tiles.querySelector('[data-field="cagr"] .perf-value');
    cagrEl.textContent = data.cagr == null ? 'n/a' : formatPercent(data.cagr);
    cagrEl.classList.toggle('positive', data.cagr > 0);
    cagrEl.classList.toggle('negative', data.cagr < 0);

    const ddEl = tiles.querySelector('[data-field="max_drawdown"] .perf-value');
    ddEl.textContent = formatPercent(data.max_drawdown);
    ddEl.classList.toggle('negative', data.max_drawdown < 0);
    tiles.querySelector('[data-field="max_drawdown"] .perf-description').textContent =
      data.max_drawdown === 0 ? 'No decline observed yet' : `From ${data.max_drawdown_peak_date} to ${data.max_drawdown_trough_date}`;

    const sharpeEl = tiles.querySelector('[data-field="sharpe_ratio"] .perf-value');
    sharpeEl.textContent = data.sharpe_ratio == null ? 'n/a' : data.sharpe_ratio.toFixed(2);
    sharpeEl.classList.toggle('positive', data.sharpe_ratio > 0);
    sharpeEl.classList.toggle('negative', data.sharpe_ratio < 0);
    tiles.querySelector('[data-field="sharpe_ratio"] .perf-description').textContent =
      `Monthly returns, annualized, ${formatPercent(data.risk_free_rate, 2)} risk-free rate assumed`;

    period.textContent = `Based on ${data.days} days of history: ${data.start_date} → ${data.end_date}.`;

    status.hidden = true;
    tiles.style.display = '';
    period.hidden = false;
    performanceLoaded = true;
  } catch (err) {
    status.textContent = `Could not load performance metrics: ${err.message}`;
  }
}

function setActiveTab(name) {
  const tabs = {
    add: { btn: document.getElementById('tab-btn-add'), panel: document.getElementById('tab-add') },
    charts: { btn: document.getElementById('tab-btn-charts'), panel: document.getElementById('tab-charts') },
    performance: { btn: document.getElementById('tab-btn-performance'), panel: document.getElementById('tab-performance') },
  };

  for (const [key, { btn, panel }] of Object.entries(tabs)) {
    const active = key === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
    panel.hidden = !active;
  }

  if (name === 'charts' && !chartsLoaded) {
    loadCharts();
  }
  if (name === 'performance' && !performanceLoaded) {
    loadPerformance();
  }
}

document.getElementById('snapshot-form').addEventListener('submit', handleSubmit);
document.getElementById('tab-btn-add').addEventListener('click', () => setActiveTab('add'));
document.getElementById('tab-btn-charts').addEventListener('click', () => setActiveTab('charts'));
document.getElementById('tab-btn-performance').addEventListener('click', () => setActiveTab('performance'));
loadLatest();
