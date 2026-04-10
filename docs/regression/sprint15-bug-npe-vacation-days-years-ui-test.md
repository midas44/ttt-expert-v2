# Test Case TC-SA-NPE-001 — Vacation days years endpoint NPE via UI

**Bug ID:** Sprint15-NPE-VacationDaysYears
**Severity:** HIGH (HTTP 500 + stack trace leakage)
**Module:** vacation
**Build:** qa-1, version `2.1.26.LOCAL` (commit `d79ae75409`)
**Endpoint under test:** `GET /api/vacation/v1/vacationdays/{login}/years`
**Service code path:** `EmployeeDaysServiceImpl.java:204`
**Controller code path:** `VacationDaysController.java:153`
**Frontend caller:** `vacation/ducks/vacation-events/services.js#fetchVacationDaysForYears`

---

## 1. Problem statement

The endpoint that returns vacation days grouped by year does not validate the `login` path parameter. When the login does not match any employee in the database, `EmployeeService.findByLogin()` returns `null`, and the next line dereferences it with `.getId()`, causing a `NullPointerException`.

The Spring error handler exposes the full stack trace (including internal class names and source line numbers) to the HTTP client. The wrong status code (500 instead of 404) breaks the REST contract and prevents the frontend from showing a friendly "user not found" message.

The frontend caller is the **Vacation Events Modal**, opened from the eye icon next to each employee on the **Vacation Days Correction** page (`/vacation/days-correction`). Under normal operation the login is always valid (it comes from a server-loaded list), so this bug does not surface during routine clicks. It surfaces in three realistic scenarios:

| Scenario | Reproducible by |
|----------|-----------------|
| A. Stale frontend after employee rename in CompanyStaff | Manager whose login is changed mid-session |
| B. Race condition: employee deleted while modal is loading | QA on test envs, rare on prod |
| C. Tampered request via DevTools or curl | QA / security test |

The most reliable end-user repro is **Scenario C** because it works without any DB setup. Scenarios A and B are listed as additional regression risks.

---

## 2. Pre-conditions

- qa-1 environment available at `https://ttt-qa-1.noveogroup.com`
- Test account with permission `VACATION_DAYS_VIEW` (any user with admin/HR role; the default qa-1 token user `pvaynmaster` works)
- Browser with DevTools (Chrome/Firefox/Edge)
- VPN/network access to qa-1
- (optional) Playwright + Node.js for automated execution

---

## 3. Manual UI test steps

### 3.1 Setup — capture a known-good baseline request

1. Open `https://ttt-qa-1.noveogroup.com/vacation/my` in the browser.
2. Log in (the SSO flow will auto-redirect from the qa-1 domain).
3. Open browser DevTools → **Network** tab.
4. Filter requests by URL substring: `vacationdays`.
5. **Reload the page.**
6. ✅ **Expected:** one request appears: `GET /api/vacation/v1/vacationdays/{your-login}/years` returning **HTTP 200** and a JSON array such as `[{"year":2026,"days":23},{"year":2027,"days":24}]`.

### 3.2 Trigger — replay the request with a tampered login

7. In the Network tab, **right-click** the captured request → **Copy** → **Copy as fetch** (Chrome) or **Copy as cURL** (Firefox).
8. Open the **Console** tab.
9. Paste the copied `fetch(...)` snippet.
10. Edit the URL: replace `{your-login}` with **`notexistuser`** (any string that is not an employee login, e.g. `zzz999`, `qa-test-bug`).
11. Press Enter.

   Example after editing:
   ```javascript
   await fetch("https://ttt-qa-1.noveogroup.com/api/vacation/v1/vacationdays/notexistuser/years", {
     "headers": { "accept": "application/json", /* ...other headers from copy... */ },
     "method": "GET",
     "credentials": "include"
   }).then(r => r.json())
   ```

### 3.3 Verify the bug

12. ✅ **Expected (correct REST behavior):**
    - HTTP status: `404 Not Found` **OR** `400 Bad Request`
    - Body: a structured error like `{"status":404,"error":"Not Found","message":"Employee not found: notexistuser"}`
    - **No stack trace** in the response

13. ❌ **Actual (the bug):**
    - HTTP status: **`500 Internal Server Error`**
    - Body contains a Java stack trace exposing internal class paths:
      ```json
      {
        "timestamp": "...",
        "status": 500,
        "error": "Internal Server Error",
        "trace": "java.lang.NullPointerException: Cannot invoke \"com.noveogroup.ttt.vacation.service.api.model.bo.employee.EmployeeBO.getId()\" because \"employee\" is null\n\tat com.noveogroup.ttt.vacation.service.impl.employeeVacation.EmployeeDaysServiceImpl.getVacationDaysGroupedByYears(EmployeeDaysServiceImpl.java:204)\n\tat com.noveogroup.ttt.vacation.rest.controller.v1.VacationDaysController.getVacationDaysGroupedByYears(VacationDaysController.java:153)\n\t..."
      }
      ```

14. **Bug confirmed when:**
    - Status code is exactly `500`
    - Response body contains the substring `NullPointerException` or `EmployeeBO.getId()`
    - Response body contains internal package name `com.noveogroup.ttt.vacation`

### 3.4 Cleanup
None — this test makes a single read-only GET, no state is mutated. Close the DevTools panel.

---

## 4. Alternative: pure UI repro via DevTools URL override (no console paste)

For testers who prefer not to use the Console:

1. Navigate to `/vacation/my` (steps 1–3 above).
2. DevTools → **Network** → find the `vacationdays/{login}/years` request.
3. Right-click → **Edit and Resend** (Firefox) **or** install the Chrome **"Resource Override"** extension.
4. Edit the URL: change the `{login}` segment to `notexistuser`.
5. Send the request.
6. Inspect the response — same bug confirmation as step 13 above.

