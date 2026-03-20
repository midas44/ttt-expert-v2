# TC-VAC-038: Update payment month to closed accounting period

**Type:** API | **Priority:** Medium | **Suite:** TS-Vac-Update

## Description

Verifies that updating a vacation's paymentMonth to a closed (past) accounting period is rejected
with a `validation.vacation.dates.payment` error. The `isPaymentDateCorrect` validator checks
that paymentMonth falls within the valid range relative to the report period and vacation dates.

## Steps

1. Create vacation with valid future paymentMonth (NEW status)
2. PUT update with paymentMonth set to a closed period (e.g., 2025-01-01)
3. Verify 400 response with validation.vacation.dates.payment error
4. Verify vacation is unchanged (still NEW, original paymentMonth preserved)

## Data

- REGULAR 5-day vacation for pvaynmaster
- Closed payment month derived from report period - 2 months
- Week offset 215+ for conflict avoidance
