---
type: module
tags:
  - sick-leave
  - service
  - deep-dive
  - code-analysis
  - permissions
  - validation
  - accounting
  - dual-status
created: '2026-03-15'
updated: '2026-03-15'
status: active
related:
  - '[[vacation-service-deep-dive]]'
  - '[[sick-leave-service-implementation]]'
  - '[[accounting-service-deep-dive]]'
  - '[[vacation-service-deep-dive]]'
branch: release/2.1
---
# Sick Leave Service Deep Dive

Code-level analysis of the sick leave subsystem within the vacation service. Covers the dual status model, service implementation, validators, permission model, access control, close validation, and accounting workflow.

## 1. Dual Status Model

Sick leaves have TWO independent status fields — a design unique among TTT absence types:

### SickLeaveStatusType (lifecycle status)
```java
public enum SickLeaveStatusType {
    SCHEDULED,  // Not used in create/patch logic — legacy?
    OPEN,       // Active sick leave
    CLOSED,     // Closed by accountant (set automatically when PAID)
    OVERDUE,    // Not used in service logic — may be calculated/scheduled
    REJECTED,   // Rejected by accountant
    DELETED     // Soft-deleted
}
```

### SickLeaveAccountingStatusType (accounting workflow)
```java
public enum SickLeaveAccountingStatusType {
    NEW,        // Just created, awaiting accountant
    PROCESSING, // Accountant is working on it
    PAID,       // Payment processed
    REJECTED    // Accountant rejected
}
```

### Status Coupling — Accounting drives Lifecycle
```java
private void updateStatus(SickLeave entity, SickLeavePatchRequestBO requestBO) {
    entity.setAccountingStatus(requestBO.getAccountingStatus());
    if (requestBO.getAccountingStatus() == PAID) {
        entity.setStatus(SickLeaveStatusType.CLOSED);       // PAID → CLOSED
    } else if (requestBO.getAccountingStatus() == REJECTED) {
        entity.setStatus(SickLeaveStatusType.REJECTED);      // REJECTED → REJECTED
    } else {
        entity.setStatus(SickLeaveStatusType.OPEN);          // NEW/PROCESSING → OPEN
    }
}
```

**Critical design**: The lifecycle status is DERIVED from accounting status. There's no independent status machine for the lifecycle — it's purely a function of accounting decisions. This means:
- Setting accountingStatus=NEW reverts status to OPEN even if it was CLOSED
- There's no way to independently close a sick leave without going through accounting
- SCHEDULED and OVERDUE statuses are never set by service logic

## 2. Entity Model — JPA Entity

```java
@Entity
@Table(name = "sick_leave")
public class SickLeave implements Serializable {
    @Id private Long id;
    @NotNull private Long employeeId;       // column: "employee"
    @NotNull private LocalDate startDate;
    @NotNull private LocalDate endDate;
    @NotNull private Integer totalDays;     // Calculated: calendar days in period
    @NotNull private Integer workDays;      // Calculated: working days in period
    @NotNull @Enumerated(STRING) private SickLeaveStatusType status;
    private Long accountantId;              // column: "accountant"
    private String number;                  // Certificate number (max 40 chars)
    @Enumerated(STRING) private SickLeaveAccountingStatusType accountingStatus;
    private String accountantComment;
}
```

**Note**: Unlike day-off/vacation, sick leave uses JPA entity (not JOOQ) for the main entity. Has calculated fields `totalDays` and `workDays` recalculated on every save.

## 3. REST API — SickLeaveController

Base path: `/v1/sick-leaves`

| Method | Path | @PreAuthorize | Purpose |
|--------|------|---------------|---------|
| GET | `/` | AUTHENTICATED_USER \|\| VACATIONS_VIEW | Search (paginated) |
| GET | `/count` | AUTHENTICATED_USER \|\| VACATIONS_VIEW | Open/overdue count |
| GET | `/{sickLeaveId}` | AUTHENTICATED_USER | Get by ID |
| POST | `/` | AUTHENTICATED_USER | Create sick leave |
| PATCH | `/{sickLeaveId}` | AUTHENTICATED_USER | Patch sick leave |
| DELETE | `/{sickLeaveId}` | AUTHENTICATED_USER | Delete sick leave |

