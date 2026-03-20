# TC-VAC-003 — Create ADMINISTRATIVE vacation (unpaid)

## Title
TC-VAC-003 — Create ADMINISTRATIVE vacation (unpaid)

## Description
API test verifying ADMINISTRATIVE (unpaid) vacation creation. Creates a single-day ADMINISTRATIVE vacation. Verifies that minimum duration of 1 day is accepted (not blocked by 5-day minimum), no available days check is performed, and paymentType=ADMINISTRATIVE persists.

## Steps
1. POST /api/vacation/v1/vacations with:
   - employeeLogin: pvaynmaster
   - startDate: single weekday at offset 48 (~Feb 2027)
   - endDate: same day
   - paymentType: ADMINISTRATIVE
2. Verify 200 response
3. Verify status=NEW in response
4. Verify paymentType=ADMINISTRATIVE in response
5. Verify 1-day duration is accepted (not blocked by 5-day minimum)
6. Verify no available days validation performed (ADMINISTRATIVE is unpaid)
7. GET /{id} to confirm persistence
8. Cleanup: DELETE vacation

## Test Data
- Employee: pvaynmaster
- Duration: 1 day (single weekday)
- Payment Type: ADMINISTRATIVE (unpaid)
- Offset: 48 days from reference (~Feb 2027)
- Available Days Check: Not performed (ADMINISTRATIVE is unpaid)

## Test Type
API test

## Priority
High

## Preconditions
- pvaynmaster exists and is active
- ADMINISTRATIVE vacation type is configured as unpaid
- Database state allows 1-day vacation creation

## Expected Outcome
ADMINISTRATIVE vacation created successfully with status=NEW. Single-day duration accepted without 5-day minimum enforcement. No available days validation performed. paymentType=ADMINISTRATIVE confirmed in response.
