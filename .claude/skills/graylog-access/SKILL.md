---
name: graylog-access
description: >
  Access the Graylog log-aggregation service at logs.noveogroup.com — login,
  list streams, select the per-environment stream (TTT-QA-1, TTT-QA-2,
  TTT-TIMEMACHINE, TTT-PREPROD, TTT-STAGE, TTT-DEV), count, search, tail, and
  download logs to artifacts/graylog/ with informative filenames. Use this
  skill whenever the user mentions "Graylog", "graylog", "logs.noveogroup",
  "check the logs", "look at the server log", "TTT-QA-1 log stream", "what did
  the backend log when", "download logs from stage", "tail logs", "search the
  log for ERROR", "did we see an exception in timemachine logs", or any task
  that requires inspecting backend/application logs from the TTT deployment.
  Also use when the user pastes a URL under https://logs.noveogroup.com/ or
  references a stream by name like "TTT-STAGE". Works via Graylog's REST API
  (session auth → HTTP Basic), no UI automation, fast, supports pagination,
  rich Graylog query-language search, and JSON / NDJSON / text / CSV output.
---

# Graylog Log Access

**Scope:**
- TTT: full
- CS:  N/A (CS has no Graylog stream)
- PMT: N/A (PMT has no Graylog stream)


The corporate Graylog instance at `https://logs.noveogroup.com/` aggregates
logs from every TTT backend environment. Each environment has its own
**stream** (a named server-side filter). This skill talks to Graylog over its
REST API — much faster than scraping the Web UI and backed by Graylog's own
query language.

| Field | Value |
|---|---|
| Web UI | https://logs.noveogroup.com/ |
| REST base | `https://logs.noveogroup.com/api` |
| Auth precedence | **API token** (Basic `<token>:token`) → session token → HTTP Basic |
| Account | `vulyanov` (corporate domain), API token generated for the CLI |
| Streams | `TTT-QA-1`, `TTT-QA-2`, `TTT-TIMEMACHINE`, `TTT-PREPROD`, `TTT-STAGE`, `TTT-DEV` |
| VPN | **required** — same corporate VPN as all TTT envs |
| TLS | Server drops TLS 1.3 handshakes; client caps at TLS 1.2 automatically |
| Proxy | HTTP/S proxy (Throne) bypassed automatically — VPN reaches host directly |
| Access mode | Read-only for search/tail/download; session endpoint is write-only POST |

## Prerequisites

- Corporate VPN must be connected (same one used for `ttt-qa-1`, GitLab, etc.)
- Python 3 with `PyYAML` — already present on this workstation
- No MCP server, no external dependencies beyond stdlib

## Configuration

Credentials and host come from three YAML files — the script loads them automatically:

- `config/graylog/graylog.yaml` — project-wide: `appUrl`, `env` (which env file to load)
- `config/graylog/envs/<env>.yaml` — per-user: `username`, `password`, `token` (the
  last two can be `[secret]` placeholders that resolve to `secret.yaml`)
- `config/graylog/envs/secret.yaml` — **gitignored**. Prefer a YAML map:

  ```yaml
  password: <corporate-domain-password>
  token: <graylog-api-token>
  ```

  A bare scalar (just the password on one line) is still accepted for backwards
  compatibility with the old single-secret shape.

The script prefers **Graylog API token** auth (Basic `<token>:token`) because
tokens are independent of the corporate LDAP/AD backend — they keep working
even when `/api/system/sessions` returns `503 Authentication service
unavailable`. If no token is configured, it falls back to session-token auth,
and if the session endpoint is down it falls back to direct HTTP Basic with
username + password.

Generate a new API token in the Web UI: top-right user menu → **Edit tokens**
→ create one with a clear name (e.g. `ttt-expert-cli`). Paste the token into
`secret.yaml`. Tokens can be revoked from the same UI without changing the
password.

To add a second user, create another file under `envs/`, put that user's
secrets into `envs/secret.yaml` (or keep per-env secret files), and flip
`env:` in `graylog.yaml`.

## CLI

Single self-contained script:

```
.claude/skills/graylog-access/scripts/graylog_api.py
```

Always run from the repo root. `--pretty` is a **global** flag — it must come
**before** the subcommand.

### Subcommands

| Command | Purpose |
|---|---|
| `streams` | List Graylog streams (optionally filter by name substring) |
| `count` | Total matching messages for a query + time range (lightweight: limit=1) |
| `search` | Search messages with a Graylog query over a time range |
| `tail` | Newest messages in a stream (sort=timestamp:desc, default range 5m) |
| `download` | Run a search and write results to `artifacts/graylog/<filename>` |

