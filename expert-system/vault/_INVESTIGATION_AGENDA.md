---
type: agenda
updated: 2026-03-26
phase: C
scope: t3404
---

# Investigation Agenda — Ticket #3404

## Status: PHASE C COMPLETE

All 24 test cases have been processed (21 verified, 3 blocked).
No further investigation or generation work needed for this scope.

<details>
<summary>Completed Items (Sessions 55-60)</summary>

### Phase A (Session 55)
- [x] Read ticket #3404 with all comments
- [x] Analyze MR !5333 code changes (4 frontend files)
- [x] Map approve period → edit icon visibility logic
- [x] Document BUG-T3404-1 (> vs >= boundary)
- [x] Create vault notes for day-off module

### Phase B (Session 55)
- [x] Generate t3404.xlsx with 24 test cases across 5 suites
- [x] Parse XLSX to manifest JSON

### Phase C (Sessions 56-60)
- [x] P0: TC-016 core earlier date selection
- [x] P0: TC-001 EN tooltip, TC-002 EN dialog title
- [x] P1: TC-004/005 edit icon open period, TC-006/008 closed period
- [x] P1: TC-007 boundary approve period start
- [x] P1: TC-009 previous year all hidden
- [x] P1: TC-010/011 closed months disabled, TC-012 open month enabled
- [x] P1: TC-013 future month enabled, TC-015 March 2 boundary
- [x] P1: TC-016/017 earlier date + first working day
- [x] P1: TC-018 February all disabled
- [x] P2: TC-003 RU tooltip, TC-014 Feb 28 boundary
- [x] P2: TC-019 future minDate uses original date (ST-4)
- [x] P2: TC-023 max date Dec 31 unchanged
- [x] P1: TC-020 E2E reschedule + approval flow
- [x] Blocked: TC-021 (env admin), TC-022 (cross-service), TC-024 (data limitation)
- [x] Fixed data source: calendar_days + LATEST_CAL CTE (not employee_dayoff)
- [x] Fixed two-user CAS SSO logout flow

</details>
