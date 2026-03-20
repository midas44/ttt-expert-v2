# TC-VAC-021: Create vacation — verify available days decrease atomically

## Description

Verifies that `availablePaidDays` decreases by exactly the number of vacation working days immediately after creation. The available days API factors in pending (NEW) vacations in its calculation.

### Steps

1. **Get balance before** — `GET /api/vacation/v1/vacationdays/available?employeeLogin=X&paymentDate=Y&newDays=0`
2. **Create 5-day REGULAR vacation** — `POST /api/vacation/v1/vacations`
3. **Get balance after** — Same endpoint as step 1
4. **Compare** — `beforeDays - afterDays` should equal `vacation.regularDays`

### Data

- **User**: pvaynmaster (AV=true, Персей office)
- **Vacation type**: REGULAR, 5 working days (Mon-Fri)
- **Key assertion**: `decrease === vacationWorkingDays` (atomic, exact match)
- Note: DB `available_vacation_days` column changes at approval, but API endpoint accounts for NEW vacations
- Cleanup: DELETE vacation after test
