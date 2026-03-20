# TC-VAC-008: Create ADMINISTRATIVE vacation = 1 day

## Description
Tests creating an ADMINISTRATIVE (unpaid) vacation of exactly 1 calendar day (startDate = endDate on a working day). ADMINISTRATIVE type skips available days validation entirely and has a minimum of 1 working day.

## Steps
1. POST create ADMINISTRATIVE vacation with startDate = endDate (single working day)
2. Verify HTTP 200, status=NEW, days=1, paymentType=ADMINISTRATIVE

## Test Data
- Login: pvaynmaster
- Dates: single working day at week offset 75
- paymentType: ADMINISTRATIVE

## Expected Result
- Vacation created, days=1, status=NEW, paymentType=ADMINISTRATIVE
- No available days consumed (ADMINISTRATIVE is unpaid)
