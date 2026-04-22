---
name: Digest template reality — content, receiver model, env tag
description: Session 142 discovery — the DIGEST email template uses fixed "дней: N" format (no Russian plural forms), has no personalised greeting, recipients are MANAGERS of the vacation owner, and subject env tag strips dashes (QA1 not QA-1)
type: exploration
tags: [digest, email-template, findings, session-142]
created: 2026-04-22
updated: 2026-04-22
status: active
related: ["[[modules/email-notification-deep-dive]]", "[[patterns/email-notification-triggers]]", "[[exploration/data-findings/email-templates-inventory]]", "[[exploration/tickets/digest-bug-array-index-out-of-bounds]]"]
branch: release/2.1
---

# Digest Email Template — Empirical Reality (Session 142)

Four XLSX digest TCs (TC-DIGEST-011/012/013/014) were drafted based on assumptions about the digest template that do not hold. Session 142 verified the actual template contents and code path against the running QA-1 backend and the live `ttt_email.email_template` row (`code='DIGEST'`).

## Discrepancies between XLSX assumptions and reality

### 1. NO Russian plural-form rendering (`1 день` / `2 дня` / `5 дней` / `21 день`) — template uses fixed `дней: {{daysCount}}`

The digest template body row for every per-employee-per-vacation entry is:

```mustache
<div>{{startDate}} – {{endDate}}, <b>дней: {{daysCount}}</b></div>
```

Every branch of the template (approveAction / optionalApproveAction / approve / optionalApprove / notifyAlso / soonAbsences / continuousAbsence) uses the same literal `дней:` prefix — no Russian plural-form variation is ever applied. `{{daysCount}}` is a pre-rendered integer supplied by `MailDataFormerService` / `DigestFormatterService` with no morphology awareness.

**Observed sample** (UID 612413, digest to `ivan.ilnitsky@noveogroup.com`):

```
Павел Вайнмастер
28.04.2026 – 28.04.2026, дней: 1
Павел Вайнмастер
30.04.2026 – 01.05.2026, дней: 1       ← 2 calendar days, 1 working day (01.05 is holiday)
```

`daysCount` is **working days**, not calendar days — derived from `DigestFormatterService.countWorkingDays`. Any spec asserting calendar-day durations against this value will fail on any seed that straddles a Russian public holiday or weekend.

**TC-DIGEST-011 / TC-DIGEST-012 premise is therefore invalid.** The "plural-form edge cases (1 день / 2 дня / 5 дней / 21 день)" scenarios cannot be exercised because the template has no plural-form code path to exercise. These TCs must be rewritten (assert `дней: N` with N = working-day count), rescoped, or removed.

### 2. No personalised greeting (`Здравствуйте, {{firstName}} {{lastName}}`)

The digest body opens with a static generic greeting:

```
Добрый день!
Ниже информация по заявкам на отпуск и на перенос выходных. События за {{period}}.
```

There is **no** `Здравствуйте, …` substitution, no recipient-name rendering. Every digest email in every branch gets the identical greeting. Existing TC-DIGEST-001 / 002 / 005 / 006 / 011 / 012 / 013 / 014 body assertions that look for `Здравствуйте, ${displayFirst} ${displayLast}` will fail 100 % of the time — the string is never emitted.

### 3. Recipient is the **manager** (or optional-approver), NOT the vacation owner

`DigestSoonEventReceiverHelper.getReceivers(employeeId)` (`vacation/service/service-impl/.../DigestSoonEventReceiverHelper.java:41`) returns:

```java
final Set<Long> receivers = new HashSet<>();
final EmployeeBO employee = employeeService.getById(employeeId);
if (employee.getManager() != null) {
    receivers.add(employee.getManager().getId());
}
receivers.addAll(optionalApproverService.search(employee.getLogin()) ...);
```

**The employee themselves is NOT added as a receiver.** A digest triggered by a vacation for employee `E` is dispatched to `E.manager` + any optional approvers configured for `E`. The digest email's `To:` header is `E.manager.email`, never `E.email`.

Consequences for the digest collection specs:

- `ApiVacationSetupFixture` can only seed vacations as `pvaynmaster` (the API-token owner)
- The resulting digest is sent to `pvaynmaster.manager = ilnitsky` (id=65, `ivan.ilnitsky@noveogroup.com`)
- **All `waitForEmail({to: data.seedEmail})` calls with `seedEmail = Pavel.Weinmeister@noveogroup.com` will return emails that are NOT the digest triggered by our seed** — they may be digests where pvaynmaster is somebody else's manager or optional-approver, whose content is uncontrolled and unseeded

