---
type: agenda
updated: '2026-04-03'
---
# Investigation Agenda — Phase C (Autotest Generation)

## Scope: reports, accounting (`autotest.scope`)

### P0 — Session 107 Immediate

- [ ] Reports CRUD remaining: TC-RPT-006 (pin/unpin), TC-RPT-007 (rename), TC-RPT-012 (comment), TC-RPT-013 (cell locking), TC-RPT-014 (manager view)
- [ ] Re-attempt TC-RPT-005 (add task — failed in prior session)
- [ ] Build ConfirmationPage object for confirmation suite

### P1 — Reports Confirmation Suite (12 cases)

- [ ] TC-RPT-016..027: Confirmation page tests (approve, reject, bulk approve, tabs)
- [ ] Requires new ConfirmationPage page object
- [ ] Selectors available in reports-pages.md vault note

### P2 — Reports Periods, AutoReject, Statistics, Notifications, Permissions

- [ ] Periods suite (8 cases) — needs Accounting page object
- [ ] AutoReject suite (5 cases) — depends on Periods
- [ ] Statistics suite (8 cases) — needs Statistics page navigation
- [ ] Notifications suite (4 cases) — API-only
- [ ] Permissions suite (8 cases) — multi-role testing

### P3 — Accounting Module (38 cases)

- [ ] After reports module is sufficiently covered
- [ ] Parse accounting XLSX and register cases

### P4 — Knowledge Write-Back (ongoing)

- [ ] Document discovered selectors in vault
- [ ] Update UI flow notes with confirmed patterns
- [ ] Log data patterns for test data generation

<details>
<summary>Completed Items (Session 106)</summary>

- [x] Phase B→C transition: config.yaml updated, vault control files reset
- [x] Manifest refreshed: 845 cases, 60 reports cases
- [x] All 60 reports cases registered in autotest_tracking
- [x] TC-RPT-004: Report in closed period — verified
- [x] TC-RPT-008: Week navigation arrows — verified
- [x] TC-RPT-009: Batch create multiple cells — verified
- [x] TC-RPT-010: Decimal hours (1.5) — verified
- [x] TC-RPT-011: TAB stacking bug #3398 — verified
- [x] MyTasksPage: 6 new week navigation + editability methods
- [x] reportQueries.ts: findEmployeeWithMultipleTasks query
- [x] Vault write-back: reports-pages.md updated with selectors

</details>

<details>
<summary>Completed Items (Phase B, Sessions 101-105)</summary>

- [x] Phase B total: 845 cases across 12 modules (sick-leave, statistics, admin, security, cross-service + prior)

</details>
