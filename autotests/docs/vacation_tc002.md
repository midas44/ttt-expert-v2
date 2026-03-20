# TC-VAC-002 — Create REGULAR vacation (AV=true office)

## Title
TC-VAC-002 — Create REGULAR vacation (AV=true office)

## Description
API test verifying vacation creation for employee in advance_vacation=true office. Creates a Mon-Fri REGULAR vacation for pvaynmaster (Персей office, AV=true). Verifies status=NEW, approver auto-assigned, and vacationDays response reflects full year balance (not monthly proration).

## Steps
1. POST /api/vacation/v1/vacations with:
   - employeeLogin: pvaynmaster
   - startDate: Mon-Fri week at offset 45 (~Jan 2027)
   - endDate: end of same week
   - paymentType: REGULAR
2. Verify 200 response
3. Verify status=NEW in response
4. Verify paymentType=REGULAR in response
5. Verify approver is auto-assigned
6. Check vacationDays response reflects full year balance (not monthly proration)
7. GET /{id} to confirm persistence
8. Cleanup: DELETE vacation

## Test Data
- Employee: pvaynmaster
- Office: Персей (advance_vacation=true)
- Duration: Mon-Fri week (5 days)
- Payment Type: REGULAR
- Vacation Days: Full year balance expected (not monthly)
- Offset: 45 days from reference (~Jan 2027)

## Test Type
API test

## Priority
High

## Preconditions
- pvaynmaster exists and is active
- Персей office is configured with advance_vacation=true
- Employee has sufficient available days for REGULAR vacation type

## Expected Outcome
Vacation created successfully with status=NEW, REGULAR paymentType confirmed, approver auto-assigned, and vacation days response reflects full year balance calculation.
