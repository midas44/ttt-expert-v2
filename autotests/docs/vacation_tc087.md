# TC-VAC-087: Days by years endpoint verification

## Description
Verifies the vacation days grouped by years endpoint returns correct per-year breakdown of vacation day balance. Cross-checks with the employee_vacation table in the database.

## Steps
1. GET /api/vacation/v1/vacationdays/{login}/years
2. Verify response is an array of {year, days} objects
3. Verify each entry has numeric year and days fields
4. Cross-check with DB: SELECT year, days FROM employee_vacation WHERE employee=<id>
5. Verify API years match DB years and days values are consistent

## Data
- Employee: pvaynmaster (AV=true office, Персей)
- Auth: API_SECRET_TOKEN
- No state modification (read-only test)
