---
type: investigation
tags:
  - planner
  - close-by-tag
  - sprint-15
  - t2724
  - backend
  - frontend
  - qa-findings
created: '2026-03-27'
updated: '2026-03-28'
status: active
related:
  - '[[modules/planner-assignment-backend]]'
  - '[[modules/frontend-planner-module]]'
  - '[[investigations/planner-close-by-tag-implementation]]'
  - '[[modules/planner-close-tag-permissions]]'
  - '[[exploration/tickets/planner-ticket-findings]]'
---
# Ticket #2724 — Close-by-Tag Deep Investigation

## Ticket Overview

**URL:** https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/2724
**Title:** [CRITICAL] [Planner] [Projects] [Project Settings] Choosing labels for automatic task closing
**State:** opened (Ready to Test)
**Labels:** Planner, Ready to Test, Sprint 15
**Author:** Alexander Malcev (amalcev), created 2023-08-29
**Assignee:** Vladimir Ulyanov (vulyanov)
**Parent module:** planner

## Ticket Evolution

This ticket evolved significantly over 3 years:

### Phase 1 — Performance Complaint (2023-08-29 → 2025-11-28)
**Original problem:** Extreme performance issues in Planner for `DirectEnergie-ODC` project — lag, crashes, slow scrolling, white/grey empty spaces, high CPU/RAM consumption. Employees on that project get ~10 new task assignments per day from tracker sync, but nobody cleans them up → table grows indefinitely.

Key comments:
- amalcev (2023-08): Suspected solving #2408 would help
- amalcev (2023-09): Performance worsened during status meetings, scrolling takes forever, opening links ~10s, returning = eternal white screen
- amalcev (2024-04): Still blocking, requested ASAP fix
- amalcev (2025-03): "Still impossible to work. Consumes a lot of RAM and CPU."
- amalcev (2025-06): "Any updates?"

### Phase 2 — Performance Analysis (2025-08)
jsaidov (note 872576) identified the root cause via DevTools:
- **N+1 API pattern**: frontend calls backend individually for each project member
- `GET /v1/assignments?endDate=...&projectId=1225&startDate=...` called 3 times simultaneously
- `GET /vacation/v1/employee-dayOff`, `GET /vacation/v1/vacations`, `GET /vacation/v1/sick-leaves` each called twice
- "requires design changes... avoiding multiple calls to the same API... using pagination or batch fetch"

### Phase 3 — Architecture Decision (2025-11-28)
vulyanov (note 890145) proposed two approaches:
1. **Quick fix:** automatic task filtering — show only tasks with reports in current open confirmation period. But breaks normal assignment functionality.
2. **Fundamental:** revisit assignment functionality, remove it or sync with tracker properly.

### Phase 4 — Feature Implementation (2026-03)
Solution evolved into "close-by-tag" feature — PM/SPM can add labels that automatically close matching assignments.

## Merge Requests — Complete List

| MR | Branch | Merged | Summary |
|----|--------|--------|---------|
| !5289 | `ishumchenko/#2724-critical-1` | ~2026-03-10 | Initial backend: close-tag CRUD (GET, POST, DELETE), DB migration, permission model |
| !5301 | `ishumchenko/#2724-critical-2` | ~2026-03-12 | Backend: added PATCH endpoint (v3), frontend: Project Settings modal with tabs |
| !5293/!5299 | (earlier MRs) | ~2026-03-10 | Related changes (backend foundations) |
| !5313 | `ishumchenko/#2724-critical-3` | 2026-03-18 | OK button added to Tasks Closing tab, column header label fix, refresh action refactor |
| !5335 | `ishumchenko/#2724-critical-4` | 2026-03-25 | **Core Apply feature**: new `POST /v1/projects/{projectId}/close-tags/apply` endpoint, Redux saga, window.location.reload() |
| !5339 | `ishumchenko/#2724-critical-5` | 2026-03-25 | UX: loading spinner during apply, synthetic DOM event hack for dialog dirty-state |
| !5341 | `ishumchenko/#2724-critical-6` | 2026-03-26 | Both tabs use same OK handler, empty-tags guard, onClose removed |

