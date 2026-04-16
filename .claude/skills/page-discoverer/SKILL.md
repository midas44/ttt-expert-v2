---
name: page-discoverer
description: >
  Discover selectors and page structure for TTT, CS, and PMT pages using live browser exploration.
  Use this skill when the user asks to "discover page", "find selectors", "explore UI",
  "page object for", "inspect page", "what elements are on", "map the page", "selector
  discovery", "build page object", or any task involving exploring a live TTT, CS, or PMT page to
  identify interactive elements and their selectors. Also use when the user needs to
  create a new page object class, wants to understand a page's structure before writing
  tests, or asks to "snapshot the page", "accessibility tree", "explore TTT UI", "explore CS UI",
  or "explore PMT UI".
---

# Page Discoverer

**Scope:**
- TTT: full
- CS: full (UI exploration via the same playwright-vpn MCP — CS pages are behind the same VPN)
- PMT: full (UI exploration via the same playwright-vpn MCP — PMT pages are behind the same VPN)

Explore live TTT, CS, and PMT pages via the playwright-vpn MCP to discover selectors, map page
structure, and generate page object skeletons. This capability bridges the gap between
test documentation (which describes what to test) and automation code (which needs
precise selectors).

## Project targeting

When the user asks to discover a page, identify the project first:
- TTT: load `e2e/config/ttt/tttConfig.ts` (or read `config/ttt/ttt.yml`) for the resolved appUrl. Generated page objects go to `autotests/e2e/pages/ttt/<PageName>.ts`.
- CS: load `e2e/config/cs/csConfig.ts` (or read `config/cs/cs.yaml`) for the resolved appUrl. Generated page objects go to `autotests/e2e/pages/cs/<PageName>.ts`.
- PMT: load `e2e/config/pmt/pmtConfig.ts` (or read `config/pmt/pmt.yaml`) for the resolved appUrl. Generated page objects go to `autotests/e2e/pages/pmt/<PageName>.ts`.
- Bare requests with no project hint default to TTT (the primary project).

Imports in generated page objects must use the project-scoped TS path alias: `@ttt/config/tttConfig`, `@cs/config/csConfig`, or `@pmt/config/pmtConfig`. Never use long relative paths like `../../config/...`.

## When to Use

- Before automating a test for a page that has no page object yet
- When a page object's selectors are outdated after a UI update
- User wants to understand a page's interactive elements
- User asks to create or update a page object class

## Process

### 1. Navigate to the Target Page

First, log in and navigate to the page. Use playwright-vpn MCP tools:

```
mcp__playwright-vpn__browser_navigate(url: "https://ttt-qa-1.noveogroup.com")
```

If login is needed, fill the login form:

```
mcp__playwright-vpn__browser_snapshot()
-- Find the login field ref from snapshot
mcp__playwright-vpn__browser_fill_form(ref: "<login-field-ref>", value: "<username>")
mcp__playwright-vpn__browser_click(ref: "<submit-btn-ref>")
```

Then navigate to the target page:

```
mcp__playwright-vpn__browser_navigate(url: "https://ttt-qa-1.noveogroup.com/<path>")
```

### 2. Take a Snapshot

Get the accessibility tree which shows all interactive elements:

```
mcp__playwright-vpn__browser_snapshot()
```

The snapshot returns elements with:
- **ref**: Unique reference ID for clicking/interacting
- **role**: ARIA role (button, link, textbox, combobox, etc.)
- **name**: Accessible name (visible text or aria-label)
- **state**: Current state (checked, expanded, disabled, etc.)

### 3. Identify Key Elements

From the snapshot, catalog:

| Category | What to Look For |
|----------|-----------------|
| **Navigation** | Tab bars, sidebar links, breadcrumbs |
| **Forms** | Input fields, dropdowns, date pickers, checkboxes |
| **Actions** | Submit buttons, save/cancel, delete, approve/reject |
| **Data display** | Tables, lists, cards, summary panels |
| **Feedback** | Toast notifications, error messages, loading indicators |
| **Modals** | Dialog triggers, modal content, close buttons |

### 4. Cross-Reference with Vault

Search the expert vault for known patterns on this page:

```
mcp__qmd-search__search(query: "<page-name> selectors UI elements", collection: "expert-vault")
```

The vault may contain previously documented selectors, known quirks (e.g., elements
that load asynchronously), or screenshots from earlier investigations.

### 5. Take a Screenshot

Capture a visual reference:

```
mcp__playwright-vpn__browser_take_screenshot()
```

Save this as a reference for the page object documentation.

### 6. Generate Page Object Skeleton

Output a TypeScript page object class:

```typescript
import { Page, Locator } from '@playwright/test';

export class ReportsPage {
  readonly page: Page;

  // Navigation
  readonly tabMyReports: Locator;
  readonly tabTeamReports: Locator;

  // Filters
  readonly periodDropdown: Locator;
  readonly employeeSearch: Locator;

  // Table
  readonly reportTable: Locator;
  readonly tableRows: Locator;

  // Actions
  readonly submitButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabMyReports = page.getByRole('tab', { name: 'My Reports' });
    this.tabTeamReports = page.getByRole('tab', { name: 'Team Reports' });
    this.periodDropdown = page.getByRole('combobox', { name: 'Period' });
    this.employeeSearch = page.getByPlaceholder('Search employee');
    this.reportTable = page.locator('[data-testid="report-table"]');
    this.tableRows = this.reportTable.locator('tbody tr');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.saveButton = page.getByRole('button', { name: 'Save' });
  }

  async navigateTo() {
    await this.page.goto('https://ttt-qa-1.noveogroup.com/report');
    await this.page.waitForLoadState('networkidle');
  }

  // ... action methods
}
```

### 7. Test Interactions

Optionally verify key selectors work by interacting with them:

```
mcp__playwright-vpn__browser_click(ref: "<element-ref>")
mcp__playwright-vpn__browser_snapshot()  -- verify state changed
```

### 8. Update Knowledge Base

Save the discovered page structure to the vault for future reference:

```
mcp__obsidian__write_note(path: "exploration/page-<name>-selectors.md", content: "...")
```

## Selector Strategy (in priority order)

Prefer selectors that are resilient to UI changes:

1. **data-testid** -- `page.locator('[data-testid="submit-report"]')` -- most stable
2. **Role + name** -- `page.getByRole('button', { name: 'Submit' })` -- semantic, readable
3. **Text content** -- `page.getByText('Submit Report')` -- readable but locale-dependent
4. **Placeholder** -- `page.getByPlaceholder('Enter name')` -- good for inputs
5. **CSS with structure** -- `page.locator('form.report >> button[type="submit"]')` -- last resort

Avoid: class-only selectors (`.btn-primary`), nth-child without context,
XPath (hard to maintain).

## Important Rules

- Always close the browser session when done: `mcp__playwright-vpn__browser_close()`
- If the page requires a specific user role, log in as the right user (check vault
  for test accounts per role)
- TTT pages are SPAs -- after navigation, wait for content to load before snapshotting
- Some pages show different content based on language (RU/EN) -- switch to EN first
  for consistent selectors
- Take both a snapshot (for selectors) and a screenshot (for visual reference)
