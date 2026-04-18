# Investigation Agenda

## Phase B — Test Documentation Generation for ticket #3423 (Cron & Startup Jobs Testing Collection)

**Status:** **COMPLETE** — all 23 cron rows have TC coverage (87 drafted TCs across 5 home workbooks). Phase C is gated off (`autotest.enabled: false`). Recommendation: set `autonomy.stop: true` in `config.yaml` unless a different ticket is being picked up.

**Scope (config.yaml):** `phase.scope: "3423"` → internal `t3423`, **collection-shaped** deliverables at `test-docs/collections/cron/` (NOT `test-docs/t3423/`). Canonical preamble: [[exploration/tickets/t3423-investigation]].

### P0 — Immediate (none — Phase B complete for t3423)

*All P0 work for ticket #3423 is done. Pick up from P1/P2 below, or set `autonomy.stop: true`.*

### P1 — Phase B closure housekeeping

- [ ] **Stage F retrospective** — author `docs/tasks/cron/retrospective.md` covering Phase A (sessions 129–134) + Phase B (sessions 135–138). Capture: methodology, ticket mining yield, delta folding process, cross-suite patterns (shared cron-suite tab color, home-module TC ID convention, collection-shaped output layout).
- [ ] **`config.yaml` decision** — `autotest.enabled` remains `false` per ticket scope requirement (no Phase C for t3423). Human operator decides whether to set `autonomy.stop: true` or switch scope to a different ticket/module.

### P2 — Lower Priority (technical debt / quality-of-life)

- [ ] **Apply scope-table corrections** to `docs/tasks/cron/cron-testing-task.md` (optional housekeeping). All 10 deltas folded into TC preconditions — ticket-body update is cosmetic.
- [ ] **Resolve `graylog-access search` subcommand regression** — inspect `.claude/skills/graylog-access/scripts/graylog_api.py`. Workaround `tail --stream <env> -n 500 | grep` remains canonical.
- [ ] **Feature-toggle precondition template.** Build a reusable snippet for Phase B TCs that need `ttt_vacation.java_migration` or Unleash toggle state set as precondition. Pattern applied ad-hoc across cron TCs — consolidation is P2.
- [ ] **RabbitMQ fan-out preconditions.** For TCs whose assertion depends on downstream consumers, document the settle-loop expectation (1-3 loops). Already applied in TC-STAT-080/081 + TC-CS-* patterns — a documented template would speed future reuse.

### Completed in sessions 135 – 138

<details><summary>Session 138 closed (2026-04-18) — statistics + email clusters landed, Phase B complete</summary>

- ✅ **Statistics cluster TC generation** — 8 TCs (TC-STAT-077…084) in new suite `TS-Stat-CronStatReportSync` in `test-docs/statistics/statistics.xlsx`. Delta #8 (INFO-level failure log) folded as TC-STAT-078. #3345 Bugs 1+2 (TC-STAT-079/080), #3337 event broadening + scoped delete (TC-STAT-081/082), #3346 bug #895498 (TC-STAT-083), full-vs-optimized sync contract (TC-STAT-084).
- ✅ **Email cluster TC generation** — 11 TCs (TC-EMAIL-001…011) in new workbook `test-docs/email/email.xlsx`:
  - `TS-Email-CronDispatch` (6 TCs, row 8): baseline cron (20s) + markers, NEW→SENT, NEW→INVALID, mixed-batch FAILED+SENT, DI-EMAIL-DISPATCH-AUTH regression, pageSize=300 cap.
  - `TS-Email-CronPrune` (5 TCs, row 9): baseline daily cron + markers, PT30D retention, strict less-than boundary, cascade delete no-orphans, zero-delete no-op.
- ✅ **Design issues folded** — DI-EMAIL-DISPATCH-AUTH (infinite retry) as TC-EMAIL-005; DI-EMAIL-DISPATCH-RETRY (no retry count) as TC-EMAIL-004 notes.
- ✅ **`COL-cron` extended** — 68 → 87 rows; title flipped "active" → "complete".
- ✅ **`coverage.md` finalized** — rows 8, 9, 22 flipped TBD → TC IDs; Total 87 TCs / 23 of 23 rows; Status **COMPLETE**.
- ✅ **SQLite `test_case_tracking`** — 19 rows inserted (8 statistics + 11 email); totals per module: email=11, statistics=84, cross-service=91, reports=80, vacation=127.
- ✅ **Generators committed** — `extend_statistics.py` (idempotent suite delete-and-rewrite) and `generate_email.py` (full workbook from scratch).

