import { loadLapFiles } from './fileLoader.js';
import { elements, setStatus, initDomElements } from './elements.js';
import { state, getActiveLap, setActiveLapId, resetState } from './state.js';
import { updateMetadata } from './metadata.js';
import { initCharts, updateLaneData, applyWindowToCharts, refreshCharts } from './charts.js';
import { renderTrackMap, initTrackHover } from './trackMap.js';
import { initProgressControls, updateProgressWindow, updateSectorCursor, renderSectorButtons } from './progress.js';
import { initLapListInteractions, renderLapList } from './lapList.js';

initDomElements();

initCharts({ setCursorDistance, setViewWindow });
initTrackHover({ getActiveLap, setCursorDistance });
initProgressControls({ getActiveLap, setViewWindow, setCursorDistance });
initLapListInteractions({
  activateLap,
  handleVisibilityChange
});

if (elements.dropzone) {
  elements.dropzone.addEventListener('click', () => elements.fileInput?.click());
  elements.dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    elements.dropzone.classList.add('dragover');
  });
  elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('dragover'));
  elements.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    elements.dropzone.classList.remove('dragover');
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    handleFiles(files);
  });
}

if (elements.fileInput) {
  elements.fileInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    handleFiles(files);
    elements.fileInput.value = '';
  });
}

elements.clearLapsBtn?.addEventListener('click', () => clearLaps());

renderTrackMap(null);
renderLapList();
renderSectorButtons(null);

async function handleFiles(files) {
  if (!files.length) return;
  setStatus('Loading...');

  const { loadedCount, failedCount, lastLoadedId } = await loadLapFiles(files);

  if (lastLoadedId) {
    activateLap(lastLoadedId);
  } else if (!state.laps.length) {
    clearLaps();
  } else {
    renderLapList();
  }

  const messages = [];
  if (loadedCount) messages.push(`Loaded ${loadedCount} lap${loadedCount === 1 ? '' : 's'}.`);
  if (failedCount) messages.push(`Failed ${failedCount}. Check console for details.`);
  if (!messages.length) messages.push('No laps loaded.');
  setStatus(messages.join(' '));
}

function setViewWindow(lap, start, end) {
  if (!lap) {
    state.viewWindow = null;
    updateProgressWindow(null);
    renderTrackMap(null);
    renderSectorButtons(null);
    applyWindowToCharts();
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
  applyWindowToCharts();
}

function setCursorDistance(distance) {
  state.cursorDistance = distance;
  renderTrackMap(getActiveLap());
  updateSectorCursor(distance);
  refreshCharts();
}

function activateLap(lapId) {
  const lap = state.laps.find((l) => l.id === lapId);
  if (!lap) return;
  setActiveLapId(lapId);
  state.cursorDistance = null;
  state.lapVisibility.add(lapId);
  setViewWindow(lap);
  updateMetadata(lap);
  updateLaneData();
  renderLapList();
}

function handleVisibilityChange(lapId, visible) {
  if (visible) {
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
}

function clearLaps() {
  resetState();
  updateMetadata(null);
  updateLaneData();
  renderTrackMap(null);
  updateProgressWindow(null);
  renderSectorButtons(null);
  renderLapList();
  setStatus('Cleared all laps.');
}
