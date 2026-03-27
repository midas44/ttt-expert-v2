---
type: exploration
tags:
  - vacation
  - form-validation
  - crud
  - ticket-mining
  - bugs
  - first-3-months
created: '2026-03-26'
updated: '2026-03-26'
status: active
related:
  - '[[analysis/vacation-business-rules-reference]]'
  - '[[exploration/tickets/vacation-ticket-findings]]'
---
# Ticket #3014 — Vacation Request Form Changes

Deep analysis: 62 comments, 35 sub-bugs. Major overhaul of vacation create/edit form.

## Feature Summary
Complete redesign of vacation request popup dialog:
- Removed "Preliminary" request type — all treated as Regular
- Changed available days display from annual advance to actually accrued days
- Payment month restricted to vacation month or up to 2 months before
- Start date today now allowed (was tomorrow+ before)
- New accrued days formula per payment month
- Dynamic validation on field change (not just on Save)
- First 3 months employment restriction for Regular vacations

## Sub-Bugs Summary (35 reported)

### Form Validation Bugs
- **Bug 1:** Single working day shows "must be at least 1 day" error incorrectly
- **Bug 7:** Inconsistent validation timing — some on date change, some on Save
- **Bug 9:** Available days calculation wrong when employee exceeds md norm
- **Bug 18:** Error 400 on save when md norm exceeded but Save button was active
- **Bug 23:** Empty Period field shows "must be at least 1 day" instead of "Required field"
- **Bug 24:** Label says "Period" instead of "Vacation period" per spec

### Available Days Calculation Bugs
- **Bug 10:** Editing + changing payment month → wrong available days (doesn't exclude current request)
- **Bug 15:** Year transition broken — leftover current-year days not available for next-year request
- **Bug 19:** Cross-year request incorrectly reduces available days for current year
- **Bug 21:** Existing request edit treats own days as consumed → shows 0 available
- **Bug 22:** Previous years' leftover days not included in calculation
- **Bug 31:** Overcorrection — available days doubled on edit popup (16 → 32)

### First 3 Months Restriction Bugs
- **Bug 25:** Creation: available days show non-zero but save returns 400
- **Bug 26:** Editing: can move period into restricted zone and save successfully
- **Bug 27:** "Next vacation from [date]" message ignores 3-month restriction
- **Bug 28:** Calendar dates not disabled in first 3 months
- **Bug 30:** Incorrect calculation for employees hired before July 2024
- **Bug 35:** Calendar opens to current month even if all dates disabled (should skip to first available)

### Type Toggle / Payment Month Bugs
- **Bug 2:** Toggle Admin checkbox on/off → payment month goes blank (edit mode only)
- **Bug 32:** Administrative request still shows payment month value (should be empty/disabled)
- **Bug 5:** Orange warning + red error show simultaneously (should hide orange)
- **Bug 6:** Editing request treats itself as "future request" for conversion

### Localization / UI Bugs
- **Bug 3:** English shows template placeholders instead of data in popup messages
- **Bug 4:** Font size 12px instead of 13px for status notification
- **Bug 16:** Negative available days displayed (should show 0)
- **Bug 29:** Past-period requests show incorrect dates on edit popup
- **Bug 34:** Date picker dropdown position doesn't match UI kit

### Legacy Data Bugs
- **Bug 8:** Preliminary requests from before change still visible
- **Bug 13:** Preliminary confirmed requests can't be paid in Accounting
- **Bug 14:** Preliminary unconfirmed requests hard-deleted by cron 1 week before start

## Design Decisions
1. **Preliminary migration:** Convert existing to Regular. Confirmed preliminary kept but hidden
2. **Validation timing:** Dynamic on field change for most; only "required field" on Save click
3. **Font hierarchy:** Info messages 13px, field errors 11px with red border
4. **Orange vs red overlap:** Hide orange warning when red error visible
5. **3-month restriction:** Applies to period dates only, NOT payment month selection
6. **Negative display:** Show zero instead of negative for available days
7. **Edit mode exclusion:** Available days calculation MUST exclude current request's consumed days
8. **Pre-release data:** Leave legacy excess-days requests as-is; new rules normalize over time

## Key Edge Cases for Testing
1. Employee in first 3 months: Regular dates disabled, Administrative allowed
2. Employee hired before July 2024: different 3-month calculation path
3. Cross-month vacation period with different accrued days per month
4. Edit existing request: available days exclude current request's consumption
5. Toggle Administrative checkbox on/off: payment month and days reset correctly
6. English locale: all messages have data (no `{0}` placeholders)
7. Year transition: 2025 request with leftover 2024 days
8. Calendar opens to first available month for restricted employees
9. Past-period request editing: correct dates shown
10. Simultaneous red + orange message handling

## Related
- [[analysis/vacation-business-rules-reference]]
- [[exploration/tickets/vacation-ticket-findings]]
- [[exploration/tickets/vacation-ticket-3015-accrued-days-validation]]
- [[modules/frontend-vacation-module]]
- [[analysis/vacation-form-validation-rules]]
