---
type: exploration
tags: [admin, tickets, bugs, projects, calendars, salary-office, employees, trackers, pm-tool, sync]
created: 2026-04-02
updated: 2026-04-02
status: active
related: ["[[admin-panel-deep-dive]]", "[[admin-panel-pages]]", "[[pm-tool-sync-implementation]]", "[[pm-tool-integration-deep-dive]]", "[[calendar-service-deep-dive]]", "[[ttt-cs-sync]]", "[[cross-service-office-sync-divergence]]"]
branch: release/2.1
---

# Admin Module — GitLab Ticket Findings

**Source:** ~120+ unique tickets mined across 8 keyword searches (admin, project, calendar, salary office, tracker, pm tool, employee, sync, календарь).

## 1. PM Tool Integration (Sprint 15 — Active)

### #3083 [OPEN] Migrate project functionality to PM Tool
- **Major refactoring:** project creation moves to PM Tool, TTT keeps "accounting name" (учетное название)
- TTT retains: tracker fields, change history (tracker-related fields only)
- PM Tool syncs to TTT: name, customer, country, supervisor, manager, owner, watchers, status, type, model, presales IDs
- **Presales IDs:** append-only (never delete)
- **Accounting name:** set once on first sync, never overwritten
- **History:** only for tracker-related fields after migration
- **Test cases:** field sync verification, accounting name immutability, presales append-only, history restriction

### #3093 [OPEN] UI changes after PM Tool integration
- Rename "Senior Manager" → "Supervisor"; project name becomes link to PM Tool
- Remove inline-editing of Type/Status; remove "Transfer project" action
- Rename "Edit project" → "Edit tracker data" (3 tracker fields remain editable)
- Remove Create project button; status filter defaults exclude "Finished" and "Cancelled"
- **QA bugs found:** tracker validation errors not shown; empty tracker URL displayed when should be hidden; project link navigates to TTT instead of PM Tool
- **Test cases:** all UI changes, button removal, link targets, filter defaults

### #3382 [OPEN] Change PM Tool integration API
- 422 error when too many project IDs in query string
- Need rate-limiting on ID count per request
- Acceptance: no failed entities in `pm_tool_sync_failed_entity` table after sync

### #3383 [OPEN] PM Tool API error on id parameter
- PM Tool API returns 422 on `id` query parameter despite documentation
- Sync verification: insert test records into `pm_tool_sync_failed_entity`, run sync, verify cleared

### #3384 [OPEN] Unable to locate employee by ID
- PM Tool references employee ID 642 as owner/manager for 7 projects; ID not found in TTT DB
- Also ID 1268 as watcher for 2 projects
- **Edge case:** PM Tool can reference employees TTT doesn't know about

### #3387 [OPEN] Add pmtId to integration model
- TWO separate ID fields: `pm_tool_id` (TTT's ID known to PM Tool) and `pmt_id` (PM Tool's own PK)
- Complex mapping: phase 1 (TTT-created) vs phase 2 (PM Tool-created) projects
- Some projects have no pmtId because PM Tool doesn't return them
- PM Tool has 501 projects vs TTT's 3137

### #3389 [OPEN] Skip employees with "sales" type
- PM Tool API sends employee types: "employee", "contractor", "sales"
- TTT must skip "sales" type during sync

### #3399 [OPEN] Rate limit from PM Tool side
- 429 Too Many Requests during batch sync of 3000+ projects at 60 RPM limit

### #3401 [OPEN] Create rate limiter for PM Tool client
- 60 requests/minute rate limit needed on TTT side

## 2. Project CRUD/Validation (Historical Bugs)

| Ticket | Status | Issue | Test Priority |
|--------|--------|-------|---------------|
| #3348 | OPEN | Trailing spaces in project name cause silent failure — no validation error, duplicate name after trim | High |
| #2674 | closed | Duplicate name: generic error instead of "Project already exists" | Medium (regression) |
| #2098 | closed | 500 on project deletion: FK `task_template_project_fkey` | High (regression) |
| #1943 | closed | 500 on project deletion (newly created projects) | Medium |
| #2125 | closed | 500 on PATCH with duplicate name (should be 400/409) | Medium |
| #2120 | closed | Wrong error code on invalid project ID | Low |
| #2053 | OPEN | Can create project without `seniorManagerLogin` and `country` via API | High (security) |
| #2481 | closed | Multiple validation errors, duplicate dropdown entries | Medium |
| #962 | closed | Owner who transferred project loses edit permission | Medium |
| #537 | closed | Owner dropdown: only typing works, not clicking; shows all employees | Low |
| #346 | closed | 400 error on duplicate name (no informative message) | Low |
| #686 | closed | 400 type mismatch on rename | Low |

