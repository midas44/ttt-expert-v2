# TC-VAC-120: Invalid date format — stack trace / info leakage

## Description
Verifies that sending an invalid date format (month=13) to the payment dates endpoint results in HTTP 400 with exposed internal Java class names in the response. This is an information disclosure vulnerability — Spring exception class names and conversion error details are visible in the response body.

## Steps
1. GET `/api/vacation/v1/paymentdates?vacationStartDate=2026-13-01&vacationEndDate=2026-04-01`
2. Verify HTTP 400 status code
3. Verify `exception` field contains full Java class name (e.g. `MethodArgumentTypeMismatchException`)
4. Verify `message` field exposes conversion/parse error details

## Data
- Endpoint: `/api/vacation/v1/paymentdates` with invalid date params
- Auth: `API_SECRET_TOKEN` header
- Invalid date: month=13 (2026-13-01)
