---
test_id: TC-VAC-051
module: vacation
title: "DELETED -> any transition (terminal -- blocked)"
type: API
priority: Medium
suite: TS-Vac-StatusFlow
---

# TC-VAC-051: DELETED Terminal State — All Transitions Blocked

## Description
Verifies that DELETED is a terminal soft-delete state. The DELETE endpoint sets status to DELETED directly (bypassing VacationStatusManager). DELETED has no entries in the transition map — all subsequent operations must fail.

## Steps
1. Create a REGULAR vacation (status = NEW)
2. DELETE the vacation (sets status to DELETED via soft-delete)
3. Attempt to UPDATE the DELETED vacation — expect error
4. Attempt to APPROVE the DELETED vacation — expect error
5. Attempt to DELETE again — expect error

## Data
- **User**: `pvaynmaster` (self-approver)
- **Dates**: Dynamic Mon-Fri window (offset 167)

## Key Assertions
- Steps 3-5 all return HTTP 400/403/404/500
- DELETED vacation is not accessible via normal list queries
- No cleanup needed — vacation is already soft-deleted
