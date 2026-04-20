# Ticket #3423 — Phase A + B Execution Report

**Ticket:** [#3423 — Cron & Startup Jobs Testing Collection](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3423)
**Epic (flat `relates_to` link):** #3402
**Scope in the expert-system runner:** `t3423` (ticket-scoped Phase A+B; Phase C gated off via `autotest.enabled: false`)
**Date range:** 2026-04-17 → 2026-04-18
**Branch:** `dev40`
**Sessions run:** 9 (runner sessions 129–137)
**Total spend:** **$91.74** (avg $10.19/session; max $18.38 at session 131)
**Final state:** Phase B **COMPLETE** — 23/23 cron-table rows covered · 87 TCs · 14 suites · 5 per-domain workbooks under `test-docs/collections/cron/` · 10/10 scope-table deltas folded · 12 GitLab regression tickets mined and captured as TC preconditions.

> **Session numbering.** The runner's session files are `session-129-*.json` through `session-137-*.json`. The agent's own close-message narration ran one number ahead from session 131 onward — e.g. the file `session-131-*.json` contains the text "Session 132 formally closed". This report uses the **runner's** numbers (129–137) as the authoritative axis because that is what matches the log files, git metadata, and `_SESSION_BRIEFING.md` timestamps. Cross-referencing commit messages / briefing text that use the narrative offset is still unambiguous — the A+B arc only spans 9 sessions in total.

---

## 1. Timeline

| Runner # | Narrative # | Phase | Started (UTC)       | Duration | Turns | Cost     | Primary outcome                                                                     |
|---------:|------------:|-------|---------------------|---------:|------:|---------:|-------------------------------------------------------------------------------------|
| 129      | 129         | A     | 2026-04-17 08:39 | 13m 12s  |    88 |  $7.16   | ttt-service code verification (jobs 1–5, 7); Graylog live-tail of job 8           |
| 130      | 130         | A     | 2026-04-17 10:02 | 18m 00s  |    96 |  $8.66   | Vacation-service code verification (10, 11, 14–19, 21); Roundcube 800-email sample |
| 131      | 132         | A     | 2026-04-17 19:00 | 43m 00s  |   207 | $18.38   | Remaining scheduler classes (6, 9, 20, 22, 23) + startup wiring; A→B readiness     |
| 132      | 133         | A     | 2026-04-17 20:28 | 13m 12s  |    80 |  $7.97   | GitLab ticket mining: #3178, #3262, #3303, #3337, #3345, #3346 (row 18/19/21/22)   |
| 133      | 134         | A→B   | 2026-04-17 21:26 | 12m 18s  |    40 |  $5.22   | Phase B scaffolds generated (cron.xlsx, test-plan.md, coverage.md); A→B transition |
| 134      | 135         | B     | 2026-04-17 22:24 | 19m 21s  |    58 |  $8.38   | Vacation cluster landed: 27 TCs, 8 suites                                           |
| 135      | 136         | B     | 2026-04-17 23:28 | 21m 08s  |   103 | $10.94   | Reports cluster: 20 TCs, 2 suites                                                   |
| 136      | 137         | B     | 2026-04-18 00:34 | 23m 37s  |    92 | $11.14   | Cross-service cluster: 21 TCs, 2 suites (commit `52d16df`)                          |
| 137      | 138         | B     | 2026-04-18 01:43 | 28m 39s  |   124 | $13.89   | Statistics + Email clusters: 19 TCs, 3 suites; **Phase B COMPLETE**                 |
| **Total**|             |       |                     | **3h 12m** | **888** | **$91.74** | **9 sessions · 23/23 rows · 87 TCs · 14 suites**                                    |

Runner halted cleanly at 2026-04-18 02:12 UTC with `autonomy.stop: true` (flipped by session 137's own close recommendation after Phase B completed).

---

## 2. Phase A — Knowledge consolidation (sessions 129–133)

### Session 129 — ttt-service code verification

- **Test endpoints confirmed** via repo read at `expert-system/repos/project/ttt/rest/.../test/`: jobs 1–4 on `TestTaskReportController` (`@RequestMapping("/v1/test/reports")`, `@Profile("!production")`, `void` return, no body); job 5 on `TestBudgetController`; job 7 `/cleanup-extended` on the reports controller.
- **Graylog markers** code-verified from `service-impl/.../periodic/**` for jobs 1, 2, 3, 4, 5, 7; live-tail of **job 8 EmailSendScheduler** confirmed on `TTT-QA-1` (logger `com.noveogroup.ttt.email.service.batch.EmailSendScheduler` emits `"sendEmails: started"` / `"sendEmails: finished, sent {n} emails"` every 20s).
- **Critical timing constants** captured: `RejectNotificationServiceImpl.DEBOUNCE_INTERVAL_MINUTES = 5` (job 4); `BudgetServiceImpl.SAFETY_INTERVAL_SECONDS = 10` (job 5); template keys (`FORGOTTEN_REPORT` for jobs 1 & 2; `APPROVE_REJECT` for job 4).
- **Scope-table row 4 correction** discovered: cron is `0 */5 * * * *` (every 5 min), not "every 10 min" as the original task body stated. Captured as delta; ticket body corrected in subsequent commit.
- **Graylog `search` CLI regression** documented with `tail` + grep workaround.
- **GitLab project ID** pinned — `1288` (`ttt-spring`), not the `172` that appears in some older docs.

### Session 130 — Vacation-service code verification + Roundcube grounding

- **Vacation-service cron cluster** code-verified for jobs 10, 11, 14, 15, 16, 18, 19, 21 via repo read of `expert-system/repos/project/vacation/service/service-impl/**/periodic/**` (monorepo layout: `project/vacation/`, not `project/ttt-vacation/`).
- **Three new scope-table deltas** discovered:
  - **Rows 12 & 13 NOT_IMPLEMENTED** — `preliminary-outdated.cron` and `close-outdated.cron` are declared in `application.yml` but no Java code references them. Phantom jobs.
  - **Row 14 path mismatch** — actual endpoint is `POST /api/vacation/v1/test/digest` on `TestDigestController`, not `/vacations/notify`.
  - **Row 18 path mismatch** — actual is `POST /api/vacation/v1/test/employee-projects` (missing `/vacation` prefix in scope table).
- **Row 15 text quirk** — `AnnualProductionCalendarTask.runFirst` emits `"Starting AnnualProductionCalendarTask for 1st october..."` but @Scheduled `"0 1 0 1 11 ?"` fires Nov 1. Legacy message text; still a valid Graylog filter.
- **Job 17 log-blind** — `VacationStatusUpdateJob` has no @SchedulerLock and no log markers at either @Scheduled method. DB-only assertion (`vacation.status` transition `APPROVED → PAID`) is the only reliable verification.
- **Startup wiring (jobs 19, 21)** confirmed via `VacationStartupApplicationListener`: `@Async @EventListener onApplicationEvent(ContextRefreshedEvent)` runs `csSyncLauncher.sync(true)` → `employeeProjectSyncLauncher.executeInitialSync()` (job 19) → `statisticReportSyncService.executeInitialSync()` (job 21). Both guarded by `migrationExecutor.executeOnce(<FEATURE_TOGGLE>, ...)` against `ttt_vacation.java_migration` — a CI `restart-<env>` is the only externally-triggerable mechanism and re-execution requires DB row deletion.
- **Roundcube subject grounding** — 800-email sample across DEV/PREPROD/QA1/QA2/STAGE/TIMEMACHINE. Prefix drift discovered: standard ttt emails use `[<ENV>][TTT]` (Latin, bracketed) vs. the vacation digest anomaly `[<ENV>]ТТТ` (**Cyrillic `ТТТ`, no brackets**). Per-template subject table added to `expert-system/vault/patterns/email-notification-triggers.md`. FORGOTTEN_REPORT subjects for job 1 and job 2 are **identical** — distinguishable only by Graylog marker correlation.
- Scheduled maintenance (§9.4, session 130 = multiple of 5): SQLite health audit + vault cross-ref audit — all clean.

### Session 131 — Remaining scheduler classes + startup listeners

- Read all 5 remaining scheduler source files on `release/2.1` (jobs 6, 9, 20, 22, 23).
- Read both startup listeners (`TttStartupApplicationListener`, `CalendarStartupApplicationListener`) and `PmToolEntitySyncLauncher`.
- Confirmed **marker collision**: jobs 6 (ttt) and 20 (calendar) both emit `"Company staff synchronization started/finished"` and share ShedLock name `CSSyncScheduler.doCsSynchronization`. Graylog stream + per-schema `shedlock` tables are the disambiguation path.
- Confirmed **dead YAML config** for `companyStaff.full-sync` — no @Scheduled annotation references the key (supersedes the scope table's earlier "daily 00:00 full CS sync" wording → delta #10).
- Unleash feature-toggle gates catalogued: `CS_SYNC-{env}` (jobs 6, 20) and `PM_TOOL_SYNC-{env}` (job 23); launcher returns `null` silently when disabled.
- **A→B readiness assessment** recorded: endpoints 23/23, markers 21/23, live-verified 6/23, Roundcube 3/23 + digest.

### Session 132 — GitLab ticket mining (final P1 Phase A item)

- Mined 6 connected GitLab tickets for jobs 18, 19, 21, 22: **#3178, #3262, #3303, #3337, #3345, #3346**.
- Synthesised the **two-table cache-sync architectural pattern**: `employee_projects` → jobs 18/19; `statistic_report` → jobs 21/22.
- Authored `expert-system/vault/exploration/tickets/3262-ticket-findings.md` with 8 catalogued bugs, 18 seed TCs, 3 design issues, full cross-references.
- Wrote `analysis_runs` / `external_refs` / `design_issues` / `exploration_findings` rows to SQLite.
- Updated `t3423-investigation.md`, `_SESSION_BRIEFING.md`, `_INVESTIGATION_AGENDA.md`, `_KNOWLEDGE_COVERAGE.md` control files.

### Session 133 — Phase B scaffolds + A→B transition

- Generated the three Phase B deliverables at `test-docs/collections/cron/`:
  - `test-plan.md` (Phase B plan — environment matrix, risk areas by cluster, verification recipe + policy)
  - `cron.xlsx` (Plan Overview sheet + COL-cron reference sheet, scaffolded empty)
  - `coverage.md` (23-row traceability matrix, all cells TBD)
- Committed the A→B transition to SQLite; session 134 picks up the P0: populate COL-cron and land cluster TCs.
- The runner read `coverage_override: -1` and `auto_phase_transition: true` from `config.yaml` and flipped `phase.current` from `knowledge_acquisition` to `generation`.

---

## 3. Phase B — Test-doc generation (sessions 134–137)

| Session | Cluster          | Rows covered                              | New suites                                                             | TCs | Key deltas / tickets folded                                                    |
|---------|------------------|-------------------------------------------|------------------------------------------------------------------------|----:|--------------------------------------------------------------------------------|
| 134     | Vacation         | 11, 12, 13, 14, 15, 16, 17, 18, 19, 21    | 8 × `TS-Vac-Cron-*`                                                    | 27  | Deltas #2-ish on rows 14, 17, 19; seed TCs from #3262 / #3303 consumed         |
| 135     | Reports          | 1, 2, 3, 4, 5, 7                          | `TS-Reports-CronNotifications`, `TS-Reports-BudgetNotifications`       | 20  | Delta #1 (REPORT_SHEET_CHANGED), #2 (row 4 zero markers), #3 (row 5 three templates); regressions #3321, #685, #2289, #892 folded |
| 136     | Cross-service    | 6, 10, 20, 23                             | `TS-CrossService-CronCSSync`, `TS-CrossService-CronPMToolSync`         | 21  | Delta #7 (row 20 v2 endpoint), #10 (full-sync dead YAML); regressions #3083, #3286, #3382, #3399 folded |
| 137     | Statistics + Email | 22 (stats); 8, 9 (email)                | `TS-Stat-CronStatReportSync`, `TS-Email-CronDispatch`, `TS-Email-CronPrune` | 19  | Delta #8 (INFO-level failure log); regressions #3345 (bugs 1+2), #3337, #3346, DI-EMAIL-DISPATCH-AUTH folded |
| **Total** |                 | **23 / 23**                               | **14 suites**                                                           | **87** | **10 / 10 deltas · 12 tickets**                                               |

Each cluster landed under its own idempotent generator script (`expert-system/generators/t3423/extend_*.py` at the time; renamed on 2026-04-20 to `generate_cron_*.py` as part of the per-domain workbook migration — see §9). The single-session commit cadence was broken only for sessions 134/135/137 (internally committed then squashed during the session-137 close), hence the final repo state is captured by commit `52d16df` (cross-service) plus the dirty tree that became commit `a35901c "cron: phases A, B finished"`.

---

## 4. Scope-table deltas folded (10 / 10)

| # | Row(s) | Delta                                                                                       | Resolution                                                                                   | Landed |
|---|--------|---------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|--------|
| 1 | 3      | Template key is `REPORT_SHEET_CHANGED`, not `TASK_REPORT_CHANGED`                           | TC-RPT-106/107 preconditions assert the correct template key                                 | s135   |
| 2 | 4      | Zero log markers — email-only verification; `DEBOUNCE_INTERVAL_MINUTES=5`                   | TC-RPT-109/110 use Roundcube assertion + debounce timing; no Graylog marker step             | s135   |
| 3 | 5      | Three budget templates (EXCEEDED / NOT_REACHED / DATE_UPDATED); `SAFETY_INTERVAL_SECONDS=10`| TC-RPT-116/117/118/119 cover all three templates + safety interval                           | s135   |
| 4 | 4      | Schedule is `0 */5 * * * *` (every 5 min), not "every 10 min"                                | Ticket-body table + vault scope table corrected in session 129 close                         | s129 A |
| 5 | 15     | Marker text says "1st october" but cron fires Nov 1                                          | TC-VAC-110 uses the legacy marker string as the Graylog filter; expected-result notes the cron actually fires Nov 1 | s134   |
| 6 | 17     | No @SchedulerLock, no log markers                                                             | TC-VAC-115/116/117 rely on DB assertion only (`vacation.status` transition)                   | s134   |
| 7 | 20     | Endpoint is v2: `POST /api/calendar/v2/test/salary-office/sync?fullSync={bool}`              | TC-CS-106/107 use v2 endpoint in preconditions                                               | s136   |
| 8 | 22     | Failure logged at INFO (`level:6`), NOT ERROR (`level:3`)                                    | TC-STAT-078 is an explicit regression guard for the log-level drift                          | s137   |
| 9 | 12, 13 | Dead YAML config — no Java reference                                                         | TC-VAC-104/105 NOT_IMPLEMENTED probes (single no-op TC each)                                 | s134   |
| 10| 6, 20  | `companyStaff.full-sync` cron is dead YAML; full sync runs only at application startup       | TC-CS-103 covers startup-only full sync; partial-sync TCs for rows 6 / 20 drop the "daily 00:00" claim | s136   |

---

## 5. Tickets mined & folded

| Ticket | Area                                              | Folded into                                                    |
|--------|---------------------------------------------------|----------------------------------------------------------------|
| #3083  | PM Tool sync — 11-field contract                  | TC-CS-112, 113, 114, 115, 116, 117, 118, 119 (row 23)          |
| #3286  | PM Tool — accounting_name immutability            | TC-CS-115                                                       |
| #3382  | PM Tool — presales APPEND-ONLY merge              | TC-CS-114                                                       |
| #3399  | PM Tool — startup full sync via listener          | TC-CS-121                                                       |
| #3345  | Statistic-report sync bugs #1 (pre-hire / post-leave) and #2 (day-off fan-out) | TC-STAT-079, 080            |
| #3337  | Sick-leave → statistic_report cache invalidation; scoped delete | TC-STAT-081, 082                                |
| #3346  | Scheduler-wiring fix (bug #895498)                | TC-STAT-083                                                     |
| #3321  | Closed report month + open confirmation period reject-notify | TC-RPT-111                                          |
| #685   | officeId=9 excluded from FORGOTTEN_REPORT         | TC-RPT-112                                                      |
| #2289  | EXTENDED_PERIOD_REPORT must not reach accountants | TC-RPT-113, 114                                                 |
| #892   | Budget templates regression (all three paths)     | TC-RPT-116, 117, 118, 119                                       |
| #895498| Bug label — periodic stat-report cron not firing  | TC-STAT-083 (same fix as #3346)                                 |

Additional read-but-not-directly-folded: #3178, #3262, #3303 (seed TCs already consumed in the vacation and cross-service clusters); #3417 (integrations groundwork — Roundcube + Graylog + CS + PM Tool; preambles this whole ticket).

---

## 6. Vault enrichments

Notes created or materially extended during the run:

| Note                                                                                | Change                                                                                           |
|-------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `exploration/tickets/t3423-investigation.md`                                        | Session preamble; audit log with one dated block per session; scope-table deltas + corrections   |
| `external/EXT-cron-jobs.md`                                                         | Session 130–132: vacation-service markers + startup wiring + scope-table deltas; session 131: remaining scheduler classes + Unleash toggles + marker collision |
| `patterns/email-notification-triggers.md`                                           | "Ticket-3423 subject predicates" section with live-sampled per-template subject lines; prefix drift (Latin `[TTT]` vs Cyrillic `ТТТ`) documented |
| `exploration/api-findings/cron-job-live-verification.md`                            | Job 8 live-tail evidence; Graylog `search` CLI regression note                                    |
| `exploration/tickets/3083-ticket-findings.md`                                       | Created in session 132 — PM Tool sync contract + 6 catalogued bugs + seed TCs                    |
| `exploration/tickets/3262-ticket-findings.md`                                       | Created in session 132 — employee-project + statistic-report cache-sync pattern; 8 bugs + 18 seed TCs |
| `exploration/tickets/3345-ticket-findings.md`                                       | Bugs 1 + 2 captured; MR !5101 fix reference                                                      |
| `exploration/tickets/3346-ticket-findings.md`                                       | Scheduler-wiring fix (bug #895498) captured                                                      |
| `investigations/statistics-caffeine-caching-performance-3337.md`                    | Caffeine L1 + statistic_report L2 cache architecture; scoped-delete regression                   |
| `modules/email-notification-deep-dive.md`                                           | §4 Batch dispatcher + retention + 2 design issues (DI-EMAIL-DISPATCH-AUTH, -RETRY)                |
| `_INVESTIGATION_AGENDA.md`, `_KNOWLEDGE_COVERAGE.md`, `_SESSION_BRIEFING.md`, `_INDEX.md` | Control files rewritten at every session close                                              |

---

## 7. SQLite analytics summary (sessions 129–137)

Scoped by `run_date >= '2026-04-17'` and equivalent filters:

| Table                 | Rows written during A+B | Notes                                                       |
|-----------------------|------------------------:|-------------------------------------------------------------|
| `analysis_runs`       | 7                       | One per major investigation theme; tools include `code-inspection`, `code+graylog+roundcube`, `gitlab-ticket-mining`, `phase-transition`, `phase_b_generation` |
| `exploration_findings`| 18                      | Mostly Phase A — endpoint contracts, marker text, prefix drift, CLI regressions |
| `design_issues`       | 15                      | Job 17 no-markers, Job 11 silent-failure, DI-EMAIL-DISPATCH-AUTH infinite loop, INFO-level failure log, etc. |
| `test_case_tracking`  | 87                      | One row per cron-collection TC; status `drafted`; xlsx_file now points at the per-domain workbook (post-migration) |

---

## 8. Open carry-overs (P1, non-blocking)

1. **Stage F retrospective** — author `docs/tasks/cron/retrospective.md` after the full A→F pipeline closes. The execution report (this file) captures *what happened*; the retrospective captures *what we learned* and proposes concrete fixes to `autotest-generator`, `collection-generator`, `xlsx-parser`, and `autotest-fixer`.
2. **Ticket #3423 body path corrections** — scope-table rows 14 and 18 still carry the pre-delta paths on GitLab. TCs already use the correct paths inline, so this is cosmetic housekeeping (P2).
3. **`graylog-access search` CLI regression** — returns `TOTAL=None` / `'str' object has no attribute 'get'` for queries containing `:` and `"`. Workaround via `tail` + grep. Investigation needed on `.claude/skills/graylog-access/graylog_api.py`.
4. **Feature-toggle precondition snippet** — the `EMPLOYEE_PROJECT_INITIAL_SYNC` / `STATISTIC_REPORT_INITIAL_SYNC` / `PM_TOOL_SYNC` precondition pattern was applied ad-hoc across multiple TCs. Consolidating into a reusable XLSX snippet (and, later, a Playwright fixture helper) would speed up Phase D.
5. **Cross-system prefix drift** (Roundcube) — `[<ENV>][TTT]` Latin vs `[<ENV>]ТТТ` Cyrillic for vacation digest — Phase C's `RoundcubeVerificationFixture` must handle both.

---

## 9. Post-run consolidation (2026-04-20)

Subsequent to Phase B close, the cron collection was reorganised:

- Cron suites **extracted** from home workbooks (`vacation.xlsx`, `reports.xlsx`, `cross-service.xlsx`, `statistics.xlsx`) into dedicated per-domain workbooks under `test-docs/collections/cron/`:
  `Cron_Vacation.xlsx` (27 TCs · 8 suites), `Cron_Reports.xlsx` (20 · 2), `Cron_CrossService.xlsx` (21 · 2), `Cron_Statistics.xlsx` (8 · 1), `Cron_Email.xlsx` (11 · 2 + lifted meta sheets).
- `test-docs/email/` directory deleted (all content was cron-specific; moved into `Cron_Email.xlsx`).
- Generators renamed and retargeted: `extend_<domain>.py` → `generate_cron_<domain>.py`; now emit into the new per-domain workbooks from scratch.
- `COL-cron` sheet gained a `source_workbook` column; `coverage.md` + `test-plan.md` updated with new paths + File layout section.
- Migration performed by `expert-system/generators/t3423/migrate_to_cron_workbooks.py` (one-shot).

Post-consolidation, `test-docs/collections/cron/` is the single home of truth for every cron TC in the collection.

---

## 10. Artefacts inventory

### Task + report docs
- `docs/tasks/cron/cron-testing-task.md` — ticket body (mirrors GitLab #3423 description)
- `docs/tasks/cron/execution-phases-a-b.md` — this file
- *(later)* `docs/tasks/cron/retrospective.md` — Stage F deliverable

### Curated collection (canonical home for all cron TCs)
- `test-docs/collections/cron/cron.xlsx` — Plan Overview + COL-cron reference sheet (87 rows · `test_id`, `source_module`, `source_workbook`, `source_suite`, `title`, `inclusion_reason`, `priority_override`)
- `test-docs/collections/cron/test-plan.md` — human-readable plan (env matrix, risks by cluster, verification recipe + policy, file layout)
- `test-docs/collections/cron/coverage.md` — 23-row traceability matrix (cron job → TC IDs → spec path)
- `test-docs/collections/cron/Cron_Vacation.xlsx` — 9 sheets · 27 TCs (rows 11–19, 21)
- `test-docs/collections/cron/Cron_Reports.xlsx` — 3 sheets · 20 TCs (rows 1–5, 7)
- `test-docs/collections/cron/Cron_CrossService.xlsx` — 3 sheets · 21 TCs (rows 6, 10, 20, 23)
- `test-docs/collections/cron/Cron_Statistics.xlsx` — 2 sheets · 8 TCs (row 22)
- `test-docs/collections/cron/Cron_Email.xlsx` — 5 sheets · 11 TCs (rows 8, 9)

### Generators
- `expert-system/generators/t3423/_common.py` — shared `author_plan_overview` helper
- `expert-system/generators/t3423/generate.py` — scaffolder (cron.xlsx shell + test-plan.md + coverage.md)
- `expert-system/generators/t3423/generate_cron_vacation.py` · `generate_cron_reports.py` · `generate_cron_crossservice.py` · `generate_cron_statistics.py` · `generate_cron_email.py` — per-domain cron workbook generators (idempotent, content-stable across consecutive runs)
- `expert-system/generators/t3423/populate_col_cron.py` — populates COL-cron sheet with 87 rows + `source_workbook` column
- `expert-system/generators/t3423/migrate_to_cron_workbooks.py` — one-shot 2026-04-20 migration (extract cron suites + delete test-docs/email/)

### Vault notes (see §6 above for the full enrichment list)

### Git commits (branch `dev40`)
- `52d16df` — session 137 close: cross-service cluster landed (20/23 rows)
- `a35901c` — cron: phases A, B finished (final state of A+B as committed)
- `3683093` — cron collection: extract suites into per-domain Cron_<Domain>.xlsx (2026-04-20 consolidation; migration + generator retarget)

### Runner artefacts
- `expert-system/logs/session-129-*.json` through `session-137-*.json` — 9 session close summaries
- `expert-system/logs/runner.log` — timeline + commit hashes
- `expert-system/logs/runner-state.json` — cumulative state (cost, duration, turn count per session)
- `expert-system/analytics.db` — see §7 for row counts

---

## 11. Cost breakdown

| Axis             | Phase A (s129–133) | Phase B (s134–137) | Total            |
|------------------|---------------------:|--------------------:|-----------------:|
| Sessions         | 5                    | 4                   | 9                |
| Wall time        | 1h 39m               | 1h 33m              | 3h 12m           |
| Turns            | 511                  | 377                 | 888              |
| Cost (USD)       | $47.39               | $44.35              | $91.74           |
| Cost per session | $9.48                | $11.09              | $10.19 (avg)     |
| Cost per TC      | —                    | **$0.51 / TC**      | $1.05 / TC (A+B) |

Phase B's cost-per-TC is the more actionable metric for future collection work: **~$0.50 per generated test case** at `full` autonomy + `opus` / `effort: max`, including ticket mining, delta folding, vault write-backs, and SQLite bookkeeping per session.
