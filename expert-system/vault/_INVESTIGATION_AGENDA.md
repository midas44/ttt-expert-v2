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

## Phase B — Day-Off Test Documentation Generation (COMPLETE)

**Status**: COMPLETE — 121 test cases generated in `test-docs/day-off/day-off.xlsx`

### Completed Items (Session 49 — Quality Review)
- [x] **Gap analysis** — compared 99-case XLSX against all vault knowledge (14 notes, 35 bugs)
- [x] **Optional approver voting** — added TC-DO-100–104 (voting + constraint validation)
- [x] **Missing search types** — added TC-DO-105–108 (ON_PAID, DELEGATED_TO_ME, sorting, pagination)
- [x] **Calendar edge cases** — added TC-DO-109–110 (half-day boundary, Path A orphan verification)
- [x] **Validation gaps** — added TC-DO-111–113 (all-null, maxDate boundary, sick leave overlap)
- [x] **Permission gap** — added TC-DO-118 (non-owner/non-approver security exception)
- [x] **Notification events** — added TC-DO-114–117 (date change, approver change, optional approver, banner broadcast)
- [x] **Regression gaps** — added TC-DO-119–121 (BUG-DO-15, BUG-DO-26, #3223 second regression)
- [x] **Regenerated XLSX** — 121 cases, 8 suites, 14 risks

### Completed Items (Session 48 — Initial Generation)
- [x] **Build generator script** — `expert-system/generators/day-off/generate.py`
- [x] **Generate XLSX** — initial 99 cases across 8 suites
- [x] **Track in SQLite** — all cases in `test_case_tracking`

## Pending — Human Decision Required

### Option A: Phase C Transition (Day-Off Autotests)
- [ ] Human reviews XLSX quality and coverage (121 cases)
- [ ] Set `phase.current: autotest_generation` in config.yaml
- [ ] Parse XLSX into manifest
- [ ] Begin Phase C autotest generation for day-off

### Option B: Phase B for Next Module
- [ ] Choose next module (vacation, sick-leave, reports, etc.)
- [ ] Update `phase.scope` in config.yaml
- [ ] Run Phase A→B cycle for the new module

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

**Final coverage: ~95%** | 14 vault notes | 35 bugs | 6 investigation methods
</details>
