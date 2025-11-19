speed and rpm should be normalised in the display.

## Resolution

**Status**: ✅ Fixed

### Problem
Speed and RPM charts were using fixed Y-axis maximums (350 km/h and 11000 RPM respectively), which didn't adapt to the actual data ranges. This meant:
- Charts with lower max values (e.g., 260 km/h) weren't using the full vertical space
- It was harder to see variations in the data
- Different laps/cars with different performance characteristics appeared artificially compressed

### Fix Applied

**File: `js/charts.js`**

Removed `suggestedMax` values from both chart configurations:
- Speed chart (line 45): Removed `suggestedMax: 350`
- RPM chart (line 59): Removed `suggestedMax: 11000`

Now both charts auto-scale their Y-axes based on the actual data range, making better use of vertical space and improving readability.

### Testing
- All existing tests pass (11/11)
- No lint errors introduced
- Charts now automatically adapt to the data range while still beginning at zero
