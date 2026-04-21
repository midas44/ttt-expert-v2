# Session Briefing — Phase C opens on the `digest` collection

**Last session close:** 138 (2026-04-21) — Phase B landed for `collection:digest`. 14 TC-DIGEST-* TCs authored across 7 variant pairs (A = scheduler, B = test-endpoint bypass) in `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation`. User reviewed; prompts/KB baseline accepted for this iteration.

**Phase switched.** Config now reads:
- `phase.current: autotest_generation`
- `autotest.enabled: true`
- `autotest.scope: "collection:digest"`
- `autonomy.stop: true` (startup auto-flip in run-sessions.sh will unwind)

## What this Phase C run does

Generate Playwright + TypeScript specs for all 14 TC-DIGEST-* cases. Output lands in `autotests/e2e/tests/digest/` — a new directory dedicated to this collection, keeping the stress-test self-contained and reviewable.

Prerequisites already in place:

- **Fixtures**: `autotests/e2e/fixtures/common/RoundcubeVerificationFixture.ts` and `autotests/e2e/fixtures/common/GraylogVerificationFixture.ts` were authored 2026-04-21. Both wrap their respective skill Python CLIs via `child_process.spawnSync`. Use them — do NOT inline IMAP or Graylog REST logic in specs.
- **Manifest refreshed**: `autotests/manifest/test-cases.json` now includes module `digest` (14 cases). Re-run `python3 autotests/scripts/parse_xlsx.py` at session start if you touch the collection XLSX.
- **Collection report persisted**: `autotests/manifest/collection-digest.json` has all 14 TCs with `"action": "needs_generation"` and `target_spec_path` populated per case.
- **Pipeline fixes landed**: `parse_xlsx.py` now scans `test-docs/collections/<name>/`; `process_collection.py` uses header-row-based column lookup (handles 6-col and 7-col COL-* schemas), verifies spec-file TC match by content (not just numeric suffix), and routes collection-scoped specs into `tests/<collection>/`.

## What you (the runner) need to do next

Follow `CLAUDE+.md` §12 (Phase C — Autotest Generation) with the §"Collection scope protocol" refinements. Specifically:

1. Read `autotests/manifest/collection-digest.json` — it's the source of truth for which TCs are in scope. Work only on cases with `"action": "needs_generation"`.
2. For each TC (up to `autotest.max_tests_per_session = 5` per session):
   - Read the TC's full Preconditions / Steps / Expected Result from `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation` sheet (manifest has title + classified_type; full cell content is only in the XLSX).
   - Read vault context: [[exploration/tickets/t3423-investigation]] § digest, [[external/EXT-cron-jobs]] § Row 14, [[patterns/email-notification-triggers]] § Digest template.
   - Generate spec at `target_spec_path` (path is supplied per-case in the report JSON).
   - Generate supporting data classes at `autotests/e2e/data/digest/` as needed.
   - Add tags: `@regress @digest @col-digest`.
   - Run the spec via `npx playwright test e2e/tests/digest/<file> --project=chrome-headless` and attempt up to `auto_fix_attempts = 3` fixes per failure.
3. After each spec lands (even failing), re-run `process_collection.py --collection digest` to update tags and the report. This refreshes the `needs_generation` count.
4. Update `autotest_tracking` in SQLite with automation_status for each TC.
5. Update `_AUTOTEST_PROGRESS.md` vault note with coverage metrics at session end.

## Must-use fixtures — content-complete verification

The 14 digest TCs require every email field to be asserted (see `CLAUDE+.md` §11 "Content-Complete Verification for Notification TCs"). Fixture helpers that matter:

- `RoundcubeVerificationFixture.waitForEmail({subject, sinceSearch, match, timeoutMs: 30_000})` — poll until the digest email arrives.
- `RoundcubeVerificationFixture.read(uid)` — fetch text body for per-field assertions.
- `RoundcubeVerificationFixture.assertBodyContains(body, ...fragments)` — one call per dynamic field (Full Name, start date, end date, type, duration).
- `RoundcubeVerificationFixture.assertBodyMissing(body, ...fragments)` — leakage guard (non-APPROVED / non-tomorrow data must not appear).
- `GraylogVerificationFixture.waitForMarker({query, range: "5m"})` — Variant A scheduler markers.
- `GraylogVerificationFixture.assertAbsent({query, range: "5m"})` — Variant B wrapper bypass.
- `GraylogVerificationFixture.countPerRecipient({query}, /Mail has been sent to ([\w.+@-]+) about NOTIFY_VACATION_UPCOMING/)` — multi-recipient digest audits.

The fixtures read config from `config/roundcube/roundcube.yaml` and `config/graylog/graylog.yaml`. The env used is whatever those YAMLs point at — test specs stay env-independent (no hard-coded env names).

## Critical DO-NOTs

- **Do not touch the cron collection.** `test-docs/collections/cron/` and any `@col-cron` tagging is out of scope here. Only work on `digest`.
- **Do not target `autotests/e2e/tests/vacation/`** for TC-DIGEST-*. Specs land in `autotests/e2e/tests/digest/`. The collection-digest report's `target_spec_path` is authoritative.
- **Do not hard-code env names** in specs. Subject regex uses `<ENV>` placeholder; Graylog stream is derived from `GlobalConfig.primary.env` via the fixture constructor. See `CLAUDE+.md` §11 "Environment Independence".
- **Do not inline IMAP or Graylog REST code** in specs. Use the fixtures — that's why they exist.
- **Do not edit prompts / KB files solely to ease Phase C.** If a TC has ambiguity that blocks spec generation, flag it in this briefing and wait for user review rather than editing the TC or the KB.
- **Do not expand scope.** Only the 14 TC-DIGEST-* cases. Do not generate specs for TC-VAC-106..108 (prior art) or any other cron TCs.

## Exit conditions

- All 14 TC-DIGEST-* have specs in `autotests/e2e/tests/digest/`.
- `collection-digest.json` summary shows `needs_generation: 0`, `tag_already_present + tag_added = 14`.
- Each spec runs end-to-end (or is marked `failed` with a documented reason after 3 fix attempts).
- SQLite `autotest_tracking` has an entry per TC.
- `_AUTOTEST_PROGRESS.md` updated.
- `autonomy.stop: true` set in config.

## Expected session count

14 TCs ÷ 5 per session ≈ **3 sessions**. Specs with clock manipulation (Variants A) are slower than test-endpoint specs (Variants B) — if a session struggles with a Variant A spec, skip it and come back after the simpler variants are shaken down.

## Comparison target (prior art)

After the run, user will compare the generated digest specs against whatever minimal reference exists (there is no Phase-C output for TC-VAC-106..108 yet — the cron collection stopped at Phase B). Phase C for digest is thus also a first-pass validation of the spec-generation pipeline on the new authoring rules.

## Last updated
2026-04-21 — Phase C prepared. Fixtures built; manifest + collection report refreshed; pipeline scripts fixed; CLAUDE+.md §12 collection protocol updated. User flips `autonomy.stop: false` (or invokes run-sessions.sh, which auto-flips) when ready to start.
