project plan.md

### Project goal

Build a **pure client-side web app** that can:

- Load **Telemetry Tool** lap files directly from the user’s machine (no upload).
- Parse them in the browser and **visualise / compare laps** (Garage 61 style).
- Be hosted as a **static site on S3** (or any static host) with:
  - No backend,
  - No logins,
  - No server-side storage of telemetry.

The aim is to cover **~99% of your analysis needs** without touching MoTeC or any licensed formats: compare your laps with friends, see where time is gained/lost, inspect speed/throttle/brake/steering profiles, etc.

---

### Implementation sketch

#### 1. Architecture

- **Static web app**:
  - Files: `index.html`, `app.js` (or split into modules later), `styles.css`.
  - Hosted on **S3 static hosting** (optionally behind CloudFront).

- **All logic runs client-side**:
  - Use the browser **File API** to read local Telemetry Tool lap files.
  - No telemetry ever leaves the user’s device.

- **Tech stack** (lean):
  - Vanilla JS + a charting library (e.g. Chart.js or Plotly).
  - Simple CSS; optional small framework later if needed (React/Vue) but not required.

---

#### 2. Data flow

1. User opens the app URL.
2. User selects or drag-drops one or more **Telemetry Tool lap files**.
3. JS reads the files via `File.text()` / `FileReader`.
4. **Parser**:
   - Detects delimiter (`;` vs `,`).
   - Reads header row, maps columns:
     - Time, lap distance, speed, throttle, brake, steering, etc.

   - Constructs a **canonical lap representation** (see below).

5. **State**:
   - Store laps in memory (`laps[]` array).
   - Provide UI controls to select which laps to display and which channel.

6. **Visualisation**:
   - Plot selected channel vs **distance** or **time** for multiple laps.
   - Optional: compute and draw delta-time traces (reference vs comparison lap).

---

#### 3. Canonical data model (in-app)

Define a simple standard structure so different sims and Telemetry Tool variations map to the same schema:

- `LapSample`:
  - `t`: time from lap start (seconds).
  - `s`: distance around lap (meters).
  - `speed`: speed (e.g. km/h).
  - `throttle`: 0–100 or 0–1.
  - `brake`: 0–100 or 0–1.
  - `steer`: steering angle or normalised steering.
  - (Optionally) `rpm`, `gear`, `lat`, `lon`, `x`, `y`.

- `Lap`:
  - `id`: internal ID.
  - `name`: source filename or user-friendly label.
  - `metadata`: car, track, lap length, number of samples (if available).
  - `samples: LapSample[]`.

All parsing logic maps Telemetry Tool’s headers into this model. The rest of the app only talks to the canonical model.

---

#### 4. Parsing strategy

- **Header inspection**:
  - On first run, log the header row to the console and note the exact column names.
  - Implement a `guessColumnIndices(headerColumns)` that:
    - Matches possible header names for time/dist/speed/etc.
    - E.g. `['Time', 'LapTime', 't']`, `['LapDist', 'Distance']`, etc.

- **Robustness**:
  - Ignore rows where time or distance are NaN.
  - Sort samples by distance as a safety measure.
  - Be tolerant of missing channels (e.g. no brake column → leave NaNs and just don’t plot).

---

#### 5. UI and features (initial)

- **File input / drop zone**:
  - `<input type="file" multiple>` plus a drag-and-drop area.
  - Show each loaded file as an entry in a lap list with a checkbox.

- **Lap selection**:
  - A simple list of laps with checkboxes: user picks which laps to show.
  - Show small metadata: sample count, approximate lap length.

- **Channel picker**:
  - Radio buttons or dropdown for channel: speed, throttle, brake, steering, etc.
  - Changing channel re-uses the same chart, just swaps the data series.

- **Base chart**:
  - X-axis: **lap distance** (metres or normalised 0–100%).
  - Y-axis: chosen channel.
  - One dataset per lap, different colour/label per lap.
  - No markers (just lines) for performance.

This already gives useful comparisons of braking points, minimum speeds, throttle traces, etc. between multiple laps.

---

#### 6. Future enhancements (nice-to-have)

- **Delta-time plot**:
  - Pick a “reference lap”.
  - Resample both laps onto a common distance axis (e.g. every 1 m or 5 m).
  - Calculate cumulative time difference to produce the classic “delta vs distance” trace.

- **Track map**:
  - If Telemetry Tool logs X/Y or GPS coordinates per sample, render a simple 2D track map on a `<canvas>`.
  - Highlight cursor position on the track when hovering over the chart.

- **Per-sim mappings**:
  - Channel mapping config per game (ACC, iRacing, LMU, AMS2, etc.) if their headers differ.
  - Possibly let the user pick the sim profile manually if auto-detection is flaky.

- **Client-side presets**:
  - Local storage for user preferences (default channel, preferred colour scheme, last used sim profile, etc.).

---

#### 7. Hosting / ops

- **Deployment**:
  - Upload `index.html` (and any JS/CSS files) to an S3 bucket.
  - Enable static website hosting.
  - Optionally front with CloudFront + custom domain.

- **Privacy**:
  - No backend.
  - No cookies or accounts by default.
  - Telemetry files are read only in the browser session; never uploaded.

- **Maintenance**:
  - Occasional tweaks as Telemetry Tool formats evolve.
  - Add new mappings for new sims / channels as you encounter them.

---

That’s the core idea: a **static, privacy-friendly, client-side lap viewer** that understands Telemetry Tool’s exports, normalises them into a simple lap model, and gives you Garage 61-style comparisons without touching MoTeC or any server infrastructure.
