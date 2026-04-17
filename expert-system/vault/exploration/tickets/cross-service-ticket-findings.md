---
type: exploration
tags: [cross-service, tickets, bugs, sync, rabbitmq, companystaff, websocket, trackers, integration, pm-tool]
created: 2026-04-02
updated: 2026-04-02
status: active
related: ["[[cross-service-integration]]", "[[cross-service-office-sync-divergence]]", "[[ttt-cs-sync]]", "[[pm-tool-sync-implementation]]", "[[pm-tool-integration-deep-dive]]"]
branch: release/2.1
---

# Cross-Service Integration — GitLab Ticket Findings

**Source:** ~75 unique tickets mined across searches: RabbitMQ, CompanyStaff, CS sync, WebSocket, STOMP, integration, event, microservice.

## 1. CompanyStaff (CS) Synchronization — Most Fragile Integration

### Sync Failures

| Ticket | Status | Issue | Severity |
|--------|--------|-------|----------|
| #2496 | closed | Cron-based sync silently stopped on dev/stage/qa-1. Manual trigger worked. | High |
| #2969 | closed | Contractor salary office transfer not synced. Sync returns 200 on internal failure. | High |
| #1892 | closed | Self-referencing manager in CS breaks TTT sync completely (reports/approval stop working) | Critical |
| #2953 | closed | Employee returned from maternity but TTT still showed "in maternity" — sync stopped for months | High |
| #3241 | closed | New SO created in CS doesn't appear in `ttt_backend.office`. Only creation broken. | High |
| #3374 | OPEN | `last_date` not updated during CS sync | Medium |
| #2153 | closed | Dev/prod CS had different csId for same login → sync failures after migration. Changed key to login. | High |
| #2525 | closed | Statistics department projects wrong because TTT department data diverged from CS | Medium |
| #2381 | closed | CS sync endpoint and office list returning 500 (data inconsistency) | High |

### CS API Integration

| Ticket | Status | Issue |
|--------|--------|-------|
| #2474 | closed | Major migration to new CS API — 43 comments, extensive testing |
| #1414 | closed | Earlier CS API integration attempt |
| #2989 | OPEN | Delta sync doesn't guarantee consistency (events lost, data changes without timestamp update). Full sync removed March 2023. |
| #3236 | OPEN | Validate CS data during sync, skip invalid records (NULL office_id → 500) |
| #3303 | OPEN | Startup sync runs once (tracked via java_migration table), then cron at 3 AM |

### CS Settings Sync

| Ticket | Status | Issue |
|--------|--------|-------|
| #2983 | closed | Migrate SO settings from TTT DB to CS (vacation/sick-leave notifications, days count, overtime) |
| #3092 | closed | advanceVacation flag from CS controls advance vacation pay — 36 comments |
| #3103 | closed | Yearly accrual setting not syncing from CS |
| #3068 | OPEN | "Months before first vacation" CS setting not implemented |

**Key insight:** CS sync is event-based (RabbitMQ) with periodic full sync as fallback. Between syncs, data can diverge. At least 15 tickets document sync failures.

## 2. RabbitMQ / Message Broker

### Event-Driven Architecture Issues

| Ticket | Status | Issue | Severity |
|--------|--------|-------|----------|
| #2530 | closed | Migration from sync REST to async RabbitMQ for TTT↔vacation. 500 errors and missing manager data during transition. | High |
| #2364 | closed | Calendar changes → vacation recalculation moved to RabbitMQ (was sync REST) | Medium |
| #2518 | closed | Email via MQ: **hours-long delays** in delivery. Chronological ordering broken. | High |
| #3303 | OPEN | Employee project sync at startup + periodic. Events can be lost when acknowledged. | High |
| #3262 | closed | Acknowledged risk: "cannot guarantee all events processed correctly, MQ doesn't store after ack." Periodic re-sync at 3 AM as fallback. | High |

