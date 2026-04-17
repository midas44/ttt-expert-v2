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

## Scope — 23 cron & startup jobs

All times are Asia/Novosibirsk (GMT+7). `E` = Roundcube email, `L` = Graylog log, `CS` / `PM` / `DB` = cross-system write.

| #  | Service  | Job                                                 | Schedule                     | Trigger                                                                | Channels       |
|----|----------|-----------------------------------------------------|------------------------------|------------------------------------------------------------------------|----------------|
| 1  | TTT      | Forgotten-report notification (weekly)              | Mon, Fri 16:00               | `POST /api/ttt/v1/test/reports/notify-forgotten`                        | E, L           |
| 2  | TTT      | Forgotten-report delayed notification               | Daily 16:30                  | `POST /api/ttt/v1/test/reports/notify-forgotten-delayed`                | E, L           |
| 3  | TTT      | Report-changed notification                         | Daily 07:50                  | `POST /api/ttt/v1/test/reports/notify-changed`                          | E, L           |
| 4  | TTT      | Report-reject notification                          | Every 10 min                 | `POST /api/ttt/v1/test/reports/notify-rejected`                         | E, L           |
| 5  | TTT      | Budget-overrun notification                         | Every 30 min                 | `POST /api/ttt/v1/test/budgets/notify`                                  | E, L           |
| 6  | TTT      | CS sync (partial / full)                            | Every 15 min / daily 00:00   | `POST /api/ttt/v1/test/employees/sync?fullSync={true,false}`            | CS, DB, L      |
| 7  | TTT      | Extended report-period cleanup                      | Every 5 min                  | `POST /api/ttt/v1/test/reports/cleanup-extended`                        | DB, L          |
| 8  | Email    | Email dispatch batch                                | Every 20 sec                 | `POST /api/email/v1/test/emails/send`                                   | E, L           |
| 9  | Email    | Email retention prune (> 30 days)                   | Daily 00:00                  | `POST /api/email/v1/test/emails/delete`                                 | DB, L          |
| 10 | Vacation | CS sync (partial / full)                            | Every 15 min / daily 00:00   | `POST /api/vacation/v1/test/employees/sync?fullSync={true,false}`       | CS, DB, L      |
| 11 | Vacation | Annual vacation accruals                            | Jan 1, 00:00                 | `POST /api/vacation/v1/test/annual-accruals`                            | DB, L          |
| 12 | Vacation | Preliminary-vacation outdated removal               | Hourly                       | `POST /api/vacation/v1/test/vacations/delete-expired-preliminary`       | DB, L          |
| 13 | Vacation | Preliminary-vacation close-outdated                 | Hourly                       | `POST /api/vacation/v1/test/vacations/close-outdated`                   | DB, L          |
| 14 | Vacation | Vacation notifications                              | Daily 08:00                  | `POST /api/vacation/v1/test/vacations/notify`                           | E, L           |
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
