---
type: exploration
tags: [accounting, ui-flow, selectors, phase-c-ready]
created: 2026-03-28
updated: 2026-03-28
status: active
related: ["[[accounting-service-deep-dive]]", "[[frontend-accounting-module]]"]
branch: release/2.1
---

# Accounting Pages — UI Structure (QA-1, session 94)

## Accounting Menu (Dropdown)
Menu button: `button "Accounting"` in main nav bar
Sub-pages:
1. **Salary** → `/admin/salary`
2. **Changing periods** → `/admin/offices`
3. **Vacation money payment** → `/vacation/payment`
4. **Correction of vacation days** → `/vacation/days-correction`
5. **Sick leave records** → `/accounting/sick-leaves`

```
// Accounting dropdown
page.getByRole('button', { name: 'Accounting' })
page.getByRole('link', { name: 'Salary' })
page.getByRole('link', { name: 'Changing periods' })
page.getByRole('link', { name: 'Vacation money payment' })
page.getByRole('link', { name: 'Correction of vacation days' })
page.getByRole('link', { name: 'Sick leave records' })
```

---

## 1. Salary Page (`/admin/salary`)

### Search & Filters
- `textbox "Search by employee / salary office"` — with search icon
- Tab toggle: `button "Employee"` / `button "Salary office"` — switches search mode
- **Period start**: datepicker `textbox` showing "01.03.2026" with label "Period start"
- **Period end**: datepicker `textbox` showing "31.03.2026" with label "Period end"
- **Date range**: `combobox` labeled "Date range" (default "Not Selected")
- **Departing filter**: `checkbox "Show only employees who are leaving"`

### Actions
- `button "Notify all managers"` — sends notification to unconfirmed managers

### Employee Table
- **Columns**: Employee (sortable link), Approved (hours), Not approved (hours), Managers who have not confirmed, Actions
- **Employee links**: navigate to `/report/{login}` (employee's My Tasks page)
- **Action button**: `button` with img icon per row (notify individual manager) — disabled when fully approved
- Some rows have 2 action buttons (when Anokhin Sergei pattern — archived employee with separate icons)
- **Pagination**: 24 pages (large dataset)

### Selectors for Phase C
```
page.getByRole('textbox', { name: /search by employee/i })
page.getByRole('button', { name: 'Employee' })   // search tab
page.getByRole('button', { name: 'Salary office' })  // search tab
page.getByRole('checkbox', { name: /show only employees who are leaving/i })
page.getByRole('button', { name: 'Notify all managers' })
page.locator('table')
page.locator('table tbody tr')
page.locator('nav[aria-label="Pagination"]')
```

---

## 2. Changing Periods Page (`/admin/offices`)

### Tab Switcher
- `button "Salary offices"` — SO-level period management
- `button "Individual period changing (N)"` — per-employee exceptions (N = count)

### Salary Offices Table
- **Columns**: Salary office (sortable), Reporting hours starting from (sortable), Confirming hours starting from (sortable), Actions
- **Period format**: "March 2026" (month + year)
- **Action button**: advance period button per SO (img icon)
- **27 salary offices** listed (Altair through Venera RF)
- No pagination — all SOs fit on one page

### Selectors for Phase C
```
page.getByRole('button', { name: 'Salary offices' })
page.getByRole('button', { name: /individual period changing/i })
page.locator('table')
page.locator('table tbody tr')
// Advance period button per row:
page.locator('table tbody tr').filter({ hasText: 'Mars (Nsk)' }).getByRole('button')
```

---

## 3. Vacation Money Payment Page (`/vacation/payment/{date}`)

### Alert
- "You have unpaid vacation requests. Please confirm their payment" — shown when unpaid exist

### Month Selection
- **Month picker**: `textbox` labeled "Payments month" showing "Mar 2026"
- **Quick-select buttons**: `button "Jan 2026"`, `button "Feb 2026"`, ..., `button "May 2026"`
- **Bulk pay**: `button "Pay all the checked requests"` (disabled when nothing checked)

### Payment Table
- **Columns**: Employee (sortable, link to CS profile), Vacation dates (sortable), Duration, Vacation type (with filter button), Salary office (with filter button), Status (with filter button), Actions, Checkbox
- **Header checkbox**: select-all `checkbox` in last column header
- **Row checkbox**: per-row `checkbox` to select for bulk payment
- **Status values**: "Not paid" (observed)
- **Vacation types**: "Regular", "Administrative" (observed)
- **No action button** for Administrative type (no checkbox either — e.g., Bogush Vladimir row)
- **Pagination**: 7 pages

### Key observation
- Administrative vacations have no "Actions" or checkbox columns — they cannot be paid through this UI
- 5-check guard (from vault) — bulk pay limited to 5 selected at once

### Selectors for Phase C
```
page.getByRole('button', { name: 'Mar 2026' })  // month quick-select
page.getByRole('button', { name: /pay all the checked/i })
page.locator('table')
page.locator('table tbody tr')
page.locator('table thead checkbox')  // select-all
// Per-row checkbox:
page.locator('table tbody tr').filter({ hasText: 'Abderrahim' }).getByRole('checkbox')
// Column filters:
page.getByRole('button', { name: 'Vacation type' })
page.getByRole('button', { name: 'Salary office' })
page.getByRole('button', { name: 'Status' })
```

---

## 4. Correction of Vacation Days Page (`/vacation/days-correction`)

### Search & Filters
- `textbox "First name, last name of the employee or of the department manager"` — search
- Tab toggle: `button "Employee"` / `button "Department manager"` — search mode
- `checkbox "Show dismissed employees"` — toggles dismissed employee visibility

### Correction Table
- **Columns**: Employee (sortable, link to CS profile), Manager (link to CS profile), Vacation days (clickable button), Pending approval (count), Department type (with filter), Events feed (button)
- **Vacation days column**: each cell is a `button` showing the day count (e.g., "23", "37") — clicking opens correction dialog
- **Events feed column**: `button` with img icon — opens event history for that employee
- **Department types observed**: "Production", "Administration"
- **Pagination**: 19 pages

### Key observation
- The vacation days button opens a correction dialog (not navigating away) — critical for Phase C automation
- Pending approval shows count of corrections awaiting manager approval
- Self-observation: Astakhova Anna (logged-in user) has 10 vacation days with 25 pending approval

### Selectors for Phase C
```
page.getByRole('textbox', { name: /first name.*last name/i })
page.getByRole('button', { name: 'Employee' })
page.getByRole('button', { name: 'Department manager' })
page.getByRole('checkbox', { name: /show dismissed/i })
page.locator('table')
page.locator('table tbody tr')
// Click vacation days to open correction dialog:
page.locator('table tbody tr').filter({ hasText: 'Abderrahim' }).getByRole('button', { name: '23' })
// Events feed button per row:
page.locator('table tbody tr').filter({ hasText: 'Abderrahim' }).locator('button').last()
```

---

## 5. Sick Leave Records (`/accounting/sick-leaves`)
*Not explored this session — lower priority. 2 test cases in XLSX.*
