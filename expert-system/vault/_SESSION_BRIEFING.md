---
type: session
updated: 2026-03-20
session: 87
phase: autotest_generation
---

# Session 87 Briefing — Phase C (Autotest Generation)

**Date:** 2026-03-20
**Phase:** C — Autotest Generation (vacation scope)
**Mode:** full (unattended)
**Duration:** ~25 min

## Summary

Generated and verified 5 new vacation API tests (TC-010, TC-013, TC-027, TC-047, TC-130). All 5 pass on qa-1. Total vacation coverage: **20/173 (11.6%)**, up from 15/173 (8.7%).

## Tests Generated This Session

| Test ID | Title | Type | Status | Fix Attempts |
|---------|-------|------|--------|-------------|
| TC-VAC-010 | Create with insufficient available days (AV=true) | API negative | verified | 1 (date span too small → 3yr span) |
| TC-VAC-013 | Create overlapping vacation (start inside existing) | API negative | verified | 2 (errorCode vs message field) |
| TC-VAC-027 | Update APPROVED vacation dates resets to NEW | API multi-step | verified | 0 |
| TC-VAC-047 | APPROVED → REJECTED (approver rejects) | API multi-step | verified | 0 |
| TC-VAC-130 | Vacation list with filters (type, sort, date, pagination) | API read-only | verified | 2 (NPE from missing from/to + totalCount vs totalElements) |

## Key Discoveries

### ValidationException Serialization Pattern
- `ValidationException` (e.g., crossing check) serializes the specific error code into the `message` field, NOT `errorCode`
- `errorCode` is always generic: `"exception.validation.fail"`
- `errors[].code` is also generic; `errors[].message` has the specific code
- Pattern: `{errorCode: "exception.validation.fail", message: "exception.validation.vacation.dates.crossing", errors: [{field: "startDate", code: "exception.validation.fail", message: "exception.validation.vacation.dates.crossing"}]}`
- This differs from `ServiceException` (e.g., duration check) where `errorCode` directly contains the specific code

### v2 Availability-Schedule Endpoint
- `GET /api/vacation/v2/availability-schedule` requires `from` and `to` date parameters — NPE without them
- Response uses `totalCount` (not `totalElements` like Spring Page)
- Response structure: `{page, pageSize, totalCount, content: [{employee: {...}, vacations: [...]}]}`
- `type=MY` with API_SECRET_TOKEN returns ALL employees (385), not just pvaynmaster — the MY/ALL/APPROVER filter affects which vacations are shown per employee

### Week Offsets Used (2027)
- 45 (TC-002), 48 (TC-003), 51 (TC-045), 54 (TC-013), 57 (TC-027 original), 60 (TC-027 updated), 63 (TC-047)

## State for Next Session

- **Vacation automated:** 20/173 (11.6%)
- **Next tests:** Continue with vacation API tests — TC-VAC-008 through TC-VAC-009, TC-VAC-011, TC-VAC-014-026, etc.
- **Week offsets available (2027):** 66+ (next free: 66, 69, 72, 75, 78...)
- **Known constraints:** API_SECRET_TOKEN authenticates as pvaynmaster only; crossing check counts DELETED records
