# TC-VAC-090: Pay with wrong day split (total mismatch)

**Suite:** TS-Vac-Payment
**Priority:** High
**Type:** API Negative

## Description

Tests that paying with an incorrect day split (regularDaysPayed + administrativeDaysPayed != vacation.days) is rejected with HTTP 400 and error code `exception.vacation.pay.days.not.equal`. The vacation must remain APPROVED after the failed payment.

## Steps

1. **Create** REGULAR 5-day vacation (Mon-Fri)
2. **Approve** via PUT /approve/{id}
3. **Pay** with `{regularDaysPayed: 2, administrativeDaysPayed: 2}` (sum=4, vacation=5)
4. **Verify** HTTP 400 with `pay.days.not.equal` error
5. **Verify** vacation remains APPROVED

## Data

- **User:** pvaynmaster
- **Dates:** Dynamic (offset 156+ weeks)
- **Cleanup:** Cancel + delete (vacation stays APPROVED)
