---
type: module
tags:
  - vacation
  - backend
  - deep-dive
  - code-level
  - validators
  - permissions
  - error-handling
  - state-machine
created: '2026-03-15'
updated: '2026-03-15'
status: active
related:
  - '[[analysis/vacation-business-rules-reference]]'
  - '[[modules/vacation-service-implementation]]'
  - '[[analysis/vacation-form-validation-rules]]'
  - '[[exploration/api-findings/vacation-crud-api-testing]]'
branch: release/2.1
---
# Vacation Service Deep Dive — Code-Level Reference

Comprehensive code-level reference for the vacation service module. Contains exact code snippets, error codes, validation rules, permission logic, and API response formats needed for test case generation.

## 1. State Machine Implementation (VacationStatusManager)

The state machine is implemented as a static transition map in `VacationStatusManager`:

```java
// VacationStatusManager.java — static initializer block
static {
    // NEW → ...
    add(NEW, NEW, ROLE_EMPLOYEE);          // Self-update
    add(NEW, CANCELED, ROLE_EMPLOYEE);     // Employee cancels
    add(NEW, REJECTED, ROLE_PROJECT_MANAGER, ROLE_DEPARTMENT_MANAGER, ROLE_ADMIN);
    add(NEW, APPROVED, ROLE_PROJECT_MANAGER, ROLE_DEPARTMENT_MANAGER, ROLE_ADMIN);

    // REJECTED → ...
    add(REJECTED, APPROVED, ROLE_PROJECT_MANAGER, ROLE_DEPARTMENT_MANAGER, ROLE_ADMIN);
    // NOTE: No REJECTED→NEW transition exists in code!
    // The business rules reference says "REJECTED → APPROVED (re-approval without edit)" is confirmed.

    // APPROVED → ...
    add(APPROVED, NEW, ROLE_EMPLOYEE);     // Employee edits dates → resets
    add(APPROVED, CANCELED, ROLE_EMPLOYEE);
    add(APPROVED, REJECTED, ROLE_PROJECT_MANAGER, ROLE_DEPARTMENT_MANAGER, ROLE_ADMIN);
    add(APPROVED, PAID, ROLE_ACCOUNTANT, ROLE_CHIEF_ACCOUNTANT, ROLE_ADMIN);

    // CANCELED → ...
    add(CANCELED, NEW, ROLE_EMPLOYEE);     // Re-open
}

// Terminal statuses (no outgoing transitions):
private static final Set<VacationStatusType> FINAL_STATUSES = Set.of(PAID, CANCELED);
// NOTE: CANCELED is in FINAL_STATUSES but has CANCELED→NEW transition!
// This means isNextStateAvailable() allows CANCELED→CANCELED (same status check bypasses
// FINAL_STATUSES for non-equal transitions) but CANCELED→NEW works via explicit map.
```

### Access Check Logic (`hasAccess`)

```java
public boolean hasAccess(EmployeeBO employee, VacationEntity request, VacationStatusType status) {
    if (employee == null || request == null) return false;

    // Owner check: ROLE_EMPLOYEE + owns the vacation
    if (employee.getRoles().contains(ROLE_EMPLOYEE)
        && request.getEmployeeId().equals(employee.getId())) {
        return true;
    }

    // Approver check: not PAID status AND not canceling, AND is manager role, AND is current approver
    if (request.getStatus() != PAID && status != CANCELED) {
        return employee.getRoles().stream().anyMatch(MANAGER_ROLES::contains)
               && Objects.equals(request.getApproverId(), employee.getId());
    }
    return false;
}
// MANAGER_ROLES = {ROLE_PROJECT_MANAGER, ROLE_DEPARTMENT_MANAGER, ROLE_CHIEF_ACCOUNTANT}
// NOTE: ROLE_CHIEF_ACCOUNTANT is in MANAGER_ROLES (not ACCOUNTANT_ROLES only!)
// BUG: ROLE_ADMIN is NOT in MANAGER_ROLES but IS in transition map → admin can transition
// but hasAccess() returns false for admin-as-approver → ServiceException thrown
```

### `isNextStateAvailable` Logic

```java
public boolean isNextStateAvailable(Collection<EmployeeGlobalRole> userRoles,
                                     VacationEntity request, VacationStatusType nextStatus) {
    VacationStatusType currentStatus = request.getStatus();
    // Same-status update: allowed unless current is a FINAL status (PAID, CANCELED)
    if (currentStatus.equals(nextStatus) && !FINAL_STATUSES.contains(currentStatus)) {
        return true;
    }
    // Check transition map
    List<EmployeeGlobalRole> allowedRoles = ALLOWED_TRANSITIONS.get(st(currentStatus, nextStatus));
    return allowedRoles != null && isContains(userRoles, allowedRoles);
}
// Edge case: CANCELED is FINAL but CANCELED→NEW transition IS in the map
// So isNextStateAvailable(CANCELED, NEW) checks the map → works if ROLE_EMPLOYEE
```

## 2. Vacation CRUD Orchestration (VacationServiceImpl)

### Create Flow

