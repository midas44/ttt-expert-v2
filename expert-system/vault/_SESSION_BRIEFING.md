# Session Briefing — Phase C, digest collection (session 144 close)

**Last session close:** 144 (2026-04-22). Session 143 flagged the digest XLSX as needing human review (4 TCs with invalid premise, 6 more with receiver-model defect) and recommended stopping. The autonomous runner continued into session 144; work was restricted to mechanical, uncontroversial changes endorsed by the s143 briefing's "If autonomy does continue" branch.

Phase still `autotest_generation`, scope still `collection:digest`, autonomy mode `full`.

## What session 144 did

### 1. Applied `tttConfig.envTag` across all 14 digest specs (mechanical find-replace)

Every digest spec used `tttConfig.env.toUpperCase()` → `QA-1` for the subject prefix. The real backend emits `[QA1]` (dashes stripped). Session 143 added the `envTag` getter; session 144 plumbed it through to every spec. Verified with `tsc --noEmit` — compiles cleanly. Specs changed: `digest-tc001..014.spec.ts` (10 of 14 had the variable; TC-009/010 didn't reference it).

### 2. Fixed `RoundcubeVerificationFixture.count()` — pre-existing bug exposed during TC-004 re-run

The `count()` method passed `--subject` / `--since` filters to the CLI's `count` subcommand, which accepts only `--mailbox`. Every TC that calls `count()` (TC-003 / 004 and any future baseline-diff TC) would fail with `unrecognized arguments: --subject ...`.

Fix: route `count()` through `search --limit 1` and read `total` from the response. The CLI's `search.total` field is the full IMAP SEARCH match count regardless of per-call item limit. Same return contract, no behavioral change for callers.

Location: `autotests/e2e/fixtures/common/RoundcubeVerificationFixture.ts:87-100`.

### 3. Re-ran TC-003 / 004 / 007 / 008 to re-confirm "verified pre-fix" status

| TC | Result | Duration | Notes |
|----|--------|----------|-------|
| TC-003 (scheduler empty) | ✓ passed | 2.9m | Graylog marker audit + envTag-corrected baseline count |
| TC-004 (test-endpoint empty) | ✓ passed | 41.5s | Graylog `assertAbsent` + count via `search --limit 1` |
| TC-007 (scheduler subject) | ✓ passed | 2.9m | waitForEmail matched on pvaynmaster (scheduler reliably produces digest to managers on patched-Monday clock) |
| TC-008 (test-endpoint subject) | ✗ failed (2× 4-min timeout) | 8m total | **Same receiver-model defect** as TC-001/002/005/006/009/010 — test endpoint on real-Wed clock did not produce a digest to pvaynmaster in the 4-min window (his direct reports had no APPROVED-soon vacations to trigger his receipt). Demoted `verified → failed` in SQLite. |

### SQLite tracking after session 144

| TC | automation_status | last_run_result |
|----|-------------------|-----------------|
| TC-001 | failed | flaky-production-aioobe |
| TC-002 | generated | per-recipient-marker-removed-needs-reverify |
| TC-003 | **verified** | passed-post-fix-session144-envTag-countFix |
| TC-004 | **verified** | passed-post-fix-session144-envTag-countFix |
| TC-005 | generated | per-recipient-markers-removed-needs-reverify |
| TC-006 | generated | per-recipient-markers-removed-needs-reverify |
| TC-007 | **verified** | passed-post-fix-session144-envTag-countFix |
| TC-008 | **failed** ↓ | receiver-model-invalid-pvaynmaster-not-digest-recipient |
| TC-009 | generated | seed-crossing-transient-needs-reverify |
| TC-010 | generated | restructured-sync-post-needs-reverify |
| TC-011 | failed | xlsx-premise-invalid-digest-template-has-no-plural-forms |
| TC-012 | failed | xlsx-premise-invalid-digest-template-has-no-plural-forms |
| TC-013 | failed | needs-receiver-model-fix-employee-not-in-own-digest |
| TC-014 | failed | needs-receiver-model-fix-employee-not-in-own-digest |

Net verified count: 3 (was 4 at s143 close — TC-008 demoted). Failed count: 6 (was 5).

## Why TC-008 failed but TC-007 passed (diagnosis)

Both search pvaynmaster's mailbox with `waitForEmail({to: Pavel.Weinmeister@noveogroup.com, subject: "Дайджест отсутствий", sinceSearch: now})`.

- **TC-007 (scheduler variant)** patches the server clock to `nextMonday 07:59:55` via `fireSoonIso`. The `@Scheduled` job at 08:00 runs `addSoonVacationEvents` which is gated on `today.getDayOfWeek() == MONDAY` and processes the full `[today+1, today+21]` window for every employee. On a shared env with many active vacations, every manager (including pvaynmaster) reliably receives a digest.

- **TC-008 (test-endpoint variant)** posts to `/api/vacation/v1/test/digest` on the **real** server clock (Wed 2026-04-22). Whatever window the test endpoint computes for a non-Monday day did not include any APPROVED-soon vacations among pvaynmaster's direct reports in the 4-min polling window — two attempts at 03:58 and 04:13 both returned 0 matching-new digests.

TC-008's passing condition is therefore not "envelope composition is correct" (what the TC claims to verify) but "pvaynmaster happens to be the manager of someone with an APPROVED-soon vacation in the non-Monday code path". That is non-deterministic on a shared env and day-of-week dependent. **The receiver-model flaw session 143 documented for TC-001/002/005/006/009/010/013/014 applies equally to TC-008.**

## What session 144 did NOT do (and why)

- **Did not "fix" TC-001 / 002 / 005 / 006 / 009 / 010 / 011 / 012 / 013 / 014**: these all have XLSX-premise or receiver-model issues that require human review per the s143 escalation. Session 144 made no spec-body changes beyond envTag.
- **Did not re-run those 10 TCs**: they would fail for the structural reasons s143 documented, not a spec bug — running them produces no new information.
- **Did not modify the digest XLSX**: that's explicitly outside Phase C's "generate autotests from XLSX" remit. See [[exploration/tickets/digest-template-reality-session-142.md]] for the review-required revisions.
- **Did not touch `DigestTc001Data`**: the receiver-model fix (resolving `seedEmail` to `pvaynmaster.manager.email`, dropping the `Здравствуйте` assertion, drop calendar-day duration, etc.) are semantic changes to the XLSX requirements, not mechanical spec fixes.

## For the next session

### Priority 0 — still: human review of digest XLSX before further digest work

The collection is now at `3/14 verified / 6/14 failed`. The remaining work splits into:

- **5 generated TCs awaiting re-verification** (TC-002 / 005 / 006 / 009 / 010). They would need receiver-model revision first to have any chance of passing; re-running without that revision would consume ~15 min of clock time and fail predictably.
- **6 failed TCs** (TC-001 / 008 / 011 / 012 / 013 / 014). Four (011/012/013/014) need XLSX revisions; one (008) needs receiver-model revision; one (001) hit a production AIOOBE bug.

Recommend next session flip `autonomy.stop: true` and escalate. No further Phase C value can be extracted from this collection without XLSX revision.

### If autonomy continues

Potentially safe mechanical work:
1. Audit other collection TCs outside digest for the same `env.toUpperCase()` → `envTag` pattern. Likely none (envTag is a digest-subject-specific invariant), but worth a grep.
2. Audit `RoundcubeVerificationFixture` callers for any other methods passing CLI-unsupported flags.
3. Nothing else in the digest collection without XLSX revision.

## Files changed in session 144 (uncommitted at close)

- `autotests/e2e/tests/digest/digest-tc001.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc002.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc003.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc004.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc005.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc006.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc007.spec.ts` — envTag (2 sites)
- `autotests/e2e/tests/digest/digest-tc008.spec.ts` — envTag (2 sites)
- `autotests/e2e/tests/digest/digest-tc011.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc012.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc013.spec.ts` — envTag
- `autotests/e2e/tests/digest/digest-tc014.spec.ts` — envTag
- `autotests/e2e/fixtures/common/RoundcubeVerificationFixture.ts` — count() route-through-search fix
- `expert-system/vault/_AUTOTEST_PROGRESS.md` — s144 status table
- `expert-system/analytics.db` — `autotest_tracking` updates for TC-003/004/007/008

## Critical DO-NOTs (still in force from s141/142/143)

- Do NOT "fix" TC-011 / 012 by relaxing to `дней: N`. XLSX revision required.
- Do NOT "fix" TC-013 / 014 by matching pvaynmaster's coincidental digest content. Receiver-model revision required.
- Do NOT silently change TC-001 / 002 / 005 / 006 / 009 / 010 / 008 to search ilnitsky's mailbox without an XLSX update — that changes the documented test intent without a human review.
- Do NOT re-introduce per-recipient marker assertions in digest specs. `DigestServiceImpl` emits no log statements.
- Do NOT hard-code env names in specs. Use `tttConfig.envTag`.
- Do NOT inline IMAP or Graylog REST logic in specs — use the fixtures.

## Last updated
2026-04-22 — end of session 144. envTag landed, count() CLI bug fixed, 3 TCs re-verified (TC-003/004/007), 1 demoted (TC-008 → failed, receiver-model defect).
