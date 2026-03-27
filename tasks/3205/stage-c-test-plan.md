# Stage C: Test Plan — Ticket #3205

## Overview

**Feature:** Day-off transfer request approver display after redirect
**Environment:** qa-1 (ttt-qa-1.noveogroup.com)
**Branch:** release/2.1
**Preconditions:**
- Employee with public holidays in their office calendar (to have transferrable day-offs)
- Employee has a direct manager (who can redirect)
- A second manager exists (redirect target)

---

## Test Cases

### TC-3205-001: Basic redirect — employee sees updated approver (Happy Path)

**Priority:** Critical
**Type:** Functional / Regression

**Preconditions:**
- Employee E has manager M1
- Manager M2 exists and can approve day-offs
- E has at least one public holiday that can be transferred

**Steps:**
1. Login as employee E
2. Navigate to Day-offs page (`/vacation/my/daysoff`)
3. Transfer a day-off from original date to a new date
4. Verify "Confirms" column shows M1 (default manager)
5. Login as manager M1
6. Navigate to Day-off requests (`/vacation/request/daysoff-request/APPROVER`)
7. Find E's request and redirect (change approver) to M2
8. Login as employee E
9. Navigate to Day-offs page

**Expected Result:**
- The transferred day-off row shows M2 in the "Confirms" column
- All other (non-transferred) day-offs still show M1

---

### TC-3205-002: Post-approval — approver display after approval

**Priority:** High
**Type:** Functional

**Preconditions:** TC-3205-001 completed (request redirected to M2, not yet approved)

**Steps:**
1. Login as M2
2. Navigate to Day-off requests (`/vacation/request/daysoff-request/APPROVER`)
3. Find and approve E's day-off transfer request
4. Login as employee E
5. Navigate to Day-offs page

**Expected Result (per design decision):**
- The transferred day-off shows M1 (original manager) in "Confirms" — NOT M2
- This is accepted behavior per designer's decision (2026-01-28)
- Document the actual observed behavior

---

### TC-3205-003: Multiple day-offs — only redirected one changes approver

**Priority:** High
**Type:** Functional

**Preconditions:**
- Employee E has 3+ public holidays visible on Day-offs page
- Only 1 of them is transferred and redirected

**Steps:**
1. Login as E, transfer day-off #1 only
2. Login as M1, redirect day-off #1 to M2
3. Login as E, open Day-offs page

**Expected Result:**
- Day-off #1 (transferred + redirected): shows M2
- Day-off #2 (not transferred): shows M1
- Day-off #3 (not transferred): shows M1

---

### TC-3205-004: Redirect chain — A redirects to B, B redirects to C

**Priority:** Medium
**Type:** Functional

**Preconditions:**
- Employee E with manager M1
- Managers M2 and M3 exist
- Day-off transfer request created by E

**Steps:**
1. Login as E, transfer a day-off
2. Login as M1, redirect the request to M2
3. Login as E — verify "Confirms" shows M2
4. Login as M2, redirect the request to M3
5. Login as E — verify "Confirms" shows M3

**Expected Result:**
- After each redirect, the employee sees the LATEST approver
- Final state: M3 is shown

---

### TC-3205-005: "Request details" popup — approver in modal

**Priority:** High
**Type:** UI / Functional

**Preconditions:** Day-off request redirected from M1 to M2 (not yet approved)

**Steps:**
1. Login as employee E
2. Navigate to Day-offs page
3. Click "More details" (Подробнее) on the redirected day-off row
4. Check the approver field in the popup/modal

**Expected Result:**
- Popup shows M2 as the approver (consistent with table column)
- Per developer's confirmation (comment #5 on ticket)

---

### TC-3205-006: New approver's queue — request is visible

**Priority:** High
**Type:** Functional

**Preconditions:** Day-off request redirected from M1 to M2

**Steps:**
1. Login as M2
2. Navigate to Day-off requests (`/vacation/request/daysoff-request/APPROVER`)

**Expected Result:**
- E's day-off transfer request appears in M2's approver queue
- Request shows correct dates and employee name

---

### TC-3205-007: Original approver's queue — request is removed

**Priority:** High
**Type:** Functional

**Preconditions:** Day-off request redirected from M1 to M2

**Steps:**
1. Login as M1
2. Navigate to Day-off requests (`/vacation/request/daysoff-request/APPROVER`)

**Expected Result:**
- E's redirected day-off request is NOT in M1's approver queue anymore
- (Or shows in a different status — verify actual behavior)

---

### TC-3205-008: Employee cancels transfer after redirect

**Priority:** Medium
**Type:** Functional / Edge Case

**Preconditions:** Day-off request redirected from M1 to M2, not approved yet

**Steps:**
1. Login as E
2. Navigate to Day-offs page
3. Cancel/revert the day-off transfer (if UI allows)
4. Check "Confirms" column

**Expected Result:**
- If cancellation is possible: day-off reverts to original date, "Confirms" reverts to M1
- If cancellation is NOT possible from employee UI: document this limitation
- The request should disappear from M2's queue

---

### TC-3205-009: Day-off without transfer — default approver display

**Priority:** Medium
**Type:** UI / Observation

**Preconditions:** Employee E has public holidays that were never transferred

**Steps:**
1. Login as E
2. Navigate to Day-offs page
3. Check the "Confirms" column for non-transferred day-offs

**Expected Result:**
- Non-transferred day-offs show the employee's direct manager
- (vulyanov's design bug #4: this value is arguably meaningless since no approval was ever needed — document observed behavior)

---

### TC-3205-010: Consistency check — vacation redirect vs day-off redirect

**Priority:** Low
**Type:** Consistency / Documentation

**Preconditions:**
- Same employee E has a vacation that was redirected to M2 and approved
- Same employee E has a day-off that was redirected to M2 and approved

**Steps:**
1. Login as E
2. Check vacation page — who is shown as approver for the approved, redirected vacation?
3. Check day-offs page — who is shown as approver for the approved, redirected day-off?

**Expected Result:**
- Vacation: shows M2 (actual approver) — known behavior
- Day-off: shows M1 (original manager) — per design decision
- **This is a known inconsistency** — document the difference

---

## Test Data Requirements

| Role | Requirements |
|------|-------------|
| Employee E | Has manager, has public holidays in 2026 calendar, enabled |
| Manager M1 | Direct manager of E, can approve day-offs |
| Manager M2 | Any other manager, redirect target |
| Manager M3 | (TC-004 only) Third manager for chain redirect |

## Environment Notes

- qa-1 must have release/2.1 deployed (with MR !5136 included)
- Calendar must have public holidays configured for the office
- Clock may need to be set to a date where transferrable day-offs exist
