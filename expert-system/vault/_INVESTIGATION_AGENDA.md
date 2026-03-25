---
type: investigation
tags:
  - agenda
  - phase-b
updated: '2026-03-25'
status: active
scope: day-off
---
# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Phase B — Day-Off Test Documentation Generation (Active)

**Scope**: day-off module only
**Output**: `test-docs/day-off/day-off.xlsx` — unified workbook with Plan + TS- suites

### P0 — Immediate (Next Session)
- [ ] **Review vacation XLSX generator** — read `expert-system/generators/vacation/` for patterns, openpyxl conventions, formatting
- [ ] **Design test suites** — define TS- tabs based on feature groupings (lifecycle, approval, calendar conflicts, search, validation, etc.)
- [ ] **Enrich vault notes if gaps found** — deeper investigation for any area lacking concrete test step detail

### P1 — High Priority
- [ ] **Build generator script** — `expert-system/generators/day-off/generate.py`
- [ ] **Generate XLSX** — Plan Overview, Feature Matrix, Risk Assessment, all TS- tabs
- [ ] **Write UI-first test steps** — all test cases use browser actions, SETUP/CLEANUP for state creation via API
- [ ] **Include regression tests from bugs** — BUG-DO-1 through BUG-DO-35 (35 bugs → regression test cases)
- [ ] **Track in SQLite** — insert all test cases into `test_case_tracking`

### P2 — Quality & Completeness
- [ ] **Cross-reference with Qase** — ensure no overlap with 12 existing tangential cases
- [ ] **Review generated test cases** — verify traceability to vault notes and GitLab tickets
- [ ] **Knowledge enrichment** — deeper investigation if test step writing reveals gaps

### P3 — Backlog
- [ ] **Figma comparison** — verify UI design alignment (nice-to-have)

## Planned Test Suite Structure

Based on vault knowledge (14 notes, 35 bugs, 6 investigation methods):

| Suite | Focus | Est. Cases |
|-------|-------|-----------|
| TS-DayOff-Lifecycle | Create, edit, delete transfer request | 15-20 |
| TS-DayOff-Approval | Manager approve, reject, redirect; optional approvers | 15-20 |
| TS-DayOff-CalendarConflict | 4 conflict paths, cascade effects | 10-15 |
| TS-DayOff-Search | 8 search types, filters, columns | 10-15 |
| TS-DayOff-Validation | Form validation, boundary values, date constraints | 10-15 |
| TS-DayOff-Permissions | Role-based access, EDIT_APPROVER unconditional | 8-10 |
| TS-DayOff-Notifications | Email templates, overdue banner, auto-reject | 8-10 |
| TS-DayOff-Regression | Bug-specific regression from BUG-DO-1 to BUG-DO-35 | 20-30 |
| **Total** | | **~100-135** |

<details>
<summary>Phase A — Day-Off Knowledge Acquisition (Completed S47)</summary>

### Completed Items
- [x] Review existing vault notes — all deep and detailed (S46)
- [x] Mine GitLab tickets — 25+ tickets, 35 bugs documented (S46)
- [x] Read code paths — DayOffService, CalendarService, validators (S9-S15)
- [x] Enrich vault notes — business rules B12-B14 sections (S46)
- [x] Check Qase — 12 tangential cases, no duplication risk (S47)
- [x] Assess Phase A→B transition — all requirements met (S47)
- [x] UI exploration: manager approval flow — comprehensive documentation (S47)
- [x] Explore UI flows — day-off tab, reschedule modal (S4, S32)
- [x] API investigation — 7 bugs found (S9)
- [x] DB analysis — data patterns, conflict analysis (S13-S15)

**Final coverage: ~92%** | 14 vault notes | 35 bugs | 6 investigation methods
</details>
