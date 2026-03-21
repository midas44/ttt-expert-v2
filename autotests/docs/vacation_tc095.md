# TC-VAC-095: Auto-pay expired approved vacations (cron trigger)

## Description
Tests the `AutomaticallyPayApprovedTask` cron job that auto-pays APPROVED vacations older than 2 months. Triggers the cron via the vacation test API endpoint and verifies: (a) recently-approved vacations are NOT auto-paid, (b) old APPROVED vacations get transitioned to PAID.

## Steps
1. Query DB for existing old APPROVED vacations (end_date < today - 2 months)
2. Create a new vacation with future dates via POST /v1/vacations
3. Approve the vacation via PUT /v1/vacations/approve/{id}
4. Verify vacation status is APPROVED
5. Trigger auto-pay cron via POST /api/vacation/test/pay-expired-approved
6. Verify our new vacation is still APPROVED (not old enough for auto-pay)
7. Check DB to see which old APPROVED vacations were auto-paid

## Data
- **Employee**: pvaynmaster
- **Week offset**: 242 (future dates, ~4.6 years from now)
- **Cron criteria**: `today.minusMonths(2).withDayOfMonth(2)` — hardcoded 2-month threshold
- **Payment logic**: REGULAR → regularDaysPayed; ADMINISTRATIVE → administrativeDaysPayed
