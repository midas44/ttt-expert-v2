

## Selectors & Patterns (discovered during Phase C, Session 50)

### Action Buttons (data-testid)
- Edit button: `[data-testid='dayoff-action-edit']` — pencil icon, present on future holidays with duration=0
- Cancel button: `[data-testid='dayoff-action-cancel']` — red X icon, present ONLY on NEW transfer request rows
- **Button order on NEW request rows**: cancel (index 0) FIRST, edit (index 1) SECOND — opposite of initial assumption

### Year Selector
- Input: `input[name='date-picker']` with class `date-picker__input`
- Wrapper: `.rdt` (react-datetime)
- Click input → opens year grid (decade view, e.g. "2020-2029")
- Year cells: `.rdt td` filtered by exact year text
- Navigate decades: ‹/› arrow headers

### Table Column Headers (Bilingual)
| English | Russian |
|---------|---------|
| Date of the event | Дата события |
| Duration | Длительность |
| Reason | Причина |
| Approved by | Подтверждает |
| Status | Статус |
| Actions | Действия |

### Status Values (Bilingual)
| API Status | English UI | Russian UI |
|-----------|-----------|-----------|
| NEW | New | На подтверждении |
| APPROVED | Approved | Подтверждено |

### Row Formats
- Regular holiday: `DD.MM.YYYY (weekday)` — e.g. "01.06.2026 (mo)"
- Transfer request: `DD.MM.YYYY (weekday) → DD.MM.YYYY (weekday)` — arrow (U+2192) between dates

### Cancel Flow
- No confirmation dialog — cancel is immediate
- Row reverts inline to original holiday format (arrow disappears)
- Notification: "Changes have been saved" / "Изменения сохранены"

### Hidden DOM Issue
After closing RescheduleDialog, its calendar `<table>` stays in DOM (hidden). When querying `thead th` with `evaluateAll`, filter with `table:visible` and `(h as HTMLElement).offsetParent !== null` to exclude hidden headers.


## Autotest Patterns (discovered S51)

### Page reload after UI mutations
After creating or editing a transfer request via RescheduleDialog, the table does NOT always auto-refresh inline. **Always add a full page reload** after dialog close to ensure fresh data:
```typescript
await rescheduleDialog.clickOk();
await rescheduleDialog.waitForClose();
await globalConfig.delay();
// REQUIRED: reload page for fresh table data
await dayOffPage.goto(tttConfig.appUrl);
await dayOffPage.waitForReady();
await globalConfig.delay();
```

### Arrow row matching — use one-sided pattern
Use `originalDate.*→` (one-sided) for initial row visibility checks, then verify full content via `getRowFirstCellText()`. Two-sided patterns like `originalDate.*→.*personalDate` can fail if the calendar picker selected a slightly different date.

### APPROVED requests — single date format
APPROVED transfer requests display only the personal date (the moved-to date), no arrow format. Use `rowHasArrowFormat()` to confirm absence of arrow.

### Button visibility rules
- **Edit button** (`data-testid='dayoff-action-edit'`): present on future d=0 holidays without active transfer requests
- **Cancel button** (`data-testid='dayoff-action-cancel'`): present only on NEW status transfer request rows (arrow format)


## Approval Page — DayOffRequestPage (discovered Session 52)

**URL pattern:** `{appUrl}/vacation/request/daysoff-request/APPROVER`

**Access:** Requires `VACATIONS: VIEW_APPROVES` permission — needs `ROLE_PROJECT_MANAGER`, `ROLE_DEPARTMENT_MANAGER`, `ROLE_TECH_LEAD`, `ROLE_VIEW_ALL`, or `ROLE_ADMIN`. Source: `VacationPermissionProvider.java`.

**Table structure:**
- Columns: Сотрудник, Исходная дата, Дата переноса, Подтверждающий, Подтвердил, Статус переноса, Действия
- Employee names shown as Russian full name "Фамилия Имя" (last name first)
- Action buttons use `data-testid` attributes:
  - Approve: `[data-testid='daysoff-request-action-approve']`
  - Reject: `[data-testid='daysoff-request-action-reject']`
  - Redirect: `[data-testid='daysoff-request-action-redirect']`
  - Info: `[data-testid='daysoff-request-action-info']`

**DB join for approver tab:** The APPROVER tab shows requests where `edr.approver = logged_in_user.id`, NOT where `e.manager = logged_in_user.id`. After a redirect, the approver changes but `e.manager` stays the same. Use `JOIN ttt_vacation.employee m ON edr.approver = m.id` for queries.

