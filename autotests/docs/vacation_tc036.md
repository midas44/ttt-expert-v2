# TC-VAC-036: Update non-existing vacation ID

**Suite:** TS-Vac-Update | **Priority:** Medium | **Type:** API

## Description
Verifies that attempting to update a vacation with a non-existent ID returns a proper error response. The `VacationRepository.findById()` returns empty, causing `EntityNotFoundException` which maps to HTTP 404.

## Steps
1. PUT /api/vacation/v1/vacations/999999999 with valid vacation body
2. Verify response: HTTP 404 with "not.found" error code
3. Accept HTTP 400 as alternative (some implementations validate before lookup)

## Data
- **Static:** pvaynmaster, vacation ID 999999999 (non-existent), 2028-11-06 to 2028-11-10
- **Dynamic:** Same static data (no DB needed)
