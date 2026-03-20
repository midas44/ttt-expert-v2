# TC-VAC-001: Create REGULAR vacation — happy path (AV=false office)

**Suite:** TS-Vac-Create | **Priority:** Critical | **Type:** API

## Description
Verifies that a REGULAR vacation can be created via the API for an employee in an AV=false (non-advance-vacation) office. Confirms auto-approver assignment, correct status, and data persistence.

## Steps
1. POST /api/vacation/v1/vacations with valid REGULAR vacation data (employee login, future Mon-Fri dates, paymentType=REGULAR, paymentMonth, empty optionalApprovers/notifyAlso)
2. Verify response: HTTP 200, status=NEW, approver auto-assigned, paymentType=REGULAR
3. GET /api/vacation/v1/vacations/{id} to confirm persistence: dates, status, paymentType match
4. Cleanup: DELETE /api/vacation/v1/vacations/{id}

## Data
- **Static:** slebedev, 2026-04-06 to 2026-04-10
- **Dynamic:** Random employee in AV=false office, next available Mon-Fri without conflicts (DB query)
