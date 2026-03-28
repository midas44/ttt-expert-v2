---
type: investigation
tags:
  - planner
  - close-by-tag
  - sprint-15
  - '2724'
  - backend
  - frontend
  - apply-endpoint
created: '2026-03-16'
updated: '2026-03-27'
status: active
related:
  - '[[modules/planner-assignment-backend]]'
  - '[[modules/frontend-planner-module]]'
  - '[[modules/pm-tool-integration-deep-dive]]'
  - '[[exploration/tickets/t2724-investigation]]'
  - '[[exploration/ui-flows/planner-project-settings-pages]]'
---
# Planner Close-by-Tag Implementation (#2724)

## Overview
Sprint 15 CRITICAL feature. Solves planner performance degradation caused by uncontrollable growth of task assignments (e.g., DirectEnergie-ODC project: ~10 new assignments/employee/day, never cleaned up). Allows managers to configure per-project labels that automatically close matching assignments during Refresh/Load-from-tracker.

**Tickets:** #2724 (main), related #2408, #3375
**Status:** Ready to Test (6 MRs merged to release/2.1: !5289, !5293/!5299, !5301, !5313, !5335, !5339, !5341)
**Migration:** V2.1.27 — `V2_1_27_20260301000000__create_planner_close_tag_table.sql`
**Deep investigation:** [[exploration/tickets/t2724-investigation]]

## Database Schema

```sql
CREATE TABLE ttt_backend.planner_close_tag (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL,
    tag         VARCHAR(255) NOT NULL,
    CONSTRAINT fk_planner_close_tag_project
        FOREIGN KEY (project_id) REFERENCES ttt_backend.project(id) ON DELETE CASCADE,
    CONSTRAINT uq_planner_close_tag_project_tag UNIQUE (project_id, tag)
);
CREATE INDEX idx_planner_close_tag_project_id ON ttt_backend.planner_close_tag(project_id);
```

Key constraints:
- CASCADE DELETE: removing project removes all its close tags
- UNIQUE(project_id, tag): no duplicate tags per project
- tag VARCHAR(255) NOT NULL

## REST API — Close Tag CRUD

**Base path:** `/v1/projects/{projectId}/close-tags`
**Controller:** `PlannerCloseTagController` (129 lines)
**Security:** All endpoints require `AUTHENTICATED_USER` or `PROJECTS_ALL`

| Method | Path | Handler | Response | Permission |
|--------|------|---------|----------|------------|
| GET | `/v1/projects/{projectId}/close-tags` | `list()` | `List<PlannerCloseTagDTO>` | Any authenticated user |
| POST | `/v1/projects/{projectId}/close-tags` | `create()` | `PlannerCloseTagDTO` (HTTP 200, not 201) | CREATE |
| PATCH | `/v1/projects/{projectId}/close-tags/{tagId}` | `update()` | `PlannerCloseTagDTO` | EDIT |
| DELETE | `/v1/projects/{projectId}/close-tags/{tagId}` | `delete()` | void | DELETE |

**Apply endpoint (added in !5335):**

| Method | Path | Handler | Response | Permission |
|--------|------|---------|----------|------------|
| POST | `/v1/projects/{projectId}/close-tags/apply` | `apply()` | void | CREATE (?) |

**Note:** POST returns HTTP 200, not 201 — unconventional for create endpoint.

### Controller Validation
- `@PathVariable("projectId") @NotNull @ProjectIdExists` — custom annotation validates project exists
- `@Valid @RequestBody` on create/update (enforces `@NotBlank tag`)

## Permission Model

**Service:** `PlannerCloseTagPermissionService` (64 lines)
**Permission types:** CREATE, EDIT, DELETE (enum `PlannerCloseTagPermissionType`)
**Model:** Binary all-or-nothing — either all three permissions or none.

**Who can manage tags (create/edit/delete):**
- Admin (`isAdmin()`)
- Project manager (`current.getId().equals(project.getManagerId())`)
- Senior manager (`current.getId().equals(project.getSeniorManagerId())`)
- Project owner (`current.getId().equals(project.getOwnerId())`)

**Who cannot:**
- Read-only users — NO permissions (empty set)
- Plain employees — can LIST tags (200 OK on GET) but get 403 on POST/PATCH/DELETE

