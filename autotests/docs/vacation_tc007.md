# TC-VAC-007: Create REGULAR vacation = 5 calendar days (boundary)

## Description
Tests creating a REGULAR vacation spanning exactly Mon-Fri (5 calendar days = 5 working days). This is a boundary test at the commonly expected minimum duration. Note: actual `minimalVacationDuration` config is 1 (not 5), so this is above the threshold and should succeed.

## Steps
1. POST create REGULAR vacation with Mon-Fri dates
2. Verify HTTP 200, status=NEW, days=5

## Test Data
- Login: pvaynmaster
- Dates: Mon-Fri at week offset 72
- paymentType: REGULAR

## Expected Result
- Vacation created successfully, days=5, status=NEW
- Approver auto-assigned (pvaynmaster is self-approver)
