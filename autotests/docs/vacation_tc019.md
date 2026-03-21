## TC-VAC-019: Regular employee auto-approver assignment

**Type:** API + DB
**Suite:** TS-Vac-Create
**Priority:** High

### Description

Verifies the standard approver assignment path for regular employees (non-CPO/DM). When a regular employee with a manager creates a vacation, the system sets `vacation.approverId = employee.getManager().getId()` — the manager becomes the primary approver. No optional approvers are auto-added (unlike the CPO path where the manager is added as optional).

### Steps

1. **Find** a suitable regular employee via DB: non-DM, has a manager, enabled
2. **Record** employee ID, manager ID, and manager login for assertions
3. **Create** vacation for the regular employee via POST with API_SECRET_TOKEN
4. **Verify** response: `approver.login == managerLogin` (not self-approval)
5. **Verify** DB: no records in `vacation_approval` table (no optional approvers auto-added)
6. **Verify** vacation status is NEW
7. **Cleanup** — DELETE the created vacation

### Data

- **Login:** Dynamically selected non-DM employee from DB
- **Manager:** Dynamically resolved from `ttt_vacation.employee.manager` FK
- **Dates:** Future Mon-Fri week (offset 254)
- **Role exclusion:** `ROLE_DEPARTMENT_MANAGER` excluded via `ttt_backend.employee_global_roles`
