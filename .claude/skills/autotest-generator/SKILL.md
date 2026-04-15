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

**Scope:**
- TTT: full (primary project)
- CS: partial (CS appears only as episodic UI steps inside cross-project specs — no CS-only test suite)

Primary orchestration skill for generating Playwright + TypeScript E2E tests from
XLSX test case documentation. Follows the 5-layer architecture and enriches tests
with knowledge from the expert vault.

## Multi-project framework layout

The autotest framework is multi-project. Use these path aliases (declared in `autotests/tsconfig.json`) — never long relative imports:

| Alias | Resolves to | Purpose |
|-------|-------------|---------|
| `@ttt/pages/*` | `e2e/pages/ttt/*` | TTT page objects |
| `@ttt/fixtures/*` | `e2e/fixtures/ttt/*` | TTT-bound fixtures |
| `@ttt/config/*` | `e2e/config/ttt/*` | `TttConfig`, `db/dbClient` |
| `@cs/pages/*` | `e2e/pages/cs/*` | CS page objects |
| `@cs/fixtures/*` | `e2e/fixtures/cs/*` | CS-bound fixtures |
| `@cs/config/*` | `e2e/config/cs/*` | `CsConfig` |
| `@common/fixtures/*` | `e2e/fixtures/common/*` | Project-agnostic fixtures (`VerificationFixture`) |
| `@common/config/*` | `e2e/config/common/*` | `AppConfig`, `GlobalConfig`, utilities |
| `@integration/fixtures/*` | `e2e/fixtures/integration/*` | Cross-project orchestration fixtures |
| `@data/*`, `@utils/*` | `e2e/data/*`, `e2e/utils/*` | Test data + utilities (module-organized; no project split) |

When generating a test:
1. **Identify project(s) the test touches**. If only TTT — generate normally.
2. **If the test touches CS** (e.g., a step says "On CS, change Salary Office X to value Y"), the spec is a cross-project test:
   - Place the spec under `tests/integration/` and tag it `@integration` (in addition to module tags).
   - Generate any missing CS page objects under `pages/cs/` on demand (small, focused — only the methods the cross-project step actually needs).
   - Use a separate `BrowserContext` for CS (CAS SSO is shared across TTT/CS, but per-context cookies keep state clean).
   - Login fixture for CS: `@cs/fixtures/LoginFixture` (uses `CsConfig`, defaults to user `slebedev`).
