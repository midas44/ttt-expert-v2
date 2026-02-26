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
