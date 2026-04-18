# Test Plan — Cron & Startup Jobs Testing Collection

**Ticket:** #3423
**Epic:** #3402
**Collection:** `cron` (XLSX at `test-docs/collections/cron/cron.xlsx`, sheet `COL-cron`)
**Generated:** 2026-04-17 (session 135 — vacation cluster landed)
**Status:** **ACTIVE** — vacation cluster populated; reports / cross-service / statistics / email clusters pending.

## 1. Overview

Curated test collection consolidating end-to-end regression tests for every scheduled job in TTT and its integrated services (Vacation, Calendar, Email). Scope covers **23 cron & startup jobs** across four backend services, with observability via DB, Roundcube (email), Graylog (logs), and cross-system writes to CS and PM Tool.

Canonical conventions for this ticket live in `expert-system/vault/exploration/tickets/t3423-investigation.md`. Knowledge base highlights: `expert-system/vault/external/EXT-cron-jobs.md`, `expert-system/vault/exploration/tickets/3262-ticket-findings.md`, `expert-system/vault/exploration/tickets/3083-ticket-findings.md`, `expert-system/vault/patterns/email-notification-triggers.md`.

**Authoring model.** `cron.xlsx` `COL-cron` is a **reference sheet** (columns: `test_id`, `source_module`, `source_suite`, `title`, `inclusion_reason`, `priority_override`). Actual test cases live in home-module workbooks (`vacation.xlsx`, `reports.xlsx`, `cross-service.xlsx`, `statistics.xlsx`, possibly `email.xlsx`) as new `TS-<Area>-Cron*` suites. Home-module IDs are used (e.g., `TC-VAC-101`), not a collection-local scheme.

## 2. Environment matrix

| Env              | Primary use                              | Test-clock | API token  | Roundcube subject prefix |
|------------------|------------------------------------------|:---:|:---:|--------------------------|
| qa-1             | Default target — most TCs run here       | ✅ | ✅ | `[QA1]` or `[QA1][TTT]` |
| ttt-timemachine  | Clock-sensitive jobs (11, 14-16, 18, 22) | ✅ | ✅ | `[TIMEMACHINE]` or `[TIMEMACHINE][TTT]` |
| stage            | Startup-only jobs (19, 21, 23-full)      | ✅ | ✅ | `[STAGE]` or `[STAGE][TTT]` |

Note: startup-only jobs are triggered by restarting the service via GitLab CI (`release/2.1` pipeline for qa-1 & ttt-timemachine; `stage` pipeline for stage). Feature toggles (`EMPLOYEE_PROJECT_INITIAL_SYNC`, `STATISTIC_REPORT_INITIAL_SYNC` in `ttt_vacation.java_migration`; `PM_TOOL_SYNC-{env}` in Unleash) gate re-execution.

## 3. Risk areas by cluster

| Cluster | Rows | Key risks |
|---|---|---|
| Notifications (ttt) | 1, 2, 3, 4, 5 | Template key drift (row 3); zero-markers (row 4); three-template fan-out (row 5); DEBOUNCE/SAFETY intervals gate email emission |
| Cleanup (ttt)       | 7             | DB-only; easy to assert |
| Email (email)       | 8, 9          | High-throughput dispatch (20s loop); retention prune every 30 days boundary |
| CS sync             | 6, 10, 20     | Marker collision between 6 & 20; Unleash toggle gating; RabbitMQ fan-out with 1-3 settle loops; full sync only at startup |
| Vacation time jobs  | 11, 14-17     | Clock manipulation; accruals silent failure (11); scheduler-wrapper bypass (15); no markers (17) |
| Employee-project    | 18, 19        | Data loss in sync window WON'T FIX; startup idempotency gated by feature-toggle |
| Statistic-report    | 21, 22        | INFO-level failure logging (22); Caffeine + DB cache invalidation; mid-month business rule deferred to #3356 |
| PM Tool             | 23            | Feature contract (11 fields); append-only presales merge; immutable accounting_name; startup-full vs partial behavior |
| Dead config         | 12, 13        | NOT_IMPLEMENTED — single no-op TC each confirms endpoint returns success |

