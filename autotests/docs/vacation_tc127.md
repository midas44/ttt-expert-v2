## TC-VAC-127: Empty request body — 400 response

Verify that POST with empty body returns HTTP 400 with empty response body.

### Steps
1. POST with Content-Type: application/json and empty string body
2. Verify 400 status and empty body (HttpMessageNotReadableException → ResponseEntity<Void>)
3. POST with Content-Type but no body at all — same behavior

### Data
- No request body data needed — tests empty/missing body handling
