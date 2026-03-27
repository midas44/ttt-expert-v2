# Stage B: Static Code Analysis — Ticket #3205

## Commit Under Review

- **Hash:** `ab03d082f3d809d90ec37c60786687c4959f9e49`
- **Merge commit:** `c2176ba8f7` (squash merge into release/2.1)
- **Files changed:** 3 (1 production, 2 test)
- **Lines:** +508, -4

## Production Code Analysis

### File: `EmployeeDayOffSearchServiceImpl.java`

#### Change 1: `setDayOffsDetailInfo()` — Approver from DB (lines 313-317)

```java
if (request.getApproverId() != null) {
    intersectionDayOff.get().setApprover(
            internalEmployeeService.findLightById(request.getApproverId()));
}
```

**Analysis:**
- **Correctness:** Sound. Only triggers when `approverId` is non-null (i.e., request was redirected). The `findLightById()` loads a lightweight employee BO — appropriate for display purposes.
- **Context:** This runs inside a loop over `employeeDayOffRequests` where `intersectionDayOff` is already confirmed `.isPresent()` (line 309). Safe.
- **Matching logic (pre-existing, line 307):** `it.getLastApprovedDate().equals(request.getLastApprovedDate())` — matches calendar day-offs with requests by their "last approved date". If both dates are the same, the request's approver is applied to the calendar day. This matching is fragile but pre-existing.

#### Change 2: `getOwnDayOffs()` — Conditional default (lines 193-196)

```java
if (calendarDay.getApprover() == null) {
    calendarDay.setApprover(employeeBO.getManager());
}
```

**Analysis:**
- **Correctness:** Sound. `setDayOffsDetailInfo()` runs before this loop (line 190), so any approver set from the DB is preserved. Day-offs without active requests (no redirect) still get the manager default.
- **Note:** `calendarDay.setManager()` still runs unconditionally (line 197) — the `manager` field always shows the employee's direct manager regardless of redirect. Only `approver` is affected.

### Potential Issues Identified

#### Issue B-1: `findSoonDayOffs()` gap (lines 232-258) — MEDIUM

```java
// line 250:
setDayOffsDetailInfo(List.of(), employeeDayOffEntities, calendarDaysResponse);
```

This method passes an **empty list** as `employeeDayOffRequests`. The approver fix in `setDayOffsDetailInfo` only applies when iterating over requests (line 303: `if (ObjectUtils.isNotEmpty(employeeDayOffRequests))`). So `findSoonDayOffs()` never triggers the fix.

Additionally, `findSoonDayOffs()` does NOT set approver at all in its forEach loop (lines 251-257) — it sets employee, id, and status but skips approver entirely.

**Impact:** If `findSoonDayOffs()` feeds any UI component (e.g., upcoming day-offs notification), the approver will be missing or null. Need to verify consumers.

**Consumers (from grep):** Called by notification services for "upcoming day-off" reminders. These typically show only dates, not approvers. **Low actual impact** but indicates incomplete refactoring.

#### Issue B-2: N+1 query pattern (line 315) — LOW

```java
internalEmployeeService.findLightById(request.getApproverId())
```

Called inside a loop over `employeeDayOffRequests`. Each redirected day-off triggers a separate DB query. Typical employee has 0-2 redirected day-offs, so N+1 is negligible in practice. If the system ever supports bulk redirects, this should be batch-loaded.

#### Issue B-3: NPE risk in date matching (line 307) — LOW (pre-existing)

```java
it.getLastApprovedDate().equals(request.getLastApprovedDate())
```

If `getLastApprovedDate()` returns null on either side, this throws NPE. Pre-existing code, not introduced by this fix. Day-offs from the calendar service should always have dates, but edge cases (deleted calendar entries, data migration artifacts) could trigger this.

#### Issue B-4: Post-approval path analysis — BY DESIGN

When a request is approved:
1. Request entity changes status (moves out of `NEW` status)
2. `employeeDayOffRequests` (line 181) filters by status — approved requests are excluded
3. `employeeDayOffEntities` (line 185-186) captures approved day-offs
4. `setDayOffDetail()` (lines 323-331) processes entities but does NOT set approver
5. The fallback at line 194 (`if approver == null → set manager`) kicks in
6. Result: approved day-offs always show the employee's manager, not the actual approver

This is the root cause of the "reverts after approval" behavior. The designer explicitly accepted this.

#### Issue B-5: No frontend changes — OBSERVATION

The MR contains zero frontend changes. The frontend already renders whatever `approver` field the API returns. This means:
- If the backend returns the correct approver, the UI will be correct
- No risk of frontend-specific display bugs from this change
- But also no opportunity to add frontend-level validation or formatting

## BDD Test Analysis

### New scenario: "Employee sees correct approver after dayOff approver is changed"

**Coverage:**
- Employee creates day-off transfer: `mpotter` transfers from 2026-04-03 to 2026-04-07
- Before redirect: all 3 day-offs show approver `bryz` (employee's manager)
- After redirect: only the transferred day-off shows `pvaynmaster`, other 2 still show `bryz`
- New approver's queue: `pvaynmaster` sees the request in APPROVER type query

**Gaps in BDD test:**
1. Does NOT test post-approval state (what happens after `pvaynmaster` approves)
2. Does NOT test redirect chain (A→B→C)
3. Does NOT test cancel-after-redirect
4. Does NOT test the "Request details" popup approver field
5. Does NOT test the employee's UI page rendering (only API response)
6. Tag `@admin-conversion` seems misplaced — this is a day-off approver test, not an admin conversion test (copy-paste from adjacent scenarios)

### Removed tags on existing scenarios

The commit also removes `@admin-conversion` tags from 3 existing maternity leave scenarios (lines 760, 796, 813). This appears to be cleanup — the maternity scenarios were incorrectly tagged.

## Summary of Risk

| Finding | Severity | Type | Action |
|---------|----------|------|--------|
| B-1: `findSoonDayOffs()` no approver | Medium | Gap | Verify consumers; likely notifications-only |
| B-2: N+1 queries | Low | Performance | Monitor; no fix needed now |
| B-3: NPE in date matching | Low | Pre-existing | Edge case test |
| B-4: Post-approval revert | N/A | By design | Document |
| B-5: No frontend changes | Info | Observation | No action |
| BDD tag misuse | Low | Test quality | Cosmetic |
