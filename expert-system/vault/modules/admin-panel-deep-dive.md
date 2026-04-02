---
type: module
tags:
  - admin
  - project-management
  - employee
  - calendar
  - pmtool-sync
  - deep-dive
  - sprint-15
created: '2026-03-15'
updated: '2026-03-15'
status: active
related:
  - '[[accounting-service-deep-dive]]'
  - '[[vacation-service-deep-dive]]'
  - '[[production-calendar-management]]'
branch: release/2.1
---
# Admin Panel Deep Dive

Deep code-level investigation of admin functionality: project CRUD, employee management, PM Tool sync, and production calendar CRUD.

## 1. Project Management

### ProjectController (`/v1/projects`)

| Endpoint | Method | Authority | Purpose |
|----------|--------|-----------|---------|
| `/{projectId}` | GET | PROJECTS_ALL or AUTHENTICATED_USER | Find project by ID |
| `/` | GET | PROJECTS_ALL or AUTHENTICATED_USER | Search with filters |
| `/managers` | POST | PROJECTS_ALL or AUTHENTICATED_USER | Find managers with active projects |
| `/{projectId}` | PATCH | PROJECTS_ALL or AUTHENTICATED_USER | Patch project |
| `/{projectId}` | DELETE | PROJECTS_ALL or AUTHENTICATED_USER | Delete project |
| `/models` | GET | (none) | List project models enum |
| `/types` | GET | (none) | List project types enum |
| `/statuses` | GET | (none) | List project statuses enum |

**Validators**: `@ProjectIdExists` on projectId path variable.

**AlreadyExistsException handling**: PATCH catches `AlreadyExistsException`, converts existing object to DTO and re-throws — returns the conflicting project in error response.

### ProjectServiceImpl

```java
// find() — validates PROJECTS VIEW permission
public ProjectBO find(Long id) {
    permissionService.validate(PermissionClassType.PROJECTS, PermissionClassActionType.VIEW);
    ProjectBO project = internalProjectService.find(id);
    return fillPermissions(fillReportInfo(project));
}

// fillReportInfo() — enriches with report data
projectCopy.setLastReportDate(taskReportService.findLastReportDateForProject(id));
projectCopy.setTotalEffort(taskReportService.getTotalEffortForProject(id));

// delete() — validates DELETE permission
public void delete(long projectId) {
    ProjectBO project = internalProjectService.find(projectId);
    ProjectBO projectWithPermissions = fillPermissions(project);
    projectPermissionService.validate(projectWithPermissions, ProjectPermissionType.DELETE);
    internalProjectService.delete(projectId);
}
```

**Permission model**: Class-level (PROJECTS VIEW) + object-level (ProjectPermissionService for DELETE).

**Design issue**: Controller uses AUTHENTICATED_USER for all operations including DELETE — service-level guards are the real security boundary.

### Project Search

`ProjectSearchRequestDTO` supports filters:
- `managersLogins` — filter by manager
- `seniorManagersLogins` — filter by senior manager
- `ownerLogin` — filter by owner
- `employeeLogins` — filter by role-based membership (MANAGER, SENIOR_MANAGER, OWNER, MEMBER, OBSERVER)

Keyboard layout auto-correction via `SuggestionMappingUtil.correctLayout`.

## 2. Employee Management

### EmployeeController (`/v1/employees`)

| Endpoint | Method | Authority | Purpose |
|----------|--------|-----------|---------|
| `/` | GET | EMPLOYEES_VIEW or AUTHENTICATED_USER | Search employees |
| `/current` | GET | EMPLOYEES_VIEW or AUTHENTICATED_USER | Current logged-in employee |
| `/{login}/work-periods` | GET | EMPLOYEES_VIEW or AUTHENTICATED_USER | Work periods for employee |
| `/{login}` | GET | EMPLOYEES_VIEW or AUTHENTICATED_USER | Get by login |
| `/{login}/roles` | GET | EMPLOYEES_VIEW or AUTHENTICATED_USER | Get employee roles |
| `/{login}` | PATCH | (none — no @PreAuthorize!) | Patch employee |

**Validators**: `@EmployeeLoginExists` on login path variable.

