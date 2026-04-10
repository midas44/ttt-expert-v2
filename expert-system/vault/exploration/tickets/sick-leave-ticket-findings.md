---
type: exploration
tags:
  - sick-leave
  - tickets
  - bugs
  - dual-status
  - permissions
  - norm-calculation
  - notifications
  - lifecycle
created: 2026-04-02T00:00:00.000Z
updated: 2026-04-02T00:00:00.000Z
status: active
related:
  - '[[sick-leave-service-deep-dive]]'
  - '[[sick-leave-service-implementation]]'
  - '[[frontend-sick-leave-module]]'
  - '[[sick-leave-dayoff-data-patterns]]'
branch: release/2.1
---

# Sick-Leave Module — GitLab Ticket Findings

**Source:** ~45 unique tickets mined across searches: "sick leave", "больничный", "sick", "мои больничные", "accounting_status".

## A. Open/Upcoming Features

### #3408 [OPEN] Family member sick leave (Sprint 16)
- New `familyMember` boolean flag (default `false`)
- Splits sick leaves: own vs. family member care
- Adds checkbox "Caring for a family member" to create/edit dialog
- Affects "My Sick Leaves" and "Sick Leave Records" accounting page
- All existing sick leaves default to `familyMember = false`
- **Depends:** #3409 (budgetNorm calculation change)
- **Test cases:** flag creation, editing, display on both pages, default value, norm impact

### #2954 [OPEN] Display working days count
- Add "Work days" column to My Sick Leaves and Employee Sick Leaves tables
- Rename "Срок" → "Дней" + add "Раб. дней"
- Currently only shows calendar days

### #2803 [OPEN] Working during sick leave (Analytical Task)
- Real case: Cyprus employee, 5-day sick leave, worked 3 days + 2 weekends
- System compensated 5 vacation days instead of 2 (counted all sick leave days as non-working)
- No resolution — open analytical task

### #2465 [OPEN] Status filter for My Sick Leaves table (Low priority)

## B. Dual Status Model — State + Accounting Status (CRITICAL)

### #2559 [CLOSED] Rename "Status" to "State" (Sprint 5)
- Two independent status dimensions:
  - **State** (состояние): Open, Planned, Overdue, Closed, Rejected, Deleted
  - **Accounting Status** (статус бухгалтерии): New, Processing, Paid, Rejected
- **Test cases:** both dimensions displayed correctly, independent updates

### #2562 [CLOSED] Add accountingStatus field (Sprint 6)
- DB field with values: New, Processing, Paid, Rejected
- Changeable by: CHIEF_ACCOUNTANT, ADMIN (all employees), OFFICE_ACCOUNTANT (own office only)
- **Dependency rule:** if accountingStatus == Closed → state must also be Closed, and vice versa

### #2668 [CLOSED] Add Planned and Overdue states (Sprint 6)
- Planned: start date in future
- Overdue: closing date passed but not yet closed
- Display on both personal and accounting pages

## C. Lifecycle / State Management Bugs (Highest Test Priority)

### #2973 [CLOSED] Accountant rejection behavior (Sprint 10)
- **Critical edge case — rejection order matters:**
  - Case 1 (OK): create → close → reject = norm correctly reverts
  - Case 2 (BUG): create → reject → close = norm incorrectly includes sick leave
