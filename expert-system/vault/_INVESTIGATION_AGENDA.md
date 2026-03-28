# Investigation Agenda — Phase C (Autotest Generation)

## Scope: planner, t2724

### P0 — Immediate (next session)
- [ ] Complete t2724: TC-T2724-036 (info text), TC-T2724-037 (200 char limit), TC-T2724-038 (error handling) — 3 remaining
- [ ] TC-036 and TC-037 are Low priority UI tests, run on qa-1
- [ ] TC-038 (silent error handling) needs timemachine — verify frontend swallows apply errors gracefully

### P1 — Begin planner module (sessions 86-95+)
- [ ] Begin planner autotest generation: TS-PLN-Nav (TC-PLN-001 through TC-PLN-011)
- [ ] Create data classes for planner employees, projects, assignments
- [ ] Generate planner editing tests (TS-PLN-Edit, TS-PLN-DnD)
- [ ] Generate planner tracker tests (TS-PLN-Tracker, TS-PLN-TrkAdv)
- [ ] Generate planner settings and copy-table tests
- [ ] Generate bug regression tests (TS-PLN-BugReg)
- [ ] Generate planner report period tests (TS-PLN-Reports)

### P2 — Polish
- [ ] Fix flaky tests, improve selector resilience
- [ ] Verify all tests pass in headless mode on qa-1
- [ ] Phase C completion report

<details>
<summary>Completed Phase C Items (Sessions 79-85)</summary>

- [x] Parse XLSX manifest: `parse_xlsx.py` for planner + t2724
- [x] Verify autotests/ framework dependencies installed
- [x] Initialize `autotest_tracking` SQLite table
- [x] Generate + verify TC-T2724-001 through TC-T2724-010 (CRUD + permissions, sessions 79-80)
- [x] Generate + verify TC-T2724-011 through TC-T2724-015 (SPM, cross-project, Unicode, VARCHAR, multi-tag, session 81)
- [x] Generate + verify TC-T2724-016 through TC-T2724-020 (close-by-tag apply core, session 82)
- [x] Generate + verify TC-T2724-021 through TC-T2724-025 (date-scoped, no-tags, reload, settings dialog, generated assignments, session 83)
- [x] Generate + verify TC-T2724-026 through TC-T2724-030 (open-for-editing, multi-tag, blank-info, API, popup regression, session 84)
- [x] Generate + verify TC-T2724-031 through TC-T2724-035 (column header EN+RU, OK button, heavy data project, auto-refresh, task order, session 85)
- [x] Created PlannerPage, ProjectSettingsDialog page objects
- [x] Created t2724Queries.ts with 20+ query helpers
- [x] t2724 coverage: 35/38 (92.1%)

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
