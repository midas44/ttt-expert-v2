# Mission Directive

## Global Goal

Build comprehensive knowledge base of Time Tracking Tool project (aka TTT aka Time Reporting Tool), generate test plans and test cases for all major features, and produce executable Playwright + TypeScript E2E autotests from the generated test documentation. Note that existing documentation can be incomplete / unclear and low-quality, therefore use codebase analysis (static) in combination with application exploration (dynamic) as final truth.

Note: (Mainly) use English version of application for exploratory analysis / testing; use English language in knowledge base; in cases of ambiguous/unclear terminology give Russian version of terms as well.

## Project Context

TTT is web application aimed for internal corporate tracking / processing / management of time usage by employees in different domains: 
* reports of hours spent for particular tasks;
* absences of different types: vacations, days-off, sick-leaves.

### Functionality

Different types of time-related data views:
* tables of different entities: reports, vacation requests, project members etc.;
* timecharts of absences (Availability chart);
* statistics view;
With search and filter options to get and display data of interest.

Processing (major areas):
* task addition / renaming;
* report of spent hours (editing / deletion);
* absence request creation / editing / deletion; 
* calculations of working hours: reported vs norm;
* calculations of vacation days: used vs available;
* confirmation and agreement of requests (vacation / day-off);
* confirmation of reported hours;
* accounting operations: periods change (per salary office), vacation payment etc.; 

Administration (major areas):
* projects;
* production calendars / salary offices;
* user's settings / trackers; 

Application UI and features depend on user's role. Roles: employee, contractor, manager, department manager, accountant, admin.

API integrations:
* other internal projects (e.g. Company Staff (aka CS) to get users and salary offices data);
* external trackers (JIRA, GitLab etc.)

Application uses cron jobs to trigger regular operations by time (e.g. synchronization with CS).

There are email notifications of different types.

UI has 2 language versions: Russian (RU) and English (EN). Language switcher is available in page header.

Note: This is brief information, some features/details may not be mentioned here due to size and complexity of project, feel free to investigate and include undescribed areas into knowledge base and generated test docs.

## Priority Areas

1. Absences
2. Reports
3. Accounting
4. Administration

## Information Sources

### Codebase
- **GitLab repo**: https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring (see skill gitlab-access)
- **Default branch**: release/2.1 (version under development in current sprint)
- **Key branches**: stage (baseline/production version)

### Documentation
- **Confluence space**: space "NOV", project "Time Tracking Tool" (Noveo > Time Tracking Tool, see skill confluence-access)

  - Key pages:

  Entry page for project with general info and links to documentation (can be severely outdated!):

  https://projects.noveogroup.com/spaces/NOV/pages/18940713/Time+Tracking+Tool

  All pages in "Time Tracking Tool/Requirements/*"

  e.g:

  https://projects.noveogroup.com/spaces/NOV/pages/130385087/3014+Using+Only+Accrued+Vacation+Days+%D0%98%D1%81%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5+%D1%82%D0%BE%D0%BB%D1%8C%D0%BA%D0%BE+%D0%BD%D0%B0%D0%BA%D0%BE%D0%BF%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D1%85+%D0%B4%D0%BD%D0%B5%D0%B9+%D0%BE%D1%82%D0%BF%D1%83%D1%81%D0%BA%D0%B0

  https://projects.noveogroup.com/spaces/NOV/pages/130385089/3092+Advance+Vacation+%D0%92%D0%BE%D0%B7%D0%BC%D0%BE%D0%B6%D0%BD%D0%BE%D1%81%D1%82%D1%8C+%D0%B2%D0%B7%D1%8F%D1%82%D1%8C+%D0%BE%D1%82%D0%BF%D1%83%D1%81%D0%BA%D0%BD%D1%8B%D0%B5+%D0%B0%D0%B2%D0%B0%D0%BD%D1%81%D0%BE%D0%BC

  https://projects.noveogroup.com/spaces/NOV/pages/130387464/Correction+of+vacation+days+%D0%9A%D0%BE%D1%80%D1%80%D0%B5%D0%BA%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0+%D0%BE%D1%82%D0%BF%D1%83%D1%81%D0%BA%D0%BD%D1%8B%D1%85+%D0%B4%D0%BD%D0%B5%D0%B9

  https://projects.noveogroup.com/spaces/NOV/pages/130385096/%D0%9F%D0%BB%D0%B0%D1%88%D0%BA%D0%B0+%D0%BD%D0%BE%D1%82%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%86%D0%B8%D0%B8+%D0%BE+%D1%80%D0%B5%D0%BF%D0%BE%D1%80%D1%82%D0%B0%D1%85+%D1%81%D0%B2%D1%8B%D1%88%D0%B5+%D0%BD%D0%BE%D1%80%D0%BC%D1%8B

  And some chosen articles beyond Requirements:

  https://projects.noveogroup.com/spaces/NOV/pages/32904541/cron

  https://projects.noveogroup.com/spaces/NOV/pages/110298524/Trackers+integration+setup+and+testing

  - Note: part of the information in Confluence may be outdated/obsolete

### Designs
- **Figma project**: see skill figma-access
Use links to figma layers from GitLab tickets and Confluence pages

### Test Management
- **Qase project**: see skill qase-access
  - Note: Can be outdated, unclear, incomplete. Use along with other info sources with discretion

### Tickets
- **GitLab tickets**: https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/boards (see skill gitlab-access)
  - Labels: Sprint X, HotFix Sprint X — but NOT all tickets have sprint labels
  - **Search strategy**: search by module keyword in title/description, NOT only by sprint label. Use `updated_after`/`created_after` params + keyword search to find all relevant tickets regardless of sprint labeling
  - **Scope**: start from current sprint (`current_sprint` in config.yaml) and work backwards through ALL history. Some features were introduced years ago — relevant tickets (bugs, edge cases) may be in Sprint 7 or earlier. Old tickets with bugs that were never fixed or have edge cases in comments are critical for test case generation
  - **Always read ticket comments** — most bug details (reproduction steps, edge cases, root cause) are in comments, not descriptions

