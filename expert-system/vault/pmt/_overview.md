---
title: PMT (Project Management Tool) — Overview
type: overview
tags: [pmt, project-management-tool, secondary-sut]
updated: 2026-04-16
---

# PMT (Project Management Tool) — Overview

PMT is the internal corporate tool that is the **source of truth for project records** (project settings, project parameters, project lifecycle). It syncs one-way to TTT (see [[ttt-pmt-sync]]).

> **Note:** PMT is an actively developed product with known bugs and rough edges. Every UI finding and workaround documented below is a snapshot of behavior observed on `pm-preprod.noveogroup.com` at a specific date — behavior may change as the product evolves. Re-verify before relying on these patterns in new automation.

## Access

| Aspect | Value |
|---|---|
| URL | `https://pm-preprod.noveogroup.com` (only env available) |
| Auth | **Keycloak OIDC** at `sso.noveogroup.com` (realm `demo-noveo`, client `openid-preprod-pmtool`) — **NOT CAS Demo** (TTT/CS use `cas-demo.noveogroup.com`; PMT uses a different SSO backend). Verified 2026-04-16. |
| Login redirect pattern | `https://sso.noveogroup.com/realms/demo-noveo/protocol/openid-connect/auth?scope=openid&response_type=code&client_id=openid-preprod-pmtool&redirect_uri=https%3A%2F%2Fpm-preprod.noveogroup.com%2Fsso%2Fauth&state=<random>` |
| Admin account | `pvaynmaster` / `pvaynmaster` — sufficient for all PMT UI interactions needed in cross-project E2E tests |
| Config | `config/pmt/pmt.yaml` + `config/pmt/envs/preprod.yaml` |
| Projects path | `/projects` (PMT-specific; see `PmtConfig.projectsPath`) |
| Logout URL | `https://sso.noveogroup.com/realms/demo-noveo/protocol/openid-connect/logout` (Keycloak OIDC logout; re-verify on first real logout automation flow) |
| Logged-in user indicator | Top-right nav displays full name (e.g., "Pavel Weinmeister") — not login/username |

## Role in the integrated system

PMT owns the project entity (project metadata / settings). TTT consumes PMT-owned project data via one-way API sync, then uses it for internal purposes (reports, assignments, accounting, etc.). In cross-project E2E tests PMT appears only as episodic UI steps: change a project's parameters on PMT, verify the synced result in TTT; create a new project on PMT, verify it appears in TTT with the expected behavior.

## Scope for this expert system

PMT is **UI-only** for testing purposes today. No API/DB/Swagger/Graylog access is available. Investigation and automation of PMT is strictly on-demand — explore only when a specific cross-project test case requires it.

## UI findings (live exploration 2026-04-16)

### Projects page (`/projects`)

- Table columns: Name, Customer, Model, Type, PM, Status, Updated, (actions).
- Status values seen: `Active`, `Finished`, `Canceled` (status cell is a `<combobox>` — editable inline).
- Default view includes a **status filter that hides `Finished` and `Canceled` projects**. Searching for a customer with no Active projects returns "No results" even when such projects exist. There is no visible filter chip/pill for this — the filter is implicit.
- **Filter toggle icon** lives next to the "Add project" button (a small icon to the right of "Add project"). Clicking it switches to "all statuses" mode and exposes a `Clear all filters` link. After clicking, search returns Finished/Canceled projects too.
- Default unfiltered listing: 158 pages as of 2026-04-16 (pagination in the footer).
- `Search by name` textbox filters live as you type (client-side or fast server-side — sub-second response).
- Search is case-insensitive and substring: `tasty` matches `ABtasty*` projects; `diabol` matches `Diabolocom-*`.
- Ticket-link footer: `https://jira.noveogroup.com/secure/RapidBoard.jspa?rapidView=223&projectKey=PMT` (PMT is tracked in JIRA, not GitLab — may be relevant when we eventually identify the PMT codebase/repo location).

### Sample project IDs observed (for future reference)

From Diabolocom search results — useful as static probe IDs for cross-project tests:

