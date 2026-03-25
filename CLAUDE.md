# TTT Expert System — Interactive Mode

This project contains an expert knowledge base for the TTT (Time Tracking Tool) application. Use it to answer questions, investigate issues, and generate test documentation.

## Knowledge Base

- **Obsidian vault** (`expert-system/vault/`, 191 notes, ~222K tokens) — search via `mcp__qmd-search__` tools or read directly via `mcp__obsidian__` tools
- **SQLite analytics** (`expert-system/analytics.db`) — query via `mcp__sqlite-analytics__execute_sql`
- **Generated test docs** (`test-docs/` — XLSX workbooks per module, UI-first test cases)
- **Autotests** (`autotests/` — Playwright + TypeScript E2E framework, generated from XLSX test cases)

## Available MCPs

| MCP | Use for |
|-----|---------|
| **qmd-search** | Semantic/keyword search over vault notes — start here for any question |
| **obsidian** | Read, write, search vault notes directly |
| **sqlite-analytics** | Query module_health, exploration_findings, design_issues, test_case_tracking |
| **playwright-vpn** | UI testing on TTT environments (use this, not the built-in plugin) |
| **swagger-\*** | REST API calls to qa-1, timemachine, stage environments |
| **postgres-\*** | Database queries on qa-1, timemachine, stage (read-only) |
| **confluence** | TTT documentation wiki |
| **figma** | Design mockups |
| **qase** | Existing test suites (project: TIMEREPORT) |
| **gitlab** | Use curl + PAT (MCP server non-functional on this CE instance) |

## How to answer questions

1. Search the vault first (`mcp__qmd-search__search` or `mcp__qmd-search__vector_search`)
2. Read relevant notes (`mcp__obsidian__read_note`)
3. If vault lacks detail, investigate live: code (`expert-system/repos/project/`), API, DB, or UI
4. Check GitLab tickets (see "GitLab Ticket Mining" below)
5. Reference vault note names when citing findings

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

The autotest framework lives in `autotests/` and shares config with the expert system (`config/ttt/`).

**Vault-first rule for autotest generation:** Before generating any test, search the vault for the relevant module's knowledge — selectors, validation rules, API behaviors, known bugs, and timing quirks. The vault contains hard-won knowledge from Phase A/B that makes generated tests more accurate and robust. Key locations:
- `modules/<module>-*deep-dive*.md` — validation rules, API endpoints, business logic details
- `exploration/ui-flows/` — page selectors, navigation patterns, dialog behaviors
- `exploration/api-findings/` — tested API behaviors, error codes, response formats
- SQLite `exploration_findings` and `design_issues` tables — structured findings with severity and impact

When you discover new information during autotest generation (selectors, UI quirks, data patterns), write it back to the vault via `mcp__obsidian__write_note` with `mode: "append"`.

**Test step conventions:** Test documentation uses prefixed steps — `SETUP:` (API state creation), `CLEANUP:` (teardown), `DB-CHECK:` (data verification), unprefixed (main UI steps). When generating autotests, map these to `ApiVacationSetupFixture` for setup/cleanup and `DbClient` for DB checks.

**Selector rules (text-first, BEM banned):** The TTT app has minimal ARIA roles. Use text-based selectors first (`getByText`, `getByRole+name`), then role-based, then structural (tag+containment), then partial class match (`[class*='...']`). **Exact BEM class selectors are BANNED** (`.navbar__*`, `.page-body__*`, `.drop-down-menu__*`) — they break across environments. **NEVER put `page.locator()` in spec files** — all selectors must be in page objects.

## Key references

- `CLAUDE+.md` — full autonomous system prompt (for reference, not loaded in interactive mode)
- `expert-system/config.yaml` — environment configuration
- `expert-system/MISSION_DIRECTIVE.md` — priority areas and information sources
- `expert-system/vault/_KNOWLEDGE_COVERAGE.md` — what's been investigated
- `expert-system/vault/_INDEX.md` — vault note index