**Key differences from vacation/day-off controllers**:
- Create/Patch/Delete only need AUTHENTICATED_USER — no VACATIONS_CREATE/EDIT/DELETE
- Uses `@SickLeaveIdExists` validation on path variable — validates existence at request level
- Create uses `@Validated(SickLeave.Create.class)` — validation groups for conditional @NotNull

## 4. DTO Validation

### SickLeaveCreateRequestDTO
```java
@SickLeaveCreateRequest   // Cross-field validator: date order check
public class SickLeaveCreateRequestDTO {
    @NotNull(groups = SickLeave.Create.class)
    @EmployeeLoginExists
    private String login;
    
    @NotNull(groups = SickLeave.Create.class)
    private LocalDate startDate;
    
    @NotNull(groups = SickLeave.Create.class)
    private LocalDate endDate;
    
    @Size(max = 40)
    private String number;      // Certificate number — optional on create
    
    @EmployeeLoginCollectionExists
    private List<String> notifyAlso;
    
    @Size(max = 5)
    private Set<@FileUuidExists UUID> filesIds;   // Max 5 attachments
    
    @NotNull(groups = SickLeave.Create.class)
    private boolean force;       // Force creation even if crosses vacation
}
```

### SickLeavePatchRequestDTO extends SickLeaveCreateRequestDTO
```java
@SickLeaveCreateRequest
public class SickLeavePatchRequestDTO extends SickLeaveCreateRequestDTO {
    private SickLeavePatchRequestStatusTypeDTO status;
    private SickLeaveAccountingStatusType accountingStatus;
    private String accountantComment;
}
```

**Design issue**: Patch DTO EXTENDS Create DTO — inherits all create validations including @SickLeaveCreateRequest cross-field validator. This means every patch request also validates date order even if dates aren't being changed (null dates pass through).

## 5. Validator — SickLeaveCreateValidator

```java
public boolean isValid(SickLeaveCreateRequestDTO value, ConstraintValidatorContext context) {
    if (value == null) return true;
    if (value.getStartDate() == null || value.getEndDate() == null) return true;
    context.disableDefaultConstraintViolation();
    return isStartEndDatesCorrect(value, context);
}

public boolean isStartEndDatesCorrect(SickLeaveCreateRequestDTO request, context) {
    boolean result = request.getStartDate().isBefore(request.getEndDate())
        || request.getStartDate().isEqual(request.getEndDate());
    if (!result) {
        context.buildConstraintViolationWithTemplate("validation.sickLeave.dates.order")
               .addPropertyNode("startDate").addConstraintViolation()
               .buildConstraintViolationWithTemplate("validation.sickLeave.dates.order")
               .addPropertyNode("endDate").addConstraintViolation();
    }
    return result;
}
```

**Error code**: `validation.sickLeave.dates.order` — applied to both startDate and endDate fields.

**Design**: Allows startDate == endDate (single-day sick leave). Only validates date order — no range limits, no future date check, no past date check. Minimal compared to vacation's multi-rule validator.

## 6. Permission Model — SickLeavePermissionProvider

Unlike vacation/day-off, sick leave uses a CLASS-LEVEL permission provider (not instance-level):

```java
@Component
public class SickLeavePermissionProvider implements PermissionProvider {
    
    private static final Set<EmployeeGlobalRole> CAN_VIEW = Set.of(
        ROLE_TECH_LEAD,
        ROLE_PROJECT_MANAGER,
        ROLE_DEPARTMENT_MANAGER
    );
    
    private static final Set<EmployeeGlobalRole> CAN_VIEW_SICK_LEAVE_ACCOUNTING = Set.of(
        ROLE_ACCOUNTANT,
        ROLE_DEPARTMENT_MANAGER,
        ROLE_CHIEF_ACCOUNTANT,
        ROLE_VIEW_ALL,
        ROLE_ADMIN
    );
    
    public Set<PermissionClassAction> get(EmployeeBO employee) {
        Set<PermissionClassAction> permissions = new LinkedHashSet<>();
        if (roles.stream().anyMatch(CAN_VIEW::contains))
            permissions.add(SICK_LEAVE_VIEW);
        if (roles.stream().anyMatch(CAN_VIEW_SICK_LEAVE_ACCOUNTING::contains))
            permissions.add(SICK_LEAVE_ACCOUNTING_VIEW);
        return permissions;
    }
}
```

