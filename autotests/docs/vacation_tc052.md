# TC-VAC-052: Invalid transition NEW → PAID (skipping approval)

## Description
Negative test: creates a NEW vacation, then attempts to pay it directly via PUT `/pay/{id}` without going through the APPROVED status first. No `NEW→PAID` transition exists in the `VacationStatusManager` transition map.

## Steps
1. POST create vacation (status = NEW)
2. PUT `/api/vacation/v1/vacations/pay/{id}` with payment body
3. Verify: HTTP 400/403 — transition blocked
4. GET to confirm vacation is still NEW

## Data
- **User:** pvaynmaster
- **Dates:** conflict-free week at offset 136
- **Pay body:** `{ regularDaysPayed: N, administrativeDaysPayed: 0 }`
- **Key logic:** `isNextStateAvailable(NEW, PAID)` → no entry in transition map → false

## Expected Error
- HTTP 400 with `exception.vacation.status.notAllowed`
- Status remains NEW after failed pay attempt

## Cleanup
Delete created vacation via DELETE endpoint.
