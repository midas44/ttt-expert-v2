# TC-VAC-103: DB/API data representation inconsistency

**Type:** API | **Priority:** Medium | **Suite:** TS-Vac-Payment

## Description

Verifies the known bug where ADMINISTRATIVE vacations have an inconsistency between DB storage
and API representation. The DB stores working days in the `regular_days` column regardless of
payment type, while the API transposes values based on `payment_type` — returning `regularDays=0,
administrativeDays=N` for ADMINISTRATIVE vacations. This means DB-level queries for reporting
give wrong day-type breakdowns.

## Steps

1. Create ADMINISTRATIVE vacation (1 day)
2. Approve the vacation
3. Pay with correct type alignment (regularDaysPayed=0, administrativeDaysPayed=1)
4. GET vacation via API — verify API shows regularDays=0, administrativeDays=1
5. Query DB directly — verify DB stores regular_days=1, administrative_days=0 (inverted)
6. Confirm DB and API disagree on which column holds the days

## Data

- ADMINISTRATIVE 1-day vacation for pvaynmaster
- Week offset 206+ for conflict avoidance
- Creates PAID vacation (permanent record, cannot be cleaned up)
