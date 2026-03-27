

## Test Cleanup: Soft-Delete vs Hard-Delete (Session 70)

**CRITICAL for autotest reliability:**

| Endpoint | Effect | Use case |
|----------|--------|----------|
| `DELETE /v1/vacations/{id}` | Soft-delete: sets `status=DELETED`, row stays in DB | Normal app flow |
| `DELETE /v1/test/vacations/{id}` | Hard-delete: removes row from DB completely | Test cleanup |

**Impact on autotests:** Soft-deleted vacations (status=DELETED) appear on the All tab and pollute future test runs. They can cause false matches when `vacationRow()` pattern matches a DELETED row instead of the intended test vacation.

**Fix applied in Session 70:** Changed `ApiVacationSetupFixture.deleteVacation()` to use the test endpoint (`/v1/test/vacations/{id}`) for hard-delete, ensuring clean state between test runs.

**Vacation balance depletion:** Leftover NEW/APPROVED/PAID vacations consume the employee's vacation day balance. If pvaynmaster has too many leftover test vacations, future `POST /v1/vacations` calls fail with `validation.vacation.duration`. Fix: hard-delete leftovers via test endpoint, then recalculate via `POST /v1/test/employees/{id}/vacations/recalculate`.
