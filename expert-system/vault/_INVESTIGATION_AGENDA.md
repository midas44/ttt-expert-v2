# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Completed (Sessions 1-103)
<details>
<summary>Sessions 1-103 completed items (click to expand)</summary>

### Sessions 1-83
- 83 sessions of knowledge acquisition, Phase B generation, and monitoring
- 191 vault notes, 170 analysis runs, 146 design issues, 207 exploration findings
- Phase B: 1090 test cases generated across 10 modules (all unified format)

### Sessions 84-99 (Phase C — Autotest Generation)
- 79 vacation API tests generated and verified across 16 sessions
- Key suites: TS-Vac-CRUD, TS-Vac-StatusFlow, TS-Vac-Approval, TS-Vac-Payment, TS-Vac-DayCalc, TS-Vac-APIErrors (complete)
- Major discoveries: crossing check includes DELETED, batch deadlocks, PAID terminal, UPDATE un-deletes DELETED, no API for vacation optional approvals, API_SECRET_TOKEN lacks AUTHENTICATED_USER for sick leave

### Session 100 (Phase C — 5 Vacation API Tests)
- [x] Generated TC-VAC-056, TC-VAC-164, TC-VAC-069, TC-VAC-165, TC-VAC-136 — all verified
- [x] Discovered: crossing check fires at CREATION, PUT requires /{id}, String(Date).slice(0,4) bug

### Session 101 (Phase C — 4 Generated, 2 Verified, qa-1 Outage)
- [x] TC-VAC-154 (burnOff unused) PASS, TC-VAC-157 (calendar migration) PASS
- [x] TC-VAC-095, TC-VAC-153 generated but blocked by qa-1 API 502 outage

### Session 102 (Phase C — 2 Fixed + 2 New, 90 total)
- [x] TC-VAC-095, TC-VAC-153 fixed and verified
- [x] TC-VAC-170, TC-VAC-018 generated and verified

### Session 103 (Phase C — 4 Verified + 1 Blocked, 94 total)
- [x] TC-VAC-169 (update past date validation) — PASS
- [x] TC-VAC-173 (year-end balance unbounded sum) — PASS (API /years filters zero-balance years)
- [x] TC-VAC-137 (multi-year FIFO verification) — PASS
- [x] TC-VAC-161 (availablePaidDays after cross-year vacation) — PASS
- [x] TC-VAC-019 blocked: @CurrentUser DTO validator rejects non-pvaynmaster login on create
- [x] TC-VAC-017 blocked: same @CurrentUser constraint
- [x] Session 20 maintenance: SQLite audit, no duplicates/orphans found

</details>

## Phase C — Autotest Generation (Active)

