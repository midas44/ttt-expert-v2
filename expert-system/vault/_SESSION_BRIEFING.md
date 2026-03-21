---
session: 0
phase: generation
updated: '2026-03-21'
scope: vacation
---
# Phase B Restart — Vacation Module (UI-First)

## Phase Transition
- **Previous phase**: Phase C (autotest_generation) — sessions 1-28
- **Current phase**: Phase B (generation) — restarting from scratch
- **Scope**: vacation module only (`phase.scope: vacation`)
- **Reason for restart**: Phase B XLSX test documentation had API-centric test steps (POST /api/...) instead of UI-first browser actions. All generated XLSX, autotests, generators, and tracking data have been deleted. Instructions updated to mandate UI-first test steps.

## Key Context for Phase B
- The knowledge base (vault) is intact from Phase A + Phase C discoveries
- `vacation-service-deep-dive.md` contains valuable business logic BUT also has "Autotest Notes" sections from Phase C — read for validation rules/state machines, ignore API token constraints
- Test steps must describe **browser actions** (login, navigate, click, fill, verify) — NOT raw API calls
- API steps only for: test endpoints (clock manipulation), DB verification, features with no UI
- Preconditions should include SQL query hints for dynamic test data generation
- `API_SECRET_TOKEN` authenticates as its **owner** (pvaynmaster on qa-1) — this is relevant for Phase C but NOT for Phase B test step design

## What Needs to Happen
1. Enrich vacation knowledge — explore UI via Playwright to document page flows, button labels, form fields, dialog behaviors
2. Write Python generator script for vacation XLSX
3. Generate `test-docs/vacation/vacation.xlsx` with UI-first test steps
4. Track cases in `test_case_tracking` table
