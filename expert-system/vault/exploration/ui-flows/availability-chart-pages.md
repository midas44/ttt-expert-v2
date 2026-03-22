---
type: exploration
tags: [chart, availability, vacation, ui-flow, selectors]
created: 2026-03-22
updated: 2026-03-22
status: active
related: ["[[frontend-vacation-module]]", "[[vacation-service-deep-dive]]"]
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