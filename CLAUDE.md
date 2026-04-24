# TTT Expert System — Interactive Mode

This project contains an expert knowledge base for the TTT (Time Tracking Tool) application and the projects it integrates with. Use it to answer questions, investigate issues, and generate test documentation.

## Projects under test

The system currently covers three projects, with more to be added:

| Project | Role | Config | Envs | Access surfaces |
|---------|------|--------|------|-----------------|
| **TTT** (primary) | The main application under test (time tracking, vacation, reports, accounting). | `config/ttt/` | `qa-1`, `timemachine`, `stage` | UI, API (Swagger), DB (Postgres), Graylog, Roundcube, Qase, GitLab, Confluence |
| **CS** (secondary, integrated) | Company Staff — internal corporate tool, source-of-truth for employees + salary offices. Syncs one-way to TTT. | `config/cs/` | `preprod` only | UI only (CAS SSO shared with TTT). Confluence subtree at page `32899211`. |
| **PMT** (secondary, integrated) | Project Management Tool — internal corporate tool, source-of-truth for project records (project settings). Syncs one-way to TTT. | `config/pmt/` | `preprod` only | UI only (CAS SSO shared with TTT; same admin credentials). Confluence subtree at page `18944057`. |

CS and PMT are investigated only as needed for cross-project E2E tests (e.g., change Salary Office on CS → verify sync to TTT; change project parameters on PMT → verify sync to TTT). When answering a question, identify the target project; for CS/PMT, skip API/DB/Graylog steps and use UI-only paths. Vault notes for CS-only topics live under `cs/`, PMT-only under `pmt/`; cross-system notes under `integrations/`.

The architecture is **multi-project ready** — adding a 4th project = (a) a `config/<proj>/` directory, (b) `pages/<proj>/` + `fixtures/<proj>/` directories, (c) a `projects:` entry in `expert-system/config.yaml`.

## Knowledge Base

- **Obsidian vault** (`expert-system/vault/`) — TTT modules at vault root (`modules/`, `exploration/`, `architecture/`, etc.); CS-only notes under `cs/`; PMT-only notes under `pmt/`; cross-system notes (CS↔TTT sync, PMT↔TTT sync, etc.) under `integrations/`. Search via `mcp__qmd-search__` tools or read directly via `mcp__obsidian__` tools
- **SQLite analytics** (`expert-system/analytics.db`) — query via `mcp__sqlite-analytics__execute_sql`
- **Generated test docs** (`test-docs/` — XLSX workbooks per module, UI-first test cases). No project-level split: cross-project tests are mixed-step entries inside the relevant TTT module workbook.
- **Curated test collections** (`test-docs/collections/` — XLSX reference workbooks grouping TCs from multiple modules into cross-cutting suites)
- **Autotests** (`autotests/` — Playwright + TypeScript E2E framework, generated from XLSX test cases). Page objects, fixtures, and configs are split per project: `pages/ttt/`, `pages/cs/`, `pages/pmt/`, `fixtures/{common,ttt,cs,pmt,integration}/`, `config/{common,ttt,cs,pmt}/`. Tests stay module-organized; cross-project specs live in `tests/integration/` (tagged `@integration`).

## Available MCPs

| MCP | Use for |
|-----|---------|
| **qmd-search** | Semantic/keyword search over vault notes — start here for any question |
| **obsidian** | Read, write, search vault notes directly |
| **sqlite-analytics** | Query module_health, exploration_findings, design_issues, test_case_tracking |
| **playwright-vpn** | UI testing on TTT, CS, and PMT environments (use this, not the built-in plugin) |
| **swagger-\*** | REST API calls to TTT qa-1, timemachine, stage environments. **TTT only** — CS and PMT have no Swagger surface |
| **postgres-\*** | Database queries on TTT qa-1, timemachine, stage (read-only). **TTT only** — CS and PMT have no exposed DB |
| **confluence** | TTT, CS, and PMT documentation wikis (CS subtree at page `32899211`; PMT subtree at page `18944057`) |
| **figma** | Design mockups (TTT) |
| **qase** | Existing TTT test suites (project: TIMEREPORT). **TTT only** — CS and PMT have no Qase project |
| **gitlab** | Use curl + PAT (MCP server non-functional on this CE instance). TTT repo is `ttt-spring` (project 172); CS and PMT GitLab repos TBD |
| **roundcube-access** skill (no MCP) | Read/search/save test notification emails TTT sends to the QA mailbox (IMAPS at `dev.noveogroup.com`, user `vulyanov@office.local`). Use whenever a task requires verifying that a TTT email notification was actually dispatched. |
| **graylog-access** skill (no MCP) | List streams, search, tail, and download TTT backend logs from Graylog at `logs.noveogroup.com` (REST API, token auth, VPN). Streams: `TTT-QA-1`, `TTT-QA-2`, `TTT-TIMEMACHINE`, `TTT-PREPROD`, `TTT-STAGE`, `TTT-DEV`. Use whenever a task needs server-side log evidence (exceptions, timing, cron jobs, API failures) — download saves `.json` / `.ndjson` / `.log` / `.csv` to `artifacts/graylog/`. **TTT only** — CS and PMT have no Graylog presence. |