**Only two class-level permissions**: SICK_LEAVE_VIEW and SICK_LEAVE_ACCOUNTING_VIEW. No create/edit/delete permissions — those are enforced inline in the service.

**Notable**: ROLE_DEPARTMENT_MANAGER appears in BOTH sets — can view sick leaves AND accounting data.

## 7. Service-Level Access Control

The real access control happens inside SickLeaveServiceImpl, NOT the permission provider.

### Search view filtering
```java
// View-based role filtering — returns empty page if unauthorized
if (view == DM_TL_DEPARTMENT && !currentEmployee.hasAnyRole(ROLE_DEPARTMENT_MANAGER, ROLE_TECH_LEAD))
    return new PageBO<>();
if (view == PM_PROJECTS && !currentEmployee.hasAnyRole(ROLE_PROJECT_MANAGER))
    return new PageBO<>();
if (view == ACCOUNTANT && !currentEmployee.hasAnyRole(
        ROLE_ACCOUNTANT, ROLE_ADMIN, ROLE_CHIEF_ACCOUNTANT, ROLE_VIEW_ALL))
    return new PageBO<>();
```

Three view types: `ACCOUNTANT`, `DM_TL_DEPARTMENT`, `PM_PROJECTS`.

### Update permission check
```java
private void checkUpdatePermissions(EmployeeBO currentUser, EmployeeBO employee,
                                     SickLeave entity, SickLeavePatchRequestBO requestBO) {
    if (entity.getStatus() == DELETED && hasUnmodifiableForDeletedRequestField(requestBO)
            || entity.getAccountingStatus() == PAID
            && !(currentUser.hasAnyRole(ROLE_ADMIN, ROLE_CHIEF_ACCOUNTANT)
            || officeAccountantRepository.existsByEmployeeIdAndOfficeId(currentUser.getId(),
            employee.getOfficeId()))) {
        throw new ValidationException(VALIDATION_SICK_LEAVE_UPDATE_CLOSED);
    }
}
```

**Rules**:
- DELETED status: only `accountantComment` can be modified (all other fields are "unmodifiable for deleted")
- PAID accounting status: only ADMIN, CHIEF_ACCOUNTANT, or the assigned office accountant can update
- Error code: `exception.validation.sickLeave.update.closed`

### PM access check — Complex exclusion logic
```java
private void checkIfCurrentEmployeeIsNotPM(EmployeeBO currentEmployee, EmployeeBO employee) {
    if (!currentEmployee.equals(employee)                     // Not self
        && (employee.getManager() == null 
            || !currentEmployee.equals(employee.getManager())) // Not employee's manager
        && (employee.getTechLead() == null 
            || !currentEmployee.equals(employee.getTechLead())) // Not employee's tech lead
        && !(currentEmployee.hasAnyRole(ROLE_ADMIN, ROLE_CHIEF_ACCOUNTANT)
            || isOfficeAccountant)                              // Not admin/accountant
        && currentEmployee.hasAnyRole(ROLE_PROJECT_MANAGER))   // IS a PM
    {
        throw new VacationSecurityException();
    }
}
```

**Logic**: If you are a PM but NOT the employee's direct manager/TL/accountant, you CANNOT edit their sick leave. This prevents PMs from other projects from modifying sick leaves. Uses `VacationSecurityException` (not SickLeave-specific) — shared exception class.

### Accountant permission check
```java
private void checkAccountantPermissions(EmployeeBO currentUser, EmployeeBO employee) {
    if (!(currentUser.hasAnyRole(ROLE_ADMIN, ROLE_CHIEF_ACCOUNTANT)
            || officeAccountantRepository.existsByEmployeeIdAndOfficeId(
                currentUser.getId(), employee.getOfficeId()))) {
        throw new VacationSecurityException();
    }
}
```

Only ADMIN, CHIEF_ACCOUNTANT, or the employee's office accountant can modify accounting fields (accountingStatus, accountantComment).

## 8. Create Flow

