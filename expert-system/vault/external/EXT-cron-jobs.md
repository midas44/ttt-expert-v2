---
type: external
tags:
  - cron
  - scheduling
  - background-jobs
  - notifications
  - code-verified
created: '2026-03-12'
updated: '2026-04-17'
status: active
related:
  - '[[architecture/system-overview]]'
  - '[[modules/ttt-service]]'
  - '[[modules/vacation-service]]'
  - '[[modules/email-service]]'
  - '[[patterns/feature-toggles-unleash]]'
branch: release/2.1
---
# Cron Jobs Inventory

**Source**: Confluence 32904541 + code verification (release/2.1) | All run on Asia/Novosibirsk (GMT+7) | **21 active jobs** across 4 services.

## TTT Backend (9 active jobs)

| Scheduler | Lock Name | Cron | Purpose |
|---|---|---|---|
| `TaskReportNotificationScheduler` | `sendReportsChangedNotifications` | config | Manager-changed report notifications |
| `TaskReportNotificationScheduler` | `sendReportsForgottenNotifications` | config | Unreported hours reminder |
| `TaskReportNotificationScheduler` | `sendReportsForgottenDelayedNotifications` | config | Delayed unreported hours |
| `TaskReportNotificationScheduler` | `sendRejectNotifications` | config | Rejected hours notifications |
| `BudgetNotificationScheduler` | `sendBudgetNotifications` | config | Budget exceeded notifications |
| `CSSyncScheduler` | `doCsSynchronization` | config | CompanyStaff partial sync |
| `PmToolSyncScheduler` | `doPmToolSynchronization` | config | PM Tool project sync |
| `StatisticReportScheduler` | `sync` | config | Periodic statistic report sync |
| `ExtendedPeriodScheduler` | `cleanUp` | config | Extended period cleanup |
| `LockServiceImpl` | `cleanUpCache` | `*/10 * * * * *` | **Stale lock cleanup (every 10 sec!)** |

Note: `CSFullSyncScheduler` is **commented out** — disabled.

## Vacation Service (8 active jobs)

| Scheduler | Lock Name | Cron | Purpose |
|---|---|---|---|
| `CSSyncScheduler` | `sync` | config | CompanyStaff sync |
| `EmployeeProjectsSyncScheduler` | `sync` | config | Employee-project sync |
| `DigestScheduler` | `sendDigests` | config | Vacation digest emails |
| `AnnualProductionCalendarTask` | `runFirst` | config | Annual calendar reminder |
| `AnnualAccrualsTask` | `run` | config | New Year vacation day accrual |
| `AutomaticallyPayApprovedTask` | `CloseOutdatedTask.run` | config | Auto-pay approved vacations |
| `AvailabilityScheduleNotificationScheduler` | **NONE** | config | Availability notifications |
| `VacationStatusUpdateJob` | **NONE** | `0 */10 * * * *` + `0 */5 * * * *` | Status updates (2 schedules!) |

Note: `CSFullSyncScheduler` is **commented out**.

## Calendar Service (1 active job)

| Scheduler | Lock Name | Cron | Purpose |
|---|---|---|---|
| `CSSyncScheduler` | `doCsSynchronization` | config | CompanyStaff sync |

Note: `CSFullSyncScheduler` is **commented out**.

## Email Service (2 active jobs)

| Scheduler | Lock Name | Cron | Purpose |
|---|---|---|---|
| `EmailSendScheduler` | `sendEmails` | config | Send queued emails |
| `EmailPruneScheduler` | `pruneEmails` | config | Prune old emails |

## Issues Found (Code Verification)

1. **Missing @SchedulerLock** on `AvailabilityScheduleNotificationScheduler` — could fire duplicate notifications in clustered deployment
2. **Missing @SchedulerLock** on `VacationStatusUpdateJob` — two schedules (5min + 10min), CONFIRMED bug #2 from Session 5
3. **Misleading lock name**: `AutomaticallyPayApprovedTask` uses lock name "CloseOutdatedTask.run" — legacy naming, confusing
4. **Aggressive frequency**: `LockServiceImpl.cleanUpCache` runs every 10 seconds — performance concern
5. **CSFullSyncScheduler disabled** in all 3 services — suggests it caused problems (only partial sync active)

## Testing Endpoints

All jobs have test endpoints under `/api/{service}/v1/test/...` for manual triggering via Swagger.

## Related
- [[architecture/system-overview]]
- [[modules/ttt-service]]
- [[modules/vacation-service]]
- [[modules/email-service]]
- [[patterns/feature-toggles-unleash]] (CS_SYNC and PM_TOOL_SYNC toggles gate sync schedulers)


## Code-Verified Log Markers (Session 129 — 2026-04-17)

Added during ticket #3423 Phase A. These are the exact log strings emitted by each scheduler/service in `release/2.1` — use them as primary Graylog queries in automated verification (`GraylogVerificationFixture`, Phase D).

