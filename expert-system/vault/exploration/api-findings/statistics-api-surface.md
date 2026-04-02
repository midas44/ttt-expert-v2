---
type: exploration
tags: [statistics, api, employee-reports, budgetNorm, swagger]
created: 2026-04-02
updated: 2026-04-02
status: active
related: ["[[frontend-statistics-module]]", "[[statistics-service-implementation]]", "[[security-patterns]]"]
branch: release/2.1
---

# Statistics API Surface

## Employee Reports Endpoints (New — #3195)

### GET /v1/statistic/report/employees
**Purpose:** Employee Reports page data (budgetNorm, reported, excess)
**Params:** employee (search), startDate (required), endDate (required), exceedingLimit (boolean), managerLogins (array)
**Response DTO: StatisticReportNodeDTO:**
- `budgetNorm` — budget norm (Nb = Ni + admin_vac + familyMember_SL)
- `norm` — individual norm (Ni)
- `normForDate` — norm for specific date
- `reported` — total reported hours
- `excess` — excess percentage
- `reportedStatus` — status indicator (OVER/UNDER/NORMAL?)
- `reportedNotificationStatus` — notification status
- `managerLogin`, `managerName`, `managerRussianName`
- `login`, `name`, `russianName`
- `childNodeList`, `expandable` — accordion project breakdown
- `nodeType`, `nodeUuid`, `parentNodeUuid`

### GET /v1/statistic/report
**Purpose:** Get statistic report data
**Params:** reportDate (string)

### POST /v1/statistic/report
**Purpose:** Submit Employee Reports comment
**Request DTO: StatisticReportCreateOrUpdateRequestDTO:**
- `comment` (string) — the comment text
- `employeeLogin` (string) — which employee
- `reportDate` (string) — which month

**Response DTO: StatisticReportDTO:**
- `id`, `budgetNorm`, `comment`, `employeeLogin`
- `monthNorm`, `reportDate`, `reportedEffort`
- `createdTime`, `lastUpdatedTime`, `updatedBy`

### GET /v1/statistic/report/projects
**Purpose:** Employee's projects breakdown for accordion
**Params:** employeeLogin, startDate, endDate

## Classic Statistics Endpoints (8 grouping views + 8 exports + 1 permissions)

### Data Views (all share common filter params)
| Endpoint | Groups By |
|----------|-----------|
| GET /v1/statistic/employees | Employees (top level) |
| GET /v1/statistic/employees/projects | Employees → Projects |
| GET /v1/statistic/employees/tasks | Employees → Tasks |
| GET /v1/statistic/departments | Departments |
| GET /v1/statistic/projects | Projects (top level) |
| GET /v1/statistic/projects/employees | Projects → Employees |
| GET /v1/statistic/tasks | Tasks (top level) |
| GET /v1/statistic/tasks/employees | Tasks → Employees |
| GET /v1/statistic/task-bound-employees | Task-bound employees |

**Common Filter Params:**
- `startDate`, `endDate` — required date range
- `employeeLogin`, `boundEmployeeLogin`, `contractor`, `showFired`
- `projectId`, `customerName`, `taskId`
- `taskNamePrefix`, `taskNameSubstring`
- `managerLogin`, `managerProjectRoles` (array)
- `departmentManagerLogin`, `officeManagerLogin`
- `taskReportStates` (array: APPROVED, REJECTED, REPORTED)
- `skipTotalEffort`, `trimProjectName`

**Response DTO: StatisticNodeDTO:**
- `id`, `login`, `name`
- `effortForPeriod`, `effortTotal` — hours data
- `nodeType` — grouping type
- `childNodeList`, `expandable` — tree structure
- `contractor`, `officeId`, `ticketUrl`
- `beginDate`, `endDate`

### Export Endpoints (CSV)
Mirror each data view above at `/v1/statistic/export/*`
**Additional params:** csvDecimalSeparator, csvLimit, csvQuote, csvValueSeparator, timeUnit

### Permissions
GET /v1/statistic/permissions — available permissions for current user
**Params:** customerName, employeeLogin, projectId, taskId, taskNamePrefix, taskNameSubstring

## Security Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /v1/authentication/check | GET | Check authentication status |
| /v1/security/activations/{login} | GET | Employee activation info |
| /v1/security/jwt | POST | Get JWT token |
| /v1/security/permissions | GET | List API token permissions |
| /v1/security/token | POST | Validate API token, return owner+permissions |
| /v1/tokens | GET | List tokens (paginated: name, page, pageSize, sort) |
| /v1/tokens | POST | Create token |
| /v1/tokens/{tokenId} | GET/DELETE/PATCH | Token CRUD |

## Budget Notification DTO
- `employeeLogin`, `projectId`, `taskId`
- `limit`, `limitPercent`
- `startDate`, `endDate`, `repeatMonthly`
- `reachedDate` — when limit was reached

## Error Response Patterns
- Missing required params: 500 with `MissingServletRequestParameterException` (exposes full exception class name — security concern)
- Validation errors: 400 with `BindException` or `ConstraintViolationException`, includes field-level error details
- Invalid login: 400 with `EmployeeLoginExistsValidator` error code
- Error response format: `{error, status, exception, errorCode, message, path, timestamp, errors[]}`

## API Endpoint Counts (TTT Service)
| Prefix | Count |
|--------|-------|
| /v1/statistic | 23 |
| /v1/projects | 15 |
| /v1/employees | 14 |
| /v1/reports | 9 |
| /v1/offices | 8 |
| /v1/suggestions | 6 |
| /v1/tasks | 6 |
| /v1/security | 4 |
| Others | ~15 |
