---
test_id: TC-VAC-050
module: vacation
title: "PAID -> any transition (terminal -- blocked)"
type: API
priority: High
suite: TS-Vac-StatusFlow
---

# TC-VAC-050: PAID Terminal State — All Transitions Blocked

## Description
Verifies that PAID is a truly terminal state with no outgoing transitions in the VacationStatusManager map. Once a vacation reaches PAID status, no further state changes are possible — approve, reject, cancel, and delete must all fail.

## Steps
1. Create a REGULAR vacation (status = NEW)
2. Approve the vacation (NEW -> APPROVED)
3. Pay the vacation with correct day split (APPROVED -> PAID)
4. Attempt to APPROVE the PAID vacation — expect HTTP 400
5. Attempt to REJECT the PAID vacation — expect HTTP 400
6. Attempt to CANCEL the PAID vacation — expect HTTP 400
7. Attempt to DELETE the PAID vacation — expect HTTP 400
8. GET vacation to confirm status is still PAID

## Data
- **User**: `pvaynmaster` (self-approver)
- **Dates**: Dynamic Mon-Fri window (offset 164)
- **Payment**: REGULAR, all regularDays paid, 0 administrative

## Key Assertions
- All 4 transition attempts return HTTP 400 (or 403)
- Error code contains `notAllowed`
- Final GET confirms status remains PAID unchanged
- PAID vacations cannot be deleted (cleanup is best-effort)
