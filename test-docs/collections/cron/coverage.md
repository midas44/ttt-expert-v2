# Traceability — Cron & Startup Jobs Testing Collection

**Generated:** 2026-04-17 (session 135 — vacation; session 136 — reports) · 2026-04-18 (session 137 — cross-service)
**Status:** **ACTIVE** — vacation + reports + cross-service clusters (20/23 rows) populated; statistics / email clusters pending.

Each row maps a cron / startup job to the home-module TCs that exercise it and to the final spec path once Phase C resumes. Until TCs land, cells read `TBD`; until Phase C runs, spec paths read `n/a (Phase C gated off)`.

| # | Job | Home module workbook | TC IDs | Spec file(s) |
|---:|-----|----------------------|--------|--------------|
| 1 | Forgotten-report notification (weekly) | `test-docs/reports/reports.xlsx` | TC-RPT-101, TC-RPT-102, TC-RPT-103 (TS-Reports-CronNotifications) | n/a (Phase C gated off) |
| 2 | Forgotten-report delayed notification | `test-docs/reports/reports.xlsx` | TC-RPT-104, TC-RPT-105 (TS-Reports-CronNotifications) | n/a (Phase C gated off) |
| 3 | Report-changed notification | `test-docs/reports/reports.xlsx` | TC-RPT-106, TC-RPT-107, TC-RPT-108 (TS-Reports-CronNotifications) | n/a (Phase C gated off) |
| 4 | Report-reject notification | `test-docs/reports/reports.xlsx` | TC-RPT-109, TC-RPT-110, TC-RPT-111, TC-RPT-112 (TS-Reports-CronNotifications) | n/a (Phase C gated off) |
| 5 | Budget-overrun notification | `test-docs/reports/reports.xlsx` | TC-RPT-116, TC-RPT-117, TC-RPT-118, TC-RPT-119, TC-RPT-120 (TS-Reports-BudgetNotifications) | n/a (Phase C gated off) |
| 6 | CS sync (partial / startup-full) | `test-docs/cross-service/cross-service.xlsx` | TC-CS-101, TC-CS-102, TC-CS-103, TC-CS-108, TC-CS-109, TC-CS-110, TC-CS-111 (TS-CrossService-CronCSSync) | n/a (Phase C gated off) |
| 7 | Extended report-period cleanup | `test-docs/reports/reports.xlsx` | TC-RPT-113, TC-RPT-114, TC-RPT-115 (TS-Reports-CronNotifications) | n/a (Phase C gated off) |
| 8 | Email dispatch batch | `test-docs/email/email.xlsx` | TBD | n/a (Phase C gated off) |
| 9 | Email retention prune (> 30 days) | `test-docs/email/email.xlsx` | TBD | n/a (Phase C gated off) |
| 10 | CS sync (partial / startup-full) | `test-docs/cross-service/cross-service.xlsx` | TC-CS-104, TC-CS-105, TC-CS-109, TC-CS-110, TC-CS-111 (TS-CrossService-CronCSSync) | n/a (Phase C gated off) |
| 11 | Annual vacation accruals | `test-docs/vacation/vacation.xlsx` | TC-VAC-101, TC-VAC-102, TC-VAC-103 (TS-Vac-Cron-AnnualAccruals) | n/a (Phase C gated off) |
| 12 | Preliminary-vacation outdated removal **[NOT_IMPLEMENTED]** | `test-docs/vacation/vacation.xlsx` | TC-VAC-104 (TS-Vac-Cron-NotImpl) | n/a (Phase C gated off) |
| 13 | Preliminary-vacation close-outdated **[NOT_IMPLEMENTED]** | `test-docs/vacation/vacation.xlsx` | TC-VAC-105 (TS-Vac-Cron-NotImpl) | n/a (Phase C gated off) |
| 14 | Vacation notifications (digest) | `test-docs/vacation/vacation.xlsx` | TC-VAC-106, TC-VAC-107, TC-VAC-108 (TS-Vac-Cron-Digest) | n/a (Phase C gated off) |
| 15 | Production-calendar annual reminder | `test-docs/vacation/vacation.xlsx` | TC-VAC-109, TC-VAC-110, TC-VAC-111 (TS-Vac-Cron-CalendarReminder) | n/a (Phase C gated off) |
| 16 | Auto-pay expired approved vacations | `test-docs/vacation/vacation.xlsx` | TC-VAC-112, TC-VAC-113, TC-VAC-114 (TS-Vac-Cron-AutoPay) | n/a (Phase C gated off) |
| 17 | APPROVED -> PAID after period close | `test-docs/vacation/vacation.xlsx` | TC-VAC-115, TC-VAC-116, TC-VAC-117 (TS-Vac-Cron-ApprovedToPaid) | n/a (Phase C gated off) |
| 18 | Employee-project periodic sync | `test-docs/vacation/vacation.xlsx` | TC-VAC-118, TC-VAC-119, TC-VAC-120, TC-VAC-121, TC-VAC-122 (TS-Vac-Cron-EmpProjectSync) | n/a (Phase C gated off) |
| 19 | Employee-project initial sync (startup-only) | `test-docs/vacation/vacation.xlsx` | TC-VAC-123, TC-VAC-124, TC-VAC-125 (TS-Vac-Cron-EmpProjectSync) | n/a (Phase C gated off) |
| 20 | CS sync (partial / startup-full) | `test-docs/cross-service/cross-service.xlsx` | TC-CS-106, TC-CS-107, TC-CS-108, TC-CS-109, TC-CS-110, TC-CS-111 (TS-CrossService-CronCSSync) | n/a (Phase C gated off) |
| 21 | Statistic-report full sync (startup-only) | `test-docs/vacation/vacation.xlsx` | TC-VAC-126, TC-VAC-127 (TS-Vac-Cron-StatReportInit) | n/a (Phase C gated off) |
| 22 | Statistic-report optimized sync | `test-docs/statistics/statistics.xlsx` | TBD | n/a (Phase C gated off) |
| 23 | PM Tool project sync (partial / startup-full) | `test-docs/cross-service/cross-service.xlsx` | TC-CS-112, TC-CS-113, TC-CS-114, TC-CS-115, TC-CS-116, TC-CS-117, TC-CS-118, TC-CS-119, TC-CS-120, TC-CS-121 (TS-CrossService-CronPMToolSync) | n/a (Phase C gated off) |