- `/projects/152/profile/general` — `Diabolocom-Java-ODC` (status: Active)
- `/projects/473/profile/general` — `Diabolocom-AI` (status: Active)
- `/projects/7538/profile/general` — `Diabolocom-PHP-Flex-T&M` (status: Finished)

From ABtasty search:
- `/projects/483/profile/general` — `ABtasty-ProductTeam-ODC-2026` (status: Active)
- `/projects/497/profile/general` — `ABtasty-DataTeam-2026-ODC` (status: Active)

The profile URL pattern is `/projects/<numeric-id>/profile/general`. The numeric ID is PMT's internal project ID (distinct from the TTT-side `pmToolId` / `pmtId` — see [[pm-tool-integration-deep-dive]]).

- `/projects/8168/profile/general` — `Noveo-PMTTest-Playwright-Internal` (status: Active, created 2026-04-16 during UI exploration — test project; leave as a known reference / delete when TTT sync is not needed).

### Project profile (`/projects/<id>/profile/*`)

Four tabs: `general` (default), `resources`, `wsr`, `dashboard`.

**General tab — inline-editable parameters (header panel):**

- `Name` — click value → inline textbox with save/cancel icons.
- `Customer` — click value → combobox (Vue multiselect). Editable.
- `Country` — combobox. **Only two options available in the list: `Russia`, `France`.** Implemented with `@vueform/multiselect` and `canClear: false` → **there is no mechanism to clear the country back to empty from the UI**. Once set, it can only be switched between the two options. Clicking the save button with an empty combobox throws a frontend `TypeError: Cannot read properties of undefined` in the console and leaves the field unchanged. The editor uses a component copy-pasted from the Sales picker — the placeholder still says `Add sales` and the wrapper CSS class is `sales-multiselect`, both code-smells.
- `Project Supervisor`, `Sales` — combobox with employee search (large list, ~55 entries; type-ahead filter). **Candidate list is role-scoped**: users who held the role historically are still visible as the current Supervisor, but may not appear in the dropdown for new assignments. Example: `Pavel Weinmeister` was verified as Supervisor on `/projects/473` but does NOT appear in the Supervisor dropdown when editing — confirmed under two different logged-in accounts (`pvaynmaster`, `slebedev`). Once a user loses the qualifying role, reassigning them from UI is impossible — DB / API change required.
- `Project folder`, `Watchers` — inline editable.
- `Model`, `Type`, `PM`, `Owner` — **read-only** on the general tab.

**Header dropdown — Status:**

- 7 values: `Active`, `Finished`, `Unconfirmed`, `Suspended`, `Acceptance`, `Warranty`, `Canceled`.
- Click-to-save: no confirmation dialog, change is persisted instantly.

**Known enum domains (complete lists, not just "seen in the wild"):**

- `Status` (7): Active, Finished, Unconfirmed, Suspended, Acceptance, Warranty, Canceled.
- `Model` (3): `FP`, `T&M`, `ODC`.
- `Type` (9): Production, Learning, Administration, Commercial (wizard default), Idle time, Internal, Investment, Investment without invoicing, `Project manager`.
- `Country` (2): Russia, France.

Ampersand display bug: `T&M` selected in the wizard renders as `TM` on the profile page `Model` field — the list-view column shows `T&M` correctly, so the bug is in the profile-page renderer only. Confirmed on `/projects/8168` (Noveo-PMTTest-Playwright-Internal).

**Sub-entities on General tab (all CRUD from UI):**

- `Contracts` — Add/Edit/Delete. Add dialog has nested Resources sub-form (Position/Grade/Start/End/Man-days/Employee) via drag-and-drop.
- `Description` — WYSIWYG rich-text editor (Heading 1/2/3/Normal, bold/italic/underline/link, ordered/bullet list, clean). Single blob.
- `Links` — list of `{Description *, Link *}` rows. The `TTT Project` link is auto-generated by the sync (`https://ttt.noveogroup.com/admin/projects#<tttId>`) — reliable handle for TTT-side verification.
- `Attachments` — drag-drop file upload (max 1 GB).

**Other tabs:**

