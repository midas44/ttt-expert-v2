# Investigation Agenda

## Priority Legend
- P0: Critical — must complete this session
- P1: High — target for next 1-2 sessions
- P2: Medium — within next 5 sessions
- P3: Low — backlog

## Completed (Sessions 1-100)
<details>
<summary>Sessions 1-100 completed items (click to expand)</summary>

### Sessions 1-83
- 83 sessions of knowledge acquisition, Phase B generation, and monitoring
- 191 vault notes, 170 analysis runs, 146 design issues, 207 exploration findings
- Phase B: 1090 test cases generated across 10 modules (all unified format)

### Sessions 84-99 (Phase C — Autotest Generation)
- 79 vacation API tests generated and verified across 16 sessions
- Key suites: TS-Vac-CRUD, TS-Vac-StatusFlow, TS-Vac-Approval, TS-Vac-Payment, TS-Vac-DayCalc, TS-Vac-APIErrors (complete)
- Major discoveries: crossing check includes DELETED, batch deadlocks, PAID terminal, UPDATE un-deletes DELETED, no API for vacation optional approvals, API_SECRET_TOKEN lacks AUTHENTICATED_USER for sick leave

### Session 100 (Phase C — 5 Vacation API Tests)
- [x] Investigated JWT token endpoint — token exchange only (needs existing CAS JWT)
- [x] Generated TC-VAC-056 (approve with crossing — blocked at creation)
- [x] Generated TC-VAC-164 (FIFO redistribution across year boundary)
- [x] Generated TC-VAC-069 (AV=false accrual formula mid-year calculation)
- [x] Generated TC-VAC-165 (edit multi-year vacation — redistribution recalculates)
- [x] Generated TC-VAC-136 (AV=true negative balance carry-over)
- [x] Discovered: crossing check fires at CREATION, not just approval (all statuses checked)
- [x] Discovered: PUT /v1/vacations requires /{id} in URL (405 without it)
- [x] Discovered: String(Date).slice(0,4) gives weekday not year (latent bug in TC-084)
- [x] All 5 tests verified passing (84 total, 48.6% vacation coverage)

### Session 101 (Phase C — 4 Generated, 2 Verified, qa-1 Outage)
- [x] Generated TC-VAC-154 (vacation days carry-over — burnOff unused) — PASS
- [x] Generated TC-VAC-157 (office calendar migration Russia→Cyprus) — PASS
- [x] Generated TC-VAC-095 (auto-pay cron trigger) — blocked by qa-1 API 502
- [x] Generated TC-VAC-153 (3-month restriction mechanism) — blocked by qa-1 API 502
- [x] Discovered: calendar_days table stores exceptions only (duration 0/7/8), not all days
- [x] Confirmed: no burn_off column in office table, no first_vacation column either
- [x] Confirmed: Russia has 6 Jan holidays vs Cyprus 1; 12 offices migrated in 2024
- [x] qa-1 full outage: ALL services 502, timemachine SSL reset — DB only accessible (86 total, 49.7%)

</details>

## Phase C — Autotest Generation (Active)

