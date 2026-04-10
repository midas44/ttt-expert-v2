# Test Plan: #2724 — Close-by-Tag Feature (Planner > Projects > Project Settings)

**Ticket:** https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/2724
**Branch under test:** release/2.1
**Test environment:** QA-1 (primary), Stage (reference — previous release without #2724)
**Tester:** Claude Code (automated + manual exploratory)
**Date:** 2026-03-30

---

## 1. Scope

The feature adds a "Tasks Closing" tab to the renamed "Project Settings" popup in Planner > Projects. Project managers can configure text tags per project. Assignments whose `ticket_info` contains any of these tags are automatically closed (hidden) when:
- The user clicks **OK** in the popup (triggers apply endpoint without tracker sync), OR
- The user clicks **Update tickets** icon-button (triggers tracker sync + close-by-tag).

### Out of scope
- Tracker sync functionality itself (no production tracker connection on QA)
- Cascade close (built then disabled in code — not part of current release)
- DnD reorder for tags (removed from requirements)

---

## 2. Test Environments & Accounts

| Environment | Purpose | URL |
|-------------|---------|-----|
| **QA-1** | Primary test env (has release/2.1 with #2724) | qa-1 TTT |
| **Stage** | Reference env (previous release, no #2724) | stage TTT |

### Test accounts (by role)

| Role | Account | Can open popup? | Can manage tags? | Can apply? |
|------|---------|-----------------|------------------|------------|
| **PM / Manager** | PM account on a small-data project | Yes | Yes | Yes |
| **SPM / Senior Manager** | If available | Yes | Yes | Yes |
| **Ordinary employee** (project member) | Employee account on same project | No (no icon) | No (403 on API) | No |
| **Admin** | Admin account | TBD — verify | TBD — verify | TBD — verify |

### Test projects

| Project | Data volume | Purpose |
|---------|-------------|---------|
| **Small project** | Few employees, few tasks | Happy path testing, fast feedback |
| **Large project** (e.g. DirectEnergie-ODC) | Many employees, thousands of tasks | Performance testing, Bug 6 regression |

### Test dates

| Date scenario | Purpose |
|---------------|---------|
| **Default date** (today / current planner date) | Basic flow |
| **Past date within report period** | Verify apply works on non-default dates |
| **Past date with reports** | Verify assignments with reports are NOT closed |
| **Date with no assignments** | Verify apply is a no-op |
| **Date after "Open for editing"** | Verify newly generated assignments are eligible |

---

## 3. Test Cases

### 3.1 Popup Opening, Layout & Navigation

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-01** | Popup opens via settings icon (PM role) | 1. Login as PM 2. Go to Planner > Projects 3. Click settings icon on a project | Popup opens with title "Project settings" / "Настройки проекта". Two tabs visible: "Project members" / "Tasks closing". OK button at bottom. | HIGH |
| **TC-02** | Tooltip on settings icon | Hover over the settings icon in the Comment column | Tooltip shows "Project settings" (EN) / "Настройки проекта" (RU) | MEDIUM |
| **TC-03** | Default tab is "Project members" | Open popup | "Project members" tab is active by default. Employee table is displayed. | MEDIUM |
| **TC-04** | Tab switching works | Click "Tasks closing" tab, then back to "Project members" | Content switches correctly. Tab underline follows active tab. | HIGH |
| **TC-05** | Popup opening — ordinary employee | 1. Login as ordinary employee (project member, not PM) 2. Go to Planner > Projects | Settings icon is NOT visible for this user, OR if visible, popup shows read-only / no tag management. | HIGH |
| **TC-06** | Popup opening on large-data project (Bug 6) | 1. Login as PM 2. Navigate to a large-data project (e.g. DirectEnergie-ODC) 3. Click settings icon | Popup should open (may be slow). Verify: does it open at all? Does it hang? Is there a spinner? Measure time. | HIGH |
| **TC-07** | Popup re-opening on large-data project (Bug 6 exact scenario) | 1. Open popup on large project 2. Add a tag 3. Close via OK 4. Wait for page reload 5. Click settings icon again | Popup should reopen. Previously reported: hangs with spinner, no network requests. | HIGH |

### 3.2 Tag CRUD — Tasks Closing Tab

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-08** | Add a tag — happy path | 1. Open popup > Tasks Closing tab 2. Type "[closed]" in input 3. Click "+" button | Tag appears in table. "Changes saved" notification shown. Row has green highlight. | HIGH |
| **TC-09** | Add tag — empty input validation | 1. Leave input empty 2. Click "+" | Error: "This is a required field". Tag NOT added. | HIGH |
| **TC-10** | Add tag — whitespace-only input | Type "   " (spaces only), click "+" | Should be treated as empty — error shown, tag NOT added. (Confluence: "entering space(s) should be treated as empty input") | HIGH |
| **TC-11** | Add tag — duplicate | 1. Add tag "[closed]" 2. Try to add "[closed]" again | Idempotent — either error message or silently returns existing tag. Verify no duplicate in table. | MEDIUM |
| **TC-12** | Add tag — special characters | Add tags: `[Done]`, `Готово`, `<script>alert(1)</script>`, `Done & Closed` | Tags stored and displayed correctly. No XSS. Special chars preserved. | MEDIUM |
| **TC-13** | Add tag — long string (200 chars per Confluence) | Type exactly 200 chars, click "+" | Tag added successfully. | MEDIUM |
| **TC-14** | Add tag — over 200 chars | Type 201+ chars | Per Confluence: 200 char limit. Verify: is input truncated? Is there a validation error? Or does it go through (DB allows 255)? Document actual behavior. | MEDIUM |
| **TC-15** | Inline edit tag — happy path | 1. Click on existing tag text in table 2. Change value 3. Press Enter or click away (blur) | Tag updated. Verify via API that value changed. | HIGH |
| **TC-16** | Inline edit tag — Escape cancels | 1. Click on tag, change value 2. Press Escape | Original value restored. No API call made. | MEDIUM |
| **TC-17** | Inline edit tag — to duplicate value | 1. Have tags "A" and "B" 2. Edit "B" to "A" | Should show error / revert. Verify behavior. | MEDIUM |
| **TC-18** | Delete tag | Click delete (trash) icon on a tag row | Tag removed from table. "Changes saved" notification. | HIGH |
| **TC-19** | Empty state — no tags | Open Tasks Closing tab on a project with no tags | Table shows "No data" message. | LOW |
| **TC-20** | Informational text displayed | Open Tasks Closing tab | Informational text about "Info" column and auto-closing is shown below tabs. Verify EN and RU text. | MEDIUM |
| **TC-21** | "Changes saved" notification on add/delete | Add a tag, then delete a tag | Green notification "Changes saved" / "Изменения сохранены" appears after each operation. | MEDIUM |
| **TC-22** | New tag green highlight + scroll | 1. Add enough tags to overflow the visible area 2. Add one more tag | New tag row has green left border. Table scrolls to show the new tag. | LOW |

### 3.3 Apply / Closing Logic — via OK Button

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-23** | OK on Tasks Closing tab — closes assignments without reports | 1. Setup: project with tag "[closed]", assignment with "[closed]" in ticket_info, NO reports on selected date 2. Click OK | Apply runs. Page reloads. Assignment is no longer visible on selected date. | HIGH |
| **TC-24** | OK — assignment WITH reports stays visible | 1. Same setup but assignment HAS reported hours on selected date 2. Click OK | Assignment remains visible (not closed). Reports protect from closing. | HIGH |
| **TC-25** | OK on Project Members tab — also triggers apply | 1. Project has close tags configured 2. Open popup, stay on Project Members tab 3. Click OK | Apply should trigger (same handler for both tabs). Page reloads. Assignments with tags are closed. | HIGH |
| **TC-26** | OK with no tags — just closes popup | 1. Project has NO close tags 2. Click OK on either tab | Popup closes immediately. No API call to apply. No page reload. | HIGH |
| **TC-27** | OK — loading state during apply | 1. Project with tags, some matching assignments 2. Click OK | Popup should show loading indicator (gray overlay/spinner) during apply. Document actual behavior. | MEDIUM |
| **TC-28** | Apply on non-default date | 1. In planner, navigate to a past date (within report period) 2. Open popup, add a tag matching an assignment on that date 3. Click OK | Apply uses the selected planner date, not today. Assignment on that date is closed. | HIGH |
| **TC-29** | Apply — only affects selected date | 1. Assignment spans multiple dates (visible on Mon and Tue) 2. Select Mon in planner 3. Click OK (with matching tag) | Assignment closed on Mon only. Still visible on Tue (if it has reports there, or is a generated assignment). | HIGH |
| **TC-30** | Apply — substring matching behavior | 1. Add tag "Done" 2. Assignment has ticket_info "Done, Alexander Strikalov" 3. Click OK | Assignment is closed (substring match). | HIGH |
| **TC-31** | Apply — false positive substring match | 1. Add tag "Done" 2. Assignment has ticket_info "Anna Donetskaya, In Progress" (contains "Done" as substring) 3. Click OK | Assignment IS closed (known accepted behavior — substring match). Document. | MEDIUM |
| **TC-32** | Apply — case insensitive matching | 1. Add tag "[CLOSED]" 2. Assignment has ticket_info containing "[closed]" (lowercase) | Assignment is closed (case-insensitive match). | MEDIUM |
| **TC-33** | Apply — multiple tags, OR logic | 1. Add tags "[closed]" and "finished" 2. Assignments: A has "[closed]", B has "finished", C has neither | A and B closed. C untouched. | MEDIUM |
| **TC-34** | Apply — blank ticket_info skipped | Assignment has empty/null ticket_info | Assignment is NOT closed regardless of tags. | MEDIUM |

### 3.4 Apply / Closing Logic — via Update Tickets Button

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-35** | Update tickets triggers close-by-tag | 1. Project with close tags configured 2. Close popup 3. Click "Update tickets" icon-button in planner | Even if tracker sync fails (no production tracker on QA), the close-by-tag action should still execute. Matching assignments should be closed. **Document actual behavior: does close-by-tag fire after failed sync?** | HIGH |
| **TC-36** | Update tickets — no tags configured | Click "Update tickets" on project without close tags | Normal refresh behavior. No assignments closed. No errors. | MEDIUM |
| **TC-37** | Update tickets on non-default date | 1. Navigate to a past date 2. Click "Update tickets" | Close-by-tag applies to the selected date, not today. | MEDIUM |
| **TC-38** | Update tickets — page content updates | After "Update tickets" completes | Planner table should update to reflect closed assignments. Verify: does it auto-update or require manual reload? | MEDIUM |

### 3.5 Permissions & Access Control

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-39** | PM can manage tags (full CRUD + apply) | Login as PM, open popup, add/edit/delete tags, click OK | All operations succeed. | HIGH |
| **TC-40** | Ordinary employee — no settings icon | Login as ordinary project member | Settings icon NOT visible in the Comment column. | HIGH |
| **TC-41** | Ordinary employee — API direct access to tag CRUD | Use browser console or API tool to call POST/PATCH/DELETE close-tags endpoints | Should return 403 Forbidden. | MEDIUM |
| **TC-42** | Ordinary employee — API direct access to apply | Call POST /v1/projects/{projectId}/close-tags/apply directly | **Verify behavior.** Per static analysis: NO permission check exists on apply endpoint. This may be a security bug — any authenticated user might be able to trigger close-by-tag. | HIGH |
| **TC-43** | Employee can list tags via API | Call GET /v1/projects/{projectId}/close-tags as employee | Should return 200 with tag list (read access is open). | LOW |
| **TC-44** | SPM / Senior Manager can manage tags | Login as SPM (if available), verify full CRUD + apply | All operations succeed. | MEDIUM |

### 3.6 Performance & Stability

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-45** | Popup open time — small project | Measure time to open popup on small project | Should be < 2 seconds. | MEDIUM |
| **TC-46** | Popup open time — large project | Measure time to open popup on large project (DirectEnergie-ODC) | May be slow but MUST NOT hang. Should open within reasonable time (< 30s). Document actual time. | HIGH |
| **TC-47** | Apply time — small project | Click OK on small project with tags | Page reload should happen within a few seconds. | LOW |
| **TC-48** | Apply time — large project | Click OK on large project with many assignments | May take longer, but MUST NOT hang. Spinner/loading indicator should be visible. Document actual time. | HIGH |
| **TC-49** | Repeated popup open/close cycles | Open popup, close, open again, close — repeat 5 times | No degradation, no memory leaks, no hanging. | MEDIUM |

### 3.7 Popup Closing Behavior

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-50** | Close by clicking outside — before any changes | Open popup, immediately click outside | Popup should close (mask-closable before changes). | HIGH |
| **TC-51** | Close by clicking outside — after changes | 1. Open popup 2. Add a tag or type in input 3. Click outside popup | Per implementation: popup should NOT close by clicking outside after input events. Only OK button works. **Document actual behavior.** | HIGH |
| **TC-52** | Close via OK — Tasks Closing tab, no tags | Open Tasks Closing tab (no tags), click OK | Popup closes. No apply call. No page reload. | MEDIUM |
| **TC-53** | Close via OK — Tasks Closing tab, with tags | Open Tasks Closing tab (has tags), click OK | Apply runs, loading shown, page reloads. | HIGH |
| **TC-54** | Close via OK — Project Members tab, no tags | Open Project Members tab (project has no tags), click OK | Popup closes. No apply. No reload. | MEDIUM |
| **TC-55** | Close via OK — Project Members tab, with tags | Open Project Members tab (project HAS tags), click OK | Apply should trigger (both tabs share same handler). Page reloads. | HIGH |
| **TC-56** | No X button visible | Open popup | There should be NO close (X) button in the top-right corner. Only OK button to close. | LOW |
| **TC-57** | Escape key behavior | Open popup, press Escape | **Document actual behavior.** Does Escape close the popup? Should it? | LOW |

### 3.8 Project Members Tab (Regression)

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-58** | Employee list displayed | Open Project Members tab | Employee table shows current project members with roles. | MEDIUM |
| **TC-59** | Add employee — happy path | Select employee from dropdown, click "+" | Employee added to table. "Changes saved" notification. Green highlight. | MEDIUM |
| **TC-60** | Add employee — no selection validation | Click "+" without selecting an employee | Error: "This is a required field" on the Employee dropdown. | LOW |
| **TC-61** | Employee DnD reorder (2+ rows) | Drag an employee row to a different position | Order changes. Planner table reflects new order. | LOW |
| **TC-62** | Delete employee | Click trash icon on an employee row | Employee removed. "Changes saved" notification. | LOW |
| **TC-63** | Inline edit role | Click on role cell, type new role, blur/Enter | Role updated inline. | LOW |

### 3.9 Cross-Project & Edge Cases

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-64** | Tags are project-scoped | 1. Add tag "[closed]" on Project A 2. Open popup on Project B | Project B should NOT show Project A's tags. Tags are independent per project. | MEDIUM |
| **TC-65** | Apply on project with no matching assignments | Project has tags but no assignments with matching ticket_info | Apply completes without error. No assignments changed. | LOW |
| **TC-66** | Apply after tag deletion | 1. Add tag, some assignments get closed on OK 2. Re-add different tag 3. Delete the original tag 4. Click OK | Only remaining tags are used for matching. Deleted tag no longer causes closures. | MEDIUM |
| **TC-67** | Multiple sequential applies on same date | Click OK, wait for reload, open popup, click OK again | Idempotent. Already-closed assignments stay closed. No errors. | LOW |

### 3.10 Language / i18n

| TC# | Title | Steps | Expected | Priority |
|-----|-------|-------|----------|----------|
| **TC-68** | EN language — all labels correct | Switch to English, open popup | Verify: "Project settings", "Project members", "Tasks closing", "Tags for closing tasks", "Actions", "OK", placeholder texts, error messages, notification text. | MEDIUM |
| **TC-69** | RU language — all labels correct | Switch to Russian, open popup | Verify: "Настройки проекта", "Участники проекта", "Закрытие задач", "Теги для закрытия задач", "Действия", "OK", placeholder texts, error messages, notification text. | MEDIUM |
| **TC-70** | Informational text on Tasks Closing tab — EN | View text in English | Should mention Info column and auto-removal behavior. | MEDIUM |
| **TC-71** | Informational text on Tasks Closing tab — RU | View text in Russian | Should mention Info/Инфо column and auto-removal behavior. | MEDIUM |

---

## 4. Test Execution Order

**Phase 1 — Smoke (TC-01, TC-04, TC-08, TC-18, TC-23, TC-40):** Verify basic popup opening, tab switching, tag CRUD, apply, and permission boundary.

**Phase 2 — Core Flows (TC-23..34, TC-35..38):** Apply via OK and Update tickets, different dates, matching logic.

**Phase 3 — Permissions (TC-39..44):** Full role matrix including API-level checks.

**Phase 4 — Popup Behavior (TC-50..57):** Closing mechanics on both tabs with/without tags.

**Phase 5 — Performance (TC-45..49):** Small vs large projects, repeated cycles.

**Phase 6 — Edge Cases & i18n (TC-64..71):** Cross-project, empty states, language checks.

**Phase 7 — Regression (TC-58..63):** Project Members tab still works correctly.

---

## 5. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Apply endpoint has no permission check (H1 from Stage B) | Any user could close assignments | TC-42 tests this directly |
| Substring false positives with short tags | Unintended mass closures | TC-31 documents, warn in report |
| Silent failure on apply error (H3) | User thinks apply succeeded when it didn't | TC-27 observes behavior |
| Bug 6: Popup hangs on large data | Feature unusable for biggest projects | TC-06, TC-07 test specifically |
| Update tickets fails (no tracker) | Close-by-tag might not fire | TC-35 tests this flow |

---

## 6. Deliverables

- `tasks/2724/test-plan.md` — this document
- `tasks/2724/test-report.md` — findings from dynamic testing (Stage D)
- `tasks/2724/screenshots/` — evidence screenshots
- `tasks/2724/bugs.md` — consolidated bug list with severity/references
