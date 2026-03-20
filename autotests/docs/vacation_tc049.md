---
test_id: TC-VAC-049
module: vacation
title: CANCELED to NEW transition (employee re-opens)
type: API
priority: Medium
---

# TC-VAC-049: CANCELED → NEW (employee re-opens)

## Description
Verify that an employee can re-open a CANCELED vacation by updating it via PUT. Although CANCELED is in FINAL_STATUSES, an explicit CANCELED→NEW transition exists in VacationStatusManager's transition map. Days are recalculated upon re-opening.

## Steps
1. POST create vacation (status = NEW)
2. PUT /cancel/{id} to cancel (status = CANCELED)
3. PUT /api/vacation/v1/vacations/{id} with same or updated dates
4. Verify status changes to NEW and days are recalculated
5. GET to confirm NEW status persisted

## Expected Result
- Create returns 200, status NEW
- Cancel returns 200, status CANCELED
- Update returns 200, status transitions from CANCELED to NEW
- Vacation re-enters active lifecycle
- Days are recalculated for the new date range

## Data
- Login: pvaynmaster
- Two conflict-free Mon-Fri windows (original + updated)
