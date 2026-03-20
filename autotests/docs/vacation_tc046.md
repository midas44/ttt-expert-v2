# TC-VAC-046: APPROVED → CANCELED blocked by canBeCancelled guard

## Description
Verifies the canBeCancelled accounting guard: a REGULAR APPROVED vacation with paymentMonth before the office report period cannot be cancelled. This protects accounting integrity after period close.

## Steps
1. Query office report period for office 20 (Персей)
2. POST create REGULAR vacation with paymentMonth set before report period
3. PUT approve (status: APPROVED)
4. PUT cancel — expect blocked (400/403)
5. GET verify still APPROVED

## Guard Logic
```
canBeCancelled = false when:
  paymentType == REGULAR
  AND status == APPROVED
  AND reportPeriod.isAfter(paymentDate)
```

## Data
- Login: pvaynmaster (office 20, Персей)
- Dates: near-future (offset ~3 weeks)
- Payment month: 1 month before report period start
- Report period start: queried from ttt_backend.office_period

## Skip Conditions
- If API rejects creation due to paymentMonth validation → test.skip
- If API_SECRET_TOKEN bypasses the permission guard → test.skip with finding documented