## Service Layer — PlannerCloseTagServiceImpl (139 lines)

### create(projectId, tag)
1. Validates projectId not null, tag not blank
2. Permission check: CREATE
3. Loads Project entity (NotFoundException if missing)
4. Calls `doSaveTagInNewTransaction()` — **REQUIRES_NEW** transaction for isolation
5. On `DataIntegrityViolationException` (duplicate key): catches, returns existing tag → **idempotent create**
6. Uses `@Lazy self` injection to invoke `doSaveTagInNewTransaction()` through Spring proxy (required for nested transaction)

### update(projectId, tagId, tag)
1. Validates projectId, tag
2. Permission check: EDIT
3. Loads tag by tagId (NotFoundException if missing)
4. **Ownership check:** tag.project.id must equal projectId → `ValidationException("Planner close tag does not belong to project")`
5. **No-op optimization:** if new tag equals existing tag, returns without saving
6. Uses `saveAndFlush()` for immediate constraint check
7. On duplicate: throws `ValidationException("Planner close tag already exists for project")`

### delete(projectId, tagId)
1. Validates projectId
2. Permission check: DELETE
3. Loads tag (NotFoundException if missing)
4. **Ownership check:** same as update
5. Deletes from repository

### Error Messages
- `"Project id is required"` — null projectId
- `"Tag must not be blank"` — blank tag
- `"Planner close tag does not belong to project {projectId}"` — cross-project access
- `"Planner close tag already exists for project {projectId}"` — duplicate on update
- `NotFoundException(Project.class)` — project not found
- `NotFoundException(PlannerCloseTag.class)` — tag not found

## Core Logic — CloseByTagServiceImpl (267 lines)

**Entry point:** `apply(PlannerSectionBO section)` — called during Refresh and Load-from-tracker flows, AND now from the dedicated apply endpoint (!5335).

### Flow
1. **Guard checks:** null section → return; `hasApplicableContext` checks for projectId or employeeLogin
2. **Resolve date:** priority: section.date → section.startDate → section.endDate
3. **Load assignments:** search for date with `strict=false`
4. **Load tasks:** by assignment task IDs into a map
5. **Group by project:** assignments grouped by projectId
6. **Tag matching:** per project, loads close tags, checks each assignment's task `ticket_info`

### Tag Matching Logic
```java
// Case-insensitive substring matching
StringUtils.containsIgnoreCase(ticketInfo, tag)
```
- A tag "closed" matches "closed", "CLOSED", "[closed]", "already-closed", etc.
- Blank tags are filtered out
- Blank ticket_info is skipped
- Projects without close tags are skipped entirely
- **Known false positive risk:** tag "Done" can match "Anna Donetskaya" — acknowledged and accepted by stakeholders

### Assignment Closing — Two Paths

**Path 1: Existing assignment (has DB id)**
- `closeByTagSetClosedAndReturnHasReportOnDate(assignmentId)` — marks closed in DB, returns whether date has report
- If HAS report: stop (no WebSocket event — row stays visible because user reported hours)
- If NO report: publish `TaskAssignmentPatchEvent` with `closed=true` (row disappears from UI)

**Path 2: Generated assignment (no DB record yet)**
- Creates real assignment with `closed=true` via `createForCloseByTag(createRequest)`
- On creation failure: **silently swallowed** with debug log only
- Checks for report on task/assignee/date
- If HAS report: stop
- If NO report: publish `TaskAssignmentGenerateEvent` with nested `AddEvent` (row disappears)

### Key Behavioral Rules
1. Closed assignments don't propagate to future dates (excluded from "last actual" logic)
2. Assignment with report stays visible even when closed — report data preserved
3. Close-by-tag runs AFTER tracker sync / refresh, not during
4. WebSocket events enable real-time UI updates without page reload
5. **"Open for editing" status may affect propagation** — if true on a date, may interrupt closing to future dates (per design discussion, exact behavior needs verification)
6. **Apply is per-date:** the apply endpoint takes a `{ date }` parameter — only affects the selected date

## Frontend Implementation (Final State after !5341)

### UI Changes
- "Project employees" tooltip/popup renamed to **"Project settings"** (RU: "Настройки проекта")
- Modal redesigned with two tabs:
  - **"Project members"** (existing employee management)
  - **"Tasks closing"** (new tag management) (RU: "Закрытие задач")

