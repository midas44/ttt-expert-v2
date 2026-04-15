---
name: gitlab-access
description: >
  Access the GitLab instance at gitlab.noveogroup.com — read issues/tickets,
  fetch comments, search issues by label/keyword, download file attachments
  (screenshots, images, documents), list pipelines, compare branches, view
  code changes, and execute CI operations (deploy, migrate, restart, rollback)
  on testing environments from the Time Tracking Tool (TTT / ttt-spring) project.
  Use this skill whenever the user mentions a GitLab ticket, issue URL, merge request,
  pipeline, branch, or asks to fetch/download/summarize anything from gitlab.noveogroup.com.
  Also use it when the user pastes a GitLab URL, references an issue number, asks to search
  for tickets, wants to list pipelines, see branch changes, compare commits, or mentions
  TTT/Time Tracking Tool/Time Reporting Tool issues. Also use when the user asks to deploy,
  migrate, restart, rollback, trigger a CI job, play a pipeline job, or mentions
  CI/CD operations on any environment (dev, qa-1, qa-2, timemachine, preprod, stage).
  This includes tasks like "read ticket #3036", "get the screenshots from that issue",
  "summarize the GitLab issue", "find all vacation bugs in Sprint 14",
  "download the attachments", "list latest pipelines", "show changes in release/2.1",
  "what files changed in the last pipeline", "deploy to qa-1", "restart timemachine",
  "migrate qa-2", "rollback qa-1", or "run the deploy job on release/2.1".
---

# GitLab Access — Time Tracking Tool (TTT)

**Scope:**
- TTT: full
- CS:  N/A (CS GitLab repo not identified yet — TTT repo `ttt-spring` (project 172) is hardcoded throughout)

TODO(CS): identify the CS GitLab repo and parameterize project_id (today only `ttt-spring`/172 is wired up).


> **IMPORTANT:** The GitLab MCP server (`@modelcontextprotocol/server-gitlab`) is registered
> but **exposes no tools** on this GitLab CE 16.11 instance. All GitLab operations must use
> **curl with the PAT** as described below. Do NOT attempt to use MCP tools for GitLab.

This skill provides instructions for interacting with the **Time Tracking Tool**
(also known as Time Reporting Tool, project path: `ttt-spring`) on the self-hosted
GitLab CE 16.11 instance at `gitlab.noveogroup.com`.

This skill is scoped to a single project:

| Field | Value |
|---|---|
| Project name | Time Tracking Tool (TTT) / Time Reporting Tool |
| GitLab path | `noveo-internal-tools/ttt-spring` |
| Project ID | `1288` |
| Web URL | https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring |

All operations below assume this project. There is no need to resolve the project ID —
always use `1288`.

## Configuration Files

- **PAT (API token):** stored in `.claude/.mcp.json` → `env.GITLAB_PERSONAL_ACCESS_TOKEN`
- **Web credentials (LDAP):** stored in `.claude/context/gitlab-credentials.md`

Read these files at the start of any GitLab operation to get the current credentials.

---

## 1. Reading Tickets (Issues)

Use the REST API with the Personal Access Token (PAT). This is fast and reliable.

### Fetch a Single Issue

Given a URL like `.../ttt-spring/-/issues/3036` or just an issue number, extract the
IID and fetch directly:

```bash
curl -s --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/issues/$IID" | python3 -m json.tool
```

The response contains `title`, `description` (markdown body), `state`, `labels`,
`assignees`, `author`, `created_at`, `updated_at`, and `web_url`.

### Fetch Comments / Notes

```bash
curl -s --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/issues/$IID/notes?per_page=100" | python3 -m json.tool
```

Attachments can appear in notes too — always check both `description` and note `body`
fields for `/uploads/` references when asked to download attachments.

### Search Issues

Use query parameters to filter issues by keyword and/or label:

```bash
curl -s --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/issues?labels=LABEL_NAME&search=KEYWORD&per_page=100&scope=all"
```

Label names with spaces need URL encoding (e.g., `Sprint%2014` for "Sprint 14").
Multiple labels can be comma-separated: `labels=Sprint%2014,Backend`.

The `search` parameter matches against title and description text.