**Counters:** rows covered 20 → 23 (100%); TCs drafted 68 → 87; deltas folded 10/10 (delta #8 closed).

</details>

<details><summary>Session 137 closed (2026-04-18) — cross-service cluster landed</summary>

- ✅ **Cross-service cluster TC generation** — 21 TCs (TC-CS-101…121) across 2 new suites in `test-docs/cross-service/cross-service.xlsx`:
  - `TS-CrossService-CronCSSync` (11 TCs, rows 6/10/20 plus shared marker-collision/ShedLock/parallel-execution/idempotency concerns).
  - `TS-CrossService-CronPMToolSync` (10 TCs, row 23 with full #3083 field contract).
- ✅ **Two scope-table deltas folded** — #7 (row 20 v2 endpoint) → TC-CS-106/107; #10 (startup-only full sync) → TC-CS-103 / TC-CS-121.
- ✅ **Design asymmetry captured** — TC-CS-104 locks in row 10's distinct `CS sync started/finished` marker; TC-CS-105 guards WARN-level failure log.
- ✅ **Marker collision between rows 6↔20** — TC-CS-108 verifies Graylog `stream`-field disambiguation.
- ✅ **GitLab regressions folded** — #3083 (TC-CS-112/113/116/118), #3382 (TC-CS-114), #3286 (TC-CS-115), #3399 (TC-CS-121).
- ✅ **`COL-cron` extended** — 47 → 68 rows.
- ✅ **`coverage.md` updated** — rows 6, 10, 20, 23 filled; total 20/23 rows, 68 TCs.

**Counters:** rows covered 16 → 20 (87%); TCs drafted 47 → 68; deltas folded 8 → 10 (all folded).

</details>

<details><summary>Session 136 closed (2026-04-17) — reports cluster landed</summary>

- ✅ **Reports cluster TC generation** — 20 TCs (TC-RPT-101…120) across 2 suites:
  - `TS-Reports-CronNotifications` (15 TCs, rows 1/2/3/4/7)
  - `TS-Reports-BudgetNotifications` (5 TCs, row 5)
- ✅ **Three scope-table deltas folded** — #1 (row 3 template REPORT_SHEET_CHANGED), #2 (row 4 zero log markers → email-only), #3 (row 5 three templates).
- ✅ **GitLab regressions folded** — #3321, #685, #2289, #892.
- ✅ **`COL-cron` extended** — 27 → 47 rows.
- ✅ **SQLite** — 20 rows inserted.

**Counters:** rows covered 10 → 16 (70%); TCs drafted 27 → 47; deltas folded 5 → 8.

</details>

<details><summary>Session 135 closed (2026-04-17) — vacation cluster landed</summary>

- ✅ **`test-plan.md` flipped** from SCAFFOLD to ACTIVE (10 sections, RabbitMQ fan-out table).
- ✅ **Vacation cluster TC generation** — 27 TCs (TC-VAC-101…127) across 8 `TS-Vac-Cron-*` suites.
- ✅ **`COL-cron` populated** with 27 rows.
- ✅ **`coverage.md` flipped to ACTIVE** — rows 11-19, 21 filled.
- ✅ **SQLite** — 27 rows inserted.
- ✅ **Generator scripts** committed idempotent.
- ✅ **5 of 8 scope-table deltas folded** — #4, #5, #6, #10.

**Counters:** rows covered 0 → 10 (43%); TCs drafted 0 → 27.

</details>

### Completed in Phase A (sessions 129 – 134)

<details><summary>Phase A backlog (collapsed — see [[exploration/tickets/t3423-investigation]] audit logs)</summary>

- ✅ **Session 134 — A→B transition executed.** Config flipped; generator scaffolded.
- ✅ **Session 133 — bulk P1 ticket mining.** #3178, #3262, #3303, #3337, #3345, #3346.
- ✅ **Session 132 — deep-dive rows 3, 4, 5, 8, 15.** 5 fresh scope-table deltas.
- ✅ **Session 131 — code-verification batch 2.** Rows 6, 9, 20, 22, 23. #3083 ticket mining.
- ✅ **Session 130 — vacation-service batch 1.** Rows 10-11, 14-19, 21 markers.
- ✅ **Session 129 — orientation.** Ticket body read; ttt-service markers code-verified.

</details>

### Deliverables tracking (Phase B — final)

| Artifact | Path | Status | Session |
|---|---|---|---|
| `test-plan.md` | `test-docs/collections/cron/test-plan.md` | ✅ ACTIVE | 135 |
| `cron.xlsx` | `test-docs/collections/cron/cron.xlsx` | ✅ COMPLETE (87 `COL-cron` rows) | 138 |
| `coverage.md` | `test-docs/collections/cron/coverage.md` | ✅ COMPLETE (23/23 rows filled) | 138 |
| Generator | `expert-system/generators/t3423/generate.py` | ✅ Scaffolded | 134 |
| Generator | `expert-system/generators/t3423/extend_vacation.py` | ✅ Idempotent | 135 |
| Generator | `expert-system/generators/t3423/extend_reports.py` | ✅ Idempotent | 136 |
| Generator | `expert-system/generators/t3423/extend_crossservice.py` | ✅ Idempotent | 137 |
| Generator | `expert-system/generators/t3423/extend_statistics.py` | ✅ Idempotent | 138 |
| Generator | `expert-system/generators/t3423/generate_email.py` | ✅ Idempotent (full workbook) | 138 |
| Generator | `expert-system/generators/t3423/populate_col_cron.py` | ✅ Idempotent (87 rows) | 138 |
| Vacation cluster TCs | `test-docs/vacation/vacation.xlsx` (extend) | ✅ 8 suites, 27 TCs | 135 |
| Reports cluster TCs | `test-docs/reports/reports.xlsx` (extend) | ✅ 2 suites, 20 TCs | 136 |
| Cross-service cluster TCs | `test-docs/cross-service/cross-service.xlsx` (extend) | ✅ 2 suites, 21 TCs | 137 |
| Statistics cluster TCs | `test-docs/statistics/statistics.xlsx` (extend) | ✅ 1 suite, 8 TCs | 138 |
| Email cluster TCs | `test-docs/email/email.xlsx` (new) | ✅ 2 suites, 11 TCs | 138 |
| NOT_IMPLEMENTED stubs | `test-docs/vacation/vacation.xlsx` (extend) | ✅ TC-VAC-104/105 | 135 |

**Phase B totals:** 14 suites · 87 TCs · 5 home workbooks · 23/23 rows covered · 10/10 deltas folded.