```java
@Transactional
public SickLeaveBO createSickLeave(SickLeaveCreateRequestBO requestBO) {
    EmployeeBO employee = employeeService.getByLogin(requestBO.getLogin());
    
    // 1. Check crossing sick leaves (same employee, overlapping dates)
    if (!findCrossingSickLeaves(employee.getId(), startDate, endDate).isEmpty())
        throw new ValidationException(START_DATE, VALIDATION_SICK_LEAVE_DATES_CROSSING);
    
    // 2. Check vacation crossing (with force flag)
    checkVacationCrossing(employee.getId(), requestBO, startDate, endDate);
    
    // 3. Create entity
    entity.setStatus(SickLeaveStatusType.OPEN);
    entity.setAccountingStatus(SickLeaveAccountingStatusType.NEW);
    
    // 4. Calculate period days
    PeriodModel period = employeePeriodCalculator.getEmployeePeriodInfo(...);
    entity.setTotalDays(period.getTotalDays());
    entity.setWorkDays(period.getWorkingDays());
    
    // 5. Save, update notifyAlso, update files, publish event
    SickLeave saved = repository.save(entity);
    notifyAlsoService.updateNotifyAlso(saved.getId(), requestBO.getNotifyAlso());
    fileService.update(saved.getId(), requestBO.getFilesIds(), false);
    eventPublisher.publishEvent(new SickLeaveCreatedEvent(...));
    return convert(saved);
}
```

### Vacation crossing — Force flag
```java
private boolean checkVacationCrossing(Long employeeId, SickLeaveCreateRequestBO requestBO,
                                       LocalDate startDate, LocalDate endDate) {
    boolean isVacationCrossingExists = !vacationSearchService
            .findCrossingVacations(employeeId, startDate, endDate).isEmpty();
    if (isVacationCrossingExists && !requestBO.isForce()) {
        throw new SickLeaveCrossingVacationException();  // HTTP 409
    }
    return isVacationCrossingExists;
}
```

**Error code**: `exception.sick.leave.crossing.vacation` (HTTP 409 Conflict)

**Force flag**: If `force=true`, the sick leave is created despite crossing a vacation, and the event system handles the vacation overlap (publishes `EmployeeSickLeaveOverlapsVacationEvent`).

## 9. Patch Flow — Multi-Step Validation

```java
@Transactional
public SickLeaveBO patchSickLeave(Long sickLeaveId, SickLeavePatchRequestBO requestBO) {
    SickLeave entity = repository.getById(sickLeaveId);
    SickLeaveBO oldSickLeave = convert(entity);
    
    // 1. Check update permissions (DELETED/PAID guards)
    checkUpdatePermissions(currentEmployee, employee, entity, requestBO);
    
    // 2. Check PM access
    checkIfCurrentEmployeeIsNotPM(currentEmployee, employee);
    
    // 3. Update comment if changed (accountant-only)
    updateCommentIfNecessary(currentEmployee, employee, entity, requestBO);
    
    // 4. Update accounting status if changed (accountant-only, drives lifecycle)
    updateAccountingStatusIfNecessary(currentEmployee, employee, entity, requestBO);
    
    // 5. Set accountant ID if user has accountant permissions
    updateAccountantIfNecessary(currentEmployee, employee, entity);
    
    // 6. Check crossing sick leaves (skip if DELETED)
    if (entity.getStatus() != DELETED && !findCrossingSickLeaves(...).isEmpty())
        throw ValidationException(VALIDATION_SICK_LEAVE_DATES_CROSSING);
    
    // 7. Check vacation crossing (with warning, not exception on force)
    if (dateChanged && checkVacationCrossing(...)) {
        eventPublisher.publishEvent(new EmployeeSickLeaveOverlapsVacationEvent(sickLeaveId));
        warnings.add(SICK_LEAVE_CROSSING_VACATION);
    }
    
    // 8. Close validation — number required
    if (requestBO.getStatus() == CLOSED && isNumberEmpty(entity.getNumber())
            && isNumberEmpty(requestBO.getNumber()))
        throw ValidationException(NUMBER, VALIDATION_SICK_LEAVE_EMPTY_NUMBER);
    
    // 9. Apply field updates, recalculate days
    // 10. Save, publish event, update notifyAlso/files
}
```

**Close validation**: Cannot close a sick leave without a certificate number. Error code: `exception.validation.sickLeave.number.empty`.

**Vacation crossing on patch**: Returns a WARNING instead of throwing (unlike create). The response includes `SICK_LEAVE_CROSSING_VACATION` in warnings list.

