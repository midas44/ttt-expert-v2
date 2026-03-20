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

## API Test Boilerplate

```typescript
import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("api_test_name @regress", async ({ request }, testInfo) => {
  const tttConfig = new TttConfig();
  const data = new ApiTestData();
  expect(tttConfig.apiToken, "apiToken required").toBeTruthy();

  const url = tttConfig.buildUrl("/api/ttt/v1/...");
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };

  const response = await request.get(url, { headers });
  expect(response.status()).toBe(200);

  const filePath = testInfo.outputPath("response.json");
  await writeFile(filePath, JSON.stringify(await response.json(), null, 2), "utf-8");
  await testInfo.attach("response", { path: filePath, contentType: "application/json" });
});
```

## Data Class Pattern

```typescript
declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "./savedDataStore";

// Constructor args interface — used for saved mode serialization
interface Tc001Args { username: string; startDate: string; endDate: string }

export class VacationTc001Data {
  readonly username: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(
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
