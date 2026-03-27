---
type: exploration
tags:
  - vacation
  - gitlab-tickets
  - bug-mining
  - regression-tests
  - phase-a
created: '2026-03-26'
updated: '2026-03-26'
status: active
related:
  - '[[analysis/vacation-business-rules-reference]]'
  - '[[modules/vacation-service-deep-dive]]'
  - '[[modules/frontend-vacation-module]]'
---
# Vacation Module — GitLab Ticket Mining Findings

Comprehensive mining of ALL vacation-related tickets in ttt-spring project (250+ tickets, spanning 2018–2026). Read descriptions AND comments for the 30+ most relevant tickets.

## 1. Calculation Bugs (Highest Severity)

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3361** | AV=True: Incorrect multi-year balance days distribution | OPEN | Next-year vacation incorrectly prevents current-year creation even when balance days exist in both years |
| **#3360** | "Expected balance by year-end" sums only 3-year window | CLOSED (hotfix) | Limits to current + 2 previous years instead of all employment years. Long-tenure employees affected |
| **#3355** | System adds vacation balance to maternity leave user | CLOSED | Days continue accruing during maternity instead of zeroing out. Affects 7+ endpoints |
| **#3352** | Incorrect recalculation after adding maternity leave | OPEN | Overlapping maternity + vacation → days not properly returned to balance |
| **#3339** | AV=False: Incorrect balance recalculation on day-off deletion within vacation | CLOSED | Available days go to 0 instead of correct recalculation when day-off deletion triggers admin conversion |
| **#3338** | AV=False: Incorrect conversion of MULTIPLE vacations after calendar change | CLOSED | ALL vacations converted instead of just the one containing the changed date |
| **#3204** | Incorrect vacation days with undertime correction | CLOSED (canceled) | After underwork correction, prior-year carry-over becomes unavailable |
| **#2789** | Double accrual on SO (salary office) change | OPEN | Employee transferring between SOs gets days accrued twice for the year |
| **#1036** | Incorrect calculation with lastYear flag | CLOSED | Wrong calculation when lastYear == true |
| **#2855** | Wrong available_vacation_days after SO transfer | CLOSED | Different annual_leave between old/new SO causes incorrect balance |