## 4. Verification recipe (applied to every TC)

1. **SETUP** — seed minimal state via TTT / Vacation / Calendar Swagger API.
2. **Clock** — if time-sensitive, `ptch-using-ptch-11` or `reset-using-pst`.
3. **Trigger** — test endpoint for cron jobs; CI restart for startup-only (19, 21, 23-full).
4. **Wait** — respect async: email 20s dequeue; RabbitMQ fan-out = 1–3 settle loops.
5. **Verify** — DB (postgres MCP) ∪ UI (Playwright) ∪ Email (Roundcube) ∪ Log (Graylog), whichever channels apply per row.
6. **CLEANUP** — delete seeded data; reset clock if advanced.

**Policy:** Roundcube is **mandatory** for E-channel rows; Graylog is **mandatory** for rows with only server-side side-effects.

## 5. RabbitMQ fan-out expectations per cluster

Cron and startup jobs that mutate shared state emit events over RabbitMQ; downstream consumers in Vacation / Calendar / TTT services settle asynchronously. TCs that assert downstream effects must wait for fan-out to complete. Tune the wait with a **polling assertion** (preferred) or a bounded `sleep` only when polling is not viable.

| Cluster | Exchanges / topics | Typical settle window | Observable marker |
|---|---|---|---|
| CS sync (6, 10, 20) | `TTT_BACKEND_CS_TOPIC` → `employee-staff-changed` | 1–3 loops (~5–15 s) | `"CSSyncScheduler.doCsSynchronization finished"` per target service stream |
| Employee-project sync (18, 19) | direct DB upsert; no RabbitMQ consumer | 0 (synchronous within sync) | `"Employee Projects sync finished!"` |
| Statistic-report periodic (22) | direct DB upsert + `TTT_BACKEND_EMPLOYEE_TOPIC` `employee-month-norm-context-calculated` | 1–2 min (QA guidance #3345 note 894873) | `"statistic report sync done"` + row count stable |
| Statistic-report startup (21) | event-driven via `StatisticReportUpdateEventType.INITIAL_SYNC` | 1–3 loops | `STATISTIC_REPORT_INITIAL_SYNC` marker in `java_migration` |
| PM Tool sync (23) | `PM_TOOL_PROJECT_SYNC_TOPIC` → projects/presales/accounting | 1–3 loops (~10–30 s) | `"PmToolProjectSyncLauncher finished"` |
| Vacation digest (14) | uses `email` service RabbitMQ queue — downstream delivery is email batch (job 8) | 20 s dequeue + template render | `"sendEmails: sent N emails"` on `TTT-QA-1` |
| Vacation production-calendar reminder (15) | same as 14 — per-recipient mail dispatch | 20 s dequeue | `"Mail has been sent to {email} about NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST..."` |

**Polling predicate shape** (illustrative — each TC names the exact predicate):
```
for attempt in range(12):   # up to 60s
    if db_state_reached() or log_marker_emitted() or email_received():
        break
    sleep(5)
else:
    fail("fan-out did not settle within 60s")
```

## 6. Phase-A-discovered scope-table deltas (fold into TC preconditions)

| Location | Field | Scope table says | Actual (release/2.1) |
|---|---|---|---|
| Row 3 | Template key | `TASK_REPORT_CHANGED` | `REPORT_SHEET_CHANGED` |
| Row 4 | Log markers | Implied presence | **Zero** log markers; DB assertion via `reject.executor_notified` |
| Row 5 | Template key | Generic `BUDGET_*` | `BUDGET_NOTIFICATION_{EXCEEDED,NOT_REACHED,DATE_UPDATED}` |
| Row 14 | Endpoint path | `POST /api/vacation/v1/test/vacations/notify` | `POST /api/vacation/v1/test/digest` |
| Row 15 | Cron property | `production-calendar-first-notification.cron` | `production-calendar-annual-first.cron` |
| Row 15 | Log marker | Scheduler marker always present | Test endpoint bypasses scheduler — assert per-recipient mail-sent markers |
| Row 18 | Endpoint path | `POST /api/v1/test/employee-projects` | `POST /api/vacation/v1/test/employee-projects` |
| Row 20 | Endpoint path | `POST /api/calendar/v1/salary-offices/sync` | `POST /api/calendar/v2/test/salary-office/sync?fullSync={true|false}` |
| Row 22 | Failure log level | Implied ERROR | INFO (tests match by message pattern, not level) |
| Global | Full CS sync schedule | "Daily 00:00 full CS sync" | Startup-only; `companyStaff.full-sync` YAML key is **dead config** |

## 7. Entry criteria

- VPN active for logs.noveogroup.com, dev.noveogroup.com/mail, gitlab.noveogroup.com, ttt-{env}.noveogroup.com
- Roundcube IMAP credentials at `config/roundcube/envs/*.yaml`
- Graylog API token at `config/graylog/envs/secret.yaml`
- Test-clock permissions on target env (`reset-using-pst`, `ptch-using-ptch-11`)
- CS preprod UI access (shared Admin SSO) for CS-sync TC assertions
- PM Tool preprod UI access for PM Tool sync TC assertions
- GitLab CI permission on `ttt-spring` to trigger `restart-<env>` job (for 19, 21, 23-startup-full)

## 8. Exit criteria

- 23 / 23 scope rows have ≥ 1 TC in `COL-cron` (see `coverage.md`)
- `coverage.md` has no TBD cells — every cron maps to at least one TC ID and home-module workbook path
- All 10 Phase-A deltas reflected in TC preconditions (ticket-body scope-table rewrite is optional housekeeping)
- SQLite `test_case_tracking` populated with every TC ID

## 9. Progress by cluster

| Cluster | Scope rows | Home workbook | TCs landed | Status |
|---|---|---|---:|---|
| Vacation | 11, 12, 13, 14, 15, 16, 17, 18, 19, 21 | `vacation.xlsx` | 27 | ✅ Landed (session 135) |
| Reports | 1, 2, 3, 4, 5, 7 | `reports.xlsx` | 0 | ⬜ Pending (P1 session 136+) |
| Cross-service | 6, 10, 20, 23 | `cross-service.xlsx` | 0 | ⬜ Pending (P1 session 136+) |
| Email | 8, 9 | TBD (`reports.xlsx` or new `email.xlsx`) | 0 | ⬜ Pending (P1 session 136+) |
| Statistics | 22 | `statistics.xlsx` | 0 | ⬜ Pending (P1 session 136+) |

## 10. Open questions

- Email cluster home — extend `reports.xlsx` or create dedicated `email.xlsx`? (Defer decision until email cluster lands; probable choice: extend `reports.xlsx` since email dispatch is owned by notification flows already documented there.)
- Do rows 12, 13 (NOT_IMPLEMENTED) need more than a single no-op stub TC each? (Current recommendation: no — stubs live in `TS-Vac-Cron-NotImpl` under `vacation.xlsx`.)
- `graylog-access search` subcommand regression — resolved or do TCs fall back to `tail ... | grep` permanently? (Skill-maintenance item; workaround is canonical for now.)
- Row 10 (vacation-service CS sync) was authored under the cross-service cluster in session 135 scoping, but the home-module assignment per session-134 briefing is cross-service. Deferred to the cross-service session so both the TTT-side row 6 and vacation-side row 10 share a common setup + assertion skeleton in `cross-service.xlsx`.

---

*This plan evolves session-by-session. The cron.xlsx COL-cron sheet is the live index; every update to a home-module workbook should be mirrored by a COL-cron row and a coverage.md line.*
