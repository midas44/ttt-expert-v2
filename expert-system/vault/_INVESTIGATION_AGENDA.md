# Investigation Agenda

## Phase C — Autotest Generation (vacation, day-off)

### P0 — Immediate (Next Session)
- [ ] Generate vacation pending UI tests: TC-VAC-068 (also-notify notification), TC-VAC-069 (wrong payment month notification), TC-VAC-070 (auto-conversion notification)
- [ ] Generate vacation API error tests: TC-VAC-092 (invalid type), TC-VAC-094 (exception leakage), TC-VAC-095 (update without id)
- [ ] Assess notification test feasibility — do we need email MCP or can we verify via DB/timeline?

### P1 — High Priority
- [ ] Generate remaining vacation regression tests: TC-VAC-080 (approver field missing), TC-VAC-081 (validation flash), TC-VAC-082 (Russian in English events), TC-VAC-084 (calendar change converts all)
- [ ] Generate vacation API tests: TC-VAC-096 (crossing format), TC-VAC-097 (sick leave crossing), TC-VAC-098 (non-existent ID), TC-VAC-099 (invalid notifyAlso)
- [ ] TC-VAC-100 (batch deadlock) — complex concurrency test

### P2 — Lower Priority
- [ ] Review blocked tests (10 vacation + 3 day-off) — check if any can be unblocked with new patterns
- [ ] Run full regression suite to verify no flakiness across all 98 verified tests

### Completed (Session 120)
- [x] TC-VAC-083: Null optionalApprovers → NPE on CPO path (High, API) — verified
- [x] TC-VAC-055: Employees Vacation Days page — search by name (Medium, UI) — verified
- [x] TC-VAC-089: Accountant can pay but not approve (Medium, UI) — verified
- [x] TC-VAC-091: Empty request body → empty 400 response (Medium, API) — verified
- [x] TC-VAC-078: Maternity leave user can't edit vacation (#3370) (Medium, UI) — verified

<details><summary>Completed (Sessions 85-119) — 68 vacation + 25 day-off tests</summary>
See autotest_tracking table for full history.
</details>