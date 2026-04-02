---
type: coverage
updated: '2026-04-02'
---
# Knowledge Coverage — Phase B Progress

## Phase B: Test Documentation Generation

### XLSX Generation Progress (Scope: sick-leave, statistics, admin, security, cross-service)

| Module | Phase A Coverage | XLSX Status | Test Cases | Session |
|--------|-----------------|-------------|------------|---------|
| **sick-leave** | 92% | **DONE** | 71 (10 suites) | 101 |
| **statistics** | 93% | **DONE** | 76 (8 suites) | 102 |
| **admin** | 87% | **DONE** | 84 (8 suites) | 103 |
| security | 83% | Pending | — | 104 |
| cross-service | 83% | Pending | — | 105 |

### Prior Phase B Completions (before current scope)

| Module | Test Cases | Status |
|--------|-----------|--------|
| day-off | 121 | exported |
| vacation | 100 | drafted |
| planner | 82 | exported |
| reports | 60 | drafted |
| accounting | 38 | drafted |
| t2724 | 38 | exported |
| t3404 | 24 | drafted |

### Totals
- **Scope modules completed:** 3/5 (sick-leave, statistics, admin)
- **Scope test cases:** 231 (71 + 76 + 84)
- **Overall test cases:** 694 across 10 modules
- **Overall XLSX files:** 10 workbooks

### Admin Coverage Detail
- **Suites:** Projects (13), Calendars (12), Employees (9), Settings (8), Account (7), Permissions (10), PMTool (10), Regression (15)
- **Priority:** Critical=17, High=35, Medium=29, Low=3
- **Type:** UI=63 (75%), Hybrid=21 (25%)
- **Knowledge sources:** 8 vault notes, 120+ tickets mined, role-permission matrix
- **Key areas covered:** 7 admin pages, 3 project action dialogs, PM Tool sync (rate limit, field mapping, sales filter, missing employee), calendar CRUD (events, SO mapping, year logic), 10 permission roles tested, 15 regression bugs from tickets, tracker config per type, accounting period validation, CS sync issues

### Statistics Coverage Detail
- **Suites:** ClassicGeneral (12), EmployeeReports (14), NormExcess (10), ExportWSR (10), Permissions (8), HourSum (6), CacheSync (6), Regression (10)
- **Priority:** Critical=13, High=40, Medium=20, Low=3
- **Type:** UI=62 (82%), Hybrid=14 (18%)

### Sick-Leave Coverage Detail
- **Suites:** CRUD (12), Lifecycle (8), Accounting (6), Manager (6), Permissions (6), Validation (7), Regression (10), Notifications (5), FamilyMember (6), CrossPage (5)
- **Priority:** Critical=20, High=30, Medium=18, Low=3
- **Type:** UI=55 (77%), Hybrid=16 (23%)