## QA Testing Findings (vulyanov, March 2026)

### Bug 1 — Popup closing issue (FIXED by !5313)
Cannot close Project Settings popup after adding tags — nothing happens on clicks outside. Only closable via OK button (by design per ishumchenko, note 908000).

### Bug 2 — Performance (CAN'T REPRODUCE)
Originally horrible on large-data projects. After fixes: "Performance is better, will survive without spinner."

### Bug 3 — Wrong column name (FIXED by !5313)
"Role on the project" column header shown in Tasks Closing tab instead of "Tags for closing tasks". Both EN and RU affected.

### Bug 4 — OK button missing (FIXED by !5313)
Tasks Closing tab had no OK/close button.

### Bug 5 — DnD not implemented (NOT A BUG)
Drag-and-drop of tags not implemented. Intentionally excluded per clarification from amalcev.

### Bug 6 — Cannot reopen popup on heavy data (OPEN)
After closing tags were previously added on DirectEnergie-ODC project (heavy data), cannot reopen Project Settings popup — page hangs with constant spinner. No network requests in DevTools during hang. Not reproducible on small-data projects (Diablocom-AI).

### Bug 7 — Testability / architecture concern (DESIGN ISSUE)
Current implementation requires "Update tickets" (tracker sync) to trigger assignment closing. This architecture is unsuitable for testing:
- QA has no access to production trackers
- Workaround: even if sync fails, after page reload closing appears to be done
- Recommendation: separate sync and closing operations
- **Partially addressed by !5335**: new `POST /v1/projects/{projectId}/close-tags/apply` endpoint allows direct apply

### Bug 8 — No auto-refresh after closing (ADDRESSED by !5335/!5339)
After "Update tickets" + closing, page content not updated — requires manual reload.
**Fixed by !5335**: OK button now triggers apply → window.location.reload()

## Design Decisions (from Irina, note 908949)

### Core Behavioral Rules
1. **OK button just closes the popup** (original design) → later changed by !5335 to trigger apply + reload
2. **Inline editing doesn't generate "Changes saved" notification** — consistent with rest of TTT
3. **Tasks with tags deleted only after clicking "Update tickets" icon AND for selected date only** → later changed: apply endpoint handles this directly
4. **System syncs with tracker, then deletes tasks** with matching tags that have no reported hours
5. **"Open for editing" status on a date affects automatic closing propagation** — if Open for editing = true on a date, it may interrupt propagation to future dates
6. **Inline editing updates the tag** — system searches for updated text in Info column on next "Update tickets"
7. **Nothing changes until user presses "Update tickets"** (or now OK button which calls apply)
8. **DnD removed** from requirements
9. **Keep "tag" term** over "label" — more general
10. **Uses "Info INCLUDES any of the tags" logic** — case-insensitive substring matching
11. **Corner case acknowledged:** tag "Done" could match assignee name "Anna Donetskaya" — users are fine with this
12. **Deletion is one-way** — no un-deletion/reopening mechanism

### Timeline Questions (vulyanov's test scenarios)
- **tc1:** task has no reports on selected date but reports next day → closed on selected date
- **tc2:** task has reports on selected date but none in future → visible on selected date
- **tc3:** task has reports only in past but none recently → closed on current date
- **tc4:** label change non-closing → closing tag → requires manual "Update tickets"
- **tc5:** deletion of reported hours for already-closed task → ???

### Closing Application Scope
vulyanov (note 907812): "Application of closing action is global, affects all timeline at once, not a single day. This is significantly different from existing Delete button functionality."

**BUT Irina clarified**: closing applies for the selected date only, controlled by "Update tickets" action.

**Final implementation**: `POST /v1/projects/{projectId}/close-tags/apply` takes a `{ date }` parameter — the frontend sends `currentDay` from Redux store.

## Backend Implementation — CloseByTagServiceImpl.java (Verified Session 73)

**File:** `ttt/service/service-impl/src/main/java/com/noveogroup/ttt/backend/service/impl/task/CloseByTagServiceImpl.java`

