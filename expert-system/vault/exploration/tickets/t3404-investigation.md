---
type: investigation
tags:
  - day-off
  - transfer
  - reschedule
  - approve-period
  - sprint-15
  - ticket-3404
created: '2026-03-26'
updated: '2026-03-26'
status: active
related:
  - '[[analysis/sick-leave-dayoff-business-rules-reference]]'
  - '[[exploration/tickets/day-off-ticket-findings]]'
  - '[[modules/frontend-day-off-module]]'
  - '[[modules/day-off-service-implementation]]'
branch: release/2.1
---
# Ticket #3404 — Day-Off Transfer: Allow Earlier Dates Within Open Month

## Summary

**Ticket:** [#3404](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3404) — [Days off] Allow moving days off to earlier dates within an open month
**Sprint:** 15 | **State:** opened (Ready to Test)
**Author:** imalakhovskaia | **Developer:** ishumchenko | **Assignee:** vulyanov
**MR:** [!5333](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5333) — merged 2026-03-24
**Branch:** `ishumchenko/#3404-days-off-allow-moving-days-off-to-earlier-dates-within-an-open-month-1` → `release/2.1`
**Related tickets:** #2672 (original transfer feature, Sprint 8), #2874 (backward re-transfer, Sprint 9)
**Parent module:** [[modules/frontend-day-off-module]], [[modules/day-off-service-implementation]]

## Requirements (from ticket description, translated)

The ticket changes 3 aspects of the day-off transfer (reschedule) feature:

### P.1 — Edit Action Availability

| Aspect | AS IS | TO BE |
|--------|-------|-------|
| Which day-offs can be rescheduled | Day-offs with date ≥ today | Day-offs with date in **open approval period** |
| When is "Edit event" unavailable | Past day-offs | Day-offs in **closed approval period** |

### P.2.4/sub2 — Datepicker: Closed Month Dates

| Aspect | AS IS | TO BE |
|--------|-------|-------|
| Which dates are disabled in the datepicker | Dates earlier than current date | Dates in months with **closed approval period** |

### P.2.4/sub4 — Earlier Date Constraint Relaxation

| Aspect | AS IS | TO BE |
|--------|-------|-------|
| Minimum selectable date (future day-offs) | Dates earlier than **original day-off date** | Dates earlier than **1st of month of original day-off date** |

### P.2 — Auto-rejection Logic
Unchanged — existing logic for rejecting transfers when month closes remains the same.

### P.3 — Regression Check
After P.1 changes, verify vacation recalculation overlapping with day-offs is not broken.

### P.4 — Tooltip Translation Fix
- EN: "Reschedule ~~an~~ event" → "Reschedule event"
- RU: "Перенести событие" (unchanged)

### Figma Reference
[Day-off transfer designs](https://www.figma.com/design/H2aXBseq7Ui60zlh5vhyjy/Noveo-TTT?node-id=26147-482652)

## Code Changes (MR !5333)

**4 files changed, all frontend-only:**

### 1. `translationsEN.json` — Tooltip fix
```json
// Before: "rescheduleAnEvent": "Reschedule an event"
// After:  "rescheduleAnEvent": "Reschedule event"
```

### 2. `TransferDaysoffModal.tsx` — Datepicker minDate
```typescript
// Added: import selectApprovePeriod, useSelector
const approvePeriod = useSelector(selectApprovePeriod);

// isMinCurrentDay = moment().isAfter(moment(originalDate))
// TRUE when original date is in the past

// Before:
minDate={isMinCurrentDay ? moment().subtract(1, 'd') : moment(originalDate)}
// After:
minDate={isMinCurrentDay ? moment(approvePeriod).subtract(1, 'd') : moment(originalDate)}
```

**Analysis:**
- `isMinCurrentDay = true` (past): minDate changed from `yesterday` to `approvePeriod - 1 day` ✅ Implements P.2.4/sub2
- `isMinCurrentDay = false` (future): minDate **UNCHANGED** — still `moment(originalDate)` ❌ Does NOT implement P.2.4/sub4

### 3. `useWeekendTableHeaders.tsx` — Edit icon visibility
```typescript
// Added: import selectApprovePeriod, useSelector
const approvePeriod = useSelector(selectApprovePeriod);

// Before:
const isDayOffAfterCurrentDate =
  lastApprovedDate > moment().format('YYYY-MM-DD') ||
  lastApprovedDate === moment().format('YYYY-MM-DD');
// After:
const isDayOffAfterCurrentDate =
  lastApprovedDate > moment(approvePeriod).format('YYYY-MM-DD') ||
  lastApprovedDate === moment().format('YYYY-MM-DD');
```

**Analysis:**
- First condition: changed from `> today` to `> approvePeriod` ✅
- Second condition: **UNCHANGED** — still `=== today` ❌ Should be `=== approvePeriod`
- Net effect: `lastApprovedDate > approvePeriod OR lastApprovedDate === today` instead of `lastApprovedDate >= approvePeriod`

### 4. `myVacation/sagas.js` — Approve period fetch
```typescript
// Added in handleSetWeekendsTable:
yield put(getApprovePeriod());
```
Ensures approve period data is loaded before rendering the weekends table.

### Approve Period Data Flow
1. **API:** `GET /v1/offices/periods/approve/min` → returns `{ type: "APPROVE", start: "YYYY-MM-DD" }` (minimum across all offices)
2. **Saga:** `handleGetApprovePeriod()` → calls API, stores `start` string in Redux
3. **Selector:** `selectApprovePeriod` → reads from approve module filters state
4. **Initial state:** Empty string `""` — populated after first API call
5. **Persistence:** Excluded from redux-persist (refetched every session)

**Value on qa-1:** `2026-03-01` (same for all offices, min = max)

## Bugs Found

### BUG-T3404-1: Edit Icon — Boundary Date Excluded (ST-1)

**Severity:** MEDIUM
**Location:** `useWeekendTableHeaders.tsx:113-114`
**Type:** Logic error

The `isDayOffAfterCurrentDate` condition is:
```typescript
lastApprovedDate > moment(approvePeriod).format('YYYY-MM-DD') ||
lastApprovedDate === moment().format('YYYY-MM-DD');
```

The second operand compares against **today** (`moment()`) instead of `approvePeriod`. A day-off exactly ON the approve period start date would fail both conditions:
- `"2026-03-01" > "2026-03-01"` → false
- `"2026-03-01" === "2026-03-26"` → false
- **Result:** No edit icon, even though March 1 is in the open approval period

**Correct code should be:**
```typescript
lastApprovedDate >= moment(approvePeriod).format('YYYY-MM-DD')
```

**Testability:** Cannot reproduce dynamically on qa-1 because March 1, 2026 is a Sunday (no holiday falls on that date). Would need an environment where a holiday falls exactly on the approve period start date.

### BUG-T3404-2: Datepicker minDate — Future Day-Off Constraint Not Relaxed (ST-3)

**Severity:** LOW-MEDIUM
**Location:** `TransferDaysoffModal.tsx:131`
**Type:** Incomplete implementation

The `else` branch (future day-offs where `isMinCurrentDay = false`) was NOT modified:
```typescript
// Requirement P.2.4/sub4 says minDate should be:
moment(originalDate).startOf('month')  // 1st of the month of original date

// But code still uses:
moment(originalDate)  // The original date itself
```

**Verified on qa-1:** For June 12 (День России) transfer, June 1-11 are all disabled. Per the requirement, June 1 through June 11 should be selectable (they're in the same month as the original date, after the 1st).

**Impact:** Users cannot reschedule future day-offs to earlier dates within the same month. Only later dates are available. This contradicts the ticket requirement.

## UI Verification (qa-1, 2026-03-26)

**Environment:** qa-1, build 2.1.26-SNAPSHOT.LOCAL, approve period 2026-03-01
**User:** eburets (Евгения Бурец, Венера РФ office)

### Edit Icon Visibility
| Day-off | Date | In open period? | Edit icon? | Status |
|---------|------|-----------------|------------|--------|
| Jan 1-9 (Новый год) | Closed (Jan) | No | No | ✅ Correct |
| Feb 23 (День защитника) | Closed (Feb) | No | No | ✅ Correct |
| Mar 12 (Жен. день transferred) | Open (Mar), PAST | Yes | **Yes** | ✅ Core new behavior |
| May 1 (День труда) | Open (May), FUTURE | Yes | Yes | ✅ Correct |
| Jun 12 (День России) | Open (Jun), FUTURE | Yes | Yes | ✅ Correct |
| Dec 31 (Новый год) | Open (Dec), FUTURE | Yes | Yes | ✅ Correct |
| Pre-holiday 7h days | Open | N/A (duration≠0) | No | ✅ Expected (only duration=0 gets edit) |

### Datepicker Constraints (March 12 transfer — past date)
- February dates: ALL disabled ✅ (closed approval period)
- March 2+ working days: enabled ✅ (can select dates earlier than March 12)
- March 1: disabled (Sunday — weekend, not by approve period)
- March 12: orange circle (original date)
- March 26: blue circle (today)
- Weekends: disabled ✅

### Datepicker Constraints (June 12 transfer — future date)
- June 1-11 working days: ALL disabled ❌ (should be enabled per P.2.4/sub4 requirement)
- June 12: orange circle (original date)
- June 15+ working days: enabled
- **Confirms BUG-T3404-2**: `else` branch not updated

## Implementation Completeness

| Requirement | Implemented? | Verified? | Notes |
|-------------|-------------|-----------|-------|
| P.1: Edit based on approve period | ✅ Yes (partial — see BUG-T3404-1) | ✅ Yes | Boundary date issue |
| P.2.4/sub2: Closed month dates disabled | ✅ Yes | ✅ Yes | February fully disabled |
| P.2.4/sub4: Earlier dates within month | ❌ No | ✅ Verified missing | `else` branch unchanged |
| P.2: Auto-rejection unchanged | ✅ N/A (no change needed) | Not tested | Requires admin action |
| P.3: Vacation recalculation regression | ✅ N/A (no change needed) | Not tested | Requires actual transfer |
| P.4: Tooltip translation | ✅ Yes | ✅ Yes (from QA report) | "Reschedule event" |

## Related Vault Notes

- [[analysis/sick-leave-dayoff-business-rules-reference]] — Day-off business rules (PART B)
- [[exploration/tickets/day-off-ticket-findings]] — Previous ticket mining
- [[exploration/ui-flows/day-off-pages]] — Day-off UI pages
- [[modules/frontend-day-off-module]] — Frontend module structure
- [[modules/day-off-service-implementation]] — Backend service

## Test Case Implications

Key scenarios for Phase B XLSX generation:
1. **Edit icon for past day-off in open month** — core new behavior
2. **Edit icon hidden for closed month day-offs** — Jan/Feb closed
3. **Boundary: day-off exactly on approve period start date** — BUG-T3404-1
4. **Datepicker: February dates disabled** — closed period
5. **Datepicker: March dates available (including before original date)** — past day-off
6. **Datepicker: Future day-off earlier dates within month** — BUG-T3404-2
7. **Tooltip translation EN/RU** — simple verification
8. **Vacation recalculation regression** — requires actual transfer + approval
9. **Auto-rejection on month close** — requires admin period change
10. **Null safety: approvePeriod empty string** — edge case when API fails/loads slowly


## Autotest Notes (Phase C — Session 60)

### Query Data Source Fix
The Days Off tab UI displays holidays from the **production calendar** (`ttt_calendar.calendar_days` via `ttt_calendar.office_calendar`), NOT from `ttt_vacation.employee_dayoff`. The `employee_dayoff` table contains entries that may not correspond to visible table rows (e.g., stale sync data, entries for dates not in the current calendar).

**Correct query pattern for finding holidays visible in the UI:**
```sql
WITH latest_cal AS (
  SELECT oc.office_id, oc.calendar_id
  FROM ttt_calendar.office_calendar oc
  WHERE oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM ttt_calendar.office_calendar oc2
      WHERE oc2.office_id = oc.office_id
        AND oc2.since_year > oc.since_year
        AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
    )
)
SELECT e.login, cd.calendar_date::text AS date
FROM ttt_vacation.employee e
JOIN latest_cal lc ON lc.office_id = e.office_id
JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
WHERE cd.duration = 0  -- holiday
  AND ...conditions...
```

### Verified Test Cases (5/24)
| Test ID | Result | Notes |
|---------|--------|-------|
| TC-T3404-004 | PASS | Future day-off in open period — baseline |
| TC-T3404-005 | PASS | Past day-off in open period — core #3404 behavior |
| TC-T3404-006 | PASS | Closed month — no edit icon |
| TC-T3404-007 | PASS | Boundary — asserts buggy behavior (BUG-T3404-1) |
| TC-T3404-016 | PASS | Earlier date selection — core #3404 behavior |

### Reused Page Objects
- `DayOffPage` — `hasEditButton()`, `dayOffRow()`, `clickEditButton()`
- `RescheduleDialog` — `isDayDisabled()`, `selectDate()`, `isOkEnabled()`, `navigateToTargetMonth()`
- No new page objects needed for batch 1
