# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Completed (Sessions 1-25)
<details>
<summary>Sessions 1-24 completed items (click to expand)</summary>

### Sessions 1-23
- Knowledge acquisition, Phase B generation
- 191 vault notes, 170 analysis runs, 146 design issues, 207 exploration findings
- Phase B: 1090 test cases generated across 10 modules (all unified format)
- Phase C sessions 20-23: Generated TC-001–TC-010, TC-013–TC-018 (13 verified, 5 blocked)

### Session 24
- TC-VAC-013 through TC-018 (5 verified, 3 blocked)
- Discovered response wrapper structure, error field inconsistency, both NPE bugs active

</details>

### Session 25 (Phase C — 5 Verified, 0 Blocked)
- [x] TC-VAC-021 (available days decrease, API) — PASS first run
- [x] TC-VAC-039 (NEW→APPROVED, API/Critical) — PASS first run
- [x] TC-VAC-040 (NEW→REJECTED, API/Critical) — PASS first run
- [x] TC-VAC-041 (NEW→CANCELED, API/High) — PASS first run
- [x] TC-VAC-042 (NEW→DELETED, API/High) — PASS first run
- [x] Session 25 maintenance (every 5 sessions): SQLite audit, manifest sync, agenda update

## Phase C — Autotest Generation (Active)

**Vacation scope**: 18/173 verified (10.4%), 5 blocked, 150 pending
**Target env**: qa-1
**Constraint**: API_SECRET_TOKEN authenticates as pvaynmaster only; @CurrentUser DTO validator rejects other logins on create
**pvaynmaster office**: Persej (office_id=20, AV=true)
**pvaynmaster manager**: ilnitsky (but self-approves as DEPARTMENT_MANAGER)
**Week offsets used (2026)**: 0, 3, 6, 9, 12, 15, 18, 21 (polluted with DELETED ghosts)
**Week offsets used (2027-2031)**: 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 120, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164, 167, 170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 200, 203, 206, 209, 212, 215, 218, 221, 224, 227, 230, 239, 242, 245, 248, 251, 257, 260, 263, 266, 269, 272, 275, 278
**Cross-year dates used**: 2030-12-29→2031-01-02 (TC-084), 2032-12-15→2033-01-09 (TC-164), 2035-12-18→2036-01-05 (TC-165), 2037-12-22→2038-01-09 (TC-161)
**Known issues**: (see session 24 briefing for full list)
**Timeline column note**: event_time (not created_at)
**API findings (session 25)**: Approve/reject/cancel all PUT no body; soft delete returns DELETED status via GET; available days returns plain number

## Active Items

### P0 — Next Session
- [ ] **TS-Vac-StatusFlow continued**: TC-043 (REJECTED→APPROVED), TC-044 (APPROVED→CANCELED), TC-045 (APPROVED→REJECTED by approver)
- [ ] **TS-Vac-Create remaining**: TC-022 (notifyAlso list), TC-023 (invalid notifyAlso)
- [ ] **TS-Vac-Update start**: TC-026 (update dates of NEW), TC-027 (update APPROVED → resets to NEW)

### P1 — High Priority (Vacation Unblocking)
- [ ] **Implement CAS per-user login fixture** — unlocks 16 vacation permission tests
  - TC-053, TC-104-117: permission boundary tests
  - Blocked by: need test user credentials (not just pvaynmaster)
- [ ] **Timemachine env support** — unlocks 6 clock-dependent tests
  - TC-011, TC-034, TC-101, TC-135, TC-140, TC-142
  - Requires: `autotest.target_env: timemachine` + clock manipulation API
- [ ] **CS sync for maternity/transfer** — unlocks 18 tests
  - TC-081, TC-131-134, TC-139, TC-143-152, TC-159-160

### P2 — Medium Priority
- [ ] Address DELETED ghost problem
- [ ] Monitor #2724 for PATCH gateway routing fix
- [ ] Periodic cleanup of test data on qa-1
- [ ] Add retry-on-500 utility for deadlock handling in batch runs

### P3 — Backlog
- [ ] #2842 — Contractor termination: stalled 2+ months
- [ ] #2954 — Sick leave working days: stalled 5+ months
- [ ] #3378 — Tracker script relocation: no dev activity
- [ ] #2876 — Vacation event feed: analytical task
- [ ] #3026 — CS office settings implementation: 3 unimplemented fields