# Investigation Agenda

## Phase B — Digest collection (pipeline-stress-test scope) — LANDED 2026-04-21

**Status:** **COMPLETE** — 14 TCs in `TS-Digest-Vacation` landed in session 138. `autonomy.stop: true` set. User review pending.

**Scope (config.yaml):** `phase.scope: "collection:digest"` → collection-shaped deliverables at `test-docs/collections/digest/`. Canonical preamble: `docs/tasks/digest/digest-testing-task.md`.

### P0 — Immediate

*None. Phase B closed for the digest collection. User drives next step (review, iterate, or switch scope).*

### P1 — Next-iteration candidates (if user decides to re-run)

The point of this collection is to compare generator output against prior art and surface remaining shortcomings for another round of prompt / KB fixes. After user review, likely iteration targets:

- [ ] **Compare `TS-Digest-Vacation` vs `TS-Vac-Cron-Digest`** (user-driven). Remaining gaps become the next prompt / KB edits.
- [ ] **Re-run on the same scope after prompt / KB edits.** Protocol: `autonomy.stop: false` → generator overwrites `TS-Digest-Vacation` and `COL-digest` data rows idempotently. Plan Overview is preserved by the generator.
- [ ] **Promote improvements to the cron collection** once the digest output meets the bar — regenerate `test-docs/collections/cron/` with the updated prompts. This is a larger effort (87 TCs, 23 rows); coordinate with user before starting.

### P2 — Lower priority

- [ ] **Generator hardening** — add a `--dry-run` mode to `expert-system/generators/digest/generate.py` that runs the audit but does not save. Useful between prompt edits to sanity-check the TC list before committing.
- [ ] **Cross-collection TC style check** — write a one-off script that greps every TS sheet under `test-docs/` for env literals. Catches drift across collections.

## Phase B — Cron collection (ticket #3423) — COMPLETE 2026-04-18

<details><summary>Historical record (collapsed) — 87 TCs, 23/23 rows, 10/10 deltas folded</summary>

Phase B closed session 138 (parent ticket) with:

- 14 suites / 87 TCs / 5 home workbooks / 23/23 rows covered / 10/10 deltas folded.
- Home workbooks: `vacation.xlsx` (27 TCs), `reports.xlsx` (20), `cross-service.xlsx` (21), `statistics.xlsx` (8), `email.xlsx` (11).
- Generators under `expert-system/generators/t3423/` — all idempotent.
- Collection shell at `test-docs/collections/cron/` — `COL-cron` 87 rows, `coverage.md` COMPLETE.

The digest collection (this current scope) is a narrow pipeline-stress-test derived from row 14 of that work. TC-VAC-106..108 in `Cron_Vacation.xlsx` → `TS-Vac-Cron-Digest` are the prior-art baseline for user comparison.

</details>

## Phase C — Autotest Generation — frozen

`autotest.enabled: false`. Scope table says the digest collection is **evaluation-only** — no Phase C target. Do not flip this without explicit user instruction.

## Deliverables tracking

| Artifact | Path | Status | Session |
|---|---|---|---|
| Task doc | `docs/tasks/digest/digest-testing-task.md` | Stable (user-owned) | — |
| Test plan | `test-docs/collections/digest/test-plan.md` | ✅ LANDED (env-independent) | 138 |
| Coverage | `test-docs/collections/digest/coverage.md` | ✅ LANDED | 138 |
| Workbook | `test-docs/collections/digest/digest.xlsx` | ✅ LANDED (14 TCs) | 138 |
| Generator | `expert-system/generators/digest/generate.py` | ✅ Idempotent + pre-save audit | 138 |
| SQLite | `test_case_tracking` TC-DIGEST-001..014 | ✅ 14 rows inserted | 138 |

## Last updated
2026-04-21 — session 138 close. Phase B landed for `collection:digest`. Awaiting user review and/or next-iteration decision.
