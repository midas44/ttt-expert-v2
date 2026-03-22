---
type: agenda
updated: '2026-03-21'
---
# Phase C — Autotest Generation Agenda

## Completed (S31-S32)
- [x] Phase B → C transition with vault control file reset
- [x] Re-parse XLSX into manifest (109 test cases)
- [x] Generate TC-VAC-001 (create regular vacation) — verified
- [x] Generate TC-VAC-006 (edit NEW vacation dates) — verified
- [x] Generate TC-VAC-007 (edit APPROVED → status reset) — verified
- [x] Generate TC-VAC-021 (cancel NEW vacation) — verified
- [x] Generate TC-VAC-022 (cancel APPROVED vacation) — verified
- [x] Generate TC-VAC-002 (create unpaid/administrative) — verified
- [x] Generate TC-VAC-003 (create with comment) — verified
- [x] Generate TC-VAC-005 (view request details) — verified
- [x] Generate TC-VAC-010 (Open/Closed/All tabs) — verified
- [x] Generate TC-VAC-013 (create vacation starting today) — verified
- [x] Fix proxy issue in playwright.config.ts
- [x] Fix available_vacation_days mismatch (use higher threshold + shorter vacation)
- [x] Add VacationDetailsDialog.close(), MyVacationsPage.clickAllTab()/getRowCount()
- [x] Add findEmployeeWithOpenAndClosedVacations query

## P0 — Next Session (S33)
- [ ] Generate next 5 vacation tests from manifest
  - TC-VAC-004: Create vacation with "Also notify" colleagues
  - TC-VAC-008: Verify vacation table columns and sorting
  - TC-VAC-009: Verify vacation table filters (status and type)
  - TC-VAC-011: Verify available vacation days display and yearly breakdown
  - TC-VAC-015: Verify payment month auto-calculation
- [ ] Verify all against qa-1 with `--workers=1`
- [ ] Update tracking tables and manifest

## P1 — Sessions 34-36
- [ ] Complete remaining TS-Vac-CRUD suite
- [ ] Start TS-Vac-Lifecycle and TS-Vac-Approval suites
- [ ] Generate approval flow tests (TC-VAC-023 approve, TC-VAC-024 reject — need manager login)
- [ ] Explore multi-role scenarios

## P2 — Sessions 37+
- [ ] Status flow tests (TS-Vac-StatusFlow)
- [ ] Day-off tests
- [ ] Negative/boundary tests (TC-VAC-014 cross-year, TC-VAC-016+ validation)
- [ ] Payment-related tests

## Constraints
- **Workers**: Must use `--workers=1` — backend can't handle concurrent vacation operations
- **Proxy**: Fixed in playwright.config.ts — env vars cleared in launchOptions
- **Vacation days**: DB `available_vacation_days` ≠ UI remaining balance. Use threshold ≥15 for 5-day vacations, ≥5 for 1-2 day vacations
- **APPROVED vacations**: Queries must check available_vacation_days when extending periods
