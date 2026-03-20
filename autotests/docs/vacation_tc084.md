# TC-VAC-084: Cross-year vacation — days split across years

## Description

Boundary test verifying that a vacation spanning December→January correctly splits working days between two calendar years in the `vacation_days_distribution` table.

### Steps

1. **Create cross-year vacation** — `POST /api/vacation/v1/vacations` with dates spanning Dec→Jan (e.g., 2029-12-29 to 2030-01-02)
2. **Verify API response** — Check `regularDays` and `administrativeDays` in response
3. **Verify DB distribution** — Query `ttt_vacation.vacation_days_distribution` for the vacation ID
   - Should have exactly 2 rows (one per year)
   - Both years should have `days > 0`
   - Sum of distribution days should equal total `regularDays`

### Data

- **User**: pvaynmaster (AV=true, Персей office)
- **Date range**: Dec 29 → Jan 2 (crosses year boundary)
- **DB table**: `vacation_days_distribution` (columns: vacation_id, year, days)
- **FIFO rule**: Current year days consumed first
- Cleanup: DELETE vacation after test
