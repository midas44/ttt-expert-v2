---
name: playwright-browser
description: >
  Automate browser interactions on the TTT, CS, and PMT environments (and other web apps) using
  Playwright — navigate pages, log in, click elements, fill forms, switch language,
  take screenshots, and more. Use this skill when the user asks to "open a page",
  "take a screenshot", "log in as user X", "test in the browser", "navigate to",
  "check the UI", "use Playwright", "browser test", "screenshot a page", or any task
  that requires controlling a real browser. Also use when the user mentions "playwright",
  "headless browser", "browser automation", "open TTT", "login to TTT", "open CS",
  "login to CS", "Company Staff UI", "open PMT", "PM Tool UI", "Project Management Tool",
  "screenshot", or asks to visually verify a page. Covers both the Playwright MCP plugin
  (for simple public-site interactions) and standalone Node.js scripts (for VPN/proxy-restricted sites).
---

# Playwright Browser Automation

**Scope:**
- TTT: full
- CS: full (UI access via the same `playwright-vpn` MCP — CS is also behind the corporate VPN)
- PMT: full (UI access via the same `playwright-vpn` MCP — PMT is also behind the corporate VPN)

This skill provides instructions for automating browser interactions using Playwright,
with special handling for the TTT, CS, and PMT environments behind VPN.

## Targeting CS (Company Staff)

CS is the secondary integrated SUT. UI is the only available access surface. Key facts:

- Base URL pattern: `https://cs-<env>.noveogroup.com` — currently only `preprod`. Get the resolved URL from `config/cs/cs.yaml` (`appUrl` template) or read it from `e2e/config/cs/csConfig.ts` if running inside the autotest framework.
- Auth: CAS SSO at `cas-demo.noveogroup.com` — same as TTT. **If the same browser context already has a TTT session via CAS, the CS login form is short-circuited** (the page redirects straight to CS dashboard). For deterministic behavior in cross-project scripts, open a separate `BrowserContext` per app (`browser.newContext()`).
- Credentials: see `config/cs/envs/preprod.yaml` (default `slebedev` / `slebedev`).
- Path inventory (from `config/cs/cs.yaml`): `/preferences`, `/employee/active/list`, `/contractors?tab=active`, `/settings/salary-office?tab=list`.

When the user asks to "log in to CS", use the CS appUrl + the slebedev credentials and check for the username input visibility before filling — the CAS short-circuit means the form may not appear.

### CS-specific gotchas (from live exploration 2026-04-15)

Knowledge deep-dive lives in the vault: `cs/_overview.md`, `cs/ui-automation-notes.md` + peers. TL;DR for automation:

