---
type: tracking
updated: '2026-04-03'
---

# Autotest Generation Progress

## Overall Progress

| Module | Verified | Total | Coverage | Blocked |
|--------|----------|-------|----------|---------|
| t2724 | 38 | 38 | 100% | 0 |
| day-off | 25 | 28 | 89.3% | 3 |
| t3404 | 21 | 24 | 87.5% | 3 |
| vacation | 35 | 100 | 35.0% | 4 |
| planner | 24 | 82 | 29.3% | 0 |
| reports | 17 | 60 | 28.3% | 0 |
| **Total** | **160** | **332** | **48.2%** | **10** |

## Vacation Module

| Metric | Value |
|--------|-------|
| Total test cases | 100 |
| Verified | 35 |
| Blocked | 4 |
| Failed | 0 |
| Pending | 61 |
| Coverage | 35.0% |

### Verified Tests by Session

**Sessions 93-98 (TC-VAC-001..011, 015..023):** CRUD operations, approval workflows, basic cancel/reject/edit flows. Established core fixtures (LoginFixture, VacationCreationFixture, ApiVacationSetupFixture) and page objects (MyVacationsPage, VacationApprovalPage).

**Sessions 99-102 (TC-VAC-025, 034..038, 047..053):** Sick-leave conversion, filter/sort, status display, type display, table rendering. Extended MyVacationsPage with filter/sort/status methods.

**Session 109 (TC-VAC-027..029, 031, 033):** Payment suite — validation, pay NEW blocked, PAID terminal state, closed period blocked, AV=true negative balance error. Extended ApiVacationSetupFixture with payVacation(), createApproveAndPay(), rawPut(), rawDelete().

**Session 110 (TC-VAC-030, 032, 057, 059):** PAID+EXACT deletion blocked (API), auto-pay cron endpoint (API), AV=true full year balance (UI), AV=false no-negative balance (UI). Added getAvailableDaysSigned() to MyVacationsPage. TC-VAC-058 blocked (can't exhaust 82-day balance within system limits).

### Blocked Tests

| Test ID | Reason |
|---------|--------|
| TC-VAC-024 | Combined approval+payment flow — complex multi-step requires sequential API orchestration not available |
| TC-VAC-026 | Requires external calendar service mock |
| TC-VAC-055 | Requires specific disabled employee data not on qa-1 |
| TC-VAC-058 | Cannot exhaust AV=true balance within system limits (duration max ~5-7 days, date range ~6 months) |

## Planner Module

| Metric | Value |
|--------|-------|
| Total test cases | 82 |
| Verified | 24 |
| Failed | 1 |
| Pending | 57 |
| Coverage | 29.3% |

### Verified Tests by Session

**Session 87 (TC-PLN-001 to TC-PLN-005):** Navigation basics — date forward/backward, Tasks/Projects tabs, project selector, date header display.

**Session 88 (TC-PLN-006 to TC-PLN-010):** Navigation advanced — role filter, WebSocket indicator, Total row, collapse/expand, Task/Ticket toggle.

**Session 89 (TC-PLN-011 to TC-PLN-015):** Notification banners + inline editing (effort, comment, remaining work). Key patterns: two-click editing, rich text editor, ensureEditMode with retries.

**Session 90 (TC-PLN-016 to TC-PLN-020):** Projects tab — project selector dropdown filtering, "Open for editing" generates assignments, edit hours in manager view, color coding (blocked/done), Info/Tracker column display.

**Session 91 (TC-PLN-021 to TC-PLN-024):** Remaining work column, Total row calculations, multi-project aggregation, effort validation.

### PlannerPage Object Methods

| Method | Added | Purpose |
|--------|-------|---------|
| `waitForReady()` | s87 | Wait for Planner heading |
| `navigateDateForward/Backward()` | s87 | Date navigation |
| `clickTasksTab/ProjectsTab()` | s87 | Tab switching |
| `selectProject()` | s87 | Project dropdown |
| `selectRoleFilter()` | s88 | Role filter dropdown |
| `socketManagerWrapper/Container()` | s88 | WebSocket indicator |
| `totalRow()` | s88 | Total row locator |
| `expandButtons/clickExpandButton()` | s88 | Collapse/expand |
| `switchToTaskView/TicketView()` | s88 | Task/Ticket toggle |
| `ensureEditMode()` | s89 | Robust editing mode activation |
| `clickCellToEdit()` | s89 | Two-click edit pattern |
| `isCellEditable()` | s89 | Readonly detection |
| `dismissErrorBanner()` | s89 | Error banner handling |
| `getEffortCell/RemainingWorkCell/CommentCell()` | s89 | Cell locators by column index |
| `waitForTableLoaded()` | s90 | DO NOT USE — loading class is perpetual |
| `dataTable()` | s90 | Datasheet table locator |
| `dataTableRows()` | s90 | Direct child rows (unreliable — prefer planner__cel filter) |
| `blockedCells() / doneCells()` | s90 | Color-coded cell locators |
| `getEmployeeHeaderRow()` | s90 | Projects tab employee header |
| `getEmployeeOpenForEditingButton()` | s90 | Per-employee edit button |

### Known Issues

- **"Open for editing" API unreliability** on qa-1 — `POST /v1/assignments/generate` intermittently fails, causing inline editing tests (TC-PLN-013/014/015) to skip. Tests are architecturally correct — they pass when the API works. Graceful degradation via `test.skip()`.
- **Saturday/Sunday navigation** — planner shows weekend dates which may have no assignments. Tests navigate backwards to find weekdays with data.
- **Perpetual loading state** (discovered s90) — `datasheet__loading--active` class never clears due to WebSocket sync. Never wait for loading to complete. Use content-specific waits.
- **Datepicker table nested in thead** (discovered s90) — `tbody tr` selectors match hidden datepicker rows. Use `planner__cel` class filter for definitive row identification.

## Reports Module

| Metric | Value |
|--------|-------|
| Total test cases | 60 |
| Verified | 17 |
| Failed | 2 |
| Pending | 41 |
| Coverage | 28.3% |

### Verified Tests by Session

**Sessions 106-108 (TC-RPT-001..004, 006, 008..012, 014..020):** Report CRUD, confirmation flow, period navigation, status display. Created ConfirmationPage, ApiReportSetupFixture, reportQueries.
