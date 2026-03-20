# TC-VAC-004: Create vacation with start date in past

## Description
Verifies that the backend rejects vacation creation when startDate is in the past. The VacationCreateValidator checks `request.getStartDate().isBefore(today)` — strictly past dates are rejected, today is accepted. Error code: `validation.vacation.start.date.in.past`.

## Steps
1. POST /api/vacation/v1/vacations — startDate = yesterday, endDate = next week
2. Verify HTTP 400 with errorCode `validation.vacation.start.date.in.past`

## Test Data
- Login: pvaynmaster (API_SECRET_TOKEN auth)
- startDate: computed as yesterday (always in the past)
- endDate: computed as today + 7 days (valid future date)
- No cleanup needed — creation is rejected