1. **Switch UI language to English first, always.** Most CS accounts default to Russian, which produces Cyrillic snapshots. Go to `/preferences` → click the `English` radio directly (labels are ambiguous — there's an "English" text elsewhere that matches `getByText('English')` wrong) → remove InnovationLab popup (see #3) → click `Сохранить`/`Save`. Saved per-user, persistent. Recipe in `cs/ui-automation-notes.md`.

2. **CAS login button click often no-ops.** Use `HTMLFormElement.prototype.submit.call(form)` via `browser_evaluate` — the CS CAS form has an input named `submit` that shadows the form's native `submit()` method, and the Login `<button>` is not a true submit button. Filling username/password then calling the prototype submit works 100%.

3. **InnovationLab popup blocks action-button clicks.** A dismissable popup in the bottom-right on every page; it overlaps Save, Publish, and timeline controls. Remove it before any button click: `document.querySelectorAll('div').forEach(el => { if (el.textContent?.includes('InnovationLab') && el.textContent.length < 300) el.remove(); });`.

4. **Role switching requires context-level cookie clear.** CAS `/logout` drops the CAS ticket but the Symfony session cookie on CS is HttpOnly and survives — the next CS navigation silently re-auths as the previous user. Use `browser_run_code` with `await page.context().clearCookies()` before navigating back to CS.

5. **Masked phone input (`#phoneInput`) rejects JS-injected values.** Use Playwright `.fill()` with digits only (e.g. `79991234567`); the mask auto-formats to `+7(999)123-xx-xx`.

6. **Vue multiselect labels are frequently 2+ ancestors away from the dropdown.** Walk up 6 parents before giving up. See the `pickFromMultiselect` pattern in `cs/ui-automation-notes.md`.

7. **Pages open in new tabs.** The pencil/edit icon on the employee list opens `/profile/edit/<id>` in a new browser tab — use `browser_tabs action=select index=N` to switch.

8. **Username convention is idiosyncratic.** Logins are first-initial + last-name, but transliteration is bespoke — Pavel Weinmeister is `pvaynmaster`, not `pweinmeister`. To discover a user's login, search the employee list and read failed thumbnail URLs from console errors (`/api/thumbnail/<login>/400`).

## Targeting PMT (Project Management Tool)

PMT is the third integrated SUT. UI is the only available access surface. Key facts:

- Base URL pattern: `https://pm-<env>.noveogroup.com` — currently only `preprod`. Get the resolved URL from `config/pmt/pmt.yaml` (`appUrl` template) or read it from `e2e/config/pmt/pmtConfig.ts` if running inside the autotest framework.
- **Auth: Keycloak OIDC (NOT CAS Demo).** Login redirects to `https://sso.noveogroup.com/realms/demo-noveo/protocol/openid-connect/auth?client_id=openid-preprod-pmtool&redirect_uri=.../sso/auth&...`. TTT and CS share CAS Demo; PMT does **not**. A prior CAS session in the same `BrowserContext` will NOT auto-log you into PMT — you get the Keycloak login form. Treat PMT like an independent SSO backend. Open a separate `BrowserContext` for PMT in cross-project scripts to keep both sessions clean.
- Credentials: see `config/pmt/envs/preprod.yaml` (default `pvaynmaster` / `pvaynmaster` — admin). Login form fields are standard Keycloak: `textbox "Username or email"` + `textbox "Password"` + `button "Sign In"`.
- Path inventory (from `config/pmt/pmt.yaml`): `/projects`. Additional paths will be added to `pmtConfig.ts` on demand as cross-project tests require them.
- Confluence entry (product docs): `https://projects.noveogroup.com/spaces/NOV/pages/18944057/Project+Management+Tool`.
- Issue tracker: PMT tracks its own issues in **JIRA**, not GitLab (footer link points to `jira.noveogroup.com/secure/RapidBoard.jspa?rapidView=223&projectKey=PMT`). The `TODO(PMT)` markers about the GitLab repo in other skills may turn out to resolve as "use JIRA instead of GitLab for PMT tickets".

### PMT UI gotchas (from live exploration 2026-04-16)

> **Caveat:** PMT is an actively developed product with known bugs. The gotchas below reflect behavior observed on `pm-preprod.noveogroup.com` on 2026-04-16 and may change as the product evolves — re-verify before relying on them in new automation.

1. **Projects page status filter hides Finished/Canceled by default.** Searching for a customer with only Finished projects returns "No results" even when they exist. The filter toggle is a small icon to the right of the "Add project" button — clicking it exposes a "Clear all filters" link and returns all statuses. A page object for `/projects` will need a `clearStatusFilter()` method before any "find by name" flow.
2. **Search is substring, case-insensitive, live.** Typing in the `Search by name` textbox filters the table as you type; no Enter required. Matches any substring of the project name.
3. **Status cell is an editable combobox inline in the table.** Changing project status does not require opening the project profile page — the list itself allows it. Useful for integration tests that need to flip status.
4. **Country field cannot be cleared from UI.** The country editor on a project profile is a `@vueform/multiselect` with `canClear: false` and only two options (`Russia`, `France`). Once set, you can only switch between the two. Saving with an empty combobox throws a frontend `TypeError: Cannot read properties of undefined` and leaves the field unchanged. To "set blank", DB / API access is required — no UI workaround. (The editor is a copy of the Sales picker: placeholder still reads `Add sales`, wrapper class is `sales-multiselect` — code smells worth noting when writing selectors.)
5. **Supervisor dropdown is role-filtered.** The Supervisor candidate list excludes users who don't currently hold the qualifying role, even if they are the current Supervisor on that project. Observed concretely: `Pavel Weinmeister` is the Supervisor on `/projects/473` but is NOT in the dropdown under either `pvaynmaster` or `slebedev` sessions — typing his name returns "No results found". Consequence for cross-project tests: you can read the current Supervisor, but you cannot re-assign it back to an "ex-qualified" user from the UI. Tests that toggle Supervisor must pick from the available pool only.
6. **Keycloak `demo-noveo` realm throttles rapid login/logout cycles.** After logging out and immediately re-navigating to `/sso/login` (or hitting `/realms/demo-noveo/protocol/openid-connect/auth`), the endpoint can return a bare Apache `403 Forbidden` for ~60–90 seconds. Keycloak root (`sso.noveogroup.com/`) is still reachable. Autotests exercising user-switching on PMT should budget ≥60s between logout and next login, or serialize user-switch scenarios. The login form itself gives no error message when credentials are invalid — it just stays on the login page (observed with `ilnitsky`/`iilnitsky` attempts; they silently failed).
7. **Logout flow is OIDC-compliant.** `Log out` in the user menu → `/sso/logout` → Keycloak end-session endpoint with `id_token_hint`. No PMT-specific logout extras.
8. **Inline editor save/cancel icons.** For every inline-editable field (Name, Country, Project Supervisor, Sales, etc.), the editor exposes two icons: first = save (check / `icon-check`), second = cancel (cross / `icon-cross-thin-line`). Both inside a `.sales-edit__actions` wrapper div — keep this in mind when building Page Objects (all inline editors share one CSS class pattern regardless of which field).
9. **PM change = Project transfer from list page, not profile page.** On the project profile page the `PM` value is **read-only**. To change it, go back to `/projects`, find the row, and click the row-action icon in the last (unlabeled) column. The icon **only renders on `Active` rows** — Finished / Canceled projects cannot be transferred from this UI. Transfer changes `PM` only; `Owner` stays intact.
10. **The row-action icon is DUAL-MODE — Transfer vs Return — based on `PM == Owner`.** The same icon behaves differently depending on project state, but its tooltip always reads `Transfer the project` (misleading — do NOT use the tooltip to detect mode):
    - **`PM == Owner`** (project is with its owner): clicking the icon opens a **"Project transfer"** modal with a `New project manager *` combobox (opens empty, does NOT pre-select current PM). Click `Transfer` → `POST /api/v1/projects/<id>/transfer`. On `200 OK` row updates inline; on `422` modal stays open with NO visible error — failures are silent, inspect network.
    - **`PM != Owner`** (project is currently transferred to someone else): clicking the icon triggers an **instant revert** — no modal, no confirmation, a single `POST /api/v1/projects/<id>/return` → `200 OK` restores PM to Owner.
    For autotests: (a) the cleanest post-test revert is just to click the icon again after a transfer — it auto-returns. (b) To chain "transfer to A, then transfer to B" in one flow you MUST go through Owner (transfer → return → transfer); the icon will not open the modal twice in a row. (c) Detect current mode by comparing the row's PM cell value to the project's Owner field on the profile page; don't rely on tooltip text.
11. **Three distinct PM-related dropdowns with different pool sizes.** Don't assume one "PM user list" exists — there are three, and picking the wrong reference data for an autotest will cause flakes:
    | Context | Pool size | Includes Pavel / Sergey / Ivan? |
    |---|---|---|
    | Profile page → `Project Supervisor` inline editor | ~55 (role-filtered) | No |
    | Projects list → Project transfer modal → `New project manager` | ~125 (full PM pool) | Yes |
    | `Add project` wizard → Step 1 → `Project manager` | ~55 (role-filtered, same as Supervisor) | No |
    The Supervisor dropdown and the wizard's PM dropdown share the same role-filtered pool; the transfer modal is the ONE place with the full pool. Cross-project tests that create a project and then transfer it use two different PM universes within the same flow — pick test users that appear in both (e.g. Kseniya Ilyukhina, Dmitry Dergachev).
12. **Ivan Ilnitsky is a CEO-special user — avoid in routine tests.** Transferring any project to Ivan Ilnitsky returns `422 Unprocessable Content` (`{"errors":{"pm":["The pm must be an array."],"pm.id":["The pm.id field is required."]}}`). The user record has special backend semantics because he is the CEO, so the frontend PM serializer produces a payload that fails validation specifically for him. **For routine cross-project E2E tests on PMT, pick any PM EXCEPT Ivan Ilnitsky** (e.g. Kseniya Ilyukhina, Ekaterina Morgunova — both confirmed to accept transfers). Dedicated "CEO edge-case" tests targeting this specific 422 behavior are fair game and worth keeping as regression coverage.
13. **Projects list `/projects` is implicitly scoped to "my projects" by default.** The default view filters to projects where the current logged-in user is PM or Supervisor; there's no visible chip/pill advertising this filter. Searching for a project you have no PM/Supervisor role on returns `No results` silently — not a search bug, a hidden scope. To see any project, click the filter-toggle icon next to "Add project"; a `Clear all filters` label appears and the default scope is removed. For cross-project autotests that look up a project by name on the list page: **always clear this default filter first** or the search will fail non-deterministically based on who is logged in. Build a `clearDefaultScopeFilter()` step into the Projects list Page Object before any search.
14. **`Add project` is a 3-step wizard, not a single-page form.** `Step 1` = basic info + people (all required except Description / Project Folder / Sales / Watchers). `Step 2` = Links + Attachments (optional). `Step 3` = first contract (optional, opened via the `Next to Add contract` footer button). Step 2 footer has **three** buttons: `Back`, `Create project` (finishes immediately, skipping contracts), `Next to Add contract`. Minimum-viable create path: fill Step 1 → `Next` → `Create project` from Step 2. A page object for the wizard should expose `fillRequired(...)` and `finishMinimal()` methods that stop at Step 2, because most cross-project tests don't need contracts on day-one.
15. **Wizard's `Owner` field is EDITABLE** — distinct from the profile page where `Owner` is a read-only label. Defaults to the creator but can be swapped from the Owner combobox in Step 1. Changing Owner here means the `/return` fallback on the Projects list (gotcha #10) will restore PM to this chosen Owner, not to the creator, if the project is later transferred away.
16. **`T&M` ampersand stripped in profile `Model` field.** A project created with `Model: T&M` via the wizard renders as `TM` on its profile-page `Model` field, but correctly as `T&M` in the projects list `Model` column. The bug is in the profile renderer; selectors matching Model value should use `.includes('T&M') || .includes('TM')` or prefer the list-view value as the source of truth.
17. **TTT sync is cron-driven, not realtime.** On a newly created PMT project the `Links` section is empty — the auto-generated `TTT Project` link (pointing to `https://ttt.noveogroup.com/admin/projects#<tttId>`) appears only after the next PM Tool → TTT sync cycle. A cross-project autotest that creates a PMT project and then verifies its appearance on TTT must either wait for the scheduled sync or trigger it via a TTT admin endpoint. Don't assume the link is present immediately after `Create project` returns `200`.

More UI details live in `vault/pmt/_overview.md`.

## Three Approaches

| Approach | When to Use | Proxy/VPN Support |
|---|---|---|
| **`playwright-vpn` MCP server** (recommended) | All TTT environments, interactive exploration, autonomous sessions | Yes — proxy bypassed via env vars + `--proxy-bypass` flag |
| **Standalone Node.js script** | Complex multi-page flows, batch screenshots, custom Playwright API | Yes — unsets proxy env vars before launch |
| **Built-in Playwright MCP plugin** | Public sites only (no VPN) | No — inherits `HTTP_PROXY`, cannot bypass |

**Important:** The built-in Playwright MCP plugin (`playwright@claude-plugins-official`) inherits
the system `HTTP_PROXY=http://127.0.0.1:2080` and provides no way to override it. VPN hosts
return **502 Bad Gateway** or **ERR_CONNECTION_RESET**. Use the `playwright-vpn` MCP server
instead — it has proxy bypass built in. See `docs/playwright-mcp-fix.md` for full details.

---

## 1. Standalone Script (Recommended for TTT)

### Prerequisites

Playwright must be installed as a local npm package:

```bash
npm list playwright 2>/dev/null || npm install --no-save playwright
```

The system Chrome (`google-chrome`) is used as the browser via `channel: 'chrome'`.

### Script Template

Use or adapt the bundled template at `scripts/ttt-template.mjs`:

```bash
node <skill-path>/scripts/ttt-template.mjs
```

### Key Patterns

#### Proxy Bypass (CRITICAL for VPN hosts)

Always unset proxy env vars at the top of the script, **before** any Playwright imports
are used to launch browsers:

```js
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;
```

#### Browser Launch

```js
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome'   // uses system google-chrome
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true
});

const page = await context.newPage();
```

#### TTT Login (Login-Only Auth, No Password)

The TTT QA login page has a single `Login` field and a `LOGIN` button — no password.

```js
await page.goto('https://ttt-qa-1.noveogroup.com', { waitUntil: 'networkidle', timeout: 30000 });
await page.fill('#username', '<login>');
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
  page.click('button[type="submit"]')
]);
// After login, URL should be /report (dashboard)
```

#### Switch Language (RU -> EN)

The nav bar shows "RU" as a dropdown. Click it, then click "EN":

```js
await page.locator('text=RU').first().click();
await page.waitForTimeout(500);
const enOption = page.locator('text=EN').first();
if (await enOption.isVisible({ timeout: 3000 }).catch(() => false)) {
  await enOption.click();
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}
```

If already in English, the nav shows "EN" — skip this step or check first:

```js
const langText = await page.locator('.nav >> text=/^(RU|EN)$/').first().textContent();
if (langText === 'RU') { /* switch */ }
```

#### Navigate to Common Pages

| Page | URL Path | Notes |
|---|---|---|
| Dashboard (My tasks) | `/report` | Default after login |
| My Vacations | `/vacation/my` | Redirects to `/vacation/my/my-vacation/OPENED` |
| Vacation Requests | `/vacation/request` | Shows pending vacation requests |
| Absence Calendar | via nav menu "Calendar of absences" dropdown | |
| Planner | `/planner` | |
| Confirmation | `/confirmation` | |

#### Take Screenshots

```js
await page.screenshot({
  path: 'artifacts/playwright/screenshot-name.png',
  fullPage: true
});
```

Always save to `artifacts/playwright/`. Create the directory first if needed.

#### Logout

```js
await page.goto('https://cas-demo.noveogroup.com/logout', {
  waitUntil: 'networkidle', timeout: 30000
});
```

The page should contain "Logout successful".

#### Error Handling

Always wrap in try/catch and take an error screenshot on failure:

```js
try {
  // ... steps ...
} catch (error) {
  console.error(`Error: ${error.message}`);
  await page.screenshot({ path: 'artifacts/playwright/error-screenshot.png', fullPage: true });
} finally {
  await browser.close();
}
```

---

## 2. playwright-vpn MCP Server (Recommended for TTT)

A standalone `@playwright/mcp` server registered with proxy bypass. Provides the same
interactive MCP tools as the built-in plugin but can reach VPN hosts.

### Setup

Already registered as `playwright-vpn` in local scope. If missing, see `docs/playwright-mcp-fix.md`.

### Available MCP Tools

All tools are prefixed with `mcp__playwright-vpn__`:

| Tool | Description |
|---|---|
| `browser_navigate` | Navigate to a URL |
| `browser_click` | Click an element by ref |
| `browser_fill_form` | Fill form fields |
| `browser_type` | Type text into focused element |
| `browser_press_key` | Press keyboard key |
| `browser_hover` | Hover over element |
| `browser_select_option` | Select dropdown option |
| `browser_snapshot` | Get page accessibility snapshot (preferred for actions) |
| `browser_take_screenshot` | Take screenshot |
| `browser_evaluate` | Run JS on page |
| `browser_run_code` | Run Playwright code snippet |
| `browser_wait_for` | Wait for condition |
| `browser_tabs` | List open tabs |
| `browser_close` | Close current page |
| `browser_console_messages` | Get console output |
| `browser_network_requests` | Get network requests |
| `browser_navigate_back` | Go back |
| `browser_resize` | Resize viewport |
| `browser_drag` | Drag element |
| `browser_file_upload` | Upload file |
| `browser_handle_dialog` | Handle alert/confirm dialog |

Tools must be loaded via `ToolSearch` before first use:

```
ToolSearch: select:mcp__playwright-vpn__browser_navigate
```

### Usage Pattern

```
1. ToolSearch: select:mcp__playwright-vpn__browser_navigate,mcp__playwright-vpn__browser_snapshot
2. browser_navigate → URL
3. browser_snapshot → get element refs
4. browser_click / browser_fill_form → interact by ref
5. browser_take_screenshot → capture evidence
```

---

## 3. Built-in Playwright MCP Plugin (Public Sites Only)

The built-in plugin (`playwright@claude-plugins-official`) is only useful for public
websites. **Cannot reach VPN hosts** — returns 502/ERR_CONNECTION_RESET.

Tools prefixed with `mcp__plugin_playwright_playwright__`. Same tool names as above.

Use `playwright-vpn` instead for all TTT work.

---

## TTT Environment Reference

| Env | URL | Status |
|---|---|---|
| QA-1 | `https://ttt-qa-1.noveogroup.com` | Dev test environment |
| Timemachine | `https://ttt-timemachine.noveogroup.com` | Dev test environment (CAS login) |
| Stage | `https://ttt-stage.noveogroup.com` | Pre-prod test environment |

Config files: `config/ttt/ttt.yml`, `config/ttt/envs/<name>.yml`

CAS logout URL: `https://cas-demo.noveogroup.com/logout`

---

## Output Directory

Save all Playwright artifacts to:
```
artifacts/playwright/
```

Use descriptive filenames:
```
artifacts/playwright/<user>-<page>-<date>.png
```

Example: `atushov-vacations-2026-02-27.png`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 502 Bad Gateway on VPN host | Browser using HTTP_PROXY | Use `playwright-vpn` MCP server (not built-in plugin). See `docs/playwright-mcp-fix.md` |
| `ERR_MODULE_NOT_FOUND: playwright` | Not installed locally | `npm install --no-save playwright` |
| Login doesn't work (stays on login page) | Wrong selectors | Use `#username` for input, `button[type="submit"]` for button |
| Language switch doesn't work | EN already active or selector mismatch | Check if nav shows "RU" or "EN" first |
| Page content not loaded | SPA async loading | Add `page.waitForTimeout(2000)` or `waitForSelector` |
| MCP tool not found | Not loaded yet | Use `ToolSearch: select:mcp__plugin_playwright_playwright__<tool>` |
| Screenshot is blank/login page | Session lost on navigation | Ensure cookies persist (use same context) |
| `channel: 'chrome'` fails | Chrome not installed | Check `which google-chrome` — fallback to `chromium` |
