# Investigation Agenda — Phase C (Autotest Generation)

## Scope: reports, accounting

### P0 — Next Session (96)
- [ ] Reports CRUD continuation: TC-RPT-006 through TC-RPT-010
- [ ] Investigate TC-RPT-005 "Add task" failure: check API response after clicking "Add a task", verify task addability per user
- [ ] TC-RPT-004 (closed period): needs week navigation — check if MyTasksPage has prev/next week methods
- [ ] Start accounting autotests if reports CRUD suite complete

### P1 — Reports Remaining Suites
- [x] TS-Reports-CRUD: TC-RPT-001 to TC-RPT-003 verified, TC-RPT-005 failed (3 attempts)
- [ ] TS-Reports-CRUD remaining: TC-RPT-004, TC-RPT-006 to TC-RPT-015
- [ ] TS-Reports-Confirmation: TC-RPT-016 to TC-RPT-025 (approve/reject flows)
- [ ] TS-Reports-Periods: TC-RPT-026 to TC-RPT-030
- [ ] TS-Reports-AutoReject, Notifications, Permissions, Statistics

### P2 — Accounting Autotests
- [ ] Generate page objects for Salary, Changing periods, Vacation payment, Day correction pages
- [ ] Generate data classes for accounting test cases
- [ ] Generate test specs: accounting-tc001.spec.ts through accounting-tc038.spec.ts
- [ ] Verify against qa-1 environment

### P3 — Completion
- [ ] All 98 test cases automated or marked blocked/failed with reasons
- [ ] autotest_tracking table fully populated
- [ ] Manifest updated with automation_status for all cases
- [ ] Set autonomy.stop: true when scope fully covered

### Known Issues
- **TC-RPT-005 "Add task" flow**: autocomplete requires click-suggestion→click-button flow. Task added but not appearing in grid. Needs API-level investigation (check network tab for error response).
- **"Group by project" display**: task names in grid have project prefix stripped. Query updated with CASE expression + fixed_task exclusion.

<details>
<summary>Completed Items</summary>

- [x] Parse XLSX to manifest — reports + accounting in manifest (session 94)
- [x] Framework verified — node_modules, playwright.config.ts, pages, fixtures (session 94)
- [x] TC-RPT-001: Create a time report — VERIFIED (session 94-95)
- [x] TC-RPT-002: Edit existing report — change hours — VERIFIED (session 95)
- [x] TC-RPT-003: Delete report by setting hours to 0 — VERIFIED (session 95)
- [x] TaskReportingFixture rewritten: fill→Enter→networkidle→delay→verify (session 95)
- [x] MyTasksPage.addTask updated with autocomplete suggestion click (session 95)
- [x] reportQueries.ts: findTaskToAdd updated with prefix stripping + fixed_task exclusion (session 95)
- [x] Maintenance run (session 95): 276 tracked, 137 verified (49.6%)

</details>

<details>
<summary>Completed Phase B Items (Sessions 92-94)</summary>

- [x] Generated test-docs/reports/reports.xlsx — 60 test cases, 7 suites
- [x] Generated test-docs/accounting/accounting.xlsx — 38 test cases, 6 suites
- [x] UI exploration: 6 pages, selector patterns documented
- [x] Vault enriched: reports-pages.md, accounting-pages.md

</details>
