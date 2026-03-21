# TC-VAC-018: CPO auto-approver self-assignment on vacation create

## Description
Verifies that when a CPO/DM (DEPARTMENT_MANAGER, isCPO=true) with a manager creates a vacation, the system automatically assigns the employee as their own approver (self-approval) and adds their manager as an optional approver with status ASKED.

## Steps
1. Query DB for employee ID and manager ID (pvaynmaster + ilnitsky)
2. POST /api/vacation/v1/vacations to create vacation as CPO
3. Verify API response: approver.login = pvaynmaster (self-approval)
4. Verify DB: vacation_approval has manager (ilnitsky) with status=ASKED, required=false
5. Verify vacation status is NEW

## Data
- **Login**: pvaynmaster (DEPARTMENT_MANAGER, isCPO=true)
- **Manager**: ilnitsky (dynamically resolved from DB)
- **Week offset**: 248 (conflict-free future week)
- **Payment type**: REGULAR

## Logic (VacationServiceImpl.createVacation)
```java
if (employee.getManager() != null && isCPO) {
    vacation.setApproverId(employee.getId());  // Self-approve
    request.getOptionalApprovers().add(employee.getManager().getLogin()); // Manager as optional
}
```
