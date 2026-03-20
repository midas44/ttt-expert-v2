# TC-VAC-040: NEW → REJECTED (approver rejects)

**Suite:** TS-Vac-StatusFlow | **Priority:** Critical | **Type:** API

## Description
Verifies the rejection flow: create a vacation in NEW status, then reject it as the assigned approver. Confirms status transition and days return to pool.

## Steps
1. POST /api/vacation/v1/vacations — create vacation for employee (status=NEW)
2. PUT /api/vacation/v1/vacations/reject/{id} — reject as assigned approver
3. Verify: status=REJECTED in response
4. GET /api/vacation/v1/vacations/{id} — confirm persistence
5. Cleanup: DELETE /{id}

## Data
- **Static:** slebedev (employee), pvaynmaster (manager), 2026-04-20 to 2026-04-24
- **Dynamic:** Random employee with enabled manager, next available Mon-Fri
