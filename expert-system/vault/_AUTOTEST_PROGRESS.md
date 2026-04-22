# Autotest Progress

## Overall Coverage (Session 144)

| Module | Manifest Total | Verified | Generated | Blocked | Failed | Pending | Coverage |
|--------|---------------|----------|-----------|---------|--------|---------|----------|
| vacation | 100 | 85 | 0 | 15 | 0 | 0 | 85% (100% addressed) |
| day-off | 28+4 | 30 | 0 | 4 | 0 | ~6 | 75% |
| sick-leave | 71 | 5 | 0 | 0 | 0 | 66 | 7% |
| t2724 | 38 | 38 | 0 | 0 | 0 | 0 | 100% |
| t3404 | 24 | 21 | 0 | 3 | 0 | 0 | 88% (100% addressed) |
| planner | 82 | 24 | 0 | 0 | 1 | 57 | 29% |
| reports | 60 | 17 | 0 | 0 | 2 | 41 | 28% |
| **digest** (collection) | **14** | **3** | **5** | **0** | **6** | **0** | **21% verified / 100% addressed** |

### Digest Collection (session 144 close — envTag landed, 4 low-risk TCs re-verified)

Scope: `collection:digest` (14 TCs in `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation`).

Session 144 applied `tttConfig.envTag` across all 14 specs, fixed `RoundcubeVerificationFixture.count()` (was calling a CLI subcommand that doesn't accept filter flags), and re-ran the 4 TCs that were "verified pre-fix" to confirm the label.

**Verified post-session-144 (3):** TC-DIGEST-003, 004, 007 — passed with fixes applied.
- TC-003 (scheduler empty, 2.9m): Graylog markers + envTag-corrected subject count. ✓
- TC-004 (test-endpoint empty, 41.5s): Graylog `assertAbsent` markers + count (via `search --limit 1` workaround). ✓
- TC-007 (scheduler subject format, 2.9m): waitForEmail matched `[QA1]ТТТ Дайджест отсутствий` on `pvaynmaster`'s mailbox. Works because the scheduler-clock-advance to Monday triggers digest delivery to managers (incl. pvaynmaster) who have direct reports with APPROVED-soon vacations — which on qa-1 is almost always true.

**Verified pre-fix, now failed (1):** TC-DIGEST-008 — test-endpoint variant of the subject audit. Fails because the test endpoint on a non-Monday real clock does NOT reliably produce a digest to `pvaynmaster` — it runs for whatever window the dispatcher decides, and on Wednesday none of pvaynmaster's direct reports had APPROVED-soon vacations in the window that would produce a new digest to him. Two separate 4-min poll attempts confirmed 0 matching new digests. This is the **same receiver-model defect** as TC-001/002/005/006/009/010: the spec searches pvaynmaster's mailbox for a digest that the seed-induced pipeline doesn't send to pvaynmaster.

**Generated, awaiting re-verification (5):** TC-DIGEST-002, 005, 006, 009, 010 — per-recipient Graylog marker assertions removed in s141. envTag now landed; body/receiver assertions still need the XLSX receiver-model revision.

**Failed (6, ↑1 from s143):**
- TC-DIGEST-001 — AIOOBE production bug at `MailDataFormerService:172` + receiver-model defect.
- TC-DIGEST-008 — receiver-model defect (promoted from "verified-pre-fix" to failed in s144).
- TC-DIGEST-011 / 012 — **XLSX premise invalid**: digest template has no plural-form code path.
- TC-DIGEST-013 / 014 — receiver-model + no `Здравствуйте` greeting.

**Pending:** 0 — scope fully addressed.

### Structural findings from session 143 (see `exploration/tickets/digest-template-reality-session-142.md`)

Four compounding defects were exposed while trying to run TC-011 for the first time:

1. **Fixture bug (FIXED)**: `RoundcubeVerificationFixture.search()` read non-existent JSON key. Fix: read `parsed.items`.
2. **Fixture bug (FIXED)**: `read()` returned `{text, html}`; specs read `text_body` / `html_body`. Fix: normalize keys, always include HTML, strip tags to text when plain-text part is empty (digest template is HTML-only).
3. **Config bug (FIXED)**: Subject env-tag `[QA1]` ≠ `tttConfig.env.toUpperCase()` `[QA-1]`. Fix: added `TttConfig.envTag` getter stripping dashes.
4. **XLSX premise errors (NOT fixed — human review needed)**:
   - Plural forms (`1 день` etc.) don't exist in the digest template.
   - Greeting `Здравствуйте, X Y` isn't in the digest template (it opens with `"Добрый день!"`).
   - Digest recipient model: manager, not employee — affects every content-complete digest TC (001 / 002 / 005 / 006 / 011 / 012 / 013 / 014).

### Critical production invariant violated (from s141, still unresolved)

TC-001 run in session 141 revealed that `DigestScheduler`'s wrapper does NOT always emit `"Digests sending job failed"` when the job throws — AIOOBE propagates past the try/catch without reaching the failure log. This is itself a regression-worthy finding: the wrapper should mark `failed` on any exception, not only declared ones.
