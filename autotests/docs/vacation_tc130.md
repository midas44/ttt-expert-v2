# TC-VAC-130: Vacation list with filters (type, status, date range)

**Suite:** TS-Vac-APIErrors | **Priority:** Medium | **Type:** API

## Description
Read-only API test verifying that the v2 availability-schedule endpoint correctly handles list filtering with type, sort, date range, and pagination parameters. Tests all three type filter values (MY, ALL, APPROVER) and validates response structure.

**Key discovery:** The v2 endpoint uses `totalCount` (not `totalElements` like v1), and requires `from`/`to` date parameters — omitting them causes a NullPointerException (NPE). This test confirms the working parameter combinations.

## Steps
1. GET /api/vacation/v2/availability-schedule with type=MY, page=0, pageSize=20, from/to date range, sort=startDate,asc
2. Verify response: HTTP 200, response contains `totalCount` field, `content` array present
3. GET /api/vacation/v2/availability-schedule with type=ALL, same pagination and date params
4. Verify response: HTTP 200, `totalCount` >= MY count (ALL includes all employees)
5. GET /api/vacation/v2/availability-schedule with type=APPROVER, same pagination and date params
6. Verify response: HTTP 200, valid structure with `totalCount` and `content`

## Data
- **Data class:** VacationTc130Data (static, no DB needed)
- **Date range:** current year span (e.g., 2026-01-01 to 2026-12-31)
- **Pagination:** page=0, pageSize=20
- **Sort:** startDate,asc
- **Type filters tested:** MY, ALL, APPROVER
- **Spec:** vacation-tc130.spec.ts
