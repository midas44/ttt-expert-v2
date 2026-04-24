---
type: module
tags:
  - cross-service
  - integration
  - rabbitmq
  - companystaff
  - websocket
  - trackers
  - pm-tool
  - sync
  - email
created: '2026-04-02'
updated: '2026-04-02'
status: active
related:
  - '[[ttt-cs-sync]]'
  - '[[cross-service-office-sync-divergence]]'
  - '[[pm-tool-sync-implementation]]'
  - '[[pm-tool-integration-deep-dive]]'
  - '[[exploration/tickets/cross-service-ticket-findings]]'
branch: release/2.1
---
# Cross-Service Integration Architecture

TTT operates as a constellation of 4 services (TTT backend, vacation service, calendar service, email service) plus external integrations (CompanyStaff, PM Tool, trackers). This note covers the integration patterns, failure modes, and testable scenarios.

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TTT Frontend (React SPA)                   │
│  WebSocket (STOMP + SockJS) ◄────┐                           │
└─────────────┬───────────────────┬┘                           │
              │ REST              │ REST                       │
     ┌────────▼────────┐  ┌──────▼───────┐                    │
     │   TTT Backend   │  │  Vacation    │  ┌──────────────┐  │
     │   (ttt_backend)  │◄►│  Service     │  │  Calendar    │  │
     │                  │  │ (ttt_vacation)│◄►│  Service     │  │
     │  Tasks, Reports  │  │ Vacations,   │  │ Working days │  │
     │  Statistics,     │  │ Sick leaves, │  │ Office cals  │  │
     │  Employees, API  │  │ Day-offs     │  └──────────────┘  │
     └───────┬──────────┘  └──────┬───────┘                    │
             │                    │                            │
             │    RabbitMQ        │                            │
             │◄───────────────────►                            │
             │                                                 │
     ┌───────▼──────────┐  ┌──────────────┐  ┌──────────────┐ │
     │  Email Service   │  │  CompanyStaff │  │   PM Tool    │ │
     │  (MQ consumer)   │  │  (REST API)   │  │  (REST API)  │ │
     └──────────────────┘  └──────────────┘  └──────────────┘ │
