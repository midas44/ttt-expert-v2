# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Completed (Sessions 1-27)
<details>
<summary>Sessions 1-26 completed items (click to expand)</summary>

### Sessions 1-23
- Knowledge acquisition, Phase B generation
- 191 vault notes, 170 analysis runs, 146 design issues, 207 exploration findings
- Phase B: 1090 test cases generated across 10 modules (all unified format)
- Phase C sessions 20-23: Generated TC-001–TC-010, TC-013–TC-018 (13 verified, 5 blocked)

### Session 24
- TC-VAC-013 through TC-018 (5 verified, 3 blocked)
- Discovered response wrapper structure, error field inconsistency, both NPE bugs active

### Session 25 (5 Verified, 0 Blocked)
- TC-VAC-021, TC-039–TC-042 — all passed first run
- Session 25 maintenance: SQLite audit, manifest sync

### Session 26 (5 Verified, 0 Blocked)
- TC-VAC-043, TC-044, TC-045, TC-047, TC-048 — StatusFlow transitions
- Discovered PUT update requires id in body, pay body format, concurrent deadlocks

</details>

### Session 27 (Phase C — 5 Verified, 0 Blocked)
- [x] TC-VAC-049 (CANCELED→NEW re-open, API/Medium) — PASS first run
- [x] TC-VAC-052 (Invalid NEW→PAID, API/Medium) — PASS first run
- [x] TC-VAC-055 (Timeline event verification, API/Medium) — PASS first run
- [x] TC-VAC-022 (notifyAlso list, API/Medium) — PASS second run (bigint type fix)
- [x] TC-VAC-023 (invalid notifyAlso login, API/Medium) — PASS first run
- [x] Manifest/SQLite sync for TC-002–005

## Phase C — Autotest Generation (Active)

**Vacation scope**: 28/173 verified (16.2%), 4 blocked, 141 pending
**Target env**: qa-1
**Constraint**: API_SECRET_TOKEN authenticates as pvaynmaster only; @CurrentUser DTO validator rejects other logins on create
**pvaynmaster office**: Persej (office_id=20, AV=true)
**pvaynmaster manager**: ilnitsky (but self-approves as DEPARTMENT_MANAGER)
**Week offsets used (2026)**: 0, 3, 6, 9, 12, 15, 18, 21 (polluted with DELETED ghosts)
**Week offsets used (2027-2031)**: 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 120, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164, 167, 170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 200, 203, 206, 209, 212, 215, 218, 221, 224, 227, 230, 239, 242, 245, 248, 251, 257, 260, 263, 266, 269, 272, 275, 278
**Cross-year dates used**: 2030-12-29→2031-01-02 (TC-084), 2032-12-15→2033-01-09 (TC-164), 2035-12-18→2036-01-05 (TC-165), 2037-12-22→2038-01-09 (TC-161)
**Known issues**: (see session 24 briefing for full list)
**Timeline table**: ttt_vacation.timeline — event_type (VACATION_CREATED/APPROVED/etc.), vacation FK, event_time, previous_status (nullable)
**vacation_notify_also**: FK column named `approver` (misleading) points to employee.id; `required` bool (false for notify-only)
**DB bigint → JS string**: PostgreSQL bigint returns as string in pg driver; use Number() for comparisons
**API findings (session 25)**: Approve/reject/cancel all PUT no body; soft delete returns DELETED status via GET; available days returns plain number

## Active Items

### P0 — Next Session
- [ ] **TS-Vac-Create remaining**: TC-024 (comment), TC-025 (long comment)
- [ ] **TS-Vac-Update start**: TC-026 (update dates of NEW), TC-027 (update APPROVED → resets to NEW), TC-028 (update CANCELED → re-opens)

### P1 — High Priority (Vacation Unblocking)
- [ ] **Implement CAS per-user login fixture** — unlocks 16 vacation permission tests
  - TC-053, TC-104-117: permission boundary tests
  - Blocked by: need test user credentials (not just pvaynmaster)
- [ ] **Timemachine env support** — unlocks 6+ clock-dependent tests
  - TC-011, TC-034, TC-046, TC-101, TC-135, TC-140, TC-142
  - TC-046 specifically needs paymentDate before report period (canBeCancelled guard)
  - Requires: `autotest.target_env: timemachine` + clock manipulation API
- [ ] **CS sync for maternity/transfer** — unlocks 18 tests
  - TC-081, TC-131-134, TC-139, TC-143-152, TC-159-160
- [ ] **TC-056 (crossing on approve)** — blocked by single-user constraint
  - Crossing check runs on both create and update, preventing overlap setup
  - Needs multi-user support or direct DB manipulation

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