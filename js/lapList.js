import { telemetryState, uiState, getLapColor } from './state.js';
import { elements } from './elements.js';
import { formatSeconds } from './parser.js';

let activateLap = () => {};
let handleVisibilityChange = () => {};

export function initLapListInteractions(deps) {
  activateLap = deps.activateLap;
  handleVisibilityChange = deps.handleVisibilityChange;

  if (!elements?.lapList) return;

  elements.lapList.addEventListener('click', (event) => {
    const toggle = event.target.closest('input[data-visibility-id]');
    if (toggle) {
      handleVisibilityChange(toggle.dataset.visibilityId, toggle.checked);
      return;
    }

    const button = event.target.closest('.lap-entry');
    if (!button) return;
    const lapId = button.dataset.lapId;
    if (lapId) {
      activateLap(lapId);
    }
  });
}

export function renderLapList() {
  if (!elements?.lapList) return;
  elements.lapList.innerHTML = '';
  if (!telemetryState.laps.length) {
    const li = document.createElement('li');
    li.className = 'status';
    li.textContent = 'No laps loaded yet.';
    elements.lapList.appendChild(li);
    return;
  }

  telemetryState.laps.forEach((lap) => {
    const li = document.createElement('li');
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.className = `lap-entry${lap.id === uiState.activeLapId ? ' active' : ''}`;
    entry.dataset.lapId = lap.id;
    const color = getLapColor(lap.id);
    const driverLabel =
      lap.metadata.driver && lap.metadata.driver !== '—' ? lap.metadata.driver : 'Unknown driver';
    const lapTimeLabel = lap.metadata.lapTime != null ? formatSeconds(lap.metadata.lapTime) : null;
    const metaLine = [driverLabel, lapTimeLabel].filter(Boolean).join(' • ');
    entry.innerHTML = `
      <span class="lap-color" style="background:${color}"></span>
      <span class="lap-text">
        <span class="lap-name">${lap.metadata.track}</span>
        <span class="lap-meta-line">${metaLine || lap.metadata.car || ''}</span>
      </span>
      <label class="lap-visibility">
        <input type="checkbox" ${telemetryState.lapVisibility.has(lap.id) ? 'checked' : ''} data-visibility-id="${lap.id}" />
        <span>Visible</span>
      </label>
    `;
    li.appendChild(entry);
    elements.lapList.appendChild(li);
  });
}
