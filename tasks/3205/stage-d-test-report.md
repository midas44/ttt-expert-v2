# Stage D: Dynamic Test Report — Ticket #3205

## Environment

- **URL:** https://ttt-qa-1.noveogroup.com
- **Build:** 2.1.26-SNAPSHOT.LOCAL (Build date: 22.03.2026)
- **Branch:** release/2.1 (includes MR !5136, merged 2026-01-21)
- **Date tested:** 2026-03-27

## Test Users

| Role | Login | Name | Office |
|------|-------|------|--------|
| Employee | `aglushko` | Artem Glushko | Уран (Cyprus holidays) |
| Manager M1 (original) | `pvaynmaster` | Pavel Weinmeister | Персей |
| Manager M2 (redirect target) | `bryz` | Vitaly Bryzgalov | Сатурн |

## Test Execution Summary

| Test Case | Result | Notes |
|-----------|--------|-------|
| TC-3205-001: Basic redirect — employee sees updated approver | **PASS** | Employee sees "Vitaly Bryzgalov" after redirect |
| TC-3205-002: Post-approval — approver display after approval | **PASS (by design)** | Reverts to "Pavel Weinmeister" after approval — accepted behavior |
| TC-3205-003: Multiple day-offs — only redirected one changes | **PASS** | Only the transferred day-off shows new approver; all others show original manager |
| TC-3205-004: Redirect chain A→B→C | **NOT TESTED** | Requires 3 different manager logins; deferred |
| TC-3205-005: Request details popup | **N/A** | Employee's day-off page has no "details" popup — only Cancel and Reschedule actions |
| TC-3205-006: New approver sees request | **PASS** | bryz sees the request in Approval tab with correct details |
| TC-3205-007: Original approver's queue cleared | **PASS** | pvaynmaster's queue dropped from 6 to 5 after redirect |
| TC-3205-008: Cancel after redirect | **NOT TESTED** | Deferred to avoid further data pollution |
| TC-3205-009: Default approver for non-transferred day-offs | **OBSERVED** | All non-transferred day-offs show original manager — confirms design bug #4 from vulyanov |
| TC-3205-010: Consistency with vacations | **NOT TESTED** | Requires matching vacation redirect scenario; deferred |

## Detailed Test Flow

### Step 1: Create day-off transfer (Employee: aglushko)
- Logged in as `aglushko` (Artem Glushko)
- Navigated to Days off page: `/vacation/my/daysoff`
- Clicked transfer button on "Cyprus National Holiday" (01.04.2026)
- Selected new date: 03.04.2026 (Friday)
- Confirmed transfer
- **Result:** Row updated to "01.04.2026 (we) → 03.04.2026 (fr)" with status "New"
- **"Approved by" column:** Pavel Weinmeister (original manager) — correct for pre-redirect state
- Screenshot: [02-transfer-created-new-status.png](screenshots/02-transfer-created-new-status.png)

### Step 2: Redirect request (Manager: pvaynmaster)
- Logged in as `pvaynmaster` (Pavel Weinmeister)
- Navigated to: `/vacation/request/daysoff-request/APPROVER`
- Found Artem Glushko's request in the Approval tab (6 total requests)
- Clicked "Redirect the request" (3rd action button)
- In the redirect dialog, searched for "bryz" and selected "Vitaly Bryzgalov"
- Confirmed redirect
- **Result:** Request disappeared from pvaynmaster's queue (count dropped from 6 to 5)
- DB verified: `employee_dayoff_request.approver` changed from pvaynmaster (id 249) to bryz (id 33)
- Screenshots: [03-approver-queue-pvaynmaster.png](screenshots/03-approver-queue-pvaynmaster.png), [04-redirect-dialog-bryz-selected.png](screenshots/04-redirect-dialog-bryz-selected.png)

