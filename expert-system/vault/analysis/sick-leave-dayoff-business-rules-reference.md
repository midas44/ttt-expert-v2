---
type: analysis
tags:
  - sick-leave
  - day-off
  - calendar
  - business-rules
  - phase-b-ready
created: '2026-03-14'
updated: '2026-03-14'
status: active
related:
  - '[[analysis/vacation-business-rules-reference]]'
  - '[[analysis/reports-business-rules-reference]]'
  - '[[analysis/role-permission-matrix]]'
  - '[[modules/sick-leave-service-implementation]]'
  - '[[modules/day-off-service-implementation]]'
branch: release/2.1
---
# Sick Leave & Day-Off Business Rules Reference

Structured compilation of all sick leave and day-off business rules from 12+ vault notes, code analysis, API testing, and live UI exploration. Organized for Phase B test case generation.

---

## PART A: SICK LEAVE

## A1. Data Model

### Tables (ttt_vacation schema)
- `sick_leave` — main entity
- `sick_leave_file` — M:N to file table (max 5 per sick leave)
- `sick_leave_notify_also` — extra notification recipients
- `office_sick_leave_notification_receiver` — per-office accountant receivers

### Key Fields
| Field | Type | Notes |
|-------|------|-------|
| id | BIGSERIAL | PK |
| employee | FK | Employee who is sick |
| start_date, end_date | DATE | Period |
| total_days | INT | Calendar days (auto-calculated) |
| work_days | INT | Working days within period |
| status | TEXT enum | OPEN, CLOSED, REJECTED, DELETED |
| accounting_status | TEXT enum | NEW, PROCESSING, PAID, REJECTED |
| number | VARCHAR(40) | Certificate number (optional, max 40 chars) |
| accountant | FK nullable | Assigned accountant |
| accountant_comment | TEXT | Accountant's note |

## A2. Dual Status System

### Main Status (`SickLeaveStatusType`)
| Stored | Computed (query-time) | Condition |
|--------|-----------------------|-----------|
| OPEN | SCHEDULED | OPEN + future start_date |
| OPEN | OVERDUE | OPEN + past end_date |
| OPEN | (plain OPEN) | OPEN + in progress |
| CLOSED | — | Explicitly closed |
| REJECTED | — | Accounting rejected |
| DELETED | — | Soft-deleted |

**Read/write asymmetry**: API returns SCHEDULED/OVERDUE but PATCH only accepts OPEN/CLOSED. Undocumented.

### Accounting Status (`SickLeaveAccountingStatusType`)
```
NEW ──→ PROCESSING ──→ PAID
                  └──→ REJECTED
```

**Status coupling** (accounting → main):
| Accounting action | Main status effect |
|-------------------|-------------------|
| Set PAID | Auto-close (status=CLOSED) |
| Set REJECTED | status=REJECTED |
| Set PROCESSING | status=OPEN (reopens if was CLOSED) |
| Set NEW | No auto-change |

**UI accounting transitions**: Any-to-any allowed via inline dropdown — no enforced state machine guardrails. Both New→Paid and Paid→New possible.

## A3. Lifecycle Operations

| Action | Endpoint | Guard | Side Effects |
|--------|----------|-------|-------------|
| Create | POST /v1/sick-leaves | Any authenticated user (**BUG: no permission check**) | Calendar calc, notify, crossing check |
| Edit | PATCH /v1/sick-leaves/{id} | PM for own reports; admin/accountant for PAID | Two-step file update |
| Close | PATCH status=CLOSED | Number field required | Sets CLOSED |
| Reopen | PATCH status=OPEN | Standard perms | Direct status overwrite |
| Delete | DELETE /v1/sick-leaves/{id} | Cannot delete PAID | Soft-delete; files/notify_also orphaned |
| Accounting | PATCH accounting_status | Admin/chief/office accountant only | Sets accountant FK |

### Create Flow
1. Any authenticated user → POST with employee login, start/end dates
2. Backend calculates total_days (calendar) and work_days (working)
3. Overlap check: 409 if `force=false`, allowed if `force=true`
4. Vacation crossing check: if overlaps active vacation → notification
5. Notification sent to employee's manager + optional approvers + notifyAlso + per-office receivers

### Edit Flow (Two-step for files)
1. PATCH dates/number → validated
2. If file changes: upload via POST /v1/files/upload → second PATCH with filesIds
3. FilesAddedEvent only on patch (not create)

