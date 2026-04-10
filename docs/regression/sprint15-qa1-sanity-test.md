# Sprint 15 — qa-1 Sanity Test Results

**Date executed:** 2026-04-09
**Environment:** qa-1 (`https://ttt-qa-1.noveogroup.com`)
**Deployed branch:** `pre-release/v2.1.26`
**Deployed version:** `2.1.26.LOCAL`

## Executive Summary

| Phase | Result | Notes |
|-------|--------|-------|
| 1 — Service liveness & version | ✅ PASS | All 5 services UP, version 2.1.26 confirmed |
| 2 — DB schema verification | ⚠️ PASS w/ findings | All 10 Sprint 15 migrations applied; 1 data anomaly (36× duplicate permission insert) |
| 3 — API reachability | ⚠️ PASS w/ findings | All probed endpoints respond; 1 NPE bug discovered (latent regression, narrow surface) |
| 4 — Vacation recalc AV=true/false | ✅ PASS | Both modes calculate correctly and recalc is idempotent |
| 5 — Sprint 15 features smoke | ⚠️ PASS w/ findings | #3353 individual norm works; PM Tool sync (#3093) has never run |

**Overall verdict:** Sprint 15 is **READY for further QA** on qa-1. The merge conflict resolution did not break vacation recalculation. Three issues warrant ticketing before promotion to stage.

---

## Phase 1 — Service Liveness & Build Version ✅

### 1.1 Rollback test endpoint
`GET /api/ttt/v1/test/rollback` →
```json
{"message": "Hello! This endpoint is used for testing rollback support implementation. Deployed version: LOCAL"}
```
✓ Endpoint exists (added in pre-release/v2.1.26).

### 1.2 Actuator health (all UP)
| Service | HTTP | Status | Build commit |
|---------|------|--------|--------------|
| ttt | 200 | UP | `d79ae75409` ← pre-release/v2.1.26 HEAD |
| vacation | 200 | UP | `63cfbe7abe` |
| calendar | 200 | UP | `63cfbe7abe` |
| email | 200 | UP | `63cfbe7abe` |
| gateway | 200 | UP | `${project.version}` (unresolved) |
| frontend | 200 | — | static SPA |

**FINDING 1.A (LOW) — Build version drift between services.** TTT service was rebuilt at the latest tip (`d79ae75409`), other services at `63cfbe7abe` (2 commits earlier). Diff between these commits is **CI/CD config files only** — no code changes, so functionally identical. Cosmetic only.

**FINDING 1.B (LOW) — Build number is `LOCAL` instead of CI build number.** All services report `version: 2.1.26.LOCAL`. Suggests an ad-hoc build, not a CI/CD pipeline build. Gateway also shows `${project.version}.LOCAL` — Maven properties not interpolated. Cosmetic only.

---

## Phase 2 — Database Schema Verification ⚠️

### 2.1 Flyway migration history
Queried `ttt_backend.schema_version` (legacy Flyway 3.x table). **All 10 Sprint 15 migrations present and `success=True`**, installed on 2026-04-09 10:21:

| Rank | Version | Description | Time |
|------|---------|-------------|------|
| 133 | 1.59 | create employee work period | 91ms |
| 134 | 2.1.25.20250101000000 | add entity to pm sync status | 117ms |
| 135 | 2.1.25.20250102000000 | rename pm id to pm tool id | 2102ms |
| 136 | 2.1.25.20250103000000 | add pm tool sync failed entity table | 22ms |
| 137 | 2.1.25.20250104000000 | fix pm sync status entity type and add indexes | 189ms |
| 138 | 2.1.26.202512011115 | add reported effort and month norm to statistic report | 12ms |
| 139 | 2.1.26.202601151522 | add statistics view permission to ttt token | 7ms |
| 140 | 2.1.26.202602021200 | add budget norm to statistic report table | 5ms |
| 141 | 2.1.26.20260206120000 | add pmt id to project | 5ms |
| 142 | 2.1.27.20260301000000 | create planner close tag table | 85ms |

Vacation schema also has 1 Sprint 15 migration: `2.1.26.202512161620 init java migration table`.

### 2.2 New tables on qa-1 vs stage
| Table | qa-1 | stage |
|-------|------|-------|
| `ttt_backend.employee_work_period` | ✓ exists | ✗ absent |
| `ttt_backend.planner_close_tag` | ✓ exists | ✗ absent |
| `ttt_backend.pm_tool_sync_failed_entity` | ✓ exists | ✗ absent |
| `ttt_backend.statistic_report.{reported_effort, month_norm, budget_norm}` | ✓ all 3 columns | ✗ none |
| `ttt_backend.project.pmt_id` | ✓ exists | ✗ absent |
| `ttt_backend.project.pm_tool_id` | ✓ (renamed from pm_id) | ✗ (still pm_id) |

