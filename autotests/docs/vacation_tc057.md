---
test_id: TC-VAC-057
module: vacation
title: "Add optional approvers on creation"
type: API
priority: High
suite: TS-Vac-Approval
---

# TC-VAC-057: Add Optional Approvers on Creation

## Description
Verifies that creating a vacation with an optionalApprovers array creates corresponding vacation_approval records in the database. Each optional approver gets a record with status = ASKED. Optional approvals are informational and don't drive the main vacation status.

## Steps
1. POST create vacation with optionalApprovers array (2 colleague logins)
2. Verify API response returns successfully (status 200)
3. Query DB: SELECT from vacation_approval WHERE vacation = created_id
4. Verify each approval record has status = ASKED and correct employee login
5. GET vacation to confirm it's in proper state

## Data
- **User**: `pvaynmaster` (self-approver, vacation owner)
- **Optional Approvers**: Dynamically discovered from same-office colleagues (fallback: any active employee)
- **Dates**: Dynamic Mon-Fri window (offset 173)

## Key Assertions
- Vacation created successfully with status NEW
- vacation_approval table has one record per optional approver
- All approval records have status = ASKED
- Each record links correct employee via FK