```java
public VacationBO createVacation(VacationCreateRequestBO request) {
    // 1. Class-level permission check
    classPermissionService.validate(PermissionVacationActionType.CREATE);

    // 2. Lookup employee
    EmployeeBO employee = employeeService.findByLogin(request.getLogin());

    // 3. Correct payment month (adjusts if needed)
    vacationCRUDService.correctPaymentMonth(request);

    // 4. Validate payment date
    if (!vacationCRUDService.isPaymentDateCorrect(request)) {
        throw new ServiceException(ErrorCode.of("validation.vacation.dates.payment"));
    }

    // 5. Check crossing vacations
    if (!vacationCRUDService.findCrossingVacations(employee.getId(), startDate, endDate).isEmpty()) {
        throw new ValidationException("startDate", "exception.validation.vacation.dates.crossing");
    }

    // 6. Determine approver (CPO vs regular vs no-manager)
    if (employee.getManager() != null && isCPO) {
        vacation.setApproverId(employee.getId());  // Self-approve
        request.getOptionalApprovers().add(employee.getManager().getLogin()); // Manager as optional
    } else if (employee.getManager() != null) {
        vacation.setApproverId(employee.getManager().getId()); // Manager approves
    } else {
        vacation.setApproverId(employee.getId()); // Self-approve (no manager)
    }

    // 7. Save, calculate days, recalculate, sync approvers, publish event
    savedVacation = vacationRepository.save(vacation);
    VacationState vacationState = vacationStateFactory.create(savedVacation);
    savedVacation.setDays(vacationState.getVacationDays().getTotal().intValue());
    vacationRecalculationService.recalculate(employee.getId(), null, false);
    synchronizeOptionalApprovals(savedVacation, request.getOptionalApprovers());
    synchronizeNotifyAlso(savedVacation, request.getNotifyAlso());
    eventPublisher.publishEvent(new VacationCreatedEvent(savedVacationBO));
}
```

### Approve Flow

```java
public VacationBO approveVacation(Long vacationId) {
    VacationEntity entity = vacationRepository.findByIdAndAcquireWriteLock(vacationId);
    VacationBO vacation = convert(entity);

    // 1. Permission check (validates current user is approver with APPROVE permission)
    permissionService.validate(vacation, PermissionType.APPROVE);

    // 2. Status transition check
    checkVacation(entity, APPROVED, true); // true = check for crossing

    // 3. Payment date adjustment
    EmployeeBO employee = employeeService.findById(entity.getEmployeeId());
    LocalDate approvePeriodStartDate = tttClient.getApprovePeriod(employee.getOfficeId()).getStart();
    LocalDate paymentDate = vacationCRUDService.getPaymentDate(entity);
    if (paymentDate.isBefore(approvePeriodStartDate)) {
        entity.setPaymentDate(approvePeriodStartDate.with(TemporalAdjusters.firstDayOfMonth()));
    }

    // 4. Status update + recalculation
    entity.setStatus(APPROVED);
    vacationRecalculationService.recalculate(employee.getId(), null, false);
    eventPublisher.publishEvent(new VacationStatusChangedEvent(updatedVacation, previousStatus));
}
```

### Delete Flow — Critical Guard

```java
private void deleteVacation(VacationEntity vacation) {
    // GUARD: Cannot delete PAID + EXACT vacations
    if (vacation.getStatus().equals(PAID)
        && vacation.getPeriodType() == VacationPeriodType.EXACT) {
        throw new ServiceException(ErrorCode.of("exception.vacation.delete.notAllowed"));
    }
    vacationRecalculationService.recalculate(vacation.getEmployeeId(), vacation.getId(), false);
    vacation.setStatus(VacationStatusType.DELETED);
    vacationRepository.save(vacation);
}
// NOTE: PAID + NON-EXACT can be deleted! (This is a design issue — PAID should be terminal)
```

### checkVacation — Combined Pre-check for Status Changes

```java
public void checkVacation(VacationEntity entity, VacationStatusType status, boolean checkForCrossing) {
    EmployeeBO employee = employeeService.getCurrent();

    // 1. ReadOnly check
    if (employee.isReadOnly()) throw new VacationSecurityException();

    // 2. Access check (owner or approver)
    if (!statusManager.hasAccess(employee, entity, status))
        throw new ServiceException(ErrorCode.of("exception.vacation.status.notAllowed"));

    // 3. State transition check
    if (!statusManager.isNextStateAvailable(employee.getRoles(), entity, status))
        throw new ServiceException(ErrorCode.of("exception.vacation.status.notAllowed"));

    // 4. Crossing check (only for approve)
    if (checkForCrossing && !vacationCRUDService.findCrossingVacations(...).isEmpty())
        throw new ValidationException("startDate", "exception.validation.vacation.dates.crossing");
}
```

## 3. Permission Service Logic (VacationPermissionService)

### Permission Calculation

