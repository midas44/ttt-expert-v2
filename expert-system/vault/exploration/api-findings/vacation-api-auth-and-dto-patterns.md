---
type: exploration
tags: [vacation, api, error-handling, validation, autotest-discovery]
created: 2026-03-20
updated: 2026-03-20
status: active
related: ["[[vacation-service-deep-dive]]"]
branch: release/2.1
---

# Vacation API Error Serialization & Endpoint Patterns

## ValidationException vs ServiceException Serialization

Discovered during Phase C session 87 (TC-013, TC-010).

### ValidationException (e.g., crossing check, field-level errors)
```json
{
  "error": "Bad Request",
  "status": 400,
  "exception": "com.noveogroup.ttt.common.exception.ValidationException",
  "errorCode": "exception.validation.fail",
  "message": "exception.validation.vacation.dates.crossing",
  "path": "/v1/vacations",
  "errors": [
    {
      "field": "startDate",
      "code": "exception.validation.fail",
      "message": "exception.validation.vacation.dates.crossing"
    }
  ]
}
```

**Key pattern:** `errorCode` is ALWAYS generic `"exception.validation.fail"`. The specific error code is in the `message` field (both top-level and per-error). The `errors[].code` is also generic.

### ServiceException (e.g., duration check, status errors)
```json
{
  "error": "Bad Request",
  "status": 400,
  "errorCode": "validation.vacation.duration",
  "message": "...",
  "errors": []
}
```

**Key pattern:** `errorCode` directly contains the specific error code. No `errors[]` entries.

### Assertion Strategy for Autotests
- For ValidationException errors: check `message` field for the specific code
- For ServiceException errors: check `errorCode` field for the specific code
- Safe catch-all: check both `errorCode` and `message` for the expected substring

## v2 Availability-Schedule Endpoint

`GET /api/vacation/v2/availability-schedule`

### Required Parameters
- `from` (date, REQUIRED) — NPE without: `Cannot invoke "java.time.LocalDate.minusYears(long)" because the return value of "AvailabilityScheduleSearchRequestV2BO.getFrom()" is null`
- `to` (date, REQUIRED) — same NPE
- `page` (int, default 0)
- `pageSize` (int, default 20)
- `type` (enum: MY, ALL, APPROVER)
- `sort` (string, e.g. "+login")

### Response Structure
```json
{
  "page": 0,
  "pageSize": 20,
  "totalCount": 385,
  "content": [
    {
      "employee": {
        "csId": 958,
        "login": "abaymaganov",
        "russianFirstName": "...",
        "latinFirstName": "...",
        "officeId": 10
      },
      "vacations": [...]
    }
  ]
}
```

**Key differences from v1:**
- Uses `totalCount` (not `totalElements` like Spring Page)
- No `totalPages` field
- Content is employee-centric (employee + their vacations), not vacation-centric
- `type=MY` with API_SECRET_TOKEN still returns all employees (385) — the filter affects vacation visibility, not employee visibility
