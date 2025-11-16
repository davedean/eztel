# Telemetry Viewer Enhancements

Suggested next steps to harden the LMU Lap Viewer and keep the refactor momentum going.

## Quality & Reliability

- **Unit / integration tests**: introduce a small test harness (Vitest/Jest) focused on pure modules (`parser.js`, `state.js`, `utils.js`). Start with parsing edge cases (different delimiters, missing columns), sector derivation, and lap colour assignment. Add DOM smoke tests with @testing-library/dom once the pure logic has coverage.
- **Static analysis**: wire up ESLint + Prettier to catch unused imports, enforce consistent style, and protect the ES-module structure we just restored.
- **Type safety**: consider JSDoc or TypeScript definitions for the `Lap`/`LapSample` shape; this will make cross-module refactors safer and ease future API integrations.

## Architecture & Readability

- **State management cleanup**: `state.js` still mixes data, view window, and chart caches. Break it into distinct concerns (telemetry data vs UI artifacts) or wrap in a lightweight store class so mutations become explicit and easier to trace.
- **DOM init lifecycle**: move the `initDomElements()` call behind a `DOMContentLoaded` guard (or hydrate through a main `init()` that runs once) to guarantee predictable ordering even when the script is bundled.
- **Config extraction**: palettes, Chart.js options, and layout constants could live in `config.js` to simplify future theming.
- **Error handling UX**: centralise user-facing errors in one module (toast/banner) so parse failures, chart errors, or drag/drop restrictions surface consistently instead of only logging to the console.

## Features & UX

- **Additional telemetry lanes**: now that modules are split, adding Speed, Gear/RPM, and Steering charts is straightforward—reuse `ensureChart` with lane-specific options.
- **Sector intelligence**: show actual sector labels when available, persist the selected window across lap switches, and allow multi-sector selection (Ctrl+click) to compare combined segments.
- **Multi-lap overlays**: extend `state.lapVisibility` into a dedicated lap manager with ordering, colour reassignment, and per-lap metadata chips.
- **Persistence**: cache the last viewed laps or window in `localStorage` so users returning to the page pick up where they left off.

## Tooling & Delivery

- **Build step**: even if the app stays “no-build” for now, consider adding Vite/Rollup to bundle ES modules, inline minified CSS, and ship hashed assets for production.
- **CI hooks**: add a GitHub Action (or similar) that runs lint/tests on push and publishes the static site to your chosen host automatically.
- **Documentation**: expand `README.md` with a short architecture overview and contributor guide so future collaborators understand module responsibilities quickly.
