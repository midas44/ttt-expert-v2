# Digest Testing Collection — Pipeline-Stress-Test Scope

**Parent ticket:** #3423 (Cron & Startup Jobs Testing Collection — Phases A+B complete 2026-04-18)
**Parent task doc:** `docs/tasks/cron/cron-testing-task.md`
**Collection name:** `digest`
**Scope row from parent:** **Row 14 — Vacation notifications (digest)**
**Primary reference:** [Confluence: cron](https://projects.noveogroup.com/spaces/NOV/pages/32904541/cron) (§ row 14)
**Created:** 2026-04-21

## Why this collection exists

The full `cron` collection (87 TCs across 23 rows, landed 2026-04-18) is the canonical cron-regression suite for TTT. A review of those TCs surfaced multiple shortcomings in the generated test documentation that trace back to the prompt / instruction files (`CLAUDE.md`, `CLAUDE+.md`, skill SKILL.md files) and to gaps or inaccuracies in the knowledge base (`expert-system/vault/**`). The user will edit those sources directly; this collection exists to **re-run the generation pipeline on a minimal scope and see whether the fixes produced the improvements intended**.

Regenerating the entire cron collection on every iteration would be expensive and noisy. The digest row is chosen because it is:

- **Narrow** — one cron job, one endpoint, one email family; any test-doc shortcoming shows up quickly.
- **Representative** — exercises every verification channel the full cron collection uses (API trigger, test-clock optional, RabbitMQ fan-out to the email service, Roundcube email assertion, Graylog log-marker assertion, DB precondition seeding). If the generator handles this well, the improvements transfer to the rest of the cron rows.
- **Already well-understood** — the underlying code paths and deltas were mapped during the cron run (see `expert-system/vault/exploration/tickets/t3423-investigation.md` and `expert-system/vault/external/EXT-cron-jobs.md` § job 14). The knowledge base already has the raw material; the question is whether prompts + KB together now steer the generator to produce sharper TCs.

## What this collection is NOT

- **Not a replacement for the cron collection.** `test-docs/collections/cron/` remains canonical. This digest collection is **evaluation-only**: the output is to be reviewed, compared with the existing `TS-Vac-Cron-Digest` suite in `test-docs/collections/cron/Cron_Vacation.xlsx`, and any remaining generator gaps captured for a second round of prompt / KB fixes.
- **Not a new Phase-C target.** `autotest.enabled: false` remains in effect; no spec generation for this collection until the user explicitly re-enables it.
- **Not a superset.** Row 8 (email dispatch batch) is downstream of the digest but is **out of scope** here; if you need to discuss how dispatch settles an emitted digest, cite the existing `TS-Email-CronDispatch` suite as prior art rather than duplicating its TCs.

## Scope — Row 14 only

| # | Service  | Job                     | Schedule        | Trigger                                           | Channels |
|---|----------|-------------------------|-----------------|---------------------------------------------------|----------|
| 14 | Vacation | Vacation notifications (digest) | Daily 08:00 (NSK) | `POST /api/vacation/v1/test/digest` | E, L     |

### Known deltas from the canonical scope table (fold into TC preconditions)

Already surfaced during the cron run (session 130) plus the 2026-04-21 post-review rules; any regenerated TC must reflect these facts rather than the original scope-table wording:

| Field | Scope table said | Actual (release/2.1) |
|---|---|---|
| Endpoint path | `POST /api/vacation/v1/test/vacations/notify` | `POST /api/vacation/v1/test/digest` |
| Subject format | Implied `[<ENV>]` Latin service tag | **`[<ENV>]ТТТ Дайджест отсутствий`** — Cyrillic `ТТТ` service tag with no brackets around it (note: this is anomalous vs every other TTT template which uses bracketed Latin `[TTT]`) |
| Log marker family | `NOTIFY_VACATION_UPCOMING` (scheduler-level only) | Scheduler variant emits `"Digests sending job started"` → `"Digests sending job finished"`; test-endpoint variant bypasses the wrapper and emits only per-recipient `"Mail has been sent to <email> about NOTIFY_VACATION_UPCOMING..."` on the configured env's Graylog stream (`TTT-<ENV>`) |
| Business rule | Implied "all vacations" | Only **APPROVED** vacations whose `start_date = CURRENT_DATE + INTERVAL '1 day'` (i.e. tomorrow) are included; PENDING / REJECTED / CANCELLED are excluded |
| Trigger coverage | Implied "trigger via test endpoint" | **Dual-trigger required**: every behavioral TC has Variant A (server-clock advance + wait for `@Scheduled` wrapper) and Variant B (test endpoint bypass). See `CLAUDE+.md` §11. |
| Content coverage | Implied "body contains recipient" | **Content-complete**: assert every dynamic field the template renders — greeting + recipient display_name, period statement + tomorrow's date, per-employee blocks (Full Name, start date, end date, type, duration with plural form), closing footer, and negative assertions (no data from non-APPROVED or non-tomorrow vacations). See [[patterns/email-notification-triggers]] § "Digest template (Row 14) — content schema". |
| Environment coupling | Implied qa-1 by examples | **Env-independent**: TC cells use `<ENV>` placeholders (subject pattern `/^\[<ENV>\]ТТТ Дайджест отсутствий$/`, stream `TTT-<ENV>`); no `qa-1` / `timemachine` / `stage` literals anywhere in the TC |

### Verification channels (mandatory)

1. **Roundcube** (`roundcube-access` skill) — mandatory. The digest **is** an email notification; DB-only or log-only verification is insufficient. Assertions must cover every field per the content schema in [[patterns/email-notification-triggers]] § "Digest template (Row 14) — content schema", specifically:
   - **Envelope** — sender (reference the TTT system-notification sender by config key, do not inline a literal address), recipient (the specific login seeded for the TC), timestamp within a bounded post-trigger window (typically ≤ 30 s including the 20 s email-service dispatch loop).
   - **Subject** — regex match `/^\[<ENV>\]ТТТ Дайджест отсутствий$/` (env-independent; note Cyrillic ТТТ + no bracket around the service tag).
   - **Body** — greeting with the recipient's display name; period statement with tomorrow's date formatted `DD.MM.YYYY`; one per-employee block per APPROVED vacation in the seed; each block asserts Full Name + start date + end date + vacation type (localized) + duration with correct plural form; footer present.
   - **Negative** — no blocks for non-APPROVED vacations, no blocks for vacations starting on other days, no leakage of data from unrelated employees.
2. **Graylog** (`graylog-access` skill) — mandatory alongside Roundcube. Stream `TTT-<ENV>` (configured env substituted at run time):
   - Variant A (clock-advance + scheduler): scheduler markers `"Digests sending job started"` and `"Digests sending job finished"` emit; one per-recipient `"Mail has been sent to ... about NOTIFY_VACATION_UPCOMING..."` per recipient; no ERROR lines in the digest scheduler span.
   - Variant B (test endpoint): scheduler markers do **not** emit (wrapper bypass); only the per-recipient markers appear. Document the absence in Expected Result.
3. **DB** — preconditions only. Seed APPROVED vacations via `mcp__swagger-<env>-vacation-default__crt-vacation-using-pst` or direct DB insert; verify via SQL that the seed landed and was not mutated by the trigger (digest is read-only).

## Expected deliverables (for the autonomous run)

When the runner processes `scope: "collection:digest"`, it is expected to produce:

1. **`test-docs/collections/digest/digest.xlsx`** — populated `COL-digest` reference sheet (schema mirrors `COL-cron`) + `Plan Overview` sheet + `TS-Digest-Vacation` suite sheet containing the Phase-B TCs. TC IDs use the collection-local pattern `TC-DIGEST-001`, `TC-DIGEST-002`, … (do **not** reuse `TC-VAC-106..108`; those continue to live in `Cron_Vacation.xlsx`).
2. **`test-docs/collections/digest/coverage.md`** — updated with each TC ID for row 14; no TBD cells.
3. **`test-docs/collections/digest/test-plan.md`** — fleshed out per session (seeded skeleton is already in place).
4. **Vault updates** — if any new finding surfaces that is not yet in `expert-system/vault/exploration/tickets/t3423-investigation.md` or `expert-system/vault/external/EXT-cron-jobs.md` § job 14, append via `mcp__obsidian__patch_note` rather than duplicating.
5. **SQLite** — `test_case_tracking` rows for each new `TC-DIGEST-*` ID. Columns per schema (2026-04-21): `test_id`, `module=vacation`, `feature=cron-digest`, `title`, `type` (Hybrid/UI/API), `priority` (Critical/High/Medium/Low), `status=drafted`, `source_notes` (vault refs), `xlsx_file=test-docs/collections/digest/digest.xlsx`, `created_date`.

## Entry criteria (before the first Phase B session)

- Knowledge base is up-to-date with any fixes the user intends to evaluate. Spot-check that `expert-system/vault/exploration/tickets/t3423-investigation.md` § digest section and `EXT-cron-jobs.md` § job 14 reflect the intended corrections.
- Prompt / instruction files (`CLAUDE.md`, `CLAUDE+.md`, relevant skill SKILL.md files) are on the branch.
- This task doc, `test-plan.md`, `coverage.md`, and the empty `digest.xlsx` (COL-digest header-only) are committed.
- `expert-system/config.yaml` has `phase.scope: "collection:digest"` (or the runner's chosen equivalent) and `autotest.enabled: false`.
- `_SESSION_BRIEFING.md` has been updated to orient the next session onto the digest scope and away from the finished cron scope.

## Exit criteria

- Row 14 of `coverage.md` has at least one `TC-DIGEST-*` TC per variant (A: scheduler-clock, B: test-endpoint) and no TBD cells.
- Every TC reflects all deltas in the table above — especially the **dual-trigger** requirement (every behavioral scenario paired A+B) and the **content-complete** assertion of the digest template body.
- Every TC is **environment-independent** — no `qa-1`, `timemachine`, `stage`, or other specific env tokens in any cell. Substitute `<ENV>` or use phrasing like "on the configured test environment".
- XLSX **legibility bar met**: Preconditions / Steps / Expected Result cells use wrap-text, vertical-align top, multi-line content via `\n`; column widths at or above the baseline in `CLAUDE+.md` §11 XLSX Format (Title 48, Preconditions 52, Steps 64, Expected 52 minimum).
- At least one TC each, paired in A+B variants where applicable: happy-path (tomorrow's vacations present, content-complete body assertion), empty-set (no applicable vacations), subject-format audit (Cyrillic `ТТТ` envelope regex), negative (leakage-guard: APPROVED vacations on other days / non-APPROVED statuses must NOT appear in body), plural-form / date-format edge cases for the body. The exact TC count is the generator's call given the improved prompts + KB.
- `autonomy.stop: true` set in config so the run halts cleanly for review.

## Pipeline-stress-test handoff to the user

After the run:

1. The user compares the new `TS-Digest-Vacation` suite against the existing `TS-Vac-Cron-Digest` suite in `test-docs/collections/cron/Cron_Vacation.xlsx`.
2. Shortcomings that remain despite the prompt / KB fixes are recorded as a new round of fixes — iterate.
3. Once the output meets the bar, optionally promote the same improvements to the cron collection by regenerating it (or by running a similarly narrow scope on another cron row to further validate).

This doc itself is stable across iterations — edit the prompts and KB, not this doc, unless the scope of the digest collection needs to change.

## Cross-references

- Parent task doc (full cron scope): `docs/tasks/cron/cron-testing-task.md`
- Parent execution report: `docs/tasks/cron/execution-phases-a-b.md`
- Canonical investigation note: `expert-system/vault/exploration/tickets/t3423-investigation.md`
- Canonical catalog: `expert-system/vault/external/EXT-cron-jobs.md` (§ job 14)
- Prior-art suite in the cron collection: `test-docs/collections/cron/Cron_Vacation.xlsx` → `TS-Vac-Cron-Digest` (`TC-VAC-106..108`)
- Collection pattern: `.claude/skills/collection-generator/SKILL.md`
- Runner protocol: `CLAUDE+.md` §10 (collection-scope detection, scope normalization)
