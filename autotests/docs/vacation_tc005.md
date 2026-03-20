# TC-VAC-005: Create vacation with startDate > endDate

**Suite:** TS-Vac-Create | **Priority:** High | **Type:** API

## Description
Verifies that creating a vacation with startDate after endDate returns a 400 validation error with the correct error code.

## Steps
1. POST /api/vacation/v1/vacations with startDate=2026-04-10, endDate=2026-04-05 (inverted)
2. Verify: HTTP 400, errorCode contains "validation.vacation.dates.order"

## Data
- **Static:** slebedev, dates 2026-04-10 > 2026-04-05
- **Dynamic:** Random active employee, same inverted dates
