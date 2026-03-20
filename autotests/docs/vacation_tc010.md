# TC-VAC-010: Create with insufficient available days (AV=true)

**Suite:** TS-Vac-Create | **Priority:** High | **Type:** API

## Description
Verifies that the API rejects a vacation request when the requested duration exceeds the employee's available paid days. Uses pvaynmaster (AV=true office, Персей, 24 days/year, ~153 accumulated) with a vacation spanning 3 years (~777 working days), which far exceeds any possible balance. Expects a 400 validation error with `validation.vacation.duration` error code.

## Steps
1. POST /api/vacation/v1/vacations with pvaynmaster login, dateFrom=2027-04-07, dateTo=2030-03-27, paymentType=REGULAR
2. Verify response: HTTP 400
3. Verify error body contains `validation.vacation.duration` error code
4. No cleanup needed (creation should be rejected)

## Data
- **Data class:** VacationTc010Data (static dates, no DB needed)
- **Employee:** pvaynmaster (AV=true office, 24 days/year, ~153 accumulated)
- **Static dates:** 2027-04-07 to 2030-03-27 (~777 working days across 3 years)
- **Spec:** vacation-tc010.spec.ts
