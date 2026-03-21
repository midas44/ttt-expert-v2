## TC-VAC-162: AV=true — Vacation days display on main page uses availablePaidDays

**Type:** Hybrid (UI + API)
**Suite:** TS-VAC-AVMultiYear
**Priority:** High

### Description

Verifies MR !5169 fix: UserVacationsPage.js:102 displays `availablePaidDays` from the API (not the legacy `currentYear` field). The UI shows "X in YYYY" in the vacations page header. This test compares the UI display with the API `availablePaidDays` value, then verifies it updates correctly after vacation create/delete.

### Steps

1. **UI:** Login as pvaynmaster, navigate to /vacation/my
2. **UI:** Read "Available vacation days: X in YYYY" display
3. **API:** GET `/vacationdays/available?employeeLogin=pvaynmaster&newDays=0&paymentDate=...&usePaymentDateFilter=true`
4. **Compare:** UI value matches API `availablePaidDays`
5. **API:** POST create vacation (5 days REGULAR, offset 275)
6. **UI:** Reload page, verify display decreased
7. **API:** DELETE vacation
8. **UI:** Reload page, verify display restored

### Data

- **Login:** pvaynmaster (AV=true, Персей office)
- **Vacation dates:** Mon-Fri week at offset 275
- **UI selector:** Text matching `/^\d+ in \d{4}$/` in the vacation page header
- **Fix reference:** MR !5169 (frontend), ticket #3361
- **UI page:** /vacation/my/my-vacation/OPENED
