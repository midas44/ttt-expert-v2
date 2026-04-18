---
type: exploration
tags: [tickets, cron, employee-projects-sync, statistic-report-sync, jobs-18-19-21-22, t3423, phase-a]
created: 2026-04-17
updated: 2026-04-17
status: active
related: ["[[external/EXT-cron-jobs]]", "[[exploration/tickets/t3423-investigation]]", "[[investigations/statistics-caffeine-caching-performance-3337]]", "[[modules/vacation-service-deep-dive]]"]
branch: release/2.1
session: 133
---

# Ticket Findings — Employee-Projects & Statistic-Report Sync (Jobs 18, 19, 21, 22)

Mined 2026-04-17 (session 133) to complete Phase A P1 ticket mining for [[exploration/tickets/t3423-investigation]] rows 18, 19, 21, 22. Six tickets form a single architectural evolution — the jobs are distinct but share foundations and QA history.

## 1. Connected architecture story (why all six belong together)

The scope table rows 18 / 19 / 21 / 22 are the four manifestations of one design pattern: **denormalised cache tables that must be kept in sync with the authoritative report data**.

| Ticket | Sprint | Status | Contribution |
|--------|--------|--------|---|
| [#3178](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3178) | 13 | Closed | Created `ttt_vacation.employee_projects` cache table + nightly sync (job 18). Foundation. |
| [#3262](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3262) | 13 | Closed | Fixed 2 bugs in job 18 (deletion handling, reschedule 00:00 → 03:00 NSK). Accepted 1 WON'T FIX (sync-window data loss). |
| [#3303](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3303) | 15 | Closed | Introduced one-time startup sync pattern (job 19) via `ttt_vacation.java_migration` markers. Enables job 18 to seed cold env. |
| [#3337](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3337) | 15 | Closed | Overall performance rework for statistic/employee report page. Added Caffeine cache layer, event-driven invalidation, introduced `ttt_backend.statistic_report` cache table design (see [[investigations/statistics-caffeine-caching-performance-3337]]). |
| [#3345](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3345) | 15 | Closed | Implemented `ttt_backend.statistic_report` cache + nightly sync (job 22). Fixed 2 QA bugs. |
| [#3346](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3346) | 15 | Closed | Introduced one-time startup statistic-report sync (job 21) via `STATISTIC_REPORT_INITIAL_SYNC` marker. Fixed 1 QA bug (periodic cron not firing). |

Pattern repeated twice:
- **employee_projects**: #3178 creates cache → #3262 fixes it → #3303 adds startup init.
- **statistic_report**: #3337 designs the page rework → #3345 creates cache → #3346 adds startup init.

Both one-time inits use the same `java_migration` + `migrationExecutor.executeOnce(...)` mechanism described in [[external/EXT-cron-jobs]] (session 130/131).

## 2. Confirmed bugs — regression test seed material

### A. Job 18 — `EmployeeProjectsSyncScheduler.sync` (nightly)

From **#3262** QA (vulyanov, 2025-07-14):

1. **Reschedule needed, FIXED (#3262).** Original cron was 00:00 NSK, which collided with (a) the full CS sync job also at 00:00, and (b) European business hours (17:00 GMT+0). Moved to **03:00 NSK** (`0 0 3 * * ?`). *Verify property `employee-projects-sync.cron: "0 0 3 * * ?"` in `application.yaml`.*
2. **Data loss during sync window, WON'T FIX.** Reports created/edited/deleted *while the sync is running* may not appear in `ttt_vacation.employee_projects` but DO appear in `ttt_backend.task_report`. This is accepted behaviour — the 03:00 NSK window is deliberately chosen to minimise user activity. *Document as known limitation in scope-table row 18 notes.*

From **#3178** (foundational — bugs all fixed before #3262):

3. Sync did not delete cache rows when a task_report was deleted (fixed in #3262 via `deletedCount` tracking; marker `"Employee Projects sync deleted {} records"` added).
4. `first_report_date` / `last_report_date` recomputation edge cases at the boundary (employee's first report of a new project; deletion of the only report in a period).

### B. Job 19 — `EmployeeProjectsSyncLauncherImpl.executeInitialSync` (startup one-shot)

From **#3303** QA (vulyanov, 2025-09-10, note 876432):

1. **One-shot guarantee.** After release, startup sync must be disabled for subsequent restarts. Implemented via `migrationExecutor.executeOnce(EMPLOYEE_PROJECT_INITIAL_SYNC, this::triggerSync)` — a row in `ttt_vacation.java_migration` is inserted on first successful run; subsequent startups no-op. *Regression test: restart service twice; first logs `"Employee Projects sync started..."`, second does not.*
2. **Endpoint-for-testing.** QA accepted that after release, the startup path cannot be re-tested without DB manipulation — but the test endpoint `POST /api/vacation/v1/test/employee-projects` (delegates to `EmployeeProjectsSyncLauncherImpl.triggerSync`) is sufficient for ongoing regression.

### C. Job 21 — `StatisticReportSyncServiceImpl.executeInitialSync` (startup one-shot)

Same pattern as job 19 — marker `STATISTIC_REPORT_INITIAL_SYNC` in `java_migration`.

From **#3346** QA (vulyanov, 2026-01-14, note 895498):

1. **Bug #895498 — FIXED in !5152 (#3337).** Periodic statistic-report sync (job 22) was not firing at 03:00 NSK or 04:00 NSK server time even though the `STATISTIC_REPORT_INITIAL_SYNC` row was present and the test endpoint `POST /api/ttt/v1/test/statistic-reports/full-sync` worked correctly. Root cause: scheduler wiring bug. Resolution: cron moved to **04:00 NSK** and scheduler fixed. *Regression test: after fix, manually DELETE a `statistic_report` row, wait for 04:00 NSK or trigger via endpoint, assert row restored.*

### D. Job 22 — `StatisticReportSyncScheduler` / periodic full-sync

From **#3345** QA (omaksimova, 2025-12-26 through 2026-01-07):

1. **Bug 1 — FIXED (!5101).** After full sync, `ttt_backend.statistic_report` contained records for months *outside* the employee's employment period (pre-hire and post-dismissal). Example: `jsaidov` left 2025-11-12 but still appeared in Dec-2025 report. Fix: filter by `ttt_vacation.employee_period` during sync — only months within `[start_date, end_date]` are persisted. (Partial-month edge case deferred to [#3356](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3356) — business rule for mid-month hire/leave still open.)
2. **Bug 2 — FIXED.** Rescheduling a day-off did not trigger recalculation of `month_norm`. Fix: extended event-driven invalidation to include day-off reschedule events on topic `TTT_BACKEND_EMPLOYEE_TOPIC` (routing `employee-month-norm-context-calculated`).
3. **Bug 1.1 — INVALIDATED by Bug 1 fix.** `reported_effort` was not updating for pre-employment months. Became moot once Bug 1 removed those records entirely.
4. **NOT-A-BUG observation** (omaksimova, 2026-01-07, note 894895). Dismissed employees briefly appeared in current-year records after full sync completed because the sync runs in two modes: **full** (previous + current year) vs **optimized** (previous + current month only). Expected behaviour. *Relevant for testers: full-sync triggered via `POST /api/ttt/v1/test/statistic-reports/full-sync` updates more than optimized-sync via `POST /api/ttt/v1/test/statistic-reports/sync`.*
5. **Async completion window.** Full-sync is event-driven via RabbitMQ. QA was instructed to wait 1–2 minutes after the test endpoint returns before asserting DB state. *Phase B preconditions must specify this wait — or provide a polling assertion.*

From **#3337** (design of the statistic-report page — related bugs):

6. **Bug — infinite load.** Statistics page hung under load. Fixed via Caffeine L1 cache + DB-backed L2 (`ttt_backend.statistic_report`). See [[investigations/statistics-caffeine-caching-performance-3337]].
7. **Bug — sick-leave hours not reflected in `month_norm`.** Month norm recalculation did not react to sick-leave events. Fixed by extending the `StatisticReportUpdateEventType` enum (VACATION_CHANGES, SICK_LEAVE_CHANGES, INITIAL_SYNC) and broadening event subscriptions.
8. **Bug — unrelated employees' records deleted.** A bulk recalculation inadvertently removed statistic_report rows for employees unrelated to the triggering event. Fixed by scoping the delete to `employee_id IN (changed_set)`.

## 3. Seed test cases for Phase B (t3423 collection)

These expand the existing seed list in [[exploration/tickets/t3423-investigation]] §TC seed list. Ticket numbers in square brackets indicate the bug-of-origin.

**Job 18 (row 18) — Employee Projects Sync (nightly):**
- TC-CRON-EPS-01: Trigger via endpoint, assert markers `"Employee Projects sync started..."` → `"Employee Projects sync page {} started"` → `"Employee Projects sync deleted {} records"` → `"Employee Projects sync finished!"` all fire, DB rows upserted. [#3178, #3262]
- TC-CRON-EPS-02: Delete task_report, trigger sync, assert corresponding `employee_projects` row deleted. [#3262]
- TC-CRON-EPS-03: Insert task_report with date BEFORE employee's existing `first_report_date`, trigger sync, assert `first_report_date` rolled back. [#3178]
- TC-CRON-EPS-04: Employee has no reports (after all deleted), trigger sync, assert `employee_projects` row removed entirely. [#3178]
- TC-CRON-EPS-05: Negative/WON'T-FIX — race window between report edit and sync (documented limitation, not enforced). [#3262]

**Job 19 (row 19) — Employee Projects Startup Init:**
- TC-CRON-EPS-STARTUP-01: Cold env (no `EMPLOYEE_PROJECT_INITIAL_SYNC` row). Start service, assert sync runs AND row appears in `java_migration`. [#3303]
- TC-CRON-EPS-STARTUP-02: Warm env (marker already present). Restart service, assert sync does NOT run (no `"Employee Projects sync started..."` marker for this startup). [#3303]
- TC-CRON-EPS-STARTUP-03: Guard precondition — remove marker row manually, restart, assert sync runs again (backdoor for dev resets). [#3303]

**Job 21 (row 21) — Statistic Report Startup Init:**
- TC-CRON-SR-STARTUP-01: Cold env, start service, assert `STATISTIC_REPORT_INITIAL_SYNC` row appears in `java_migration`. [#3346]
- TC-CRON-SR-STARTUP-02: Warm env, restart, assert no re-sync. [#3346]

**Job 22 (row 22) — Statistic Report periodic sync:**
- TC-CRON-SR-22-01: Fire full-sync endpoint, wait 120s, assert `statistic_report` contains rows ONLY for months within each employee's `employee_period`. No pre-hire rows for `omaksimova` (2025-09-01 hire), no post-leave rows for `jsaidov` (2025-11-12 leave). [#3345 Bug 1]
- TC-CRON-SR-22-02: Manually delete a `statistic_report` row for an active employee, wait for 04:00 NSK (or trigger optimized-sync endpoint), assert row restored. [#3346 bug 1]
- TC-CRON-SR-22-03: Create/reschedule a day-off, wait for event processing (RabbitMQ async — ~5s), assert `month_norm` for that employee/month updated. [#3345 Bug 2]
- TC-CRON-SR-22-04: Create a sick-leave, wait, assert `month_norm` and `reported_effort` updated. [#3337 Bug — sick-leave not reflected]
- TC-CRON-SR-22-05: Trigger a change event for employee A, assert employee B's `statistic_report` rows UNCHANGED (regression for scoped-delete bug). [#3337 Bug — unrelated employees]
- TC-CRON-SR-22-06: Full vs optimized sync contract — trigger optimized, assert only previous + current MONTH rows are refreshed; trigger full, assert previous + current YEAR is refreshed. [#3345 note 894873]
- TC-CRON-SR-22-07: Dismissed-employee edge — employee leaves mid-year, assert rows for months after `end_date` removed after full-sync; rows for months before `start_date` not present. [#3345 Bug 1]

## 4. Design issues to file in SQLite

| # | Category | Location | Severity | Description |
|---|----------|----------|----------|-------------|
| 1 | data-consistency | EmployeeProjectsSyncScheduler | Medium | **WON'T FIX** — reports created/edited/deleted during nightly sync window (~few minutes at 03:00 NSK) may not propagate to `ttt_vacation.employee_projects`. [#3262 note 866870] |
| 2 | business-rule-gap | StatisticReportSyncServiceImpl | Low | Mid-month hire/leave business rule deferred to [#3356](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3356). Currently any month in which an employee was employed ANY day is included. [#3345 note 894506] |
| 3 | async-test-contract | StatisticReportSyncServiceImpl | Low | Full-sync is event-driven via RabbitMQ; QA must wait 1–2 min after test endpoint returns. Test cases must encode this as a poll or explicit wait. [#3345 note 894873] |

## 5. Scope-table / EXT-cron-jobs corrections

No new corrections surfaced this session — the session-130/131 analysis already captured the accurate cron properties and marker text. Confirmed consistent with tickets:

- Job 18 cron: `0 0 3 * * ?` (03:00 NSK). Matches note in [[external/EXT-cron-jobs]] for row 18.
- Job 22 cron: **04:00 NSK** (moved from 03:00 NSK post-#3346 bug fix). *Verify this is reflected in both [[external/EXT-cron-jobs]] and scope-table row 22.* If scope table still says 03:00 for job 22, that is a new delta.
- Startup markers (jobs 19, 21) fire exactly once per env, guarded by `java_migration`.

## 6. Cross-references

- [[external/EXT-cron-jobs]] — master table; sessions 130/131 rows 18, 19, 21, 22 are accurate; minor delta for job 22 cron time (verify 03:00 vs 04:00).
- [[investigations/statistics-caffeine-caching-performance-3337]] — deep-dive on the Caffeine cache + `statistic_report` table architecture. Contains full MR list (!5013, !5101, !5150, !5152, !5155, !5194, !5200, !5203).
- [[exploration/tickets/t3423-investigation]] — canonical conventions (collection-shaped deliverables at `test-docs/collections/cron/cron.xlsx` with `COL-cron` sheet).
- [[modules/vacation-service-deep-dive]] — startup-listener (`VacationStartupApplicationListener`) wiring for jobs 19 and 21.

## 7. Outstanding investigation items (not blocking A→B)

- **Verify job 22 cron time** in live code & YAML (03:00 vs 04:00 NSK — post-#3346 bug fix).
- **Map `StatisticReportUpdateEventType` subscribers** across vacation / sick-leave / day-off event emitters for complete fan-out diagram (material for P2 RabbitMQ fan-out map in agenda).
- **Sample live statistic_report DB state** on qa-1 for representative employee to confirm employment-period filtering works in practice.

## Session audit log

- **2026-04-17 (session 133)** — mined 6 tickets (#3178, #3262, #3303, #3337, #3345, #3346), synthesised architecture story, catalogued 8 confirmed bugs, extracted 18 seed test cases, filed 3 design issues. Agent: vulyanov (auto). Tickets all CLOSED; no open issues against jobs 18/19/21/22 at time of mining.
