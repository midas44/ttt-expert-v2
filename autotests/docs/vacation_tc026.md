# TC-VAC-026: Update dates of NEW vacation

## Description
Tests that updating the dates of a vacation in NEW status succeeds and the status remains NEW. Unlike TC-027 which tests APPROVED→NEW reset on date change, this verifies that updating within the same NEW status preserves it. Days should be recalculated for the new date range. Optional approvals should NOT reset (already NEW).

## Steps
1. POST create REGULAR vacation → verify status=NEW
2. PUT update with new startDate/endDate (shifted by 3 weeks) → verify HTTP 200
3. Verify status remains NEW, dates updated, days recalculated
4. GET to confirm persistence

## Test Data
- Login: pvaynmaster (self-approver)
- Original dates: week offset 66 (Mon-Fri)
- Updated dates: week offset 69 (Mon-Fri)
- paymentMonth: derived from start month

## Cleanup
- DELETE the created vacation in finally block
