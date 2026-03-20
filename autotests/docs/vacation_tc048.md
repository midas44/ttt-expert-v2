# TC-VAC-048: APPROVED → PAID (accountant pays)

**Suite:** TS-Vac-StatusFlow
**Priority:** Critical
**Type:** API Functional

## Description

Tests the APPROVED → PAID status transition — the core payment flow. An accountant pays an approved vacation by submitting the correct day split (regularDaysPayed + administrativeDaysPayed = vacation.days). After payment, the vacation becomes PAID (terminal state) — no further transitions are possible.

## Steps

1. **Create** REGULAR vacation via POST /v1/vacations (status=NEW)
2. **Approve** via PUT /v1/vacations/approve/{id} (status=APPROVED)
3. **Pay** via PUT /v1/vacations/pay/{id} with `{regularDaysPayed: N, administrativeDaysPayed: 0}` where N = vacation.regularDays
4. **Verify** status is PAID via GET
5. **Verify terminal** — attempt cancel → expect 400/403

## Data

- **User:** pvaynmaster (self-approver, has ACCOUNTANT-equivalent via API_SECRET_TOKEN)
- **Dates:** Dynamic (Mon-Fri window, offset 144+ weeks)
- **Payment type:** REGULAR
- **Cleanup:** PAID+EXACT vacations cannot be deleted — leaves permanent record