### Close Flow
1. Must provide `number` (certificate number, max 40 chars) to close
2. PATCH status=CLOSED + number

## A4. Validation Rules

| Rule | Detail |
|------|--------|
| Date order | startDate ≤ endDate (bean validation) |
| No overlap | No overlapping active sick leaves (excludes DELETED/REJECTED) |
| Vacation crossing | 409 if force=false; allowed if force=true |
| Number to close | Required, max 40 chars |
| Number on create | Optional, max 40 chars |
| File limits | Max 5 files, 5MB each via FileController |
| Delete PAID | Cannot delete PAID sick leave |

## A5. File Handling

- Upload: POST /v1/files/upload → returns UUID
- Include UUID in create/patch request `filesIds` array
- Edit: diff-and-sync — adds new, removes old file associations
- **Soft-delete does NOT clean up file associations** (orphaned records)
- Download: GET /v1/files/{id}/download
- Delete: DELETE /v1/files/{id}

## A6. Notification Events (5 types, async after commit)

| Event | Templates | Trigger |
|-------|-----------|---------|
| Created | NOTIFY_SICKLEAVE_OPEN / _BY_SUPERVISOR | Create by employee / manager |
| Changed | CLOSED / DATES_CHANGED / NUMBER_CHANGED / REJECTED | Status/field change, via chain-of-responsibility |
| Deleted | NOTIFY_SICKLEAVE_DELETE / _BY_SUPERVISOR | Delete by employee / manager |
| Files added | NOTIFY_SICKLEAVE_FILES_ADDED | Files attached via patch |
| Vacation overlap | NOTIFY_EMPLOYEE_SICKLEAVE_OVERLAPS_VACATION | Sick leave crosses active vacation |

**Recipients**: employee's manager + optional approvers + notifyAlso + per-office notification receivers

**BUG: Reference equality in getEditorType()**: `employee == currentEmployee` uses `==` on separately-fetched BO instances → always false. Notification editor type falls through to default.

## A7. Overdue Warning System

- `OverdueSickLeaveCommand` — per-request check (not cron)
- Evaluates: OPEN + end_date < today → surfaces `OVERDUE_SICK_LEAVE` warning
- Shown in manager views as green checkmark action button

## A8. Permission Model

| Role | View | Accounting View | Mutation |
|------|------|----------------|----------|
| TECH_LEAD | ✓ | | |
| PROJECT_MANAGER | ✓ | | Own reports' sick leaves |
| DEPARTMENT_MANAGER | ✓ | ✓ | |
| ACCOUNTANT | | ✓ | |
| CHIEF_ACCOUNTANT | | ✓ | |
| ADMIN | | ✓ | PAID sick leaves |
| Any authenticated | | | **Create for anyone (BUG)** |

### Route-level gaps
- `/sick-leave/my` has **no router-level permission check** (TODO comment in code)

## A9. UI Views (3 pages)

| Page | Route | User | Key Features |
|------|-------|------|-------------|
| My Sick Leaves | /sick-leave/my | Employee | Add/edit/close/delete, file upload (max 5), number field |
| Sick Leaves of Employees | /vacation/sick-leaves-of-employees | Manager | My department / My projects tabs, state+status filters |
| Accounting | /accounting/sick-leaves | Accountant | Inline accounting status dropdown, comment tooltip, 10 columns |

### Accounting page columns
Employee, Sick leave dates, Days (calendar), Work days, Sick note (number), Accountant, Salary office (filter: 27), State (filter: 7), Status (filter: 4, **inline dropdown**), Actions

### Manager view limitations
- Cannot upload files (employee-only capability)
- `force=true` hardcoded (bypasses backend overlap check)
- Client-side overlap check capped at 100 records

## A10. Data Patterns (Timemachine)

| Status | Accounting | Count | % |
|--------|-----------|-------|---|
| CLOSED | NEW | 215 | 62% |
| CLOSED | PAID | 96 | 28% |
| DELETED | NEW | 16 | 5% |
| REJECTED | REJECTED | 13 | 4% |
| OPEN | NEW | 8 | 2% |

- 348 total records, ~104-114 per year
- Average duration 9-11 calendar days, max 140-141 days
- 55% have file attachments, 30% have notifyAlso recipients
- **62% backlog**: CLOSED but never processed by accounting

