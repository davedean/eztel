import { parseLapFile, formatSeconds } from './parser.js';

const state = {
      laps: [],
      lapVisibility: new Set(),
      activeLapId: null,
      viewWindow: null,
      cursorDistance: null,
      lapColors: new Map(),
      trackProjectionLapId: null,
      trackProjectionPoints: [],
      charts: {
        throttle: null,
        brake: null,
      }
    };

    const PALETTE = ['#0ea5e9', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#facc15', '#1b5f8c', '#f43f5e'];

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const statusEl = document.getElementById('status');
    const metaTrack = document.getElementById('metaTrack');
    const metaCar = document.getElementById('metaCar');
    const metaDriver = document.getElementById('metaDriver');
    const metaLapTime = document.getElementById('metaLapTime');
    const metaSamples = document.getElementById('metaSamples');
    const lapList = document.getElementById('lapList');
    const clearLapsBtn = document.getElementById('clearLaps');
    const trackCanvas = document.getElementById('trackCanvas');
    const sectorButtons = document.getElementById('sectorButtons');
    const progressWindow = document.getElementById('progressWindow');
    const progressTrack = document.querySelector('.progress-track');
    const sectorCursor = document.createElement('div');
    sectorCursor.className = 'progress-cursor';
    progressTrack.appendChild(sectorCursor);

    Chart.register({
      id: 'sharedCursor',
      afterDatasetsDraw(chart) {
        if (state.cursorDistance == null) return;
        const xScale = chart.scales.x;
        if (!xScale) return;
        const xPixel = xScale.getPixelForValue(state.cursorDistance);
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

    function setStatus(message) {
      statusEl.textContent = message;
    }

    function getLapColor(lapId) {
      if (!state.lapColors.has(lapId)) {
        const nextColor = PALETTE[state.lapColors.size % PALETTE.length];
        state.lapColors.set(lapId, nextColor);
      }
      return state.lapColors.get(lapId);
    }

    function updateMetadata(lap) {
      if (!lap) {
        metaTrack.textContent = '—';
        metaCar.textContent = '—';
        metaDriver.textContent = '—';
        metaLapTime.textContent = '—';
        metaSamples.textContent = '—';
        return;
      }
      metaTrack.textContent = lap.metadata.track;
      metaCar.textContent = lap.metadata.car;
      metaDriver.textContent = lap.metadata.driver || '—';
      metaLapTime.textContent = formatSeconds(lap.metadata.lapTime);
      metaSamples.textContent = lap.samples.length.toLocaleString();
    }

    function ensureChart(key, canvasId) {
      if (state.charts[key]) return state.charts[key];
      const ctx = document.getElementById(canvasId).getContext('2d');
      const overlay = document.createElement('div');
      overlay.className = 'lane-selection';
      ctx.canvas.parentElement.appendChild(overlay);

      const chart = new Chart(ctx, {
        type: 'line',
        data: { datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            x: { type: 'linear', title: { display: true, text: 'Distance (m)' }, grid: { color: '#eef1f6' } },
            y: { beginAtZero: true, suggestedMax: 100, title: { display: true, text: '% input' }, grid: { color: '#eef1f6' } }
          },
          plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 12 } },
            tooltip: { enabled: true }
          }
        }
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
        try { chart.canvas.releasePointerCapture(event.pointerId); } catch (_) {}
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
      state.charts[key] = chart;
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
      if (!lap || !state.viewWindow) {
        setOverlayRange(chart, null, null);
        return;
      }
      setOverlayRange(chart, state.viewWindow.start, state.viewWindow.end, 0.2);
    }

    function updateLaneData() {
      const visibleLaps = state.laps.filter((lap) => state.lapVisibility.has(lap.id));

      const throttleChart = ensureChart('throttle', 'throttleLane');
      throttleChart.data.datasets = visibleLaps.map((lap) => ({
        label: lap.metadata.driver && lap.metadata.driver !== '—' ? `${lap.metadata.driver} (${lap.metadata.track})` : lap.name,
        borderColor: getLapColor(lap.id),
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        data: lap.samples.filter((s) => s.throttle != null).map((s) => ({ x: s.distance, y: s.throttle }))
      }));
      applyWindowToChart(throttleChart);

      const brakeChart = ensureChart('brake', 'brakeLane');
      brakeChart.data.datasets = visibleLaps.map((lap) => ({
        label: lap.metadata.driver && lap.metadata.driver !== '—' ? `${lap.metadata.driver} (${lap.metadata.track})` : lap.name,
        borderColor: getLapColor(lap.id),
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        data: lap.samples.filter((s) => s.brake != null).map((s) => ({ x: s.distance, y: s.brake }))
      }));
      applyWindowToChart(brakeChart);
    }

    function applyWindowToChart(chart) {
      if (!chart) return;
      const lap = getActiveLap();
      if (!lap) {
        chart.update('none');
        return;
      }
      const start = state.viewWindow?.start ?? lap.samples[0].distance;
      const end = state.viewWindow?.end ?? lap.samples[lap.samples.length - 1].distance;
      chart.options.scales.x.min = start;
      chart.options.scales.x.max = end;
      chart.update('none');
      syncLaneSelectionOverlay(chart);
    }

    function findSampleAtDistance(samples, target) {
      if (target == null) return null;
      let left = 0;
      let right = samples.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const value = samples[mid].distance;
        if (value === target) return samples[mid];
        if (value < target) left = mid + 1;
        else right = mid - 1;
      }
      return samples[Math.max(0, Math.min(samples.length - 1, left))];
    }

    function renderTrackMap(lap) {
      const ctx = trackCanvas.getContext('2d');
      ctx.clearRect(0, 0, trackCanvas.width, trackCanvas.height);
      if (!lap || !state.lapVisibility.size) {
        ctx.fillStyle = '#adb3c2';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Load a lap to view the track map', trackCanvas.width / 2, trackCanvas.height / 2);
        state.trackProjectionLapId = null;
        state.trackProjectionPoints = [];
        return;
      }

      const getPlanarY = (sample) => (sample.z != null ? sample.z : sample.y);
      const activeLap = lap;
      const activePoints = activeLap.samples.filter((s) => s.x != null && getPlanarY(s) != null);
      if (!activePoints.length) {
        ctx.fillStyle = '#adb3c2';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Track coordinates unavailable in this export.', trackCanvas.width / 2, trackCanvas.height / 2);
        state.trackProjectionLapId = null;
        state.trackProjectionPoints = [];
        return;
      }

      const windowStart = state.viewWindow?.start ?? lap.samples[0].distance;
      const windowEnd = state.viewWindow?.end ?? lap.samples[lap.samples.length - 1].distance;
      const totalSpan = lap.samples[lap.samples.length - 1].distance - lap.samples[0].distance || 1;
      const windowSpan = windowEnd - windowStart;
      const shouldZoom = windowSpan < totalSpan * 0.98;
      const windowPoints = shouldZoom ? activePoints.filter((p) => p.distance >= windowStart && p.distance <= windowEnd) : activePoints;
      const drawingPoints = shouldZoom && windowPoints.length >= 2 ? windowPoints : activePoints;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      drawingPoints.forEach((p) => {
        const planeY = getPlanarY(p);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (planeY < minY) minY = planeY;
        if (planeY > maxY) maxY = planeY;
      });

      const expand = shouldZoom ? 0.15 : 0.05;
      const expandX = (maxX - minX) * expand || 1;
      const expandY = (maxY - minY) * expand || 1;
      minX -= expandX;
      maxX += expandX;
      minY -= expandY;
      maxY += expandY;

      const paddingX = 30;
      const paddingY = 30;
      const rangeX = (maxX - minX) || 1;
      const rangeY = (maxY - minY) || 1;
      const width = trackCanvas.width - paddingX * 2;
      const height = trackCanvas.height - paddingY * 2;

      function toCanvasCoords(sample) {
        const planeY = getPlanarY(sample);
        const normX = (sample.x - minX) / rangeX;
        const normY = (planeY - minY) / rangeY;
        const x = paddingX + (1 - normX) * width;
        const y = trackCanvas.height - paddingY - normY * height;
        return { x, y };
      }

      state.laps.forEach((lapItem) => {
        if (!state.lapVisibility.has(lapItem.id)) return;
        const lapPoints = lapItem.samples.filter((s) => s.x != null && getPlanarY(s) != null);
        if (!lapPoints.length) return;
        const lapColor = getLapColor(lapItem.id);
        ctx.lineWidth = 2;
        ctx.strokeStyle = lapColor;
        ctx.globalAlpha = lapItem.id === activeLap.id ? 0.8 : 0.35;
        ctx.beginPath();
        lapPoints.forEach((sample, idx) => {
          const { x, y } = toCanvasCoords(sample);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      if (windowEnd > windowStart) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = getLapColor(activeLap.id);
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        let drawing = false;
        activePoints.forEach((sample) => {
          if (sample.distance < windowStart || sample.distance > windowEnd) {
            drawing = false;
            return;
          }
          const { x, y } = toCanvasCoords(sample);
          if (!drawing) {
            ctx.moveTo(x, y);
            drawing = true;
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      state.trackProjectionLapId = lap.id;
      state.trackProjectionPoints = activeLap.samples
        .map((sample) => {
          const planeY = getPlanarY(sample);
          if (sample.x == null || planeY == null) return null;
          const { x, y } = toCanvasCoords(sample);
          return { distance: sample.distance, x, y };
        })
        .filter(Boolean);

      if (state.cursorDistance != null) {
        state.laps.forEach((lapItem) => {
          if (!state.lapVisibility.has(lapItem.id)) return;
          const sample = findSampleAtDistance(lapItem.samples, state.cursorDistance);
          const planeY = sample ? getPlanarY(sample) : null;
          if (sample && sample.x != null && planeY != null) {
            const { x, y } = toCanvasCoords(sample);
            ctx.fillStyle = getLapColor(lapItem.id);
            ctx.beginPath();
            ctx.arc(x, y, lapItem.id === lap.id ? 6 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      }
    }

    function updateProgressWindow(lap) {
      if (!lap) {
        progressWindow.style.left = '0%';
        progressWindow.style.width = '0%';
        sectorCursor.style.opacity = 0;
        return;
      }
      const total = lap.metadata.lapLength || lap.samples[lap.samples.length - 1].distance;
      const minDistance = lap.samples[0].distance;
      const span = (total - minDistance) || total || 1;
      const start = (state.viewWindow?.start ?? minDistance) - minDistance;
      const end = (state.viewWindow?.end ?? total) - minDistance;
      const left = (start / span) * 100;
      const width = ((end - start) / span) * 100;
      progressWindow.style.left = `${Math.max(0, Math.min(100, left))}%`;
      progressWindow.style.width = `${Math.max(0, Math.min(100, width))}%`;
    }

    function updateSectorCursor(distance) {
      const lap = getActiveLap();
      if (!lap || distance == null) {
        sectorCursor.style.opacity = 0;
        return;
      }
      const minDistance = lap.samples[0].distance;
      const maxDistance = lap.metadata.lapLength || lap.samples[lap.samples.length - 1].distance;
      const ratio = (distance - minDistance) / ((maxDistance - minDistance) || 1);
      sectorCursor.style.opacity = 1;
      sectorCursor.style.left = `${Math.max(0, Math.min(100, ratio * 100))}%`;
    }

    function renderSectorButtons(lap) {
      sectorButtons.innerHTML = '';
      if (!lap) {
        const span = document.createElement('span');
        span.className = 'sector-placeholder';
        span.textContent = 'Load a lap to view sectors.';
        sectorButtons.appendChild(span);
        return;
      }
      const startDistance = lap.samples[0]?.distance ?? 0;
      const endDistance = (lap.metadata.lapLength || lap.samples[lap.samples.length - 1]?.distance) ?? startDistance;
      const viewStart = state.viewWindow?.start ?? startDistance;
      const viewEnd = state.viewWindow?.end ?? endDistance;

      const buttons = [];
      const createButton = (label, start, end) => {
        const isActive = isWindowMatch(viewStart, viewEnd, start, end);
        const button = createSectorButton(label, start, end, isActive);
        buttons.push(button);
      };

      createButton('All', startDistance, endDistance);

      const sectorEntries = lap.sectors || [];
      sectorEntries.forEach((sector, idx) => {
        const label = sector.label || `S${sector.index ?? idx + 1}`;
        const start = sector.start ?? startDistance;
        const end = sector.end ?? endDistance;
        createButton(label, start, end);
      });

      buttons.forEach((button) => sectorButtons.appendChild(button));

      if (!sectorEntries.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'sector-placeholder';
        placeholder.textContent = 'No sector data available for this lap.';
        sectorButtons.appendChild(placeholder);
      }
    }

    function createSectorButton(label, start, end, isActive) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `sector-button${isActive ? ' active' : ''}`;
      button.dataset.start = start;
      button.dataset.end = end;
      button.textContent = label;
      return button;
    }

    function isWindowMatch(viewStart, viewEnd, targetStart, targetEnd) {
      const tolerance = Math.max(1, (targetEnd - targetStart) * 0.01);
      return Math.abs(viewStart - targetStart) <= tolerance && Math.abs(viewEnd - targetEnd) <= tolerance;
    }

    function setViewWindow(lap, start, end) {
      if (!lap) {
        state.viewWindow = null;
        return;
      }
      const minDistance = lap.samples[0].distance;
      const maxDistance = lap.metadata.lapLength || lap.samples[lap.samples.length - 1].distance;
      const windowStart = start ?? minDistance;
      const windowEnd = end ?? maxDistance;
      state.viewWindow = {
        start: Math.max(minDistance, Math.min(maxDistance, windowStart)),
        end: Math.max(minDistance, Math.min(maxDistance, windowEnd))
      };
      updateProgressWindow(lap);
      renderTrackMap(lap);
      renderSectorButtons(lap);
      Object.values(state.charts).forEach((chart) => applyWindowToChart(chart));
    }

    function setCursorDistance(distance) {
      state.cursorDistance = distance;
      const lap = getActiveLap();
      renderTrackMap(lap);
      updateSectorCursor(distance);
      Object.values(state.charts).forEach((chart) => chart && chart.update('none'));
    }

    function getActiveLap() {
      return state.laps.find((lap) => lap.id === state.activeLapId) || null;
    }

    function activateLap(lapId) {
      const lap = state.laps.find((l) => l.id === lapId);
      if (!lap) return;
      state.activeLapId = lapId;
      state.cursorDistance = null;
      state.lapVisibility.add(lapId);
      setViewWindow(lap);
      updateMetadata(lap);
      updateLaneData();
    }

    function renderLapList() {
      lapList.innerHTML = '';
      if (!state.laps.length) {
        const li = document.createElement('li');
        li.className = 'status';
        li.textContent = 'No laps loaded yet.';
        lapList.appendChild(li);
        return;
      }
      state.laps.forEach((lap) => {
        const li = document.createElement('li');
        const entry = document.createElement('button');
        entry.type = 'button';
        entry.className = `lap-entry${lap.id === state.activeLapId ? ' active' : ''}`;
        entry.dataset.lapId = lap.id;
        const color = getLapColor(lap.id);
        const driverLabel = lap.metadata.driver && lap.metadata.driver !== '—' ? lap.metadata.driver : 'Unknown driver';
        const lapTimeLabel = lap.metadata.lapTime != null ? formatSeconds(lap.metadata.lapTime) : null;
        const metaLine = [driverLabel, lapTimeLabel].filter(Boolean).join(' • ');
        entry.innerHTML = `
          <span class=\"lap-color\" style=\"background:${color}\"></span>
          <span class=\"lap-text\">
            <span class=\"lap-name\">${lap.metadata.track}</span>
            <span class=\"lap-meta-line\">${metaLine || lap.metadata.car || ''}</span>
          </span>
          <label class=\"lap-visibility\">
            <input type=\"checkbox\" ${state.lapVisibility.has(lap.id) ? 'checked' : ''} data-visibility-id=\"${lap.id}\" />
            <span>Visible</span>
          </label>
        `;
        li.appendChild(entry);
        lapList.appendChild(li);
      });
    }

    function clearLaps() {
      state.laps = [];
      state.activeLapId = null;
      state.viewWindow = null;
      state.cursorDistance = null;
      state.lapColors.clear();
      state.lapVisibility.clear();
      state.trackProjectionLapId = null;
      state.trackProjectionPoints = [];
      updateMetadata(null);
      updateLaneData();
      renderTrackMap(null);
      updateProgressWindow(null);
      renderSectorButtons(null);
      renderLapList();
      setStatus('Cleared all laps.');
    }

    async function handleFiles(files) {
      if (!files.length) return;
      setStatus('Loading...');

      let loadedCount = 0;
      let failedCount = 0;
      let lastLoadedId = null;

      for (const file of files) {
        try {
          const text = await file.text();
          const lap = parseLapFile(text, file.name);
          state.laps.push(lap);
          state.lapVisibility.add(lap.id);
          lastLoadedId = lap.id;
          getLapColor(lap.id);
          loadedCount++;
        } catch (err) {
          console.error(err);
          failedCount++;
        }
      }

      if (lastLoadedId) {
        activateLap(lastLoadedId);
      } else if (!state.laps.length) {
        clearLaps();
      }

      renderLapList();

      const messages = [];
      if (loadedCount) messages.push(`Loaded ${loadedCount} lap${loadedCount === 1 ? '' : 's'}.`);
      if (failedCount) messages.push(`Failed ${failedCount}. Check console for details.`);
      if (!messages.length) messages.push('No laps loaded.');
      setStatus(messages.join(' '));
    }

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
      const files = Array.from(event.dataTransfer.files);
      if (!files.length) return;
      handleFiles(files);
    });

    fileInput.addEventListener('change', (event) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      handleFiles(files);
      fileInput.value = '';
    });

    lapList.addEventListener('click', (event) => {
      const toggle = event.target.closest('input[data-visibility-id]');
      if (toggle) {
        const lapId = toggle.dataset.visibilityId;
        if (toggle.checked) {
          state.lapVisibility.add(lapId);
        } else {
          state.lapVisibility.delete(lapId);
          if (!state.lapVisibility.size && state.activeLapId) {
            state.lapVisibility.add(state.activeLapId);
          }
        }
        updateLaneData();
        renderTrackMap(getActiveLap());
        renderLapList();
        return;
      }

      const button = event.target.closest('.lap-entry');
      if (!button) return;
      const lapId = button.dataset.lapId;
      if (lapId) {
        activateLap(lapId);
        renderLapList();
      }
    });

    clearLapsBtn.addEventListener('click', () => clearLaps());

    sectorButtons.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-start]');
      if (!button) return;
      const lap = getActiveLap();
      if (!lap) return;
      setViewWindow(lap, Number(button.dataset.start), Number(button.dataset.end));
    });

    function handleTrackHover(event) {
      const lap = getActiveLap();
      if (!lap || state.trackProjectionLapId !== lap.id || !state.trackProjectionPoints.length) return;
      const rect = trackCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let nearest = null;
      let best = Infinity;
      for (const point of state.trackProjectionPoints) {
        const dx = point.x - x;
        const dy = point.y - y;
        const dist = dx * dx + dy * dy;
        if (dist < best) {
          best = dist;
          nearest = point;
          if (dist < 25) break;
        }
      }
      if (nearest) {
        setCursorDistance(nearest.distance);
      } else {
        setCursorDistance(null);
      }
    }

    trackCanvas.addEventListener('mousemove', handleTrackHover);
    trackCanvas.addEventListener('mouseleave', () => setCursorDistance(null));

    const dragState = {
      active: false,
      startRatio: 0,
      endRatio: 1
    };

    function getProgressRatio(event) {
      const rect = progressTrack.getBoundingClientRect();
      const raw = (event.clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, raw));
    }

    function applyDragSelection() {
      const lap = getActiveLap();
      if (!lap) return;
      const total = lap.metadata.lapLength || lap.samples[lap.samples.length - 1].distance;
      const minDistance = lap.samples[0].distance;
      const span = total - minDistance;
      let startRatio = Math.min(dragState.startRatio, dragState.endRatio);
      let endRatio = Math.max(dragState.startRatio, dragState.endRatio);
      if (endRatio - startRatio < 0.005) {
        const center = (startRatio + endRatio) / 2;
        startRatio = Math.max(0, center - 0.0025);
        endRatio = Math.min(1, center + 0.0025);
      }
      const start = minDistance + span * startRatio;
      const end = minDistance + span * endRatio;
      setViewWindow(lap, start, end);
      setCursorDistance((start + end) / 2);
    }

    progressTrack.addEventListener('pointerdown', (event) => {
      const lap = getActiveLap();
      if (!lap) return;
      progressTrack.setPointerCapture(event.pointerId);
      dragState.active = true;
      const ratio = getProgressRatio(event);
      dragState.startRatio = ratio;
      dragState.endRatio = ratio;
      applyDragSelection();
    });

    progressTrack.addEventListener('pointermove', (event) => {
      if (!dragState.active) return;
      dragState.endRatio = getProgressRatio(event);
      applyDragSelection();
    });

    function endDrag(event) {
      if (!dragState.active) return;
      dragState.endRatio = getProgressRatio(event);
      dragState.active = false;
      try { progressTrack.releasePointerCapture(event.pointerId); } catch (_) {}
      applyDragSelection();
    }

    progressTrack.addEventListener('pointerup', endDrag);
    progressTrack.addEventListener('pointerleave', (event) => {
      if (!dragState.active) return;
      endDrag(event);
    });

    progressTrack.addEventListener('mousemove', (event) => {
      if (dragState.active) return;
      const lap = getActiveLap();
      if (!lap) return;
      const ratio = getProgressRatio(event);
      const minDistance = lap.samples[0].distance;
      const maxDistance = lap.metadata.lapLength || lap.samples[lap.samples.length - 1].distance;
      const distance = minDistance + (maxDistance - minDistance) * ratio;
      setCursorDistance(distance);
    });

    progressTrack.addEventListener('mouseleave', () => {
      if (dragState.active) return;
      setCursorDistance(null);
    });

    renderTrackMap(null);
    renderLapList();
    renderSectorButtons(null);
