# TC-VAC-093: Pay with negative days

## Description
Verifies that the vacation payment endpoint rejects negative values for `regularDaysPayed`. The `VacationPaymentDTO` has `@Range(min=0, max=366)` annotations on payment fields, so negative values should trigger a 400 validation error.

## Steps
1. Create a REGULAR vacation (Mon-Fri, 5 days)
2. Approve the vacation
3. Attempt payment with `regularDaysPayed: -1, administrativeDaysPayed: 0`
4. Verify HTTP 400 returned
5. Verify vacation remains in APPROVED status

## Data
- Login: pvaynmaster
- Week offset: 194+ (dynamic conflict-free search)
- Cleanup: cancel → delete after test
