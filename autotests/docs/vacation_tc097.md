# TC-VAC-097: Payment dates endpoint — valid range

## Description

Verifies that the payment dates endpoint (`GET /api/vacation/v1/paymentdates`) returns a correct set of 1st-of-month dates for a given vacation date range.

### Steps

1. **GET payment dates** — Call endpoint with `vacationStartDate=2027-04-01` and `vacationEndDate=2027-04-10`
2. **Verify format** — All returned dates must be `YYYY-MM-01` (1st of month)
3. **Verify continuity** — Dates must be consecutive months with no gaps
4. **Verify range** — Returned range must include the vacation start month

### Data

- **Endpoint**: `GET /api/vacation/v1/paymentdates?vacationStartDate=X&vacationEndDate=Y`
- **Auth**: API_SECRET_TOKEN header
- **Expected range**: ~(vacStart - 2mo) to ~(vacEnd + 6mo), bounded by report period
- Read-only test — no vacation created or modified
