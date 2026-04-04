# AI-Driven QA Automation Expert System for TTT

An autonomous AI expert system that systematically investigates a complex legacy web application (TTT — Time Tracking Tool), builds a structured knowledge base, and generates both test documentation (XLSX workbooks) and executable Playwright E2E autotests.

## Architecture

The system operates as a prompt-engineered autonomous agent (Claude Code + Claude Opus) with a three-phase pipeline:

![Three-Phase Pipeline](docs/epic_task/architecture-pipeline.png)
*Fig. 1 — Three-phase pipeline: Sources → Knowledge Acquisition → Test Documentation → Autotest Generation*

### Phase A — Knowledge Acquisition

The agent conducts multi-session investigation across all available information sources: codebase static analysis (Java/Spring Boot backend, React/TypeScript frontend), live environment testing via browser automation and REST API calls, database inspection, external documentation (Confluence, Figma, Qase), and GitLab ticket mining (descriptions, comments, bug patterns). Findings are persisted into an Obsidian vault (Markdown notes with YAML frontmatter, wikilink cross-references, and semantic search) and a SQLite analytics database.

### Phase B — Test Documentation Generation

Using the accumulated knowledge, the agent generates per-module XLSX workbooks containing structured test plans and test cases. Each workbook is self-contained with cross-linked tabs: Plan Overview, Feature Matrix, Risk Assessment, and TS-* test suite tabs. Test steps are written as UI-first browser actions. Setup/cleanup steps handle data preconditions via API. Compatible with Google Sheets import.

### Phase C — Autotest Generation

Test cases from XLSX are parsed into a JSON manifest and enriched with vault knowledge (selectors, validation rules, edge cases, timing quirks). The agent generates executable Playwright + TypeScript E2E specs following a 5-layer framework architecture (specs → fixtures → page objects → config+data → Playwright API). Tests are verified against live environments, failures are auto-diagnosed and fixed, and all discoveries are written back to the knowledge base.

Sessions are orchestrated by a shell-based runner (`run-sessions.sh`) that manages phase transitions, inter-session delays, auto-stop conditions, vault versioning, and dashboard generation.

![Integration Layers](docs/epic_task/architecture-layers.png)
*Fig. 2 — System layers: Agent → MCP Integration (39 servers) → Generated Artifacts*

### MCP Integration Layer

The agent connects to the target application and supporting tools through 39 MCP (Model Context Protocol) servers:

| MCP Server | Purpose |
|---|---|
| **PostgreSQL** ×3 | Database inspection across dev, test, stage environments (read-only) |
| **Swagger/API** ×21 | REST API exploration — 3 environments × 7 service groups |
| **Playwright** | Browser automation for VPN-restricted environments (proxy bypass) |
| **Confluence** | Requirements and wiki documentation |
| **Figma** | Design specifications and mockups |
| **Qase** | Existing test suites and test cases |
| **GitLab** | Issues, MRs, pipelines, code via REST API |
| **Obsidian + QMD** | Knowledge base CRUD and semantic/keyword search |
| **SQLite** | Structured analytics queries |

### Skills

18 reusable skills encapsulate domain-specific interaction patterns: GitLab access, Confluence access, Figma access, Qase access, Swagger API, PostgreSQL queries, Playwright browser, autotest generator, autotest runner, autotest fixer, XLSX parser, autotest progress, page discoverer, collection generator, test reporting, MCP setup, package install, skill creator.

## Target Application (TTT)

A microservices-based corporate system for time tracking and absence management:
- 4 backend services (Java 17, Spring Boot): TTT core, Vacation, Calendar, Email
- React 18 / TypeScript / Redux frontend with 12 modules
- PostgreSQL database with 86 tables across 4 schemas
- 20+ salary offices across 7 countries, 11 global user roles
- Business-critical domains: vacation workflows (multi-approver, dual calculation modes), sick leaves, days-off, time reporting with approval chains, accounting period management
- 3 testing environments with full API and database access

## Scope Modes

The system supports flexible scoping via `config.yaml`:

| Scope | Example | Behavior |
|-------|---------|----------|
| **All modules** | `scope: "all"` | Full breadth-first investigation and generation |
| **Single module** | `scope: "vacation"` | Focused pipeline for one functional area |
| **GitLab ticket** | `scope: "3404"` | Targeted investigation of a specific issue with regression tests |
| **Mixed** | `scope: "vacation, 3404"` | Modules and tickets together |