- **Requirements established:**
  1. Employee CANNOT edit in "Rejected" state
  2. Close action only for "Open" and "Overdue" (closing "Rejected" was a bug)
  3. Overlap notification (#4A) should NOT fire for "Rejected" or "Deleted" sick leaves
  4. DM/TL: same restrictions apply
  5. Closing "Planned" sick leave IS allowed (design decision)
- **Test cases:** all permutations of state × action × role

### #2567 [CLOSED] Accountant/admin editing at any status (Sprint 6)
- CHIEF_ACCOUNTANT, ADMIN, OFFICE_ACCOUNTANT: no editing restrictions regardless of state
- **Exception (UPD in comments):** accountants CANNOT delete from Sick Leave Records UI
- **State-action matrix:**
  - State "Rejected": edit allowed for employee
  - State "Closed" + accounting ≠ "Paid": edit and delete allowed
  - State "Closed" + accounting == "Paid": view only
  - State "Open/Overdue/Planned/Rejected": delete, close, edit all allowed
  - State "Deleted": NO editing, status dropdown shows plain text (not selectable)
- **Test cases:** full matrix of state × accounting_status × role × action

### #2636 [CLOSED] Forbid editing deleted sick leave (Sprint 6)
- Accountant CANNOT edit deleted sick leaves
- Edit icon hidden for deleted sick leaves
- Status dropdown for deleted = plain text
- Date overlap notification (#4A) excludes deleted sick leaves
- Email notification (ID_105) excludes deleted sick leaves
- **Test cases:** edit icon visibility, overlap exclusion, notification exclusion

## D. Permission / Visibility Bugs

### #3213 [CLOSED, HIGH] All employees see all sick leaves (Sprint 12)
- **Production bug:** all employees could see everyone's sick leaves on "My Sick Leaves"
- Root cause: MRs #3211 and #3190 were reverted to fix this
- **Test cases:** regression test — verify visibility scope after login

### #3012 [CLOSED] Accounting route accessible to regular employees (Sprint 11)
- `/accounting/sick-leaves` visible to regular employees
- Root cause: checked `VACATIONS` permission with `VIEW` instead of `SICK_LEAVE_ACCOUNTING_VIEW`
- Fix: added new permission `SICK_LEAVE_ACCOUNTING_VIEW`
- **Test cases:** route access per role

### #2524 [CLOSED, HotFix] One employee sees another's sick leave (Sprint 4)
- **Production "flickering bug":** intermittent visibility leak
- Root cause: frontend sends request WITHOUT `employeeLogin` param on page refresh → API returns ALL
- Reproduction: login → open My Sick Leaves → refresh page
- **Test cases:** verify employeeLogin param always sent, test page refresh behavior

### #2622 [CLOSED] DM/TL/PM view employee sick leaves (Sprint 10)
- Three tabs: "My Department" (DM/TL), "My Projects" (PM), personal
- **Bugs found:**
  - Tab badge counter was per-page (not total count) → added API response field
  - State filter had "Deleted" option visible (should be hidden)
  - No validation error when no employee selected during creation → "employee cannot be null"
  - Filters not resetting when switching tabs
- **Test cases:** tab content per role, badge counter, filter behavior

### #2873 [CLOSED] DM/TL/PM actions on employee sick leaves (Sprint 10)
- DM/TL can create and edit for their employees
- PM can only view (no edit/create)
- SPM role also returns employee sick leaves (by design)
- API: `/api/vacation/v1/sick-leaves?departmentManagerLogin=<login>`
- Bug: endpoint returned 568 employees instead of expected 16
- **Test cases:** action permissions per role, employee list scope

## E. Norm Calculation / Display Bugs

### #2778 [CLOSED] Deleted sick leave still shows in My Tasks (Sprint 8)
- After deletion, days still red and norms not recalculated
- Required page refresh — caching/update issue

### #2783 [CLOSED] Tooltip norm not recalculated after deletion (Sprint 8)
- Tooltip hours norm unchanged after deleting sick leave

### #2792 [CLOSED] Deleted sick leave shows in Planner (HotFix Sprint 8)
- After deletion, Planner still marks days as red
- Regression noted in comments (multiple fix attempts)

### #2863 [CLOSED] Rejected sick leave colors days in My Tasks (HotFix Sprint 8)
- Accountant rejection should revert day colors to black
- Actual: days remained orange

### #2901 [CLOSED] Individual norm not recalculated when day-off moved during sick leave (HotFix Sprint 8)
- Steps: create calendar event → verify norm → create overlapping sick leave → move day-off outside range
- Expected: norm reduced by both
- Actual: moved day-off not counted in norm calculation

### #2915 [CLOSED] Daily norm incorrect with sick leave (Sprint 9)
- Tooltip "norm for specific day" wrong (second value after slash)

### #2812 [CLOSED] Rejected sick leave in copied availability data (HotFix Sprint 8)
- Copy-to-clipboard includes rejected sick leaves (should exclude)

### #2819 [CLOSED] Confirmation page display issues (HotFix Sprint 8)
- 4 sub-bugs:
  1. Weekend hours not shown in orange
  2. Deleted sick leave (`status:"DELETED"`) still displayed
  3. Unapproved day-off transfer shows incorrectly
  4. Sick leave not displayed in "By Employees" confirmation view

**Test pattern:** for EACH state change (create, delete, reject, close), verify:
- My Tasks page: day colors, norm tooltip, cell values
- Planner: day marking
- Availability Chart: copy data
- Confirmation page: both views
- Statistics: norm calculation

## F. Vacation-Sick Leave Crossing

### #2641 [CLOSED] Missing overlap popup (Sprint 7)
- Creating sick leave overlapping existing vacation should trigger notification popup
- Actual: created without warning
- **Test cases:** overlap detection across absence types

### #3193 [CLOSED] Maternity leave interaction (Sprint 13)
- 130-day sick leave for maternity caused incorrect vacation day accrual (24 days added for 2025)
- Required manual DB correction
- **Test cases:** long sick leaves, maternity-related edge cases

## G. Notification Bugs

### #2673 [CLOSED] File attachment email sent to wrong recipients (Sprint 6)
- Should go only to accountants of employee's office
- Actual: sent to managers/PMs too

### #2623 [CLOSED] DM/TL notifications for sick leave (Sprint 10)
- New notification IDs 107-111: DM/TL creates/edits sick leave for employee

### #2432 [CLOSED] Per-office notification recipients (Sprint 4)
- DB config: which employees/addresses receive notifications per office (Calculation Center)

## H. Display / Data Issues

### #3257 [CLOSED] Sick leave not displayed in tables (Sprint 13)
- Data exists in DB but not shown in UI
- Both "Sick Leave Records" and "My Sick Leaves" affected

### #2609 [CLOSED] "No data" in table (Sprint 6)
- Despite having open sick leaves, table empty
- Partially fixed, then regressed for specific users (500 error)

### #2561 [CLOSED] Add office field to SickLeaveDTO (Sprint 6)
- `SickLeaveDTO` needed `office` field (id and name)

## I. Original Implementation / QA Rounds

### #2553 [CLOSED] Changes after adding accountant UI (Sprint 6)
- **9 bugs from QA round:**
  1. Accountant page inaccessible for ACCOUNTANT role
  2. Accountant name not displayed after status change
  3. Closed+unpaid: no actions available
  4. "Notify also" field: 400 for specific employee (DB sync issue)
  5. Deleted sick leave blocks date overlap
  6. Accountant editing own sick leave shows wrong name (WON'T FIX)
  7. State not changing to "Overdue" when date passes
  8. Closed+Paid row missing yellow highlight
  9. Overlap popup broken

### #2947 [CLOSED] Working days in Accounting page (Sprint 10)
- "Срок" → "Дней", added "Раб. дней" column
- "In progress" EN status renamed to "Pending"

### #2428 [CLOSED] My Tasks: sick leave day marking (Sprint 4)
- Days marked orange (same as vacation, holidays, weekends)
- Cells remain active for hour input (can report work during sick leave)
- Tooltip text accounts for sick leave in norm calculation
- UPD: deleting sick leave must reverse norm adjustment

## Summary — Top Test-Worthy Findings

1. **Dual status model** — State × Accounting Status × Role × Action matrix. Most complex aspect. Tickets #2567, #2636, #2973 all found matrix violations.
2. **Norm recalculation propagation** — 8 tickets (#2778-#2915) where state changes failed to propagate to My Tasks, Planner, Availability Chart, Confirmation page.
3. **Rejection order dependency** (#2973) — create→close→reject works; create→reject→close breaks norm. Critical edge case.
4. **Visibility scope bugs** (#3213, #2524, #3012) — production bugs where employees saw others' data. Regression testing essential.
5. **DM/TL/PM permission model** (#2622, #2873) — three tabs with different role-based access, action restrictions, and employee scope.
6. **Cross-page cache invalidation** — after any state change, ALL pages (My Tasks, Planner, Availability, Confirmation, Statistics) must update.
7. **Upcoming familyMember flag** (#3408) — splits sick leave types, affects budgetNorm calculation.
8. **Date overlap exclusions** — overlap check must skip Rejected and Deleted sick leaves but not others.


## Sprint 16 Updates (Session 98)

### #3408 — familyMember flag for sick leaves (Sprint 16, To Do)
- New boolean `familyMember` flag (default `false`) splits all sick leaves into 2 types:
  - `familyMember = false` — own sick leave (default, existing behavior)
  - `familyMember = true` — caring for a family member
- All existing sick leaves retroactively treated as `familyMember = false`
- **UI changes:**
  - Create/Edit sick leave dialog: new checkbox "По уходу за членом семьи" (EN: "Caring for a family member"), default unchecked
  - Calendar > My sick leaves: display updated
  - Accounting > Sick leave accounting: display updated
- **Impact on budgetNorm:** familyMember=true sick leaves are NOT deducted from individual norm — they're added to budgetNorm like admin vacations (see #3409)
- **Test scenarios:**
  - Create sick leave with familyMember=false (default) — norm should decrease
  - Create sick leave with familyMember=true — norm should NOT decrease, budgetNorm shows both values
  - Edit existing sick leave to toggle familyMember flag — verify norm recalculation
  - Verify all historical sick leaves show familyMember=false
  - Check calendar display differentiates the two types
  - Check accounting display includes familyMember column/filter
