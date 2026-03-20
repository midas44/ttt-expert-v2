# TC-VAC-067: Change approver preserves optional approver list

**Type:** API | **Priority:** Medium | **Suite:** TS-Vac-Approval

## Description

Verifies that when the primary approver is changed via PUT /vacations/pass/{id},
existing optional approvers are preserved and the old primary approver is added
as a new optional approver with ASKED status.

## Steps

1. Create vacation with 2 optional approvers (A, B)
2. Verify initial approval records in DB (primary + A + B = 3 records)
3. PUT /pass/{id} with new approver login C
4. Verify in DB: C is new primary, A and B still in approvals with ASKED status,
   old primary added as optional with ASKED status

## Data

- REGULAR 5-day vacation for pvaynmaster
- 2 same-office colleagues as optional approvers
- 3rd colleague as new primary approver
- Week offset 209+ for conflict avoidance