Ticket numbers (pure digits) are automatically normalized to `t<number>` internally (e.g., `3404` → `t3404`) for artifact naming.

## Operating Modes

1. **Autonomous Pipeline** — `./start.sh` launches the session runner in tmux. The agent executes phases A→B→C automatically, with configurable transitions (auto or human-approved). Auto-stop triggers when all test cases in scope are covered.

2. **Interactive Expert** — run `claude` in the project directory for conversational access to the full knowledge base. The agent can answer questions, investigate bugs, trace workflows, or perform targeted tasks.

3. **Scoped Execution** — set `scope` in config to restrict all phases to a specific module or GitLab ticket. Produces focused artifacts without touching other areas.

## Knowledge Base

The central innovation — a living, queryable resource that grows with every session:

- **Obsidian Vault** — interconnected markdown notes covering architecture, module deep-dives, API behavior, UI flows, data patterns, bug investigations, and ticket findings. Semantic search via QMD.
- **SQLite Analytics** — structured tables for exploration findings, module health, design issues, and test case tracking.
- **Bidirectional enrichment** — Phase C discoveries (selectors, timing quirks, data patterns) are written back to the vault, improving subsequent generations.

## Repository Structure

**Remote:** https://github.com/midas44/ttt-expert-v2.git

```
CLAUDE.md                               # Interactive mode prompt
CLAUDE+.md                              # Autonomous mode prompt (~1000 lines)
start.sh / stop.sh / dashboard.sh       # Runner control scripts
expert-system/
  config.yaml                           # Runtime configuration (phase, scope, autonomy)
  MISSION_DIRECTIVE.md                  # Project goals, priority areas, information sources
  analytics.db                          # SQLite analytics database
  vault/                                # Obsidian knowledge base (200+ notes)
  scripts/
    run-sessions.sh                     # Autonomous session orchestrator
    generate-dashboard.py               # HTML dashboard generator
  generators/                           # Python scripts that produce XLSX workbooks
  repos/project/                        # Local TTT codebase clone (populated at runtime)
test-docs/                              # Generated XLSX workbooks (per module or per ticket)
  collections/<name>/                   # Curated Test Collections (cross-module reference workbooks)
autotests/                              # Playwright + TypeScript E2E framework
  playwright.config.ts                  # Test configuration
  scripts/parse_xlsx.py                 # XLSX → JSON manifest parser
  scripts/process_collection.py         # Collection processor (tag injection + report)
  manifest/test-cases.json              # Parsed test cases with automation status
  manifest/collection-<name>.json       # Collection processing reports
  e2e/
    tests/<module>/                     # Generated test specs (per module subdir)
    data/<module>/                      # Test data classes + queries
    pages/                              # Page object classes
    fixtures/                           # Reusable workflow fixtures
    config/                             # Environment configuration
config/ttt/
  envs/*.yml                            # Environment credentials (per env)
docs/                                   # Setup guides, troubleshooting, epic description
.claude/
  skills/                               # 18 reusable skills
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **AI Agent** | Claude Code CLI, Claude Opus 4.6 (1M context), full autonomy mode |
| **Knowledge Storage** | Obsidian vault + QMD semantic search + SQLite |
| **Integration** | 39 MCP servers (PostgreSQL, Swagger, Playwright, Confluence, Figma, Qase, GitLab) |
| **Test Framework** | Playwright + TypeScript, 5-layer POM architecture |
| **Test Documentation** | Python + openpyxl, XLSX with cross-linked tabs |
| **Orchestration** | Bash session runner, tmux, YAML config, HTML dashboard |
| **Host** | Ubuntu Server LTS, Node.js, Python 3 |

## Host Environment

- **OS:** Ubuntu Server LTS (XFCE desktop with XRDP access)
- **Runtime:** Claude Code CLI via adguardvpn-cli (SOCKS proxy) and Throne proxy manager
- **Network:** Corporate VPN required for all TTT environments; MCP servers configured with proxy bypass
- **Prerequisites:** Node.js, Python 3 + openpyxl, QMD daemon, PostgreSQL client libraries
- **Hardware:** i5-12600K CPU, 32GB RAM, Nvidia GPU (GTX 1070) for QMD CUDA acceleration, 1TB SSD