**Data exhaustion pattern:** TC-018 (approve), TC-020 (reject), and TC-021 (redirect) are destructive — they consume NEW requests. Use `createNewDayoffRequest()` fallback to INSERT new requests when the pool is exhausted.

## Redirect Dialog — RedirectDialog (discovered Session 52)

**Component:** `WeekendRedirectFormContainer.tsx` → `FormRequestRedirect.js` → `FormikSelect` (react-select)

**Structure:**
- Dialog: `getByRole("dialog")`
- Manager dropdown: react-select with `[class*='control']` to click open, keyboard type to filter
- Options: `[class*='option']` with manager name as text
- Manager name format in dropdown: "Имя Фамилия" (first name first) — from `EmployeeDto.getRussianName()` = `russianFirstName + ' ' + russianLastName`
- Buttons: "Отмена" (Cancel) and "OK"

**Selection flow:** Click `[class*='control']` → type last name to filter → click matching `[class*='option']`

**Backend endpoint:** `PUT /v1/employee-dayOff/change-approver/{id}/{approverLogin}` — changes the `approver` field in `employee_dayoff_request`


## WeekendDetailsModal — Full Selector Map (discovered Session 53)

**Opened by:** clicking `[data-testid='daysoff-request-action-info']` on any request row. Dispatches Redux `showModal(MODAL.WEEKEND_DETAILS, { dayOffId, managerView: true, ... })`.

**Note:** On the previous session the info button click failed silently on timemachine. This session it worked on a fresh browser. The issue appears transient — possibly a Redux store initialization timing issue. If it fails, retry after page reload.

### Dialog Container
- Dialog: `role="dialog"` — rendered by rc-dialog library
- Class: `rc-dialog dialog dialog-size-medium`
- Parent wrapper: `div.rc-dialog-wrap`
- Title: `span.rc-dialog-title` with text "Request details" / "Детали заявки"
- Close button: `button.rc-dialog-close` with `aria-label="Close"`
- Playwright selector: `page.getByRole("dialog")`

### Request Fields (Definition List)
The modal uses `<dl>` with `<dt>`/`<dd>` pairs:
| Term (dt) | Value (dd) content |
|-----------|-------------------|
| Employee | Link to cs.noveogroup.com/profile/{login} |
| Manager | Link to cs.noveogroup.com/profile/{login} |
| Reason | Holiday name text (e.g. "Easter Monday (Orthodox)") |
| Initial date | ISO date YYYY-MM-DD |
| Requested date | ISO date YYYY-MM-DD |
| Status | "New" / "Approved" / "Rejected" |
| Approved by | Link to cs.noveogroup.com/profile/{login} |

### Optional Approvers Table (read-only mode)
- Table: `dialog.locator("table")` — always present when `managerView: true`
- Headers: "Agreed by" | "Status" | (empty 3rd column)
- Row cells: approver name as link | status text ("Requested"/"Approved"/"Rejected") | (empty)
- Approver link: `a[href="https://cs.noveogroup.com/profile/{login}"]`

### "Edit list" Button
- Selector: `getByRole("button", { name: /Edit list|Редактировать список/i })`
- Full class: `uikit-button uikit-button--theme-default uikit-button--size-md uikit-button--style-bordered uikit-button--length-with-phrase`
- **Only visible for NEW status requests** — absent for APPROVED/REJECTED
- Located between the approvers table and the action buttons

### Action Buttons (footer)
- Reject: `getByRole("button", { name: /^(Reject|Отклонить)$/i })` — class includes `uikit-button--theme-reject`
- Approve: `getByRole("button", { name: /^(Approve|Подтвердить)$/i })` — class includes `uikit-button--theme-confirm`
- Redirect: `getByRole("button", { name: /^(Redirect|Перенаправить)$/i })` — class includes `uikit-button--theme-default`
- **Only visible for NEW status requests** — completely absent for APPROVED/REJECTED modals
- **Disabled during edit mode** — all three become disabled when "Edit list" is clicked

### Edit Mode (after clicking "Edit list")

**Entering edit mode:**
1. "Edit list" button disappears
2. "+" (add) button appears in the 3rd column header
3. Delete (trash) button appears in the 3rd column of each existing approver row
4. "Cancel" and "Save" buttons appear below the table
5. Approve/Reject/Redirect buttons become disabled

