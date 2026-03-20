# TC-VAC-091: Pay already PAID vacation — double payment guard

## Description
Verifies that attempting to pay an already-PAID vacation is blocked. The PAID state is terminal — no further status changes are allowed, including duplicate payments.

## Steps
1. POST create REGULAR vacation (status: NEW)
2. PUT approve (status: APPROVED)
3. PUT pay with correct day split (status: PAID)
4. PUT pay again with same body — expect 400
5. Verify error code indicates status not allowed
6. GET verify vacation is still PAID

## Data
- Login: pvaynmaster (dynamic)
- Dates: Mon-Fri week at offset 182 (conflict-free)
- Payment type: REGULAR
- Pay body: { regularDaysPayed: N, administrativeDaysPayed: 0 }
- NOTE: Creates permanent PAID record (cannot be deleted)