## How to answer questions

1. Identify the target project (TTT, CS, PMT, or cross-project). For CS/PMT, skip API/DB/Graylog steps — use UI-only paths.
2. Search the vault first (`mcp__qmd-search__search` or `mcp__qmd-search__vector_search`). For CS look under `cs/` and `integrations/`; for PMT under `pmt/` and `integrations/`; for TTT under the regular `modules/`, `exploration/`, etc.
3. Read relevant notes (`mcp__obsidian__read_note`)
4. If vault lacks detail, investigate live: code (`expert-system/repos/project/`), API, DB, or UI (TTT only); or live UI exploration via `playwright-vpn` (CS, PMT, or TTT)
5. Check GitLab tickets (see "GitLab Ticket Mining" below) — TTT repo is `ttt-spring` (project 172); CS and PMT repos TBD
6. Reference vault note names when citing findings

## GitLab Ticket Mining

When investigating any module or answering questions about bugs/behavior, search GitLab tickets and read BOTH descriptions AND comments. Use the `gitlab-access` skill.

**Search strategy** — use multiple approaches, not just sprint labels:
- Search by keyword in title/description: `search=<module_keyword>&order_by=updated_at&sort=desc`
- Search by label if available: `labels=<module>`
- Search the ENTIRE history — some features were introduced years ago (e.g., day-off ~Sprint 7). Don't filter by sprint number. Old tickets contain bugs, edge cases, and design decisions that are still relevant.
- Paginate through all results — don't stop at page 1

**Always read comments** (`GET /projects/172/issues/:id/notes`) — the valuable content is in comments, not descriptions. Look for these patterns:

| Pattern | What it indicates |
|---------|------------------|
| `* [ ]` or `- [ ]` checkbox lists | Bug reports or acceptance criteria |
| **Expected** / **Actual** / **Env** in bold | Structured bug report |
| Numbered "Steps to reproduce" | Reproduction steps (better than descriptions) |
| Screenshots or attachments | Visual evidence of bugs or UI states |
| Comments titled "**Design Notes**" or "Design:" | Implementation decisions, business rules, edge case strategies |
| "Note:" or "Important:" prefixes | Constraints, gotchas, non-obvious requirements |
| Long technical explanations | Hidden business rules, WHY something works a certain way |
| "While testing this, I also noticed..." | Related bugs, side effects |
| Comments from QA team | Edge cases found during testing |
| "Regression" or "broken after" | Changes that broke existing behavior |

**Don't filter by comment length or author** — short comments like "also broken for disabled employees" are high-value edge cases.

**Freshness** — the project is old. When ticket info conflicts with current code, trust the code. Old bug reports are valuable if the bug still exists or if the fix introduced new edge cases — verify against current behavior. Fixed bugs are the best source of regression test scenarios.

## Static code audits — fetch before citing

Before you file a bug, cite a file:line in a ticket or test doc, claim "branch X contains Y", or do any static analysis that informs downstream action, **always refresh the local clone first**:

```bash
# Start of any code audit that will feed a ticket or a vault claim:
cd expert-system/repos/project
git fetch origin <branch>             # e.g. release/2.1, master, stage
# Then prefer origin/<branch> over the local ref:
git show origin/<branch>:<path>
git log origin/<branch> -- <path>
git merge-base --is-ancestor <sha> origin/<branch>
```

The local tracking branch (`release/2.1`, `stage`, …) can be hundreds of commits behind origin — it only moves when you explicitly `git pull`. A false claim based on a stale ref has happened in the past (filed a "bug" for a `>` vs `>=` comparison that was already fixed 200 commits ago on origin; the deployed build had the fix, the ticket had to be retracted). Fetch-first is cheap; the recovery cost of a wrong-ticket is much higher.

