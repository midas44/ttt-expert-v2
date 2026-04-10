# Test Case TC-SA-NPE-002 — Vacation days years endpoint NPE: realistic UI surface analysis

**Bug ID:** Sprint15-NPE-VacationDaysYears (UI surface, revised)
**Severity:** **MEDIUM** (latent bug, narrow natural trigger window)
**Module:** vacation, frontend
**Build:** qa-1, version `2.1.26.LOCAL` (commit `d79ae75409`)

> **Revision note:** an earlier draft of this test case (and the parent sanity test report) overstated the impact, claiming **27 affected users** on qa-1. Investigation showed all 27 are **contractors**, who are protected from ever reaching the buggy code path by **three independent guards**. This document supersedes that claim and documents the realistic — much narrower — natural trigger window.

---

## 1. Why the original "27 users" claim was wrong

The 27 users (`amine.soumiaa`, `olivier.lombard`, etc.) all have `is_contractor = true` and the global role `ROLE_CONTRACTOR`. Three guards block them:

| Layer | Component | Guard |
|-------|-----------|-------|
| Backend | `VacationPermissionProvider.get()` | Calls `vacationClient.getPermissions()`. For users not in `ttt_vacation.employee`, the call returns empty/throws → provider catches and returns `Collections.emptySet()`. The user has **no `VACATIONS:VIEW`** in their permission set. |
| Frontend menu | `menuConfig.vacationPermissions.my` requires `VACATIONS:VIEW` | `PermissionDto.menuHasUserPermission()` returns `false` → the **"Vacations" item is hidden** from the navbar. |
| Frontend route | `PrivateRoute` guarding `/vacation/my` | Even if the user types the URL directly, the same permission check returns `false` and the page renders `<NotAuthorizedContainer />` (403 page). The buggy `UserVacationsPageContainer` **never mounts**. |

**Verified counts on qa-1:**
```sql
SELECT count(*) FILTER (WHERE b.is_contractor = false) AS non_contractors,
       count(*) FILTER (WHERE b.is_contractor = true)  AS contractors
FROM ttt_backend.employee b
WHERE b.enabled = true AND b.login IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ttt_vacation.employee v WHERE v.login = b.login);
-- non_contractors = 0
-- contractors = 27
```

**Result:** zero non-contractor users hit this bug naturally on qa-1 today. The `27` figure was a false alarm.

---

## 2. The bug is still real — narrower realistic trigger

The NPE remains a defect (HTTP 500 with stack-trace leakage) and matches the static-analysis finding 3.A. It can fire in three realistic scenarios, all narrower than the contractor scenario:

### 2.1 Scenario A — New regular hire onboarding race window

**Conditions:**
- A new employee is created in CompanyStaff as a non-contractor
- TTT auth sync (`CSEmployeeSynchronizer`) picks them up first → they appear in `ttt_backend.employee` with vacation permissions
- The vacation service sync (`vacation/CSEmployeeSynchronizer.java`) hasn't run yet → they are missing from `ttt_vacation.employee`
- The new hire logs in (e.g., follows a welcome email link) and clicks "Vacations" in the menu

**Result:** the menu item is visible (TTT auth granted vacation permissions), the user navigates to `/vacation/my`, the saga calls the buggy endpoint → 500 NPE → "Something went wrong" modal.

**Window length:** depends on vacation sync schedule. In the project, syncs run on a cron — typically minutes to hours. If sync fails for that employee specifically, the window can stretch to days until manual intervention.

**Detectability today:** zero on qa-1 (no employees currently in this state). To reproduce, you must artificially create such a state (see §3 below).

### 2.2 Scenario B — Stale frontend after rename

**Conditions:**
- An admin renames an employee's login in CompanyStaff (`oldlogin` → `newlogin`)
- TTT auth sync updates `ttt_backend.employee.login = 'newlogin'`
- Vacation sync hasn't propagated the rename → `ttt_vacation.employee.login = 'oldlogin'` (or reverse, depending on sync order)
- The renamed user has an open browser tab with cached state still holding `oldlogin`
- They refresh the My Vacations page

**Result:** frontend dispatches `fetchVacationDaysForYears({ login: 'oldlogin' })` against the new vacation DB → backend can't find the user → NPE.

**Detectability:** very low — requires a specific timing of rename + open session. Realistic but rare.

### 2.3 Scenario C — Tampered request (TC-SA-NPE-001)

The DevTools-based reproduction documented in `sprint15-bug-npe-vacation-days-years-ui-test.md`. Reliable, no setup required, but not a "regular user" scenario — it's a QA / security test.

---

## 3. Test Case TC-SA-NPE-002 — synthetic black-box repro of Scenario A