**No create/delete**: Employees are imported from CompanyStaff sync — TTT only patches existing employees.

**Design issue**: `PATCH /{login}` has no `@PreAuthorize` annotation — relying entirely on service-level security. All other endpoints have explicit annotations. This is inconsistent.

**Employee Search** (`EmployeeSearchRequestDTO`):
- Uses `searchSecured()` — applies role-based visibility filters
- `PageableUtil.correct()` normalizes pagination parameters

## 3. PM Tool Synchronization

### Architecture

```
PmToolSyncScheduler (cron)
  → PmToolSyncLauncher.sync(false)  // incremental sync
    → PmToolSyncService.sync(fullSync=false)
      → PmToolEntitySyncLauncher.sync(projectSynchronizer, PAGE_SIZE=100, fullSync)
        → Paginated fetch with rate limiter
        → Async execution pool (per entity)
        → Failed entity retry with batching
```

### PmToolSyncScheduler

```java
@Scheduled(cron = "${pmTool.sync.cron}", zone = TimeUtils.DEFAULT_ZONE_NAME)
@SchedulerLock(name = "PmToolSyncScheduler.doPmToolSynchronization")
public void doPmToolSynchronization() {
    pmToolSyncLauncher.sync(false); // incremental
}
```

### PmToolEntitySyncLauncher — Sync Engine

**Configuration**:
- `${pmTool.sync.retry-batch-size:10}` — retry batch size (default 10)
- `${pmTool.sync.fetch-rate-per-minute:50}` — rate limit (default 50 req/min)
- `TIMEOUT = 10000` ms — per-entity sync timeout
- Uses `RateLimiter` (Guava) for API call throttling

**Incremental vs Full sync**:
- Incremental: `updatedAfter = lastSucceeded.toLocalDate()` — only changed since last sync
- Full: no date filter — syncs everything

**Failed entity handling**:
1. On timeout/error: entity ID saved to `PmToolSyncFailedProjectRepository`
2. After main sync: retry failed IDs in configurable batches
3. On success: remove from failed repository
4. Status tracking in `PmToolSyncStatusRepository`

**Post-processing**: `entitySynchronizer.postProcess()` called if any entities synced.

### PmToolProjectSynchronizer

Maps PM Tool projects to TTT `Project` entities.

**Field mapping**:
- `pmToolId` → source identifier
- `name` / `accountingName` ← both set to PM Tool project name
- `customer` ← `customerName`
- `model` ← parsed via `parseProjectModel()`
- `type` ← `ProjectType.valueOf(upperCase(typeId))`
- `status` ← `ProjectStatus.valueOf(upperCase(statusId))`, except `"draft"` → `ACTIVE`
- `country` ← `countryId`
- `preSalesIds` ← presales ticket IDs joined with ","
- `pmtId` ← PM Tool tracker ID
- Owner/PM/Supervisor ← looked up by CompanyStaff ID

**Sales filtering**: `removeSalesFromProject()` — removes all sales-type references from PM, owner, supervisor, and watchers before processing. Sales employees exist in PM Tool but not in TTT.

**Validation**: `validateEmployeesExist()` — all employee CS IDs must exist in TTT. Throws `IllegalStateException` with details if missing.

**Design issue**: Throws `IllegalStateException` for missing employees — not a proper business exception, will cause HTTP 500 instead of a meaningful error.

**Observer sync**: After project save, batch-syncs watchers via `InternalProjectObserverService.batchChangeObservers()`.

**Cache eviction**: `projectService.evictFromCache()` after each project sync.

## 4. Production Calendar CRUD

### CalendarControllerV2 (`/v2/calendars`)

| Endpoint | Method | Authority | Purpose |
|----------|--------|-----------|---------|
| `/` | GET | CALENDAR_VIEW | List calendars (paginated) |
| `/` | POST | ADMIN or CHIEF_ACCOUNTANT | Create calendar |
| `/{calendarId}` | PATCH | ADMIN or CHIEF_ACCOUNTANT | Update calendar |
| `/{calendarId}` | DELETE | ADMIN or CHIEF_ACCOUNTANT | Delete calendar |

**Validators**: `@CalendarIdExists` on calendarId.

