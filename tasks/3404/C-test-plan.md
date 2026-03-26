# Stage C: Test Plan & Test Cases — #3404

**Ticket:** [#3404](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3404)
**Environment:** qa-1 (release/2.1)
**Date:** 2026-03-26

---

## C.1 Test Strategy

### Scope
- All 4 requirements (P.1, P.2.4/sub2, P.2.4/sub4, P.4)
- 2 regression areas (P.2 month-close rejection, P.3 vacation recalculation)
- 5 static testing findings (ST-1 through ST-5)

### Approach
1. **Smoke** — verify tooltip fix and basic new behavior
2. **Core** — systematic check of each requirement
3. **Boundaries** — approve period boundaries, off-by-one
4. **E2E** — full reschedule-to-earlier-date flow with approval
5. **Regression** — vacation recalc, month-close, existing functionality
6. **Edge cases** — multi-office, language, year switching

### Test Data Needs
- Current approve period start date per office (DB/API query)
- Employee with day-off on a public holiday IN the open approve period
- Employee with day-off on a public holiday in a CLOSED month
- Employee with day-off exactly ON the approve period start date (boundary)
- Manager credentials for approval testing

---

## C.2 Test Cases

### Group 1: P.4 — Tooltip Translation Fix

#### TC-3404-01: EN tooltip text on edit icon
| Field | Value |
|-------|-------|
| **Precondition** | Language = English. Employee has at least one reschedulable day-off. |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Hover over the edit (pencil) icon on a day-off row |
| **Expected** | Tooltip reads **"Reschedule event"** (not "Reschedule an event") |
| **Traces** | P.4, translationsEN.json change |

#### TC-3404-02: EN dialog title
| Field | Value |
|-------|-------|
| **Precondition** | Language = English. Reschedulable day-off exists. |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Click edit icon on a reschedulable row |
| **Expected** | Dialog title reads **"Reschedule event"** |
| **Traces** | P.4 |

#### TC-3404-03: RU tooltip unchanged
| Field | Value |
|-------|-------|
| **Precondition** | Language = Russian. Reschedulable day-off exists. |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Hover over edit icon |
| **Expected** | Tooltip reads **"Перенести событие"** (unchanged) |
| **Traces** | P.4, regression |

---

### Group 2: P.1 — Edit Action Availability

#### TC-3404-04: Edit icon visible for day-off in open month
| Field | Value |
|-------|-------|
| **Precondition** | Employee has a public holiday (duration=0) with `lastApprovedDate` in the currently open approve period. |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Find the row for the holiday in the open month 3. Check the Actions column |
| **Expected** | Edit (pencil) icon **is visible** |
| **Traces** | P.1 TO BE |

#### TC-3404-05: Edit icon visible for PAST day-off in open month (NEW behavior)
| Field | Value |
|-------|-------|
| **Precondition** | Today is March 26. Employee has a public holiday on March 8 (past date). Approve period starts March 1 (March is open). |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Find the March 8 row |
| **Expected** | Edit icon **is visible** — this is the key NEW behavior (previously hidden because date < today) |
| **Traces** | P.1 TO BE, core new functionality |

#### TC-3404-06: Edit icon hidden for day-off in closed month
| Field | Value |
|-------|-------|
| **Precondition** | Employee has a public holiday with `lastApprovedDate` in a closed month (e.g., January or February). |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Find the row for the holiday in the closed month |
| **Expected** | Edit icon is **NOT visible** — action unavailable |
| **Traces** | P.1 TO BE (closed period = unavailable) |

#### TC-3404-07: Edit icon for day-off ON approve period start date (BOUNDARY)
| Field | Value |
|-------|-------|
| **Precondition** | Employee has a public holiday where `lastApprovedDate` = approve period start date (e.g., both = 2026-03-01). |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Find the boundary row |
| **Expected** | Edit icon **is visible** — the date is IN the open period |
| **Verifies** | GAP-1 / ST-1: if `>` is used instead of `>=`, this test FAILS |

#### TC-3404-08: Edit icon hidden for day-off on last day of closed month
| Field | Value |
|-------|-------|
| **Precondition** | Employee has holiday on Feb 28. Approve period starts March 1. |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Find the Feb 28 row |
| **Expected** | Edit icon is **NOT visible** |
| **Traces** | P.1, boundary |

#### TC-3404-09: No edit icons in previous year
| Field | Value |
|-------|-------|
| **Precondition** | All months of 2025 are in closed approve period. |
| **Steps** | 1. Navigate to `/vacation/my/daysoff` 2. Switch year selector to 2025 3. Inspect all rows |
| **Expected** | **No** edit icons visible on any rows (all holidays are in closed periods) |
| **Traces** | P.1, regression |

---

### Group 3: P.2.4/sub2 — Datepicker: Closed Month Dates Disabled

#### TC-3404-10: Closed month (January) — all dates disabled
| Field | Value |
|-------|-------|
| **Precondition** | Approve period starts March 1. Reschedulable day-off exists. |
| **Steps** | 1. Click edit icon on a reschedulable row 2. In datepicker, navigate to January 2026 |
| **Expected** | All dates in January are **disabled** (greyed out / not clickable) |
| **Traces** | P.2.4/sub2 |

#### TC-3404-11: Closed month (February) — all dates disabled
| Field | Value |
|-------|-------|
| **Steps** | 1. In datepicker, navigate to February 2026 |
| **Expected** | All dates in February are **disabled** |
| **Traces** | P.2.4/sub2 |

#### TC-3404-12: Open month (March) — working days enabled
| Field | Value |
|-------|-------|
| **Steps** | 1. In datepicker, navigate to March 2026 |
| **Expected** | Working days (Mon-Fri, non-holiday) are **enabled**. Weekends and holidays remain disabled per existing logic. |
| **Traces** | P.2.4/sub2, positive |

#### TC-3404-13: Future month (April) — working days enabled
| Field | Value |
|-------|-------|
| **Steps** | 1. In datepicker, navigate to April 2026 |
| **Expected** | Working days in April are **enabled** |
| **Traces** | P.2.4/sub2, positive |

#### TC-3404-14: Boundary — Feb 28 (last day of closed month) disabled
| Field | Value |
|-------|-------|
| **Precondition** | Approve period starts March 1. |
| **Steps** | 1. In datepicker, navigate to February 2026 2. Check day 28 |
| **Expected** | Feb 28 is **disabled** |
| **Traces** | P.2.4/sub2, boundary |

#### TC-3404-15: Boundary — March 1 (first day of open month) enabled
| Field | Value |
|-------|-------|
| **Precondition** | Approve period starts March 1. March 1 is a working day. |
| **Steps** | 1. In datepicker, navigate to March 2026 2. Check day 1 |
| **Expected** | March 1 is **enabled** (if it's a working day) |
| **Verifies** | ST-2: off-by-one in `subtract(1,'d')` |

---

### Group 4: P.2.4/sub4 — Earlier Date Constraint Relaxation

#### TC-3404-16: Can select date earlier than original within same month
| Field | Value |
|-------|-------|
| **Precondition** | Day-off with `originalDate` = March 15. Approve period starts March 1. |
| **Steps** | 1. Click edit icon 2. In datepicker, select March 3 3. Click OK |
| **Expected** | March 3 is **selectable**. Transfer request created successfully. |
| **Traces** | P.2.4/sub4, core new functionality |

#### TC-3404-17: Can select first day of original month
| Field | Value |
|-------|-------|
| **Precondition** | Day-off with `originalDate` = March 15. Approve period starts March 1. March 2 is a working day (March 1 may be weekend). |
| **Steps** | 1. Click edit icon 2. Select March 2 (first working day of March) |
| **Expected** | Selectable — this is within "1st of the month of the original day-off date" boundary |
| **Traces** | P.2.4/sub4 |

#### TC-3404-18: Cannot select date before original month (closed period)
| Field | Value |
|-------|-------|
| **Precondition** | Day-off `originalDate` = March 15. Approve period starts March 1. |
| **Steps** | 1. Click edit icon 2. Navigate datepicker to February 2026 3. Try to select Feb 28 |
| **Expected** | Feb 28 is **disabled** — it's in a closed month |
| **Verifies** | ST-3: if approvePeriod < March 1, this test may fail (dates before March would be enabled) |

#### TC-3404-19: Future holiday — old behavior preserved
| Field | Value |
|-------|-------|
| **Precondition** | Day-off with `originalDate` in the future (e.g., a holiday in May 2026). `isMinCurrentDay` = false (today < originalDate). |
| **Steps** | 1. Click edit icon 2. Check datepicker minDate |
| **Expected** | minDate = `originalDate` — cannot select dates before the original date (old behavior for future holidays is preserved) |
| **Traces** | P.2.4/sub4, regression for future holidays |

---

### Group 5: E2E Flow

#### TC-3404-20: Full reschedule to earlier date with approval
| Field | Value |
|-------|-------|
| **Precondition** | Employee has a past public holiday (e.g., March 8) in the open approve period that has NOT been transferred yet (duration=0, no existing transfer). Manager identified. |
| **Steps** | 1. Login as employee 2. Navigate to `/vacation/my/daysoff` 3. Click edit icon on March 8 row 4. In datepicker, select March 3 (earlier date) 5. Click OK / Submit 6. Verify row shows "March 8 -> March 3" with status NEW 7. Login as manager 8. Navigate to `/vacation/request/daysoff-request/approval` 9. Find the transfer request 10. Click Approve |
| **Expected** | Transfer created with status NEW. After approval: status = APPROVED. Day-off now on March 3 in the calendar. Vacation days recalculated if applicable. |
| **Traces** | All requirements, E2E integration |

---

### Group 6: P.2 — Month-Close Rejection (Regression)

#### TC-3404-21: Month close auto-rejects NEW transfers
| Field | Value |
|-------|-------|
| **Precondition** | A NEW (unapproved) day-off transfer exists with `personalDate` in the currently open month. Admin access available. |
| **Steps** | 1. Verify the NEW transfer exists 2. As admin, close the current approve period (advance to next month) 3. Check the transfer status |
| **Expected** | Transfer status changed to **REJECTED** (auto-rejected by system). Existing behavior preserved. |
| **Traces** | P.2, regression |
| **Note** | This test modifies the approve period — execute LAST or use a separate test employee |

---

### Group 7: P.3 — Vacation Recalculation (Regression)

#### TC-3404-22: Vacation days correct after moving day-off to earlier date
| Field | Value |
|-------|-------|
| **Precondition** | Employee has: (a) a vacation in the same month, (b) a day-off in that month that can be moved to an earlier date (within or near the vacation range). |
| **Steps** | 1. Record vacation day count before the move 2. Move the day-off to an earlier date (within the open month) 3. Have manager approve the transfer 4. Check vacation day count after approval |
| **Expected** | Vacation day count is **correctly recalculated**. If the day-off moved into the vacation date range, working days in vacation decrease by 1. If moved out, they increase by 1. |
| **Traces** | P.3 |

---

## C.3 Test Execution Matrix

| Phase | Test Cases | Duration | Priority |
|-------|-----------|----------|----------|
| 1. Smoke | TC-3404-01, 04, 06 | 10 min | P0 |
| 2. Core P.1 | TC-3404-05, 07, 08, 09 | 20 min | P0 |
| 3. Datepicker | TC-3404-10, 11, 12, 13, 14, 15 | 20 min | P0 |
| 4. Earlier dates | TC-3404-16, 17, 18, 19 | 20 min | P0 |
| 5. E2E | TC-3404-20 | 20 min | P1 |
| 6. Tooltip all | TC-3404-02, 03 | 5 min | P2 |
| 7. Regression | TC-3404-21, 22 | 30 min | P1 |

**Total: ~22 test cases, ~2 hours estimated**

---

## C.4 Defect Severity Definitions

| Severity | Criteria |
|----------|----------|
| **BLOCKER** | Core new functionality doesn't work (can't reschedule past day-offs, can't select earlier dates) |
| **CRITICAL** | Boundary bugs causing wrong edit visibility, vacation recalc regression |
| **MAJOR** | Datepicker allows dates in closed months, requirement mismatch on minDate |
| **MINOR** | Tooltip text, visual flash, code hygiene |
