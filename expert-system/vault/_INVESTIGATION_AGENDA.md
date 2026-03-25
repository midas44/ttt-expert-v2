---
type: investigation
tags:
  - agenda
  - phase-a
updated: '2026-03-23'
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
- [ ] **Review existing vault notes** — read `dayoff-service-deep-dive.md`, `calendar-service-deep-dive.md`, `day-off-service-implementation.md`, `frontend-day-off-module.md`. Assess depth and gaps.
- [ ] **Mine GitLab tickets** — search all day-off/calendar related issues. Read descriptions AND comments. Document findings in `exploration/tickets/day-off-ticket-findings.md`
- [ ] **Read code paths** — DayOffService, CalendarService, validators, permission checks, state transitions

### P1 — High Priority
- [ ] **Explore UI flows** — My vacations and days off page (day-off tab), creation dialog, approval flow, admin views. Document in `exploration/ui-flows/day-off-pages.md`
- [ ] **API investigation** — test day-off CRUD endpoints, error responses, validation rules
- [ ] **DB analysis** — day-off tables, calendar tables, FK relationships, data distribution
- [ ] **Enrich vault notes** — expand to 1500+ words per note with code snippets, validation rules, boundary values

### P2 — Medium Priority
- [ ] **Cross-module dependencies** — how day-off interacts with vacation service, calendar, reporting
- [ ] **Permission matrix** — who can create/approve/reject/delete day-offs
- [ ] **Edge cases from tickets** — compile all corner cases from GitLab comments into test scenarios
- [ ] **Figma comparison** — check design mockups vs actual implementation

### P3 — Backlog
- [ ] Other modules (vacation already done, sick-leave, reports, etc.)

## Completed Phases
<details>
<summary>Vacation module (Phases A → B → C) — completed 2026-03-23</summary>

- Phase A: 19 sessions knowledge acquisition
- Phase B v2: 3 sessions, 109 UI-first test cases generated
- Phase C v2: 12 sessions, 62 tests verified
- Lessons learned: UI-first steps, text-first selectors, BEM banned, setup steps via API, ticket comments critical
</details>
