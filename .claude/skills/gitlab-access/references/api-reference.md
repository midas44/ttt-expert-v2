# GitLab API Reference

Instance: `gitlab.noveogroup.com` — GitLab Community Edition 16.11.10

API base: `https://gitlab.noveogroup.com/api/v4`

Auth header: `PRIVATE-TOKEN: <token>` (read from `.claude/.mcp.json`)

---

## Endpoints

### Projects

| Operation | Method | Endpoint | Notes |
|---|---|---|---|
| Search projects | GET | `/projects?search=<name>` | Match on `path_with_namespace` |
| Get project | GET | `/projects/:id` | Includes permissions info |

### Issues

| Operation | Method | Endpoint | Notes |
|---|---|---|---|
| Get issue | GET | `/projects/:id/issues/:iid` | `:iid` is the issue number shown in the URL |
| List issue notes | GET | `/projects/:id/issues/:iid/notes?per_page=100` | Comments and system events |
| Create issue note | POST | `/projects/:id/issues/:iid/notes` | Body: `{"body": "markdown text"}` — adds a comment |
| List issue labels | — | Included in issue response | `labels` array field |
| Search issues | GET | `/projects/:id/issues?search=KEYWORD&labels=LABEL&per_page=100&scope=all` | See search params below |

#### Issue Search Parameters

| Parameter | Description | Example |
|---|---|---|
| `search` | Full-text search in title and description | `search=vacation` |
| `labels` | Filter by label (comma-separated, URL-encoded) | `labels=Sprint%2014,Backend` |
| `state` | Filter by state | `state=opened` or `state=closed` |
| `assignee_username` | Filter by assignee | `assignee_username=vulyanov` |
| `scope` | Search scope | `scope=all` (include all issues, not just assigned) |
| `per_page` | Results per page (max 100) | `per_page=100` |
| `page` | Page number for pagination | `page=2` |
| `order_by` | Sort field | `order_by=created_at` or `order_by=updated_at` |
| `sort` | Sort direction | `sort=desc` or `sort=asc` |

### Merge Requests

| Operation | Method | Endpoint | Notes |
|---|---|---|---|
| Get MR | GET | `/projects/:id/merge_requests/:iid` | |
| List MR notes | GET | `/projects/:id/merge_requests/:iid/notes?per_page=100` | |
| List MR changes | GET | `/projects/:id/merge_requests/:iid/changes` | Includes diff |

### Users & Auth

| Operation | Method | Endpoint | Notes |
|---|---|---|---|
| Current user | GET | `/user` | Verify token works |
| PAT info | GET | `/personal_access_tokens/self` | Shows scopes, expiry |
| GitLab version | GET | `/version` | |

### Pipelines & Jobs

| Operation | Method | Endpoint | Notes |
|---|---|---|---|
| List pipelines | GET | `/projects/:id/pipelines?per_page=10&order_by=id&sort=desc` | Do NOT use `scope=all` — rejected by this GitLab version |
| Filter by branch | GET | `/projects/:id/pipelines?ref=BRANCH&per_page=10` | |
| Filter by status | GET | `/projects/:id/pipelines?status=success` | Values: `success`, `failed`, `running`, `pending`, `skipped`, `canceled` |
| Get pipeline | GET | `/projects/:id/pipelines/:pipeline_id` | Full pipeline details |
| List pipeline jobs | GET | `/projects/:id/pipelines/:pipeline_id/jobs?per_page=100` | Returns all jobs in the pipeline |
| Get job | GET | `/projects/:id/jobs/:job_id` | Full job details incl. status |
| Play manual job | POST | `/projects/:id/jobs/:job_id/play` | Triggers a manual job; job must have `status: "manual"` |
| Cancel job | POST | `/projects/:id/jobs/:job_id/cancel` | Cancel a running/pending job |
| Retry job | POST | `/projects/:id/jobs/:job_id/retry` | Retry a failed job |
| Get job log | GET | `/projects/:id/jobs/:job_id/trace` | Returns raw text log output |

### Repository

