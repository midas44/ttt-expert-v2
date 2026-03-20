# TC-VAC-092: Pay NEW vacation — wrong status

**Suite:** TS-Vac-Payment
**Priority:** Medium
**Type:** API Negative

## Description

Tests that attempting to pay a vacation in NEW status (not yet approved) is rejected. The `PayVacationServiceImpl` validates that the vacation must be APPROVED+EXACT before payment. Expects HTTP 400.

## Steps

1. **Create** REGULAR vacation (status=NEW, do NOT approve)
2. **Pay** via PUT /pay/{id} with valid day split
3. **Verify** HTTP 400 — pay requires APPROVED status
4. **Verify** vacation remains NEW

## Data

- **User:** pvaynmaster
- **Dates:** Dynamic (offset 160+ weeks)
- **Cleanup:** Delete directly (vacation is still NEW)
