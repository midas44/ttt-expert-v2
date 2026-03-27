# Autotest Progress — Phase C

## Overall Status (2026-03-27, Session 68)

| Module | Total | Verified | Blocked | Pending | Coverage |
|--------|-------|----------|---------|---------|----------|
| vacation | 100 | 19 | 1 | 80 | 19% |
| day-off | 121 | 0 | 0 | 121 | 0% |
| **Total** | **221** | **19** | **1** | **201** | **8.6%** |

## Verified Tests by Session

### Session 65 (5 verified)
- TC-VAC-001: View personal vacation list
- TC-VAC-002: View vacation balance per year
- TC-VAC-003: Create REGULAR vacation — happy path
- TC-VAC-004: Create ADMINISTRATIVE vacation
- TC-VAC-005: Edit NEW vacation dates

### Session 66 (5 verified, 1 blocked)
- TC-VAC-006: Delete NEW vacation
- TC-VAC-007: View vacation details in read-only modal
- TC-VAC-008: Filter vacation list by status
- TC-VAC-009: Filter vacation list by year
- TC-VAC-010: blocked (pagination — insufficient data)
- TC-VAC-011: Verify vacation creation notification

### Session 67 (5 verified)
- TC-VAC-012: Manager approve vacation
- TC-VAC-013: Manager reject vacation
- TC-VAC-014: Verify approval changes status to APPROVED
- TC-VAC-015: Verify rejection reason saved in DB
- TC-VAC-016: Verify manager sees pending requests count

### Session 68 (5 verified)
- TC-VAC-019: CPO self-approval on create
- TC-VAC-020: Change approver (redirect request)
- TC-VAC-025: Pay APPROVED REGULAR vacation
- TC-VAC-034: Start date in past — rejected
- TC-VAC-036: Insufficient available days — REGULAR blocked

## Reusable Artifacts Created
- **Page Objects**: MyVacationsPage, VacationCreationDialog, VacationDetailsDialog, EmployeeRequestsPage, VacationPaymentPage, MainPage
- **Fixtures**: LoginFixture, LogoutFixture, VerificationFixture, ApiVacationSetupFixture
- **Data queries**: vacationQueries.ts (findEmployeeWithManager, findCpoEmployeeWithManager, findSubordinateAndAltManager, findAccountantForEmployee, findEmployeeWithLimitedDays, hasVacationConflict, +more)

## Key Technical Notes
- All tests pass with `--workers=1` (sequential) — parallel execution causes CAS session conflicts
- react-select dropdowns: use `[class*='option']` divs, type with `{ delay: 50 }` + 1500ms wait
- react-datetime picker: `rdtSwitch` header, `rdtNext` navigation, `rdtMonth` cells
- Payment page: dual confirmation dialogs, office-filtered accountants, "Last First" name format
- PAID+EXACT vacations are permanent — test pollution accumulates
