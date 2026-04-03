# Investigation Agenda — Phase C (Autotest Generation)

## Scope: vacation, day-off (`autotest.scope`)

### P0 — Next Session Immediate

- [ ] Vacation validation remaining: TC-VAC-039, TC-VAC-041..044, TC-VAC-046
- [ ] Vacation regression: TC-VAC-072, TC-VAC-075..084
- [ ] Vacation filters: TC-VAC-050..054

### P1 — Vacation API & Permissions (High Priority)

- [ ] TC-VAC-091..100: API error handling (empty body, invalid type, missing fields, exception leakage, deadlock)
- [ ] TC-VAC-013 (delete PAID+NON-EXACT), TC-VAC-014 (soft delete), TC-VAC-022 (approval resets on edit)

### P2 — Remaining Unblocked Tests

- [ ] Check for any remaining pending tests not in the above groups
- [ ] Revisit failed tests in planner/reports if scope expands

### P3 — Knowledge Write-Back (ongoing)

- [ ] Document discovered selectors in vault
- [ ] Update UI flow notes with confirmed patterns
- [ ] Log data patterns for test data generation

### Blocked (not actionable on qa-1)

- TC-VAC-064..067: Notification infra broken (RabbitMQ/EMAIL_ASYNC)
- TC-VAC-090: Accounting period manipulation (needs timemachine)
- TC-VAC-024: Combined approval+payment orchestration
- TC-VAC-026: External calendar service mock
- TC-VAC-055: Disabled employee data missing
- TC-VAC-058: Balance exhaustion exceeds system limits

<details>
<summary>Completed Items (Session 115)</summary>

- [x] TC-VAC-040: 3-month restriction new employee — verified (2 attempts, calendar widget fix)
- [x] TC-VAC-045: Accrued days validation auto-conversion — verified (3 attempts, multi-vacation setup for pvaynmaster)
- [x] TC-VAC-056: Latin name search bug #3297 — verified (1 attempt, new VacationDaysPage)
- [x] TC-VAC-073: Edit shows 0 available #3014-21 — verified (1 attempt)
- [x] TC-VAC-074: Redirect status not reset #2718 — verified (2 attempts, pagination fix)
- [x] Session 115 maintenance: manifest-SQLite sync (166 entries), coverage audit

</details>

<details>
<summary>Completed Items (Session 114)</summary>

- [x] TC-VAC-085: Owner can edit own vacation (not PAID) — verified (1 attempt)
- [x] TC-VAC-086: Owner cannot edit PAID vacation — verified (1 attempt)
- [x] TC-VAC-087: Non-approver cannot approve — verified (2 attempts, SQL fix)
- [x] TC-VAC-088: ReadOnly user server rejection — verified (3 attempts)
- [x] TC-VAC-071: Overlapping vacations blocked #3240 — verified (1 attempt)
- [x] TC-VAC-090: canBeCancelled guard — BLOCKED (period manipulation)

</details>

<details>
<summary>Completed Items (Session 110)</summary>

- [x] TC-VAC-030: Delete PAID+EXACT blocked — verified (3 attempts, accept [400,403])
- [x] TC-VAC-032: Auto-pay expired APPROVED cron — verified (1 attempt, smoke test)
- [x] TC-VAC-057: AV=true full year balance — verified (4 attempts, UI≠DB fix, breakdown fallback)
- [x] TC-VAC-059: AV=false monthly accrual no negative — verified (2 attempts, schema fix)
- [x] TC-VAC-058: AV=true negative balance — BLOCKED (can't exhaust 82-day balance within system limits)

</details>

<details>
<summary>Completed Items (Session 109)</summary>

- [x] TC-VAC-029: PAID vacation terminal state — verified
- [x] TC-VAC-027: Payment validation wrong day sum — verified
- [x] TC-VAC-028: Cannot pay NEW vacation — verified
- [x] TC-VAC-031: Payment month closed period blocked — verified
- [x] TC-VAC-033: Error 500 AV=true negative balance — verified

</details>

<details>
<summary>Completed Items (Sessions 106-108, reports scope)</summary>

- [x] Reports CRUD: TC-RPT-001..004, 006, 008..012, 014..020 — 17 verified
- [x] ConfirmationPage, ApiReportSetupFixture, reportQueries — all created

</details>
