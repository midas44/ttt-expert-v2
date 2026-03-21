## TC-VAC-161: AV=true — availablePaidDays after cross-year vacation

**Type:** API + DB (Functional)
**Suite:** TS-VAC-AVMultiYear
**Priority:** Critical

### Description

Verifies the #3361/#3092 fix: `availablePaidDays` correctly reflects balance after creating a cross-year vacation (Dec→Jan). MR !5169 changed frontend to display `availablePaidDays` instead of `currentYear`. This API test confirms the backend calculation is correct — `availablePaidDays` decreases properly after cross-year vacation creation and restores after deletion.

### Steps

1. **API:** GET `/vacationdays/{login}` — baseline summary
2. **API:** GET `/vacationdays/available` — baseline `availablePaidDays`
3. **Create** cross-year vacation (Dec→Jan, far future)
4. **DB:** Check `vacation_days_distribution` — verify FIFO across year boundary
5. **API:** Re-check `availablePaidDays` — should decrease; compare with `currentYear` field
6. **Delete** vacation, verify `availablePaidDays` restores

### Data

- **Login:** pvaynmaster (AV=true, Персей office)
- **Dates:** Dec 2037 → Jan 2038 (cross-year window)
- **Fix reference:** MR !5169 (frontend), MR !5116 (backend calculation)
