# TC-VAC-063: Edit dates resets all optional approvals to ASKED

## Description
Verifies that when an APPROVED vacation's dates are updated, all optional approvals are reset to ASKED status. The main vacation status also resets from APPROVED to NEW, requiring re-approval.

## Steps
1. Create vacation with 2 optional approvers
2. Approve the vacation (transitions to APPROVED)
3. Check optional approval statuses in DB before edit
4. Update vacation dates (shift 1 week forward)
5. Verify main status reset to NEW
6. Verify all optional approvals reset to ASKED in DB

## Data
- Login: pvaynmaster
- Week offset: 203+ (needs two non-overlapping weeks: original + updated)
- Optional approvers: same-office colleagues (dynamic lookup)
- Update body requires `id` field (discovered in session 85)
- Cleanup: delete (should be in NEW status after edit)