## Status legend

- TC IDs present — TC landed in the home-module workbook; referenced in `COL-cron`
- `TBD` — TC not yet authored; Phase B session to deliver
- `TBD (deferred …)` — scoped for a later session with a linked home workbook change; see test-plan §10 for deferral rationale
- **[NOT_IMPLEMENTED]** — cron code is dead YAML config; single no-op stub TC sufficient
- `n/a (Phase C gated off)` — ticket Stage D — spec paths populated when `autotest.enabled: true`

## Cluster progress

| Cluster | Rows | TCs landed | Status |
|---|---|---:|---|
| Vacation (11, 12, 13, 14, 15, 16, 17, 18, 19, 21) | 10 | 27 | ✅ Landed session 135 |
| Reports (1, 2, 3, 4, 5, 7) | 6 | 20 | ✅ Landed session 136 |
| Cross-service (6, 10, 20, 23) | 4 | 21 | ✅ Landed session 137 |
| Email (8, 9) | 2 | 0 | ⬜ Pending P0 session 138 |
| Statistics (22) | 1 | 0 | ⬜ Pending P0 session 138 |
| **Total** | **23** | **68** | **20 / 23 rows covered** |

## Verification channels per row (shortcut)

`E` = Roundcube email (mandatory for E-rows)  |  `L` = Graylog log (mandatory for server-only rows)  |  `CS` / `PM` / `DB` = cross-system write

| # | Channels |
|---:|---|
| 1 | E, L |
| 2 | E, L |
| 3 | E, L |
| 4 | E, L |
| 5 | E, L |
| 6 | CS, DB, L |
| 7 | DB, L |
| 8 | E, L |
| 9 | DB, L |
| 10 | CS, DB, L |
| 11 | DB, L |
| 12 | DB, L |
| 13 | DB, L |
| 14 | E, L |
| 15 | E, L |
| 16 | DB, L |
| 17 | DB, L |
| 18 | DB, L |
| 19 | DB, L |
| 20 | CS, DB, L |
| 21 | DB, L |
| 22 | DB, L |
| 23 | PM, DB, L |
