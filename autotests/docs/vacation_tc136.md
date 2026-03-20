# TC-VAC-136: AV=true — Negative Balance Carry-Over

## Description
Verifies that AdvanceCalculationStrategy correctly handles negative balances for AV=true offices.
Unlike AV=false (which clamps to 0), AV=true allows negative available days. Tests the
availablePaidDays endpoint and cross-verifies with DB balances.

## Steps
1. GET vacationdays/{login} — baseline summary
2. GET vacationdays/{login}/years — check per-year balances (any negative?)
3. GET availablePaidDays — record baseline
4. Cross-verify with DB employee_vacation balances
5. Create 5-day REGULAR vacation to consume days
6. Verify available days decreased by exactly regularDays consumed
7. Verify AV=true formula (no clamping to 0)

## Data
- **Login**: pvaynmaster (AV=true, Персей office, office_id=20)
- **Vacation**: 5-day Mon-Fri (offset 239, dynamic)
- **Type**: REGULAR