**Role check**: Uses `hasAnyRole('ADMIN', 'ROLE_CHIEF_ACCOUNTANT')` (note: inconsistent role naming — 'ADMIN' vs 'ROLE_CHIEF_ACCOUNTANT').

### CalendarServiceImpl

Simple CRUD with audit fields:
- `create(name)`: sets name, createdAt/By, updatedAt/By from current user
- `update(id, name)`: updates name and updatedAt/By
- `delete(id)`: simple deletion

**Design issue**: `update()` contains `calendar.setId(calendar.getId())` — redundant self-assignment, dead code.

### CalendarDaysController (`/v2/days`)

| Endpoint | Method | Authority | Purpose |
|----------|--------|-----------|---------|
| `/` | GET | CALENDAR_VIEW | List calendar days (default page=0, size=100) |
| `/` | POST | ADMIN or CHIEF_ACCOUNTANT | Create calendar day |
| `/{dayId}` | PATCH | ADMIN or CHIEF_ACCOUNTANT | Patch calendar day |
| `/{dayId}` | DELETE | ADMIN or CHIEF_ACCOUNTANT | Delete calendar day |
| `/by-date` | GET | CALENDAR_VIEW | Find by date and calendar ID |

**Validators**: `@CalendarDaysIdExists` on dayId.

**Date format**: ISO 8601 (YYYY-MM-DD). Controller Javadoc: "All time and timezone information will be ignored."

**Design issue**: `findByDate` returns `null` instead of 404 when not found — inconsistent REST convention.

### CalendarDaysServiceImpl — Complex Working Day Calculations

**Constants**:
```java
DAYS_IN_WEEK = 7
WORKING_DAYS_IN_WEEK = 5
START_WEEK_COMPENSATION = 8
```

**Working days calculation** (`calculateWorkingDaysInPeriod`):
1. Calculate base working days (Mon-Fri) in period
2. Apply holiday compensation (hours adjustment from calendar entries)
3. Apply weekend compensation (working weekends, non-working weekdays)

**Calendar day operations**:
- `create`: saves entry + publishes `CalendarUpdatedEvent` with diff calculation
- `patch`: only updates `reason` field (not duration/date — design issue)
- `delete`: publishes both `CalendarUpdatedEvent` and `CalendarDeletedEvent` → triggers absence conflict resolution in vacation service

**Cross-year period handling**: For date ranges spanning year boundaries, queries different calendars per year based on `OfficeCalendar` mapping.

**Event propagation**: Calendar changes cascade to vacation service → day-off deletion, vacation day recalculation.

**Design issue**: `RUSSIAN_CALENDAR_ID` hardcoded constant — legacy code smell, assumes single default calendar.

## 5. Office/Salary Office Management

Offices are synced from CompanyStaff via periodic synchronization (`CSSalaryOfficeSynchronizer` in 3 services: TTT, vacation, calendar). TTT doesn't provide office CRUD — offices are managed externally.

**OfficeController** (`/v1/offices`):
- Period management endpoints (covered in [[accounting-service-deep-dive]])
- Employee extended period endpoints
- Suggestion/search endpoints
- No create/delete — offices come from CompanyStaff

## 6. Tracker Integration

Files located but architecture is complex — uses `TrackerClient` abstraction with factory pattern:
- `TrackerClientFactory` — creates tracker clients (JIRA, GitLab)
- `IssueTrackerService` — manages tracker tasks
- `LoadFromTrackerCommand` / `SendToTrackerCommand` — command pattern for work log sync
- `EmployeeTrackerCredentialsController` — manages per-employee tracker credentials
- `ProjectTrackerWorkLogController` — tracker work log operations

**No GraalVM sandbox found** — the tracker integration uses direct HTTP clients, not a GraalVM sandbox as initially suspected.

## 7. Design Issues Summary

