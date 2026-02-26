# GitLab Access — Skill Reference

Reference document describing how to interact with the GitLab instance at `gitlab.noveogroup.com` (GitLab CE 16.11).

## Instance Details

- **URL:** https://gitlab.noveogroup.com
- **API base:** https://gitlab.noveogroup.com/api/v4
- **Version:** GitLab Community Edition 16.11.10
- **Auth type:** LDAP (default login tab) + Standard

## Authentication

Two authentication mechanisms are needed depending on the resource type.

### 1. API Access (PAT)

The Personal Access Token (PAT) works for all `/api/v4/` endpoints.

```
Header: PRIVATE-TOKEN: <token>
```

Token is stored in `.claude/.mcp.json` under `GITLAB_PERSONAL_ACCESS_TOKEN`.
Scopes: `api`, `read_api`, `read_user`, `read_repository`, `write_repository`, `read_registry`, `write_registry`.

### 2. Web Session Access (LDAP login via Puppeteer)

Upload files (issue attachments, screenshots) are served through web routes, **not** the API. They require a browser session cookie (`_gitlab_session`) obtained by signing in through the web UI.

**PAT does NOT work for web routes.** All of the following fail:
- `PRIVATE-TOKEN` header on web URLs
- `Authorization: Bearer` header
- `?private_token=` query parameter
- Basic auth with PAT as password
- OAuth2 password grant with PAT

Web credentials are stored in `.claude/context/gitlab-credentials.md`.

#### LDAP Login Form Fields

The sign-in page (`/users/sign_in`) defaults to the **LDAP** tab. Field selectors:

| Field    | ID                   | Name       | Type     |
|----------|----------------------|------------|----------|
| Username | `#ldapmain_username` | `username` | text     |
| Password | `#ldapmain_password` | `password` | password |

The Standard tab uses `#user_login` / `#user_password` — do NOT use these for LDAP auth.

---

## Operations

### Read a Ticket (Issue)

**Method:** REST API with PAT

**Steps:**

1. Resolve the project ID from the URL path. The project `noveo-internal-tools/ttt-spring` has ID `1288`. To find a project ID dynamically:
   ```
   GET /api/v4/projects?search=<name>
   ```
   Then match `path_with_namespace` in the results.

2. Fetch the issue:
   ```
   GET /api/v4/projects/:project_id/issues/:iid
   Header: PRIVATE-TOKEN: <token>
   ```

3. Key fields in the response:
   - `title` — issue title
   - `description` — markdown body (contains relative image paths like `/uploads/<secret>/<filename>`)
   - `state` — `opened` / `closed`
   - `labels` — array of label strings
   - `assignees` — array of user objects
   - `author` — user object
   - `created_at`, `updated_at` — timestamps
   - `web_url` — browser link to the issue

4. Fetch issue comments/notes:
   ```
   GET /api/v4/projects/:project_id/issues/:iid/notes?per_page=100
   Header: PRIVATE-TOKEN: <token>
   ```

### Extract Image URLs from a Ticket

Image paths appear in the `description` field as markdown:
```
![alt](/uploads/<secret_hash>/<filename>)
```

Parse with regex:
```
/!\[([^\]]*)\]\(\/uploads\/([a-f0-9]+)\/([^)]+)\)/g
```

This gives the secret hash and filename. The full web URL is:
```
https://gitlab.noveogroup.com/<namespace>/<project>/uploads/<secret_hash>/<filename>
```

### Download Attachments (Uploads)

**Method:** Headless browser (Puppeteer) with LDAP credentials

Uploads are NOT accessible via the API on this GitLab version/access level. A browser session is required.

**Prerequisites:**
- Node.js 18+
- Puppeteer: `npm install puppeteer` (installs to working dir or `/tmp`)
- Google Chrome installed on the system

**Preferred method — use the bundled skill script:**
```bash
# Create credentials file (avoids shell escaping issues with special chars like !)
cat > /tmp/gl_creds.json << 'EOF'
{"login": "<username>", "password": "<password>"}
EOF

node <skill-path>/scripts/download_attachments.mjs \
  --credentials-file /tmp/gl_creds.json \
  --output "<output-dir>" \
  --urls "<url1>" "<url2>" ...
```

**Manual procedure (if bundled script is unavailable):**

```javascript
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const BASE = 'https://gitlab.noveogroup.com';

async function downloadGitLabUploads(imageList, outdir) {
  // imageList: [{ name: string, url: string }, ...]

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  // Step 1: Load sign-in page
  await page.goto(`${BASE}/users/sign_in`, { waitUntil: 'domcontentloaded' });

  // Step 2: Fill LDAP form (default tab)
  const usernameField = await page.$('#ldapmain_username');
  const passwordField = await page.$('#ldapmain_password');
  await usernameField.type('<login>');
  await passwordField.type('<password>');

  // Step 3: Submit and wait for redirect
  const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
  await submitBtn.click();
  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) { /* may have already navigated */ }

  // Step 4: Verify login succeeded
  const url = page.url();
  if (url.includes('sign_in')) {
    throw new Error('Login failed');
  }

  // Step 5: Download each image by navigating to its URL
  for (const img of imageList) {
    const resp = await page.goto(img.url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    const contentType = resp.headers()['content-type'] || '';

    if (contentType.includes('image')) {
      const buffer = await resp.buffer();
      writeFileSync(`${outdir}/${img.name}`, buffer);
    }
  }

  await browser.close();
}
```

**Important notes:**
- Use `#ldapmain_username` / `#ldapmain_password` selectors — NOT the generic `#user_login` / `#user_password` which belong to the Standard tab.
- If both username and password end up in one field, the wrong tab or wrong selectors were used.
- The session cookie expires after ~2 hours.

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Upload download via API | Not available at Developer access level (requires Maintainer+ for `GET /projects/:id/uploads`) |
| PAT on web routes | Always redirects to `/users/sign_in` |
| OAuth2 password grant | Rejected — PAT is not a valid password for OAuth flow |
| Deprecated Session API | `POST /api/v4/session` removed in GitLab 16.x |
| `render_html` parameter | Not available on this GitLab version |
| GraphQL image resolution | Returns lazy-load placeholders (`data:image/gif;base64,...`) with relative `data-src`, not actual image data |

## API Endpoints Quick Reference

| Operation | Method | Endpoint |
|---|---|---|
| Get project by search | GET | `/api/v4/projects?search=<name>` |
| Get project by ID | GET | `/api/v4/projects/:id` |
| Get issue | GET | `/api/v4/projects/:id/issues/:iid` |
| List issue notes | GET | `/api/v4/projects/:id/issues/:iid/notes` |
| Get current user | GET | `/api/v4/user` |
| Get PAT info | GET | `/api/v4/personal_access_tokens/self` |
| Get GitLab version | GET | `/api/v4/version` |
| Render markdown | POST | `/api/v4/markdown` (body: `{"text": "...", "project": "..."}`) |
| GraphQL | POST | `/api/graphql` (body: `{"query": "..."}`) |

## Known Project IDs

| Project | ID | Path |
|---|---|---|
| ttt-spring | 1288 | `noveo-internal-tools/ttt-spring` |
