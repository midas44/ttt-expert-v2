# TC-VAC-020: Create vacation — employee without manager (self-approval)

**Type:** API | **Priority:** Medium | **Suite:** TS-Vac-Create

## Description

Verifies that a DEPARTMENT_MANAGER (pvaynmaster) auto-assigns themselves as approver
when creating a vacation. This is the self-approval fallback path — when the employee
is a manager or has no manager, they approve their own vacations.

## Steps

1. Create vacation via POST (standard valid body)
2. Verify API response has approver = creator login (self-approval)
3. Verify in DB: vacation.approver = vacation.employee (same person)
4. Verify self-approval works: PUT /approve/{id} succeeds, status → APPROVED

## Data

- REGULAR 5-day vacation for pvaynmaster (DEPARTMENT_MANAGER)
- Week offset 218+ for conflict avoidance
- Cleanup: cancel → delete after test
