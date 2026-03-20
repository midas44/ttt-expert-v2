# TC-VAC-009: Create with insufficient available days (AV=false)

**Suite:** TS-Vac-Create | **Priority:** High | **Type:** API

## Description
Verifies that creating a REGULAR vacation is rejected when the requested duration exceeds the employee's accrued vacation days in an AV=false (non-advance-vacation) office. AV=false offices use monthly accrual formula: `accruedDays = paymentMonth * (normDays / 12)`. A 3-year span (~777 working days) definitively exceeds any possible accrued balance.

## Steps
1. POST /api/vacation/v1/vacations with REGULAR type, 3-year date span (2028-08-07 to 2031-07-25) for an AV=false employee
2. Verify response: HTTP 400 with errorCode containing "validation.vacation.duration"
3. Verify error references startDate or endDate field
4. Cleanup: delete vacation if unexpectedly created

## Data
- **Static:** slebedev (AV=false office), 2028-08-07 to 2031-07-25
- **Dynamic:** Random employee from AV=false office via `findEmployeeAvFalse()` DB query
