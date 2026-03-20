# TC-VAC-088: Pay APPROVED REGULAR vacation — happy path

**Suite:** TS-Vac-Payment
**Priority:** Critical
**Type:** API Functional

## Description

Tests the complete payment flow for a REGULAR vacation with database-level verification. After paying, verifies the `vacation_payment` record exists in the DB with correct `regular_days_payed`, `administrative_days_payed`, and `payed_at` fields.

## Steps

1. **Create** REGULAR vacation via POST (status=NEW)
2. **Approve** via PUT /approve/{id} (status=APPROVED)
3. **Pay** via PUT /pay/{id} with correct day split
4. **DB verify** — query `ttt_vacation.vacation_payment` table for the payment record
5. **API verify** — GET confirms PAID status

## Data

- **User:** pvaynmaster
- **Dates:** Dynamic (offset 148+ weeks)
- **DB assertions:** vacation_payment.regular_days_payed = regularDays, administrative_days_payed = 0