```

## 1. CompanyStaff (CS) Synchronization — Most Fragile Integration

### Sync Mechanisms
Three parallel sync mechanisms, each with known failure modes:

**A. Periodic Cron Sync:**
- Schedule: Daily at 3:00 AM (configurable via `${companyStaff.sync.cron}`)
- ShedLock prevents duplicate execution across instances
- Scope: incremental (delta) since March 2023 — full sync was removed (#2989)
- **Runs in ALL 3 services** independently: TTT, vacation, calendar each have `CSSalaryOfficeSynchronizer`
- Tracked via `cs_sync_status` table

**B. Startup Sync:**
- `employee_projects` sync runs once tracked via `java_migration` table (#3303)
- After initial run, only cron triggers
- If the initial sync fails, it retries on next startup

**C. Event-Based (RabbitMQ):**
- CS publishes events on employee/office changes
- TTT consumes and applies incrementally
- **Acknowledged risk (#3262):** Events can be lost after acknowledgment — MQ doesn't store after ACK. Periodic re-sync at 3 AM is the safety net.

### What CS Syncs
| Data | TTT Field | Known Issues |
|------|-----------|-------------|
| Employee profile | login, name, officeId, managerId | #2153: different csId across envs |
| Salary office | office table | #3241: new SO creation broken, only updates work |
| Manager hierarchy | employee.manager_id | #1892: self-referencing manager crashes sync |
| Employment dates | employee.first_date, last_date | #3374: last_date not updated during sync |
| Contract status | enabled, contractor flags | #2969: contractor SO transfer not synced |
| Roles | employee_global_roles | #2063: cache staleness after sync |
| Office settings | advance_vacation, yearly_accrual | #3092: advanceVacation flag, #3103: accrual setting |

### CS Sync Failure Patterns (15+ tickets)
| Failure Pattern | Tickets | Impact | Severity |
|----------------|---------|--------|----------|
| Silent cron failure | #2496 | Sync stops, no alert | High |
| Returns 200 on internal error | #2969 | Data loss undetected | High |
| Self-referencing manager | #1892 | Reports/approval break | Critical |
| NULL office_id in data | #3236 | HTTP 500 errors | High |
| Employee stuck in old state | #2953 | "In maternity" for months | High |
| Different csId across envs | #2153 | Sync failures after migration | High |
| Department data divergence | #2525 | Statistics show wrong departments | Medium |

**Key insight:** Delta sync (#2989) doesn't guarantee consistency because:
1. CS can change data without updating timestamps
2. RabbitMQ events can be lost after acknowledgment
3. Full sync was removed in March 2023 — no recovery mechanism except manual intervention

### Three-Service Sync Divergence
TTT, vacation, and calendar services each sync from CS independently. The office sync across these 3 services can diverge: [[cross-service-office-sync-divergence]] documents cases where `ttt_backend.office` has different data than `ttt_vacation.office` for the same salary office. This causes cascading inconsistencies in norm calculations, vacation day accruals, and calendar assignments.

## 2. RabbitMQ Integration

### Event Types and Flows

**TTT → Vacation Service:**
- Task report changes → statistic_report recalculation
- Employee project assignments → project-employee sync

**Vacation → TTT:**
- Vacation/sick-leave create/change/delete → statistic_report norm recalculation
- Day-off changes → norm recalculation

**Calendar → Vacation:**
- Calendar day changes → working day recalculation → vacation day/norm cascade
- Calendar delete events → day-off conflict resolution, absence rescheduling

**Any service → Email Service:**
- Notification events → email queue → SMTP delivery

### Known RabbitMQ Issues

**Hours-long email delays (#2518):** After migration from sync REST to async MQ, emails experience multi-hour delays. Chronological ordering is broken — notification sent at 10 AM may arrive after one sent at 2 PM.

**Event loss accepted (#3262):** "Cannot guarantee all events processed correctly, MQ doesn't store after ack." The 3 AM re-sync is the safety net. **Between midnight and 3 AM, stale data may exist.**

**Sync migration instability (#2530):** Migration from sync REST to async RabbitMQ for TTT↔vacation communication caused 500 errors and missing manager data during transition.

**Calendar→vacation cascade (#2364):** Calendar changes trigger vacation day recalculation via RabbitMQ (was previously sync REST). If the MQ event is lost, vacation days aren't recalculated until the next 3 AM sync.

## 3. WebSocket (Planner Real-Time)

### Architecture
- Protocol: STOMP over SockJS
- 12 event types across 5 topics per user/project
- Events: TASK_RENAME, ASSIGNMENT_PATCH, SYNC, etc.
- Subscription: `/topic/projects/{id}/tasks`, `/user/queue/notifications`

### Known Issues

**JWT Expiry (#2270):** JWT has 1-day expiry with no refresh mechanism. When token expires during a WebSocket session:
- WebSocket connection drops
- Frontend falls back to polling `/v1/authentication/check` every 5 seconds
- This polling-based workaround is not robust for long sessions

**Missing Data in Events (#1258):** PATCH events via WebSocket lack assignment ID — receiver cannot determine which specific assignment was updated. Workaround: `AssignmentDTO.updatedTime` field added for offline editing timestamp comparison (#1201).

**Offline Reconciliation (#1949 OPEN):** Need SYNC events for offline-to-online reconciliation. Currently only TASK_RENAME events sent to project topic.

## 4. Tracker Integrations

### Supported Trackers (7 types)
| Tracker | Auth Method | Status | Key Issues |
|---------|-------------|--------|------------|
| Jira Cloud | OAuth | Working | |
| Jira Server | Login/password | Broken (#3161) | Routing through foreign VPN |
| Jira Server (PAT) | Personal Access Token | Broken (#2511) | "Wrong server" error |
| ClickUp | API key | Partially working | #3341: specific spaces fail |
| YouTrack | Token | Working (#3145) | 18 comments on integration |
| Asana | Custom sync | Working (#2119) | External script, not in codebase |
| GitLab | Token | Working | |

### Architecture
- `TrackerClientFactory` → creates tracker-specific HTTP clients
- `IssueTrackerService` → manages tracker tasks
- `LoadFromTrackerCommand` / `SendToTrackerCommand` — command pattern for work log sync
- `EmployeeTrackerCredentialsController` — per-employee credential management

### Known Issues
- #3198: Multiple projects with same tracker workspace → task search breaks (namespace collision)
- #3378: Custom sync scripts stored externally → need migration to TTT codebase
- #3296: Approved status not cleared after tracker import (stale approvals)
- #1174: HTTP proxy for trackers — security concern: HTTPS proxy not implemented (#1305), keys would be in cleartext
- #2039: No error message for inaccessible tracker API

## 5. PM Tool Integration (Sprint 15+ — Active Development)

### Sync Architecture
```
PmToolSyncScheduler (cron: ${pmTool.sync.cron})
  → PmToolSyncLauncher.sync(false)  // incremental
    → PmToolSyncService.sync(fullSync=false)
      → PmToolEntitySyncLauncher.sync(PAGE_SIZE=100, fullSync)
        → Guava RateLimiter (50 req/min default)
        → Paginated fetch from PM Tool API
        → Per-entity async processing
        → Failed entity retry (batch size: 10)
