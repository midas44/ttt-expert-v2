---
type: exploration
tags:
  - vacation
  - ui-flows
  - selectors
  - phase-b
created: '2026-03-21'
updated: '2026-03-21'
status: active
---
# Vacation UI Pages — Comprehensive Reference

## Login Page (`/`)
- Single textbox `#username` (no password on test env)
- Button: `LOGIN`
- Selectors: `page.locator('#username')`, `getByRole('button', { name: 'LOGIN' })`

## Main Navigation
| Item | URL | Badge |
|------|-----|-------|
| My tasks | `/report` | — |
| Calendar of absences | dropdown | count badge |
| Confirmation | `/approve` | — |
| Planner | `/planner` | — |
| Statistics | dropdown | — |
| Admin panel | dropdown | — |
| Accounting | dropdown | — |
| Notifications | `/notifications` | — |

### Calendar of absences dropdown
| Item | URL |
|------|-----|
| My vacations and days off | `/vacation/my` |
| My sick leaves | `/sick-leave/my` |
| Availability chart | `/vacation/chart` |
| Employees requests | `/vacation/request` |
| Employees vacation days | `/vacation/vacation-days` |
| Sick leaves of employees | `/vacation/sick-leaves-of-employees` |

## My Vacations Page (`/vacation/my`)
Redirects to `/vacation/my/my-vacation/OPENED`

### Tab bar
- `button "Vacations"` (default active, red underline)
- `button "Days off"`

### Available days section
- Text: "Available vacation days: N in YYYY"
- Info icon → popup with per-year breakdown
- `link "Vacation regulation"` → Confluence
- `button "Vacation events feed"`

### Action button
- `button "Create a request"` — opens creation dialog

### Filter tabs
- `button "Open"` (default)
- `button "Closed"`
- `button "All"`

### Table columns
| Column | Sortable | Filterable |
|--------|----------|------------|
| Vacation dates | Yes | No |
| Regular days | Yes | No |
| Administrative days | Yes | No |
| Vacation type | Yes | Yes (checkboxes: All, Regular, Administrative) |
| Approved by | Yes | No |
| Status | Yes | Yes (checkboxes: All, New, Approved, Rejected, Paid, Finished, Deleted) |
| Payment month | Yes | No |
| Actions | No | No |

### Actions per row
- "..." icon → opens "Request details" dialog
- Edit (pencil icon) for editable statuses

### Table footer
- "Total" row summing Regular days and Administrative days

## Vacation Creation Dialog
**Title:** "Creating vacation request"

| Field | Type | Label | Required |
|-------|------|-------|----------|
| Start date | datepicker | "Vacation period*" | Yes |
| End date | datepicker | (range end) | Yes |
| Day count | read-only | "Number of days:" | auto |
| Payment month | month picker | "Vacation pay to be paid with salary for" | No |
| Unpaid checkbox | checkbox | "Unpaid vacation" | No |
| Approved by | read-only link | "Approved by" | auto |
| Agreed by | read-only link | "Agreed by" | auto |
| Also notify | multi-select | "Also notifty" (typo!) | No |
| Comment | textarea | "Comment" | No |

**Buttons:** `Cancel`, `Save` (green)

**Selectors:**
- `getByRole('button', { name: 'Create a request' })`
- `getByRole('dialog', { name: 'Creating vacation request' })`
- Unpaid: `getByRole('checkbox', { name: 'Unpaid vacation' })`
- Save: `getByRole('button', { name: 'Save' })`

## Request Details Dialog
**Title:** "Request details"
- Period, Number of days, Status, Vacation type, Payment month, Approved by, Agreed by
- Button: `Close` (X icon)

## Employee Requests Page (`/vacation/request`)
### Top tabs
- `button "Vacation requests (N)"` — pending count
- `button "Days off rescheduling (N)"`

### Sub-filter buttons
- `button "Approval (N)"` — needs this user's approval
- `button "Agreement (N)"` — needs agreement
- `button "My department"`
- `button "My projects"`
- `button "Redirected"`

### Table columns
| Column | Sortable | Filterable |
|--------|----------|------------|
| Employee | Yes | No |
| Vacation dates | Yes | No |
| Vacation type | Yes | Yes |
| Manager | Yes | No |
| Approved by | Yes | No |
| Agreed by | No | No (progress bar) |
| Payment month | Yes | No |
| Status | Yes | No |
| Actions | No | No |

### Action buttons per row (NEW status)
1. Approve (checkmark) — `data-testid="vacation-request-action-approve"`
2. Reject (X) — `data-testid="vacation-request-action-reject"`
3. Redirect (arrow) — `data-testid="vacation-request-action-redirect"`
4. Details (eye) — `data-testid="vacation-request-action-info"`

## Availability Chart (`/vacation/chart`)
- Search: "Search by employee / project / manager / salary office"
- View toggle: `button "Days"` / `button "Months"`
- Timeline navigation: left/right arrows
- Green bars = approved vacations, blue = day-off/holidays
- Weekend columns have yellow background
- Today has distinct highlighting

## Employees Vacation Days (`/vacation/vacation-days`)
- Search: "First name, last name of the employee or of the manager"
- Checkbox: "Show dismissed employees"
- Table: Employee (link), Vacation days, Pending approval


## Autotest Discoveries (Phase C, Session 31)

### Proxy Issue
- Chromium headless inherits `HTTP_PROXY`/`HTTPS_PROXY` env vars even with `--no-proxy-server` flag
- Fix: clear proxy env vars in `launchOptions.env` in playwright.config.ts
- Without this fix, Chromium shows 502 Bad Gateway when navigating to VPN hosts

