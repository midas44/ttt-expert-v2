# Session Briefing — 137 close → 138 start (Phase B in progress)

**Last session:** 137 — closed 2026-04-18 (cross-service cluster landed, scope `t3423`, autonomy `full`).

**Phase:** generation | **Scope:** ticket `t3423` (Cron & Startup Jobs Testing Collection; **collection-shaped output** at `test-docs/collections/cron/`) | **Autonomy:** full | **Phase C gated off** (`autotest.enabled: false`).

## Session 137 — what was accomplished

1. ✅ **Cross-service cluster generated** — 21 TCs (TC-CS-101…121) across 2 new suites in existing `test-docs/cross-service/cross-service.xlsx`:
   - `TS-CrossService-CronCSSync` (11 TCs) — covers rows 6 (ttt), 10 (vacation), 20 (calendar), plus shared marker-collision / ShedLock / parallel-execution / idempotency concerns.
   - `TS-CrossService-CronPMToolSync` (10 TCs) — covers row 23 (PM Tool sync) with full #3083 field contract.
   - Suite-name disambiguation: pre-existing `TS-CrossService-CSSync` / `TS-CrossService-PMToolSync` cover general sync semantics; new `TS-CrossService-Cron*` suites address cron-specific concerns (scheduler cadence, ShedLock, startup vs cron paths, Unleash gating). Tab color `F4B084` (orange) distinguishes cron suites from the blue (`4472C4`) regular suites.
   - Every TC uses `SETUP:` / `TRIGGER:` / `WAIT:` / `VERIFY:` / `DB-CHECK:` / `LOG-CHECK:` / `EMAIL-CHECK:` / `CLEANUP:` prefixes with concrete Graylog queries, SQL, and API endpoints.
2. ✅ **Both pending Phase-A deltas folded** into TCs:
   - Delta #7 (row 20 path `POST /api/calendar/v2/test/salary-office/sync?fullSync={true|false}`) → TC-CS-106 / TC-CS-107.
   - Delta #10 ("daily 00:00 full CS sync" wording → startup-only clarification) → TC-CS-103 (ttt startup), TC-CS-121 (PMT startup).
3. ✅ **GitLab regressions folded** — #3083 baseline PM Tool contract (TC-CS-112/113), #3382 presales append-only (TC-CS-114), #3286 accounting-name immutability (TC-CS-115), #3083 default-script silent populate (TC-CS-116), #3083 note 4 snavrockiy regression 2026-02-25 (TC-CS-118), #3399 startup listener (TC-CS-121).
4. ✅ **Row 10 design asymmetry captured** — TC-CS-104 verifies that vacation's `CSSyncScheduler.sync()` emits `CS sync started/finished` (distinct from ttt/calendar's `Company staff synchronization …`); TC-CS-105 guards WARN-level failure logging (not ERROR).
5. ✅ **Marker collision rows 6↔20 captured** — TC-CS-108 verifies Graylog `stream` field disambiguation (TTT-QA-1 vs calendar).
6. ✅ **`COL-cron` extended** — 47 → 68 rows (cross-service cluster appended, grouped by cron-row with inline comments).
7. ✅ **`coverage.md` updated** — rows 6, 10, 20, 23 flipped from TBD to TC IDs + suite names; cluster-progress summary shows Cross-service landed; total 20/23 rows, 68 TCs.
8. ✅ **SQLite `test_case_tracking`** — 21 TCs inserted (status `drafted`, xlsx_file `test-docs/cross-service/cross-service.xlsx`); breakdown: 6 Critical / 12 High / 3 Medium; 8 Functional / 5 Regression / 4 Negative / 2 Idempotency / 2 Verification.
9. ✅ **Generator committed** at `expert-system/generators/t3423/extend_crossservice.py` (idempotent — deletes and rewrites the two `TS-CrossService-Cron*` suites only; never touches Plan Overview / Feature Matrix / Risk Assessment / 8 pre-existing `TS-CrossService-*` suites).
10. ✅ **`populate_col_cron.py` updated** — 21 new rows appended, title line refreshed to reference session 137.

### Key design decisions (applies to remaining clusters)

