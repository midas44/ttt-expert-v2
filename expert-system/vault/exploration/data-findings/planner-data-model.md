---
type: exploration
tags: [planner, database, schema, close-by-tag, task-assignment, data-model]
created: 2026-03-27
updated: 2026-03-27
status: active
related: ["[[investigations/planner-close-by-tag-implementation]]", "[[modules/planner-assignment-backend]]"]
---

# Planner Data Model — Database Schema (qa-1)

## Core Tables

### `ttt_backend.planner_close_tag` (0 rows on qa-1)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `bigint` | NO | nextval sequence | PK |
| `project_id` | `bigint` | NO | — | FK → project(id) |
| `tag` | `varchar(255)` | NO | — | Tag text |

**Constraints:**
- PK: `(id)`
- UNIQUE: `(project_id, tag)` — no duplicate tag names per project
- FK: `project_id` → `project(id)`

**Indexes:** PK, unique `(project_id, tag)`, non-unique `(project_id)` for FK lookups

**Key insight:** Simple tag registry — no audit columns, no created_by, no timestamps. The table is empty on qa-1 (no close-by-tag configured yet).

### `ttt_backend.task_assignment` (2,587,444 rows)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `bigint` | NO | nextval | PK |
| `assignee` | `bigint` | YES | — | FK → employee(id) |
| `task` | `bigint` | YES | — | FK → task(id) |
| `assigner` | `bigint` | YES | — | FK → employee(id), who assigned |
| `remaining_estimate` | `text` | YES | — | **Pseudo-status field** — free text |
| `comment` | `text` | YES | — | Internal notes |
| `date` | `date` | YES | — | Assignment date |
| `next_assignment` | `bigint` | YES | — | FK → self — **linked list** |
| **`closed`** | **`boolean`** | YES | `false` | **Close-by-tag target column** |
| `internal_comment` | `text` | YES | — | |
| `ui_data` | `text` | YES | — | JSON `{id, date, login}` |
| `updated_time` | `timestamptz` | YES | `now()` | |
| `show_in_history` | `boolean` | YES | `false` | History view flag |
| `position` | `integer` | YES | — | Ordering within day |

**Constraints:**
- PK: `(id)`
- UNIQUE: `(assignee, task, date)` — one assignment per person per task per day
- FKs: `assignee` → employee, `task` → task, `assigner` → employee, `next_assignment` → self

**`closed` column distribution:** 2,489,232 `false` (96.2%) vs 98,212 `true` (3.8%)

**`remaining_estimate` — pseudo-status values:**
| Value | Count | Notes |
|-------|-------|-------|
| `"Done"` | 204K | Most common "status" — **this is the value tags typically match** |
| `"-"` | 33K | Placeholder |
| `"Suspended"` | 32K | |
| `"?h"` | 28K | Unknown estimate |
| `"Blocked"` | 7K | |
| `"CR"` | 3K | Code Review |
| `"Testing"` | 1K | |
| `"Ready"` | 933 | |

**Important:** `remaining_estimate` is NOT the same as `ticket_info` (which is in the `task` table). The close-by-tag matching uses `task.ticket_info`, not `remaining_estimate`.

**`next_assignment` — linked list pattern:** Self-referencing FK creates ordered chains of assignments for a day's planner. Combined with `position` integer for ordering within a project.

**`ui_data` — JSON content example:** `{"id":2588423,"date":"2026-03-27","login":"ebalakina"}`

### `ttt_backend.task` (669,324 rows)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `bigint` | NO | nextval | PK |
| `project` | `bigint` | YES | — | FK → project(id) |
| `name` | `text` | YES | — | Task name |
| `ticket_url` | `text` | YES | — | Tracker URL |
| `ticket_name` | `text` | YES | — | Tracker ticket ID |
| `ticket_info` | `text` | YES | — | **Close-by-tag matches this field** |
| `created_time` | `timestamptz` | YES | — | |
| `last_reported_time` | `timestamptz` | YES | — | |
| `creator` | `bigint` | YES | — | FK → employee(id) |
| `bound_employee` | `bigint` | YES | — | FK → employee(id) |
| `is_project_open` | `boolean` | YES | `true` | Denormalized project status |

