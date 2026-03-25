---
type: exploration
tags:
  - day-off
  - gitlab-tickets
  - bugs
  - regression-tests
  - calendar
  - phase-a
created: '2026-03-25'
updated: '2026-03-25'
status: active
related:
  - '[[dayoff-service-deep-dive]]'
  - '[[sick-leave-dayoff-business-rules-reference]]'
  - '[[dayoff-api-testing]]'
  - '[[frontend-day-off-module]]'
  - '[[dayoff-calendar-conflict-code-analysis]]'
---
# Day-Off GitLab Ticket Findings

Comprehensive mining of 25+ GitLab tickets related to day-off, calendar, and weekend transfer functionality. Extracted from descriptions AND comments (where the real bug details live).

## Search Strategy
- Keywords: "day-off", "dayoff", "weekend", "production calendar", "перенос выходного"
- Scope: ALL history (Sprint 7 through Sprint 15), not just recent sprints
- Project ID: 1288 (ttt-spring)

---

## Category 1: Calendar Change → Day-Off Cascade Bugs (HIGH PRIORITY)

### #3339 [closed, Sprint 14] — AV=False: day-off deletion/transfer causes balance to show 0
**Bug**: When AV=False office employee has a PAID vacation spanning a day-off, and admin deletes that day-off (or employee transfers it), the vacation converts to Administrative but available/balance days show as **0** instead of correct recalculated value.
**Examples**: Employee `esmolina` (paid vacation 3.11-12.11, day-off 3.11 deleted → balance=0 instead of 7); employee `ngerasimov` (day-off transfer triggers conversion → balance=0).
**Root cause**: Accrued days calculation goes negative after calendar change, causing balance zeroing.
**Test cases**:
- TC: AV=False employee with PAID vacation spanning a day-off → admin deletes day-off → verify balance NOT zeroed
- TC: AV=False employee transfers day-off within vacation period → verify balance correct after conversion

### #3338 [closed, Sprint 14] — AV=False: multiple vacations incorrectly converted
**Bug**: When a production calendar day-off is deleted, ALL vacations for the employee are converted to Administrative, not just the one containing the deleted date.
**Example**: `dmaslov` has 2 paid vacations; Cyprus calendar day-off deleted from December date → both November AND December vacations converted.
**Comments (critical)**: QA found a specific reproduction: employee with 3 vacations using all year's days; transferring a day-off causes incorrect conversion of a vacation that shouldn't be affected. After conversion, editing the vacation back to "paid" (unchecking "without payment") works — data integrity workaround.
**Test cases**:
- TC: Employee with multiple vacations → delete day-off in only one vacation's range → verify ONLY that vacation converts
- TC: After incorrect conversion → verify editing back to "paid" is possible

