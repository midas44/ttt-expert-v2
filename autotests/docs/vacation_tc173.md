## TC-VAC-173: Expected year-end balance calculation — unbounded year sum (#3360 fix)

**Type:** API + DB (Functional)
**Suite:** TS-VAC-PastDateVal
**Priority:** High

### Description

Verifies that the vacation day balance calculation includes ALL past years (unbounded sum), not just the most recent 2 years. MR !5116 fixed `EmployeeDaysServiceImpl.calculateDaysNotAfter()` by changing the SQL from a 3-year window (`WHERE year <= :before AND year >= :after`) to an unbounded query (`WHERE year <= :year`). This ensures employees with 3+ years of accruals see correct `availablePaidDays`.

### Steps

1. **DB:** Retrieve all `employee_vacation` rows for pvaynmaster, grouped by year
2. **Compute** unbounded DB sum of `available_vacation_days` across ALL years
3. **API:** GET `/vacationdays/{login}/years` — verify all DB years appear in response
4. **API:** GET `/vacationdays/available` — record baseline `availablePaidDays`
5. **Create** a 5-day REGULAR vacation
6. **Re-check** `availablePaidDays` — should decrease by regularDays consumed
7. **Delete** vacation and verify balance restores to baseline

### Data

- **Login:** pvaynmaster (AV=true office, Персей)
- **Dates:** Future Mon-Fri week (offset 257)
- **Key fields:** `availablePaidDays`, `employee_vacation.available_vacation_days`
- **Fix reference:** MR !5116, issue #3360
