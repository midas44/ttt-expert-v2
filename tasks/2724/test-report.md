# Test Report: #2724 — Close-by-Tag Feature

**Ticket:** https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/2724
**Environment:** QA-1 (ttt-qa-1.noveogroup.com), Build 2.1.26-SNAPSHOT.LOCAL (26.03.2026)
**Tester:** Claude Code
**Date:** 2026-03-30
**Status:** COMPLETE

---

## Accounts & Projects Tested

| Account | Role | Projects Tested |
|---------|------|----------------|
| `pvaynmaster` (Pavel Weinmeister) | PM/CPO | Lazur (small, 0 assignments on test date) |
| `amalcev` (Alexander Malcev) | PM (ticket author) | **DirectEnergie-ODC** (huge: 2128 rows, 16 employees), **Predica-TMA** (small) |
| `dergachev` (Dmitry Dergachev) | Ordinary employee | Permission check — no settings icon visible |

---

## Test Execution Summary

| Phase | TCs | Status |
|-------|-----|--------|
| Popup opening, layout, tabs | TC-01..07 | 7/7 PASS |
| Tag CRUD | TC-08..15, TC-18..22 | 11 PASS, 1 FAIL (BUG-6: inline edit), 1 finding (BUG-1: whitespace) |
| Apply via OK button | TC-23, TC-24, TC-26, TC-27, TC-29, TC-30, TC-53, TC-55 | 8/8 PASS |
| Apply via Update Tickets | TC-35, TC-36 | Tested — see findings below |
| Popup close behavior | TC-50, TC-51, TC-56 | 3/3 PASS |
| Permissions | TC-05, TC-40 | 2/2 PASS |
| Performance | TC-06, TC-07, TC-48 | 3/3 PASS (slow but functional) |
| Special chars & edge cases | TC-12, TC-14, TC-64 | 3/3 PASS (with findings) |
| i18n EN + RU | TC-68..71 | 4/4 PASS |

**Total: 43+ test cases executed | 6 active bugs (BUG-7 promoted to CONFIRMED) | 1 resolved | multiple observations**

---

## Bugs Found

### BUG-1: Whitespace-only tag input bypasses frontend validation [MEDIUM]
- **TC:** TC-10
- **Steps:** Type spaces only in tag input > Click "+"
- **Expected:** "Mandatory field" error (Confluence: spaces = empty)
- **Actual:** Sent to backend, returns 400. Generic error banner shown.
- **Screenshot:** [04-whitespace-tag-server-error.png](screenshots/04-whitespace-tag-server-error.png)

### BUG-2: API calls to `/projects/undefined/close-tags` on page load [LOW]
- **TC:** Discovered during TC-01
- **Steps:** Navigate to Planner > Projects before selecting any project
- **Actual:** Console 404 errors for `/projects/undefined/members` and `/projects/undefined/close-tags`
- **Screenshot:** [01-projects-tab-undefined-error.png](screenshots/01-projects-tab-undefined-error.png)

### BUG-3: No green highlight on newly added tag rows [LOW]
- **TC:** TC-08
- **Expected:** Green left border on new row (per Figma/Confluence 7.4.4)
- **Actual:** No highlight
- **Screenshot:** [05-tag-added-closed.png](screenshots/05-tag-added-closed.png)

### ~~BUG-4: Apply endpoint not deployed~~ — RESOLVED
- **Was:** 500 "POST not supported" on build 22.03
- **Resolution:** Redeployed QA-1 to build 26.03. Apply works correctly.

### BUG-5: Silent failure — no error notification when apply fails [MEDIUM]
- **TC:** TC-53 (observed on old build where apply returned 500)
- **Expected:** Error notification shown to user
- **Actual:** Dialog closes silently. No error message. No page reload.
- **Root cause (code):** Saga catch block only calls `devLog(error)`, missing `setErrorGlobalEvent()`.

### BUG-6: Inline tag editing does not activate [MEDIUM]
- **TC:** TC-15
- **Steps:** Click or double-click on tag text in table
- **Expected:** Inline editing mode (per Confluence 7.4.4: "format: inline editing")
- **Actual:** Nothing happens. Cell is not interactive.
- **Screenshot:** [07-tag-cell-not-editable.png](screenshots/07-tag-cell-not-editable.png)

---

## Passed Tests

