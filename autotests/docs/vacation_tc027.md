# TC-VAC-027: Update APPROVED vacation dates resets status to NEW

**Suite:** TS-Vac-StatusFlow | **Priority:** High | **Type:** API

## Description
Verifies that updating the dates of an APPROVED vacation automatically resets its status back to NEW. This is a multi-step workflow: create a vacation, approve it, then update its dates to a different range. The system should reset the status to NEW because the approval was for the original dates, not the new ones.

## Steps
1. POST /api/vacation/v1/vacations — create vacation with first date range (status=NEW)
2. PUT /api/vacation/v1/vacations/approve/{id} — approve vacation (status=APPROVED)
3. PUT /api/vacation/v1/vacations/{id} — update vacation dates to second date range
4. Verify response: status=NEW (reset from APPROVED)
5. GET /api/vacation/v1/vacations/{id} — confirm persistence: status=NEW, dates match second range
6. Cleanup: DELETE /api/vacation/v1/vacations/{id}

## Data
- **Data class:** VacationTc027Data (dynamic, two week ranges with offsets 57 and 60)
- **First date range:** Mon-Fri at week offset 57
- **Second date range:** Mon-Fri at week offset 60
- **Spec:** vacation-tc027.spec.ts
