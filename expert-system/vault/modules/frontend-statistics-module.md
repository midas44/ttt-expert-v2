---
type: module
tags:
  - frontend
  - statistics
  - react
  - redux
  - rtk
  - react-query
  - employee-reports
  - budget-norm
  - norm-calculation
  - permissions
  - export
  - wsr
created: '2026-03-12'
updated: '2026-04-02'
status: active
related:
  - '[[statistics-service-implementation]]'
  - '[[frontend-app]]'
  - '[[ttt-report-service]]'
  - '[[exploration/tickets/statistics-ticket-findings]]'
branch: release/2.1
---
# Frontend Statistics Module

Two parallel sub-systems within modules/statistics/:

## Sub-system A — Classic Statistics (`/statistics/general`)

Legacy hierarchical tree-table. connect() HOC + class-based reducers. JavaScript only.

### Component Tree
```
StatisticsPage
  ├── StatisticsFiltersPanel
  │     ├── SearchMultiFilterContainer (entity search)
  │     ├── TabsWithFiltersContainer (13 role-gated tabs via rc-tabs)
  │     ├── SelectDateContainer (date range + period presets)
  │     ├── ListTypeRadioGroupContainer (hours/days toggle)
  │     └── EffortTypeRadioGroupContainer
  ├── TableControls (export dropdown, refresh)
  ├── StatisticsTableContainer (rc-table tree-table with lazy child expansion)
  ├── TaskDetails (slide-in panel)
  └── TaskRename (inline dialog)
```

### Permission-Gated Tabs (13)
VIEW_MY_TASKS → MY_TASKS, VIEW_MY_PROJECTS → MY_PROJECTS + EMPLOYEES_IN_MY_PROJECTS, VIEW_MY_DEPARTMENT → DEPARTMENT tabs, VIEW_MY_OFFICE → OFFICE tabs, VIEW_MANAGER_OFFICE → OFFICE tabs, VIEW_PROJECT → PROJECT tabs, VIEW_CUSTOMER → CUSTOMER tabs, etc.