### 2.3 NOT NULL columns on `statistic_report`
**Static analysis warned this migration would fail** (`reported_effort decimal(10,3) NOT NULL` without DEFAULT).

Reality on qa-1: **migration succeeded in 12ms**. Investigation:
- The `statistic_report` table was first created by migration `2.1.25.202510241205` on 2025-12-24
- It remained **empty** until migration `2.1.26.202512011115` was applied on 2026-04-09 10:21
- Therefore there were no rows to violate the NOT NULL constraint
- After the migration, the table was populated by the new sync service (current count: 9616 rows, 0 NULLs)

**FINDING 2.A (HIGH) — Static analysis warning is still valid for production.** On stage/prod, if `statistic_report` is populated **before** this migration runs, the migration will fail with `column "reported_effort" contains null values`. The qa-1 success was timing-dependent, not because the migration is safe. **Recommend:** add `DEFAULT 0` clause or backfill `UPDATE` before the `ALTER TABLE`.

### 2.4 Token permission insert
Migration: `INSERT INTO token_permissions (token, apipermission) SELECT id, 'STATISTICS_VIEW' ...` ran ONCE per Flyway log.

DB state: **Token 384 has the `STATISTICS_VIEW` permission row 36 times** (vs 1 row each for `CALENDAR_VIEW`, `VACATIONS_VIEW`).

**FINDING 2.B (MEDIUM) — Duplicate permission rows in `token_permissions`.** 36 identical `(token=384, apipermission='STATISTICS_VIEW')` rows. Not from Flyway (which logs only 1 application). Possible causes: manual DB intervention, repeated migration during a Flyway repair, or a startup-time seeder re-running. The table appears to lack a unique constraint on `(token, apipermission)`. Functionally harmless (token still has the permission), but indicates DB hygiene issue and a missing constraint.

---

## Phase 3 — API Reachability ⚠️

| Test | Result |
|------|--------|
| TTT `GET /v1/employees/current` | ✅ 200 — returns `pvaynmaster` |
| TTT `GET /v1/permissions` | ✅ 200 — `STATISTICS_VIEW` present |
| TTT `GET /v1/employees/achernishov/work-periods` | ✅ 200 — `[{"periodStart":"2026-01-19"}]` |
| TTT `GET /v1/reports/summary?login=...&date=...` | ✅ 200 |
| Vacation `GET /v1/vacationdays/{login}/years` | ✅ 200 |
| Vacation `GET /v1/vacations?employeeLogin=...` | ✅ 200 |
| Vacation `GET /v1/vacationdays/available` | ✅ 200 |
| Calendar (via swagger MCP) | ✅ MCP works |
| Email (via swagger MCP) | ✅ MCP works |

**FINDING 3.A (MEDIUM, downgraded from HIGH) — NPE on `GET /v1/vacationdays/{login}/years` when employee not found.**

`GET /v1/vacationdays/{login}/years` returns **HTTP 500** with a leaked Java stack trace whenever the path login does not exist in `ttt_vacation.employee`:

```
java.lang.NullPointerException: Cannot invoke "com.noveogroup.ttt.vacation.service.api.model.bo.employee.EmployeeBO.getId()" because "employee" is null
  at com.noveogroup.ttt.vacation.service.impl.employeeVacation.EmployeeDaysServiceImpl.getVacationDaysGroupedByYears(EmployeeDaysServiceImpl.java:204)
  at com.noveogroup.ttt.vacation.rest.controller.v1.VacationDaysController.getVacationDaysGroupedByYears(VacationDaysController.java:153)
```

**Repro (curl):**
```bash
curl -sk --noproxy '*' -H "API_SECRET_TOKEN: <token>" \
  "https://ttt-qa-1.noveogroup.com/api/vacation/v1/vacationdays/notexistuser/years"
# HTTP 500, body contains NullPointerException
```

**Expected:** HTTP 400 with `"Employee login not found"` (matching the sibling endpoint pattern).
**Actual:** HTTP 500 with stack trace exposing internal class names, source files, and line numbers.

**This is a regression.** All sibling endpoints in the same controller use the `@EmployeeLoginExists` validator and return clean HTTP 400. The `/years` endpoint was added without copying the annotation:

| Endpoint | Unknown login response | Validator |
|----------|------------------------|-----------|
| `/v1/vacationdays/{login}` | 400 "Employee login not found" | ✓ |
| **`/v1/vacationdays/{login}/years`** | **500 NPE** | **✗ MISSING** |
| `/v1/vacations/employee/{login}` | 400 "Employee login not found" | ✓ |
| `/v1/vacations?employeeLogin=...` | 400 validation error | ✓ |