- **Cron-focused suites vs general-sync suites** — the existing `TS-CrossService-CSSync` / `TS-CrossService-PMToolSync` tabs document general sync semantics (field propagation, data mapping). The new `TS-CrossService-Cron*` tabs focus on scheduler-layer concerns: cron cadence, ShedLock, startup vs cron paths, Unleash gating, RabbitMQ fan-out settle windows. This pattern might be worth applying to the email cluster (extend `reports.xlsx` vs new `email.xlsx`?) — decision deferred to session 138.
- **Home-module TC IDs** — TC-CS-101 continues the cross-service workbook's sequence (previous last: TC-CS-070). Session 138 onward follows the same pattern per home workbook: TC-STAT-NNN (statistics), TC-EMAIL-NNN (if email workbook is new) or TC-RPT-121+ (if email extends reports).
- **Scope-table deltas 100% folded** — 10 of 10 deltas folded into TC preconditions; no pending scope-table corrections remain. The `docs/tasks/cron/cron-testing-task.md` ticket-body update is cosmetic housekeeping only (P2).

## Phase B preamble — non-default conventions for ticket #3423

**READ BEFORE GENERATING ANYTHING.** Canonical conventions: [[exploration/tickets/t3423-investigation]] §"Non-default conventions for this ticket".

| Artifact | Correct path | Wrong path (default ticket-scope) |
|---|---|---|
| Test plan | `test-docs/collections/cron/test-plan.md` ✅ ACTIVE | ~~`test-docs/t3423/`~~ |
| Collection XLSX | `test-docs/collections/cron/cron.xlsx` (sheet `COL-cron`) ✅ 68 refs | ~~`test-docs/t3423/t3423.xlsx`~~ |
| Coverage traceability | `test-docs/collections/cron/coverage.md` ✅ 20/23 rows filled | n/a |
| Retrospective | `docs/tasks/cron/retrospective.md` (Stage F — later) | n/a |

If any Phase B session begins creating `test-docs/t3423/`, **stop** and re-read the preamble.

### Remaining cluster assignments

| Cron rows | Home module workbook | Suite(s) landed / suggested | Status |
|---|---|---|---|
| 1, 2, 3, 4, 7 | `test-docs/reports/reports.xlsx` | `TS-Reports-CronNotifications` ✅ | Session 136 |
| 5 | `test-docs/reports/reports.xlsx` | `TS-Reports-BudgetNotifications` ✅ | Session 136 |
| 6, 10, 20 | `test-docs/cross-service/cross-service.xlsx` | `TS-CrossService-CronCSSync` ✅ | Session 137 |
| 23 | `test-docs/cross-service/cross-service.xlsx` | `TS-CrossService-CronPMToolSync` ✅ | Session 137 |
| 8, 9 | **Decision pending** — extend `reports.xlsx` OR new `email.xlsx` | `TS-Email-Dispatch` / `TS-Email-Prune` (pending) | **P0 session 138** |
| 11–19, 21 | `test-docs/vacation/vacation.xlsx` | 8 `TS-Vac-Cron-*` suites ✅ | Session 135 |
| 22 | `test-docs/statistics/statistics.xlsx` | `TS-Stat-CacheSync` (pending) | **P0 session 138** |

## Phase A deliverables (reference)

Still canonical inputs for the remaining clusters:

- [[exploration/tickets/t3423-investigation]] — preamble + audit logs
- [[external/EXT-cron-jobs]] — scheduler inventory, markers, timing, ShedLock/feature-toggle mapping
- [[exploration/tickets/3083-ticket-findings]] — 8 seed TCs for PM Tool sync (row 23) — **consumed in session 137**
- [[exploration/tickets/3262-ticket-findings]] — 18 seed TCs for jobs 18/19/21/22 (13 consumed for jobs 18/19/21; **5 remaining for job 22 → session 138**)
- [[patterns/email-notification-triggers]] — subject-prefix patterns, template key per cron
- [[investigations/statistics-caffeine-caching-performance-3337]] — design context for jobs 21/22
- [[_KNOWLEDGE_COVERAGE]] — row-by-row status (now 20/23)

