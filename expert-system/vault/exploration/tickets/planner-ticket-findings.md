---
type: investigation
tags:
  - planner
  - ticket-mining
  - gitlab
  - bugs
  - sprint-15
created: '2026-03-27'
updated: '2026-03-27'
status: active
related:
  - '[[modules/planner-assignment-backend]]'
  - '[[modules/frontend-planner-module]]'
  - '[[exploration/tickets/t2724-investigation]]'
---
# Planner Module — GitLab Ticket Mining

## Mining Summary (Session 71)
- **Total unique tickets found:** ~130+
- **Currently open:** ~75-80
- **Open bugs:** ~30+
- **Feature requests:** ~25+
- **Active sprint (14-15-16):** ~17
- **Canceled performance tickets:** 7

## Active Sprint 15 Bugs (High Priority for Testing)

| Ticket | Title | State | Impact |
|--------|-------|-------|--------|
| #2724 | Close-by-tag auto task closing | Ready to Test | New feature — 6 MRs, 2 open bugs |
| #3332 | Tasks duplicated after reordering (DnD) | To Do | Race condition, 3 competing state update paths |
| #3314 | Task order reset on "Open for Editing" | To Do | 4 root causes (push vs splice, saga no-op, sortIndex desync) |
| #3386 | Deleted tasks in "Copy the table" | Production Ready | Closed/deleted tasks appear in copy output |
| #3375 | Update members order in project planner | In Progress | UX improvement |
| #3406 | Error on refresh button press | Open | No labels yet |
| #3296 | Approved status not removed after hours change | To Do | Confirmation state inconsistency |
| #3294 | Deleting today's task requires page reload | To Do | Frontend state not updated |

## Critical Open Backlog Bugs

| Ticket | Title | Severity | Category |
|--------|-------|----------|----------|
| #2914 | Can report >36 hours/day via project planner | High | Data validation |
| #2302 | Filled hours disappear on tracker sync | High | Data loss risk |
| #2832 | Must constantly refresh page to see changes | Medium | Real-time updates |
| #2696 | Error if deleted project employee is logged in | Medium | Edge case |
| #2600 | Wrong name in history changes | Low | Display |
| #2569 | Task move attempt in Tasks tab fails | Medium | DnD |
| #2511 | URGENT - Jira PAT auth problem | High | Tracker integration |
| #2461 | Failed to load hours from GitLab | Medium | Tracker integration |
| #2447 | "Open for Editing" functionality issues | Medium | Core feature |
| #2338 | Planner sometimes doesn't update tickets | Medium | Sync reliability |
| #2337 | Statuses displayed in different languages | Low | i18n |
| #3274 | Incorrect Total value in Personal Planner | Low | Calculation |

## Canceled Performance Tickets (Historical Context for #2724)

These tickets document the performance problem that led to the close-by-tag feature:

| Ticket | Title | Insight |
|--------|-------|---------|
| #2408 | Table grows too quickly | Original root cause — assignments never cleaned up |
| #2506 | Page cannot be loaded in sensible time | Large project loading failure |
| #2351 | Low performance on large tables | DirectEnergie-ODC project specific |
| #2331 | Planner consumes 2+ GB RAM | Memory leak / unbounded growth |
| #1857 | Interface very slow on large project | User-reported performance |
| #1790 | Add function to delete completed assignments | The manual solution that was never implemented |

## Key Ticket: #3394 — Document Current Behaviour + E2E Tests
**State:** Open, To Do
**Directly relevant to our scope:** This ticket asks for documentation of current planner behavior and E2E test creation — exactly what we're doing.

## Test-Worthy Bug Categories

### 1. DnD / Ordering Bugs (#3332, #3314, #3308, #2569)
Race conditions between optimistic local reorder, WebSocket events, and unconditional refetch. 4 distinct root causes identified. High regression test value.

### 2. Data Integrity (#2914, #2302, #3296)
- Can report >36h/day via project planner (no validation)
- Hours disappear on tracker sync (data loss)
- Approved status not removed after hours change

### 3. Real-time Update Issues (#2832, #3294, #1949)
Page doesn't update after various operations — constant manual refresh needed. WebSocket events missing or not handled.

### 4. Tracker Integration (#2511, #2461, #2468, #2338, #3341, #3237)
Jira PAT auth, GitLab loading failures, ClickUp API changes, sync reliability. Large sub-topic.