3. Cross-project orchestration helpers (e.g., `CsToTttSyncFixture`) live in `fixtures/integration/`.

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
Parse step prefixes: `SETUP:` (API state creation before test), `CLEANUP:` (teardown after test), `DB-CHECK:` (data verification), unprefixed (main UI steps).

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
autotests/e2e/fixtures/    -- Test fixtures (reuse existing workflows)
autotests/e2e/tests/<module>/  -- Existing test specs per module (avoid duplication, follow conventions)
autotests/e2e/tests/t<number>/  -- Ticket-scoped test specs (when scope is a GitLab ticket number)
autotests/e2e/data/<module>/   -- Data classes per module, queries/, saved/
autotests/e2e/data/t<number>/  -- Ticket-scoped data classes (when scope is a GitLab ticket number)
autotests/e2e/config/      -- Environment config (reads shared config/ttt/)
autotests/reference/       -- Prototype tests from ttt-autom-v2 (patterns, not executed)
```

Read 2-3 existing files in `e2e/pages/` and `e2e/fixtures/` to match conventions.

### 4. Generate Test Artifacts

Follow the 5-layer architecture (tests -> fixtures -> pages -> config+data -> Playwright API):

**a) Data class** (`e2e/data/<module>/{Module}{TestId}Data.ts`, e.g. `e2e/data/vacation/VacationTc001Data.ts`; for ticket scope: `e2e/data/t<number>/T<number>Tc<seq>Data.ts`, e.g. `e2e/data/t3404/T3404Tc001Data.ts`):
- Read the test case `preconditions` and `notes` from the manifest — extract ALL data requirements
- Build a **compound DB query** satisfying all preconditions simultaneously (office type AND sufficient days AND has manager AND correct role — not just one criterion)
- Consult vault for **implicit criteria** not in preconditions — e.g., approval needs `manager_id IS NOT NULL`, payment needs APPROVED+EXACT, CPO self-approval needs ROLE_DEPARTMENT_MANAGER
- Think through the **full test workflow** — if the test creates→approves→pays, the employee must satisfy requirements for ALL steps
- Use `ORDER BY random() LIMIT 1` so different tests pick different employees — prevents calendar contention
- After fetching, **validate** the data satisfies all criteria before returning
- NEVER hardcode the same username across multiple data classes
- Implement all three modes: `static` (env vars + defaults), `dynamic` (compound DB queries), `saved` (loadSaved → dynamic → saveToDisk)
- See `references/generation-guidelines.md` § "Smart Data Generation" for patterns

**b) Page Object** (`e2e/pages/{PageName}Page.ts`) -- create or extend existing:
- All locators as `private readonly` fields
- Intent-driven methods, no raw locator wrappers
- Composition, no inheritance
- **Selector priority: text-first** (`getByText`, `getByRole(_, {name})`) → role → structural (tag+containment) → partial class (`[class*='...']`)
- **BANNED: exact BEM class selectors** (`.navbar__*`, `.page-body__*`, `.drop-down-menu__*`) — they break across environments
- If an existing page object lacks a method you need, **ADD the method** — never inline a locator in the spec file

**c) Fixtures** (`e2e/fixtures/{Feature}Fixture.ts`) -- only if not already existing:
- Plain classes instantiated in test body (NOT `test.extend()`)
- Compose page objects internally

**d) Spec file** (`e2e/tests/<module>/{module}-{test-id}.spec.ts`, e.g. `e2e/tests/vacation/vacation-tc001.spec.ts`):
- **UI-first**: uses `{ page }` from Playwright — login via browser, interact via page objects, verify visible results
- Every verification step: `globalConfig.delay()` -> assert -> screenshot via `VerificationFixture`
- Tag: `@regress` (or `@smoke`/`@debug`)
- Login → navigate → interact → verify → cleanup (logout + page.close())
- API calls ONLY for: test endpoints (clock, sync), data verification (DB checks), or explicit API-only steps
- Auth: browser login for UI (any employee), `API_SECRET_TOKEN` for test endpoints only, JWT for API calls needing user context

### 5. Run the Test

After generation, run the test to verify it passes:

```bash
cd autotests && npx playwright test e2e/tests/<module>/{module}-{test-id}.spec.ts --project=chrome-headless
```

If it fails, diagnose and fix (invoke `autotest-fixer` skill if needed).

### 6. Track in SQLite

Update the tracking record:

```sql
UPDATE autotest_tracking
SET automation_status = 'generated', spec_file = '<spec-path>', data_class = '<data-class-path>', updated_date = datetime('now')
WHERE test_id = '<TC-ID>';
```

## Architecture Rules

1. **NEVER put `page.locator()` or `page.getByText()` directly in spec files.** All selectors MUST be in page objects. If a page object lacks the method you need, ADD it to the page object — do NOT shortcut by inlining a locator in the spec. This is the most common violation.
2. **No hardcoded data in specs.** All in `*Data` classes under `e2e/data/`.
3. **Every verification: delay -> assert -> screenshot** via `VerificationFixture`.
4. **Reuse before creating.** Check existing pages/ and fixtures/ first.
5. **Vault-first knowledge.** Search the vault before generating — it has selectors, validation rules, and quirks.
6. **Three data modes.** Every data class must support static, dynamic, and saved.
7. **API setup for preconditions.** When a test needs specific state (APPROVED/CANCELED vacation, etc.), create it via `ApiVacationSetupFixture` in the data class setup — don't rely on pre-existing DB state. Try DB query first, fall back to API creation. Accept `request?: APIRequestContext` in `create()` for this.
8. **Step timeout.** Per-action timeout is `stepTimeoutMs` (30s) in `global.yml`, wired as Playwright `actionTimeout`. Use `globalConfig.stepTimeoutMs` for custom waits. Never increase timeouts to mask broken selectors.

## References

Read these files for detailed framework conventions and code patterns:

- `references/framework-spec.md` -- Full 5-layer architecture specification, boilerplate, selector priority, TTT quirks
- `references/generation-guidelines.md` -- Data modes, vault integration, cleanup requirements

## Example Output Structure

For test case TC-RPT-042 in the Reports module:

```
autotests/e2e/
  tests/reports/reports-tc042.spec.ts
  pages/ReportsPage.ts                    (created or reused)
  fixtures/ReportSubmitFixture.ts          (created or reused)
  data/reports/ReportsTc042Data.ts         (created)
  data/reports/queries/reportQueries.ts    (extended if dynamic data needed)
```
