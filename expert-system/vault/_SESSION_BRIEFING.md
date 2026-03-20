---
session: 98
phase: autotest_generation
updated: '2026-03-20'
---
# Session 98 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-20
**Phase:** Autotest Generation (vacation scope)
**Tests generated:** 5 verified + 1 skipped (TC-119, TC-120, TC-122, TC-123, TC-124 + TC-126 skipped)

## What was done

Generated and verified 5 vacation API error handling tests on qa-1:

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-119 | Malformed JSON request body — empty 400 response | API | TS-Vac-APIErrors | PASS |
| TC-VAC-120 | Invalid date format — stack trace leakage | API | TS-Vac-APIErrors | PASS |
| TC-VAC-122 | Missing required fields — validation errors array | API | TS-Vac-APIErrors | PASS |
| TC-VAC-123 | Type mismatch — string for numeric field | API | TS-Vac-APIErrors | PASS |
| TC-VAC-124 | Exception class leakage in error responses | API | TS-Vac-APIErrors | PASS |

Skipped:
| Test ID | Title | Reason |
|---------|-------|--------|
| TC-VAC-126 | Sick leave crossing vacation — 409 CONFLICT | API_SECRET_TOKEN lacks AUTHENTICATED_USER authority for POST /sick-leaves (403) |

Session 15 maintenance completed: tracking integrity verified (78 spec files, 74 verified, 5 skipped in DB), no duplicates, no orphans.

## Key Discoveries

1. **API_SECRET_TOKEN cannot access sick leave endpoints** — POST `/api/vacation/v1/sick-leaves` returns 403. The sick leave controller requires `AUTHENTICATED_USER` authority which the token doesn't have. The vacation controller works because it uses `AUTHENTICATED_USER || VACATIONS_CREATE`. This blocks all cross-module sick-leave tests.

2. **HttpMessageNotReadableException returns completely empty 400 body** — no JSON, no error details, no errorCode. The client gets a bare 400 status with 0 bytes body. Confirmed as a usability issue.

3. **Exception class leakage is universal** — every error response (except HttpMessageNotReadableException) includes the `exception` field with full Java class name like `com.noveogroup.ttt.common.exception.ServiceException`. This leaks internal package structure.

4. **MethodArgumentNotValidException errors array confirmed** — missing @NotNull fields produce `errors[]` with `{field, code, message}` per field. Code values include "NotNull".

5. **MethodArgumentTypeMismatchException** — errorCode is `exception.type.mismatch`, message includes expected type ("Long").

## Coverage

- **Vacation automated:** 74/173 (42.8%)
- **Total automated:** 74/1071 (6.9%)
- **Skipped:** 5 (TC-VAC-031, TC-VAC-058, TC-VAC-046, TC-VAC-099, TC-VAC-126)

## Week Offsets Used

No new date offsets used this session — all 5 verified tests are read-only API error tests (no vacation creation). TC-126 (skipped) would have used offset 221.

## Next Session Candidates

- **TS-Vac-APIErrors remaining:** TC-125 (ServiceException vs ValidationException format), TC-VAC-056 (approve with crossing)
- **Blocked by pass NPE:** TC-067, TC-068, TC-053, TC-056 — try on timemachine env
- **DayCalc suite:** TC-069 (AV=false accrual — needs different office employee), TC-085 (employment +3mo — needs newly hired employee)
- **Create suite:** TC-018 (CPO auto-approver), TC-019 (regular employee auto-approver) — need different users
- **JWT investigation:** Still needed for permission-based tests and sick leave cross-module tests
- **Begin UI test generation** — at 42.8%, well past 30% threshold
