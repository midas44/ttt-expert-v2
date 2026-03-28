

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