### Concurrent Test Limitation
- Running multiple vacation tests in parallel (default workers) causes "Server is unavailable" errors
- The backend vacation service can't handle concurrent requests from different browser sessions
- **Must use `--workers=1`** for vacation tests to avoid backend overload

### Edit Dialog (TC-006, TC-007)
- Pencil icon is the **first button** in the last `<td>` (Actions column) of the vacation row
- Opens dialog titled "Editing vacation request" (vs "Creating vacation request" for new)
- `VacationCreateDialog` handles both via regex `/(Creating|Editing) vacation request/i`
- When editing an APPROVED vacation, warning text appears: "Changing the vacation dates will move the request to the 'New' status and send it for approval once again."
- Save button becomes **disabled** if employee has insufficient available days for the new period

### Cancel/Delete Flow (TC-021, TC-022)
- "Cancel" in test cases maps to **Delete button** in Request Details dialog
- `VacationDetailsDialog.deleteRequest()`: clicks Delete → confirms in "Delete the request?" confirmation dialog
- After deletion, vacation disappears from Open tab and appears in Closed tab
- Status in Closed tab shows either "Deleted" or "Canceled" (both are valid)

### Available Days Widget
- Located via `text=/Available vacation days/` → extract number with regex `(\d+)`
- Shows current available days count, updates after vacation creation/cancellation

### Tab Navigation
- Open/Closed/All tabs are `<button>` elements matched by `getByRole("button", { name: /^Open$/i })`
- After clicking a tab, `waitForLoadState("networkidle")` needed before interacting with table

### Date Display Formats
- Same-month: "23 – 27 Mar 2026"
- Cross-month: "30 Mar – 16 Apr 2026"  
- Different employees may show different day counts for same date range (office-specific calendars)

### Data Constraints Discovered
- `findEmployeeWithVacation` must check `available_vacation_days >= N` when test extends a vacation
- Employee with 0 available days → Save button disabled in edit dialog
- Cross-month vacation periods need pattern alternative 4 (`sDay sMonth ... eDay eMonth`) to match


## Filter Behavior (discovered Session 33, Phase C)

**Vacation type and Status column filters apply in REAL-TIME** while the dropdown is open. No need to close the dropdown before reading filtered table data.

- Unchecking "All" unchecks all individual options → table shows "No data"
- Checking an individual option immediately filters the table
- Closing dropdown (click filter icon or Escape) preserves filter state
- Clicking the "All" tab button resets all filters

**Filter dropdown DOM structure:**
- Filter checkboxes are inside the `<th>` column header element
- Checkboxes use `role="checkbox"` with labels like "All", "Regular", "Administrative"
- Filter icon is the last `<button>` inside the header cell

**Reliable filter interaction pattern for tests:**
```typescript
await vacationsPage.openColumnFilter("Vacation type");
await vacationsPage.toggleFilterCheckbox("All");       // uncheck all
await page.waitForTimeout(500);                        // React re-render
await vacationsPage.toggleFilterCheckbox("Administrative"); // check target
await page.waitForTimeout(1000);                       // wait for table update
// Read column texts while dropdown is still open — filter is already applied
const typeValues = await vacationsPage.getColumnTexts("Vacation type");
await page.keyboard.press("Escape");                   // dismiss dropdown
```

**Table structure notes:**
- Data rows in first `<tbody>`, Total row in `<tfoot>` (separate rowgroup)
- "No data" row has single merged `<td>` — `getColumnTexts` must filter by `td.length > colIndex`
- Table is paginated for users with many vacations (20 per page)
- `ttt_backend.employee` columns: `latin_first_name`, `latin_last_name` (NOT `first_name`, `last_name`)


## Available Days Counter — DOM Structure (discovered Session 40)

The "Available vacation days" section on `/vacation/my` has a **split layout** where the label and value are in separate sibling containers:

```html
<!-- Row 1: Label -->
<div class="UserVacationsPage_userVacationInfo__...">
  <div class="UserVacationsPage_userVacationDaysWrapper__...">
    <div class="UserVacationsPage_vacationDaysRowContainer__...">
      Available vacation days:
    </div>
  </div>
  <a class="info-link">...Vacation regulation...</a>
</div>

<!-- Row 2: Value (SIBLING, not child!) -->
<div class="UserVacationsPage_userVacationInfo__...">
  <div class="UserVacationsPage_userVacationDaysWrapper__...">
    <div class="UserVacationsPage_vacationDaysRowContainer__...">
      <span>30&nbsp;in&nbsp;2026</span>
      <div class="custom-tooltip__wrapper">...</div>
    </div>
  </div>
  <button>Vacation events feed</button>
</div>
```

**Key insight:** `text=/Available vacation days/` matches the label element whose `textContent()` has NO digits. The count `<span>30&nbsp;in&nbsp;2026</span>` uses `&nbsp;` (U+00A0) between tokens.

**Working selector pattern (used in `getAvailableDays()` and `getAvailableDaysFullText()`):**
```typescript
const text = await this.page.evaluate(() => {
  for (const span of document.querySelectorAll("span")) {
    const t = span.textContent?.trim() ?? "";
    if (/^\d+[\s\u00a0]+in[\s\u00a0]+\d{4}$/.test(t)) return t;
  }
  return "";
});
```

**Yearly breakdown button:** `button[class*="VacationDaysTooltip_numberOfDaysInfo"]` — unique to the available-days tooltip.

## Employees Requests Page — Multiple Employee Rows

When filtering by employee name on the Employees Requests page, **multiple rows may exist** for the same employee (from previous test runs or multiple vacations). Always filter by both employee name AND period pattern to target the specific row:
```typescript
await requestsPage.rejectRequest(data.employeeName, data.periodPattern);
await requestsPage.waitForRequestRowToDisappear(data.employeeName, data.periodPattern);
```