### Components
- `PlannerTagsAdd.js` — form with text field + add button (Formik)
- `PlannerTagsList.js` — tag list table with new-item highlighting + scroll-to-new
- `PlannerTag.js` — inline-editable tag cell (click to edit, Enter to save, Escape to cancel)
- `PlannerModalDelete.js` — generalized delete button (renamed from PlannerEmployeeDelete)

### Tags Tab Content
1. Explanatory text: "Project tickets containing added values in the Info column will be automatically removed from the list on days when there are no more reports for them"
2. Add tag form (text input + "Add" button)
3. Tag list table with inline editing and delete buttons

### OK Button / Apply Flow (final state, !5335 + !5339 + !5341)

**Both tabs now use the same OK button handler:**

1. User clicks OK on either tab (Project Members or Tasks Closing)
2. `handleCloseTagsApplyOnClick` dispatches `closeTagsApplyAndCloseModal()` action
3. Also dispatches synthetic `Event('input', { bubbles: true })` on `fakeEventRef` — **hack for Dialog dirty-state detection**
4. Saga `handleCloseTagsApply()`:
   - Reads `projectTags` from Redux store
   - **Empty-tags guard:** if `projectTags.length === 0`, returns immediately (no API call)
   - Shows loading spinner (`startLoadingEmployeeModal`)
   - Calls `POST /v1/projects/{projectId}/close-tags/apply` with `{ date: currentDay }`
   - Calls `window.location.reload()` on success — **blunt-force refresh**
   - In `finally`: stops loading + closes modal

**Design concerns:**
- Both tabs' OK buttons call apply — if user only changed members (not tags), apply is still called (unless tags list is empty)
- `window.location.reload()` is a blunt approach vs surgical Redux state update
- Synthetic DOM event is a fragile hack for Dialog component behavior

### Refresh Refactor (!5313)
`fetchProjectTasksRefresh` saga refactored to read `currentDay` and `currentProjectId` from Redux store via selectors, instead of from action payload. Fixes stale-data bugs.

### New-Item Highlighting
- Green left border (5px) on new items via `.new-item::before` CSS
- Auto-scroll to newly added item
- Highlight auto-clears after rendering

### Localization Keys
- `project_settings`, `add_tag`, `tag_for_closing`, `tags_for_closing`
- `tags_text` (explanatory text about auto-closing)
- `tabs.project_members`, `tabs.task_closing`

## Integration Tests

### PlannerCloseTagControllerIntegrationTest (282 lines)
8 test methods covering CRUD + permissions:
1. `createAndListTagsForProject` — create via POST, verify in GET
2. `updateTagForProjectWithPatch` — create, update via PATCH, verify
3. `updateTagConflictDuplicateTag` — create two tags, update second to match first → 400
4. `createTagTwiceWithSameNameReturnsExistingTag` — idempotent create verified
5. `deleteTagForProject` — create, delete, verify empty list
6. `createTagAsOwner` — owner permission verified
7. `createTagAsSeniorManager` — senior manager permission verified
8. `whenCurrentUserIsPlainEmployee_canListTagsButCannotCreateUpdateDelete` — 200 on GET, 403 on POST/PATCH/DELETE

### CloseByTagIntegrationTest (761 lines)
End-to-end test with WireMock (GitLab tracker) and mocked PM Tool:
1. Sync projects from PM Tool (WireMock)
2. Set up tracker, create task with closed ticket
3. Add project member, create time report
4. Generate assignments, verify visibility
5. Add close tag `[closed]`
6. Refresh for next day → verify: assignment `closed=true` in DB, WebSocket GENERATE event, not visible in filtered search

## Design Issues / Test Gaps Identified
1. **Silent failure on generated assignment creation** — creation errors swallowed with debug log
2. **POST returns 200 instead of 201** — unconventional REST
3. **No max tag count per project** — could create unlimited tags
4. **No tag length validation** beyond VARCHAR(255) DB constraint
5. **Substring matching false positives** — tag "fix" matches "prefix", "fixed", "fixture"
6. **No audit trail** — no logging of who created/modified/deleted tags
7. **Manager role only via project role** — department manager not checked in permissions
8. **No bulk operations** — no endpoint to delete all tags or create multiple at once
9. **No pagination on tag list** — GET returns all tags, could be large
10. **Race condition on update** — `saveAndFlush` catches duplicate but no optimistic locking
11. **Both tabs trigger apply** — Project Members OK button also calls close-tags apply (mitigated by empty-tags guard)
12. **window.location.reload()** — blunt page refresh instead of selective state update
13. **Synthetic DOM event hack** — fragile workaround for Dialog dirty-state