### Step 3: Verify employee sees updated approver (TC-3205-001 — THE FIX)
- Logged in as `aglushko`
- Navigated to Days off page
- **Result:** The transferred day-off row shows **"Vitaly Bryzgalov"** in "Approved by" column
- All other day-offs still show "Pavel Weinmeister"
- **VERDICT: PASS — the fix works correctly**
- Screenshot: [05-employee-sees-new-approver-PASS.png](screenshots/05-employee-sees-new-approver-PASS.png)

### Step 4: New approver sees request (TC-3205-006)
- Logged in as `bryz` (Vitaly Bryzgalov)
- Navigated to: `/vacation/request/daysoff-request/APPROVER`
- **Result:** Artem Glushko's request visible in Approval tab (1 request)
- Row shows: Employee "Artem Glushko" | Initial date "01.04.2026" | Requested date "03.04.2026" | Manager "Pavel Weinmeister" | Approved by "Vitaly Bryzgalov" | Status "New"
- **VERDICT: PASS**
- Screenshot: [06-bryz-sees-request-in-queue.png](screenshots/06-bryz-sees-request-in-queue.png)

### Step 5: Approve request and verify post-approval state (TC-3205-002)
- As `bryz`, clicked "Approve the request" button
- **Result:** Request approved, bryz's queue is now empty
- Logged in as `aglushko`, navigated to Days off page
- **Result:** Row now shows "03.04.2026 (fr)" (transferred date only, no arrow) with status "Approved"
- **"Approved by" column: "Pavel Weinmeister"** — reverted to original manager, NOT "Vitaly Bryzgalov"
- **VERDICT: PASS (matches expected by-design behavior)**
- This confirms the post-approval revert behavior described in ticket comments
- Screenshot: [07-post-approval-reverts-to-original-manager.png](screenshots/07-post-approval-reverts-to-original-manager.png)

## Issues Found

### Issue 1: Post-approval approver revert (KNOWN — by design)
- **Severity:** Low (accepted by designer)
- **Description:** After a redirected day-off request is approved, the employee's "Approved by" column reverts to the original manager instead of showing the actual approver
- **Root cause:** Approved requests move from `employeeDayOffRequests` to `employeeDayOffEntities` code path, which doesn't preserve the approver (see Stage B, Issue B-4)
- **Status:** Accepted by designer (comment 2026-01-28): "User doesn't need exact audit trail for approved day-offs"
- **Evidence:** Screenshot [07-post-approval-reverts-to-original-manager.png](screenshots/07-post-approval-reverts-to-original-manager.png)

### Issue 2: "Approved by" terminology inconsistency (KNOWN — design bug #3)
- **Severity:** Low (cosmetic)
- **Description:** English UI header is "Approved by" (past tense, implies completed action), while Russian UI header is "Подтверждает" (present tense, implies ongoing action). These convey different meanings.
- **Recommendation:** Use neutral terms "Approver" / "Подтверждающий" as suggested by QA (vulyanov)

### Issue 3: Default approver shown for non-transferred day-offs (KNOWN — design bug #4)
- **Severity:** Low (cosmetic)
- **Description:** Day-offs that were never transferred (no rescheduling request exists) still display the employee's manager in the "Approved by" column, even though no approval was needed
- **Evidence:** All non-transferred rows in screenshots show "Pavel Weinmeister" with status "Approved"

### Issue 4: Orphaned test data — eburets transfer request
- **Severity:** Informational
- **Description:** During testing, a day-off transfer request was created for `eburets` (id 3438, 01.05→04.05.2026). It remains in NEW status assigned to `gprikhodko`. Should be cleaned up manually.
- **DB record:** `ttt_vacation.employee_dayoff_request` id=3438

## Overall Verdict

**The MR !5136 fix works as intended.** The core bug (employee not seeing updated approver after redirect) is resolved. The post-approval revert behavior is a known, accepted design limitation.

| Aspect | Status |
|--------|--------|
| Core fix (pre-approval approver update) | Working correctly |
| Post-approval behavior | Works as designed (reverts to original manager) |
| Isolation (only redirected day-off affected) | Working correctly |
| Approver queue updates (new approver sees request) | Working correctly |
| Original approver queue cleanup | Working correctly |
