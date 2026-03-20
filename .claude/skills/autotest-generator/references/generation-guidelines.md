# Autotest Generation Guidelines

## Process

1. **Read the test case** from `autotests/manifest/test-cases.json` or accept a TC-ID
2. **Enrich from vault**: search QMD for module + feature → read vault notes for validation rules, selectors, edge cases
3. **Check existing code**: scan `autotests/e2e/pages/` and `e2e/fixtures/` for reusable components
4. **Generate artifacts** in order: data class → page objects (if needed) → fixtures (if needed) → test spec → doc file
5. **Run and verify**: `npx playwright test <spec> --project=chrome-headless`
6. **Track**: update SQLite `autotest_tracking` table

## Data & Parametrization

- All dynamic data in the dedicated `*Data` class
- Constructor params read from `process.env` with documented defaults
- Standard timestamp format: `ddmmyy_HHmm`
- If DB queries needed, create query file in `e2e/data/queries/`

### Three Test Data Modes

Every data class MUST implement `static async create(mode: TestDataMode, tttConfig: TttConfig)` supporting all three modes:

1. **`static`** — zero DB calls, uses hardcoded defaults from constructor/env vars. Fast, deterministic, works offline. Use for CI smoke tests and when DB is unavailable.

2. **`dynamic`** — queries PostgreSQL via `DbClient` for real data each run (random employee, conflict-free dates, valid entities). Produces realistic test data but requires DB access. Always wrap in `try/finally` with `db.close()`.

3. **`saved`** — reads constructor args from `e2e/data/saved/<ClassName>.json`. If the file doesn't exist, falls back to `dynamic` mode, then saves the result for future runs. Enables reproducible runs without DB. Use `savedDataStore.ts` utilities:
   ```typescript
   import { loadSaved, saveToDisk } from "./savedDataStore";

   static async create(mode: TestDataMode, tttConfig: TttConfig): Promise<MyData> {
     if (mode === "static") return new MyData();
     if (mode === "saved") {
       const cached = loadSaved<{ username: string; startDate: string }>("MyData");
       if (cached) return new MyData(cached.username, cached.startDate);
       // Fall through to dynamic, then save
     }
     const db = new DbClient(tttConfig);
     try {
       const username = await findSomeEmployee(db);
       const instance = new MyData(username);
       if (mode === "saved") saveToDisk("MyData", { username });
       return instance;
     } finally {
       await db.close();
     }
   }
   ```

The mode is set in `e2e/config/global.yml` → `testDataMode` and read by `GlobalConfig.testDataMode`. Tests access it via `globalConfig.testDataMode` and pass to `Data.create()`.

## Fixture & Page Object Rules

- Reuse existing first — only create new if needed
- Fixtures are plain classes instantiated in test body
- Page objects expose intent-driven methods, not raw locator wrappers
- For unstable elements, use `resolveFirstVisible()` from `e2e/utils/locatorResolver.ts`

## Verification & Diagnostics

- All assertions through `VerificationFixture`: delay → assert → screenshot
- Name verification steps descriptively for searchable attachments
- Use `testInfo` attachments, not console.log
- API tests: save response JSON as attachments

## Selector Rules

- Prefer role-based (`getByRole`) for accessibility and stability
- Stable attributes (`getByTestId`, `data-qa`, `aria-*`) when roles insufficient
- Text-based only for static EN text
- Always `exact: true` when name could be substring
- Encapsulate selectors in page objects, never in specs

## Cleanup Requirements

- Tests that create data MUST clean up (delete vacation, remove task, etc.)
- Use `logout.runViaDirectUrl()` + `page.close()` at test end
- API tests with mutations: include DELETE/reset step

## Vault Integration (Expert System Advantage)

Before generating any test:
1. `mcp__qmd-search__search` for the module name + feature
2. Read relevant vault notes for: validation rules, error codes, boundary values, known bugs
3. Query SQLite `exploration_findings` for edge cases specific to this feature
4. Use discovered knowledge to write better preconditions, assertions, and data choices
