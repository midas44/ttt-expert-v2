# Knowledge Coverage — Phase B (Ticket #3423 — Cron & Startup Jobs)

**Scope (config.yaml):** `phase.scope: "3423"` → internal `t3423` (**collection-shaped** output at `test-docs/collections/cron/`). Phase C gated off (`autotest.enabled: false`).

**Coverage metric for Phase B:** rows (from the 23-row scope table) that have ≥ 1 test case referenced in `cron.xlsx` `COL-cron` sheet. Each TC must have a matching definition in a home-module workbook (`vacation.xlsx`, `reports.xlsx`, `cross-service.xlsx`, `statistics.xlsx`, etc.). Coverage target (auto-transition gate): **1.0 = 23/23**.

## Phase B status — cron.xlsx row coverage

| Row | Job | Home module | TCs in COL-cron | Status |
|----:|-----|-------------|:---:|--------|
| 1 | TTT — forgotten weekly | reports.xlsx | 3 | ✅ Covered — TC-RPT-101…103 (session 136) |
| 2 | TTT — forgotten delayed | reports.xlsx | 2 | ✅ Covered — TC-RPT-104…105 (session 136) |
| 3 | TTT — report changed | reports.xlsx | 3 | ✅ Covered — TC-RPT-106…108 (delta #1 folded in) |
| 4 | TTT — reject | reports.xlsx | 4 | ✅ Covered — TC-RPT-109…112 (delta #2 folded; #3321/#685 regressions) |
| 5 | TTT — budget | reports.xlsx | 5 | ✅ Covered — TC-RPT-116…120 (delta #3 folded; #892 regression) |
| 6 | TTT — CS sync | cross-service.xlsx | 7 | ✅ Covered — TC-CS-101…103, 108…111 (session 137; delta #10 folded) |
| 7 | TTT — extended cleanup | reports.xlsx | 3 | ✅ Covered — TC-RPT-113…115 (#2289 regression folded) |
| 8 | Email — dispatch | TBD (reports.xlsx or new email.xlsx) | 0 | ⬜ Not started |
| 9 | Email — prune | TBD (reports.xlsx or new email.xlsx) | 0 | ⬜ Not started |
| 10 | Vacation — CS sync | cross-service.xlsx | 5 | ✅ Covered — TC-CS-104, 105, 109…111 (session 137; distinct marker text; WARN-level regression) |
| 11 | Vacation — annual accruals | vacation.xlsx | 3 | ✅ Covered — TC-VAC-101…103 (session 135) |
| 12 | Vacation — prelim outdated remove | vacation.xlsx | 1 | ✅ Covered — TC-VAC-104 stub (NOT_IMPLEMENTED) |
| 13 | Vacation — prelim close-outdated | vacation.xlsx | 1 | ✅ Covered — TC-VAC-105 stub (NOT_IMPLEMENTED) |
| 14 | Vacation — digest | vacation.xlsx | 3 | ✅ Covered — TC-VAC-106…108 (path delta #4 folded in) |
| 15 | Vacation — prod-calendar reminder | vacation.xlsx | 3 | ✅ Covered — TC-VAC-109…111 (deltas #5 folded in) |
| 16 | Vacation — auto-pay expired | vacation.xlsx | 3 | ✅ Covered — TC-VAC-112…114 |
| 17 | Vacation — APPROVED→PAID | vacation.xlsx | 3 | ✅ Covered — TC-VAC-115…117 (DB-only; no markers) |
| 18 | Vacation — employee-project periodic | vacation.xlsx | 5 | ✅ Covered — TC-VAC-118…122 (delta #6 folded in) |
| 19 | Vacation — employee-project startup | vacation.xlsx | 3 | ✅ Covered — TC-VAC-123…125 (feature-toggle gated) |
| 20 | Calendar — CS sync | cross-service.xlsx | 6 | ✅ Covered — TC-CS-106…111 (session 137; delta #7 v2 endpoint folded) |
| 21 | Vacation — statistic-report startup | vacation.xlsx | 2 | ✅ Covered — TC-VAC-126…127 (feature-toggle gated) |
| 22 | TTT — statistic-report optimized | statistics.xlsx | 0 | ⬜ Not started — *INFO-level failure delta* |
| 23 | TTT — PM Tool sync | cross-service.xlsx | 10 | ✅ Covered — TC-CS-112…121 (session 137; #3083/#3286/#3382/#3399 regressions folded) |

**Rows covered:** 20 / 23 (87%)
**XLSX files touched:** 3 / 5 (`vacation.xlsx` + `reports.xlsx` + `cross-service.xlsx` extended with cron suites — 12 new `TS-*-Cron-*` suites totalling 68 TCs)
**Collection deliverables:** test-plan.md ✅ (full Phase B); cron.xlsx `COL-cron` ✅ (68 refs); coverage.md ✅ (vacation + reports + cross-service rows filled).

## Session 137 — delta

- **21 TCs landed** (TC-CS-101 … TC-CS-121) across **2 new suites** in `test-docs/cross-service/cross-service.xlsx`:
  - `TS-CrossService-CronCSSync` — 11 TCs (rows 6, 10, 20 plus shared marker-collision/ShedLock/parallel-execution/idempotency)
  - `TS-CrossService-CronPMToolSync` — 10 TCs (row 23 with full #3083 field contract)
- **Two Phase-A deltas folded** — #7 (row 20 v2 endpoint `/api/calendar/v2/test/salary-office/sync?fullSync={true|false}`), #10 (startup-only full sync).
- **Row 10 design asymmetry captured** — TC-CS-104 locks in vacation's distinct `CS sync started/finished` markers; TC-CS-105 guards WARN-level failure log (not ERROR).
- **Marker collision rows 6↔20** — TC-CS-108 verifies Graylog `stream`-field disambiguation.
- **GitLab regressions folded** — #3083 (TC-CS-112/113 contract; TC-CS-116 silent default; TC-CS-117 event contract), #3382 (TC-CS-114 append-only), #3286 (TC-CS-115 immutability), #3083 note 4 (TC-CS-118 snavrockiy regression), #3399 (TC-CS-121 startup listener).
- SQLite `test_case_tracking` now contains TC-CS-101…121 (status = `drafted`, xlsx_file = `test-docs/cross-service/cross-service.xlsx`); breakdown: 6 Critical / 12 High / 3 Medium; 8 Functional / 5 Regression / 4 Negative / 2 Idempotency / 2 Verification.
- `COL-cron` extended 47 → 68 rows.
- `coverage.md` now 20/23 rows covered; cluster-progress table shows cross-service ✅ landed.

## Session 136 — delta

- **20 TCs landed** (TC-RPT-101 … TC-RPT-120) across **2 new suites** in `test-docs/reports/reports.xlsx`:
  - `TS-Reports-CronNotifications` — 15 TCs (rows 1, 2, 3, 4, 7)
  - `TS-Reports-BudgetNotifications` — 5 TCs (row 5)
- **Three Phase-A deltas folded** — #1 (row 3 template REPORT_SHEET_CHANGED), #2 (row 4 zero log markers → email-only), #3 (row 5 three templates).
- **Four GitLab regressions folded** — #3321 (TC-RPT-111), #685 (TC-RPT-112), #2289 (TC-RPT-113/114), #892 (TC-RPT-119).
- SQLite `test_case_tracking` now contains TC-RPT-101…120 (status = `drafted`, xlsx_file = `test-docs/reports/reports.xlsx`); breakdown: 7 Critical / 8 High / 5 Medium.
- `COL-cron` extended 27 → 47 rows.
- `coverage.md` now 16/23 rows covered; cluster-progress table updated.

## Session 135 — delta

- **27 TCs landed** (TC-VAC-101 … TC-VAC-127) spread across **8 new suites** in `test-docs/vacation/vacation.xlsx`:
  - `TS-Vac-Cron-AnnualAccruals` — 3 TCs (row 11)
  - `TS-Vac-Cron-NotImpl` — 2 TCs (rows 12, 13; single stub per dead-config row)
  - `TS-Vac-Cron-Digest` — 3 TCs (row 14)
  - `TS-Vac-Cron-CalendarReminder` — 3 TCs (row 15)
  - `TS-Vac-Cron-AutoPay` — 3 TCs (row 16)
  - `TS-Vac-Cron-ApprovedToPaid` — 3 TCs (row 17)
  - `TS-Vac-Cron-EmpProjectSync` — 8 TCs (rows 18 + 19)
  - `TS-Vac-Cron-StatReportInit` — 2 TCs (row 21)
- SQLite `test_case_tracking` now contains all 27 (status = `drafted`, xlsx_file = `test-docs/vacation/vacation.xlsx`).
- `COL-cron` sheet flipped from scaffold to active (27 rows referencing home-module IDs).
- `coverage.md` flipped from SCAFFOLD to ACTIVE; 10/23 rows populated.

## Seed material ready for Phase B TC generation

These Phase A notes contain ready-to-convert seed TCs. Each item below is already test-case-shaped (preconditions + steps + expected result + priority):

| Source note | Seed TCs | Jobs covered | Consumed to date |
|---|---:|---|---|
| [[exploration/tickets/3262-ticket-findings]] §3 | 18 | 18, 19, 21, 22 | 13 for jobs 18/19/21 (session 135); 5 remaining for row 22 |
| [[exploration/tickets/3083-ticket-findings]] | 8 | 23 (PM Tool sync) | ✅ **all 8 consumed session 137** — TC-CS-112…119 |
| [[external/EXT-cron-jobs]] "Session 132" section | — (narrative) | 3, 4, 5, 8, 15 | Row 15 preconditions used for TC-VAC-109…111; rows 3/4/5 preconditions used for TC-RPT-106…120 (session 136) |
| [[patterns/email-notification-triggers]] | — (predicates) | all E-channel | Subject predicates used for TC-VAC-106/109/110 and TC-RPT-101/106/109/116 |

**Seed TCs remaining to consume:** 5 for row 22 (statistics cluster). (Row 23's 8 seed TCs all consumed session 137.)

## Scope-table deltas to fold into TC preconditions

All 10 deltas (8 open + 1 closed + 1 "Daily 00:00 full CS sync" cleanup note) tracked in [[_SESSION_BRIEFING]] session-134 brief. Folded so far:

| Delta | Fold status |
|---|---|
| #1 Row 3 template key (`REPORT_SHEET_CHANGED`) | ✅ session 136 — TC-RPT-106/107 |
| #2 Row 4 zero log markers | ✅ session 136 — TC-RPT-109 (email-only verification, no LOG-CHECK) |
| #3 Row 5 three templates (EXCEEDED/NOT_REACHED/DATE_UPDATED) | ✅ session 136 — TC-RPT-116/117/118 |
| #4 Row 14 path (`/vacations/notify` → `/digest`) | ✅ session 135 — TC-VAC-106…108 use POST `/api/vacation/v1/test/digest` |
| #5a Row 15 cron property (`annual-first`) | ✅ session 135 — TC-VAC-109 preconditions reference |
| #5b Row 15 scheduler-wrapper bypass | ✅ session 135 — TC-VAC-109…111 verify per-recipient mail markers only |
| #6 Row 18 path (`/api/vacation/v1/test/employee-projects`) | ✅ session 135 — TC-VAC-118…122 use corrected path |
| #10 Full CS sync wording (startup-only) | ✅ session 135 — TC-VAC-123/126 scoped to startup-only |

| #7 Row 20 path | ✅ session 137 — TC-CS-106/107 use v2 endpoint |
| #10 Full CS sync wording (startup-only) — follow-up | ✅ session 137 — TC-CS-103 (ttt startup) + TC-CS-121 (PMT startup) |

Remaining deltas to fold (future sessions):
| Delta | Target cluster |
|---|---|
| #8 Row 22 INFO-level | Statistics (P0 session 138) |

## Phase B exit criteria

- **23 / 23 rows covered** with ≥ 1 TC in `COL-cron` — currently **20/23**
- `test-plan.md` complete (not scaffold) — ✅
- `coverage.md` complete with no "TBD" cells — currently 3 TBD remaining (rows 8, 9, 22)
- All 10 scope-table deltas reflected in TC preconditions — **9/10 folded** (only #8 row 22 INFO-level remaining for statistics cluster)
- SQLite `test_case_tracking` populated with every TC ID — 68/~85 target

## Phase A — reference (collapsed)

<details><summary>Phase A final status (archived)</summary>

Phase A closed session 134 with:
- Endpoints code-confirmed: 23/23 ✅
- Markers code-verified: 21/23 ✅ (rows 12, 13 = NOT_IMPLEMENTED dead config)
- Markers live-verified: 6/23 (not a Phase A blocker)
- Roundcube subjects sampled: 3/23 + digest (4 deferred by seeding requirements; 1 by identical-to-sibling)
- **P1 tickets mined: 9/9** ✅
- Scope-table deltas enumerated: **8** + 1 closed as non-delta (row 22 cron time)
- Design issues filed: 7
- Bugs catalogued: 8 (all FIXED or WON'T FIX; no open)
- **Seed TCs extracted: 26** (18 from #3262 cluster + 8 from #3083)

All gates met per `thresholds.knowledge_coverage_target: 1.0` after override cleared.

</details>

## Phase C — Autotest Generation (paused)

Frozen at session 128 close. `autotest.enabled: false`. Will resume after Phase B completes and the ticket body's Stage D timing is right.

## Last updated
2026-04-18 by session 137 (cross-service cluster — 21 TCs landed; 20/23 rows covered; 68 TCs total; 9/10 deltas folded).
