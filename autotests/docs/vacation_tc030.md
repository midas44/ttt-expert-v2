# TC-VAC-030: Update PAID vacation — immutable

## Description
Tests that a PAID vacation cannot be updated. PAID is in `NON_EDITABLE_STATUSES`, so the permission service returns an empty permission set. Any attempt to PUT update should be rejected with HTTP 400 or 403.

## Steps
1. GET existing PAID vacation from DB — verify status=PAID
2. PUT update with shifted dates → expect HTTP 400 or 403
3. GET again to confirm vacation dates unchanged

## Test Data
- Uses existing PAID vacation from DB (prefers pvaynmaster's, falls back to any)
- No data creation needed — read-only test

## Expected Result
- Update rejected: HTTP 400 (`exception.vacation.status.notAllowed`) or 403
- Vacation dates and status unchanged after attempt
