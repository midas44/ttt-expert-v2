---
type: meta
tags: [agenda, phase-c]
updated: 2026-03-26
status: active
---

# Investigation Agenda

**Last updated:** 2026-03-26T02:10:00Z
**Phase:** C — Autotest Generation
**Module scope:** calendar-dayoff

## P0 — Next Session (56)

- [ ] Continue with next 5 pending dayoff test cases from manifest
- [ ] Prioritize TS-DayOff-Search or TS-DayOff-Validation suites (lower-complexity UI tests, higher throughput)

## P1 — Remaining Dayoff Tests

- [ ] 93 pending test cases remain out of 121 total
- [ ] Review TC-DO-028/029/030 blocked status — consider updating XLSX test documentation to note dayoff-specific limitations
- [ ] Data cleanup: delete old test-created dayoff requests on qa-1 if date slots become exhausted

## P2 — Cross-cutting Improvements

- [ ] Update `findFreeHolidayForTransfer` callers — active calendar filter now applied (session 55)
- [ ] Consider adding shared cleanup utility for old test dayoff requests
- [ ] Sync `findEmployeeByActiveCalendar` pattern to other queries that join office_calendar

<details>
<summary>Completed (Sessions 54-55)</summary>

- [x] TC-DO-025: Add optional approver — VERIFIED
- [x] TC-DO-026: Remove optional approver — VERIFIED
- [x] TC-DO-028: Blocked (dayoff approve only for NEW)
- [x] TC-DO-029: Blocked (dayoff reject only for NEW)
- [x] TC-DO-030: Blocked (CPO self-approval not reproducible)
- [x] TC-DO-007: Verify holidays — Russia — VERIFIED (3 attempts)
- [x] TC-DO-008: Verify holidays — Cyprus — VERIFIED (1st attempt)
- [x] TC-DO-014: Transfer modal max date boundary — VERIFIED (7 attempts)
- [x] Manifest/SQLite sync (17 entries reconciled)
- [x] Session 55 maintenance: vault audit, SQLite health check
</details>
