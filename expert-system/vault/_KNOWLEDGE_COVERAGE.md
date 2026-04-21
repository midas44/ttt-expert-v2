# Knowledge Coverage — Phase B

**Current scope (config.yaml):** `phase.scope: "collection:digest"` → pipeline-stress-test collection derived from row 14 of the canonical #3423 cron scope. Phase C gated off (`autotest.enabled: false`).

## Current scope — Digest collection — LANDED 2026-04-21

**Status:** **COMPLETE** — 14 TCs landed in `TS-Digest-Vacation`, 7 variant pairs (A = scheduler, B = test-endpoint bypass). `autonomy.stop: true` set.

### Row-level coverage

| Row | Job | TCs in COL-digest | Status |
|----:|-----|:---:|--------|
| 14 | Vacation — digest (`POST /api/vacation/v1/test/digest`) | 14 (7 A+B pairs) | ✅ LANDED (2026-04-21) |

### TC map

| Scenario | Variant A | Variant B | Priority |
|---|---|---|---|
| Happy path — content-complete body | TC-DIGEST-001 | TC-DIGEST-002 | Critical |
| Empty set | TC-DIGEST-003 | TC-DIGEST-004 | High |
| Leakage guard | TC-DIGEST-005 | TC-DIGEST-006 | Critical |
| Subject regex (Cyrillic ТТТ, no brackets) | TC-DIGEST-007 | TC-DIGEST-008 | High |
| Graylog marker audit (scheduler vs bypass) | TC-DIGEST-009 | TC-DIGEST-010 | High |
| Russian plural forms | TC-DIGEST-011 | TC-DIGEST-012 | High |
| Cross-year date boundary | TC-DIGEST-013 | TC-DIGEST-014 | High |

### Session 138 — delta (current session)

- **14 TCs landed** in `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation` (tab color `F4B084`).
- **`COL-digest` populated** with 14 data rows — row 1 description and row 2 headers preserved; rows 3–16 rewritten.
- **`coverage.md` finalized** — Row 14 TBD cell replaced with `TC-DIGEST-001..014`; deltas table rewritten env-independent; progress flipped to ✅.
- **`test-plan.md` landed** — §2 Environment rewritten as capability table (env-independent); §3 Risk areas expanded to 8 concerns; §4 Verification recipe rewritten with `<ENV>` placeholders and A/B clock-advance split; §8 Progress + Session history added.
- **Generator committed** — `expert-system/generators/digest/generate.py` (load-and-rewrite pattern with pre-save audit that fails on any env-literal leak or missing wrap-text).
- **SQLite `test_case_tracking`** — 14 new rows (module=`vacation`, feature=`cron-digest`, type=`Hybrid`, status=`drafted`).

### Exit criteria check

- [x] ≥ 1 `TC-DIGEST-*` per variant A + B — **14/14 ✅**
- [x] All 8 deltas folded (endpoint, subject, markers, rule, wrapping, trigger coverage, content coverage, env coupling) — **8/8 ✅**
- [x] At least one TC each paired A+B for: happy-path, empty-set, subject regex, Graylog markers, leakage guard, plural form, date boundary — **7/7 ✅**
- [x] XLSX legibility (wrap-text, col widths, freeze panes, auto-filter, tab color, row heights) — **Audit ✅**
- [x] Grep-clean (no `qa-1` / `qa1` / `timemachine` / `stage` / `preprod` literals) — **Audit ✅**
- [x] SQLite rows inserted — **14/14 ✅**
- [x] `autonomy.stop: true` — set

## Previous scope — Cron collection (ticket #3423) — COMPLETE 2026-04-18

<details><summary>Historical record (collapsed) — 87 TCs, 23/23 rows, 10/10 deltas folded</summary>

Phase B closed with 14 suites / 87 TCs / 5 home workbooks / 23/23 rows covered / 10/10 scope-table deltas folded. The current digest collection is a narrow stress-test re-run of row 14 of that scope, using updated prompts and KB notes, to see whether the generator output improves vs prior art TC-VAC-106..108 in `Cron_Vacation.xlsx` → `TS-Vac-Cron-Digest`.

Home workbooks: `vacation.xlsx` (27), `reports.xlsx` (20), `cross-service.xlsx` (21), `statistics.xlsx` (8), `email.xlsx` (11).

</details>

## Knowledge base inputs consumed (digest collection)

| Source note | Role |
|---|---|
| [[exploration/tickets/t3423-investigation]] § digest | Endpoint, markers, APPROVED-only rule, wrapper bypass asymmetry |
| [[external/EXT-cron-jobs]] § job 14 | Canonical job description, schedule, markers |
| [[patterns/email-notification-triggers]] § Digest template | Subject regex (Cyrillic ТТТ), content schema (greeting / period / per-employee block / footer / plural forms) |
| [[modules/email-notification-deep-dive]] | Dispatcher plumbing (informational — dispatch timing loop, ~20 s fan-out window) |

## Phase C — Autotest Generation — frozen

`autotest.enabled: false` — scope table says digest collection is evaluation-only (no Phase C target for this collection). Do not flip without user instruction.

## Last updated
2026-04-21 — session 138 close. Digest collection LANDED (14 TCs, 7 variant pairs). Awaiting user review.
