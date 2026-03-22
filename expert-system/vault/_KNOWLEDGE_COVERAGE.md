---
type: analysis
updated: '2026-03-21'
status: active
---
# Knowledge Coverage — Phase C (Autotest Generation)

## Autotest Coverage: Vacation Module

**10 / 109 test cases automated (9.2%)**

### By Suite
| Suite | Automated | Total | Coverage |
|-------|-----------|-------|----------|
| TS-Vac-CRUD | 10 | ~30 | 33% |
| TS-Vac-Lifecycle | 0 | ~20 | 0% |
| TS-Vac-Approval | 0 | ~15 | 0% |
| TS-Vac-StatusFlow | 0 | ~15 | 0% |
| TS-Vac-Validation | 0 | ~15 | 0% |
| TS-Vac-DayOff | 0 | ~14 | 0% |

### Automated Test Cases
| ID | Title | Session | Status |
|----|-------|---------|--------|
| TC-VAC-001 | Create regular vacation — happy path | S31 | verified |
| TC-VAC-002 | Create administrative (unpaid) vacation | S32 | verified |
| TC-VAC-003 | Create vacation with comment | S32 | verified |
| TC-VAC-005 | View vacation request details | S32 | verified |
| TC-VAC-006 | Edit vacation dates — NEW status | S31 | verified |
| TC-VAC-007 | Edit APPROVED vacation — status resets | S31 | verified |
| TC-VAC-010 | Open/Closed/All filter tabs | S32 | verified |
| TC-VAC-013 | Create vacation starting today | S32 | verified |
| TC-VAC-021 | Cancel NEW vacation request | S31 | verified |
| TC-VAC-022 | Cancel APPROVED vacation | S31 | verified |

### Framework Assets
- **Page objects**: MainPage (MyVacationsPage), VacationCreateDialog, VacationDetailsDialog
- **Fixtures**: LoginFixture, LogoutFixture, MainFixture, HeaderNavigationFixture, VerificationFixture, VacationDeletionFixture
- **Queries**: findEmployeeWithVacationDays, findEmployeeWithVacation, hasVacationConflict, findEmployeeWithOpenAndClosedVacations
