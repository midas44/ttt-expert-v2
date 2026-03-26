# Autotest Generation Guidelines

## Process

1. **Read the test case** from `autotests/manifest/test-cases.json` or accept a TC-ID
2. **Parse step prefixes**: identify `SETUP:` steps (API state creation), `CLEANUP:` steps (teardown), `DB-CHECK:` steps (data verification), and main UI steps (unprefixed)
3. **Enrich from vault**: search QMD for module + feature → read vault notes for validation rules, selectors, edge cases
4. **Check existing code**: scan `autotests/e2e/pages/` and `e2e/fixtures/` for reusable components
5. **Generate artifacts** in order: data class → page objects (if needed) → fixtures (if needed) → test spec
5. **Run and verify**: `npx playwright test <spec> --project=chrome-headless`
6. **Track**: update SQLite `autotest_tracking` table

## Data & Parametrization

- All dynamic data in the dedicated `*Data` class
- Constructor params read from `process.env` with documented defaults
- Standard timestamp format: `ddmmyy_HHmm`
- If DB queries needed, create query file in `e2e/data/<module>/queries/` (or `e2e/data/t<number>/queries/` for ticket scope). Reuse existing query functions from parent module when possible.

### Three Test Data Modes

Every data class MUST implement `static async create(mode: TestDataMode, tttConfig: TttConfig)` supporting all three modes:

1. **`static`** — zero DB calls, uses hardcoded defaults from constructor/env vars. Fast, deterministic, works offline. Use for CI smoke tests and when DB is unavailable.

2. **`dynamic`** — queries PostgreSQL via `DbClient` for real data each run (random employee, conflict-free dates, valid entities). Produces realistic test data but requires DB access. Always wrap in `try/finally` with `db.close()`.

3. **`saved`** — reads constructor args from `e2e/data/saved/<ClassName>.json`. If the file doesn't exist, falls back to `dynamic` mode, then saves the result for future runs. Enables reproducible runs without DB. Use `savedDataStore.ts` utilities:
   ```typescript
   import { loadSaved, saveToDisk } from "../savedDataStore";

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

### Preconditions Are The Contract

The test case `preconditions` field in the manifest is the **primary specification** for what the data class must do. When preconditions say:
- "Employee in AV=false office" → `create()` dynamic mode MUST query `SELECT ... WHERE office.advance_vacation=false`
- "Employee with sufficient accrued days (>=5)" → MUST query `WHERE vacation_days.days >= 5`
- "No overlapping vacations" → MUST use `hasVacationConflict()` to find conflict-free dates
- "Manager/approver exists" → MUST use `findEmployeeWithManager()` or similar
- "CPO employee" → MUST use `findCpoEmployee()` or query for ROLE_DEPARTMENT_MANAGER

### Smart Data Generation — Data Must Be Suitable for the Test Case

Dynamically generated data must satisfy ALL preconditions simultaneously, not just one. This is the most critical aspect of data class generation.

**1. Build compound queries from ALL preconditions.**
Most test cases have multiple preconditions that must all be true at the same time. Example:

TC-VAC-088 "Pay APPROVED REGULAR vacation" requires:
- Employee in an office where REGULAR vacations exist
- Employee has a manager (approval flow needs an approver)
- Employee has sufficient vacation days (to create the vacation)
- No overlapping vacations in the target date range
- The employee's role permits vacation creation

The DB query must AND all these criteria together — not just pick any random employee:
```sql
SELECT e.login FROM ttt_backend.employee e
  JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
  JOIN ttt_vacation.employee ve ON ve.login = e.login
  JOIN ttt_backend.office o ON o.id = e.office_id
WHERE e.enabled = true
  AND e.manager_id IS NOT NULL          -- has approver
  AND o.advance_vacation = false         -- AV=false office
  AND r.role_name = 'ROLE_EMPLOYEE'      -- has employee role
