# Session Briefing — Digest collection Phase B landed; awaiting user review

**Last session close:** 138 (2026-04-21) — Phase B complete for `collection:digest`. 14 TC-DIGEST-* TCs authored across 7 variant pairs (A = scheduler, B = test-endpoint bypass) in `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation`. `autonomy.stop: true` set. The run halted cleanly for user review.

**Current config (as of stop):** `phase.current: generation` · `phase.scope: "collection:digest"` · `autonomy.mode: full` · `autonomy.stop: true` · `autotest.enabled: false`.

## What landed this session

**14 TCs in `TS-Digest-Vacation` (suite tab color `F4B084`):**

| Scenario | Variant A (scheduler) | Variant B (test endpoint) | Priority |
|---|---|---|---|
| Happy path — content-complete body | TC-DIGEST-001 | TC-DIGEST-002 | Critical |
| Empty set — no APPROVED tomorrow vacations | TC-DIGEST-003 | TC-DIGEST-004 | High |
| Leakage guard — non-APPROVED / non-tomorrow records excluded | TC-DIGEST-005 | TC-DIGEST-006 | Critical |
| Subject-format regex — Cyrillic `ТТТ`, no brackets | TC-DIGEST-007 | TC-DIGEST-008 | High |
| Graylog marker audit (scheduler present vs bypass absent) | TC-DIGEST-009 | TC-DIGEST-010 | High |
| Russian plural forms — 1 день / 2 дня / 5 дней / 21 день | TC-DIGEST-011 | TC-DIGEST-012 | High |
| Cross-year date boundary — `01.01.<YYYY+1>` | TC-DIGEST-013 | TC-DIGEST-014 | High |

**Deliverables:**

- `test-docs/collections/digest/digest.xlsx` — `Plan Overview` preserved; `COL-digest` populated (14 data rows); `TS-Digest-Vacation` rebuilt (14 TC rows, frozen header, auto-filter, wrap-text, col widths 14/48/52/64/52/12/12/24/18/40, tab color `F4B084`).
- `test-docs/collections/digest/coverage.md` — LANDED; TC map table added; deltas table rewritten env-independent; progress row flipped to ✅ 14.
- `test-docs/collections/digest/test-plan.md` — LANDED; §2 Environment rewritten as capability table (env-independent); §3 Risk areas expanded to cover 8 concerns (including plural forms, year boundary, wrapper bypass); §4 Verification recipe re-written with `<ENV>` placeholders and A/B clock-advance split; §8 Progress + Session history added.
- `expert-system/generators/digest/generate.py` — new Python generator. Loads existing workbook (preserves Plan Overview sheet), rebuilds `TS-Digest-Vacation` and `COL-digest` data rows. Pre-save audit greps every cell for banned env literals (`qa-1`, `qa1`, `timemachine`, `stage`, `preprod`) with word-boundary matching and asserts `wrap_text=True` on every prose column. Generator fails loudly if either check trips.
- SQLite `test_case_tracking` — 14 new rows inserted (module=`vacation`, feature=`cron-digest`, type=`Hybrid`, source_notes cite `exploration/tickets/t3423-investigation.md § digest`, `external/EXT-cron-jobs.md job 14`, `patterns/email-notification-triggers.md § Digest template`).

## Exit-criteria check

- ✅ Row 14 in `coverage.md` has ≥ 1 TC-DIGEST-* per variant A + B (14/14; no TBD cells).
- ✅ Every TC folds all deltas (dual-trigger, content-complete, env-independent, Cyrillic ТТТ subject, APPROVED ∧ tomorrow rule, scheduler-wrapper bypass asymmetry).
- ✅ XLSX legibility bar met (wrap-text, multi-line cells, column widths ≥ baseline, `freeze_panes="A3"`, auto-filter on header row).
- ✅ Generator pre-save audit passed (0 env-literal defects, 0 wrap-text violations).
- ✅ SQLite 14 rows inserted.
- ✅ `autonomy.stop: true` set.

## What the user does next

1. Open `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation` sheet and review the 14 TCs.
2. Compare against prior art at `test-docs/collections/cron/Cron_Vacation.xlsx` → `TS-Vac-Cron-Digest` (TC-VAC-106..108). The comparison is the whole point of this pipeline-stress-test collection.
3. Record remaining shortcomings as a new round of prompt / KB fixes.
4. Either iterate (edit prompts / KB, delete the TS sheet + `COL-digest` data rows, flip `autonomy.stop: false`, re-run) or declare the prompt + KB baseline acceptable and move on to a different scope.

## Critical DO-NOTs (persisted from pre-run briefing)

- **Do not touch the cron collection.** `test-docs/collections/cron/` is canonical. The only cross-reference is citing `TS-Vac-Cron-Digest` as prior art for comparison.
- **Do not enable Phase C.** `autotest.enabled` stays `false` until the user explicitly flips it.
- **Do not modify prompt / instruction files or KB notes solely to make the generator's job easier.** Those sources are the *input* to this stress-test; the user edits them between iterations, not the runner.

## Comparison target (prior art)

`test-docs/collections/cron/Cron_Vacation.xlsx` → `TS-Vac-Cron-Digest` (TC-VAC-106, TC-VAC-107, TC-VAC-108). These 3 TCs are the baseline. Regressions vs expected improvements:

| Dimension | TC-VAC-106..108 (prior art) | TC-DIGEST-001..014 (this session) |
|---|---|---|
| Env-independence | Mentions `qa-1` / `[QA1][TTT]` | `<ENV>` placeholders throughout; generator audit rejects any env literal |
| Subject assertion | `[QA1][TTT]` Latin | Cyrillic `[<ENV>]ТТТ Дайджест отсутствий` regex |
| Dual-trigger | Single-trigger only (implied scheduler) | Every behavioral TC paired A (scheduler) + B (test endpoint) |
| Content coverage | Subject + recipient | Every dynamic template field (greeting, period date, per-employee Full Name/start/end/type/duration, footer) + negative leakage + plural + year-boundary |
| Total TCs | 3 | 14 |

## Last updated
2026-04-21 — session 138 close. 14 TCs drafted, exit criteria met, `autonomy.stop: true` logged. Awaiting user review.