```java
// Status sets controlling permission availability:
APPROVABLE_STATUSES = {NEW, REJECTED}
REJECTABLE_STATUSES = {NEW, APPROVED}
NON_EDITABLE_STATUSES = {CANCELED, PAID}

private Set<PermissionType> calculate(VacationBO vacation, EmployeeBO currentEmployee) {
    // GUARD: readOnly users or non-ROLE_EMPLOYEE → no permissions
    if (currentEmployee.isReadOnly()
        || !currentEmployee.getRoles().contains(ROLE_EMPLOYEE)) {
        return Collections.emptySet();
    }

    boolean isApprover = Objects.equals(currentEmployee, vacation.getApprover());
    boolean isOwner = vacation.getEmployee().getId().equals(currentEmployee.getId());

    // APPROVER permissions:
    if (isApprover) {
        if (!NON_EDITABLE_STATUSES.contains(status))  → EDIT_APPROVER
        if (APPROVABLE_STATUSES.contains(status))      → APPROVE
        if (REJECTABLE_STATUSES.contains(status) && canBeCancelled) → REJECT
    }

    // OWNER permissions (status != PAID):
    if (isOwner && status != PAID) {
        if (canBeCancelled) → DELETE, CANCEL (unless CANCELED)
        → EDIT (always, if not PAID)
    }
}

// canBeCancelled guard:
private boolean canBeCancelled(VacationBO vacation, LocalDate reportPeriod) {
    return vacation.getPaymentType() != REGULAR
           || vacation.getStatus() != APPROVED
           || !reportPeriod.isAfter(vacation.getPaymentDate());
}
// This means: REGULAR + APPROVED + reportPeriod after paymentDate → CANNOT cancel/reject/delete
// This protects against canceling vacations after the accounting period has closed.
```

### Permission Types Used

| Permission | Who Gets It | When |
|---|---|---|
| EDIT_APPROVER | Approver | Status not CANCELED/PAID |
| APPROVE | Approver | Status is NEW or REJECTED |
| REJECT | Approver | Status is NEW or APPROVED, canBeCancelled=true |
| DELETE | Owner | Status not PAID, canBeCancelled=true |
| CANCEL | Owner | Status not PAID/CANCELED, canBeCancelled=true |
| EDIT | Owner | Status not PAID (always) |

## 4. Validation Rules — Complete Error Code Catalog

### VacationCreateValidator Error Codes

| Error Code | Condition | Fields |
|---|---|---|
| `validation.vacation.start.date.in.past` | startDate < today | startDate |
| `validation.vacation.dates.order` | startDate > endDate | startDate, endDate |
| `validation.vacation.next.year.not.available` | startDate.year > today.year AND today < Feb 1 | startDate |
| `validation.vacation.duration` | REGULAR type AND (thisYear + nextYear < minimalVacationDuration OR availablePaidDays < total) | startDate, endDate |
| `exception.validation.vacation.too.early` | Vacation days under limitation date exceed limit | startDate, endDate |

### VacationUpdateValidator — Differences from Create

```java
// Key difference: CANCELED or REJECTED vacations + ADMINISTRATIVE type skip day limit checks
if (VacationPaymentType.ADMINISTRATIVE.equals(entity.getPaymentType())
    || VacationStatusType.CANCELED.equals(entity.getStatus())
    || VacationStatusType.REJECTED.equals(entity.getStatus())) {
    // Uses raw daysLimitations from employee (original limits)
} else {
    // Adjusts limitations: adds back the current vacation's consumed days
    // This allows editing within the same day budget
}
// NOTE: Update validator does NOT call isNextVacationAvailable()
// → Next year check only applies to create, not update!
```

### Service-Level Error Codes (VacationServiceImpl)

| Error Code | Condition | HTTP Status |
|---|---|---|
| `validation.vacation.dates.payment` | Payment date invalid (correctPaymentMonth + isPaymentDateCorrect) | 400 |
| `exception.validation.vacation.dates.crossing` | Overlapping vacation exists | 400 (ValidationException) |
| `exception.vacation.status.notAllowed` | No access or invalid transition | 400 (ServiceException) |
| `exception.vacation.delete.notAllowed` | Delete PAID+EXACT, or changeApprover to self | 400 |
| `exception.vacation.no.permission` | VacationSecurityException | 403 |

### DTO-Level Validation Annotations

```java
// AbstractVacationRequestDTO
login:            @NotNull @EmployeeLoginExists @CurrentUser(groups=CreateGroup.class)
startDate:        @NotNull
endDate:          @NotNull
paymentType:      @NotNull (VacationPaymentTypeDTO enum)
paymentMonth:     (NO ANNOTATIONS — NPE if null when REGULAR type!)
comment:          (optional)
notifyAlso:       @EmployeeLoginCollectionExists (can be null)
optionalApprovers: @EmployeeLoginCollectionExists (can be null → NPE in synchronizeOptionalApprovals!)

// VacationUpdateRequestDTO extends AbstractVacationRequestDTO
id:               @Min(1) @NotNull

// VacationPaymentDTO (for pay endpoint)
payedAt:          @JsonFormat("yyyy-MM-dd") (optional)
regularDaysPayed:      @NotNull @Range(min=0, max=366)
administrativeDaysPayed: @NotNull @Range(min=0, max=366)
```

## 5. API Error Response Format

### Standard Error Response (ErrorResponse)

```json
{
    "error": "Bad Request",           // HTTP status reason phrase
    "status": 400,                    // HTTP status code
    "exception": "com.noveogroup.ttt.common.exception.ServiceException",
    "errorCode": "validation.vacation.dates.payment",
    "message": "Payment date is incorrect",
    "path": "/api/vacation/v1/vacations",
    "timestamp": "2026-03-15T10:30:00"
}
```

### Validation Error Response (extends ErrorResponse)

