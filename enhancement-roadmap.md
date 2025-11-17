# Telemetry Viewer Enhancements

Suggested next steps to harden the LMU Lap Viewer and keep the refactor momentum going.

## Quality & Reliability _(✅ Completed)_

- **Unit / integration tests**: ✅ Parser/state specs now live under `tests/` and run via `npm test`, catching parsing regressions early.
- **Static analysis**: ✅ ESLint + Prettier are configured (see `eslint.config.js`, `.prettierrc`, `npm run lint` / `npm run format`).
- **Type safety**: ✅ Lap/LapSample/state helpers expose JSDoc typings so cross-module refactors keep consistent shapes.

## Architecture & Readability _(✅ Completed)_

- **State management cleanup**: ✅ `state.js` now separates telemetry/ui/projection/chart registries, making mutations explicit across modules.
- **DOM init lifecycle**: ✅ App bootstrap waits for `DOMContentLoaded`, so DOM lookups/event bindings only run once the document is ready.
- **Config extraction**: ✅ Shared palette/status/chart defaults live in `config.js` for reuse and theming.
- **Error handling UX**: ✅ `notifications.js` centralises status/error messaging and styles, replacing scattered `console.warn` calls.

## Features & UX

- **Additional telemetry lanes**: now that modules are split, adding Speed, Gear/RPM, and Steering charts is straightforward—reuse `ensureChart` with lane-specific options.
- **Sector intelligence**: show actual sector labels when available, persist the selected window across lap switches, and allow multi-sector selection (Ctrl+click) to compare combined segments.
- **Multi-lap overlays**: extend `state.lapVisibility` into a dedicated lap manager with ordering, colour reassignment, and per-lap metadata chips.
- **Persistence**: cache the last viewed laps or window in `localStorage` so users returning to the page pick up where they left off.

## Tooling & Delivery

- **Build step**: even if the app stays “no-build” for now, consider adding Vite/Rollup to bundle ES modules, inline minified CSS, and ship hashed assets for production.
- **CI hooks**: ✅ GitHub Action (`.github/workflows/ci.yml`) now runs format checks, lint, and tests on every push/PR.
- **Documentation**: expand `README.md` with a short architecture overview and contributor guide so future collaborators understand module responsibilities quickly.
