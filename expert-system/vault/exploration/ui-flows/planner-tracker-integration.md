---
type: exploration
tags:
  - planner
  - tracker
  - integration
  - jira
  - gitlab
  - clickup
  - backend
  - frontend
created: '2026-03-28'
updated: '2026-03-28'
status: active
related:
  - '[[modules/frontend-planner-module]]'
  - '[[exploration/tickets/planner-ticket-findings]]'
  - '[[exploration/ui-flows/planner-websocket-stomp-system]]'
  - '[[external/ext-tracker-integration]]'
  - '[[external/requirements/req-tracker-integration]]'
---
# Planner Tracker Integration — Full System Documentation

## Architecture Overview

The tracker integration follows a **layered command pattern**:

```
Frontend (React/Redux-Saga)
    ↓ POST /v1/projects/{projectId}/tracker-work-log/sync
REST Controller (ProjectTrackerWorkLogController)
    ↓
Service Layer (ProjectTrackerWorkLogService)
    ↓
Command Pattern (SendToTrackerCommand / LoadFromTrackerCommand)
    ↓
IssueTrackerService + TrackerClientFactory
    ↓
Tracker Clients (Jira, GitLab, ClickUp, Asana, Redmine, YouTrack, Presales)
```

## Backend — REST API

### Endpoints

**Controller:** `ttt/rest/.../controller/v1/project/ProjectTrackerWorkLogController.java`
**Base path:** `/v1/projects/{projectId}/tracker-work-log`

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/info` | Get work log info (enabled status) | AUTHENTICATED_USER \| PROJECTS_ALL |
| POST | `/sync` | Sync work log with tracker | AUTHENTICATED_USER \| PROJECTS_ALL |

### Sync Request DTO

```java
// ProjectTrackerWorkLogSyncRequestDTO.java
public class ProjectTrackerWorkLogSyncRequestDTO {
    @NotNull
    private LocalDate date;           // Date to sync
    @EmployeeLoginExists
    private String employeeLogin;     // null = all project employees
    private SyncSourceType source;    // TTT or TRACKER
}
```

### Sync Response DTO

```java
// ProjectTrackerWorkLogSyncResponseDTO.java
public class ProjectTrackerWorkLogSyncResponseDTO {
    private List<EmployeeSyncResponseDTO> items;  // Per-employee results
}
```

## Backend — Service Layer

### ProjectTrackerWorkLogServiceImpl

**File:** `ttt/service/service-impl/.../project/tracker/ProjectTrackerWorkLogServiceImpl.java`

```java
public ProjectTrackerWorkLogSyncResponseBO sync(ProjectTrackerWorkLogSyncRequestBO request) {
    // 1. Publish TrackerSyncStartEvent (WebSocket notification)
    // 2. Check SyncSourceType:
    //    - TTT → SendToTrackerCommand.execute(request)
    //    - TRACKER → LoadFromTrackerCommand.execute(request)
    // 3. Special case: YouTrack returns empty response
    // 4. Publish TrackerSyncFinishEvent (WebSocket notification)
}
```

### Command Pattern — Two Sync Directions

**SendToTrackerCommand** (`command/SendToTrackerCommand.java`):
- Purpose: Upload work logs from TTT → external tracker
- Dependencies: InternalProjectService, TaskAssignmentService, IssueTrackerService, WorkLogSyncExecutor
- Gets project details, finds assignments to sync, calls tracker API to create work logs

**LoadFromTrackerCommand** (`command/LoadFromTrackerCommand.java`):
- Purpose: Download work logs from tracker → TTT
- Fetches project + member info, retrieves employee tracker credentials, downloads work logs, persists to TTT DB

### TrackerClientFactory — 7 Supported Trackers

**File:** `ttt/service/service-impl/.../task/tracker/TrackerClientFactory.java`

```java
switch (credentials.getType()) {
    case GITLAB:       return new GitlabClient(credentials, objectMapper);
    case REDMINE:      return new RedmineClient(credentials, objectMapper);
    case JIRA_TOKEN:
    case JIRA_LOGPASS: return new JiraClient(credentials, objectMapper);
    case ASANA:        return new AsanaClient(credentials, objectMapper);
    case CLICK_UP:     return new ClickUpClient(credentials, objectMapper);
    case PRESALES:     return new PresalesClient(credentials, objectMapper);
    case YOU_TRACK:    return new YouTrackClient(credentials, objectMapper);
}
```

### IssueTrackerService

**File:** `ttt/service/service-impl/.../task/tracker/IssueTrackerService.java`

Key methods:
- `getTaskFromTracker(ticketUrl, project, requester)` — fetch task info from tracker
- `initClient(project, requester, canUseManagerCredentials)` — initialize tracker client with credentials
- `execute(trackerInfo, callable)` — execute tracker operations with error handling

### WebSocket Events for Sync

**Listener:** `WsTrackerSyncEventListener.java`
**Topic:** `/topic/projects/{projectId}/tracker-work-log`

Events:
- `TRACKER_SYNC_START` — published before sync begins
- `TRACKER_SYNC_FINISH` — published after completion

## Frontend — Planner Integration

### API Client

**File:** `frontend-js/src/modules/planner/ducks/api/projects.ts` (lines 143-158)

```typescript
export const requestSyncWorkLogInfo = (
    projectId: number,
    { date, employeeLogin, source }: { date: DateFormatAPI; employeeLogin: string; source: string }
) => Api.post<ProjectTrackerWorkLogSyncResponseDTO>(
    `/v1/projects/${projectId}/tracker-work-log/sync`,
    { date, employeeLogin, source }
);
```

### Two Sync Sagas

**Upload to Tracker** (`handleSyncWorkLogInfoWithTracker`, lines 900-988):
- Source: `'TTT'`
- Locks UI during sync
- Error handling: `exception.tracker.not.supported`, general errors
- Success notification: `planner.tracker.success`

**Download from Tracker** (`handleSyncProjectWithTracker`, lines 990-1096):
- Source: `'TRACKER'`
- Locks UI during sync
- Error handling: `exception.no.tracker.url.found`, `exception.tracker.not.supported`
- Success notification: `planner.tracker.hours_uploaded`

### UI Components

**ApproveActions.js** (lines 36-143) — Dropdown with two sync buttons:
```javascript
// "Upload to Tracker" button
result.push({
    label: t('planner.approve.upload_to_tracker'),
    onClick: handleSynchWorkLogClick,    // → syncWorkLogInfo saga
    disabled: isSomeEmployeeReadOnly,
});

