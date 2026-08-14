const SVG_NS = 'http://www.w3.org/2000/svg';

function formatEUR(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits,
  }).format(value);
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAxisDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function niceTicks(min, max, count = 5) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  let step;
  if (residual > 5) step = 10 * mag;
  else if (residual > 2) step = 5 * mag;
  else if (residual > 1) step = 2 * mag;
  else step = mag;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = niceMin; t <= niceMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return { ticks, min: niceMin, max: niceMax };
}

function el(tag, attrs = {}, ns = null) {
  const node = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

/**
 * series: [{ key, label, color, values: number[] }]
 * dates: string[]  (same length as each series' values)
 */
function renderLineChart(container, { title, dates, series }) {
  container.replaceChildren();
  container.hidden = false;

  const WIDTH = 720;
  const HEIGHT = 340;
  const MARGIN = { top: 20, right: 24, bottom: 36, left: 64 };
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const n = dates.length;

  const allValues = series.flatMap((s) => s.values);
  const { ticks, min: yMin, max: yMax } = niceTicks(Math.min(0, ...allValues), Math.max(...allValues));

  const xFor = (i) => (n <= 1 ? MARGIN.left + plotW / 2 : MARGIN.left + (i / (n - 1)) * plotW);
  const yFor = (v) => MARGIN.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const header = el('div', { class: 'chart-header' });
  const h3 = el('h3');
  h3.textContent = title;
  const tableToggle = el('button', { type: 'button', class: 'chart-toggle' });
  tableToggle.textContent = 'Table view';
  header.append(h3, tableToggle);
  container.appendChild(header);

  const svg = el('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: 'chart-svg',
    role: 'img',
    'aria-label': title,
  }, SVG_NS);

  // gridlines + y-axis labels
  for (const t of ticks) {
    const y = yFor(t);
    svg.appendChild(el('line', {
      x1: MARGIN.left, x2: WIDTH - MARGIN.right, y1: y, y2: y, class: 'chart-grid',
    }, SVG_NS));
    const label = el('text', { x: MARGIN.left - 10, y: y + 4, class: 'chart-axis-label', 'text-anchor': 'end' }, SVG_NS);
    label.textContent = formatEUR(t, 0);
    svg.appendChild(label);
  }

  // baseline
  svg.appendChild(el('line', {
    x1: MARGIN.left, x2: WIDTH - MARGIN.right, y1: MARGIN.top + plotH, y2: MARGIN.top + plotH, class: 'chart-baseline',
  }, SVG_NS));

  // x-axis ticks (up to 6, evenly spaced)
  const tickCount = Math.min(6, n);
  const xTickIdx = [];
  for (let k = 0; k < tickCount; k++) {
    xTickIdx.push(Math.round((k / Math.max(1, tickCount - 1)) * (n - 1)));
  }
  [...new Set(xTickIdx)].forEach((i) => {
    const label = el('text', {
      x: xFor(i), y: HEIGHT - MARGIN.bottom + 20, class: 'chart-axis-label', 'text-anchor': 'middle',
    }, SVG_NS);
    label.textContent = formatAxisDate(dates[i]);
    svg.appendChild(label);
  });

  // lines + end markers
  const lastI = n - 1;
  const ends = series.map((s) => ({ s, lx: xFor(lastI), ly: yFor(s.values[lastI]) }));

  series.forEach((s) => {
    const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
    svg.appendChild(el('path', { d, class: 'chart-line', style: `stroke:${s.color}` }, SVG_NS));
  });

  ends.forEach(({ s, lx, ly }) => {
    svg.appendChild(el('circle', { cx: lx, cy: ly, r: 5, class: 'chart-end-dot', style: `fill:${s.color}` }, SVG_NS));
  });

  // end labels: only for series whose end points don't collide vertically
  // (past the ~4-series threshold, converging lines fall back to legend + tooltip)
  const MIN_LABEL_GAP = 14;
  const sortedEnds = [...ends].sort((a, b) => a.ly - b.ly);
  const labelable = new Set();
  let lastY = -Infinity;
  sortedEnds.forEach(({ s, ly }) => {
    if (ly - lastY >= MIN_LABEL_GAP) {
      labelable.add(s.key);
      lastY = ly;
    }
  });

  ends.forEach(({ s, lx, ly }) => {
    if (!labelable.has(s.key)) return;
    const endLabel = el('text', { x: lx + 8, y: ly + 4, class: 'chart-end-label' }, SVG_NS);
    endLabel.textContent = series.length > 1 ? `${s.label} ${formatEUR(s.values[lastI], 0)}` : formatEUR(s.values[lastI], 0);
    svg.appendChild(endLabel);
  });

  // crosshair
  const crosshair = el('line', {
    x1: 0, x2: 0, y1: MARGIN.top, y2: MARGIN.top + plotH, class: 'chart-crosshair', style: 'display:none',
  }, SVG_NS);
  svg.appendChild(crosshair);

  const hoverDots = series.map((s) => el('circle', {
    r: 4.5, class: 'chart-hover-dot', style: `fill:${s.color}; display:none`,
  }, SVG_NS));
  hoverDots.forEach((dot) => svg.appendChild(dot));

  const hitRect = el('rect', {
    x: MARGIN.left, y: MARGIN.top, width: plotW, height: plotH, class: 'chart-hit-rect',
  }, SVG_NS);
  svg.appendChild(hitRect);

  container.appendChild(svg);

  // legend (multi-series only)
  if (series.length > 1) {
    const legend = el('div', { class: 'chart-legend' });
    series.forEach((s) => {
      const item = el('div', { class: 'chart-legend-item' });
      const swatch = el('span', { class: 'chart-legend-swatch', style: `background:${s.color}` });
      const text = el('span');
      text.textContent = s.label;
      item.append(swatch, text);
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  // tooltip
  const tooltip = el('div', { class: 'chart-tooltip', style: 'display:none' });
  container.appendChild(tooltip);

  function showTooltip(i, evt) {
    crosshair.setAttribute('x1', xFor(i));
    crosshair.setAttribute('x2', xFor(i));
    crosshair.style.display = '';

    hoverDots.forEach((dot, si) => {
      dot.setAttribute('cx', xFor(i));
      dot.setAttribute('cy', yFor(series[si].values[i]));
      dot.style.display = '';
    });

    tooltip.replaceChildren();
    const dateEl = el('div', { class: 'chart-tooltip-date' });
    dateEl.textContent = formatShortDate(dates[i]);
    tooltip.appendChild(dateEl);
    series.forEach((s) => {
      const row = el('div', { class: 'chart-tooltip-row' });
      const key = el('span', { class: 'chart-tooltip-key', style: `background:${s.color}` });
      const label = el('span', { class: 'chart-tooltip-label' });
      label.textContent = series.length > 1 ? s.label : 'Total';
      const val = el('span', { class: 'chart-tooltip-value' });
      val.textContent = formatEUR(s.values[i], 0);
      row.append(key, label, val);
      tooltip.appendChild(row);
    });

    tooltip.style.display = '';
    const containerRect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const scaleX = svgRect.width / WIDTH;
    const px = svgRect.left - containerRect.left + xFor(i) * scaleX;
    tooltip.style.left = `${Math.min(px + 12, containerRect.width - 160)}px`;
    tooltip.style.top = '8px';
  }

  function hideTooltip() {
    crosshair.style.display = 'none';
    hoverDots.forEach((dot) => (dot.style.display = 'none'));
    tooltip.style.display = 'none';
  }

  hitRect.addEventListener('pointermove', (evt) => {
    const svgRect = svg.getBoundingClientRect();
    const relX = ((evt.clientX - svgRect.left) / svgRect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(xFor(i) - relX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    }
    showTooltip(nearest, evt);
  });
  hitRect.addEventListener('pointerleave', hideTooltip);

  // table view toggle
  const table = el('table', { class: 'chart-table', hidden: '' });
  const thead = el('thead');
  const headRow = el('tr');
  headRow.appendChild(el('th')).textContent = 'Date';
  series.forEach((s) => {
    const th = el('th');
    th.textContent = s.label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = el('tbody');
  for (let i = n - 1; i >= 0; i--) {
    const row = el('tr');
    const dateTd = el('td');
    dateTd.textContent = dates[i];
    row.appendChild(dateTd);
    series.forEach((s) => {
      const td = el('td');
      td.textContent = formatEUR(s.values[i], 2);
      row.appendChild(td);
    });
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);

  let showingTable = false;
  tableToggle.addEventListener('click', () => {
    showingTable = !showingTable;
    svg.style.display = showingTable ? 'none' : '';
    table.hidden = !showingTable;
    if (series.length > 1) container.querySelector('.chart-legend').style.display = showingTable ? 'none' : '';
    hideTooltip();
    tableToggle.textContent = showingTable ? 'Chart view' : 'Table view';
  });
}

function renderPortfolioCharts(totalContainer, assetsContainer, history) {
  if (!history.length) return;

  const dates = history.map((h) => h.date);

  renderLineChart(totalContainer, {
    title: 'Total Portfolio Growth',
    dates,
    series: [{ key: 'total', label: 'Total', color: 'var(--series-1)', values: history.map((h) => h.total) }],
  });

  renderLineChart(assetsContainer, {
    title: 'Growth by Asset',
    dates,
    series: [
      { key: 'stocks', label: 'Stocks/ETFs', color: 'var(--series-1)', values: history.map((h) => h.stocks) },
      { key: 'crypto', label: 'Crypto', color: 'var(--series-2)', values: history.map((h) => h.crypto) },
      { key: 'cash', label: 'Cash', color: 'var(--series-3)', values: history.map((h) => h.cash) },
      { key: 'loans', label: 'Loans', color: 'var(--series-4)', values: history.map((h) => h.loans) },
    ],
  });
}
