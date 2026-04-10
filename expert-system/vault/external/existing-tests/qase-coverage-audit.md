---
type: external
tags: [qase, test-coverage, audit, gap-analysis]
created: 2026-04-02
updated: 2026-04-02
status: active
related: ["[[frontend-statistics-module]]", "[[admin-panel-deep-dive]]", "[[sick-leave-service-deep-dive]]", "[[security-patterns]]", "[[cross-service-integration]]"]
branch: release/2.1
---

# Qase Test Coverage Audit — TIMEREPORT Project

**Audit date:** 2026-04-02 (Session 98)
**Project totals:** 258 suites, 1,116 test cases

## Coverage for Our 5 Modules

| Module | Suites | Test Cases | Coverage Level |
|--------|--------|------------|----------------|
| Statistics | 1 (empty) | 0 | **NONE — complete gap** |
| Admin | ~24 | ~143 | MODERATE |
| Security/Permissions | 0 | 0 (7-10 incidental) | **NONE — critical gap** |
| Sick Leave | ~16 | ~59 | PARTIAL |
| Cross-Service | 0 | 1 | **NONE — critical gap** |
| **Total** | ~41 | ~203 | |

## Detailed Findings

### Statistics — 0 Test Cases
Suite 182 "Статистика" exists as an empty placeholder. Zero child suites, zero test cases. No coverage for:
- Statistics report generation/viewing
- Employee Reports page (budgetNorm, excess, comments)
- Export functionality
- Statistics permissions

### Admin — ~143 Test Cases
Moderate coverage under suite 183 "Админка":
- **Projects (suites 184-191):** ~83 cases — well-covered (CRUD, history, transfer)
- **Calendar management (suites 197-202):** ~26 cases
- **Employees (suites 192-193):** ~12 cases — thin
- **Parameters (suites 194-196):** ~10 cases — parameter editing suite EMPTY
- **API tokens (suites 203-205):** ~12 cases
- **Export (suite 206):** 0 cases — empty

**Gaps:** Parameter editing (0), Export (0), Office management (none), Role assignment (none), Bulk operations (none)

### Security — 0 Dedicated Test Cases
No dedicated security/permissions suites. Only 7-10 incidental permission checks scattered across other suites:
- Suite 197: 3 cases mentioning VIEW_ALL
- Suite 203: 1 case for admin role
- Suite 185: 3 cases mentioning "owner, senior manager or manager"

**No systematic testing of:** RBAC, menu visibility per role, API authorization, cross-role isolation, permission escalation, JWT handling

### Sick Leave — ~59 Test Cases
Partial coverage:
- **Color indication (6 suites × 3 cases):** 18 cases across My Tasks, Confirmation, Planner
- **Accounting management (suites 229-234):** ~27 cases (sort/filter, table, actions, alerts)
- **Email notifications (suite 248):** 14 cases
- **Employee self-service (suites 273, 276):** 0 cases — **EMPTY placeholders**

**Gaps:** Employee CRUD lifecycle (create/edit/upload), status transitions, overlap with vacation, manager view, overdue alerts, date validation

### Cross-Service — 1 Test Case
Only 1 case: "Работа в Noveo (периоды работы сотрудника)" mentioning CompanyStaff API.

**No coverage for:** Employee sync, project sync, calendar integration, email service, cross-service data consistency, sync failures, data propagation

## Phase B Impact

Our test documentation will:
- **Statistics:** Entirely new coverage (no conflicts)
- **Security:** Entirely new systematic coverage (no conflicts)
- **Cross-Service:** Entirely new coverage (no conflicts)
- **Sick Leave:** Fill the employee CRUD gap, extend existing 59 cases
- **Admin:** Substantially extend existing 143 cases (params, export, office, roles)

**Note:** Existing Qase cases are mostly title-only (no steps/preconditions/descriptions). All marked `automation: 0`, `isToBeAutomated: false`. Our XLSX with detailed steps and preconditions will be significantly more actionable.