| # | Issue | Location | Severity | Test Impact |
|---|-------|----------|----------|-------------|
| 1 | No @PreAuthorize on PATCH employee | EmployeeController.patch | Medium | Test unauthenticated access |
| 2 | AUTHENTICATED_USER for all project ops | ProjectController | Low | Service guards provide security |
| 3 | IllegalStateException for missing employees | PmToolProjectSynchronizer | Medium | HTTP 500 instead of business error |
| 4 | findByDate returns null not 404 | CalendarDaysController | Low | Client must handle null |
| 5 | PATCH only updates reason | CalendarDaysServiceImpl.patch | Low | Cannot update duration/date via PATCH |
| 6 | Redundant self-assignment | CalendarServiceImpl.update | Low | Dead code |
| 7 | RUSSIAN_CALENDAR_ID hardcoded | CalendarDaysServiceImpl | Low | Legacy constraint |
| 8 | Inconsistent role naming in auth | CalendarControllerV2 | Low | 'ADMIN' vs 'ROLE_CHIEF_ACCOUNTANT' |
| 9 | draft → ACTIVE status mapping | PmToolProjectSynchronizer | Low | Test PM Tool draft projects |
| 10 | Sales filtering removes nulls | PmToolProjectSynchronizer | Low | Test with null watcher entries |

## Related Notes

- [[accounting-service-deep-dive]] — period management, vacation payment
- [[vacation-service-deep-dive]] — vacation CRUD and permissions
- [[dayoff-service-deep-dive]] — day-off calendar conflicts
- [[sick-leave-service-deep-dive]] — sick leave lifecycle
- [[ttt-report-service-deep-dive]] — task report CRUD
- [[pm-tool-sync-implementation]] — PM Tool sync overview
- [[production-calendar-management]] — calendar architecture
- [[EXT-cron-jobs]] — scheduled task inventory


## 8. Ticket-Derived Bug Patterns and Validation Details (Session 97 Enrichment)

### PM Tool Integration — Active Bugs (Sprint 15-16)