### #3397 [closed] 500 on project creation
- Sprint 15 deployed without project creation support (moved to PM Tool)
- False alarm on prod — intentional removal

## 3. Production Calendars

### #3221 [closed] Cross-calendar event deletion (CRITICAL)
- **Critical bug:** deleting day-off event from Georgia calendar incorrectly processes day-off transfers for Cyprus calendar users when both calendars have event on same date
- Users receive incorrect email notifications
- **Test cases:** cross-calendar event isolation, notification recipients

### #3300 [closed] Calendar change for SO applied immediately (HIGH)
- Setting production calendar change for next year on a SO gets applied immediately to ALL years including current
- 16 QA comments with extensive debugging
- **Test cases:** calendar change timing, year isolation

### Calendar CRUD API (Sprint 7 — Foundation)

| Ticket | Status | Endpoint | Key Bugs |
|--------|--------|----------|----------|
| #2648 | closed | Schema change | `created_at`/`created_by` become NULL after editing event |
| #2651 | closed | POST /v2/calendars | Name must be unique, Latin characters only, CHIEF_ACCOUNTANT+ADMIN access |
| #2652 | closed | PATCH /v2/calendars/{id} | Only `name` editable, 500 error found during testing |
| #2653 | closed | DELETE /v2/calendars/{id} | Only empty calendars can be deleted |
| #2654 | closed | office_calendar table | New SO gets calendar_id=1 (Russia) instead of NULL |
| #2655 | closed | GET /v2/days | Paginated, all filters optional |
| #2656 | closed | POST /v2/days | **18 duplicate events** created when adding to Russia calendar |
| #2657 | closed | PATCH /v2/days/{id} | `updated_by` stored full name instead of login |
| #2658 | closed | DELETE /v2/days/{id} | CHIEF_ACCOUNTANT+ADMIN access |
| #2659 | closed | GET /v2/offices | `since_year` logic: records stored only when calendar changes, `nextYearName` if different |
| #2660 | closed | PUT /v2/offices/{id}/calendars/{id} | If previous calendar=null update immediately; otherwise from next year only |
| #2662 | closed | GET /v2/periods/summary | Calendar+office+date range query |

### Calendar UI Bugs

| Ticket | Status | Issue | Test Priority |
|--------|--------|-------|---------------|
| #2642 | closed | Original calendar settings feature — 19 QA bugs found | High |
| #2791 | closed | First event creation fails on Firefox/Safari: sends "Invalid date" | Medium |
| #2902 | closed | All-spaces in reason field makes it uneditable afterward | Medium |
| #2916 | closed | VIEW_ALL users see create/edit/delete buttons | Medium |
| #2890 | closed | Admin shouldn't delete past PC events | Medium |
| #3232 | closed | No validation message for duplicate event date (regression Sprint 12) | High |
| #2204 | closed | Duplicate date: "Changes saved" message but request never sent | Medium |
| #3010 | closed | Navigate to correct year after creating event for next year | Low |

## 4. Salary Offices / CS Sync

### #3323 [OPEN] Hide archived salary offices
- Three areas need changes: Calendars for SO (hide from next year), Accounting salary search (hide immediately), Accounting periods (hide immediately)
- In Admin: show greyed-out at bottom without edit capability

### #2725 [OPEN] Archived SO status not recognized
- CS has archive feature not recognized by TTT
- `office.salary` boolean field exists but unused — should be removed

### #3241 [closed] New SO not synced to TTT
- New SO created in CS doesn't appear in `ttt_backend.office` after sync
- Only creation broken; field updates worked

### #3228 [OPEN] Mixed Russian/Latin SO names
- `office.name` mix of Russian and Latin across different TTT databases

### #2969 [closed] CS sync fails for contractors
- Contractor salary office not updated during sync
- Sync endpoint returns 200 even on internal failure

### #3236 [OPEN] CS data validation during sync
- Validate CS data, skip invalid records, log warnings
- `office_id = NULL` causes 500 errors

### #2989 [OPEN] Full sync with CS needed
- Delta sync doesn't guarantee consistency: CS data changes without timestamp update, Rabbit events lost
- Full sync was removed in March 2023

