---
type: reference
tags:
  - auth
  - api
  - roles
  - qa-1
updated: '2026-04-04'
---

## API Authentication & Roles — Quick Reference

### API_SECRET_TOKEN Owner: pvaynmaster

The `API_SECRET_TOKEN` configured in `config/ttt/envs/qa-1.yml` authenticates as **pvaynmaster** on qa-1. This user has **ALL major roles**:

| Role | Granted |
|------|---------|
| ROLE_ADMIN | YES |
| ROLE_ACCOUNTANT | YES |
| ROLE_CHIEF_OFFICER | YES |
| ROLE_DEPARTMENT_MANAGER | YES |
| ROLE_EMPLOYEE | YES |
| ROLE_OFFICE_HR | YES |
| ROLE_PROJECT_MANAGER | YES |

**pvaynmaster is NOT limited to ROLE_EMPLOYEE.** Any 403 errors when using API_SECRET_TOKEN are caused by wrong endpoint/method/body, NOT by missing roles.

### Finding Users by Role

```sql
SELECT e.login, egr.role_name
FROM ttt_backend.employee e
JOIN ttt_backend.employee_global_roles egr ON e.id = egr.employee
WHERE egr.role_name = '<ROLE_NAME>' AND e.enabled = true
ORDER BY e.login;
```

Table: `ttt_backend.employee_global_roles` (columns: `employee` FK, `role_name` text).

There are 8 ROLE_ADMIN users on qa-1 (as of 2026-04-04).

### Auth Methods for Tests

| Method | How | When to use |
|--------|-----|-------------|
| API_SECRET_TOKEN | Header `API_SECRET_TOKEN: <token>` | Endpoints with `@PreAuthorize("hasAuthority('CALENDAR_EDIT')")` etc. — provides `ApiPermission` authorities |
| JWT via CAS login | Login via browser, extract from `localStorage['id_token']`, send as `TTT_JWT_TOKEN` header | Endpoints requiring `AUTHENTICATED_USER` (e.g., period PATCH) |
| Browser login | LoginFixture via UI | UI tests, any user context |

### JWT Auth Pattern for Autotests

Some endpoints require `AUTHENTICATED_USER` authority, which only JWT auth provides. The `API_SECRET_TOKEN` grants `ApiPermission` values (like `CALENDAR_EDIT`, `OFFICES_VIEW`) but NOT `AUTHENTICATED_USER`.

**Endpoints requiring JWT (AUTHENTICATED_USER only):**
- `PATCH /v1/offices/{id}/periods/approve`
- `PATCH /v1/offices/{id}/periods/report`
- Other admin write endpoints without `ApiPermission` fallback

**Pattern:**
```typescript
// Use { page, request } fixtures
const login = new LoginFixture(page, tttConfig);
await login.run();
const jwt = await page.evaluate(() => localStorage.getItem("id_token"));
const headers = { TTT_JWT_TOKEN: jwt, "Content-Type": "application/json" };
// Then use standalone `request` fixture with JWT headers
await request.patch(tttConfig.buildUrl("/api/ttt/v1/..."), { headers, data: {...} });
```

**Autotest Token Permissions (qa-1, id=62447):**
ASSIGNMENTS_ALL, ASSIGNMENTS_VIEW, CALENDAR_EDIT, CALENDAR_VIEW, EMPLOYEES_VIEW, OFFICES_VIEW, PROJECTS_ALL, REPORTS_APPROVE, REPORTS_EDIT, REPORTS_VIEW, STATISTICS_VIEW, SUGGESTIONS_VIEW, TASKS_EDIT, VACATIONS_APPROVE, VACATIONS_CREATE, VACATIONS_DELETE, VACATIONS_EDIT, VACATIONS_PAY, VACATIONS_VIEW, VACATION_DAYS_EDIT, VACATION_DAYS_VIEW.
No `OFFICES_EDIT` or `EMPLOYEES_EDIT` exist in the `ApiPermission` Java enum.

### Common 403 Debugging

If API_SECRET_TOKEN returns 403, check:
1. **Endpoint requires AUTHENTICATED_USER** — use JWT auth pattern instead
2. **Endpoint URL** — is it the correct path?
3. **HTTP method** — POST vs PUT vs PATCH
4. **Request body field names** — e.g., DTO uses `start` not `startDate` for period PATCH
5. **Content-Type** — must be `application/json`
6. **NOT the role** — pvaynmaster has all roles (ROLE_ADMIN + 6 others)

See also: [[security-patterns]], [[auth-authorization-doc]]
