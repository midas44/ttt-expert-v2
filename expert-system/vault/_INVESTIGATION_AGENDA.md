# Investigation Agenda

**Last updated:** 2026-03-26T01:05:00Z
**Phase:** C — Autotest Generation
**Module scope:** calendar-dayoff

## P0 — Next Session

- [ ] **TC-DO-030**: CPO self-approval — investigate APPROVER page table visibility timeout. May need different page object or tab navigation approach.
- [ ] **Data cleanup**: Delete old test-created dayoff requests on qa-1 to free up future date slots. All (employee, date) combos are exhausted.

## P1 — Remaining Dayoff Tests

- [ ] Continue with pending dayoff test cases from manifest (check `autotest_tracking` for next eligible)
- [ ] Review TC-DO-028/029 blocked status — consider updating XLSX test documentation to note dayoff vs vacation approval flow difference

## P2 — Cross-cutting

- [ ] Update `createNewDayoffRequest` callers across all data classes to prefer `findNewDayoffRequestWithManager` first
- [ ] Consider adding a shared cleanup utility for old test dayoff requests

## Completed (Session 54)

- [x] TC-DO-025: Add optional approver — VERIFIED
- [x] TC-DO-026: Remove optional approver — VERIFIED (major rework: UI-based add-then-remove flow)
- [x] TC-DO-028: Blocked (dayoff approve only for NEW)
- [x] TC-DO-029: Blocked (dayoff reject only for NEW)
