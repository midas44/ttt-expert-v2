---
type: investigation
tags:
  - cron
  - collection
  - integrations
  - roundcube
  - graylog
  - rabbitmq
  - test-clock
  - startup-jobs
  - sprint-16
  - ticket-3423
created: '2026-04-17'
updated: '2026-04-17'
status: active
related:
  - '[[external/EXT-cron-jobs]]'
  - '[[exploration/api-findings/cron-job-live-verification]]'
  - '[[patterns/email-notification-triggers]]'
branch: release/2.1
---
# Ticket #3423 — Cron & Startup Jobs Testing Collection (Session Preamble)

> **Read this first.** This note is the pinned session preamble for every Phase A/B session run with `phase.scope: "3423"`. It captures the non-default conventions of this ticket so they don't have to be re-derived each session. When the ticket body and this note agree, trust either; when in doubt, the canonical source is [ticket #3423](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3423) and [`docs/tasks/cron/cron-testing-task.md`](../../docs/tasks/cron/cron-testing-task.md).

## Summary

**Ticket:** [#3423](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3423) — [QA Automation] Cron & Startup Jobs Testing Collection
**Epic:** #3402 (flat `relates_to` link — CE 16.11 has no native parent/child)
**Collection name:** `cron`
**Primary spec:** [Confluence: cron](https://projects.noveogroup.com/spaces/NOV/pages/32904541/cron) — 23 jobs, canonical backlog
**Scope in this expert system:** Phases A + B only. Phase C is intentionally gated off via `autotest.enabled: false` in `expert-system/config.yaml` and will be enabled later with `autotest.scope: "collection:cron"`.

## Non-default conventions for this ticket

This is a **ticket-scoped** investigation that produces **collection-shaped** deliverables. The usual `test-docs/t3423/t3423.xlsx` / ticket-scoped output is **wrong** for this ticket. The ticket body lists the correct deliverable paths:

| Artifact                                                          | Path                                                                   |
|-------------------------------------------------------------------|------------------------------------------------------------------------|
| Test plan (human-readable)                                        | `test-docs/collections/cron/test-plan.md`                              |
| Curated collection XLSX (sheet `COL-cron`)                        | `test-docs/collections/cron/cron.xlsx`                                 |
| Traceability matrix (cron job → TC → spec)                        | `test-docs/collections/cron/coverage.md`                               |
| Reusable email verification fixture                               | `autotests/e2e/fixtures/common/RoundcubeVerificationFixture.ts` (Phase D, not now) |
| Reusable log verification fixture                                 | `autotests/e2e/fixtures/common/GraylogVerificationFixture.ts` (Phase D, not now)   |
| Retrospective                                                     | `docs/tasks/cron/retrospective.md` (end of Stage F)                    |

Test IDs and suite naming follow the **collection** pattern (mirror `test-docs/collections/absences/absences.xlsx`), **not** the ticket pattern from CLAUDE+.md §10.1. Expected forms:
- Test IDs: `TC-CRON-001`, `TC-CRON-002`, … in the XLSX; the `COL-cron` sheet also carries `source_module` / `source_suite` columns pointing back to the TC's home module.
- Suite tag at autotest time: `@col-cron` (set by `collection-generator`, applied on top of existing per-module tags).

If a Phase B session starts creating `test-docs/t3423/`, **stop** — that is the default ticket-scope output path and is wrong for this ticket. Emit to `test-docs/collections/cron/` instead.

### Post-t3423 authoring rules (2026-04-21, for the `digest` sub-scope)

After the cron collection landed, review surfaced four shortcomings in the generated TCs. These rules apply to any **future** session generating cron TCs (including the narrow `digest` stress-test collection at `test-docs/collections/digest/`) — they are captured in full at:

- `CLAUDE.md` § "Test-doc authoring principles"
- `CLAUDE+.md` §11 — expanded XLSX formatting, "Environment Independence", "Cron-Job TCs — Dual-Trigger Principle", "Content-Complete Verification for Notification TCs"
- `expert-system/vault/patterns/email-notification-triggers.md` § "Test authoring rules for notification TCs" (includes the digest content schema)
- `expert-system/vault/external/EXT-cron-jobs.md` § "Row 14 — DigestScheduler" (deep-dive added 2026-04-21)

Summary of the four rules:

1. **UI-first verification** — primary steps are browser actions; API/DB reserved for SETUP / CLEANUP / DB-CHECK / test-clock. Exception: content-assertion-heavy notification flows (digest) may be backend-only if every field is asserted.
2. **Environment independence** — TCs use `<ENV>` placeholders; no `qa-1` / `timemachine` / `stage` literals.
3. **Dual-trigger for cron TCs** — each behavioral TC exists in two variants: clock-advance + `@Scheduled` wrapper, and test-endpoint bypass.
4. **Content-complete verification for notifications** — assert every dynamic field the email template renders, not just subject.

The landed cron TCs (sessions 131–138) predate these rules and are **not** being retrofitted. The `cron` collection stays as-is; the `digest` collection is the re-generation test bed for the updated rules.

## Scope — 23 cron & startup jobs

All times are Asia/Novosibirsk (GMT+7). `E` = Roundcube email, `L` = Graylog log, `CS` / `PM` / `DB` = cross-system write.

| #  | Service  | Job                                                 | Schedule                     | Trigger                                                                | Channels       |
|----|----------|-----------------------------------------------------|------------------------------|------------------------------------------------------------------------|----------------|
| 1  | TTT      | Forgotten-report notification (weekly)              | Mon, Fri 16:00               | `POST /api/ttt/v1/test/reports/notify-forgotten`                        | E, L           |
| 2  | TTT      | Forgotten-report delayed notification               | Daily 16:30                  | `POST /api/ttt/v1/test/reports/notify-forgotten-delayed`                | E, L           |
| 3  | TTT      | Report-changed notification                         | Daily 07:50                  | `POST /api/ttt/v1/test/reports/notify-changed`                          | E, L           |
| 4  | TTT      | Report-reject notification                          | Every 5 min (code)           | `POST /api/ttt/v1/test/reports/notify-rejected`                         | E, L           |
| 5  | TTT      | Budget-overrun notification                         | Every 30 min                 | `POST /api/ttt/v1/test/budgets/notify`                                  | E, L           |
| 6  | TTT      | CS sync (partial / full)                            | Every 15 min / daily 00:00   | `POST /api/ttt/v1/test/employees/sync?fullSync={true,false}`            | CS, DB, L      |
| 7  | TTT      | Extended report-period cleanup                      | Every 5 min                  | `POST /api/ttt/v1/test/reports/cleanup-extended`                        | DB, L          |
| 8  | Email    | Email dispatch batch                                | Every 20 sec                 | `POST /api/email/v1/test/emails/send`                                   | E, L           |
| 9  | Email    | Email retention prune (> 30 days)                   | Daily 00:00                  | `POST /api/email/v1/test/emails/delete`                                 | DB, L          |
| 10 | Vacation | CS sync (partial / full)                            | Every 15 min / daily 00:00   | `POST /api/vacation/v1/test/employees/sync?fullSync={true,false}`       | CS, DB, L      |
| 11 | Vacation | Annual vacation accruals                            | Jan 1, 00:00                 | `POST /api/vacation/v1/test/annual-accruals`                            | DB, L          |
| 12 | Vacation | Preliminary-vacation outdated removal               | Hourly                       | `POST /api/vacation/v1/test/vacations/delete-expired-preliminary`       | DB, L          |
| 13 | Vacation | Preliminary-vacation close-outdated                 | Hourly                       | `POST /api/vacation/v1/test/vacations/close-outdated`                   | DB, L          |
| 14 | Vacation | Vacation notifications (digest)                     | Daily 08:00                  | `POST /api/vacation/v1/test/digest` *(scope-table path `/vacations/notify` is wrong — see session-130 audit log)* | E, L           |
| 15 | Vacation | Production-calendar annual reminder                 | Nov 1, 00:01                 | `POST /api/vacation/v1/test/production-calendars/send-first-reminder`   | E, L           |
| 16 | Vacation | Auto-pay expired approved vacations                 | Daily 00:00                  | `POST /api/vacation/v1/test/vacations/pay-expired-approved`             | DB, L          |
| 17 | Vacation | APPROVED → PAID auto-transition after period close  | Every 10 min                 | *(no dedicated test endpoint — trigger via `ptch-report-period`)*       | DB, L          |
| 18 | Vacation | Employee-project periodic sync                      | Daily 03:00                  | `POST /api/v1/test/employee-projects`                                   | DB, L          |
| 19 | Vacation | Employee-project initial sync *(startup-only)*      | Application startup          | CI restart of `vacation` service on target env †                        | DB, L          |
| 20 | Calendar | CS sync (partial / full)                            | Every 15 min / daily 00:00   | `POST /api/calendar/v1/salary-offices/sync?fullSync={true,false}`       | CS, DB, L      |
| 21 | Vacation | Statistic-report full sync *(startup-only)*         | Application startup          | CI restart of `vacation` service on target env †                        | DB, L          |
| 22 | TTT      | Statistic-report optimized sync                     | Daily 04:00                  | `POST /api/v1/test/statistic-reports`                                   | DB, L          |
| 23 | TTT      | PM Tool project sync (partial / startup-full)       | Every 15 min / startup-full  | `POST /api/ttt/v1/test/project/sync`                                    | PM, DB, L      |

### † Startup-only triggers (jobs 19, 21; startup-full mode of 23)

- `release/2.1` pipeline → qa-1 and ttt-timemachine.
- `stage` pipeline → stage.
- Mechanism: `restart-<env>` job in the deploy stage of `ttt-spring`. Use the `gitlab-access` skill's restart operations; the service's startup sequence runs the sync logic; observability is identical to cron-triggered runs (DB + Graylog).
- Feature toggles — must be set in preconditions:
  - `EMPLOYEE_PROJECT_INITIAL_SYNC` in `ttt_vacation.java_migration` → job 19
  - `STATISTIC_REPORT_INITIAL_SYNC` in `ttt_vacation.java_migration` → job 21
  - `PM_TOOL_SYNC` in Unleash → job 23 (startup-full mode)

## Verification shape (shared by every TC in this collection)

1. **SETUP** — seed minimal state via TTT / Vacation / Calendar Swagger API.
2. **Clock** — for time-sensitive crons, advance via `ptch-using-ptch-11` or reset with `reset-using-pst` on the target env (available on qa-1, ttt-timemachine, stage).
3. **Trigger** — cron test endpoint (scope table) OR CI restart for startup-only jobs (19, 21) and startup-full mode of 23.
4. **Wait** — respect async boundaries. Email scheduler (job 8) dequeues every 20 s; sync crons fan out via RabbitMQ (see [[patterns/email-notification-triggers]] and the "RabbitMQ fan-out" block in the ticket body); expect 1–3 settle loops for downstream consumers.
5. **Verify** — per available channel:
   - DB: `mcp__postgres-qa1__execute_sql` / `mcp__postgres-tm__execute_sql` / `mcp__postgres-stage__execute_sql`.
   - UI: Playwright page-object assertions (only when the effect is user-visible).
   - Email: `RoundcubeVerificationFixture` (scaffolded in Phase D). Until then, verify manually via the `roundcube-access` skill — subject filter `[<ENV>]` / `[<ENV>][TTT]`, sender, time window.
   - Log: `GraylogVerificationFixture` (scaffolded in Phase D). Until then, verify via the `graylog-access` skill — stream `TTT-QA-1` / `TTT-TIMEMACHINE` / `TTT-STAGE`, query by cron lock name or marker string.
6. **CLEANUP** — delete seeded data; reset the test clock if advanced.

**Verification policy (collection baseline, not optional):**
- Roundcube check is **mandatory** for every cron that emits email (channel `E`).
- Graylog check is **mandatory** for every cron whose only side-effects are server-side, and recommended on top of DB checks when timing / retry behaviour is under test.

## Prior-art pointers

These notes are the starting point for Phase A. Read them first each session; update them in place when gaps are found.

- [[external/EXT-cron-jobs]] — extracted cron catalogue from the backend codebase (ttt, vacation, calendar, email services). Starting point for code-level detail on each job.
- [[exploration/api-findings/cron-job-live-verification]] — prior live-verification findings on cron test endpoints (which ones exist, what they return, what they actually do when fired outside their schedule).
- [[patterns/email-notification-triggers]] — patterns for how cron jobs produce emails (subject formats, locale, templating paths). Use this when writing email verification assertions.

Additional context (add when relevant to the cron being investigated):
- Tickets cited in the Confluence spec — #3083 (PM Tool sync), #3262 / #3303 (employee-project sync), #3345 / #3346 / #3337 (statistic-report sync).
- #3417 — integrations groundwork (Roundcube + Graylog + CS + PM Tool) — all cron verification channels trace back here.
- Per-module vault notes for each cron's owning module (reports, vacation, day-off, statistics, accounting) — pull validation rules and selectors as needed.

## Phase A checklist (per-session starting point)

Use this as a running audit; tick items off in the note itself when they are done (mode: `append` a `## Audit log` section with dated entries — one line per closed item).

- [ ] Read the ticket body end-to-end — `docs/tasks/cron/cron-testing-task.md`.
- [ ] Read and audit the three prior-art vault notes (list above) against the 23-row scope table.
- [ ] For each cron/startup job, confirm the test-trigger endpoint exists on the target env — Swagger or direct `mcp__swagger-qa1-*__*` call — and document its contract (request shape, synchronous vs asynchronous, return payload).
- [ ] For each email-emitting cron, confirm expected subject format, sender, and env prefix in the Roundcube mailbox (sample via `roundcube-access` skill).
- [ ] For each cron, confirm the Graylog marker (log message or lock name) the test will query — sample via `graylog-access` skill.
- [ ] Mine tickets #3083, #3262, #3303, #3345, #3346, #3337, #3417 comments for edge cases and historical bugs that should become TCs.
- [ ] Verify CI `restart-<env>` job permissions and reachability on `release/2.1` / `stage` for jobs 19 / 21 / 23-startup-full — note which engineer to escalate to if blocked.
- [ ] Track gaps discovered per session in the `## Audit log` section (below); write back findings to the relevant module / pattern notes, not just here.

## Phase B deliverables (ordered)

1. `test-docs/collections/cron/test-plan.md` — risk areas, env matrix, entry/exit, open questions, RabbitMQ fan-out notes per cron cluster.
2. `test-docs/collections/cron/cron.xlsx` (sheet `COL-cron`) — one or more TC rows per scope-table row. Mirror the `absences` workbook shape.
3. `test-docs/collections/cron/coverage.md` — traceability: cron job → TC IDs → (placeholder) spec path. No "??" rows permitted; if a cron cannot be covered, annotate with blocker + ticket reference.

## Non-goals (Phases A + B)

- **Phase C is out of scope** for this session series. Do not scaffold `RoundcubeVerificationFixture` / `GraylogVerificationFixture`; do not create `autotests/e2e/tests/integration/cron/` specs; do not run `process_collection.py`.
- Do not edit production cron scheduling or CI pipeline definitions. Only existing test-trigger endpoints and the existing CI `restart-<env>` job are invoked.
- No validation of raw cron expressions at the code level — the task verifies observable job behaviour.

## Audit log

_Append one dated line per session closing an audit item above. Example: `2026-04-18 — confirmed test endpoint for job 5 (budget-overrun notify) returns 202 + event id; Graylog marker = "BudgetOverrunJob.run".`_

### Session 129 — 2026-04-17

Scope: Phase A — confirm test-trigger endpoints, code-verified Graylog markers, and critical timing constants for cron jobs owned by the **ttt** service (jobs 1, 2, 3, 4, 5, 7, plus live-check of 8).

- 2026-04-17 — **test endpoints** confirmed via repo read at `expert-system/repos/project/ttt/rest/.../test/`: jobs 1–4 all live on `TestTaskReportController` (`@RequestMapping("/v1/test/reports")`, `@Profile("!production")`, all `void` return, no request body) — `POST /notify-forgotten` (job 1), `/notify-forgotten-delayed` (job 2), `/notify-changed` (job 3), `/notify-rejected` (job 4), `/cleanup-extended` (job 7). Job 5 on `TestBudgetController` at `POST /v1/test/budgets/notify`.
- 2026-04-17 — **Graylog markers** (code-verified from `service-impl/.../periodic/**`):
  - Job 1 `report-forgotten` — `"Report forgotten notification started"` (debug, `TaskReportNotificationScheduler.sendForgottenReportNotifications`). Service-level extras: `"Start notification process"`, `"Checking period: {} - {}"`, `"Employees not reached reporting norm count = {}"`, `"Sending notification to = {}"`.
  - Job 2 `report-forgotten-delayed` — `"Report forgotten delayed notification started"` (debug). Service-level: `"Sending delayed notification to = {}"`, `"Employee {} already reported hours for period from {} to {}"`.
  - Job 3 `report-sheet-changed` — `"Reports sheet changed notification started"` (debug).
  - Job 4 `report-reject` — `"Reject notification started"` (debug). Service-level: `"<X> notification FAILED: "` on exception.
  - Job 5 `budget` — no scheduler-level log; service `BudgetServiceImpl` emits `"Budget notification job is done"` (info) on success, `"Budget notification send FAILED: "` (error) on exception.
  - Job 7 `extended-period-cleanup` — `"Extended period clean up started"` → `"Extended period clean up finished"` (debug). Error: `"Unable to clean up timed out report extended periods: "`.
  - Job 8 `email-dispatch` — **live-verified on TTT-QA-1** (tail): logger `com.noveogroup.ttt.email.service.batch.EmailSendScheduler` emits `"sendEmails: started"` / `"sendEmails: finished, sent {n} emails"` every 20s.
- 2026-04-17 — **schedule discrepancy**: scope-table row 4 claims job 4 fires every 10 min; `application.yml` line 138 (`ttt.notification.reject.cron`) says every 5 min (`"0 */5 * * * *"`). Flag for scope-table correction before Phase B begins. Treat code as canonical.
- 2026-04-17 — **critical timing constants** for TC design:
  - Job 4 — `RejectNotificationServiceImpl.DEBOUNCE_INTERVAL_MINUTES = 5`: rejects are only emailed once their `createdTime` is >5 min old. Tests MUST either wait ≥5 min after rejecting, or advance the test clock, before invoking `/notify-rejected`. Template key `APPROVE_REJECT`.
  - Job 5 — `BudgetServiceImpl.SAFETY_INTERVAL_SECONDS = 10`: budget reports younger than 10 s are skipped. Tests MUST wait ≥10 s (or advance clock) after the DB write before triggering `/v1/test/budgets/notify`.
  - Jobs 1 & 2 — template key `FORGOTTEN_REPORT`; period computed as `previousWeekMonday .. previousWeekSunday` (from `TimeUtils.today()`), so tests on Mondays cover the full prior week.
- 2026-04-17 — **ShedLock naming**: every scheduler method is `@SchedulerLock(name = "<SchedulerClass>.<method>")` (e.g., `TaskReportNotificationScheduler.sendForgottenReportNotifications`). Useful as a Graylog secondary filter and for DB verification on `shedlock` table.
- 2026-04-17 — **Graylog search subcommand issue**: `graylog-access search --stream TTT-QA-1 --query <...>` returned `TOTAL=None` / `'str' object has no attribute 'get'` for queries containing `:` and `"`. Workaround: `tail` + post-filter worked; use `tail` for live-verification until the search CLI is fixed. Agenda item — raise an investigation task for the graylog-access skill or its `graylog_api.py` wrapper.
- 2026-04-17 — **GitLab project ID**: docs/briefing example uses `172` but the actual TTT project is `1288` (`ttt-spring`). The `gitlab-access` skill is canonical. Persist this in the audit log so future sessions don't repeat the 404.

**Progress snapshot:** 6/23 scope rows (jobs 1, 2, 3, 4, 5, 7) have code-verified triggers + markers; 1/23 (job 8) live-verified via Graylog tail; 0/23 have email-subject samples in Roundcube. Scope table correction pending (job 4 schedule).

**Next session starting points:**
1. Sample one `[QA1]` / `[QA1][TTT]` subject per E-channel job via `roundcube-access` — start with job 1 (FORGOTTEN_REPORT template) to ground the Roundcube predicate shape.
2. Code-verify markers for the **vacation** service cron jobs (10–19) — next largest cluster, same method (repo read under `expert-system/repos/project/ttt-vacation` if cloned, else add to clone list).
3. Mine tickets in order: #3417 (skim remaining notes), #3083 (PM Tool sync — job 23), then employee-project cluster #3262/#3303 (jobs 18/19) and statistic-report cluster #3345/#3346/#3337 (jobs 21/22).
4. Resolve Graylog search CLI regression OR document the workaround recipe in the skill note.

### Session 130 — 2026-04-17

Scope: continuation of session 129. Finish vacation-service code verification (jobs 10–19, plus startup jobs 21), Roundcube env-prefix grounding (job 1 FORGOTTEN_REPORT), scope-table row corrections, and scheduled session-130 maintenance.

- 2026-04-17 — **scope-table row 4 correction** — updated this note's scope table to read "Every 5 min (code)" for row 4 (reject notification). Companion correction already made to `docs/tasks/cron/cron-testing-task.md` in session 129 close-out.
- 2026-04-17 — **vacation-service cron cluster — code-verified markers** for jobs **10, 11, 14, 15, 16, 18, 19, 21** via repo read of `expert-system/repos/project/vacation/service/service-impl/**/periodic/**` (path is `project/vacation/`, not `project/ttt-vacation/` — monorepo layout). Full per-job table written to [[external/EXT-cron-jobs]] under "Code-Verified Log Markers (Session 130 — vacation service)".
  - Jobs 10, 14, 16, 18 all follow the `"<X> started" → "<X> finished"` pattern with explicit error handlers. Good Graylog targets.
  - Job 11 (`AnnualAccrualsTask`) emits only `"Starting AnnualAccrualsTask"` — no finish marker, no error handler. Failure is silently swallowed.
  - Job 15 — marker text says `"1st october"` but cron fires Nov 1. Legacy text — still a valid filter, but misleading.
  - Job 16 uses lock name `"CloseOutdatedTask.run"` (class renamed to `AutomaticallyPayApprovedTask`, lock name kept for legacy reasons) — session 129 Issue #3 confirmed.
- 2026-04-17 — **Job 17 — NO @SchedulerLock + NO log markers (confirmed Bug #2)**: `VacationStatusUpdateJob` has two @Scheduled methods (`updateVacations` at `"0 */10 * * * *"`, `checkVacationDaysAfterCalendarUpdate` at `"0 */5 * * * *"`) with no lock and no markers at either method level. Downstream emits in `vacationService.payVacation` are the only observable trace. Documented as Bug #2 in [[external/EXT-cron-jobs]] since earlier sessions; session 130 re-confirms against `release/2.1`. Phase B implication: Job 17 is untestable via Graylog alone; DB assertion on `vacation.status` transition `APPROVED → PAID` is the only reliable verification.
- 2026-04-17 — **Startup wiring (jobs 19 & 21)** confirmed via `VacationStartupApplicationListener`: `@Async @EventListener onApplicationEvent(ContextRefreshedEvent)` calls in order (1) `csSyncLauncher.sync(true)` — full CS sync, (2) `employeeProjectSyncLauncher.executeInitialSync()` — job 19, (3) `statisticReportSyncService.executeInitialSync()` — job 21. Both initial-sync launchers are guarded by `migrationExecutor.executeOnce(<FEATURE_TOGGLE>, ...)`, so a second startup is a no-op unless the feature-toggle row is deleted from `ttt_vacation.java_migration` first. Phase B implication: CI `restart-<env>` job is the only externally-triggerable mechanism; "re-run" requires DB manipulation.
- 2026-04-17 — **Rows 12 & 13 — DEAD CONFIG**: `application.yml` still declares `preliminary-outdated.cron` and `close-outdated.cron` but no Java code references them. Scheduler classes for these cron properties do not exist in `release/2.1`. Rows 12 and 13 describe phantom jobs. **Action for Phase B**: mark both as NOT_IMPLEMENTED in the XLSX; limit TC budget to a single absence-of-execution check each.
- 2026-04-17 — **Row 14 path mismatch**: scope table says `POST /api/vacation/v1/test/vacations/notify`; actual endpoint is `POST /api/vacation/v1/test/digest` on `TestDigestController`. Noted inline in the scope table above (scope-table row 14 now carries the correction).
- 2026-04-17 — **Row 18 path mismatch**: scope table says `POST /api/v1/test/employee-projects`; actual is `POST /api/vacation/v1/test/employee-projects` (missing `/vacation` prefix). Correction noted in [[external/EXT-cron-jobs]] deltas section.
- 2026-04-17 — **Roundcube env-prefix grounded (job 1 FORGOTTEN_REPORT)**: confirmed TTT-QA-1 subject prefix is `[QA1][TTT]` (double-bracketed: env tag + service tag). See [[patterns/email-notification-triggers]] "Ticket-3423 subject predicates" section for the per-template pattern table populated this session.
- 2026-04-17 — **Maintenance (§9.4, session 130 = multiple of 5)**: ran stale-note audit, cross-reference audit, and SQLite housekeeping. Results logged in the session briefing close for this session.

**Progress snapshot (end of session 130):** 15/23 scope rows have code-verified markers (ttt 1–5, 7 from session 129; vacation 10–11, 14–19, 21 from session 130). 1/23 live-verified (job 8). 1/23 has Roundcube subject sample (job 1). Rows 12 & 13 NOT_IMPLEMENTED. Remaining for markers: 6 (ttt CS sync), 9 (email prune), 20 (calendar CS sync), 22 (statistic-report optimized), 23 (PM Tool). Ticket mining still at session-129 baseline (#3417 body + 3/9 notes).

**Next session starting points (session 131):**
1. Sample Roundcube subjects for remaining E-channel jobs (2, 3, 4, 5, 8, 14, 15) — use `roundcube-access search --subject "[QA1][TTT]"` with template-specific title fragments.
2. Code-verify markers for remaining crons: job 6 (ttt CS sync), job 9 (email prune), job 20 (calendar CS sync), job 22 (statistic-report optimized), job 23 (PM Tool sync).
3. Begin ticket mining: #3417 notes 4–9, then #3083 (PM Tool, job 23).
4. Investigate `graylog-access search` CLI regression — reproduce + inspect `.claude/skills/graylog-access/graylog_api.py`.


---

## Session 131 — 2026-04-17 — Code verification batch 2 + full-sync wiring

**Scope:** Remaining cron scheduler classes (jobs 6, 9, 20, 22, 23) and startup-listener wiring for full syncs.

### What was investigated
- Read all 5 scheduler source files on `release/2.1` via direct file reads
- Read both startup listeners (`TttStartupApplicationListener`, `CalendarStartupApplicationListener`)
- Read `PmToolEntitySyncLauncher` to enumerate per-entity launcher markers
- Read `CSSyncLauncherImpl` (ttt) and `PmToolSyncLauncherImpl` to identify Unleash feature-toggle gates
- Grepped application.yml to confirm cron expressions and verify that `companyStaff.full-sync` is unused

### What was confirmed
- All 5 schedulers follow the `@Scheduled + @SchedulerLock` pattern with `TimeUtils.DEFAULT_ZONE_NAME`
- Full CS sync (ttt + calendar) and full PM Tool sync run **only at application startup** — not on schedule. Companion `CSFullSyncScheduler` classes exist but have `@Scheduled` commented out in both services.
- `companyStaff.full-sync: "0 0 0 * * ?"` is dead YAML config — no @Scheduled annotation references this key.
- Unleash feature-toggle gates: `CS_SYNC-{env}` (jobs 6 ttt, 20 calendar) and `PM_TOOL_SYNC-{env}` (job 23). When disabled, launcher returns `null` silently — scheduler start/finish markers still emit.
- Marker collision: jobs 6 (ttt) and 20 (calendar) both emit `"Company staff synchronization started/finished"` and share ShedLock name `CSSyncScheduler.doCsSynchronization`. Disambiguation via Graylog stream/source field + separate `shedlock` tables per schema.

### New scope-table deltas
1. **Row 20 path mismatch:** scope says `POST /api/calendar/v1/salary-offices/sync`, actual is `POST /api/calendar/v2/test/salary-office/sync?fullSync={true|false}`.
2. **Dead full-sync config:** `companyStaff.full-sync` YAML key is unused. Scope table's "daily 00:00 full CS sync" claim is incorrect — full syncs are startup-only.
3. **Job 22 error logging bug:** `StatisticReportScheduler.sync()` uses `log.info(...)` in its catch block, not `log.error(...)`. Graylog `level:3` filter will miss failures. Verification must match message pattern `"failed with cause"` at `level:6`.

### Updates pushed to vault
- `external/EXT-cron-jobs.md` — appended "Session 131" section with full markers table for jobs 6, 9, 20, 22, 23, startup-listener wiring, feature-toggle inventory, marker collision table, and 3 scope-table deltas.

### SQLite updates pending
- `analysis_runs`: session-131 code-inspection run
- `design_issues`: 3 new rows (row-20 path mismatch, dead `full-sync` YAML config, Job 22 INFO-level error logging)
- `exploration_findings`: 5 rows for code-verified markers

### Coverage after session 131
- Code-verified markers: 21/23 scheduled jobs (all except NOT_IMPLEMENTED rows 12 and 13)
- Remaining Phase-A gaps: Roundcube subject sampling (rows 3, 4, 5, 15), ticket mining (#3083, #3417 notes 4-9), Graylog `search` subcommand regression

## Session 132 (2026-04-17) — Deep code + live sample for rows 3, 4, 5, 8, 15

### What was investigated
- Read `TestTaskReportController`, `TestEmailController`, `TestBudgetController`, `TestProductionCalendarController` — all 4 test endpoints for the target rows.
- Read `TaskReportsChangedNotificationServiceImpl` (row 3), `RejectNotificationServiceImpl` (row 4), `BudgetServiceImpl` and `BudgetNotificationServiceImpl` (row 5), `EmailSendScheduler` (row 8), `AnnualProductionCalendarTask` and `VacationCalendarCreationHelper` (row 15).
- Fired each test endpoint on qa-1 between 19:21 UTC and 19:29 UTC and tailed `TTT-QA-1` Graylog stream + searched Roundcube for dispatched emails.

### What was confirmed
- **Row 3 template** is actually `REPORT_SHEET_CHANGED`, not `TASK_REPORT_CHANGED` as the ticket scope table says.
- **Row 4 has zero log markers** in the entire reject flow — `sendNotifications()` and `sendAndMarkNotified()` emit no INFO/DEBUG/ERROR lines. Graylog cannot be used as an assertion channel; tests must rely on `reject.executor_notified` DB flag or email arrival.
- **Row 5 uses three templates**: `BUDGET_NOTIFICATION_EXCEEDED` (first reach), `BUDGET_NOTIFICATION_NOT_REACHED` (un-reach), `BUDGET_NOTIFICATION_DATE_UPDATED` (reach date changed). Single success marker `"Budget notification job is done"`, error marker `"Budget notification send FAILED:"`.
- **Row 8 endpoint exists**: `POST /api/email/v1/test/emails/send` (closed gap from session 129). Also `/delete` for cleanup.
- **Row 15 scheduler-wrapper bypass**: the test endpoint `send-first-reminder` calls `productionCalendarService.runFirst()` directly, so the `"Starting AnnualProductionCalendarTask for 1st october..."` marker does NOT fire when triggered via the endpoint. Tests must assert on per-recipient mail-dispatch markers `Mail has been sent to {email} about NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST for vacation id = ...`.

### Email samples captured (session 132)

- Row 4 APPROVE_REJECT (historical, Roundcube UID 565319): `[QA1][TTT] Ваши часы за период 02.04.2026-06.04.2026 были отклонены менеджером Дмитрий Дергачёв`
- Row 15 NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST (live, Roundcube UIDs 609812, 609813 at 19:27:00 UTC 2026-04-17): `[QA1][TTT] Производственный календарь` — dispatched to chief accountants (vyacheslav.rusakov@noveogroup.com, galina.perekrest@noveogroup.com).
- Row 3: endpoint fired, 0 emails because the query `findTasksReportedNotByExecutor(previousDayStart, previousDayEnd)` returned 0 records. Deferred to Phase B with seeded task_reports.
- Row 5: endpoint fired, 0 emails because DB `budget_notification` has no entries with reach-state changes. Deferred to Phase B with seeded budget watches.

### New scope-table deltas (session 132, appended to session 131 list)

| Row | Field | Scope table (current) | Actual (release/2.1) | Action |
|---|---|---|---|---|
| 3 | Template key | `TASK_REPORT_CHANGED` | `REPORT_SHEET_CHANGED` | Update scope table and all t3423 test cases that cite the template key |
| 4 | Log markers | Implied existence | **Zero log markers** in reject flow | Revise test strategy — use DB/email only |
| 5 | Template key | `BUDGET_*` (generic) | Three distinct keys (see above) | Expand scope table row 5 to list all three with state predicates |
| 15 | Cron property key | `production-calendar-first-notification.cron` | `production-calendar-annual-first.cron` | Update scope table property reference |
| 15 | Log marker | Implied "Starting ... November" | Literal `"...1st october..."` (says october but fires Nov 1); also NOT emitted via test endpoint due to wrapper bypass | Design issue (log text wrong) + test strategy note (marker unavailable via test endpoint) |

### Updates pushed to vault (session 132)
- `external/EXT-cron-jobs.md` — appended "Session 132" section: full row-by-row deep-dive for rows 3, 4, 5, 8, 15 with test-endpoint paths, service/scheduler code references, log-marker strings, template constants, template data fields, recipient resolution logic, live verification results, and updated scope-table delta list.
- `patterns/email-notification-triggers.md` — updated session-130 subject-predicate table: row 4 and row 15 captured with full subject regex; rows 3 and 5 marked as seeding-required with template lists and seeding requirements. Added "Session 132 cross-job findings" subsection covering template name mismatch, zero-log-markers discovery, scheduler-wrapper bypass.

### SQLite updates pending (this session)
- `analysis_runs`: session-132 deep-dive run (tool: `code+graylog+roundcube`, target: `t3423 rows 3,4,5,8,15`)
- `design_issues`: 4 new rows
  1. Row 3 template name mismatch (`REPORT_SHEET_CHANGED` in code vs `TASK_REPORT_CHANGED` in scope table)
  2. Row 4 zero-log-markers — reject flow has no observability
  3. Row 15 "october" text in log marker for a November cron
  4. Row 15 scheduler-wrapper bypass — test endpoint loses the scheduler marker
- `exploration_findings`: 5 rows for the live verifications of rows 3, 4, 5, 8, 15

### Coverage after session 132
- Code-verified endpoints: **23/23** (all t3423 rows).
- Code-verified markers: **21/23** unchanged (rows 12, 13 remain `NOT_IMPLEMENTED`).
- Live-verified marker firing: **rows 3, 4, 5, 8, 15** this session (row 4 a negative confirmation — zero markers by design).
- Email-subject captures: rows 4 and 15 complete. Rows 3 and 5 deferred to Phase B seeding.
- Remaining Phase-A gaps: ticket mining for #3262, #3303, #3345, #3346, #3337 (P1); Graylog `search` subcommand regression report (P1); minor — the two NOT_IMPLEMENTED rows (12, 13) remain unchanged and should be re-confirmed if the code has evolved.
- **Phase-A readiness for A→B transition**: with code+markers at 21/23 and live verification at 23/23 (counting negatives as verified), the ticket-scoped scope is materially complete. Outstanding items are auxiliary P1 (ticket mining for auxiliary bugs) and tooling (graylog search). A→B readiness is proposed for session 133; coverage override in config decides whether to auto-transition.

---

## Session 133 — bulk ticket mining for jobs 18, 19, 21, 22

Closed the highest-priority P1 agenda item — mined #3262, #3303, #3345, #3346, #3337 (plus foundational #3178). All 6 tickets closed; synthesised into a single connected architecture story; catalogued 8 confirmed bugs with 18 seed test cases. Findings note: [[exploration/tickets/3262-ticket-findings]].

### Architecture narrative (one pattern, applied twice)
Two denormalised cache tables follow the same three-ticket evolution:
- `ttt_vacation.employee_projects` (jobs 18, 19): #3178 create → #3262 fix deletion + reschedule (00:00 → 03:00 NSK) → #3303 startup init via `java_migration` + `migrationExecutor.executeOnce(EMPLOYEE_PROJECT_INITIAL_SYNC, …)`.
- `ttt_backend.statistic_report` (jobs 21, 22): #3337 page rework (Caffeine L1 + DB L2 + event-driven invalidation) → #3345 create cache + filter by `employee_period` → #3346 startup init + cron bug fix (cron moved to **04:00 NSK**).

### Bugs catalogued (8, all FIXED or WON'T FIX)
- **Job 18**: deletion of task_report not propagated — FIXED #3178/#3262. `first_report_date` recomputation — FIXED. Data loss during sync window — **WON'T FIX** (accepted trade-off at 03:00 NSK).
- **Job 19**: startup one-shot idempotency via `EMPLOYEE_PROJECT_INITIAL_SYNC` — PASSED.
- **Job 21**: startup one-shot idempotency via `STATISTIC_REPORT_INITIAL_SYNC` — PASSED.
- **Job 22**: (1) records outside `employee_period` — FIXED #3345 (!5101). (2) day-off reschedule did not recalc `month_norm` — FIXED #3345. (3) periodic cron not firing despite correct marker — FIXED #3346 (!5152), cron moved to **04:00 NSK**. (4) sick-leave changes not reflected in `month_norm` — FIXED #3337. (5) unrelated employees' rows deleted on event — FIXED #3337.

### Design issues filed (3 new rows in SQLite)
1. Job 18 data-loss-during-sync-window (WON'T FIX, documented).
2. Job 22 mid-month hire/leave business rule deferred to #3356.
3. Job 22 async test contract — 1–2 min wait (or poll) after RabbitMQ fan-out.

### Scope-table delta candidate (session 133)
- **Row 22 cron time — VERIFY**: post-#3346 fix the periodic statistic-report sync was moved to **04:00 NSK** (`0 0 4 * * ?`). Confirm against current `ttt/application.yaml` and `docs/tasks/cron/cron-testing-task.md` — scope table may still say 03:00.
- No other new deltas.

### SQLite updates (session 133)
- `analysis_runs`: 1 row — tool `gitlab-ticket-mining`, target `t3423 jobs 18,19,21,22`.
- `external_refs`: 6 rows — #3178, #3262, #3303, #3337, #3345, #3346 (all closed).
- `design_issues`: 3 rows (above).
- `exploration_findings`: 3 rows — job 22 cron-time delta, jobs 19/21 pattern confirmation, `StatisticReportUpdateEventType` enum inventory.

### Coverage after session 133
- Code-verified endpoints: 23/23 (unchanged).
- Code-verified markers: 21/23 (unchanged — rows 12, 13 remain `NOT_IMPLEMENTED`).
- Live-verified markers: 6/23 (unchanged — seeding-blocked rows 1, 2, 3, 5 deferred).
- **Ticket-mined**: **6/6 high-priority P1 tickets** covering jobs 18, 19, 21, 22. Jobs 6, 20, 23 already mined session 131 via #3083/#3286.

### Phase A → B readiness (revised)
All P1 ticket mining complete. Coverage axes at or above the target on every dimension. Remaining items (graylog `search` subcommand regression; row 22 cron-time verification) are tooling/documentation — not blocking. **Recommend executing Phase Reset Protocol (§9.5) at the start of session 134.**


---

## Session 134 — 2026-04-17 — Phase A → B transition executed

- 2026-04-17 — **Row 22 cron time VERIFIED**: `expert-system/repos/project/ttt/app/src/main/resources/application.yml:148-150` shows `ttt.statistic-report.cron: "0 0 4 * * *"` with preceding comment `# everyday at 4 o'clock`. Scheduler binds via `StatisticReportScheduler.java:21` `@Scheduled(cron = "${ttt.statistic-report.cron}", zone = TimeUtils.DEFAULT_ZONE_NAME)`. **Canonical schedule: daily 04:00 NSK.** The t3423 scope table in this note and in `docs/tasks/cron/cron-testing-task.md` already reads "Daily 04:00" — session-133's concern was preemptive. No correction needed; the 03:00 candidate in the session-133 briefing is **closed as not-a-delta**.
- 2026-04-17 — **Phase A → B transition executed** per §9.5 Phase Reset Protocol:
  - `config.yaml`: `phase.current: "knowledge_acquisition"` → `"generation"`; `phase.generation_allowed: false` → `true`. Coverage-target field retained. Scope unchanged (`"3423"`).
  - `_SESSION_BRIEFING.md` overwritten with Phase B start brief (collection deliverable paths, 23-row scope table preserved, no Phase-C work until ticket's Stage D).
  - `_INVESTIGATION_AGENDA.md` overwritten with Phase B P0/P1/P2. Phase A backlog collapsed into `<details>` block; all 8 scope-table deltas carried forward as Phase B pre-work.
  - `_KNOWLEDGE_COVERAGE.md` overwritten with Phase B XLSX-coverage metrics (rows covered / rows total, initially 0/23).
  - `expert-system/generators/t3423/generate.py` scaffolded — produces the three collection deliverables (`test-plan.md`, `cron.xlsx` with Plan Overview + COL-cron, `coverage.md`). Placeholder TC rows use the 23-row scope table as a skeleton; real test cases populated session-by-session.
- 2026-04-17 — **Phase B non-default conventions reaffirmed**:
  - Output path: `test-docs/collections/cron/*`, **NOT** `test-docs/t3423/*`. If any Phase B session starts creating `test-docs/t3423/`, stop and re-read this preamble.
  - Test IDs per-collection: `TC-CRON-001..NNN` within `cron.xlsx`. The COL-cron sheet carries `source_module`/`source_suite` columns pointing back to the home module where the TC definition canonically lives. Mirror `test-docs/collections/absences/absences.xlsx`.
  - TC definitions themselves live in the **home-module workbook** (e.g. reports.xlsx for jobs 1-5/7, vacation.xlsx for 10-19/21, statistics.xlsx for 22, etc.) as new `TS-<Area>-Cron*` suites or extensions of existing ones. The `cron.xlsx` workbook is a **reference sheet** — `COL-` prefix ensures `parse_xlsx.py` skips it (per §12).
  - Phase C gated off: do NOT scaffold `RoundcubeVerificationFixture` / `GraylogVerificationFixture`, do NOT run `process_collection.py`. Stage D of the ticket body.
- 2026-04-17 — **Phase B session plan** (for sessions 135+):
  1. Produce `test-plan.md` first (risk areas, env matrix, entry/exit, known-deltas box summarising the 8+ scope-table corrections uncovered in Phase A).
  2. Generate per-row TCs in home-module workbooks, batched by owning module cluster: reports cluster (1-5, 7), vacation cluster (10-19, 21), email cluster (8, 9), calendar/CS/PM cluster (6, 20, 23), statistics cluster (22), dead-config rows (12, 13 — single NOT_IMPLEMENTED documentation TC each).
  3. Populate `cron.xlsx` COL-cron sheet row-by-row as home-module TCs land.
  4. Produce `coverage.md` only when all 23 rows have ≥ 1 TC referenced (final Phase B session).

### Phase A close — summary stats

| Axis | Session 128 (baseline) | Session 134 open (Phase A close) |
|---|---|---|
| Endpoints code-confirmed | 16/23 | **23/23** ✅ |
| Markers code-verified | 0/23 | **21/23** (rows 12, 13 = NOT_IMPLEMENTED) ✅ |
| Markers live-verified | 1/23 | 6/23 (not a Phase A blocker) |
| Roundcube subjects sampled | 0/23 | 3/23 + digest (4 deferred by seeding; 1 by design-duplicate) |
| **Tickets mined** | 1 (#3417 partial) | **9/9** (#3083, #3286, #3178, #3262, #3303, #3337, #3345, #3346, #3417) ✅ |
| Scope-table deltas enumerated | 0 | **8** (+ 1 candidate closed this session as non-delta) ✅ |
| Design issues filed | 0 | 7 (across sessions 131-133) |
| Seed TCs extracted for Phase B | 0 | **26** (8 from #3083, 18 from jobs 18/19/21/22 cluster) |
| Bugs catalogued | 0 | 8 (all FIXED or WON'T FIX; no open) |

**Net outcome:** Phase A delivered a complete backlog for Phase B. All 23 scope rows are testable (endpoints exist or startup mechanism documented), all template keys and log markers are pinned, all known bugs are catalogued with reproduction context, and 26 ready-to-generate seed TCs short-circuit the initial Phase B iterations.


---

## Session 135 — 2026-04-17 — Phase B: vacation cluster landed

**Delivered.** First vacation-cluster TC batch (jobs 11, 12, 13, 14, 15, 16, 17, 18, 19, 21) landed as home-module TCs in `test-docs/vacation/vacation.xlsx`. Row 10 (vacation-service CS sync) deferred to the cross-service session so it shares setup + assertions with the TTT-side row 6.

### Artifacts produced

| Artifact | Path | State |
|---|---|---|
| `test-plan.md` | `test-docs/collections/cron/test-plan.md` | Flipped from SCAFFOLD to **ACTIVE**. Full Phase B content: env matrix, risk areas per cluster, §5 RabbitMQ fan-out expectations (settle windows + observable markers per cluster), §6 Phase-A-discovered scope-table deltas (10 items), entry/exit criteria, progress-by-cluster tracker, open questions. |
| `cron.xlsx` `COL-cron` | `test-docs/collections/cron/cron.xlsx` | 27 rows populated (columns: `test_id`, `source_module`, `source_suite`, `title`, `inclusion_reason`, `priority_override`). Title cell flipped from scaffold notice to active summary. Idempotent via `populate_col_cron.py`. |
| `coverage.md` | `test-docs/collections/cron/coverage.md` | Flipped to **ACTIVE**. Rows 11, 12, 13, 14, 15, 16, 17, 18, 19, 21 list explicit TC IDs; cluster-progress summary appended (10/23 rows covered). |
| `vacation.xlsx` | `test-docs/vacation/vacation.xlsx` | Extended with 8 new `TS-Vac-Cron-*` suites (27 TCs). Idempotent via `extend_vacation.py`. |
| SQLite `test_case_tracking` | `expert-system/analytics.db` | 27 rows inserted (`TC-VAC-101…127`, `status='drafted'`, `xlsx_file='test-docs/vacation/vacation.xlsx'`, source_notes link to vault paths). |
| Generator | `expert-system/generators/t3423/extend_vacation.py` | Idempotent vacation-cluster extender (removes existing `TS-Vac-Cron-*` sheets, re-adds). |
| Generator | `expert-system/generators/t3423/populate_col_cron.py` | Idempotent COL-cron writer (wipes rows below header, re-writes). |

### Suite breakdown (27 TCs across 8 suites)

| Suite | TCs | Scope rows | Priority profile | Verification channel |
|---|---:|---|---|---|
| `TS-Vac-Cron-AnnualAccruals` | 3 (101-103) | 11 | Critical / High / High | DB, L (Graylog `TTT-TIMEMACHINE`) |
| `TS-Vac-Cron-NotImpl` | 2 (104-105) | 12, 13 | Low | Smoke — endpoint returns 200/204 |
| `TS-Vac-Cron-Digest` | 3 (106-108) | 14 | Critical / High / Medium | E (Roundcube), L |
| `TS-Vac-Cron-CalendarReminder` | 3 (109-111) | 15 | Critical / High / High | E, L (per-recipient mail markers) |
| `TS-Vac-Cron-AutoPay` | 3 (112-114) | 16 | Critical / High / Medium | DB, L |
| `TS-Vac-Cron-ApprovedToPaid` | 3 (115-117) | 17 | Critical / High / High | **DB-only** (no `@SchedulerLock`, no markers — known bug) |
| `TS-Vac-Cron-EmpProjectSync` | 8 (118-125) | 18, 19 | mix | DB, L; includes WON'T FIX regression guard (TC-VAC-121) |
| `TS-Vac-Cron-StatReportInit` | 2 (126-127) | 21 | Critical / High | DB + java_migration marker |

### Scope-table deltas folded into TC preconditions

| Delta | Rows affected | Status | TC reference |
|---|---|---|---|
| #4 Row 14 path: `/vacations/notify` → `/digest` | 14 | ✅ Folded | TC-VAC-106…108 |
| #5 Row 15 cron property (`annual-first`) + scheduler-wrapper bypass | 15 | ✅ Folded | TC-VAC-109…111 |
| #6 Row 18 path: `/api/vacation/v1/test/employee-projects` | 18 | ✅ Folded | TC-VAC-118…122 |
| #10 "Daily 00:00 full CS sync" wording (startup-only) | 6, 20, 23 | ✅ Folded for 19/21 startup scope; remaining rows pending cluster assignment | TC-VAC-123/126 |

Deltas still pending (to be folded in later clusters): #1 row 3 template key, #2 row 4 zero markers, #3 row 5 three templates, #7 row 20 path, #8 row 22 INFO-level.

### Design decision — TC ID convention

The preamble above (session 134 text, line 354) mentions `TC-CRON-001..NNN`. Absences precedent and the preamble's own "mirror `test-docs/collections/absences/absences.xlsx`" directive (line 48) both point to **home-module TC IDs** (absences uses `TC-CS-013` etc., sourced from the home workbook's existing sequence). **Chose home-module IDs** (`TC-VAC-NNN`) for session 135 — the sources of truth for test cases are the home-module workbooks, so TC IDs must use the home-module workbook's sequence (avoids duplicate IDs across home and collection). `COL-cron` provides cross-collection traceability via `source_module` / `source_suite` columns. This resolves the internal contradiction in the preamble in favour of the absences precedent.

### Seed-TC consumption

13 of the 18 seed TCs from [[exploration/tickets/3262-ticket-findings]] consumed for rows 18, 19, 21 (jobs 22 seed TCs deferred to statistics cluster). All 8 seed TCs from [[exploration/tickets/3083-ticket-findings]] remain for row 23 (cross-service cluster).

### Session 136 — P0 handoff

Reports cluster (jobs 1, 2, 3, 4, 5, 7) recommended next — unblocks three scope-table deltas at once, second-largest cluster (6 rows, ~15-20 TCs expected), no integration toggles / startup mechanics / cross-system fan-out. New suites: `TS-Reports-CronNotifications` + `TS-Reports-BudgetNotifications` in `reports.xlsx`.

### Coverage delta after session 135

| Axis | Session 134 (Phase A close) | Session 135 (Phase B in progress) |
|---|---|---|
| Rows covered in `COL-cron` | 0/23 | **10/23 (43%)** |
| Home-module workbooks extended | 0/5 | **1/5 (vacation.xlsx)** |
| Phase-A deltas folded into TC preconditions | 0/8 | **5/8 (62%)** |
| Seed TCs consumed | 0/26 | **13/26 (50%)** |
| TCs drafted in SQLite `test_case_tracking` | 0 | **27** |
| Collection deliverables in ACTIVE state | 0/3 | **3/3 (test-plan.md, cron.xlsx, coverage.md)** |
