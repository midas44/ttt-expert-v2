---
type: exploration
tags:
  - reports
  - confirmation
  - statistics
  - tickets
  - bugs
  - gitlab-mining
  - phase-a
created: 2026-03-28
updated: 2026-03-28
status: active
related:
  - '[[modules/ttt-report-service-deep-dive]]'
  - '[[modules/ttt-report-confirmation-flow]]'
  - '[[analysis/reports-business-rules-reference]]'
  - '[[exploration/api-findings/report-crud-api-testing]]'
  - '[[exploration/tickets/accounting-ticket-findings]]'
branch: release/2.1
---
# Reports & Confirmation — GitLab Ticket Findings (Session 92)

Comprehensive mining of 100+ report-related, 66+ period/confirmation-related GitLab tickets. Descriptions AND comments read for 22 high-priority tickets. Organized by theme cluster for Phase B test case generation.

## 1. Auto-Rejection Cluster (#2698, #3285, #3354, #3367)

The auto-rejection of unapproved hours on period closure is the single most problematic feature area. It was implemented, caused severe bugs, was reverted, and has incomplete requirements.

### #2698 — Auto-reject unconfirmed hours after period change [OPEN, Canceled]
- **Feature**: When ACCOUNTANT/ADMIN closes the Confirming Period, all hours neither APPROVED nor REJECTED must become REJECTED automatically
- **Notification**: Employee receives email (ID_120) + banner on My Tasks/Planner
- **Banner behavior**: Shows "Unapproved hours for task %name% were automatically rejected upon month closure". Displayed while approval period is +1 to the one with rejected hours. "Go to Report" link navigates to first week with rejected hours. Tooltip on hover over rejected cells.
- **Known bug**: Banner reappears after navigating away and back despite X click dismissal (edge case: new browser, cleared site data)
- **Status**: Feature DISABLED to fix #3367. Implementation described as "severely incorrect" by QA. Rollback and new implementation with clearer requirements suggested.

