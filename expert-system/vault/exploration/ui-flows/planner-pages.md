

## Selectors — Session 88 Discoveries

### Search Bar (Tasks tab)
- Main search input: `input[name='TASK_NAME']` — unique, distinguishes from per-row autosuggest inputs
- Per-row autosuggest: `input[class*='react-autosuggest__input']` with numeric IDs — NOT the main search
- Suggestions dropdown: `[class*='react-autosuggest__suggestions-container--open']`
- Individual suggestions: `[class*='react-autosuggest__suggestion']`
- The search bar only renders when `hasReadonlyAssignment` is false (no auto-generated rows without DB IDs)
- "Open for editing" button (`GenerateAllButton`) replaces the search bar when readonly rows exist
- Clicking "Open for editing" triggers API to create DB records, then search bar appears

### Open for Editing
- Button: `getByRole('button', { name: 'Open for editing' })`
- Visible when `selectReadonlyAssignments` returns non-empty (any task row with `!closed && !id`)
- Non-working days (weekends) always show "Open for editing" because auto-generated rows lack DB IDs
- After clicking: wait for button to become hidden (API call creates task_assignment records)

### Socket Manager (both tabs)
- Position wrapper: `[class*='socket-manager--position']` — in PlannerTabs.tsx, wraps SocketManagerContainer
- Inner status container: `[class*='socket-manager--position'] > div` — the SocketManagerWrapper div
- Status classes on inner container: `socket-manager--connected`, `socket-manager--connecting`, `socket-manager--disconnected`
- Icons: renders `IconConnect` (SVG) when connected/connecting, `IconDisconnect` when disconnected
- `animate--blink` class added to connecting icon
- **WARNING**: `[class*='socket-manager'].first()` matches the position wrapper, NOT the status container!
- **SocketManagerLed component exists but is NOT used** — separate file at `SocketManager/tiles/SocketManagerLed.js`


## Selectors — Session 90 Discoveries

### Critical: Planner Table Loading State is Perpetual
The planner datasheet table (`table[class*='datasheet__table']`) has a **permanently active** `datasheet__loading--active` CSS class due to WebSocket synchronization. The table renders content WHILE in loading state — you can never wait for loading to complete.

**Impact:** `waitForTableLoaded()` (which waits for `datasheet__loading--active` to be hidden) will ALWAYS timeout at 180s. Do NOT use it for planner tests.

### Critical: Datepicker Table Nested Inside Datasheet
The datepicker `<table>` is nested inside the datasheet table's `<thead>` cell. Any `tbody tr` selector will match BOTH planner data rows AND hidden datepicker rows. Even CSS `> tbody > tr` direct child combinator is unreliable because Playwright's first match may resolve to a hidden datepicker element.

### Definitive Row Selector for Planner Data Rows
```typescript
// CORRECT — only matches actual planner data rows
const taskRows = page
  .locator("tr")
  .filter({ has: page.locator("[class*='planner__cel']") });

// WRONG — matches hidden datepicker rows too
const taskRows = page.locator("table[class*='datasheet__table'] > tbody > tr");
```
The `planner__cel` class is unique to planner data cells and never appears in datepicker rows.

### Color Coding CSS Classes (Confirmed on qa-1)
- Blocked (red/orange): `[class*='planner__cel--color-blocked']`
- Done (green): `[class*='planner__cel--color-done']`

### Projects Tab Table Structure
Multiple `<tbody>` elements per employee:
- `<tbody class="datasheet__grouped">` — employee header row
- `<tbody>` (next sibling) — task data rows for that employee

### Two-Click Edit Pattern
Planner inline editing requires two clicks: first click sets focus/lock, second click (after 500ms) enters edit mode. Use `plannerPage.clickCellToEdit(cell)`.