### Test Cases from Calculation Bugs
- **REGRESSION:** Create vacation for AV=true employee with balance in both current and next year → verify both years accessible (#3361)
- **REGRESSION:** Verify "Expected balance by year-end" includes ALL employment years, not just 3-year window (#3360)
- **EDGE CASE:** Employee on maternity leave should NOT accrue vacation days (#3355)
- **EDGE CASE:** Add maternity leave overlapping existing vacation → verify days properly returned (#3352)
- **REGRESSION:** Delete day-off within vacation period (AV=false) → verify balance recalculation (#3339)
- **REGRESSION:** Calendar change affecting one vacation must NOT convert other vacations (#3338)
- **EDGE CASE:** Employee transferring between SOs → verify no double accrual (#2789)

## 2. Approval Workflow Bugs

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3379** | Payment month change uses Report period instead of Approval period | CLOSED (hotfix) | Design flaw from old change #1399 — system checks wrong period type. Production bug |
| **#3319** | CPO self-approval of vacations and day-offs | CLOSED | Chief Production Officer needs self-approval. Implemented via "approver" property |
| **#3310** | Incorrect admin vacation assignment on payment month change | CLOSED | Warning messages reference wrong request; conversion doesn't happen correctly |
| **#3043** | Different approvers shown in employee vs approver view | CLOSED | Inconsistent approver display between the two views |
| **#2718** | Redirected approved/rejected request should reset status | OPEN | When approved/rejected vacation is redirected, status doesn't reset to NEW |
| **#2862** | Handle month re-closure — revert approval month backward | CLOSED | Re-opening and re-closing a month breaks approval month handling |
| **#2640** | Changing dates in confirmed request doesn't reset to New | CLOSED | APPROVED vacation date edit doesn't trigger status reset |

### Test Cases from Approval Bugs
- **REGRESSION:** Edit vacation → change payment month → verify Approval period (not Report period) checked (#3379)
- **EDGE CASE:** CPO creating vacation → verify self-approval (#3319)
- **REGRESSION:** Redirect approved vacation to new approver → verify status resets to NEW (#2718)
- **REGRESSION:** Edit dates of APPROVED vacation → verify status resets to NEW (#2640)

## 3. CRUD / Form Bugs

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3240** | Overlapping vacations not blocked by frontend | CLOSED | Encompassing date range not detected; Save not disabled; API error on save |
| **#3042** | Vacations without status in API response | CLOSED | 23 vacations missing status field, breaking STT sync with 500 |
| **#3127** | Flash of irrelevant validation message on first date pick | CLOSED | Momentary incorrect duration validation display |
| **#3066** | Incorrect notification bar on period change | CLOSED | Wrong notification plaque after editing vacation period |
| **#3065** | 404 page on vacation request details | CLOSED (Urgent) | "More details" link leads to 404 |
| **#2705** | Payment month not updated in edit modal after save | CLOSED | Re-opening edit modal shows old payment month. 26 comments of investigation |
| **#805** | Start date defaults to 1st of month | CLOSED | Form prefills start date as first day of month |

### Test Cases from CRUD Bugs
- **REGRESSION:** Create vacation overlapping existing one → verify frontend blocks save (#3240)
- **REGRESSION:** Open vacation details via "More details" → verify no 404 (#3065)
- **REGRESSION:** Edit payment month, save, reopen → verify updated month shown (#2705)
- **UI:** Select first date in create form → verify no flash of incorrect validation (#3127)

## 4. Calendar Integration Bugs

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3300** | Calendar change for next year applied immediately | CLOSED | Next-year PC change incorrectly applies to current year calendars. 16 comments |
| **#2782** | Error 500 "Calculation error" on vacation overlap with PC event (7-8h) | CLOSED | SQL query using wrong ID field. Intermittent |
| **#2731** | Error 500 on deleting confirmed vacation | CLOSED | Vacation_days_distribution count differs from vacation length. Data inconsistency |
| **#3301** | Balance validation with Calendar changes | CLOSED (Canceled) | Complex interaction: yearly balance vs accrued days validation. 32 comments. Decision: keep only yearly balance |
| **#2372** | Delete vacation when duration becomes 0 after calendar change | CLOSED | Auto-deletion sends 2 emails (one incorrect), rejected/canceled vacations not handled |

### Test Cases from Calendar Bugs
- **REGRESSION:** Make next-year calendar change → verify current-year calendars unchanged (#3300)
- **EDGE CASE:** Vacation overlapping PC event with non-zero hours → verify no 500 (#2782)
- **REGRESSION:** Calendar change reducing vacation to 0 days → verify auto-deletion + single correct email (#2372)

## 5. Payment / Accounting Bugs

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3377** | Payment month changes to confirmation month on production | CLOSED | Real production bug. Fixed in #3379 |
| **#3363** | AV=true: Error 500 on negative balance payment | OPEN | Pay vacation when balance negative → 500 instead of validation error |
| **#2951** | Days not returned on partial vacation payment | CLOSED | Partial payment fails to return unused days |
| **#2704** | Employee names disappear after bulk payment | CLOSED | UI glitch on payment table |
| **#3141** | Old ADMINISTRATIVE vacations stuck in APPROVED | CLOSED | Large number not auto-converting to PAID |
| **#3283** | Vacation day correction: new logic per AV setting | CLOSED | Manual corrections >=0 floor, auto corrections can go negative. Architecture inconsistency |

### Test Cases from Payment Bugs
- **REGRESSION:** Pay vacation for AV=true employee with negative balance → verify proper validation error, not 500 (#3363)
- **EDGE CASE:** Partial payment → verify remaining days returned to balance (#2951)
- **REGRESSION:** Bulk payment → verify employee names remain visible in table (#2704)

## 6. Notification / Email Bugs

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3315** | Duplicate email notifications for vacation/absence reminders | CLOSED (hotfix) | Sent Fri+Sat+Sun instead of only last working day. Also: maternity employees still receive; day-off rescheduling sends for old date. 12 comments with multiple sub-bugs |
| **#3344** | Russian messages in English version of events feed | CLOSED | Under/overwork correction messages display in Russian even in English mode |
| **#2925** | Incorrect payment month in email notification | OPEN | Email shows wrong payment month on status change |
| **#3281** | Email template ID_85 not delivered | CLOSED | Calendar update notification not reaching receiver |

## 7. Advance Vacation (AV) Logic — Deep Feature Tickets

| Ticket | Title | State | Comments | Sub-bugs |
|---|---|---|---|---|
| **#3092** | Implement advance vacation per CS setting | CLOSED | **50+ comments** | **14+ sub-bugs**: wrong recalculation, negative balance handling, incorrect events feed, 500 on payment |
| **#3347** | AV=true: Corner cases next-year vacation uses current-year days | OPEN | BDD test cases provided | Smart reallocation needed |
| **#3369** | Backend allows past vacation without balance deduction | OPEN | Clock manipulation edge case | |
| **#3015** | Validate accrued days for later payment months | CLOSED | **59 comments** | **31+ sub-bugs**: conversion notifications, wrong vacation referenced, admin type failures |
| **#3014** | Vacation request form changes | CLOSED | **62 comments** | **35+ sub-bugs**: calendar navigation, mid-year hire accrual, admin payment month control |

## 8. Data Integrity / Sync Bugs

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3302** | Doubled accrued days in Ulugbek SO | CLOSED (hotfix) | CS config ↔ TTT DB mismatch. 20 comments |
| **#3329** | Approver field missing from API response | CLOSED (hotfix) | Intermittent production issue |
| **#3374** | last_date not updated during CS sync | OPEN | Termination date not synced |
| **#3202** | API 404 for page 3-4 | CLOSED | Missing office_id for some employees |
| **#3033** | Deadlock on cache update | CLOSED (hotfix) | Two caches filled in different order by different threads |
| **#3073** | Double accrual after CS settings sync | CLOSED | New SO settings sync causes double accrual |

## 9. UI / Frontend Bugs

| Ticket | Title | State | Key Finding |
|---|---|---|---|
| **#3297** | Latin name search broken on Employees vacation days | OPEN | Only Russian names and login work |
| **#3370** | Maternity leave user can't edit vacation (0 available days) | OPEN | Available days shows "0" when editing |
| **#3128** | Rewrite vacationValidationForm to yup + TypeScript | CLOSED | Frontend validation refactored |
| **#2843** | Employee Vacation Days filter broken in English | CLOSED (Dup) | Filter controls break in EN locale |
| **#3251** | Popup layout bugs for vacation create/edit | CLOSED | Layout issues in create/edit dialog |

## Summary Statistics

| Category | Tickets | Open | High-Value for Testing |
|---|---|---|---|
| Calculation | 10 | 3 | ALL — most complex logic |
| Approval workflow | 7 | 1 | #3379, #2718, #2640 |
| CRUD/Form | 7 | 0 | #3240, #2705 |
| Calendar integration | 5 | 0 | #3300, #2782, #2372 |
| Payment/Accounting | 6 | 1 | #3363, #2951 |
| Notifications | 4 | 1 | #3315 |
| AV logic (deep) | 5 | 2 | #3092 (14+ sub-bugs), #3015 (31+ sub-bugs), #3014 (35+ sub-bugs) |
| Data integrity | 6 | 1 | #3302, #3033 |
| UI/Frontend | 5 | 2 | #3297, #3370 |
| **Total** | **55+** | **11** | **30+ regression test candidates** |

## Recurring Root Causes
1. **Incorrect SQL queries** — wrong ID fields, missing JOINs (#2782, #3202)
2. **Race conditions in caching** — deadlock (#3033), stale data
3. **Design changes that didn't propagate** — Report vs Approval period (#3379/#906/#1399)
4. **Missing edge case validation** — negative balance, maternity leave, 0-day vacations
5. **Frontend-backend disagreement** on available days calculation
6. **CS sync gaps** — field mapping mismatches, double accruals (#3302, #3073, #2789)
7. **Multi-vacation FIFO redistribution** — fragile across calendar changes, day-off deletions

## Related
- [[analysis/vacation-business-rules-reference]] — business rules (needs update with these findings)
- [[modules/vacation-service-deep-dive]] — backend code analysis
- [[modules/frontend-vacation-module]] — frontend module
- [[exploration/api-findings/vacation-crud-api-testing]] — API testing results
- [[exploration/api-findings/payment-flow-live-testing]] — payment testing
- [[investigations/vacation-sprint-15-technical-details]] — Sprint 15 AV changes
- [[investigations/vacation-av-true-multiYear-balance-3361]] — #3361 investigation
- [[investigations/vacation-past-date-validation-3369]] — #3369 investigation
