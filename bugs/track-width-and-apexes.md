## Track limits overlay

**Status**: ✅ Generator + SPA overlay shipped (2025-11-18) — ✅ preview/QA tool added (2025-11-19)

Track limit overlays now originate from calibration laps processed by the track map generator. The CLI ingests “hug left/right” laps, produces JSON assets in `assets/trackmaps/`, and the SPA automatically draws the grey limit lines whenever a lap from a calibrated circuit is loaded. A browser-based admin tool now lets us inspect calibration laps, tune samples/smoothing, and push a preview straight into the SPA before committing JSON.

### What shipped in the merged branch
- `tools/generateTrackMap.js` implements the complete processing pipeline (lap loading, resampling, centreline & normal derivation, width solving, smoothing, edge generation, and JSON export). Reusable math modules live under `js/trackMapGenerator/`.
- Calibration CSVs now live in `lapdata_custom/calibration/{trackId}/`. The first production asset (`assets/trackmaps/algarve_gp.json`) plus the registry (`assets/trackmaps/index.json`) prove the workflow end-to-end.
- `js/trackMapLoader.js` fetches and caches JSON assets, while `js/trackMap.js` renders left/right boundaries and the dashed centreline beneath the existing telemetry traces. Loader now also checks for a preview blob stored in `localStorage` so QA runs can inject a temporary track map without touching the repo.
- `admin/track-map-preview.html` offers a dropzone + controls for tagging left/right/center laps, tuning sample count and smoothing, visualising the raw laps vs generated edges, downloading the JSON, or seeding the SPA via `localStorage` with a single click.
- `tools/README_TRACK_MAP_GENERATOR.md` documents the full workflow (recording calibration laps, running the CLI, interpreting warnings), and now points to the preview tool for QA before committing assets.

- **Asset provenance is still opaque**: metadata sits inside each JSON, but there’s no registry UI summarising which laps/settings produced a map, so audits across multiple tracks will be painful once more circuits land.
- **Preview exports are manual**: the preview tool can download JSON and seed the SPA, but there’s no “promote this blob into `assets/trackmaps/` and `index.json`” helper yet.
- **Coverage**: Algarve is calibrated; other tracks still need recorded laps + QA runs through the new tool.
- **CLI-only operators still lack richer diagnostics**: width/curvature plots or a `--preview` HTML export would help those who want to stick to the terminal.

### Plan to continue
1. **Track map registry dashboard**  
   - Small admin view that reads `assets/trackmaps/index.json`, lists generatedAt timestamps + calibration filenames, and links directly into the preview tool with defaults pre-filled.  
   - Flag maps older than N days or missing centre laps to prioritise recalibration.
2. **Promote-from-preview helper**  
   - Extend the preview UI with a “Save into repo” workflow that writes the JSON + updates `assets/trackmaps/index.json` (maybe via a script stub the user runs locally) so QA + commit is a single flow.
3. **Preview tuning controls**  
   - Add sliders/inputs for (a) min/max width clamps, (b) left/right lap weighting vs centre lap (including a “no centre lap” mode that averages left/right midpoints), (c) segment-specific smoothing boosts (e.g., for pit entry) so users can iterate until the generated edges stay within the recorded limits.  
   - Show live diagnostics (width histogram, highlight sections where generated edges cross raw laps) and allow per-sector overrides (e.g., “lock centreline to raw left/right average between progress 0.6–0.7”).  
   - Persist the chosen parameters so the CLI can be invoked with the same values when exporting the final blob.
4. **Geometric guardrails**  
   - Add post-processing checks that ensure `centerline ± halfWidth` never exceeds the convex hull created by the contributing laps. If a segment pushes outside the left/right traces, nudge the half-width back toward zero and record the adjustment so editors know where manual tweaks are needed.  
   - Support multiple left/right laps by averaging their projections so the algorithm stays robust when centre laps are skipped or noisy.
5. **CLI diagnostics**  
   - Add a `--preview` flag that emits a standalone HTML (or dumps CSVs for centreline/widths) so terminal-first workflows still gain visibility without launching the browser tool.
6. **Track coverage push**  
   - Schedule calibration laps for the next priority circuits (Spa, Monza, etc.), run them through the preview tool with the new controls, and land the resulting blobs once they pass QA.

### Storage format (current schema)
```jsonc
{
  "sim": "lmu",
  "trackId": "algarve_international_circuit",
  "trackName": "Algarve International Circuit",
  "version": 1,
  "generatedAt": "2025-11-18T06:26:27.453Z",
  "sampleCount": 1024,
  "centerline": [[x, z], ...],
  "halfWidthLeft": [8.2, 7.9, ...],
  "halfWidthRight": [7.9, 8.1, ...],
  "leftEdge": [[x, z], ...],
  "rightEdge": [[x, z], ...],
  "viewBox": [-1.1, -0.9, 2.2, 1.8],
  "smoothingWindow": 30,
  "calibrationLaps": {
    "left": "20251118162851093044_lap5.csv",
    "center": null,
    "right": "20251118162851093044_lap7.csv"
  }
}
```

### File layout & docs
- Track maps → `assets/trackmaps/{trackId}.json`
- Track registry → `assets/trackmaps/index.json`
- Calibration source CSVs → `lapdata_custom/calibration/{trackId}/`
- Workflow guide → `tools/README_TRACK_MAP_GENERATOR.md`

### Original context (kept for reference)
- **Option 1 – Manual track-definition assets**: never pursued (external SVGs, hard to keep updated).
- **Option 2 – Calibration laps + admin tooling**: implemented via CLI; preview/QA extras still outstanding per the plan above.
