# Autotest Generation Progress

## Overall Status (as of Session 37)
| Metric | Value |
|--------|-------|
| Total manifest test cases | 109 |
| Tracked in SQLite | 33 |
| Verified (passing) | 31 |
| Failed | 1 |
| Blocked | 1 |
| Pending | 76 |
| **Coverage** | **28.4%** |

## Per-Session Generation History
| Session | Tests Generated | Tests Verified | Tests Failed | Notes |
|---------|----------------|---------------|-------------|-------|
| 28-29 | 5 | 5 | 0 | TC-001, TC-002, TC-003, TC-004, TC-005 |
| 30 | 4 | 4 | 0 | TC-013, TC-017, TC-021, TC-022 |
| 31 | 3 | 3 | 0 | TC-028, TC-031, TC-032 |
| 32 | 2 | 2 | 0 | TC-029, TC-030 |
| 33 | 3 | 3 | 0 | TC-018, TC-033, TC-034 |
| 34 | 5 | 5 | 0 | TC-024, TC-025, TC-026, TC-031, TC-032 |
| 35 | 4 | 4 | 0 | TC-029, TC-030, TC-033, TC-034 |
| 36 | 5 | 4 | 1 | TC-012, TC-016, TC-017, TC-018, TC-023 |
| 37 | 4+1fix | 5 | 0 | TC-011(fix), TC-083, TC-084, TC-087, TC-014 |

## Artifacts Created (Session 37)
- `e2e/data/VacationTc014Data.ts` — cross-year with clock manipulation
- `e2e/data/VacationTc083Data.ts` — past start date validation
- `e2e/data/VacationTc084Data.ts` — end before start validation
- `e2e/data/VacationTc087Data.ts` — overlapping dates crossing error
- `e2e/tests/vacation-tc014.spec.ts` — cross-year vacation Dec→Jan
- `e2e/tests/vacation-tc083.spec.ts` — past date backend error
- `e2e/tests/vacation-tc084.spec.ts` — Formik frontend validation
- `e2e/tests/vacation-tc087.spec.ts` — crossing error from backend
- `e2e/pages/MainPage.ts` — rewrote 3 methods for yearly breakdown
- `e2e/pages/VacationCreateDialog.ts` — added isOpen(), getErrorText()

## Blocked/Failed Tests
| Test ID | Status | Reason |
|---------|--------|--------|
| TC-VAC-012 | blocked | Vacation regulations link not visible in UI |
| TC-VAC-016 | failed | Unpaid checkbox not toggling correctly |
