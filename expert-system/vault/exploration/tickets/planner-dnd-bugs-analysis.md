---
type: investigation
tags:
  - planner
  - dnd
  - frontend-bug
  - t3332
  - t3314
  - ordering
created: '2026-03-28'
updated: '2026-03-28'
status: active
related:
  - '[[exploration/tickets/t2724-investigation]]'
  - '[[modules/frontend-planner-module]]'
  - '[[exploration/tickets/planner-ticket-findings]]'
---
# Planner DnD Bugs — Root Cause Analysis

## Overview

Two related frontend bugs in the planner module stem from improper state management when assignments are generated or readonly status changes. Both involve the `filteredRowsOrder` state in `TasksPlannerTable.tsx` and the `generateTaskAssignments.ts` service.

## Bug #3332 — DnD Creates Duplicate Task Rows

**Ticket:** https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3332
**State:** Open, To Do
**Evidence:** Video showing duplicate entries after drag reorder

### Root Cause

**File:** `frontend-js/src/modules/planner/services/plannerTasks/generateTaskAssignments.ts`

When a WebSocket `TaskAssignmentGenerateEvent` arrives (e.g., after "Open for editing"), the function:
1. Deletes old assignment from the **map** (line 47: `delete newMap[groupKey][oldId]`)
2. Creates new entry with new ID in the map (lines 49-56)
3. **APPENDS** new ID to the **order array** (line 90: `newOrder[groupKey].push(newId)`)

**The bug:** The old ID is removed from the map but **NOT removed from the order array**. So `newOrder[groupKey]` contains BOTH the orphaned old ID and the newly pushed ID. The UI renders both entries — one as the actual assignment, one as a ghost/duplicate.

### Commented-Out Fix
The developer was aware of the correct approach (lines 81-85, commented out):
```javascript
// todo this code is kept until the testing is finished
// newOrder[groupKey].splice(sortIndex, 1, newId);
```
This `splice(sortIndex, 1, newId)` would REPLACE the old ID at its position with the new ID. But it's commented out with a "kept until testing is finished" note — suggesting it was intentionally deferred.

### Correct Fix
```javascript
// Instead of line 90:
// newOrder[groupKey].push(newId);

// Should be:
const oldIndex = newOrder[groupKey].indexOf(oldId);
if (oldIndex !== -1) {
  newOrder[groupKey] = [...newOrder[groupKey]];
  newOrder[groupKey][oldIndex] = newId;  // Replace at same position
} else {
  newOrder[groupKey].push(newId);  // Append only if not found
}
```

---

## Bug #3314 — Task Order Resets on "Open for Editing"

**Ticket:** https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3314
**State:** Open, To Do
**Confirmed:** Backend returns correct order (verified by jsaidov) — this is frontend-only.

### Root Cause

**File:** `frontend-js/src/modules/planner/containers/tasks/TasksPlannerTable.tsx` (lines 80-128)

The `useEffect` hook runs whenever `rowsMap` or `rowsOrder` changes for a project group. It:
1. **Filters** closed assignments (lines 102-106): `.filter(itemUuid => !rowsMap[groupName][itemUuid]?.closed)`
2. **Sorts** by readonly status (lines 108-121): readonly items go to bottom, non-readonly to top

```javascript
.sort((first, second) => {
  const isFirstReadOnly = rowsMap[groupName]?.[first]?.readOnly;
  const isSecondReadOnly = rowsMap[groupName]?.[second]?.readOnly;
  if ((isFirstReadOnly && isSecondReadOnly) || (!isFirstReadOnly && !isSecondReadOnly))
    return 0;  // Equal → position not guaranteed
  if (isFirstReadOnly) return 1;  // Readonly goes down
  return -1;  // Non-readonly goes up
});
```

**The bug:** When "Open for editing" changes an employee's `readOnly` from `true` to `false`:
1. The assignment objects in `rowsMap` get new references (readOnly changes)
2. The `useEffect` triggers because `newGroupObject !== oldGroupObject`
3. The `.sort()` re-sorts ALL assignments by readonly status
4. Any DnD-ordered items within the same readonly category (both `return 0`) are NOT guaranteed to maintain their relative order — JavaScript's `Array.sort()` is not required to be stable for equal elements in all engines
5. Result: user's DnD ordering is destroyed

### Additional Factor
The `.sort()` runs on EVERY assignment map change, not just readonly changes. So any WebSocket event that modifies any assignment in the group triggers a full re-sort, potentially disrupting DnD order.

### Correct Fix
Either:
1. Remove the readonly sort entirely (let backend handle ordering)
2. Use a stable sort that preserves insertion order for equal elements
3. Track readonly sort separately from DnD order — apply readonly grouping only on initial load, not on updates

---

## Relationship Between the Two Bugs

Both bugs share a common root cause: **the frontend re-processes assignment ordering on every state change**, destroying user-initiated DnD positions.

- **#3332**: Assignment generation adds new ID without removing old → duplicate
- **#3314**: Assignment state change triggers sort → DnD order lost

The bugs can compound: if DnD generates a new assignment (#3332 creates duplicate), and then the user switches "Open for editing" (#3314 re-sorts), the result is both duplicated AND reordered rows.

## Files Involved

| File | Role |
|------|------|
| `services/plannerTasks/generateTaskAssignments.ts` | #3332: order array append vs replace |
| `containers/tasks/TasksPlannerTable.tsx` | #3314: useEffect re-sort on state change |
| `containers/tasks/TaskTableContainer.js` | DnD dispatch: `sortAssignments` action |
| `ducks/assignments/sagas.ts` | Backend call: PATCH `/v1/assignments/{id}` with nextAssignmentId |
| `ducks/plannerTasks/helpers.ts` | Normalization helpers |
| `ducks/plannerTasks/reducer.ts` | State management for assignment maps |
| `components/PlannerEmployeesModal/PlannerEmployeesList.js` | Member DnD (separate from task DnD) |

## Testing Implications

For [[exploration/tickets/t2724-investigation]]:
- Close-by-tag apply may trigger `TaskAssignmentPatchEvent` or `TaskAssignmentGenerateEvent`
- These events update `rowsMap` → triggering the #3314 re-sort
- If apply creates closed generated assignments, the order may shift as closed items are filtered out
- Test cases should verify that applying close-by-tag doesn't visually disrupt remaining task order