| TC# | Title | Account | Project | Notes |
|-----|-------|---------|---------|-------|
| TC-01 | Popup opens correctly | pvaynmaster | Lazur | Title "Project settings", two tabs, OK button |
| TC-02 | Tooltip on icon | pvaynmaster, amalcev | Lazur, Predica | EN: "Project settings", RU: "Настройки проекта" |
| TC-03 | Default tab is Project members | pvaynmaster | Lazur | Confirmed |
| TC-04 | Tab switching works | pvaynmaster | Lazur | URL updates to `/project-members` or `/task-closing` |
| TC-05 | Employee — no settings icon | dergachev | N/A | No icon in Comment column for employee |
| TC-06 | Popup opens on large project | amalcev | DirectEnergie-ODC | Opens but takes >5s (slow, NOT hanging) |
| TC-07 | Popup re-opens after apply on large project | amalcev | DirectEnergie-ODC | Re-opens successfully (Bug 6 regression PASS) |
| TC-08 | Add tag happy path | pvaynmaster | Lazur | "Changes have been saved" notification |
| TC-09 | Empty input validation | pvaynmaster | Lazur | "Mandatory field" error shown |
| TC-11 | Duplicate tag idempotent | pvaynmaster | Lazur | No duplicate row created |
| TC-12 | Special characters | amalcev | Predica-TMA | `Готово & <script>alert(1)</script>` — no XSS, chars preserved |
| TC-14 | Long tag (201 chars) | amalcev | Predica-TMA | Accepted — no 200-char limit enforced |
| TC-18 | Delete tag | pvaynmaster | Lazur | "Changes have been saved", "Delete" tooltip |
| TC-19 | Empty state | pvaynmaster | Lazur | "No data" displayed |
| TC-20 | Informational text | pvaynmaster | Lazur | Text with bold **Info** correct |
| TC-21 | Changes saved notification | pvaynmaster | Lazur | Shown on add and delete |
| TC-23 | Apply closes assignments without reports | amalcev | DirectEnergie-ODC | Tag "Ready to test" — assignments without reports closed |
| TC-24 | Apply preserves assignments with reports | amalcev | DirectEnergie-ODC | Task with 0.3h reports stayed visible |
| TC-26 | OK with no tags | pvaynmaster | Lazur | Popup closes, no apply, no reload |
| TC-27 | Loading state during apply | amalcev | DirectEnergie-ODC | Gray overlay + spinner visible during processing |
| TC-29 | Apply only affects selected date | amalcev | DirectEnergie-ODC | Thu 26: 314 "Ready to test" untouched. Fri 27 (apply): 1 remains. No propagation. |
| TC-30 | Substring matching works | amalcev | DirectEnergie-ODC | "Ready to test" matched in Info column |
| TC-35 | Update Tickets button | amalcev | Predica-TMA | See "Update Tickets Behavior" section below |
| TC-40 | Employee no settings icon | dergachev | N/A | Confirmed |
| TC-48 | Apply on large project | amalcev | DirectEnergie-ODC | 2128 rows processed without crash |
| TC-50 | Click outside before changes | amalcev | Predica-TMA | Dialog closes (mask-close works before input) |
| TC-51 | Click outside after changes | pvaynmaster | Lazur | Dialog stays open (mask-close disabled) |
| TC-53 | OK on Tasks Closing with tags | pvaynmaster, amalcev | Lazur, DirectEnergie-ODC | Apply succeeds, page reloads |
| TC-55 | OK on Project Members with tags | pvaynmaster | Lazur | Apply also fires from Members tab |
| TC-56 | No X close button | pvaynmaster | Lazur | Confirmed — `closable={false}` |
| TC-64 | Tags are project-scoped | pvaynmaster, amalcev | Lazur, Predica | Tags on one project don't appear on another |
| TC-68 | EN labels correct | pvaynmaster | Lazur | All labels verified |
| TC-69 | RU labels correct | pvaynmaster | Lazur | All labels verified |
| TC-70 | EN informational text | pvaynmaster | Lazur | Correct with bold "Info" |
| TC-71 | RU informational text | pvaynmaster | Lazur | Correct with bold "Инфо" |

---

## Update Tickets Button Behavior (TC-35..38)

**How it works (current implementation):**

| Action | Trigger | What happens | Close-by-tag? | Page reload? |
|--------|---------|-------------|---------------|-------------|
| **OK button** (with tags) | Click OK in popup | Calls `POST /close-tags/apply` | YES (dedicated endpoint) | YES (`window.location.reload()`) |
| **Update Tickets** icon | Click sync icon in Tracker column header | Calls `POST /v1/tasks/refresh` with plannerSection | Unclear — may trigger as part of refresh | NO (in-place update) |

**Update Tickets observations:**
- Shows green notification: "Tickets have been successfully updated"
- Does NOT reload the page — updates table in-place
- Tracker sync likely fails on QA (no production tracker connection) but still reports success
- Whether close-by-tag fires as part of this flow requires further investigation with a project that has matching assignments AND the tracker configured

**Key difference from OK button:** The OK button explicitly calls the `/close-tags/apply` endpoint. The Update Tickets button calls `/tasks/refresh` which may or may not include close-by-tag processing depending on the backend implementation. Per Confluence requirement 7.4.6, BOTH should trigger close-by-tag.

---

## Popup Behavior Summary (per user's request)

### Opening
- Opens via settings icon in the Comment column header (only visible for PM accounts when a project is selected)
- Default tab: **Project members**
- If URL already contains `/task-closing`, re-opens on Tasks Closing tab directly
- On large projects (DirectEnergie-ODC): takes >5 seconds to open, but does NOT hang

