---
type: investigation
tags:
  - agenda
  - phase-b
updated: '2026-03-21'
status: active
scope: vacation
---
# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Phase B — Vacation Test Documentation (Active)

**Scope**: vacation module only
**Approach**: UI-first test steps — describe browser actions, not API calls

### P0 — Immediate
- [ ] **Explore vacation UI flows via Playwright** — document page structure, button labels, form fields, dialog names for: My Vacations page, vacation creation dialog, vacation edit, approval actions, payment flow
- [ ] **Write vault notes** for UI flows discovered → `exploration/ui-flows/vacation-pages.md`
- [ ] **Review existing vault knowledge** — read `vacation-service-deep-dive.md` for validation rules, state transitions, permission checks (skip "Autotest Notes" sections which are Phase C-specific)

### P1 — High Priority
- [ ] **Define test suites** — group vacation test cases into logical suites (CRUD, Approval, StatusFlow, DayCalc, Payment, Permissions, etc.)
- [ ] **Write Python generator** — `expert-system/generators/vacation/generate.py` with UI-first test steps
- [ ] **Generate vacation.xlsx** — unified workbook in `test-docs/vacation/`
- [ ] **Track in SQLite** — populate `test_case_tracking` for all generated cases

### P2 — Medium Priority
- [ ] **Verify test steps against live UI** — spot-check that described UI flows match actual application behavior
- [ ] **Check Qase for existing coverage** — ensure no duplication with existing test suites
- [ ] **Knowledge enrichment** — if gaps found during generation, investigate via code/API/DB and update vault

### P3 — Backlog (Other Modules — Not In Scope)
- [ ] sick-leave, day-off, reports, statistics, accounting, admin, planner, security, cross-service
- [ ] These await `phase.scope: all` or individual scope changes

## Completed Phases
<details>
<summary>Phase A (Sessions 1-19) — Knowledge Acquisition</summary>

- 191 vault notes, 170 analysis runs, 146 design issues, 207 exploration findings
- Coverage target reached, auto-transitioned to Phase B
</details>

<details>
<summary>Phase B v1 (Sessions 20-105) — Test Documentation (API-centric, DEPRECATED)</summary>

- Generated 1,090 test cases across 10 modules as XLSX workbooks
- **Problem**: test steps were written as raw API calls (POST /api/...) instead of UI actions
- All XLSX, generators, and tracking data deleted on 2026-03-21
- Restarting Phase B with UI-first instructions
</details>

<details>
<summary>Phase C v1 (Sessions 20-28) — Autotest Generation (DEPRECATED)</summary>

- Generated 33 verified API-based tests for vacation module
- **Problem**: all tests used API calls because XLSX steps were API-centric; all hardcoded to pvaynmaster due to API_SECRET_TOKEN constraint
- All generated tests, data classes, and tracking deleted on 2026-03-21
- Phase C will restart after Phase B v2 completes
</details>
