---
type: exploration
tags:
  - accounting
  - payment
  - periods
  - correction
  - tickets
  - bugs
  - gitlab-mining
  - phase-a
created: 2026-03-28
updated: 2026-03-28
status: active
related:
  - '[[modules/accounting-service-deep-dive]]'
  - '[[modules/accounting-backend]]'
  - '[[exploration/ui-flows/accounting-pages]]'
  - '[[exploration/api-findings/accounting-api-testing]]'
  - '[[exploration/tickets/reports-ticket-findings]]'
branch: release/2.1
---
# Accounting — GitLab Ticket Findings (Session 92)

Comprehensive mining of 62+ accounting-related GitLab tickets. Descriptions AND comments read for 12 high-priority tickets. Organized by theme cluster for Phase B test case generation.

## 1. Period Management Cluster (#3350, #3365, #3264, #3351)

### #3350 — Do not backdate approval period by more than one month [CLOSED, Sprint 14]
- **Feature**: Max 1-month delta (forward or backward) from saved value for both report and confirmation periods. Sequential saves required for multi-month changes.
- **Persei special rule removed**: Previously confirmation period = [current month -2; reporting period]. Now ALL offices follow same 1-month rule.
- **QA bugs found** (vulyanov, 6 bugs):
  1. Report period could be selected arbitrarily far into future, transitively allowing unbounded confirmation delta
  2. Confirmation 2-month change blocked on backend but possible in UI via sequential report period changes. Edit button silently stops working — no error shown to user.
  3. Confirmation period month AHEAD of saved report period not disabled in UI. Saving produces 400.
  4. Popup uses DYNAMIC (unsaved) values instead of SAVED values for available months. Partial save possible — one period saves while other validation fails.
  5. Report period month PRECEDING saved confirmation period not disabled (moved to #3365)
  6. Simultaneous editing of both periods with opposite 1-month deltas creates 2-month delta between them (WON'T FIX — 2-month jump from saved value still disabled)
- **Key design insight**: Validation must use SAVED values, not dynamic. Both periods must be validated simultaneously. Error notification on 400.
- **Test cases (10+)**: 1-month forward/backward (succeed), 2+ months (disabled in UI), confirmation <= report constraint, report >= confirmation constraint, saved vs dynamic value validation, partial save prevention, error notification, sequential edits for multi-month changes

### #3365 — Report period month selection not disabled [OPEN, Sprint 15]
- **Bug**: Month preceding saved confirmation period not disabled for report period selection. Saving produces 400.
- **Partially fixed** (commit 13fa803a) but 2-month delta between report and confirmation still possible
- **Test cases**: Report period month before confirmation = disabled, no 400 on valid selection, 2-month delta prevention

### #3264 — Persei periods up to 2 months back [CLOSED, HotFix Sprint 12]
- **Historical**: Added -2 month lower bound for Persei SO. Later superseded by #3350 (universal 1-month rule).
- **Now obsolete** — all offices follow same rule

### #3351 — Changing periods UI bugs [OPEN, To Do]
- **Cosmetic**: Page title rename, tooltip/modal/datepicker translations, button label "Edit" → "Change"
- **Test cases**: All labels/titles match spec in both RU and EN

## 2. Vacation Day Calculation Cluster (#3283, #3204, #3339, #3363)

The AV (advance vacation) setting fundamentally changes all day balance behavior. This cluster is the deepest source of bugs.

### #3283 — New correction logic depending on AV setting [CLOSED, Sprint 14]
- **AV=No (Russia, default)**:
  - Overwork/underwork do NOT affect vacation days. Available days CANNOT go negative.
  - **AS-IS bug**: System pretends to accept negative values in correction UI, but DB stores ≥0. Feed event uses requested (negative) value, corrupting counters.
  - **TO-BE**: PREVENT minus sign in inline editing field for AV=No offices.
- **AV=Yes (Cyprus, Germany)**:
  - Overwork/underwork DO affect vacation days. Available days CAN go negative.
  - **TO-BE**: Correctly display negative values. Manual correction must allow negative values with correct processing.
  - Negative balance can result from: underwork correction, day-off transfer out of vacation period, admin deleting day-off from vacation period, admin adding working day within vacation period, manual correction by accountant/admin.
- **QA architecture findings** (vulyanov):
  - Manual correction event doesn't trigger redistribution between years
  - Delta of balance change has no information about which year it belongs to
  - Balance days used as accrued days in calculations for AV=false (incorrect)
  - Manual correction: DB stores ≥0, negative part lost. Feed preserves negative deltas. Automatic correction: negative values ARE written to DB.
  - Both corrections operate on balance sum (current + past years), not accrued days alone — fundamentally incorrect
- **Test cases (9+)**: AV=No minus prevented, AV=No no negative display, AV=Yes negative accepted/stored, negative display after underwork/day-off-deletion/day-off-transfer/working-day-add/manual-correction, Feed event correctness

### #3204 — Incorrect vacation days calculation per year after correction [CLOSED, Canceled]
- **Bug**: After underwork correction of -19 days, previous year days become unavailable in current year. First available days only months later.
- **Root cause**: VACATION_MONTHLY_RECALCULATION logic different from DAYS_ADJUSTMENT — doesn't distribute deductions correctly across years
- **QA findings** (vulyanov, 14 detailed comments):
  1. Negative accrued days calculated correctly but shown as zeros in UI (My Vacations, creation popup, events feed)
  2. Manual correction + underwork correction together creates incorrect results
  3. Open vacation requests NOT converted from regular to administrative when underwork reduces accrued days below vacation duration
  4. `available days` ≠ `accrued days` — first cannot be negative, second can be <0
  5. Correction operates on balance sum instead of accrued days — allows advance payment for non-accrued days
- **Status**: Closed as Canceled — relevant cases moved to #3283 and new tickets
- **Test cases**: Underwork deduction order (earliest year first), negative balance display, recalculation reverse restores distribution, manual + automatic correction interaction

### #3339 — AV=false balance recalculation incorrect [CLOSED, Sprint 14]
- **Bug**: For AV=false offices, vacation day recalculation incorrect when: vacation converted to Administrative due to insufficient balance AND accrued days become negative after calendar change
- **Examples**:
  - Delete day-off within vacation period → conversion results in 0 balance instead of correct value (7)
  - Transfer day-off within vacation period → same incorrect recalculation
- **Test cases**: AV=false delete day-off in vacation → verify correct balance, transfer day-off → verify, vacation type conversion preserves correct balance, balance doesn't drop to 0 incorrectly

### #3363 — Error 500 on vacation payment with negative balance (AV=true) [OPEN, Sprint 15]
- **Bug**: AV=true offices — paying vacation when combined (current + next year) balance <0 → 500 error
- **Condition**: Requires combined balance of current year AND next year < 0 (rare)
- **Works when**: Balance ≥0 (even if current year negative but sum with next year positive)
- **Proposed solution**: Automatic deletion of future vacations in reverse chronological order of payment months to maintain sum ≥0
- **NOT on prod** version (different behavior)
- **Test cases**: Payment with combined negative balance (should not 500), payment with current negative + next positive (should succeed), proper error message for negative, AV=true offices only

## 3. Salary Office Visibility (#2841, #3323)

### #2841 — Incorrect salary office filter in payment table [CLOSED, HotFix Sprint 8]
- **Bug**: Vacation Payment SO filter shows subset of accessible offices. Employees from missing offices absent.
- **Root cause**: localStorage with stale/corrupt filter data
- **Additional bugs found**: SO pagination >20 entries, filter breaks if one SO has no name, SO names don't update on language switch
- **Reproduction**: User with ACCOUNTANT+ADMIN roles sees zero SO options (only "All"). Table not filtered by SO.
- **Same bug on sick leave accounting page**
- **Test cases**: All accessible SO in Payment filter, filter updates after SO list change, ACCOUNTANT+ADMIN role, SO with no name, >20 SO pagination, language switch updates SO names, sick leave accounting filter

### #3323 — Hide archived salary offices [OPEN, Sprint 15]
- **Feature**: Archived SO hidden from Accounting dropdowns (Salary, Changing periods). In Admin panel: visible but dimmed/grayed, non-editable, at bottom of list.
- **Test cases**: Archived SO not in Accounting dropdowns, visible but dimmed in Admin, not editable, positioned at end, non-archived fully functional

## 4. Permission & Access Control (#3012)

### #3012 — Accounting route accessible to regular employee [CLOSED, Sprint 11]
- **Bug**: `/accounting/sick-leaves` accessible to regular employees because `VACATIONS:VIEW` permission used instead of proper accounting-specific permission
- **Fix**: New `SICK_LEAVE_ACCOUNTING_VIEW` permission
- **Test cases**: Regular employee → no access to accounting routes, direct URL blocked/redirected, accountant/admin with permission → access works

## 5. Employee Lifecycle (#3336)

### #3336 — Last working day not displayed for leaving employee [OPEN]
- **Bug**: On Salary page, "date of leave" tooltip for departing employee appears then disappears when CS sync removes employee
- **Mechanism**: Tooltip shown when `beingDismissed=true` in API response. `lastDate` always returned from `ttt_backend.employee`. `beingDismissed` fetched from CS.
- **Timing issue**: Date saved until employee removed from CS list (usually next day after dismissal). Salary should already be calculated by then.
- **Design note**: Read-only flag not set automatically during dismissal salary calculation stage
- **Test cases**: Tooltip with beingDismissed=true, tooltip hidden with false, timing of CS sync vs salary processing, read-only flag during dismissal

## 6. Cross-Cutting Test Case Themes

### Period management (15+ test cases):
- 1-month max delta enforcement (forward/backward) for ALL offices
- Report period ≥ confirmation period constraint in UI
- Saved vs dynamic value validation
- Partial save prevention (both-or-neither)
- Error notifications on 400
- Sequential edits for multi-month changes
- Extended period blocking approve period change
- UI translations and labels (RU/EN)

### Vacation day corrections (12+ test cases):
- AV=No: prevent negative input, never show negative
- AV=Yes: allow negative, display correctly after all trigger types
- Manual + automatic correction interaction
- Year-to-year distribution correctness
- Feed event accuracy

### Vacation payment (8+ test cases):
- Normal payment flow (APPROVED → PAID)
- Negative balance payment (500 prevention)
- Day redistribution when paid less than requested
- Auto-payment of expired approved vacations (2-month threshold)
- Bulk payment via checkbox selection

### Salary office management (6+ test cases):
- Filter completeness across all accounting pages
- Archived SO hiding
- Pagination >20 entries
- Language switch for SO names
- ACCOUNTANT vs ADMIN role filtering

## Related
- [[modules/accounting-service-deep-dive]] — code-level reference
- [[modules/accounting-backend]] — backend overview
- [[exploration/ui-flows/accounting-pages]] — UI exploration
- [[exploration/api-findings/accounting-api-testing]] — API testing
- [[exploration/tickets/reports-ticket-findings]] — reports module tickets
- [[analysis/office-period-model]] — period architecture
