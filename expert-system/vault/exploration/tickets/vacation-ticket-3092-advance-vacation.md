---
type: exploration
tags:
  - vacation
  - advance-vacation
  - AV-true
  - ticket-mining
  - bugs
  - edge-cases
created: '2026-03-26'
updated: '2026-03-26'
status: active
related:
  - '[[analysis/vacation-business-rules-reference]]'
  - '[[modules/vacation-service-deep-dive]]'
  - '[[exploration/tickets/vacation-ticket-findings]]'
---
# Ticket #3092 — Advance Vacation Implementation (AV=True)

Deep analysis of the most complex vacation ticket. 50+ comments, 14 sub-bugs, 7 design decisions, 12 edge cases.

## Feature Summary
Implement `advanceVacation` flag from CompanyStaff — when `true`, employees get full year's vacation allocation immediately (no monthly accrual). Fundamentally changes calculation, display, and validation logic.

## Sub-Bugs Found (14)

### Bug 1 — UI broken for AV=True employees (FIXED)
8 sub-items: missing info icon, wrong font size, link on "Available vacation days", missing events feed link, wrong text in popup, "Pending approval" displayed incorrectly, missing info icon in popup, column name "Accrued days" not applicable to AV=True.

### Bug 2 — Info icon vertical misalignment (FIXED)
Y position too high, looks ugly. Env: qa-1.

### Bug 3 — Incorrect recalculation in complex scenarios (OBSOLETE)
Underwork correction → period closure → negative balance → next-year vacation → conversion to admin → rollback on period reopening. Obsolete after refactoring in #2736.

### Bug 4 — Negative available days display (PARTIALLY FIXED)
Available days for current year displays negative. Designer clarified: negative CAN be displayed (Figma spec was initially wrong). Save button should be active; error shown only on Save click.

### Bug 5 — Misleading "available days by payment time" message (FIXED)
Message irrelevant for AV=True. Should show balance-till-end-of-year instead.

### Bug 5+ — PC changes cause incorrect recalculation for AV=True (FIXED)
Day-off deletion, working Sat/Sun creation, day-off transfer → incorrect available balance days recalculation. Env: qa-1, user `abpopov` from Neptune SO.

### Bug 6 — Incorrect redistribution on cross-year vacation edit (WON'T FIX → #3361)
Editing vacation spanning Dec 2025–Jan 2026 fails to redistribute balance days between years across multiple vacations.

### Bug 7 — Multi-month period closure/reopening (WON'T FIX → #3350)
Closing/reopening periods by 2+ months at once only corrects for one month. Rare but causes data damage.

### Bug 8 — No proper rounding of fractional values (FIXED)
Available/balance days not rounded to 3 decimal places. Affects My Vacations page, events feed popup, Accounting > Correction page. Tooltips still showed unrounded values after initial fix.

### Bug 9 — "Available now" calculation with next-year payment (WON'T FIX → #3361)
Next-year-payment vacations reduce current-year counter to 0 even when current-year balance days exist. "Severe disinformation of users." Env: timemachine, user `tdemetriou`.

### Bug 10 — Vacation creation broken after period reopening (WON'T FIX → #3350)
API receives null startDate/endDate/paymentMonth after certain period reopening sequences.

### Bug 11 — Report period control allows far-future dates (NOT A BUG)
Control allows selecting any future period (e.g., Dec 2026 when current is Dec 2025). Design gap in period control UI.

### Bug 12 — Strange zero on creation popup (FIXED)
Zero value displayed on popup for both AV=True and AV=False accounts. Env: qa-1.

### Bug 13 — CS sync doesn't update advance_vacation field (FIXED)
`ttt_vacation.office.advance_vacation` not updated by 15-min cron sync. Requires full restart. Sub-issues: unused `office_annual_leave.advance_vacation` DB column, `salary_office.updated_at` must be manually updated in CS.

### Bug 14 — Error 500 on negative balance payment (WON'T FIX → #3363)
Accountant pays vacation where combined current+next year balance is negative → 500 instead of validation error.

## Design Decisions

### D1: Days consumption order for AV=True
- Current-year payment: consume earliest years first (2023→2024→2025); release reverse
- Next-year payment: consume next-year first (2026), then previous (2023→2024), then current (2025)
- Storage: unused days in `employee_vacation` (per year), consumed in `vacation_days_distribution`

### D2: Negative balance handling
- Display negative per-year values honestly in tooltips
- Calculate available as sum of ALL year balances (including negatives)
- When current year ≤0, display next year balance adjusted for deficit

### D3: Translation changes
- "Accrued days" → "Paid days allowance" / "Начислено очередных дней"
- "Regular days used" → "Paid days used" / "Использовано очередных дней"
- "Administrative days used" → "Unpaid days used" / "Использовано административных дней"

### D4: Cross-year vacation splitting notification
Proposed: Show notification suggesting split into two requests for faster payment processing.

### D5: Display which years' days each vacation uses
Proposed: Days-per-year breakdown on vacation popup.

### D6: Negative display correction
Figma corrected: negative values CAN be displayed. Save button active; error only on Save click.

### D7: Complex redistribution deferred to Sprint 15
Earliest days consumed first. If counter shows 0, user cannot create current-year request. Workaround: delete future-year request first.

## Edge Cases for Testing
1. Cross-year vacation dates (Dec 25–Jan 11) with different payment years — redistribution fails
2. Negative balance from underwork corrections — fractional values (-0.796)
3. Next-year-payment vacation blocks current-year creation (shows 0 available)
4. Multi-month period changes — only one month corrected
5. PC changes for AV=True — day-off deletions, working Sat/Sun, transfers
6. Payment with negative combined balance → 500
7. CS sync boundary at calendar year change
8. Orphan `office_annual_leave.advance_vacation` DB column (unused)
9. Report period control allows far-future dates
10. Frontend sends null fields after period reopening
11. Rounding: 20.20399... in tooltips
12. AV=True with 0 available — user actually has days in different year bucket

## Spawned Tickets
- #3347: Advanced redistribution logic (Sprint 15)
- #3350: Multi-month period fix
- #3361: Next-year payment redistribution
- #3363: Error 500 on negative balance payment
- #2736: Refactoring
- #2989: Full CS sync

## Related
- [[analysis/vacation-business-rules-reference]]
- [[modules/vacation-service-deep-dive]]
- [[investigations/vacation-av-true-multiYear-balance-3361]]
- [[exploration/tickets/vacation-ticket-findings]]
