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
