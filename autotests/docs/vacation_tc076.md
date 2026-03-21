## TC-VAC-076: FIFO cancel returns days to pool, redistributes

**Type:** API + DB (Functional)
**Suite:** TS-Vac-DayCalc
**Priority:** High

### Description

Verifies FIFO redistribution when a vacation is canceled. The recalculation service returns ALL regular days to the balance pool, then re-distributes them among remaining NEW/APPROVED vacations following FIFO (earliest year consumed first). After cancel, vacation B's distribution total stays the same but the per-year breakdown may change.

### Steps

1. **DB:** Baseline `employee_vacation` year balances for pvaynmaster
2. **API:** POST create vacation A (5 days REGULAR, offset 263)
3. **API:** POST create vacation B (5 days REGULAR, offset 266)
4. **DB:** Check `vacation_days_distribution` for both A and B
5. **API:** PUT `/cancel/{idA}` — cancel vacation A
6. **DB:** Verify: A's distribution cleared, B's total unchanged, B follows FIFO, balance = baseline - B_days
7. **API:** DELETE vacation B, verify full balance restoration

### Data

- **Login:** pvaynmaster (AV=true, Персей office)
- **Vacation A:** Mon-Fri week at offset 263
- **Vacation B:** Mon-Fri week at offset 266
- **Key tables:** `employee_vacation` (balances), `vacation_days_distribution` (FIFO tracking)
- **Vault ref:** patterns/vacation-day-calculation § FIFO Day Consumption
