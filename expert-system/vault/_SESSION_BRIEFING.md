---
session: 102
phase: autotest_generation
updated: '2026-03-21'
---
# Session 102 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-21
**Phase:** Autotest Generation (vacation scope)
**Tests verified:** 4 (TC-095, TC-153, TC-170, TC-018)
**New tests generated:** 2 (TC-170, TC-018)

## What was done

Verified 2 previously blocked tests (qa-1 recovered from 502 outage), generated 2 new tests:

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-095 | Auto-pay expired approved vacations (cron trigger) | API | TS-Vac-Payment | PASS (fixed URL path) |
| TC-VAC-153 | First vacation 3-month restriction mechanism | API/DB | TS-Vac-CSSettings | PASS (fixed column name) |
| TC-VAC-170 | Past start date + end before start — dual validation errors | API | TS-VAC-PastDateVal | PASS (new) |
| TC-VAC-018 | CPO auto-approver self-assignment on create | API/DB | TS-Vac-Create | PASS (new) |

## Fixes Applied

1. **TC-095 URL path**: `/api/vacation/test/pay-expired-approved` → `/api/vacation/v1/test/vacations/pay-expired-approved`. Swagger spec shows path is `/v1/test/vacations/pay-expired-approved` relative to `/api/vacation` base.
2. **TC-153 column name**: `e.first_day` → `e.first_date`. Confirmed via `get_object_details` on ttt_vacation.employee table.
3. **TC-018 column names**: `vacation_approval` table uses `employee` (not `approver`), has no `required` column.

## Key Discoveries

1. **vacation_approval schema**: Columns are `id`, `vacation`, `employee`, `status` — no `required` or `approver` columns. FK `employee` references the optional approver.
2. **Vacation test API path pattern**: `/v1/test/vacations/<action>`, NOT `/test/<action>`. Same API_SECRET_TOKEN auth.
3. **Pass endpoint still broken**: `PUT /v1/vacations/pass/{vacationId}` returns 500 on qa-1 (Caffeine cache NPE persists). Blocks TC-067, TC-068.
4. **Remaining API tests bottleneck**: Most pending vacation API tests are blocked by either (a) per-user auth requirement (permissions suite), (b) timemachine clock (date-dependent tests), or (c) pass endpoint NPE.

## Coverage

- **Vacation automated:** 90/173 (52.0%)
- **Total automated:** 90/1071 (8.4%)
- **Skipped:** 5 (TC-VAC-031, TC-VAC-058, TC-VAC-046, TC-VAC-099, TC-VAC-126)
- **Blocked categories:**
  - Per-user auth needed: TC-053, TC-104, TC-105, TC-106, TC-107, TC-110, TC-111, TC-113, TC-116 (permissions suite)
  - Timemachine clock needed: TC-011, TC-034, TC-135
  - Pass endpoint NPE: TC-067, TC-068
  - Complex employee state: TC-085, TC-132, TC-138, TC-139, TC-148, TC-152

## Week Offsets Used

- TC-018: offset 248
- TC-170: no offset (uses past dates — negative test)

## Next Session Candidates

- **Consider expanding scope** — vacation API tests are increasingly blocked by auth/env constraints
- **UI tests via Playwright login** — could unblock permissions suite (TC-104+) if CAS login works
- **Timemachine clock tests** — switch target_env to timemachine for TC-011, TC-034, TC-135
- **Sick-leave module** — start next module in priority_order if vacation scope change approved
- **Pass endpoint bug report** — document NPE and file GitLab issue if not already tracked
