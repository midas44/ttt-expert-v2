# TC-VAC-089: Pay ADMINISTRATIVE vacation — happy path

**Suite:** TS-Vac-Payment
**Priority:** High
**Type:** API Functional

## Description

Tests paying an ADMINISTRATIVE (unpaid) vacation. The day split uses `administrativeDaysPayed` instead of `regularDaysPayed`. ADMINISTRATIVE vacations have no impact on paid leave balance.

## Steps

1. **Create** ADMINISTRATIVE vacation via POST (regularDays=0, administrativeDays>0)
2. **Approve** via PUT /approve/{id}
3. **Pay** via PUT /pay/{id} with `{regularDaysPayed: 0, administrativeDaysPayed: N}`
4. **Verify** status is PAID, paymentType remains ADMINISTRATIVE

## Data

- **User:** pvaynmaster
- **Dates:** Dynamic (offset 152+ weeks)
- **Payment type:** ADMINISTRATIVE
