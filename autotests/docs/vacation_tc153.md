# TC-VAC-153: First vacation restriction — verify 3-month hardcoded waiting period

## Description
Verifies the hardcoded 3-month employment restriction in `DaysLimitationService`. Within the first 3 months of employment, REGULAR vacation day limit is 0 (ADMINISTRATIVE still allowed). The CS field `firstVacation` is NOT synced or used. Tests the positive path: established employee (>3 months) successfully creates REGULAR vacation.

## Steps
1. Get employee's `first_day` from DB to calculate months since hire
2. Verify employee is past the 3-month threshold
3. Call `GET /v1/vacationdays/available` — verify available REGULAR days > 0
4. Create REGULAR vacation via POST /v1/vacations — verify success (no restriction)
5. Verify no `first_vacation` column in `ttt_vacation.office` table (CS setting unimplemented)

## Data
- **Employee**: pvaynmaster (established, hired years ago)
- **Week offset**: 245 (future dates)
- **Mechanism**: `DaysLimitationService` — `List.of(new Limit(3, BigDecimal.valueOf(0)))` hardcoded for all offices
- **Note**: Negative path (new employee blocked) requires a recently-hired employee, not testable with pvaynmaster
