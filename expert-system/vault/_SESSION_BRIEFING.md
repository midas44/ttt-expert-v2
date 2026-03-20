---
session: 95
phase: autotest_generation
updated: '2026-03-20'
---
# Session 95 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-20
**Phase:** Autotest Generation (vacation scope)
**Tests generated:** 5 verified (TC-097, TC-100, TC-062, TC-084, TC-021)

## What was done

Generated and verified 5 vacation API tests on qa-1:

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-097 | Payment dates endpoint — valid 1st-of-month range | API | TS-Vac-Payment | PASS |
| TC-VAC-100 | Balance unchanged after payment (days deducted at approval) | API | TS-Vac-Payment | PASS |
| TC-VAC-062 | Change approver with invalid login rejected | API | TS-Vac-Approval | PASS |
| TC-VAC-084 | Cross-year vacation splits days across years | API | TS-Vac-DayCalc | PASS (1 fix) |
| TC-VAC-021 | Available days decrease atomically on vacation create | API | TS-Vac-Create | PASS |

## Key Discoveries

1. **vacation_days_distribution uses FIFO, not calendar year split** — The `vacation_days_distribution` table column is `vacation` (not `vacation_id`). Days are consumed from earliest available balance year using FIFO, so a cross-year vacation (Dec→Jan) may show all days consumed from a single early year (e.g., 2025), not split between the two calendar years the vacation spans.

2. **Payment dates endpoint format confirmed** — `GET /api/vacation/v1/paymentdates?vacationStartDate=X&vacationEndDate=Y` returns array of `YYYY-MM-01` date strings, consecutive months, including vacation start month.

3. **Balance unchanged after payment confirmed** — `availablePaidDays` is identical before and after `PUT /pay/{id}`. Days are deducted at approval time only.

4. **Change approver (pass) endpoint** — `PUT /api/vacation/v1/vacations/pass/{id}` with `{login: "nonexistent"}` returns error with errorCode/message. Vacation remains unchanged.

5. **Available days decrease on creation** — The `availablePaidDays` endpoint (with `newDays=0`) accounts for pending NEW vacations, so balance decreases immediately on creation even though the DB column changes only at approval.

## Coverage

- **Vacation automated:** 59/173 (34.1%)
- **Total automated:** 59/1071 (5.5%)
- **Skipped:** 3 (TC-VAC-031, TC-VAC-058, TC-VAC-046)

## Week Offsets Used

Session 95 used offsets 185 (TC-100), 188 (TC-062), 191 (TC-021). TC-084 used cross-year dates (2030-12-29 to 2031-01-02). TC-097 is read-only (no offset). Next session should use 194+.

## Next Session Candidates

- **Payment suite:** TC-094 (payment type alignment bug), TC-093 (pay with negative days), TC-099 (cancel after accounting period)
- **DayCalc suite:** TC-069 (AV=false accrual formula — may need AV=false employee)
- **Approval suite:** TC-063 (edit dates resets optional approvals to ASKED)
- **UI tests:** At 34.1%, well past 30% threshold — next session should include 1-2 UI tests
- **JWT investigation:** Still needed for permission-based tests (TC-104 through TC-115)