```json
{
    "error": "Bad Request",
    "status": 400,
    "errorCode": "exception.validation",
    "exception": "javax.validation.ConstraintViolationException",
    "message": "...",
    "path": "/api/vacation/v1/vacations",
    "timestamp": "...",
    "errors": [
        {
            "field": "startDate",
            "code": "validation.vacation.start.date.in.past",
            "message": "Start date is in the past"
        },
        {
            "field": "endDate",
            "code": "validation.vacation.dates.order",
            "message": "End date must be after start date"
        }
    ]
}
```

### Error Handler Exception Mapping

| Exception | HTTP Status | Error Code |
|---|---|---|
| ConstraintViolationException | 400 | Validator class name in `errors[].code` |
| MethodArgumentNotValidException | 400 | Message template in `errors[].code` |
| ValidationException | 400 | `exception.validation` + `errors[0].code` = field-level code |
| ServiceException | 400 | exception.getErrorCode() |
| VacationSecurityException | 403 | `exception.vacation.no.permission` |
| NotFoundException | 404 | exception.getErrorCode() |
| EntityNotFoundException | 404 | `exception.not.found` |
| SickLeaveCrossingVacationException | 409 (CONFLICT) | exception.getErrorCode() |
| IllegalArgumentException | 400 | `exception.illegal.argument` |
| HttpMessageNotReadableException | 400 | (empty body!) |
| MethodArgumentTypeMismatchException | 400 | `exception.type.mismatch` |
| FeignException | Proxied status | `exception.integration` (if deserialization fails) |

**CRITICAL NOTE:** `HttpMessageNotReadableException` returns **empty body** with 400 status!
This means sending malformed JSON gets no error details — just `ResponseEntity<Void>`.

**INFO DISCLOSURE:** `exception` field contains full Java class name (e.g., `com.noveogroup.ttt.common.exception.ServiceException`). This leaks internal implementation details.

## 6. Controller Endpoint Security Matrix

### VacationController (`/v1/vacations`)

| Method | Path | Permission | Custom Validators |
|---|---|---|---|
| GET | `/{vacationId}` | AUTHENTICATED_USER / VACATIONS_VIEW | @VacationIdExists |
| GET | (list) | AUTHENTICATED_USER / VACATIONS_VIEW | — |
| POST | (create) | AUTHENTICATED_USER / VACATIONS_CREATE | @Validated(CreateGroup) + @VacationCreateRequest |
| PUT | `/{vacationId}` | AUTHENTICATED_USER / VACATIONS_EDIT | @Validated(UpdateGroup) + @VacationUpdate |
| POST | `/{vacationId}/approve` | AUTHENTICATED_USER / VACATIONS_APPROVE | @VacationIdExists |
| PUT | `/{vacationId}/reject` | AUTHENTICATED_USER / VACATIONS_DELETE | — |
| PUT | `/{vacationId}/change-approver` | AUTHENTICATED_USER / VACATIONS_APPROVE | — |
| PUT | `/{vacationId}/cancel` | AUTHENTICATED_USER / VACATIONS_DELETE | — |
| PUT | `/{vacationId}/pay` | AUTHENTICATED_USER / VACATIONS_PAY | @Valid |
| DELETE | `/{vacationId}` | AUTHENTICATED_USER / VACATIONS_DELETE | @VacationIdExists |

**NOTE:** Reject uses `VACATIONS_DELETE` permission, not a dedicated REJECT permission.
**NOTE:** Cancel also uses `VACATIONS_DELETE` — same permission for reject, cancel, and delete.

## 7. Known NPE Vulnerabilities (from code analysis)

1. **`paymentMonth: null`** — VacationCreateRequestDTO has no @NotNull on paymentMonth. When REGULAR type, `correctPaymentMonth()` may NPE.
2. **`optionalApprovers: null`** — `synchronizeOptionalApprovals()` calls `optionalApproversLogins == null` → calls `deleteAll()`. But `request.getOptionalApprovers().add()` in CPO path will NPE if originally null.
3. **`pagination: null`** — Availability schedule endpoints accept nullable Pageable → NPE in repository.

## Related
- [[analysis/vacation-business-rules-reference]] — business rules summary
- [[modules/vacation-service-implementation]] — compressed overview
- [[analysis/vacation-form-validation-rules]] — frontend validation
- [[exploration/api-findings/vacation-crud-api-testing]] — API test results with bugs
- [[exploration/api-findings/payment-flow-live-testing]] — payment bug findings
- [[analysis/role-permission-matrix]] — cross-module permission matrix
- [[patterns/error-handling-agreement]] — error handling patterns


## Autotest Notes (Phase C Discoveries)

### minimalVacationDuration = 1 (not 5)
**Discovered**: Session 85, TC-VAC-006 initial failure.
The `vacationProperties.getMinimalVacationDuration()` is configured as **1** in `application.yml` (`vacation.minimal-vacation-duration: 1`). No per-environment overrides exist — all environments use 1. The Javadoc comment says "5" but the actual config is "1". The duration check compares **working days** (not calendar days) via `VacationDaysCalculatorImpl.calculateDays()` against this minimum. A Mon-Wed (3 working day) REGULAR vacation passes; only vacations with 0 working days (e.g., Sat-Sun) trigger `validation.vacation.duration`.

### Update endpoint requires `id` in request body
**Discovered**: Session 85, TC-VAC-044 initial failure.
`PUT /v1/vacations/{vacationId}` requires the vacation `id` field in the JSON request body in addition to the URL path parameter. Without it: `IllegalArgumentException: The given id must not be null!` (JPA `findById` called with null from DTO).

