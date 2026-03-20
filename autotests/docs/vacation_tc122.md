# TC-VAC-122: Missing required fields — validation errors with field details

## Description
Verifies that posting a vacation create request with missing required fields (only `login` provided) returns HTTP 400 with a structured `errors` array containing per-field violations. The `MethodArgumentNotValidException` handler produces an errors array where each entry has `field`, `code`, and `message` properties.

## Steps
1. POST `/api/vacation/v1/vacations` with body: `{login: "pvaynmaster"}` (missing startDate, endDate, paymentType)
2. Verify HTTP 400 status code
3. Verify response contains `errors` array
4. Verify array has entries for each missing required field: startDate, endDate, paymentType
5. Verify each error has NotNull violation code

## Data
- Endpoint: `/api/vacation/v1/vacations`
- Auth: `API_SECRET_TOKEN` header
- Body: only `login` field, all required fields omitted
- Expected missing: startDate, endDate, paymentType (all @NotNull)
