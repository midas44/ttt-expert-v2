---
type: index
updated: '2026-04-02'
---

# Vault Index

## Architecture
- [[architecture-overview]]
- [[frontend-architecture]]
- [[backend-architecture]]
- [[security-patterns]] — Auth mechanisms, filter chain, token model, API bypass patterns
- [[auth-authorization-doc]] — Developer doc analysis, dual auth, @PreAuthorize patterns

## Modules
- [[vacation-service-deep-dive]]
- [[frontend-vacation-module]]
- [[sick-leave-service-deep-dive]] — Dual status model, validation, permissions, lifecycle, familyMember flag (#3408)
- [[day-off-module]]
- [[reports-service-deep-dive]]
- [[frontend-reports-module]]
- [[accounting-service-deep-dive]]
- [[frontend-accounting-module]]
- [[planner-module]]
- [[frontend-statistics-module]] — Classic + Employee Reports, budgetNorm display, Confluence spec, permission matrix
- [[statistics-service-implementation]] — Norm calc (personal/budget), cache sync, excess detection, code snippets
- [[admin-panel-deep-dive]] — Project CRUD, PM Tool sync, calendar CRUD, CS sync, Sprint 15-16 tickets
- [[cross-service-integration]] — CS sync (3 mechanisms), RabbitMQ, WebSocket, trackers, PM Tool, stability

## Patterns
- [[notification-patterns]]
- [[permission-model]]
- [[period-management-pattern]]

## Analysis
- [[role-permission-matrix]]

## Exploration
### UI Flows
- [[reports-pages]] — My Tasks + Confirmation page structure, selectors for Phase C
- [[accounting-pages]] — Salary, Changing periods, Vacation payment, Correction pages structure

### API Findings
- [[vacation-api-testing]]
- [[reports-api-testing]]
- [[accounting-api-testing]]
- [[statistics-api-surface]] — 23 statistic endpoints + Employee Reports DTOs (budgetNorm, excess, reportedStatus)
- [[sick-leave-api-surface]] — 7 sick leave endpoints + DTOs, force param, dual status in API

### Data Findings
- [[database-schema-overview]]

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
- [[confluence-requirements]]
- [[figma-designs]]
- [[qase-existing-tests]]

## Decisions
- [[business-rules-reference]]
- [[reports-business-rules-reference]]

- [[qase-coverage-audit]] — 258 suites/1116 cases total. Statistics=0, Security=0, Cross-service=1 (critical gaps)
