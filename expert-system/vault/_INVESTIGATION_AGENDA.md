---
type: agenda
updated: '2026-04-02'
---
# Investigation Agenda — Phase B (Test Documentation Generation)

## Scope: sick-leave, statistics, admin, security, cross-service

### P0 — Next Session (104) — Security XLSX

- [ ] **Knowledge enrichment** — re-read security-patterns, role-permission-matrix, JWT auth, API token model, OWASP-relevant patterns
- [ ] **Qase check** — verify 0 existing security cases
- [ ] **Define test suites** — plan TS-Security-AuthModel, TS-Security-RoleMatrix, TS-Security-APIBypass, TS-Security-CrossOffice, TS-Security-TokenPerms
- [ ] **Write generator** — `expert-system/generators/security/generate.py`
- [ ] **Generate XLSX** — `test-docs/security/security.xlsx`
- [ ] **Track cases** — insert into test_case_tracking

### P1 — Session 105 — Cross-Service XLSX

- [ ] **Knowledge enrichment** — CS sync divergence, MQ events, data model discrepancies, office sync across 3 services
- [ ] **Define test suites** — plan TS-CrossService-CSSync, TS-CrossService-DataDivergence, TS-CrossService-EventPropagation
- [ ] **Write generator** — `expert-system/generators/cross-service/generate.py`
- [ ] **Generate XLSX** — `test-docs/cross-service/cross-service.xlsx`
- [ ] **Track cases** — insert into test_case_tracking

### P2 — Phase B Completion Check (Session 105-106)

- [ ] Review all 12+ XLSX workbooks for completeness
- [ ] Verify all modules in scope have coverage
- [ ] Log Phase B readiness report to _SESSION_BRIEFING.md
- [ ] If auto_phase_transition: transition to Phase C for autotest.scope modules

<details>
<summary>Completed Items (Phase B, Sessions 101-103)</summary>

**Session 103:**
- [x] Admin context: vault notes read (8 key sources), Qase check (0 cases), 120+ tickets already mined
- [x] Admin UI verified on qa-1 via Playwright (logged in as pvaynmaster)
- [x] 8 test suites defined: Projects, Calendars, Employees, Settings, Account, Permissions, PMTool, Regression
- [x] Generator written: `expert-system/generators/admin/generate.py`
- [x] XLSX generated: `test-docs/admin/admin.xlsx` — 84 test cases
- [x] SQLite tracked: 84 records in test_case_tracking

**Session 102:**
- [x] Statistics: 8 suites, 76 test cases in `test-docs/statistics/statistics.xlsx`

**Session 101:**
- [x] Sick-leave: 10 suites, 71 test cases in `test-docs/sick-leave/sick-leave.xlsx`

</details>

<details>
<summary>Completed Items (Phase A, Sessions 96-100)</summary>

**Session 96-100:** Phase A knowledge acquisition for all 5 modules — 87.6% coverage, 500+ tickets mined, cross-env comparison, SQLite maintenance. See session 100 briefing for details.

</details>