| Job (# in t3423 scope) | Service | Scheduler class | Primary log marker (exact string) | Level | Service-level extras |
|---|---|---|---|---|---|
| 1 (forgotten) | ttt | `TaskReportNotificationScheduler.sendForgottenReportNotifications` | `Report forgotten notification started` | debug | `Start notification process`, `Checking period: {} - {}`, `Employees not reached reporting norm count = {}`, `Sending notification to = {}` |
| 2 (forgotten-delayed) | ttt | `TaskReportNotificationScheduler.sendForgottenReportDelayedNotifications` | `Report forgotten delayed notification started` | debug | `Sending delayed notification to = {}`, `Employee {} already reported hours for period from {} to {}` |
| 3 (changed) | ttt | `TaskReportNotificationScheduler.sendReportsChangedNotifications` | `Reports sheet changed notification started` | debug | — |
| 4 (reject) | ttt | `TaskReportNotificationScheduler.sendRejectNotifications` | `Reject notification started` | debug | Error path: `<marker> notification FAILED: <exception>` |
| 5 (budget) | ttt | `BudgetNotificationScheduler.sendBudgetNotifications` (no log in scheduler) → `BudgetServiceImpl` | `Budget notification job is done` | info | Error: `Budget notification send FAILED: <exception>` |
| 7 (extended-cleanup) | ttt | `ExtendedPeriodScheduler.cleanUp` | `Extended period clean up started` → `Extended period clean up finished` | debug | Error: `Unable to clean up timed out report extended periods: <exception>` |
| 8 (email-dispatch) | email | `EmailSendScheduler` (live-verified TTT-QA-1 via `graylog-access tail`) | `sendEmails: started` → `sendEmails: finished, sent {n} emails` | (tail-observed) | Logger: `com.noveogroup.ttt.email.service.batch.EmailSendScheduler` |

Error-path pattern across `TaskReportNotificationScheduler`: `log.error("<X> notification FAILED: ", ex)` — query for substring `notification FAILED` to catch any of the four (jobs 1–4) job failures.

## Critical Timing Constants (must be respected by every TC)

From `release/2.1` source. These drive the SETUP → Wait → Trigger choreography in Phase B test steps and Phase D fixtures.

| Constant | Value | Owner | Effect on tests |
|---|---|---|---|
| `RejectNotificationServiceImpl.DEBOUNCE_INTERVAL_MINUTES` | `5` | ttt | Rejects younger than 5 min are skipped by the next `/notify-rejected` run. TC must either wait ≥5 min after rejecting, or advance the test clock. |
| `BudgetServiceImpl.SAFETY_INTERVAL_SECONDS` | `10` | ttt | Budget reports younger than 10 s are skipped by the next `/notify` run. TC must wait ≥10 s (or advance clock) before triggering. |

## Email Template Keys (used by cron emails)

| Cron job | Template key | Consumer |
|---|---|---|
| 1 (forgotten) | `FORGOTTEN_REPORT` | `TaskReportsForgottenNotificationServiceImpl.sendNotification` |
| 2 (forgotten-delayed) | `FORGOTTEN_REPORT` | same service, `sendDelayedNotifications` path |
| 4 (reject) | `APPROVE_REJECT` | `RejectNotificationServiceImpl` |

Template keys are useful Roundcube search hooks — in tests, Roundcube subject filter works; the backend also logs `"Sending notification to = {}"` immediately before `emailService.send(...)`, so Graylog can correlate log→email pairs.

## Cron Expression — Actual vs Scope Table

Discrepancy detected against `expert-system/repos/project/ttt/app/src/main/resources/application.yml` lines 124–150:

| Scope row (t3423) | Schedule in scope table | Schedule in code | Resolution |
|---|---|---|---|
| Row 4 (reject notification) | every 10 min | `ttt.notification.reject.cron: "0 */5 * * * *"` (every 5 min) | **Correct the scope table before Phase B**. Code is canonical. |

All other jobs 1, 2, 3, 5, 7 match the scope table.

## ShedLock Name Convention (code-verified)

Every scheduler uses `@SchedulerLock(name = "<ShedulerClassName>.<methodName>")` — example: `"TaskReportNotificationScheduler.sendForgottenReportNotifications"`. These names are useful as:
1. Graylog secondary filter alongside the primary marker (e.g., `message:"Report forgotten" AND message:"sendForgottenReportNotifications"`).
2. DB assertion on `shedlock.name` table during a lock-held window.

## Code-Verified Log Markers (Session 130 — 2026-04-17 — vacation service)

Added during ticket #3423 Phase A session 130. Source: `expert-system/repos/project/vacation/service/service-impl/**/periodic/**` at `release/2.1`. The monorepo root for the vacation service is `expert-system/repos/project/vacation/` (not `ttt-vacation/` as earlier briefing mentioned — monorepo layout uses `ttt/`, `vacation/`, `calendar/`, `email/` as top-level dirs).

| Job (# in t3423 scope) | Scheduler class + method | Lock name | Cron property / expression | Primary log marker (exact) | Error marker |
|---|---|---|---|---|---|
| 10 (CS sync — vacation) | `CSSyncScheduler.sync` | `CSSyncScheduler.sync` | `${employee-sync.cron}` (every 15 min per convention) | `"CS sync started"` (info) → `"CS sync finished"` (info) | `"CS sync failed"` (warn) — note **warn**, not error |
| 11 (annual accruals) | `AnnualAccrualsTask.run` | `AnnualAccrualsTask.run` | `${annual-accruals.cron}` = `"0 0 0 1 1 ?"` (Jan 1 midnight NSK) | `"Starting AnnualAccrualsTask"` | **none** — no finish marker, no error handler. Failure silently swallowed by ShedLock. |
| 14 (vacation digest) | `DigestScheduler.sendDigests` | `DigestScheduler.sendDigests` | `${digest.cron}` = `"0 0 8 * * ?"` (daily 08:00 NSK) | `"Digests sending job started"` → `"Digests sending job finished"` (info) | `"Digests sending job failed, reason: {}"` (error) |
| 15 (prod-calendar annual reminder) | `AnnualProductionCalendarTask.runFirst` | `AnnualProductionCalendarTask.runFirst` | `${production-calendar-annual-first.cron}` = `"0 1 0 1 11 ?"` (Nov 1 00:01 NSK) | `"Starting AnnualProductionCalendarTask for 1st october..."` | — (no error handler) |
| 16 (auto-pay expired approved) | `AutomaticallyPayApprovedTask.run` | **`CloseOutdatedTask.run`** (legacy misleading name — see Issue #3 above) | `${pay-expired-approved.cron}` = `"0 0 0 * * ?"` (daily midnight NSK) | `"Starting AutomaticallyPayApprovedTask..."` → `"AutomaticallyPayApprovedTask stopped"` | `"AutomaticallyPayApprovedTask failed"` |
| 17 (APPROVED→PAID + calendar-update recalc) | `VacationStatusUpdateJob.updateVacations` + `.checkVacationDaysAfterCalendarUpdate` | **NONE (no @SchedulerLock)** | `"0 */10 * * * *"` (APPROVED→PAID) + `"0 */5 * * * *"` (calendar recalc) — hardcoded expressions, not config | **NO log markers at all** — entries only via downstream services (`vacationService.payVacation`) | — |
| 18 (employee-project periodic sync) | `EmployeeProjectsSyncScheduler.sync` → delegates to `EmployeeProjectsSyncLauncherImpl.triggerSync` | `EmployeeProjectsSyncScheduler.sync` | `${employee-projects.cron}` = `"0 0 3 * * ?"` (daily 03:00 NSK) | **Launcher-level markers** (scheduler has none): `"Employee Projects sync started..."` → per-page `"Employee Projects sync page {} started"` / `"Employee Projects sync page {} finished with {} items"` → `"Employee Projects sync deleted {} records"` → `"Employee Projects sync finished!"` | — |
| 19 (employee-project initial sync — STARTUP) | `VacationStartupApplicationListener.onApplicationEvent` → `EmployeeProjectsSyncLauncherImpl.executeInitialSync` | **no lock** — startup-only, guarded by `migrationExecutor.executeOnce(EMPLOYEE_PROJECT_INITIAL_SYNC, this::triggerSync)` | Fires on `ContextRefreshedEvent` (app startup) | Same marker chain as job 18 — `"Employee Projects sync started..."` etc. (shared `triggerSync` method). Feature-toggle row in `ttt_vacation.java_migration` gates re-runs. | — |
| 21 (statistic-report full sync — STARTUP) | `VacationStartupApplicationListener.onApplicationEvent` → `StatisticReportSyncServiceImpl.executeInitialSync` | **no lock** — startup-only, guarded by `migrationExecutor.executeOnce(STATISTIC_REPORT_INITIAL_SYNC, ...)` | Fires on `ContextRefreshedEvent` (app startup) | (needs live capture — `@Retryable` wrapper: 2 attempts, 30 s backoff) | — |

### Startup wiring — jobs 19 & 21

`VacationStartupApplicationListener` is the canonical entry point for jobs 19 and 21:

```java
@Async @EventListener
public void onApplicationEvent(ContextRefreshedEvent event) {
    if (event.getApplicationContext().equals(applicationContext)) {
        csSyncLauncher.sync(true);                          // Full CS sync at startup
        employeeProjectSyncLauncher.executeInitialSync();   // Job 19
        statisticReportSyncService.executeInitialSync();    // Job 21
    }
}
```

Implication for Phase B: a CI `restart-<env>` fires all three syncs in sequence (full CS sync → job 19 → job 21). Jobs 19 and 21 are **not independently re-triggerable** without a restart, and even then only if `migrationExecutor.executeOnce` has not already consumed the feature-toggle row in `ttt_vacation.java_migration`. To force a re-run, the feature-toggle row must be deleted from DB before restart (or switched to a fresh toggle name).

### Scope-table deltas — found session 130

1. **Row 4 (Job 4 — reject notification) schedule** — session 129 finding confirmed: code says every 5 min, scope table says every 10 min. Scope table correction pending; ticket body already corrected (`docs/tasks/cron/cron-testing-task.md`).
2. **Row 12 & 13 — DEAD CONFIG**. `application.yml` (vacation) still declares `preliminary-outdated.cron: "0 0 * * * ?"` and `close-outdated.cron: "0 0 * * * ?"` but **no Java code references these properties**. Greps across `service-impl/` find zero `@Scheduled`/cron-valueOf usages for either. Rows 12 and 13 describe phantom jobs. Either:
   - The scheduler classes were deleted but the yml entries forgotten (most likely), or
   - They ran on an old branch and were never carried to `release/2.1`.
   **Action for Phase B:** mark rows 12 & 13 as NOT_IMPLEMENTED in the XLSX; the only verification possible is *absence of execution* (check DB/Graylog for no effect). Do not spend TC budget on them beyond that one contradiction test.
3. **Row 14 path mismatch** — scope table says `POST /api/vacation/v1/test/vacations/notify`; actual endpoint is `POST /api/vacation/v1/test/digest` on `TestDigestController`. Correct before Phase B XLSX generation.
4. **Row 18 path mismatch** — scope table says `POST /api/v1/test/employee-projects`; actual is `POST /api/vacation/v1/test/employee-projects` (missing `/vacation` prefix). Correct before Phase B.
5. **Row 15 marker/cron mismatch** — cron fires **Nov 1** (`"0 1 0 1 11 ?"`) but the log marker text reads `"Starting AnnualProductionCalendarTask for 1st october..."`. Pure legacy text — the marker is still valid as a Graylog filter, but the `"october"` string is misleading. Document as a benign inconsistency in the test; do NOT propose fixing the code string during this ticket's scope.
6. **Row 6 CS sync (ttt-service) — not yet verified** (deferred to a later session — see `CSSyncScheduler` in ttt-service). Session 130 covered vacation-service CS sync (row 10) only.

### Also out of t3423 scope but noted

- `AvailabilityScheduleNotificationScheduler` — uses `${notifications.cron}` (daily 14:00 NSK). **NO @SchedulerLock** (Issue #1 above). Marker: `"Availability Schedule notification job started"` → `"Availability Schedule notification job finished"` (info), error `"Availability Schedule notification job failed, reason: {}"`. This is listed in the "Vacation Service" inventory but is **not** in the 23-row t3423 scope — out of scope for this ticket.

### Roundcube env-prefix confirmation (session 130)

Confirmed on TTT-QA-1 via `roundcube-access` skill: QA-1 email subjects carry the `[QA1][TTT]` prefix (double-bracketed: env tag + service tag). Full predicate shape for FORGOTTEN_REPORT on QA-1: subject matches `/^\[QA1\]\[TTT\].*Report.*forgotten/i`. See [[patterns/email-notification-triggers]] for the full per-template subject pattern table populated in session 130.


---

## Session 131 — 2026-04-17 — Code Verification Batch 2 (jobs 6, 9, 20, 22, 23)

All 5 remaining scheduler classes inspected on `release/2.1` branch. Verified classes, log markers, ShedLock names, cron expression source, feature-toggle gates, test endpoints, and full-sync wiring.

### 1. Job 6 — `CSSyncScheduler` (ttt service, partial CS sync)

- **File:** `expert-system/repos/project/ttt/service/service-impl/src/main/java/com/noveogroup/ttt/periodic/cs/synchronization/CSSyncScheduler.java`
- **Class:** `com.noveogroup.ttt.periodic.cs.synchronization.CSSyncScheduler`
- **Method:** `doCsSynchronization()`
- **Cron:** `${companyStaff.cron}` → `"0 */15 * * * *"` (every 15 minutes)
- **Lock name:** `CSSyncScheduler.doCsSynchronization`
- **Markers (INFO):** `"Company staff synchronization started"` / `"Company staff synchronization finished"`
- **Exception handling:** none (NoveoScheduledTaskAspect catches + logs at ERROR)
- **Launcher gate:** `CSSyncLauncherImpl.sync(false)` — **silent no-op when Unleash flag `CS_SYNC-{env}` disabled**. Flag off → zero scheduler/launcher markers except the start/finish pair (sync body skipped before `CSSyncServiceV2.sync()`).
- **Companion full-sync class:** `CSFullSyncScheduler` EXISTS but **`@Scheduled` annotation is commented out** (file lines 18-20). Unused. Cron key `${companyStaff.full-sync}` = `"0 0 0 * * ?"` is **dead YAML config**. Full CS sync only runs at startup via `TttStartupApplicationListener` — NOT daily at midnight as scope table implies.

### 2. Job 9 — `EmailPruneScheduler` (email service)

- **File:** `expert-system/repos/project/email/service/service-impl/src/main/java/com/noveogroup/ttt/email/service/prune/EmailPruneScheduler.java`
- **Class:** `com.noveogroup.ttt.email.service.prune.EmailPruneScheduler`
- **Method:** `pruneEmails()`
- **Cron:** `${email.scheduler.prune.cron}` → `"0 0 0 * * *"` (daily at 00:00)
- **Lock name:** `EmailPruneScheduler.pruneEmails`
- **Markers (INFO):**
  - Start: `"pruneEmails: started"`
  - Finish: `"pruneEmails: finished, removed {} emails"` (SLF4J placeholder for count)
- **Retention:** Older than `email.scheduler.prune.retention-period` = `30d` (EmailBatchService enforces)
- **No feature-toggle gate.** Runs unconditionally on schedule.
- **Test endpoint:** `POST /api/email/v1/test/emails/delete` (TestEmailController:49). Skip body is empty or `{ "olderThanDays": N }` — scope table path `/api/email/v1/test/emails/delete` ✓ matches.
- **Graylog stream:** email/gotenberg combined backend stream (verify exact stream name before prod run — not one of the `TTT-*` streams inventoried).

### 3. Job 20 — `CSSyncScheduler` (calendar service, partial CS sync)

- **File:** `expert-system/repos/project/calendar/service/service-impl/src/main/java/com/noveogroup/ttt/calendar/service/impl/periodic/cs/synchronization/CSSyncScheduler.java`
- **Class:** `com.noveogroup.ttt.calendar.service.impl.periodic.cs.synchronization.CSSyncScheduler`
- **Method:** `doCsSynchronization()`
- **Cron:** `${companyStaff.cron}` → `"0 */15 * * * *"` (calendar's own copy of the value, identical to ttt)
- **Lock name:** `CSSyncScheduler.doCsSynchronization` — **SAME NAME as ttt job 6**. Disambiguation relies on separate shedlock tables (`ttt_backend.shedlock` vs `ttt_calendar.shedlock` — verify).
- **Markers (INFO):** `"Company staff synchronization started"` / `"Company staff synchronization finished"` — **IDENTICAL strings to job 6**. Graylog verification must filter by `source` (pod name) or `stream` (TTT vs calendar backend stream).
- **Launcher gate:** Calendar's own `CSSyncLauncherImpl` — also gated by Unleash flag `CS_SYNC-{env}` (verify — same flag name or calendar-specific?).
- **Companion full-sync class:** `CSFullSyncScheduler` in calendar service also **commented out**; full CS sync triggered at startup via `CalendarStartupApplicationListener.onApplicationEvent` calling `csSyncLauncher.sync(true)`.
- **Scope-table DELTA (row 20):** Scope table says test endpoint is `POST /api/calendar/v1/salary-offices/sync`. Actual endpoint is `POST /api/calendar/v2/test/salary-office/sync?fullSync={true|false}` — **path mismatch** (v1→v2, `salary-offices`→`salary-office`, `/sync`→`/test/salary-office/sync`). Update scope table.

### 4. Job 22 — `StatisticReportScheduler` (ttt service, daily report sync)

- **File:** `expert-system/repos/project/ttt/service/service-impl/src/main/java/com/noveogroup/ttt/periodic/statisticReport/synchronization/StatisticReportScheduler.java`
- **Class:** `com.noveogroup.ttt.periodic.statisticReport.synchronization.StatisticReportScheduler`
- **Method:** `sync()`
- **Cron:** `${ttt.statistic-report.cron}` → `"0 0 4 * * *"` (daily at 04:00)
- **Lock name:** `StatisticReportScheduler.sync`
- **Markers (INFO):**
  - Start: `"Periodic statistic report sync started..."` (note trailing ellipsis)
  - Finish (success): `"Periodic statistic report sync finished."`
  - Finish (failure): `"Periodic statistic report sync failed with cause: {}"` — **LOGGED AT INFO, NOT ERROR** (see bug below)
- **BUG — Error level mis-classification:** The catch block uses `log.info(...)` for failure, not `log.error(...)`. Graylog filter `level:3` (ERROR) will miss failures from this job. Tests that verify failure propagation must search at `level:6` (INFO) AND by message pattern `"failed with cause"`. File as design issue.
- **No feature-toggle gate.** Runs unconditionally.
- **Test endpoint:** `POST /api/ttt/v1/test/statistic-reports` (TestStatisticReportController:24). Scope table path matches.

### 5. Job 23 — `PmToolSyncScheduler` (ttt service, PM Tool incremental sync)

- **File:** `expert-system/repos/project/ttt/service/service-impl/src/main/java/com/noveogroup/ttt/periodic/pmtool/synchronization/PmToolSyncScheduler.java`
- **Class:** `com.noveogroup.ttt.periodic.pmtool.synchronization.PmToolSyncScheduler`
- **Method:** `doPmToolSynchronization()`
- **Cron:** `${pmTool.sync.cron}` → `"0 */15 * * * *"` (every 15 minutes)
- **Lock name:** `PmToolSyncScheduler.doPmToolSynchronization`
- **Markers (INFO):**
  - Scheduler start: `"Pm tool synchronization started"`
  - Scheduler finish: `"Pm tool synchronization finished"`
- **Launcher markers (from `PmToolEntitySyncLauncher`, per entity):**
  - Entity start: `"PmTool Sync {entityName} started (fullSync={})"` (e.g., `"PmTool Sync PROJECT started (fullSync=false)"`)
  - Per-item success (INFO): `"{entityName} {id} synched"`
  - Per-item timeout (ERROR): `"Unable to sync {entityName} {id} due to timeout"`
  - Per-item failure (ERROR): `"Unable to sync {entityName} {id}"`
  - Failed-ID retry batch start (INFO): `"PmTool Sync failed {entityName} ids count = {} start"` and `"PmTool Sync failed {entityName} ids retry batch {}-{} of {}"`
  - Failed-ID retry batch finish (INFO): `"PmTool Sync failed {entityName} ids count = {} finished"`
  - Entity finish: `"PmTool Sync {entityName} finished (fullSync={}), result = SyncResult(success={}, successCount={}, failedCount={}), retryResult = SyncResult(...)"`
- **Scheduler call signature:** `pmToolSyncLauncher.sync(false)` — **always partial**. No scheduled full-sync path. Full sync only fires at startup via `TttStartupApplicationListener`.
- **Launcher gate:** `PmToolSyncLauncherImpl.sync` — **silent no-op when Unleash flag `PM_TOOL_SYNC-{env}` disabled**. Flag off → only scheduler start/finish pair emits; no launcher markers.
- **Rate limiter:** `RateLimiter.create(fetchRatePerMinute / 60.0)`, default `pmTool.sync.fetch-rate-per-minute=50` → ~0.83 fetches/sec across paginated entity fetches.
- **Timeout:** `TIMEOUT = 10_000` ms per-entity future — timeouts logged and the ID is parked in `pmToolSyncFailedProjectRepository` for next-run retry in `retry-batch-size=10` chunks.
- **Test endpoint:** `POST /api/ttt/v1/test/project/sync` (scope row 23) — **body sync only** (`sync(false)`); no `fullSync` query parameter in the controller signature. Startup-style full sync NOT triggerable via API in release/2.1.

### Full-sync startup wiring (affects jobs 6 ttt, 20 calendar, 23)

- **ttt service:** `com.noveogroup.ttt.backend.service.configuration.TttStartupApplicationListener`
  - `@Async @EventListener` on `ContextRefreshedEvent`
  - Guard: `event.getApplicationContext().equals(applicationContext)` — only runs for the root context
  - Calls (in order): `projectFirstReportTimeMigrationService.migrate()`, `csSyncLauncher.sync(true)`, `pmToolSyncLauncher.sync(true)`
  - Implication: **every pod restart** triggers a full CS + full PM sync. Tests/automation that expect full-syncs only at scheduled times will miss this.
- **calendar service:** `com.noveogroup.ttt.calendar.service.impl.conf.CalendarStartupApplicationListener`
  - Calls `csSyncLauncher.sync(true)` — startup full CS sync for calendar's own schema
- **Dead YAML config:** `companyStaff.full-sync: "0 0 0 * * ?"` in ttt's `application.yml` — **not referenced by any `@Scheduled` annotation** (grep confirms zero hits outside the yml file and comments). File as design issue: dead config leads operators to believe there's a daily scheduled full sync.

### Unleash feature-toggle inventory (updated after session 131)

| Flag name (code) | Launcher | Behavior when disabled |
|---|---|---|
| `CS_SYNC-{env}` | `CSSyncLauncherImpl` (ttt and calendar) | Returns `null` silently; scheduler markers still emit; no downstream sync call |
| `PM_TOOL_SYNC-{env}` | `PmToolSyncLauncherImpl` | Returns `null` silently; scheduler markers still emit |

- `{env}` comes from `@Value("${unleash.env}")` — local/dev/qa/stage/prod, as deployed.
- QA runs commonly have these flags OFF → scheduler start/finish markers show up but no sync work occurs. **Tests that assert on launcher/entity markers must check flag state first.** Use `ttt_backend.feature_toggles` table (or Unleash UI) to verify enabled before force-triggering sync endpoints.

### Marker collisions and disambiguation

| Collision | Jobs | Disambiguation |
|---|---|---|
| `"Company staff synchronization started/finished"` | 6 (ttt) + 20 (calendar) | Graylog `source` field (pod name) or stream name |
| ShedLock name `CSSyncScheduler.doCsSynchronization` | 6 (ttt) + 20 (calendar) | Separate schemas → separate shedlock tables; no cross-service lock contention |

### Scope-table deltas discovered in session 131

| Row | Field | Scope table (current) | Actual (release/2.1) | Action |
|---|---|---|---|---|
| 20 | Test endpoint path | `POST /api/calendar/v1/salary-offices/sync` | `POST /api/calendar/v2/test/salary-office/sync?fullSync={true\|false}` | Update scope table (P1) |
| — | `companyStaff.full-sync` YAML key | Implies daily 00:00 full CS sync | Dead config — no @Scheduled uses it; full sync is startup-only | Update scope table and mission directive |
| 22 | Log level for failure | Implied ERROR | Logged at INFO (`log.info` in catch) | Design issue; update verification strategy |

### Updated coverage after session 131

- Code-verified markers: **21/23** scheduled jobs (all except rows 12 and 13 which are `NOT_IMPLEMENTED`).
- Full-sync wiring: **confirmed startup-only** for CS (ttt + calendar) and PM Tool.
- Feature-toggle gates: **documented for CS and PM Tool** launchers.
- Outstanding Phase-A work: Roundcube subject sampling for jobs 3/4/5/15, ticket mining for #3083 and #3417 notes 4-9, Graylog `search` subcommand regression.

## Session 132 (2026-04-17) — Row deep-dive code + live verification

Scope: force-trigger + live-sample rows 3, 4, 5, 8, 15. Endpoints fired at 19:21-19:29 UTC against qa-1 (env QA1).

### Row 3 — TaskReportsChangedNotification (`sendReportsChangedNotifications`)

**Test endpoint**: `POST /api/ttt/v1/test/reports/notify-changed` (file `TestTaskReportController.java`). Scope table previously recorded this — confirmed correct.

**Service**: `TaskReportsChangedNotificationServiceImpl.sendNotifications()` — log markers:
- `"Start notification process"`
- `"Search notification for periods: {} - {}"` (ISO8601 start and end, previousDay)
- `"Find: {} task reported by manager today"` (count)

**Template (code)**: `REPORT_SHEET_CHANGED` — **NOT** `TASK_REPORT_CHANGED` as shown in ticket scope table. Cross-reference: constant `REPORT_SHEET_CHANGED_TEMPLATE_KEY` in the service class.

**Query**: `taskReportRepository.findTasksReportedNotByExecutor(previousDayStart, previousDayEnd)` — yesterday's task_reports where `reporter_id ≠ executor_id`.

**Recipient**: executor of the report. Groups by (manager, report_date).

**Live verification (session 132, 19:21 UTC)**: markers fired, `Find: 0 task reported by manager today`, zero emails dispatched. DB has no yesterday-reports-by-manager, confirming the query predicate.

### Row 4 — RejectNotification (`sendRejectNotifications`)

**Test endpoint**: `POST /api/ttt/v1/test/reports/notify-rejected` (same file).

**Service**: `RejectNotificationServiceImpl.sendNotifications()` / `sendAndMarkNotified()` — **ZERO log markers** across the reject flow. Both methods emit no `log.info`, `log.debug`, or `log.error` calls. This is a hard testing constraint.

**Template (code)**: `APPROVE_REJECT` (constant `REJECT_TEMPLATE_KEY`).

**Template data** (from `sendAndMarkNotified`):
- `period_start` — reject period start (`LocalDate`)
- `period_end` — reject period end (`LocalDate`)
- `manager` — `manager.getRussianName()` (Russian full-name form)
- `cause` — reject cause text (from `Reject.getCause()`)
- `to_name` — `executor.getRussianName()`
- `page_link` — URL to user's report page

**DB assertion vector**: on successful send, `reject.executor_notified := true`. This is the only non-email state change; tests use this flag as the success signal.

**Debounce**: `DEBOUNCE_INTERVAL_MINUTES = 5`. A reject created less than 5 minutes ago is not dispatched on this run — re-evaluated next minute (cron `0 */1 * * * *`).

**Live verification (session 132, 19:22 UTC)**: endpoint fired, no log markers emitted (as expected). Roundcube historical sample UID 565319 captured: subject `[QA1][TTT] Ваши часы за период 02.04.2026-06.04.2026 были отклонены менеджером Дмитрий Дергачёв`.

### Row 5 — BudgetNotification (`sendBudgetNotifications`)

**Test endpoint**: `POST /api/ttt/v1/test/budgets/notify` (file `TestBudgetController.java`).

**Scheduler**: `BudgetNotificationScheduler.sendBudgetNotifications()` — NO log marker at scheduler level (pure delegate to service).

**Service**: `BudgetServiceImpl.sendNotifications()` — log markers:
- Success: `"Budget notification job is done"` (INFO)
- Failure: `"Budget notification send FAILED: "` (ERROR, with exception)

**Templates (code, THREE)** in `BudgetNotificationServiceImpl`:
- `BUDGET_NOTIFICATION_EXCEEDED` — budget limit reached for the first time (prev=null, current=date)
- `BUDGET_NOTIFICATION_NOT_REACHED` — budget no longer reached (prev=date, current=null)
- `BUDGET_NOTIFICATION_DATE_UPDATED` — reached date changed (prev != current, both non-null, different day)

**Seeding requirement**: create a `BudgetNotification` entity (via `POST /api/ttt/v1/budget-notifications` or DB insert) with budget_limit or budget_limit_percent, covering a date range, bound to an employee/task/project. Then post task_reports that sum to exceed or un-exceed the budget. On scheduler run, `recalcLimit()` evaluates the date and triggers one of the three templates if state changed. Test seeding is complex — see Phase B test plan for row 5.

**Recipient**: `notification.watcherId` (the employee watching the budget — usually manager or owner). Email fetched via `employeeService.find(watcherId)`.

**Live verification (session 132, 19:29 UTC)**: endpoint fired, `Budget notification job is done` marker appeared, zero emails (no state changes in current DB budget notifications).

### Row 8 — EmailSendScheduler (dispatch batch)

**Test endpoint**: `POST /api/email/v1/test/emails/send` (file `TestEmailController.java` in email service). Also supports `POST /v1/test/emails/delete` for cleanup.

**Scheduler**: `EmailSendScheduler.sendEmails()`:
- Cron: `${email.scheduler.send.cron}` = `*/20 * * * * *` (every 20 seconds)
- PageSize: 300 (from `${email.scheduler.send.page-size}`)
- ShedLock name: `EmailSendScheduler.sendEmails`
- Log markers:
  - `"sendEmails: started"` (INFO)
  - `"sendEmails: finished, sent {} emails"` (INFO, with count)

**Service**: `EmailBatchService.send()` returns `int sentNum` (count of SMTP-dispatched messages).

**Live verification (session 132, 19:27 UTC)**: continuous stream of `sendEmails: started` / `sendEmails: finished, sent N emails` pairs every 20 seconds. During row 15 firing, one pair caught `sent 2 emails` — those are the two prod-calendar reminders dispatched to chief accountants.

### Row 15 — AnnualProductionCalendarTask first-reminder (`runFirst`)

**Test endpoint**: `POST /api/vacation/v1/test/production-calendars/send-first-reminder` (file `TestProductionCalendarController.java` in vacation service).

**Scheduler bean**: `AnnualProductionCalendarTask.runFirst()`:
- Cron: `${production-calendar-annual-first.cron}` (NOT `production-calendar-first-notification.cron` as scope table says — delta)
- Log marker at scheduler level: `"Starting AnnualProductionCalendarTask for 1st october..."` — **note the "october" text is wrong**; actual cron fires Nov 1 (delta documented below).
- ShedLock name: `AnnualProductionCalendarTask.runFirst`.

**Scheduler-wrapper bypass delta**: the test REST endpoint (`productionCalendarFirstNotification`) calls `productionCalendarService.runFirst()` DIRECTLY, bypassing the scheduler bean. Consequences:
- The `"Starting AnnualProductionCalendarTask for 1st october..."` marker is **NOT** emitted when tests trigger via the endpoint.
- Tests must assert on the per-email markers from the vacation mail dispatcher: `"Mail has been sent to {email} about NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST for vacation id = {id}"` (logger under `ttt-vacation` application).

**Template (code)**: `NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST` (from `VacationCalendarCreationHelper`).

**Template data**:
- `to_name` — chief-accountant Russian full name
- `year` — next calendar year
- `calendars` — comma-separated list of calendar (country/office) names needing a calendar for the next year

**Recipients**: all chief accountants (from `employeeService.getAllChiefAccountants()`) — not a single chief accountant, but all of them who haven't marked the year's calendar as complete.

**Live verification (session 132, 19:24 UTC)**: endpoint fired, scheduler-level "Starting..." marker **absent** (confirming wrapper bypass). Mail-sent markers fired for 2 recipients (vyacheslav.rusakov@noveogroup.com, galina.perekrest@noveogroup.com). Roundcube UIDs 609812 and 609813 captured with subject `[QA1][TTT] Производственный календарь`.

### Session 132 scope-table deltas (append to session 131 delta table)

| Row | Field | Scope table (current) | Actual (release/2.1) | Action |
|---|---|---|---|---|
| 3 | Template key | `TASK_REPORT_CHANGED` | `REPORT_SHEET_CHANGED` | Update scope table and all t3423 test-case `requirement_ref` cells |
| 4 | Log markers | Implied (scope table says "Start/Finish in logs") | **Zero log markers anywhere in the reject flow** — Graylog cannot verify this job | Update scope table; Phase B tests for row 4 must use DB (`reject.executor_notified`) or email-arrival as assertion vectors |
| 5 | Template key | `BUDGET_*` (generic) | THREE distinct keys: `BUDGET_NOTIFICATION_EXCEEDED`, `BUDGET_NOTIFICATION_NOT_REACHED`, `BUDGET_NOTIFICATION_DATE_UPDATED` | Update scope table to list all three and the state-transition predicate that triggers each |
| 15 | Cron property name | `production-calendar-first-notification.cron` (per scope table) | `production-calendar-annual-first.cron` (code `@Scheduled(cron = "${production-calendar-annual-first.cron}")`) | Update scope table property name |
| 15 | Log marker text | Implied "Starting ... November" | Code literal: `"Starting AnnualProductionCalendarTask for 1st october..."` (says october but fires Nov 1) | Report as design issue; do not rely on log text for month validation |
| 15 | Test-endpoint behavior | Implied "same as scheduler" | Bypasses scheduler wrapper — no "Starting..." marker when triggered via endpoint | Update scope table row 15 test strategy: assert on per-email mail-dispatch markers, not scheduler marker |

### Updated coverage after session 132

- Code-verified endpoints: **23/23** scheduled + startup jobs (includes rows 3, 4, 5, 8, 15 full code audit this session).
- Code-verified markers: **21/23** (rows 12 and 13 remain `NOT_IMPLEMENTED` — see session 131 notes).
- Live-verified marker firing: **rows 3, 4, 5, 8, 15** confirmed this session (row 4 confirmed to emit ZERO markers — a negative confirmation).
- Email-template subject captures: rows 4 and 15 complete; rows 3 and 5 outstanding pending DB seeding.
- Outstanding Phase-A work: row 3 and row 5 Roundcube sampling (deferred to Phase B with seeded test data); ticket mining for #3262, #3303, #3345, #3346, #3337 (P1); Graylog `search` regression report (P1).
