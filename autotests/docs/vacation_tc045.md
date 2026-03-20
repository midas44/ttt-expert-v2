# TC-VAC-045 — APPROVED → CANCELED (employee cancels)

## Title
TC-VAC-045 — APPROVED → CANCELED (employee cancels)

## Description
API test for the APPROVED→CANCELED status transition. Creates a vacation, approves it, then cancels via PUT /cancel/{id}. Verifies status transitions through NEW→APPROVED→CANCELED with correct state progression and persistence.

## Steps
1. POST /api/vacation/v1/vacations with:
   - employeeLogin: pvaynmaster
   - startDate: Mon-Fri week at offset 51 (~Mar 2027)
   - endDate: end of same week
   - paymentType: REGULAR
2. Verify 200 response with status=NEW
3. PUT /api/vacation/v1/vacations/{id}/approve to transition to APPROVED
4. Verify 200 response with status=APPROVED
5. PUT /api/vacation/v1/vacations/{id}/cancel to transition to CANCELED
6. Verify 200 response with status=CANCELED
7. GET /{id} to confirm CANCELED persisted
8. Cleanup: DELETE vacation

## Test Data
- Employee: pvaynmaster (self-approver)
- Duration: Mon-Fri week (5 days)
- Payment Type: REGULAR
- Offset: 51 days from reference (~Mar 2027)

## Test Type
API test

## Priority
High

## Preconditions
- pvaynmaster exists and is active
- pvaynmaster is self-approver or approver is available
- Employee has sufficient available days for REGULAR vacation

## Expected Outcome
Status transitions correctly: NEW → APPROVED → CANCELED. Each state confirmed in responses and persisted in GET. Cleanup succeeds with DELETE.
