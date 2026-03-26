# Stage A: Requirements Analysis — #3404

**Ticket:** [#3404](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3404) — "[Days off] Allow moving days off to earlier dates within an open month"
**Date:** 2026-03-26
**Analyst:** QA (automated analysis)

---

## A.1 Requirements Summary

| Req ID | Description | AS IS | TO BE |
|--------|-------------|-------|-------|
| **P.1** | Edit action availability for day-off rescheduling | Day-offs with date >= today are available; past day-offs have "Edit event" action unavailable | Day-offs with date in an **open approve period** are available; day-offs in a **closed approve period** have "Edit event" action unavailable |
| **P.2.4/sub2** | Dates disabled in datepicker (closed period) | Dates earlier than current date are disabled | Dates of months for which the approve period is **already closed** are disabled |
| **P.2.4/sub4** | Lower bound for rescheduling date | Dates earlier than the **original** day-off date are disabled | Dates earlier than the **1st of the month of the original** day-off date are disabled |
| **P.2** | Month-close rejection logic | Existing auto-rejection when closing approve period | **Unchanged** — verify still works |
| **P.3** | Vacation recalculation | Working correctly | **Must not break** after day-off moves to earlier dates |
| **P.4** | Tooltip translation fix (EN) | "Reschedule an event" | "Reschedule event" (remove article "an") |

**Related tickets:** #2874, #2672 (original rescheduling feature)
**Figma:** [node 26147:482652](https://www.figma.com/design/H2aXBseq7Ui60zlh5vhyjy/Noveo-TTT?node-id=26147-482652)

---

## A.2 Code Changes Analysis

**MR:** [!5333](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5333) — merged 2026-03-24 into `release/2.1`
**Scope:** Frontend-only, 4 files, +14/-4 lines

### Changed Files

| # | File | Change |
|---|------|--------|
| 1 | `translationsEN.json` | `"rescheduleAnEvent": "Reschedule an event"` → `"Reschedule event"` |
| 2 | `TransferDaysoffModal.tsx` | Import `selectApprovePeriod`; `minDate` changed from `moment().subtract(1,'d')` to `moment(approvePeriod).subtract(1,'d')` |
| 3 | `useWeekendTableHeaders.tsx` | Import `selectApprovePeriod`; visibility condition changed from `lastApprovedDate > moment().format('YYYY-MM-DD')` to `lastApprovedDate > moment(approvePeriod).format('YYYY-MM-DD')`; `approvePeriod` added to `useMemo` deps |
| 4 | `sagas.js` | Dispatch `getApprovePeriod()` in `handleSetWeekendsTable` saga |

**No backend changes** — the backend already accepts any `personalDate` without date-range validation (known gaps BUG-DO-4, BUG-DO-5).

---

## A.3 Gap Analysis — Requirements vs Implementation

### GAP-1 (CRITICAL): Boundary condition `>` vs `>=`

**Requirement P.1:** Day-offs in an open approve period should have the edit action available.
**Implementation:** `lastApprovedDate > moment(approvePeriod).format('YYYY-MM-DD')`

If `approvePeriod = '2026-03-01'` and a day-off's `lastApprovedDate = '2026-03-01'`, the comparison `'2026-03-01' > '2026-03-01'` evaluates to `false`. The edit button will be **hidden** for a day-off that IS in the open period.

The original code had a two-line check:
```
line 109: lastApprovedDate > moment().format('YYYY-MM-DD')
line 110: lastApprovedDate === moment().format('YYYY-MM-DD')
```
Together these form `>=`. If only line 109 was changed to use `approvePeriod` but line 110 still compares against `moment()` (today), the logic becomes:
- `lastApprovedDate > approvePeriod` OR `lastApprovedDate === today`
This is a **mixed comparison** — partly using the new logic, partly using the old.

**Impact:** Users with day-offs on the 1st day of an open month cannot reschedule them.
**Verification:** TC-3404-07

---

### GAP-2 (HIGH): Requirement vs implementation mismatch on minDate

**Requirement P.2.4/sub4:** "Dates earlier than the 1st of the month of the **original** day-off date" should be disabled.
**Implementation:** `minDate = moment(approvePeriod).subtract(1, 'd')` — uses approve period start, not the original date's month.

These only align when `approvePeriod` starts on the 1st of the original date's month. They diverge when:

| Scenario | Approve Period | Original Date | Req says minDate | Code says minDate |
|----------|---------------|---------------|------------------|-------------------|
| Normal case | 2026-03-01 | 2026-03-15 | 2026-03-01 | 2026-02-28 (approvePeriod - 1 day) |
| Approve spans 2 months | 2026-02-01 | 2026-03-15 | 2026-03-01 | 2026-01-31 |
| Same month | 2026-03-01 | 2026-03-08 | 2026-03-01 | 2026-02-28 |

In all cases the code is **more permissive** than the requirement (allows earlier dates). The off-by-one (`subtract(1, 'd')`) consistently allows one extra day before the approve period start.

**Impact:** Users may be able to select dates outside the intended range.
**Verification:** TC-3404-17, TC-3404-18

---

### GAP-3 (MEDIUM): Global vs per-office approve period

The `selectApprovePeriod` selector reads from Redux state populated by `getApprovePeriod()` action, which calls `/v1/offices/periods/approve/min`. This endpoint returns the **earliest** open approve period across all offices (or the current user's office — needs verification).

If it returns a global minimum:
- Employee in Office A (March closed) could see March dates as editable because Office B's March is still open
- This would allow rescheduling day-offs that should be locked

**Impact:** Multi-office environments may have incorrect date constraints.
**Verification:** TC-3404-07 + DB query to compare per-office periods

---

### GAP-4 (LOW): Race condition on first render

The saga dispatches `getApprovePeriod()` asynchronously. Components render immediately with `approvePeriod = undefined`. `moment(undefined)` returns current date, so the UI briefly shows old behavior (today-based constraints) before switching to approvePeriod-based constraints after the API response.

**Impact:** Brief visual flash of wrong enabled/disabled state. No functional impact — user cannot interact with datepicker during the loading phase.

---

## A.4 Known Application State (from Knowledge Base)

### Existing Day-Off Rescheduling Behavior
- Employee view: `/vacation/my/daysoff` — table with year selector
- Edit icon (pencil) shown for holidays with `duration=0` and `lastApprovedDate >= today`
- `TransferDaysoffModal` opens with datepicker: `minDate` was yesterday or original date, `maxDate` = Dec 31 of year+1
- Weekends disabled, existing day-off dates disabled, short-day conflicts disabled
- Working weekends ARE selectable (exception to weekend rule)
- OK button disabled until valid date selected

### Existing Bugs Relevant to This Change
- **BUG-DO-4:** Past `personalDate` accepted by backend without validation
- **BUG-DO-5:** Weekend `personalDate` accepted by backend (UI blocks but API allows)
- **BUG-DO-13:** Hardcoded date `'2024-03-10'` in WeekendTableActions
- **BUG-DO-14:** `updateEmployeeDayoffRequest` drops `personalDate` silently via destructuring

### Data Model Context
- `lastApprovedDate` field name is misleading — it's the **public holiday date**, not the last approved date
- `personalDate` is the employee's chosen compensatory day
- `originalDate` = the calendar holiday date (same as `lastApprovedDate` in most cases)
- Approve period is per-office (responsibility center), tracked in `office_period` table

---

## A.5 Questions for Dynamic Testing

- [ ] **Q1:** Is the `>=` boundary handled correctly for day-offs on the approve period start date? (GAP-1)
- [ ] **Q2:** Does the approve period endpoint return per-employee-office or global minimum? (GAP-3)
- [ ] **Q3:** Does `minDate` correctly restrict to the 1st of the original month, or does it allow earlier dates from the approve period? (GAP-2)
- [ ] **Q4:** Is the `isMinCurrentDay` logic preserved for future holidays (should use `moment(originalDate)` as minDate)?
- [ ] **Q5:** Does the datepicker's `minDate` prop use `<` or `<=` for disabling dates?
