# Test Plan — Digest Testing Collection (Pipeline-Stress-Test Scope)

**Parent ticket:** #3423
**Parent collection:** `cron` (landed 2026-04-18)
**Collection name:** `digest`
**Scope row:** Row 14 — Vacation notifications (digest)
**Created:** 2026-04-21
**Last updated:** 2026-04-21 (session 138 — 14 TCs landed, 7 variant pairs)
**Status:** **LANDED** — Phase B complete. 14 TCs in `TS-Digest-Vacation`; all seven exit-criterion scenarios represented; ready for user review against prior art (`TS-Vac-Cron-Digest` in `Cron_Vacation.xlsx`).

## 1. Overview

Narrow collection scoped to a single cron job (the daily vacation-digest email) to exercise the TTT test-doc generation pipeline end-to-end after edits to prompt/instruction files and knowledge base notes. Review the generator's output here before re-running the full cron scope.

See `docs/tasks/digest/digest-testing-task.md` for the scope rationale, deltas, and expected deliverables. This plan is the session-level working document — update it as Phase B progresses.

### File layout

```
test-docs/collections/digest/
├── digest.xlsx       — Plan Overview + COL-digest reference sheet + TS-Digest-Vacation suite
├── test-plan.md      — this document
└── coverage.md       — traceability matrix (1 row — job 14)
```

Test IDs use the collection-local pattern `TC-DIGEST-NNN`. Suite sheet name: `TS-Digest-Vacation` (orange `F4B084` tab color per the cron-suite convention).

## 2. Environment

TCs are **environment-independent** — every cell uses `<ENV>` placeholders and `TTT-<ENV>` stream names. Executors substitute the configured env at run time. The table below describes capabilities, not specific environments.

| Capability | Required? | Notes |
|---|:---:|---|
| Test-clock endpoint (`PATCH /api/ttt/v1/test/clock`) | ✅ for Variant A TCs | Scheduler variant needs clock advance to just before 08:00 NSK so the `@Scheduled` wrapper fires in ≤ 60 s. Variant B (test endpoint) does not require it. |
| Vacation-service test endpoint (`POST /api/vacation/v1/test/digest`) | ✅ | All Variant B TCs trigger via this endpoint (scheduler-wrapper bypass). |
| API bearer token (swagger defaults file) | ✅ | Seed + trigger + cleanup paths all authenticate via the token. |
| Graylog stream `TTT-<ENV>` | ✅ | Marker assertions (both variants). |
| Roundcube IMAPS access to shared QA mailbox | ✅ | Email-content assertions for all TCs. |

The digest test endpoint bypasses the `@Scheduled` wrapper, so wall-clock time on the environment does not matter for Variant B. Variant A deliberately exercises the wrapper (clock advance + poll for start/finish markers) and therefore depends on test-clock availability. TCs document which variant they are in the Notes column.

## 3. Risk areas

Single-cluster plan — all risks sit within Row 14.

| Concern | Why it matters |
|---|---|
| Endpoint path drift | Scope table still shows `/vacations/notify`; release/2.1 is `/digest`. TC precondition spells the actual path. |
| Subject anomaly | `[<ENV>]ТТТ Дайджест отсутствий` — Cyrillic `ТТТ` (no brackets around the service tag), unlike every other TTT template that uses bracketed Latin `[TTT]`. TCs assert the exact anomalous shape via regex. |
| Cross-service dispatch window | Vacation service enqueues; email-service dispatch loop (~20 s) delivers. Mailbox assertions poll for ≥ 30 s before failing. |
| APPROVED-only business rule | Digest reads APPROVED vacations starting tomorrow. PENDING/REJECTED/CANCELLED seeded alongside and must be absent from the body — the core negative control (leakage guard, TC-005/006). |
| Wrapper bypass via test endpoint | `/test/digest` does not run the `@Scheduled` wrapper; scheduler markers must **not** fire for Variant B. Variant B asserts their absence; Variant A asserts their presence (TC-009/010). |
| Russian plural forms | 1 → `день`, 2-4 → `дня`, 5-20 & 0 → `дней`, then cycles (21 → `день` again). Template plural logic is easy to regress; TC-011/012 asserts each bracket. |
| Date formatting at year boundary | Template renders `DD.MM.YYYY`. A digest run whose tomorrow is Jan 1 crosses the year boundary; TC-013/014 asserts the correct YYYY+1. |
| Empty-set idempotence | When no vacations qualify, Variant A must still emit start+finish markers cleanly (zero mail-sent markers); Variant B must return 200 with zero markers. TC-003/004. |

## 4. Verification recipe (per TC)

Env-independent mirror of the cron-collection recipe:

1. **SETUP (data)** — via `mcp__swagger-<ENV>-vacation-default__crt-vacation-using-pst` (seed APPROVED vacation with `start_date = CURRENT_DATE + INTERVAL '1 day'`) and/or `crt-vacation-using-pst` with `APPROVED` status flip via `approve-vacation-using-put`. For leakage guard tests, seed additional rows with non-APPROVED statuses or non-tomorrow dates that must be excluded.
2. **SETUP (mailbox baseline)** — `roundcube-access count --subject "[<ENV>]ТТТ Дайджест" --since today` before the trigger, so the post-trigger assertion can diff.
3. **SETUP (clock, Variant A only)** — `PATCH /api/ttt/v1/test/clock` to `CURRENT_DATE 07:59:55 NSK`.
4. **TRIGGER** — Variant A: wait ≤ 60 s for the scheduler to fire. Variant B: `POST /api/vacation/v1/test/digest` (no body).
5. **WAIT** — poll for up to 30 s (5-s cadence, 6 attempts) until either the expected email lands OR the Graylog marker sequence completes.
6. **VERIFY**
   - **Email** — `roundcube-access search --subject "[<ENV>]ТТТ Дайджест отсутствий" --since today`; assert subject regex `/^\[<ENV>\]ТТТ Дайджест отсутствий$/`, sender (config-keyed), recipient (seeded login's email), timestamp within window; body contents per `patterns/email-notification-triggers.md § Digest template — content schema` (greeting + period date + per-employee block with Full Name + start + end + type + duration (plural-aware) + footer); negative assertions for non-APPROVED / non-tomorrow rows.
   - **Log** — `graylog-access search --stream TTT-<ENV>` for the start / finish markers (Variant A only — Variant B asserts absence) + per-recipient `Mail has been sent to <email> about NOTIFY_VACATION_UPCOMING...` lines (both variants).
   - **DB** — optional sanity: seeded vacation rows unchanged (digest is read-only).
7. **CLEANUP (clock)** — Variant A: reset clock to real time via `PATCH /api/ttt/v1/test/clock`.
8. **CLEANUP (data)** — delete seeded vacations; do not purge mailbox (only remove emails this test added, matched by subject + timestamp).

## 5. Entry criteria

- VPN active (Graylog, Roundcube, TTT/vacation services for the configured env).
- Roundcube IMAP credentials at `config/roundcube/envs/<ENV>.yaml`.
- Graylog API token at `config/graylog/envs/secret.yaml`.
- Vacation-service swagger reachable (`mcp__swagger-<ENV>-vacation-default__*`).
- Parent vault notes up-to-date: `expert-system/vault/external/EXT-cron-jobs.md` § job 14, `expert-system/vault/exploration/tickets/t3423-investigation.md`, `expert-system/vault/patterns/email-notification-triggers.md` § Digest template — content schema.

## 6. Exit criteria

- ✅ Row 14 in `coverage.md` has ≥ 1 `TC-DIGEST-*` per variant (A + B); no TBD cells. *(landed: 14 TCs, 7 A+B pairs)*
- ✅ `COL-digest` sheet in `digest.xlsx` references every TC landed in `TS-Digest-Vacation`. *(landed)*
- ✅ Every TC folds all deltas: dual-trigger (A + B), content-complete body assertion, env-independent (no `qa-1` / `timemachine` / `stage` / `preprod` literals), Cyrillic `ТТТ` subject regex, APPROVED ∧ tomorrow business rule, wrapper-bypass marker difference.
- ✅ Scenario coverage: happy-path (content-complete), empty-set, subject-regex audit, Graylog marker audit (scheduler vs bypass), leakage guard (negative), plural-form edge cases, cross-year date boundary.
- ✅ XLSX legibility bar met (wrap-text on prose columns; column widths 14/48/52/64/52/12/12/24/18/40; `freeze_panes="A3"`; auto-filter on row 2; tab color `F4B084`; row heights sized by line count).
- ✅ Grep-clean: no env literals in any cell (verified by generator's pre-save audit).
- ✅ SQLite `test_case_tracking` rows inserted for all 14 TCs.
- ✅ `autonomy.stop: true` set — run halts cleanly for user review.

## 7. Out of scope

- Row 8 (email-dispatch batch) TCs — already covered in `test-docs/collections/cron/Cron_Email.xlsx` → `TS-Email-CronDispatch`. If a digest TC needs to assert dispatch timing, cite that suite as prior art; do not duplicate.
- Phase C autotest generation. `autotest.enabled` remains `false` for the digest collection unless explicitly flipped later.
- Revisions to the cron collection. Any improvements that originate here stay in the digest output until the user decides to promote them.
- Production-calendar reminder (Row 15) — different endpoint, different template family. Similar in shape, but scoped out to keep the stress-test narrow.

## 8. Progress

| Cluster | Row(s) | TCs landed | Status |
|---|---|---:|---|
| Digest | 14 | 14 | ✅ Landed 2026-04-21 (session 138) |

### Session history

| Session | Date | TCs authored | Notes |
|--:|---|---:|---|
| 138 | 2026-04-21 | 14 | Phase B complete. 7 variant pairs covering happy-path, empty-set, leakage guard, subject regex, Graylog markers, plural forms, cross-year date. Generator audit (env-literal grep + wrap-text check) passed. |

---

*This plan updates session-by-session. `COL-digest` is the live index of landed TCs; every update to the suite sheet must be mirrored by a COL-digest row and a coverage.md line.*