- `Resources` — read-only view of allocations owned by the external Staffing Plan tool (`staffing-preprod.noveogroup.com`). Cannot be edited from PMT.
- `WSR` — Weekly Status Reports: Add/Edit/Delete + XLS export (`/api/v1/projects/<pid>/wsr/<wsrId>/generate-xls`).
- `Dashboard` — week-scoped editable row (`projectWeekInfo`): Health Status, End of budget, News&Issues&Risks free text, QA call, 3 checkboxes.

### Auth / logout behavior

- `Log out` in the user menu (top-right, under the current user name) navigates to PMT's `/sso/logout`, which redirects to the Keycloak end-session endpoint with an OIDC `id_token_hint` — correct OIDC flow.
- **Rate-limiting on `demo-noveo` realm**: after a logout → login cycle (especially multiple rapid ones), Apache on `sso.noveogroup.com` may return `403 Forbidden` on `/realms/demo-noveo/protocol/openid-connect/auth` for roughly 60-90 seconds. The Keycloak root (`sso.noveogroup.com/`) continues to work — only the `demo-noveo` realm is throttled. After the cool-down window, login succeeds normally. Autotests that exercise user-switching on PMT should budget ~60-90s between logouts or serialize them.

### Specific UI limitations that block revert flows

Discovered while editing `/projects/473` (Diabolocom-AI) as `pvaynmaster`:

1. **Country cannot be cleared.** Once set to `France` or `Russia`, the only way to change it is to pick the other option. There is no "None", "—", clear button, or code path to empty-save.
2. **Project Supervisor cannot be reassigned to Pavel Weinmeister.** He's absent from the dropdown candidate list under both `pvaynmaster` and `slebedev` sessions. This is the general role-filter rule above — Pavel currently does not hold the role that makes someone a valid Supervisor candidate in PMT's backend, even though he's currently set as Supervisor on several projects.

Both are bugs/UX limitations in the current PMT build — expect them to be fixed eventually.

### Project transfer (change PM) — from Projects list page

There is **no PM-edit control on the project profile page** (the `PM` value there is read-only). The PM is changed via a dedicated **"Project transfer"** flow initiated from the Projects list (`/projects`):

- The last (unlabeled) table column has a **row-action icon that appears only on `Active` rows** — rows in `Finished` / `Canceled` / other terminal statuses don't render it. So a Finished project's PM cannot be reassigned from this page.
- **The icon is dual-purpose: Transfer vs Return — behavior depends on project state.** The tooltip always says `Transfer the project` (misleading), but the action the icon triggers is different depending on whether the current PM matches the Owner:

  | Project state | Icon click action | Modal? | Endpoint |
  |---------------|-------------------|--------|----------|
  | `PM == Owner` (project is with its owner) | opens **"Project transfer"** dialog | yes (pick new PM from combobox, click Transfer) | `POST /api/v1/projects/<id>/transfer` |
  | `PM != Owner` (project is currently transferred) | **instant return** to Owner — no modal, no confirmation | **no** | `POST /api/v1/projects/<id>/return` |

  The `/return` variant is the "undo last transfer" operation — one click and PM is restored to Owner. This has important consequences for autotests:
  - A test that transfers a project and wants to chain "pick yet another PM" cannot do it in one UI step — the second click of the icon will return to Owner, not open a new Transfer dialog. You must transfer back to Owner (explicitly via `/return` or by selecting Owner in the Transfer modal) first, then the icon reverts to Transfer-dialog mode and you can pick a new PM.
  - An autotest cleanup/revert step after a transfer can simply click the icon again — no need to re-open the modal and pick Owner manually.
  - The tooltip does NOT change between the two modes — don't rely on tooltip text to detect which action the icon will take. Check the row's PM cell vs the project's Owner field instead.

**Transfer modal behavior** (only when `PM == Owner`):

