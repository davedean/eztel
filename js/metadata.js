import { elements } from './elements.js';
import { formatSeconds } from './parser.js';

export function updateMetadata(lap) {
  if (!lap) {
    elements.metaTrack.textContent = '—';
    elements.metaCar.textContent = '—';
    elements.metaDriver.textContent = '—';
    elements.metaLapTime.textContent = '—';
    elements.metaSamples.textContent = '—';
    return;
  }

  elements.metaTrack.textContent = lap.metadata.track;
  elements.metaCar.textContent = lap.metadata.car;
  elements.metaDriver.textContent = lap.metadata.driver || '—';
  elements.metaLapTime.textContent = formatSeconds(lap.metadata.lapTime);
  elements.metaSamples.textContent = lap.samples.length.toLocaleString();
}
