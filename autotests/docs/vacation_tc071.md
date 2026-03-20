# TC-VAC-071 — AV=true: full year available immediately

## Title
TC-VAC-071 — AV=true: full year available immediately

## Description
Read-only API test verifying that AV=true (advance_vacation=true) employees see full annual vacation balance immediately, not monthly proration. For pvaynmaster in Персей office (AV=true, norm=24 days), availablePaidDays should significantly exceed what monthly proration would give (month * 24/12 = 2 days per month).

## Steps
1. Compute expected available days:
   - Full year balance: 24 days
   - Monthly prorated amount: 24/12 = 2 days/month
2. GET /api/vacation/v1/vacationdays/available with:
   - employeeLogin: pvaynmaster
   - paymentDate: 1st of next month
   - newDays: 0
3. Verify 200 response
4. Verify availablePaidDays > monthly prorated amount (> 2 days)
5. Confirm availablePaidDays reflects full year balance for AV=true office

## Test Data
- Employee: pvaynmaster
- Office: Персей (advance_vacation=true, norm=24 days)
- Vacation Norm: 24 days/year
- Payment Date: 1st of next month
- Expected Available Days: ~24 days (full year, not monthly prorated)
- Monthly Prorated: 2 days (24/12)

## Test Type
API test (read-only, vacation days calculation)

## Priority
Medium

## Preconditions
- pvaynmaster exists and is active in Персей office
- Персей office configured with advance_vacation=true
- Vacation norm for pvaynmaster is 24 days/year
- No vacations planned for next month (to avoid reducing available days)

## Expected Outcome
GET returns availablePaidDays significantly greater than 2 (monthly prorated). Full year balance (24 days) is available immediately for AV=true employees. No monthly proration applied.
