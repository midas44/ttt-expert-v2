# TC-VAC-014: Create with null paymentMonth — NPE bug

## Description
Tests that creating a REGULAR vacation without the `paymentMonth` field exposes a known NPE bug. The DTO `AbstractVacationRequestDTO` has no `@NotNull` annotation on `paymentMonth`, so when the field is omitted, `correctPaymentMonth()` or `VacationAvailablePaidDaysCalculatorImpl.paymentDate.getYear()` throws a `NullPointerException`.

## Steps
1. POST `/api/vacation/v1/vacations` with REGULAR type body, `paymentMonth` omitted
2. Verify response is HTTP 500 (known NPE) or HTTP 400 (if bug fixed)

## Test Data
- Login: pvaynmaster
- Dates: far-future Mon-Fri to avoid crossing conflicts
- paymentMonth: intentionally absent from request body

## Expected Result
- **Current (bug):** HTTP 500 NullPointerException
- **After fix:** HTTP 400 with validation error on paymentMonth field