Because Scenarios A and B require specific timing or DB state, this test case **engineers** the precondition by removing one row from `ttt_vacation.employee`. The triggering UI flow is then 100% black-box — no DevTools, no code, no network manipulation.

> **Caution:** this test mutates qa-1 data. Do **not** run on stage/prod. Restore the row at the end of the test.

### Pre-conditions

| # | Pre-condition |
|---|---------------|
| P1 | qa-1 environment available at `https://ttt-qa-1.noveogroup.com` |
| P2 | A test user account with **`is_contractor = false`** and `enabled = true` who has SSO credentials accessible to the QA team. Recommended candidates on qa-1: `achernishov`, `akunpeissov`, or any HR-owned test account. The user should have **few or zero existing vacation rows** to keep cleanup simple. |
| P3 | DBA / infra access to `mcp__postgres-qa1` (or equivalent) for the precondition setup |
| P4 | A web browser (any modern Chrome/Firefox/Edge) |
| P5 | The vacation service employee sync scheduler is **stopped or paused** for the test window — otherwise it will re-add the test user mid-test. (Coordinate with DevOps. Alternative: run the test in a 2-minute window where you delete and restore quickly.) |

### Setup

1. **Capture the existing row** (for restoration):
   ```sql
   -- on postgres-qa1 (write-mode required, normally read-only)
   SELECT * FROM ttt_vacation.employee WHERE login = 'achernishov';
   -- Save the row to a scratchpad
   ```

