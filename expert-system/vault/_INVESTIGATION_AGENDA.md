# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Completed (Sessions 1-88)
<details>
<summary>Sessions 1-88 completed items (click to expand)</summary>

### Sessions 1-83
- 83 sessions of knowledge acquisition, Phase B generation, and monitoring
- 191 vault notes, 170 analysis runs, 146 design issues, 207 exploration findings
- Phase B: 1090 test cases generated across 10 modules (all unified format)

### Session 84 (Phase C — Autotest Generation Start)
- [x] QMD collection migrated from v1 to v2 path
- [x] Read existing autotest framework (pages, fixtures, data, utils, reference tests)
- [x] Generated 5 vacation API test specs (TC-001, 005, 039, 040, 118)
- [x] All 5 tests verified passing on qa-1

### Session 85 (Phase C — 5 More Vacation API Tests)
- [x] Generated TC-VAC-041 (NEW→CANCELED), TC-VAC-042 (NEW→DELETED), TC-VAC-044 (APPROVED→NEW)
- [x] Generated TC-VAC-004 (past date validation), TC-VAC-006 (min duration validation)
- [x] Discovered: minimalVacationDuration = 1 (not 5), check uses working days
- [x] Discovered: PUT update body requires `id` field in JSON
- [x] All 5 tests verified (TC-006 and TC-044 required 1 fix each)

### Session 86 (Phase C — 5 More Vacation API + Day Calc Tests)
- [x] Generated TC-VAC-002 (AV=true create), TC-VAC-003 (ADMINISTRATIVE create)
- [x] Generated TC-VAC-045 (APPROVED→CANCELED), TC-VAC-071 (AV=true day calc)
- [x] Generated TC-VAC-171 (past date boundary — today/yesterday)
- [x] Discovered: pvaynmaster is in AV=true office (Персей, office_id=20)
- [x] Discovered: crossing check includes DELETED records (DELETED ghosts block future creates)
- [x] Discovered: batch runs cause PostgreSQL deadlocks on employee_vacation table
- [x] Moved data classes to 2027 offsets to avoid DELETED ghost collisions
- [x] All 5 tests verified passing individually (15 total, 8.7% vacation coverage)

### Session 87 (Phase C — 5 More Vacation API Tests)
- [x] Generated TC-VAC-010 (insufficient days AV=true), TC-VAC-013 (overlapping/crossing)
- [x] Generated TC-VAC-027 (update APPROVED dates → status reset to NEW)
- [x] Generated TC-VAC-047 (APPROVED→REJECTED), TC-VAC-130 (schedule filters/pagination)
- [x] Discovered: ValidationException puts specific code in `message`, not `errorCode`
- [x] Discovered: v2 availability-schedule requires `from`/`to` params (NPE without)
- [x] All 5 tests verified passing (20 total, 11.6% vacation coverage)

### Session 88 (Phase C — 5 More + Maintenance)
- [x] Generated TC-VAC-007 (REGULAR 5-day boundary), TC-VAC-008 (ADMINISTRATIVE 1-day)
- [x] Generated TC-VAC-014 (null paymentMonth NPE bug)
- [x] Generated TC-VAC-026 (update NEW dates), TC-VAC-030 (update PAID immutable)
- [x] Discovered: API response uses regularDays/administrativeDays (not days field)
- [x] Discovered: PAID vacation update returns 400 (permission service returns empty set)
- [x] Added queryOneOrNull() to DbClient for nullable queries
- [x] Session maintenance: backfilled generation_session, verified tracking integrity, QMD index OK
- [x] All 5 tests verified passing (25 total, 14.5% vacation coverage)

### Session 92 (Phase C — 5 Vacation Payment Tests)
- [x] Generated TC-VAC-048 (APPROVED→PAID terminal state), TC-VAC-088 (pay REGULAR with DB verification)
- [x] Generated TC-VAC-089 (pay ADMINISTRATIVE), TC-VAC-090 (wrong day split), TC-VAC-092 (pay NEW)
- [x] Discovered: vacation_payment FK is vacation.vacation_payment_id (not shared PK, auto-sequence IDs)
- [x] Discovered: PAID terminal confirmed (cancel returns 400), PAID+EXACT cannot be deleted
- [x] TC-088 required 1 fix (DB column names and FK pattern)
- [x] All 5 tests verified passing (45 total, 26.0% vacation coverage)

</details>

## Phase C — Autotest Generation (Active)

**Current scope**: vacation (173 test cases, 45 automated = 26.0%)
**Target env**: qa-1
**Constraint**: API_SECRET_TOKEN authenticates as pvaynmaster only
**pvaynmaster office**: Персей (office_id=20, AV=true)
**Week offsets used (2026)**: 0, 3, 6, 9, 12, 15, 18, 21 (polluted with DELETED ghosts)
**Week offsets used (2027-2029)**: 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 120, 128, 132, 136, 140, 144, 148, 152, 156, 160
**Known issues**: crossing check counts DELETED; batch deadlocks on employee_vacation; PAID+EXACT vacations are permanent records
**API response notes**: regularDays/administrativeDays (not days); ServiceException → specific errorCode; ValidationException → generic errorCode + specific message
**DB notes**: vacation_payment FK is on vacation.vacation_payment_id (NOT shared PK); vacation_payment.id is auto-sequence (1.4M range)

## Active Items

### P0 — Next Session
- [ ] Generate next batch of vacation API tests (5 more from manifest)
  - Critical API remaining: TC-VAC-069 (AV=false accrual), TC-VAC-164 (FIFO redistribution)
  - High API: TC-VAC-046 (canBeCancelled guard), TC-VAC-056 (approve crossing blocked)
  - High API: TC-VAC-057 (optional approvers on create), TC-VAC-091 (pay already PAID)
  - Medium: TC-VAC-082 (available days endpoint), TC-VAC-121 (non-existent vacation 404)
- [ ] Investigate JWT token acquisition: `get-full-jwt-token-using-pst` swagger endpoint
  - Unlocks: accountant role, different-user tests, AV=false office employees
  - Priority over individual tests — would unlock 20+ permission-based test cases

### P1 — High Priority
- [ ] Address DELETED ghost problem
  - Try vacation-test API `del-vacation-using-del` / `del-vacations-using-del`
  - Or build SQL cleanup script for DELETED/CANCELED records
- [ ] Add retry-on-500 utility for deadlock handling in batch runs
- [ ] Explore UI test generation (after API coverage reaches ~30%)

### P2 — Medium Priority
- [ ] Monitor #2724 for PATCH gateway routing fix
- [ ] Periodic cleanup of test data on qa-1
- [ ] Investigate clock manipulation on timemachine for time-dependent tests (TC-011)

### P3 — Backlog
- [ ] #2842 — Contractor termination: stalled 2+ months
- [ ] #2954 — Sick leave working days: stalled 5+ months
- [ ] #3378 — Tracker script relocation: no dev activity
- [ ] #2876 — Vacation event feed: analytical task
- [ ] #3026 — CS office settings implementation: 3 unimplemented fields
