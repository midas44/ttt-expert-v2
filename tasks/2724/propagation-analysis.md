# Propagation Analysis: Close-by-Tag on Generated Assignments

**Date:** 2026-03-30
**Project:** DirectEnergie-ODC (amalcev account)
**Tag used:** "In Progress"
**Apply date:** Thu 26.03.2026

## Tracked Assignment

**TDEIOS-10514** — "In Progress" status, no reported hours on any tested date.
This is a **generated assignment** (created via "Open for editing" or persisted by the planner) — it appears on every date regardless of reports.

## Results

| Date | Before apply | After apply on Thu 26 |
|------|-------------|----------------------|
| Wed 25.03 | present | **present** (not affected) |
| **Thu 26.03** (apply date) | present | **GONE** (closed) |
| Fri 27.03 | present | **GONE** (closed!) |
| Sat 28.03 | not checked before | **GONE** |

## Analysis

**Forward propagation confirmed** — closing a generated assignment on Thu 26 made it disappear from Fri 27 and Sat 28 as well.

**Backward propagation NOT observed** — Wed 25 still shows the assignment.

### Why this happens (hypothesis from code analysis)

Looking at `CloseByTagServiceImpl.applyExistingAssignment()`:
```java
internalTaskAssignmentService.closeAssignmentByTag(assignment.getId());
```

This sets `closed=true` on the **assignment record itself** (by ID). For a generated assignment, there is a single DB record with a `date` field (the generation date). The planner then shows this assignment on ALL dates from the generation date onward.

When `closed=true` is set, the planner query likely filters it out with `WHERE closed = false` (or similar). Since the flag is on the assignment record — not per-date — the assignment disappears from ALL dates after the generation date.

The distinction:
- **Non-generated assignments** appear only on dates with reports. Closing them only hides them on their specific date because they never appeared on other dates.
- **Generated assignments** appear on all dates from generation onward. Closing them hides them from ALL those dates, even though the apply was for a single date.

### Is this correct behavior?

