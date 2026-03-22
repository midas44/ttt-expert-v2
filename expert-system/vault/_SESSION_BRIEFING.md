# Session Briefing

## Last Session: 37 (2026-03-22)
**Phase:** C — Autotest Generation
**Mode:** Full autonomy
**Duration:** ~25 min

## Session 37 Summary

### Completed (5 tests: 1 fixed, 4 new)
| Test ID | Title | Status | Fix Attempts |
|---------|-------|--------|-------------|
| TC-VAC-011 | Available vacation days yearly breakdown | verified (fix) | 5 |
| TC-VAC-083 | Start date in the past — error message | verified | 3 |
| TC-VAC-084 | End date before start date — error message | verified | 1 |
| TC-VAC-087 | Overlapping vacation dates — crossing error | verified | 2 |
| TC-VAC-014 | Create cross-year vacation (Dec→Jan) | verified | 3 |

### Key Findings
- **Frontend validation patterns:** Formik disables Save when end < start (TC-084). Past start dates NOT caught by frontend — backend validates (TC-083). Overlapping dates handled by backend crossing error (TC-087).
- **Table date format:** Vacation dates column uses "DD Mon YYYY - DD Mon YYYY" (English month names), not DD.MM.YYYY. Period patterns must use multi-format alternatives.
- **Clock manipulation works:** TC-014 successfully uses `PATCH /api/ttt/v1/test/clock` to set server time to Nov 15 for cross-year testing, then resets via `POST /api/ttt/v1/test/clock/reset`.
- **Calendar date picker:** VacationCreateDialog.selectDate() works reliably for future months via ‹/› navigation.
- **VacationCreateDialog enhanced:** Added `isOpen()` and `getErrorText()` methods for validation tests.
- **MainPage methods rewritten:** `getAvailableDaysFullText()`, `toggleYearlyBreakdown()`, `getYearlyBreakdownEntries()` now use CSS module class selectors instead of fragile heuristics.

### Cumulative Progress
- **Total tracked:** 33 (31 verified, 1 failed, 1 blocked)
- **Manifest total:** 109 test cases
- **Coverage:** 31/109 = 28.4% verified

### State
- Clock: RESET (TC-014 cleanup resets clock after each run)
- No pending vacations left (TC-014 deletes its creation)
- All generated files committed

## Next Session Priorities
1. Continue vacation validation tests (TC-VAC-085, TC-VAC-086, TC-VAC-088)
2. Consider vacation approval flow tests (TC-VAC-025 through TC-VAC-034 range)
3. Look at vacation editing tests (TC-VAC-015 through TC-VAC-020 range)
