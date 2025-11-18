## Track limits overlay

Right now we only have the car’s centreline (`X/Y` or `X/Z`) so the map can’t draw genuine track limits. LMU’s telemetry export doesn’t include left/right boundary channels, so we need to generate the limits ourselves. Two candidate approaches:

### Option 1 – Manual track-definition assets
- Build or source per-track SVGs/polylines (e.g., from existing CAD or community data).
- Store them in the app keyed by `trackId`.
- Pros: one-time effort if data exists; accurate reference lines.
- Cons: requires external assets; difficult to update when layouts change.

### Option 2 – Calibration laps + admin tool (preferred)
1. Create an internal “track builder” tool.
2. Drive three calibration laps at each circuit:
   - Lap A hugging the left limit, Lap B in the middle, Lap C hugging the right.
3. Export those laps via the telemetry logger.
4. Tool steps:
   - Resample each lap onto a common progress grid (0→1 along the lap) using cumulative distance.
   - Use the middle lap as the provisional centreline; compute tangents/normals along it.
   - Project left/right laps onto the normals to estimate half-widths at each sample.
   - Smooth centreline + widths (circular moving average, window size adjustable).
   - Derive left/right edge polylines from `centreline ± halfWidth * normal`.
   - Save the result as a JSON “track layout blob” containing centreline, width arrays, and a viewBox transform.
5. Viewer loads the blob (by track ID) and draws the limits beneath telemetry traces.
- Extras:
   - Calibration UI overlay showing the three raw laps vs generated edges for QA.
   - Controls to tune smoothing windows or manually tweak problematic sections (pit entry, chicanes).

### Storage format (rough sketch)
```jsonc
{
  "sim": "lmu",
  "trackId": "algarve_gp",
  "sampleCount": 1024,
  "centerline": [[x, y], ...],
  "halfWidthLeft": [8.2, ...],
  "halfWidthRight": [7.9, ...],
  "viewBox": [-1.1, -0.9, 2.2, 1.8]
}
```

Once the admin tool exists we can batch-calibrate favoured circuits and check in the blobs so the viewer shows real track limits + apex shading. Until then, no telemetry channel can provide limits automatically.

### Current progress
- The public viewer already has a robust centreline renderer (`js/trackMap.js`) with pan/zoom, cursor sync, and multi-lap overlays, so once we can emit real track-boundary polylines there’s a canvas ready to display them.
- A first batch of calibration laps for Algarve lives under `lapdata_custom/calibration/algarve/` (four CSVs). They still need tagging (left/middle/right), but the raw `X/Y/Z` points are available to feed the builder prototype.
- No admin UI or JSON blob repository exists yet, so the viewer cannot load anything beyond the raw telemetry that ships inside each lap.

### Plan to continue
1. **Builder shell + ingestion**: create an `admin/track-builder.html` page that reuses `js/parser.js` so we can drag/drop calibration laps, tag them as left/middle/right, and inspect metadata (lap length, sample count, timestamps) before processing.
2. **Normalisation pipeline**: add a pure module (e.g. `js/trackBuilder/math.js`) that resamples tagged laps onto a uniform 0→1 progress grid, derives tangents/normals, and reports any gaps or spikes so we catch bad calibration data early.
3. **Width solving & smoothing controls**: expose UI sliders for sample count and smoothing window; project left/right laps onto the middle-lap normals to get half-width arrays, then run circular moving averages or Savitzky‑Golay passes with live feedback.
4. **Preview canvas for QA**: render raw inputs vs generated edges on the builder page (same canvas stack as the main app) plus a toggle to compare the generated layout inside the existing viewer before writing it to disk. This is the “validate before live” gate.
5. **Export + storage**: let the tool emit the JSON blob (matching the storage format above) into a `track_layouts/<trackId>.json` folder, record provenance (source laps, smoothing parameters), and teach the main viewer to look up blobs by `sim+trackId` so the limits render automatically whenever a matching lap loads.