## Live Testing Results (timemachine, S74)

16 API tests run. Key results:
- CRUD (GET, POST, DELETE): all pass
- PATCH: failed with 500 — **root cause: PATCH commit not in deployed build** (deployment timing issue, not code bug)
- Idempotent create: confirmed
- Validation (blank, whitespace, non-existent project): all pass
- Cross-project access check: passes
- Special characters stored raw — **no HTML sanitization** (XSS concern)

### PATCH 500 Root Cause
Not a gateway routing bug — the PATCH endpoint was added in commit `dbdb6c9663` (v3, 2026-03-12), ~29 hours AFTER the deployed build `2.1.26-SNAPSHOT.290209` (2026-03-11). Current release/2.1 HEAD includes PATCH. Re-test after redeployment.

### RestErrorHandler Issue
`RestErrorHandler` (`@RestControllerAdvice`) has catch-all `@ExceptionHandler(Exception.class)` → maps ALL unhandled exceptions to 500 instead of correct HTTP codes (e.g., 405 for `HttpRequestMethodNotSupportedException`).

## QA Bug Summary (from ticket #2724 comments)

| Bug | Description | Status |
|-----|-------------|--------|
| Bug 1 | Can't close popup after changes — only OK button works | FIXED (!5313) — by design |
| Bug 2 | Performance on heavy projects | CAN'T REPRODUCE — improved |
| Bug 3 | Wrong column header in Tasks Closing tab | FIXED (!5313) |
| Bug 4 | OK button missing from Tasks Closing tab | FIXED (!5313) |
| Bug 5 | DnD not implemented | NOT A BUG — intentionally excluded |
| Bug 6 | Can't reopen popup on heavy data (DirectEnergie-ODC) | **OPEN** |
| Bug 7 | Closing requires tracker sync — testability concern | **DESIGN ISSUE** — partially addressed by apply endpoint |
| Bug 8 | No auto-refresh after closing | FIXED (!5335) — window.location.reload() |


## Live Testing Results (qa-1, Session 72)

### CRUD API Testing — Full Suite

**Authentication:** `?token=` query parameter works; `Bearer` and `X-Auth-Token` headers do NOT work for close-tag endpoints.

| Test | Method | Input | Result | HTTP | Notes |
|------|--------|-------|--------|------|-------|
| List empty | GET /close-tags | project 29 | `[]` | 200 | Clean state confirmed |
| Create tag | POST /close-tags | `{"tag":"test-close-tag"}` | `{id:1, tag:"test-close-tag"}` | 200 | Returns DTO (not 201) |
| Duplicate create | POST /close-tags | same tag | `{id:1, tag:"test-close-tag"}` | 200 | **Idempotent** — returns existing (id=1, not new id) |
| Create second | POST /close-tags | `{"tag":"[closed]"}` | `{id:3}` | 200 | Note: id skipped to 3 (seq consumed by duplicate attempt) |
| Create third | POST /close-tags | `{"tag":"Done"}` | `{id:4}` | 200 | Works |
| List all | GET /close-tags | — | 3 tags | 200 | Ordered by creation |
| Blank tag | POST /close-tags | `{"tag":""}` | NotBlank error | 400 | `"Tag must not be blank"` |
| Whitespace tag | POST /close-tags | `{"tag":"   "}` | NotBlank error | 400 | Spaces treated as blank |
| Special chars | POST /close-tags | `{"tag":"Done / Résolu"}` | `{id:5, tag:"Done / Résolu"}` | 200 | Unicode accepted |
| Delete tag | DELETE /close-tags/1 | — | (empty body) | 200 | Works |
| Delete again | DELETE /close-tags/1 | — | NotFoundException | 404 | **NOT idempotent** (unlike create) |
| Cross-project list | GET /projects/2/close-tags | — | `[]` | 200 | Correctly scoped |
| Cross-project delete | DELETE /projects/2/close-tags/3 | — | ValidationException | 400 | `"Planner close tag does not belong to project 2"` |
| Non-existent project | GET /projects/999999/close-tags | — | ProjectIdExists error | 400 | Custom validator |
| **PATCH update** | PATCH /close-tags/6 | `{"tag":"updated"}` | `{id:6, tag:"updated"}` | 200 | **WORKS on qa-1** (unlike timemachine 500) |
| PATCH blank | PATCH /close-tags/6 | `{"tag":""}` | NotBlank error | 400 | Same validation as create |
| PATCH non-existent | PATCH /close-tags/999999 | `{"tag":"x"}` | NotFoundException | 404 | `"id = 999999"` |

