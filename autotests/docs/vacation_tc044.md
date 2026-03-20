# TC-VAC-044: APPROVED → NEW (employee edits dates)

## Description
Verifies the critical business rule: when an employee edits dates on an APPROVED vacation, the status resets back to NEW, requiring re-approval. The approver must re-approve the vacation. State machine rule: `add(APPROVED, NEW, ROLE_EMPLOYEE)`.

## Steps
1. POST /api/vacation/v1/vacations — create a REGULAR vacation (status = NEW)
2. PUT /api/vacation/v1/vacations/approve/{id} — approve it (status = APPROVED)
3. PUT /api/vacation/v1/vacations/{id} — update dates (status resets to NEW)
4. GET /api/vacation/v1/vacations/{id} — verify status = NEW, dates updated

## Test Data
- Login: pvaynmaster (API_SECRET_TOKEN auth, self-approver)
- Original dates: Mon-Fri at week offset 18
- Updated dates: Mon-Fri at week offset 21
- Both date ranges checked for conflicts via DB