### apply() Method — Full Flow
```java
@Transactional(rollbackFor = Exception.class)
public void apply(Long projectId, LocalDate date) throws ServiceException {
    // 1. Guard: null projectId or date → return
    // 2. Load close tags for project → if empty, return
    // 3. Search ALL assignments for project+date (all employees, strict=false)
    // 4. Load tasks for those assignments
    // 5. Filter: keep assignments whose task.ticket.info contains any close tag (case-insensitive)
    // 6. For each matching assignment:
    //    - If existing (id != null): close it (if no reports on date)
    //    - If generated (id == null): create as closed (if no reports on date)
}
```

### Key Implementation Details
- **`buildSearchRequest()`**: Sets `employeeLogin = null` (all project participants), `startDate = endDate = date`, `strict = false`
- **`collectAssignmentsToClose()`**: Uses `StringUtils.containsIgnoreCase(ticketInfo, tag)` — **case-insensitive substring match**. Skips assignments where task is null, ticket is null, or ticket.info is blank.
- **`applyExistingAssignment()`**: Checks `hasReportOnDate()` first — if report exists, skips (preserves assignment). Otherwise calls `closeAssignmentByTag()` and publishes `TaskAssignmentPatchEvent`.
- **`applyGeneratedAssignment()`**: Also checks `hasReportOnDate()`. Creates new assignment with `closed=true` via `createForCloseByTag()`. **Catches ALL exceptions with `log.debug()` only** — silent failure for generated assignment creation errors. Publishes `TaskAssignmentGenerateEvent`.
- **`hasReportOnDate()`**: Checks `internalTaskReportService.find(taskId, assigneeId, date) != null`

### Event Publishing
- Existing assignment closed → `TaskAssignmentPatchEvent` (id, login, patchRequest with closed=true)
- Generated assignment created+closed → `TaskAssignmentGenerateEvent` wrapping `TaskAssignmentAddEvent`

### Design Concern: Silent Error Handling
Line 168-172: Exception during generated assignment creation is swallowed with `log.debug()`. This means if `createForCloseByTag()` throws (e.g., unique constraint violation, data integrity issue), the apply endpoint returns 200 success but some assignments were NOT closed. No error is surfaced to the user.

## Frontend Implementation — Apply Flow (Verified Session 73)

### handleCloseTagsApply Saga
**File:** `frontend-js/src/modules/planner/ducks/plannerProjects/sagas.tsx` (lines 1209-1231)

```javascript
function* handleCloseTagsApply() {
  try {
    const projectTags = yield select(selectProjectTags);
    if (projectTags.length === 0) return;  // Guard: no tags → no API call

    yield put(actions.startLoadingEmployeeModal());  // Show spinner

    const currentDay = yield select(selectProjectCurrentDay);  // Date from Redux
    const project = yield select(selectCurrentProject);

    yield call(ProjectsApi.closeTagsApplyRequest, project.id, currentDay);

    window.location.reload();  // Blunt force refresh
  } catch (error) {
    devLog(error);  // Error swallowed, not shown to user
  } finally {
    yield put(actions.stopLoadingEmployeeModal());
    yield put(actions.closeEmployeesModal());  // Dead code — page reloads before this executes
  }
}
```

### API Client
**File:** `frontend-js/src/modules/planner/ducks/api/projects.ts` (line 191)
```javascript
export const closeTagsApplyRequest = (projectId: number, date: string) =>
  Api.post(`/v1/projects/${projectId}/close-tags/apply`, { date });
```

### Action + Constant
- Action: `closeTagsApplyAndCloseModal()` → type `@@plannerProjects/CLOSE_TAGS_APPLY_AND_CLOSE_MODAL`
- Saga: `takeLatest` on `CLOSE_TAGS_APPLY_AND_CLOSE_MODAL` → `handleCloseTagsApply`

### Design Issues
1. **Both tabs' OK button calls apply** — if user only changed Project Members (not tags), apply is still called (unless tags list is empty). Side effect of unified handler in !5341.
2. **`window.location.reload()`** — blunt force refresh instead of surgical Redux state update. Loses any unsaved state. The `finally` block (stopLoading + closeModal) is dead code since page reloads.
3. **Error not shown to user** — if apply fails, `devLog(error)` only logs to console. User sees spinner, then nothing happens (no reload, no error message).

