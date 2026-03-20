# TC-VAC-100: Verify balance unchanged after payment

## Description

Confirms that vacation day balance (`availablePaidDays`) does NOT change when a vacation is paid. Days are deducted at APPROVAL time, not at payment time. Payment is purely an accounting status transition (APPROVED → PAID).

### Steps

1. **Get initial balance** — `GET /api/vacation/v1/vacationdays/available`
2. **Create REGULAR vacation** — `POST /api/vacation/v1/vacations`
3. **Approve vacation** — `PUT /api/vacation/v1/vacations/approve/{id}`
4. **Get balance before payment** — Record `availablePaidDays`
5. **Pay vacation** — `PUT /api/vacation/v1/vacations/pay/{id}` with `regularDaysPayed`
6. **Get balance after payment** — Compare with step 4 balance (must be identical)

### Data

- **User**: pvaynmaster (AV=true, Персей office)
- **Vacation type**: REGULAR, 5 working days (Mon-Fri)
- **Key assertion**: `beforePayDays === afterPayDays`
- Creates permanent PAID record (cannot be fully deleted)
