# TC-VAC-023: Create vacation with invalid notifyAlso login

## Description
Negative test: attempts to create a vacation with a `notifyAlso` list containing a non-existent employee login. The `@EmployeeLoginCollectionExists` DTO validator should reject the request before the vacation is created.

## Steps
1. POST `/api/vacation/v1/vacations` with `notifyAlso: ['nonexistent_user_xyz_999']`
2. Verify response: HTTP 400 with validation error

## Data
- **User:** pvaynmaster
- **notifyAlso:** `['nonexistent_user_xyz_999']` (invalid login)
- **Dates:** Static far-future dates (vacation should not be created)

## Expected Error
- HTTP 400
- `@EmployeeLoginCollectionExists` validation failure
- No vacation created — no cleanup needed
