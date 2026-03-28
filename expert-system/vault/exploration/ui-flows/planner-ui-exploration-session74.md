---
type: exploration
tags: [planner, ui-exploration, playwright, selectors, editing-mode]
created: 2026-03-28
updated: 2026-03-28
status: active
related: ["[[planner-module]]", "[[planner-lock-mechanism]]", "[[planner-assignment-ordering]]"]
branch: release/2.1
---
# Planner UI Exploration — Session 74

## Page Routes

| Tab | URL | Description |
|-----|-----|-------------|
| Tasks (personal) | `/planner/TABS_ASSIGNMENTS_TASK` | Personal task view — shows current user's assignments for selected date |
| Projects (manager) | `/planner/TABS_ASSIGNMENTS_PROJECT` | Project view — shows all employees for selected project |

There is **no History tab** — only Tasks and Projects. The "History" concept from agenda items doesn't exist as a separate tab.

## Tasks Tab (Personal Planner)

### Layout
- Search bar: `textbox "My project / my task, ticket number or URL 1,5h"` + `button "Add a task"`
- Table columns: №, Info, Tracker, Task/Ticket, Date (with day-of-week), Remaining work, Comment
- Total row at bottom
- Date navigation: left/right arrows around the date header

### Selectors (discovered)
```
Search input: getByRole('textbox', { name: /my project.*my task/i })
Add task button: getByRole('button', { name: 'Add a task' })
Tasks tab: getByRole('button', { name: 'Tasks' })
Projects tab: getByRole('button', { name: 'Projects' })
Date left arrow: table header date cell → first button child
Date right arrow: table header date cell → last button child
```

### Empty State
When user has no assignments for the selected date, only the header row and Total row (showing 0) are visible.

## Projects Tab (Manager View)

### Layout — Read-Only Mode
- **Project selector**: dropdown with project name (e.g., "Fondation du Patrimoine")
- **Role filter**: "Show projects where I am a" → dropdown (PM, member, etc.)
- **"Open for editing" button** (blue) — top-right toolbar
- **WebSocket indicator**: cloud icon next to tabs shows "Connected" status

### Table Structure
- **Employee header rows**: `Name (Role)` | total hours | action buttons (2 buttons: Open for editing, Update tickets)
- **Task rows under each employee**: №, Info ([Medium]/[High]), Tracker (linked), Task/Ticket, Hours, Remaining work, Comment

### Color Coding
- **Blocked** → red/orange background
- **Done** → green background
- No color → in progress or unset

### Read-Only Mode Features
- Action buttons in comment column are **disabled** (greyed out)
- No DnD handles visible
- Employee header has 2 action buttons (open for editing, sync)

### Editing Mode (after clicking "Open for editing")
**Major UI changes:**
1. **Toolbar additions**: "Actions" dropdown + "Copy the table" button appear
2. **DnD handles**: Every task row gets a "::" button at the start (drag handle)
3. **Comment edit buttons**: Become enabled (two buttons per comment cell)
4. **Employee header row**: Gets 3 action buttons (open for editing, update tickets, add employee)

### "Actions" Dropdown Contents
- **"Approve all"** — approves all reported hours for the project
- **"Download hours from the tracker"** — triggers tracker sync for all employees

### Per-Employee Action Buttons (in header row)
1. **Open for editing** (per-employee toggle) — tooltip "Open for editing"
2. **Update tickets** — triggers tracker sync for that employee, shows error banner if tracker not configured: "Failed to update tickets for the project X. Project manager has to set up synchronization with the tracker"
3. **Add employee** (only visible in editing mode)

### Selectors (discovered)
```
Project selector: page.locator('[class*="project"] select') or combobox near "Project" label
Role filter: combobox near "Show projects where I am a"
Open for editing (top): getByRole('button', { name: 'Open for editing' })
Actions button: getByRole('button', { name: 'Actions' })
Copy table: getByRole('button', { name: 'Copy the table' })
DnD handle: button with text "::"
Employee name: cell containing employee "Name (Role)"
Task name: cell containing "Project / Task name"
Tracker link: link with Jira ticket ID (e.g., "SF-1613")
WebSocket status: img icon next to tabs → click reveals "Connected" text
```

## Build Info (qa-1)
`Build #: 2.1.26-SNAPSHOT.LOCAL | Build date: 22.03.2026`
The apply endpoint from !5335 (merged 2026-03-25) is NOT deployed — build is from 2026-03-22.

## Screenshots Captured
- `artefacts/planner-tasks-tab-empty.png` — Tasks tab, empty state
- `artefacts/planner-projects-tab-data.png` — Projects tab, read-only mode, full page
- `artefacts/planner-editing-mode-dnd.png` — Projects tab with editing activated

## Notifications/Banners Observed
1. "Next week contains non-working days — please remember to report your hours"
2. "You have overdue day off rescheduling requests. Please approve or reject them"
3. "This month, you have exceeded the hours norm by X%. Norm: Y. Reported: Z"
4. "Failed to update tickets for the project X. Project manager has to set up synchronization with the tracker" (error, red)

## Key Observations
- **No separate History tab** exists in the planner
- **WebSocket connection indicator** next to tabs shows real-time connection status
- **Tracker integration** is per-employee (not bulk), and requires PM to configure synchronization
- **Comment field supports multi-line** text (paragraphs)
- **DnD is active only in editing mode** — handles appear only after "Open for editing"
- **Per-employee editing** can be toggled independently of the global "Open for editing"