---
name: autotest-generator
description: >
  Generate Playwright + TypeScript E2E test code from XLSX test case documentation.
  Use this skill when the user asks to "generate autotest", "automate test case",
  "create E2E test", "autotest for TC-", "generate spec for", "write playwright test",
  "convert test case to code", or any task that involves turning manual test documentation
  into automated Playwright tests. Also use when the user mentions a specific test case ID
  (TC-NNN) and wants it automated, or asks to "scaffold test", "generate test from xlsx",
  or "create automation for module X".
---

# Autotest Generator

Primary orchestration skill for generating Playwright + TypeScript E2E tests from
XLSX test case documentation. Follows the 5-layer architecture and enriches tests
with knowledge from the expert vault.

## When to Use

- User requests automation for a specific test case (TC-NNN)
- User asks to generate E2E tests for a module or feature
- User wants to convert XLSX test documentation into Playwright specs
- User says "generate autotest", "create E2E test", "automate test case"

## Process

### 1. Identify the Test Case

Read the test case from the JSON manifest (`autotests/manifest/test-cases.json`).
If the manifest is missing or outdated, invoke the `xlsx-parser` skill first.

Extract: test case ID, module, title, preconditions, steps, expected results, priority.

### 2. Enrich from Knowledge Base

Search the expert vault for module-specific knowledge before writing any code:

```
mcp__qmd-search__search(query: "<module name> <feature>", collection: "expert-vault")
mcp__obsidian__read_note(path: "modules/<module>.md")
```

Look for: known UI patterns, selectors, API endpoints, data dependencies, edge cases,
known bugs, and timing-sensitive behaviors documented in the vault.

### 3. Check Existing Framework Code

Before creating new files, always check what already exists:

```
autotests/e2e/pages/       -- Page Object classes (reuse existing ones)
autotests/e2e/fixtures/    -- Test fixtures (reuse existing auth, navigation, data setup)
autotests/e2e/specs/       -- Existing specs (avoid duplication, follow conventions)
autotests/e2e/data/        -- Data classes and test data
autotests/e2e/config/      -- Environment config, base URLs, credentials
```

Read 2-3 existing spec files to match the project's coding conventions.

### 4. Generate Test Artifacts

Follow the 5-layer architecture (specs -> fixtures -> pages -> config+data -> Playwright API):

**a) Data class** (`e2e/data/<module>.data.ts`):
- All test data in typed classes/objects
- No hardcoded values in specs -- everything comes from data classes
- Environment-specific data handled via config

**b) Page Object** (`e2e/pages/<module>.page.ts`) -- only if not already existing:
- All locators encapsulated in page class
- Action methods return promises
- No raw locators leak outside the page object

**c) Fixtures** (`e2e/fixtures/<module>.fixture.ts`) -- only if not already existing:
- Auth fixtures (login as specific role)
- Navigation fixtures (go to specific page)
- Data setup/teardown fixtures (API calls to prepare state)

**d) Spec file** (`e2e/specs/<module>/<test-case-id>.spec.ts`):
- Uses fixtures for setup, page objects for interaction, data classes for values
- Every verification step follows the pattern: delay -> assert -> screenshot
- Tags match module and priority from the test case
- Descriptive test.describe and test blocks matching the test case title

### 5. Run the Test

After generation, run the test to verify it passes:

```bash
cd autotests && npx playwright test e2e/specs/<module>/<test-case-id>.spec.ts --reporter=list
```

If it fails, diagnose and fix (invoke `autotest-fixer` skill if needed).

### 6. Track in SQLite

Log the automation result:

```sql
INSERT INTO autotest_tracking (test_case_id, module, status, spec_file, generated_at)
VALUES ('<TC-ID>', '<module>', 'generated', '<spec-path>', datetime('now'));
```

## Architecture Rules

These rules exist because the framework must be maintainable across hundreds of tests.

1. **No raw locators in specs.** Every element interaction goes through a page object.
   Specs should read like business logic, not DOM manipulation.

2. **No hardcoded data in specs.** All test data lives in data classes. This enables
   environment switching and data-driven testing.

3. **Every verification: delay -> assert -> screenshot.** UI state can lag behind
   actions. Always wait for the expected state, assert it, then capture evidence.

4. **Reuse before creating.** Check existing pages/ and fixtures/ before generating
   new ones. Duplicate page objects cause maintenance nightmares.

5. **Vault-first knowledge.** The expert vault contains hard-won knowledge about TTT
   module behavior, quirks, and timing issues. Always search it before generating.

## References

Read these files for detailed framework conventions and code patterns:

- `references/framework-spec.md` -- Full 5-layer architecture specification
- `references/generation-guidelines.md` -- Code style, naming, and pattern guidelines

These reference files will be created as the framework matures. If they do not exist yet,
use the conventions observed in existing spec files under `autotests/e2e/specs/`.

## Example Output Structure

For test case TC-042 in the Reports module:

```
autotests/e2e/
  specs/reports/tc-042-submit-weekly-report.spec.ts
  pages/reports.page.ts          (created or reused)
  fixtures/reports.fixture.ts    (created or reused)
  data/reports.data.ts           (created or extended)
```
