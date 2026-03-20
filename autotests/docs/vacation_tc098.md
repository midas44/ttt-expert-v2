# TC-VAC-098: Payment dates with start > end — accepted (bug)

## Description
Verifies that the payment dates endpoint (`GET /api/vacation/v1/paymentdates`) accepts an inverted date range where `vacationStartDate > vacationEndDate`. This is a known bug — the endpoint should reject inverted ranges with HTTP 400 but instead returns valid results (HTTP 200).

## Steps
1. Call payment dates endpoint with a normal (valid) date range as baseline
2. Call payment dates endpoint with inverted range (start > end)
3. Compare responses — both return 200 with date arrays (BUG)

## Data
- Normal range: 2027-06-01 to 2027-06-10
- Inverted range: 2027-06-10 to 2027-06-01
- Read-only test — no vacation creation needed
