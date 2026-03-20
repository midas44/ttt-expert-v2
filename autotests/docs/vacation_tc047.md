# TC-VAC-047: APPROVED to REJECTED (approver rejects after approval)

**Suite:** TS-Vac-StatusFlow | **Priority:** High | **Type:** API

## Description
Verifies the APPROVED to REJECTED status transition: after a vacation has been approved, the approver can still reject it. Confirms that pvaynmaster has the PM/DM role required to perform the reject transition. Multi-step workflow: create, approve, then reject.

## Steps
1. POST /api/vacation/v1/vacations — create vacation (status=NEW)
2. PUT /api/vacation/v1/vacations/approve/{id} — approve vacation (status=APPROVED)
3. PUT /api/vacation/v1/vacations/reject/{id} — reject the approved vacation
4. Verify response: status=REJECTED
5. GET /api/vacation/v1/vacations/{id} — confirm persistence: status=REJECTED
6. Cleanup: DELETE /api/vacation/v1/vacations/{id}

## Data
- **Data class:** VacationTc047Data (dynamic, week offset 63)
- **Employee/Approver:** pvaynmaster (has PM/DM role needed for reject transition)
- **Date range:** Mon-Fri at week offset 63
- **Spec:** vacation-tc047.spec.ts
