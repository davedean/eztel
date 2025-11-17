/* global Chart */
import { telemetryState, uiState, chartRegistry, getActiveLap, getLapColor } from './state.js';
import { CHART_BASE_OPTIONS } from './config.js';
import { formatLapLabel } from './utils.js';

let setCursorDistance = () => {};
let setViewWindow = () => {};

export function initCharts(deps) {
  setCursorDistance = deps.setCursorDistance;
  setViewWindow = deps.setViewWindow;
  if (!window.Chart) return;

  Chart.register({
    id: 'sharedCursor',
    afterDatasetsDraw(chart) {
      if (uiState.cursorDistance == null) return;
      const xScale = chart.scales.x;
      if (!xScale) return;
      const xPixel = xScale.getPixelForValue(uiState.cursorDistance);
      if (Number.isNaN(xPixel)) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = '#11182733';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xPixel, chart.chartArea.top);
      ctx.lineTo(xPixel, chart.chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    }
  });
}

export function updateLaneData() {
  const visibleLaps = telemetryState.laps.filter((lap) => telemetryState.lapVisibility.has(lap.id));

  const throttleChart = ensureChart('throttle', 'throttleLane');
  throttleChart.data.datasets = visibleLaps.map((lap) => ({
    label: formatLapLabel(lap),
    borderColor: getLapColor(lap.id),
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    data: lap.samples
      .filter((s) => s.throttle != null)
      .map((s) => ({ x: s.distance, y: s.throttle }))
  }));
  applyWindowToChart(throttleChart);

  const brakeChart = ensureChart('brake', 'brakeLane');
  brakeChart.data.datasets = visibleLaps.map((lap) => ({
    label: formatLapLabel(lap),
    borderColor: getLapColor(lap.id),
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    data: lap.samples.filter((s) => s.brake != null).map((s) => ({ x: s.distance, y: s.brake }))
  }));
  applyWindowToChart(brakeChart);
}

export function applyWindowToCharts() {
  Object.values(chartRegistry).forEach((chart) => chart && applyWindowToChart(chart));
}

export function refreshCharts() {
  Object.values(chartRegistry).forEach((chart) => chart && chart.update('none'));
}

function ensureChart(key, canvasId) {
  if (chartRegistry[key]) return chartRegistry[key];
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    throw new Error(`Canvas ${canvasId} not found`);
  }
  const ctx = canvas.getContext('2d');
  const overlay = document.createElement('div');
  overlay.className = 'lane-selection';
  ctx.canvas.parentElement.appendChild(overlay);

  const chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: cloneChartOptions()
  });

  const pointerState = { active: false, start: null, end: null };

  function getXValueFromEvent(event) {
    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const xScale = chart.scales.x;
    if (!xScale) return null;
    const value = xScale.getValueForPixel(x);
    return Number.isFinite(value) ? value : null;
  }

  chart.canvas.addEventListener('mousemove', (event) => {
    const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true);
    const xValue = getXValueFromEvent(event);
    if (points.length) {
      const first = points[0];
      const point = chart.data.datasets[first.datasetIndex].data[first.index];
      setCursorDistance(point.x);
    } else if (xValue != null) {
      setCursorDistance(xValue);
    } else {
      setCursorDistance(null);
    }

    if (pointerState.active && xValue != null) {
      pointerState.end = xValue;
      setOverlayRange(chart, pointerState.start, pointerState.end, 0.4);
    }
  });

  chart.canvas.addEventListener('mouseleave', () => {
    setCursorDistance(null);
    if (!pointerState.active) {
      syncLaneSelectionOverlay(chart);
    }
  });

  chart.canvas.addEventListener('pointerdown', (event) => {
    const xValue = getXValueFromEvent(event);
    if (xValue == null) return;
    chart.canvas.setPointerCapture(event.pointerId);
    pointerState.active = true;
    pointerState.start = xValue;
    pointerState.end = xValue;
    setOverlayRange(chart, pointerState.start, pointerState.end, 0.5);
    setCursorDistance(xValue);
  });

  chart.canvas.addEventListener('pointermove', (event) => {
    if (!pointerState.active) return;
    const xValue = getXValueFromEvent(event);
    if (xValue == null) return;
    pointerState.end = xValue;
    setOverlayRange(chart, pointerState.start, pointerState.end, 0.5);
  });

  function endLaneDrag(event) {
    if (!pointerState.active) return;
    const xValue = getXValueFromEvent(event);
    if (xValue != null) {
      pointerState.end = xValue;
    }
    pointerState.active = false;
    try {
      chart.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures – pointer may already be uncaptured.
    }
    syncLaneSelectionOverlay(chart);
    if (pointerState.start != null && pointerState.end != null) {
      const lap = getActiveLap();
      if (lap) {
        let start = Math.min(pointerState.start, pointerState.end);
        let end = Math.max(pointerState.start, pointerState.end);
        if (Math.abs(end - start) < 0.5) {
          const center = (start + end) / 2;
          start = center - 0.25;
          end = center + 0.25;
        }
        setViewWindow(lap, start, end);
      }
    }
    pointerState.start = null;
    pointerState.end = null;
  }

  chart.canvas.addEventListener('pointerup', endLaneDrag);
  chart.canvas.addEventListener('pointerleave', endLaneDrag);

  chart._selectionOverlay = overlay;
  chartRegistry[key] = chart;
  return chart;
}

function setOverlayRange(chart, startValue, endValue, opacity = 0.25) {
  const overlay = chart?._selectionOverlay;
  if (!overlay) return;
  if (startValue == null || endValue == null) {
    overlay.style.opacity = 0;
    return;
  }
  const xScale = chart.scales.x;
  if (!xScale) {
    overlay.style.opacity = 0;
    return;
  }
  const left = xScale.getPixelForValue(startValue);
  const right = xScale.getPixelForValue(endValue);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    overlay.style.opacity = 0;
    return;
  }
  overlay.style.opacity = opacity;
  overlay.style.left = `${Math.min(left, right)}px`;
  overlay.style.width = `${Math.max(2, Math.abs(right - left))}px`;
}

function syncLaneSelectionOverlay(chart) {
  const lap = getActiveLap();
  if (!lap || !uiState.viewWindow) {
    setOverlayRange(chart, null, null);
    return;
  }
  setOverlayRange(chart, uiState.viewWindow.start, uiState.viewWindow.end, 0.2);
}

function applyWindowToChart(chart) {
  if (!chart) return;
  const lap = getActiveLap();
  if (!lap) {
    chart.update('none');
    return;
  }
  const start = uiState.viewWindow?.start ?? lap.samples[0].distance;
  const end = uiState.viewWindow?.end ?? lap.samples[lap.samples.length - 1].distance;
  chart.options.scales.x.min = start;
  chart.options.scales.x.max = end;
  chart.update('none');
  syncLaneSelectionOverlay(chart);
}

function cloneChartOptions() {
  return typeof structuredClone === 'function'
    ? structuredClone(CHART_BASE_OPTIONS)
    : JSON.parse(JSON.stringify(CHART_BASE_OPTIONS));
}