## A11. Known Bugs

| ID | Severity | Description | Source |
|----|----------|-------------|--------|
| BUG-SL-1 | HIGH | No creation permission check — any user can create for any employee | Code analysis S6 |
| BUG-SL-2 | MEDIUM | Reference equality `==` in getEditorType() — always falls to default | Code analysis S6 |
| BUG-SL-3 | MEDIUM | Unrestricted accounting status transitions (Paid→New possible) | UI testing S11 |
| BUG-SL-4 | LOW | "Rejected Rejected" label duplication in state filter | UI testing S11 |
| BUG-SL-5 | LOW | Orphaned file/notify_also records on soft-delete | Code analysis S6 |
| BUG-SL-6 | LOW | Missing router-level permission check on /sick-leave/my | Code analysis S6 |
| BUG-SL-7 | LOW | MySickLeaveTableContainer re-fetches vacations on every render | Code analysis S6 |
| BUG-SL-8 | LOW | NoveoAI widget overlaps Status/Actions columns | UI testing S11 |

---

## PART B: DAY-OFF (WEEKEND TRANSFER)

## B1. Data Model

### Two-Table Pattern
**employee_dayoff_request** — mutable workflow:
| Field | Type | Notes |
|-------|------|-------|
| id | BIGSERIAL | PK |
| employee | FK | |
| approver | FK | Auto-assigned (CPO=self, otherwise manager) |
| original_date | DATE | Immutable source date |
| last_approved_date | DATE | Public holiday date (misleading name) |
| personal_date | DATE | Employee's chosen compensatory day |
| duration | INT | Hours (0=day-off, 7=half-day, 8=full working day) |
| status | TEXT enum | NEW, APPROVED, REJECTED, DELETED, DELETED_FROM_CALENDAR |
| reason | TEXT | Holiday name (e.g., "Новый год") |

**employee_dayoff** — settled credit/debit ledger:
| Field | Type | Notes |
|-------|------|-------|
| id | BIGSERIAL | PK |
| employee | FK | |
| original_date, personal_date | DATE | |
| duration | INT | 0=taking day-off (debit), 8=worked holiday (credit), 7=half-day |
| reason | TEXT | |

**employee_dayoff_approval** — optional FYI-style approvers:
- ASKED → APPROVED/REJECTED per optional approver (non-blocking)

### Dead Code
- CANCELED status exists in entity enum but is never used (absent from BO enum)

## B2. Lifecycle Operations

| Action | Endpoint | Guard | Side Effects |
|--------|----------|-------|-------------|
| Create | POST /v1/employee-dayOff | Authenticated | CPO self-approves; upsert pattern |
| Approve | PUT /approve/{id} | Approver, NEW/REJECTED status | Writes 2 ledger entries + vacation recalc + norm update |
| Reject | PUT /reject/{id} | Approver, NEW/APPROVED (if personalDate ≥ report period) | Status only — **ledger NOT reverted** (BUG) |
| Delete | DELETE /{id} | Owner, personalDate ≥ period start OR not APPROVED | Soft status=DELETED |
| Edit | PATCH /{id} | Owner only | Only personalDate changeable; resets optional approvals |
| Change approver | PUT /change-approver/{id}/{login} | Current approver | Old→optional, new replaces |
| System rejection | rejectedBySystem() | Calendar change (period) | Bulk-rejects NEW requests |
| Calendar deletion | deleteDayOffs() | Calendar removes holiday | DELETED_FROM_CALENDAR + physically deletes ledger |
| Office change | AutoDeleteHelper.update | Employee changes office | DELETED_FROM_CALENDAR + deletes all year's ledger |

### Approve — Ledger Mechanics (Critical)
On approval, **two ledger entries** written (upsert):
1. **lastApprovedDate slot** (credit reversal): duration from existing ledger or calendar or reportingNorm fallback
2. **personalDate slot** (debit confirmation): duration + reason from request

Then fires events:
- `RecalculateVacationDaysHandler`: diff=+1 for lastApprovedDate, diff=-1 for personalDate → adjusts vacation balance
- `UpdateMonthNormHandler`: recalculates norms for both affected months

### Reject — Does NOT Undo Ledger (BUG-DO-6)
Rejecting an APPROVED request only changes status. Ledger entries created during approval **remain orphaned**. Repeated approve/reject cycles compound phantom entries.

