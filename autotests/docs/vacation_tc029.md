---
test_id: TC-VAC-029
module: vacation
title: Update REJECTED vacation — skips day limit checks
type: API
priority: Medium
---

# TC-VAC-029: Update REJECTED vacation — skips day limit checks

## Description
Verify that a REJECTED vacation can be updated via PUT and that the VacationUpdateValidator skips day limit adjustments for REJECTED status. Creates a vacation, rejects it, then updates dates and verifies.

## Steps
1. POST create vacation (status = NEW)
2. PUT /reject/{id} to reject (status = REJECTED)
3. PUT /api/vacation/v1/vacations/{id} with updated dates
4. Verify update response — check resulting status and updated dates

## Expected Result
- Create returns 200, status NEW
- Reject returns 200, status REJECTED
- Update returns 200, dates updated
- Validator skips raw daysLimitations adjustment for REJECTED vacations
- Status may transition to NEW — test documents actual behavior

## Data
- Login: pvaynmaster (acts as both employee and approver)
- Two conflict-free Mon-Fri windows (original + updated)