## New Apply Endpoint (!5335)

```
POST /v1/projects/{projectId}/close-tags/apply
Body: { "date": "YYYY-MM-DD" }
```

**Frontend flow (final state after !5341):**
1. User clicks OK button on either tab (Project Members or Tasks Closing)
2. Saga reads `projectTags` from Redux store
3. If `projectTags.length === 0` → return immediately (no API call)
4. Otherwise: show loading spinner, call `POST /apply` with `currentDay`, then `window.location.reload()`
5. Synthetic `Event('input', { bubbles: true })` dispatched on a ref — hack for Dialog dirty-state detection

**Design concern:** Both tabs' OK buttons call the apply flow. If user only changed Project Members (not tags), the apply endpoint is still called (unless tags list is empty). This is a side effect of unifying the handlers.

## Frontend Implementation Details (final state)

### Synthetic Event Hack
`PlannerEmployeesModal/index.js` uses `useRef(null)` for `fakeEventRef`, attached to the button container div on Tasks Closing tab. On OK click, dispatches `new Event('input', { bubbles: true })` — workaround for Dialog component's dirty-state tracking that would otherwise prevent closing when no "real" input events have occurred.

### Redux Flow
- Action: `CLOSE_TAGS_APPLY_AND_CLOSE_MODAL`
- Saga: `handleCloseTagsApply()` (takeLatest)
- API: `ProjectsApi.closeTagsApplyRequest(project.id, currentDay)`
- Result: `window.location.reload()` — blunt-force page refresh rather than surgical Redux state update

### Refresh Refactor (!5313)
`fetchProjectTasksRefresh` saga refactored to read `currentDay` and `currentProjectId` from Redux store via selectors, instead of receiving them from action payload. Fixes stale-data bugs.

## "Open for Editing" ↔ Close-by-Tag Interaction (Session 73)

### How "Open for Editing" Works
"Open for editing" = **assignment generation**. It creates editable task assignments for a specific employee and date.

**Frontend:**
- Button visible only when `readOnlyEmployee === true` for that employee (in `TableProjectGroupRow.js`)
- Also requires `isOpenPeriod === true` (report period must be open for selected date)
- Triggers `handleProjectAssignmentsGenerate()` saga → POST `/v1/assignments/generate`
- Request: `{ date: currentDay, employeeLogin, projectId }`
- Response: newly generated `TaskAssignmentDTO` objects
- WebSocket events push changes to frontend in real-time

**Backend:**
```
POST /v1/assignments/generate
  → TaskAssignmentController.generate()
    → TaskAssignmentService.generate()
      → searchInternal(projectId, employeeId, date, date, false)
      → Creates/reuses TaskAssignment entities
      → Sets order (position, nextAssignmentId)
      → Publishes TaskAssignmentGenerateEvent
```

### Interaction with Close-by-Tag
Both features are **date-scoped** — they use the same `currentDay` from Redux:

1. **Sequence matters**: If user clicks "Open for editing" FIRST, then OK on Tasks Closing:
   - "Open for editing" generates assignments (readOnly becomes false)
   - OK triggers apply → those newly generated assignments are now eligible for close-by-tag matching
   - If any generated assignment's task.ticket.info matches a close tag AND has no reports → it gets closed

2. **Reverse sequence**: If user clicks OK on Tasks Closing FIRST (with tags configured), then "Open for editing":
   - Apply closes matching assignments for all employees
   - For read-only employees (not yet "opened for editing"), apply processes their generated (id=null) assignments → creates them as closed
   - "Open for editing" then generates remaining assignments — but already-closed ones are not regenerated

3. **Both use same date**: currentDay determines which assignments are affected. Both features operate on exactly one date at a time.

### Close-by-Tag Handles Both Assignment Types
The backend `CloseByTagServiceImpl.apply()` handles:
- **Existing assignments (id != null)**: Closes them via `closeAssignmentByTag()` + patch event
- **Generated assignments (id == null)**: Creates new assignment with `closed=true` via `createForCloseByTag()` + generate event

