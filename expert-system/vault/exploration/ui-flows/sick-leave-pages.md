

## Selectors (discovered during Phase C, session 125)

### MySickLeavePage (`/sick-leave/my`)

- **Page heading**: `locator("text=/My sick leaves|Мои больничные/i")` — bilingual regex needed
- **Add button**: `getByRole("button", { name: "Add a sick note" })`
- **Data table rows**: `page.locator("table tbody").first().locator("tr")` — first tbody is data, second is footer "Total"
- **No data indicator**: `td` with text "No data"

#### Table columns (EN):
| Index | Column |
|-------|--------|
| 0 | Sick leave dates |
| 1 | Calendar days |
| 2 | Number |
| 3 | Accountant |
| 4 | State |
| 5 | Actions |

#### Date format in table:
- Format: `"25 – 30 Apr 2026"` (day – day Month year)
- NOT `dd.mm – dd.mm.yyyy`
- Pattern match: `new RegExp(\`${startDay}.*${endDay}.*${monthAbbrev}\`)`
- Month abbreviations: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec

#### Action buttons (data-testid selectors):
- **Edit (pencil)**: `[data-testid="sickleave-action-edit"]` — opens edit dialog
- **Close (checkmark)**: `[data-testid="sickleave-action-close"]` — opens close dialog (fallback: `sickleave-action-end`)
- **Details (three-dots)**: `[data-testid="sickleave-action-detail"]` — opens rc-dialog details panel
- **Attachments**: `[data-testid="sickleave-action-attachments"]` — hidden by default, do NOT match with generic `button` selector

**CRITICAL: There is NO direct delete button on the row.** Delete is accessed via the details dialog — open details first, then find Delete button inside the dialog.

**CRITICAL: There is NO "more" (...) menu like vacation.** The three-dots icon IS the details button (`sickleave-action-detail`), NOT a dropdown menu.

### Details Dialog (rc-dialog)
- **Selector**: `page.locator(".rc-dialog-wrap, [role='dialog']").first()`
- Does NOT match `getByRole("dialog")` — must use class-based selector
- Contains: employee name, dates, calendar days, number, state
- Contains Delete button: `detailsDialog.getByRole("button", { name: /delete/i })`
- Close via: `.rc-dialog-close` (X button) or `Escape` key

### SickLeaveCreateDialog
- **Dialog title (create)**: "Adding sick note" / "Добавление больничного"
- **Dialog title (edit)**: "Editing sick note" / contains "edit" or "изменени"
- **Date pickers**: react-datetime, same calendar navigation as VacationCreateDialog
- **Number field**: `dialog.locator("div").filter({ hasText: /Number of the sick note/i }).last().locator("input")`
- **Calendar days display**: Read via `evaluate()` searching for "calendar days:" text in dialog
- **Submit button**: `getByRole("button", { name: /save|сохранить/i })`
- **Cancel button**: `getByRole("button", { name: /cancel|отмена/i })`

### Confirmation dialogs
- Delete confirmation appears after clicking Delete in details dialog
- Selector: `page.locator(".rc-dialog-wrap, [role='dialog']").last()`
- Confirm button: `getByRole("button", { name: /delete|confirm|yes|ok/i })`

### State values (EN):
- After create: "started" or "planned" (depends on dates relative to today)
- After close: "Ended" or "Closed"
- After delete: row disappears, or shows "Deleted" state

## API Authentication Issue (Phase C finding)

Sick leave CRUD requires `AUTHENTICATED_USER` authority. Unlike vacation:
- `API_SECRET_TOKEN` gets **403 Forbidden** for sick leave endpoints
- `page.request.post()` gets **401 Unauthorized** (CAS cookies don't pass through proxy)
- `page.evaluate(fetch())` with `credentials: "include"` also gets **401**
- **Workaround**: Use UI-based create/edit/delete for both test actions AND cleanup
- Cleanup in `finally` blocks should use UI delete (open details → click delete → confirm)