// "Download from Tracker" button
result.push({
    label: t('planner.approve.download_from_tracker'),
    onClick: handleSynchClick,           // → syncWithTracker saga
});
```

**Tracker Header Components:**
- `TableProjectTrackerHeader.js` — Project-level "Refresh tickets" button (RefreshTicketsButton → `fetchProjectTasksRefresh`)
- `TableTrackerHeader.tsx` — Task-level "Refresh tickets" button (RefreshTicketsButton → `fetchTasksRefresh`)

### Three Distinct Tracker Buttons in UI

1. **"Refresh tickets"** (per-employee row icon) — refreshes task metadata only (name, status, ticket_info). Does NOT reload work logs.
2. **"Upload to Tracker"** (Actions dropdown) — sends TTT hours → external tracker
3. **"Download from Tracker"** (Actions dropdown) — pulls tracker hours → TTT

## Employee Tracker Credentials

**Controller:** `EmployeeTrackerCredentialsController.java`
**Base path:** `/v1/employees/current/settings/trackers`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Get tracker credentials (with optional query filter) |
| POST | `/` | Create tracker credentials |
| PATCH | `/` | Update credentials (requires trackerUrl param) |
| DELETE | `/` | Delete credentials (requires trackerUrl param) |

## Data Model

**tracker_work_log table** (222K rows, 52MB per schema deep-dive):
- External tracker hours imported from Jira/GitLab/ClickUp
- Fields: id, taskId, employeeId, date, trackerWorkLogId, effort, remainingEstimate, comment

## Known Bugs from GitLab Ticket Mining

### Critical / High Severity

| Ticket | Title | Status | Impact |
|--------|-------|--------|--------|
| #2511 | Jira PAT auth not supported | OPEN (3+ years) | Blocks all Jira PAT-only instances (e.g., Seagate) |
| #2338 | Refresh tickets intermittent failure | OPEN (4+ years) | Tracker timeout → entire refresh fails, no retry logic |
| #3296 | Approved status not cleared after import | OPEN | Data integrity: hours change but approval status stays |
| #3198 | Multiple projects can't share tracker | OPEN | Architecture limitation |

### Medium Severity

| Ticket | Title | Status | Impact |
|--------|-------|--------|--------|
| #2461 | GitLab Cloud hours import fails | OPEN | GitLab API timeouts, 500 errors, slow imports |
| #2488 | Task not linked cross-project | OPEN | Same tracker ticket can't link to multiple TTT projects |
| #3018 | Task name not updated after rename | OPEN | Cached name persists even after tracker rename |
| #3341 | ClickUp multi-space not supported | OPEN | Tasks from one ClickUp space can't be added |
| #3378 | Custom sync scripts on external cloud | OPEN | External dependency for tracker sync scripts |

### Resolved / Low Severity

| Ticket | Title | Status |
|--------|-------|--------|
| #2352 | SSL handshake failure (GitLab) | FIXED — SNI enabled |
| #2282 | Jira 1-minute worklog delay | Known limitation |
| #3238 | ClickUp URL change breaks export | FIXED |
| #3275 | Task not added from Projects tab | Can't reproduce |

### Documentation Ticket

**#3394** — "[Planner] Document current behaviour, tracker integration and add E2E tests"
- Massive spec request: English tech docs, UML diagrams, 10+ backend tests
- Contains detailed description of the three button behaviors (Refresh, Load, Upload)
- Key distinction: **Refresh** only updates metadata; **Load from tracker** also imports hours but only for tickets with worklogs on selected date

## Connection to Close-by-Tag

The close-by-tag feature was originally designed to trigger via "Update tickets" (tracker sync). After !5335, a separate `POST /v1/projects/{projectId}/close-tags/apply` endpoint was created, decoupling close-by-tag from tracker sync. However, the UI still triggers both features from the same Project Settings modal area.

## Test Priorities for Tracker Integration

1. Upload to tracker flow (source: TTT)
2. Download from tracker flow (source: TRACKER)
3. Refresh tickets (metadata-only sync)
4. Tracker credential CRUD
5. Error handling: tracker unavailable, timeout, auth failure
6. WebSocket TRACKER_SYNC_START/FINISH notifications
7. Cross-project task linking conflicts
8. Multiple tracker types (Jira, GitLab, ClickUp minimum)