**When UI behavior doesn't match what the source seems to say**, two hypotheses before blaming the user-visible state:

1. **Local clone is stale** — run `git fetch` and diff `origin/<branch>` against your local ref.
2. **Deployed code ≠ local source** — builds can lag or come from a different commit. Check the build footer (`Build #: …`) and cross-reference with the GitLab pipeline's `sha`. When in doubt, grep the actual deployed JS bundle / chunk / jar for the minified pattern (`.format("YYYY-MM-DD")`, a unique i18n key near the logic, etc.) to see which operator or branch actually shipped.

Cite `origin/<branch>@<sha>` in ticket bodies, not bare `<branch>`, so the reader can reproduce your exact view.

## Updating the knowledge base

When you discover new information during a task — a bug, an undocumented behavior, a corrected understanding, or deeper detail about a feature — update the knowledge base:

- **Existing note has relevant topic**: expand or correct it via `mcp__obsidian__patch_note` or `mcp__obsidian__write_note`
- **New topic not covered**: create a new note in the appropriate vault directory (modules/, exploration/, investigations/, etc.) with YAML frontmatter and wikilinks to related notes
- **Structured findings**: also log to SQLite (`exploration_findings`, `design_issues`, or `module_health` tables)
- **After significant updates**: run `qmd embed` via bash to update semantic search index

The knowledge base is a living resource — every interactive session that discovers something new should leave it richer.

## Autotest generation

Use the autotest skills to generate, run, and fix Playwright E2E tests from the XLSX test documentation:

- **autotest-generator** — generate test code from XLSX test cases (enriched with vault knowledge)
- **autotest-runner** — run generated tests and analyze results
- **autotest-fixer** — diagnose and fix failing tests (uses playwright-vpn for live selector discovery)
- **xlsx-parser** — parse XLSX workbooks into the JSON manifest
- **autotest-progress** — view automation coverage and prioritize next tests
- **page-discoverer** — explore TTT pages to discover selectors for page objects
- **collection-generator** — create and process curated test collections (cross-module suites via shared tags)

The autotest framework lives in `autotests/` and reads project configs from `config/<project>/`. Layout under `autotests/e2e/`:
- `pages/ttt/`, `pages/cs/`, `pages/pmt/` — page objects per project (add `pages/<proj>/` on demand for new projects)
- `fixtures/common/` — project-agnostic fixtures (e.g., `VerificationFixture`)
- `fixtures/ttt/`, `fixtures/cs/`, `fixtures/pmt/` — project-bound fixtures
- `fixtures/integration/` — cross-project orchestration fixtures (e.g., `CsToTttSyncFixture`, future `PmtToTttSyncFixture`)
- `config/common/{appConfig.ts,configUtils.ts,globalConfig.ts}` — shared interface + utilities
- `config/ttt/tttConfig.ts`, `config/cs/csConfig.ts`, `config/pmt/pmtConfig.ts` — per-project config classes (all implement `AppConfig`)
- `tests/<module>/` — module-organized specs (TTT modules + `tests/integration/` for cross-project)

TS path aliases: `@ttt/pages/*`, `@ttt/fixtures/*`, `@ttt/config/*`, `@cs/pages/*`, `@cs/fixtures/*`, `@cs/config/*`, `@pmt/pages/*`, `@pmt/fixtures/*`, `@pmt/config/*`, `@common/fixtures/*`, `@common/config/*`, `@integration/fixtures/*`, `@data/*`, `@utils/*`.

A cross-project spec opens a second `BrowserContext` for the secondary project (CAS SSO sessions are per-context — keeps cookies clean):
```ts
const tttConfig = new TttConfig();
const csConfig  = new CsConfig();
const csContext = await browser.newContext();
const csPage = await csContext.newPage();
await new cs.LoginFixture(csPage, csConfig).run();
// ... CS step ...
await new ttt.LoginFixture(page, tttConfig).run();
// ... TTT verification ...
await csContext.close();
```
Replace `cs` with `pmt` for PMT-side steps (`new PmtConfig()`, `new pmt.LoginFixture(pmtPage, pmtConfig).run()`); the framework supports any number of secondary projects via the same `secondary: AppConfig[]` slot on `GlobalConfig`.

