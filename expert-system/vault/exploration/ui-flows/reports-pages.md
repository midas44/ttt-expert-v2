---
type: exploration
tags:
  - reports
  - ui-flow
  - selectors
  - phase-c-ready
created: 2026-03-28T00:00:00.000Z
updated: 2026-03-28T00:00:00.000Z
status: active
related:
  - '[[reports-service-deep-dive]]'
  - '[[frontend-reports-module]]'
branch: release/2.1
---

# Reports Pages — UI Structure (QA-1, session 94)

## My Tasks Page (`/report`)

### Navigation
- Nav bar items: `link "My tasks"` (→ /report), `button "Calendar of absences (N)"`, `link "Confirmation"` (→ /approve), `link "Planner"` (→ /planner), `button "Statistics"`, `button "Admin panel"`, `button "Accounting"`, `link "Notifications"` (→ /notifications)
- Language switcher: `generic "EN"` with dropdown arrow
- User menu: `button "Anna Astakhova Anna Astakhova"` with avatar + logout button

### Alerts Banner
- Overdue day-off alert: "You have overdue day off rescheduling requests. Please approve or reject them"
- Over-reporting alert: "This month, you have exceeded the hours norm by **272**%. Norm as of March 28: **32**. Reported hours: **119**"
- Next week non-working days reminder

### Task Input
- `textbox "My project / my task, ticket number or URL 1,5h"` — main task/hours input
- `button "Add a task"` — submits the input

### Hours Summary
- "Worked in March:" followed by 4 numbers: reported/confirmed/norm-so-far/norm-total
- Located in `generic` container above the table

### Week Navigation
- `button "Current week"` (disabled when already on current week)
- Previous/Next week buttons (with img arrows)
- Date range display: "23.03.2026 – 29.03.2026"

### Group By Project Toggle
- `paragraph "Group by project"` label
- `checkbox "Group by project"` (checked by default)

### Report Table
- `table` with `rowgroup` header and body
- **Header columns:** Active tasks, Mon-Sun (day + date), For the period, Total
- **Header icons** (in Active tasks header): 3 img icons (expand all / collapse all / sort)
- **Project rows** (when grouped): project name with expand arrow, period sum, total sum
- **Task rows**: task name + rename button (img icon), day cells (editable), period sum, total sum
- **Total row**: "Total" label, day sums (format "N" or "N/N"), period sum (format "N / N")
- **Task rename button**: `button` with `img` icon next to task name
- **Empty day cells**: clickable to enter hours

### Footer
- Vacation fund info text explaining which project types count
- `link "Vacation regulation"` → Confluence

### Selectors for Phase C
```
// Task input
page.getByRole('textbox', { name: /my project.*my task/i })
page.getByRole('button', { name: 'Add a task' })

// Week navigation
page.getByRole('button', { name: 'Current week' })

// Group by project
page.getByRole('checkbox', { name: 'Group by project' })

// Table
page.locator('table')
page.locator('table tbody tr')  // all rows

// Hours summary
page.getByText(/Worked in/)
```

---

## Confirmation Page (`/approve/employees/{page}`)

### Tab Switcher
- `button "By employees"` — switches to employee-based view
- `button "By projects"` — switches to project-based view

### Filters (By Employees tab)
- **Employee dropdown**: `combobox` inside container labeled "Employee", shows current employee name
- **Role filter**: "Show projects where I am a" + `combobox` with options (PM, etc.)
- **Task filter**: `checkbox "Of other projects"` — show tasks from other projects
- **Approved filter**: `checkbox "With approved hours"` (checked by default)

### Week Selection
- Multiple week buttons: `button "23.02 – 01.03"`, `button "02.03 – 08.03"`, etc.
- Some week buttons have an `img` icon (likely indicating status — approved/pending)

### Actions
- `button "Approve"` — approves all hours for selected week

### Confirmation Table
- Same structure as My Tasks table: Active tasks, Mon-Sun, For the period, Total
- **Task row actions**: each task has 2 buttons with img icons (approve task / reject task)
- **Header icons**: 2 button groups — approve/reject all + expand/collapse/sort icons
- **Total row**: shows "reported/norm" format per day (e.g., "0.5/8.5")

### Selectors for Phase C
```
// Tab buttons
page.getByRole('button', { name: 'By employees' })
page.getByRole('button', { name: 'By projects' })

// Employee dropdown
page.getByRole('combobox')  // within Employee container

// Approve button
page.getByRole('button', { name: 'Approve' })

// Week buttons
page.getByRole('button', { name: /\d{2}\.\d{2}.*–.*\d{2}\.\d{2}/ })

// Checkboxes
page.getByRole('checkbox', { name: 'Of other projects' })
page.getByRole('checkbox', { name: 'With approved hours' })
```


## Selectors Discovered During Phase C (Session 106)

### Week Navigation (confirmed working on qa-1)
- Previous week arrow: `button[class*='prev']` or first button in week-navigation container
- Next week arrow: `button[class*='next']` or last button in week-navigation container
- Current week button: `getByRole('button', { name: /current week/i })`
- Week range text: found via `[class*='week-navigation'] span` or date pattern matching
- Week tabs: buttons matching `/\d{2}\.\d{2}\s*[–—-]\s*\d{2}\.\d{2}/`

### Cell Editability Check Pattern
- Double-click cell → check for input/textarea (inline) → fallback to `.timesheet-reporting__input` (floating)
- Closed period cells: double-click produces no input → `isCellEditable()` returns false
- Open period cells: input appears within 2s