TC fix pattern: `data.seedEmail` must resolve to `pvaynmaster.manager.email`. Content-complete assertions must search for the Russian display name of the **employee** (pvaynmaster) in the recipient's (manager's) digest body.

Shape-wise, the relevant template section for "seeded APPROVED vacation" is `{{#showSoonAbsence}}{{#soonAbsences}}{{#vacation}}{{#events}}...{{/events}}{{/vacation}}{{/soonAbsences}}{{/showSoonAbsence}}` — all receivers whose own-team member has an upcoming absence get the absence listed here.

### 4. Subject env-tag strips dashes (`[QA1]` not `[QA-1]`)

TTT backend prefixes notification subjects with `[${app.env-tag}]` where `env-tag` is the env name with dashes removed:

| `tttConfig.env` | `toUpperCase()` | actual subject tag |
|---|---|---|
| `qa-1`          | `QA-1`          | `QA1` |
| `qa-2`          | `QA-2`          | `QA2` |
| `timemachine`   | `TIMEMACHINE`   | `TIMEMACHINE` |
| `stage`         | `STAGE`         | `STAGE` |

Session 142 added `TttConfig.envTag` (`env.replace(/-/g, "").toUpperCase()`) for specs to use in subject regex assertions. The old `tttConfig.env.toUpperCase()` matches non-dashed envs correctly but misses dashed ones.

## Template location and data flow

- Template row: `ttt_email.email_template WHERE code='DIGEST'` (qa-1)
- Server loader: `DigestServiceImpl.sendEmail` → `InternalEmailService.send` → RabbitMQ `SEND_EMAIL` → `email` microservice → SMTP
- Data former: `MailDataFormerService` (subject `period`, receiver display name unused, `firstName` / `lastName` in per-event block are the **vacation employee**, NOT recipient)
- Date format: `DateFormatter.formatDateMonthYear` = `dd.MM.yyyy` (Java `DateTimeFormatter.ofPattern("dd.MM.yyyy")`). Year-rollover assertions against `01.01.<YYYY+1>` ARE valid — the formatter emits the correct year as long as `TimeUtils.today()` returns the patched clock.

## Fixture bugs discovered alongside (fixed in session 142)

1. `RoundcubeVerificationFixture.search()` read `parsed.messages ?? []` — the CLI returns `items`. Result: every `waitForEmail` timed out with "0 candidates".
2. `RoundcubeVerificationFixture.read()` returned raw `{text, html}` keys; specs read `body.text_body` → always undefined → all `assertBodyContains` calls treated the body as empty string. Additionally the digest template emits HTML only (plain-text part is empty), so even when `text` is populated the body-assertion would miss rendered content.

The fixture now:
- Maps `parsed.items` → returned messages
- Maps `{text, html}` → `{text_body, html_body}` on read, always requesting HTML, and falls back to a tag-stripped view of the HTML when the plain-text part is empty, so `assertBodyContains` works against HTML-only templates

Prior "verified" status on TC-DIGEST-007 / 008 (session 141) is therefore suspect — neither could have matched an email with the old fixture. They should be re-verified in a future session after the body-assertion questions above are resolved.

## Recommended XLSX revisions (for the next session's human review)

- TC-DIGEST-011 / 012: repurpose as "per-event block content-complete" (assert `дней: <N>` where `<N>` = working-day count for each seeded vacation; drop plural-form branches). OR: delete the TC as invalid premise and re-author around a different cron job that DOES do plural rendering.
- TC-DIGEST-013 / 014: valid in principle (year-rollover in `dd.MM.yyyy`), but must (a) look up `pvaynmaster.manager.email` and search the recipient's mailbox; (b) drop `Здравствуйте, …` greeting assertion; (c) assert employee display name + both dates.
- TC-DIGEST-001 / 002 / 005 / 006: same receiver-model fix required.

These revisions go beyond Phase C's "generate autotests from XLSX" remit — they need a human or Phase B pass to correct the XLSX before specs can meaningfully pass.

## Evidence

- Template source: `ttt_email.email_template WHERE code='DIGEST'` (qa-1, 2026-04-22)
- Receiver helper: `vacation/service/service-impl/src/main/java/com/noveogroup/ttt/vacation/service/impl/digest/DigestSoonEventReceiverHelper.java:41`
- Date formatter: `common/common-util/src/main/java/com/noveogroup/ttt/common/util/DateFormatter.java:18`
- Observed digest emails: Roundcube UIDs 612413 (to ilnitsky, contains pvaynmaster seeds) and 612424 (to pvaynmaster, contains his 44 direct-reports' absences — none of pvaynmaster's own vacations)
