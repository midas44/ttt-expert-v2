---
type: exploration
tags: [vacation, correction, ui-flow, selectors]
created: 2026-03-22
updated: 2026-03-22
status: active
related: ["[[vacation-service-deep-dive]]"]
---

# Vacation Day Correction Page

**URL:** `/vacation/days-correction`
**Access:** ROLE_ACCOUNTANT, ROLE_CHIEF_ACCOUNTANT (chief has broadest visibility)

## Page Structure

- Title: "Correction of vacation days"
- Filter: textbox with placeholder "First name, last name of the employee or of the department manager"
  - Two mode buttons: "Employee" / "Department manager"
  - Checkbox: "Show dismissed employees"
- Table columns: Employee, Manager, Vacation days, Pending approval, Department type, Events feed
- Pagination: 15 rows per page

## Selectors (discovered during Phase C)

- Page title: `text=Correction of vacation days`
- Filter input: `getByPlaceholder(/employee/i)` or `textbox "First name, last name..."`
- Table: `table` (first on page)
- Vacation days cell: `row.locator("td").nth(2)` — contains a **button** showing current value
- Vacation days button: `row.locator("td").nth(2).locator("button")` — click to edit
- Events feed button: last cell in each row

## Inline EditBox Interaction (CRITICAL)

The Vacation Days cell uses an `EditBox` component with these behaviors:
1. Default: shows a **button** with the current value
2. Click button → input appears with `autoFocus` and `onFocus` selects all text
3. **onBlur triggers submitAndClose()** — any blur (including `fill()` or `clear()`) will close the edit
4. Typing replaces selected text (since onFocus selects all)
5. Enter key triggers `submitAndClose()` which opens confirmation modal
6. Validation: `isValidNumber && value !== initValue` — value must change

**Safe Playwright interaction pattern:**
```typescript
// 1. Click the button to open edit mode
await row.locator("td").nth(2).locator("button").click();
// 2. Wait for input
const input = row.locator("td input").first();
await input.waitFor({ state: "visible", timeout: 3000 });
// 3. Select all and type (DO NOT use fill() or clear() — they trigger blur)
await page.keyboard.press("Control+A");
await page.keyboard.type(newValue);
// 4. Submit via Enter
await page.keyboard.press("Enter");
```

## Confirmation Modal

After submitting a new value, a dialog appears:
- Text: "Do you want to change vacation days for <NAME> from <OLD> to <NEW>?"
- Required field: Comment (textarea, 1-255 chars)
- Buttons: Cancel, Approve

**Selectors:**
- Modal: `getByRole("dialog")`
- Comment: `modal.locator("textarea")`
- Approve button: `modal.getByRole("button", { name: /approve/i })`

## Access Rules

- **ROLE_CHIEF_ACCOUNTANT** sees all employees (broadest visibility)
- **ROLE_ACCOUNTANT** may only see employees in their salary office — can show "No data"
- Filter searches by name (first/last), NOT by login
- AV=false offices: min value = 0 (cannot go negative)
- AV=true offices: min value = -Infinity (can go negative)
- Max value: 200
