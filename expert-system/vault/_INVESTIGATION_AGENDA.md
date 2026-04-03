# Investigation Agenda — Phase C (Autotest Generation)

## Scope: vacation, day-off (`autotest.scope`)

### P0 — Next Session Immediate

- [ ] Vacation payment/transition remaining: TC-VAC-030 (delete PAID+EXACT API), TC-VAC-032 (auto-pay cron API)
- [ ] Vacation day balance: TC-VAC-057 (AV=true full year), TC-VAC-058 (AV=true negative), TC-VAC-059 (AV=false monthly)
- [ ] Vacation FIFO: TC-VAC-060 (earliest year first), TC-VAC-061 (redistribution on cancel)

### P1 — Vacation Notifications & Regression (High Priority)

- [ ] TC-VAC-064..070: Notification tests (create→approver, approve→employee, reject, cancel, also-notify, wrong payment month, auto-conversion)
- [ ] TC-VAC-071..084: Regression tests (overlapping not blocked, payment month edit, edit shows 0 available, redirect status, ghost conflicts, etc.)

### P2 — Vacation Permissions & Advanced

- [ ] TC-VAC-085..090: Permission tests (owner edit, non-approver, ReadOnly, accountant, canBeCancelled guard)
- [ ] TC-VAC-039..046: Date and validation tests (next year, 3-month restriction, payment month range, holiday impact)
- [ ] TC-VAC-050..054: Table/filter tests (column filter, sort, footer, availability chart)

### P3 — Vacation API & Edge Cases

- [ ] TC-VAC-091..100: API error handling (empty body, invalid type, missing fields, exception leakage, deadlock)
- [ ] TC-VAC-013 (delete PAID+NON-EXACT), TC-VAC-014 (soft delete), TC-VAC-022 (approval resets on edit)

### P4 — Knowledge Write-Back (ongoing)

- [ ] Document discovered selectors in vault
- [ ] Update UI flow notes with confirmed patterns
- [ ] Log data patterns for test data generation

<details>
<summary>Completed Items (Session 109)</summary>

- [x] TC-VAC-029: PAID vacation terminal state — verified (3 attempts, fixed status code expectations)
- [x] TC-VAC-027: Payment validation wrong day sum — verified (1 attempt)
- [x] TC-VAC-028: Cannot pay NEW vacation — verified (1 attempt)
- [x] TC-VAC-031: Payment month closed period blocked — verified (1 attempt)
- [x] TC-VAC-033: Error 500 AV=true negative balance — verified (2 attempts, ghost conflict fix)
- [x] ApiVacationSetupFixture: added payVacation, createApproveAndPay, rawPut, rawDelete

</details>

<details>
<summary>Completed Items (Sessions 106-108, reports scope)</summary>

- [x] Reports CRUD: TC-RPT-001..004, 006, 008..012, 014..020 — 17 verified
- [x] ConfirmationPage, ApiReportSetupFixture, reportQueries — all created
- [x] Phase B total: 845 cases across 12 modules

</details>
