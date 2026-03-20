# TC-VAC-123: Type mismatch — string for numeric field

## Description
Verifies that sending a string value where a numeric ID is expected returns HTTP 400 with errorCode `exception.type.mismatch`. The `MethodArgumentTypeMismatchException` global handler catches type conversion failures and returns a structured error response indicating the expected type.

## Steps
1. GET `/api/vacation/v1/vacations/abc` (string where numeric vacationId expected)
2. Verify HTTP 400 status code
3. Verify errorCode contains `type.mismatch`
4. Verify message indicates expected type (Long/numeric)

## Data
- Endpoint: `/api/vacation/v1/vacations/abc`
- Auth: `API_SECRET_TOKEN` header
- Invalid ID: "abc" (string, should be numeric Long)
