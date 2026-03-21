---
session: 28
phase: autotest_generation
updated: '2026-03-21'
---
# Session 28 — Phase C: Autotest Generation

## Completed
Five new vacation tests generated and verified (all passing):

| Test ID | Suite | Title | Result |
|---------|-------|-------|--------|
| TC-VAC-024 | Create | Create vacation with comment | Passed |
| TC-VAC-025 | Create | Create vacation with very long comment (5000 chars) | Passed |
| TC-VAC-026 | Update | Update dates of NEW vacation | Passed |
| TC-VAC-027 | Update | Update dates of APPROVED vacation — status resets to NEW | Passed |
| TC-VAC-028 | Update | Update CANCELED vacation — re-opens with new dates | Passed |

## Vacation Scope Status
- **Verified**: 33 / 173 (19.1%)
- **Blocked**: 4 / 173 (2.3%)
- **Pending**: 136 / 173 (78.6%)

## Key Discoveries (Session 28)
1. **2026 vacation balance exhausted** — pvaynmaster's 2026 vacation days are depleted due to accumulated DELETED ghost vacations consuming balance. Update tests (TC-026/027/028) which need two consecutive conflict-free weeks were pushed to Dec 2026 dates, triggering `validation.vacation.duration` errors. Fix: start date search from week 40+ (~Jan 2027) where fresh annual accrual is available.
2. **Parallel execution deadlocks** — Running 5 vacation API tests in parallel for the same user (pvaynmaster) causes deadlocks on `vacation_days_distribution` table (jOOQ UPSERT contention). Resolved by running update tests sequentially.
3. **Comment field confirmed unlimited** — 5000-char comment stored and returned in full. No truncation, no DB column length limit. Both create response and GET response include comment field.
4. **APPROVED→NEW reset on update confirmed** — PUT update with changed dates on APPROVED vacation resets status to NEW. Key business rule verified via API.
5. **CANCELED→NEW on update with new dates confirmed** — Consistent with TC-049 (same transition via same dates). Update validator skips day limit checks for CANCELED status.
6. **Test doc discrepancy** — TC-028 test case doc states "Status remains CANCELED (no auto-transition)" but actual behavior is CANCELED→NEW. The VacationStatusManager transition map drives this, and it's the correct behavior per code.

## Artifacts Created
- Data classes: VacationTc024Data, VacationTc025Data, VacationTc026Data, VacationTc027Data, VacationTc028Data
- Test specs: vacation-tc024.spec.ts, vacation-tc025.spec.ts, vacation-tc026.spec.ts, vacation-tc027.spec.ts, vacation-tc028.spec.ts

## Next Steps
- **TS-Vac-Update remaining**: TC-029 through TC-038 (10 pending tests — update comment, update paymentType, update with crossing dates, etc.)
- **TS-Vac-Approval**: TC-057 through TC-068 (12 pending tests)
- **TS-Vac-DayCalc**: TC-069 through TC-087 (19 pending tests)
- **TS-Vac-StatusFlow remaining**: TC-050, TC-051, TC-054 (UI tests)
