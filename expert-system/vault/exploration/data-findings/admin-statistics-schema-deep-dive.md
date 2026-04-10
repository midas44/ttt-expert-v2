---
type: exploration
tags:
  - database
  - admin
  - statistics
  - calendar
  - schema
  - qa-1
created: '2026-04-02'
updated: '2026-04-02'
status: active
related:
  - '[[ttt-backend-schema-deep-dive]]'
  - '[[admin-panel-deep-dive]]'
  - '[[statistics-service-implementation]]'
branch: release/2.1
---
# Admin & Statistics Schema Deep Dive (qa-1)

Session 100: Comprehensive PostgreSQL schema analysis for admin and statistics modules.

## Admin Module — Key Tables

### employee (1,841 rows, 33 columns)
Central entity. 406 enabled, 1,435 disabled, 159 contractors, 4 being_dismissed, 1,363 read_only.
- **Self-referential FKs:** senior_manager, tech_lead, contractor_manager_id, hr → employee.id
- **salary_office** → office.id (all 1,841 have one)
- **department_type:** PRODUCTION (1,460), ADMINISTRATION (109), NULL (272) — text, not enum
- **Soft delete pattern:** enabled=false + read_only=true (no hard delete)
- **Fuzzy search indexes:** trigram GIN on russian_first+last, latin_first+last, login
- **Maternity fields:** maternity_start_date/end_date (10 employees, some NULL end_date = ongoing)

### employee_global_roles (2,118 rows)
| Role | Count |
|------|-------|
| ROLE_EMPLOYEE | 1,683 |
| ROLE_CONTRACTOR | 159 |
| ROLE_PROJECT_MANAGER | 136 |
| ROLE_OFFICE_HR | 50 |
| ROLE_DEPARTMENT_MANAGER | 29 |
| ROLE_TECH_LEAD | 19 |
| ROLE_ACCOUNTANT | 18 |
| ROLE_VIEW_ALL | 13 |
| ROLE_ADMIN | 8 |
| ROLE_CHIEF_ACCOUNTANT | 2 |
| ROLE_CHIEF_OFFICER | 1 |

### office (32 rows)
28 salary offices (salary=true), 4 non-salary. Named after celestial bodies. ID assigned externally from CompanyStaff (not sequence). **Office ID 0 exists** as blank placeholder (name="", salary=false).

### office_period (56 rows = 28 offices × 2 types)
UNIQUE on (office, type). Two types: REPORT and APPROVE. Most start_date = 2026-03-01. "Не указано" frozen at 2020-03-01.

### project (3,142 rows)
- **status:** ACTIVE (200), FINISHED (2,871), CANCELED (59), SUSPENDED (12)
- **type:** COMMERCIAL (2,684), ADMINISTRATION (124), INTERNAL (141), INVESTMENT (56), IDLE_TIME (50), etc.
- **model:** ODC (1,194), FP (1,105), T_AND_M (843)
- **country:** Highly inconsistent free text (FR=2526, RU=423, plus "Fr", "fr", "Fra" duplicates)
- **pmt_id:** PM Tool integration ID (new field)

### project_member (423 rows) — DATA QUALITY ISSUE
- **`role` field is FREE TEXT**, not enum. 100+ distinct values with duplicates, typos, bilingual entries ("QA" 42, "PM" 25, "Developer" 21, "Senior deeloper", "Fronend")
- **access_type:** all NULL (423 rows) — unused column

### project_event (7,503 rows)
Audit log. 19 event types. Most common: MANAGER_CHANGED (2,348), STATUS_CHANGED (1,876), CREATED (1,222).

### application_settings (18 rows)
Key-value store. Notable: `notification.reporting.over/under` = +10/-10, `reportingPeriod.extension.duration` = 60 min.

### token (1,858 rows) + token_permissions
API tokens. token_permissions has **no PK, no indexes, no FKs** — notable schema weakness.

## Calendar Module (ttt_calendar schema)

### calendar (10 rows)
| ID | Name | Days | Range |
|----|------|------|-------|
| 1 | Russia | 277 | 2013-2026 |
| 2 | Germany | 31 | 2024-2026 |
| 3 | Georgia | 22 | 2024-2025 |
| 5 | Vietnam | 39 | 2024-2026 |
| 6 | Cyprus | 40 | 2024-2026 |
| 7 | France | 29 | 2024-2026 |
| 10 | Uzbekistan | 25 | 2024-2026 |
| 9 | Empty (no holidays) | 0 | — |

### calendar_days (507 rows)
UNIQUE on (calendar_id, calendar_date). Duration semantics: **0=holiday** (436), **7=short day/7h** (67), **8=working Saturday** (4). Has audit columns.

### office_calendar (35 rows)
UNIQUE on (office_id, calendar_id, since_year). **Year-dependent mapping** — offices switched from Russia to country-specific calendars in 2024. Norm calculations must be year-aware.

## Statistics Module

### statistic_report (9,624 rows)
UNIQUE on (report_date, employee_login). Monthly pre-computed stats.
- **employee_login is TEXT, not FK** — requires join on login field (consistency risk)
- **report_date:** always 1st of month (24 distinct months: Jan 2025 - Dec 2026)
- **reported_effort:** decimal hours (0-374, avg 86.4) — unlike task_report which uses minutes
- **month_norm:** 0-184 hours
- **budget_norm:** often = month_norm, differs for 251 rows
- **comment:** effectively unused (0 non-empty values)
- 469 distinct employees across 24 months

## Test-Relevant Patterns

1. **Office-Calendar year mapping** — test calendar switches (Russia → country-specific in 2024)
2. **Dual period system** — REPORT always one month ahead of APPROVE per office
3. **Free-text project_member.role** — 100+ values, no validation
4. **statistic_report uses login not FK** — cross-service consistency risk
5. **Task name case-insensitive uniqueness** — `upper(name)` index
6. **task_report UNIQUE (task, executor, report_date)** — one report per task/person/day
7. **Calendar days: 0/7/8 only** — holiday/short/working Saturday
8. **Office ID 0 placeholder** — edge case for unassigned employees
9. **token_permissions has no constraints** — no PK, no FK, no indexes
10. **Project country data quality** — FR/Fra/Fr/fr inconsistency

Links: [[ttt-backend-schema-deep-dive]], [[admin-panel-deep-dive]], [[statistics-service-implementation]], [[cross-service-office-sync-divergence]]
