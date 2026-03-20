---
session: 99
phase: autotest_generation
updated: '2026-03-20'
---
# Session 99 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-20
**Phase:** Autotest Generation (vacation scope)
**Tests generated:** 5 verified (TC-125, TC-127, TC-128, TC-065, TC-167)

## What was done

Generated and verified 5 vacation API tests on qa-1:

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-125 | ServiceException vs ValidationException format difference | API | TS-Vac-APIErrors | PASS |
| TC-VAC-127 | Empty request body — 400 response | API | TS-Vac-APIErrors | PASS |
| TC-VAC-128 | Very large vacation — 365 day boundary | API | TS-Vac-APIErrors | PASS |
| TC-VAC-065 | Notify-also with required flag behavior | API | TS-Vac-Approval | PASS |
| TC-VAC-167 | availablePaidDays API returns correct values for AV=true | API | TS-VAC-AVMultiYear | PASS |

TC-096 (payment date adjustment on approval) was deferred — requires approve period > report period gap which doesn't exist on qa-1 (both are 2026-03-01 for all offices).

## Key Discoveries

1. **Past date validation is ConstraintViolation, not ServiceException** — `@VacationCreateRequest` validator fires as `MethodArgumentNotValidException` with `errorCode: "exception.validation"` + errors[]. Same format as missing @NotNull fields.

2. **Approve/{nonExistentId} returns ConstraintViolationException** — `@VacationIdExistsValidator` on the path variable triggers `javax.validation.ConstraintViolationException` (not ServiceException). The response has `errorCode: "exception.validation"` with `errors[{field: "vacationId", code: "VacationIdExistsValidator"}]`.

3. **Real ServiceException requires service-layer failure** — only triggers when validation passes but business logic rejects (e.g., double-approve returns `VacationSecurityException` 403). The key structural difference: application exceptions have NO errors[] array; validation exceptions HAVE errors[] array with field-level details.

4. **vacation_notify_also columns**: `vacation` (not vacation_id), `approver` (not approver_id), `required` (boolean, default false). All user-submitted notifyAlso entries get `required=false` because `listRequired()` is a no-op.

5. **availablePaidDays endpoint requires paymentDate** — `GET /v1/vacationdays/available` needs `employeeLogin`, `newDays`, `paymentDate`, `usePaymentDateFilter`. The `newDays` parameter doesn't subtract — it simulates planned consumption for daysNotEnough calculation.

6. **No approve > report period gap on qa-1** — all offices have APPROVE and REPORT periods set to the same date (2026-03-01). This blocks TC-096 (payment date auto-adjustment on approval).

7. **365-day REGULAR vacation rejected** — insufficient days (pvaynmaster has ~125 days total). Error response provides error information. ADMINISTRATIVE type behavior for large vacations was also documented.

## Coverage

- **Vacation automated:** 79/173 (45.7%)
- **Total automated:** 79/1071 (7.4%)
- **Skipped:** 5 (TC-VAC-031, TC-VAC-058, TC-VAC-046, TC-VAC-099, TC-VAC-126)

## Week Offsets Used

- TC-125: offset 221 (create → approve → double-approve for ServiceException)
- TC-065: offset 224 (create with notifyAlso)
- TC-167: offset 227 (create 5-day vacation to verify balance decrease)
- TC-127, TC-128: no offsets (error tests, no vacation creation)

## Next Session Candidates

- **TC-096**: Deferred — needs approve period advancement or different environment
- **TS-Vac-APIErrors complete**: All 8 test cases in suite now automated (TC-119, 120, 122, 123, 124, 125, 127, 128)
- **JWT investigation**: Still needed for permission-based tests (15 pending in TS-Vac-Permissions)
- **TS-Vac-Approval remaining**: TC-065 done this session, TC-067/068 blocked by pass NPE
- **TS-VAC-AVMultiYear**: TC-167 done, TC-164 (FIFO cross-year) and TC-165 (edit redistribution) remain
- **Begin UI test generation**: At 45.7%, well past threshold
