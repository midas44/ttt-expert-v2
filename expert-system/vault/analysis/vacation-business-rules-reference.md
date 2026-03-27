---
type: analysis
tags:
  - vacation
  - business-rules
  - reference
  - phase-b-prep
  - priority-1
  - ticket-mining-enriched
created: '2026-03-15'
updated: '2026-03-26'
status: active
related:
  - '[[patterns/vacation-day-calculation]]'
  - '[[modules/vacation-service-implementation]]'
  - '[[patterns/multi-approver-workflow]]'
  - '[[analysis/role-permission-matrix]]'
  - '[[analysis/absence-data-model]]'
  - '[[exploration/tickets/vacation-ticket-findings]]'
branch: release/2.1
---
# Vacation Business Rules Reference

Structured compilation of all vacation business rules from code, requirements, DB analysis, live testing, and **comprehensive GitLab ticket mining (250+ tickets analyzed)**. Organized for Phase B test case generation.

## 1. Two Calculation Modes

Office-level setting `advanceVacation` (from CompanyStaff) drives fundamentally different behavior.

| Rule | AV=false (Russia) | AV=true (Cyprus/Germany) |
|---|---|---|
| Available days | Monthly accrual formula | Full year immediately |
| Negative balance | Never (display 0) | Allowed for current year |
| Over/undertime impact | None | Adjusts balance monthly |
| Insufficient days | Red error, block submit | Error 11.4 "Insufficient days" |
| Payment month display | "X of Y" form | No "X of Y" display |
| Manual correction | Cannot go negative | Can go negative |
| FIFO consumption | Yes | Yes |
| Norm deviation | None | BOTH type → fractional days |