## B3. Calendar Conflict Handling (4 Paths)

### Path A: Calendar Day Changed → Day-Off MOVE (Silent)
- **Trigger**: Admin creates/updates calendar day (adds holiday where employees have day-off)
- **Action**: Creates NEW moved ledger entry (previous working day). Old entry NOT cleaned up (orphaned)
- **Request unchanged**: status stays APPROVED
- **Notification**: NOTIFY_VACATION_CALENDAR_UPDATE_0H_DAY_MOVED or _7H_DAY_MOVED

### Path B: Calendar Day Deleted → DELETED_FROM_CALENDAR
- **Trigger**: Admin deletes calendar day entirely
- **Action**: Bulk sets request status to DELETED_FROM_CALENDAR (hardcoded SQL). **Physically deletes** all ledger entries for that date. Recalculates vacation days.
- **82 records**: All from 2025-06-12 "День России" removal

### Path C: Period Changed → REJECTED by System
- **Trigger**: Approve period changes for an office
- **Action**: Finds NEW requests with last_approved_date = changed date → sets REJECTED
- **Notification**: NOTIFY_DAYOFF_AUTODELETE_TO_EMPLOYEE

### Path D: Employee Office Change → DELETED_FROM_CALENDAR (Year-wide)
- **Trigger**: Employee changes office
- **Action**: Finds ALL NEW/APPROVED requests for year (max 100) → DELETED_FROM_CALENDAR. **Physically deletes** ALL ledger entries for the year.

### Architecture Issues
1. **Entity state bug**: `updateAll()` hardcodes DELETED_FROM_CALENDAR in SQL but Java entities retain original status for post-update events
2. **Race condition**: Paths A and B use separate MQ queues — rapid create-then-delete could cause orphaned entries
3. **Weekend-only calendar**: PreviousWorkingDayCalculator checks only Sat/Sun, not actual production calendar
4. **Hardcoded production URL** in all notification templates

## B4. Validation Rules

| Rule | Detail |
|------|--------|
| No duplicate prevention | POST with existing publicDate creates via upsert — shadows original (BUG-DO-3) |
| Past personalDate | **Accepted** without validation (BUG-DO-4) |
| Weekend personalDate | **Accepted** without working-day validation (BUG-DO-5) |
| Edit restriction | Only personalDate changeable via PATCH |
| Delete restriction | personalDate ≥ period start OR status ≠ APPROVED |

## B5. Permission Model (Dynamic Calculation)

| Actor | Condition | Permissions |
|-------|-----------|------------|
| Approver | NEW/REJECTED | APPROVE |
| Approver | NEW/APPROVED, personalDate ≥ report period start | REJECT |
| Approver | Always | EDIT_APPROVER |
| Owner | personalDate ≥ period start OR status ≠ APPROVED | DELETE |
| Owner | Always | EDIT |
| CPO (PROJECT role) | Self | Self-approval on creation |
| Read-only/non-EMPLOYEE | — | No permissions |

## B6. Search Types

| Type | Returns |
|------|---------|
| MY | Own + calendar + ledger merge (3 sources with date-matching heuristics) |
| ALL | Admin view — all requests |
| APPROVER | Primary approver requests (over-includes: 484 results vs 18 actual) |
| OPTIONAL_APPROVER | FYI-style approver requests |
| MY_DEPARTMENT | Department manager view |
| RELATED | Related employees |
| DELEGATED / DELEGATED_TO_ME | Redirected requests |
| ON_PAID | Paid holiday entries (credit only) |

## B7. UI (Embedded in Vacation Module)

### Employee View (/vacation/my → Days Off tab)
- Year selector + "Weekend regulation" link
- Columns: Date of event (with day-of-week), Duration, Reason, Approved by, Status, Actions
- Duration: "0" = full day-off, "7" = pre-holiday shortened day
- **Localization bug**: Reasons display in Russian even in EN mode
- Transfer: click edit → TransferDaysoffModal → datepicker → POST/PATCH
- Cancel: X button on NEW → DELETE /{id}
- **Filtering hides working-weekend entries** (duration=8 without compensatory)

### Manager View (/vacation/request → Days off rescheduling tab)
- 5 sub-tabs: APPROVER, OPTIONAL_APPROVER, MY_DEPARTMENT, MY_PROJECTS, DELEGATED
- Inline approve/reject/redirect actions
- WeekendDetailsModal: approve/reject/redirect + optional approvers management

