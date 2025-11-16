import { parseLapFile } from './parser.js';
import { state, getLapColor } from './state.js';

export async function loadLapFiles(files) {
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
    } catch (error) {
      console.error(error);
      failedCount++;
    }
  }

  return { loadedCount, failedCount, lastLoadedId };
}
