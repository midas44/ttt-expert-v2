---
type: module
tags:
  - backend
  - statistics
  - norm-calculation
  - caching
  - scheduled-jobs
  - budget-norm
  - employee-reports
  - excess-detection
  - export
created: '2026-03-12'
updated: '2026-04-02'
status: active
related:
  - '[[ttt-report-service]]'
  - '[[frontend-statistics-module]]'
  - '[[ttt-service]]'
  - '[[exploration/tickets/statistics-ticket-findings]]'
branch: release/2.1
---
# Statistics Service Implementation

Two subsystems: Live Statistics (real-time queries) and Statistic Report (pre-computed cache table).

## Database: `ttt_backend.statistic_report`

Per-employee monthly aggregate. Unique on (report_date, employee_login).
Fields: id, employee_login, report_date (1st of month), comment, reported_effort (decimal hours), month_norm (minutes), budget_norm (minutes), created_time, last_updated_time, updated_by.

### Related table: `employee_monthly_effort`
Per-employee monthly total effort (hours). Used by the new Employee Reports page for pre-computed data instead of live calculation.

## Norm Calculation (Two Types — Critical Business Logic)

### Individual (Personal) Norm
1. Clamp date range to employee work period (effectiveBounds via `GET /v1/employees/{login}/work-periods`)
2. Fetch time-offs from vacation service: vacations + sick leaves + day-offs + maternity
3. Merge overlapping off-periods
4. totalNorm = calendar service working hours for office in period
5. personalNorm = max(0, totalNorm - offHours) → converted to minutes
6. Cached via Caffeine (TTL 5min, max 1000 entries)