- Clicking the icon opens a modal titled **"Project transfer"** with a single required field `New project manager *` (Vue multiselect) + `Cancel` / `Transfer` buttons.
- Unlike the profile-page editors, the combobox **does NOT pre-select the current PM** — it opens empty and the user must pick.
- Clicking `Transfer` triggers `POST /api/v1/projects/<id>/transfer`. On `200 OK` the modal closes and the row updates inline. On error (e.g. `422`) the modal stays open with **no visible error message** — failures are silent from the user's perspective, a UX bug.
- Transfer changes **`PM` only, not `Owner`**. `Owner` remains the original creator/owner of the project. The profile page exposes both as separate read-only fields so you can distinguish.

**PM candidate list is much broader than Supervisor's** — observed ~125 entries vs ~55 for Supervisor, and the PM list **includes** users that the Supervisor dropdown excludes (e.g., `Pavel Weinmeister`, `Sergey Lebedev`, `Ivan Ilnitsky`). So the role-filter on Supervisor is Supervisor-specific; the PM pool is effectively the full set of PM-eligible users.

**Ivan Ilnitsky — special backend record (CEO).** Transferring a project to Ivan Ilnitsky via the UI reliably returns `422 Unprocessable Content` with `{"errors":{"pm":["The pm must be an array."],"pm.id":["The pm.id field is required."]}}`. This is a **data-level anomaly** — the Ivan Ilnitsky user record is treated specially on the backend because he is the CEO, and the frontend's PM serializer produces a payload that fails validation for him. **For routine cross-project E2E tests, avoid selecting Ivan Ilnitsky as PM** — pick any other candidate. Dedicated CEO-related tests that specifically target this edge case are fine (and in fact valuable for regression).

Verified cases:
- Transfer `/projects/473` (Diabolocom-AI) from original PM Dmitry Dergachev (Owner) to Kseniya Ilyukhina → `POST /transfer 200 OK`, PM updates to Kseniya.
- Click icon again on the same row with PM=Kseniya → `POST /return 200 OK`, no modal, PM reverts to Dmitry Dergachev (Owner).
- Transfer to Ivan Ilnitsky → `POST /transfer 422` (silent failure, modal stays open).

### Projects list — default scope filter ("my projects")

The default view of the `/projects` page is **NOT "all projects"** — it implicitly filters to projects where the current logged-in user is PM or Supervisor (the "my projects" scope). Side effects:

- **Search can return "No results" for projects that clearly exist** — the filter narrows the pool before the substring search runs. Example: after transferring `/projects/473` away from Pavel Weinmeister, searching `Diabolocom-AI` as `pvaynmaster` returned `No results` even though the project is active and Pavel can still view it by ID URL.
- To see all projects the filter icon needs to be clicked — same icon used for status filter (next to "Add project"). When clicked, a `Clear all filters` label appears and the default "my projects" scope is removed.
- The default filter is NOT shown as a chip/pill anywhere — there is no visible indication that the list is scoped. Users unfamiliar with PMT conclude "the project doesn't exist" or "search is broken" when it's really this hidden default.
- For autotests: any cross-project test that finds a project by name on the list view must **first clear the default filter** before searching, or it will silently fail when the current user is not PM/Supervisor on the target project. Add a `clearDefaultScopeFilter()` step to the Projects list page object to make this deterministic.

### Project creation (`Add project` wizard)

The `Add project` button on the projects list launches a **3-step wizard** (breadcrumb `1 2 3` at the top). Backend endpoint: `POST /api/v1/projects`.

**Step 1 — basic info + people** (required fields marked `*`):

| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| Project name | ✅ | textbox | empty | Help text: `Customer-Title-Technology-Model` without spaces. Convention only — backend accepts any non-empty string. |
| Description | — | WYSIWYG | empty | Same toolbar as profile page, but here it also has `Heading 4/5/6`, `blockquote`, `code-block`, `link`, plus two extra buttons (image? anchor?) the profile editor lacks — richer toolbar in the wizard. |
| Customer | ✅ | filterable autocomplete | empty | Large pool — typing `Noveo` returns Noveo / Noveo Core Team / Noveo Internal / Noveo Internal Tools. |
| Country | ✅ | combobox | empty | Same 2 options: `Russia`, `France`. |
| Model | ✅ | combobox | empty | `FP`, `T&M`, `ODC`. |
| Type | ✅ | combobox | `Commercial` | 9 values (see enum table above). Only field that comes pre-selected. |
| Project Folder | — | combobox | empty | |
| Project manager | ✅ | combobox | empty | **~55-entry role-filtered pool** — same as Supervisor dropdown on profile page, NOT the ~125-entry pool used by the Transfer modal. Creator often cannot pick themselves (e.g., Pavel Weinmeister absent). |
| Owner | ✅ | combobox | current logged-in user | **Unlike profile view** where Owner is read-only, here it is editable. Defaults to the creator. |
| Project supervisor | ✅ | combobox | empty | Same ~55-entry role-filtered pool as on the profile page. |
| Sales | — | combobox | empty | |
| Watchers | — | combobox | empty | |

