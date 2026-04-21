---
name: Digest job NPE-equivalent — ArrayIndexOutOfBoundsException on empty reminderEvent list
description: Production bug discovered in Phase C TC-DIGEST-009 verification — digest scheduler throws AIOOBE when a reminder digest item has zero APPROVE_UNTIL/LEFT_DAYS events after filtering
type: investigation
tags: [digest, vacation, bug, regression, mail-data-former, phase-c-discovery]
created: 2026-04-21
updated: 2026-04-21
status: active
related: ["[[vacation-service]]", "[[cron-job-live-verification]]"]
branch: release/2.1
---

# Digest job — `ArrayIndexOutOfBoundsException` in `removeUnnecessaryEventsForReminderRequest`

## Discovered

2026-04-21 during Phase C autotest verification of TC-DIGEST-009 against the QA-1 environment.

Graylog evidence (stream `TTT-QA-1`):

```
22:28:15  level:3  Digests sending job failed, reason: Index 0 out of bounds for length 0
          java.lang.ArrayIndexOutOfBoundsException: Index 0 out of bounds for length 0
            at java.base/jdk.internal.util.Preconditions.outOfBounds(Preconditions.java:100)
            ...
            at com.noveogroup.ttt.vacation.service.impl.digest.MailDataFormerService
              .removeUnnecessaryEventsForReminderRequest(MailDataFormerService.java:172)
```

Reproduces on every digest run on QA-1 in the test window — both via the scheduler (`@Scheduled` with clock advance to 07:59:55) and via the test endpoint (`POST /api/vacation/v1/test/digest`).

## Root cause

`MailDataFormerService.removeUnnecessaryEventsForReminderRequest` (lines 167-174):

```java
private static void removeUnnecessaryEventsForReminderRequest(final DigestMailObjectItem digestMailObjectItem) {
    final var reminderEvent = digestMailObjectItem.getEvents().stream()
            .filter(event -> event.getName() != null)
            .filter(event -> event.getName().contains(APPROVE_UNTIL)
                || event.getName().contains(LEFT_DAYS)).toList();
    reminderEvent.get(0).setFirst(true);                  // ← line 172, throws when reminderEvent is empty
    digestMailObjectItem.setEvents(reminderEvent);
}
```

**Trigger conditions** (all must hold for one digest item):

1. `digest.isReminderEvent() == true` — the digest item was constructed from a `VACATION_REMINDER` or `EMPLOYEE_DAY_OFF_REMINDER` notification (`DigestFormatterService.java:622-624` and `670-672`).
2. After filtering, none of the item's events have a `name` that contains either `APPROVE_UNTIL` (`"Примите решение до "`) or `LEFT_DAYS` (`"Осталось дней до отпуска: "`).
3. Code calls `.get(0)` on the empty filtered list → `ArrayIndexOutOfBoundsException`.

The filter intentionally drops every event except APPROVE_UNTIL / LEFT_DAYS markers. There is no guard that at least one of those two events is present before promoting the first one to `first = true`.

## Impact

The throw bubbles up to the scheduler (`Digests sending job failed`). The job's outer loop continues for *other* employees only if the catch is at the per-employee level — needs verification by reading the job entry point. Worst case: the entire digest run aborts and **no further employees receive digests** for that 8 AM run.

Even in the best case (per-employee try/catch), the affected employee receives no digest, so reminder emails for vacations awaiting approval can be silently dropped.

## How the bad input arises

A digest item built from a `VACATION_REMINDER` timeline event must accumulate at least one event whose `name` field is set to either `APPROVE_UNTIL` or `LEFT_DAYS`. The producers are the `AbstractTimelineEventProcessor` chain plus:

- `addApproveUntilEventToDigestEvent(...)` — line 150, only called when `digest.getDayOffStatus() != null` for day-off items
- `addLeftVacationDaysEventToDigest(...)` — line 157, only called when `digest.getType() == DigestType.VACATION && action != DigestActionType.NO_ACTION`

Combinations that bypass both paths (e.g. a `VACATION_REMINDER` where the resolved `DigestActionType` ends up `NO_ACTION`, or a day-off reminder for a vacation-typed digest, or an event-processor that fails to set `name`) leave the events list empty after filtering.

## Suggested fix (out of scope for tests — flag for backend team)

```java
private static void removeUnnecessaryEventsForReminderRequest(final DigestMailObjectItem digestMailObjectItem) {
    final var reminderEvent = digestMailObjectItem.getEvents().stream()
            .filter(event -> event.getName() != null)
            .filter(event -> event.getName().contains(APPROVE_UNTIL)
                || event.getName().contains(LEFT_DAYS)).toList();
    if (!reminderEvent.isEmpty()) {
        reminderEvent.get(0).setFirst(true);
    }
    digestMailObjectItem.setEvents(reminderEvent);
}
```

…or, more defensively, log a warning + skip the item entirely when no reminder-applicable events survive the filter.

## Implications for autotests

- TC-DIGEST-009 (Variant A — scheduler marker audit) and TC-DIGEST-010 (Variant B — test endpoint marker audit) both assert `failedHits == 0` and `level:3 ERROR == 0`. **Both will fail on QA-1 until the bug is fixed.** This is correct regression detection — do not mute the assertion.
- Without the `since: triggerIso` scoping introduced in this session, prior runs' failure markers leak into the lookback window of unrelated tests. The fix narrows the assertion to the per-test trigger window so a stale failure does not pollute a run where the bug did not fire.
- Other digest TCs (TC-001 content-complete, TC-005 leakage guard, TC-007 subject format) only assert `failedHits == 0` against the per-test window. They will fail when this bug fires *during* their test window. They will pass when it does not.

## Filing

This is a real backend defect, not a test issue. The owning team needs:
- Stack trace + Graylog query: `level:3 AND "Digests sending job"` on stream `TTT-QA-1` since 2026-04-21
- Reference to `MailDataFormerService.java:172`
- Suggested fix above
- Test reproduction: any digest scheduler run on QA-1 that processes an employee with a `VACATION_REMINDER` notification whose digest item has no APPROVE_UNTIL / LEFT_DAYS events