### #3282 [closed, Sprint 14] — Twice-transferred day-off not removed from personal calendar
**Bug**: Transfer day-off from A→B, then back B→A (exact original date), then admin deletes A from production calendar → day-off NOT removed from personal calendar. Only reproduces when second transfer goes back to the EXACT original date.
**Regression history**: Fixed in one build, regressed in later snapshot (2.1.25-SNAPSHOT.281046), re-fixed.
**Comments**: Does NOT cover transfer to working Saturday — see #2906 (separate bug still open).
**Test cases**:
- TC: Transfer → transfer back to original → admin deletes → verify personal calendar updated
- TC: Transfer to working Saturday → admin deletes → verify behavior (known issue #2906)

### #2971 [OPEN, Analytical Task] — SO calendar change doesn't delete confirmed transferred day-off for next year
**Bug**: Create confirmed day-off transfer to next year → change production calendar for SO → confirmed transfer from OLD calendar persists. Unconfirmed transfers are correctly deleted.
**Status**: Still open, no design specification exists for this case.
**Test cases**:
- TC: Confirmed transfer to next year → change SO calendar → verify transfer removed
- TC: Unconfirmed transfer to next year → change SO calendar → verify correctly deleted (regression guard)

### #3300 [closed, Sprint 13, HIGH] — Calendar change from next year applied immediately to all years
**Bug**: Admin sets new production calendar for SO effective NEXT year → change applies immediately to ALL years (current + past) in employee's Days Off view.
**Side effects discovered**: Error notifications on login; "No data" in Availability chart with Project filter; app completely broken without DB migration.
**Test cases**:
- TC: Set new calendar for SO effective next year → verify current year still shows OLD calendar
- TC: Verify past years also unaffected

### #3221 [closed, Sprint 12] — Calendar deletion affects day-offs from different calendars
**Bug**: Two calendars (Cyprus, Georgia) both have day-off on same date. Admin deletes from Georgia → Cyprus employee's transfer is also auto-deleted. Root cause: deletion handler checks only date, not salary_office_id.
**Additional bug from comments**: When calendar day-off is created on a date where employee has approved vacation → vacation auto-deleted but available days NOT restored (#3223).
**Test cases**:
- TC: Delete calendar event from calendar A → verify transfers for calendar B employees unaffected
- TC: Verify email notification NOT sent to wrong-calendar employees

### #3223 [closed, Sprint 12, HIGH] — Vacation balance not updated after auto-deletion
**Bug**: Single-day vacation exists; admin adds day-off on same date (or employee transfers day-off to that date + manager approves) → vacation auto-deleted but balance NOT updated. Permanent vacation day loss.
**Comments**: First fix attempt caused REGRESSION — auto-deleted Regular vacations converted to Administrative with 0 days duration instead of being deleted. Required second fix (MR !4592).
**Test cases**:
- TC: Single-day Regular vacation + admin adds day-off on same date → verify vacation deleted AND balance +1
- TC: Same with day-off transfer + approval → verify balance restored
- TC: Verify auto-deleted vacation retains original type (no conversion)

---

## Category 2: Day-Off Transfer Bugs

### #2962 [closed, Sprint 9, HIGH] — Access Denied on day-off transfer (silent failure)
**Bug**: Click OK in transfer dialog → popup closes but request NOT created. 400 Access Denied response, but NO error banner shown to user. Silent failure.
**Envs**: Reproduced on qa-1 and preprod; NOT on stage.
**Test cases**:
- TC: Submit transfer via UI → verify request actually created (check API response, not just popup closure)
- TC: If creation fails → verify error notification displayed

### #2801 [closed, Sprint 8] — 500 error when editing transfer to reuse freed date
**Bug**: Create transfer A (date X), create transfer B (date Y), delete B, edit A to use date Y → 500 error. Root cause: `employee_dayoff_employee_id_personal_date_idx` unique constraint violation during upsert.
**Test cases**:
- TC: Create→delete→reuse freed date via edit → verify no 500 error
- TC: Create→delete→create new transfer for same date → verify no constraint violation

### #2833 [closed, HotFix Sprint 8] — Vacation not recalculated when day-off transferred onto vacation date
**Bug**: Employee has vacation spanning a date. Day-off transfer approved onto that date. Vacation NOT recalculated.
**Production bug**: Affected real users (ann, aristov) on prod and stage.
**Business rule**: When a day-off is transferred onto a date covered by a vacation, the vacation must be shortened/recalculated.
**Test cases**:
- TC: Vacation spanning date X → approve day-off transfer to X → verify vacation duration decreases
- TC: Same but without approval → verify vacation unchanged

### #2901 [closed, HotFix Sprint 8] — Individual norm not recalculated with sick leave + day-off transfer
**Bug**: Employee has sick leave overlapping a day-off → transfers day-off outside sick leave period → individual norm not reduced by both sick leave AND transferred day-off.
**Test cases**:
- TC: Sick leave overlapping day-off → transfer day-off outside sick leave → verify norm = base - sick_hours - dayoff_hours

### #2874 [closed, Sprint 9] — Feature: backward re-transfer of day-offs
**Feature**: Allow re-transferring to dates BEFORE the last confirmed date (but >= original RC date and >= current date).
**Bugs found during implementation (3)**:
1. Auto-rejection on month close failed for backward transfers where source date in open month but target in closed month
2. Re-transfer blocked after transfer to 7h shortened working day (originalDate/lastApprovedDate both returned confirmed date, not RC original)
3. Past dates available for selection when original date passed into real past (current date constraint not enforced in UI)
**Business rules defined**:
- Transfer date >= original RC date AND >= current date
- Auto-rejection covers BOTH source date month AND target date month
- Grey rows when status != Pending AND both dates in past
- Default sort on "For Approval" tab: Pending > Confirmed > Rejected > Deleted
**Test cases**:
- TC: Transfer backward (between original and last-confirmed) → verify permitted
- TC: After transfer to 7h day, re-transfer backward → verify not blocked
- TC: When original date past → verify dates before today disabled in calendar

---

## Category 3: UI/Display Bugs

### #3094 [closed, Sprint 12] — Unconfirmed transfer shown with wrong calendar colors
**Bug**: In "By employees", "By projects", "My tasks" views: original day-off shown as grey (working) instead of orange (day-off) when transfer is pending. Target date also shown as working (correct).
**Comments**: "My tasks" fix verified but "By employees"/"By projects" could not be verified due to secondary 400 error on roles API.
**Test cases**:
- TC: Pending transfer → verify original date orange in all 3 views
- TC: After approval → verify original becomes grey, target becomes orange

### #2815 [closed, HotFix Sprint 8] — Red highlight removed from My Tasks without confirmation
**Bug**: Creating unconfirmed transfer request removes red highlight on original day-off date in My Tasks table immediately, before approval.
**Test cases**:
- TC: Create transfer (unconfirmed) → verify original date retains red highlight in My Tasks
- TC: After confirmation → verify highlight moves

### #2818 [closed, HotFix Sprint 8] — Unconfirmed transfer marking wrong in Confirmation view
**Bug**: Same as #2815 but in Confirmation / By Employees view. Original day-off shown grey instead of orange.
**Test cases**: Same as #3094 for Confirmation view specifically.

### #2930 [closed, Sprint 9] — Overdue notification banner improvements
**Feature**: Banner now includes day-off info (not just vacations); link to confirmation page; displayed on all pages.
**Comments**: Translation fixes for rows 834-835 (English text for day-off transfer notification and cancel tooltip).
**Test cases**:
- TC: Verify banner appears on all pages when overdue requests exist
- TC: Verify banner includes day-off request info
- TC: Verify banner link navigates to correct page

---

## Category 4: Availability Chart / Calendar Display

### #3312 [closed, HotFix Sprint 13, HIGH] — Calendar events missing for some employees
**Bug**: Availability chart without employee filter returns events only for current year (2025); with filter returns all years. Unfiltered multi-employee path was broken.
**Test cases**:
- TC: Availability chart multi-year range without employee filter → verify all years have calendar events
- TC: Verify Cyprus SO employees show correct day-offs

### #3292 [closed, Sprint 13] — Calendar events not displayed before 2024
**Bug**: No production calendar events shown for any date before 01.01.2024. Affects both chart and "Copy absences".
**Business rule from comments**: Pre-2024 historical data uses the Payment office chronologically assigned first in DB (active as of 2024).
**Test cases**:
- TC: Date range including 2023 → verify production calendar events shown
- TC: "Copy absences" for pre-2024 range → verify day-offs included

### #3212 [closed, Backend] — Calendar not set after employee reinstatement with SO change
**Bug**: Employee reinstated via CS with SO change → TTT still shows old SO calendar instead of new one. Design gap: never described/implemented/tested.
**Note**: Regular SO change sets new calendar from next year; reinstatement should set it immediately.
**Test cases**:
- TC: Reinstate employee with SO change → verify new calendar effective immediately for current year

---

## Category 5: Cross-Feature Interactions

### #2736 [closed, Sprint 14] — Vacation event feed formulations for calendar-triggered events
**Feature**: 3 event types: VACATION_AUTO_DELETED_CALENDAR_UPDATE, VACATION_DAYS_RECALCULATION_CALENDAR_UPDATE, VACATION_EDITED_TYPE (conversion to Administrative).
**Critical bugs found during testing**:
1. Auto-delete event NOT generated; vacation left in DB with 0 days instead of being deleted
2. Vacation days NOT returned to balance when converted to Administrative (permanent day loss)
3. VACATION_EDITED_TYPE not firing for day-off transfer outside vacation
**Complex ordering algorithm**: After PC change, validate all requests with payment month >= affected vacation's. Sort by payment month then by date. First that fails accrued days check → converted to Administrative.
**Test cases**:
- TC: Single-day vacation + admin adds day-off → verify AUTO_DELETED event, vacation deleted, balance +1
- TC: Multi-day vacation + day-off added in range → verify RECALCULATION event, correct day count
- TC: AV=False + PC change → verify EDITED_TYPE event, conversion to Administrative, days returned

### #3179 [closed, Sprint 12] — Day-off info in digest section 3
**Feature**: Continuous absence merging in digest — combine consecutive absences (vacation + day-off + sick leave with no working days between).
**Bugs from implementation**:
1. Empty digests for some users after deployment
2. Incorrect date combination (vacation and distant day-off merged as continuous)
**Test cases**:
- TC: Consecutive vacation + day-off (no gap) → verify combined in one cell
- TC: Vacation + day-off with working day gap → verify separate rows

---

## Category 6: Feature/Design Tasks (Historical)

### #2621 [OPEN, Sprint 7] — Master analytical task for individual employee day-offs
Original feature spec. Key rules: 5-day transfer window; month-based limits (Jan:6, May/Dec:5, others:3); approval flow; individual monthly norm.

### #2733 [closed, Sprint 7] — Backend: day-off schema per employee API

### #2952 [closed, Sprint 9] — Add day-off ID to availability chart response

---

## Bug Index (for test case cross-reference)

| Ticket | Severity | Category | Status | Key Risk |
|--------|----------|----------|--------|----------|
| #3339 | HIGH | Calendar cascade | Fixed | Balance zeroed after conversion |
| #3338 | HIGH | Calendar cascade | Fixed | Wrong vacations converted |
| #3282 | HIGH | Calendar cascade | Fixed (regressed once) | Double-transfer cleanup |
| #2971 | MEDIUM | Calendar cascade | OPEN | Confirmed transfer survives SO change |
| #3300 | HIGH | Calendar cascade | Fixed | Calendar applied to wrong years |
| #3221 | HIGH | Calendar isolation | Fixed | Cross-calendar deletion |
| #3223 | HIGH | Balance integrity | Fixed (2 attempts) | Permanent vacation day loss |
| #2962 | HIGH | Transfer creation | Fixed | Silent failure |
| #2801 | HIGH | Transfer edit | Fixed | 500 on reused date |
| #2833 | HIGH | Vacation interaction | Fixed (prod) | Vacation not recalculated |
| #2901 | MEDIUM | Norm calculation | Fixed | Sick leave + transfer |
| #2874 | N/A | Feature | Implemented | 3 bugs during implementation |
| #3094 | MEDIUM | UI display | Fixed | Wrong colors on pending transfer |
| #2815 | MEDIUM | UI display | Fixed | Premature highlight removal |
| #2818 | MEDIUM | UI display | Fixed | Wrong marking in Confirmation |
| #3312 | HIGH | Availability chart | Fixed | Events missing unfiltered |
| #3292 | MEDIUM | Availability chart | Fixed | Pre-2024 data missing |
| #3212 | MEDIUM | Calendar assignment | Fixed (manual DB) | Reinstatement gap |
| #2736 | HIGH | Event feed | Fixed (complex) | 3 bugs during implementation |
| #3179 | MEDIUM | Digest | Fixed | Empty digests after deploy |

## Total: 25+ tickets mined, 20+ test-worthy bugs documented