**Formulas:**
- AV=false: `available = (month × norm/12) + yearRemainder + priorYears − norm + futureDays + editedDays`
- AV=true: `available = currentYearDays + pastYearDays + futureDays + editedDays`
- Norm deviation (AV=true): `available = norm + deviation − consumed`
- Accrued days (#3014/#3015): `X = monthsWorked * md/12 + remainderDays - md`

## 2. Status State Machine

```
NEW → APPROVED (main approver approves)
NEW → REJECTED (main approver rejects)
NEW → CANCELED (employee cancels)
NEW → DELETED (employee deletes)
REJECTED → APPROVED (re-approval without edit — confirmed possible)
APPROVED → NEW (employee edits dates — resets status)
APPROVED → CANCELED (employee cancels)
APPROVED → REJECTED (approver rejects)
APPROVED → PAID (accountant pays — terminal)
CANCELED → NEW (employee re-opens)
PAID → terminal (no transitions out)
DELETED → terminal (soft delete)
```

**Live distribution**: PAID 94.3%, DELETED 3.2%, APPROVED 1.5%, NEW 0.6%, REJECTED 0.4%

## 3. Approval Workflow

**Auto-assignment on creation:**
- CPO (chief) → self-approval + manager as optional approver (#3319)
- Regular employee → manager as primary approver
- No manager → self-approval
- DEPARTMENT_MANAGER → self-approval (confirmed in live testing)

**Two-tier model:**
- Primary approver: single, stored on `vacation.approver`. Their action drives state changes.
- Optional approvers: `vacation_approval` table. Statuses: ASKED → APPROVED/REJECTED. **Not required** for vacation to advance.
- Notify-also: `vacation_notify_also` table. `required=true` → acts as additional mandatory approver.

**Reassignment:** `changeApprover()` — old becomes optional (ASKED), new becomes primary. 21% of vacations reassigned.

**State resets:** Editing dates resets all optional approvals back to ASKED.

**Known bugs:**
- #3043: Different approvers shown in employee vs approver view
- #2718 (OPEN): Redirected approved/rejected request doesn't reset status to NEW
- #2640: Editing dates of APPROVED vacation didn't trigger status reset
- #2862: Month re-closure breaks approval month handling

## 4. FIFO Day Consumption

Days consumed from **earliest year first**. Cross-year splits tracked in `vacation_days_distribution` (vacation_id + year → days).

**On cancel/reject/edit:** Days returned to pool, redistributed among remaining NEW/APPROVED vacations using FIFO.

**Recalculation service:** Returns ALL regular+exact days to balance, then re-distributes. Insufficient days → auto-converts later requests to ADMINISTRATIVE.

**Sprint 15 (#3347):** Smart reallocation — validates both current and future-year requests, reallocates without converting to admin.

**AV=True consumption order (#3092 D1):**
- Current-year payment: consume earliest years first (2023→2024→2025); release reverse
- Next-year payment: consume next-year first (2026), then previous (2023→2024), then current (2025)

## 5. Payment Flow

**Trigger:** Accountant pays individual vacation or cron auto-pays expired (>2 months old approved).

**Validation:** Status must be APPROVED, period must be EXACT, `regularDaysPayed + administrativeDaysPayed` must equal `vacation.getDays()`.

**Key behavior:** Days deducted at **approval** time, not payment. Payment is purely status transition APPROVED → PAID.

**Payment types:** REGULAR (paid leave), ADMINISTRATIVE (unpaid / за свой счёт). Mixed possible.

**Auto-pay cron:** `payExpiredApproved()` runs daily, finds APPROVED >2 months old, auto-distributes by type.

**Payment month validation (#3379 hotfix):** Must check **Approval period** (not Report period). Old design from #1399 incorrectly used Report period. Production bug discovered on #3377.

**Known bugs:**
- #3363 (OPEN): Error 500 on vacation payment when AV=true balance is negative (no validation, just 500)
- #2951: Partial payment doesn't return unused days
- #3141: Old ADMINISTRATIVE vacations stuck in APPROVED (not auto-paid)
- #2704/#2768: Employee names disappear from payment table after bulk payment
- No type alignment validation (admin vacation paid with regular split accepted)
- 2-hour orphan window in status update job
- DB/API day-type transposition

## 6. Vacation-Calendar Interaction

**Trigger:** Day-off deletion/transfer or production calendar change that increases vacation days.

**Phase 1 (immediate):** Check if annual days exceeded → convert to ADMINISTRATIVE.

**Phase 2 (10 min delay):** If annual OK, check accrued days for affected payment month and all later months → convert if insufficient, send notification.

**Known bugs:**
- #3300: Calendar change for next year applied immediately to current year
- #3338: Calendar change converts ALL vacations, not just the one containing the changed date
- #2782: Error 500 "Calculation error" when vacation overlaps PC event with non-zero hours (wrong SQL ID field)
- #2731: Error 500 on deleting confirmed vacation — data inconsistency in vacation_days_distribution
- #2372: Auto-deletion on 0-day vacation sends 2 emails (one incorrect), rejected/canceled vacations not handled
- #3301: Complex interaction between yearly balance vs accrued days validation (32 comments; decided: keep only yearly balance)

## 7. Create/Edit Request Validations

| Validation | AV=false | AV=true | Both |
|---|---|---|---|
| Employment +3 months (#3014) | ✓ (regular only) | ✓ | |
| Min 1 day | | | ✓ |
| Available days ≥ requested | Red error, block | Error 11.4 | |
| Future request impact (#3015) | Orange warning | Orange warning | |
| Payment month in range | 2mo before → end month | 2mo before → end month | |
| Payment month not closed | ✓ | ✓ | |
| `paymentMonth` required | ✓ (NPE if null) | ✓ (NPE if null) | |
| `optionalApprovers` not null | | | ✓ (NPE if null) |
| Overlapping vacation check | | | ✓ |
| Start date ≥ today (#3014) | | | ✓ (was tomorrow+, now today OK) |

**Accrued days validation (#3015):** On create/edit, check all future requests (later payment month) still have enough accrued days. If not, auto-convert earliest-deficit request to Administrative. Conversion order: chronological by payment month, select request with minimum X value.

**First 3 months restriction (#3014):**
- Dates in first 3 months of employment disabled in calendar for Regular requests
- Administrative requests NOT restricted
- Calendar should open to first available (non-disabled) month
- Bug history: calculation was incorrect for employees hired before July 2024 (#3014 Bug 30)

**Dynamic validation (#3014):** Messages update on field change, not just on Save. Exception: "required field" validation only on Save click.

## 8. Day Correction Rules

- **AV=false:** Prohibit negative values in inline editing
- **AV=true:** Allow negative values
- **#3283:** Manual corrections floor at ≥0, but auto corrections can go negative. Architecture inconsistency.
- Causes: underwork, day-off moves, admin adding work days, manual edits
- Corrections reflected in Event Feed
- **Bug found:** `pastPeriodsAvailableDays` drift — DB accepts edit but recalculation may not honor AV=false negative prohibition

## 9. Permissions (Who Can Do What)

| Action | Roles |
|---|---|
| View own vacations | EMP (all logged-in) |
| View approval requests | PM, DM, TL, ADM, VALL |
| Create vacation | EMP (non-readOnly) |
| Approve/Reject | Primary approver (PM/DM/ADM role) |
| Change approver | Primary approver |
| Pay vacation | ACC, CACC, ADM |
| Edit vacation days | ACC, CACC, ADM, VALL |
| View vacation days | ACC, CACC, ADM, VALL |
| View payments | ACC, CACC, ADM, VALL |
| View employees | DM |
| Cancel | Employee (own, pre-PAID) |
| Delete | Employee (own, CANCELED/REJECTED) |

## 10. Known Bugs — Complete Catalog

### A. Calculation Bugs (Highest Severity)

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| A1 | #3361 | AV=True: Multi-year balance distribution blocks current-year creation | OPEN | HIGH |
| A2 | #3360 | "Expected balance by year-end" sums only 3-year window | CLOSED (hotfix) | HIGH |
| A3 | #3355 | System accrues vacation days during maternity leave | CLOSED | HIGH |
| A4 | #3352 | Maternity leave overlap → days not returned to balance | OPEN | HIGH |
| A5 | #3339 | AV=False: Day-off deletion in vacation period → balance goes to 0 | CLOSED | HIGH |
| A6 | #3338 | Calendar change converts ALL vacations, not just affected one | CLOSED | HIGH |
| A7 | #2789 | Double accrual on salary office change | OPEN | HIGH |
| A8 | — | -60 day cluster (batch recalculation bug) | — | HIGH |
| A9 | — | pastPeriodsAvailableDays drift | — | MEDIUM |
| A10 | — | FIFO validation gap at creation | — | MEDIUM |

### B. Approval Workflow Bugs

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| B1 | #3379 | Payment month uses Report period instead of Approval period | CLOSED (hotfix) | HIGH |
| B2 | #2718 | Redirected approved/rejected request doesn't reset status | OPEN | MEDIUM |
| B3 | #3310 | Incorrect admin vacation assignment on payment month change | CLOSED | MEDIUM |
| B4 | #3043 | Different approvers shown in employee vs approver view | CLOSED | LOW |
| B5 | #2640 | Editing dates of APPROVED vacation doesn't reset to NEW | CLOSED | MEDIUM |
| B6 | — | Re-approval after rejection without edit (possible) | — | LOW |
| B7 | — | Orphaned approvals on deletion (no cascade) | — | LOW |

### C. CRUD/Form Bugs

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| C1 | #3240 | Overlapping vacations not blocked by frontend | CLOSED | MEDIUM |
| C2 | #3042 | Vacations without status in API response (23 affected) | CLOSED | HIGH |
| C3 | #2705 | Payment month not updated in edit modal after save | CLOSED | MEDIUM |
| C4 | #3065 | 404 page on "More details" link | CLOSED | HIGH |
| C5 | #3127 | Flash of irrelevant validation on first date pick | CLOSED | LOW |
| C6 | — | NPE on null paymentMonth | — | HIGH |
| C7 | — | NPE on null optionalApprovers | — | HIGH |
| C8 | — | NPE on null pagination | — | HIGH |

### D. Accrued Days Validation Bugs (#3015 — 31 sub-bugs)

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| D1 | #3015-1 | Inter-year conversion fails | FIXED | HIGH |
| D2 | #3015-4 | Error 400: freed days from conversion not restored | FIXED | HIGH |
| D3 | #3015-7 | Wrong conversion order (latest-first) | FIXED | HIGH |
| D4 | #3015-10 | Multiple future requests — only some converted | FIXED | HIGH |
| D5 | #3015-17 | Current request auto-converts instead of future | FIXED | HIGH |
| D6 | #3015-29 | UI identifies wrong request as converted | FIXED | MEDIUM |
| D7 | #3015-30 | Silent conversion — no UI messages | FIXED | HIGH |
| D8 | #3015-31 | UI messages but no actual conversion | FIXED | HIGH |

### E. Form Changes Bugs (#3014 — 35 sub-bugs)

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| E1 | #3014-21 | Edit treats own days as consumed → shows 0 available | FIXED | HIGH |
| E2 | #3014-15 | Year transition: leftover days not available for next year | FIXED | HIGH |
| E3 | #3014-25 | First 3 months: days show non-zero but save returns 400 | FIXED | HIGH |
| E4 | #3014-26 | Editing can move period into restricted 3-month zone | FIXED | HIGH |
| E5 | #3014-30 | 3-month calculation wrong for employees hired before July 2024 | FIXED | MEDIUM |
| E6 | #3014-31 | Available days doubled on edit popup (overcorrection) | FIXED | HIGH |
| E7 | #3014-3 | English shows template placeholders instead of data | FIXED | MEDIUM |

### F. Payment/Accounting Bugs

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| F1 | #3363 | AV=true: Error 500 on negative balance payment | OPEN | HIGH |
| F2 | #2951 | Partial payment doesn't return unused days | CLOSED | MEDIUM |
| F3 | #3141 | Old ADMINISTRATIVE vacations stuck in APPROVED | CLOSED | MEDIUM |
| F4 | #2704 | Employee names disappear after bulk payment | CLOSED | LOW |
| F5 | — | No type alignment validation | — | MEDIUM |
| F6 | — | 2-hour orphan window in status update job | — | HIGH |
| F7 | — | DB/API day-type transposition | — | MEDIUM |

### G. Calendar Integration Bugs

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| G1 | #3300 | Next-year calendar change applied to current year | CLOSED | HIGH |
| G2 | #2782 | Error 500 on vacation overlap with PC event (wrong SQL ID) | CLOSED | HIGH |
| G3 | #2731 | Error 500 on deleting confirmed vacation (data inconsistency) | CLOSED | HIGH |
| G4 | #2372 | Auto-deletion on 0-day sends 2 emails (one incorrect) | CLOSED | MEDIUM |

### H. Notification Bugs

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| H1 | #3315 | Duplicate notifications (Fri+Sat+Sun instead of last working day) | CLOSED (hotfix) | HIGH |
| H2 | #3344 | Russian messages in English events feed | CLOSED | MEDIUM |
| H3 | #2925 | Wrong payment month in email notification | OPEN | MEDIUM |

### I. Data Integrity / Sync Bugs

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| I1 | #3302 | Doubled accrued days in Ulugbek SO (CS-TTT mismatch) | CLOSED (hotfix) | HIGH |
| I2 | #3033 | Deadlock on cache update (two caches, different order) | CLOSED (hotfix) | HIGH |
| I3 | #3073 | Double accrual after CS settings sync | CLOSED | HIGH |
| I4 | #3329 | Approver field missing from API response (intermittent) | CLOSED (hotfix) | HIGH |
| I5 | #3374 | last_date not updated during CS sync | OPEN | MEDIUM |

### J. UI / Frontend Bugs

| # | Ticket | Description | State | Severity |
|---|---|---|---|---|
| J1 | #3297 | Latin name search broken on Employee Vacation Days | OPEN | MEDIUM |
| J2 | #3370 | Maternity leave user can't edit vacation (0 available) | OPEN | MEDIUM |

**Total: 50+ distinct bugs across 10 categories. 11 currently OPEN.**

## 11. Recurring Root Causes

1. **Incorrect SQL queries** — wrong ID fields, missing JOINs (#2782, #3202)
2. **Race conditions in caching** — deadlock (#3033), stale data
3. **Design changes that didn't propagate** — Report vs Approval period (#3379/#1399)
4. **Missing edge case validation** — negative balance, maternity leave, 0-day vacations
5. **Frontend-backend disagreement** on available days calculation
6. **CS sync gaps** — field mapping mismatches, double accruals (#3302, #3073, #2789)
7. **Multi-vacation FIFO redistribution** — fragile across calendar changes, day-off deletions
8. **Conversion logic complexity** — 31 bugs in #3015 alone (chronological ordering, multi-request selection)

## Related
- [[patterns/vacation-day-calculation]] — formula details
- [[modules/vacation-service-implementation]] — backend implementation
- [[modules/vacation-service-deep-dive]] — code-level analysis
- [[patterns/multi-approver-workflow]] — approval pattern
- [[analysis/absence-data-model]] — data model
- [[analysis/role-permission-matrix]] — access control
- [[analysis/vacation-form-validation-rules]] — form validation rules
- [[exploration/api-findings/vacation-crud-api-testing]] — CRUD test results
- [[exploration/api-findings/payment-flow-live-testing]] — payment test results
- [[exploration/tickets/vacation-ticket-findings]] — comprehensive ticket mining
- [[exploration/tickets/vacation-ticket-3092-advance-vacation]] — AV=true implementation
- [[exploration/tickets/vacation-ticket-3015-accrued-days-validation]] — accrued days validation
- [[exploration/tickets/vacation-ticket-3014-form-changes]] — form redesign
- [[investigations/vacation-day-calculation-verification]] — formula verification
- [[investigations/vacation-approval-workflow-e2e]] — approval trace
- [[investigations/vacation-sprint-15-technical-details]] — Sprint 15 AV changes
- [[investigations/vacation-av-true-multiYear-balance-3361]] — #3361 investigation
- [[external/requirements/REQ-vacations-master]] — master requirements
- [[external/requirements/REQ-accrued-vacation-days]] — AV=false spec
- [[external/requirements/REQ-advance-vacation]] — AV=true spec
- [[external/requirements/REQ-vacation-day-corrections]] — correction rules
