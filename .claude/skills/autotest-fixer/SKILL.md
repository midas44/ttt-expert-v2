---
name: autotest-fixer
description: >
  Diagnose and fix failing Playwright E2E tests. Use this skill when the user asks to
  "fix autotest", "fix selector", "fix flaky test", "test is failing", "debug test failure",
  "fix timeout", "update selectors", "test broke", or any task involving diagnosing and
  repairing a broken E2E test. Also use when the user pastes a test error output, mentions
  a specific test that stopped working, or asks why a test is flaky. This skill can use
  the playwright-vpn MCP for live selector discovery on the running application.
---

# Autotest Fixer

**Scope:**
- TTT: full
- CS:  partial (framework supports cross-project specs; fixer works on @integration tests when they exist)


Diagnose and fix failing Playwright E2E tests using error analysis, live browser
inspection, and knowledge base lookups.

## When to Use

- A generated test is failing and needs to be fixed
- User reports a flaky test
- Selectors are outdated after a UI change
- Test passes locally but fails in CI
- User pastes error output from a test run

## Process

### 1. Read the Error

Get the full error output. If the user hasn't provided it, run the failing test:

```bash
cd /home/v/Dev/ttt-expert-v2/autotests && npx playwright test <spec-file> --reporter=list 2>&1
```

### 2. Classify the Failure

| Category | Symptoms | Root Cause |
|----------|----------|------------|
| **Selector** | `locator.click: Error`, `strict mode violation`, element not found | UI changed, selector too fragile, multiple matches |
| **Timeout** | `Test timeout exceeded`, `waiting for selector` | Slow load, missing waitFor, wrong wait condition |
| **Data** | `expect(received).toBe(expected)`, wrong values | Test data stale, environment state changed, data not reset |
| **Logic** | Wrong step order, missing precondition | Test flow doesn't match current app behavior |
| **Auth** | Redirect to login, 401 responses | Session expired, fixture not setting up auth correctly |
| **Flaky** | Passes sometimes, fails sometimes | Race condition, animation timing, network variability |

### 3. Investigate

**For selector issues** -- use playwright-vpn MCP to inspect the live page:

```
mcp__playwright-vpn__browser_navigate(url: "https://ttt-qa-1.noveogroup.com/<path>")
mcp__playwright-vpn__browser_snapshot()
```

The snapshot returns an accessibility tree with element refs. Find the correct
element and extract a robust selector (prefer data-testid, role, or text content
over CSS class selectors which are fragile).

**For data issues** -- check the environment state:

- Query the database via `mcp__postgres-qa1__execute_sql`
- Call the API via swagger MCP tools to verify data exists
- Check if the test clock needs resetting

**For timing issues** -- search the vault for known patterns:

```
mcp__qmd-search__search(query: "<module> timing delay load", collection: "expert-vault")
```

### 4. Apply the Fix

Based on the diagnosis:

**Selector fix:** Update the page object (not the spec). Replace fragile selectors
with robust alternatives found via live inspection.

```typescript
// Before (fragile -- class-based)
readonly submitBtn = this.page.locator('.btn-primary.submit');

// After (robust -- role + text)
readonly submitBtn = this.page.getByRole('button', { name: 'Submit' });
```

**Timeout fix:** Add explicit waits before the failing action:

```typescript
await this.page.waitForSelector('[data-testid="table-loaded"]', { timeout: 10000 });
```

**Data fix:** Update the data class or add API setup in the fixture to ensure
correct state before the test runs.

**Flaky fix:** Add stabilization waits, use `toPass()` for retry assertions,
or add `waitForLoadState('networkidle')` after navigation.

### 5. Verify the Fix

Re-run the test to confirm it passes:

```bash
cd /home/v/Dev/ttt-expert-v2/autotests && npx playwright test <spec-file> --reporter=list --repeat-each=3
```

Using `--repeat-each=3` helps catch flaky fixes that only work sometimes.

### 6. Update Knowledge Base

If the fix revealed something about TTT behavior (a changed UI pattern, a timing
quirk, an undocumented state), update the vault:

```
mcp__obsidian__patch_note(path: "modules/<module>.md", content: "<new finding>")
```

## Key Advantage: Live Selector Discovery

Unlike static debugging, this skill can open the actual running TTT application
via the `playwright-vpn` MCP and take real-time snapshots. This means:

- You can see exactly what the page looks like right now
- You can find the correct selectors by inspecting the accessibility tree
- You can test interactions before committing them to code
- You can compare what the test expects vs what the app shows

Always use live inspection for selector issues rather than guessing.

## Common Fixes Reference

| Problem | Quick Fix |
|---------|-----------|
| `strict mode violation` | Add `.first()` or make selector more specific |
| `Navigation timeout` | Add `waitUntil: 'domcontentloaded'` instead of `networkidle` |
| Element covered by overlay | Add `await page.locator('.overlay').waitFor({ state: 'hidden' })` |
| Dropdown not opening | Click trigger, then `waitForSelector` on the dropdown panel |
| Date picker issues | Use API to set date instead of UI interaction |
| Table not loaded | Wait for row count: `await expect(rows).not.toHaveCount(0)` |
