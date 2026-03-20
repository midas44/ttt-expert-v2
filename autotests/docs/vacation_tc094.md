# TC-VAC-094: Payment type alignment bug — admin vacation paid as regular

## Description
Verifies that an ADMINISTRATIVE vacation can be paid with `regularDaysPayed=1, administrativeDaysPayed=0` — a known bug where `checkForPayment()` only validates total days match (`regular + admin == vacation.getDays()`) but does NOT validate type alignment.

## Steps
1. Create an ADMINISTRATIVE vacation (1 day)
2. Approve the vacation
3. Pay with mismatched types: `regularDaysPayed=1, administrativeDaysPayed=0`
4. Verify HTTP 200 (BUG — should be 400)
5. Verify DB payment record shows incorrect classification (regular_days=1 for admin vacation)

## Data
- Login: pvaynmaster
- Week offset: 197+ (single day, dynamic)
- Note: PAID+EXACT vacations cannot be deleted — leaves permanent record