### #3285 — Spontaneous rejection of reports when closing report period [OPEN, HIGH]
- **Bug**: When DM closes report period for a SO, reports in Confirmation > By Projects spontaneously receive "rejected" status. HTTP 400 "Employee login not found" on tab load.
- **Root cause**: Implementation of #2698 triggered on report period closure instead of approve period closure. Missing `approverLogin` for auto-rejected tasks causes 400.
- **Code reverted** from release/2.1 back to development-ttt branch
- **Migration job** must be run before testing (damaged data from #2698)
- **Related**: #2698, #3278
- **Env**: qa-2, qa-1, timemachine (NOT on stage/production)

### #3354 — Share settings of manually/auto-rejected hours [OPEN, design spec]
- **Requirement**: Auto-rejected hours MUST behave identically to manually rejected ones after period reopening
- **Scope**: Confirmation (individual cell, by line, all active tasks, "Approve all"), Planner > Projects > Actions > Approve all, My Tasks editing, Planner editing
- **Test cases**: Each approval granularity level (cell, line, all-tasks, approve-all) × (manual vs auto rejection) = 8+ test combinations

### #3367 — Unable to confirm/edit autorejected reports after period reopen [CLOSED, URGENT]
- **Bug**: After confirmation period closed → auto-reject → period reopened: confirmation of auto-rejected reports fails with 500. Also affects editing and notification display.
- **Fix**: MR !5095
- **Consequence**: Prevents accountants from correctly reopening confirmation period
- **Test cases**: Close → auto-reject → reopen → confirm (must not 500), close → reopen → edit (must not 500), close → reopen → verify notification with resubmission option

## 2. Confirmation Page Inconsistencies (#3368, #3321, #3267, #3278, #3268)

### #3368 — Over/under reports notification missing on "By Employee" tab [OPEN, Sprint 15]
- **Bug**: "By Projects" calls `ttt/v1/statistic/report/employees` for over/under notification, but "By Employee" does NOT — missing notification
- **QA findings** (detailed by omaksimova):
  1. Approve button on "By Employee" doesn't switch to next user or change work week
  2. Notification missing "Monthly norm" and "Norm as of {date}" fields
  3. Period-dependent bug: approve month < current month AND report month = current month → "By Employee" shows no notification, "By Projects" does
  4. Incorrect month shown in notification when over-report exists in both past and current month
- **Test cases**: Compare notifications on both tabs for same employee, verify Approve button advances, check correct period notification

### #3321 — No notification about rejected hours when report month closed but confirmation open [CLOSED, Sprint 14]
- **Bug**: Rejecting hours when report month closed but confirmation period open → no employee notification. Rejection comment not shown on hover.
- **Test cases**: Reject hours with report month closed → verify notification; verify comment on hover; compare with report month open

### #3267 — Incorrect update of employee/project lists and tabs [CLOSED, HIGH]
- **Bug**: After confirming ALL hours, if employee submits new report for same period: employee disappears from dropdown, project disappears, weekly tab shows no red dot, Confirm button inactive
- **Suspected**: Performance/backend glitch, fixed after server restart
- **Test cases**: Confirm all → new report → verify dropdown updates, red dot, Confirm button state

### #3278 — Error 400 on task rename in confirmation [CLOSED, Sprint 13]
- **Bug**: Editing task name in Confirmation popup triggers 400 "Employee login not found". UI elements disappear after error.
- **Additional bug**: Renaming for one employee (checkbox unchecked) on "By Projects" tab — popup closes, name unchanged. Works on "By Employees".
- **Related**: Loading weekly tab causes 400 when one employee's report period is already closed → spawned #3285
- **Test cases**: Rename in popup (no error), rename for single employee, rename for all, "For all time" vs "from date", UI elements persist after input change

### #3268 — Rejected hours notification banner missing [CLOSED, Sprint 13]
- **Bug**: My Tasks page doesn't show notification for rejected hours in previous month. API returns 400: "Period should be less than two months"
- **Root cause**: Backend max-2-month sampling restriction prevents notification API from loading
- **Fix**: MR !4668
- **Test cases**: Rejected report in previous month → banner appears, API doesn't error, test with period not yet closed and with reopened period

## 3. Norm Calculation Cluster (#3353, #3380, #3381, #3356)

### #3381 — Budget norm including administrative vacation hours [CLOSED, Hotfix Sprint 14]
- **Feature**: New "budget norm" = individual norm + administrative vacation hours for the month
- **Display**: `{individual norm} ({budget norm})` when different; just `{budget norm}` when equal
- **Exceed %**: Calculated from budget norm, not individual norm
- **Info icon**: Tooltip on "Norm" header explaining budget norm
- **Backend**: `api/ttt/v1/statistic/report/employees` now includes `budgetNorm` field
- **Calculation example**: Base 152h + day-off transfer (+8h=160h) - sick leave (=144h) - admin vacation (-8h=136h). Budget norm = 136 + 8 (admin vac hours) = 144h.

### #3353 — Individual norm exclude pre-employment/post-termination periods [OPEN, Sprint 15]
- **Feature**: When employee's first working day is not 1st of month, individual norm reduced by pre-start hours. Same for post-termination.
- **New endpoint**: `/v1/employees/{login}/work-periods` returns `[{periodStart, periodEnd}]`
- **UI changes**: Non-working days orange on My Tasks, Confirmation, Planner
- **Edge cases**: Re-hired employees (gap periods), employees not yet working (show 0/0/monthlyNorm)
- **Figma**: `H2aXBseq7Ui60zlh5vhyjy/Noveo-TTT?node-id=44763-311340`
- **Related**: #3320, #3189, #2735, #3356

### #3380 — Vacations don't affect employee personal monthly norm [OPEN, Sprint 15]
- **Bug**: Creating vacation (paid or unpaid) does NOT reduce personal monthly norm on My Tasks or Employee Reports
- **Discrepancy**: Different behavior between qa-2 and stage
- **Related**: #3381

### #3356 — Updated individual norm for partial-month employees [OPEN, Sprint 15, Waiting]
- **Feature**: Budget norm accounts for partial-month employment (prorated individual norm)
- **Depends on**: #3353
- **Endpoint changed**: `/v1/employees/{login}/work-periods` now uses login (was employeeId)

## 4. Statistics Bugs (#3309, #3320, #3306, #3366)

### #3309 — Add DM and Comment fields to statistics employee reports [CLOSED, Sprint 14]
- **New features**: Manager column with CS link and filter, Comment field with inline edit (per employee per month)
- **QA bugs**: Font size 14px→13px, spelling error in column title, comments aggregated incorrectly (task-level merged into employee-level)
- **Comment storage**: Per employee per month, changing month shows that month's comment

### #3320 — Future employees shown with false underreports [CLOSED, Sprint 14]
- **Bug**: Statistics > Employee reports shows employees in periods BEFORE their start date with negative exceed %
- **Fix**: Replaced employee search endpoint from `api/ttt/v1/suggestions/employees` to `GET api/vacation/v1/statistic/report/employees`
- **Additional bug**: Dismissed employees shown in table but not searchable in dropdown. `last_date` in `ttt_vacation.employee` not updated since 2023.

### #3306 — "Only over the limit" switcher doesn't work [CLOSED, HotFix Sprint 13]
- **Bug**: Toggle on Statistics > Employee reports has no effect
- **Parameters**: `notification.reporting.under` and `notification.reporting.over` in TTT Parameters
- **Additional**: Single menu item in Statistics → should work as direct link, not submenu

## 5. Data Integrity & UX (#3331, #3398, #3150, #3296)

### #3331 — Lost reporting data [OPEN, Feedback Awaited]
- **Bug**: Hours lost after CAS session expiry during reporting. No session expiration message appeared. Production report.
- **Investigation**: Could NOT reproduce data loss. CAS timeout redirect works on preprod. Network error popup appears on connection loss.
- **Design issue**: UI remains available after CAS timeout — should redirect to login

### #3398 — Multiple stacked input fields on TAB [OPEN]
- **Bug**: On report page, pressing TAB after clicking empty cell creates duplicate input field. Stacking accumulates.
- **Production user report** with screenshot

### #3150 — Infinite spinner on contractor's report page [OPEN, Sprint 15]
- **Bug**: Global error and spinner when opening contractor's report from Statistics/Admin links. Does NOT occur on contractor's own My Tasks page.
- **Long-standing**: Created Nov 2024, still open Jan 2026
- **URL**: `/report/<contractor_login>` opened from manager views

### #3296 — Approved status not removed after tracker import [OPEN]
- **Bug**: After PM approves hours → employee reports in external tracker → PM imports → value changes but green Approved background persists
- **Both tabs affected**: Planner > Projects and Planner > Tasks
- **Expected**: Any hour change after approval MUST remove confirmation status

## 6. Cross-Cutting Test Case Themes

### Auto-rejection lifecycle (16+ test cases):
- Period closure → auto-reject → notification → reopen → re-confirm/edit
- Compare manual vs auto rejection behavior at each approval granularity
- Banner persistence, dismissal, reappearance

### Confirmation page parity (10+ test cases):
- "By Employee" vs "By Projects" must show identical data for same employee
- Over/under notification consistency between tabs
- Approve button behavior differences between tabs
- Period-dependent notification display rules

### Norm calculation (12+ test cases):
- General norm → individual norm → budget norm chain
- Partial-month proration for new/terminated employees
- Administrative vacation impact on budget norm
- Vacation/sick-leave impact on personal norm
- Over/under-limit threshold filtering

### Period management interaction with reports (8+ test cases):
- Report period closure doesn't trigger auto-reject (only approve period should)
- Period reopening restores editing/confirmation capability
- Extended period individual exceptions
- 1-month max delta enforcement

## Related
- [[analysis/reports-business-rules-reference]] — comprehensive business rules
- [[modules/ttt-report-service-deep-dive]] — code-level reference
- [[modules/ttt-report-confirmation-flow]] — confirmation workflow
- [[exploration/tickets/accounting-ticket-findings]] — accounting module tickets
- [[exploration/api-findings/report-crud-api-testing]] — API testing results
