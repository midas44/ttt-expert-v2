# TC-VAC-171 — Boundary: today/future accepted, yesterday rejected

## Title
TC-VAC-171 — Boundary: today/future accepted, yesterday rejected

## Description
API test for the past start date validation boundary. The server validates startDate.isBefore(today) — strict less-than comparison. Today is NOT "before" today, so it passes. Yesterday IS before today, so it fails with a "past" error. Uses database conflict check to find first available date >= today. Note: crossing check includes DELETED records in the availability search.

## Steps
1. POST /api/vacation/v1/vacations with:
   - employeeLogin: pvaynmaster
   - startDate: today or future date
   - endDate: 5 days later
   - paymentType: REGULAR
2. Verify 200 response with status=NEW (today is NOT "before" today, passes validation)
3. Cleanup: DELETE vacation
4. POST /api/vacation/v1/vacations with:
   - employeeLogin: pvaynmaster
   - startDate: yesterday
   - endDate: 4 days after yesterday
   - paymentType: REGULAR
5. Verify 400 response with "past" error message
6. Verify vacation not created

## Test Data
- Employee: pvaynmaster
- Test Case 1 (success): startDate = today or computed future date (offset >= 0)
- Test Case 2 (failure): startDate = yesterday
- Duration: 5 days (Mon-Fri week)
- Payment Type: REGULAR
- Note: Crossing check includes DELETED vacations, so findAvailableDay searches up to 365 days for conflict-free date

## Test Type
API test (boundary value)

## Priority
High

## Preconditions
- pvaynmaster exists and is active
- Current date/time is known and stable during test
- Employee has sufficient available days for REGULAR vacation

## Expected Outcome
- Test Case 1: startDate >= today accepted (status=NEW)
- Test Case 2: startDate < today rejected with 400 error and "past" error message
- Boundary condition: today IS a valid start date (not rejected as past)