**Current scope**: vacation (173 test cases, 86 automated = 49.7%)
**Target env**: qa-1
**Constraint**: API_SECRET_TOKEN authenticates as pvaynmaster only; JWT endpoint requires existing CAS token (no arbitrary user generation)
**pvaynmaster office**: Персей (office_id=20, AV=true)
**pvaynmaster manager**: ilnitsky (but self-approves as DEPARTMENT_MANAGER)
**Week offsets used (2026)**: 0, 3, 6, 9, 12, 15, 18, 21 (polluted with DELETED ghosts)
**Week offsets used (2027-2030)**: 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 120, 128, 132, 136, 140, 144, 148, 152, 156, 160, 164, 167, 170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 200, 203, 206, 209, 212, 215, 218, 221, 224, 227, 230, 239, 242, 245
**Cross-year dates used**: 2030-12-29→2031-01-02 (TC-084), 2032-12-15→2033-01-09 (TC-164), 2035-12-18→2036-01-05 (TC-165)
**Known issues**: crossing check fires at CREATION (all statuses including NEW, DELETED); batch deadlocks on employee_vacation; PAID+EXACT vacations are permanent records; UPDATE on DELETED un-deletes; no API for vacation optional approvals; paymentMonth in past rejected at creation; PUT /pass/{id} NPEs on qa-1 (Caffeine cache bug); EmployeeWatcherServiceImpl.listRequired() is a no-op stub; API_SECRET_TOKEN lacks AUTHENTICATED_USER for sick leave endpoints; all offices have approve=report period (no gap for TC-096); JWT endpoint is token exchange only (not a generator)
**API response notes**: regularDays/administrativeDays (not days); ServiceException → specific errorCode; ValidationException → generic errorCode + specific message; approver field is full DTO object (not string login); HttpMessageNotReadableException → empty 400 body; exception field leaks full Java class name in ALL error responses; ConstraintViolationException also uses "exception.validation" + errors[]; availablePaidDays endpoint requires paymentDate param; PUT /v1/vacations requires /{id} in URL path (405 without)
**DB notes**: vacation_payment FK is on vacation.vacation_payment_id (NOT shared PK); vacation_payment.id is auto-sequence (1.4M range); vacation_approval includes primary approver row; vacation_days_distribution column is `vacation` (not vacation_id), uses FIFO from earliest balance year; office_period is in ttt_backend schema (NOT ttt_vacation); vacation.approver column (not approver_id); timeline table tracks all status events; vacation_notify_also columns: vacation, approver (not _id suffixed), required (default false); pg driver returns Date objects — use getFullYear() not String().slice(0,4); ttt_calendar.calendar_days stores EXCEPTIONS only (duration: 0=holiday, 7=shortened, 8=transferred) — standard working days are implied; no burn_off or first_vacation columns exist in ttt_vacation.office (CS settings unimplemented)

## Active Items

### P0 — Next Session
- [ ] **Verify TC-095 and TC-153** when qa-1 API recovers (code ready, just need to run)
- [ ] Re-run TC-067 to check if pass endpoint NPE is resolved
- [ ] Generate next batch of vacation tests (up to 5 from manifest)
  - TC-070 (AV=false negative balance shows 0 — UI test, may need Playwright)
  - TC-072 (AV=true negative balance allowed — UI test)
  - TC-075 (FIFO day consumption — earliest year first)
  - TC-076 (FIFO cancel returns days, redistributes)
  - TC-077 (FIFO insufficient → auto-convert to ADMINISTRATIVE)
- [ ] Begin UI test generation — at 49.7%, consider Playwright-based tests
- [ ] Fix TC-084 latent bug: String(Date).slice(0,4) gives weekday not year

### P1 — High Priority
- [ ] Start TS-Vac-Permissions suite (0/15 automated, blocked by JWT — need Playwright UI login)
  - TC-104 (employee views own), TC-105 (employee creates), TC-106 (readOnly blocked)
- [ ] Address TS-Vac-Approval suite (8/15 automated, TC-058 skipped, TC-063/064/065 done)
  - TC-067/068 blocked by pass endpoint NPE — try on timemachine
- [ ] Address TS-Vac-DayCalc suite (7/15 automated after TC-069/TC-136)
- [ ] TC-096 deferred — all offices have approve=report period, needs gap for auto-adjustment
- [ ] TC-099 needs report period advancement — try on timemachine env with clock manipulation
- [ ] TC-126 needs JWT auth — API_SECRET_TOKEN returns 403 on sick leave endpoints
- [ ] Investigate pass endpoint NPE on qa-1 — may need service restart or bug report
- [ ] Add retry-on-500 utility for deadlock handling in batch runs

### P2 — Medium Priority
- [ ] Address DELETED ghost problem
  - Try vacation-test API `del-vacation-using-del` / `del-vacations-using-del`
  - Or build SQL cleanup script for DELETED/CANCELED records
- [ ] Monitor #2724 for PATCH gateway routing fix
- [ ] Periodic cleanup of test data on qa-1
- [ ] Investigate clock manipulation on timemachine for time-dependent tests (TC-011, TC-034)

### P3 — Backlog
- [ ] #2842 — Contractor termination: stalled 2+ months
- [ ] #2954 — Sick leave working days: stalled 5+ months
- [ ] #3378 — Tracker script relocation: no dev activity
- [ ] #2876 — Vacation event feed: analytical task
- [ ] #3026 — CS office settings implementation: 3 unimplemented fields