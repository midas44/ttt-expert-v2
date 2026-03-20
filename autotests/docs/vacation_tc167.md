## TC-VAC-167: API /v1/vacationdays/available returns correct availablePaidDays for AV=true

Verify the available vacation days endpoint returns correct values and responds to state changes.

### Steps
1. GET /v1/vacationdays/available with employeeLogin, newDays=0, usePaymentDateFilter=true
2. Cross-verify with DB employee_vacation balances
3. Test newDays=10 simulation — should reduce availablePaidDays by ~10
4. Test usePaymentDateFilter=false — compare results
5. Create a 5-day vacation
6. Re-check available days — should decrease by ~5, then cleanup

### Data
- Dynamic: conflict-free Mon-Fri week at offset 227
- pvaynmaster (AV=true office Персей, office_id=20)
