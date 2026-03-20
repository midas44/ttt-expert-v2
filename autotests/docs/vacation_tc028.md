---
test_id: TC-VAC-028
module: vacation
title: Update CANCELED vacation
type: API
priority: Medium
---

# TC-VAC-028: Update CANCELED vacation

## Description
Verify that a CANCELED vacation can be updated via PUT. The VacationUpdateValidator skips day limit checks for CANCELED status. This test creates a vacation, cancels it, then updates the dates and verifies the update succeeds.

## Steps
1. POST create vacation (status = NEW)
2. PUT /cancel/{id} to cancel (status = CANCELED)
3. PUT /api/vacation/v1/vacations/{id} with updated dates
4. Verify update response — check resulting status and updated dates

## Expected Result
- Create returns 200, status NEW
- Cancel returns 200, status CANCELED
- Update returns 200, dates updated
- Note: status may transition to NEW (CANCELED→NEW is in transition map) — test documents actual behavior

## Data
- Login: pvaynmaster
- Two conflict-free Mon-Fri windows (original + updated)