This means close-by-tag works **even for employees who haven't "opened for editing"** — it creates closed assignments for them directly.

## Related Tickets

| Ticket | Relation | Description |
|--------|----------|-------------|
| #2408 | Related | Performance / assignment growth — suspected root cause |
| #3375 | Related | Regression from #3258 — employee ordering broken |
| #3332 | Related | **Frontend bug: DnD creates duplicate task rows** (root-caused Session 73) |
| #3314 | Related | **Frontend bug: task order resets on "Open for Editing"** (root-caused Session 73) |
| #2506 | Related | Page cannot be loaded (large project) |
| #1857 | Related | Interface very slow on large project |
| #2351 | Related | Low performance on large tables (DirectEnergie-ODC) |
| #2331 | Related | Planner consumes 2+ GB RAM (memory leak) |
| #1790 | Mentioned | Add function to delete assignments |
| #2319 | Mentioned | Future: Cancel+Save instead of instant |
| #3258 | Related | UI refactor that caused regression #3375 |
| #3254 | Related | Info column display bug (multi-line partially hidden) |

## Confluence Requirements (Fetched Session 72)

**Source:** https://projects.noveogroup.com/x/A4rFBw — page 130386435, "Planner / Планировщик"
**Version:** 19 (latest). Color-coded: magenta = new for #2724, green = ticket refs.

### Full Spec for Tasks Closing Tab (§7.4)
- Below tabs: informational text explaining auto-closing behavior
- Input: "Tag for closing tasks" — required, 200 char limit, placeholder "Add a tag"
- "+" button adds tag to table
- Table: column "Tags for closing tasks" with inline editing + delete icon
- ~~DnD~~ (removed from requirements — strikethrough in Confluence)
- Green highlight on new items, auto-scroll to newly added
- Adding/deleting is IMMEDIATE with "Changes saved" notification
- Tags alone don't change planner — closing happens when pressing "Update tickets" (§7.4.5.2)
- **§7.4.6:** On "Update tickets": (1) sync with tracker, (2) remove matching assignments without reports
- §7.4.6.1: Both stages run regardless of user role