**Bug (#1175):** Outdated tabs — stale data displayed before permissions fully loaded. Tab auto-selection code (`statisticsPermissionsTabName`) is mostly commented out → `currentTab=null` on first load.

### State: `state.statistics` (persisted via redux-persist)
- permissions (role array), filters (dates, search values, current tab), uiFilters (sort, effort type, expanded keys), data (parent/child nodes, task details)

**Bug (#2366):** "No data" notification persists after filter removal — state not cleared properly.

### Hour Sum Consistency (8 Tickets — Systematic Root Cause)
Parent-level totals from `/api/ttt/v1/statistic/departments` include fired employees. Expanding a parent node fetches `/api/ttt/v1/statistic/employees` which filters by `showFired` parameter (default false). Result: parent total ≠ sum of visible children. See [[statistics-service-implementation]] for full analysis.

### Search / Filtering
- `SuggestionMappingUtil.correctLayout()` handles wrong keyboard layout (#298)
- URL search params supported for task name filter (#2624)
- **Bug (#3298):** "Search by projects" broke after HR hotfix #3247 — regression from overlapping permission changes

### Export (Classic)
Export dropdown: CSV download for the current view. Known issues:
- #2191: 400 error when params empty (regression)
- #1492: 404 on some export endpoints (regression)
- #1422: `units` parameter (hours/days) support added
- #2096: Admin-only `employees-largest-customers` CSV export

### WSR (Weekly Status Report) View
Tree-view display of weekly status reports. **5 open bugs:**
- #3030: Layout broken in WSR tree view
- #3041: Task branches don't collapse
- #3144: Update tickets shows wrong period data
- #3289: 6+ sub-issues — WSR lists always open, tree view disabled, update button logic wrong, tooltip translation, button breaks list, unnecessary top-level node
- #2334: Project names in task names break PM export scripts

## Sub-system B — Employee Reports (`/statistics/employee-reports`)

Newer flat tabular view. RTK createAction/createReducer + React-Query for comments. TypeScript.

### Component Tree
```
EmployeeReportsContainer
  └── EmployeeReportsPage
        ├── Filters (employee search, month picker, over-limit toggle)
        └── ReportsTable
              ├── ManagerFilter (filterable column header — #3309)
              ├── EmployeeRow (expand + staff link + AbsencesIcon + nav link)
              ├── ProjectRow (on expand)
              ├── ManagerRow (staff link)
              └── CommentField (inline textarea, save on blur — #3309)
```

### State: `state.employeeReports` (not persisted)
- reports, isLoadingReports, params (startDate, endDate, employee, exceedingLimit, sort, order, managersLogin), projectBreakdown per employee

### Employee Reports Page — Feature Details (#3195, #3309, Sprint 13-14)

**Column layout (after #3309):**
| Column | Content | Notes |
|--------|---------|-------|
| Employee | Name (CS link on click), AbsencesIcon on row | White background, bold only for metrics columns |
| Manager | Name (CS link), header has dropdown filter (#3309) | New column added Sprint 14 |
| Reported | Hours reported | Bold |
| Norm | `{individualNorm} ({budgetNorm})` or just `{budgetNorm}` | Bold, info icon tooltip |
| Excess | `{percent}%` with directional arrow | Bold, color-coded (under/over/neutral) |
| Comment | Inline textarea | Click to edit, Tab/click-outside to save, Enter = newline (#3309) |

**Over-limit toggle (#3306):**
- Filters employees whose excess exceeds configured thresholds
- Prerequisites: TTT parameters `notification.reporting.under` and `notification.reporting.over`
- **Bug:** Toggle ON didn't filter the table (hotfix Sprint 13)
- If user has only one Statistics menu item, menu works as direct link (not dropdown)

**Employee row expand:**
- Click employee → shows ProjectRow breakdown per project
- Each ProjectRow shows: project name, reported hours, percentage of employee total

### Employee Reports — Known Bugs (19 from #3195 QA)
1. No dynamic text filtering in searchbar (unlike Classic Statistics)
2. "Only over limit" toggle broken (#3306 — fixed)
3. Report icon not shown on hover
4. Employee name click opens report page (should open CS page)
5. Notification thresholds not applied — everything above 0% was red
6. Default month: should be latest open for approval (not current month)
7. norm=0, hours>0 → should show "+N/A%", not "0.00%"
8. Percentage decimal: 1 decimal place for (−1, +1) range, integer otherwise
9. No English translation for "Only overage" switch
10. **Font size 14px instead of required 13px** (#3309 QA)
11. **Column title typo:** "Превышение" should be "Превышения" (#3309 QA)
12. **Comments incorrectly aggregated at task level** — only employee-level comments required (#3309)

### Employee Reports — Future Employee Exclusion (#3320)
- Employees not yet hired appeared with false underreport percentages
- Root cause: `ttt_backend.employee.last_date` not updated since 2023; differs from `ttt_vacation.employee_period`
- Fix: filter using `ttt_vacation.employee_period` dates
- Employee search API changed to `GET api/vacation/v1/statistic/report/employees`

### Comment Field (Inline CRUD — #3309)
- API: `GET /v1/statistic/report` returns existing comment, `POST /v1/statistic/report` saves/updates
- Per employee per month granularity
- Click textarea to edit, Tab or click outside to save
- Enter key inserts newline (NOT save)
- **No auto-save on tab close** — data lost if browser tab closed during editing
- Comments are stored in `statistic_report.comment` column

### budgetNorm Display Rules (#3381, #3409)
```javascript
// renderNormHours in ReportsTable
function renderNormHours(individualNorm, budgetNorm) {
  if (budgetNorm !== individualNorm) {
    return `${individualNorm} (${budgetNorm})`; // e.g. "136 (144)"
  }
  return `${budgetNorm}`; // e.g. "152"
}
// Info icon + tooltip on "Norm" column header
```

## Absence Icons (AbsencesIcon)
Displayed inline on employee rows in both sub-systems. Two icons: IconSick (sick leaves), IconVacation (vacations). Tooltip shows breakdown: total hours + individual periods with dates, status, payment type. Hours/days unit from effortDisplayType setting.

## API Endpoints

### Classic Statistics (6)
- `GET /v1/statistic/permissions` — role-gated tab permissions
- `GET /v1/statistic/employees` — employee data (with `showFired` param)
- `GET /v1/statistic/employees/tasks` — tasks per employee
- `GET /v1/statistic/tasks` — task-level data
- `GET /v1/statistic/projects` — project-level data
- `GET /v1/statistic/departments` — department-level totals
- Export links (CSV, WSR)

### Employee Reports (6)
- `GET /v1/statistic/report/employees` — employee list with norm/excess
- `GET /v1/statistic/report/projects` — project breakdown per employee
- `GET /v1/statistic/report` — comments (read)
- `POST /v1/statistic/report` — comments (save/update)
- `POST /api/vacation/v1/statistic` — absence data (vacations)
- `POST /api/vacation/v1/statistic/report/sick-leaves` — sick leave data

Both sub-systems call vacation service independently for absence data — no deduplication.

## Norm Calculation Bugs (Cross-Page Impact)

| Ticket | Page Affected | Issue |
|--------|--------------|-------|
| #3353 | Employee Reports | Pre/post-employment norm display wrong for rehired employees |
| #3356 | Employee Reports | Partial-month employees need effectiveBounds clamping |
| #3380 | Employee Reports | Vacations don't reduce personal monthly norm (wrong API call) |
| #3381 | Employee Reports | budgetNorm calculation added (admin vacation hours) |
| #3409 | Employee Reports | budgetNorm includes family-member sick leaves (Sprint 16) |

## Permission Matrix (Complex — 8 Roles × Tabs × Data)

| Role | Classic Tabs | Employee Reports | Export |
|------|-------------|-----------------|--------|
| ADMIN | All 13 tabs | All employees | All |
| CHIEF_ACCOUNTANT | All 13 tabs | All employees | All |
| OFFICE_DIRECTOR | Office tabs | Own office | Office |
| OFFICE_ACCOUNTANT | Office tabs | Own office | Office |
| DEPARTMENT_MANAGER | Department tabs | Subordinates (incl. contractors #3147) | Department |
| TECH_LEAD | Department tabs | Subordinates | Department |
| OFFICE_HR | HR-assigned tabs | Own assigned employees only (#3247) | HR scope |
| PROJECT_MANAGER | Project tabs | N/A | Project |

**Bug (#3247):** HR managers previously saw ALL employees in statistics — fixed to show only their assigned employees. This fix then caused regression #3298 (search by projects broke).

## Technical Debt (12 items)
1. **Split patterns**: Legacy connect+reducers vs RTK+React-Query in same module
2. **Partial TypeScript**: Employee Reports in TS, classic in JS
3. **Broken tab auto-selection**: statisticsPermissionsTabName mostly commented out → currentTab=null
4. **Hardcoded CompanyStaff URL**: `https://companystaff.noveogroup.com/profile/`
5. **processStatisticsData overwrites**: Only keeps last absence record per employee (childNodeList has individuals)
6. **getExpandedRowKeysForData bug**: Checks length===0 then iterates empty array (no-op)
7. **handleRemovingProcessingParent bug**: splice() receives item not index from find()
8. **Dual vacation/sick-leave API calls**: Both sub-systems fetch independently, no deduplication
9. **CommentField saves on blur only**: No auto-save, data lost on tab close
10. **projectBreakdown in local state**: Re-fetched on every navigation
11. **Stale filter persistence**: redux-persist preserves filters across sessions → confusion
12. **React element in Redux action**: FiltersError renders JSX inside saga put() — non-serializable

Links: [[statistics-service-implementation]], [[frontend-app]], [[ttt-report-service]], [[exploration/tickets/statistics-ticket-findings]]


## Confluence Requirements — Employee Reports Page (#3195)
*Source: Confluence page 119244531 "Statistics / Статистика", version 27*

### Menu Structure
- Regular users: "Statistics" menu without submenu, page shown without heading
- Privileged roles: "Statistics" → submenu: "General Statistics" + "Employee Reports"
  - Pages shown with headings matching submenu items
  - Roles with submenu access:
    - ADMIN — all employees
    - CHIEF_ACCOUNTANT — all employees
    - OFFICE_ACCOUNTANT — employees of own salary offices only
    - DEPARTMENT_MANAGER — employees of own department only
    - TechLead — own subordinates only

### General Statistics Page Changes
1. Fix padding inside Filter block (pin "Reset all filters" button-link)
2. Date range filter: use N-dash (–)
3. Align padding above/below "Update data" and "Export" buttons
4. Column header: "Сотрудник / проект / задача" — add spaces
5. Translation fix: "За период" = "For period" (currently breaks EN header layout)
6. #2435: Sick leave icon + tooltip (show only period within selected range; absence may be longer; N-dash in date range)

### Employee Reports Page — Full Specification

**Search field (III.1):**
- Table updates as user types (live search)
- Search by: first name, last name (Latin + Cyrillic), login
- Including wrong keyboard layout matching

**Date picker (III.2):**
- Default: last month open for confirmation in user's salary office
- Selects month granularity

**Over-limit toggler (III.3):**
- When ON: show only employees with reported > or < threshold parameters (from Admin > TTT Parameters)

**Data table columns (III.4):**

| Column | Key Behavior |
|--------|-------------|
| Employee (4.1) | Name links to CS page. Vacation/sick leave icons with tooltip (dates within period). Report icon on hover → links to employee report page. Row click → accordion with per-project breakdown (sorted by hours desc) |
| Manager (4.2) | Manager name with CS link. Has filter. |
| Reported (4.3) | Sum of reported hours. Red arrow up for over-report. Purple arrow down for under-report. Red text if excess > `notification.reporting.over` param. Purple text if excess < `notification.reporting.under` param. |
| Norm (4.4) | Budget norm. Info icon with tooltip. See budgetNorm calculation below. |
| Excess (4.5) | `(Reported - budgetNorm) / budgetNorm * 100%`. Integer display except (-1;+1) range → 1 decimal. Color coding per threshold params. |
| Comment (4.6) | Inline edit like My Tasks. Enter = new paragraph. Tab/click-outside = exit edit. Stored per employee per month. |

**BudgetNorm Calculation (4.4.2, updated by #3409):**
```
Nb = Ni + admin_vacation_working_hours + familyMember_sickleave_working_hours
```
Where:
- `Ni` = individual norm (working hours in production calendar minus own vacation/own sick leave hours)
- `admin_vacation_working_hours` = working hours falling on administrative (unpaid) vacation days
- `familyMember_sickleave_working_hours` = working hours falling on family member sick leave days (#3409)

**Norm Display Cases (4.4.3):**
- **Case 1** (has admin vacation OR family sick leave): `{individualNorm} ({budgetNorm})`
- **Case 2** (has regular vacation OR own sick leave, but NOT admin/family): `{budgetNorm}` (equals individualNorm)
- **Case 3** (no absences): `{budgetNorm}` (equals general office norm)

**Excess Corner Cases (4.5.5):**
- Very low norm due to absences + high reported hours → show actual percentage even if very large
- norm=0 AND reported=0 → 0%
- norm=0 AND reported>0 → +N/A% (maximum in sort order, displayed at top of list)

**Excess Behavior Notes (4.5.6, from #3381):**
- Employee works during regular vacation/own sick leave → over-report
- Employee doesn't work during admin vacation and doesn't overwork other days → under-report

**Sorting (4.7):** By excess percentage descending (highest over-report at top)

**Displayed Users (4.8):**
- All users active in selected month
- Fired last month: shown in last month, hidden in current month
- TBD Sprint 15 (#3353, #3356): handling of partial-month employees (hired mid-month or dismissed mid-month)
- Role-based filtering same as menu access (ADMIN=all, OFFICE_ACCOUNTANT=own offices, etc.)

**Admin Parameters (4.9):**
- `notification.reporting.over` — over-report threshold
- `notification.reporting.under` — under-report threshold
- Must be configured on test envs and prod before release