## 10. Delete Flow

```java
@Transactional
public SickLeaveBO deleteById(Long sickLeaveId) {
    SickLeave entity = repository.getById(sickLeaveId);
    
    // Guard: cannot delete PAID sick leave
    if (entity.getAccountingStatus() == PAID) {
        throw new ValidationException(VALIDATION_SICK_LEAVE_DELETE_CLOSED);
    }
    
    // Soft delete
    entity.setStatus(SickLeaveStatusType.DELETED);
    repository.save(entity);
    eventPublisher.publishEvent(new SickLeaveDeletedEvent(...));
    return sickLeaveBO;  // Returns the pre-delete state
}
```

**Error code**: `exception.validation.sickLeave.delete.closed` — cannot delete a PAID sick leave.

**No owner check on delete**: Any AUTHENTICATED_USER can call the delete endpoint. The only guard is the PAID accounting status. This is different from vacation/day-off which check ownership via permission service.

## 11. Notification System

### Editor type determination
```java
private SickLeaveNotificationEditorType getEditorType(EmployeeBO employee, EmployeeBO currentEmployee) {
    if (employee == currentEmployee) {                    // BUG: identity comparison, not .equals()
        return SickLeaveNotificationEditorType.EMPLOYEE;
    } else if (isAccountantPermissionExist(currentEmployee, employee)) {
        return SickLeaveNotificationEditorType.ACCOUNTANT;
    } else if (currentEmployee.hasAnyRole(ROLE_DEPARTMENT_MANAGER, ROLE_TECH_LEAD)) {
        return SickLeaveNotificationEditorType.SUPERVISOR;
    }
    return SickLeaveNotificationEditorType.EMPLOYEE;      // Default fallback
}
```

**Bug**: Uses `==` (identity comparison) instead of `.equals()`. Since `employee` and `currentEmployee` are loaded separately, they will be different object instances even for the same person. This means self-edits will be classified as ACCOUNTANT or SUPERVISOR type, never EMPLOYEE (except via fallback).

Three notification types:
- **EMPLOYEE**: Self-reporting/editing (broken due to == bug)
- **ACCOUNTANT**: Accountant actions on sick leave
- **SUPERVISOR**: DM or TL actions

## 12. Event System

5 domain events with event listeners:
- `SickLeaveCreatedEvent` → notifications to managers, file processing
- `SickLeaveChangedEvent` → notifications (old vs new state comparison)
- `SickLeaveDeletedEvent` → notifications
- `SickLeaveFilesAddedEvent` → file processing
- `EmployeeSickLeaveOverlapsVacationEvent` → handles vacation-sick leave overlap

### Chain of Responsibility pattern (4 commands):
- `SickLeaveClosedCommand` — handles close-specific logic
- `SickLeaveDatesChangedCommand` — handles date change impact
- `SickLeaveNumberChangedCommand` — handles certificate number changes
- `SickLeaveRejectedCommand` — handles rejection logic

## 13. Error Codes Summary

| Error Code | Trigger | HTTP |
|------------|---------|------|
| `validation.sickLeave.dates.order` | startDate after endDate | 400 |
| `exception.validation.sickLeave.dates.crossing` | Overlapping sick leaves | 400 |
| `exception.sick.leave.crossing.vacation` | SickLeaveCrossingVacationException | 409 |
| `exception.validation.sickLeave.number.empty` | Close without certificate number | 400 |
| `exception.validation.sickLeave.update.closed` | Update DELETED or PAID sick leave | 400 |
| `exception.validation.sickLeave.delete.closed` | Delete PAID sick leave | 400 |
| `exception.vacation.no.permission` | VacationSecurityException (PM access) | 403 |

## 14. Design Issues and Test Implications

1. **Identity comparison bug in getEditorType()**: `employee == currentEmployee` always false for separately loaded objects. Test: verify notification type when employee self-creates vs manager creates. Expected: EMPLOYEE type for self, but actual will be ACCOUNTANT/SUPERVISOR.

2. **PatchDTO extends CreateDTO**: All create validations re-run on patch. The @SickLeaveCreateRequest validator runs on every patch. Test: patch with only accountantComment changed — does date validation trigger?

