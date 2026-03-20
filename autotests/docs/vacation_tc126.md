# TC-VAC-126: Sick leave crossing vacation — 409 CONFLICT

## Description
Verifies that creating a sick leave with dates overlapping an existing vacation returns HTTP 409 CONFLICT (SickLeaveCrossingVacationException). This is the only exception in the vacation module that maps to 409 — all other crossing/validation errors return 400. The `force` flag can override this check; this test uses `force=false`.

## Steps
1. Create an ADMINISTRATIVE vacation (Mon-Fri) to establish date range
2. POST `/api/vacation/v1/sick-leaves` with overlapping dates (Wed-Thu within vacation range) and `force=false`
3. Verify HTTP 409 CONFLICT status code
4. Verify errorCode contains `sick.leave.crossing.vacation`
5. Cleanup: delete the created vacation

## Data
- Vacation: ADMINISTRATIVE, Mon-Fri at offset 221
- Sick leave: Wed-Thu within the vacation range
- Auth: `API_SECRET_TOKEN` header
- force: false (do not override crossing check)
