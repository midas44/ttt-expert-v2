## TC-VAC-163: AV=true — Future vacations affect available days display

**Type:** Hybrid (UI + API + DB)
**Suite:** TS-VAC-AVMultiYear
**Priority:** High

### Description

Verifies that creating a vacation in a future year affects the current available days display for employees in AV=true offices. The `availablePaidDays` endpoint uses FIFO (first-in-first-out) day consumption from the earliest balance year, so future vacations reduce the displayed balance even if they're in a different calendar year.

### Steps

1. Login via CAS, navigate to My Vacations page
2. Read UI baseline "X in YYYY" display
3. Get API baseline via GET /vacationdays/available
4. Create a future-year vacation via POST /vacations (5 working days)
5. Verify API shows decreased availablePaidDays
6. Refresh UI — verify display decreased
7. DB: Query vacation_days_distribution to verify FIFO cross-year allocation
8. Delete the vacation — verify UI and API restore to baseline

### Data

- **User:** pvaynmaster (DM, Persej office, AV=true)
- **Dates:** Dynamic — 5-day Mon-Fri block in far future (week offset 278)
- **DB queries:** vacation_days_distribution for FIFO verification
