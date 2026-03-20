# TC-VAC-039: NEW → APPROVED (approver approves)

**Suite:** TS-Vac-StatusFlow | **Priority:** Critical | **Type:** API

## Description
Verifies the core approval flow: create a vacation in NEW status, then approve it as the assigned approver. Confirms status transition persists.

## Steps
1. POST /api/vacation/v1/vacations — create vacation for employee (status=NEW)
2. POST /api/vacation/v1/vacations/approve/{id} — approve as assigned approver
3. Verify: status=APPROVED in response
4. GET /api/vacation/v1/vacations/{id} — confirm persistence
5. Cleanup: PUT cancel/{id} → DELETE /{id}

## Data
- **Static:** slebedev (employee), pvaynmaster (manager), 2026-04-13 to 2026-04-17
- **Dynamic:** Random employee with enabled manager, next available Mon-Fri