**Vault-first rule for autotest generation:** Before generating any test, search the vault for the relevant module's knowledge — selectors, validation rules, API behaviors, known bugs, and timing quirks. The vault contains hard-won knowledge from Phase A/B that makes generated tests more accurate and robust. Key locations:
- `modules/<module>-*deep-dive*.md` — validation rules, API endpoints, business logic details
- `exploration/ui-flows/` — page selectors, navigation patterns, dialog behaviors
- `exploration/api-findings/` — tested API behaviors, error codes, response formats
- SQLite `exploration_findings` and `design_issues` tables — structured findings with severity and impact

When you discover new information during autotest generation (selectors, UI quirks, data patterns), write it back to the vault via `mcp__obsidian__write_note` with `mode: "append"`.

**Test step conventions:** Test documentation uses prefixed steps — `SETUP:` (API state creation), `CLEANUP:` (teardown), `DB-CHECK:` (data verification), unprefixed (main UI steps). When generating autotests, map these to `ApiVacationSetupFixture` for setup/cleanup and `DbClient` for DB checks.

**Test-doc authoring principles (apply to every generated or edited TC):**
1. **UI-first verification** — primary steps describe what a user does in the browser (login, click, verify on page). API/DB steps are reserved for `SETUP:`, `CLEANUP:`, `DB-CHECK:`, clock manipulation, and explicitly headless areas (service integrations, webhooks). The exception is *content-assertion-heavy* flows (digest emails, notification bodies) where the verification is inherently backend — in those cases backend-only TCs are acceptable, but the content must still be asserted field-by-field (see principle 4).
2. **Environment-independent phrasing** — no `qa-1` / `timemachine` / `stage` / `preprod` literals in TC cells. Use placeholders like `<ENV>` (subject prefix `[<ENV>][TTT]`, stream `TTT-<ENV>`) or phrasings like "on the configured test environment". TCs must run unchanged on any configured env.
3. **Dual-trigger for cron TCs** — every behavioral `@Scheduled` TC exists in two variants: (A) server-clock advance + wait for the scheduler wrapper, and (B) `POST /api/<service>/v1/test/<endpoint>` bypass. Pair them as consecutive TCs; different regressions surface in each path. Single-TC coverage is acceptable only for dead-config stubs or when variants provably collapse (note the justification in the TC).
4. **Content-complete verification for notifications** — email-notification TCs must assert *every* dynamic field the template renders: envelope (sender, recipient, timestamp), subject pattern, each body section, each substituted value (names, dates, counts, types), locale formatting, and absence of leaked data from unrelated records. Subject-only assertions are insufficient.
5. **XLSX cell legibility** — Preconditions / Steps / Expected Result cells use wrap-text, vertical-align top, multi-line content with `\n` line breaks, and column widths ≥ baseline (Title 48, Preconditions 52, Steps 64, Expected 52; see `CLAUDE+.md` §11 XLSX Format). Single-line packed cells are a defect.

**Ticket scope:** When `scope` in config.yaml is a GitLab ticket number (pure digits, e.g., `"3404"`), all artifacts use `t<number>` prefix internally. Test IDs: `TC-T3404-001`. Dirs: `tests/t3404/`, `data/t3404/`. XLSX: `test-docs/t3404/t3404.xlsx`. See CLAUDE+.md §10.1 for full protocol.

**Collection scope:** Use `autotest.scope: "collection:<name>"` (e.g., `"collection:absences"`) — the `collection:` prefix is mandatory. The system runs `process_collection.py`, reads the report JSON for the exact set of TCs, and works only on those. Existing specs get the `@col-<name>` tag; missing specs are generated. Execute the suite: `npx playwright test --grep "@col-<name>"`. See the `collection-generator` skill for the full workflow.

**Email notifications:** TTT dispatches many email notifications (digest of absences, last-day-before-absence reminder, forgot-to-report reminder, vacation approval/rejection, day-off removal, accounting, etc.). The shared QA mailbox at `https://dev.noveogroup.com/mail` (Roundcube Webmail, Dovecot IMAP) is the sink for all test environments (QA1, QA2, TM, PREPROD, STAGE). Use the **`roundcube-access`** skill to verify emails: `list` / `count` / `search` by `--from`/`--subject`/`--since`/etc. / `read` by UID / `save` raw `.eml` files to `artifacts/roundcube/` for test evidence. Config at `config/roundcube/*`. VPN required (same VPN as TTT envs). Subjects are prefixed `[<ENV>]` or `[<ENV>][TTT]` — filter by env tag when verifying per-environment behavior.

