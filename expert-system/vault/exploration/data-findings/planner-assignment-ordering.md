---
type: exploration
tags: [planner, assignment-ordering, linked-list, drag-and-drop, next-assignment]
created: 2026-03-28
updated: 2026-03-28
status: active
related: ["[[planner-module]]", "[[planner-data-model]]", "[[planner-dnd-bugs-analysis]]"]
branch: release/2.1
---
# Planner Assignment Ordering — Linked-List System

## Data Model

### Database Schema
The `task_assignment` table uses a **dual ordering system**:
```sql
next_assignment BIGINT NULL    -- Linked-list pointer to next assignment's ID (NULL = end of chain)
position INTEGER               -- Secondary index-based position (added in DB v2.1.2)
```
New assignments created with `position = 0`.

### Java Entity
```java
// TaskAssignment.java
@Column(name = "next_assignment")
private Long nextAssignmentId;

@Column(name = "position")
private Integer position;
```

### API DTO
```java
// TaskAssignmentUpdateNextRequestDTO
private Long nextAssignmentId;  // Target position for reordering
```

## Backend Ordering Logic

### Core Method: `InternalTaskAssignmentService.move()` (lines 288-347)

```
1. Fetch all assignments for employee on date
2. Sort via TaskAssignmentSorter.sort()
3. Remove assignment from current position
4. Insert at position indicated by nextAssignmentId (null = end)
5. Rebuild linked-list chain:
   for i in 0..n-1:
     assignment[i].nextAssignmentId = assignment[i+1].id (or null for last)
     assignment[i].position = i
6. Save all modified assignments atomically
7. Call moveFutureAssignmentsAccordingly() for cascade
```

### TaskAssignmentSorter.sort() (lines 16-40)
```
1. Separate assignments: positioned (non-null position) vs unpositioned
2. Sort positioned by position, then by task name as tiebreaker
3. Add unpositioned at the beginning, sorted by task name
4. Handles mixed ordered/unordered state gracefully
```

### Future Date Cascade: `moveFutureAssignmentsAccordingly()` (lines 363-413)
When an assignment is reordered on date X, the same task's assignments on ALL future dates are repositioned to match. This maintains cross-date consistency when drag-and-drop occurs.

**Potential issue:** May not always be intended — if an employee has different task priorities on different days, cascading destroys that.

## Frontend State Management

### Normalized State Structure
```typescript
// Redux state
mapOfGroupOrders: {        // Assignment ID arrays per project group
    [groupKey]: number[]   // Represents the linked-list order
}
mapOfGroupMaps: {          // Assignment objects indexed by ID
    [groupKey]: {
        [assignmentId]: AssignmentObject
    }
}
sortIndex: number          // Position in the order array
```

### Order Reconstruction (sortAssignments.js, lines 19-44)
Recursive traversal of `nextAssignmentId` chain when assignments arrive out-of-order from API. Starts from end of list and reconstructs array backwards.

### State Normalization (normalizeAssignments.ts, lines 13-67)
API response is pre-ordered by backend. Frontend creates `sortIndex` from array position and builds O(1) lookup maps.

## Drag-and-Drop Flow

```
1. User drags row (react-beautiful-dnd)
2. handleSortAssignments() saga triggered
3. Extract: nextAssignmentId = itemTo?.id || 0 (0 = end of list)
4. API call: PATCH /v1/assignments/{id} with {nextAssignmentId, employeeLogin}
5. Backend: move() → linked-list rebuild → save → cascade to future dates
6. WebSocket: broadcast PATCH event
7. Other clients: updateAssignment.js recalculates sortIndex
```

### Conflict Handling
Server may respond with `409 Conflict` if assignments already exist at target position. Frontend saga includes retry logic.

## WebSocket Event Processing

### PATCH Event (updateAssignment.js, lines 40-77)
- Receives new `nextAssignmentId` value
- Recalculates `sortIndex` for moved assignment
- Updates all subsequent assignments' `sortIndex`
- Immutable state updates

### DELETE Event (deleteAssignment.js, lines 1-45)
- Removes from order array
- Decrements `sortIndex` for all assignments after deleted item

## Creation Flow

```
insertAssignmentByTaskWorker() saga (lines 50-110):
  1. POST /v1/assignments with nextAssignmentId parameter
  2. Backend applies order immediately
  3. Frontend receives ADD WebSocket event
  4. State updated with new assignment in correct position
```

## Known Issues and Edge Cases

1. **DnD duplicate bug (#3332):** `generateTaskAssignments.ts` line 90 appends new ID to order array without removing old ID. Old assignment deleted from map but not from order → duplicate rows rendered.

2. **Order reset bug (#3314):** `TasksPlannerTable.tsx` `useEffect` re-sorts by `readOnly` status on EVERY state change. "Open for editing" flips readOnly → `.sort()` destroys DnD order. `return 0` for equal elements doesn't guarantee stability.

3. **Future date cascade may be unwanted:** Reordering on Monday cascades to Tuesday through Friday, even if employee intended different ordering per day.

4. **Mixed ordered/unordered state:** Legacy assignments without `position` field handled gracefully by sorter, but placed at beginning rather than end.

5. **Rapid DnD operations:** Can cause out-of-order WebSocket events. Mitigated by recursive reconstruction algorithm in sortAssignments.js.

6. **Position field dual purpose:** Serves as both sort index and for position-based queries — can be confusing.

## Data Consistency Guarantees

- **Atomic updates:** Backend saves all assignments in single transaction
- **Linked-list rebuild:** Every save rebuilds complete chain (positions 0 to n-1)
- **Cascade atomicity:** Future date changes saved with current date changes
- **State normalization:** Frontend state always matches linked-list order from backend