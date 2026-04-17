**Parent epic:** #3402
**Collection name:** `cron`
**Primary reference:** [Confluence: cron](https://projects.noveogroup.com/spaces/NOV/pages/32904541/cron)

## Summary

Build a dedicated curated test collection — `cron` — that consolidates end-to-end tests for every scheduled job in TTT and its integrated systems (Vacation, Calendar, Email services; CS and PM Tool sync; notification emails through Roundcube; backend evidence through Graylog). The collection materialises as a cross-module Playwright suite tagged `@cron`, generated from a single XLSX workbook and supported by two new reusable verification fixtures.

## Motivation

Cron-driven behaviour is the most complex and highest-risk testing surface in TTT. It spans time (test-clock manipulation is available on every test environment — qa-1, ttt-timemachine, stage), crosses the four backend services, and has observable side-effects outside the application — notification emails in the shared Roundcube mailbox, log lines per environment in Graylog, RabbitMQ fan-out, and writes from CS / PM Tool sync. Manual regression is slow, brittle, and currently the dominant mode of verification for this area.

<details>
<summary>What "RabbitMQ fan-out" means here</summary>

One published event reaches many independent consumers — one cron trigger, multiple downstream effects. The term has two senses: (1) a RabbitMQ **fanout exchange** that broadcasts every message to every queue bound to it, ignoring routing keys; (2) the broader pattern of "one producer → N consumers", whether implemented with a fanout exchange or with a topic exchange plus multiple bindings.

TTT's backends (ttt, vacation, calendar, email) are decoupled and talk over RabbitMQ, so a single cron tick often emits events that several services process asynchronously. Examples:

- **CS sync** (jobs 6, 10, 20) — publishes employee-update events; vacation and calendar each re-materialise their own copies.
- **Calendar change** — flipping a day to work/non-work fans out to vacation (recalculate affected requests) and day-off (cascade-delete invalid days).
- **Period close** (job 17, APPROVED → PAID) — emits `PeriodChangedEvent`; accounting, statistics, and vacation each react.
- **Email dispatch** (job 8) — every backend publishes to an email exchange; the email service consumes and delivers.

For cron tests this means: (a) wait for the full fan-out to settle — each consumer is its own settle loop; (b) verify the *downstream* targets, not just the emitter's DB; (c) use Graylog on the consumer services to catch silent drops, because a rejected message doesn't always surface as an error on the producer side.

</details>

Existing test documentation only partially touches these paths: a handful of cases in `vacation.xlsx`, `reports.xlsx`, `statistics.xlsx`, and `day-off.xlsx`. All of it predates ticket #3417, which added Roundcube and Graylog as first-class verification channels. As a result, no single suite exercises scheduled jobs as a coherent group, and no spec verifies the email/log evidence that matters most for cron correctness.

A secondary, equally intentional goal: cron + integration tests are the hardest case the generation pipeline can be asked to handle (API triggers, async waits, test-clock work, email and log assertions, cross-service side-effects). Driving them end-to-end through the test-docs → collection-processing → autotest-generation chain is the sharpest available stress-test for the generator skills. Every friction point surfaced here converts directly into concrete improvements for `autotest-generator`, `autotest-fixer`, `collection-generator`, and `xlsx-parser`. If the pipeline can automate cron, it can automate anything.

## 📚 References

- Cron spec (canonical backlog): [Confluence: cron](https://projects.noveogroup.com/spaces/NOV/pages/32904541/cron)
- Parent epic: #3402 (this ticket will be linked as a child)
- Integrations groundwork: #3417 (Roundcube + Graylog + CS + PM Tool)
- Feature tickets cited in the spec: #3083 (PM Tool sync), #3262, #3303 (employee-project sync), #3345, #3346, #3337 (statistic-report sync)
- Collection pattern: `test-docs/collections/absences/absences.xlsx`
- Framework rules: `CLAUDE.md`, `CLAUDE+.md` §10 (collection scope protocol)
- Skills used: `collection-generator`, `autotest-generator`, `autotest-runner`, `autotest-fixer`, `xlsx-parser`, `roundcube-access`, `graylog-access`, `swagger-api`, `postgres-db`
- Prior-art vault notes: `expert-system/vault/external/ext-cron-jobs.md`, `expert-system/vault/exploration/api-findings/cron-job-live-verification.md`, `expert-system/vault/patterns/email-notification-triggers.md`

## 📋 Scope — 23 cron & startup jobs

All times are Asia/Novosibirsk (GMT+7). Descriptions of each job live in the Confluence spec; this table names the jobs, schedules, test endpoints, and verification channels. `E` = Roundcube email, `L` = Graylog log, `CS` / `PM` / `DB` = cross-system writes.

| #  | Service  | Job                                             | Schedule                       | Test endpoint                                                         | Channels         |
|----|----------|-------------------------------------------------|--------------------------------|-----------------------------------------------------------------------|------------------|
| 1  | TTT      | Forgotten-report notification (weekly)          | Mon, Fri 16:00                 | `POST /api/ttt/v1/test/reports/notify-forgotten`                       | E, L             |
| 2  | TTT      | Forgotten-report delayed notification           | Daily 16:30                    | `POST /api/ttt/v1/test/reports/notify-forgotten-delayed`               | E, L             |
| 3  | TTT      | Report-changed notification                     | Daily 07:50                    | `POST /api/ttt/v1/test/reports/notify-changed`                         | E, L             |
| 4  | TTT      | Report-reject notification                      | Every 10 min                   | `POST /api/ttt/v1/test/reports/notify-rejected`                        | E, L             |
| 5  | TTT      | Budget-overrun notification                     | Every 30 min                   | `POST /api/ttt/v1/test/budgets/notify`                                 | E, L             |
| 6  | TTT      | CS sync (partial / full)                        | Every 15 min / daily 00:00     | `POST /api/ttt/v1/test/employees/sync?fullSync={true,false}`           | CS, DB, L        |
| 7  | TTT      | Extended report-period cleanup                  | Every 5 min                    | `POST /api/ttt/v1/test/reports/cleanup-extended`                       | DB, L            |
| 8  | Email    | Email dispatch batch                            | Every 20 sec                   | `POST /api/email/v1/test/emails/send`                                  | E, L             |
| 9  | Email    | Email retention prune (> 30 days)               | Daily 00:00                    | `POST /api/email/v1/test/emails/delete`                                | DB, L            |
| 10 | Vacation | CS sync (partial / full)                        | Every 15 min / daily 00:00     | `POST /api/vacation/v1/test/employees/sync?fullSync={true,false}`      | CS, DB, L        |
| 11 | Vacation | Annual vacation accruals                        | Jan 1, 00:00                   | `POST /api/vacation/v1/test/annual-accruals`                           | DB, L            |
| 12 | Vacation | Preliminary-vacation outdated removal           | Hourly                         | `POST /api/vacation/v1/test/vacations/delete-expired-preliminary`      | DB, L            |
| 13 | Vacation | Preliminary-vacation close-outdated             | Hourly                         | `POST /api/vacation/v1/test/vacations/close-outdated`                  | DB, L            |
| 14 | Vacation | Vacation notifications                          | Daily 08:00                    | `POST /api/vacation/v1/test/vacations/notify`                          | E, L             |
| 15 | Vacation | Production-calendar annual reminder             | Nov 1, 00:01                   | `POST /api/vacation/v1/test/production-calendars/send-first-reminder`  | E, L             |
| 16 | Vacation | Auto-pay expired approved vacations             | Daily 00:00                    | `POST /api/vacation/v1/test/vacations/pay-expired-approved`            | DB, L            |
| 17 | Vacation | APPROVED → PAID auto-transition after period close | Every 10 min                | *(no dedicated test endpoint — trigger via `ptch-report-period`)*      | DB, L            |
| 18 | Vacation | Employee-project periodic sync                  | Daily 03:00                    | `POST /api/v1/test/employee-projects`                                  | DB, L            |
| 19 | Vacation | Employee-project initial sync *(startup-only)*  | Application startup            | `POST /api/v1/test/employee-projects`                                  | DB, L *(manual)* |
| 20 | Calendar | CS sync (partial / full)                        | Every 15 min / daily 00:00     | `POST /api/calendar/v1/salary-offices/sync?fullSync={true,false}`      | CS, DB, L        |
| 21 | Vacation | Statistic-report full sync *(startup-only)*     | Application startup            | `POST /api/v1/test/statistic-reports/full-sync`                        | DB, L *(manual)* |
| 22 | TTT      | Statistic-report optimized sync                 | Daily 04:00                    | `POST /api/v1/test/statistic-reports`                                  | DB, L            |
| 23 | TTT      | PM Tool project sync (partial / startup-full)   | Every 15 min / startup-full    | `POST /api/ttt/v1/test/project/sync`                                   | PM, DB, L        |

Feature toggles and enablement flags (for example, `PM_TOOL_SYNC` in Unleash for job 23, `EMPLOYEE_PROJECT_INITIAL_SYNC` / `STATISTIC_REPORT_INITIAL_SYNC` in `ttt_vacation.java_migration` for jobs 19 and 21) are documented in the Confluence spec and must be handled in the corresponding test preconditions.

## 📦 Deliverables

| Path                                                                 | Purpose                                                                                                 |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `test-docs/collections/cron/test-plan.md`                            | Human-readable test plan: risk areas, environment matrix, entry/exit criteria, open questions           |
| `test-docs/collections/cron/cron.xlsx` (sheet `COL-cron`)            | Curated-collection workbook following the `absences` pattern                                            |
| `test-docs/collections/cron/coverage.md`                             | Traceability matrix — cron job → TC IDs → spec file(s)                                                  |
| `autotests/e2e/tests/integration/cron/*.spec.ts`                     | New cross-project specs (CS sync, PM Tool sync, notification delivery)                                  |
| Existing module specs                                                | Injected with `@cron` tag by `collection-generator` — no content change                              |
| `autotests/e2e/fixtures/common/RoundcubeVerificationFixture.ts`      | Wraps `roundcube-access` — IMAP search + assert helpers for subject / from / body / time window         |
| `autotests/e2e/fixtures/common/GraylogVerificationFixture.ts`        | Wraps `graylog-access` — log-line presence, level, source, and timing assertions per environment stream |
| `docs/tasks/cron/retrospective.md`                                   | Pipeline pain-points and proposed generator improvements (populated at the end of Stage F)              |

## Verification recipe

Every automated cron test case follows the same shape:

1. **SETUP** — seed minimal state via the TTT / Vacation / Calendar Swagger API (employee, report, vacation request, calendar event, project binding, etc.).
2. **Clock** — if the cron is time-sensitive, advance the test clock on the target environment (`ptch-using-ptch-11`) or reset it with `reset-using-pst`. The test-clock endpoints are exposed on every test environment (qa-1, ttt-timemachine, stage), not only on ttt-timemachine; pick the env the rest of the spec targets.
3. **Trigger** — call the cron's matching `*-test__*` endpoint from the scope table.
4. **Wait** — respect async boundaries: the email scheduler dequeues every 20 s (job 8); sync crons may fan out downstream events; expect 1–3 settle loops.
5. **Verify** — per available channel:
   - DB state via the postgres MCP for the target environment: `mcp__postgres-qa1__execute_sql`, `mcp__postgres-tm__execute_sql`, or `mcp__postgres-stage__execute_sql`.
   - UI state via Playwright page-object assertions when the effect is user-visible.
   - Email delivery via `RoundcubeVerificationFixture`, filtered by subject prefix `[<ENV>]` or `[<ENV>][TTT]`, sender, and time window.
   - Backend log line via `GraylogVerificationFixture`, querying the per-environment stream (`TTT-QA-1`, `TTT-TIMEMACHINE`, `TTT-STAGE`, …) by cron lock name or marker.
6. **CLEANUP** — delete seeded data; reset the test clock if it was advanced; confirm no cross-test bleed.

### Verification policy

- **Roundcube verification is mandatory** for every cron that emits email (channel `E` in the scope table). DB-only verification is not sufficient — the delivery path matters as much as the DB write.
- **Graylog verification is mandatory** for every cron whose only side-effects are server-side (no user-visible UI and no directly queryable DB row), and recommended on top of DB verification when timing or retry behaviour is under test.
- These are the baseline for the `cron` collection, not "nice to have". The two new verification fixtures exist specifically to make these checks cheap.

## 🚫 Non-goals

- Startup-only jobs (job 19 — employee-project initial sync, job 21 — statistic-report full sync) are verified by manual smoke and documented in the test plan, not automated.
- No validation of raw cron expressions at the code level — scheduling is treated as a given; the task verifies observable job behaviour.
- No changes to production cron scheduling; only test-trigger endpoints are invoked.

## Prerequisites

- VPN to `logs.noveogroup.com`, `dev.noveogroup.com/mail`, `gitlab.noveogroup.com`, and the TTT qa-1 / ttt-timemachine / stage environments.
- Roundcube IMAP credentials at `config/roundcube/envs/*.yaml`.
- Graylog API token at `config/graylog/envs/secret.yaml`.
- Test-clock permissions on every test environment in use (`reset-using-pst`, `ptch-using-ptch-11` on qa-1, ttt-timemachine, and stage).
- CS preprod UI access (shared Admin SSO) for assertions on the CS side of sync tests.
- PM Tool preprod UI access (shared Admin SSO) for assertions on the PM Tool side of sync tests.

## ✅ Acceptance criteria

- Every row of the scope table except jobs 19 and 21 has ≥ 1 test case in `cron.xlsx`.
- `coverage.md` contains no unresolved cells — every cron maps to at least one TC ID and one spec path.
- `npx playwright test --grep "@cron"` passes on the target test environment (qa-1, ttt-timemachine, or stage); each spec declares which env it runs on.
- `RoundcubeVerificationFixture` is used by ≥ 5 specs; `GraylogVerificationFixture` is used by ≥ 5 specs.
- `retrospective.md` lists ≥ 3 concrete pipeline improvements with repro notes and proposed changes to the generator skills.

## Stages

The work mirrors the three-phase pipeline from `docs/epic_task/epic-description.md`.

- **A. Knowledge consolidation** — audit vault cron notes, mine related tickets (#3083, #3262, #3303, #3345, #3346, #3337, #3417), update vault notes with any gaps found while scoping each cron.
- **B. Test-docs generation** — produce `test-plan.md`, `cron.xlsx`, and `coverage.md`.
- **C. Collection processing** — set `autotest.scope: "collection:cron"` in `expert-system/config.yaml`, run `process_collection.py`; existing qualifying specs receive the `@cron` tag.
- **D. Autotest generation** — scaffold `RoundcubeVerificationFixture` and `GraylogVerificationFixture` first (they are dependencies for most specs), then generate the missing specs, then re-process the collection so new specs are tagged.
- **E. Execution and fix** — run the suite with `autotest-runner`; diagnose failures with `autotest-fixer`. This is both the payload and the pipeline stress-test.
- **F. Retrospective** — capture the pipeline pain-points and concrete generator improvements in `retrospective.md`; open follow-up tickets where fixes are substantial.
