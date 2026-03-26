# Stage B: Static Testing — #3404

**Ticket:** [#3404](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3404)
**MR:** [!5333](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5333) — 4 files, +14/-4 lines
**Date:** 2026-03-26

---

## B.1 Code Review Findings

### ST-1 — Boundary comparison operator (HIGH)

**File:** `useWeekendTableHeaders.tsx`
**Lines:** ~108-110

**Issue:** The visibility condition for the "Reschedule event" button uses strict `>`:
```ts
const isDayOffAfterCurrentDate =
    lastApprovedDate > moment(approvePeriod).format('YYYY-MM-DD');
```

The original code had an additional `===` check against `moment()` (today):
```ts
    lastApprovedDate > moment().format('YYYY-MM-DD') ||
    lastApprovedDate === moment().format('YYYY-MM-DD');
```

If the `===` line was NOT updated to use `approvePeriod`, the combined logic becomes:
- `lastApprovedDate > approvePeriod` OR `lastApprovedDate === today`

This means:
- Day-offs **after** the approve period start → visible (correct)
- Day-offs **on** the approve period start but != today → HIDDEN (bug)
- Day-offs **on** today's date → visible (old behavior leak)
- Day-offs **before** the approve period → hidden (correct)

If the `===` line WAS removed entirely, then only strict `>` applies and day-offs on the boundary date lose the edit action.

**Recommendation:** Should be `>=` against approvePeriod (or `>= approvePeriod` using moment comparison).

---

### ST-2 — Off-by-one in minDate calculation (MEDIUM)

**File:** `TransferDaysoffModal.tsx`
**Line:** ~128

**Issue:**
```ts
minDate={isMinCurrentDay ? moment(approvePeriod).subtract(1, 'd') : moment(originalDate)}
```

The `.subtract(1, 'd')` shifts the minimum date one day before the approve period start. The resulting behavior depends on how the `react-datetime` datepicker interprets `minDate`:
- If it disables dates `< minDate` (strictly less than), then `approvePeriod - 1 day` means `approvePeriod` itself is enabled → **correct**
- If it disables dates `<= minDate` (less than or equal), then `approvePeriod - 1 day` means that day is disabled but `approvePeriod` is enabled → **also correct**
- If it disables dates `< minDate` and the day before approve period start becomes the first enabled → **incorrect** (one extra day enabled)

The old code used `moment().subtract(1, 'd')` (yesterday) to make "today" the first selectable date, suggesting the datepicker uses `> minDate` semantics (dates strictly after minDate are enabled). This means the pattern is consistent.

**Risk:** Low — the `.subtract(1, 'd')` pattern is established. But worth verifying the actual boundary date in the UI.

---

### ST-3 — minDate based on approvePeriod, not original month (MEDIUM)

**File:** `TransferDaysoffModal.tsx`
**Line:** ~128

**Issue:** The requirement (P.2.4/sub4) says:
> "Dates earlier than the 1st of the month of the **original** day-off date" should be disabled

But the code uses `moment(approvePeriod)` as the base, not `moment(originalDate).startOf('month')`.

These diverge when:
1. Approve period starts before the original date's month → code is MORE permissive
2. Approve period starts after the original date's month → code is MORE restrictive (shouldn't happen normally)

Example: approve period = 2026-02-01, original date = 2026-03-08.
- Requirement: minDate = 2026-03-01 (1st of March)
- Code: minDate = 2026-01-31 (Feb 1 - 1 day) → allows February dates

**Note:** This may be intentional — the approve period is the real business constraint, and the requirement wording may be simplified. But it's a testable discrepancy.

---

### ST-4 — Async approvePeriod loading race condition (LOW)

**File:** `sagas.js` + `TransferDaysoffModal.tsx` + `useWeekendTableHeaders.tsx`

**Issue:** The `getApprovePeriod()` is dispatched in the `handleSetWeekendsTable` saga. This triggers an API call to `/v1/offices/periods/approve/min`. The response populates Redux state.

Meanwhile, the components render immediately. `useSelector(selectApprovePeriod)` returns `undefined` before the API responds.

`moment(undefined)` creates a moment object for the current date/time. So:
- `moment(undefined).subtract(1, 'd')` = yesterday → old `minDate` behavior
- `moment(undefined).format('YYYY-MM-DD')` = today → old visibility behavior

**Behavior:** The UI briefly shows old-logic constraints, then re-renders with correct constraints after API response. This is a **graceful degradation** but could cause a flash (dates briefly enabled then disabled, or vice versa).

**Risk:** User might click a date during the brief window. However, the datepicker isn't open during table load, and by the time the user clicks the edit icon and the modal opens, the API response should have arrived.

---

### ST-5 — Translation key name mismatch (LOW)

**File:** `translationsEN.json`

**Issue:** The key name `rescheduleAnEvent` still contains "An" even though the value was changed to "Reschedule event". This is a code hygiene issue, not a bug. The key could be renamed to `rescheduleEvent` for consistency, but this would require updating all references.

**Impact:** None for users. Minor developer confusion.

---

## B.2 Backend Implications

### No backend validation changes
The MR contains zero backend changes. The existing backend behavior:
- `PATCH /v1/employee-dayOff/{id}` accepts any `personalDate` without date-range checks
- No validation that `personalDate` is a working day (BUG-DO-5)
- No validation that `personalDate` is after any approve period boundary (BUG-DO-4)

**Implication:** The frontend is the SOLE enforcement layer for the new date constraints. Any direct API call can bypass them entirely. This is an existing architectural weakness, not introduced by this change.

### Backend will accept earlier dates
Since the backend has no date-range validation, moving a day-off to an earlier date (e.g., from March 20 to March 3) will succeed at the API level. No backend-side 4xx errors expected from the new date range.

---

## B.3 Regression Risk Assessment

| Area | Risk | Reason |
|------|------|--------|
| Edit button visibility | **HIGH** | Core logic changed — boundary bugs possible |
| Datepicker min date | **MEDIUM** | Constraint relaxed — may be too permissive |
| Vacation recalculation | **LOW** | No changes to recalc code, but moving day-offs to earlier dates creates new timing scenarios |
| Month-close auto-rejection | **LOW** | No changes to rejection saga |
| Other day-off operations (create, approve, reject, delete) | **NONE** | No code changes |
| Manager approval view | **NONE** | No changes to request table/approval components |

---

## B.4 Summary of Static Testing Defect Candidates

| ID | Severity | Type | Description | Verify in |
|----|----------|------|-------------|-----------|
| ST-1 | HIGH | Logic error | `>` vs `>=` boundary — day-offs on approve period start may lose edit action | TC-3404-07 |
| ST-2 | MEDIUM | Off-by-one | `subtract(1,'d')` on minDate — verify exact boundary | TC-3404-15, TC-3404-17 |
| ST-3 | MEDIUM | Req mismatch | minDate uses approvePeriod, not 1st of original month | TC-3404-18 |
| ST-4 | LOW | Race condition | Brief flash of old constraints on page load | Visual observation |
| ST-5 | LOW | Code hygiene | Key name `rescheduleAnEvent` inconsistent with value | N/A (not user-facing) |
