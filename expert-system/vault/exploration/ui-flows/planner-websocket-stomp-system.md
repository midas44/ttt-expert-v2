---
type: exploration
tags:
  - planner
  - websocket
  - stomp
  - real-time
  - backend
  - frontend
  - architecture
created: '2026-03-28'
updated: '2026-03-28'
status: active
related:
  - '[[modules/frontend-planner-module]]'
  - '[[exploration/ui-flows/planner-lock-mechanism]]'
  - '[[exploration/ui-flows/planner-tracker-integration]]'
  - '[[exploration/data-findings/planner-redux-state-architecture]]'
---
# Planner WebSocket/STOMP Real-Time Event System

## Architecture Overview

```
┌─ BACKEND ──────────────────────────────────────────────────┐
│ Service publishes domain event (ApplicationEventPublisher) │
│      ↓                                                      │
│ @TransactionalEventListener (Ws*EventListener)             │
│      ↓                                                      │
│ *EventService.send(event) → AbstractEventService           │
│      ↓                                                      │
│ WebsocketService.sendEvent(destination, Event<T>)          │
│  (SimpMessagingTemplate.convertAndSend)                    │
│      ↓                                                      │
│ STOMP Broker routes to /topic/employees/{login}/*          │
└────────────────────────────────────────────────────────────┘
                        ↓ NETWORK (WebSocket)
┌─ FRONTEND ─────────────────────────────────────────────────┐
│ useSocketSubscriptions → stompClient.subscribe()           │
│      ↓                                                      │
│ onChange callback with parsed frame.body                    │
│      ↓                                                      │
│ manager/sagas.ts routes by subscriptionType + EventType    │
│      ↓                                                      │
│ Feature sagas (plannerTasks, locks, focus, etc.)           │
│      ↓                                                      │
│ Reducers update state → React re-renders                   │
└────────────────────────────────────────────────────────────┘
```

## Backend Configuration

### WebsocketConfig.java

**File:** `ttt/websocket/.../configuration/WebsocketConfig.java`
- `@EnableWebSocketMessageBroker`
- STOMP endpoints: `/ws` (native WebSocket, CORS allowed) + `/sockjs` (SockJS fallback, CDN `sockjs-client@1.4.0`)
- Message broker: `enableSimpleBroker("/topic")` — in-memory routing

### WebsocketBrokerConfig.java

**File:** `ttt/websocket/.../configuration/WebsocketBrokerConfig.java`
- Intercepts STOMP CONNECT commands
- Extracts JWT or API tokens from STOMP headers: `TTT_JWT_TOKEN`, `API_TOKEN`
- Authenticates via Spring Security
- Throws `AccessDeniedException` if no valid token

### WebsocketSecurityConfig.java

**File:** `ttt/websocket/.../configuration/WebsocketSecurityConfig.java`
- `CONNECT` and `UNSUBSCRIBE` allowed without authentication
- All `/topic/**` subscription destinations require authentication
- All other messages denied by default

## Event Types

### EventType Enum

```java
GENERATE, TASK_RENAME, TASK_REFRESH_START, TASK_REFRESH_FINISH,
TRACKER_SYNC_START, TRACKER_SYNC_FINISH, LOCK, UNLOCK, SELECT,
ADD, PATCH, DELETE
```

### Event Envelope

```java
// Event.java — generic wrapper
public class Event<T> {
    EventType type;        // Event category
    String emitterLogin;   // User who triggered
    long timestamp;        // Event timestamp
    T value;               // Payload (varies by type)
}
```

## Topic Subscriptions

All topics follow pattern: `/topic/employees/{login}/{subscriptionType}`

| Topic | Subscription Type | Event Types | Listener Class |
|-------|-------------------|-------------|----------------|
| `/topic/employees/{login}/assignments` | ASSIGNMENTS | ADD, PATCH, DELETE, GENERATE | WsTaskAssignmentEventListener |
| `/topic/employees/{login}/reports` | REPORTS | ADD, PATCH, DELETE | (via TaskReportEventService) |
| `/topic/employees/{login}/tasks` | TASKS | TASK_RENAME, TASK_REFRESH_START, TASK_REFRESH_FINISH | WsTaskEventListener |
| `/topic/employees/{login}/selections` | SELECTIONS | SELECT | WsSelectionEventListener |
| `/topic/employees/{login}/locks` | LOCKS | LOCK, UNLOCK | WsLockEventListener |
| `/topic/projects/{projectId}/tracker-work-log` | (project-level) | TRACKER_SYNC_START, TRACKER_SYNC_FINISH | WsTrackerSyncEventListener |

## Backend Event Listeners (6 total)

### WsTaskAssignmentEventListener

**File:** `ttt/websocket/.../listener/WsTaskAssignmentEventListener.java`
- Listens to: `TaskAssignmentPatchEvent`, `TaskAssignmentGenerateEvent`, `TaskAssignmentAddEvent`, `TaskAssignmentDeleteEvent`
- Delegates to: `TaskAssignmentEventService.send(event)`
- Destination: `/topic/employees/{assigneeLogin}/assignments`

**Payload classes:**
- `TaskAssignmentPatchEventPayload` — fields: id, task, remainingEstimate, comment, internalComment, uiData, nextAssignmentId, closed, updatedTime
- `TaskAssignmentGenerateEventPayload` — list of generated assignments