---

## 5. Stale-frontend natural repro (Scenario A — bonus)

This is harder to set up but matches a real production scenario:

1. As an admin, navigate to `/admin/employees` and **rename** an employee's login (or trigger a CompanyStaff sync that renames a login). For example, change `oldlogin` → `newlogin`.
2. In a **second browser tab** still on the old session, navigate to `/vacation/days-correction`.
3. Find the employee with the new login in the table.
4. **The frontend may still hold the old login `oldlogin` in cached props.** Click the eye icon (the `VacationEventsButton`) for that row.
5. The modal opens and dispatches `fetchVacationDaysForYears({ login: 'oldlogin' })`.
6. **Bug:** the user sees a generic browser error or a blank modal instead of either fresh data or a friendly "user not found" message. The Network tab shows HTTP 500.

This scenario is harder to script but proves the bug has real production impact.

---

## 6. Automated repro (Playwright)

Drop this into `autotests/tests/regress/vacation-days-years-npe.spec.ts`:

```typescript
import { test, expect, request } from '@playwright/test';

test.describe('@regress @bug Vacation days years NPE on unknown login', () => {
  const BASE = 'https://ttt-qa-1.noveogroup.com';
  const TOKEN = process.env.TTT_API_TOKEN ?? '76c45e8c-457a-4a8f-817f-4160d0cc2eaf';

  test('TC-SA-NPE-001 baseline: valid login returns 200', async () => {
    const ctx = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { API_SECRET_TOKEN: TOKEN },
    });
    const res = await ctx.get(`${BASE}/api/vacation/v1/vacationdays/achernishov/years`);
    expect(res.status(), 'valid login should return 200').toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('TC-SA-NPE-001 trigger: unknown login should NOT return 500/NPE', async () => {
    const ctx = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { API_SECRET_TOKEN: TOKEN },
    });
    const res = await ctx.get(`${BASE}/api/vacation/v1/vacationdays/notexistuser/years`);

    // After fix: should be 404 or 400, NOT 500
    expect.soft(res.status(), 'unknown login should not return 500').not.toBe(500);
    expect.soft([400, 404]).toContain(res.status());

    const body = await res.text();
    // Should not leak internal Java class names
    expect.soft(body, 'response must not contain NullPointerException').not.toContain('NullPointerException');
    expect.soft(body, 'response must not contain internal package').not.toContain('com.noveogroup.ttt.vacation.service.impl');
    expect.soft(body, 'response must not expose CGLIB proxy').not.toMatch(/\$\$EnhancerBySpringCGLIB\$\$/);
  });

  test('TC-SA-NPE-001 UI: trigger from Vacation Days Correction page via tampered fetch', async ({ page, context }) => {
    // Log in via SSO (assumes pre-existing session or auto-login fixture)
    await page.goto(`${BASE}/vacation/my`);
    await expect(page).toHaveURL(/\/vacation\/my/);

    // Fire the tampered request from inside the page context (preserves cookies/CSRF)
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/vacation/v1/vacationdays/notexistuser/years', {
        method: 'GET',
        credentials: 'include',
      });
      return { status: r.status, body: await r.text() };
    });

    expect.soft(result.status, 'in-browser fetch should not return 500').not.toBe(500);
    expect.soft(result.body).not.toContain('NullPointerException');
  });
});
```

**Run:**
```bash
cd autotests
npx playwright test tests/regress/vacation-days-years-npe.spec.ts --grep '@bug'
```

**Expected on the buggy build (qa-1 v2.1.26.LOCAL):** all three tests **FAIL** at the soft assertions (status is 500, body contains `NullPointerException`).
**Expected after fix:** all three tests **PASS**.

---

## 7. Acceptance criteria for the fix

A patch is acceptable when:
1. `GET /api/vacation/v1/vacationdays/notexistuser/years` returns **HTTP 404** (preferred) or **HTTP 400** (validator-style)
2. The response body is JSON with a clean error message and **no Java class names, no `NullPointerException`, no source line numbers**
3. The valid case `GET .../vacationdays/achernishov/years` still returns **HTTP 200** with the same payload as before
4. All three Playwright tests above pass

**Suggested fix** (one of):

A. Add a validator on the controller (matches the project's existing pattern):
```java
// VacationDaysController.java:152
@GetMapping("/{login}/years")
public List<EmployeeDaysDTO> getVacationDaysGroupedByYears(
    @PathVariable("login") @EmployeeLoginExists final String login) { ... }
```

B. Or guard inside the service:
```java
// EmployeeDaysServiceImpl.java:202
final EmployeeBO employee = employeeService.findByLogin(employeeLogin);
if (employee == null) {
    throw new NotFoundException("Employee not found: " + employeeLogin);
}
```

The static analysis report (`sprint15-static-analysis.md`) flagged the same anti-pattern at `InternalEmployeeService.java:311` and `:315` for `manager`/`techLead` lookups — the fix pass should cover those too.

---

## 8. Related findings

- **Vault note** (to be created): `vault/exploration/api-findings/vacation-days-years-npe.md`
- **Static analysis report:** `docs/regression/sprint15-static-analysis.md` (issue 3.A in the qa-1 sanity report)
- **Sanity test report:** `docs/regression/sprint15-qa1-sanity-test.md` (Phase 3, Finding 3.A)
- **Same anti-pattern locations** to fix in the same MR:
  - `InternalEmployeeService.java:311` (`request.getManagerLogin()` → `manager.getId()`)
  - `InternalEmployeeService.java:315` (`request.getTechLeadLogin()` → `techLead.getId()`)