### Global options

| Option | Description |
|---|---|
| `--config-dir PATH` | Override config dir (default: `config/graylog`) |
| `--pretty` | Human-readable output (default is JSON) |

### Search / tail / count / download options

| Option | Default | Meaning |
|---|---|---|
| `-s, --stream NAME\|ID` | — | Stream by title (e.g. `TTT-QA-1`, case-insensitive) or 24-hex ID |
| `--query STR` | `*` | Graylog query-language expression |
| `--range VALUE` | — | Relative range: `300` / `5m` / `2h` / `1d` → `/relative` endpoint |
| `--since VALUE` | — | Absolute start: ISO `2026-04-13T10:00` or relative `1h`; flips to `/absolute` |
| `--until VALUE` | `now` | Absolute end (only used with `--since`) |
| `-n, --limit N` | `100` | Max messages |
| `-o, --offset N` | `0` | Pagination offset |
| `--field NAME` | — | Include only these fields (repeatable) |
| `--sort FIELD:ORDER` | — | e.g. `timestamp:desc`, `timestamp:asc` |

### Download-only options

| Option | Default | Meaning |
|---|---|---|
| `-d, --output-dir PATH` | `artifacts/graylog` | Output directory |
| `--format FMT` | `json` | `json` / `ndjson` / `text` / `csv` |
| `--name FILENAME` | auto | Override generated filename (single run) |

### Time-range rules

- Pass `--range` **or** `--since`/`--until`, not both.
- If neither is passed, the default is `range=5m`.
- Accepted relative formats: `300s`, `5m`, `2h`, `1d`, `1w`, or bare digits (seconds).
- Accepted absolute formats (all UTC): `2026-04-13`, `2026-04-13T10:00`,
  `2026-04-13T10:00:00`, `2026-04-13T10:00:00.000Z`.

## Common workflows

### 1. List streams (find the one for your env)

```bash
python3 .claude/skills/graylog-access/scripts/graylog_api.py --pretty streams
```

Returns all streams with IDs + titles. Six TTT environments are configured:
`TTT-QA-1`, `TTT-QA-2`, `TTT-TIMEMACHINE`, `TTT-PREPROD`, `TTT-STAGE`, `TTT-DEV`.

Filter by substring:

```bash
... streams --name qa
```

### 2. How many messages arrived on TTT-QA-1 in the last 10 minutes?

```bash
... --pretty count --stream TTT-QA-1 --range 10m
```

Prints `total`, the time window Graylog resolved, and query latency.

### 3. Tail (latest N log lines) — equivalent to "load log" / "refresh"

```bash
... --pretty tail --stream TTT-TIMEMACHINE -n 50
```

Default range is 5 minutes; pass `--range` to widen it.

### 4. Search the log by keyword, level, or field

Graylog uses Lucene-ish query syntax (see `references/query-cheatsheet.md`).

```bash
# Errors/warnings in the last hour
... --pretty search --stream TTT-QA-1 --query "level:3 OR level:4" --range 1h -n 50

# Messages containing a specific phrase
... --pretty search --stream TTT-STAGE --query 'message:"NullPointerException"' --range 6h

# Exact field match
... --pretty search --stream TTT-PREPROD --query 'source:"ttt-preprod.noveogroup.com"' --range 15m
```

### 5. Search over an absolute time window

```bash
... search --stream TTT-QA-1 \
  --since 2026-04-13T10:00 \
  --until 2026-04-13T10:30 \
  --query '*' -n 500
```

### 6. Paginate

Offsets are zero-based.

```bash
# page 1 (newest 100)
... tail --stream TTT-QA-1 -n 100 -o 0

# page 2
... tail --stream TTT-QA-1 -n 100 -o 100

# page 3
... tail --stream TTT-QA-1 -n 100 -o 200
```

### 7. Download logs to `artifacts/graylog/` — four formats

`.json` — full search response (pretty-printed):

```bash
... download --stream TTT-QA-1 --range 10m -n 500 --format json
# → artifacts/graylog/ttt-qa-1_last-600s_20260413T113624Z_<hash>.json
```

`.ndjson` — one JSON message per line (convenient for `jq` / `grep`):

```bash
... download --stream TTT-QA-1 --range 10m -n 500 --format ndjson
```

`.log` — plaintext, one line per message (`timestamp source [level] message`):

```bash
... download --stream TTT-STAGE --query "ERROR" --range 1h -n 200 --format text
```

`.csv` — Graylog's native CSV export (quoted fields, header row). When no
`--field` is passed, the script auto-seeds `timestamp,source,level,message`
because Graylog rejects an empty field list for CSV export:

```bash
... download --stream TTT-TIMEMACHINE --query "NullPointerException" --range 24h -n 1000 --format csv
```

### 8. Filename conventions

Auto-generated filename layout (all lowercase, `_` separated):

```
{stream-slug}_{window}_[q-{query-slug}_]{timestamp-UTC}_{hash6}.{ext}
```

| Segment | Example | Notes |
|---|---|---|
| `{stream-slug}` | `ttt-qa-1` | Exact stream title, slugified |
| `{window}` | `last-600s` OR `20260413T100000Z_20260413T103000Z` | Relative range OR absolute from..to |
| `q-{slug}` | `q-ERROR` | Only present when `--query` != `*` |
| `{timestamp}` | `20260413T113624Z` | Run-time UTC, distinguishes re-runs |
| `{hash6}` | `bd8524` | SHA1 prefix of args — uniquifies concurrent runs |

Override with `--name my-custom.json`. Write into a sub-directory with `-d`:

```bash
... download --stream TTT-STAGE --range 1h --format csv \
    -d artifacts/graylog/ticket-3404
```

### 9. Machine-readable JSON (for agents / jq)

Drop `--pretty`:

```bash
... tail --stream TTT-QA-1 -n 20 | jq '.messages[] | {ts: .timestamp, msg: .message}'
```

### 10. Filter returned fields (smaller payload, faster parse)

```bash
... search --stream TTT-QA-1 --range 1h \
    --field timestamp --field source --field level --field message -n 200
```

## Output format (JSON)

### `streams`

```json
{
  "total": 6,
  "items": [
    {"id": "63896d4bfe3c6d193d5ff2ac", "title": "TTT-QA-1",
     "description": "...", "disabled": false, "is_default": false,
     "index_set_id": "...", "rules": 1},
    ...
  ]
}
```

### `count`

```json
{
  "stream": "TTT-QA-1",
  "query": "*",
  "total": 30,
  "from": "2026-04-13T11:31:14.695Z",
  "to":   "2026-04-13T11:36:14.695Z",
  "duration_ms": 2145
}
```

### `search` / `tail`

```json
{
  "stream": "TTT-QA-1",
  "query": "*",
  "total": 2109,
  "returned": 50,
  "from": "2026-04-13T11:26:41.151Z",
  "to":   "2026-04-13T11:36:41.151Z",
  "duration_ms": 2150,
  "messages": [
    {
      "_id": "...",
      "timestamp": "2026-04-13T11:36:40.005Z",
      "source": "ttt-qa-1.noveogroup.com",
      "level": 6,
      "message": "sendEmails: finished, sent 0 emails",
      "facility": "...", "service_name": "...", "streams": [...]
    }
  ]
}
```

(`tail` uses `window_from`/`window_to` instead of `from`/`to`, and omits `total`.)

### `download`

```json
{
  "stream": "TTT-QA-1",
  "query": "*",
  "format": "json",
  "path": "/home/v/Dev/ttt-expert-v2/artifacts/graylog/ttt-qa-1_last-600s_...",
  "size": 54337,
  "total": 2109,
  "returned": 50
}
```

## Stream quick-reference (TTT environments)

| Env | Stream title | Typical `source` |
|---|---|---|
| QA-1 (primary dev) | `TTT-QA-1` | `ttt-qa-1.noveogroup.com` |
| QA-2 (secondary dev) | `TTT-QA-2` | `ttt-qa-2.noveogroup.com` |
| Timemachine (test-clock env) | `TTT-TIMEMACHINE` | `ttt-timemachine.noveogroup.com` |
| Pre-prod | `TTT-PREPROD` | `ttt-preprod.noveogroup.com` |
| Stage (prod baseline) | `TTT-STAGE` | `ttt-stage.noveogroup.com` |
| Dev (backend sandbox) | `TTT-DEV` | — |

Log **level** follows syslog severity: `3` = ERROR, `4` = WARN, `6` = INFO, `7` = DEBUG.

## Why not a browser + Graylog Web UI?

A Playwright-based UI path was considered and rejected:

- The Web UI paginates 50 entries at a time and renders slowly for larger windows.
- Graylog's query-bar accepts the same Lucene-ish syntax we send over REST —
  nothing is lost.
- Response JSON from `/api/search/universal/*` is exactly what the UI renders,
  minus a few CSS layers.
- UI markup can shift between Graylog versions; REST is stable since 4.x.

Fallback: if a future task needs the Web UI (rendering bug, saved-search UI,
dashboards, widgets), use `playwright-browser` and log in via
`https://logs.noveogroup.com/` with the same credentials.

## Why not the Graylog MCP server / third-party IMAP-style MCPs?