### Editing
- **Tag CRUD** (add/delete): immediate server-side save, "Changes have been saved" notification
- **Inline tag edit**: DOES NOT WORK (BUG-6) — click/double-click on tag text has no effect
- **Employee CRUD** on Project Members tab: appears to work normally (not extensively tested)
- After any input event inside the dialog, clicking outside the dialog is blocked (mask-close disabled)

### Closing by OK button
- **No tags exist**: popup closes immediately, no API call, no reload
- **Tags exist**:
  1. Shows loading overlay (gray spinner)
  2. Calls `POST /v1/projects/{id}/close-tags/apply` with selected planner date
  3. On success: `window.location.reload()` — full page reload (loses scroll, date selection, all state)
  4. On failure: dialog closes silently, no error notification (BUG-5)
- **Same behavior on both tabs**: OK button triggers apply from either Project Members or Tasks Closing tab

### Closing by clicking outside
- **Before any input**: dialog closes normally
- **After any input event**: dialog cannot be closed by clicking outside (only OK button works)

### Closing by Update Tickets icon-button
- The Update Tickets button is **outside** the popup, in the Tracker column header
- It does NOT close the popup — it operates independently
- Triggers tracker sync + shows green notification
- Does NOT do a page reload

---

## Propagation & Clock Change Tests (Session 2 — 2026-03-30)

### Propagation Analysis (Diabolocom-AI, [backlog] tag)
Applied close-by-tag on multiple dates. DB-level verification:

| Finding | Detail |
|---------|--------|
| **Apply is per-date only** | `CloseByTagServiceImpl.apply()` processes ONLY the selected date |
| **Backward cascade exists** | `AssignmentCascadeCloseService` closes PREVIOUS dates without reports |
| **No explicit forward propagation** | Future blocking is emergent (closed records prevent virtual assignment generation) |
| **Reports protect individually** | Each date with reports survives, propagation resumes on next report-less date |
| **Multiple applies needed** | To close a date range, PM must apply on each date individually |

### Clock Change Test
- Advanced backend clock to Mar 31 via `PATCH /test/clock`
- Called apply on Mar 31 → returned 200 OK, but no new records created
- **Conclusion:** The apply endpoint does not trigger virtual assignment generation — it only processes already-existing assignments. Full clock change test requires opening the planner UI as a PM user.

### BUG-7 Confirmed
- Dergachev (global PM, NOT a Diabolocom-AI member) called apply on project 3134 → **200 OK**
- No permission check prevents cross-project close-by-tag execution
- Severity upgraded from MEDIUM to **HIGH**

### "Open for editing" — Not Testable
- "Open for editing" is derived from office report period settings, not a per-date toggle
- Testing would require modifying office period settings affecting all employees

---

## Additional Observations

| # | Description |
|---|-------------|
| OBS-1 | Tab switching modifies browser URL — creates history entries |
| OBS-2 | Validation text "Mandatory field" differs from Confluence "This is a required field" |
| OBS-3 | Date selection resets to default after `window.location.reload()` (state loss) |
| OBS-4 | No 200-char tag limit enforced (Confluence specifies 200, DB allows 255, both frontend and backend allow 201+) |
| OBS-5 | No success notification visible after apply — page reloads before toast can appear |
| OBS-6 | DirectEnergie-ODC: 2128 rows, 16 employees — all operations slow (>5s) but functional |
| OBS-7 | Swagger MCP `PATCH /test/clock` body serialization fails (NPE) — must use browser JWT fetch instead |
| OBS-8 | CAS demo login doesn't reliably switch users — session stickiness prevents account switching in browser |

---

## Screenshots Index

| File | Description |
|------|-------------|
| 01-projects-tab-undefined-error.png | BUG-2: /projects/undefined API calls |
| 02-popup-project-members-tab.png | Project Members tab default state |
| 03-tasks-closing-tab-empty.png | Tasks Closing tab empty state |
| 04-whitespace-tag-server-error.png | BUG-1: Whitespace causes server error |
| 05-tag-added-closed.png | BUG-3: Tag added without green highlight |
| 07-tag-cell-not-editable.png | BUG-6: Inline edit not activating |
| 08-after-ok-silent-failure.png | BUG-5: Silent failure after apply error |
| 09-employee-no-settings-icon.png | TC-40: No icon for employee user |
| 10-ru-labels-tasks-closing.png | TC-69/71: All RU labels correct |
| 11-directenergie-loaded.png | DirectEnergie-ODC planner table with real data |
| 12-directenergie-popup-attempt.png | TC-06: Popup opening on heavy project |
| 13-directenergie-tasks-closing.png | Tasks Closing tab on DirectEnergie-ODC |
| 14-directenergie-tag-added.png | "Ready to test" tag added |
| 15-directenergie-after-apply.png | After apply: loading overlay visible |
| 16-directenergie-after-reload.png | After reload: "Ready to test" task with reports survived |
| 17-popup-reopen-for-cleanup.png | TC-07: Popup re-opens after apply on heavy project |
| 18-tag-deleted-cleanup.png | Cleanup: tag deleted |
| 19-cleanup-done.png | Cleanup complete |
| 20-update-tickets-notification.png | TC-35: "Tickets have been successfully updated" |
