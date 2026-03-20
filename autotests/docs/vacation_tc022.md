# TC-VAC-022: Create vacation with notifyAlso list

## Description
Verifies that creating a vacation with a `notifyAlso` list of valid colleague logins succeeds. The `notifyAlso` field populates the `vacation_notify_also` table and triggers email notifications to the specified recipients.

## Steps
1. POST `/api/vacation/v1/vacations` with `notifyAlso: ['colleague1', 'colleague2']` (valid logins)
2. Verify response: HTTP 200, status=NEW, vacation created
3. GET the vacation to confirm persistence and check notifyAlso in response

## Data
- **User:** pvaynmaster (CPO, self-approver)
- **notifyAlso:** 2 valid colleague logins (dynamically discovered via DB)
- **Dates:** Mon-Fri week at offset 120 (conflict-free)
- **Validation:** `@EmployeeLoginCollectionExists` on notifyAlso field

## Cleanup
Delete created vacation via DELETE endpoint.
