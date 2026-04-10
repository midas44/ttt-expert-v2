---
type: exploration
tags: [security, tickets, bugs, authorization, authentication, JWT, permissions, RBAC, access-control]
created: 2026-04-02
updated: 2026-04-02
status: active
related: ["[[security-patterns]]", "[[auth-authorization-doc]]", "[[role-permission-matrix]]"]
branch: release/2.1
---

# Security — GitLab Ticket Findings

**Source:** ~85 unique tickets mined across searches: authentication, authorization, JWT, token, permission, role, 403, forbidden, security, авторизация. No results for XSS/injection/CSRF/RBAC.

## 1. API-Level Authorization Bypass (SYSTEMIC PATTERN)

Multiple tickets show UI correctly hides features but API endpoints lack authorization checks:

| Ticket | Status | Issue | Severity |
|--------|--------|-------|----------|
| #1250 | closed | Employee redirects own vacation request via API (not possible via UI) | High |
| #1292 | closed | Manager cancels vacation via API (should only approve/reject) | High |
| #117 | closed | ANY user with right role can approve ANY request — approver field decorative | Critical |
| #736 | closed | Employee sees other employees' reports via GET /v1/reports | High |
| #2181 | closed | GET /projects/{id}/events accessible to ALL users | Medium |
| #870 | closed | "Show tasks from other projects" checkbox leaks approval to foreign projects | High |
| #2136 | closed | Project owner edits fields beyond permission (manager/SPM fields) | Medium |
| #2127 | closed | Can assign ROLE_EMPLOYEE as PM/SPM via PATCH /projects | Medium |
| #2046 | closed | Non-manager assignable as senior manager via POST /projects | Medium |
| #3002 | closed | PROJECT_MANAGER can edit sick leave records via API (accountant-only) | High |
| #2102 | closed | VIEW_ALL role accesses Export menu (gets corrupt file) | Medium |
| #2103 | closed | Manager accesses Export via direct URL bypass | Medium |
| #3012 | closed | Regular employees access /accounting/sick-leaves route | High |
| #1430 | closed | Autocomplete shows tasks from inaccessible projects | Medium |
| #3410 | OPEN | User gets 403 on task creation (active bug) | Medium |

**Pattern:** UI hides button/link → API endpoint still accessible → no server-side authorization check. This is the #1 security testing priority.

## 2. Cross-Office Data Leakage

| Ticket | Status | Issue |
|--------|--------|-------|
| #959 | closed | ADMIN and CHIEF_ACCOUNTANT see only own office vacations (should see all) |
| #2050 | closed | OFFICE_DIRECTOR sees employees from ALL offices (should see own only) |
| #480 | closed | Office accountant views/modifies vacation days for other offices |
| #479 | closed | Office accountant sees report periods for all offices |
| #482 | closed | Regular employee accesses Employees & Contractors admin page |
| #2196 | closed | 403 on customer search for manager's project (fix: return 206 for partial) |

**Pattern:** office-scoped access control frequently broken — roles see data from other offices.

## 3. Incorrect Error Codes (403 vs 500)

| Ticket | Status | Issue |
|--------|--------|-------|
| #1286 | closed | Day correction: 500 instead of 403 (inter-service call masks error) |
| #1883 | closed | PATCH/DELETE on tokens/settings: 500 instead of 403 |
| #2164 | closed | GET /projects/{id}: 400 instead of 403 |
| #2131 | closed | DELETE /projects/{id}: wrong HTTP status on invalid ID |

**Pattern:** authorization failures return 500/400 instead of 403 — hard to distinguish from server errors.

## 4. Role Assignment via CS Sync (Fragile)

| Ticket | Status | Issue |
|--------|--------|-------|
| #807 | closed | DEPARTMENT_MANAGER role not assigned (manager hierarchy logic) |
| #522 | closed | OFFICE_DIRECTOR role not assigned (CS sync delay) |
| #451 | closed | PROJECT_SENIOR_MANAGER and PROJECT_OBSERVER never populated |
| #293 | closed | Observer in project but ROLE_PROJECT_OBSERVER absent |
| #2063 | closed | /v1/employees and /v1/employees/{login}/roles return contradictory data (cache) |

**Pattern:** role propagation from CS is asynchronous and fragile — roles may be stale or missing after sync.

## 5. JWT/Authentication Issues

| Ticket | Status | Issue |
|--------|--------|-------|
| #64 | closed | Inter-service auth failed (system jobs had no JWT) → moved to External-API with API-key |
| #2270 | closed | JWT expiry → WebSocket reconnection loops → fix: poll /v1/authentication/check every 5s |
| #1275 | closed | Deactivated user login → infinite 500-loop requesting JWT → propose 412 |
| #1262 | closed | Inconsistent auth error behavior across envs (dev loops, preprod redirects to CAS) |
| #1231 | closed | API_TOKEN: 400 on notifications/tokens/periods (restricted by design, misleading error) |
| #692 | closed | API key auth from Swagger UI broken |
| #1865 | closed | Token not returned for user (migration failure) |
| #1067 | closed | Flutter app: added /jwt endpoint that redirects to CAS |
| #3217 | closed | Test env login page: login-only, no password (deferred — move to foreign server) |

## 6. Permission System Architecture (Reference)

| Ticket | Info |
|--------|------|
| #416 | Core RBAC for projects |
| #412 | Core RBAC for task reports |
| #430 | PermissionDTO architecture |
| #506 | API_TOKEN permission model |
| #1133 | Office-scoped access for OFFICE_DIRECTOR |
| #1946 | OPEN — permissions for TECH_LEAD, SPM, OWNER not fully documented |
| #2135 | EXPORT_EMPLOYEES_LARGEST_CUSTOMERS added to STATISTICS class |

## Summary — Top Security Test-Worthy Findings

1. **API authorization bypass** — systemic issue. Test EVERY endpoint accessible via API against the role-permission matrix. UI hiding is NOT sufficient.
2. **Cross-office data leakage** — office-scoped roles frequently see data from other offices. Test all office-filtered endpoints with multi-office scenarios.
3. **Role assignment via CS sync** — roles can be stale/missing. Test behavior when CS sync is delayed or fails.
4. **JWT lifecycle** — expired tokens cause loops (#1275), WebSocket breaks (#2270). Test token expiry, refresh, and disabled user flows.
5. **Error code consistency** — authorization failures sometimes return 500/400. Test all 403-expected scenarios.
6. **Permission documentation gaps** (#1946) — TECH_LEAD, SPM, OWNER permissions not fully documented. Risk of untested permission combinations.
