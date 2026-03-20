---
test_id: TC-VAC-025
module: vacation
title: Create vacation with very long comment (no length limit)
type: API
priority: Low
---

# TC-VAC-025: Create vacation with very long comment (no length limit)

## Description
Boundary test: POST vacation with a 5000-character comment string. The AbstractVacationRequestDTO has no @Size annotation on the comment field, so no length limit is enforced at the DTO validation level. The actual limit depends on the DB column type (VARCHAR(n) or TEXT).

## Steps
1. POST /api/vacation/v1/vacations with a 5000-character comment
2. Verify response — expect 200 if DB accepts, or error if column limit exceeded
3. GET to confirm comment persisted and check actual stored length

## Expected Result
- If DB column is TEXT/unlimited: HTTP 200, full 5000-char comment stored
- If DB column has length limit: either truncation or error
- Test documents actual behavior for both scenarios

## Data
- Login: pvaynmaster (API_SECRET_TOKEN user)
- Payment type: REGULAR
- Dates: Mon-Fri 5-day span (dynamic conflict-free window)
- Comment: 5000-char repeated string
