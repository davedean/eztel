const PALETTE = ['#0ea5e9', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#facc15', '#1b5f8c', '#f43f5e'];

export const state = {
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
    brake: null
  }
};

export function getLapColor(lapId) {
  if (!state.lapColors.has(lapId)) {
    const nextColor = PALETTE[state.lapColors.size % PALETTE.length];
    state.lapColors.set(lapId, nextColor);
  }
  return state.lapColors.get(lapId);
}

export function getActiveLap() {
  if (!state.laps.length) return null;
  if (!state.activeLapId) {
    return state.laps[0];
  }
  return state.laps.find((lap) => lap.id === state.activeLapId) || state.laps[0] || null;
}

export function setActiveLapId(lapId) {
  state.activeLapId = lapId;
}

export function resetState() {
  state.laps = [];
  state.lapVisibility.clear();
  state.activeLapId = null;
  state.viewWindow = null;
  state.cursorDistance = null;
  state.lapColors.clear();
  state.trackProjectionLapId = null;
  state.trackProjectionPoints = [];
  Object.keys(state.charts).forEach((key) => {
    const chart = state.charts[key];
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
    state.charts[key] = null;
  });
}
