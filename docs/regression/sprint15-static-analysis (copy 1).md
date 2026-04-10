# Sprint 15 Static Analysis: release/2.1 vs stage

**Date:** 2026-04-09
**Branches:** `release/2.1` (ea58f85) vs `origin/stage` (2f13c2d)
**Scope:** 709 files changed, +30,635 / -4,953 lines, 526 commits

## Methodology

Static code review of `git diff origin/stage..release/2.1` across all modules (TTT backend, Vacation backend, Frontend). Each finding is verified against the actual diff. New Sprint 15 features (#2724 close-by-tag, #3093 PM Tool integration, #3353 individual norm, #3092 advance vacation, #3404 days-off transfer, #3396 CI/CD rollback) are excluded from bug classification.

---

## 1. Critical / High Severity Findings

### 1.1 DB Migration: NOT NULL Columns Without DEFAULT on Existing Table

**Severity:** CRITICAL
**File:** `ttt/db/db-migration/.../V2_1_26_202512011115__add_reported_effort_and_month_norm_to_statistic_report_table.sql`

```sql
ALTER TABLE ttt_backend.statistic_report
ADD COLUMN reported_effort decimal(10, 3) NOT NULL;

ALTER TABLE ttt_backend.statistic_report
ADD COLUMN month_norm bigint NOT NULL;
```

**Problem:** Adds `NOT NULL` columns without `DEFAULT` to `statistic_report`. PostgreSQL rejects `ADD COLUMN ... NOT NULL` if the table contains any existing rows (`ERROR: column contains null values`). If `statistic_report` has been populated in previous sprints, this migration **will fail on deployment**.

**Dynamic test:**
- TC-SA-001: Deploy migration against a database with existing `statistic_report` rows. Verify migration succeeds or fails.
- TC-SA-002: If migration fails, add `DEFAULT 0` and re-run. Verify existing data integrity.

---

### 1.2 Race Condition: Shared Mutable Event Payload in Async Processing

**Severity:** HIGH
**File:** `vacation/service/service-impl/.../statisticReport/StatisticReportUpdateAfterVacationEventHelper.java`

```java
public void sendUpdateMonthNormEvent(final VacationBO vacation) {
    final var eventPayload = new EmployeeMonthNormContextCalculatedEventPayload();

    // Event 1: start month
    final List<...> contextsForStartMonth = monthNormContextCalculator
        .prepareMonthNormCalculationContextForEmployees(startMonth, ...);
    eventPayload.setContexts(contextsForStartMonth);           // <-- mutates payload
    eventPublisher.publishEvent(new ...ApplicationEvent(eventPayload));

    if (!startMonth.equals(endMonth)) {
        // Event 2: end month — REUSES SAME eventPayload object
        eventPayload.setContexts(contextsForEndMonth);         // <-- mutates same object
        eventPublisher.publishEvent(new ...ApplicationEvent(eventPayload));
    }
}
```

**Problem:** The same `eventPayload` object is shared between two published events. The listener (`VacationUpdatedEventListener`) processes events `@Async`. By the time event 1 is processed, `eventPayload.getContexts()` may already point to `contextsForEndMonth` from event 2. This causes:
- Event 1 processes end-month data instead of start-month data
- Start-month norm is never recalculated
- Data inconsistency in statistic reports

**Fix:** Create a new `eventPayload` object for each event, or deep-copy contexts.

**Dynamic test:**
- TC-SA-003: Update a vacation that spans two months (e.g., May 28 — June 5). Verify that month norm is correctly recalculated for BOTH May and June.
- TC-SA-004: Under load (multiple concurrent vacation updates), verify no cross-contamination of month norm data.

---

### 1.3 Double VacationUpdatedEvent per Update

**Severity:** MEDIUM-HIGH
**File:** `vacation/service/service-impl/.../vacation/VacationServiceImpl.java` (lines 235-240)

```java
private void sendVacationUpdatedEvent(final VacationBO oldVacation, final VacationBO newVacation) {
    eventPublisher.publishEvent(new VacationUpdatedEvent(oldVacation));
    eventPublisher.publishEvent(new VacationUpdatedEvent(newVacation));
}
```

**Problem:** Every vacation update publishes TWO `VacationUpdatedEvent`s — one with old data, one with new. Each triggers `StatisticReportUpdateAfterVacationEventHelper.sendUpdateMonthNormEvent()`, which itself publishes up to 2 more events (start/end month). Net result: a single vacation update can trigger **4 month norm recalculations** instead of the necessary 2.

When vacation dates don't change (e.g., only comment edited), both events cover the same months — pure waste. Combined with issue 1.2 (shared mutable state), this amplifies the race condition.

**Design intent:** Likely meant to recalculate norms for both old and new date ranges when dates change. Better approach: compare dates, only publish for changed months.

**Dynamic test:**
- TC-SA-005: Update a vacation's comment (no date change). Check server logs for redundant month norm recalculation events.
- TC-SA-006: Move a vacation from May to June. Verify norms for May (old), June (new) are both correctly recalculated.

---

### 1.4 Frontend Statistics: API Request Batching Removed

**Severity:** HIGH
**File:** `frontend/frontend-js/src/modules/statistics/ducks/data/sagas.js`

```javascript
// OLD: Split into batches of 5 parallel requests
for (let i = 0; i < calls.length; i += 5) {
    vacationsDividedStatistics.push(yield all(calls.slice(i, i + 5)));
}

// NEW: Single request with ALL employee logins
const [employeesVacations, employeesSickLeaves] = yield all([
    call(sendRequestForVacationStatistics, { employeesLogins, startDate, endDate }),
    call(sendRequestForSickLeaveStatistics, { employeesLogins, startDate, endDate }),
]);
```

**Problem:** The old code split employee logins into chunks of 5 to prevent API overload. New code sends ALL logins in a single request. For organizations with 100+ employees:
- Request payload may exceed backend limits
- Backend query may time out
- Single point of failure (one failed request = no absences shown for anyone)

**Dynamic test:**
- TC-SA-007: Open Statistics page for a department with 50+ employees. Verify absences (vacation/sick leave) load correctly.
- TC-SA-008: Open Statistics page for a department with 200+ employees. Measure response time, check for timeouts.
- TC-SA-009: Verify API request payload size in browser DevTools Network tab for large employee lists.

---

### 1.5 effectiveBounds Depends on Unpopulated employee_work_period Table

**Severity:** HIGH (first deployment only)
**File:** `ttt/service/service-impl/.../task/report/TaskReportSummaryServiceImpl.java`

```java
private Pair<LocalDate, LocalDate> effectiveBounds(final long employeeId,
                                                    final LocalDate rangeStart,
                                                    final LocalDate rangeEnd) {
    return employeeWorkPeriodRepository.findPeriodForRange(employeeId, rangeStart, rangeEnd)
        .map(period -> Pair.of(
            TimeUtils.max(rangeStart, period.getPeriodStart()),
            period.getPeriodEnd() == null ? rangeEnd : TimeUtils.min(rangeEnd, period.getPeriodEnd())))
        .orElse(Pair.of(rangeStart, rangeEnd));  // fallback: full range
}
```

**Problem:** The new `effectiveBounds()` method clamps report periods to the employee's work period. The `employee_work_period` table is populated by CS employee sync (`CSEmployeeSynchronizer`). On first deployment:
- If sync hasn't run yet: all employees fall back to full range (functionally correct but misses the point of #3353)
- If sync runs partially (e.g., fails mid-page): some employees have correct bounds, others don't — **inconsistent norm calculations across employees**

The fallback `orElse(Pair.of(rangeStart, rangeEnd))` means the system degrades gracefully, but users may see different norm behavior for different employees until sync completes.

**Dynamic test:**
- TC-SA-010: Before CS sync runs, verify "My Tasks" page shows correct norms (full month range as before).
- TC-SA-011: After CS sync, verify norms exclude days before hire date and after dismissal date.
- TC-SA-012: For an employee hired mid-month (e.g., 15th), verify personal norm is proportional, not full month.

---

### 1.6 Project Patch Reduced to 3 Fields — Task Unpinning Removed

**Severity:** HIGH (regression risk)
**File:** `ttt/service/service-impl/.../project/InternalProjectService.java`

```java
// OLD patch() method handled 11+ fields:
// name, customer, country, model, seniorManager, manager, observers, owner, status, type, preSalesIds,
// trackerUrl, proxyUrl, scriptUrl, knowledgeBaseUrl
// Including: taskService.renameProjectTasks(), taskService.unpinProjectTasks()

// NEW patch() method handles only:
Optional.ofNullable(projectPatchRequest.getTrackerUrl())...
Optional.ofNullable(projectPatchRequest.getProxyUrl())...
Optional.ofNullable(projectPatchRequest.getScriptUrl())...
```

**Context:** This is INTENTIONAL — Sprint 15 moved project management to PM Tool (#3093). Projects are now synced from PM Tool, not edited manually. However:

1. **Task unpinning on project close is gone:** Old code called `taskService.unpinProjectTasks()` when status changed to CLOSED. If PM Tool sync closes a project, pinned tasks won't be unpinned.
2. **Permission validations removed:** `ProjectPatchServiceImpl` validation methods for EDIT_TYPE, EDIT_MODEL, EDIT_OWNER, EDIT_SENIOR_MANAGER were deleted. If any path still allows these changes via PM Tool sync, they bypass permission checks.
3. **Project creation endpoint (`POST /projects`) removed entirely** from `ProjectController.java`. Any external integrations calling this endpoint will get 404.

**Dynamic test:**
- TC-SA-013: Close a project via PM Tool sync. Verify pinned tasks for that project are properly handled.
- TC-SA-014: Try to manually create a project via API (`POST /v1/projects`). Verify proper error response (404, not 500).
- TC-SA-015: Via Admin UI, open project edit form. Verify only URL fields are editable. Verify non-URL fields are read-only/synced from PM Tool.

---

## 2. Medium Severity Findings

### 2.1 StatisticReport Entity EqualsAndHashCode Changed

**File:** `ttt/db/db-api/.../entity/statisticReport/StatisticReport.java`

```java
// OLD: @EqualsAndHashCode(of = "id")
// NEW: @EqualsAndHashCode(of = {"employeeLogin", "reportDate"})
```

**Risk:** Any code that uses `StatisticReport` objects in `Set` or `Map` collections will now use `{employeeLogin, reportDate}` as the key instead of `id`. If two objects have the same login+date but different IDs (shouldn't happen, but no DB unique constraint enforces this), they'll be treated as equal.

**Dynamic test:**
- TC-SA-016: Query `statistic_report` table for duplicate `(employee_login, report_date)` pairs. Verify none exist.

---

### 2.2 Frontend: Vacation daysLimitation safeToFixed Removed

**File:** `frontend/frontend-js/src/modules/vacation/ducks/myVacation/reducer.ts`

```javascript
// OLD: daysLimitation: safeToFixed(daysObject.daysLimitation),
// NEW: daysLimitation: daysObject.daysLimitation,
```

**Risk:** `safeToFixed()` provided null/undefined protection and consistent formatting. Without it, if backend returns null for `daysLimitation`, downstream calculations using this value may produce NaN or crash.

**Dynamic test:**
- TC-SA-017: Create a vacation for a new employee with no accrued days. Verify daysLimitation displays correctly (not NaN/undefined).
- TC-SA-018: Create a vacation for a maternity-leave employee. Verify daysLimitation value.

---

### 2.3 Frontend: Approve Tab — spawn Changed to call (Sequential Loading)

**File:** `frontend/frontend-js/src/modules/approve/ducks/sagas/employeeTabSagas.ts`

```javascript
// OLD: Non-blocking parallel execution
yield spawn(handleGetEmployeeWeekPeriods as any, {...});
yield spawn(handleGetEmployees);

// NEW: Sequential blocking execution
yield call(handleGetEmployeeWeekPeriods as any, {...});
yield call(handleGetEmployees);
```

**Risk:** `spawn` creates detached background tasks (non-blocking), while `call` blocks until completion. The approve tab will now load employee data sequentially, potentially increasing page load time.

**Dynamic test:**
- TC-SA-019: Open Approve tab. Measure load time with DevTools. Compare with previous version if possible.
- TC-SA-020: Open Approve tab for a manager with 30+ employees. Verify all data loads correctly.

---

### 2.4 Frontend: Statistics Tab-Specific Absence Logic Removed

**File:** `frontend/frontend-js/src/modules/statistics/ducks/data/sagas.js`

```javascript
// OLD: Only fetched absences for specific tabs (employee-bound tabs)
const isBoundTab = boundTabs.has(filters.currentTab);

// NEW: Fetches absences unconditionally, assigns to any node with a login
const absencesMapper = node => {
    if (node.login) {
        node.vacation = vacationsByLogin[node.login];
        node.sickLeaves = sickLeavesByLogin[node.login];
    }
};
```

**Risk:** Absence data is now assigned to ALL nodes with a `login` property, including task-bound nodes where it may not be expected. Could cause rendering issues or incorrect data display in task-bound statistics tabs.

**Dynamic test:**
- TC-SA-021: Open Statistics > "Task linked hours by employees" tab. Verify no unwanted vacation/sick-leave columns appear.
- TC-SA-022: Open Statistics > General tab. Verify absences display correctly for employees.

---

### 2.5 Frontend: formikSelectMulti.js Deleted

**File:** `frontend/frontend-js/src/common/services/formHelpers/formikSelectMulti.js` (DELETED, -66 lines)

**Risk:** If any remaining component imports this helper, it will cause a runtime import error. The admin project form was the primary user (now simplified), but other forms may have used it.

**Dynamic test:**
- TC-SA-023: Navigate through all admin forms (projects, employees, offices, trackers, events). Verify no console errors related to missing imports.

---

### 2.6 Frontend: Vacation Create Form — New Advance Validation

**File:** `frontend/frontend-js/src/modules/vacation/services/validation/vacationValidationForm.js`

```javascript
if (isAdvanceVacation && daysNotEnough.length > 0) {
    errors[INPUT_NAME.VACATION_START_DATE] = apiErrorMessage({
        message: 'exception.validation.vacation.duration',
    });
}
```

**Risk:** New validation disables submit button when advance vacation has insufficient days. Uses same error message key as duration errors — could confuse users. If `daysNotEnough` array is incorrectly populated, valid vacations may be blocked.

**Dynamic test:**
- TC-SA-024: For advance-vacation office, create vacation exceeding available days. Verify clear error message.
- TC-SA-025: For advance-vacation office, create vacation within available days. Verify submit is enabled.

---

### 2.7 Frontend: Production Calendar DTO Type Mismatch

**File:** `frontend/frontend-js/src/common/ducks/productionCalendar/api.ts`

```typescript
export const fetchUserWorkingPeriods = ({ employeeLogin }: { employeeLogin: string }) =>
    tttApiRequest.get<PagedEmployeeDayOffDTO>(  // <-- wrong DTO type
        `/v1/employees/${employeeLogin}/work-periods`,
    );
```

**Risk:** Uses `PagedEmployeeDayOffDTO` type for work periods endpoint. The actual response likely has a different structure. TypeScript won't catch this at runtime, but accessing wrong property names will produce undefined values.

**Dynamic test:**
- TC-SA-026: Open "My Tasks" page. Verify no console errors related to work periods. Check that weekly/monthly norms display correctly.

---

## 3. Intentional Changes Requiring Regression Testing

These are NOT bugs — they are Sprint 15 features. But they touch critical existing paths and need focused regression testing.

### 3.1 Vacation Calculation Strategy Refactoring (#3092)

**Files:**
- `VacationAvailablePaidDaysCalculatorImpl.java` — main calculator refactored
- `VacationAvailabilityChecker.java` — new strategy selector
- `AdvanceCalculationStrategy.java` — advance office logic
- `RegularCalculationStrategy.java` — regular office logic

Maternity handling moved from calculator to checker. Old methods commented out (tech debt). Public interface methods deleted without deprecation.

**Regression tests:**
- TC-SA-027: Regular office employee — create vacation, verify available days calculation.
- TC-SA-028: Advance-vacation office employee — create vacation, verify advance calculation.
- TC-SA-029: Maternity-leave employee — create vacation, verify days summed across all years.
- TC-SA-030: Edit existing vacation — verify edited days properly excluded from calculations.
- TC-SA-031: Create vacation spanning year boundary — verify cross-year day calculations.

### 3.2 Individual Norm with Work Periods (#3353)

**Files:**
- `TaskReportSummaryServiceImpl.java` — new `effectiveBounds()`, context-based API
- `EmployeeWorkPeriodServiceImpl.java` — new service
- `CSEmployeeSynchronizer.java` — populates work periods

**Regression tests:**
- TC-SA-032: Employee hired on 15th — verify monthly norm is prorated from 15th, not 1st.
- TC-SA-033: Employee dismissed on 20th — verify monthly norm excludes days after 20th.
- TC-SA-034: Employee with no work period data — verify fallback to full range.
- TC-SA-035: Over-report notification — verify threshold calculation uses effective bounds.

### 3.3 Project Management via PM Tool (#3093)

**Files:**
- `InternalProjectService.java` — create() removed, patch() simplified
- `PmToolProjectSynchronizer.java` — new sync for projects from PM Tool
- Admin frontend — edit form simplified, table columns removed

**Regression tests:**
- TC-SA-036: PM Tool sync — create new project in PM Tool, verify it appears in TTT after sync.
- TC-SA-037: PM Tool sync — update project name/status in PM Tool, verify TTT reflects changes.
- TC-SA-038: Admin UI — verify project list still displays correctly (no missing columns).
- TC-SA-039: Admin UI — verify project info modal shows all data (read-only for PM Tool fields).

### 3.4 Close-by-Tag Feature (#2724)

**Files:**
- `CloseByTagServiceImpl.java`, `AssignmentCascadeCloseService.java`
- `PlannerCloseTagController.java`, `PlannerCloseTagServiceImpl.java`
- Frontend: `PlannerTagsAdd.js`, `PlannerTagsList.js`, `PlannerTag.js`

**Regression tests (guard against breaking existing planner):**
- TC-SA-040: Projects without close tags — verify planner works normally, no unexpected closures.
- TC-SA-041: Assignment with reports — verify close-by-tag does NOT close assignments that have reports.
- TC-SA-042: Planner employee modal — verify existing employee add/remove functionality still works alongside new tag UI.

---

## 4. Summary of Dynamic Test Cases

| ID | Area | Severity | What to Verify |
|----|------|----------|----------------|
| TC-SA-001 | DB Migration | CRITICAL | Migration on table with existing data |
| TC-SA-002 | DB Migration | CRITICAL | Migration with DEFAULT fix |
| TC-SA-003 | Vacation Events | HIGH | Month norm recalc for cross-month vacation |
| TC-SA-004 | Vacation Events | HIGH | Concurrent vacation updates — no data corruption |
| TC-SA-005 | Vacation Events | MEDIUM | Redundant events on non-date-change update |
| TC-SA-006 | Vacation Events | HIGH | Date-change update recalculates both old and new months |
| TC-SA-007 | Statistics FE | HIGH | Absences load for 50+ employees |
| TC-SA-008 | Statistics FE | HIGH | Absences load for 200+ employees |
| TC-SA-009 | Statistics FE | HIGH | Request payload size check |
| TC-SA-010 | Norm Calculation | HIGH | Pre-sync: norms use full month range |
| TC-SA-011 | Norm Calculation | HIGH | Post-sync: norms respect hire/dismiss dates |
| TC-SA-012 | Norm Calculation | HIGH | Mid-month hire: proportional norm |
| TC-SA-013 | Project Mgmt | HIGH | PM Tool close — pinned tasks handling |
| TC-SA-014 | Project API | MEDIUM | POST /projects returns 404 |
| TC-SA-015 | Admin UI | MEDIUM | Project edit form — only URL fields editable |
| TC-SA-016 | Statistic Report | MEDIUM | No duplicate (login, date) pairs in DB |
| TC-SA-017 | Vacation FE | MEDIUM | daysLimitation for new employee |
| TC-SA-018 | Vacation FE | MEDIUM | daysLimitation for maternity employee |
| TC-SA-019 | Approve FE | MEDIUM | Approve tab load time |
| TC-SA-020 | Approve FE | MEDIUM | Approve tab for 30+ employees |
| TC-SA-021 | Statistics FE | MEDIUM | Task-bound tab no unwanted absences |
| TC-SA-022 | Statistics FE | MEDIUM | General tab absences display |
| TC-SA-023 | Admin FE | MEDIUM | No missing import errors across admin forms |
| TC-SA-024 | Vacation FE | MEDIUM | Advance vacation — insufficient days error |
| TC-SA-025 | Vacation FE | MEDIUM | Advance vacation — sufficient days submit |
| TC-SA-026 | My Tasks FE | MEDIUM | Work periods — no console errors |
| TC-SA-027 | Vacation Calc | HIGH | Regular office — available days |
| TC-SA-028 | Vacation Calc | HIGH | Advance office — available days |
| TC-SA-029 | Vacation Calc | HIGH | Maternity — days across all years |
| TC-SA-030 | Vacation Calc | HIGH | Edit vacation — days calculation |
| TC-SA-031 | Vacation Calc | HIGH | Cross-year vacation calculation |
| TC-SA-032 | Norm Calc | HIGH | Mid-month hire — prorated norm |
| TC-SA-033 | Norm Calc | HIGH | Dismissed employee — norm excludes post-dismiss |
| TC-SA-034 | Norm Calc | MEDIUM | No work period data — fallback |
| TC-SA-035 | Over-report | MEDIUM | Notification threshold with effective bounds |
| TC-SA-036 | PM Tool Sync | HIGH | New project sync |
| TC-SA-037 | PM Tool Sync | HIGH | Project update sync |
| TC-SA-038 | Admin UI | MEDIUM | Project list display |
| TC-SA-039 | Admin UI | MEDIUM | Project info modal |
| TC-SA-040 | Planner | HIGH | No-tag project — planner unaffected |
| TC-SA-041 | Planner | HIGH | Close-by-tag skips reported assignments |
| TC-SA-042 | Planner | MEDIUM | Employee modal — existing functionality |