- **Graylog's built-in MCP** (`Tools > MCP Server` in the admin UI, shipped in
  Graylog 6.x) is an experimental beta and has to be enabled on the server
  side — our corporate Graylog has it off.
- Third-party MCPs like `lcaliani/graylog-mcp` wrap the same REST endpoints
  this script hits, and would still need the same VPN / IPv4-only / TLS-1.2-cap
  / proxy-bypass workarounds we already have here.
- One extra MCP to install, register, and maintain for a small scope.

If the scope grows (alerts, notifications-config, extractors, pipelines),
reconsider enabling the server-side MCP or pulling in a community one.

## Edge cases the script already handles

1. **Proxy bypass** — `HTTPS_PROXY=http://127.0.0.1:2080` (Throne) intercepts
   the TLS handshake with this host. The script builds a urllib opener with
   an empty `ProxyHandler({})` to route around it. Do **not** use
   `urlopen(context=...)` — it silently discards installed proxy handlers.
2. **IPv4-only DNS** — corporate VPN returns an error for `AF_UNSPEC` lookups
   but resolves cleanly for `AF_INET`. The script monkey-patches
   `socket.getaddrinfo` to force IPv4, same as `roundcube-access`.
3. **TLS-1.2 cap** — the nginx frontend in front of Graylog drops TLS 1.3
   handshakes (connection reset by peer). The script caps
   `ctx.maximum_version = ssl.TLSVersion.TLSv1_2`.
4. **Password placeholder** — YAML parses the unquoted `[secret]` as a
   **list**, not the literal string. The loader treats any non-string password
   value as a pointer to `envs/secret.yaml`.
5. **CSV requires fields** — Graylog's universal-search CSV export rejects an
   empty `fields` list. The script auto-seeds
   `timestamp,source,level,message` when `--format csv` is passed without
   `--field` args.
6. **Auth fallback chain** — access token (preferred, independent of LDAP) →
   session token → direct HTTP Basic. Each step only runs if the previous
   failed or wasn't configured. The auth backend behind `/api/system/sessions`
   is sometimes flaky (503 "Authentication service unavailable"); having a
   token configured means the skill keeps working through those windows.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Network error: [Errno 104] Connection reset by peer` | Proxy intercepting TLS, or TLS 1.3 | Already handled — if you still see this, confirm VPN is up. |
| `Session auth failed: HTTP 503 Authentication service unavailable` | Corporate LDAP/AD backend paused | Retry in a few seconds — the service recovers on its own. Fallback Basic auth kicks in automatically. |
| `HTTP 401 Unauthorized for GET /api/streams` | Wrong password, or session not created + Basic fallback rejected | Check `config/graylog/envs/secret.yaml`; confirm you can log in to the Web UI with the same creds. |
| `HTTP 400 Bad Request ... arg6 ... invalidValue = null` on CSV | `--format csv` without `--field` on an old Graylog | Already handled — script seeds defaults. Pass `--field` explicitly if you want other columns. |
| `Stream not found` | Typo or case mismatch | `streams` subcommand lists the exact titles; matching is case-insensitive on exact title or unambiguous substring. |
| `No address associated with hostname` | Not on VPN, or IPv6 lookup | Connect VPN; IPv4 patch is already in place. |
| `ERROR: PyYAML required` | PyYAML missing | `python3 -m pip install pyyaml`. |

## Files

- `scripts/graylog_api.py` — the CLI. Self-contained, stdlib + PyYAML.
- `references/query-cheatsheet.md` — terse Graylog query-language crib sheet.

## Quick reference

```bash
ROOT=/home/v/Dev/ttt-expert-v2
SCRIPT="python3 $ROOT/.claude/skills/graylog-access/scripts/graylog_api.py"

$SCRIPT --pretty streams
$SCRIPT --pretty streams --name qa
$SCRIPT --pretty count   --stream TTT-QA-1 --range 10m
$SCRIPT --pretty tail    --stream TTT-QA-1 -n 50
$SCRIPT --pretty search  --stream TTT-STAGE --query "level:3" --range 1h -n 200
$SCRIPT --pretty search  --stream TTT-QA-1 --since 2026-04-13T10:00 --until 2026-04-13T10:30
$SCRIPT --pretty download --stream TTT-QA-1 --range 10m --format json
$SCRIPT --pretty download --stream TTT-TIMEMACHINE --query ERROR --range 1h --format text
$SCRIPT --pretty download --stream TTT-STAGE --query "\"OutOfMemoryError\"" --range 24h --format csv
$SCRIPT         tail --stream TTT-QA-1 -n 10 | jq '.messages[] | .message'
```