### Apply Endpoint — NOT DEPLOYED on qa-1

| Test | Method | Input | Result | HTTP |
|------|--------|-------|--------|------|
| POST /apply | POST /close-tags/apply | `date=2026-03-27` | HttpRequestMethodNotSupportedException | 500 |
| PUT /apply | PUT /close-tags/apply | same | HttpRequestMethodNotSupportedException | 500 |
| GET /apply | GET /close-tags/apply | same | HttpRequestMethodNotSupportedException | 500 |
| PATCH /apply | PATCH /close-tags/apply | same | MethodArgumentTypeMismatchException | 400 |

**Root cause:** The `POST /apply` endpoint (added in MR !5335, merged 2026-03-25) is NOT in the deployed qa-1 build. Spring routes `POST /close-tags/apply` → `DELETE /{tagId}` handler (treats "apply" as tagId string) → "POST not supported". PATCH hits the `PATCH /{tagId}` handler → can't parse "apply" as Long → NumberFormatException.

**Timemachine status:** Returns 401 (empty body) — endpoint also not deployed there.

**Impact:** Cannot test the full close-by-tag flow (create tags → apply → verify assignments closed) on either testing environment until redeployment.

### PATCH Works on qa-1 (Upgrade from timemachine)

PATCH endpoint `PlannerCloseTagController.update()` works correctly on qa-1, unlike timemachine where it returned 500. This confirms the PATCH fix (from MR !5301 commit `dbdb6c9663`, 2026-03-12) IS deployed on qa-1 but was NOT deployed on timemachine during session 74 testing.

## Confluence Requirements (Fetched Session 72)

**Source:** https://projects.noveogroup.com/x/A4rFBw (page 130386435, version 19)
**Title:** "Planner / Планировщик"

### Requirement Sections (Summarized)

**§1-4: Assignments model**
- "Generated" assignments: added manually in Planner or opened for editing; persist indefinitely
- "Non-generated" assignments: appear only on report dates; auto-disappear next day

**§5: Task ordering (Planner > Tasks)**
- 5.1. Projects sorted alphabetically (A→Z, then Cyrillic)
- 5.2. New task added to TOP of list within project
- 5.3. Use `generate` with `projectId` to preserve per-project ordering