### Add a Comment / Note

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  --header "Content-Type: application/json" \
  -X POST "https://gitlab.noveogroup.com/api/v4/projects/1288/issues/$IID/notes" \
  --data "$(python3 -c "import json,sys; print(json.dumps({'body': sys.stdin.read()}))" <<< "$BODY")"
```

The `$BODY` variable should contain the markdown-formatted comment text. Use a heredoc
to build it for multi-line content. The response contains `id`, `author`, `created_at`.

**Tips for formatting:**
- GitLab supports `<details><summary>Title</summary>content</details>` for collapsible sections
- Markdown tables, code blocks, and emoji (`:white_check_mark:`) all work
- To safely pass the body through JSON, always use the `python3 -c "import json..."` pipe
  pattern shown above — this handles special characters, newlines, and quotes correctly

### Summarize

When asked to summarize, extract: title, status, labels, assignee, creation date,
and a concise description of the problem and expected behavior. Note any attached
images (they appear as `![alt](/uploads/<hash>/<filename>)` in the description or notes).

---

## 2. Uploading Files (Screenshots, Images)

Upload files to a GitLab issue via the project uploads API. This is a two-step process:
upload the file, then reference it in a comment or description.

### Step 1: Upload the File

```bash
curl -s --noproxy "gitlab.noveogroup.com" \
  --header "PRIVATE-TOKEN: $TOKEN" \
  -F "file=@/path/to/screenshot.png" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/uploads"
```

Response:
```json
{
  "alt": "screenshot",
  "url": "/uploads/<hash>/screenshot.png",
  "full_path": "/noveo-internal-tools/ttt-spring/uploads/<hash>/screenshot.png",
  "markdown": "![screenshot](/uploads/<hash>/screenshot.png)"
}
```

### Step 2: Reference in a Comment

Use the `markdown` value (or the `url` field) directly in the comment body:

```markdown
<details><summary>screen description</summary>

![screenshot](/uploads/<hash>/screenshot.png)

</details>
```

### Complete Example: Upload + Post Comment with Image

```bash
TOKEN="<read from .claude/.mcp.json>"