### TAB Key Behavior (Session 106, #3398 regression test)
- TAB key moves focus to next cell's editor
- Confirmed: no stacking of duplicate input fields on rapid TAB presses (qa-1 environment)
- At most 1 visible input/textarea in the table at any time

### Decimal Hours (Session 106)
- Entering "1.5" stores correctly as 90 minutes, displays as "1.5"
- Decimal separator depends on office settings (dot vs comma)

### Batch Reporting (Session 106)
- Multiple cells can be filled sequentially: fill → Enter → navigate → fill
- Totals recalculate after each cell save (networkidle wait confirms)
- Multiple tasks' rows accessible via `waitForTask(pattern)`


## Selectors (discovered during Phase C, Session 107)

### Pin/Unpin Task
- Pin icon container: `[class*='task-pin']` (inside first `td` of task row)
- Pin icon hidden by default, visible on hover of task row parent
- When pinned: has `_pinned` modifier class → always visible
- Toggle: hover row → click `[class*='task-pin']` button → `waitForLoadState("networkidle")`
- Task order: Pinned (alphabetical) → Special → Unpinned (alphabetical)

### Rename Task Modal
- Triggered by clicking task name span (`span[class*='task-name']`) in first column
- Modal: `getByRole("dialog")` — title "Renaming the task"
- **Name input is rc-select combobox** (`input[role='combobox']`), NOT a regular text input
- Dropdown opens automatically on fill/type → Rename button stays DISABLED while dropdown is open
- **Critical: must close dropdown before Rename button enables** — click `.rc-dialog-title` or `input[name='date-picker']` to shift focus
- `pressSequentially()` works better than `fill()` for React state updates
- Date field: `input[name='date-picker']` with rdt date picker — label "Rename from"
- Footer buttons: `uikit-button--theme-cancel` (Cancel), `uikit-button--theme-confirm` (Rename)
- **Known issue: rc-select may require dropdown SELECTION, not free text entry.** Button stays disabled if custom text typed without matching dropdown item. Needs further investigation.

### Report Comment (TC-RPT-012)
- Comment input found via multi-strategy: `textarea[class*='comment']`, `[class*='commentInput'] textarea`, `.timesheet-reporting__input textarea`
- Fallback: right-click cell → context menu with "Comment" option
- Comment tooltip: `[class*='tooltip'], [role='tooltip'], [class*='rc-tooltip']` — appears on cell hover
- Comment field in backend: `reportComment` on task_report entity, set via `PATCH /v1/reports/{id}`

### Manager View (/report/<login>)
- Another employee's report page: navigate to `/report/<employeeLogin>` directly
- Page has NO search input (`input[name='TASK_NAME']`) — `waitForReady()` will fail
- Use `page.locator("table").first().waitFor()` instead for readiness check
- Table structure same as My Tasks but read-only for non-PM managers

### Contractor Report Page (#3150)
- Direct URL `/report/<contractorLogin>` works without spinner
- Bug #3150 only triggers when navigating FROM Statistics/Admin links
- Check for spinner: `[class*='spinner'], [class*='loading']` — should not be visible after networkidle
- Console errors: filter for "global error" or "Uncaught" to detect the bug


## Confirmation Page Selectors (discovered during Phase C, Session 108)

### ConfirmationPage Object — Verified Working Patterns

**Navigation:**
- By Projects tab: `goto(baseUrl, "projects")` → `/approve/projects/0`
- By Employees tab: `goto(baseUrl, "employees")` → `/approve/employees/0`
- Table readiness: `page.locator("table").first().waitFor({ state: "visible", timeout: 30000 })`

**Dropdown (rc-select combobox):**
- Employee/project selector: `page.getByRole("combobox").first()`
- Click → fill(name) → wait for `.rc-select-item-option, [class*='select-item-option'], [class*='option']` filtered by name
- **By Employees tab searches by FULL NAME** (latin_first_name + latin_last_name), NOT by login
- **Manager must have project-level PM role** (`project_member.role IN ('PM', 'DM', 'PO')`) — not just global ROLE_PROJECT_MANAGER

**Week selection:**
- Week buttons match regex: `/\d{2}\.\d{2}\s*[–—-]\s*\d{2}\.\d{2}/`
- Both exact text match and date-range parsing work
- Shortcut for "most recent week": click `weekButtons.nth(weekCount - 1)`

**Task row actions:**
- Approve button: first `button` with `img` child in the task row, or `button[title*='pprove']`
- Reject button: second `button` with `img` child, or `button[title*='eject']`
- Both use `resolveFirstVisible` multi-strategy fallback
- After approve click: `waitForLoadState("networkidle")` confirms state change

**Reject tooltip:**
- Tooltip with textarea: `[class*='tooltip']`, `[class*='popover']`, `[class*='popup']` filtered by `has: textarea`
- Fill textarea → click confirm button (last button in tooltip, or `button { name: /reject/i }`)

**Bulk approve:**
- "Approve" / "Approve all" button: `getByRole("button", { name: /^approve$/i })` or `{ name: /approve all/i }`

**Task visibility requirement:**
- Employee must have the task PINNED (in `fixed_task` table) for it to appear on By Employees tab
- Query must JOIN `fixed_task ft ON ft.employee = e.id AND ft.task = t.id`

**Task name display — "Group by project" behavior:**
- On My Tasks page with "Group by project" checked: task names display WITHOUT project prefix
- e.g., "WiseMoGuest / QA: Android Host" → displayed as "QA: Android Host" under "WiseMoGuest" group
- Use `stripProjectPrefix(taskName, projectName)` helper when searching for tasks on My Tasks page
- On Confirmation page: task names display as-is (full name including project prefix)