2. **Delete the row from `ttt_vacation.employee`** (this simulates Scenario A — TTT auth has the user, vacation service doesn't):
   ```sql
   DELETE FROM ttt_vacation.employee WHERE login = 'achernishov';
   -- (cascades may delete employee_vacation rows; capture them too if needed)
   ```

3. **Verify** the user is gone from vacation but still in TTT auth:
   ```sql
   SELECT 'auth' AS service, count(*) FROM ttt_backend.employee WHERE login = 'achernishov'
   UNION ALL
   SELECT 'vacation' AS service, count(*) FROM ttt_vacation.employee WHERE login = 'achernishov';
   -- Expect: auth = 1, vacation = 0
   ```

4. **Verify backend rejects unknown login on the buggy endpoint** (sanity check):
   ```bash
   curl -sk --noproxy '*' -H "API_SECRET_TOKEN: <token>" \
     "https://ttt-qa-1.noveogroup.com/api/vacation/v1/vacationdays/achernishov/years"
   # Expect: HTTP 500 with "NullPointerException" in body  ← bug confirmed
   ```

### Test steps

| # | Action | Expected (after fix) | Actual (current build) |
|---|--------|----------------------|------------------------|
| 1 | Open `https://ttt-qa-1.noveogroup.com` in a clean private/incognito window | SSO login screen | ✓ same |
| 2 | Log in as `achernishov` (the deleted-from-vacation user) | TTT landing page loads, top navbar visible, **"Vacations" menu item is visible** (because TTT auth still has the user with vacation permissions) | ✓ menu item is visible |
| 3 | Click **"Vacations"** in the top navbar | Browser navigates to `/vacation/my`, the My Vacations page renders with: a vacation balance widget showing `0` days (or default for fresh employee), an empty vacation list, no error dialog | ❌ A modal opens with title **"Error"** and body **"Something went wrong"** with single OK button. The vacation balance widget is missing/blank behind the dialog. |
| 4 | Click "OK" to dismiss the dialog | (n/a — no dialog after fix) | Dialog closes; vacation balance widget still missing |
| 5 | Refresh page (F5) | Page loads cleanly | Error dialog reappears every time |
| 6 | Open browser DevTools Network tab → filter `vacationdays` → reload | Request to `/api/vacation/v1/vacationdays/achernishov/years` returns **HTTP 400** with body containing `"Employee login not found"` (matching sibling endpoints) | Request returns **HTTP 500** with body containing `"NullPointerException"` and Java stack trace |
| 7 | Open DevTools Network tab → check the response body for the failing request | Body is a small JSON validation error, no Java types | Body is large JSON containing `"trace": "java.lang.NullPointerException: Cannot invoke ... EmployeeBO.getId() ... EmployeeDaysServiceImpl.java:204 ..."` |

### Cleanup (mandatory)

8. **Restore the row** in `ttt_vacation.employee` from the scratchpad captured in Setup step 1:
   ```sql
   INSERT INTO ttt_vacation.employee (id, login, ...) VALUES (...);
   -- Plus any cascade-deleted child rows
   ```

9. **Verify restoration** by repeating Setup step 3 — both should be 1 again.

10. **Re-enable** the vacation employee sync scheduler (Setup step P5).

11. As a final sanity check, hit the same endpoint again — it should now return HTTP 200:
    ```bash
    curl -sk --noproxy '*' -H "API_SECRET_TOKEN: <token>" \
      "https://ttt-qa-1.noveogroup.com/api/vacation/v1/vacationdays/achernishov/years"
    # Expect: HTTP 200, JSON array of {year, days}
    ```

### Acceptance criteria for the fix

The test passes when **all** of the following are true after applying the suggested fix:

- [ ] Step 3: NO error dialog appears; the My Vacations page renders normally
- [ ] Step 6: Backend returns HTTP **400** (not 500) with `"Employee login not found"` message
- [ ] Step 7: Response body contains **no** `"NullPointerException"`, **no** internal package names, **no** source line numbers
- [ ] Sanity step 11: valid login still returns HTTP 200 with the same payload structure as before

---

## 4. Severity downgrade — revised assessment

| Criterion | Original (wrong) | Revised |
|-----------|------------------|---------|
| User impact | "27 contractors broken" | None today on qa-1; affects only race-window users. **0 affected users currently.** |
| Frequency | "Every contractor login" | Transient race during onboarding sync gap; rare. |
| Workaround for user | "None — must contact IT" | Same — but population approaches zero. |
| Detectability | "High — reproducible" | Same when triggered, but trigger is rare. |
| Security risk (info disclosure) | Medium | Medium — **unchanged**. The 500 still leaks Java stack traces, regardless of how it's triggered. CWE-209 still applies. |
| Code quality | "Critical regression" | **Still a regression** — the validator was missed when this endpoint was added; sibling endpoints all have it. |

**Net severity:** downgraded from HIGH to **MEDIUM** for runtime impact, but the **fix priority remains the same** because:

1. The fix is a one-line annotation
2. The bug surfaces immediately for any future onboarding race or rename glitch
3. The information disclosure (CWE-209) is independent of trigger frequency

---

## 5. Suggested fix (unchanged)

`vacation/rest/.../VacationDaysController.java:152` — add the validator that all sibling endpoints already have:

```java
@GetMapping("/{login}/years")
public List<EmployeeDaysDTO> getVacationDaysGroupedByYears(
    @PathVariable("login") @EmployeeLoginExists final String login) { ... }
```

---

## 6. Lower-effort regression guard for CI

Even though the live qa-1 surface is small, an API-level Playwright test is the cheapest way to prevent the regression from coming back. It needs no SSO password and no DB mutation:

```typescript
// autotests/tests/regress/sprint15-vacation-days-years-validator.spec.ts
import { test, expect, request } from '@playwright/test';

test('@regress @bug Vacation /vacationdays/{login}/years rejects unknown login with 4xx (not 500 NPE)', async () => {
  const ctx = await request.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { API_SECRET_TOKEN: process.env.TTT_API_TOKEN! },
  });
  const res = await ctx.get(
    'https://ttt-qa-1.noveogroup.com/api/vacation/v1/vacationdays/notexistuser/years'
  );

  expect.soft(res.status(), 'must not be 500').not.toBe(500);
  expect.soft([400, 404]).toContain(res.status());

  const body = await res.text();
  expect.soft(body, 'must not leak NPE').not.toContain('NullPointerException');
  expect.soft(body, 'must use validator format').toContain('Employee login not found');
});
```

This is the recommended automation for this finding — it would have caught the bug at code review and remains valid as a permanent regression guard.

---

## 7. Lessons learned

- When a backend endpoint surfaces a bug for arbitrary input, do not assume that natural UI flows will reach it. Frontend menu visibility and route guards often filter the affected user population to zero.
- Permission systems in TTT are layered: backend permission provider → frontend menu config → frontend route guard. Verify all three layers before claiming "X users are affected".
- For TC-SA-NPE-002 specifically, the bug is real and worth fixing, but its blast radius is small. The fix priority is justified by code quality and information disclosure, not by user pain.

---

## 8. Related artifacts

- **Sister test case:** `docs/regression/sprint15-bug-npe-vacation-days-years-ui-test.md` (TC-SA-NPE-001 — DevTools-based, no DB setup)
- **Sanity test report:** `docs/regression/sprint15-qa1-sanity-test.md` (Phase 3, Finding 3.A — to be updated with this revised severity)
- **Static analysis:** `docs/regression/sprint15-static-analysis.md`
- **Backend file:** `vacation/rest/.../VacationDaysController.java:152`
- **Backend file:** `vacation/service/.../EmployeeDaysServiceImpl.java:204`
- **Frontend file:** `vacation/containers/myVacation/UserVacationsPageContainer/index.js`
- **Permission provider:** `ttt/service/.../permission/clazz/VacationPermissionProvider.java`
- **Route guard:** `frontend/.../common/components/permissions/PrivateRoute.js`