# Upload
UPLOAD=$(curl -s --noproxy "gitlab.noveogroup.com" \
  --header "PRIVATE-TOKEN: $TOKEN" \
  -F "file=@screenshot.png" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/uploads")

IMG_URL=$(echo "$UPLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

# Build comment body with the uploaded image
BODY=$(cat <<EOFBODY
**QA screenshot:**

<details><summary>evidence</summary>

![screenshot](${IMG_URL})

</details>
EOFBODY
)

# Post the comment
curl -s --noproxy "gitlab.noveogroup.com" \
  --header "PRIVATE-TOKEN: $TOKEN" \
  --header "Content-Type: application/json" \
  -X POST "https://gitlab.noveogroup.com/api/v4/projects/1288/issues/$IID/notes" \
  --data "$(python3 -c "import json,sys; print(json.dumps({'body': sys.stdin.read()}))" <<< "$BODY")"
```

### Important Notes

- The upload endpoint accepts any file type (png, jpg, pdf, etc.)
- Max file size: 10 MB (GitLab default)
- Uploaded files are permanent — they persist even if the referencing comment is deleted
- The returned `url` path is relative to the project — it works in issues, MRs, and wiki pages
- **Blank lines** around `![image]()` inside `<details>` tags are required for GitLab to render the image
- Multiple files can be uploaded in separate calls and referenced in the same comment

---

## 3. Downloading Attachments

Uploaded files (screenshots, images, documents) in issue descriptions or comments are
served through **web routes**, not the API. The PAT does not work for these URLs — they
require a browser session obtained by logging in through the web UI with LDAP credentials.

### Why the API Doesn't Work

On this GitLab version (CE 16.11) at Developer access level, the PAT does not
authenticate web route requests (uploads). The only working method is a headless browser
that signs in via the LDAP form.

### Extract Upload URLs

Parse the issue `description` and all note `body` fields for markdown image references:

```
![alt_text](/uploads/<secret_hash>/<filename>)
```

Build the full URL:
```
https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/uploads/<secret_hash>/<filename>
```

### Download Using the Bundled Script

A ready-made Puppeteer script is bundled at `scripts/download_attachments.mjs`.

**Step 1:** Ensure Puppeteer is installed (one-time, installs to `/tmp`):
```bash
cd /tmp && npm install puppeteer 2>&1 | tail -3
```

**Step 2:** Create a credentials file to avoid shell escaping issues with special
characters in passwords:
```bash
cat > /tmp/gl_creds.json << 'EOF'
{"login": "<username>", "password": "<password>"}
EOF
```

**Step 3:** Run the download script:
```bash
node <skill-path>/scripts/download_attachments.mjs \
  --credentials-file /tmp/gl_creds.json \
  --output "<output-directory>" \
  --urls "<url1>" "<url2>" ...
```

The `--credentials-file` approach is preferred over `--login`/`--password` CLI args
because passwords with special characters (like `!`) can be mangled by shell expansion.

The script will:
1. Launch headless Chrome
2. Navigate to the GitLab sign-in page
3. Fill the LDAP form (uses `#ldapmain_username` / `#ldapmain_password`)
4. Submit and verify login succeeded
5. Download each URL by navigating to it and saving the response buffer
6. Close the browser

**Step 4:** Verify the downloads:
```bash
file <output-directory>/*
```

Each file should report as the expected type (e.g., `PNG image data`). If it says
`HTML document`, the login likely failed — check credentials.

### Manual Fallback (Without the Script)

If Puppeteer is unavailable, write an inline Node.js script. Critical details:

- The sign-in page defaults to the **LDAP** tab
- Username field: `#ldapmain_username` (name: `username`)
- Password field: `#ldapmain_password` (name: `password`)
- Do NOT use `#user_login` / `#user_password` — those are on the Standard tab and
  typing into them will concatenate both values into one field
- Use `waitUntil: 'domcontentloaded'` (not `networkidle0` which can timeout)
- After login, verify `page.url()` does not contain `sign_in`

---

## 4. Pipelines, Branches & Code Changes

Use the REST API to list pipelines, compare branches, and see what files changed.

### List Pipelines

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/pipelines?per_page=10&order_by=id&sort=desc"
```

Key response fields: `id`, `iid`, `sha`, `ref` (branch/tag), `status`, `source`, `created_at`, `web_url`.

**Important:** Do NOT use `scope=all` — this GitLab version rejects it. Omit `scope` entirely.

Filter by branch:
```bash
...pipelines?ref=release/2.1&per_page=10&order_by=id&sort=desc
```

Filter by status: `status=success`, `status=failed`, `status=running`, etc.

### Compare Commits (What Changed Between Pipelines)

To see the code diff between two pipeline runs on the same branch, use the `compare` endpoint
with the `sha` values from each pipeline:

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/repository/compare?from=OLD_SHA&to=NEW_SHA"
```

The response contains:
- `commits[]` — list of commits between the two SHAs (`short_id`, `title`, `author_name`, `created_at`)
- `diffs[]` — list of changed files with fields:
  - `new_path` — file path
  - `new_file` (bool) — added file
  - `deleted_file` (bool) — deleted file
  - `renamed_file` (bool) — renamed file
  - `diff` — unified diff text

### List Branches

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/repository/branches?per_page=20&order_by=updated&sort=desc"
```

### Get a Single Commit

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/repository/commits/COMMIT_SHA"
```

### Workflow: "What changed in the latest pipeline on branch X?"

1. Fetch the 2 most recent pipelines for the branch: `?ref=BRANCH&per_page=2&order_by=id&sort=desc`
2. Extract the `sha` from each pipeline (newer = `to`, older = `from`)
3. Call the compare endpoint with those SHAs
4. Parse the `commits` and `diffs` arrays from the response

---

## 5. CI Operations — Deploy, Migrate, Restart, Rollback

All CI operations are **manual jobs** within existing pipelines. They are triggered by
"playing" the job via the GitLab API. You do NOT create new pipelines — you find the
target pipeline and play the specific manual job within it.

### CI Architecture

**Pipeline stages (in order):**
1. `build` — compile project artifacts
2. `post-build` — generate deployment manifest
3. `merge` — merge release branch to develop
4. `deploy` — deploy to target server (manual)
5. `deploy-doc` — deploy documentation
6. `autotest` — run autotests (manual)
7. `migrate` — DB migration from old MySQL to PostgreSQL (manual)
8. `restart` — restart docker-compose services (manual)

**Branch → Environment mapping:**

| Branch | Available environments |
|---|---|
| `development-ttt` | dev, qa-1, qa-2, timemachine |
| `release/*` (e.g. `release/2.1`) | qa-1, qa-2, timemachine, preprod |
| `stage` | stage |
| `hotfix/*` | qa-1, qa-2, preprod |

**Job naming convention:**
- Deploy: `deploy-<env>`, `deploy-<env>-develop`, `deploy-<env>-release`, `deploy-<env>-hotfix`
- Rollback: `rollback-<env>`, `rollback-<env>-develop`, `rollback-<env>-release`
- Migrate: `migrate-<env>` (e.g. `migrate-qa-1`, `migrate-timemachine`)
- Restart: `restart-<env>` (e.g. `restart-qa-1`, `restart-timemachine`)

### Workflow: Trigger a CI Operation

**Step 1 — Find the target pipeline:**

Identify the correct branch for the target environment, then get the latest
successful pipeline on that branch:

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/pipelines?ref=BRANCH&per_page=1&order_by=id&sort=desc&status=success"
```

Common branch lookups:
- qa-1/qa-2/timemachine from release: `ref=release/2.1`
- qa-1/qa-2/timemachine from develop: `ref=development-ttt`
- stage: `ref=stage`
- preprod from release: `ref=release/2.1`

**Step 2 — List jobs in the pipeline:**

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/pipelines/PIPELINE_ID/jobs?per_page=100"
```

Find the job with the matching `name` (e.g. `deploy-qa-1-release`, `migrate-qa-1`,
`restart-qa-1`). The job must have `status: "manual"` to be playable.

**Step 3 — Play (trigger) the job:**

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  -X POST "https://gitlab.noveogroup.com/api/v4/projects/1288/jobs/JOB_ID/play"
```

The response returns the job object with `status: "pending"` or `status: "running"`.

**Step 4 — Monitor job status:**

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/jobs/JOB_ID"
```

Poll until `status` is `success` or `failed`. Key fields: `status`, `started_at`,
`finished_at`, `duration`, `web_url`.

To read the job log:
```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/jobs/JOB_ID/trace"
```

### What Each Operation Does

| Operation | What it does |
|---|---|
| **deploy** | Pulls latest Docker images for the branch and runs `docker-compose up -d` with all services |
| **rollback** | Deploys using the manifest from the pipeline (specific artifact versions) |
| **migrate** | Stops calendar/vacation/email/ttt services, runs `pgloader` migration from prod-RO DB, restarts services |
| **restart** | Runs `docker-compose restart` on all services |

### Quick Reference: Environment Job Names

**From `development-ttt` pipeline:**
- `deploy-dev`, `deploy-qa-1-develop`, `deploy-qa-2-develop`, `deploy-timemachine-develop`
- `rollback-dev`, `rollback-qa-1-develop`, `rollback-qa-2-develop`, `rollback-timemachine-develop`
- `migrate-dev`, `migrate-qa-1`, `migrate-qa-2`, `migrate-timemachine`
- `restart-dev`, `restart-qa-1`, `restart-qa-2`, `restart-timemachine`

**From `release/2.1` pipeline:**
- `deploy-qa-1-release`, `deploy-qa-2-release`, `deploy-timemachine-release`, `deploy-preprod-release`
- `rollback-qa-1-release`, `rollback-qa-2-release`, `rollback-timemachine-release`, `rollback-preprod-release`
- `migrate-qa-1`, `migrate-qa-2`, `migrate-timemachine`, `migrate-preprod`
- `restart-qa-1`, `restart-qa-2`, `restart-timemachine`, `restart-preprod`

**From `stage` pipeline:**
- `deploy-stage`, `rollback-stage`, `migrate-stage`, `restart-stage`

### Retrying Already-Completed Jobs

To re-run a job that already completed (e.g., re-deploy after rollback testing):

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  -X POST "https://gitlab.noveogroup.com/api/v4/projects/1288/jobs/JOB_ID/retry"
```

**Important:** The retry response returns a **new job object with a new ID**. Use the
new ID for polling — the old job ID will remain in its completed state.

### Service Startup Times After CI Operations

After deploy, rollback, or restart, services need time to start:

| Operation | Job duration | Service startup | Total wait |
|---|---|---|---|
| **deploy** | ~20-30s | ~90s | ~2 min |
| **rollback** | ~20-30s | ~90s | ~2 min |
| **migrate** | ~5 min | ~90s | ~6 min |
| **restart** | ~20s | ~90s | ~2 min |

During startup, API endpoints return **502 Bad Gateway** (nginx) then **503 Service
Unavailable** (Spring Boot loading). Wait ~90 seconds after job success before calling
API endpoints. If still 503, wait another 30s and retry.

### Reading the Deployment Manifest

The `generate-manifest` job creates a `deploy-{PIPELINE_ID}.yml` artifact. To read
the manifest without downloading the artifact, check the job log:

```bash
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/jobs/JOB_ID/trace" | grep -A10 "GENERATED MANIFEST"
```

The manifest lists 7 deployable services with their exact image tags (pipeline IDs):
`discovery`, `gateway`, `frontend-app`, `email-app`, `calendar-app`, `ttt-app`, `vacation-app`.

### Rollback Behavior Notes

- **deploy** uses branch tags (e.g., `release_2.1-2.1.26-SNAPSHOT`) — the rollback test
  endpoint returns `Deployed version: LOCAL`
- **rollback** uses pipeline ID tags from the manifest — the endpoint returns
  `Deployed version: <pipeline_id>` (e.g., `290682`)
- **Same-pipeline rollback is a no-op** — if you rollback to the same pipeline that was
  just deployed via regular deploy, docker-compose detects no image change and does not
  recreate containers. The version endpoint continues showing the previous state.
- To verify rollback, use the test endpoint: `GET /api/ttt/v1/test/rollback` (available
  via Swagger MCP tools: `mcp__swagger-qa1-ttt-test__trigger-rollback-test-using-get`,
  `mcp__swagger-tm-ttt-test__trigger-rollback-test-using-get`)

### Safety Notes

- **Always confirm** with the user before triggering deploy/migrate/rollback operations.
  Restart is lower risk but still confirm.
- **Migrate** is the most impactful — it stops services and runs DB migration from production.
- **Deploy** replaces running containers with new images — the environment will be briefly unavailable.
- After deploy or migrate, consider running **restart** if services don't come up cleanly.
- Check the job log if a job fails to diagnose the issue.

### Polling Pattern for Job Completion

Use this pattern to trigger a job and wait for completion:

```bash
TOKEN="<PAT>"

# Trigger the job
curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
  -X POST "https://gitlab.noveogroup.com/api/v4/projects/1288/jobs/JOB_ID/play"

# Poll until done
for i in $(seq 1 30); do
  STATUS=$(curl -s --noproxy "gitlab.noveogroup.com" --header "PRIVATE-TOKEN: $TOKEN" \
    "https://gitlab.noveogroup.com/api/v4/projects/1288/jobs/JOB_ID" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'])")
  echo "$(date +%H:%M:%S) status: $STATUS"
  if [ "$STATUS" = "success" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; then
    break
  fi
  sleep 10
done
```

Use `sleep 10` for deploy/restart, `sleep 15` for migrate (longer running).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Downloaded file is HTML, not image | Login failed or session expired | Check credentials, verify LDAP selectors |
| Both values in username field | Wrong form tab selectors used | Use `#ldapmain_*` not `#user_*` |
| Navigation timeout | `networkidle0` too strict | Switch to `domcontentloaded` |
| 404 on API endpoint | Wrong project ID | Use `1288` for ttt-spring |
| 302 redirect to sign_in | PAT used on web route | Use Puppeteer method instead |
| `scope does not have a valid value` | Used `scope=all` on pipelines endpoint | Omit `scope` param — only valid for issues |
| Password with `!` or special chars mangled | Shell expansion | Use `--credentials-file` instead of `--password` |
| 502/503 after deploy/rollback | Services still starting | Wait ~90s after job success, then retry |
| Rollback shows "LOCAL" instead of pipeline ID | Same-pipeline rollback (no-op) | Expected when rolling back to the currently deployed pipeline |
| Job retry returns old status | Polling the old job ID | Retry creates a NEW job — use the new ID from the retry response |
| `play` returns 400 "Unplayable Job" | Job already ran or is not manual | Use `retry` endpoint instead of `play` for completed jobs |

---

## Reference Files

- `references/api-reference.md` — Full list of API endpoints, response field mappings, search parameters
- `scripts/download_attachments.mjs` — Puppeteer script for downloading uploads via LDAP auth
