# TC-VAC-041: NEW → CANCELED (employee cancels)

## Description
Verifies that an employee can cancel their own vacation in NEW status via PUT /cancel/{id}. The vacation transitions from NEW to CANCELED. Days are returned to the pool.

## Steps
1. POST /api/vacation/v1/vacations — create a REGULAR vacation (status = NEW)
2. PUT /api/vacation/v1/vacations/cancel/{id} — cancel the vacation
3. GET /api/vacation/v1/vacations/{id} — verify status = CANCELED

## Test Data
- Login: pvaynmaster (API_SECRET_TOKEN auth)
- Vacation type: REGULAR, 5-day Mon-Fri window
- Week offset: 12 (to avoid conflicts with other tests)