**Current scope**: vacation (173 test cases, 94 automated = 54.3%)
**Target env**: qa-1
**Constraint**: API_SECRET_TOKEN authenticates as pvaynmaster only; @CurrentUser DTO validator rejects other logins on create
**pvaynmaster office**: Персей (office_id=20, AV=true)
**pvaynmaster manager**: ilnitsky (but self-approves as DEPARTMENT_MANAGER)
**Week offsets used (2026)**: 0, 3, 6, 9, 12, 15, 18, 21 (polluted with DELETED ghosts)
**Week offsets used (2027-2031)**: 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 120, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164, 167, 170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 200, 203, 206, 209, 212, 215, 218, 221, 224, 227, 230, 239, 242, 245, 248, 251, 257, 260
**Cross-year dates used**: 2030-12-29→2031-01-02 (TC-084), 2032-12-15→2033-01-09 (TC-164), 2035-12-18→2036-01-05 (TC-165), 2037-12-22→2038-01-09 (TC-161)
**Known issues**: crossing check fires at CREATION (all statuses including NEW, DELETED); batch deadlocks on employee_vacation; PAID+EXACT vacations are permanent records; UPDATE on DELETED un-deletes; no API for vacation optional approvals; paymentMonth in past rejected at creation; PUT /pass/{id} NPEs on qa-1 (Caffeine cache bug — still broken session 102); EmployeeWatcherServiceImpl.listRequired() is a no-op stub; API_SECRET_TOKEN lacks AUTHENTICATED_USER for sick leave endpoints; all offices have approve=report period (no gap for TC-096); JWT endpoint is token exchange only (not a generator); API_SECRET_TOKEN bypasses hasAccess() ownership checks (blocks all permission tests); @CurrentUser DTO validator rejects non-pvaynmaster login on create (blocks TC-019, TC-017, all different-user create tests)
**API response notes**: regularDays/administrativeDays (not days); ServiceException → specific errorCode; ValidationException → generic errorCode + specific message; approver field is full DTO object (not string login); HttpMessageNotReadableException → empty 400 body; exception field leaks full Java class name in ALL error responses; ConstraintViolationException also uses "exception.validation" + errors[]; availablePaidDays endpoint requires paymentDate param; PUT /v1/vacations requires /{id} in URL path (405 without)
**DB notes**: vacation_payment FK is on vacation.vacation_payment_id (NOT shared PK); vacation_payment.id is auto-sequence (1.4M range); vacation_approval columns: id, vacation, employee, status (NO required, NO approver column); vacation_days_distribution column is `vacation` (not vacation_id), uses FIFO from earliest balance year; office_period is in ttt_backend schema (NOT ttt_vacation); vacation.approver column (not approver_id); timeline table tracks all status events; vacation_notify_also columns: vacation, approver (not _id suffixed), required (default false); pg driver returns Date objects — use getFullYear() not String().slice(0,4); ttt_calendar.calendar_days stores EXCEPTIONS only (duration: 0=holiday, 7=shortened, 8=transferred) — standard working days are implied; no burn_off or first_vacation columns exist in ttt_vacation.office (CS settings unimplemented); employee table: first_date (not first_day); API /vacationdays/{login}/years filters out zero-balance years from response
**Test API path pattern**: `/v1/test/vacations/<action>` (NOT `/test/<action>`)

## Active Items

### P0 — Next Session
- [ ] **Strategic decision: expand scope beyond vacation**
  - Vacation feasible API tests nearly exhausted (72 pending but most blocked by auth/env)
  - Option A: Switch scope to sick-leave module (next in priority_order)
  - Option B: Implement CAS login via Playwright for per-user tests (unlocks ~20 vacation tests)
  - Option C: Switch target_env to timemachine for clock-dependent tests (TC-011, TC-034, TC-135)

### P1 — High Priority (Blocked — need strategy decision)
- [ ] **TS-Vac-Permissions suite (0/15 automated)** — blocked by API_SECRET_TOKEN bypassing hasAccess() + @CurrentUser
  - TC-053, TC-104, TC-105, TC-106, TC-107, TC-110, TC-111, TC-113, TC-116
  - Need CAS per-user login (Playwright UI) or per-user JWT tokens
- [ ] **Different-user create tests** — blocked by @CurrentUser DTO validator
  - TC-019 (regular employee auto-approver), TC-017 (readOnly user)
- [ ] **Pass endpoint NPE** — blocks TC-067, TC-068
  - PUT /v1/vacations/pass/{id} returns 500 on qa-1
- [ ] **Clock-dependent tests** — need timemachine env
  - TC-011 (next-year before Feb 1), TC-034 (update bypasses next-year), TC-135 (nextYearAvailableFromMonth)
- [ ] **Complex employee state tests**
  - TC-085 (new employee <3 months), TC-132 (SO transfer), TC-138 (norm deviation)
  - TC-139, TC-148, TC-152 (maternity tests)
- [ ] TC-096 — all offices have approve=report period, needs gap for auto-adjustment
- [ ] TC-099 needs report period advancement
- [ ] TC-126 needs JWT auth for sick leave endpoints

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
