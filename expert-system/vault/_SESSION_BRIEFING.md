---
session: 97
phase: autotest_generation
updated: '2026-03-20'
---
# Session 97 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-20
**Phase:** Autotest Generation (vacation scope)
**Tests generated:** 5 verified (TC-083, TC-103, TC-055, TC-038, TC-020)

## What was done

Generated and verified 5 vacation API tests on qa-1:

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-083 | Available days: negative newDays accepted (bug) | API | TS-Vac-DayCalc | PASS |
| TC-VAC-103 | DB/API data representation inconsistency (bug) | API | TS-Vac-Payment | PASS |
| TC-VAC-055 | Status transition: verify timeline events | API | TS-Vac-StatusFlow | PASS |
| TC-VAC-038 | Update paymentMonth to closed period rejected | API | TS-Vac-Update | PASS |
| TC-VAC-020 | DEPARTMENT_MANAGER self-approval | API | TS-Vac-Create | PASS |

Blocked/Skipped:
| Test ID | Title | Reason |
|---------|-------|--------|
| TC-VAC-067 | Change approver preserves optionals | PUT /pass/{id} NPEs on qa-1 (Caffeine cache bug) |
| TC-VAC-068 | Notification on approver change | Same pass endpoint NPE |
| TC-VAC-065 | Notify-also required=true | EmployeeWatcherServiceImpl.listRequired() is a no-op stub |

## Key Discoveries

1. **PUT /vacations/pass/{id} is broken on qa-1** — NPE in Caffeine cache `BoundedLocalCache.computeIfAbsent` for ALL valid employee logins. This blocks all approver-change tests (TC-067, TC-068, and future pass-related tests). TC-062 (invalid login) passed only because it expects 400/500.

2. **EmployeeWatcherServiceImpl is a stub** — Both `list()` and `listRequired()` return `Collections.emptyList()`. The `required=true` notifyAlso mechanism is designed but never actually populates required watchers. TC-065 is untestable.

3. **Timeline table records all status transitions** — `ttt_vacation.timeline` has event_type (VACATION_CREATED, VACATION_APPROVED, etc.), previous_status, and vacation FK. VACATION_APPROVED events have null previous_status (not 'NEW' as expected).

4. **DB/API inconsistency confirmed in fresh test** — ADMINISTRATIVE vacations: DB stores in regular_days=1, administrative_days=0; API transposes to regularDays=0, administrativeDays=1 based on payment_type.

5. **Manifest had mixed statuses** — Fixed 5 tests with "automated" status to "verified" for consistency (TC-009, 012, 015, 016, 036).

6. **pvaynmaster has a manager (ilnitsky)** — But still self-approves as DEPARTMENT_MANAGER. Approver field in API response is a full employee DTO object, not a string login.

## Coverage

- **Vacation automated:** 69/173 (39.9%)
- **Total automated:** 69/1071 (6.4%)
- **Skipped:** 4 (TC-VAC-031, TC-VAC-058, TC-VAC-046, TC-VAC-099)

## Week Offsets Used

Session 97 used offsets 206 (TC-103), 212 (TC-055), 215 (TC-038), 218 (TC-020). TC-083 is read-only (no offset). Next session should use 221+.

## Next Session Candidates

- **Blocked by pass NPE:** TC-067, TC-068, TC-053, TC-056 — try on timemachine env
- **DayCalc suite:** TC-069 (AV=false accrual — needs different office employee), TC-085 (employment +3mo)
- **Create suite:** TC-018 (CPO auto-approver), TC-019 (regular employee auto-approver), TC-011 (next-year cutoff — needs clock)
- **Update suite:** TC-034 (next year check not on update — needs clock), TC-037 (approver edits)
- **Payment suite:** TC-095 (auto-pay cron — needs old APPROVED vacation), TC-096 (payment date adjustment)
- **JWT investigation:** Still needed for permission-based tests (TC-017, TC-053, TC-104-106)
