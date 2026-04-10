---
type: exploration
tags:
  - planner
  - frontend
  - redux
  - state-management
  - architecture
created: '2026-03-28'
updated: '2026-03-28'
status: active
related:
  - '[[modules/frontend-planner-module]]'
  - '[[exploration/ui-flows/planner-websocket-stomp-system]]'
  - '[[exploration/ui-flows/planner-lock-mechanism]]'
  - '[[exploration/data-findings/planner-assignment-ordering]]'
---
# Planner Redux State Architecture — 9 Slices

## Store Structure

```
RootState
  └── planner (combineReducers)
      ├── plannerTasks      — Task view data (PERSISTED to localStorage)
      ├── plannerProjects   — Project/manager view data
      ├── socketManager     — WebSocket connection state
      ├── tasks             — Task rename modal state
      ├── reports           — Employee report periods
      ├── focus             — Cell selection tracking
      ├── locks             — Cell lock management
      ├── tooltips          — Comment tooltip state
      └── assignments       — Assignment history (paginated)
```

**Root files:**
- `ducks/rootReducer.ts` — combines all 9 slice reducers
- `ducks/rootSaga.ts` — forks all slice sagas

## Root Saga

```typescript
export function* assignmentsRootSaga() {
    yield fork(watchSocketManagerRequests);     // Central WebSocket dispatcher
    yield fork(watchAssignmentsRequests);
    yield fork(watchPlannerProjectsRequests);
    yield fork(watchPlannerTasksRequests);
    yield fork(watchReportRequests);
    yield fork(watchFocusRequests);
    yield fork(watchLocksRequests);
}
```

## Slice Details

### 1. plannerTasks — Task View (62 action types, PERSISTED)

**Purpose:** Main planner table from employee perspective, grouped by project.
**Files:** `ducks/plannerTasks/{reducer,actions,selectors,sagas,helpers,constants,types}.ts`

**State shape:**
```typescript
{
    currentDay: DateFormatAPI,
    loading: boolean,
    historyIsVisible: boolean,
    initDateIsLoaded: boolean,
    isPendingRefresh: boolean,
    taskView: 'TASK' | 'TICKET',
    syncWorkLogInfoInProgress: boolean,
    syncWithTrackerIsInProgress: boolean,
    workLogsInfoEnabledByProjectId: Record<projectId, boolean>,
    hiddenGroups: Record<projectName, boolean>,     // Collapsed groups
    rowsById: Record<projectName, Record<assignmentId, MappedAssignment>>,
    rowsOrderByProject: Record<projectName, number[]>,
    rowsByTasksId: Record<taskId, MappedAssignment>,
    projectsSubscriptionsMap: Record<projectId, boolean>,
    newAssignmentId: number | null,
}
```

**Key selectors (26+):** `selectCurrentDay`, `selectTaskRowsById`, `selectTaskRowsOrderByProject`, `selectFlatTaskAssignments`, `selectTasksByProjectName`, `selectTotalEffortsByProject`, `selectReadonlyAssignments`, `selectHiddenGroups`, `selectSyncWorkLogInProgress`

**Persistence:** localStorage — persists currentDay, hiddenGroups, taskView, workLogsInfoEnabledByProjectId

### 2. plannerProjects — Project/Manager View (106 action types)

**Purpose:** Manager perspective, grouped by employee. Includes project member mgmt and close-by-tag.
**Files:** `ducks/plannerProjects/{reducer,actions,selectors,sagas,helpers,constants,types}.ts`
**Saga file:** 40KB — largest saga file in planner module.

**State shape:**
```typescript
{
    currentDay: DateFormatAPI,
    loading: boolean,
    projectUsers: ProjectMemberDTO[],
    projectTags: ProjectTagDTO[],           // Close-by-tag tags
    currentProject: ProjectDTO | null,
    employeeModal: boolean,                  // PlannerEmployeesModal
    employeeModalLoading: boolean,
    taskView: 'TASK' | 'TICKET',
    roleTypes: ProjectRolesType[],          // Current user's roles
    allRoleTypes: ProjectRolesType[],       // Available roles
    historyIsVisible: boolean,
    initDateIsLoaded: boolean,
    isPendingRefresh: boolean,
    workLogInfo: { enabled: boolean },
    syncWorkLogInfoInProgress: boolean,
    syncWithTrackerInProgress: boolean,
    rolesRestored: boolean,
    rowsById: Record<login, Record<assignmentId, MappedAssignment>>,
    rowsOrderByEmployee: Record<login, (string | number)[]>,
    rowsByTasksId: Record<taskId, Record<login, MappedAssignment>>,
    newAssignmentId: number | null,
}
```

**ProjectRolesType:** `SENIOR_MANAGER`, `MANAGER`, `MEMBER`

**Key selectors (40+):** `selectCurrentProject`, `selectProjectUsers`, `selectProjectTags`, `selectProjectRoleTypes`, `selectEmployeesModalVisibility`, `selectIsManagerOfCurrentProject`, `selectHasApprovedPermission`, `selectWorkLogInfoIsEnabled`

### 3. manager — WebSocket Connection Hub

**Purpose:** Central dispatcher routing all WebSocket events to appropriate slices.
**Files:** `ducks/manager/{reducer,actions,selectors,sagas,constants,types}.ts`

**State shape:**
```typescript
{
    users: string[],           // Connected user logins
    projects: string[],        // Subscribed project IDs
    connected: boolean,        // WebSocket connection status
    currentPage: 'tasks' | 'projects' | null,
}
```

