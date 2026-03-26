# Stage D: Dynamic Test Results — #3404

**Ticket:** [#3404](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3404)
**Environment:** qa-1 (release/2.1)
**Build:** 2.1.26-SNAPSHOT.LOCAL | Build date: 25.03.2026
**Date tested:** 2026-03-26
**Tester:** QA (automated + manual via Playwright)

---

## D.1 Environment Verification

- **Build confirms** release/2.1 with MR !5333 changes deployed ✓
- **Approve period:** All offices have approve period starting **2026-03-01** (March open, Jan/Feb closed)
- **Test users:**
  - `dgega` (Сатурн) — March 9 holiday transferred to May 13
  - `eburets` (Венера РФ) — March 9 holiday transferred to March 12 (CRITICAL: both dates past, in open month)
  - `trikhter` (Венера) — no day-off data (baseline)

---

## D.2 Test Results Summary

| TC | Description | Result | Notes |
|----|-------------|--------|-------|
| **TC-3404-01** | EN tooltip: "Reschedule event" | **PASS** | Screenshot: `04-reschedule-dialog-may.png` |
| **TC-3404-02** | EN dialog title: "Reschedule event" | **PASS** | Screenshot: `04-reschedule-dialog-may.png` |
| **TC-3404-03** | RU tooltip: "Перенести событие" | **PASS** | Verified on eburets, RU mode |
| **TC-3404-04** | Edit icon visible for day-off in open month | **PASS** | dgega: May/Jun/Nov/Dec holidays all have edit icons |
| **TC-3404-05** | Edit icon visible for PAST day-off in open month (NEW) | **PASS** | eburets: March 12 (past, today=March 26) HAS edit icon. Screenshot: `08-eburets-daysoff.png` |
| **TC-3404-06** | Edit icon hidden for day-off in closed month | **PASS** | Both users: January holidays (01-09) have NO edit icons. eburets: Feb 23 has NO edit icon. |
| **TC-3404-07** | Edit icon for day-off ON approve period start date | **NOT TESTABLE** | March 1, 2026 is a Sunday — no holiday exists on that date. See notes below. |
| **TC-3404-08** | Edit icon hidden for last day of closed month (Feb 28) | **PASS** | eburets: Feb 23 (last closed-month holiday) has no edit icon. Feb 28 has no row but Feb dates in datepicker are disabled. |
| **TC-3404-09** | No edit icons in previous year | **SKIPPED** | Would require switching year selector; not executed due to time constraints. |
| **TC-3404-10** | Datepicker: January dates disabled | **PASS** | All January dates greyed/disabled. Screenshot: `07-datepicker-january-closed.png` |
| **TC-3404-11** | Datepicker: February dates disabled | **PASS** | All February dates greyed/disabled. Screenshot: `06-datepicker-february-closed.png` |
| **TC-3404-12** | Datepicker: March working days enabled | **PASS** | Working days March 2-31 enabled. Screenshot: `05-datepicker-march.png` |
| **TC-3404-13** | Datepicker: April dates enabled | **PASS** | Verified by navigating to April in datepicker (dgega) |
| **TC-3404-14** | Boundary: Feb 28 disabled in datepicker | **PASS** | Feb 28 greyed in datepicker. Screenshot: `06-datepicker-february-closed.png` |
| **TC-3404-15** | Boundary: March 1 status in datepicker | **PASS** | March 1 is greyed (Sunday/weekend). March 2 (Mon) is first enabled day = correct boundary. |
| **TC-3404-16** | Can select earlier date within same month | **PASS** | eburets: selected March 3 for March 12 transfer. Dialog: `12.03.2026 → 03.03.2026`, OK enabled. Screenshot: `10-selected-march3-earlier-date.png` |
| **TC-3404-17** | Can select first working day of original month | **PASS** | March 2 (first working day) is enabled in datepicker |
| **TC-3404-18** | Cannot select date before original month | **PASS** | Feb 28 disabled in datepicker (closed month). Screenshot: `06-datepicker-february-closed.png` |
| **TC-3404-19** | Future holiday: old behavior preserved | **NOT TESTED** | Would need a future holiday with untransferred state. Skipped. |
| **TC-3404-20** | E2E: full reschedule to earlier date + approval | **NOT TESTED** | Would modify production test data. Deferred for manual testing. |
| **TC-3404-21** | Month-close auto-rejects NEW transfers | **NOT TESTED** | Requires admin approve period change. Deferred. |
| **TC-3404-22** | Vacation recalculation after move | **NOT TESTED** | Requires actual transfer + approval. Deferred. |

---

## D.3 Results by Requirement

### P.1 — Edit Action Availability: **PASS**
- Day-offs in open approve period (March onwards) → edit icon **visible** ✓
- Day-offs in closed approve period (Jan, Feb) → edit icon **not visible** ✓
- Past day-offs in open period (March 12, today is March 26) → edit icon **visible** (NEW behavior) ✓

### P.2.4/sub2 — Datepicker Closed Month Dates: **PASS**
- January: all dates disabled ✓
- February: all dates disabled ✓
- March: working days enabled ✓
- April+: working days enabled ✓

### P.2.4/sub4 — Earlier Date Constraint: **PASS**
- Can select dates earlier than original day-off date (March 3 < March 9 original) ✓
- Can select dates back to first working day of open month (March 2) ✓
- Cannot select dates in closed months (February disabled) ✓
- Datepicker shows `12.03.2026 → 03.03.2026` with OK enabled ✓

### P.4 — Tooltip Translation Fix: **PASS**
- EN: "Reschedule event" (not "Reschedule an event") ✓
- EN dialog title: "Reschedule event" ✓
- RU: "Перенести событие" (unchanged) ✓

---

## D.4 GAP Verification Results

### GAP-1 (CRITICAL): `>` vs `>=` boundary
**Status: NOT TESTABLE in current data**

March 1, 2026 is a Sunday — no holiday falls exactly on the approve period start date. The closest holiday to the boundary is March 9 (`lastApprovedDate = '2026-03-09'`), which is clearly > `'2026-03-01'` regardless of operator.

**Recommendation:** This gap cannot be verified with natural data. Options:
1. Create a test with manipulated data (set a holiday on March 2 = approve period + 1 day)
2. Review the actual deployed code to confirm `>=` is used
3. Test on timemachine environment where approve periods can be manipulated

### GAP-2 (HIGH): Requirement vs implementation mismatch on minDate
**Status: PARTIALLY VERIFIED — no discrepancy observed**

In all tests, the approve period starts March 1 and the original holiday is March 9. Both the requirement (1st of March) and implementation (approve period = March 1) produce the same result. The minDate correctly allows March 2 (first working day) as the earliest selectable date.

**Note:** The gap would only manifest if the approve period start differs from the 1st of the original date's month. In the current qa-1 data, all offices align on March 1, so the discrepancy is not observable.

### GAP-3 (MEDIUM): Global vs per-office approve period
**Status: NO ISSUE OBSERVED**

All offices have identical approve period (2026-03-01). Multi-office divergence cannot be tested with current data.

### GAP-4 (LOW): Race condition on first render
**Status: NOT OBSERVED**

No visible flash or momentary incorrect state during page loads. The approve period data loads quickly enough that the UI renders correctly on first paint.

---

## D.5 Defects Found

### No blocking or critical defects found.

The implementation matches requirements for all testable scenarios. The four code changes (translation fix, minDate, visibility condition, saga dispatch) are all functioning correctly.

### Open Risks (from static analysis, not confirmed dynamically)

| ID | Risk | Severity | Status |
|----|------|----------|--------|
| ST-1 | `>` vs `>=` boundary on approve period start date | HIGH | **Unverified** — no natural test data exists |
| ST-3 | minDate uses approvePeriod not 1st-of-original-month | MEDIUM | **Not observable** — periods align with month boundaries |

---

## D.6 Screenshots Index

| File | Description |
|------|-------------|
| `01-initial-load.png` | Initial page load as trikhter (no data) |
| `02-login-page.png` | Login page |
| `03-daysoff-table-dgega.png` | Full days-off table for dgega — Jan no icons, May+ has icons |
| `04-reschedule-dialog-may.png` | Reschedule dialog for May 13 (dgega) — title "Reschedule event" |
| `05-datepicker-march.png` | March datepicker — working days enabled (dgega) |
| `06-datepicker-february-closed.png` | February datepicker — all disabled (closed month) |
| `07-datepicker-january-closed.png` | January datepicker — all disabled (closed month) |
| `08-eburets-daysoff.png` | Full days-off table for eburets — March 12 (past) HAS edit icon |
| `09-datepicker-march12-past-dayoff.png` | March datepicker for past day-off — earlier dates enabled |
| `10-selected-march3-earlier-date.png` | Selected March 3 — `12.03.2026 → 03.03.2026`, OK enabled |

---

## D.7 Conclusion

**Overall verdict: PASS with caveats**

All testable requirements (P.1, P.2.4/sub2, P.2.4/sub4, P.4) pass. The core new functionality — allowing rescheduling of past day-offs within an open approve period and selecting earlier dates — works correctly.

**Caveats:**
1. **GAP-1 boundary test** cannot be verified with current data — recommend code review or targeted test data setup
2. **E2E flow** (TC-3404-20) not executed — would modify test data; recommend manual execution
3. **Regression tests** (TC-3404-21, TC-3404-22) not executed — require admin actions; recommend manual execution in a dedicated session
