---
type: exploration
tags:
  - api
  - cross-env
  - reference-data
  - qa-1
  - stage
created: '2026-04-02'
updated: '2026-04-02'
status: active
branch: release/2.1
---
# Cross-Environment Reference Data Comparison (qa-1 vs stage)

## Summary
Session 100: Compared 9 reference data API endpoints between qa-1 and stage. **All identical** — no Sprint 15/16 changes to static enum/lookup data.

## Endpoints Compared

| Endpoint | qa-1 | stage | Result |
|----------|------|-------|--------|
| GET /project-statuses | 7 values | 7 values | IDENTICAL |
| GET /project-types | 9 values | 9 values | IDENTICAL |
| GET /decimal-separator-types | 2 values | 2 values | IDENTICAL |
| GET /project-models | 3 values (FP, T&M, ODC) | 3 values | IDENTICAL |
| GET /quote-types | 2 values | 2 values | IDENTICAL |
| GET /val-separator-types | 3 values | 3 values | IDENTICAL |
| GET /country-codes | 249 entries | 249 entries | IDENTICAL |
| GET /roles (no param) | 400 error | 400 error | IDENTICAL error |
| GET /info (no param) | 400 error | 400 error | IDENTICAL error |

## Key Reference Values

**Project Statuses:** ACTIVE, FINISHED, UNCONFIRMED, SUSPENDED, ACCEPTANCE, WARRANTY, CANCELED
**Project Types:** PRODUCTION, LEARNING, ADMINISTRATION, COMMERCIAL, IDLE_TIME, INTERNAL, INVESTMENT, INVESTMENT_WITHOUT_INVOICING, PROJECT_MANAGER
**Project Models:** FP, T&M, ODC

## Implication
Sprint 15/16 changes are strictly in business logic (budgetNorm, familyMember, PM Tool) — not in reference data. All enum-based validations in test cases can use the same values across environments.

Links: [[statistics-api-surface]], [[admin-panel-deep-dive]], [[cross-service-integration]]
