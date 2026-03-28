# Investigation Agenda — Phase C (Autotest Generation)

## Scope: planner, t2724

### P0 — Immediate (next session)
- [ ] Continue t2724: TC-T2724-011 through TC-T2724-015 (senior mgr CRUD, cross-project, special chars, long tags, multiple tags)
- [ ] TC-T2724-011 needs query for senior_manager login on a project
- [ ] TC-T2724-013 (Unicode/Cyrillic) and TC-T2724-014 (VARCHAR 255) are fast — no new page objects needed
- [ ] TC-T2724-015 (multiple tags) creates 5+ tags sequentially, verifies order

### P1 — Near-term (sessions 82-85)
- [ ] Complete t2724 Apply suite: TC-T2724-016 through TC-T2724-028 (tag application to tasks, auto-close behavior)
- [ ] Apply suite requires new page objects for assignment viewing and apply button
- [ ] TC-T2724-029 (API direct call) is a hybrid test — uses request context
- [ ] Begin t2724 Regression suite: TC-T2724-030 through TC-T2724-038

### P2 — Planner autotest generation (sessions 86-95+)
- [ ] Begin planner autotest generation: TS-PLN-Nav (TC-PLN-001 through TC-PLN-011)
- [ ] Create data classes for planner employees, projects, assignments
- [ ] Generate planner editing tests (TS-PLN-Edit, TS-PLN-DnD)
- [ ] Generate planner tracker tests (TS-PLN-Tracker, TS-PLN-TrkAdv)
- [ ] Generate planner settings and copy-table tests
- [ ] Generate bug regression tests (TS-PLN-BugReg)
- [ ] Generate planner report period tests (TS-PLN-Reports)

### P3 — Polish
- [ ] Fix flaky tests, improve selector resilience
- [ ] Verify all tests pass in headless mode on qa-1
- [ ] Phase C completion report

<details>
<summary>Completed Phase C Items (Sessions 79-80)</summary>

- [x] Parse XLSX manifest: `parse_xlsx.py` for planner + t2724
- [x] Verify autotests/ framework dependencies installed
- [x] Initialize `autotest_tracking` SQLite table
- [x] Generate + verify TC-T2724-001: Create tag happy path
- [x] Generate + verify TC-T2724-002: Duplicate tag idempotent
- [x] Generate + verify TC-T2724-003: Blank tag validation
- [x] Generate + verify TC-T2724-004: Inline edit happy path
- [x] Generate + verify TC-T2724-005: Inline edit Escape cancels
- [x] Generate + verify TC-T2724-006: Edit tag to duplicate — validation error
- [x] Generate + verify TC-T2724-007: Delete tag happy path
- [x] Generate + verify TC-T2724-008: List tags empty state
- [x] Generate + verify TC-T2724-009: Permission — employee cannot access tag mgmt
- [x] Generate + verify TC-T2724-010: PM can CRUD tags full cycle
- [x] Created PlannerPage page object (selectRoleFilter, selectProject, clickProjectSettingsIcon, isProjectSettingsIconVisible)
- [x] Created ProjectSettingsDialog page object (tag CRUD + inline edit + delete methods)
- [x] Created t2724Queries.ts (findProjectWithManager, findProjectWithNoTags, findProjectWithPlainMember, listCloseTags, tagExists)
- [x] Wrote selector discoveries to vault (planner-project-settings-selectors.md)
- [x] Discovered: project_member table (not planner_assignment), permission model exclusions

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