3. **No owner check on delete**: Any authenticated user can delete any sick leave (if not PAID). Test: delete another user's sick leave as a regular employee.

4. **No PM check on delete**: `checkIfCurrentEmployeeIsNotPM` is only called in `patchSickLeave`, not `deleteById`. Test: PM from another project deleting an employee's sick leave.

5. **SCHEDULED and OVERDUE statuses**: Never set by service logic. May be set by cron/scheduled tasks. Test: search for SCHEDULED/OVERDUE sick leaves, verify behavior.

6. **Accounting status drives lifecycle status reversal**: Setting accountingStatus=NEW after PAID reverts status to OPEN. Test: unpay a sick leave, verify status changes back.

7. **File limit @Size(max=5)**: Validated on DTO but not enforced in service. Test: add files via patch beyond initial 5 limit.

8. **hasUnmodifiableForDeletedRequestField**: Only `accountantComment` can be changed on DELETED sick leaves. Test: modify each field on deleted sick leave, verify rejection.

9. **Force flag required on create (@NotNull)**: Must explicitly set force=true or force=false. But on patch, force comes from inherited CreateDTO fields — NPE risk if not set.

10. **Shared VacationSecurityException**: PM access check and accountant check throw VacationSecurityException (not SickLeaveSecurityException) — error code `exception.vacation.no.permission` for sick leave operations.


## 15. Ticket-Derived Bug Patterns and Edge Cases (Session 97 Enrichment)

### Rejection Order Dependency (#2973 — CRITICAL)
The order of state transitions matters for norm calculation propagation:
- **Case 1 (OK):** create → close → reject = norm correctly reverts
- **Case 2 (BUG):** create → reject → close = norm INCORRECTLY includes sick leave hours

**Root cause:** The `updateStatus()` method in §1 above resets status to OPEN when accountingStatus returns to NEW/PROCESSING. But the norm recalculation event is only triggered on specific transitions, and the reject→close sequence triggers events in a different order than close→reject.

**Testing requirements established from #2973:**
1. Employee CANNOT edit in "Rejected" state (but accountant can)
2. Close action only for "Open" and "Overdue" states (closing "Rejected" was a bug)
3. Overlap notification should NOT fire for "Rejected" or "Deleted" sick leaves
4. DM/TL: same restrictions apply as employee
5. Closing "Planned" sick leave IS allowed (design decision)

### Norm Recalculation Propagation Failures (8 tickets #2778-#2915)

After ANY sick leave state change (create, delete, reject, close), ALL of these pages must update correctly:

| Page | What Must Update | Known Bug |
|------|-----------------|-----------|
| My Tasks | Day colors (orange→black on delete/reject), norm tooltip values, cell input availability | #2778: deleted SL still shows, #2863: rejected SL colors days |
| Planner | Day marking (red for sick leave) | #2792: deleted SL still marks days red (multiple fix attempts) |
| Availability Chart | Copy-to-clipboard data | #2812: rejected SL included in copied data |
| Confirmation page | Both "By Employees" and "By Projects" views | #2819: 4 sub-bugs — weekend hours, deleted SL displayed, day-off transfer, sick leave missing from "By Employees" view |
| Statistics | Norm calculation | #2915: daily norm tooltip (second value after slash) wrong |

**Root pattern:** Frontend caching is aggressive — page components cache absence data and don't invalidate on state changes from OTHER pages. The event system publishes domain events but the frontend doesn't have a unified invalidation mechanism.

