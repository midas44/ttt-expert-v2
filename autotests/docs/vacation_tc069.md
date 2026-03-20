# TC-VAC-069: AV=false Basic Accrual Formula — Mid-Year Calculation

## Description
Tests the RegularCalculationStrategy accrual formula for AV=false offices:
accruedDays = paymentMonth × (normDays / 12). Verifies that available days increase
proportionally with the payment month, and that negative values are clamped to 0.

## Steps
1. Find AV=false employee via DB
2. GET vacationdays/{login} for normForYear
3. GET availablePaidDays with paymentDate = March, June, December
4. Verify linear increase: delta(3→6) ≈ 3×(norm/12), delta(6→12) ≈ 6×(norm/12)
5. Verify all values ≥ 0 (AV=false clamping)
6. Cross-verify with DB employee_vacation balances

## Data
- **Login**: random AV=false employee (dynamic from DB)
- **Read-only test**: no vacation creation, no cleanup needed