### Cancel endpoint: PUT /cancel/{id}
Confirmed working. Returns updated vacation with status=CANCELED. No request body needed.

### Delete endpoint: DELETE /{id}
Confirmed working. Soft delete — record persists with status=DELETED. GET still returns the record.


## Autotest Notes (Session 86)

### pvaynmaster Office Discovery
- pvaynmaster is in **Персей** office (office_id=20, advance_vacation=true)
- Annual norm: 24 days for 2026 and 2027
- Prior sessions labeled TC-001 as "AV=false" — incorrect. pvaynmaster was always AV=true.

### Crossing Check Includes DELETED Records
- The `exception.validation.vacation.dates.crossing` validation counts ALL vacation records regardless of status, including DELETED and CANCELED.
- Soft-deleted vacations create permanent "ghost" conflicts that block future creates at those dates.
- This is a design issue: DELETED should be excluded from crossing validation.
- Impact on testing: every test run that creates+deletes a vacation permanently blocks that date range.

### ADMINISTRATIVE Vacation Behavior
- paymentType=ADMINISTRATIVE creates an unpaid vacation
- Min duration check applies same as REGULAR (minimalVacationDuration=1 working day)
- No available days validation — ADMINISTRATIVE can be created regardless of balance
- Approver is still auto-assigned (same as REGULAR)

### AV=true Day Calculation
- GET /api/vacation/v1/vacationdays/available returns `availablePaidDays` for AV=true employees
- In March 2026, pvaynmaster shows availablePaidDays significantly above monthly prorated (3/12 * 24 = 6)
- Confirms full year balance available from Jan 1, not monthly accrual

### Batch Run Deadlocks
- Running multiple vacation create/approve/cancel tests back-to-back causes PostgreSQL deadlocks
- Root: `employee_vacation` table row contention during VacationRecalculationServiceImpl
- Each vacation create/cancel triggers FIFO redistribution which locks employee_vacation rows
- Error: `org.springframework.dao.CannotAcquireLockException: deadlock detected`
- Mitigation: run tests individually or with 2+ second gaps between them


## Autotest Notes (Session 88)

### Create/Update Response: regularDays/administrativeDays (not days)
**Discovered**: Session 88, TC-VAC-007/008 initial failure.
The vacation create/update API response does NOT include a `days` field. Instead it returns:
- `regularDays` (integer) — working days counted as paid leave
- `administrativeDays` (integer) — working days counted as unpaid leave
For a REGULAR vacation Mon-Fri: `regularDays: 5, administrativeDays: 0`
For an ADMINISTRATIVE 1-day: `regularDays: 0, administrativeDays: 1`
The internal `vacation.days` field (used in DB `vacation.days` column) is calculated server-side as `regularDays + administrativeDays` but is NOT exposed in the API response.

### pvaynmaster optionalApprovers Auto-Assignment
When pvaynmaster (CPO, self-approver) creates a vacation, the system automatically adds their manager `ilnitsky` as an optional approver with status=ASKED. This is the CPO auto-approver path from `VacationServiceImpl.createVacation()`.

### Week Offsets Used (2027-2028)
Previous (2027): 45, 48, 51, 54, 57, 60, 63
New (2027-2028): 66 (TC-026 original), 69 (TC-026 updated), 72 (TC-007), 75 (TC-008)

### Update Response for NEW Status
PUT update on a NEW vacation returns the same response format as create. Status remains "NEW", dates and regularDays are recalculated. No status reset occurs (already NEW).

### PAID Vacation Immutability Confirmed
PUT update on a PAID vacation returns HTTP 400. PAID is terminal — `NON_EDITABLE_STATUSES` set blocks all edits. Permission service returns empty set for PAID vacations. Even the vacation owner cannot modify.

### Null paymentMonth → HTTP 500 Confirmed
POST with paymentMonth omitted reliably returns HTTP 500 (NPE). The error response body varies — sometimes includes `exception: "java.lang.NullPointerException"`, sometimes a generic 500 with minimal detail. Bug still present on qa-1.


## Autotest Notes (Session 91)

### API_SECRET_TOKEN bypasses hasAccess() ownership checks
- Sending `login=otherUser` in PUT update body does NOT cause a 400.
- The API_SECRET_TOKEN authenticates as a privileged system user. `employeeService.getCurrent()` returns this system user, not the user from the `login` field.
- The system user passes `hasAccess()` for all vacations — likely has admin/system roles.
- **Impact:** Permission tests (TC-031 update by non-owner, TC-053 non-approver approve) cannot be automated via API_SECRET_TOKEN. Need CAS per-user authentication.
- The `login` field in create/update DTOs is purely data — it tells the server whose vacation to create/update, not who is performing the action.

### Crossing validation error format (update endpoint)
- `errorCode`: `exception.validation.fail` (generic, NOT the specific crossing code)
- `message`: `exception.validation.vacation.dates.crossing` (specific code is here)
- `errors[0].code`: `exception.validation.fail`
- `errors[0].message`: `exception.validation.vacation.dates.crossing`
- Pattern for assertions: always check both `errorCode` and `message`/`errors[].message`.