**Day-off interaction (#2901):** Moving a day-off during an overlapping sick leave doesn't trigger norm recalculation. Steps: create calendar event → verify norm → create overlapping sick leave → move day-off outside range → norm not reduced by moved day-off.

### Production Visibility Bugs (Security-Critical)

**#3213 (HIGH):** ALL employees could see EVERYONE's sick leaves on "My Sick Leaves" page. Production bug. Root cause: MRs #3211 and #3190 were reverted to fix this. Regression test essential.

**#2524 (HotFix):** Intermittent "flickering bug" — one employee sees another's sick leave. Root cause: frontend sends request WITHOUT `employeeLogin` parameter on page refresh → API returns ALL sick leaves for all employees. Reproduction: login → open My Sick Leaves → refresh page.

**#3012:** `/accounting/sick-leaves` route accessible to regular employees. Root cause: checked `VACATIONS` permission with `VIEW` instead of `SICK_LEAVE_ACCOUNTING_VIEW`. Fix: added new permission `SICK_LEAVE_ACCOUNTING_VIEW`.

### DM/TL/PM Permission Tabs (#2622, #2873)

Three tabs with role-based scoping:
- **"My Department"** tab: DM and TL see their subordinates
- **"My Projects"** tab: PM sees employees on their projects (view only — no edit/create)
- **Personal** tab: all employees see their own

**Bugs found during testing:**
- Tab badge counter was per-page (not total count) → added API response field
- State filter had "Deleted" option visible (should be hidden for non-accountant roles)
- No validation error when no employee selected during creation → "employee cannot be null"
- Filters not resetting when switching tabs
- DM/TL can create and edit for their employees
- SPM role also returns employee sick leaves (by design)
- API endpoint returned 568 employees instead of expected 16 for PM scope (#2873)

### Upcoming: familyMember Flag (#3408, Sprint 16)
- New `familyMember` boolean flag (default `false`)
- Splits sick leaves into: own illness vs. family member care
- Adds checkbox "Caring for a family member" to create/edit dialog
- Affects both "My Sick Leaves" and "Sick Leave Records" accounting page
- All existing sick leaves default to `familyMember = false`
- **Depends on #3409:** budgetNorm calculation changes — family-member sick leaves included in budgetNorm, own sick leaves excluded

### Working During Sick Leave (#2803 — Unresolved)
Real case: Cyprus employee, 5-day sick leave, worked 3 days + 2 weekends. System compensated 5 vacation days instead of 2 (counted ALL sick leave days as non-working, not just the days the employee actually missed). No resolution — open analytical task.

### Date Overlap Exclusion Rules
From tickets #2636, #2973:
- Overlap check (`findCrossingSickLeaves()`) must SKIP: Rejected, Deleted sick leaves
- Email notification (ID_105) must EXCLUDE: Deleted sick leaves
- Only check against: Open, Planned, Overdue, Closed sick leaves

### Full State × Action × Role Matrix (from §7 + tickets)

| State | Acc. Status | Employee Actions | DM/TL Actions | Accountant Actions |
|-------|-------------|-----------------|---------------|-------------------|
| Open | New | edit, delete | edit, create for subordinate | edit, change acc. status |
| Open | Processing | edit, delete | edit | edit, change acc. status |
| Planned | New | edit, delete, close | edit | edit, change acc. status |
| Overdue | New | edit, delete, close | edit | edit, change acc. status |
| Rejected | Any | view only (#2973) | view only | edit, change acc. status |
| Closed | Non-Paid | edit, delete | edit | edit, change acc. status |
| Closed | Paid | view only | view only | edit (admin/chief/office accountant only) |
| Deleted | Any | view only | view only | edit accountantComment only |

**PM role exception:** PM can VIEW sick leaves for employees on their projects but CANNOT create, edit, or delete. §7 `checkIfCurrentEmployeeIsNotPM()` enforces this.


## Upcoming: familyMember Flag (#3408, Sprint 16)

A new `familyMember` boolean flag will split sick leaves into two types:
- `familyMember = false` (default) — employee's own sick leave. Deducts from individual norm.
- `familyMember = true` — caring for a family member. Does NOT deduct from individual norm; instead added to budgetNorm (like admin vacations).

**Impact:**
- All historical sick leaves retroactively set to `familyMember = false`
- UI: new checkbox in create/edit dialog: "По уходу за членом семьи" / "Caring for a family member"
- Calendar display: must differentiate the two types
- Accounting > sick leave accounting: updated display
- Statistics budgetNorm formula changes (#3409): `Nb = Ni + admin_vac_hrs + familyMember_SL_hrs`
- API: `v1/statistic/report/employees` must include updated budgetNorm

**Key test scenarios for familyMember:**
1. Create sick leave with default familyMember=false → verify norm decreases
2. Create sick leave with familyMember=true → verify norm does NOT decrease, budgetNorm shows both values  
3. Toggle familyMember on existing sick leave → verify norm recalculation
4. Verify calendar shows different indicators for own vs family sick leave
5. Verify accounting page includes familyMember in display/filter
6. Verify budgetNorm tooltip text updated per #3409
