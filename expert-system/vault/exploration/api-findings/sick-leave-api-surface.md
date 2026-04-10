---
type: exploration
tags: [sick-leave, api, swagger, dual-status]
created: 2026-04-02
updated: 2026-04-02
status: active
related: ["[[sick-leave-service-deep-dive]]", "[[statistics-api-surface]]"]
branch: release/2.1
---

# Sick Leave API Surface (Vacation Service)

## Endpoints

| Method | Path | Purpose | Key Params |
|--------|------|---------|-----------|
| GET | /v1/sick-leaves | Search sick leaves | statuses, accountingStatuses, datePeriod.start/end, employeeLogin, officeId, officeIds, departmentManagerLogin, techLeadLogin, deleted, view, page, pageSize, sort |
| POST | /v1/sick-leaves | Create sick leave | SickLeaveCreateRequestDTO |
| GET | /v1/sick-leaves/count | Count by status | Same filters as search |
| GET | /v1/sick-leaves/{id} | Get by ID | sickLeaveId |
| DELETE | /v1/sick-leaves/{id} | Delete | sickLeaveId |
| PATCH | /v1/sick-leaves/{id} | Patch | SickLeavePatchRequestDTO |
| POST | /v1/statistic/report/sick-leaves | Statistics report | requestDTO |

## DTOs

### SickLeaveDTO (response)
- `id` — sick leave ID
- `employee` — employee object
- `office` — office object
- `startDate`, `endDate` — date range
- `number` — document number
- `status` — operational status (state machine)
- `accountingStatus` — accounting status (separate from operational)
- `accountant`, `accountantComment` — accountant assignment
- `notifyAlso` — additional notification recipients (array of SickLeaveNotifyAlsoDTO)
- `files` — attached files
- `totalDays`, `workDays` — calculated day counts
- `warnings` — validation warnings

### SickLeaveCreateRequestDTO
- `login` — employee login
- `startDate`, `endDate` — date range
- `number` — document number
- `filesIds` — attached file IDs
- `notifyAlso` — additional recipients
- `force` — bypass validation (boolean)
- **NOTE:** No `familyMember` field yet — will be added by #3408 (Sprint 16)

### SickLeavePatchRequestDTO
- All create fields PLUS:
- `status` — can change operational status
- `accountingStatus` — can change accounting status
- `accountantComment` — set comment

## Key Observations

1. **Dual status model confirmed:** `status` (operational) + `accountingStatus` (accounting) are independent fields in both DTO and API
2. **Force creation:** `force` parameter bypasses validation — important for edge case testing
3. **familyMember not yet in API** — Sprint 16 feature (#3408) will add this field
4. **Notification recipients:** `notifyAlso` allows specifying additional people to notify about the sick leave
5. **File attachments:** Sick leaves support file uploads (filesIds on create/patch)
6. **Accountant assignment:** `accountant` and `accountantComment` fields for accounting workflow
7. **Statistics integration:** POST /v1/statistic/report/sick-leaves endpoint in vacation service provides sick leave data for statistics reports
