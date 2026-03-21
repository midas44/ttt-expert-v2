## TC-VAC-037: Update vacation — approver edits (EDIT_APPROVER permission)

**Type:** API (Functional)
**Suite:** TS-Vac-Update
**Priority:** Medium

### Description

Verifies that the vacation approver can update a vacation via the EDIT_APPROVER permission. The permission is granted when `isApprover && !NON_EDITABLE_STATUSES` (NON_EDITABLE = CANCELED, PAID). pvaynmaster as DM is both owner and approver (self-approver), so both EDIT and EDIT_APPROVER paths are active. The test covers update in NEW status and update after APPROVED (which resets to NEW).

### Steps

1. **API:** POST create vacation — pvaynmaster auto-assigned as approver
2. **Verify:** approver login matches owner login (self-approver)
3. **API:** PUT update with new dates + comment — verify 200, dates changed, status stays NEW
4. **API:** PUT approve the vacation
5. **API:** PUT update with original dates — verify 200, status resets from APPROVED → NEW
6. **API:** GET verify persisted changes
7. **Cleanup:** DELETE vacation

### Data

- **Login:** pvaynmaster (DM, self-approver)
- **Original dates:** offset 269 (Mon-Fri)
- **Updated dates:** offset 272 (Mon-Fri)
- **Permission path:** EDIT_APPROVER (isApprover + not CANCELED/PAID)
- **Vault ref:** modules/vacation-service-deep-dive § Permission Calculation
