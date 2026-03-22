---
type: exploration
tags:
  - chart
  - availability
  - vacation
  - ui-flow
  - selectors
created: 2026-03-22T00:00:00.000Z
updated: 2026-03-22T00:00:00.000Z
status: active
related:
  - '[[frontend-vacation-module]]'
  - '[[vacation-service-deep-dive]]'
branch: release/2.1
---

# Availability Chart Page — UI Structure & Selectors

Page URL: `/vacation/chart`

## Page Layout
- Title: "Availability chart" (text locator)
- Search box: `textbox "Search by employee / project / manager / salary office"`
- Filter chips: Employee, Project, Manager, Salary office (button roles in a list)
- Toggle buttons: "Days" (default active), "Months"
- Month navigation: prev/next arrow buttons + textbox showing "Mar 2026"
- Chart: single `<table>` with thead (2 header rows) + tbody (employee rows)

## Critical CSS Issue
The chart `<table>` is inside a scrollable container with `overflow: hidden`. Playwright reports ALL table elements (`<tr>`, `<td>`, `<th>`) as **hidden**, even though they are visually rendered.

**Workarounds:**
- `waitFor({ state: "attached" })` instead of default visible check
- `page.evaluate(() => ...)` for reading content (textContent, getComputedStyle)
- `page.locator("table tbody tr").count()` works for counting (counts attached elements)
- Role-based locators (`getByRole("row")`) do NOT work because they filter by visibility

## Table Structure
### Header rows (thead)
- Row 1: Month name headers — `columnheader "March"`, `columnheader "April"`
- Row 2: Day number + day-of-week — `columnheader "23 mo"`, `columnheader "24 tu"`, etc.
  - Weekend columns (sa, su) have yellow background
  - Today column has distinct highlighting

### Body rows (tbody)
- Each row: employee name cell (first-child) + day cells
- Employee names: "First\nLast" format in nested divs
- Vacation bars: colored `<div>` elements inside `<td>` cells
  - Green (rgb where g > r and g > b) = APPROVED/PAID vacation
  - Blue = day-off/holidays
  - Gray = other absences

## Selectors (discovered during Phase C)
```typescript
// Page title
page.locator("text=Availability chart").first()

// Toggles
page.getByRole("button", { name: "Days", exact: true })
page.getByRole("button", { name: "Months", exact: true })

// Search
page.getByRole("textbox", { name: /search by employee/i })

// Employee rows (CSS-hidden, use count/evaluate)
page.locator("table tbody tr")

// Employee name cells
page.locator("table tbody tr td:first-child")

// Column headers
page.locator("table thead th")

// Employee row by name
page.locator("table tbody tr").filter({ hasText: "LastName" })

// Green vacation bars (via evaluate)
getComputedStyle(div).backgroundColor → match rgb(r, g, b) where g > r && g > b
```

## Filter Chips
Same chip-based filter as VacationDayCorrectionPage: click chip button → dropdown → type → select.
Filter buttons are in a `<ul>` below the search box:
- Employee, Project, Manager, Salary office

## Notes
- The chart shows ~30 days centered around the current date
- Default view is "Days"; switching to "Months" changes the grid
- User must have manager/admin permissions to see subordinates
- Regular employees see an empty chart (no rows)

## Chart Navigation (discovered S45)

### Days View — MonthControl component
Source: `vacation/containers/vacationsChart/MonthControl.tsx`
- Container: `[class*="datePickerContainer"]` (CSS module: `.datePickerContainer`)
- Prev button: first `<button>` in container (has `IconArrowRounded`)
- Month input: `DateInput` showing "Mar 2026" format (abbreviation + year)
- Next button: last `<button>` in container (has `IconArrowRounded` with `.rightSwitcherIcon` = rotated 180°)

Playwright locators:
```typescript
page.locator('[class*="datePickerContainer"]').locator("button").first()  // prev
page.locator('[class*="datePickerContainer"]').locator("input").inputValue()  // "Mar 2026"
page.locator('[class*="datePickerContainer"]').locator("button").last()   // next
```

### Months View — DatePeriodFilterContainer
Appears when "Months" toggle is active (replaces MonthControl).
- Start date: `input[placeholder="dd.mm.yyyy"]` first (e.g. "01.03.2026")
- End date: `input[placeholder="dd.mm.yyyy"]` last (e.g. "22.09.2026")
- Table headers: `<th>` with "2026\nMonth" pattern (year + month name)

### View Toggle
- `getByRole('button', { name: 'Days', exact: true })` — Days mode
- `getByRole('button', { name: 'Months', exact: true })` — Months mode
- Active button gets `[active]` state in accessibility tree

### Chart Search (multi-field)
- Textbox: `getByRole('textbox', { name: /search by employee/i })`
- Matches: employee name, project name, manager name, salary office
- Filtered results include indirect matches (e.g. employees whose manager matches)
- Uses infinite scroll — row count may increase after search

## Pagination Controls (My Vacations, discovered S45)
- Container: `getByRole('navigation', { name: 'Pagination' })`
- Previous: `getByRole('button', { name: 'Previous page' })`
- Next: `getByRole('button', { name: 'Next page' })`
- Current page: `getByRole('button', { name: /Page N is your current page/ })`
- Other pages: `getByRole('button', { name: 'Page N' })`
- Fixed page size (20 rows), no rows-per-page selector

## Events Feed (My Vacations, discovered S45)
- Button: `getByRole('button', { name: 'Vacation events feed' })`
- Shows lifecycle events with dates in dd.mm.yyyy format
- Event types: created, approved, rejected, paid, cancelled, deleted