**"+" (Add) Button:**
- Location: inside `<th>` (3rd column header)
- Class: `uikit-button uikit-button--theme-default uikit-button--size-sm-md uikit-button--style-flat uikit-button__icon`
- Icon: SVG circle-plus (path starts with `M12.0011 21.5C6.76345`)
- Playwright: `dialog.locator("table th").nth(2).getByRole("button")`

**Delete (Trash) Button:**
- Location: inside `<td>` (3rd column of each approver row)
- Class: same flat icon button pattern as "+"
- Icon: SVG trash (path starts with `M16.1429 4.96296V3.4851`)
- Playwright: `row.locator("td").nth(2).getByRole("button")`

**Cancel Button:**
- Selector: `getByRole("button", { name: /^(Cancel|Отмена|Отменить)$/i })`
- Class: `uikit-button--theme-cancel ... uikit-button--style-bordered uikit-button--length-with-word`
- Parent: `div.vacation__optional-approvers-table__save-buttons`

**Save Button:**
- Selector: `getByRole("button", { name: /^(Save|Сохранить)$/i })`
- Class: `uikit-button--theme-default ... uikit-button--style-bordered uikit-button--length-with-word`
- Parent: same `div.vacation__optional-approvers-table__save-buttons`

### New Approver Row (after clicking "+")

Clicking "+" inserts a new row at the TOP of the table body with:
- **Cell 0**: react-select combobox for employee search
- **Cell 1**: empty (status not yet assigned)
- **Cell 2**: delete (trash) button

**React-Select Combobox (employee search):**
- Container: `div.vacation__optional-approvers-table__row-select.css-b62m3t-container`
- Control: `div.selectbox__control.css-13cymwt-control`
- Value container: `div.selectbox__value-container`
- Placeholder: `div.selectbox__placeholder` with text "Select" / "Выбрать"
- Input: `input.selectbox__input` with `role="combobox"`, `id="react-select-2-input"`, `aria-autocomplete="list"`
- Indicators: `div.selectbox__indicators` — contains dropdown arrow (`img` chevron)

**Dropdown (when combobox focused/clicked):**
- Menu: `div.selectbox__menu.css-1nmdiq5-menu`
- Menu list: `div.selectbox__menu-list.css-1yyklds` with `role="listbox"`, `id="react-select-2-listbox"`
- Options: `role="option"` with `id="react-select-2-option-{N}"`
- Option inner: `div.selectbox__option` — shows employee full name (English: "FirstName LastName")
- Option count: 63 employees available (on timemachine env, as azharkikh)
- Focused option class: `selectbox__option--is-focused css-d7l1ni-option`
- Normal option class: `selectbox__option css-10wo9uf-option`

**Playwright selection flow:**
```typescript
// Click the combobox to open dropdown
await dialog.getByRole("combobox").click();
// Type to filter
await dialog.getByRole("combobox").fill("Pavlov");
// Select the matching option
await dialog.getByRole("option", { name: "Alexander Pavlov" }).click();
```

### Visibility Rules by Status

| Element | NEW | APPROVED | REJECTED |
|---------|-----|----------|----------|
| Approve button | Yes | No | No |
| Reject button | Yes | No | No |
| Redirect button | Yes | No | No |
| Edit list button | Yes | No | No |
| Close (X) button | Yes | Yes | Yes |
| Approvers table | Yes | Yes | Yes |
| Request fields | Yes | Yes | Yes |

### MY_DEPARTMENT Tab — Button Visibility

On the MY_DEPARTMENT tab (`/vacation/request/daysoff-request/MY_DEPARTMENT`):
- **APPROVED rows**: Only 1 action button visible — the info button (`data-testid='daysoff-request-action-info'`)
- **NEW rows**: All 4 action buttons visible — approve, reject, redirect, info
- **Status filter**: Available via a filter button in the Status column header (ref=e626)
- **Pagination**: Present when >20 rows, standard pagination with page numbers

### Screenshots
- `expert-system/artefacts/weekend-details-modal.png` — NEW request modal (read-only view)
- `expert-system/artefacts/weekend-details-modal-edit-mode.png` — edit mode with Cancel/Save, +/trash buttons
- `expert-system/artefacts/weekend-details-modal-add-approver.png` — new approver row with Select combobox
- `expert-system/artefacts/weekend-details-modal-dropdown-open.png` — combobox dropdown open showing employee list
- `expert-system/artefacts/weekend-details-modal-approved.png` — APPROVED request modal (no action buttons)