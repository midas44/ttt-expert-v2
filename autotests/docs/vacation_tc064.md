# TC-VAC-064: Delete vacation — optional approvals NOT cascaded (orphan bug)

## Description
Verifies that soft-deleting a vacation (status→DELETED) does NOT cascade to the `vacation_approval` table, leaving orphan approval records. This is a known data integrity issue — cosmetic severity.

## Steps
1. Create vacation with 2 optional approvers
2. Verify approval records exist in DB before delete
3. Delete the vacation (soft delete → DELETED)
4. Verify vacation status is DELETED
5. Check approval records after delete — BUG: they persist as orphans

## Data
- Login: pvaynmaster
- Week offset: 200+ (dynamic)
- Optional approvers: same-office colleagues (dynamic lookup)
- Cleanup: vacation is already DELETED after the test
