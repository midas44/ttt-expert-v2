## TC-VAC-137: AV=true — multi-year accumulated balance (3+ years)

**Type:** API + DB (Functional)
**Suite:** TS-Vac-Supplement
**Priority:** Medium

### Description

Verifies FIFO day consumption for AV=true employees with multi-year accumulated balances. When a vacation is created, days are consumed from the earliest year with positive balance first, tracked via the `vacation_days_distribution` table. After deletion, all year balances restore to their original values.

### Steps

1. **DB:** Get all `employee_vacation` rows for pvaynmaster — baseline year balances
2. **API:** GET `/vacationdays/{login}/years` — per-year breakdown before
3. **Create** a 5-day REGULAR vacation
4. **DB:** Check `vacation_days_distribution` — verify FIFO (earliest year consumed first)
5. **API:** GET years again — verify total decreased by regularDays
6. **Delete** vacation, verify year balances fully restore

### Data

- **Login:** pvaynmaster (AV=true, Персей office, multi-year data: 2023-2027)
- **Dates:** Future Mon-Fri week (offset 260)
- **Key tables:** `employee_vacation` (balances), `vacation_days_distribution` (FIFO tracking)
- **FIFO rule:** Oldest year with positive balance consumed first
