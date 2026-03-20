# TC-VAC-042: NEW → DELETED (employee deletes)

## Description
Verifies that an employee can delete their own vacation in NEW status via DELETE /{id}. This is a soft delete — the vacation record persists in the DB with status DELETED. DELETED is a terminal state.

## Steps
1. POST /api/vacation/v1/vacations — create a REGULAR vacation (status = NEW)
2. DELETE /api/vacation/v1/vacations/{id} — delete the vacation
3. GET /api/vacation/v1/vacations/{id} — verify status = DELETED (soft delete)

## Test Data
- Login: pvaynmaster (API_SECRET_TOKEN auth)
- Vacation type: REGULAR, 5-day Mon-Fri window
- Week offset: 15 (to avoid conflicts with other tests)
