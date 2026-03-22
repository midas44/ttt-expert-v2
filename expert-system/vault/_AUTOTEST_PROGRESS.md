# Autotest Generation Progress

**Last updated:** 2026-03-22 (Session 44)

## Overall Coverage
| Metric | Count | % |
|--------|-------|---|
| Total test cases | 109 | 100% |
| Verified | 63 | 57.8% |
| Blocked | 2 | 1.8% |
| Failed | 1 | 0.9% |
| Skipped | 1 | 0.9% |
| Pending | 42 | 38.5% |

## Coverage by Suite
| Suite | Total | Verified | Blocked | Pending |
|-------|-------|----------|---------|---------|
| TS-Vac-CRUD | 16 | 14 | 0 | 2 |
| TS-Vac-Lifecycle | 11 | 6 | 1 | 4 |
| TS-Vac-Approval | 8 | 6 | 0 | 2 |
| TS-Vac-Payment | 10 | 8 | 0 | 2 |
| TS-Vac-DayCalc | 10 | 8 | 0 | 2 |
| TS-Vac-DayCorrection | 10 | 8 | 0 | 2 |
| TS-Vac-Chart | 10 | 2 | 0 | 8 |
| TS-Vac-Permissions | 8 | 5 | 0 | 3 |
| TS-Vac-Validation | 8 | 4 | 0 | 4 |
| TS-Vac-Notifications | 10 | 1 | 1 | 8 |
| TS-Vac-Integration | 8 | 1 | 0 | 7 |

## Page Objects Created
- MyVacationsPage (MainPage.ts) — vacation table, row operations, tabs
- VacationCreateDialog — creation form, period, type, payment
- VacationDetailsDialog — view details, delete action
- VacationPaymentPage — payment queue, filtering
- VacationDayCorrectionPage — inline editing, chip filter, confirm modal
- AvailabilityChartPage — chart with CSS-hidden table workarounds (Session 44)

## Blocked Tests
- **TC-VAC-027**: Needs accounting period close API (clock alone insufficient)
- **TC-VAC-063**: Duplicate of TC-VAC-064

## Session History
| Session | Tests Generated | Tests Verified | Notes |
|---------|----------------|----------------|-------|
| 30-38 | ~50 | ~45 | Initial generation batch |
| 39 | 5 | 0 | CAS timeout issues |
| 40 | 5 | 5 | Fixed getAvailableDays() |
| 41 | 5 | 5 | Fixed TC-VAC-035/048 |
| 42 | 5 | 5 | TC-VAC-080/081/082/049/050 |
| 43 | 5 | 5 | TC-VAC-051/052/058/059/064 |
| 44 | 5 | 4 | TC-VAC-065/066/069/073 verified, TC-VAC-027 blocked |