### Approve endpoint confirmed: PUT /approve/{id}
- All status transition endpoints follow `PUT /{action}/{vacationId}` pattern.
- Approve: `PUT /approve/{id}` (not POST, not `/{id}/approve`)
- Reject: `PUT /reject/{id}`
- Cancel: `PUT /cancel/{id}`
- Pay: `PUT /pay/{id}`

### notifyAlso field behavior
- Valid logins accepted (200), records stored in `vacation_notify_also` table.
- Invalid login rejected (400) by `@EmployeeLoginCollectionExists` DTO validator.
- GET /vacations/{id} response does NOT include notifyAlso — data is only in the DB table.
- Colleague logins can be found via: `SELECT login FROM ttt_backend.employee WHERE enabled=true AND login != ownerLogin`.


## Autotest Notes (Session 92)

### vacation_payment Table Schema (DB-Level Payment Verification)
**Discovered**: Session 92, TC-VAC-088 initial failures.
- `ttt_vacation.vacation_payment` columns: `id` (bigint PK), `regular_days` (int), `administrative_days` (int), `payed_at` (date)
- The FK is on the vacation table: `vacation.vacation_payment_id → vacation_payment.id`
- vacation_payment.id is auto-generated (values in 1.4M range), NOT equal to vacation.id (51K range)
- NOT a shared-PK pattern. The vacation table holds the FK, not vacation_payment.
- Correct query: `SELECT vp.regular_days, vp.administrative_days, vp.payed_at FROM ttt_vacation.vacation v JOIN ttt_vacation.vacation_payment vp ON v.vacation_payment_id = vp.id WHERE v.id = $1`

### Pay Endpoint Detailed Behavior
- PUT /v1/vacations/pay/{id} — body: `{regularDaysPayed: N, administrativeDaysPayed: M}`
- Validation: N + M must equal vacation.days (regularDays + administrativeDays)
- Wrong sum → 400, errorCode: `exception.vacation.pay.days.not.equal`
- Wrong status (not APPROVED) → 400 (PayVacationServiceImpl.checkForPayment validates APPROVED + EXACT)
- Success response wraps payment info: `{vacation: {..., status: "PAID"}, paymentDTO: {payedAt, regularDaysPayed, administrativeDaysPayed}}`
- ADMINISTRATIVE pay: regularDaysPayed=0, administrativeDaysPayed=N (no balance impact)

### PAID Terminal State Confirmed
- Cancel PAID → HTTP 400 (checkVacation → hasAccess returns false for PAID vacations)
- Delete PAID+EXACT → blocked by ServiceException("exception.vacation.delete.notAllowed")
- PAID vacations with EXACT periodType are permanent records in test environments
- Week offsets 144-160 used for payment tests (permanent PAID records at those dates)


## Autotest Notes (Session 98)

### API_SECRET_TOKEN Cannot Access Sick Leave Endpoint
**Discovered**: Session 98, TC-VAC-126 failure (403).
POST `/api/vacation/v1/sick-leaves` returns **403 Forbidden** with `AccessDeniedException` when authenticated via `API_SECRET_TOKEN`. The sick leave controller uses `@PreAuthorize("hasAuthority('AUTHENTICATED_USER')")` — the API_SECRET_TOKEN user lacks this authority. The vacation controller uses `hasAuthority('AUTHENTICATED_USER') || hasAuthority('VACATIONS_CREATE')` — the `||` allows the token through via `VACATIONS_CREATE`.

**Impact**: All tests requiring sick leave creation/modification via API are blocked with `API_SECRET_TOKEN`. This includes:
- TC-VAC-126 (sick leave crossing vacation — 409 CONFLICT)
- Any future cross-module tests involving sick leave + vacation interaction
- Needs per-user CAS JWT authentication to test sick leave endpoints.

### TS-Vac-APIErrors Suite Patterns Confirmed
Session 98 verified 5 error handling patterns:
- **HttpMessageNotReadableException** → HTTP 400 with completely **empty body** (no JSON, no error details)
- **MethodArgumentTypeMismatchException** → HTTP 400, errorCode: `exception.type.mismatch`, message includes expected type ("Long")
- **MethodArgumentNotValidException** → HTTP 400, errors[] array with per-field `{field, code, message}` objects, code contains "NotNull"
- **ServiceException** (past dates) → HTTP 400, `exception` field leaks full Java class name (`com.noveogroup.ttt.common.exception.ServiceException`)
- **Exception class leakage** is universal — every error response includes `exception` field with dotted package path

### Error Response Fields Confirmed
All error responses (except HttpMessageNotReadableException) include these standard fields:
- `error` (HTTP reason phrase, e.g., "Bad Request")
- `status` (HTTP code as integer)
- `exception` (full Java class name — security issue)
- `path` (request path)
- `timestamp` (ISO datetime)
- `errorCode` (application-specific error code)
- `message` (human-readable or error code string)
- `errors[]` (only for validation exceptions — per-field violations)


## Autotest Notes (Phase C discoveries)

### vacation_approval table schema
- Columns: `id`, `vacation`, `employee`, `status` — NO `required` column, NO `approver` column
- FK `employee` references the optional approver's employee ID (not named `approver`)
- Status values observed: `ASKED` (initial), presumably `APPROVED`/`REJECTED`
- The `required` attribute from `vacation_notify_also` does NOT exist here

