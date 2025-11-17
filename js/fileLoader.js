import { parseLapFile } from './parser.js';
import { telemetryState, getLapColor } from './state.js';

export async function loadLapFiles(files) {
  let loadedCount = 0;
  let failedCount = 0;
  let lastLoadedId = null;
  const errors = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const lap = parseLapFile(text, file.name);
      telemetryState.laps.push(lap);
      telemetryState.lapOrder.push(lap.id);
      telemetryState.lapVisibility.add(lap.id);
      lastLoadedId = lap.id;
      getLapColor(lap.id);
      loadedCount++;
    } catch (error) {
      console.error(error);
      failedCount++;
      errors.push({ fileName: file.name, error });
    }
  }

  return { loadedCount, failedCount, lastLoadedId, errors };
}
