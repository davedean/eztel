slide the selection along in the sector bar.

## Investigation

- The progress track already supports redefining the view window by dragging anywhere in the bar (`js/progress.js:20-86`), but once a range is chosen there is no affordance to “grab” the window and move it without resizing—attempting to start a drag inside the existing selection just creates a new selection.
- UX feedback expects a “slide” interaction similar to Garage 61: drag handles or a middle drag that shifts the selected window while preserving its width.

## Proposed fix

1. Detect pointerdown events that originate inside the current selection (`elements.progressWindow`) and enter a “pan” mode instead of a full re-selection.
2. Track the delta while dragging and update `uiState.viewWindow` via `setViewWindow()` by shifting start/end, clamping to lap bounds (mirrors the track map pan).
3. Provide visual feedback (e.g., change cursor to `grab/grabbing`) to signal sliding vs. resizing, matching common timeline widgets.

## Status

✅ Completed — the progress window now uses grab/grabbing cursors and pointerdown events inside the selection enter “slide” mode, dragging keeps the window width intact while clamping to lap bounds, and all linked views update accordingly.
