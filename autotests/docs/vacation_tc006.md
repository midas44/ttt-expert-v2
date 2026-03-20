# TC-VAC-006: Create REGULAR vacation with 0 working days (min duration violation)

## Description
Verifies the backend enforces minimum working days for REGULAR vacations. A Sat-Sun REGULAR vacation has 0 working days, which is below the configured minimum of 1 (`vacation.minimal-vacation-duration: 1` in application.yml). Error code: `validation.vacation.duration`.

**Discovery**: The Javadoc says minimum is 5 days, but the actual config is **1** across all environments. The check compares **working days** (from office calendar), not calendar days. A Mon-Wed vacation (3 working days) passes; only 0-working-day ranges trigger the error. ADMINISTRATIVE vacations skip this check entirely.

## Steps
1. POST /api/vacation/v1/vacations — REGULAR type, Sat-Sun (0 working days)
2. Verify HTTP 400 with errorCode `validation.vacation.duration`

## Test Data
- Login: pvaynmaster (API_SECRET_TOKEN auth)
- Dates: Sat-Sun, 20 weeks in the future
- paymentType: REGULAR
- No cleanup needed — creation is rejected
