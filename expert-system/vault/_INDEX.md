---
type: index
updated: '2026-04-02'
---

# Vault Index

## Architecture
- [[system-overview]] — High-level architecture
- [[frontend-architecture]]
- [[backend-architecture]]
- [[database-schema]] — Schema overview
- [[security-patterns]] — Auth mechanisms, filter chain, token model, API bypass patterns
- [[auth-authorization-doc]] — Developer doc analysis, dual auth, @PreAuthorize patterns
- [[roles-permissions]] — 11 global roles, permission matrix
- [[deployment-architecture]]
- [[rabbitmq-messaging]]
- [[websocket-events]]

## Modules
- [[vacation-service-deep-dive]]
- [[frontend-vacation-module]]
- [[sick-leave-service-deep-dive]] — Dual status model, validation, permissions, lifecycle, familyMember flag (#3408)
- [[sick-leave-service-implementation]] — Backend lifecycle, dual status, bugs, file handling
- [[frontend-sick-leave-module]] — Routes, modals, state management, 10 tech debt items
- [[dayoff-service-deep-dive]] — Day-off lifecycle, auto-rejection, calendar integration
- [[ttt-report-service-deep-dive]] — Reports service
- [[frontend-report-module]] — Reports frontend
- [[accounting-service-deep-dive]]
- [[frontend-accounting-module]]
- [[frontend-planner-module]] — Planner frontend
- [[planner-assignment-backend]] — Planner backend
- [[frontend-statistics-module]] — Classic + Employee Reports, budgetNorm display, Confluence spec, permission matrix
- [[statistics-service-implementation]] — Norm calc (personal/budget), cache sync, excess detection, code snippets
- [[admin-panel-deep-dive]] — Project CRUD, PM Tool sync, calendar CRUD, CS sync, Sprint 15-16 tickets
- [[cross-service-integration]] — CS sync (3 mechanisms), RabbitMQ, WebSocket, trackers, PM Tool, stability
- [[calendar-service-deep-dive]]
- [[email-notification-deep-dive]]

## Patterns
- [[email-notification-triggers]] — Notification patterns and triggers
- [[period-management-pattern]] — Office period model

## Analysis
- [[role-permission-matrix]]
- [[reports-business-rules-reference]]
- [[vacation-business-rules-reference]]
- [[sick-leave-dayoff-business-rules-reference]] — Sick leave + day-off rules, state×action×role matrix, known bugs
- [[office-period-model]]
- [[qase-coverage-audit]] — 258 suites/1116 cases total. Statistics=0, Security=0, Cross-service=1 (critical gaps)
- [[qase-dedup-strategy]]
- [[admin-statistics-schema-deep-dive]] — 30 tables across 4 schemas, data quality issues (Session 100)

## Exploration
### UI Flows
- [[reports-pages]] — My Tasks + Confirmation page structure, selectors
- [[accounting-pages]] — Salary, Changing periods, Vacation payment, Correction pages
- [[dayoff-pages]] — Day-off page selectors
- [[planner-pages]] — Planner selectors
- [[vacation-my-vacations-pages]] — Vacation page selectors
- [[sick-leave-accounting-workflow]] — Accounting page columns, action buttons, dual status confirmed

### API Findings
- [[report-crud-api-testing]] — Reports API
- [[accounting-api-testing]]
- [[statistics-api-surface]] — 23 statistic endpoints + Employee Reports DTOs
- [[sick-leave-api-surface]] — 7 sick leave endpoints + DTOs, force param, dual status
- [[cross-env-reference-data-comparison]] — 9 endpoints identical qa-1 vs stage (Session 100)

### Data Findings
- [[ttt-backend-schema-deep-dive]] — 40 tables, employee model, roles, scheduled tasks
- [[vacation-schema-deep-dive]]
- [[cross-service-office-sync-divergence]]
- [[db-data-overview-tm]]
- [[admin-statistics-schema-deep-dive]] — DB schema deep-dive: employee, project_member, statistic_report

### Tickets
- [[vacation-ticket-findings]]
- [[sick-leave-ticket-findings]] — 45+ tickets + Sprint 16 familyMember flag (#3408/#3409)
- [[day-off-ticket-findings]]
- [[reports-ticket-findings]]
- [[accounting-ticket-findings]]
- [[planner-ticket-findings]]
- [[statistics-ticket-findings]] — 180+ tickets + Sprint 15-16: Employee Reports, budgetNorm, partial-month norm
- [[admin-ticket-findings]] — 120+ tickets + Sprint 15-16: PM Tool integration, calendar validation
- [[security-ticket-findings]] — 85 tickets: API bypass pattern, cross-office leakage, JWT lifecycle
- [[cross-service-ticket-findings]] — 75+ tickets + Sprint 15-16: confirmation-statistics gap, CS sync

## External
### Requirements
- [[confluence-overview]] — Confluence page index
- 25 requirement notes in `external/requirements/`

### Designs
- [[figma-sprint-14-15-designs]]

### Existing Tests
- [[qase-overview]]

## Test Documentation (Phase B)
- `test-docs/sick-leave/sick-leave.xlsx` — 71 cases, 10 suites (Session 101)
- `test-docs/statistics/statistics.xlsx` — 76 cases, 8 suites (Session 102)
- `test-docs/admin/admin.xlsx` — 84 cases, 8 suites (Session 103)
- `test-docs/vacation/vacation.xlsx` — 100 cases, 10 suites
- `test-docs/day-off/day-off.xlsx` — 121 cases
- `test-docs/planner/planner.xlsx` — 82 cases
- `test-docs/reports/reports.xlsx` — 60 cases
- `test-docs/accounting/accounting.xlsx` — 38 cases
- `test-docs/t2724/t2724.xlsx` — 38 cases
- `test-docs/t3404/t3404.xlsx` — 24 cases

## Investigations
- 28 investigation notes in `investigations/` (bug analyses, deep dives, verifications)

## Branches
- 2 branch analysis notes in `branches/`
