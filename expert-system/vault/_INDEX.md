---
type: index
updated: '2026-04-17'
last_session: '136'
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

## Integrations (cross-system)
- [[ttt-cs-sync]] — CS (Company Staff) → TTT one-way sync (employees, salary offices, maternity-leave, dismissal events). 7 documented bugs.
- [[ttt-pmt-sync]] — PMT (Project Management Tool) → TTT one-way sync (project records / project settings). Stub — expand on demand.

## CS — Company Staff (UI-only secondary SUT)
- [[cs/_overview]] — CS at a glance: access, accounts (slebedev/pvaynmaster), nav, roles, framework fingerprints
- [[cs/employee-profile]] — Employee edit page, 5 cards (HR/Admin/Accountant/Manager/Personnel), Accountant-card timeline, event-add wizard
- [[cs/salary-offices]] — Salary offices page, 32-office inventory, Current/Archive, year selector on vacation policy, inline edit, archive/unarchive
- [[cs/employee-transfer]] — Transfer workflow: 11 checklist items across 3 tabs, Change/Retrieve, Complete the process
- [[cs/employee-hiring]] — Add new employee: New → Registration in progress → Ready to publish → Published; 5-role card approvals
- [[cs/ui-automation-notes]] — CAS SSO quirks, cookie-clear for role switch, InnovationLab popup blocker, multiselect/datepicker/masked-phone patterns, selector library

## PMT — Project Management Tool (UI-only secondary SUT)
- [[pmt/_overview]] — PMT at a glance: access (pvaynmaster admin), role (source-of-truth for project records), scope for expert system (UI-only, on-demand)
- [[pm-tool-integration-deep-dive]] — TTT-side PM Tool integration deep dive: 2-phase ID mapping, Sprint 15 sync mechanics
- [[pm-tool-sync-implementation]] — TTT-side PM Tool sync implementation walkthrough (launcher, synchronizer, failed-entity table)
- [[pm-tool-stage-comparison]] — PM Tool behavior differences between release/2.1 and stage branches

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
- [[cron-job-live-verification]] — Cron test endpoints (which exist, return payloads, behaviour when fired off-schedule)

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

### Ticket-scoped investigations
- [[exploration/tickets/t3423-investigation]] — Ticket #3423 pinned preamble + audit log. Cron & Startup Jobs Testing Collection — 23 jobs across ttt/vacation/calendar/email. Collection-shaped output at `test-docs/collections/cron/`. Phase C gated off.
- [[exploration/tickets/3083-ticket-findings]] — Tickets #3083 + #3286 — PM Tool sync field contract (11 PMT-owned fields, append-only presales merge, immutable accounting_name, event-history rules). Feeds cron job 23 testing.
- [[exploration/tickets/3262-ticket-findings]] — Tickets #3178/#3262/#3303/#3337/#3345/#3346 — employee_projects + statistic_report cache pattern for cron jobs 18, 19, 21, 22. 8 bugs, 18 seed TCs.

## External
### Requirements
- [[confluence-overview]] — Confluence page index
- 25 requirement notes in `external/requirements/`

### Designs
- [[figma-sprint-14-15-designs]]

### Existing Tests
- [[qase-overview]]

### Other externals
- [[external/EXT-cron-jobs]] — Cron jobs inventory (code-verified): schedulers, lock names, cron expressions, log markers, timing constants, template keys. Session 131: all 21 implemented jobs now code-verified; documented Unleash feature-toggle gates (CS_SYNC, PM_TOOL_SYNC), startup-only full-sync wiring, job 22 INFO-level error-logging bug.

## Test Documentation (Phase B)
- `test-docs/sick-leave/sick-leave.xlsx` — 71 cases, 10 suites (Session 101)
- `test-docs/statistics/statistics.xlsx` — 76 cases, 8 suites (Session 102)
- `test-docs/admin/admin.xlsx` — 84 cases, 8 suites (Session 103)
- `test-docs/vacation/vacation.xlsx` — 127 cases, 18 suites (100 baseline + 27 cron TCs across 8 `TS-Vac-Cron-*` suites, session 135)
- `test-docs/day-off/day-off.xlsx` — 121 cases
- `test-docs/planner/planner.xlsx` — 82 cases
- `test-docs/reports/reports.xlsx` — 80 cases (60 baseline + 20 cron TCs across 2 `TS-Reports-Cron*` suites, session 136)
- `test-docs/accounting/accounting.xlsx` — 38 cases
- `test-docs/t2724/t2724.xlsx` — 38 cases
- `test-docs/t3404/t3404.xlsx` — 24 cases
- `test-docs/collections/absences/absences.xlsx` — curated collection (absences)
- `test-docs/collections/cron/{cron.xlsx, test-plan.md, coverage.md}` — ticket #3423 collection (Phase B in progress; 16/23 rows covered via 47 TCs; `COL-cron` active; session 136)

## Investigations
- 28 investigation notes in `investigations/` (bug analyses, deep dives, verifications)

## Branches
- 2 branch analysis notes in `branches/`
