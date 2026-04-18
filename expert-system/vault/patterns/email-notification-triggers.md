---
type: pattern
tags:
  - email
  - notifications
  - rabbitmq
  - scheduling
  - cross-service
created: '2026-03-13'
updated: '2026-04-17'
status: active
related:
  - '[[rabbitmq-messaging]]'
  - '[[EXT-cron-jobs]]'
  - '[[ttt-service]]'
  - '[[vacation-service]]'
  - '[[email-service]]'
  - '[[calendar-service]]'
branch: release/2.1
---

# Email Notification Triggers

## Architecture

Email sending follows two patterns:
1. **Scheduled batch** — Cron jobs collect recipients, publish to RabbitMQ `ttt.email.topic` exchange
2. **Event-driven** — Spring `@EventListener` reacts to domain events, routes through `SendEmailApplicationEventListener` → RabbitMQ → `EmailSendScheduler` batch sender

Central processor: [[email-service]] `EmailBatchService` picks up queued messages via `EmailSendScheduler` cron and sends via SMTP.

## TTT Service — 5 Scheduled Triggers

| Template | Cron Property | Purpose |
|----------|--------------|---------|
| `TASK_REPORT_CHANGED` | `task-report.changed.notifications.cron` | Report status changes |
| `FORGOTTEN_REPORT` | `task-report.forgotten.notifications.cron` | Missing weekly reports |
| (delayed resend) | `task-report.forgotten.delayed.notifications.cron` | Re-send if still missing, skip day-off |
| `REPORT_REJECTED` | `task-report.reject.notifications.cron` | Manager rejected report |
| (budget) | `budget.notifications.cron` | Budget threshold alerts |

All via `TaskReportNotificationScheduler` and `BudgetNotificationScheduler`.

## Vacation Service — 2 Scheduled + ~25 Event-Driven

**Scheduled**: `DIGEST` (weekly/daily aggregated summary via `DigestScheduler`) and availability schedule notifications (`AvailabilityScheduleNotificationScheduler`).

**Event-driven templates** (30+ variants):
- **Vacation**: status change, approver change, calendar conflicts (less-than-min, not-enough, 7h-day-moved, 0h-day-moved, next-year-first) — 7 templates
- **Day-off**: status change, approver change, auto-delete, calendar-update-delete — 6 templates  
- **Sick leave**: open, close, delete, dates-changed, number-changed, files-added — 6 base templates × 3 actor variants (employee, accountant, supervisor) = ~16 templates

Total: ~30 unique email templates in vacation service alone.

## Calendar Service — No Emails

Calendar service has no email sending capability. It only manages date/holiday data and CS sync.

## Message Flow

```
Domain Event → @EventListener → SendEmailApplicationEvent
  → SendEmailApplicationEventListener → RabbitMQ (ttt.email.topic)
    → SendEmailListener (@RabbitListener) → MqEventHandler
      → EmailBatchService → SMTP
```

## Key Finding

The vacation service has the richest email logic with complex conditional notification routing — different templates for same action depending on who performed it (employee vs accountant vs supervisor). This is a high-priority area for test coverage.

## Ticket-3423 subject predicates (live-sampled session 130 — 2026-04-17)

Source: 800 most-recent emails from `timereporting@noveogroup.com` in the shared QA mailbox (`vulyanov@office.local` via Roundcube/Dovecot IMAPS). Sampled across envs DEV, PREPROD, QA1, QA2, STAGE, TIMEMACHINE.

**Sender** (all cron + event emails): `timereporting@noveogroup.com`

**Subject envelope** — **two different prefix conventions coexist**:

1. **Standard TTT-service envelope**: `[<ENV>][TTT] <title>` — Latin `TTT`, bracketed, single space before title. Used by all ttt-service crons (jobs 1, 2, 3, 4, 5) and all event-driven sick-leave / day-off / vacation notifications.
2. **Vacation-digest envelope**: `[<ENV>]ТТТ <title>` — **Cyrillic `ТТТ`** (U+0422 U+0422 U+0422), **no bracket around the service tag**, no space between env bracket and service tag. Only used by **Job 14 (DigestScheduler)**.

