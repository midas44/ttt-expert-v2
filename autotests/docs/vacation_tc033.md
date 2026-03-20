# TC-VAC-033: Update — verify optional approvals reset on date change

## Description
Verifies that optional approval records are preserved/reset when vacation dates are updated. After a date change, all optional approvals should be in ASKED status.

## Steps
1. POST create vacation with optional approvers
2. Verify vacation_approval records in DB (status: ASKED)
3. PUT update vacation with new dates (shifted by ~1 week)
4. Verify vacation_approval records still exist with ASKED status

## Data
- Login: pvaynmaster (dynamic)
- Original dates: Mon-Fri week at offset 179
- Updated dates: following Mon-Fri week (conflict-free)
- Optional approvers: 2 same-office colleagues
- NOTE: Full APPROVED→ASKED reset not testable without optional approval API endpoint

## Limitations
- No API endpoint exists for vacation optional approvals (only day-off has PATCH)
- Cannot programmatically set optional approval to APPROVED, then verify reset
- Test verifies the weaker property: approvals survive the update with correct status
