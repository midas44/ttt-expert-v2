---
type: exploration
tags:
  - statistics
  - tickets
  - bugs
  - employee-reports
  - norm-calculation
  - export
  - wsr
  - permissions
created: 2026-04-02T00:00:00.000Z
updated: 2026-04-02T00:00:00.000Z
status: active
related:
  - '[[frontend-statistics-module]]'
  - '[[statistics-service-implementation]]'
  - '[[statistics-caffeine-caching-performance-3337]]'
  - '[[statistics-effective-bounds-norm]]'
  - '[[statistics-ui-deep-exploration]]'
branch: release/2.1
---

# Statistics Module — GitLab Ticket Findings

**Source:** ~180+ unique tickets mined across multiple keyword searches (statistic, norm, export, статистик, норм, WSR, employee report, overreport, effective bounds).

## Tier 1 — Employee Reports Page (Sprint 13-16, Active Development)

### #3409 [OPEN] Update budgetNorm calculation for sick leave type (Sprint 16)
- After splitting sick leaves into own vs. family member types (#3408), `budgetNorm` calculation changes
- Administrative vacations AND family-member sick leaves included in budgetNorm
- Own sick leaves NOT included in budgetNorm
- API: `GET /api/ttt/v1/statistic/report/employees` returns `budgetNorm` field
- UI tooltip text changes; format: `{individualNorm} ({budgetNorm})` when values differ
- **Test cases:** budgetNorm calc with different sick leave types, tooltip format toggling

### #3381 [CLOSED] Additional norm including administrative vacation hours (Hotfix Sprint 14)
- Added `budgetNorm` = individualNorm + administrative vacation hours
- Excess % uses budgetNorm as denominator
- API response example: `{"login":"dkolesnikov", "reported":16.0, "norm":128, "budgetNorm":144, "excess":-89, "reportedStatus":"LOW"}`
- **UI format rules:**
  - budgetNorm != individualNorm → show `{individualNorm} ({budgetNorm})`
  - budgetNorm == individualNorm → show just `{budgetNorm}`
  - Info icon with tooltip on "Norm" column header
- **QA example:** Monthly norm=152h, +8h dayoff transfer=160h, −16h sick leave=144h, −8h admin vacation=136h individual. Budget=144h (adds back admin vacation 8h)
- **Test cases:** budgetNorm calculation; conditional display format; tooltip content

### #3356 [OPEN] Individual norm for partial-month employees (Sprint 15)
- When employee starts/leaves mid-month, individualNorm (and budgetNorm) adjusted for working days only
- API: `GET /api/ttt/v1/employees/{login}/work-periods` returns array of `{periodStart, periodEnd}` pairs
- QA noted API changed from employeeId to login parameter
- **Test cases:** norm for mid-month hires, mid-month terminations, multiple employment periods

### #3309 [CLOSED] Add DM and Comment fields (Sprint 14)
- **UI changes:**
  - White background (was grey) for employee rows
  - Bold only for Reported, Norm, Excess columns
  - New "Manager" column with CS link + header filter
  - "Excess" renamed from "Percent exceeded"
  - New "Comment" column: inline editing (click to edit, tab/click-outside to save, Enter=newline)
  - Comments per employee per month
- **Bugs found during testing:**
  - Font size 14px instead of required 13px
  - Column title typo: "Превышение" should be "Превышения"
  - Comments incorrectly aggregated at task level → only employee-level comments required
- **Test cases:** comment CRUD, format verification, manager link/filter

### #3320 [CLOSED] Employee reports includes future employees (Sprint 14)
- Employees not yet hired appear with false underreport percentages
- Root cause: `ttt_backend.employee.last_date` not updated since 2023; differs from `ttt_vacation.employee_period`
- Fix: filter using `ttt_vacation.employee_period` dates; employee search now uses `GET api/vacation/v1/statistic/report/employees`
- **Test cases:** future employee exclusion, dismissed employee filter

### #3306 [CLOSED] "Only over the limit" switcher broken (Hotfix Sprint 13)
- Toggle ON doesn't filter the table
- Prerequisites: TTT parameters `notification.reporting.under` = −10, `notification.reporting.over` = +10
- Additional fix: if user has only one menu item in Statistics, it works as link (not dropdown)
- **Test cases:** switcher filtering with configurable thresholds, menu behavior

### #3195 [OPEN] Employee Reports page — original feature ticket (Sprint 13)
- **19 bugs found during testing:**
  1. No dynamic text filtering in searchbar (unlike General Statistics)
  2. "Only over limit" toggle broken (#3306)
  3. Report icon not shown on hover
  4. Employee name click opens report page (should open CS page)
  5. Notification thresholds not applied — everything above 0% was red
  6. Default month: latest open for approval (not current month)
  7. norm=0, hours>0 → show "+N/A%" (not "0.00%")
  8. Percentage decimal: 1 decimal place for values in (−1, +1), integer otherwise
  9. No English translation for "Only overage" switch
- **Corner cases (Confluence 4.4.4):**
  - norm very low but many hours → show calculated % as-is
  - norm=0, hours=0 → show 0%
  - norm=0, hours>0 → show "+N/A%", sort as maximum
- **APIs:** `ttt/api/v1/statistic/report/employees`, `ttt/api/v1/statistic/report/projects`, `vacation/api/v1/statistic/report/sick-leaves`
- **Test cases:** ALL corner cases, API responses, UI states

## Tier 2 — Statistic Report Cache (Sprint 15)

### #3337 [OPEN] Performance cache table (Sprint 15)
- New table `ttt_backend.statistic_report` with `reported_effort` and `month_norm` columns
- New table `employee_monthly_effort` for total monthly effort per employee
- Sync modes: Full (prev+current year) and Optimized (prev+current month, daily at 4AM)
- Events triggering recalculation: vacation create/delete, calendar changes, task report events
- **Test cases:** cache vs live data consistency, sync after events, performance

### #3345 [OPEN] Synchronization for statistic_report (Sprint 15)
- Vacation service calculates month_norm at startup, sends to TTT service
- **Bugs found:** dismissed employees had records for months after termination, day-off rescheduling didn't trigger recalc, `reported_effort` not updated for pre-employment periods
- Key fields: `month_norm_updated_at`, `reported_updated_at` (idempotent updates)
- **Test cases:** sync correctness, dismissed employee handling, event-driven updates

### #3346 [OPEN] Execute initial sync only once (Sprint 15)
- `ttt_vacation.java_migration` table tracks sync execution
- Record type `STATISTIC_REPORT_INITIAL_SYNC` prevents re-execution on restart
- **Test cases:** runs once, restart skips, cron schedule works

## Tier 3 — Hour Sum Consistency (Systematic Issue)

**8 related tickets** about parent-child hour mismatches across grouping levels:
- #2097 — "My Projects" filter: HR project hours mismatch by departments
- #2108 — "Employees on my projects": department hours ≠ sum of employees
- #1923 — "Department projects" / "Office projects": sum > project total
- #2112 — "Manager projects": extreme mismatch (546.55 vs 803.6)
- #2122 — "Project team": hours don't match (81.25 vs 78.75)
- #2123 — "Employees on manager projects": mismatch (984.55 vs 981.05)
- #2142 — "Customer projects": mismatch (20.6 vs 10.3)
- #2143 [CLOSED] — "Customer team": extreme mismatch (205.57 vs 36.9)

**Root cause:** `/api/ttt/v1/statistic/departments` includes dismissed employees, but `/api/ttt/v1/statistic/employees` filters by `showFired` parameter. Parent totals include fired employee hours; expanded child list doesn't show them.

**Test cases:** hour sum consistency across ALL filter+grouping combinations; showFired parameter behavior

## Tier 4 — WSR View Bugs

| Ticket | Status | Issue | Test Priority |
|--------|--------|-------|---------------|
| #3030 | OPEN | Layout issue in WSR tree view | Medium |
| #3041 | OPEN | Task branches don't collapse | Medium |
| #3144 | OPEN | Update tickets shows wrong period data | High |
| #3289 | OPEN | 6+ sub-issues: WSR lists always open, tree view disabled, update button logic wrong, tooltip translation, button breaks list, unnecessary top-level node | High |
| #2334 | OPEN | Project names in task names break PM export scripts | Medium |

## Tier 5 — Export Features

| Ticket | Status | Issue | Test Priority |
|--------|--------|-------|---------------|
| #2191 | CLOSED | 400 error on CSV export (empty params) | High (regression) |
| #1492 | CLOSED | 404 on various export endpoints | High (regression) |
| #1422 | CLOSED | `units` parameter support (hours/days) | Medium |
| #1329 | CLOSED | WSR export endpoints added | Medium |
| #2096 | CLOSED | Admin-only export: employees-largest-customers CSV | Low |

## Tier 6 — Permissions and Access Control

| Ticket | Status | Issue | Test Priority |
|--------|--------|-------|---------------|
| #3247 | CLOSED | HR managers see only their employees' statistics | High |
| #1132 | CLOSED | OFFICE_DIRECTOR full statistics access | Medium |
| #1154 | CLOSED | Wrong permissions for OFFICE_DIRECTOR/ACCOUNTANT search | Medium |
| #3147 | CLOSED | DM access to contractor statistics | Medium |
| #1053 | CLOSED | Separate departments by contractor flag; "(Subcontract)" suffix | Medium |
| #3298 | CLOSED | Search by projects broke after HR hotfix #3247 — **regression** | High |

## Tier 7 — Norm Calculation (Cross-cutting)

### #3353 [OPEN] Exclude pre/post-employment from individual norm (Sprint 15)
- Formula: individual norm = working hours only within employment period
- API: `GET /v1/employees/{login}/work-periods`
- **Bugs:** rehired employees show previously working days in orange; pre-employment norm should be 0/0/{totalNorm}
- **Test cases:** mid-month hires, rehired employees, pre-employment display

### #3380 [OPEN] Vacations don't affect personal monthly norm (Sprint 15)
- Frontend uses incorrect API call
- **Test cases:** norm reduction after vacation creation

## Tier 8 — UI/UX Bugs

| Ticket | Status | Issue |
|--------|--------|-------|
| #2366 | OPEN | "No data" notification persists after filter removal |
| #1175 | OPEN | Outdated tabs: stale data before permissions loaded |
| #2536 | CLOSED | First element auto-expanded in "Tasks by employees" |
| #2720 | CLOSED | Russian names not shown in employee popup (RU version) |
| #565 | CLOSED | Memory leak on display/date filter change |
| #2716 | OPEN | Error on "Refresh data" click |
| #1172 | CLOSED | "Total" column incorrectly depends on period filter |

## Tier 9 — Search and Filtering

| Ticket | Status | Issue |
|--------|--------|-------|
| #2624 | CLOSED | Task name via URL search params |
| #2341 | CLOSED | URL filter values not working |
| #298 | CLOSED | Search with wrong keyboard layout |
| #3298 | CLOSED | Search by projects broke after HR hotfix |

## Summary — Top Test-Worthy Findings

1. **Employee Reports page** — flagship feature with most active development. budgetNorm calc, partial-month norm, over-limit switcher, norm=0 corner cases, comment field inline editing, manager column
2. **Hour sum consistency** — 8 tickets, root cause is fired employee inclusion/exclusion inconsistency
3. **Cache table sync** — `statistic_report` table correctness after events, dismissed employees, day-off rescheduling
4. **Export** — 400/404 errors, units parameter, all endpoint combinations
5. **Permission matrix** — ADMIN, OFFICE_DIRECTOR, OFFICE_ACCOUNTANT, CHIEF_ACCOUNTANT, DM, HR, TECH_LEAD, OBSERVER roles × tabs × data
6. **WSR view** — 5 open bugs with multiple sub-issues
7. **Norm calculation** — partial month, pre/post-employment, vacation effect, rehired employees


## Sprint 15-16 Updates (Session 98)

### #3409 — budgetNorm calculation update for sick leave types (Sprint 16, To Do)
- After #3408 (familyMember flag), update budgetNorm to differentiate own sick leave vs family member sick leave
- Formula update: `Nb = Ni + admin_vacation_hrs + familyMember_sickleave_hrs`
- Own sick leave (`familyMember=false`) IS deducted from norm (reduces individual norm)
- Family member sick leave (`familyMember=true`) is NOT deducted — added to budgetNorm like admin vacations
- Must update tooltip text on Employee Reports page
- BudgetNorm must be passed via API to STT (v1/statistic/report/employees)
- Depends on #3408

### #3411 — BudgetNorm to API (closed, HF Sprint 15)
- Adds BudgetNorm to `v1/employees-periods` API endpoint
- UPD: STT will use `v1/statistic/report/employees` instead
- Already deployed

### #3356 — Individual norm for partial-month employees (Sprint 15, open)
- After #3353 (exclude pre/post employment from norm)
- Individual norm corrected for hours when employee wasn't yet hired (first month) or after last working day (dismissal month)
- Budget norm inherits this correction

### #3380 — Bug: Vacations don't affect personal monthly norm (Sprint 15, Production Ready)
- On qa-2: creating paid/unpaid vacation should decrease monthly norm on My Tasks and Employee Reports
- Bug: norm stays the same — vacations not reflected
- Affects both My Tasks page and Employee Reports page

### #3368 — Bug: Over/under report notification missing on Confirmation By Employee (Sprint 15)
- "Confirmation > By Projects" calls `ttt/v1/statistic/report/employees` API, shows notification
- "Confirmation > By Employee" does NOT call this API → notification missing
- Frontend bug — missing API call integration
- Cross-cutting: statistics API used on non-statistics page

### #3400 — Statistics norm export by individual calendar (Sprint 15, Production Ready)
- Simple CSV export: login, name, surname, department_manager_login, salary_office, individual_norm

### #3337 — Performance optimization for Employee Report page (Sprint 15, open)
- Optimization work for the Employee Reports page loading speed

### #3345/3346 — statistic_report sync optimization (Sprint 15)
- Populate statistic_report table via sync
- Execute sync only once using java_migration table
