# TC-VAC-082: Available days endpoint — newDays=0 (main page mode)

## Description
Verifies the vacation available days calculation endpoint in "main page mode" (newDays=0), which triggers the binary search algorithm to calculate maximum safe vacation duration.

## Steps
1. GET /api/vacation/v1/vacationdays/available?employeeLogin=pvaynmaster&paymentDate=2029-01-01&newDays=0
2. Verify HTTP 200 response
3. Verify response contains `availablePaidDays` (number >= 0)
4. Verify `daysNotEnough` field is an array (if present)

## Data
- Employee: pvaynmaster
- Payment date: 2029-01-01 (far future)
- newDays: 0 (triggers binary search / main page mode)
- Auth: API_SECRET_TOKEN
