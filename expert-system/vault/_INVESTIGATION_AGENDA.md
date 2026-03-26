---
type: session-control
updated: '2026-03-26'
---
# Investigation Agenda — Phase C (t3404)

## Current Phase: Autotest Generation for #3404

### P0 — Completed
- [x] TC-T3404-005: Edit icon visible PAST day-off open month ✅ verified
- [x] TC-T3404-006: Edit icon HIDDEN closed month ✅ verified
- [x] TC-T3404-016: Select earlier date same month ✅ verified

### P1 — Completed
- [x] TC-T3404-004: Edit icon visible future day-off ✅ verified
- [x] TC-T3404-007: Boundary on approve period start ✅ verified
- [x] TC-T3404-010: Closed month Jan all disabled (datepicker) ✅ verified
- [x] TC-T3404-011: Closed month Feb all disabled (datepicker) ✅ verified
- [x] TC-T3404-012: Open month Mar working days enabled (datepicker) ✅ verified
- [x] TC-T3404-015: March 2 first working day enabled (datepicker) ✅ verified
- [x] TC-T3404-017: First working day of month selectable (earlier date) ✅ verified

### P1 — Remaining
- [ ] TC-T3404-018: Feb dates NOT selectable (earlier date)
- [ ] TC-T3404-020: E2E reschedule + approval (regression)
- [ ] TC-T3404-021: Month-close auto-rejection (regression, hybrid)
- [ ] TC-T3404-022: Vacation recalculation overlap (regression, hybrid)

### P2 — Pending
- [ ] TC-T3404-001: EN tooltip text
- [ ] TC-T3404-002: EN dialog title
- [ ] TC-T3404-008: Edit icon hidden last day closed month
- [ ] TC-T3404-009: Previous year all hidden
- [ ] TC-T3404-013: Future month Apr enabled (datepicker)
- [ ] TC-T3404-014: Boundary Feb 28 disabled (datepicker)
- [ ] TC-T3404-019: Future holiday minDate ST-4 (earlier date)
- [ ] TC-T3404-023: Max date Dec 31 unchanged (regression)

### P3 — Pending
- [ ] TC-T3404-003: RU tooltip text unchanged
- [ ] TC-T3404-024: Global approve period diff offices

### Key Learnings
- **Data source:** UI Days Off tab displays from production calendar (`calendar_days` via `office_calendar`), NOT from `employee_dayoff`. All queries must use `calendar_days`.
- **Reusable page objects:** `DayOffPage` and `RescheduleDialog` cover all needed interactions.
- **BUG-T3404-1:** Boundary test (TC-007) asserts current buggy behavior (edit icon hidden on exact period start) with known-bug annotation.
- **Datepicker navigation:** react-datetime with minDate Feb 28 blocks backward navigation past February. TC-010 handles both scenarios (blocked or all-disabled).
- **New RescheduleDialog methods:** `areAllCurrentMonthDaysDisabled()`, `getDayStates()`, `clickPrevMonth()` — added in session 60 for datepicker suite.
