# TC-VAC-015: Create with null optionalApprovers — NPE bug (CPO path)

**Suite:** TS-Vac-Create | **Priority:** High | **Type:** API | **Tags:** known-bug

## Description
Verifies the known NPE bug when a CPO (ROLE_DEPARTMENT_MANAGER) employee creates a vacation with null optionalApprovers. The CPO code path at `VacationServiceImpl:155` calls `request.getOptionalApprovers().add(manager.getLogin())` which throws NullPointerException when the list is null. The DTO has no `@NotNull` annotation on the optionalApprovers field.

## Steps
1. POST /api/vacation/v1/vacations as CPO employee (abogdanova), omitting optionalApprovers field
2. Verify response: HTTP 500 (NPE bug) or 400 (if bug fixed) or 200 (non-CPO path)
3. If 500: verify NullPointerException in response
4. If 200: cleanup created vacation

## Data
- **Static:** abogdanova (ROLE_DEPARTMENT_MANAGER, manager=pvaynmaster), 2028-09-04 to 2028-09-08
- **Dynamic:** Random CPO employee with manager via `findCpoEmployee()` DB query
