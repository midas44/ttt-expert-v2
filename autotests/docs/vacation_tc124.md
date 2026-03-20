# TC-VAC-124: Exception class leakage in all error responses

## Description
Verifies that the `exception` field in error responses contains the full Java class name, exposing internal package structure (e.g. `com.noveogroup.ttt.common.exception.ServiceException`). This is a security issue — every error response from `RestErrorHandler` leaks implementation details through the `exception` field.

## Steps
1. POST `/api/vacation/v1/vacations` with past dates (triggers `validation.vacation.start.date.in.past`)
2. Verify HTTP 400 status code
3. Verify `exception` field contains full dotted Java class name
4. Verify internal package path is visible (com.noveogroup.ttt or org.springframework)
5. Verify standard error response fields are present (error, status, path, timestamp)

## Data
- Endpoint: `/api/vacation/v1/vacations`
- Auth: `API_SECRET_TOKEN` header
- Body: vacation with dates in 2020 (past)