**Partial-month employees** (#3356, #3353): When employee starts/leaves mid-month, the effectiveBounds calculation clamps the date range to work period dates. This means:
- Mid-month hire (e.g. starts 15th): norm calculated only for 15th-30th working days
- Mid-month termination: norm calculated only until termination date
- Multiple employment periods (rehired employees): each period calculated separately
- Pre-employment period: norm = 0/0/{totalNorm} (reported=0, individual=0, budget=totalNorm)

**Bug (#3353):** Rehired employees show previously working days in orange (My Tasks page). Pre-employment norm display should be 0/0/{totalNorm}.

**Bug (#3380):** Frontend uses incorrect API call for vacation effect on norm — vacations don't reduce personal monthly norm when they should.

### Budget Norm (Critical Distinction from Personal Norm)
Same as personal norm **except**: administrative vacations AND family-member sick leaves (#3409) are included in budgetNorm calculation. Own sick leaves are NOT included.

**Business logic:** Budget norm represents the "cost to the company" — an employee on unpaid/administrative leave is still counted in the budget, while actual sick days (own illness) are a genuine reduction.

**Calculation formula (from #3381 QA example):**
```
Monthly calendar norm:          152h
+ Day-off transfer hours:       +8h → 160h
- Own sick leave hours:         -16h → 144h (individual norm)
- Administrative vacation hours: -8h → 136h (NOT included in budget)

Budget norm = individual norm + admin vacation hours = 136 + 8 = 144h
```

**Post-Sprint 16 (#3409):** budgetNorm also includes family-member sick leave hours (new `familyMember` boolean flag on sick leave entity). Own sick leaves remain excluded from budgetNorm.

### Display Rules (Frontend — #3381, #3195)
```
// renderNormHours logic
if (budgetNorm !== individualNorm) {
    display: "{individualNorm} ({budgetNorm})"  // e.g. "136 (144)"
} else {
    display: "{budgetNorm}"                     // e.g. "152"
}
// Info icon with tooltip on "Norm" column header explains the dual display
```

## Excess / Over-Report Detection

### ExcessStatus Enum
```java
public enum ExcessStatus {
    HIGH,     // reported > budgetNorm (>0% excess)
    LOW,      // reported < budgetNorm (<0%)
    NEUTRAL,  // reported == budgetNorm (0%)
    NA        // budgetNorm == 0 (cannot calculate percentage)
}
```

### Excess formula
```
excess_percent = (reported - budgetNorm) / budgetNorm * 100
```

**Uses budgetNorm (not personalNorm) as denominator** — administrative vacation time is counted against the employee in excess calculations. Design issue: employee on admin vacation gets penalized in over-report metrics.

### Notification thresholds
From `application_settings`: `notification.reporting.under` (default −10%) and `notification.reporting.over` (default +10%).

**Bug (#3306):** "Only over the limit" switcher was broken — toggling ON didn't filter the table. Prerequisites for testing: TTT parameters `notification.reporting.under` = −10, `notification.reporting.over` = +10. Additional behavior: if user has only one menu item in Statistics, it works as a link (not dropdown).

### norm=0 Corner Cases (#3195 — Confluence 4.4.4)
| Condition | Display | Sort Order |
|-----------|---------|------------|
| norm=0, hours=0 | "0%" | Normal |
| norm=0, hours>0 | "+N/A%" | Sorted as maximum |
| norm very low, many hours | Calculated % as-is | Normal |
| excess in range (−1, +1) | 1 decimal place (e.g. "0.5%") | Normal |
| excess ≥1 or ≤−1 | Integer (e.g. "15%") | Normal |

### Color Indicators
- `reportedNotificationStatus`: LOW → `underReported` class, NEUTRAL → `normal`, HIGH/NA → `overReported`
- `reportedStatus`: HIGH/NA → up arrow, LOW → down arrow
- Thresholds from TTT parameters, NOT hardcoded

## Three Update Paths for statistic_report

| Path | Trigger | Scope | Detail |
|------|---------|-------|--------|
| Nightly sync | Cron 4:00 AM, ShedLock | Current + previous month | Full recalc for all employees; deletes removed employees |
| Task report event | @TransactionalEventListener, @Async | Single employee/month | Updates reported_effort only; creates record if missing |
| MQ (RabbitMQ) | Vacation/sick leave change | Batch of employees | INITIAL_SYNC deletes extras; VACATION_CHANGES/SICK_LEAVE_CHANGES upsert only |

### Cache Table Sync Details (#3337, #3345, #3346)

**Full sync mode:** Syncs previous year + current year. Runs once via `java_migration` table tracking (record type `STATISTIC_REPORT_INITIAL_SYNC`). Won't re-execute on restart.

**Optimized sync mode:** Syncs previous month + current month. Daily at 4 AM via cron.

**Event-driven recalculation triggers:**
- Vacation create/delete/change
- Sick leave create/delete/change
- Calendar day changes (holiday additions/removals)
- Task report create/update/delete
- Day-off rescheduling

**Sync bugs (#3345):**
- Dismissed employees had records for months AFTER termination (ghost data)
- Day-off rescheduling didn't trigger recalc (event missing)
- `reported_effort` incorrectly updated for pre-employment periods
- Key idempotency fields: `month_norm_updated_at`, `reported_updated_at`

**Vacation service calculates `month_norm`** at startup and sends to TTT service. This cross-service dependency means TTT relies on vacation service being up during sync.

## Hour Sum Consistency Problem (Systematic — 8 Tickets)

Root cause of tickets #2097, #2108, #1923, #2112, #2122, #2123, #2142, #2143:

**Problem:** `/api/ttt/v1/statistic/departments` (parent-level totals) includes fired/dismissed employees in hour sums, but `/api/ttt/v1/statistic/employees` (child-level rows) filters by `showFired` parameter. When `showFired=false` (default), parent totals include hours from fired employees, but expanding the parent shows only active employees — creating mismatches.

**Extreme examples:** 546.55 vs 803.6 (Manager projects), 205.57 vs 36.9 (Customer team).

**Test strategy:** For EVERY filter + grouping combination (13 tabs × multiple groupings), verify: sum of expanded child rows == parent total. Also test `showFired=true` to confirm consistency.

## Access Control

| Role | Scope | Notes |
|------|-------|-------|
| ADMIN, CHIEF_ACCOUNTANT | All employees | Full access |
| OFFICE_DIRECTOR | Own office employees | #1132 confirmed |
| OFFICE_ACCOUNTANT | Own office employees | |
| DEPARTMENT_MANAGER | Subordinates (department) | #3147: includes contractors |
| TECH_LEAD | Subordinates | |
| OFFICE_HR | Assigned HR employees | #3247: only their employees, not all office |
| EMPLOYEE only | Cannot access Employee Reports | |

**Permission hierarchy bug (#3298):** HR hotfix #3247 broke "search by projects" functionality — regression. Multiple overlapping permission fixes have created fragile access control logic.

## Export Features

| Endpoint | Method | Purpose | Known Bugs |
|----------|--------|---------|------------|
| CSV export (classic) | GET | Download statistics as CSV | #2191: 400 on empty params (regression) |
| CSV export (units) | GET | With hours/days unit | #1422: `units` parameter support added |
| WSR export | GET | Weekly Status Report export | #1329: endpoints added |
| Largest customers | GET | Admin-only | #2096: employees-largest-customers CSV |

**Bug (#1492):** 404 on various export endpoints — regression test needed.

## Caching
- Caffeine in-memory: reportingNorm cache (5min TTL, 1000 entries) for calendar service calls
- statistic_report table itself is persistent cache for monthly aggregates
- Race condition: No pessimistic locking between MQ events and task report events (#3337 design issue)

## Design Issues

1. **Race condition**: No pessimistic locking between MQ events and task report events — concurrent updates may lose data
2. **budgetNorm null fallback**: Falls back to monthNorm when null
3. **Excess uses budgetNorm not personalNorm**: Administrative vacation counted against employee in metrics
4. **2-month sync only**: Optimized scheduler syncs current + previous month; no historical back-fill for data corrections
5. **Hardcoded CEO login**: `CEO_LOGIN = "ilnitsky"` in BaseStatistic — bypasses normal permission checks
6. **Legacy over-report endpoint**: `/v1/task-reports/employees-over-reported` — N+1 pattern, superseded by cache table but still accessible
7. **Resilience4j bulkhead**: Live statistics path rate-limits concurrent DB queries — can cause timeouts under heavy load

Links: [[ttt-report-service]], [[frontend-statistics-module]], [[ttt-service]]


## Code-Level Details (Session 97 — Codebase Investigation)

### budgetNorm Calculation — Actual Code

**File:** `ttt/service/service-impl/.../InternalReportingNormService.java`

```java
public Long calculateBudgetNorm(
    final EmployeeOfficeModel employeeOffice,
    final EmployeeBO employee,
    final LocalDate startDate,
    final LocalDate endDate,
    final EmployeeTimeOffModel employeeTimeOffs
) {
    // Key: filters OUT administrative vacations (they DON'T reduce budget norm)
    final List<VacationTimeOffItemModel> vacations = filterNonAdministrativeVacations(
        employeeTimeOffs.getVacations()
    ).stream().filter(it -> isDatesBetween(it, startDate, endDate)).toList();

    final List<EmployeeTimeOffItemModel> sickLeaves = employeeTimeOffs.getSickLeaves()
        .stream()
        .filter(it -> isDatesBetween(it, startDate, endDate))
        .toList();
    
    return calculatePersonalNorm(employeeOffice, employee, startDate, endDate, 
        new EmployeeTimeOffModel(vacations, sickLeaves, dayOffs));
}

private List<VacationTimeOffItemModel> filterNonAdministrativeVacations(
    final List<VacationTimeOffItemModel> vacations
) {
    return vacations.stream()
        .filter(vacation -> vacation.getPaymentType() != VacationPaymentTypeModel.ADMINISTRATIVE)
        .toList();
}
```

**Key insight:** `budgetNorm` and `personalNorm` use the SAME `calculatePersonalNorm()` method — the difference is that budgetNorm passes vacations with administrative ones filtered OUT (so they don't reduce the norm), while personalNorm passes ALL vacations. The sync service calls `report.setBudgetNorm(budgetNorm)` in `StatisticReportSyncServiceImpl.java`.

### effectiveBounds — Partial-Month Norm Clamping

**File:** `ttt/service/service-impl/.../TaskReportSummaryServiceImpl.java`

```java
private Pair<LocalDate, LocalDate> effectiveBounds(final long employeeId,
                                                    final LocalDate rangeStart,
                                                    final LocalDate rangeEnd) {
    return employeeWorkPeriodRepository.findPeriodForRange(employeeId, rangeStart, rangeEnd)
        .map(period -> Pair.of(
            TimeUtils.max(rangeStart, period.getPeriodStart()),
            period.getPeriodEnd() == null
                ? rangeEnd                                      // Still employed
                : TimeUtils.min(rangeEnd, period.getPeriodEnd())))
        .orElse(Pair.of(rangeStart, rangeEnd));                // No period found → use full range
}
```

**Business logic:** `employeeWorkPeriodRepository.findPeriodForRange()` queries `ttt_vacation.employee_period` table. If employee starts mid-month (e.g., starts on 15th), the effective range becomes [15th, end-of-month]. If employee has no work period record (e.g., old data), falls back to full range — which can cause incorrect norms for terminated employees.
