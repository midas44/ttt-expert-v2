# TC-VAC-121: Non-existent vacation ID — 404 response

## Description
Verifies that requesting a vacation with a non-existent ID returns a proper 404 error response with clean error structure (no stack trace exposure).

## Steps
1. GET /api/vacation/v1/vacations/999999999
2. Verify HTTP 404 (or 400) response
3. Verify error response contains errorCode/error field
4. Verify no stack trace is exposed in the response

## Data
- Non-existent vacation ID: 999999999
- Auth: API_SECRET_TOKEN
