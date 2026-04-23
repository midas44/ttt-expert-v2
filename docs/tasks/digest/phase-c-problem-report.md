# Digest Phase C — Problem Report

**Generated:** 2026-04-22 (post session 144, runner stopped mid-145 for review)
**Scope:** `collection:digest` (row 14 of #3423 cron — vacation digest email)
**Sessions consumed:** 7 (138–144 — 138 landed Phase B, 139/140 quota-blocked, 141/142/143/144 Phase C)
**Source artefacts reviewed:** `autotests/e2e/tests/digest/*.spec.ts`, `autotests/e2e/data/digest/*Data.ts`, `autotests/e2e/fixtures/common/{Roundcube,Graylog}VerificationFixture.ts`, `test-docs/collections/digest/digest.xlsx`, session-JSONs 141–144, SQLite `autotest_tracking`, vault notes `exploration/tickets/digest-{bug-array-index-out-of-bounds,template-reality-session-142}.md`, runner log 2026-04-21 → 2026-04-22.

---

## Final state

| Status | Count | TCs |
|---|---|---|
| verified (meaningful) | **1** | TC-003 |
| verified (accidental) | **2** | TC-004, TC-007 |
| failed (structural) | **6** | TC-001, TC-008, TC-011, TC-012, TC-013, TC-014 |
| generated, never re-run after fixture fix | **5** | TC-002, TC-005, TC-006, TC-009, TC-010 |

**7 sessions consumed; only 1 spec actually verifies the behaviour its title claims.**

---

## P0 — XLSX premise invalid (Phase B authored wrong assumptions)

Session 142 discovered empirically that four core assumptions the XLSX makes about the DIGEST email template are false. These are **Phase B defects** — the specs dutifully implement what the XLSX requires, and they will fail forever until the XLSX is rewritten.

### 1. Receiver model is wrong (affects 9 TCs)

- **Assumption:** digest → `employee.email`
- **Reality:** digest → `employee.manager.email` (+ optional approvers); the vacation owner is NEVER a recipient of their own digest
- **Evidence:** `DigestSoonEventReceiverHelper.java:41` — `if (employee.getManager() != null) receivers.add(employee.getManager().getId())`; Roundcube UIDs 612413 / 612424
- **Compounding:** `ApiVacationSetupFixture` can only seed as pvaynmaster (the API-token owner). So every test's seed goes to `pvaynmaster.manager` = ilnitsky (id 65), but every spec searches pvaynmaster's mailbox. The mismatch is structural, not fixable in the spec layer.
- **Affected:** TC-001, 002, 005, 006, 008, 009, 010, 013, 014

### 2. Personalised greeting doesn't exist (affects 8 TCs)

- **Assumption:** template emits `Здравствуйте, {firstName} {lastName}`
- **Reality:** template opens with static `Добрый день!`; recipient name is never rendered
- **Evidence:** `ttt_email.email_template WHERE code='DIGEST'` inspection on qa-1 (2026-04-22)
- **Affected:** TC-001, 002, 005, 006, 011, 012, 013, 014 — every TC that calls `assertBodyContains(..., 'Здравствуйте, …')`

### 3. Russian plural forms don't exist (TC-011, TC-012)

- **Assumption:** `daysCount` is morphologically rendered (1 день / 2 дня / 5 дней / 21 день)
- **Reality:** template emits fixed literal `дней: {{daysCount}}` — integer substituted verbatim, no morphology branches
- **Evidence:** template row from qa-1 DB; spec asserts `/1 день/`, `/2 дня/` which cannot match literal `дней: N`
- **Affected:** TC-011, TC-012 test functionality that does not exist in the code

### 4. Working-days vs calendar-days mismatch (TC-001, TC-013)

- **Assumption:** `durationPhrase = inclusiveDayCount(startIso, endIso) + russianDayPluralWord(...)`
- **Reality:** `daysCount` in the template is `DigestFormatterService.countWorkingDays` (weekends + holidays excluded)
- **Concrete collision:** TC-013 seeds `01.01.YYYY → 05.01.YYYY` = 5 calendar days, but Jan 1 is a Russian public holiday and the span includes a weekend → template would render `дней: 3` (3 working days). The data class computes and asserts `дней: 5`.

### 5. Cyrillic `ТТТ` subject tag hardcoded (minor, design decision)

- All specs assert the service tag is Cyrillic `ТТТ` (U+0422 × 3). If the backend ever emits Latin `TTT` on a different env or after a config change, every subject assertion breaks.
- Breaks the CLAUDE+.md "environment independence" rule by encoding a Cyrillic-only assumption into the test — acceptable if project policy commits to Cyrillic, should be explicit.

---

## P0 — Production bug blocks digest runs

`MailDataFormerService.removeUnnecessaryEventsForReminderRequest:172` throws `ArrayIndexOutOfBoundsException` when a reminder digest item has zero APPROVE_UNTIL / LEFT_DAYS events after filtering. Bug reproduces on every digest run in the test window on qa-1, **both scheduler and test-endpoint paths**.

```java
private static void removeUnnecessaryEventsForReminderRequest(final DigestMailObjectItem digestMailObjectItem) {
    final var reminderEvent = digestMailObjectItem.getEvents().stream()
            .filter(event -> event.getName() != null)
            .filter(event -> event.getName().contains(APPROVE_UNTIL)
                || event.getName().contains(LEFT_DAYS)).toList();
    reminderEvent.get(0).setFirst(true);   // ← line 172, AIOOBE when reminderEvent is empty
    digestMailObjectItem.setEvents(reminderEvent);
}
```

- **TC-001** failed explicitly on this (AIOOBE marker fires → `failedHits == 0` assertion fails)
- **TC-009 / TC-010** would fail for the same reason but weren't re-run after the s143 fixture fixes
- Vault note `exploration/tickets/digest-bug-array-index-out-of-bounds.md` has stack trace + suggested fix
- **Action:** needs ticket filed with backend team. Suggested fix: guard `.get(0)` with `if (!reminderEvent.isEmpty())`.

---

## P1 — "Verified" status is misleading for 2 of 3 TCs

- **TC-003** (scheduler, empty-set, Graylog marker audit) — **genuinely passes.** No email dependency; scheduler emits `finished` regardless of content.
- **TC-004** (test-endpoint, empty-set, 200 response) — **genuinely passes** for the same reason. No email receiver dependency.
- **TC-007** (scheduler, subject regex) — **passes accidentally.** The spec searches pvaynmaster's mailbox for subject `Дайджест отсутствий` with `sinceSearch: now`. On patched-Monday, pvaynmaster's 44 direct reports' existing APPROVED vacations trigger a digest TO pvaynmaster. The subject regex matches. But the matched email is **not** the digest the test seeded — it was triggered by unrelated data. If you deleted the test's seed, TC-007 would still pass. This is a false-positive: the test says "it verified subject format for the seeded vacation's digest"; actually it verified subject format for some other digest that happened to arrive.

Same false-positive shape would apply to TC-001/005/011 if/when they get past their body assertions — receiver model is wrong, but `waitForEmail({to: pvaynmaster})` will find *something* on Mondays because of the same ambient-digest-traffic effect.

---

## P1 — Early "verified" rows were silently wrong

Session 141 marked TC-007 / TC-008 as `verified` against a Roundcube fixture that had **two latent bugs** (both fixed in s143):

1. `RoundcubeVerificationFixture.search()` read `parsed.messages ?? []` — the CLI returns `items`. Every `waitForEmail` would time out with "0 candidates".
2. `RoundcubeVerificationFixture.read()` returned raw `{text, html}`; specs read `body.text_body` → always undefined → every `assertBodyContains` operated on empty string.

The mechanism by which s141 claimed to verify these 2 TCs under those latent defects is unclear — `waitForEmail` would have thrown before reaching body assertions. Either the runner marked-verified without executing, or an accidental code path gave empty results that were interpreted as success. Either way, the SQLite "verified" state issued at 2026-04-21 23:03:25 was unreliable; only s144's re-run established real status (TC-007 pass / TC-008 fail).

---

## P1 — Agent did not self-stop at recommended gate

- **Session 143 briefing** ended with: *"Next session should pause digest and have a human review the XLSX before any more spec work."*
- **Session 144 briefing** ended with: *"Recommend next session flip `autonomy.stop: true` and escalate. No further Phase C value can be extracted from this collection without XLSX revision."*

Neither session flipped `autonomy.stop`. The runner kept cycling. Session 145 was started and had to be killed mid-cycle for this review.

**The runner's `autonomy.stop` is purely operator-driven; the agent's "recommend stop" is advisory with no self-interlock.** If the system should honour its own gates, the agent needs permission to flip `autonomy.stop` when a briefing contains an escalation — or the runner should parse the briefing for escalation markers and halt.

---

## P2 — Spec / test-hygiene concerns

### Leakage guard race (TC-005)

Spec seeds 4 vacations for pvaynmaster then asserts `assertBodyMissing(body, data.wrongDateDisplay)`. On shared qa-1 env, pvaynmaster's 44 direct reports' existing APPROVED vacations *also* populate his digest. If any of those have `data.wrongDateDisplay` in them, the guard fires falsely. Conversely, if many other candidate dates appear in the digest body, a real v2 leakage would be drowned out. **Leakage guard as written cannot distinguish "my v2 leaked" from "some other employee has that date".**

### Clock mutation on shared env (TC-013, TC-014)

`nextMondayDec31Year` resolves to 2028 today. Patching the server clock 2.6 years into the future on qa-1 affects every concurrent user for the window of the test. If a second autotests session runs in parallel, both crash. `resetServerClock(...).catch(() => {})` silently swallows the reset failure — if it throws, the next test on that env runs against a year-displaced clock until someone notices.

### Best-effort cleanup hides leaks

Every spec wraps cleanup in `.catch(() => {})`:

```ts
await resetServerClock(request, tttConfig).catch(() => {});
await data.cleanup(request, tttConfig).catch(() => {});
```

This masks two classes of production problem: orphan APPROVED vacations accumulating in qa-1, and unreset clocks breaking downstream tests. At minimum, structured logging; ideally, these should fail the test.

### Fixture-method sync/async polymorphism

`GraylogVerificationFixture.count/search` are sync (spawnSync wraps Python CLI); `waitForMarker` is async. Same for Roundcube: `count/search/read` sync, `waitForEmail` async. Specs occasionally mix `await` and non-await usage — not a runtime defect (JS tolerates `await` on non-promises), but easy to misread. The fixture doc comments don't call out the sync/async distinction.

### Test-budget inconsistency

- TC-001 / 005 / 007 / 011: 420_000 ms (7 min)
- TC-002 / 006 / 008 / 010: 300_000 ms (5 min)
- TC-009: 360_000 ms (6 min)
- TC-013 / 014: 420_000 ms

Not a defect, but reflects ad-hoc sizing rather than a measured baseline. With digest-run latencies of 2–8 min on shared qa-1, variance is real — consider a shared `DIGEST_TEST_TIMEOUT` constant.

---

## P2 — Vault / SQLite hygiene

- `last_run_error` field in `autotest_tracking` is mostly empty. Rich failure context lives in session briefings, which get overwritten on every session. **No durable per-TC failure log.**
- `last_run_result` uses free-form strings (`flaky-production-aioobe`, `xlsx-premise-invalid-digest-template-has-no-plural-forms`, `receiver-model-invalid-pvaynmaster-not-digest-recipient`, …). Fine as tags but not queryable — better as enum + note.
- TC-007 / TC-008's s141 "verified" was granted without the fixture fixes in place; SQLite captured state that couldn't have been true. Re-verification pipeline worked (s144 corrected 007 and demoted 008), but an accountability trail for the original bad write would help.

---

## Summary — what's actually broken vs working

| Layer | State |
|---|---|
| **Fixtures (Roundcube, Graylog)** | Post-s143: correct. `search`-key fix, `text_body`/`html_body` normalisation, `count()` CLI workaround, HTML-to-text fallback — all good. |
| **clockControl utils** | Good. `triggerDigestTestEndpoint`, `fireSoonIso`, `nextMondayDec31Year` solid. |
| **DigestTc*Data classes** | Structurally sound. Problem is receiver — all resolve pvaynmaster as seed, but real recipient is `pvaynmaster.manager`. Needs `seedEmail = pvaynmaster.manager.email`, `seedLogin` stays pvaynmaster. |
| **Specs (8/14)** | Implement wrong XLSX requirements. TC-011/012/013/014 carry `STATUS: XLSX PREMISE INVALID` doc comments — loud, good. TC-001/002/005/006 don't document their receiver-model defect in the spec header. |
| **Specs (6/14)** | TC-003/004 correct. TC-007 falsely verified. TC-008 honestly failed. TC-009/010 marker-only, should work once AIOOBE is fixed. |
| **XLSX (Phase B output)** | Needs rewrite for 9 TCs before Phase C can continue. |
| **Collection scope pipeline** | `parse_xlsx.py`, `process_collection.py` — working correctly after s138 pipeline fixes. |

---

## Full SQLite tracking snapshot (2026-04-22)

| TC | automation_status | last_run_result | failure_count |
|----|-------------------|-----------------|---------------|
| TC-DIGEST-001 | failed | flaky-production-aioobe | 1 |
| TC-DIGEST-002 | generated | per-recipient-marker-removed-needs-reverify | 0 |
| TC-DIGEST-003 | **verified** | passed-post-fix-session144-envTag-countFix | 0 |
| TC-DIGEST-004 | **verified** | passed-post-fix-session144-envTag-countFix | 0 |
| TC-DIGEST-005 | generated | per-recipient-markers-removed-needs-reverify | 0 |
| TC-DIGEST-006 | generated | per-recipient-markers-removed-needs-reverify | 0 |
| TC-DIGEST-007 | **verified** | passed-post-fix-session144-envTag-countFix | 0 |
| TC-DIGEST-008 | failed | receiver-model-invalid-pvaynmaster-not-digest-recipient | 1 |
| TC-DIGEST-009 | generated | seed-crossing-transient-needs-reverify | 0 |
| TC-DIGEST-010 | generated | restructured-sync-post-needs-reverify | 0 |
| TC-DIGEST-011 | failed | xlsx-premise-invalid-digest-template-has-no-plural-forms | 1 |
| TC-DIGEST-012 | failed | xlsx-premise-invalid-digest-template-has-no-plural-forms | 1 |
| TC-DIGEST-013 | failed | needs-receiver-model-fix-employee-not-in-own-digest | 1 |
| TC-DIGEST-014 | failed | needs-receiver-model-fix-employee-not-in-own-digest | 1 |

---

## Session-by-session retrospective

| Session | Outcome | Notable |
|---|---|---|
| 138 | Phase B landed | Collection XLSX seeded with 14 TCs based on XLSX-assumption template content (wrong on 4 axes) |
| 139 | quota-blocked | Anthropic usage cap hit |
| 140 | quota-blocked | Same |
| 141 | 10 specs generated, 2 prematurely marked "verified" | TC-007/008 verified against buggy Roundcube fixture (see P1 above) |
| 142 | Template reality discovered | Empirical verification of `ttt_email.email_template`: no greeting, no plural forms, wrong receiver; bug note for AIOOBE filed |
| 143 | Fixture fixes landed; 4 more specs generated (011–014) | XLSX premise invalidity recognised; specs retained with "STATUS: XLSX PREMISE INVALID" markers; recommended stop — not honoured |
| 144 | Mechanical envTag + count() CLI fix | TC-003/004/007 re-verified; TC-008 demoted to failed; recommended stop again — not honoured |
| 145 | Killed before first commit | Operator intervention stopped the runaway |

---

## What to do next (three options)

### Option A — pause and escalate (what s143/144 recommended)

Flip the XLSX in Phase B — receiver to manager, drop greeting assertion, drop plural-form TCs, use working-day count. Then re-run Phase C.

- **Cost:** 1–2 Phase B sessions + 2 Phase C re-run sessions
- **Yields:** actual coverage for 9 of 14 TCs (11/12 remain invalid in any form)

### Option B — acknowledge limits and close out

Keep current state as "stress-test findings report", move on to next collection.

- **Cost:** 0
- **Yields:** a calibration dataset on how Phase B underwrites empirical assumptions, without further investment

### Option C — tighten the pipeline to prevent recurrence

Before Phase B writes TCs for a notification flow, make it mandatory to empirically verify: recipient resolution path (code + live email), template greeting literal, dynamic-field inventory, date formatter output. Store as a vault note, cite from XLSX. Also: wire `autonomy.stop` self-flip on explicit escalation markers in session briefings.

- **Cost:** expensive up-front (new Phase B rule + skill update)
- **Yields:** prevents 7-session dead-ends like this one on future collections

### Recommended: **C + B**

Bake the verification rule into `CLAUDE+.md §11` and the email-notification pattern note, mark digest collection CLOSED with current coverage (3/14 of which 1 meaningful), move on. Retrying digest would consume another 2–4 sessions for a collection that's fundamentally a pipeline stress-test, not a shippable test suite.

---

## Open action items

1. **File backend ticket** for `MailDataFormerService.removeUnnecessaryEventsForReminderRequest:172` AIOOBE. Stack trace + Graylog query + suggested fix are in `exploration/tickets/digest-bug-array-index-out-of-bounds.md`.
2. **Decide Option A / B / C above** and record the decision here.
3. **If B or C:** update `autotest_tracking` to mark 11 unsettled TCs as `blocked` with owner=XLSX-revision, not `generated`/`failed`, so dashboards stop counting them as pending work.
4. **If C:** draft the empirical-verification rule addition to `CLAUDE+.md §11` — template inspection, receiver trace, greeting literal, date formatter.
5. **Consider:** letting the agent flip `autonomy.stop: true` when its own briefing contains an escalation marker (e.g. phrase `Recommend next session flip autonomy.stop: true`). Current gap cost 1.5 extra sessions on digest.