### #3303 [OPEN] Sync on application startup
- `employee_projects` sync runs once (tracked via `java_migration` table), then only cron (3 AM)

### #3374 [OPEN] `last_date` not updated during CS sync
- Employee's `last_date` in `ttt_vacation.employee` not updated during sync

## 5. Employees and Contractors

| Ticket | Status | Issue | Test Priority |
|--------|--------|-------|---------------|
| #2514 | closed | 500 on sort by Manager: `BadSqlGrammarException` in jOOQ | Medium |
| #2515 | closed | Russian "Ё" sorting before all others (collation issue) | Medium |
| #2702 | closed | Empty employee names with "Show fired" | Medium |
| #2195 | closed | HR sees "Report page" button → 403 on click | Medium |
| #2050 | closed | OFFICE_DIRECTOR sees all offices' employees | High |
| #2051 | closed | ACCOUNTANT gets 403 on employees list | High |
| #2052 | closed | OFFICE_HR gets 403 on employees list | High |
| #2167 | closed | OFFICE_HR can't find other offices' employees | Medium |
| #2063 | closed | Contradictory role data between endpoints (cache not refreshed after sync) | Medium |
| #3273 | OPEN | Employee ↔ contractor transition | High |
| #2842 | OPEN | Contractor termination process missing | Medium |

## 6. TTT Parameters

| Ticket | Status | Issue |
|--------|--------|-------|
| #3288 | OPEN | Invalid characters: English validation message incorrect |
| #2201 | closed | Duplicate name: generic error instead of field-level |
| #1669 | closed | Comment truncated at 360 chars |

## 7. Tracker Integration

| Ticket | Status | Issue | Test Priority |
|--------|--------|-------|---------------|
| #3341 | OPEN | ClickUp space tasks not adding (specific space) | Medium |
| #3198 | OPEN | Multiple projects with same tracker workspace | Medium |
| #2039 | OPEN | No error for inaccessible tracker API | Medium |
| #2448 | OPEN | Wrong error when tracker type not selected | Low |
| #3261 | OPEN | Wrong title on tracker edit popup (English) | Low |
| #3378 | OPEN | Relocate tracker sync scripts to TTT codebase | Low |
| #3148 | closed | ClickUp integration completely broken | Medium (regression) |
| #3161 | closed | JIRA Server integration broken | Medium (regression) |
| #3145 | closed | YouTrack integration added | Medium |
| #2209 | closed | Cryptic error for `tracker.not.permitted` | Low |

## 8. Role/Permission Issues

| Ticket | Status | Issue |
|--------|--------|-------|
| #961 | closed | ADMIN sees tasks from foreign projects in Confirmation |
| #1196 | closed | ADMIN can't confirm reports from non-member projects |
| #2188 | closed | PM/SPM role checkboxes disabled after admin login |
| #2181 | closed | `GET /projects/{id}/events` accessible to ALL users |

## 9. API Key Management

| Ticket | Status | Issue |
|--------|--------|-------|
| #897 | closed | Duplicate name: 409 but generic error in UI |
| #2667 | OPEN | Missing "Copy" button for API key |

## Summary — Top Test-Worthy Findings

1. **PM Tool integration** — Employee ID not found, rate limiting, presales append-only, accounting name immutability, "sales" type filtering. Active development area.
2. **Cross-calendar event bug** (#3221) — Critical: deleting event from one calendar affects users with different calendar. Regression test essential.
3. **Calendar change timing** (#3300) — Setting next-year change applies immediately to all years. 16 QA comments.
4. **CS sync validation** (#3236, #3241, #2969) — Missing data, NULL office_id → 500, sync reports success on failure, contractor sync failures
5. **Role-based access** — Multiple tickets (#2050-2052, #2167, #2181) where roles see wrong data. Matrix testing needed.
6. **Project validation** — Duplicate names (#2674, #3348), FK constraints on deletion (#2098), missing required fields via API (#2053)
7. **Calendar CRUD** — 18 duplicate events (#2656), Firefox/Safari date bug (#2791), spaces in reason field (#2902)
8. **Employee management** — SQL sorting bugs (#2514, #2515), contractor transition (#3273), fired employee display
9. **Archived salary offices** (#3323, #2725) — Not hidden, no UI distinction, unused boolean field
10. **Tracker integration** — ClickUp/JIRA breakages, multi-project support, error handling
