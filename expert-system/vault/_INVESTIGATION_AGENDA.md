---
type: investigation
tags:
  - agenda
  - phase-a
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

## Phase A — Day-Off Knowledge Acquisition (Active)

**Scope**: day-off module only
**Approach**: Deep investigation before any test documentation generation

### P0 — Immediate
- [x] **Review existing vault notes** — read `dayoff-service-deep-dive.md`, `calendar-service-deep-dive.md`, `day-off-service-implementation.md`, `frontend-day-off-module.md`. Assessed depth — all deep and detailed. (S46)
- [x] **Mine GitLab tickets** — 25+ tickets mined across 4 keyword searches. Read descriptions AND comments. 20+ bugs documented. Created `exploration/tickets/day-off-ticket-findings.md`. (S46)
- [x] **Read code paths** — DayOffService, CalendarService, validators, permission checks, state transitions (covered in S9-S15 deep dives)

### P1 — High Priority (Next Session)
- [x] **Enrich vault notes** — expanded business rules reference with B12-B14 sections, 20 new bugs (BUG-DO-16 through BUG-DO-35). (S46)
- [ ] **Check Qase for existing day-off test cases** — verify no duplication before Phase B
- [ ] **Assess Phase A→B transition readiness** — vault has 13+ notes, 35 bugs, 6 investigation methods used. Coverage likely sufficient.
- [ ] **UI exploration: manager approval flow** — WeekendDetailsModal, approve/reject/redirect, optional approvers management in detail

### P2 — Medium Priority
- [x] **Explore UI flows** — day-off tab, reschedule modal documented in S4 and S32 (day-off-pages.md)
- [x] **API investigation** — 7 bugs found in S9 (dayoff-api-testing.md)
- [x] **DB analysis** — data patterns, conflict analysis, live test results (S13-S15)
- [ ] **Cross-module dependencies** — how day-off interacts with vacation service (partially covered via ticket findings: #2833, #3223, #2736)
- [ ] **Permission matrix** — who can create/approve/reject/delete day-offs (covered in dayoff-service-deep-dive.md §6)
- [ ] **Edge cases from tickets** — compile regression test scenarios from ticket comments (done: ticket-findings.md)

### P3 — Backlog
- [ ] **Figma comparison** — check design mockups vs actual implementation for day-off
- [ ] Other modules (vacation done, sick-leave done, reports done, statistics done, admin done)

## Phase A→B Transition Assessment

**Minimum depth requirements check:**
| Requirement | Status |
|-------------|--------|
| Module vault note 1000+ words with code snippets | ✓ dayoff-service-deep-dive (3000+ words) |
| GitLab tickets searched, bug findings documented | ✓ 25+ tickets, 35 bugs total (S46) |
| 3+ investigation methods used | ✓ Code reading, API testing, UI exploration, DB analysis, ticket mining, code analysis (6 methods) |
| Known bugs and edge cases documented with ticket refs | ✓ BUG-DO-1 through BUG-DO-35 |

**Assessment**: Day-off module is likely ready for Phase A→B transition. Key remaining check: Qase existing test cases.

## Completed Phases
<details>
<summary>Vacation module (Phases A → B → C) — completed 2026-03-23</summary>

- Phase A: 19 sessions knowledge acquisition
- Phase B v2: 3 sessions, 109 UI-first test cases generated
- Phase C v2: 12 sessions, 62 tests verified
- Lessons learned: UI-first steps, text-first selectors, BEM banned, setup steps via API, ticket comments critical
</details>
