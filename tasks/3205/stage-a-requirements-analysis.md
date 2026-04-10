# Stage A: Requirements vs Known State Analysis — Ticket #3205

## Ticket Summary

**Title:** [Bug][Days off] Approving manager not updated in employee UI after redirecting day-off transfer request
**Reporter:** Loreta Simonyan (2025-02-11)
**Assignee:** Vladimir Ulyanov
**Labels:** Production Ready, Sprint 15
**MR:** !5136 merged into release/2.1 (2026-01-21), commit `ab03d082`

## Original Bug Description

When a day-off transfer request is redirected from one manager to another, the "Confirms" ("Подтверждает") field in the employee's UI does not update to show the new approver. The original manager remains displayed even after the redirect and even after the new manager approves the request.

**Reproduction steps (from ticket):**
1. Login as employee `mpotter`
2. Open day-offs page, transfer a day-off to another date
3. Login as manager `bryz`, redirect the request to `pvaynmaster`
4. Login as `mpotter` — "Confirms" still shows `bryz` (BUG)
5. Login as `pvaynmaster`, approve the request
6. Login as `mpotter` — "Confirms" still shows `bryz` (BUG)

**Environment:** Originally found on preprod/stage.

## What the Fix Addresses

The MR changes `EmployeeDayOffSearchServiceImpl.java` (10 lines, backend only):

### Change 1: `setDayOffsDetailInfo()` (line 314)
When building the employee's day-off list, if a day-off request has `approverId` set in the database (meaning it was redirected), the code now loads the actual approver employee and sets it on the day-off BO.

```java
if (request.getApproverId() != null) {
    intersectionDayOff.get().setApprover(
            internalEmployeeService.findLightById(request.getApproverId()));
}
```

### Change 2: `getOwnDayOffs()` (line 194)
Previously, the code **unconditionally** overwrote every day-off's approver with the employee's manager. Now it only defaults to manager when no approver was already set from the database.

```java
// Before (broken):
calendarDay.setApprover(employeeBO.getManager());

// After (fixed):
if (calendarDay.getApprover() == null) {
    calendarDay.setApprover(employeeBO.getManager());
}
```

## What the Fix Does NOT Address (By Design Decision)

The ticket discussion (11 comments) revealed a broader set of issues. Designer (imalakhovskaia) decided on 2026-01-28 to leave most as-is:

### 1. Post-approval approver revert (ACCEPTED by designer)
After the redirected approver approves the request, the employee's UI reverts to showing the original manager. Root cause: approved requests move from `employeeDayOffRequests` to `employeeDayOffEntities`, and that code path doesn't preserve the approver.

Designer rationale: "User needs to know who confirms PENDING requests. For approved day-offs, exact audit trail is not a necessity."

QA (vulyanov) disagreed, noting this creates inconsistency with vacation behavior where the actual approver is preserved.

### 2. Terminology inconsistency (NOT FIXED)
- Russian: "Подтверждает" (confirms, present/ongoing tense)
- English: "Approved by" (past tense, implies completed action)

vulyanov recommended neutral terms: "Подтверждающий" / "Approver"

### 3. Default approver for non-transferred day-offs (NOT FIXED)
Day-offs that were never transferred still show a pre-populated "Confirms" value (the employee's manager), even though no approval process exists for them. vulyanov noted this is misleading.

### 4. Inconsistency with vacation redirect behavior (NOT FIXED)
For vacations, after redirect + approval, the actual approver is shown permanently. For day-offs, it reverts. This creates cross-module inconsistency within the same application.

## Known State From Knowledge Base

- The day-off module uses a separate entity structure from vacations (`EmployeeDayOffRequestEntity` vs `VacationEntity`)
- Day-off transfer requests are per-transfer, not per-day-off (unlike vacations where one request covers the whole vacation)
- The `changeApprover` API endpoint on the vacation service updates `approverId` in the request entity
- The employee's day-off page calls `GET /v1/employee-dayOff?type=MY` which routes to `getOwnDayOffs()`
- The approver's queue uses `type=APPROVER` which routes to `findByApprover()` — a different code path

## Risk Assessment

| Risk | Likelihood | Impact | Notes |
|------|-----------|--------|-------|
| Fix works for pre-approval redirect | Low (straightforward logic) | High if broken | Core bug fix |
| Post-approval revert confuses users | Medium | Low (designer accepted) | Document as known limitation |
| N+1 queries for many redirected day-offs | Low (few redirects typically) | Low | Performance concern only |
| NPE in date matching (pre-existing) | Low | Medium | Edge case with null dates |
