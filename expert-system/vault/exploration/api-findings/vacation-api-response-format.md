---
type: exploration
tags: [vacation, api, response-format, autotest]
created: 2026-03-21
updated: 2026-03-21
status: active
related: ["[[vacation-service-deep-dive]]"]
branch: release/2.1
---
# Vacation API Response Format (Discovered During Phase C)

## POST /api/vacation/v1/vacations — Create

Response body wraps data in `vacation` and `vacationDays` top-level keys:

```json
{
  "vacation": {
    "id": 51581,
    "employee": { "login": "pvaynmaster", ... },
    "approver": { "login": "pvaynmaster", ... },
    "manager": { "login": "ilnitsky", ... },
    "office": { ... },
    "startDate": "2026-04-06",
    "endDate": "2026-04-10",
    "paymentDate": "2026-04-01",
    "creationDate": "2026-03-21",
    "paymentType": "REGULAR",
    "periodType": "...",
    "status": "NEW",
    "regularDays": 4,
    "administrativeDays": 0,
    "notifyAlso": [],
    "optionalApprovers": [],
    "permissions": [...]
  },
  "vacationDays": { ... }
}
```

**Key fields in `vacation`:**
- `id` (number) — vacation record ID
- `status` — NEW, APPROVED, REJECTED, CANCELED, PAID
- `paymentType` — REGULAR or ADMINISTRATIVE
- `regularDays` (int) — paid working days
- `administrativeDays` (int) — unpaid working days
- No `days` field — must compute from regularDays + administrativeDays
- `approver` (object) — auto-assigned approver, not just an ID
- `employee`, `manager` — full employee objects with login, names, officeId

## Error Responses (HTTP 400)

Top-level `errorCode` is always `exception.validation` for DTO/validator errors. Specific error codes are in `errors[]` array:

```json
{
  "error": "Bad Request",
  "status": 400,
  "exception": "org.springframework.web.bind.MethodArgumentNotValidException",
  "errorCode": "exception.validation",
  "errors": [
    { "field": "startDate", "code": "validation.vacation.start.date.in.past", "message": "..." },
    { "field": "login", "code": "validation.notcurrentuser", "message": "..." }
  ]
}
```

## @CurrentUser Constraint

The `@CurrentUser` DTO annotation on the `login` field requires the request login to match the authenticated user. API_SECRET_TOKEN authenticates as `pvaynmaster` on qa-1. Any other login returns `validation.notcurrentuser` (HTTP 400).

**Impact on testing:**
- All API vacation creation tests must use `login: "pvaynmaster"`
- pvaynmaster is in Персей office (office_id=20, AV=true)
- Cannot test AV=false scenarios via API_SECRET_TOKEN
- CPO self-approval: pvaynmaster self-approves, ilnitsky (manager) is optional approver