### OK Button (§7.5)
- Closes popup. Future: may change to Cancel+Save buttons (#2319)
- §7.5.1: If Tasks closing tab has tags: check planner, remove matching tasks without reports for selected date, show grey loader, then reload page

### Key Req/Code Discrepancy Found
- **Confluence says 200 char limit** (§7.4.2) but **DB is VARCHAR(255)** and no frontend validation enforces 200 chars

## Figma Design Specs (Fetched Session 72)

**Node:** `44604:89145` in file `H2aXBseq7Ui60zlh5vhyjy`

Modal structure:
- 600px wide, 2 tabs ("Участники проекта" / "Закрытие задач")
- Only OK button visible (Cancel/Delete/Save hidden in component)
- Green toaster "Изменения сохранены" on changes

Tasks Closing tab:
- Description text explaining behavior
- Tag input: 490px field + 50px "+" button
- Tag table: 2 columns (440px tag + 120px actions)
- Example tags in design: `[closed]`, `finished`
- Cursor hand on existing tags = click-to-edit (inline editing)
- Delete icon (trash) per row
- New item highlighted green

Design annotations:
- Only current manager + senior manager can access (#1596)
- Employee DnD ordering matches planner display (#1622)
- Hover role → placeholder "Click to add role" → inline edit

Screenshots saved to `artefacts/figma/` directory.

## Live API Testing Results

### Session 72 (qa-1)
Full CRUD cycle tested successfully on qa-1:
- **GET, POST, DELETE:** All work correctly
- **PATCH (update):** Works on qa-1 (unlike timemachine where it was 500)
- **POST /apply:** NOT deployed on qa-1 — returns 500 "POST not supported"
- **Validation:** blank tags, whitespace tags, cross-project access all properly rejected
- **Idempotent create:** confirmed (duplicate returns existing tag)
- **Auth:** Only `?token=` query param works for these endpoints

### Session 73 Retest (qa-1, 2026-03-28)
- **POST /close-tags/apply:** STILL returns 500 `HttpRequestMethodNotSupportedException: Request method 'POST' not supported`
- **GET /close-tags:** Returns `[]` (empty — project 1225 has no tags)
- **Conclusion:** Apply endpoint (!5335, merged 2026-03-25) is NOT YET DEPLOYED to qa-1. The qa-1 build predates the apply endpoint merge.

See [[investigations/planner-close-by-tag-implementation]] for full test matrix.

## Google Docs References (Blocked)
- Tracker integration spec: https://docs.google.com/document/d/1HakoivdHDIc385EGonau8-57FFaP5_n4itkxuAj5cxg
- Planner spec: https://docs.google.com/document/d/1tJiSoUIVEYXj0LB1-dOf_1CmcAiVhjfbxk0y615YGRQ
- **Status:** Cannot fetch via WebFetch — Google Docs requires authentication. Would need manual export or Google Docs API with OAuth.

## Open Issues / Test Priorities

### Must Test
1. **Happy path**: Create tag → OK → verify assignments with matching Info closed
2. **CRUD**: Create, read, inline edit, delete tags
3. **Permissions**: Manager/SPM/Admin can CRUD; plain employee can only list
4. **Idempotent create**: POST same tag twice → returns existing
5. **PATCH update**: verify works after deployment
6. **Substring matching**: "closed" matches "[closed]", "CLOSED", "already-closed"
7. **Partial match false positives**: "Done" matches "Donetskaya" (known, accepted)
8. **Assignment with reports**: stays visible even when tag matches
9. **Assignment without reports**: removed from table
10. **Apply on specific date**: only affects selected date
11. **Empty tags guard**: OK on project with no tags → no API call

### Edge Cases
12. **Heavy data project**: DirectEnergie-ODC — Bug 6 (popup hang) may still exist
13. **Cross-project tag access**: tag from project A → 400 when accessed via project B
14. **Special characters**: `<script>`, Unicode, Cyrillic — stored raw, no sanitization
15. **Blank/whitespace tag**: rejected with validation error
16. **Multiple tags**: behavior with 5+ tags on a project
17. **Inline edit to duplicate**: update tag to match existing → validation error
18. **"Open for editing" then OK**: generated assignments eligible for close-by-tag
19. **Both tabs OK triggers apply**: Project Members tab changes also trigger apply (if tags exist)
20. **Apply error not shown**: if backend fails silently, user sees no feedback

### Open Questions
21. **Google Docs specs**: not accessible via automated fetch — need manual review or OAuth access
22. **Apply endpoint deployment**: when will qa-1 get the build with /close-tags/apply?

## Updated Coverage Assessment

| Area | Session 71 | Session 72 | Session 73 | Methods |
|------|-----------|-----------|-----------|---------|
| **t2724 depth** | ~85% | ~95% | **~97%** | +backend code verified, +frontend saga verified, +Open for editing interaction mapped |
| **Planner module** | ~45% | ~55% | **~65%** | +DnD root causes (#3332, #3314), +Open for editing mechanism, +filtering/sorting logic |
| **Missing for 100%** | — | — | Apply endpoint live test, Google Docs specs | — |


## Session 74 Updates

### Apply Endpoint Status (qa-1)
- Build on qa-1 is still `2.1.26-SNAPSHOT.LOCAL | Build date: 22.03.2026`
- The MR !5335 (merged 2026-03-25) adding the apply endpoint has NOT been deployed to qa-1
- HTTP response changed from 500 (HttpRequestMethodNotSupportedException in S73) to 401 (Unauthorized) — suggests a different path handling, but the actual close-by-tag apply logic is still not testable on qa-1
- Live testing of apply endpoint remains blocked until next qa-1 deployment

### Related Findings
- **Lock mechanism fully mapped** — see [[planner-lock-mechanism]]
- **Assignment ordering system documented** — see [[planner-assignment-ordering]]
- **#2914 validation bypass analyzed** — see [[planner-2914-validation-bypass]]
- **UI exploration completed** — see [[planner-ui-exploration-session74]]
