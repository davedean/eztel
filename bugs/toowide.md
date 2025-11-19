the page is _Very_ wide?? it looks like the lanes go for 10x a screen width?? there's sort of shading and an "end cap" as well, in line with the lanes.

so the page width is bugged somehow.

## Resolution

**Status**: ✅ Fixed

### Root Causes Identified

1. **Page Width Issue**: The `.lanes-wrapper` container had no `max-width` or `overflow` constraints, allowing Chart.js charts (configured with `responsive: true`) to expand the container indefinitely beyond the viewport.

2. **Selection Overlay Issue**: When clicking "All" to view the full lap, selection overlays (the "end cap" shading) remained visible in both the lane charts and progress bar, even though the entire lap was in view.

3. **Progress Bar Blocking Issue**: When viewing the full lap, the entire progress bar was treated as a "slide" target, preventing users from creating new selections. The cursor would become a hand icon but no new selection could be made.

### Fixes Applied

#### 1. CSS Width Constraints (`index.html`)
- Added `max-width: 100%`, `overflow-x: hidden`, and `min-width: 0` to `.lanes-wrapper`
- Added `max-width: 100%` and `overflow: hidden` to `.lane`
- This prevents charts from expanding beyond the viewport and fixes the horizontal scrolling issue

#### 2. Lane Selection Overlay Logic (`js/charts.js`)
- Updated `syncLaneSelectionOverlay()` to detect when viewing the full lap (within 1% tolerance)
- When viewing full lap, overlays are hidden instead of showing the full-width selection

#### 3. Progress Bar Selection Logic (`js/progress.js`)
- Updated `updateProgressWindow()` to hide the progress window when viewing the full lap
- Updated the `pointerdown` event handler to always use "select" mode (not "slide" mode) when viewing the full lap
- This allows users to create new selections after clicking "All"

### Testing
- All existing tests pass (8/8)
- No lint errors introduced
- Changes are backwards compatible
