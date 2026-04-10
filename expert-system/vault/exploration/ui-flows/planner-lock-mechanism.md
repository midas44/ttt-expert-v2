---
type: exploration
tags: [planner, lock, concurrent-editing, websocket, caffeine-cache]
created: 2026-03-28
updated: 2026-03-28
status: active
related: ["[[planner-module]]", "[[planner-close-by-tag-implementation]]", "[[planner-data-model]]"]
branch: release/2.1
---
# Planner Lock Mechanism — Concurrent Editing Protection

## Architecture Overview

The planner implements a **distributed, time-based concurrent editing protection system** that prevents multiple users from editing the same cell simultaneously. It uses:
- REST API for lock acquisition/release
- WebSocket (STOMP) for real-time lock/unlock broadcasting
- In-memory Caffeine cache (backend) — NO database persistence
- Redux state (frontend)

## Data Model

### Backend — LockBO
```java
// LockBO extends CellBO
class LockBO {
    String lockOwnerLogin;     // User holding the lock
    LocalDateTime timestamp;   // Auto-set to now()
    CellType type;             // TASK, TASK_REPORT, TASK_ASSIGNMENT
    EntityKeyBO key;           // {employeeLogin, taskId, date}
    String fieldName;          // effort, remainingEstimate, comment
}
```

### Frontend — MappedLock
```typescript
interface MappedLock {
    employeeLogin?: string;
    ownerLogin: string;
    taskId: number;
    date: DateFormatAPI;       // YYYY-MM-DD
    isCurrentUserLock: boolean;
    column: FieldsToLockType;  // effort | remainingEstimate | comment
    id: string;
    rowId: string;
}
```

### Lockable Fields
```typescript
FIELDS_TO_LOCK = {
    [ALL_ROW]: ALL_ROW,        // Entire row (legacy?)
    effort: 'effort',           // TaskReport.effort
    remainingEstimate: 'remainingEstimate',  // TaskAssignment.remainingEstimate
    comment: 'comment',         // TaskAssignment.comment
}
```

## API Endpoints

| Method | Endpoint | Behavior | Response |
|--------|----------|----------|----------|
| POST | `/v1/locks` | Create/Update locks (replace mode) | Set of LockDTOs |
| DELETE | `/v1/locks` | Delete ALL current user's locks | 204 |
| GET | `/v1/locks?startDate=&endDate=&employeeLogin=` | Search locks | Set of LockDTOs |

**POST replace-mode behavior:** If user holds locks {A, B} and POSTs {B, C}, result is: A removed, B kept, C added. Replacement is atomic within a synchronized block.

**Error responses:**
- `200 OK` — lock operation succeeded
- `403 Forbidden` — no permission to lock this cell
- `423 Locked` — cell already locked by another user ("Locked by jane.smith at 2025-01-15T10:23:45")

## Lock Lifecycle Flow

### 1. User Clicks Cell → Lock Acquired
```
UI: onCellFocus → dispatch(addLocked({taskId, fieldName, employeeLogin, date}))
  → Saga: POST /v1/locks
  → Backend: LockServiceImpl.create()
    → canLock(cell, login) — check lockByCell map
    → Permission check (EDIT or APPROVE for reports, EDIT for assignments)
    → Store in Caffeine cache + 3 lock maps
    → Publish LockEvent via ApplicationEventPublisher
  → WebSocket: WsLockEventListener broadcasts to /topic/employees/{login}/locks
  → Other clients: receive LOCK event → update Redux state
```

### 2. User Leaves Cell → Lock Released
```
UI: onCellEnd → dispatch(removeLocked())
  → Saga: DELETE /v1/locks
  → Backend: LockServiceImpl.delete()
    → Remove from all maps + cache
    → Publish UnlockEvent
  → WebSocket: broadcast UNLOCK event
```

### 3. Page Unload
```javascript
// TaskTableContainer.js — beforeunload handler
useEffect(() => {
    const handleBeforeUnload = () => removeLocked();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        removeLocked();
    };
}, [removeLocked]);
```

## Backend Concurrency Control