**Known accepted risk:** RabbitMQ event loss is acknowledged (#3262). The 3 AM re-sync is the safety net. Between midnight and 3 AM, stale data may exist.

## 3. WebSocket / Planner Real-Time

| Ticket | Status | Issue |
|--------|--------|-------|
| #1949 | OPEN | WS events for TASK_RENAME sent to /topic/projects/{id}/tasks. Need SYNC events for offline-to-online reconciliation. |
| #1258 | closed | PATCH event via WS lacks assignment ID — receiver can't determine which assignment updated |
| #1201 | closed | Added `AssignmentDTO.updatedTime` for offline editing timestamp comparison |
| #1060 | closed | Gateway updated for WS stability, assignment API reviewed |
| #2270 | closed | JWT expiry breaks WS reconnection → polling /v1/authentication/check every 5s |

## 4. Tracker Integrations

### Jira

| Ticket | Status | Issue |
|--------|--------|-------|
| #3161 | closed | Jira Server integration broken — routing through foreign VPN |
| #2511 | OPEN | Jira PAT auth broken — "wrong server" error. Blocks Seagate projects. |
| #2571 | OPEN | Need PAT auth support for Jira Server (not just login/password) |
| #2468 | OPEN | Invalid credentials cause cascading errors, inadequate error messages |
| #2072 | closed | REST API blocked on Jira side. Tracker must be configured by project SPM. |

### ClickUp

| Ticket | Status | Issue |
|--------|--------|-------|
| #3148 | closed | ClickUp export completely broken on prod |
| #3341 | OPEN | Tasks from one ClickUp space don't add (space-specific) |
| #2397 | closed | Full ClickUp integration — 37 comments on API quirks |
| #3237 | closed | API domain change |

### Other Trackers

| Ticket | Status | Issue |
|--------|--------|-------|
| #3145 | closed | YouTrack integration added — 18 comments |
| #2119 | closed | Asana integration via custom sync script |
| #3198 | OPEN | Multiple projects with same tracker → task search breaks |
| #3378 | OPEN | Custom sync scripts stored externally — needs migration to TTT codebase |
| #3296 | OPEN | Approved status not cleared after tracker import (stale approvals) |
| #1174 | closed | HTTP proxy for trackers. Security concern: "prohibit https proxy — keys in cleartext" |
| #1305 | OPEN | HTTPS proxy not implemented (SSL cert handling needed) |

## 5. Application Stability Under Sync Load

| Ticket | Status | Issue | Severity |
|--------|--------|-------|----------|
| #3023 | OPEN | App hangs with >30 concurrent threads (JMeter). Multiple sequential full CS syncs crash vacation service. DB connection pool exhaustion. | Critical |
| #2629 | closed | Time travel (test clock) corrupts cs_sync_status table. Moving time backward creates duplicates. **Vacation service crashed** after table cleared. | High |
| #2865 | closed | Browser runs out of memory (5-8GB) on project assignments tab. 1000 simultaneous requests. | High |

## 6. PM Tool Integration (Sprint 15+)

| Ticket | Status | Issue |
|--------|--------|-------|
| #3382 | OPEN | Too many project IDs → 422. Need pagination. |
| #3387 | OPEN | Two ID fields: pm_tool_id (TTT→PM Tool) vs pmt_id (PM Tool's PK). 501 vs 3137 project mismatch. |
| #3389 | OPEN | Filter employees with "sales" type during sync. |
| #3399 | OPEN | 429 Too Many Requests from PM Tool (60 RPM limit). |
| #3401 | OPEN | Rate limiter needed on TTT side. |

## 7. Email Service

| Ticket | Status | Issue |
|--------|--------|-------|
| #2518 | closed | Hours-long email delays after RabbitMQ migration. Chronological ordering broken. |
| #3281 | closed | Specific notification (ID_85) not reaching recipients |

## Summary — Top Integration Test-Worthy Findings

1. **CS sync reliability** — most fragile integration. 15+ tickets document failures. Every CS-synced field (office, manager, roles, salary office settings, contract dates) needs regression tests.
2. **RabbitMQ event loss** — acknowledged and accepted risk (#3262). Between 3 AM syncs, data can be stale. Test: what happens when event lost during vacation/report/calendar change.
3. **Email delays** (#2518) — hours-long delays via RabbitMQ. Affects time-sensitive notifications.
4. **WebSocket JWT expiry** (#2270) — polling-based workaround, not robust. Test: planner open overnight → token expires.
5. **Tracker auth diversity** — each tracker (Jira Cloud/Server, ClickUp, Asana, YouTrack) has unique auth. Jira PAT broken (#2511, #2571).
6. **Application crash under sync load** (#3023) — DB connection pool exhaustion with concurrent syncs.
7. **Test clock corrupts sync state** (#2629) — time manipulation breaks cs_sync_status table.
8. **PM Tool integration** — rate limiting, project ID mismatch, employee type filtering. Active development area.