### vacation-test API paths
- Test API paths follow `/v1/test/vacations/<action>` pattern (NOT `/test/<action>`)
- Example: `POST /api/vacation/v1/test/vacations/pay-expired-approved` (not `/api/vacation/test/pay-expired-approved`)
- Auth: same `API_SECRET_TOKEN` header as main API

### employee table: first_date (not first_day)
- Column is `first_date` (date type), not `first_day`
- Used by DaysLimitationService for 3-month employment restriction check

### pass endpoint still NPE (session 102, 2026-03-21)
- `PUT /v1/vacations/pass/{vacationId}` still returns 500 on qa-1
- Caffeine cache BoundedLocalCache.computeIfAbsent NPE persists
- Blocks TC-067 (change approver) and TC-068 (notification on approver change)


## Autotest Notes (Session 103)

### @CurrentUser DTO Validator Blocks Multi-User API Tests
**Discovered**: Session 103, TC-VAC-019 failure (400, `validation.notcurrentuser`).
`VacationCreateRequestDTO.login` has `@CurrentUser(groups=CreateGroup.class)` annotation. This validates that `request.getLogin()` matches `employeeService.getCurrent().getLogin()` at the DTO validation layer — BEFORE service logic runs. API_SECRET_TOKEN maps to pvaynmaster's identity, so only `login: "pvaynmaster"` passes this check.

**Impact on all "different user" tests:**
- TC-VAC-019 (regular employee auto-approver) — BLOCKED
- TC-VAC-017 (create as readOnly user) — BLOCKED  
- Any test requiring vacation creation for a non-pvaynmaster employee via API — BLOCKED
- The `@CurrentUser` annotation fires for `CreateGroup` only — update DTO uses `UpdateGroup` which may not have this check (unverified)
- This is a different blocker than `hasAccess()` bypass (session 91). `hasAccess()` is service-level; `@CurrentUser` is DTO-level.

**Resolution**: Per-user CAS authentication needed. The API_SECRET_TOKEN can only create/update vacations for the user it authenticates as (pvaynmaster).

### Week Offsets Used (Session 103)
- TC-169: offset 251
- TC-173: offset 257
- TC-137: offset 260
- TC-161: cross-year 2037-12-22 → 2038-01-09

### Cross-Year Vacation Dates Used
- TC-161: 2037-12-22 → 2038-01-09 (Dec→Jan cross-year)


## Autotest Notes (Session 23)

### employee_vacation Table (Correct Schema for Available Days)
- Table: `ttt_vacation.employee_vacation` (NOT `vacation_days`)
- Columns: `id` (PK), `employee` (FK bigint), `available_vacation_days` (numeric), `year` (int)
- FK column is `employee`, not `employee_id`
- Query for total available: `SELECT SUM(ev.available_vacation_days) FROM ttt_vacation.employee_vacation ev JOIN ttt_vacation.employee e ON e.id = ev.employee WHERE e.login = $1`

### Holiday Impact on Working Days Count
- Mon-Fri (5 calendar days) may yield 4 regularDays if one day is a public holiday in the office calendar
- The `VacationDaysCalculatorImpl.calculateDays()` uses the office-specific production calendar
- Assertions on regularDays for Mon-Fri windows should use `>= 4` not `== 5`

### Duration Validation: Real Minimum is 1, Not 5
- minimalVacationDuration=1 confirmed across all environments (qa-1, timemachine, stage)
- Test doc TC-VAC-006 says "< 5 days" but the actual trigger is 0 working days
- Only Sat-Sun (or holiday-only) ranges produce 0 working days → `validation.vacation.duration`
- A 3-day Mon-Wed vacation (3 working days) passes fine since 3 >= 1

### Insufficient Days Validation Order
- DTO-level `VacationCreateValidator` fires BEFORE service-level `findCrossingVacations`
- So `validation.vacation.duration` (insufficient balance) returns even if the dates would also conflict with ghost records
- This makes negative tests for insufficient days reliable regardless of date conflicts


## Autotest Notes (Session 24)

### Response wrapper structure
Create endpoint (`POST /api/vacation/v1/vacations`) returns a wrapper object:
```json
{
  "vacation": { "id": 51589, "employee": {...}, "approver": {...}, "status": "NEW", ... },
  "vacationDays": { "availableDays": 24, "reservedDays": 14, ... }
}
```
Access vacation ID via `response.vacation.id`, approver via `response.vacation.approver`.

### Error field inconsistency
- **Crossing validation**: `{code: "exception.validation.fail", message: "exception.validation.vacation.dates.crossing", field: "startDate"}` — actual error in `message`, not `code`
- **Other validators** (login, duration): error code directly in `code` field
- When matching errors in tests, always check BOTH `code` and `message` fields

### NPE bugs still active (qa-1, 2026-03-21)
- **paymentMonth null** → HTTP 500 (TC-014 confirmed)
- **optionalApprovers null on CPO path** → HTTP 500 (TC-015 confirmed)

### pvaynmaster identity (qa-1)
- Login: pvaynmaster, csId: 249
- Office: Персей (id: 20, AV=true)
- Role: ROLE_DEPARTMENT_MANAGER (CPO)
- Manager: ilnitsky (csId: 65)
- Self-approval: confirmed (approver = self, manager as optional with ASKED status)


## Autotest Notes (Session 26)

