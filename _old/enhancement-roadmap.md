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

## Features & UX _(✅ Completed)_

- **Additional telemetry lanes**: ✅ Speed, Gear/RPM, and Steering charts now render alongside throttle/brake with shared cursors.
- **Sector intelligence**: ✅ Sector buttons respect multi-select (Ctrl/Cmd) and view-window selections persist per lap and across lap switches.
- **Multi-lap overlays**: ✅ Lap list now exposes reorder controls, metadata chips, and keeps lap order in state so overlays are easier to manage.
- **Persistence**: ✅ View-window preferences persist via `localStorage`, restoring your preferred zoom after reloads.

## Tooling & Delivery

- **Build step**: even if the app stays “no-build” for now, consider adding Vite/Rollup to bundle ES modules, inline minified CSS, and ship hashed assets for production.
- **CI hooks**: ✅ GitHub Action (`.github/workflows/ci.yml`) now runs format checks, lint, and tests on every push/PR.
- **Documentation**: ✅ `README.md` now includes an architecture overview plus a contributor guide that covers setup, coding standards, and required checks.