**Backend logs (Graylog):** TTT ships every backend log line to Graylog at `https://logs.noveogroup.com`, one stream per environment (`TTT-QA-1`, `TTT-QA-2`, `TTT-TIMEMACHINE`, `TTT-PREPROD`, `TTT-STAGE`, `TTT-DEV`). Use the **`graylog-access`** skill whenever a task needs server-side evidence of exceptions, cron execution, email dispatch, scheduled jobs, API failures, or slow requests: `streams` / `count` / `search` / `tail` / `download`. Queries use Lucene-ish syntax (`level:3`, `message:"NullPointerException"`, range `--range 1h` or `--since/--until`). Auth uses a Graylog API token (stored in the gitignored `config/graylog/envs/secret.yaml`) with HTTP Basic fallback. `download` saves artifacts to `artifacts/graylog/` as `.json` / `.ndjson` / `.log` / `.csv`. VPN required.

**Selector rules (text-first, BEM banned):** The TTT app has minimal ARIA roles. Use text-based selectors first (`getByText`, `getByRole+name`), then role-based, then structural (tag+containment), then partial class match (`[class*='...']`). **Exact BEM class selectors are BANNED** (`.navbar__*`, `.page-body__*`, `.drop-down-menu__*`) — they break across environments. **NEVER put `page.locator()` in spec files** — all selectors must be in page objects.

## Artifacts & temp files

**Never save files to the repo root.** Screenshots, PDFs, logs, downloads, and any other session artifacts belong under a subdirectory of `artifacts/`, organized by source:

| Source | Directory |
|---|---|
| Playwright screenshots / page captures (TTT, CS, PMT, any UI) | `artifacts/playwright/` |
| CS-specific exploration captures | `artifacts/cs-screenshots/` |
| PMT-specific exploration captures | `artifacts/pmt-screenshots/` |
| Graylog log downloads | `artifacts/graylog/` |
| Roundcube email exports | `artifacts/roundcube/` |
| Confluence page/attachment downloads | `artifacts/confluence/` |
| Other (one-off investigations) | `artifacts/misc/` |

**Naming:** use a descriptive, dated filename that makes the purpose clear without opening the file (e.g. `vulyanov-vacations-2026-02-27.png`, not `screenshot.png` or `test.png`). The date in the name beats the filesystem mtime when artifacts are copied between hosts.

**Before creating any file, confirm the path is under `artifacts/<source>/`.** The `/*.png`, `/*.jpg`, `/*.pdf`, `/*.mp4` etc. patterns at the repo root are `.gitignore`'d to catch accidental strays, but you should not rely on that — put them in the right place from the start.

**Clean up ephemeral artifacts.** Screenshots and downloads that were only useful *during* a single session (e.g., `browser_take_screenshot` output you used to confirm a UI state and already captured in a vault note or response) should be deleted at the end of that task. Distinguish:

- **Ephemeral** (delete when done): session-only screenshots, intermediate API response dumps, experimental log slices, retry attempts
- **Durable** (keep in `artifacts/<source>/`): bug-report screenshots posted to a GitLab issue, logs that prove a cron ran at a specific time, reference captures a vault note links to, anything explicitly saved by the user

If unsure, ask. Never delete files the user created manually or git-tracked files without explicit confirmation.

**Never embed screenshots in vault notes** unless the user explicitly asks. Vault notes should describe UI state in text + reference the artifact path; the artifact lives in `artifacts/` where it can be updated independently of the note.

## Key references

- `CLAUDE+.md` — full autonomous system prompt (for reference, not loaded in interactive mode)
- `expert-system/config.yaml` — environment configuration (includes `projects:` array)
- `expert-system/MISSION_DIRECTIVE.md` — priority areas and information sources (TTT + integrated systems)
- `expert-system/vault/_KNOWLEDGE_COVERAGE.md` — what's been investigated
- `expert-system/vault/_INDEX.md` — vault note index
- `config/ttt/ttt.yml`, `config/ttt/envs/<env>.yml` — TTT app + env configs
- `config/cs/cs.yaml`, `config/cs/envs/preprod.yaml` — CS app + env configs
- `config/pmt/pmt.yaml`, `config/pmt/envs/preprod.yaml` — PMT app + env configs
