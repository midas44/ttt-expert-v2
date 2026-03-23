# TTT Autotest Framework Specification

## Architecture

5-layer Playwright + TypeScript with strict downward dependencies:

```
Test Specs          autotests/e2e/tests/*.spec.ts       — scenario orchestration
    ↓
Fixtures            autotests/e2e/fixtures/*.ts          — reusable workflows (plain classes)
    ↓
Page Objects        autotests/e2e/pages/*.ts             — UI locators + intent-driven methods
    ↓
Config + Data       autotests/e2e/config/, e2e/data/     — YAML configs + test data classes
    ↓
Playwright API
```

## Rules

1. **Fixtures are plain classes** — instantiated in test body, never `test.extend()`
2. **Config per-test** — `new TttConfig()` then `new GlobalConfig(tttConfig)`
3. **No raw locators in specs** — all via page objects or fixtures
4. **No hardcoded test data** — all in `*Data` classes under `e2e/data/`
5. **Every verification**: `globalConfig.delay()` → assertion → screenshot
6. **Page objects use composition** — no base class, no inheritance

## Naming

| Artifact | Pattern | Example |
|----------|---------|---------|
| Test spec | `{module}-{test-id}.spec.ts` | `vacation-tc001.spec.ts` |
| Data class | `{Module}{TestId}Data` | `VacationTc001Data` |
| Fixture | `{Feature}Fixture` | `VacationCreationFixture` |
| API setup fixture | `Api{Module}SetupFixture` | `ApiVacationSetupFixture` |
| Page object | `{PageName}Page` / `{Dialog}Dialog` | `MyVacationsPage` |

## UI Test Boilerplate

```typescript
import { test } from "@playwright/test";

test("test_name @regress", async ({ page }, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SomeTestData.create(globalConfig.testDataMode, tttConfig);
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  await login.run();
  // ... workflow via fixtures/page objects ...
  await logout.runViaDirectUrl();
  await page.close();
});
```

## API Call Boilerplate (for test endpoints and setup only)

API calls should ONLY be used in tests for: test endpoints (clock manipulation, sync, cleanup), data verification, or rare cases where a test step explicitly requires API interaction. Most tests should use the UI Test Boilerplate above.

```typescript
// Use API_SECRET_TOKEN ONLY for test/admin endpoints (no @CurrentUser validation)
// This token authenticates as its owner (pvaynmaster on qa-1) — NOT any user
const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
const clockUrl = tttConfig.buildUrl("/api/ttt/test/v1/clock");
await request.patch(clockUrl, { headers, data: { dateTime: "2026-04-01T10:00:00" } });

// NOTE: No endpoint exists to get JWT for arbitrary users.
// API setup can only create data as the token owner (pvaynmaster).
// For per-user scenarios, use UI login via LoginFixture.
```

## Data Class Pattern

```typescript
declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "./savedDataStore";

// IMPORTANT: Constructor defaults are static-mode fallbacks only.
// Dynamic mode MUST implement the DB query from test case preconditions.
// Never hardcode the same username across multiple data classes.
// API_SECRET_TOKEN authenticates as its OWNER (pvaynmaster on qa-1) — NOT any user.
// For UI tests, auth is via browser login (any employee). API setup is limited to token owner (pvaynmaster).

// Constructor args interface — used for saved mode serialization
interface Tc001Args { username: string; startDate: string; endDate: string }

export class VacationTc001Data {
  readonly username: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(
    // Static-mode fallbacks only — dynamic mode queries DB for a suitable employee
    username = process.env.VAC_TC001_USER ?? "pvaynmaster",
    startDate = process.env.VAC_TC001_START ?? "01.04.2026",
    endDate = process.env.VAC_TC001_END ?? "05.04.2026",
  ) {
    this.username = username;
    this.startDate = startDate;
    this.endDate = endDate;
  }

  static async create(mode: TestDataMode, tttConfig: TttConfig): Promise<VacationTc001Data> {
    // Static: hardcoded defaults, zero DB calls
    if (mode === "static") return new VacationTc001Data();

    // Saved: read from JSON cache, fall through to dynamic if missing
    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("VacationTc001Data");
      if (cached) return new VacationTc001Data(cached.username, cached.startDate, cached.endDate);
    }

    // Dynamic: query PostgreSQL for real data
    const db = new DbClient(tttConfig);
    try {
      const username = await findRandomEmployee(db);
      const { startDate, endDate } = await findAvailableDates(db, username);
      const instance = new VacationTc001Data(username, startDate, endDate);
      // If "saved" mode requested, persist for future runs
      if (mode === "saved") saveToDisk("VacationTc001Data", { username, startDate, endDate });
      return instance;
    } finally {
      await db.close();
    }
  }
}
```

### Test Data Modes

| Mode | DB Required | Reproducible | Use Case |
|------|-------------|-------------|----------|
| `static` | No | Yes (hardcoded) | CI smoke tests, offline development |
| `dynamic` | Yes | No (random each run) | Full regression, data freshness |
| `saved` | First run only | Yes (cached) | Reproducible regression, debug replays |

Set in `e2e/config/global.yml` → `testDataMode`. Read via `globalConfig.testDataMode`.
Saved data stored in `e2e/data/saved/<ClassName>.json`.

## Selector Priority

1. Role-based: `getByRole("button", { name: "Create", exact: true })`
2. Stable attributes: `getByTestId()`, `locator("[data-qa]")`, `locator("[aria-*]")`
3. Scoped CSS under container
4. Text-based: `getByText()` (only static EN text)
5. XPath (last resort)

Always use `exact: true` in `getByRole()` when name could be a substring.

## Timeouts

Three timeout levels are configured — use the right one for each situation:

| Timeout | Config | Default | Scope |
|---------|--------|---------|-------|
| **Test timeout** | `playwright.config.ts` → `timeout` | 180s | Total time for entire test (setup + steps + cleanup) |
| **Step timeout** | `global.yml` → `stepTimeoutMs` | 30s | Per action: `click()`, `fill()`, `goto()`, `waitFor()`. Exposed as `globalConfig.stepTimeoutMs` and wired to Playwright's `actionTimeout` + `navigationTimeout` |
| **Expect timeout** | `playwright.config.ts` → `expect.timeout` | 10s | Per assertion: `expect(locator).toBeVisible()`, `expect(locator).toHaveText()` |

**When to use `stepTimeoutMs` explicitly** — Playwright applies `actionTimeout` automatically to all built-in actions. Use `globalConfig.stepTimeoutMs` when you need an explicit timeout for custom waits:
```typescript
await page.waitForSelector(".some-element", { timeout: globalConfig.stepTimeoutMs });
await pollForMatch(candidates, { timeout: globalConfig.stepTimeoutMs });
```

**Do NOT increase timeouts to fix broken selectors.** If a step times out at 30s, the selector is likely wrong — investigate with `page-discoverer` skill or playwright-vpn snapshot. Increasing the timeout just makes failures slower to detect.

## TTT UI Quirks

- `rc-checkbox`: use `.click()` not `.check()` / `.uncheck()`
- Dialog naming: gerunds ("Creating vacation request"), not imperatives
- Data race: wait for expected state in dialog before interacting
- Date picker: `.rdtPicker` calendar with `.rdtDay`, `.rdtSwitch` navigation
- Notification: multiple selector strategies needed (role, class, data-qa — use `resolveFirstVisible()`)

## Running Tests

```bash
cd autotests
npx playwright test e2e/tests/<spec> --project=chrome-headless   # autonomous
npx playwright test e2e/tests/<spec> --project=chrome-debug       # manual headed
```