### 5. "Open for Editing" (#2447, #1895, #3314)
Functionality issues, proposal to remove the button entirely. Interacts with close-by-tag propagation.

### 6. History / Copy Table (#3386, #3207, #2600)
Deleted/closed tasks appearing where they shouldn't. History changes display bugs.


## Deep-Dived Tickets (Session 72)

### #2408 — [Planner] Table grows quickly (CLOSED → Canceled)

**State:** Canceled (2026-02-19, superseded by #2724)
**Author:** amalcev (2022-09-20)
**Labels:** Canceled, Planner

**Problem:** Project with many developers (10+) and many small tasks — table grows uncontrollably. Three pain points:
1. Manual cleanup every day is too labor-intensive
2. Scrolling hundreds of tickets during standup is very inconvenient
3. Causes severe lag (refreshing closed tickets)

**Proposed solutions (never implemented):**
- Auto-remove tasks with tracker statuses (Resolved/Closed) that had no reports recently
- Button to remove all unnecessary tasks for all project employees
- Integrate cleanup into "Refresh tasks" function
- View/filter to hide tasks without recent reports

**Key follow-ups:**
- amalcev (2024-04): "Can this be accelerated?"
- amalcev (2024-09): "Planner lags very severely because of this, impossible to use"
- **Closed** 2026-02-19 as "implementing within #2724"

**Significance for #2724:** This is the original root cause ticket. The close-by-tag feature (#2724) directly addresses this 3.5-year-old pain point. All proposed solutions from #2408 inform test scenarios for #2724.

---

### #3375 — [UX][Planner][Projects] Update members order in project planner (OPEN)

**State:** opened, In Progress (Sprint 15)
**Author:** imalakhovskaia (2026-01-12)
**Labels:** In Progress, Sprint 15

**Source:** User report from E. Galkina (project manager), three distinct issues:

**Issue 1 — Employee ordering broken:**
> "With the last TTT update, the order of people in the planner broke. Now it's alphabetical order. Before: whatever order in the list of people on the project, same in the planner. I have the order people speak at the daily standup."

**Issue 2 — Info column display broken:**
Multi-line content in Info column partially hidden, no square brackets, possibly extra fields (API fields like `assignee`).

**Issue 3 — Old tasks reappearing:**
Tasks that were previously hidden now showing 10-15-20 tickets per person (normally 3-7 max).

**QA Analysis (vulyanov, 2026-01-14):**
- Issue 1: **Regression from #3258 release.** Employee order in Planner > Projects no longer matches "Employees on project" popup (DnD-customizable order now replaced by alphabetical). Since popup has DnD reorder feature, it was clearly designed to control planner display order.
- Issue 2: Possibly related to #3254, also regression from #3258. Need design clarification for Info column display.
- Issue 3: Related to #2408 / #2724 — assignment functionality needs rework.

**Figma:** https://www.figma.com/design/H2aXBseq7Ui60zlh5vhyjy/Noveo-TTT?node-id=44604-89145

**Test-worthy:** Verify employee order matches Project Members popup DnD order; verify Info column display; verify old tasks behavior after close-by-tag.

---

### #3332 — [Bug][Planner] Tasks are duplicated after reordering (OPEN)

**State:** opened, To Do (Sprint 15)
**Author:** omaksimova (2025-11-05)
**Labels:** Frontend, Sprint 15, To Do
**Assignee:** ishumchenko (frontend dev)
**Env:** prod (all environments), Chrome + Firefox

**Steps:**
1. Open Planner
2. Click "Open for editing"
3. Drag Task A below Task B

**Expected:** Tasks reorder without duplication
**Actual:** Both original AND reordered copies appear → duplicated tasks

**Evidence:** Video showing duplication in real-time.

**Root cause analysis:** Not yet investigated in comments. Likely a React state management issue — optimistic local reorder + Redux store update + possible WebSocket refetch creates race condition with duplicate entries.

**Test-worthy:** High regression value. Verify DnD reorder doesn't duplicate tasks.

---

### #3314 — [Bug][Planner] Task order reset on "Open for Editing" (OPEN)

**State:** opened, To Do (Sprint 15)
**Author:** omaksimova (2025-09-29)
**Labels:** Sprint 15, To Do
**Assignee:** ishumchenko (frontend dev)
**Env:** prod

**Steps:**
1. Open Planner (correct task order visible)
2. Click "Open for editing" button

**Expected:** Task order stays the same
**Actual:** Task order is disrupted; correct order only restored after page refresh

**Backend investigation (jsaidov, 2025-10-10):**
Compared API responses for 2 employees:
- `GET /v1/assignments` (view mode)
- `POST /v1/assignments/generate` (edit mode)

**Conclusion: Backend returns IDENTICAL order for both APIs.** Task IDs match 1:1 in the same sequence. This is a **confirmed frontend bug** — the UI disrupts order when transitioning between view and edit modes despite receiving identical data from the API.

**Reassigned:** jsaidov → ishumchenko (frontend dev) after confirming frontend root cause.

**Test-worthy:** Verify "Open for editing" preserves task order. API contract verified correct — test should focus on frontend behavior.

## Ticket Relationship Web (Updated)

```
#2408 (table growth, 2022) ─cancelled─→ #2724 (close-by-tag, 2023-2026)
                                              ├─related─→ #3375 (order broken, 2026)
                                              │               └─related─→ #3258 (UI refactor)
                                              │                              └─related─→ #3254 (info column)
                                              ├─related─→ #3332 (DnD duplication)
                                              │               └─mentioned─→ #3255
                                              ├─related─→ #3314 (order reset)
                                              ├─design─→ #2319 (future: non-instant apply)
                                              └─performance─→ #2506, #1857, #2351, #2331, #1790
```


## Additional Tickets Deep-Dived (Session 73)

### #3406 — Refresh button error (OPEN)

**State:** opened (no labels, no assignee)
**Author:** snavrockiy (2026-03-23)
**Comments:** 0 non-system

**Description:** Error occurs when pressing the refresh button (Планировщик). Report from Elena Galkina. Contains 2 screenshot uploads but minimal description — just "У Елены Галкиной ошибка при нажатии на кнопку рефрешь".

**Analysis:** Low-info ticket. No reproduction steps, no error message text, no environment specified. Screenshots would need download to assess. Likely related to `fetchProjectTasksRefresh` saga refactored in !5313 (session 72 finding).

**Test-worthy:** Regression test for refresh button functionality.

---

### #2914 — >36h/day via project planner (OPEN)

**State:** opened
**Author:** vulyanov (2024-03-07)
**Labels:** Planner
**Comments:** 0 non-system
**Env:** prod + qa-1

**Problem:** When inline-editing hours in the project planner, validation only checks the sum of reported hours **per one project** (the currently selected project), not the total across all projects. This allows reporting >36h in a single day (sum across multiple projects).

**Key detail:** This is specifically about manual inline editing — missing validation on tracker import is a separate known issue.

**Evidence:** 2 screenshots showing >36h input and display.

**Test-worthy:** HIGH priority. Validate that inline hour editing checks global daily sum, not per-project sum. Boundary test at 36h limit.

---

### #2302 — Hours disappear on tracker sync (OPEN)

**State:** opened
**Author:** sgrigorenko (via amalcev) (2022-03-23)
**Labels:** Analytical Task, High, Planner
**Comments:** 1 non-system from mpotter (2022-10-18)

**Problem:** When pressing "Load hours from tracker" in the project planner, hours previously filled for tasks without tracker links (daily, communications, etc.) are zeroed out if the tracker has no corresponding tasks.

**Design decision (mpotter):** This was intentional — "single source of truth" design. Either TTT is the source (exports to tracker, TTT normalizes) or tracker is the source (TTT imports and keeps only what came from tracker). Merging both sources would be "extremely difficult to handle all cases". But mpotter agrees: "adding a warning on import is a good idea."

**Test-worthy:** Verify tracker sync behavior with mixed TTT-only and tracker tasks. Verify warning message (if implemented).

---

### #3258 — UI refactor: sorting + padding (CLOSED)

**State:** closed (Sprint 14)
**Author:** imalakhovskaia (2025-05-27)
**Comments:** 9 non-system (detailed QA from omaksimova)

**This ticket is the ROOT CAUSE of regression #3375.** UI refactor that changed padding, sorting, and assignment display behavior.

**QA findings from omaksimova (2025-09-17–18):**
1. Padding 20px instead of required 16px — `[in progress]` status doesn't fit in one line
2. Projects not sorted alphabetically (EN and RU versions)
3. Employees not sorted properly on Projects tab
4. Green highlight not showing on newly added tasks in Projects tab
5. DnD task jump: task visually bounces back to original position then settles (race condition with server response)
6. **Backend bug**: Generated assignment disappears if no hours entered or page refreshed → #3307
7. **Backend bug**: DnD order not persisted next day → #3308

**Key observation:** The DnD visual bounce (point 5) is a separate manifestation from #3332 (duplication). The bounce is cosmetic (optimistic → server → reconcile), while #3332 is a state management bug (duplicate IDs in order array).

---

### #3308 — DnD order not persisted (CLOSED)

**State:** closed (Sprint 14, Backend, R+)
**Author:** vulyanov (2025-09-17)
**Comments:** 18 system-only (no non-system)

**Problem:** Requirement §6.3: "Generated assignments can be moved via DnD, system must remember order and display same order next day." But DnD order resets the next day.

**Env:** qa-2

**Steps:** Open Planner → choose date 2-3 days before today → DnD reorder → next day check → order reset.

**Relation:** Spawned from #3258 QA testing. Backend fix was applied (R+ label = code reviewed).

---

### Open Planner Ticket Landscape (Session 73 refresh)

**50 open Planner-labeled tickets** as of 2026-03-28. Key categories:

| Category | Count | Key Tickets |
|----------|-------|------------|
| Close-by-tag (#2724) | 1 | #2724 (Ready to Test) |
| DnD/Ordering | 3 | #3332, #3314, #3375 |
| Data validation | 2 | #2914 (>36h), #3296 (approved status) |
| Tracker integration | 5+ | #2511, #2461, #2488, #2338, #2302 |
| Real-time updates | 3 | #2832, #3294, #1949 |
| UX improvements | 10+ | #2319, #2501, #2548, #3183, etc. |
| Legacy bugs | 15+ | Various older issues from 2019-2024 |
| Documentation | 2 | #3394 (document behavior), #1810 (Confluence) |

## Root Causes Identified (Session 73)

### #3332 Root Cause — CONFIRMED
**File:** `generateTaskAssignments.ts` line 90
**Mechanism:** `newOrder[groupKey].push(newId)` appends new ID without removing old ID from order array. Old ID deleted from map but not from order → duplicate visual rows.
**Commented-out fix exists:** lines 81-85 `splice(sortIndex, 1, newId)` was the correct approach but left commented.

### #3314 Root Cause — CONFIRMED
**File:** `TasksPlannerTable.tsx` lines 80-128
**Mechanism:** `useEffect` re-sorts by `readOnly` status on ANY state change. When "Open for editing" changes readOnly flag, `.sort()` destroys DnD order. `return 0` for equal elements doesn't guarantee position preservation.

See [[exploration/tickets/planner-dnd-bugs-analysis]] for full technical analysis.


## Tracker Integration Tickets Deep-Dived (Session 75)

### #2511 — URGENT: Jira PAT Auth Problem (OPEN, 3+ years)

**State:** opened (2023-02-07, last updated 2024-12-20)
**Labels:** Planner
**Author:** amalcev

**Problem:** Seagate migrated to new Jira with passwordless auth (email code + 2FA). Jira allows generating Personal Access Tokens (PAT). When adding tracker in TTT as "Jira Cloud", it complains about incorrect server.

**Key comments:**
- amalcev (2023-03-16): "This problem blocks the use of Planner on Seagate projects"
- amalcev (2023-07-24): Asks if feature is planned
- ipanchenko (2023-09-20): Linked to #2570 and #2571

**Impact:** TTT cannot authenticate to Jira instances requiring PAT-only auth. Blocks tracker integration for all projects on such instances. **Unresolved 3+ years.**

**Test-worthy:** Verify tracker credential types (JIRA_TOKEN, JIRA_LOGPASS); test error handling for unsupported auth.

---

### #2461 — Failed to Load Hours from GitLab (OPEN)

**State:** opened (2022-11-24, last updated 2024-12-20)
**Labels:** Planner, To Do
**Author:** vulyanov

**Problem:** GitLab Cloud hours import fails with "Failed to load hours. Try again later."

**Key comments:**
- vulyanov: Reproduced with gitlab.com. Connection OK, tasks link OK, but hours load fails. Error messages differ between manager and employee roles. Sometimes hours DO load despite error.
- mpotter (developer, 2022-11-24): GitLab Server vs Cloud API is actually the same. Jira Server/Cloud difference is only in auth.
- mpotter (2022-11-29): **Root cause — GitLab API responds very slowly, some requests return 500.** Fix attempted: increased response timeout and decreased page size (commits 2bea658, 2a0a2ef, 5f15506). But won't solve fundamental slowness.

**Impact:** GitLab Cloud hours import unreliable. Partially mitigated but fundamentally unresolved.

**Test-worthy:** Test "Load from tracker" with GitLab; verify timeout handling; verify error messages are consistent per role.

---

### #2488 — Task Not Linked to Tracker Cross-Project (OPEN)

**State:** opened (2023-01-11, last updated 2026-02-19)
**Labels:** Planner

**Problem:** Task PIOS-217 already linked to project Seagate-MobileToolkit-TM. When trying to add same task to Seagate-Primal-ODC, it doesn't link. Suspected duplicate of #2323.

**Impact:** **Architecture limitation** — same tracker ticket cannot be linked from multiple TTT projects. Related to #3198 (multiple project integration with same tracker) and #3341 (ClickUp multi-space).

---

### #2338 — Planner Sometimes Doesn't Refresh Tickets (OPEN, 4+ years)

**State:** opened (2022-06-16, last updated 2024-09-02)
**Labels:** Planner

**Problem:** "Refresh tickets" fails intermittently. Error response shows `"updated":[],"failed":[...]` with two error types:
1. `exception.unhandled` / Timeout (e.g., AMSDK-1125 against jira.corp.lyveminds.com)
2. `exception.tracker.not.available` / "Issue tracker not responding" (multiple tasks)

**Key comments:**
- amalcev (2024-09-02): "The feature still doesn't work" — screenshots showing it's STILL broken 2+ years later

**Impact:** No retry logic or graceful degradation. Entire refresh fails if external Jira is slow/unavailable.

**Test-worthy:** Test refresh with tracker timeouts; verify partial success reporting; verify error display.

---

### Additional Tracker Tickets from Search (49 total found)

| Ticket | Title | Status | Key Finding |
|--------|-------|--------|------------|
| #3394 | Document planner behavior + E2E tests | OPEN | Massive spec: Refresh only updates metadata, Load also imports hours for selected date only |
| #3296 | Approved status not cleared after import | OPEN | Hours change but approval stays green |
| #3341 | ClickUp multi-space not supported | OPEN | Two TTT projects can't link to same ClickUp tracker |
| #3378 | Custom tracker sync scripts on external cloud | OPEN | External dependency — cloud.noveogroup.com unavailability broke sync |
| #3018 | Task name not updated after rename | OPEN | Cached name persists, refresh only updates existing planner tasks |
| #3238 | ClickUp URL change broke export | CLOSED | `app.clickup.com` → `api.clickup.com`, info endpoint returned `enabled: false` |
| #2352 | SSL handshake failure (GitLab) | CLOSED | SNI was disabled for old Redmine, fixed |
| #2282 | Jira 1-minute worklog delay | Known limitation | Jira API doesn't return worklogs updated within last minute |
| #3275 | Task not added from Projects tab | Can't reproduce | Validation error on URL paste, projectId mismatch |
| #2039 | Unhandled error when adding tracker | OPEN | No error handling when API inaccessible |
| #2310 | Wrong type for password field | OPEN | Minor UX |
| #2448 | Incorrect error when no tracker type selected | OPEN | Wrong error message |
| #3198 | Support multiple projects per tracker | OPEN | Architecture enhancement needed |
| #2694 | Add "Send data to tracker" to planner/tasks page | OPEN | Feature request |
| #1858 | Mark task sync with tracker | OPEN | Feature request |

### Key Architectural Insight from #3394

The three planner tracker buttons have **distinct behaviors** that are commonly confused:
1. **Refresh** — updates task metadata only (name, status, ticket_info). Does NOT reload worklogs/task_report.
2. **Load from tracker** — updates metadata + reported time, but ONLY for tickets with worklogs on selected date.
3. **Upload to tracker** — sends TTT reports to the external tracker.

This distinction is critical for test design — users frequently conflate these operations.
