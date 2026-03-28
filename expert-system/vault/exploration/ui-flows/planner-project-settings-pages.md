---
type: exploration
tags:
  - planner
  - ui-flow
  - selectors
  - close-by-tag
  - project-settings
created: '2026-03-27'
updated: '2026-03-27'
status: active
related:
  - '[[modules/frontend-planner-module]]'
  - '[[exploration/tickets/t2724-investigation]]'
---
# Planner Project Settings — UI Exploration

## Navigation Path
1. Login → navbar: click `link "Planner"` → `/planner/TABS_ASSIGNMENTS_TASK`
2. Click `button "Projects"` → `/planner/TABS_ASSIGNMENTS_PROJECT`
3. Select a project from the "Choose a project" dropdown
4. Click Project Settings icon (far right of table header) → modal opens
5. URL changes to `/planner/TABS_ASSIGNMENTS_PROJECT/project-members` or `/planner/TABS_ASSIGNMENTS_PROJECT/task-closing`

## URL Routes
- `/planner/TABS_ASSIGNMENTS_TASK` — Tasks tab
- `/planner/TABS_ASSIGNMENTS_PROJECT` — Projects tab
- `/planner/TABS_ASSIGNMENTS_PROJECT/project-members` — Project settings modal (members)
- `/planner/TABS_ASSIGNMENTS_PROJECT/task-closing` — Project settings modal (tasks closing)

## Selectors (discovered Session 71, qa-1)

### Planner Page
| Element | Selector |
|---------|----------|
| Planner nav link | `getByRole('link', { name: 'Planner' })` |
| Tasks tab | `getByRole('button', { name: 'Tasks' })` |
| Projects tab | `getByRole('button', { name: 'Projects' })` |
| Project dropdown | `[class*='planner__project-select']` (react-select) |
| Role filter | `[class*='planner__roles-filter']` |
| Actions button | `getByRole('button', { name: 'Actions' })` |
| Open for editing | `getByRole('button', { name: 'Open for editing' })` |
| Copy table button | visible alongside Actions |
| Project settings icon | `.planner__project-group-add .uikit-button` (unnamed SVG icon) |

### Project Settings Modal
| Element | Selector |
|---------|----------|
| Dialog | `getByRole('dialog', { name: 'Project settings' })` |
| Dialog CSS | `dialog.rc-dialog.dialog.dialog-size-large` |
| Heading | `h2` with "Project settings" |
| Project members tab | `getByRole('button', { name: 'Project members' })` |
| Tasks closing tab | `getByRole('button', { name: 'Tasks closing' })` |
| Tab container | `div.main-tabs.main-tabs__theme-main` |
| Active tab | `div.main-tabs__item.main-tabs__item--active` |
| OK button | `getByRole('button', { name: 'OK' })` |

### Project Members Tab
| Element | Selector |
|---------|----------|
| Employee select | `getByRole('combobox')` inside dialog |
| Role input | `input.project_role` / `getByRole('textbox', { name: 'Add a role' })` |
| Add button | SVG icon button (no text) |
| Members table | `table.planner__employees-table.ui-table-droppable` |
| Employee name links | `link` → `https://cs.noveogroup.com/profile/{id}` |
| Delete member button | `button` with trash SVG icon |

### Tasks Closing Tab
| Element | Selector |
|---------|----------|
| Description text | "Project tickets containing added values in the **Info** column will be automatically removed from the list on days when there are no more reports for them" |
| Tag input | `getByRole('textbox', { name: 'Add a tag' })` |
| Add tag button | SVG icon button (no text, "+" icon) |
| Tags table | columns: "Tags for closing tasks", "Actions" |
| No data message | "No data" when empty |
| Delete tag button | `button` with trash SVG icon |

### Task Table (Projects Tab)
| Element | Selector |
|---------|----------|
| Table wrapper | `.planner__table` → `.datasheet` → `table.datasheet__table` |
| Employee group | `tbody.datasheet__grouped` |
| Info column cells | `td.planner__cel-info` |
| Blocked status | `[class*='planner__cel--color-blocked']` (red) |
| Done status | `[class*='planner__cel--color-done']` (green) |
| Read-only status | `[class*='planner__cel--color-read-only']` |
| Task name | `.planner__table__task-row` |

## Table Columns (Projects Tab)
No (60px), Info (115px), Tracker (120px), Task/Ticket (385px), Date (104px), Remaining work (167px), Comment (309px)

## Key Observations
1. **Project Settings icon is hard to find** — unnamed SVG button at far right of table header, inside `.planner__project-group-add`
2. **Dropdown is react-select** — uses CSS prefix `selectbox__`, not standard HTML select
3. **Both tabs have OK button** — after !5341, both trigger close-tags-apply saga
4. **Empty state** — "No data" shown in tags table when no tags configured
5. **Info column** shows tracker priority tags like `[Medium]`, `[High]` — these are the values matched by close-by-tag

## Screenshots
Location: `expert-system/artefacts/planner-exploration/`
- `01-my-tasks-page.png` through `13-fondation-settings-project-members.png`
