# Knowledge Coverage — Phase B (Ticket #3423 — Cron & Startup Jobs)

**Scope (config.yaml):** `phase.scope: "3423"` → internal `t3423` (**collection-shaped** output at `test-docs/collections/cron/`). Phase C gated off (`autotest.enabled: false`).

**Status:** **COMPLETE** — 23/23 rows covered; 87 drafted TCs across 5 home workbooks; all 10/10 scope-table deltas folded.

**Coverage metric for Phase B:** rows (from the 23-row scope table) that have ≥ 1 test case referenced in `cron.xlsx` `COL-cron` sheet. Each TC must have a matching definition in a home-module workbook. Coverage target (auto-transition gate): **1.0 = 23/23** — met session 138.

## Phase B status — cron.xlsx row coverage

| Row | Job | Home module | TCs in COL-cron | Status |
|----:|-----|-------------|:---:|--------|
| 1 | TTT — forgotten weekly | reports.xlsx | 3 | ✅ TC-RPT-101…103 (s136) |
| 2 | TTT — forgotten delayed | reports.xlsx | 2 | ✅ TC-RPT-104…105 (s136) |
| 3 | TTT — report changed | reports.xlsx | 3 | ✅ TC-RPT-106…108 (s136; delta #1 folded) |
| 4 | TTT — reject | reports.xlsx | 4 | ✅ TC-RPT-109…112 (s136; delta #2 folded; #3321/#685) |
| 5 | TTT — budget | reports.xlsx | 5 | ✅ TC-RPT-116…120 (s136; delta #3 folded; #892) |
| 6 | TTT — CS sync | cross-service.xlsx | 7 | ✅ TC-CS-101…103, 108…111 (s137; delta #10) |
| 7 | TTT — extended cleanup | reports.xlsx | 3 | ✅ TC-RPT-113…115 (s136; #2289) |
| 8 | Email — dispatch | email.xlsx | 6 | ✅ TC-EMAIL-001…006 (s138; DI-EMAIL-DISPATCH-AUTH) |
| 9 | Email — prune | email.xlsx | 5 | ✅ TC-EMAIL-007…011 (s138; strict less-than; cascade delete) |
| 10 | Vacation — CS sync | cross-service.xlsx | 5 | ✅ TC-CS-104, 105, 109…111 (s137; marker asymmetry; WARN-level) |
| 11 | Vacation — annual accruals | vacation.xlsx | 3 | ✅ TC-VAC-101…103 (s135) |
| 12 | Vacation — prelim outdated remove | vacation.xlsx | 1 | ✅ TC-VAC-104 stub NOT_IMPLEMENTED |
| 13 | Vacation — prelim close-outdated | vacation.xlsx | 1 | ✅ TC-VAC-105 stub NOT_IMPLEMENTED |
| 14 | Vacation — digest | vacation.xlsx | 3 | ✅ TC-VAC-106…108 (delta #4) |
| 15 | Vacation — prod-calendar reminder | vacation.xlsx | 3 | ✅ TC-VAC-109…111 (delta #5) |
| 16 | Vacation — auto-pay expired | vacation.xlsx | 3 | ✅ TC-VAC-112…114 |
| 17 | Vacation — APPROVED→PAID | vacation.xlsx | 3 | ✅ TC-VAC-115…117 (DB-only; no markers) |
| 18 | Vacation — employee-project periodic | vacation.xlsx | 5 | ✅ TC-VAC-118…122 (delta #6) |
| 19 | Vacation — employee-project startup | vacation.xlsx | 3 | ✅ TC-VAC-123…125 (feature-toggle) |
| 20 | Calendar — CS sync | cross-service.xlsx | 6 | ✅ TC-CS-106…111 (s137; delta #7) |
| 21 | Vacation — statistic-report startup | vacation.xlsx | 2 | ✅ TC-VAC-126…127 (feature-toggle) |
| 22 | TTT — statistic-report optimized | statistics.xlsx | 8 | ✅ TC-STAT-077…084 (s138; delta #8 INFO-level folded) |
| 23 | TTT — PM Tool sync | cross-service.xlsx | 10 | ✅ TC-CS-112…121 (s137; #3083/#3286/#3382/#3399) |

**Rows covered:** **23 / 23 (100%)**
**XLSX files touched:** 5 / 5 (`vacation.xlsx`, `reports.xlsx`, `cross-service.xlsx`, `statistics.xlsx` extended; `email.xlsx` created)
**Suites landed:** 14 new `TS-*-Cron-*` suites
**Collection deliverables:** test-plan.md ✅ (full Phase B); cron.xlsx `COL-cron` ✅ (87 refs); coverage.md ✅ COMPLETE.

## Session 138 — delta

- **19 TCs landed** across 2 clusters:
  - **Statistics (8 TCs)**: TC-STAT-077…084 in new suite `TS-Stat-CronStatReportSync` (statistics.xlsx). Delta #8 folded (TC-STAT-078 guards INFO-level failure log regression). #3345 Bugs 1+2 (TC-STAT-079/080). #3337 event-broadening + scoped-delete (TC-STAT-081/082). #3346 bug #895498 scheduler wiring (TC-STAT-083). Full-vs-optimized sync contract (TC-STAT-084).
  - **Email (11 TCs)**: TC-EMAIL-001…011 in new workbook `email.xlsx` with 2 suites. `TS-Email-CronDispatch` (6): baseline cron + markers, NEW→SENT happy, NEW→INVALID, mixed-batch FAILED+SENT, DI-EMAIL-DISPATCH-AUTH regression (infinite retry loop), pageSize=300 cap. `TS-Email-CronPrune` (5): baseline cron + markers, PT30D retention, strict less-than boundary, cascade delete (no FK orphans), zero-delete no-op.
- **Delta #8 folded** (TC-STAT-078) — all 10 scope-table deltas now folded (10/10 ✅).
- **`COL-cron` extended** 68 → 87 rows; title cell "active" → "complete".
- **`coverage.md` finalized** — rows 8, 9, 22 flipped TBD → TC IDs; cluster-progress Total 87/23; header Status "ACTIVE" → "COMPLETE".
- **SQLite `test_case_tracking`** — 19 new rows inserted (8 statistics + 11 email); per-module totals: email=11, statistics=84, cross-service=91, reports=80, vacation=127.
- **Generators committed** — `extend_statistics.py` (idempotent suite delete-and-rewrite); `generate_email.py` (~700-line full workbook from scratch).

## Phase B — final totals

| Cluster | Rows | TCs | Home workbook | Landed |
|---|---|---:|---|---|
| Vacation | 10 | 27 | vacation.xlsx (8 new suites) | s135 |
| Reports | 6 | 20 | reports.xlsx (2 new suites) | s136 |
| Cross-service | 4 | 21 | cross-service.xlsx (2 new suites) | s137 |
| Statistics | 1 | 8 | statistics.xlsx (1 new suite) | s138 |
| Email | 2 | 11 | email.xlsx (NEW; 2 suites) | s138 |
| **Total** | **23** | **87** | **5 workbooks, 14 suites** | — |

## Seed material consumption (final)

| Source note | Seed TCs | Jobs covered | Consumed |
|---|---:|---|---|
| [[exploration/tickets/3262-ticket-findings]] §3 | 18 | 18, 19, 21, 22 | ✅ all 18 consumed (13 s135 + 5 s138) |
| [[exploration/tickets/3083-ticket-findings]] | 8 | 23 (PM Tool sync) | ✅ all 8 consumed (s137) |
| [[exploration/tickets/3345-ticket-findings]] | — | 22 | ✅ folded as TC-STAT-079/080 (s138) |
| [[exploration/tickets/3346-ticket-findings]] | — | 22 | ✅ folded as TC-STAT-083 (s138) |
| [[investigations/statistics-caffeine-caching-performance-3337]] | — | 22 | ✅ folded as TC-STAT-081/082 (s138) |
| [[modules/email-notification-deep-dive]] §4 | — (design issues) | 8 | ✅ DI-EMAIL-DISPATCH-AUTH folded as TC-EMAIL-005 (s138) |
| [[patterns/email-notification-triggers]] | — (predicates) | all E-channel | ✅ Subject predicates used across TC-VAC, TC-RPT, TC-EMAIL |
| [[external/EXT-cron-jobs]] | — (narrative) | all 23 | ✅ Canonical input across s135–138 |

## Scope-table deltas — all folded

| Delta | Fold status |
|---|---|
| #1 Row 3 template key (`REPORT_SHEET_CHANGED`) | ✅ s136 — TC-RPT-106/107 |
| #2 Row 4 zero log markers (email-only verification) | ✅ s136 — TC-RPT-109 |
| #3 Row 5 three templates (EXCEEDED/NOT_REACHED/DATE_UPDATED) | ✅ s136 — TC-RPT-116/117/118 |
| #4 Row 14 path (`/vacations/notify` → `/digest`) | ✅ s135 — TC-VAC-106…108 |
| #5a Row 15 cron property (`annual-first`) | ✅ s135 — TC-VAC-109 preconditions |
| #5b Row 15 scheduler-wrapper bypass | ✅ s135 — TC-VAC-109…111 per-recipient markers |
| #6 Row 18 path (`/api/vacation/v1/test/employee-projects`) | ✅ s135 — TC-VAC-118…122 |
| #7 Row 20 path (v2 endpoint) | ✅ s137 — TC-CS-106/107 |
| #8 Row 22 INFO-level failure log | ✅ s138 — TC-STAT-078 |
| #10 Full CS sync startup-only | ✅ s135+s137 — TC-VAC-123/126 + TC-CS-103/121 |

**10/10 deltas folded. No open deltas remain.**

## Phase B exit criteria — all met

- [x] **23 / 23 rows covered** with ≥ 1 TC in `COL-cron` — **23/23 ✅**
- [x] `test-plan.md` complete (not scaffold) — ✅ s135
- [x] `coverage.md` complete with no "TBD" cells — ✅ s138 (only legend references of TBD remain)
- [x] All 10 scope-table deltas reflected in TC preconditions — **10/10 ✅**
- [x] SQLite `test_case_tracking` populated with every TC ID — 87/87 ✅

## Phase A — reference (collapsed)

<details><summary>Phase A final status (archived)</summary>

Phase A closed session 134 with:
- Endpoints code-confirmed: 23/23 ✅
- Markers code-verified: 21/23 ✅ (rows 12, 13 = NOT_IMPLEMENTED dead config)
- Markers live-verified: 6/23 (not a Phase A blocker)
- Roundcube subjects sampled: 3/23 + digest
- **P1 tickets mined: 9/9** ✅
- Scope-table deltas enumerated: **8** + 1 closed as non-delta (row 22 cron time)
- Design issues filed: 7
- Bugs catalogued: 8 (all FIXED or WON'T FIX)
- **Seed TCs extracted: 26** (18 from #3262 cluster + 8 from #3083) — all consumed in Phase B

</details>

## Phase C — Autotest Generation (paused)

Frozen at session 128 close. `autotest.enabled: false` per ticket scope requirement. Will resume after retrospective authored and ticket body's Stage D timing is right.

## Last updated
2026-04-18 by session 138 (close — Phase B **COMPLETE** for ticket #3423. 23/23 rows covered. 87 TCs drafted. All 10 deltas folded. 5 home workbooks. 14 new suites.).