### WsLockEventListener

- Destination: `/topic/employees/{employeeLogin}/locks`
- Events: LOCK, UNLOCK
- Payload: `Set<LockBO>`

### WsSelectionEventListener

- Destination: `/topic/employees/{employeeLogin}/selections`
- Events: SELECT
- Payload: `SelectionBO`

### WsTaskEventListener

- Destination: `/topic/employees/{employeeLogin}/tasks`
- Events: TASK_RENAME, TASK_REFRESH_START, TASK_REFRESH_FINISH

### TaskReportEventService

- Destination: `/topic/employees/{employeeLogin}/reports`
- Events: ADD, PATCH, DELETE

### WsTrackerSyncEventListener

- Destination: `/topic/projects/{projectId}/tracker-work-log`
- Events: TRACKER_SYNC_START, TRACKER_SYNC_FINISH

## Frontend WebSocket Client

### useSocketClient.js

**File:** `frontend-js/src/modules/planner/components/SocketManager/hooks/useSocketClient.js`

```javascript
// Protocol detection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
// Dev port: 8577, production: via NGINX
const port = isLocalhost ? ':8577' : '';

// STOMP client config
const client = new Client({
    brokerURL: `${protocol}//${host}${port}/ws`,
    connectHeaders: { TTT_JWT_TOKEN: token },
    reconnectDelay: 500,    // Auto-reconnect after 500ms
    onConnect: successCallback,
    onStompError: errorCallback,
});

// Fallback to SockJS if native WebSocket unavailable
client.webSocketFactory = () => new SockJS(`${httpProtocol}//${host}${port}/sockjs`);
client.activate();
```

### useSocketSubscriptions.js

**File:** `frontend-js/src/modules/planner/components/SocketManager/hooks/useSocketSubscriptions.js`

Subscribes to 5 topics per user:
1. `/topic/employees/{user}/assignments` → ADD/PATCH/DELETE/GENERATE
2. `/topic/employees/{user}/reports` → report changes
3. `/topic/employees/{user}/tasks` → task renames
4. `/topic/employees/{user}/selections` → cell selections
5. `/topic/employees/{user}/locks` → lock/unlock

Subscription IDs: `{user}-{subscriptionType}`
Triggers `onChange` callback with parsed event data.

### SocketManager.js + socketState.js

**File:** `frontend-js/src/modules/planner/components/SocketManager/`

- `SocketManager.js` — React component wrapping entire planner module
- `socketState.js` — Context provider using React Context + useReducer
- Hooks: `useSocketClient` (STOMP init) + `useSocketSubscriptions` (per-user) + `useSocketProjectsSubscriptions` (per-project)

## Frontend Event Routing

### manager/sagas.ts — Central Event Dispatcher

**File:** `frontend-js/src/modules/planner/ducks/manager/sagas.ts`

Routes WebSocket events by `subscriptionType` and `EventType`:

```
WebSocket Event
    ↓
watchSocketManagerRequests()
    ├── subscriptionType.ASSIGNMENTS
    │   ├── ADD → actions.addNewAssignment()
    │   ├── PATCH → actions.updateAssignment()
    │   ├── DELETE → actions.deleteAssignment()
    │   ├── SORT → actions.sortAllAssignment()
    │   └── GENERATE → actions.webSocketGenerateAssignmentsForCurrentUserReaction()
    ├── subscriptionType.REPORTS
    │   ├── DELETE → deleteTaskReport()
    │   ├── PATCH → updateTaskReport()
    │   └── ADD → addTaskReport()
    ├── subscriptionType.TASKS
    │   └── TASK_RENAME → renameAction()
    ├── subscriptionType.SELECTIONS
    │   └── SELECT → updateSelect()
    └── subscriptionType.LOCKS
        ├── LOCK → updateLock()
        └── UNLOCK → unlockEvent()
```

Events are dispatched to BOTH `plannerTasks` and `plannerProjects` slices (dual-view architecture).

## Authentication Flow

1. Client reads JWT from `localStorage` (`LocalStorageService.getItem('id_token')`)
2. Sent as STOMP header `TTT_JWT_TOKEN` during CONNECT
3. Server validates during STOMP CONNECT phase (WebsocketBrokerConfig)
4. All `/topic/**` subscriptions require authenticated session

## Key Design Details

- **In-memory broker** — Spring's SimpleBroker, no external message queue
- **Auto-reconnect** — 500ms reconnect delay on disconnect
- **Per-user topics** — each user subscribes to their own login-scoped topics
- **Project-level topics** — tracker sync events broadcast per-project (all viewers see sync status)
- **SockJS fallback** — for environments where native WebSocket is blocked
- **Event deduplication** — GENERATE events processed with debouncing in frontend sagas
- **Transaction safety** — `@TransactionalEventListener` ensures events published only after successful DB commit

## Statistics

- **Backend listeners:** 6 event listener classes
- **Frontend topics per user:** 5 (assignments, reports, tasks, selections, locks)
- **Event types:** 12 enum values
- **Redux actions dispatched:** 15+ connected to WebSocket events
- **STOMP endpoints:** 1 WebSocket (`/ws`) + 1 SockJS fallback (`/sockjs`)