**Known scope-table deltas — folding status (10/10 done ✅):**
1. Row 3 template key — ✅ TC-RPT-106/107 (s136)
2. Row 4 zero log markers — ✅ TC-RPT-109 (s136)
3. Row 5 three templates — ✅ TC-RPT-116/117/118 (s136)
4. Row 14 path — ✅ TC-VAC-106..108 (s135)
5. Row 15 scheduler-bypass — ✅ TC-VAC-109..111 (s135)
6. Row 18 path — ✅ TC-VAC-118..122 (s135)
7. Row 20 v2 endpoint — ✅ TC-CS-106/107 (s137)
8. Row 22 failure log level INFO — ⬜ **pending statistics session 138**
9. ~~Row 22 cron time~~ — closed session 134 as not-a-delta
10. Full CS sync startup-only — ✅ TC-CS-103 / TC-CS-121 (s137)

## Session 138 — plan (P0 for next run)

**Two clusters remaining in Phase B. Pick one first, probably statistics (simpler, 1 row, 5 seed TCs ready).**

### Statistics cluster (job 22) — target suite count: 1 new, ~6-8 TCs

- **Home workbook**: extend existing `test-docs/statistics/statistics.xlsx` (check if exists; create if not).
- **New suite**: `TS-Stat-CacheSync` covering `StatisticReportScheduler.sync()` cron logic.
- **Seed TCs from [[exploration/tickets/3262-ticket-findings]]**: 5 remaining TCs for row 22 — consume all.
- **Delta #8 folding**: INFO-level failure log (not ERROR) must appear in assertion predicate — design-issue regression guard.
- **Dependencies**: Caffeine cache invalidation ([[investigations/statistics-caffeine-caching-performance-3337]]); async contract.
- **Scripts**: new `expert-system/generators/t3423/extend_statistics.py` (idempotent, mirrors `extend_reports.py` / `extend_crossservice.py` pattern).

### Email cluster (jobs 8, 9) — target suite count: 2 new, ~10-15 TCs

- **Critical decision to make first**: extend `test-docs/reports/reports.xlsx` OR create new `test-docs/email/email.xlsx`? Session 137 outcome (separate cron suites in `cross-service.xlsx` worked cleanly) suggests **creating `email.xlsx`** is viable if the email module is logically separable. Check vault + cross-references before deciding.
- **Job 8 (email dispatch batch)** — highest-throughput cron (every 20 s). Suite: `TS-Email-Dispatch` (~8-10 TCs). Focus: batching, concurrent dispatch, quarantine path, failure retry.
- **Job 9 (email retention prune)** — daily 00:00, >30-day deletion. Suite: `TS-Email-Prune` (~4-5 TCs). Focus: date-window filter, idempotency, hard-delete verification.
- **Scripts**: new `expert-system/generators/t3423/extend_email.py` (or `extend_reports.py` rework if email extends reports — latter risks bloat).

### After both land — Phase B completion checklist

- ⬜ `coverage.md` — all 23 rows filled, no TBD; cluster progress 5/5.
- ⬜ `COL-cron` — 68 → ~85 rows with email + statistics TCs.
- ⬜ `test-plan.md` — update §10 Exit Criteria (last bullet "all 23 cron rows have TCs" → flip to ✅).
- ⬜ SQLite `test_case_tracking` — total ~85 drafted rows for t3423 scope.
- ⬜ **Phase B readiness report** — log to `_SESSION_BRIEFING.md` with total TC count, suites covered, tickets mined, vault notes enriched. If `auto_phase_transition: true` (check config), Phase C gates off means the agent stops here.
- ⬜ `config.yaml` — `autotest.enabled` remains `false` per ticket scope requirement (no autotest generation for t3423); Phase B closes when coverage 23/23.

## P1 carry-overs (non-blocking for Phase B)

- `graylog-access search` subcommand regression — workaround `tail --stream <env> -n 500 | grep` still works. Raise as a skill-maintenance task.
- Scope-table corrections in `docs/tasks/cron/cron-testing-task.md` — applied inline in TC Notes; full ticket-body correction is optional housekeeping (P2).
- Feature-toggle precondition template — pattern applied ad-hoc in TCs; consolidating into a reusable snippet is P2.

## Last updated
2026-04-18 by session 137 (close — cross-service cluster landed, 20/23 rows covered, 68 TCs in `COL-cron`, 10/10 deltas folded).