**Topic types managed:** ADD, PATCH, DELETE, TASK_RENAME, GENERATE, SELECT, LOCK, UNLOCK, SORT

**Cross-slice routing:** See [[planner-websocket-stomp-system]] for full routing diagram.

### 4. focus — Cell Selection Tracking

**Purpose:** Real-time tracking of which cells other users are currently viewing/selecting.
**Files:** `ducks/focus/{reducer,actions,selectors,sagas,helpers,constants,types}.ts`

**State shape:**
```typescript
{
    selections: Record<string, Record<PlannerHeadersType, MappedSelection[]>>,
    selectionsByEmployee: Record<string, MappedSelection>,
    selectionsLogins: string[],
}
```

**MappedSelection fields:** ownerLogin, group, date, employeeLogin, label, taskId, column (effort/comment/remainingEstimate), color, isCurrentUserSelection, id, rowId

**Focus item types:** TASK, TASK_ASSIGNMENT, TASK_REPORT

### 5. locks — Cell Lock Management

**Purpose:** Prevents concurrent editing of the same cell by multiple users.
**Files:** `ducks/locks/{reducer,actions,selectors,sagas,helpers,constants,types}.ts`

**State shape:**
```typescript
{
    locks: Record<string, Record<FieldsToLockType, MappedLock>>,
    locksLogins: string[],
}
```

**Lockable fields:** `effort`, `comment`, `remainingEstimate`, `ALL_ROW`
**Auto-release:** 1 minute TTL if not refreshed
See [[planner-lock-mechanism]] for full backend+frontend details.

### 6. assignments — Assignment History

**Purpose:** Paginated history of a specific assignment's changes.
**Files:** `ducks/assignments/{reducer,actions,selectors,sagas,constants,types}.ts`

**State shape:**
```typescript
{
    history: {
        value: {
            taskName: string, taskId: number | null,
            page: number, totalPages: number,
            content: TaskAssignmentHistoryItemDTO[],
            employeeLogin: string, employeeName: string,
            sortDirection: TSortDirection,
            sortField: 'date' | 'effort' | 'comment' | 'remainingEstimate',
            totalHours: number,
        },
        isLoading: boolean,
    }
}
```

### 7. reports — Employee Report Periods

**Purpose:** Metadata about report periods (open/closed) used to determine editability.
**Files:** `ducks/reports/{reducer,actions,selectors,sagas,constants,types}.ts`

**State shape:**
```typescript
{
    employeesReportsPeriods: Record<employeeLogin, EmployeeReportPeriod>
}
```

**EmployeeReportPeriod fields:** employeeLogin, periodStart, periodEnd, status, canApprove, canModify

### 8. tasks — Task Rename Modal

**Purpose:** Simple UI state for the task rename dialog.
**Files:** `ducks/tasks/{reducer,actions,selectors,sagas,constants,types}.ts`

**State shape:**
```typescript
{
    modalTaskRename: boolean,
    taskRenameData: { taskId, taskName, projectId } | null,
    taskRenameLogin: string | null,
}
```

### 9. tooltips — Comment Tooltip

**Purpose:** Tooltip content for comment cells.
**Files:** `ducks/tooltips/{reducer,actions,selectors,constants,types}.ts`

**State shape:**
```typescript
{
    commentTooltip: string,
}
```

## Cross-Slice Data Flow

### Dual-View Architecture

`plannerTasks` and `plannerProjects` maintain **parallel data structures** for the same assignments:
- `plannerTasks.rowsById` — grouped by PROJECT name
- `plannerProjects.rowsById` — grouped by EMPLOYEE login

Both receive the same WebSocket events (ADD, PATCH, DELETE, GENERATE, SORT) routed by the manager saga. This means every assignment change updates both views simultaneously.

### WebSocket Event Flow

```
manager saga (central dispatcher)
    ├─→ plannerTasks saga (task view updates)
    ├─→ plannerProjects saga (project view updates)
    ├─→ focus saga (selection updates)
    ├─→ locks saga (lock updates)
    └─→ assignments saga (history updates)
```

### API Layer

**Files:** `ducks/api/{assignments,projects,reports,focus,periods,calendar}.ts`

All backend communication through dedicated API modules:
- `assignments.ts` — assignment history, CRUD
- `projects.ts` — projects, users, roles, tags, work log sync, close-tags apply
- `reports.ts` — employee report periods
- `focus.ts` — cell selections
- `periods.ts` — calendar periods
- `calendar.ts` — vacation/sick/weekend calendar

## Key Architectural Patterns

1. **Duck pattern** — each slice is self-contained: reducer + actions + selectors + sagas + types
2. **Redux-saga exclusively** for async — no thunks, no RTK Query
3. **Manager as event bus** — all WebSocket events pass through manager saga
4. **Normalized state** — assignments indexed by ID within groups
5. **Persisted slice** — only plannerTasks persists to localStorage (UI preferences)
6. **Complementary tracking** — focus (selections) and locks track the same cells independently
7. **Debounced generation** — GENERATE WebSocket events debounced to prevent excessive re-renders

## Statistics

- **Total action types:** ~240+ across all slices (62 + 106 + ~72 others)
- **Total selectors:** ~100+
- **Saga files:** 7 saga files, largest is plannerProjects at 40KB
- **API modules:** 6 API files under ducks/api/
