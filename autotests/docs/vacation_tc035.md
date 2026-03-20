---
test_id: TC-VAC-035
module: vacation
title: "Update paymentType REGULAR -> ADMINISTRATIVE"
type: API
priority: Medium
suite: TS-Vac-Update
---

# TC-VAC-035: Update Payment Type from REGULAR to ADMINISTRATIVE

## Description
Verifies that updating a vacation's paymentType from REGULAR to ADMINISTRATIVE triggers day pool recalculation. Previously consumed REGULAR days return to pool, and ADMINISTRATIVE days are set instead.

## Steps
1. Create a REGULAR vacation (status = NEW, regularDays > 0)
2. PUT update with paymentType = ADMINISTRATIVE (same dates)
3. Verify paymentType changed, regularDays = 0, administrativeDays > 0
4. GET to confirm persistence

## Data
- **User**: `pvaynmaster` (self-approver)
- **Dates**: Dynamic Mon-Fri window (offset 170)
- **Original type**: REGULAR
- **Updated type**: ADMINISTRATIVE

## Key Assertions
- paymentType changes from REGULAR to ADMINISTRATIVE
- regularDays becomes 0
- administrativeDays becomes > 0 (recalculated for same date range)
- Status remains NEW
- Duration validation switches to ADMINISTRATIVE rules (min 1 day instead of 5)
