# Session Briefing

## Last Session: 91 — 2026-03-28
**Phase:** C (Autotest Generation)
**Scope:** planner
**Mode:** full autonomy

### Completed
- **TC-PLN-021 to TC-PLN-025 (TS-PLN-DnD suite)** — DnD reorder tests for Projects tab
  - TC-PLN-021: Drag task to reorder — **verified** (37.3s)
  - TC-PLN-022: DnD handles only in editing mode — **verified** (2.1m)
  - TC-PLN-024: Bug #3332 no duplicate rows after DnD — **verified** (1.8m)
  - TC-PLN-025: Bug #3314 order preserved after toggle — **verified** (1.7m)
  - TC-PLN-023: DnD order persists after reload — **failed** (genuine finding)

### Key Findings
- **TC-PLN-023 reveals real issue:** DnD task reorder does NOT persist after page reload. The order reverts to default sort. This indicates the DnD reorder is client-side only, or the backend save/re-read is broken. This is the behavior the test was designed to detect.
- **PlannerPage.ts enhanced** with 8+ new DnD methods: `enterProjectsEditMode()`, `allDndHandles()`, `dndEditableRows()`, `getFirstDndRowTaskNames()`, `dragTaskWithMouse()`, `dragTaskUp()`, `dragTaskDown()`, `getEmployeeHeaderRow()`, `getEmployeeOpenForEditingButton()`
- **enterProjectsEditMode()** fixed to skip disabled "Open for editing" buttons (some dates have disabled buttons)
- **getTaskNameFromRow()** made fault-tolerant with 5s timeout + try/catch
- **selectProject()** improved with explicit waitFor before option click
- **plannerQueries.ts** — added `findPMWithDndReadyEmployee` and `findPMWithTwoEmployees` query functions

### Infrastructure Improvements
- Mouse-based DnD for react-beautiful-dnd requires: 250ms after mousedown, 300ms threshold wait, 30-step slow drag, 500ms pre-drop, 800ms post-drop
- Projects tab can have 400-700+ DnD rows across all employees — must scope operations to limited row sets
- "Open for editing" buttons can be disabled on certain dates — filtering for enabled-only is required
- Project dropdown after page reload needs explicit waitFor on option visibility

### Progress
- Planner: 24 verified, 1 failed, 57 pending (25/82 = 30.5% covered)
- Next: TS-PLN-Lock suite (TC-PLN-026 to TC-PLN-030)

### State for Next Session
- Continue with session 92, next batch from TS-PLN-Lock suite
- All DnD page object methods are in place and working
- `enterProjectsEditMode()` handles disabled buttons correctly
