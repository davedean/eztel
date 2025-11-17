/** @typedef {import('./parser.js').Lap} Lap */
/** @typedef {import('./parser.js').LapSample} LapSample */

const PALETTE = [
  '#0ea5e9',
  '#ef4444',
  '#10b981',
  '#f97316',
  '#8b5cf6',
  '#facc15',
  '#1b5f8c',
  '#f43f5e'
];

/**
 * Global runtime state shared across modules.
 * @type {{
 *  laps: Lap[],
 *  lapVisibility: Set<string>,
 *  activeLapId: string|null,
 *  viewWindow: {start: number, end: number} | null,
 *  cursorDistance: number | null,
 *  lapColors: Map<string, string>,
 *  trackProjectionLapId: string | null,
 *  trackProjectionPoints: Array<{distance: number, x: number, y: number}>,
 *  charts: Record<string, import('chart.js').Chart|null>
 * }}
 */
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

/**
 * Determine the paint colour assigned to a lap, generating one if needed.
 * @param {string} lapId
 * @returns {string}
 */
export function getLapColor(lapId) {
  if (!state.lapColors.has(lapId)) {
    const nextColor = PALETTE[state.lapColors.size % PALETTE.length];
    state.lapColors.set(lapId, nextColor);
  }
  return state.lapColors.get(lapId);
}

/**
 * Retrieve the currently active lap, or fall back to the first loaded lap.
 * @returns {Lap|null}
 */
export function getActiveLap() {
  if (!state.laps.length) return null;
  if (!state.activeLapId) {
    return state.laps[0];
  }
  return state.laps.find((lap) => lap.id === state.activeLapId) || state.laps[0] || null;
}

/**
 * Set the active lap identifier.
 * @param {string} lapId
 */
export function setActiveLapId(lapId) {
  state.activeLapId = lapId;
}

/**
 * Reset the shared runtime state, clearing laps and cached Chart.js instances.
 */
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
