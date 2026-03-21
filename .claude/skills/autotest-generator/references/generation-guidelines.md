# Autotest Generation Guidelines

## Process

1. **Read the test case** from `autotests/manifest/test-cases.json` or accept a TC-ID
2. **Enrich from vault**: search QMD for module + feature → read vault notes for validation rules, selectors, edge cases
3. **Check existing code**: scan `autotests/e2e/pages/` and `e2e/fixtures/` for reusable components
4. **Generate artifacts** in order: data class → page objects (if needed) → fixtures (if needed) → test spec
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
- Commenting "API_SECRET_TOKEN authenticates as X" — the token is env-wide, not user-specific
- Using the same hardcoded dates across tests — compute from `new Date()` in dynamic mode
- Creating vacations years into the future (2030+) — max 1–1.5 years ahead
- Selecting an employee without checking they have the required role/manager/office type

**The API_SECRET_TOKEN** is an environment-wide service token resolved from the DB `token_permissions` table. It is NOT tied to any specific user. Any employee login works with it.

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
