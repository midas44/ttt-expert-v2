# TC-VAC-154: Vacation days carry-over — verify no expiration (burnOff unused)

## Description
Verifies that vacation days from old years never expire. The `CSSalaryOfficeVacationData.burnOff` field exists in the CompanyStaff model but is NOT synced or used in TTT. Days accumulate indefinitely across years in the `employee_vacation` table.

## Steps
1. Query DB `employee_vacation` for per-year vacation day balances for the test employee
2. Identify records from years 2+ years ago — verify they still exist (no expiration cleanup)
3. Verify old year records have persisted values (non-zero or zero but present)
4. Call `GET /v1/vacationdays/{login}/years` API to confirm years breakdown matches DB
5. Call `GET /v1/vacationdays/{login}` to verify `pastPeriodsAvailableDays` includes old balances
6. Verify no `burn_off` column exists in `ttt_vacation.office` table (setting unimplemented)

## Data
- **Employee**: pvaynmaster (established employee with multi-year history)
- **DB table**: `ttt_vacation.employee_vacation` (year + available_vacation_days per employee)
- **API**: `GET /api/vacation/v1/vacationdays/{login}` and `/years`
