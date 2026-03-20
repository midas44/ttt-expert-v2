# TC-VAC-012: Create next-year vacation on/after Feb 1

**Suite:** TS-Vac-Create | **Priority:** Medium | **Type:** API

## Description
Verifies that when the current date is on or after February 1, employees can create vacations with start dates in the next calendar year. The `nextYearAvailableFromMonth` config (default: 2 = February) controls this cutoff. The `VacationCreateValidator.isNextVacationAvailable()` check: `startDate.getYear() > now.getYear() && now.isBefore(nextYearFrom)` — after Feb 1, the second condition is false, so the block is not triggered.

## Steps
1. Pre-check: skip test if current date is before Feb 1 (next-year block would be active)
2. POST /api/vacation/v1/vacations with startDate in next year (2027-03-08 to 2027-03-12)
3. Verify: response is 200 (created) or 400 with error OTHER than "validation.vacation.next.year.not.available"
4. Key assertion: the next-year-not-available error code must NOT appear
5. Cleanup: delete if created

## Data
- **Static:** pvaynmaster (AV=true), 2027-03-08 to 2027-03-12 (Mon-Fri in next year)
- **Dynamic:** Calculates next year from current date, uses March Mon-Fri range
