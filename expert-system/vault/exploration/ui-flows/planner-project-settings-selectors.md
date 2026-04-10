---
type: exploration
tags:
  - planner
  - selectors
  - phase-c
  - project-settings
  - close-by-tag
created: '2026-03-28'
updated: '2026-03-28'
status: active
---
## Selectors Discovered During Phase C (Session 79)

### Planner Page — Navigation to Project Settings

**Role filter dropdown** ("Show projects where I am a"):
- Container: `page.getByText("Show projects where I am a")` then parent `.locator("[class*='selectbox__control']").first()`
- Options: `page.getByRole("option", { name: "PM", exact: true })`
- Needs `force: true` click — control may be partially overlapped
- Default value is "Member" — PM projects won't show unless changed to "PM"

**Project dropdown**:
- Combobox: `page.locator("[class*='planner__project-select']").getByRole("combobox")`
- Fill to search, then select option: `page.getByRole("option", { name: projectName, exact: true })`
- CSS class `planner__project-select` only on the project dropdown (not role filter)

**Project Settings icon** (gear):
- Selector: `page.locator(".planner__project-group-add .uikit-button").first()`
- `.first()` required — each employee row also has action buttons with similar class
- Only appears after a project is selected

### Project Settings Dialog

**Dialog root**: `page.getByRole("dialog", { name: "Project settings" })`

**Tasks closing tab**: `dialog.getByRole("button", { name: "Tasks closing" })`

**Tag input**: `dialog.getByRole("textbox", { name: "Add a tag" })`

**Add tag button**: `dialog.locator("button.add-employee-button")`
- Class from `PlannerTagsAdd.js` Formik form — `type="submit"` button
- NOT accessible by icon/SVG — must use class selector

**Tags table**: `dialog.getByRole("table")`

**Tag text in table** (for click-to-edit): 
- `tagsTable.locator("tbody").getByText(tagText, { exact: true })`
- Must click the text span directly, not the `<td>` — PlannerTag.js attaches onClick to span

**Inline edit input**: `tagsTable.locator("tbody input[class*='change-role-input']")`
- Appears after clicking tag text
- Enter → saves (triggers blur which sends PATCH if changed)
- Escape → reverts value and deactivates (no save)

**Delete tag button**: Row-scoped `button` within `tbody tr` filtered by `hasText`

**OK button**: `dialog.getByRole("button", { name: "OK" })`

**Notification**: `page.getByText("Changes have been saved")`
- Shown for: tag create, tag delete
- NOT shown for: tag inline edit (confirmed from `sagas.tsx` — `handleEditTagToProject` doesn't call `setSuccessGlobalEvent`)

### Timing Notes
- `globalConfig.delay()` needed after: role filter selection, project selection, tab switch, tag operations
- Tags table refresh is immediate after API response (saga dispatches `GET_TAGS_BY_PROJECT_ID_SUCCESS`)


## Permission Model (discovered session 80)

- Project Settings icon (`.planner__project-group-add .uikit-button`) visibility depends on user permissions for the selected project
- PM/SPM/admin can see and click the settings icon → opens "Project settings" dialog
- Plain members (`project_member` table) may see the icon DOM element but the dialog does NOT open for them
- Permission check: `PlannerCloseTagPermissionService` checks `isAdmin`, `managerId`, `seniorManagerId`, `ownerId`
- To find plain members: use `ttt_backend.project_member` table (NOT `planner_assignment` — that table doesn't exist)
- Exclude: `p.manager`, `p.senior_manager`, `p.old_owner` columns, and employees with `ROLE_ADMIN`/`ROLE_DEPARTMENT_MANAGER`/`ROLE_CHIEF_OFFICER` in `employee_global_roles`

## Delete Tag Selector (discovered session 80)

- Delete icon: `button` inside the tag row (no specific class needed — single button per row for delete)
- `settingsDialog.deleteTag(tagText)`: filter tbody row by text, click its button
- Delete triggers "Changes have been saved" notification (unlike edit which has no notification)
- No confirmation dialog — deletion is immediate

## Empty State (discovered session 80)

- When project has no close tags, the tags table shows "No data" text
- Informational text about auto-closing is visible: "Project tickets containing added values in the Info column will be automatically removed..."
- Query for tagless projects: `NOT EXISTS (SELECT 1 FROM planner_close_tag WHERE project_id = p.id)`

## Duplicate Edit Validation (discovered session 80)

- Editing tag-b to match existing tag-a: backend returns ValidationException
- The edit input appears to return to original state (tag-b text preserved)
- The saga does NOT show error notification — silent rejection
- Verify by checking tag counts: tag-a still has count=1, tag-b still exists
