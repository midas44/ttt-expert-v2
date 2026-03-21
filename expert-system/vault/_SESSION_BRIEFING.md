---
session: 101
phase: autotest_generation
updated: '2026-03-21'
---
# Session 101 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-21
**Phase:** Autotest Generation (vacation scope)
**Tests generated:** 4 (TC-154, TC-157, TC-095, TC-153)
**Tests verified:** 2 (TC-154, TC-157) — TC-095, TC-153 blocked by qa-1 outage

## What was done

Generated 4 vacation tests, 2 verified passing, 2 blocked by environment outage:

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-154 | Vacation days carry-over — no expiration (burnOff unused) | API/DB | TS-Vac-CSSettings | PASS |
| TC-VAC-157 | Office calendar migration — Russia to Cyprus verification | DB | TS-Vac-CalendarMigr | PASS |
| TC-VAC-095 | Auto-pay expired approved vacations (cron trigger) | API | TS-Vac-Payment | BLOCKED (502) |
| TC-VAC-153 | First vacation 3-month hardcoded restriction mechanism | API | TS-Vac-CSSettings | BLOCKED (502) |

## Key Discoveries

1. **qa-1 API gateway fully down** — ALL services returning 502 Bad Gateway (vacation, ttt, calendar). DB (postgres) still accessible. Timemachine has SSL connection reset issues. Infrastructure outage, not service-specific.

2. **calendar_days table stores exceptions only** — `ttt_calendar.calendar_days` has `duration` column (0=holiday, 7=shortened, 8=transferred workday). Only ~500 rows total across all calendars — standard working days are implied, not stored.

3. **No burn_off column in office table** — Confirmed via information_schema query. `CSSalaryOfficeVacationData.burnOff` is never synced to DB. Days truly never expire.

4. **No first_vacation column in office table** — CS setting `firstVacation` is also unimplemented. The hardcoded `DaysLimitationService.Limit(3, 0)` is the only restriction mechanism.

5. **Russia vs Cyprus January holidays** — Russia has 6 non-working entries (Jan 1-5, 8 New Year break), Cyprus has 1 (Jan 1 only). 12 offices migrated in 2024, all from Russia to local calendars.

6. **TC-095 and TC-153 have ready-to-run specs** — Code generated with full data classes, DB verification, and cleanup. Just need API to come back online.

## Coverage

- **Vacation automated:** 86/173 (49.7%)
- **Total automated:** 86/1071 (8.0%)
- **Skipped:** 5 (TC-VAC-031, TC-VAC-058, TC-VAC-046, TC-VAC-099, TC-VAC-126)
- **Generated but unverified:** 2 (TC-095, TC-153) — pending qa-1 recovery

## Week Offsets Used

- TC-095: offset 242 (future vacation for auto-pay negative test)
- TC-153: offset 245 (future vacation for restriction positive test)
- TC-154: no offset (read-only)
- TC-157: no offset (DB-only)

## Next Session Candidates

- **Verify TC-095 and TC-153** when qa-1 API recovers (top priority)
- **Re-run TC-067** to check if pass endpoint NPE is resolved
- **Continue API tests**: TC-VAC-067 (change approver), TC-VAC-068 (notification), TC-VAC-085 (3-month employment)
- **Begin UI test generation** — at 49.7%, consider Playwright-based tests for permissions suite (TC-104+)
- **Fix TC-084 latent bug**: String(Date).slice(0,4) gives weekday not year
