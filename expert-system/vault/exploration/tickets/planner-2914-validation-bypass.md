---
type: exploration
tags: [planner, validation, hours-limit, bug, data-integrity, ticket-2914]
created: 2026-03-28
updated: 2026-03-28
status: active
related: ["[[planner-module]]", "[[planner-data-model]]", "[[t2724-investigation]]"]
branch: release/2.1
---
# Ticket #2914 — Daily Hours Validation Bypass (>36h/day)

## Summary

The TTT system has a configurable daily report limit of **36 hours** (`ttt.daily-report-limit: 36h` in `application.yml`). However, this limit is enforced only as **warnings, not hard blocks**. An employee can report >36h/day by splitting hours across multiple projects.

## Validation Architecture

### Two Parallel Systems (Both Warning-Only)

**A. Global (Employee-wide) Validation**
- **File:** `TaskReportWarningCommand.java`
- **Method:** `findDaysWithExceededLimit()`
- **Scope:** Total hours across ALL projects for employee on date
- **SQL:** `SELECT executor, SUM(actual_efforts) FROM task_report WHERE report_date > :sinceDate AND executor = :employeeId GROUP BY report_date HAVING SUM(actual_efforts) > :dailyReportLimit`
- **Warning type:** `TaskReportWarningType.DATE_EFFORT_OVER_LIMIT`
- **Exposed via:** `GET /employee/current/warnings` (display only)

**B. Per-Project Validation**
- **File:** `ProjectWarningCommand.java`
- **Method:** `findDaysWithExceededLimitByProjectId()`
- **Scope:** Hours within a SINGLE project on date
- **SQL:** `SELECT executor, SUM(actual_efforts) FROM task_report tr JOIN task t ON t.id = tr.task WHERE t.project = :projectId AND tr.report_date = :date GROUP BY tr.executor HAVING SUM(actual_efforts) > :dailyReportLimit`
- **Warning type:** `ProjectWarningType.EMPLOYEE_DATE_EFFORT_OVER_LIMIT`
- **Exposed via:** `GET /project/{projectId}/warnings`

### The Bypass

The per-project validation is **insufficient** because:
1. Employee reports 20h in Project A → per-project check: 20h < 36h ✓
2. Employee reports 20h in Project B → per-project check: 20h < 36h ✓
3. **Total: 40h on same day** → only caught by global warning, which doesn't block

### No Hard Validation on Submission

**File:** `TaskReportServiceImpl.java` (lines 431-447)
```java
private void validate(TaskReport taskReport, TaskReportBO taskReportBO,
                      TaskReportUpdateEffortBO updateEffort,
                      TaskReportUpdateStateBO updateState) {
    // ONLY checks PERMISSIONS (EDIT/APPROVE)
    // Does NOT check daily hour limits
    if (testFillEffortsRequired(taskReport, updateEffort)) {
        taskReportPermissionService.validate(taskReportBO, TaskReportPermissionType.EDIT);
    }
    if (testFillStateRequired(taskReport, updateState)) {
        // Permission checks only...
    }
}
```

**No frontend validation** for max hours per day found in planner modules.

## Validation Summary Table

| Layer | Validation | Type | Scope | Blocks Submission? |
|-------|-----------|------|-------|-------------------|
| Frontend | None found | — | — | No |
| Backend (submission) | Permission only | Hard | Per-report | No (no hour check) |
| Backend (warning) | Global daily | Soft | All projects | No (warning only) |
| Backend (warning) | Per-project | Soft | Single project | No (warning only) |

## Configuration

```yaml
# application.yml line 157
ttt:
  daily-report-limit: 36h  # Duration, converted to 2160 minutes for SQL
```

## Impact

- **Data integrity risk:** Employees can report unrealistic hours (e.g., 60h in a day)
- **Accounting impact:** Over-reported hours affect project budgets and billing
- **Detection:** Only post-hoc via warnings displayed in UI — no prevention

## Test Cases to Generate

1. Report exactly 36h across multiple projects → verify warning appears
2. Report >36h total split across 2+ projects → verify no blocking, warning appears
3. Report exactly 36h in single project → verify per-project warning
4. Report 0.5h when daily total already at 35.5h → verify behavior
5. Check warning display on both employee dashboard and project warnings page
6. Verify `daily-report-limit` config value is respected
7. Edge: report via API vs. planner UI — same behavior?