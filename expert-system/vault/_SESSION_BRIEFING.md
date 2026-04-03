# Session Briefing — Phase C (Autotest Generation)

## Last Session: 113 (2026-04-03)
**Phase:** C — Autotest Generation
**Scope:** vacation, day-off (`autotest.scope`)
**Target Env:** qa-1
**Mode:** Full autonomy

## Session 113 Accomplishments

### 1 Verified + 4 Blocked Vacation Tests
| Test ID | Title | Type | Priority | Status | Attempts |
|---------|-------|------|----------|--------|----------|
| TC-VAC-063 | Day correction AV=false prohibits negative balance | UI | P1 | verified | 3 |
| TC-VAC-064 | Create vacation → notification to approver | API | P2 | blocked | 2 |
| TC-VAC-065 | Approve vacation → notification to employee | API | P2 | blocked | 2 |
| TC-VAC-066 | Reject vacation → notification to employee | API | P2 | blocked | 2 |
| TC-VAC-067 | Cancel vacation → notification to approver | API | P2 | blocked | 2 |

### New Artifacts Created
- **Shared utility**: `e2e/data/vacation/queries/vacationNotificationQueries.ts` — reusable queries for notification tests (findNotificationEmails, getEmployeeNotifInfo, getDbTimestamp, getServerDate, findAvailableWeekFromServer)
- **4 data classes**: VacationTc064Data..VacationTc067Data — all use server clock date calculation via findAvailableWeekFromServer
- **4 spec files**: vacation-tc064..tc067.spec.ts — API-based notification verification tests
- **VacationTc063Data rewritten**: uses firstName/lastName fields, ORDER BY latin_last_name ASC for page-1 visibility
- **vacation-tc063.spec.ts rewritten**: removed search/filter, finds employee directly on page 1

### Key Discoveries & Fixes
1. **TC-VAC-063 autocomplete search pitfall**: VacationDayCorrectionPage's filterByEmployee() uses autocomplete — typing without selecting a suggestion clears the table to "No data". Fix: skip search entirely, pick alphabetically earliest AV=false employee (ORDER BY latin_last_name ASC LIMIT 1) who appears on page 1.
2. **TC-VAC-063 displayName format**: Page shows "LastName FirstName" format. Data class now stores firstName/lastName separately with computed displayName property.
3. **QA-1 notification infrastructure broken**: Vacation CRUD events do NOT generate notification emails on QA-1. The `ttt_email.email` table receives no new records after vacation create/approve/reject/cancel. Likely cause: RabbitMQ/EMAIL_ASYNC infrastructure not running on QA-1. The `notify-about-vacation-using-pst` test endpoint only triggers scheduled reminders (last day before absence), not CRUD event notifications.
4. **Email schema discovered**: `ttt_email.email` table: id(uuid), sender, receiver, cc, bcc, subject, body, status(NEW/SENT/FAILED/INVALID), error_message, add_time, sent_time. Subject format: `[QA1][TTT] <Russian text>`.
5. **Payment month validation boundary**: Office "Персей" approval period starts 2026-05-01. Vacations before May fail with `validation.vacation.dates.payment`. Notification tests use weeksAhead 6-9 to push dates into May+.
6. **Server clock for date calculation**: findAvailableWeekFromServer uses DB's CURRENT_DATE instead of local new Date() — critical for QA envs with manipulated test clocks.

### Vacation Module Autotest Progress
- Total tracked: 100 cases
- Verified: 39 (+4 since session 110, +1 this session)
- Blocked: 8 (+4 this session)
- Pending: 53
- Coverage: 39.0%

### Day-off Module Autotest Progress
- Total tracked: 28 cases
- Verified: 25
- Blocked: 3
- Pending: 0
- Coverage: 89.3% (fully covered minus blocked)

### Overall Autotest Progress
- Total: 332 cases
- Verified: 164
- Failed: 3
- Blocked: 14
- Pending: 151
- Coverage: 49.4%

### Next Session Priority
1. Vacation FIFO balance tests: TC-VAC-060 (earliest year consumed first), TC-VAC-061 (redistribution on cancel)
2. Vacation permissions: TC-VAC-085..090
3. Vacation regression: TC-VAC-071..084
4. Skip TC-VAC-068..070 (remaining notification tests — same QA-1 infra blocker)

## State
- Branch: dev35
- Config: `phase.current: "autotest_generation"`, `autotest.scope: "vacation,day-off"`
- All 39 verified vacation tests + 25 day-off tests pass reliably
- 4 notification tests (TC-VAC-064..067) have complete code but cannot verify on QA-1 — need RabbitMQ fix or timemachine env