| Operation | Method | Endpoint | Notes |
|---|---|---|---|
| Compare commits | GET | `/projects/:id/repository/compare?from=SHA1&to=SHA2` | Returns `commits[]` and `diffs[]` with changed files |
| List branches | GET | `/projects/:id/repository/branches?per_page=20&order_by=updated&sort=desc` | |
| Get branch | GET | `/projects/:id/repository/branches/:branch` | URL-encode branch name (e.g. `release%2F2.1`) |
| Get commit | GET | `/projects/:id/repository/commits/:sha` | |
| List commits | GET | `/projects/:id/repository/commits?ref_name=BRANCH&per_page=20` | |

### Other

| Operation | Method | Endpoint | Notes |
|---|---|---|---|
| Render markdown | POST | `/markdown` | Body: `{"text": "...", "project": "namespace/project"}` |
| GraphQL | POST | `/api/graphql` | Body: `{"query": "..."}` |
| Project members | GET | `/projects/:id/members/all` | |

---

## Target Project

This skill is scoped to a single project. Always use project ID `1288`.

| Field | Value |
|---|---|
| Name | Time Tracking Tool (TTT) / Time Reporting Tool |
| Path | `noveo-internal-tools/ttt-spring` |
| ID | `1288` |
| Web URL | https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring |

---

## Issue Response Fields

Key fields returned by `GET /projects/:id/issues/:iid`:

```
title           — string, issue title
description     — string, markdown body (may contain upload refs)
state           — "opened" | "closed"
labels          — string[], label names
assignees       — object[], each has: id, username, name, web_url
author          — object, same fields as assignee
created_at      — ISO timestamp
updated_at      — ISO timestamp
closed_at       — ISO timestamp | null
web_url         — full browser URL to the issue
milestone       — object | null
user_notes_count — int, number of comments
```

## Note Response Fields

Key fields returned by `GET /projects/:id/issues/:iid/notes`:

```
id              — int, note ID
body            — string, markdown content (may contain upload refs)
author          — object with id, username, name
created_at      — ISO timestamp
system          — bool, true for system-generated notes (label changes, etc.)
```

---

## Upload URL Pattern

Uploads in `description` or note `body` appear as:

```markdown
![alt_text](/uploads/<secret_hash>/<filename>)
```

To build the full downloadable URL:

```
https://gitlab.noveogroup.com/<namespace>/<project>/uploads/<secret_hash>/<filename>
```

Example:
- Markdown: `![screenshot](/uploads/6fb7affd82cd01a44240f20961d8fdea/footer_vs_pipeline.png)`
- Full URL: `https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/uploads/6fb7affd82cd01a44240f20961d8fdea/footer_vs_pipeline.png`

These URLs require web session auth — see the main SKILL.md for download instructions.

---

## Job Response Fields

Key fields returned by `GET /projects/:id/jobs/:job_id` or in pipeline jobs list:

```
id              — int, unique job ID (used in play/cancel/retry/trace endpoints)
name            — string, job name (e.g. "deploy-qa-1-release", "migrate-qa-1")
stage           — string, pipeline stage (e.g. "deploy", "migrate", "restart")
status          — string, one of: "manual", "pending", "running", "success", "failed", "canceled", "skipped"
started_at      — ISO timestamp | null
finished_at     — ISO timestamp | null
duration        — float | null, seconds
web_url         — full browser URL to the job page
runner          — object | null, runner that executed the job
pipeline        — object with id, ref, sha, status
```

## CI Environment Mapping

| Environment | Pipeline branch | Deploy job name | Migrate job | Restart job |
|---|---|---|---|---|
| dev | `development-ttt` | `deploy-dev` | `migrate-dev` | `restart-dev` |
| qa-1 | `development-ttt` | `deploy-qa-1-develop` | `migrate-qa-1` | `restart-qa-1` |
| qa-1 | `release/*` | `deploy-qa-1-release` | `migrate-qa-1` | `restart-qa-1` |
| qa-2 | `development-ttt` | `deploy-qa-2-develop` | `migrate-qa-2` | `restart-qa-2` |
| qa-2 | `release/*` | `deploy-qa-2-release` | `migrate-qa-2` | `restart-qa-2` |
| timemachine | `development-ttt` | `deploy-timemachine-develop` | `migrate-timemachine` | `restart-timemachine` |
| timemachine | `release/*` | `deploy-timemachine-release` | `migrate-timemachine` | `restart-timemachine` |
| preprod | `release/*` | `deploy-preprod-release` | `migrate-preprod` | `restart-preprod` |
| stage | `stage` | `deploy-stage` | `migrate-stage` | `restart-stage` |