**Indexes:** Trigram GIN on `name` (fuzzy search), unique on `upper(name)`, index on `bound_employee`, `last_reported_time`, `created_time`, `ticket_url`

**`ticket_info` — the close-by-tag matching field:** Contains tracker status info pulled during sync. Example values include `[closed]`, `Done`, `In Progress`, `Resolved`, etc. The `CloseByTagServiceImpl.apply()` method does `StringUtils.containsIgnoreCase(ticketInfo, tag)` against this field.

**`is_project_open` distribution:** 243,520 `true` vs 425,804 `false`

### `ttt_backend.project` (3,141 rows)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint` | PK |
| `name` | `text` | Project name |
| `manager` | `bigint` | FK → employee(id) — **permission for close-tag CRUD** |
| `senior_manager` | `bigint` | FK → employee(id) — **also has close-tag permission** |
| `old_owner` | `bigint` | FK → employee(id) — **also has close-tag permission** |
| `status` | `text` | ACTIVE (199), FINISHED (2871), CANCELED (59), SUSPENDED (12) |
| `tracker_url` | `text` | Tracker integration URL |
| `type` | `text` | Project type |
| `customer` | `text` | Client name |
| `finish_date` | `date` | |
| ... | ... | 10+ more columns |

### `ttt_backend.project_member` (423 rows)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint` | PK |
| `project` | `bigint` | FK → project(id) |
| `employee` | `bigint` | FK → employee(id) |
| `role` | `text` | Free-text role (120+ distinct: "QA", "PM", "Developer", etc.) |
| `member_position` | `integer` | **Ordering column for DnD reorder** |
| `access_type` | `text` | All NULL currently |

**Key for close-by-tag testing:** `member_position` controls employee display order in Project Settings modal and Planner > Projects tab.

## Related Tables

### `ttt_backend.project_event` (7,502 rows — audit table)
Event types: MANAGER_CHANGED (2348), STATUS_CHANGED (1876), CREATED (1221), PRE_SALES_IDS_CHANGED (380), TRACKER_URL_CHANGED (352), etc.

### `ttt_backend.fixed_task` (4,368 rows)
Pinned/fixed tasks per employee: `(task, employee)` composite PK.

### `ttt_backend.task_template` (120 rows)
Task name templates with prefix per project.

### `ttt_backend.task_report` (3,583,811 rows)
Report state values: APPROVED (3.57M), REPORTED (11.7K), REJECTED (965).

### `ttt_backend.tracker_work_log` (223,366 rows)
Tracker sync data per task/employee/date.

## FK Relationship Map

```
planner_close_tag.project_id  →  project.id
task.project                  →  project.id
task_assignment.assignee      →  employee.id
task_assignment.task          →  task.id
task_assignment.assigner      →  employee.id
task_assignment.next_assignment → task_assignment.id  (self-ref linked list)
task_report.task              →  task.id
task_report.executor          →  employee.id
project.manager               →  employee.id
project.senior_manager        →  employee.id
project_member.project        →  project.id
project_member.employee       →  employee.id
```

## Key Observations for Testing

1. **`planner_close_tag` is empty on qa-1** — need to create test data via API
2. **`task.ticket_info`** is the matching field, NOT `task_assignment.remaining_estimate`
3. **`task_assignment.closed`** is the boolean set by close-by-tag apply (3.8% currently true)
4. **No audit/history** for planner_close_tag changes (no created_by, no timestamps)
5. **`project_member.member_position`** controls display order in Project Settings modal
6. **Self-referencing linked list** in task_assignment via `next_assignment` — complex ordering mechanism
7. **2.5M+ rows** in task_assignment — performance-sensitive table for queries
