---
type: session
updated: '2026-03-20'
session: 88
phase: autotest_generation
---
# Session 88 Briefing — Phase C (Autotest Generation)

**Date:** 2026-03-20
**Phase:** C — Autotest Generation (vacation scope)
**Mode:** full (unattended)
**Duration:** ~30 min

## Summary

Generated and verified 5 new vacation API tests (TC-007, TC-008, TC-014, TC-026, TC-030). All 5 pass on qa-1. Total vacation coverage: **25/173 (14.5%)**, up from 20/173 (11.6%). Also ran session maintenance (session 5, every-5 trigger).

## Tests Generated This Session

| Test ID | Title | Type | Status | Fix Attempts |
|---------|-------|------|--------|-------------|
| TC-VAC-007 | Create REGULAR vacation 5-day Mon-Fri boundary | API positive | verified | 1 (regularDays not days) |
| TC-VAC-008 | Create ADMINISTRATIVE vacation 1 day | API positive | verified | 1 (administrativeDays not days) |
| TC-VAC-014 | Create with null paymentMonth — NPE bug | API negative | verified | 0 |
| TC-VAC-026 | Update dates of NEW vacation (status stays NEW) | API multi-step | verified | 1 (regularDays not days) |
| TC-VAC-030 | Update PAID vacation — immutable (rejected) | API negative | verified | 0 |

## Key Discoveries

### Vacation API Response: regularDays/administrativeDays (NOT days)
- The create/update response does NOT include a `days` field
- Instead: `regularDays` (paid working days) and `administrativeDays` (unpaid working days)
- REGULAR Mon-Fri: `{regularDays: 5, administrativeDays: 0}`
- ADMINISTRATIVE 1-day: `{regularDays: 0, administrativeDays: 1}`
- The DB column `vacation.days` is internal and not exposed via API

### PAID Immutability Confirmed
- PUT on PAID vacation returns HTTP 400 (tested against real PAID vacation in DB)
- Permission service returns empty set for PAID — no EDIT permission available

### Null paymentMonth NPE Still Present
- Confirmed on qa-1: POST without paymentMonth reliably returns 500
- Error response varies in detail level

### DbClient Enhancement
- Added `queryOneOrNull()` method to `dbClient.ts` for nullable query results
- Used by TC-030 to handle "no PAID vacation found" gracefully

### Week Offsets Used (2027-2028)
- Previous: 45, 48, 51, 54, 57, 60, 63
- New: 66 (TC-026 orig), 69 (TC-026 upd), 72 (TC-007), 75 (TC-008)

## Session Maintenance (Session 5 of Phase C)

- Backfilled missing `generation_session` values in autotest_tracking
- Verified all 25 verified test entries have correct spec_file and data_class
- QMD index: already up to date (no stale embeddings)
- No orphaned tracking entries found

## State for Next Session

- **Vacation automated:** 25/173 (14.5%)
- **Next tests:** Continue with vacation API tests — prioritize:
  - TC-VAC-048 (APPROVED→PAID) — needs JWT/multi-user auth investigation
  - TC-VAC-046 (canBeCancelled guard) — needs specific period conditions
  - TC-VAC-009 (AV=false insufficient days) — needs AV=false employee
  - Simpler candidates: TC-VAC-011 (next-year cutoff), TC-VAC-015 (null optionalApprovers CPO)
- **Week offsets available (2027+):** 78+ (next free: 78, 81, 84, 87, 90...)
- **Known constraints:** API_SECRET_TOKEN authenticates as pvaynmaster only; crossing check counts DELETED records; regularDays/administrativeDays in API response (not days)
