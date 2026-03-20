---
test_id: TC-VAC-024
module: vacation
title: Create vacation with comment
type: API
priority: Low
---

# TC-VAC-024: Create vacation with comment

## Description
Verify that creating a vacation with a comment field populates the comment correctly in the response and persists it in the database. The comment field in AbstractVacationRequestDTO has no @Size annotation, so no length limit is enforced at the DTO level.

## Steps
1. POST /api/vacation/v1/vacations with comment = "Family trip to the mountains"
2. Verify create response contains the comment field with the exact value
3. GET /api/vacation/v1/vacations/{id} to confirm comment persists

## Expected Result
- HTTP 200 on create
- Vacation created with status NEW
- Comment field populated with exact input string in both POST response and GET response

## Data
- Login: pvaynmaster (API_SECRET_TOKEN user)
- Payment type: REGULAR
- Dates: Mon-Fri 5-day span (dynamic conflict-free window)
- Comment: "Family trip to the mountains"