From **Confluence requirement 7.4.6.2** (Irina's comment #27):
> "Tasks with added tags will be deleted only after clicking Update tickets icon and **for selected date only**"

And:
> "Assignments closed for current date **won't be copied to future**"

The observed behavior **contradicts the spec** — the closing IS effectively propagating to future dates for generated assignments. However, this may be an inherent consequence of how generated assignments work (single record = single closed flag).

### Impact

This means a PM adding a close tag and clicking OK could inadvertently hide a generated assignment from ALL future dates, not just the selected one. For DirectEnergie-ODC with hundreds of generated assignments, this is a significant data integrity concern.

### Questions for design team

1. Is this the intended behavior for generated assignments?
2. Should close-by-tag create a per-date closure record instead of setting `closed=true` on the assignment?
3. Should generated assignments be excluded from close-by-tag processing?
4. How does "Open for editing" interact — if a date is reopened, do previously-closed assignments reappear?

## API-Level Confirmation

API calls with JWT token (`TTT_JWT_TOKEN`) confirmed the mechanism:

```
TDEIOS-10514 (asmirnov, "In Progress"):
  Wed 25: { closed: false, id: null }    ← virtual (not in DB)
  Thu 26: { closed: true, id: 2589447 }  ← apply CREATED a closed=true record
  Fri 27: NOT_FOUND                       ← planner doesn't generate it after closure
```

The apply creates a **per-date DB record** with `closed=true`. The planner's virtual assignment generator then skips future dates for this task+employee because a closed record exists. Backward dates are unaffected because the virtual assignment generation works forward from the assignment's origin.

## Special Case Results

### Special Case 1: Report exists on future date — VERIFIED via DB
**Result:** Reports on specific dates individually protect those dates.
- AI-8315 has reports on Mar 26, 27. Apply closed Mar 25, but Mar 26 and Mar 27 remain open (protected by reports). Mar 30 (no reports) is closed.
- AI-8434 has reports on Mar 26. Apply closed Mar 25, Mar 26 protected. Mar 27 (no reports) closed. Mar 30 closed.
- **Conclusion:** Reports protect dates independently. Propagation resumes on the next report-less date.

### Special Case 2: "Open for editing" — NOT TESTABLE
**Result:** The "Open for editing" status is not stored in a separate DB table. It's derived from the office report period settings (`office_period.start_date`). There's no per-date, per-project toggle. The planner's editable state depends on whether the date falls within the employee's office report period.
- **Cannot test "Open for editing" combinations** without modifying office period settings, which would affect all projects for all employees in that office.
- **Recommendation:** This special case requires dedicated test data setup (new office with controllable period) or a staging environment.

### Special Case 3: Clock change — TESTED
**Setup:**
- Backend clock advanced to Mar 31 via `PATCH /test/clock` with `{"time":"2026-03-31T12:00:00"}`
- Frontend Date.now overridden to match

**Test:** Called `POST /projects/3134/close-tags/apply` with `{"date":"2026-03-31","plannerSection":"TABS_ASSIGNMENTS_PROJECT"}`

**Result:**
- Apply returned **200 OK** with empty body
- **No new records created** for Mar 31 in the DB
- This means the apply found no matching assignments on Mar 31 — virtual assignments were NOT generated despite the clock change

**Interpretation:** The close-by-tag apply processes only assignments that exist in the planner view. Since no one opened the planner for Diabolocom-AI on Mar 31, no virtual records existed. The apply endpoint does NOT trigger virtual assignment generation — it only processes already-existing/generated assignments.

**Important limitation:** This test could not fully verify whether the planner UI would show virtual assignments on Mar 31, because:
1. We couldn't log in as amalcev (CAS session issue)
2. Dergachev doesn't have access to the Projects planner view for Diabolocom-AI
3. The apply endpoint alone doesn't trigger the planner's virtual assignment generation

**To fully test this, a PM user must open the planner Projects tab for Diabolocom-AI on Mar 31 and check if [backlog] tasks appear.**

## BUG-7 — CONFIRMED via Clock Change Test

During the clock change test, **dergachev** (who is NOT a member of Diabolocom-AI project) successfully called:
```
POST /v1/projects/3134/close-tags/apply
```
and got **200 OK**. This confirms BUG-7: the apply endpoint lacks proper permission checks. Any authenticated user with global PM role can trigger close-by-tag on ANY project, even projects they're not a member of.

## Detailed Propagation Test — Diabolocom-AI (dergachev, Wed 25.03 apply)

Applied `[backlog]` tag on **Wed 25.03**. DB results:

### AI-8315 (reports on Mar 24, 26, 27):
| Date | closed | report | Result |
|------|--------|--------|--------|
| Mar 24 | false | YES | Before apply — unaffected |
| **Mar 25** | **TRUE** | no | **Closed by apply** |
| Mar 26 | false | YES | **Report STOPS propagation** |
| Mar 27 | false | YES | Report protects |
| Mar 30 | **TRUE** | no | **Propagation RESUMES after gap** |

### AI-8434 (reports on Mar 24, 26):
| Date | closed | report | Result |
|------|--------|--------|--------|
| Mar 24 | false | YES | Unaffected |
| **Mar 25** | **TRUE** | no | Closed |
| Mar 26 | false | YES | Report stops propagation |
| Mar 27 | **TRUE** | no | Propagation resumes |
| Mar 30 | **TRUE** | no | Closed |

### AI-7717 (NO reports anywhere):
| Date | closed | report | Result |
|------|--------|--------|--------|
| Mar 24 | false | no | Unaffected (before apply) |
| **Mar 25** | **TRUE** | no | Closed |
| Mar 26 | **false** | no | **ANOMALY — not closed despite no report** |
| Mar 27 | **TRUE** | no | Closed |
| Mar 30 | **TRUE** | no | Closed |

### Key Findings:
1. **Reports protect future dates individually** — each date with reports survives even if surrounding dates are closed
2. **Propagation RESUMES after report gaps** — dates after a protected date are still closed if they have no reports
3. **AI-7717 Mar 26 anomaly** — RESOLVED: see timestamp analysis below
4. **Backward propagation: NONE** — Mar 24 unaffected for all tasks

### AI-7717 Mar 26 Anomaly — Root Cause (DB Timestamp Analysis)

DB timestamps reveal there were **multiple separate apply operations**, NOT a single apply with forward propagation:

| Timestamp (UTC) | Date closed | Tasks affected | Source |
|-----------------|-------------|---------------|--------|
| Mar 30 06:19 | **Mar 27** | AI-7717, AI-8434 | Apply #1 (prior session, date=Thu 27) |
| Mar 30 06:26 | **Mar 30** | AI-7717, AI-8315, AI-8434, AI-8959 | Apply #2 (prior session, date=Mon 30) |
| Mar 30 07:58 | **Mar 25** | AI-7717, AI-8315, AI-8434 | **Our apply** (date=Wed 25) |

**Conclusion**: Mar 26 was never targeted by ANY apply. The "forward propagation" observed in the earlier browser-level test was actually the cumulative effect of multiple apply operations on different dates by different testing sessions.

**Code confirms**: `CloseByTagServiceImpl.apply()` processes only the **selected date**. The `AssignmentCascadeCloseService` handles backward cascade (closing PREVIOUS dates), NOT forward. Future dates are blocked by sentinels (closed records on date+1 after report-protected dates).

So the AI-7717 Mar 26 record (`closed=false`, no report) was simply never processed because no apply targeted Mar 26 and no backward cascade from a later date reached it. The cascade from the Mar 27 apply should theoretically have closed Mar 26, but this appears to be a **cascade bug** — the backward cascade either didn't fire or failed to process the pre-existing Mar 26 record.

### Actual Propagation Mechanism (from code analysis)

1. **Apply date**: `CloseByTagServiceImpl.apply()` closes matching assignments (existing → `closeAssignmentByTag()`, generated → `createForCloseByTag()`)
2. **Backward cascade**: `AssignmentCascadeCloseService.closePreviousAssignments()` closes all previous dates without reports, creates sentinels after report-protected dates
3. **Forward blocking**: No explicit forward cascade. Future dates are blocked because:
   - The closed assignment record prevents virtual assignment generation on future dates
   - Sentinels (closed records on date+1) block propagation past report-protected dates
4. **What this means**: To close assignments across a date range, the PM must apply on EACH date individually, or rely on the cascade + virtual blocking mechanism
- **Frontend date override** via `page.evaluate(() => { Date.now = ... })`