**§6: Planner > Projects**
- 6.1. (#3375) Employee ordering must match "Project Settings > Project Members" order
- 6.2. Task ordering per employee must match Planner > Tasks ordering
- 6.3. [NEW] Rename tooltip from "Add/remove employees" to "Project settings"

**§7: "Project Settings" popup** [ALL NEW for #2724]
- 7.1. Title: "Employees on project" → "Project Settings"
- 7.2. Two tabs: "Project Members" / "Tasks closing"
- 7.3. Project Members tab:
  - 7.3.1. Employee dropdown (required, placeholder "Select an employee")
  - 7.3.2. Project role field (optional, placeholder "Add a role")
  - 7.3.3. Add button (+) on same row
  - 7.3.4. Table with DnD reorder, inline role editing, delete icon with tooltip
  - 7.3.5. Changes saved IMMEDIATELY on click, with notification banner "Changes saved"
  - 7.3.5.1. Banner positioned 40px from top edge if default position is off-screen
- 7.4. Tasks closing tab:
  - 7.4.1. Informational text below tabs
  - 7.4.2. Input field "Tag for closing tasks" (required, placeholder "Add a tag", 200 char limit)
  - 7.4.3. + button adds tag to table
  - 7.4.4. Table: "Tags for closing tasks" column, inline editing, delete icon. ~~DnD~~ (strikethrough = removed). Green highlight on new items, auto-scroll
  - 7.4.5. Adding/deleting tags is IMMEDIATE with "Changes saved" notification
  - 7.4.5.2. Tags themselves don't change planner table — only "Update tickets" applies them
  - 7.4.6. [NEW BACKEND] On "Update tickets": sync with tracker, then remove assignments containing listed tags
  - 7.4.6.1. Both stages happen regardless of user role (manager or member)
- 7.5. OK button closes popup
  - 7.5.1. If Tasks closing tab has tags: check planner table, remove matching tasks without reports, show loading overlay, then reload page

**§8: Task ordering rules** (common for both tabs)
- 8.1. Non-generated above generated (before Open for editing)
- 8.2. Order preserved when opening for editing
- 8.3. DnD reorder persisted for generated assignments
- 8.4. New task at TOP of project list
- 8.5. 5-second green highlight on new task
- 8.6. Auto-scroll to addition point

**§9: UI changes in tables** (#3258)
- 9.1. 16px side padding
- 9.2. Standard 13px font (13 semibold for headers)
- 9.3. Left alignment in all columns except date/hours

### Key Discrepancies: Requirements vs Code vs Live App

| Aspect | Confluence Req | Code/Live | Status |
|--------|---------------|-----------|--------|
| Tag char limit | 200 chars (§7.4.2) | VARCHAR(255) in DB, no frontend validation | **MISMATCH** — DB allows 255, Confluence says 200 |
| DnD on tags | ~~Strikethrough~~ (removed) | Not implemented | OK — correctly excluded |
| "Changes saved" banner on tag add/delete | Required (§7.4.5) | Implemented (notification after add/delete) | OK |
| Banner position 40px from top | Required (§7.3.5.1, §7.4.5.1) | Unclear if implemented | **NEEDS VERIFICATION** |
| Employee field placeholder | "Select an employee" (§7.3.1) | Need to verify | **NEEDS VERIFICATION** |
| Role field placeholder | "Add a role" (§7.3.2) | Need to verify | **NEEDS VERIFICATION** |
| Delete tooltip | "Delete" (§7.3.4) | Need to verify | **NEEDS VERIFICATION** |
| Inline editing of tags | Required (§7.4.4, Figma shows click-to-edit) | PATCH endpoint exists | **NEEDS UI VERIFICATION** |
| OK button behavior | Close popup + apply if tags exist (§7.5.1) | Both tabs use apply handler + reload | OK (slightly different: both tabs trigger, guarded by empty-tags check) |

## Figma Design Specs (Fetched Session 72)

**File:** `H2aXBseq7Ui60zlh5vhyjy` (Noveo-TTT), Node: `44604:89145`
**Section title:** "#2424 Planner / Projects / Project Settings"

### Modal Design
- Width: 600px (560px content + 20px padding each side)
- Title: "Настройки проекта" (Project Settings)
- 2 tabs: "Участники проекта" / "Закрытие задач"
- Only **OK** button visible (Cancel/Delete/Save hidden)
- Green success toaster: "Изменения сохранены" ("Changes saved")

### Tab 2: Tasks Closing (design details)
- Description text below tabs explaining auto-closing behavior
- Tag input: 490px wide text field + 50px "+" button
- Tag table: 2 columns — "Теги для закрытия задач" (440px) + "Действия" (120px)
- Example tags: `[closed]`, `finished`
- New item highlighted (green row)
- Click-to-edit on existing tag values (cursor hand in design)
- Delete icon (trash) per row

### Design Annotations
- Access: only current manager + senior manager can open Project Settings
- Employee DnD ordering: reorder display order in planner table (ticket #1622)
- Hover on role → placeholder "Click to add role", click for inline edit
- Post-add: employee appears in planner with project tasks; already-added employees filtered from dropdown

### Screenshots
- `artefacts/figma/planner-tasks-closing-tab-flat.png`
- `artefacts/figma/planner-project-members-tab-flat.png`
- `artefacts/figma/planner-project-settings-section-flat.png`
- `artefacts/figma/planner-member-add-variants-flat.png`
