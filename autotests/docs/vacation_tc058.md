---
test_id: TC-VAC-058
module: vacation
title: "Optional approver approves (ASKED -> APPROVED)"
type: API
priority: Medium
suite: TS-Vac-Approval
---

# TC-VAC-058: Optional Approver Approves (ASKED -> APPROVED)

## Description
Verifies that an optional approver can update their approval status from ASKED to APPROVED via the PATCH optional-approval endpoint. The main vacation status must remain unchanged since optional approvals are informational only.

## Steps
1. Create vacation with one optional approver
2. Query DB for vacation_approval record (confirm status = ASKED)
3. PATCH /api/vacation/v1/optional-approval/{vacationId} with status = APPROVED
4. Query DB again — approval status should be APPROVED
5. GET vacation — main status should still be NEW (unchanged)

## Data
- **User**: `pvaynmaster` (vacation owner)
- **Optional Approver**: Dynamically discovered same-office colleague
- **Dates**: Dynamic Mon-Fri window (offset 176)

## Key Assertions
- Optional approval status transitions from ASKED to APPROVED
- Main vacation status remains NEW (optional approval is informational)
- vacation_approval record updated correctly in DB