Key distinction: **the wizard's `Project manager` dropdown uses the smaller role-filtered pool** (~55 entries), whereas the profile-page Transfer modal uses the broader PM pool (~125 entries including Pavel Weinmeister, Sergey Lebedev, Ivan Ilnitsky). So a user who can be transferred to an existing project via the transfer flow may NOT be selectable as PM when *creating* a new one. The `Project supervisor` dropdown behaves identically in both flows.

**Step 2 — Links + Attachments** (both optional).

**Step 3 — Add contract** (optional; same nested Contract+Resources form as the profile page).

**Dual-path finish on Step 2 footer:** three buttons — `Back` (to Step 1), **`Create project`** (finishes immediately, skipping Step 3), **`Next to Add contract`** (goes to Step 3). So Step 3 is truly optional; the minimum-viable-create path is: Step 1 filled → Next → Step 2 → `Create project`. Creating a project with no contracts is perfectly valid.

After `Create project`:
- Redirects to `/projects/<new-id>/profile/general`.
- Status defaults to `Active`.
- New project is immediately visible in the projects list for the PM, Supervisor, and Owner (default "my projects" scope).
- A benign console error `Failed to load resource: /api/v1/projects/<id>` appears on first render — likely an auxiliary fetch (contracts/WSR/TTT-link) that 404s on a brand-new empty project. No user-visible impact.
- **`TTT Project` link in the Links section is NOT auto-generated on creation** — the TTT sync is cron-driven, not realtime. Cross-project "create PMT project → verify in TTT" tests must either wait for the sync cycle or explicitly trigger it. Compare with `/projects/473` (Diabolocom-AI) which has the `TTT Project` link populated (synced long ago).

Verified creation: `/projects/8168` — `Noveo-PMTTest-Playwright-Internal`, Customer=Noveo, Country=Russia, Model=T&M (displayed as `TM` in profile), Type=Internal, PM=Dmitry Dergachev, Owner=Pavel Weinmeister, Supervisor=Aleksandr Maksimenko, created 2026-04-16 as part of a UI exploration session.

## Related vault notes

- [[ttt-pmt-sync]] — TTT ↔ PMT integration (cross-system note)
- [[pm-tool-integration-deep-dive]] — PM Tool integration deep dive (TTT-side, 2-phase ID mapping, sync mechanics, Sprint 15)
- [[pm-tool-sync-implementation]] — PM Tool sync implementation (TTT-side, code walkthrough)
- [[pm-tool-stage-comparison]] — PM Tool changes between release/2.1 and stage branches
- [[admin-panel-deep-dive]] — TTT admin panel "PM Tool sync" section (TTT side)
- [[cross-service-integration]] — TTT cross-service integrations overview (PM Tool entry)

## External documentation

- Confluence (PMT subtree root): https://projects.noveogroup.com/spaces/NOV/pages/18944057/Project+Management+Tool

## Known open items

- PMT UI default language — not yet confirmed during live exploration (CS defaults to Russian; PMT may or may not mirror this behavior).
- PMT user pool beyond the admin account — discover as cross-project tests require specific roles.
- PMT GitLab repo URL — not yet identified; mark `TODO(PMT)` when cross-referencing tickets.
- Keycloak logins observed working for PMT: `pvaynmaster`, `slebedev`. `ilnitsky` / `iilnitsky` rejected silently by Keycloak (no error message in the form, just stays on the login page). Credentials for other users not yet known.