The digest inconsistency is a long-standing legacy — **do NOT filter digest emails with `[TTT]` Latin pattern**, they will be missed. Either search without the service tag (`subject:"[QA1]" subject:"Дайджест"`) or include both prefixes explicitly.

Env tag set observed: `DEV`, `PREPROD`, `QA1`, `QA2`, `STAGE`, `TIMEMACHINE`. Convention: env name uppercased, no dashes (`TIMEMACHINE` not `TTT-TIMEMACHINE`).

### Per-template subject predicates (t3423 scope rows)

| Cron job | Template key | Subject (Russian, from live samples) | Subject regex predicate (IMAP SEARCH + grep) | Channel scope row |
|---|---|---|---|---|
| 1 (weekly forgotten) | `FORGOTTEN_REPORT` | `[<ENV>][TTT] Скорее всего вы забыли зарепортиться за прошлую неделю` | `/^\[<ENV>\]\[TTT\] Скорее всего вы забыли зарепортиться за прошлую неделю$/` | Row 1 |
| 2 (daily delayed) | `FORGOTTEN_REPORT` (same template key as job 1) | **IDENTICAL subject** to job 1 — subject alone cannot distinguish jobs 1 vs 2 | *(must correlate with Graylog marker or send-time to disambiguate)* | Row 2 |
| 3 (changed) | `REPORT_SHEET_CHANGED` (NOT `TASK_REPORT_CHANGED` — scope table is wrong) | *(still not captured session 132 — test endpoint fired 19:21 UTC, DB had 0 reports with reporter≠executor yesterday; seeding required to capture)* | TBD (requires seeding — see row-3 notes) | Row 3 |
| 4 (reject) | `APPROVE_REJECT` | `[<ENV>][TTT] Ваши часы за период DD.MM.YYYY-DD.MM.YYYY были отклонены менеджером <Russian Full Name>` (session 132 historical sample Roundcube UID 565319) | `/^\[<ENV>\]\[TTT\] Ваши часы за период (?P<start>\d{2}\.\d{2}\.\d{4})-(?P<end>\d{2}\.\d{2}\.\d{4}) были отклонены менеджером (?P<manager>.+?)$/` | Row 4 |
| 5 (budget) | THREE templates: `BUDGET_NOTIFICATION_EXCEEDED`, `BUDGET_NOTIFICATION_NOT_REACHED`, `BUDGET_NOTIFICATION_DATE_UPDATED` (session 132 code-confirmed in `BudgetNotificationServiceImpl`) | *(still not captured session 132 — endpoint fired, no budget state changes in DB; seeding required: create `BudgetNotification` watch via `POST /api/ttt/v1/budget-notifications` then add task_reports that cross/uncross the limit)* | TBD (requires seeding) | Row 5 |
| 8 (email dispatch) | — | *N/A — job 8 is the sender batch, not a template; subject is whatever the queued email carries* | — | Row 8 |
| 14 (vacation digest) | `DIGEST` | `[<ENV>]ТТТ Дайджест отсутствий` (Cyrillic ТТТ, no bracket around service tag) | `/^\[<ENV>\]ТТТ Дайджест отсутствий$/` | Row 14 |
| 15 (prod-calendar reminder) | `NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST` (session 132 code+live confirmed) | `[<ENV>][TTT] Производственный календарь` (session 132 live sample Roundcube UIDs 609812, 609813 at 19:27 UTC 2026-04-17) | `/^\[<ENV>\]\[TTT\] Производственный календарь$/` | Row 15 |

### Adjacent event-driven templates (NOT in t3423 scope — observed in sampling)

These are event-driven (not cron), so they're out of t3423 scope but useful for cross-cutting Roundcube predicate design in Phase C `RoundcubeVerificationFixture`:

| Template | Subject |
|---|---|
| Last day before absence | `[<ENV>][TTT] Последний день перед отсутствием` |
| Sick-leave open | `[<ENV>][TTT] Открыт больничный лист` |
| Sick-leave close | `[<ENV>][TTT] Больничный лист закрыт` |
| Sick-leave delete | `[<ENV>][TTT] Больничный лист удален` |
| Sick-leave dates changed | `[<ENV>][TTT] Изменены даты больничного` |
| Sick-leave number edited | `[<ENV>][TTT] Отредактирован номер больничного листа` |
| Vacation-request changes | `[<ENV>][TTT] Изменения в заявке на отпуск` |
| Day-off-2027 bulk deletion | `[<ENV>][TTT] Заявки на переносы выходных в 2027 году были удалены` |

### Phase B / Phase C implications

1. **Subject alone can't disambiguate jobs 1 vs 2** (weekly forgotten vs delayed forgotten). Test cases must correlate subject with Graylog marker (`Report forgotten notification started` vs `Report forgotten delayed notification started`) or with send-time window (job 1 Mon/Fri 16:00, job 2 daily 16:30).
2. **Digest-subject regex must include the Cyrillic prefix variant**; a Latin `[TTT]` filter will miss all digest emails.
3. **Preferred IMAP SEARCH shape** for env-scoped verification:
   ```
   roundcube-access search --from timereporting --subject "[<ENV>]" --since <today> -n 50
   ```
   then post-filter by the template-specific title fragment (avoid embedding the full subject in `--subject` because IMAP doesn't match literal brackets reliably in some clients).
4. **For Phase C `RoundcubeVerificationFixture`**: expose a `matchSubject(env, templateKey)` API that resolves to the correct regex above, handling the digest Cyrillic case internally. This protects call sites from needing to know about the `ТТТ` inconsistency.
5. **Sampling gap (session 132 update)**: Row 4 historical subject captured from pre-existing Roundcube sample (UID 565319). Row 15 captured by force-trigger (2 emails dispatched to chief accountants). Rows 3 and 5 still TBD — both require DB seeding because the force-trigger yields 0 emails when the query finds no data to notify about: row 3 needs `task_report` rows from yesterday where `manager_id ≠ executor_id`; row 5 needs a `BudgetNotification` watch whose reached-state toggled between previous and current scheduler runs. Phase C can defer these predicates until the corresponding test cases run on a seeded dataset.

### Session 132 cross-job findings

- **Row 3 template name mismatch**: scope table says `TASK_REPORT_CHANGED` but code in `TaskReportsChangedNotificationServiceImpl` uses constant `REPORT_SHEET_CHANGED`. Update scope table and all test-case `requirement_ref` fields.
- **Row 4 has zero log markers**: `RejectNotificationServiceImpl.sendNotifications()` and `sendAndMarkNotified()` emit NO `log.info` / `log.debug` lines anywhere in the reject flow. Graylog cannot be used as an assertion channel for row 4. DB assertion vector: `UPDATE reject SET executor_notified = true` — tests must poll `reject.executor_notified` or rely on email arrival alone.
- **Row 5 has success-only marker**: `BudgetServiceImpl.sendNotifications()` emits `Budget notification job is done` on success and `Budget notification send FAILED:` on exception; no per-email marker at the service level. Per-email delivery markers come from `SendEmailListener` / `EmailBatchService` in the `ttt-email` application.
- **Row 15 scheduler-wrapper bypass**: `AnnualProductionCalendarTask.runFirst()` (scheduled bean) emits `Starting AnnualProductionCalendarTask for 1st october...` BUT the test endpoint `POST /v1/test/production-calendars/send-first-reminder` calls `productionCalendarService.runFirst()` DIRECTLY, bypassing the scheduler wrapper. Tests using the test endpoint will NOT see the "Starting AnnualProductionCalendarTask" marker — they must assert on `Mail has been sent to <email> about NOTIFY_VACATION_CALENDAR_NEXT_YEAR_FIRST` markers (one per recipient, emitted by the vacation-service mail dispatcher). Also note: the log text says "1st october" but the cron actually fires 1st November (see [[EXT-cron-jobs]] row 15 delta).
