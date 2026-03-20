# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Completed (Sessions 1-87)
<details>
<summary>Sessions 1-87 completed items (click to expand)</summary>

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
- [x] Generated TC-VAC-010 (insufficient days AV=true — negative), TC-VAC-013 (overlapping/crossing — negative)
- [x] Generated TC-VAC-027 (update APPROVED dates → status reset to NEW)
- [x] Generated TC-VAC-047 (APPROVED→REJECTED), TC-VAC-130 (schedule filters/pagination)
- [x] Discovered: ValidationException puts specific code in `message`, not `errorCode` (errorCode is always "exception.validation.fail")
- [x] Discovered: v2 availability-schedule requires `from`/`to` params (NPE without), uses `totalCount` not `totalElements`
- [x] TC-010 needed 1 fix (3yr span for AV=true balance), TC-013 needed 2 fixes (message field), TC-130 needed 2 fixes (from/to + totalCount)
- [x] All 5 tests verified passing (20 total, 11.6% vacation coverage)

</details>

## Phase C — Autotest Generation (Active)

**Current scope**: vacation (173 test cases, 20 automated = 11.6%)
**Target env**: qa-1
**Constraint**: API_SECRET_TOKEN authenticates as pvaynmaster only
**pvaynmaster office**: Персей (office_id=20, AV=true)
**Week offsets used (2026)**: 0, 3, 6, 9, 12, 15, 18, 21 (all polluted with DELETED ghosts)
**Week offsets used (2027)**: 45(tc002), 48(tc003), 51(tc045), 54(tc013), 57(tc027-orig), 60(tc027-upd), 63(tc047)
**Known issues**: crossing check counts DELETED; batch deadlocks on employee_vacation
**API error patterns**: ServiceException → specific errorCode; ValidationException → generic errorCode + specific message

## Active Items

### P0 — Next Session
- [ ] Generate next batch of vacation API tests (5 more from manifest)
  - Critical API remaining: TC-VAC-048 (APPROVED→PAID), TC-VAC-088 (pay happy path)
  - High API: TC-VAC-008 (empty login), TC-VAC-009 (missing fields), TC-VAC-011 (past date create)
  - Need JWT token for multi-user tests (accountant role for pay)
- [ ] Investigate JWT token acquisition: `get-full-jwt-token-using-pst` swagger endpoint
  - May enable authenticating as any user (accountant, different employee)

### P1 — High Priority
- [ ] Address DELETED ghost problem
  - Try vacation-test API `del-vacation-using-del` / `del-vacations-using-del` (needs correct auth)
  - Or build SQL cleanup script for DELETED/CANCELED records
- [ ] Add retry-on-500 utility for deadlock handling in batch runs
- [ ] Explore UI test generation (after API coverage improves)

### P2 — Medium Priority
- [ ] Monitor #2724 for PATCH gateway routing fix
- [ ] Monitor for new MRs / Sprint 16 activity
- [ ] Periodic cleanup of test data on qa-1

### P3 — Backlog
- [ ] #2842 — Contractor termination: stalled 2+ months
- [ ] #2954 — Sick leave working days: stalled 5+ months
- [ ] #3378 — Tracker script relocation: no dev activity
- [ ] #2876 — Vacation event feed: analytical task
- [ ] #3026 — CS office settings implementation: 3 unimplemented fields
