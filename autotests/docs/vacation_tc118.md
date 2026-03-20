# TC-VAC-118: NPE on null pagination — availability-schedule endpoints

**Suite:** TS-Vac-APIErrors | **Priority:** Critical | **Type:** API

## Description
Regression test for a known NPE bug: calling v1 or v2 availability-schedule endpoints without page/pageSize query params causes a NullPointerException at PageableRequestDTOToBOConverter.java:33-34. Both endpoints are affected.

## Steps
1. GET /api/vacation/v1/availability-schedule?officeId=N (no page/pageSize) → expect HTTP 500
2. GET /api/vacation/v2/availability-schedule?officeId=N (no page/pageSize) → expect HTTP 500
3. GET /api/vacation/v1/availability-schedule?officeId=N&page=0&pageSize=20 → expect HTTP 200 (workaround)

## Data
- **Static:** officeId=1
- **Dynamic:** Random valid office ID from DB
