# TC-VAC-016: Create with non-existent employee login

**Suite:** TS-Vac-Create | **Priority:** Medium | **Type:** API

## Description
Verifies that creating a vacation with a non-existent employee login is rejected by the `@EmployeeLoginExists` custom constraint validator on the DTO's login field. The validator checks that the login corresponds to an existing employee in the system.

## Steps
1. POST /api/vacation/v1/vacations with login = "nonexistent_user_xyz_98765"
2. Verify response: HTTP 400 with validation error referencing the login field
3. Verify error contains EmployeeLoginExists constraint violation

## Data
- **Static:** nonexistent_user_xyz_98765 (guaranteed non-existent), 2028-10-02 to 2028-10-06
- **Dynamic:** Same static data (no DB needed for non-existent login)
