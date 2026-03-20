# TC-VAC-165: Edit Multi-Year Vacation — Redistribution Recalculates

## Description
Tests that editing a cross-year vacation triggers VacationRecalculationServiceImpl to
redistribute days. Creates a Dec→Jan vacation, then shortens it to end in December,
verifying that vacation_days_distribution is recalculated.

## Steps
1. Create cross-year vacation (Dec 18 → Jan 5)
2. Record distribution rows from vacation_days_distribution
3. Update vacation to end Dec 24 (shorter, single-year)
4. Verify distribution recalculated (fewer total days, matching new regularDays)
5. Verify vacation now within single calendar year in DB

## Data
- **Login**: pvaynmaster (AV=true, Персей office)
- **Original range**: Dec 18 → Jan 5 (cross-year, ~10 working days)
- **Shortened range**: Dec 18 → Dec 24 (~5 working days)
- **Years**: 2035-2037 (dynamic conflict avoidance)