### Additional Documents
- **Google Docs**: by links from Confluence pages and GitLab tickets (access by link, no mcp required)
- **Google Sheets**: by links from Confluence pages and GitLab tickets (access by link, no mcp required)

### Testing Environments
Use config/ttt/envs/* to get environment parameters, see skills: playwright-browser, postgres-db
- **Primary dev**: timemachine
- **Secondary dev**: qa-1
- **Primary prod**: stage
- Note: compare dev and prod versions to investigate changes in current Sprint
- **Playwright:** Use `playwright-vpn` MCP server (tools prefixed `mcp__playwright-vpn__`) for all UI exploration. The built-in Playwright plugin cannot reach VPN hosts. Load tools via `ToolSearch` before first use.
- List of swaggers available for each test environment (see skill swagger-api):
[envURL]/api/ttt/swagger-ui.html?urls.primaryName=api
[envURL]/api/ttt/swagger-ui.html?urls.primaryName=test-api
[envURL]/api/vacation/swagger-ui.html?urls.primaryName=default
[envURL]/api/vacation/swagger-ui.html?urls.primaryName=test-api
[envURL]/api/calendar/swagger-ui.html?urls.primaryName=default
[envURL]/api/email/swagger-ui.html?urls.primaryName=api
[envURL]/api/email/swagger-ui.html?urls.primaryName=test-api
where envURL = https://ttt-[env].noveogroup.com (e.g. https://ttt-qa-1.noveogroup.com, https://ttt-timemachine.noveogroup.com, https://ttt-stage.noveogroup.com)

### Test Email Service
All TTT environments dispatch notification emails into a single shared test mailbox surfaced through **Roundcube Webmail** at `https://dev.noveogroup.com/mail` (backed by Dovecot IMAP). Use the **`roundcube-access`** skill (no MCP — self-contained Python CLI over IMAPS, same VPN as TTT envs) to verify email behavior:
- `mailboxes`, `count`, `list` (newest-first pagination), `search` (FROM / TO / SUBJECT / BODY / SINCE / BEFORE / UNSEEN / FLAGGED / HEADER / LARGER / ... — Cyrillic supported)
- `read <uid>` — full message (headers, text, HTML, attachments metadata)
- `save` — write raw `.eml` files (RFC 822, lossless) to `artifacts/roundcube/` for test evidence
- Config: `config/roundcube/roundcube.yaml` + `config/roundcube/envs/<env>.yaml`
- Subject prefix `[<ENV>]` or `[<ENV>][TTT]` identifies which environment originated the notification — always filter by env tag when verifying per-env behavior
- Observed notification types in live mailbox: absence digest (Дайджест отсутствий), last-day-before-absence reminder, forgot-to-report reminder, day-off removal, vacation approval/rejection, accounting changes, etc.

## Output Requirements

### Phase B — XLSX Test Documentation
- Test plans as XLSX (one per major module/feature area)
- Test cases as XLSX (detailed, executable)
- **UI-first test steps** — steps describe user actions in the browser (login, navigate, click, fill, verify), NOT raw API calls. API steps only for: test endpoints (clock, sync), data verification (DB checks), state setup, or features with no UI
- **Explicit setup steps** — when a test needs specific state (APPROVED/CANCELED vacation, etc.), include `SETUP:` steps that create the state via API before the main UI flow. Include `CLEANUP:` steps for teardown. Never assume state exists in the DB.
- Preconditions must include SQL query hints for dynamic test data generation (by database mining with criteria, random employee selection, timestamp computation, static values etc.)
- Generation scope configurable via `phase.scope` in config.yaml (`"all"` or a specific module name)
- Compatible with Google Sheets import
- English only

### Phase C — Autotest Generation
- Executable Playwright + TypeScript E2E tests generated from XLSX test documentation
- **UI-first**: tests use browser login and page interactions by default. API calls only for test endpoints, data setup/teardown, or explicit API-only steps
- Test code lives in `autotests/` directory, follows 5-layer architecture: test specs → fixtures → page objects → config+data → Playwright API
- XLSX test cases are parsed into a JSON manifest (`autotests/manifest/test-cases.json`) via `autotests/scripts/parse_xlsx.py`
- Each generated test must support three data modes: `static` (hardcoded defaults), `dynamic` (PostgreSQL queries for real data), `saved` (cached JSON for reproducibility)
- **Authentication**: browser login for UI tests (any employee), `API_SECRET_TOKEN` for test endpoints and API setup as token owner (pvaynmaster). No endpoint exists to get JWT for arbitrary users — use UI login for per-user scenarios.
- Tests are verified against live test environments (configured via `autotest.target_env` in config.yaml)
- Generation scope can be limited to a single module via `autotest.scope` in config.yaml
- Priority order follows the same order as Phase B (Absences → Reports → Accounting → Administration)
- Knowledge base (vault) must be consulted before generating each test — for selectors, validation rules, known UI quirks, and edge cases
- Use existing page objects and fixtures when possible; create new ones only when needed
- Data classes MUST implement the data generation strategy described in XLSX preconditions — if preconditions contain SQL queries or employee criteria, the dynamic mode must query the DB accordingly, not hardcode values. Never hardcode the same username across multiple data classes.
- Track progress in SQLite `autotest_tracking` table
- Skills: autotest-generator, autotest-runner, autotest-fixer, xlsx-parser, autotest-progress, page-discoverer