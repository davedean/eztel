export const elements = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  status: document.getElementById('status'),
  metaTrack: document.getElementById('metaTrack'),
  metaCar: document.getElementById('metaCar'),
  metaDriver: document.getElementById('metaDriver'),
  metaLapTime: document.getElementById('metaLapTime'),
  metaSamples: document.getElementById('metaSamples'),
  lapList: document.getElementById('lapList'),
  clearLapsBtn: document.getElementById('clearLaps'),
  trackCanvas: document.getElementById('trackCanvas'),
  sectorButtons: document.getElementById('sectorButtons'),
  progressWindow: document.getElementById('progressWindow'),
  progressTrack: document.querySelector('.progress-track')
};

export const sectorCursor = (() => {
  const cursor = document.createElement('div');
  cursor.className = 'progress-cursor';
  elements.progressTrack.appendChild(cursor);
  return cursor;
})();

export function setStatus(message) {
  elements.status.textContent = message;
}
