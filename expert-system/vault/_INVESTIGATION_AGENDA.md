# Investigation Agenda

## Phase B — Test Documentation Generation for ticket #3423 (Cron & Startup Jobs Testing Collection)

**Scope (config.yaml):** `phase.scope: "3423"` → internal `t3423`, **collection-shaped** deliverables at `test-docs/collections/cron/` (NOT `test-docs/t3423/`). Canonical preamble: [[exploration/tickets/t3423-investigation]]. Read it once per session; don't rederive conventions.

**Phase C is gated off** (`autotest.enabled: false`). Do NOT scaffold fixtures, do NOT create autotest spec files, do NOT run `process_collection.py`. Stage D in the ticket body — later.

### Completed in sessions 135–137

<details><summary>Session 135 closed (2026-04-17) — vacation cluster landed</summary>

- ✅ `test-plan.md` flipped from SCAFFOLD to ACTIVE (full Phase B content, 10 sections, RabbitMQ fan-out table).
- ✅ **Vacation cluster TC generation** — 27 TCs (TC-VAC-101…127) across 8 `TS-Vac-Cron-*` suites in `test-docs/vacation/vacation.xlsx`.
- ✅ **`COL-cron` populated** with 27 rows referencing home-module IDs + suite names + priority_override.
- ✅ **`coverage.md` flipped to ACTIVE** — rows 11, 12, 13, 14, 15, 16, 17, 18, 19, 21 filled; cluster-progress table appended.
- ✅ **SQLite `test_case_tracking`** — 27 rows inserted with source_notes linking to vault paths.
- ✅ **Generator scripts** — `extend_vacation.py` + `populate_col_cron.py` idempotent and committed under `expert-system/generators/t3423/`.
- ✅ **5 of 8 scope-table deltas folded** — #4 (row 14 path), #5 (row 15 cron + scheduler bypass), #6 (row 18 path), #10 (full CS sync startup-only).

**Counters:** rows covered 0 → 10 (43%); TCs drafted 0 → 27.

</details>

<details><summary>Session 136 closed (2026-04-17) — reports cluster landed</summary>

- ✅ **Reports cluster TC generation** — 20 TCs (TC-RPT-101…120) across 2 suites in `test-docs/reports/reports.xlsx`:
  - `TS-Reports-CronNotifications` (15 TCs, rows 1/2/3/4/7)
  - `TS-Reports-BudgetNotifications` (5 TCs, row 5)
- ✅ **Three scope-table deltas folded** — #1 (row 3 template REPORT_SHEET_CHANGED), #2 (row 4 zero log markers → email-only verification), #3 (row 5 three templates).
- ✅ **GitLab regressions folded** — #3321 (TC-RPT-111), #685 (TC-RPT-112), #2289 (TC-RPT-113/114), #892 (TC-RPT-119).
- ✅ **`COL-cron` extended** — 27 → 47 rows, grouped by cron-row with comments.
- ✅ **`coverage.md` updated** — rows 1, 2, 3, 4, 5, 7 filled; total 16/23 rows, 47 TCs.
- ✅ **SQLite `test_case_tracking`** — 20 rows inserted (7 Critical / 8 High / 5 Medium; 11 Functional / 4 Idempotency / 3 Negative / 2 Regression).
- ✅ **Generator committed** — `expert-system/generators/t3423/extend_reports.py` (idempotent).

**Counters:** rows covered 10 → 16 (70%); TCs drafted 27 → 47; deltas folded 5 → 8.

</details>

<details><summary>Session 137 closed (2026-04-18) — cross-service cluster landed</summary>

