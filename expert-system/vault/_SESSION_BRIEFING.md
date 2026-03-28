# Session Briefing

## Session 83 — 2026-03-29T01:00 UTC
**Phase:** C — Autotest Generation
**Scope:** planner, t2724
**Mode:** Full autonomy

### Session 83 Progress

**Generated and verified 5 apply-suite tests for t2724 (TC-T2724-021 through TC-T2724-025).**

| Test ID | Title | Status | Fix Attempts |
|---------|-------|--------|-------------|
| TC-T2724-021 | Apply on specific date — only affects selected date | verified | 0 |
| TC-T2724-022 | Apply with no tags — no API call, no reload | verified | 0 |
| TC-T2724-023 | Apply — page reloads after successful apply | verified | 0 |
| TC-T2724-024 | Apply from Project Members tab — triggers if tags exist | verified | 0 |
| TC-T2724-025 | Apply — generated (not-yet-opened) assignments also closed | verified | 3 |

All 25 t2724 tests passing on timemachine. Full suite run (5 tests): 2.1m.

### Key Technical Findings (session 83)

**TC-025 — Generated assignments (fixed_task table):**
- The table binding employees to tasks is `ttt_backend.fixed_task` (columns: task, employee), NOT `task_bound_employee` which doesn't exist
- Generated assignments: when an employee is in `fixed_task` but has no `task_assignment` row for a date, the apply endpoint creates a new closed assignment via `createForCloseByTag()`
- The query uses `generate_series` to find candidate dates where no assignment exists but the employee has assignments on other dates
- **Date format critical:** Java API expects `java.time.LocalDate` (`YYYY-MM-DD`). PostgreSQL `generate_series` returns timestamps — must use `to_char(d.dt, 'YYYY-MM-DD')` not `d.dt::text` (which gives `2026-03-23 00:00:00+00`)

**TC-021 — Date-scoped apply:**
- Apply POST body accepts `{date: "YYYY-MM-DD"}` to scope to a single date
- Verified: applying on date1 closes only date1's assignment, date2 stays open
- Test uses `findApplyTargetTwoDatesNoReports` — finds same task+assignee with two different unclosed assignment dates

**TC-022 — No-tags no-op:**
- `findProjectWithNoTags` finds ACTIVE project with PM but zero close tags
- Apply on such a project returns 200 but makes no changes (no-op)

**TC-024 — Settings dialog accessibility:**
- PM can access Project Settings dialog via the settings icon
- Dialog closed via Escape, then `dialog.waitFor({ state: "hidden" })`

### New Query Helpers Added to t2724Queries.ts
- `findApplyTargetTwoDatesNoReports()` — two unclosed same-task assignments on different dates
- `findUnclosedAssignmentForProject()` — any unclosed assignment for a project
- `findGeneratedAssignmentTarget()` — task with bound employee but no assignment on candidate date
- `findAssignmentByTaskEmployeeDate()` — lookup assignment by task+employee+date
- `deleteAssignment()` — cleanup helper for generated assignment tests
- `findProjectWithNoTags()` — ACTIVE project with PM but no close tags
- `findProjectWithPlainMember()` — ACTIVE project with PM and a separate plain member (not PM/SPM/admin)

### Files Created/Modified
- `e2e/tests/t2724/t2724-tc021.spec.ts` through `t2724-tc025.spec.ts` — 5 apply test specs
- `e2e/data/t2724/T2724Tc021Data.ts` through `T2724Tc025Data.ts` — 5 data classes
- `e2e/data/t2724/queries/t2724Queries.ts` — 7 new query functions added
- `e2e/pages/PlannerPage.ts` — added `waitForSettingsDialog()`, `clickSettingsOk()`
- `config/ttt/ttt.yml` — temporarily switched to timemachine, restored to qa-1

### Coverage Update
- t2724 module: 25/38 test cases automated (65.8%)
- planner module: 0/82 test cases automated (0%)
- Overall scope: 25/120 (20.8%)

### Next Session Priorities
1. Continue t2724: TC-T2724-026 through TC-T2724-030 (remaining apply/edge-case tests)
2. After t2724 complete (38 total), begin planner module tests
3. Apply tests require timemachine env — switch ttt.yml temporarily during those runs

### Previous Phase Context
Phase B completed in session 78: 120 test cases across 16 suites (82 planner + 38 t2724). Phase C started session 79.