## B8. Calendar-Triggered Vacation Recalculation

When day-off removed from production calendar:

**advanceVacation = false (Russia):**
1. Check if affected vacation has sufficient accrued days for year
2. Insufficient → convert to ADMINISTRATIVE type
3. Sufficient → delayed check (10 min) including all same-payment-month requests + later payment months
4. Any insufficient → convert to administrative + email notification (ID_85)

**advanceVacation = true (Cyprus/Germany):**
- Deducts from current year balance (can go negative)
- No automatic conversion to administrative

## B9. Warning System
`ExpiredNonApprovedEmployeeDayOffCommand` — warns PM/DM/ADMIN about unresolved NEW requests where personalDate or lastApprovedDate is past today.

**Overdue warning broadcast bug** (S12): Warning shown to ALL users, not just relevant approvers.

## B10. Data Patterns (Timemachine)

### Request Status Distribution (3,238 records)
| Status | Count | % |
|--------|-------|---|
| APPROVED | 2,902 | 89.6% |
| DELETED | 223 | 6.9% |
| DELETED_FROM_CALENDAR | 82 | 2.5% |
| NEW | 18 | 0.6% |
| REJECTED | 13 | 0.4% |

### Ledger Duration Patterns (5,334 entries)
| Duration | Count | Meaning |
|----------|-------|---------|
| 8 hours | 2,853 | Full working day credit |
| 0 hours | 2,454 | Day-off taken (debit) |
| 7 hours | 27 | Half-day / short day |

Credit (2,853) > debit (2,454) → ~399 earned but unused day-off credits.

## B11. Known Bugs

| ID | Severity | Description | Source |
|----|----------|-------------|--------|
| BUG-DO-1 | HIGH | NPE on findAll without type parameter | API testing S9 |
| BUG-DO-2 | HIGH | NPE on list endpoint (Caffeine cache null key) | API testing S9 |
| BUG-DO-3 | MEDIUM | No duplicate prevention — upsert shadows original | API testing S9 |
| BUG-DO-4 | MEDIUM | Past personalDate accepted without validation | API testing S9 |
| BUG-DO-5 | MEDIUM | Weekend personalDate accepted (no working-day check) | API testing S9 |
| BUG-DO-6 | MEDIUM | Ledger not reverted on reject (orphaned entries) | API testing S9 |
| BUG-DO-7 | LOW | APPROVER search over-includes (484 vs 18 actual) | API testing S9 |
| BUG-DO-8 | MEDIUM | Path A orphaned ledger entry on calendar conflict move | Live test S15 |
| BUG-DO-9 | LOW | Deletion path is silent (no notification email) | Live test S15 |
| BUG-DO-10 | LOW | Hardcoded production URL in notifications | Code analysis S13 |
| BUG-DO-11 | LOW | Overdue warning broadcast to all users | UI testing S12 |
| BUG-DO-12 | LOW | Localization: reasons display in Russian in EN mode | UI testing S4 |
| BUG-DO-13 | LOW | Hardcoded date '2024-03-10' in WeekendTableActions | Code analysis S5 |
| BUG-DO-14 | LOW | updateEmployeeDayoffRequest drops personalDate silently | Code analysis S5 |
| BUG-DO-15 | LOW | Transaction isolation: ledger write and status update not atomic | Code analysis S6 |

---

## Related Vault Notes

### Sick Leave
- [[modules/sick-leave-service-implementation]] — backend service
- [[modules/frontend-sick-leave-module]] — frontend module
- [[exploration/ui-flows/sick-leave-accounting-workflow]] — accounting UI
- [[external/requirements/REQ-sick-leave]] — Confluence requirements
- [[exploration/data-findings/sick-leave-dayoff-data-patterns]] — data patterns

### Day-Off
- [[modules/day-off-service-implementation]] — backend service
- [[modules/frontend-day-off-module]] — frontend module
- [[exploration/api-findings/dayoff-api-testing]] — API testing
- [[exploration/api-findings/dayoff-calendar-conflict-code-analysis]] — 4 conflict paths
- [[exploration/data-findings/dayoff-calendar-conflict-live-test]] — live test results
- [[external/requirements/REQ-day-off]] — requirements (scattered)
- [[analysis/absence-data-model]] — shared data model