ORDER BY random() LIMIT 1
```

**2. Consult the knowledge base for implicit criteria.**
The XLSX preconditions don't always list everything needed. The vault contains knowledge about implicit requirements:
- Approval flow requires `manager_id IS NOT NULL` (vault: modules/vacation-service-deep-dive.md)
- AV=true offices use different day calculation (vault: modules/vacation-service.md)
- CPO self-approval requires ROLE_DEPARTMENT_MANAGER (vault: exploration/api-findings/)
- Payment requires APPROVED status + EXACT period type (vault: exploration/api-findings/payment-flow)

Before writing the DB query, search the vault for the module + feature to discover these implicit requirements:
```
mcp__qmd-search__search(query: "vacation approval prerequisites manager", collection: "expert-vault")
```

**3. Validate fetched data before returning.**
After querying, verify the result actually works:
```typescript
const emp = await findSuitableEmployee(db);
// Verify: does this employee actually have sufficient days?
const days = await db.queryOne<{days: number}>(
  'SELECT days FROM ttt_vacation.vacation_days WHERE employee_login = $1 AND year = $2',
  [emp.login, new Date().getFullYear()]
);
if (days.days < requiredDays) {
  // Try another employee or throw descriptive error
  throw new Error(`Employee ${emp.login} has ${days.days} days, need ${requiredDays}`);
}
```

**4. Consider the full test workflow when selecting data.**
Some tests need data that survives multiple steps:
- "Create → approve → pay" needs an employee whose manager exists AND is enabled
- "Create → reject → re-create" needs dates that are available for two vacation windows
- "Multi-year vacation" needs dates spanning a year boundary

Think through what the test will DO with the data, not just what the first step needs.

**5. Use `ORDER BY random()` to distribute load.**
When multiple tests need "any employee in AV=false office", each should pick a DIFFERENT random employee. This prevents all tests from competing for the same user's calendar:
```sql
SELECT ... ORDER BY random() LIMIT 1
```

### Realistic Data Ranges

Generated test data must be **realistic and similar to existing data** in the system. Unrealistic values (e.g., vacations in 2030) break application workflows — accounting periods, day calculations, and approval flows assume dates within normal business ranges.

**Date ranges:**
- Vacations: no more than **1–1.5 years ahead** from current date. Use `new Date()` + offset in weeks, not hardcoded far-future years.
- Sick leaves: past or current, within the current accounting year
- Report periods: within open accounting periods (query `ttt_backend.office_report_period` for current open period)
- Payment months: 1st of the month containing the vacation start date

**Employee data:**
- Use employees that are `enabled = true` and have recent activity — don't pick disabled or archived accounts
- Respect office-specific rules: AV=true vs AV=false offices have different day calculation, don't mix them up
- Use employees with realistic vacation day balances — not zero, not thousands

**General principle:** If a human QA engineer would never create such data manually, the autotest shouldn't either. When in doubt, query the DB for a distribution of existing values and pick within the normal range.

### Anti-patterns

- Hardcoding `pvaynmaster` or any single username across multiple data classes
- Implementing `static` mode only and ignoring `dynamic`
- Building a query that matches only ONE precondition while ignoring others
- Ignoring SQL queries provided in the `notes` or `preconditions` fields
- Using the same hardcoded dates across tests — compute from `new Date()` in dynamic mode
- Creating vacations years into the future (2030+) — max 1–1.5 years ahead
- Selecting an employee without checking they have the required role/manager/office type
- Generating API-only tests when the test case describes a UI scenario — default is always UI
- Using `API_SECRET_TOKEN` for business endpoint calls — it authenticates as the token owner only (see below)

### Authentication Strategy

**`API_SECRET_TOKEN` is NOT an environment-wide service token.** It is resolved via `DatabaseApiTokenResolver` and authenticates as the **token owner** (pvaynmaster on qa-1). The `@CurrentUser` validator checks that `login` in the request body matches the authenticated principal. So API calls with `API_SECRET_TOKEN` + a different `login` will FAIL on `@CurrentUser` endpoints.

| Scenario | Auth method |
|----------|-----------|
| **UI tests** (default) | Browser login via `LoginFixture` — works for any employee |
| **Test endpoints** (clock, sync, cleanup) | `API_SECRET_TOKEN` — these don't use `@CurrentUser` |
| **API calls needing specific user** (rare) | Not available — no endpoint for arbitrary user JWT. Use UI login or create data as token owner (pvaynmaster) |

**Most tests should use browser login.** Only use API calls for test setup/teardown and data verification.

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

- **Text-first**: use `getByText()`, `getByRole(_, { name: "visible text" })` — most stable for TTT
- **Role-based**: `getByRole()` when element has semantic HTML (`button`, `dialog`, `heading`)
- **Structural**: tag + containment (`table tbody tr`, `dialog.locator("button")`)
- **Partial class match**: `[class*='menu']`, `[class*='notification']` — survives class renaming
- **BEM class selectors are BANNED**: never use `.navbar__*`, `.page-body__*`, `.drop-down-menu__*` or any exact BEM class — they break across environments
- Always `exact: true` when name could be substring
- **Encapsulate ALL selectors in page objects — NEVER in spec files** (see Architecture Rules)

## Step Prefixes from Test Documentation

The XLSX test documentation uses prefixed steps to distinguish setup/teardown from the main test flow. Map these to code:

| Prefix | Meaning | Code pattern |
|--------|---------|-------------|
| `SETUP:` | Create precondition state via API before UI test | `ApiVacationSetupFixture` in data class `create()` or test setup block |
| `CLEANUP:` | Revert state after test | `finally` block with `ApiVacationSetupFixture.deleteVacation()` |
| `DB-CHECK:` | Verify DB state beyond what UI shows | `DbClient` query + assertion |
| _(no prefix)_ | Main UI step | Page objects + fixtures |

**When generating code from steps with SETUP: prefix, use `ApiVacationSetupFixture`** rather than inventing setup logic. The test documentation specifies which API calls to make.

## API Setup for Test Preconditions

When a test has `SETUP:` steps or requires specific state that may not exist in the DB (e.g., an APPROVED or CANCELED vacation), **create that state via API in the test setup phase** rather than relying on pre-existing data:

1. Use `ApiVacationSetupFixture` (in `e2e/fixtures/`) for vacation state setup
2. The data class `create()` method should accept an optional `request: APIRequestContext` parameter
3. Try DB query first (fast). If no matching data found, fall back to API creation
4. Use JWT auth (`getJwtForUser()`) for endpoints with `@CurrentUser` validation
5. Use `API_SECRET_TOKEN` for approve/admin operations (pvaynmaster is CPO)
6. Record created IDs for cleanup

**Pattern:**
```typescript
static async create(mode: TestDataMode, tttConfig: TttConfig, request?: APIRequestContext) {
  const db = new DbClient(tttConfig);
  try {
    try {
      return await findExistingData(db);  // Fast path
    } catch {
      if (!request) throw new Error("No data found and no request context for setup");
      const setup = new ApiVacationSetupFixture(request, tttConfig);
      return await setup.createAndApprove(employee, startDate, endDate);  // Setup path
    }
  } finally { await db.close(); }
}
```

## Cleanup Requirements

- Tests that create data MUST clean up (delete vacation, remove task, etc.)
- Use `logout.runViaDirectUrl()` + `page.close()` at test end
- API-created setup data: use `ApiVacationSetupFixture.deleteVacation(id)` in finally block

## Vault Integration (Expert System Advantage)

Before generating any test:
1. `mcp__qmd-search__search` for the module name + feature
2. Read relevant vault notes for: validation rules, error codes, boundary values, known bugs
3. Query SQLite `exploration_findings` for edge cases specific to this feature
4. Use discovered knowledge to write better preconditions, assertions, and data choices