**Severity revision:** initially classified HIGH on the assumption that 27 enabled qa-1 users would hit this naturally on `/vacation/my`. **Investigation showed all 27 are contractors**, who are blocked from reaching the buggy code path by three independent guards: the `VacationPermissionProvider` returns empty permissions for users not in the vacation service → `VACATIONS:VIEW` permission missing → both the navbar menu item AND the `/vacation/my` route guard hide the page (`<NotAuthorizedContainer />`).

**Realistic natural triggers (narrow):**
1. Race window during new regular-employee onboarding — between TTT auth sync and vacation sync, the user has menu access but the buggy endpoint NPEs
2. Stale frontend session after a CompanyStaff rename
3. Tampered request via DevTools / curl (security test)

**Today on qa-1:** zero non-contractor users in the vulnerable state (`SELECT count(*) FILTER (WHERE is_contractor = false) FROM ... WHERE NOT EXISTS in vacation = 0`).

**Severity:** downgraded to **MEDIUM** for runtime impact. Fix priority unchanged because:
- Information disclosure (CWE-209) — stack trace leakage applies regardless of trigger frequency
- One-line fix
- Latent bug that will surface immediately for any future race or rename glitch

**Fix:** add `@EmployeeLoginExists` to the `@PathVariable("login")` parameter in `VacationDaysController.java:152`.

**Detailed test cases:**
- `docs/regression/sprint15-bug-npe-vacation-days-years-ui-test.md` — TC-SA-NPE-001 (DevTools-based, no setup)
- `docs/regression/sprint15-bug-npe-vacation-days-years-blackbox-ui-test.md` — TC-SA-NPE-002 (synthetic black-box repro of the race scenario)

---

## Phase 4 — Vacation Recalculation: AV=true vs AV=false ✅

**Test employees:**

| Login | Office | AV | First date |
|-------|--------|----|-----|
| `achernishov` (id 990360) | Венера | **false** | 2026-01-19 |
| `azhiltsov` (id 3) | Нептун | **true** | (long-term) |
| `atynybaeva` (id 940) | (maternity, AV=false) | false | (maternity) |

### 4.1 — Calculate available paid days (May 2026, +1 day request)

| Employee | Vacation days by year | Available paid days | Formula check |
|----------|----------------------|---------------------|---------------|
| `achernishov` (AV=false) | 2026: 23, 2027: 24 | **9.0** | 23 + 0 − 24 + (5×24/12) = **9** ✓ |
| `azhiltsov` (AV=true) | 2025: 4.688, 2026: 21, 2027: 21 | **25.688** | 21 + 4.688 = **25.688** ✓ (no accrual subtraction) |
| `atynybaeva` (maternity) | 2023: 22 | **22.0** | sum of all years = **22** ✓ (maternity branch) |

✅ **All three formulas match exactly.** This proves:
- `RegularCalculationStrategy` (AV=false) correctly applies the accrual reduction `+ accruedDays - normDays`
- `AdvanceCalculationStrategy` (AV=true) correctly returns `currentYearDays + pastYearDays` without accrual
- `VacationAvailabilityChecker` correctly bypasses both strategies for maternity employees and returns the cross-year sum

### 4.2 — Recalculation idempotency

`POST /v1/test/employees/{id}/vacations/recalculate` invoked for both AV modes:

| Step | achernishov years | achernishov avail | azhiltsov years | azhiltsov avail |
|------|------|------|------|------|
| Before recalc | 23/24 | 9.0 | 4.688/21/21 | 25.688 |
| Recalc HTTP | 200 | — | 200 | — |
| After recalc | 23/24 | 9.0 | 4.688/21/21 | 25.688 |

✅ **Both recalcs are perfectly idempotent.** No drift, no errors. The merge conflict resolution did NOT break:
- Strategy selection in `VacationRecalculationServiceImpl.recalculate()`
- DI wiring of `VacationAvailabilityChecker`
- Transaction boundaries in either calculation path

---

## Phase 5 — Sprint 15 Feature Smoke ⚠️

### 5.1 Individual norm with work periods (#3353) ✅

`GET /v1/reports/summary?login=achernishov&date=2026-01-31` →
```json
{
  "week": {"reported": 2.0, "personalNorm": 40, "norm": 40, "personalNormForDate": 40, "normForDate": 40},
  "month": {"reported": 6.0, "personalNorm": 80, "norm": 160, "personalNormForDate": 80, "normForDate": 160}
}
```

✅ For `achernishov` (hired 2026-01-19), January personal norm is **80h** (half of office norm 160h) — `effectiveBounds()` is correctly clamping the period to start from hire date.

For `pvaynmaster` (long-term employee, same date) personal norm is `112` and office norm is `168` (both reduced from full 168 due to vacation/holiday time-offs). Distinct from achernishov, confirming the new logic is active.

