---
type: exploration
tags: [reports, ui-flow, selectors, phase-c-ready]
created: 2026-03-28
updated: 2026-03-28
status: active
related: ["[[reports-service-deep-dive]]", "[[frontend-reports-module]]"]
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
