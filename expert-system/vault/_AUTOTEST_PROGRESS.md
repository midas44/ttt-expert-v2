# Autotest Progress

## Overall Coverage (vacation module)

| Status | Count | % |
|--------|-------|---|
| Verified | 27 | 24.8% |
| Failed | 1 | 0.9% |
| Blocked | 1 | 0.9% |
| Pending | 80 | 73.4% |
| **Total** | **109** | |

## Session History

| Session | Tests | Verified | Failed | Blocked |
|---------|-------|----------|--------|---------|
| 28 | 5 | 5 | 0 | 0 |
| 29 | 5 | 5 | 0 | 0 |
| 30 | 5 | 4 | 1 | 0 |
| 31 | 3 | 3 | 0 | 0 |
| 32 | 2 | 2 | 0 | 0 |
| 33 | 2 | 2 | 0 | 0 |
| 34 | 5 | 5 | 0 | 0 |
| 35 | 4 | 4 | 0 | 0 |
| 36 | 5 | 4 | 0 | 1 |

## Blocked Tests
- **TC-VAC-023**: Restore CANCELED vacation — no CANCELED vacations in qa-1 DB. Status 'CANCELED' exists in enum but 0 rows. Options: self-contained test (create→cancel→restore) or environment setup.

## Failed Tests
- **TC-VAC-009**: (from session 30) — needs reattempt

## Verified Tests (by suite)
### TS-Vac-CRUD
TC-001, TC-002, TC-003, TC-004, TC-005, TC-006, TC-007, TC-008, TC-010, TC-011, TC-016, TC-017, TC-018

### TS-Vac-ViewFilter
TC-012, TC-013, TC-014, TC-015

### TS-Vac-Lifecycle
TC-023 (blocked)

### TS-Vac-Approval
TC-024, TC-025, TC-026, TC-027, TC-028, TC-029, TC-030, TC-031, TC-032, TC-033, TC-034

## Shared Infrastructure Created
- **Page Objects**: MyVacationsPage, VacationCreateDialog, VacationDetailsDialog
- **Fixtures**: LoginFixture, LogoutFixture, MainFixture, HeaderNavigationFixture, VerificationFixture, VacationDeletionFixture
- **Query Functions**: findRandomEmployee, findEmployeeWithVacationDays, findEmployeeWithVacation, findEmployeeWithColleague, findEmployeeWithMultipleVacations, findEmployeeWithMixedTypeVacations, findEmployeeWithMultiYearBalance, countVacationNotifyAlso, findEmployeeWithManager, findVacationId, findNonCpoEmployeeWithManager, findCpoEmployeeWithManager, hasVacationConflict, findEmployeeWithOpenAndClosedVacations