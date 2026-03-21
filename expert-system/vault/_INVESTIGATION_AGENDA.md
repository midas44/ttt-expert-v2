# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Completed (Sessions 1-105)
<details>
<summary>Sessions 1-105 completed items (click to expand)</summary>

### Sessions 1-83
- 83 sessions of knowledge acquisition, Phase B generation, and monitoring
- 191 vault notes, 170 analysis runs, 146 design issues, 207 exploration findings
- Phase B: 1090 test cases generated across 10 modules (all unified format)

### Sessions 84-104 (Phase C — Vacation Autotest Generation)
- 100 vacation tests generated and verified across 21 sessions
- Key suites: TS-Vac-CRUD, TS-Vac-StatusFlow, TS-Vac-Approval, TS-Vac-Payment, TS-Vac-DayCalc, TS-Vac-APIErrors (complete), TS-VAC-AVMultiYear
- Major discoveries: crossing check includes DELETED, batch deadlocks, PAID terminal, UPDATE un-deletes DELETED, no API for vacation optional approvals, API_SECRET_TOKEN lacks AUTHENTICATED_USER for sick leave, timeline PAID audit gap confirmed

### Session 105 (Phase C — 3 Verified + Full Vacation Triage)
- [x] TC-VAC-163 (future vacations affect display, hybrid UI+API+DB) — PASS
- [x] TC-VAC-172 (past-date validation error key, API) — PASS
- [x] TC-VAC-102 (timeline audit gap for PAID events, DB read-only) — PASS
- [x] Fixed TC-037/TC-076 tracking (were verified session 104, tracking missed)
- [x] Triaged all 64 remaining pending vacation tests → 64 blocked with specific reasons
- [x] **Vacation scope COMPLETE**: 100 verified, 67 blocked, 5 skipped, 1 covered, 0 pending

</details>

## Phase C — Autotest Generation (Active)

**Vacation scope**: COMPLETE (100/173 verified = 57.8%, 0 pending)
**Target env**: qa-1
**Constraint**: API_SECRET_TOKEN authenticates as pvaynmaster only; @CurrentUser DTO validator rejects other logins on create
**pvaynmaster office**: Persej (office_id=20, AV=true)
**pvaynmaster manager**: ilnitsky (but self-approves as DEPARTMENT_MANAGER)
**Week offsets used (2026)**: 0, 3, 6, 9, 12, 15, 18, 21 (polluted with DELETED ghosts)
**Week offsets used (2027-2031)**: 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 120, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164, 167, 170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 200, 203, 206, 209, 212, 215, 218, 221, 224, 227, 230, 239, 242, 245, 248, 251, 257, 260, 263, 266, 269, 272, 275, 278
**Cross-year dates used**: 2030-12-29→2031-01-02 (TC-084), 2032-12-15→2033-01-09 (TC-164), 2035-12-18→2036-01-05 (TC-165), 2037-12-22→2038-01-09 (TC-161)
**Known issues**: (see session 104 briefing for full list)
**Timeline column note**: event_time (not created_at)

## Active Items

### P0 — Next Session
- [ ] **Switch scope to sick-leave module** — vacation is complete, sick-leave is next in priority_order
  - Requires config change: `autotest.scope: sick-leave`
  - Parse sick-leave XLSX if not in manifest
  - Assess feasibility with pvaynmaster auth (API_SECRET_TOKEN lacks AUTHENTICATED_USER for sick leave — may need workaround)

### P1 — High Priority (Vacation Unblocking)
- [ ] **Implement CAS per-user login fixture** — unlocks 16 vacation permission tests
  - TC-053, TC-104-117: permission boundary tests
  - Reuse TC-162 CAS login pattern with parameterized username
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