- **PUT update requires `id` in body** — `PUT /v1/vacations/{id}` expects `id` field in the JSON request body in addition to the URL path parameter. Omitting it causes `IllegalArgumentException: The given id must not be null!` (400). Full update body: `{id, login, startDate, endDate, paymentType, paymentMonth, optionalApprovers, notifyAlso}`.
- **Pay body format confirmed** — `PUT /v1/vacations/pay/{id}` body: `{"regularDaysPayed": N, "administrativeDaysPayed": N}`. Sum must equal vacation's total working days. For REGULAR 5-day: `{"regularDaysPayed": 5, "administrativeDaysPayed": 0}`. The `days` field in the vacation response object provides the correct total.
- **REJECTED→APPROVED confirmed** — `VacationStatusManager` allows direct re-approval from REJECTED without requiring an edit. Transition map: `REJECTED → [APPROVED]`.
- **APPROVED→REJECTED confirmed** — Approver can reject an already-approved vacation. Days returned to pool, FIFO redistribution triggered.
- **APPROVED→NEW on date edit confirmed** — Editing dates via PUT resets status from APPROVED to NEW. Optional approvals also reset to ASKED.
- **APPROVED→CANCELED confirmed** — `canBeCancelled` guard passes for future vacations where paymentDate is after the office report period.
- **APPROVED→PAID confirmed** — Terminal state. PAID+EXACT cannot be canceled, rejected, or deleted via normal API. Cleanup requires test API endpoint or accepting persistence.


## Autotest Notes (Session 27)

### Timeline Table Schema (DB-Level Event Verification)
- Table: `ttt_vacation.timeline`
- Key columns: `id` (PK bigint), `employee` (FK), `event_time` (timestamptz), `event_type` (text), `vacation` (FK to vacation.id), `previous_status` (text nullable)
- Event types observed: `VACATION_CREATED`, `VACATION_APPROVED`, `VACATION_REJECTED`, `VACATION_CANCELED`, `VACATION_DELETED`, `VACATION_PAID`
- `previous_status` is only populated for reject (previous_status='APPROVED'), cancel (previous_status='APPROVED'), and delete (previous_status='CANCELED'/'REJECTED'). It is NULL for create, approve, and pay events.
- Events are reliably created on every status transition — suitable for integration test assertions.

### vacation_notify_also Table Schema
- Table: `ttt_vacation.vacation_notify_also`
- Columns: `id` (PK bigint), `vacation` (FK to vacation.id), `approver` (FK to employee.id — misleading name, actually the notified colleague), `required` (boolean, defaults false)
- Unique index on `(vacation, approver)` — can't notify same person twice
- `required=false` for informational notify-also; `required` may be `true` for other use cases
- GET /vacations/{id} response does NOT include notifyAlso data — verification must be via DB query

### DB Bigint Type Handling
- PostgreSQL `bigint` columns return as JavaScript strings via the `pg` driver (not numbers)
- When comparing DB FK values with API-returned numeric IDs, always use `Number(row.column)` for equality checks
- Affects: vacation FK in vacation_notify_also, vacation_approval, timeline tables

### CANCELED → NEW Transition Confirmed
- PUT /v1/vacations/{id} with full update body (including `id` field) changes CANCELED → NEW
- The transition works because `isNextStateAvailable(CANCELED, NEW)` finds the explicit entry in the transition map, even though CANCELED is in FINAL_STATUSES
- Days are recalculated on re-open (regularDays and administrativeDays recomputed)
- Status resets to NEW, same as a fresh vacation

### Invalid NEW → PAID Confirmed
- PUT /v1/vacations/pay/{id} on a NEW vacation returns HTTP 400
- PayVacationServiceImpl.checkForPayment validates status must be APPROVED + periodType EXACT
- The status check prevents any non-APPROVED vacation from being paid
- Vacation status remains unchanged after the failed pay attempt

### TC-046 (canBeCancelled) Deferred
- Cannot set up paymentDate < reportPeriod scenario without clock manipulation or period advancement
- Creating future vacations always sets paymentDate in the future → canBeCancelled returns true
- Needs timemachine environment with clock set to a date after the vacation's paymentMonth

### TC-056 (crossing on approve) Deferred
- Cannot create two overlapping vacations for the same user — crossing check runs on both POST create and PUT update
- Would need: (a) multi-user support to create overlapping vacations for different users, or (b) direct DB manipulation to insert an overlapping record, or (c) timing exploit between create and crossing check


## Autotest Notes (Phase C corrections)

### API Endpoint Path Corrections
The Controller Endpoint Security Matrix in §6 above lists paths relative to the controller mapping, but the **actual deployed paths** differ for some operations (confirmed via swagger spec `/v2/api-docs`):

| Operation | Code/Vault Path | Actual Deployed Path | Method |
|-----------|----------------|---------------------|--------|
| Approve | `/{vacationId}/approve` | `/approve/{vacationId}` | PUT |
| Cancel | `/{vacationId}/cancel` | `/{vacationId}/cancel` | PUT |
| Delete | `/{vacationId}` | `/{vacationId}` | DELETE |
| Create | (root) | (root) | POST |

All paths are relative to base `/v1/vacations` (full: `/api/vacation/v1/vacations`).

The swagger spec (`/api/vacation/v2/api-docs`) is the authoritative source for deployed endpoint paths. The code analysis may show controller annotations that differ from the deployed routing due to API gateway remapping.