```

### Key Design Decisions
- TTT no longer creates projects — PM Tool is the source of truth
- TTT retains: accounting name (set once), tracker fields, change history (tracker-related only)
- PM Tool syncs: name, customer, country, supervisor, manager, owner, watchers, status, type, model, presales IDs
- **Scale mismatch:** PM Tool has 501 projects vs TTT's 3137 — PM Tool only manages a subset

### Failed Entity Handling
1. On timeout/error: entity ID saved to `pm_tool_sync_failed_entity` table
2. After main sync: retry failed IDs in configurable batches
3. On success: remove from failed repository
4. Acceptance criteria (#3382): no failed entities in table after sync

## 6. Application Stability Under Integration Load

### Concurrent Sync Crash (#3023 CRITICAL)
- App hangs with >30 concurrent threads (JMeter)
- Multiple sequential full CS syncs crash vacation service
- Root cause: DB connection pool exhaustion (`HikariCP` default pool size too small for concurrent sync + normal operations)

### Test Clock Corruption (#2629)
- Time travel (test clock manipulation via `PATCH /api/ttt/v1/test/clock`, see [[patterns/test-clock-control]]) can corrupt `cs_sync_status` table
- Moving time **backward** creates duplicate status records — forward-only shifts avoid this
- **Vacation service crashed** in the #2629 incident after the corrupted table was cleared
- Test data: clock manipulation is available on every non-production env but tests must reset the clock after use and prefer forward-only shifts to avoid this sync-tracking hazard

### Browser Memory (#2865)
- Project assignments tab causes browser to run out of memory (5-8GB)
- Root cause: 1000 simultaneous API requests fired on tab open
- Not a backend issue but affects integration testing with real browser

## 7. Email Service Integration

### Architecture
- Async via RabbitMQ (migrated from sync REST)
- Email service consumes notification events from MQ queue
- Templates rendered by email service
- SMTP delivery

### Known Issues
- #2518: Hours-long delays after MQ migration, chronological ordering broken
- #3281: Specific notification (ID_85) not reaching recipients
- Notification IDs are integer-based (e.g., ID_85, ID_105, ID_107-111)

## 8. Cross-Service Test Scenarios

### Data Consistency Tests
1. Create vacation → verify statistic_report updated within 5 minutes (MQ event)
2. Change calendar → verify vacation day recalculation propagated
3. CS sync → verify employee data consistent across all 3 services
4. Delete calendar event → verify ONLY affected calendar's employees impacted

### Failure Recovery Tests
1. Stop vacation service → create task report → restart → verify statistic_report eventually consistent
2. Simulate MQ event loss → verify 3 AM re-sync corrects stale data
3. CS sync with invalid data (NULL office_id) → verify error handling, valid records still processed
4. PM Tool rate limit (429) → verify retry with backoff

### Race Condition Tests
1. Concurrent statistic_report updates from MQ and task report event
2. Multiple CS syncs running simultaneously
3. Calendar change during vacation creation

Links: [[ttt-cs-sync]], [[cross-service-office-sync-divergence]], [[pm-tool-sync-implementation]], [[pm-tool-integration-deep-dive]], [[exploration/tickets/cross-service-ticket-findings]]


## Sprint 15-16 Cross-Service Updates (Session 98)

### Confirmation-Statistics Cross-Service Bug (#3368)
- "Confirmation > By Projects" page calls `ttt/v1/statistic/report/employees` → shows over/under report notification
- "Confirmation > By Employee" page does NOT call this API → notification missing
- Frontend integration gap: statistics data not fed into confirmation page variant

### CS Sync Updates
- **#3374** (Sprint 15): `last_date` field in `ttt_vacation.employee` not updated during CS sync
- **#3303** (Sprint 15): Implement sync procedure on application startup
- **#3072** (Sprint 15): Remove CS v1 API support (cleanup)

### PM Tool Cross-Service
- **#3412**: Change API parameter from `token` to `api_token` — API contract change
- **#3382**: Change PM Tool integration API endpoints — another API contract change
