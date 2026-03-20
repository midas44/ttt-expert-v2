# TC-VAC-062: Change approver with invalid login

## Description

Negative test verifying that attempting to change a vacation's approver to a nonexistent employee login is properly rejected.

### Steps

1. **Create vacation** — `POST /api/vacation/v1/vacations` (NEW status)
2. **Change approver to invalid login** — `PUT /api/vacation/v1/vacations/pass/{id}` with `login: "nonexistent_xyz_99999"`
3. **Verify rejection** — Expect HTTP 400/404 with error info
4. **Verify vacation unchanged** — `GET /api/vacation/v1/vacations/{id}` confirms status still NEW

### Data

- **User**: pvaynmaster
- **Invalid approver**: `nonexistent_xyz_99999` (does not exist in employee table)
- **Expected error**: Validation error for non-existent employee login
- Cleanup: DELETE vacation after test
