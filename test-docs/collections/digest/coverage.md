# Traceability — Digest Testing Collection

**Parent ticket:** #3423
**Parent collection:** `cron` (landed 2026-04-18)
**Collection name:** `digest`
**Created:** 2026-04-21
**Last updated:** 2026-04-21 (session 138 — Phase B landed 14 TCs)
**Status:** **LANDED** — Phase B complete for this collection; 14 TCs authored across 7 variant pairs (A = scheduler, B = test endpoint). Phase C gated off; user will compare against `TS-Vac-Cron-Digest` (TC-VAC-106..108) prior art.

Single-row scope: Row 14 from the canonical #3423 scope table. Every TC landed in `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation` suite lists its ID here.

| # | Job | Source workbook | TC IDs | Spec file(s) |
|---:|-----|-----------------|--------|--------------|
| 14 | Vacation notifications (digest) — `POST /api/vacation/v1/test/digest` (daily 08:00 NSK) | `test-docs/collections/digest/digest.xlsx` | TC-DIGEST-001..014 | n/a (Phase C gated off) |

### TC map (A = clock-advance + scheduler; B = test-endpoint bypass)

| Scenario | Variant A (scheduler) | Variant B (test endpoint) | Priority |
|---|---|---|---|
| Happy path — content-complete body | TC-DIGEST-001 | TC-DIGEST-002 | Critical |
| Empty set — no APPROVED tomorrow vacations | TC-DIGEST-003 | TC-DIGEST-004 | High |
| Leakage guard — non-APPROVED / non-tomorrow records excluded | TC-DIGEST-005 | TC-DIGEST-006 | Critical |
| Subject-format regex — Cyrillic `ТТТ`, no brackets | TC-DIGEST-007 | TC-DIGEST-008 | High |
| Graylog marker audit (scheduler markers present vs bypass absent) | TC-DIGEST-009 | TC-DIGEST-010 | High |
| Russian plural forms — 1 день / 2 дня / 5 дней / 21 день | TC-DIGEST-011 | TC-DIGEST-012 | High |
| Cross-year date boundary — `01.01.<YYYY+1>` | TC-DIGEST-013 | TC-DIGEST-014 | High |

## Status legend

- `n/a (Phase C gated off)` — spec paths populated when `autotest.enabled: true`; remains `false` for this collection until the user explicitly re-enables.

## Verification channels for this row

`E` = Roundcube email (mandatory)  |  `L` = Graylog log (mandatory)  |  `DB` = vacation-service DB (preconditions + read-only post-assert)

| # | Channels | Notes |
|---:|---|---|
| 14 | E, L (DB as precondition) | Subject regex `/^\[<ENV>\]ТТТ Дайджест отсутствий$/` (Cyrillic ТТТ, no brackets around service tag); per-recipient `Mail has been sent to <email> about NOTIFY_VACATION_UPCOMING...` log line on `TTT-<ENV>`; scheduler variant emits `"Digests sending job started"` → `"Digests sending job finished"`; test-endpoint variant bypasses wrapper (scheduler markers absent); ≤ 30 s delivery window (20 s email-service dispatch loop + poll slack). |

## Deltas folded into every TC

| Field | Scope-table said | Actual (release/2.1) |
|---|---|---|
| Endpoint path | `POST /api/vacation/v1/test/vacations/notify` | `POST /api/vacation/v1/test/digest` |
| Subject format | Implied bracketed Latin `[<ENV>][TTT]` | **`[<ENV>]ТТТ Дайджест отсутствий`** — Cyrillic `ТТТ` service tag, no brackets around it |
| Log marker family | Scheduler-level `NOTIFY_VACATION_UPCOMING` | Variant A: `"Digests sending job started/finished"` (wrapper markers); Variant B: only per-recipient `"Mail has been sent to <email> about NOTIFY_VACATION_UPCOMING..."` (wrapper bypassed) |
| Business rule | Implied "all vacations" | **APPROVED** vacations with `start_date = CURRENT_DATE + INTERVAL '1 day'` only |
| Trigger coverage | Implied single-trigger | **Dual-trigger**: every behavioral TC paired A (scheduler) + B (test endpoint) |
| Content coverage | Implied "subject + recipient" | **Content-complete**: greeting, period date, per-employee Full Name + start + end + type + duration (plural-aware), footer, negative leakage guards |
| Environment coupling | Examples named qa-1 | **Env-independent**: `<ENV>` placeholders, `TTT-<ENV>` stream; no qa-1 / timemachine / stage / preprod literals |

## Progress

| Cluster | Rows | TCs landed | Status |
|---|---|---:|---|
| Digest | 1 (row 14) | 14 (7 A+B pairs) | ✅ Landed (2026-04-21) |
| **Total** | **1** | **14** | **1 / 1 rows covered** |

## Cross-references

- Parent coverage: `test-docs/collections/cron/coverage.md` row 14 (TC-VAC-106..108 in `Cron_Vacation.xlsx` → `TS-Vac-Cron-Digest`) — prior art for comparison only.
- Scope: `docs/tasks/digest/digest-testing-task.md`
- Plan: `test-docs/collections/digest/test-plan.md`
- Canonical cron catalog: `expert-system/vault/external/EXT-cron-jobs.md` § job 14
- Canonical investigation: `expert-system/vault/exploration/tickets/t3423-investigation.md`