### Layer 1: Java Synchronized Locks per Employee
```java
private final Map<String, Object> syncLocksByEmployeeLogin = new ConcurrentHashMap<>();

synchronized (getOrCreateSyncLock(currentEmployeeLogin)) {
    validateLocks(locks);  // Check ALL before making changes
    // Atomic: delete old + add new
}
```

### Layer 2: Caffeine Cache with TTL (60s default)
```java
Cache<String, Set<LockBO>> locksByEmployeeLogin = Caffeine.newBuilder()
    .maximumSize(1_000)
    .expireAfterWrite(ttl, TimeUnit.SECONDS)  // Default 60s
    .removalListener((key, value, cause) -> {
        if (cause.wasEvicted()) {
            synchronized (getOrCreateSyncLock(key)) {
                removeLocks(value);
            }
        }
    })
    .build();
```

### Layer 3: Hard Deadline Cleanup (10 minutes)
```java
@Scheduled(cron = "*/10 * * * * *")  // Every 10 seconds
@SchedulerLock(name = "LockServiceImpl.cleanUpCache")
public void cleanUpCache() {
    // Remove locks older than 10 minutes
    if (ChronoUnit.MINUTES.between(lock.getTimestamp(), now) > 10) {
        log.warn("[LOCK GOT STUCK] Removing...");
    }
}
```

### Layer 4: Three Maps for Fast Lookup
```java
Map<String, Set<LockBO>> tasksLocks;
Map<String, Set<LockBO>> taskReportsLocks;
Map<String, Set<LockBO>> taskAssignmentsLocks;
Map<CellBO, LockBO> lockByCell;  // For O(1) conflict detection
```

## Frontend Redux State

```typescript
state.planner.locks = {
    LOCKS: {           // LocksMapByRow
        [rowId]: {
            effort: MappedLock {},
            remainingEstimate: MappedLock {},
            comment: MappedLock {}
        }
    },
    LOCKS_LOGINS: ['john.doe', 'jane.smith']  // Users with active locks
}
```

## WebSocket Subscription

**Topic:** `/topic/employees/{employeeLogin}/locks`

**Event types:** `LOCK`, `UNLOCK`

**Payload:** Array of LockBO objects with lockOwnerLogin, timestamp, type, fieldName, key

## Key Files

| File | Role |
|------|------|
| `LockController.java` | REST endpoints (POST/DELETE/GET /v1/locks) |
| `LockServiceImpl.java` (539 lines) | Core logic: create, delete, validate, cleanup |
| `LockServiceProperties.java` | TTL configuration |
| `WsLockEventListener.java` | WebSocket event broadcaster |
| `locks/sagas.ts` | API calls + WebSocket event handling |
| `locks/reducer.ts` | Redux state management |
| `locks/helpers.ts` | LockDTO → MappedLock mapping |
| `TaskTableContainer.js` | UI integration (onCellFocus/onCellEnd) |
| `ProjectTableContainer.js` | Same pattern for project view |

## Race Conditions and Known Issues

1. **Clock skew:** If server clock jumps backward (NTP), stuck lock detection via `ChronoUnit.MINUTES.between()` could return negative. No safeguard.
2. **Cache eviction overlap:** Brief 423 conflicts possible during Caffeine eviction if another user simultaneously tries to lock the same cell. Mitigated by per-user synchronized blocks.
3. **WebSocket event ordering:** Rapid lock/unlock can cause out-of-order events. Frontend filters by `currentDay` to mitigate.
4. **No persistence:** All locks lost on backend restart — intentional to prevent zombie locks, but means active editors lose their locks silently.
5. **Replace-mode atomicity:** Validation + replacement happen inside sync block, preventing interleaving. But between cache eviction and new lock creation, brief window exists.

## Important Design Decisions

- **In-memory only** — locks NOT persisted to database (safety: prevents zombies)
- **60s TTL** — auto-expire prevents "walked away from computer" lock hoarding
- **10min hard deadline** — catches any lock that survived cache eviction
- **Per-employee synchronization** — not per-cell, so different users can lock different cells concurrently
- **Replace semantics on POST** — allows atomic "switch which cell I'm editing" without explicit unlock+lock sequence