## B12. GitLab Ticket-Derived Edge Cases & Business Rules (Session 46)

### Calendar Cascade Interactions (Highest Risk Area)

**AV=False vacation conversion cascade** (#3338, #3339):
- When a production calendar day-off is deleted or transferred, the system scans affected employee's vacations
- **BUG (fixed)**: ALL vacations were converted to Administrative, not just the one containing the changed date
- **BUG (fixed)**: After conversion, available/balance days showed as 0 instead of correct recalculated value (when accrued days go negative)
- **Ordering algorithm**: After PC change, validate all requests with payment month >= affected vacation's. Sort by (1) payment month chronologically, (2) date within same payment month. First that fails accrued days check → converted to Administrative.
- **AV=True vs AV=False separation**: AV=False uses accrued days as limit; AV=True uses balance days (can go negative). Different code paths.

**Calendar isolation per salary office** (#3221):
- Two calendars can have day-offs on the same date (e.g., Easter in both Cyprus and Georgia)
- **BUG (fixed)**: Deleting from one calendar affected transfers from the other calendar. Root cause: deletion handler used only date, not salary_office_id
- Employee notifications were incorrectly sent to wrong-calendar employees

**Double-transfer back to original date** (#3282):
- Transfer A→B, then B→A (exact original date), then admin deletes A from production calendar
- **BUG (fixed, regressed once)**: Day-off NOT removed from personal calendar. Only reproduces when second transfer returns to EXACT original date.
- Does NOT cover transfer to working Saturday (#2906 — separate bug)

**SO calendar change timing** (#3300):
- Admin sets new calendar for SO effective NEXT year → should only affect next year
- **BUG (fixed)**: Applied immediately to ALL years (current + past)
- Side effects: broken app state without DB migration, error notifications on login

**Confirmed transfer survives SO change** (#2971 — STILL OPEN):
- Create confirmed day-off transfer to next year → change SO production calendar
- Unconfirmed transfers correctly deleted, but confirmed transfers from OLD calendar persist
- No design specification exists for this case

### Vacation-Day-Off Interaction Rules

**Auto-deletion with balance restoration** (#3223):
- Single-day vacation exists on a date → admin adds day-off on same date (or employee transfers day-off to that date + approval)
- Vacation is auto-deleted (correct) but **balance was NOT updated** (permanent day loss)
- **Regression from first fix**: Auto-deleted Regular vacations converted to Administrative with 0 days instead of being deleted
- Required two fix attempts (MR !4592 for the second)

**Vacation recalculation on transfer** (#2833):
- Day-off transfer approved onto a date covered by existing vacation → vacation MUST be shortened/recalculated
- **BUG (fixed, was on prod)**: Vacation was NOT recalculated. Production impact on real users.

**Vacation event feed events** (#2736):
- `VACATION_AUTO_DELETED_CALENDAR_UPDATE` — single-day vacation reduced to 0 days by PC change
- `VACATION_DAYS_RECALCULATION_CALENDAR_UPDATE` — vacation duration changed but not to 0
- `VACATION_EDITED_TYPE` — vacation converted from Regular to Administrative (AV=False only)
- **Bugs during implementation**: Auto-delete event not generated; vacation left with 0 days in DB; accrued days not returned to balance on type conversion

### Transfer Mechanics — Backward Transfer Rules (#2874)

- Transfer date must be >= original RC date (production calendar) AND >= current date
- Auto-rejection on month close covers BOTH source date month AND target date month
- Approval list editing available when status = "Pending confirmation" (not month-based)
- Default sort on "For Approval" tab: Pending > Confirmed > Rejected > Deleted from calendar
- Rows become grey when: status != Pending AND both dates (original and transfer) are in past
- **Bug found**: Re-transfer blocked after transfer to 7h shortened working day (originalDate/lastApprovedDate returned confirmed date, not RC original)
- **Bug found**: Past dates still selectable in UI when original date passed into real past (current date constraint not enforced)

### Norm Calculation (#2901)

- Individual monthly norm must account for BOTH sick leave hours AND transferred day-off hours
- **BUG (fixed)**: When sick leave overlapped a day-off and day-off was transferred outside sick leave period, norm only reduced by sick leave, not both

### UI Display Bugs (Calendar Colors)

**Pending transfer display** (#3094, #2815, #2818):
- Unconfirmed transfer: original day-off should show as ORANGE (day-off), not grey (working)
- Affects: "By employees", "By projects", "My tasks", "Confirmation" views
- Target date should show as working day (correct behavior)
- After confirmation: original becomes grey, target becomes orange

### Availability Chart History (#3292, #3312)

- Pre-2024 historical data: use the Payment office chronologically assigned first in DB (active as of 2024)
- Before 2024, only one production calendar existed: Russia
- **BUG (fixed)**: Unfiltered multi-employee query returned events only for current year
- **BUG (fixed)**: No events shown for dates before 01.01.2024

### Employee Reinstatement (#3212)

- Regular SO change → new calendar from NEXT year
- Reinstatement with SO change → new calendar effective IMMEDIATELY for current year
- **BUG (fixed manually)**: Reinstatement path used regular change logic, showing old calendar

## B13. Expanded Known Bugs (from Ticket Mining)

| ID | Severity | Description | Ticket | Status |
|----|----------|-------------|--------|--------|
| BUG-DO-16 | HIGH | AV=False: balance zeroed after vacation conversion triggered by day-off deletion/transfer | #3339 | Fixed (Sprint 14) |
| BUG-DO-17 | HIGH | AV=False: multiple vacations converted instead of only the one containing changed date | #3338 | Fixed (Sprint 14) |
| BUG-DO-18 | HIGH | Double-transfer back to original → not removed on calendar deletion | #3282 | Fixed (regressed once) |
| BUG-DO-19 | MEDIUM | Confirmed transfer survives SO calendar change for next year | #2971 | OPEN |
| BUG-DO-20 | HIGH | Calendar change for next year applied immediately to all years | #3300 | Fixed (Sprint 13) |
| BUG-DO-21 | HIGH | Calendar deletion affects transfers from different calendars (no SO filter) | #3221 | Fixed (Sprint 12) |
| BUG-DO-22 | HIGH | Vacation balance not updated after auto-deletion by calendar event | #3223 | Fixed (2 attempts) |
| BUG-DO-23 | HIGH | Vacation not recalculated when day-off transferred onto vacation date | #2833 | Fixed (prod HotFix) |
| BUG-DO-24 | HIGH | Access Denied on day-off transfer creation (silent failure) | #2962 | Fixed (Sprint 9) |
| BUG-DO-25 | HIGH | 500 DB constraint when editing transfer to reuse freed date | #2801 | Fixed (Sprint 8) |
| BUG-DO-26 | MEDIUM | Individual norm not recalculated with sick leave + day-off transfer | #2901 | Fixed (HotFix S8) |
| BUG-DO-27 | MEDIUM | Re-transfer blocked after transfer to 7h shortened day | #2874 | Fixed (Sprint 9) |
| BUG-DO-28 | MEDIUM | Past dates selectable when original date in past (UI constraint miss) | #2874 | Fixed (Sprint 9) |
| BUG-DO-29 | MEDIUM | Pending transfer: original date shown grey instead of orange in calendar views | #3094 | Fixed (Sprint 12) |
| BUG-DO-30 | MEDIUM | Red highlight removed from My Tasks without transfer confirmation | #2815 | Fixed (HotFix S8) |
| BUG-DO-31 | HIGH | Availability chart: events missing for unfiltered multi-employee query | #3312 | Fixed (HotFix S13) |
| BUG-DO-32 | MEDIUM | No calendar events shown for dates before 2024 | #3292 | Fixed (Sprint 13) |
| BUG-DO-33 | MEDIUM | Calendar not set after employee reinstatement with SO change | #3212 | Fixed (manual DB) |
| BUG-DO-34 | HIGH | Vacation event feed: auto-delete event not generated, vacation left with 0 days | #2736 | Fixed (Sprint 14) |
| BUG-DO-35 | HIGH | Accrued days not returned to balance on vacation type conversion | #2736 | Fixed (Sprint 14) |

## B14. Ticket Cross-References

- [[exploration/tickets/day-off-ticket-findings]] — full ticket mining details with reproduction steps
- [[dayoff-calendar-conflict-code-analysis]] — code-level analysis of conflict paths
- [[dayoff-calendar-conflict-live-test]] — live test results for conflict scenarios
- [[dayoff-rescheduling-warning-bug]] — overdue warning broadcast to all users