**Employee ID Mismatch (#3384):** PM Tool references employee CS IDs (e.g., ID 642 as owner/manager for 7 projects, ID 1268 as watcher for 2 projects) not found in TTT DB. The `validateEmployeesExist()` throws `IllegalStateException` → HTTP 500 when PM Tool sends unknown employee IDs. Real-world scenario: PM Tool has employees TTT doesn't know about (different data source boundaries).

**Dual ID Fields (#3387):** Two confusing project identifiers:
- `pm_tool_id`: TTT's internal ID that PM Tool knows (for TTT-created projects)
- `pmt_id`: PM Tool's own PK (for PM Tool-created projects)
- Phase 1 (TTT-created) vs Phase 2 (PM Tool-created) projects have different ID mapping
- Some projects have no `pmtId` because PM Tool API doesn't return it
- **Scale mismatch:** PM Tool has 501 projects vs TTT's 3137

**Rate Limiting (#3399, #3401):** PM Tool API returns 429 Too Many Requests during batch sync of 3000+ projects at 60 RPM limit. TTT needs rate limiter on its side (`PmToolEntitySyncLauncher` uses Guava `RateLimiter` configured at `${pmTool.sync.fetch-rate-per-minute:50}`).

**422 on Batch Query (#3382):** Too many project IDs in query string causes 422. Need pagination of ID batches.

**Sales Type Filtering (#3389):** PM Tool API sends employee types: "employee", "contractor", "sales". TTT must skip "sales" type during sync — `removeSalesFromProject()` exists but needs verification for all role fields.

**Presales Append-Only (#3083):** `preSalesIds` is append-only — PM Tool sync never deletes presales IDs, only adds new ones. This is by design (presales history preservation) but means stale IDs accumulate.

**Accounting Name Immutability (#3083):** `accountingName` is set once on first sync and NEVER overwritten. If the first sync gets wrong data, manual DB fix required.

### Calendar CRUD — Validation Bugs from Tickets

**Cross-Calendar Event Isolation (#3221 CRITICAL):**
Deleting a day-off event from Georgia calendar incorrectly triggers day-off transfer processing for Cyprus calendar users when both calendars have an event on the same date. Root cause: the cascade event (`CalendarDeletedEvent`) doesn't properly scope by calendar ID — it processes ALL employees who have the same date as a day-off, not just those assigned to the affected calendar. Users receive incorrect email notifications.

**Calendar Change Timing (#3300 HIGH):**
Setting a production calendar change for a salary office for NEXT YEAR gets applied immediately to ALL years including the current year. 16 QA comments with extensive debugging. The `OfficeCalendar.since_year` logic has edge cases: records are stored only when the calendar changes for an office, and `nextYearName` shows the upcoming calendar name if different from current. The PUT endpoint `/v2/offices/{id}/calendars/{id}` has two behaviors:
- Previous calendar = null → update immediately
- Previous calendar exists → effective from next year only

**18 Duplicate Events (#2656):** Creating a calendar day entry for the Russia calendar resulted in 18 duplicate records. Root cause: no uniqueness constraint on (calendar_id, date) in `calendar_days` table at the time.

**Duplicate Date Validation (#3232):** After the duplication fix, validation message for duplicate date was silently lost — regression in Sprint 12. Previously (#2204): "Changes saved" message appeared but request was never actually sent to server.

**Firefox/Safari First Event (#2791):** First event creation fails on Firefox/Safari — sends "Invalid date" string instead of ISO date. Date parsing issue in frontend.

**All-Spaces Reason Field (#2902):** Setting a calendar event reason to all spaces makes it uneditable afterward — the field appears empty but contains whitespace, and the PATCH endpoint only updates the `reason` field.

**Past Event Deletion (#2890):** Admin should NOT be able to delete past production calendar events — but currently can. No date guard in delete logic.

**VIEW_ALL Button Visibility (#2916):** Users with VIEW_ALL role see create/edit/delete buttons despite having read-only intent. Controller uses role check, not permission check.

**Audit Field Bug (#2648):** `created_at` and `created_by` become NULL after editing a calendar event — the update operation clears creation audit fields.

### Project CRUD — Validation Bugs

**Trailing Spaces (#3348 OPEN):** Project name with trailing spaces causes silent failure — no validation error shown, but after trim the name duplicates an existing project. The `AlreadyExistsException` handling in PATCH converts the conflicting project to DTO and re-throws, but the original trailing-space name passes initial validation.

**FK Constraint on Delete (#2098):** Deleting a project fails with 500 (`task_template_project_fkey` FK violation). Projects with existing task templates cannot be deleted. No pre-check for dependent records.

**Duplicate Name Error UX (#2674, #346):** On duplicate project name, API returns generic error instead of "Project already exists" message. PATCH with duplicate name returns 500 instead of 400/409 (#2125).

**Missing Required Fields via API (#2053 OPEN):** Can create a project without `seniorManagerLogin` and `country` via API — UI enforces these but API doesn't. Security gap: API bypasses frontend validation.

**Owner Permission After Transfer (#962):** Project owner who transferred the project to another owner loses edit permission — no fallback access.

### CS Sync Validation Issues

**NULL office_id (#3236 OPEN):** CS sync sends employees with `office_id = NULL` → causes 500 errors in TTT. Need validation to skip invalid records and log warnings.

**New SO Not Synced (#3241):** New salary office created in CS doesn't appear in `ttt_backend.office` after sync. Only creation is broken; field updates on existing SOs work. Root cause: sync only does updates, doesn't handle inserts for new SOs.

**Contractor Sync (#2969):** Contractor salary office transfer not synced. Sync endpoint returns HTTP 200 even on internal failure — silent data loss.

**Archived SO (#3323 OPEN, #2725 OPEN):**
- CS has archive feature not recognized by TTT
- `office.salary` boolean field exists but is unused — should be removed
- Three areas need changes: Calendar settings (hide archived from next year), Accounting salary search (hide immediately), Accounting periods (hide immediately)
- In Admin: show greyed-out at bottom without edit capability

**Mixed Naming (#3228 OPEN):** `office.name` is a mix of Russian and Latin characters across different TTT databases — no naming convention enforced.

### Employee Management — Additional Bugs

**SQL Sorting (#2514):** Sort by Manager causes `BadSqlGrammarException` in jOOQ-generated SQL.
**Ё Collation (#2515):** Russian "Ё" letter sorts before all other characters — PostgreSQL collation issue.
**Contractor Transition (#3273 OPEN):** Employee ↔ contractor transition process not supported — no workflow for type changes.
**Cache Staleness (#2063):** Contradictory role data between endpoints because cache not refreshed after CS sync.

## Related Notes

- [[accounting-service-deep-dive]] — period management, vacation payment
- [[vacation-service-deep-dive]] — vacation CRUD and permissions
- [[dayoff-service-deep-dive]] — day-off calendar conflicts
- [[sick-leave-service-deep-dive]] — sick leave lifecycle
- [[ttt-report-service-deep-dive]] — task report CRUD
- [[pm-tool-sync-implementation]] — PM Tool sync overview
- [[production-calendar-management]] — calendar architecture
- [[EXT-cron-jobs]] — scheduled task inventory
- [[exploration/tickets/admin-ticket-findings]] — full ticket analysis


## 9. Code-Level Verification (Session 97 — Codebase Investigation)

### PM Tool — validateEmployeesExist() Actual Code

**File:** `ttt/service/service-impl/.../PmToolProjectSynchronizer.java`

```java
private void validateEmployeesExist(final Set<Long> employeeCsIds,
                                    final Map<Long, Employee> employeeMap,
                                    final PmToolProjects pmToolProject) {
    final Set<Long> missingIds = employeeCsIds.stream()
            .filter(id -> !employeeMap.containsKey(id))
            .collect(Collectors.toSet());
    if (missingIds.isEmpty()) return;
    
    final List<String> missingFields = new ArrayList<>();
    // Collects which role fields have missing employees (owner, supervisor, pm, watchers)
    throw new IllegalStateException(error); // HTTP 500 — not a business exception
}
```

Confirmed: throws `IllegalStateException` (not a proper business exception) with details of which fields have unknown employee CS IDs. This causes the ENTIRE project sync to fail for that project, not just the missing field.

### PM Tool — Rate Limiter Actual Code

**File:** `ttt/service/service-impl/.../PmToolEntitySyncLauncher.java`

```java
private final RateLimiter fetchRateLimiter;

public PmToolEntitySyncLauncher(...
    @Value("${pmTool.sync.fetch-rate-per-minute:50}") final int fetchRatePerMinute) {
    this.fetchRateLimiter = RateLimiter.create(fetchRatePerMinute / SECONDS); // SECONDS = 60.0
}

// During sync:
fetchRateLimiter.acquire();  // Blocks until rate permits
final PmToolPageResponse<T> page = entitySynchronizer.fetch(request);
```

Confirmed: Guava `RateLimiter` at 50/60 ≈ 0.83 requests/second by default. The `acquire()` call blocks the sync thread — under heavy load with 3000+ projects, this creates a long-running sync process.

### Calendar — Duplicate Date Check

**File:** `calendar/service/service-impl/.../CalendarDaysServiceImpl.java`

```java
public boolean exists(final long calendarId, final LocalDate date) {
    return calendarDaysRepository.existsByCalendarIdAndDate(calendarId, date);
}
```

The `exists()` method checks for duplicate (calendar_id, date) pairs. Called before `create()` — but the check + insert is NOT atomic, so under concurrent requests, duplicates can still occur (race condition that caused #2656's 18 duplicate events).


## Sprint 15-16 Admin Updates (Session 98)

### PM Tool Integration — Latest Tickets
- **#3412** (open): Change PM Tool API parameter from `token` to `api_token`
- **#3401** (Sprint 15): Create rate limiter for PM Tool client on TTT side
- **#3399** (Sprint 15): PM Tool rate limiting on PM Tool side
- **#3389** (Sprint 15): Skip employees with "sales" type during PM Tool sync
- **#3384** (Sprint 15): Employee not found by ID in DB during PM Tool integration
- **#3383** (Sprint 15): PM Tool API `id` parameter error despite documentation support
- **#3382** (Sprint 15): Change PM Tool integration API endpoints
- **#3387** (Sprint 15): Add `pmtId` (PM Tool internal project ID) to integration response and UI model
- **#3397** (Sprint 15, closed): Error 500 on project creation — fixed

### Other Admin Bugs
- **#3365** (Sprint 15): Accounting period selection — report period month before confirmation period should be disabled but isn't. Saving causes 400 error. Frontend validation gap.
- **#3323** (Sprint 15): Hide archived salary offices in Accounting and Admin panel
- **#3407** (Sprint 15): Confirmation page crash — "No panic! Something went wrong" error on qa-2 for pvaynmaster. Page doesn't load.
