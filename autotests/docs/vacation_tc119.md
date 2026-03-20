# TC-VAC-119: Malformed JSON request body — empty 400 response

## Description
Verifies that sending malformed (unparseable) JSON to the vacation create endpoint returns HTTP 400 with an empty response body. The `HttpMessageNotReadableException` handler in `RestErrorHandler` returns `ResponseEntity<Void>` — no error details, no errorCode, no message. The client gets 400 but no actionable error information.

## Steps
1. POST `/api/vacation/v1/vacations` with body: `{invalid json, "broken": }`
2. Verify HTTP 400 status code
3. Verify response body is empty (no JSON error structure)

## Data
- Endpoint: `/api/vacation/v1/vacations`
- Auth: `API_SECRET_TOKEN` header
- Body: malformed JSON string (not valid JSON)