### 5.2 Pre-hire date guard (TC-SA-033) ✅

`GET /v1/reports/summary?login=achernishov&date=2026-01-15` (hired 2026-01-19) →
```json
{
  "week": {"reported": 0.0, "personalNorm": 0, "norm": 40, "personalNormForDate": 0, "normForDate": 32},
  "month": {"reported": 6.0, "personalNorm": 80, "norm": 160, "personalNormForDate": 0, "normForDate": 72}
}
```

✅ `personalNormForDate: 0` correctly returned for a pre-hire date — the safety guard `if (effectiveStart.isAfter(endForDate)) normForDate = Pair.of(0L, 0L)` is working.

### 5.3 Employee work period table population ✅

`SELECT count FROM employee_work_period;` → **1664 employees** (400 active + 1264 dismissed)

`achernishov` row: `(period_start=2026-01-19, period_end=NULL)` — correct (active employee).

CS sync has populated this table successfully.

### 5.4 PM Tool sync (#3093) ⚠️

`SELECT * FROM pm_sync_status` → **0 rows**
`SELECT * FROM pm_tool_sync_failed_entity` → **0 rows**

**FINDING 5.A (MEDIUM) — PM Tool sync has never run on qa-1.** This is a key Sprint 15 feature (#3093 PM Tool integration), but no sync execution is recorded. Possible causes:
- Sync scheduler is disabled in qa-1 config
- PM Tool URL/credentials not configured for qa-1
- Sync hasn't fired yet since deployment (deployed 2026-04-09 10:21, ~7h ago — should have triggered by now)

**Recommendation:** trigger sync manually via test endpoint and verify behavior, OR check qa-1 application logs for scheduler errors.

### 5.5 Close-by-tag (#2724) ℹ️

`SELECT count FROM planner_close_tag` → **0 rows**

Table exists and is queryable; no tags configured yet (expected for fresh deployment).

---

## Findings Summary

| ID | Severity | Area | Description | Action |
|----|----------|------|-------------|--------|
| 2.A | **HIGH** | DB migration | `statistic_report` NOT NULL columns will fail on any environment where the table has data before migration runs | Add `DEFAULT 0` to migration before promoting to stage |
| 3.A | MEDIUM (was HIGH) | Vacation API | NPE in `EmployeeDaysServiceImpl.java:204` when employee not found; missing `@EmployeeLoginExists` validator on `VacationDaysController.java:152`; sibling endpoints all have it. Affected user population today: 0 (the 27 missing-from-vacation users are all contractors, blocked by 3 permission/route guards from reaching the page). Latent regression — fix is one annotation. | Add `@EmployeeLoginExists` validator |
| 2.B | MEDIUM | DB hygiene | 36 duplicate `STATISTICS_VIEW` rows for token 384; missing unique constraint on `token_permissions` | Add `UNIQUE (token, apipermission)` and de-dup |
| 5.A | MEDIUM | PM Tool sync | Has never run on qa-1; `pm_sync_status` empty | Verify scheduler config / trigger manually |
| 1.A | LOW | Build versioning | Service builds drift by 2 CI commits (cosmetic) | Rebuild all services from same commit |
| 1.B | LOW | Build versioning | Build number is `LOCAL`, gateway has unresolved Maven properties | Use CI pipeline for builds |

## Cross-reference to Static Analysis (`sprint15-static-analysis.md`)

| Static finding | Live test result |
|----------------|------------------|
| 1.1 NOT NULL migration without DEFAULT | **CONFIRMED** as latent issue (succeeded on qa-1 due to empty table only) |
| 1.2 Shared mutable eventPayload race condition | Not directly testable in sanity scope; needs targeted concurrency test |
| 1.3 Double VacationUpdatedEvent | Not exercised in this run; vacation update flow not tested |
| 1.4 Statistics request batching removed | Not tested (UI-level concern) |
| 1.5 effectiveBounds dependency on employee_work_period | **CONFIRMED WORKING** — table populated, mid-month hire prorated correctly |
| 1.6 Project patch reduced to 3 fields | Not tested in this run |
| 2.4 Statistics tab-specific absence logic | Not tested (UI-level concern) |
| New finding 3.A (NPE) | **NEW** — surfaced during API probe, not in static analysis |

## Recommendations

1. **Before promoting to stage:** fix the `statistic_report` migration (add `DEFAULT 0`) and the `EmployeeDaysServiceImpl` NPE.
2. **During further qa-1 testing:** trigger PM Tool sync manually and verify it succeeds; exercise vacation create/update flows to test the static-analysis-flagged race condition.
3. **DB hygiene:** clean up the 35 duplicate `STATISTICS_VIEW` rows for token 384 and add a unique constraint to `token_permissions`.
4. **Build process:** rebuild all services from the same commit before final stage promotion.
