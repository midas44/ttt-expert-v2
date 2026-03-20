# TC-VAC-164: FIFO Redistribution Across Year Boundary

## Description
Tests that creating a cross-year vacation (Dec 15 → Jan 9, ~13 working days) correctly splits
days across years using FIFO (First In, First Out) from the earliest balance year.
Verifies vacation_days_distribution table, balance changes, and availablePaidDays API.

## Steps
1. Record balance before via availablePaidDays API
2. Create cross-year REGULAR vacation spanning Dec→Jan
3. Query vacation_days_distribution — verify FIFO ordering (earliest year first)
4. Verify distribution total equals regularDays from API response
5. Verify DB vacation record spans two calendar years
6. Verify balance decreased via availablePaidDays API
7. Verify AV=true employee can still create vacations (no clamping)

## Data
- **Login**: pvaynmaster (AV=true, Персей office)
- **Range**: Dec 15 → Jan 9 for years 2032-2034 (dynamic conflict avoidance)
- **Type**: REGULAR
