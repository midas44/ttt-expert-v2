# Investigation Agenda — Phase C (Autotest Generation)

## Scope: planner, t2724

### P0 — Immediate (next session)
- [ ] Continue planner: TC-PLN-021 through TC-PLN-025 (Projects tab — search, add task, delete task, DnD, task/ticket toggle)
- [ ] Leverage session 90 discoveries: use `planner__cel` filter pattern, skip `waitForTableLoaded()`

### P1 — Planner module continued (sessions 91-100+)
- [ ] Generate planner tracker tests (TS-PLN-Tracker: TC-PLN-026 to TC-PLN-035)
- [ ] Generate planner advanced tracker tests (TS-PLN-TrkAdv: TC-PLN-036 to TC-PLN-045)
- [ ] Generate planner settings and copy-table tests (TS-PLN-Settings: TC-PLN-046 to TC-PLN-055)
- [ ] Generate bug regression tests (TS-PLN-BugReg: TC-PLN-056 to TC-PLN-065)
- [ ] Generate planner report period tests (TS-PLN-Reports: TC-PLN-066 to TC-PLN-082)

### P2 — Polish
- [ ] Fix flaky tests, improve selector resilience
- [ ] Verify all tests pass in headless mode on qa-1
- [ ] Phase C completion report

<details>
<summary>Completed Phase C Items (Sessions 79-90)</summary>

- [x] Parse XLSX manifest: `parse_xlsx.py` for planner + t2724
- [x] Verify autotests/ framework dependencies installed
- [x] Initialize `autotest_tracking` SQLite table
- [x] t2724 coverage: 38/38 (100%) — sessions 79-86
- [x] Created PlannerPage, ProjectSettingsDialog page objects
- [x] Created t2724Queries.ts with 20+ query helpers
- [x] TC-PLN-001 to TC-PLN-005: navigation basics (session 87)
- [x] TC-PLN-006 to TC-PLN-010: navigation advanced (session 88)
- [x] TC-PLN-011 to TC-PLN-015: inline editing (session 89)
- [x] TC-PLN-016 to TC-PLN-020: Projects tab — open for editing, edit hours, color coding, info/tracker columns (session 90)
- [x] Key discovery: planner table loading state is perpetual, datepicker nested in thead, definitive row selector is `planner__cel` filter
- [x] Session 90 maintenance: SQLite audit clean, no duplicates, agenda refined

</details>

<details>
<summary>Completed Phase B Items (Sessions 76-78)</summary>

- [x] Phase A→B transition (session 76)
- [x] Designed and generated t2724.xlsx: 38 cases, 3+ suites
- [x] Designed and generated planner.xlsx: 82 cases, 13 suites
- [x] Cross-validated all 120 cases against Qase — zero duplication
- [x] Phase B→C transition: config.yaml updated, readiness report written

</details>

<details>
<summary>Completed Phase A Items (Sessions 67-75)</summary>

- [x] t2724 GitLab ticket deep-dive: 33 comments, 8 QA bugs, 6 MRs
- [x] Planner close-by-tag implementation analysis (23K+ words)
- [x] Planner data model: 7 DB tables mapped
- [x] 130+ GitLab tickets cataloged for planner module
- [x] API testing on qa-1: 16 close-by-tag tests
- [x] Confluence + Figma specs verified against implementation

</details>