- ✅ **Cross-service cluster TC generation** — 21 TCs (TC-CS-101…121) across 2 new suites in existing `test-docs/cross-service/cross-service.xlsx`:
  - `TS-CrossService-CronCSSync` (11 TCs, rows 6/10/20 plus shared marker-collision/ShedLock/parallel-execution/idempotency concerns).
  - `TS-CrossService-CronPMToolSync` (10 TCs, row 23 with full #3083 field contract).
- ✅ **Two scope-table deltas folded** — #7 (row 20 v2 endpoint) → TC-CS-106/107; #10 (startup-only full sync) → TC-CS-103 / TC-CS-121.
- ✅ **Design asymmetry captured** — TC-CS-104 locks in row 10's distinct `CS sync started/finished` marker (vs rows 6/20 `Company staff synchronization …`); TC-CS-105 guards WARN-level failure log.
- ✅ **Marker collision between rows 6↔20** — TC-CS-108 verifies Graylog `stream`-field disambiguation.
- ✅ **GitLab regressions folded** — #3083 PM Tool contract (TC-CS-112/113), #3382 presales append-only (TC-CS-114), #3286 accounting-name immutability (TC-CS-115), #3083 default-script silent populate (TC-CS-116), #3083 note 4 snavrockiy 2026-02-25 (TC-CS-118), #3399 startup listener (TC-CS-121).
- ✅ **`COL-cron` extended** — 47 → 68 rows, grouped by cron-row with comments.
- ✅ **`coverage.md` updated** — rows 6, 10, 20, 23 filled; total 20/23 rows, 68 TCs.
- ✅ **SQLite `test_case_tracking`** — 21 rows inserted (6 Critical / 12 High / 3 Medium; 8 Functional / 5 Regression / 4 Negative / 2 Idempotency / 2 Verification).
- ✅ **Generator committed** — `expert-system/generators/t3423/extend_crossservice.py` (idempotent; never touches pre-existing 8 suites or Plan Overview / Feature Matrix / Risk Assessment tabs).

**Counters:** rows covered 16 → 20 (87%); TCs drafted 47 → 68; deltas folded 8 → 10 (all folded).

</details>

### P0 — Immediate (Session 138 — last Phase B clusters)

- [ ] **Statistics cluster TCs — job 22.** Target: new `TS-Stat-CacheSync` suite in `test-docs/statistics/statistics.xlsx` (create workbook scaffold if absent). Use the 5 bug-regression seed TCs from [[exploration/tickets/3262-ticket-findings]]. **Delta #8 folding**: INFO-level failure log (not ERROR) must appear in assertion predicate. Dependencies: [[investigations/statistics-caffeine-caching-performance-3337]] (Caffeine cache invalidation), async contract. Target suite count: 1 new suite, ~6-8 TCs. Update `COL-cron` and `coverage.md` as rows land. Script: `expert-system/generators/t3423/extend_statistics.py`.
- [ ] **Email cluster TCs — jobs 8, 9.** Decide first: extend `reports.xlsx` OR create new `test-docs/email/email.xlsx`. Session 137 proved separate cron suites can coexist in a workbook (cross-service approach) — consider creating `email.xlsx` if the email module is logically separable. Job 8 (dispatch batch, every 20 s): `TS-Email-Dispatch` (~8-10 TCs) — batching, concurrent dispatch, quarantine path, failure retry. Job 9 (retention prune, daily 00:00 >30 days): `TS-Email-Prune` (~4-5 TCs) — date-window filter, idempotency, hard-delete verification. Target: 2 suites, ~10-15 TCs. Script: `expert-system/generators/t3423/extend_email.py`.

### P1 — After session 138 (Phase B closure)

- [ ] **Phase B readiness report** — log to `_SESSION_BRIEFING.md` with total TC count, suites covered, tickets mined, vault notes enriched. Expected terminal state: 23/23 rows covered, ~85 TCs drafted, 10/10 deltas folded.
- [ ] **`config.yaml` check** — `autotest.enabled` remains `false` per ticket scope requirement (no Phase C for t3423). If `auto_phase_transition: true`, Phase B closes without entering Phase C.

### P2 — Lower Priority (late Phase B)

- [ ] **`coverage.md` final pass** — run when all 23 rows have ≥ 1 TC in COL-cron (after session 138). Verify no TBD cells, every channel marker correct.
- [ ] **Apply scope-table corrections** to `docs/tasks/cron/cron-testing-task.md` (optional housekeeping). All 10 deltas folded into TC preconditions (s135 #4/#5/#6/#10; s136 #1/#2/#3; s137 #7/#10) — the ticket-body update is cosmetic.
- [ ] **Resolve `graylog-access search` subcommand regression** — inspect `.claude/skills/graylog-access/scripts/graylog_api.py`. Workaround `tail --stream <env> -n 500 | grep` remains canonical; fix is skill-maintenance, not Phase-B blocker.
- [ ] **Feature-toggle precondition template.** Build a reusable snippet for Phase B TCs that need `ttt_vacation.java_migration` or Unleash toggle state set as precondition. Jobs 19, 21 (java_migration — done this session), jobs 6, 20, 23 (Unleash) all need it; consolidate the pattern for future reuse.
- [ ] **RabbitMQ fan-out preconditions.** For TCs whose assertion depends on downstream consumers, document the settle-loop expectation (1-3 loops). Most impactful for jobs 6, 10, 20 (CS sync fan-out) and job 23 (PM Tool sync).

### Completed in Phase A (sessions 129 – 134)

<details><summary>Phase A backlog (collapsed — see [[exploration/tickets/t3423-investigation]] audit logs and [[_KNOWLEDGE_COVERAGE]] for full detail)</summary>

- ✅ **Session 134 — A→B transition executed.** Config flipped; vault control files reset; generator scaffolded at `expert-system/generators/t3423/generate.py`. Row 22 cron time verified as 04:00 NSK (non-delta).
- ✅ **Session 133 — bulk P1 ticket mining.** #3178, #3262, #3303, #3337, #3345, #3346 (jobs 18/19/21/22). Created [[exploration/tickets/3262-ticket-findings]] with 18 seed TCs + 8 catalogued bugs + 3 design issues.
- ✅ **Session 132 — deep-dive rows 3, 4, 5, 8, 15.** Template-key mismatch (row 3), zero-markers (row 4), three-template fan-out (row 5), endpoint gap closed (row 8), scheduler-wrapper bypass (row 15). 5 fresh scope-table deltas.
- ✅ **Session 131 — code-verification batch 2.** Rows 6, 9, 20, 22, 23. Full startup-listener wiring. Marker collision between 6/20 documented. Unleash toggle inventory. #3083 ticket mining (PM Tool sync) + [[exploration/tickets/3083-ticket-findings]] with 8 seed TCs.
- ✅ **Session 130 — vacation-service batch 1.** Rows 10-11, 14-19, 21 markers. Startup-wiring for 19 & 21. Rows 12 & 13 confirmed DEAD CONFIG. Roundcube env-prefix grounded (`[QA1][TTT]`).
- ✅ **Session 129 — orientation.** Ticket body read, test endpoints for jobs 1-5, 7 confirmed; ttt-service markers code-verified; timing constants extracted (DEBOUNCE_INTERVAL_MINUTES=5, SAFETY_INTERVAL_SECONDS=10); job 8 live-verified via Graylog tail.

</details>

### Deliverables tracking (Phase B)

| Artifact | Path | Status | Session |
|---|---|---|---|
| `test-plan.md` | `test-docs/collections/cron/test-plan.md` | ✅ ACTIVE (full Phase B content) | 135 |
| `cron.xlsx` | `test-docs/collections/cron/cron.xlsx` | ✅ ACTIVE (68 `COL-cron` rows) | 137 |
| `coverage.md` | `test-docs/collections/cron/coverage.md` | ✅ ACTIVE (20/23 rows filled) | 137 |
| Generator | `expert-system/generators/t3423/generate.py` | ✅ Scaffolded | 134 |
| Generator | `expert-system/generators/t3423/extend_vacation.py` | ✅ Idempotent vacation extender | 135 |
| Generator | `expert-system/generators/t3423/extend_reports.py` | ✅ Idempotent reports extender | 136 |
| Generator | `expert-system/generators/t3423/extend_crossservice.py` | ✅ Idempotent cross-service extender | 137 |
| Generator | `expert-system/generators/t3423/populate_col_cron.py` | ✅ Idempotent COL-cron writer | 135/136/137 |
| Vacation cluster TCs | `test-docs/vacation/vacation.xlsx` (extend) | ✅ 8 suites, 27 TCs | 135 |
| Reports cluster TCs | `test-docs/reports/reports.xlsx` (extend) | ✅ 2 suites, 20 TCs | 136 |
| Cross-service cluster TCs | `test-docs/cross-service/cross-service.xlsx` (extend) | ✅ 2 suites, 21 TCs | 137 |
| Email cluster TCs | TBD (reports.xlsx or email.xlsx) | ⬜ | — |
| Statistics cluster TCs | `test-docs/statistics/statistics.xlsx` (extend) | ⬜ | — |
| NOT_IMPLEMENTED stubs | `test-docs/vacation/vacation.xlsx` (extend) | ✅ TC-VAC-104/105 | 135 |
