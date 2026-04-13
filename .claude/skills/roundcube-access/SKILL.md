---
name: roundcube-access
description: >
  Access the Roundcube Webmail test mailbox at dev.noveogroup.com/mail — login, count,
  list, search (by sender, subject, body, date, flags, headers), paginate, and read full
  message bodies from the shared QA mailbox that TTT sends notification emails to.
  Use this skill when the user asks to "check emails", "read inbox", "search emails",
  "find the notification email", "verify the TTT email was sent", "look at what arrived
  in the mailbox", "check vulyanov's mailbox", "Roundcube", "webmail", "test email",
  "email notifications", "find email from timereporting", or any task involving the
  QA email service that Roundcube presents as UI. Also use when the user mentions
  "inbox", "IMAP", "mailbox", "unread emails", wants to verify that TTT dispatched a
  specific notification, or pastes the URL dev.noveogroup.com/mail. Works via IMAPS
  (no Roundcube UI automation) — fast, supports pagination and IMAP SEARCH criteria.
---

# Roundcube / Dovecot Test Mailbox Access

The QA environment's test email service is **Dovecot** + **Roundcube Webmail** at
`https://dev.noveogroup.com/mail`. TTT sends notification emails here during tests.
This skill reads the mailbox directly over **IMAPS (port 993)** — much faster and
more reliable than UI automation, with full IMAP SEARCH power.

| Field | Value |
|---|---|
| Webmail URL | https://dev.noveogroup.com/mail/ |
| IMAP host | `dev.noveogroup.com` (resolves to `10.0.5.103` on VPN) |
| IMAP port | `993` (IMAPS, implicit TLS) |
| Mailbox owner | `vulyanov@office.local` |
| Roundcube version | `1.6.1` |
| Server software | Dovecot (Ubuntu) |
| Access mode | **read-only** (script uses `SELECT ... readonly=True`) |
| VPN | **required** — same corporate VPN as all TTT envs |

## Prerequisites

- Corporate VPN must be connected (same one used for `ttt-qa-1`, GitLab, etc.)
- Python 3 with `PyYAML` — already present on this workstation
- No MCP server, no external dependencies

## Configuration

Credentials and host come from two YAML files — the script loads them automatically:

- `config/roundcube/roundcube.yaml` — project-wide: `appUrl`, `env` (which env file to load)
- `config/roundcube/envs/<env>.yaml` — per-user: `username`, `password`

Hostname is derived from `appUrl`. To add a second user, create another file under
`envs/` and flip `env:` in `roundcube.yaml`.

## CLI

Single self-contained script, no external runtime:

```
.claude/skills/roundcube-access/scripts/roundcube_imap.py
```

Always from the repo root. Pass `--pretty` before the subcommand for human-readable
output; JSON is the default (parseable for agents).

### Subcommands

| Command | Purpose |
|---|---|
| `mailboxes` | List folders (INBOX, Sent, Trash, Junk, Drafts, …) |
| `count` | Total / unseen / recent message counts for a mailbox |
| `list` | Newest-first page of messages from a mailbox |
| `search` | IMAP SEARCH with many criteria, paginated, newest-first |
| `read <uid>` | Full message by UID — headers, text body, HTML (opt), attachments metadata |
| `save` | Save raw `.eml` files (RFC 822) for one or more messages — by UID list or search criteria |

### Global options

| Option | Description |
|---|---|
| `--config-dir PATH` | Override config dir (default: `config/roundcube`) |
| `--pretty` | Human-readable output (default is JSON) |

Subcommand options are positional after the subcommand:

| Option | Default | Applies to |
|---|---|---|
| `-m, --mailbox NAME` | `INBOX` | count, list, search, read |
| `-n, --limit N` | `20` | list, search |
| `-o, --offset N` | `0` | list, search (offset into newest-first results) |
| `--include-html` | off | read (include HTML body in output) |

### Search criteria

All criteria AND together. Use them inside `search`:

| Option | IMAP keyword | Example |
|---|---|---|
| `--from STR` | `FROM` | `--from "timereporting"` |
| `--to STR` | `TO` | `--to "Daria.Smolyakova"` |
| `--cc STR` | `CC` | |
| `--subject STR` | `SUBJECT` | `--subject "QA1"` or `--subject "отпуск"` |
| `--body STR` | `BODY` | `--body "vacation was approved"` (slower — body scan) |
| `--text STR` | `TEXT` | `--text "keyword"` (slowest — full message) |
| `--since DD-Mmm-YYYY` | `SINCE` | `--since 01-Apr-2026` |
| `--before DD-Mmm-YYYY` | `BEFORE` | `--before 13-Apr-2026` |
| `--on DD-Mmm-YYYY` | `ON` | `--on 13-Apr-2026` |
| `--unseen` | `UNSEEN` | unread only |
| `--seen` | `SEEN` | already-read only |
| `--flagged` | `FLAGGED` | starred |
| `--answered` | `ANSWERED` | replied-to |
| `--larger N` | `LARGER` | size > N bytes |
| `--smaller N` | `SMALLER` | size < N bytes |
| `--header "Name: value"` | `HEADER` | repeatable; e.g. `--header "X-Mailer: foo"` |

Cyrillic (and any non-ASCII) works — the script auto-adds `CHARSET UTF-8` and
encodes strings to bytes before sending.

## Common workflows

### 1. "How many unread emails are there?"

```bash
python3 .claude/skills/roundcube-access/scripts/roundcube_imap.py --pretty count
```

Returns `{total, unseen, recent}` for INBOX.

### 2. "Show me the last 10 emails"

```bash
python3 .claude/skills/roundcube-access/scripts/roundcube_imap.py --pretty list -n 10
```

### 3. Paginate through inbox

Offsets are zero-based into the newest-first stream.

```bash
# page 1 (newest 20)
... list -n 20 -o 0

# page 2
... list -n 20 -o 20

# page 3
... list -n 20 -o 40
```

### 4. "Did TTT send the vacation-removed email for QA-1 today?"

```bash
python3 .claude/skills/roundcube-access/scripts/roundcube_imap.py --pretty search \
  --from "timereporting" \
  --subject "QA1" \
  --since 13-Apr-2026 \
  -n 5
```

### 5. Find by Cyrillic subject

```bash
python3 .claude/skills/roundcube-access/scripts/roundcube_imap.py --pretty search \
  --subject "отпуск" \
  --since 01-Apr-2026 \
  -n 10
```

### 6. Read the body of a specific email

```bash
# UID from a prior list/search output
python3 .claude/skills/roundcube-access/scripts/roundcube_imap.py --pretty read 607029
```

Add `--include-html` to also dump the HTML body (TTT emails are HTML-only).

### 7. Machine-readable JSON (for agents piping into jq)

Drop `--pretty`:

```bash
python3 .claude/skills/roundcube-access/scripts/roundcube_imap.py search \
  --from "timereporting" --since 13-Apr-2026 -n 5 | jq '.items[] | .subject'
```

### 8. Search a different folder

```bash
... list -m Sent -n 10
... search -m Trash --subject "test" -n 20
```

### 9. Save emails as `.eml` artifacts (for test evidence)

`.eml` is the canonical, lossless email format — preserves all headers, MIME
structure, inline images, attachments, and raw encoding. Openable in any mail
client (Thunderbird, Apple Mail, `less`, etc.).

Default output dir: `artifacts/roundcube/`. Default filename:
`{uid}-{slug}.eml` where `slug` is the local part of the `To:` address
(falling back to a subject slug, then to just the UID).

**By explicit UIDs** — useful when you already have UIDs from a prior `list` or
`search` run:

```bash
... save 606889 606887
# -> artifacts/roundcube/606889-Pavel.Weinmeister.eml
#    artifacts/roundcube/606887-Pavel.Nikonorov.eml
```

**By search criteria** — grabs all matching messages (up to `-n`, newest first):

```bash
... save --from timereporting --subject "QA1" --since 13-Apr-2026 -n 20
```

**Custom output directory**:

```bash
... save 606889 606887 -d artifacts/roundcube/ticket-3404
```

**Custom filename** (single UID only):

```bash
... save 606889 --name digest-evidence.eml
```

**Idempotent re-runs**:

```bash
... save --from timereporting --since 13-Apr-2026 -n 100 --skip-existing
```

With `--skip-existing`, already-saved files aren't re-fetched — safe to re-run
the same command as new emails arrive.

Search-mode flags available inside `save`: `--from`, `--to`, `--cc`, `--subject`,
`--body`, `--text`, `--since`, `--before`, `--on`, `--unseen`, `--seen`,
`--flagged`, `--answered`, `--larger`, `--smaller`, `--header`, `-m`, `-n`.

## Output format (JSON)

### `list` / `search`

```json
{
  "mailbox": "INBOX",
  "total": 141789,
  "offset": 0,
  "limit": 20,
  "criteria": ["FROM", "\"timereporting\""],
  "items": [
    {
      "uid": 607029,
      "seq": 141789,
      "internal_date": "13-Apr-2026 06:58:52 +0000",
      "size": 19517,
      "flags": ["\\Seen"],
      "subject": "[PREPROD][TTT] Заявки на переносы выходных в 2027 году были удалены",
      "from": "timereporting@noveogroup.com",
      "to": "Daria.Smolyakova@noveogroup.com",
      "cc": null,
      "date": "Mon, 13 Apr 2026 07:01:00 +0000 (GMT)",
      "message_id": "<...@mail.noveogroup.com>"
    }
  ]
}
```

`criteria` is only present on `search`. `seq` is the sequence number (1..total), `uid`
is the server UID (stable across sessions — use this for `read`).

### `read`

```json
{
  "uid": 607029,
  "size": 19517,
  "internal_date": "...",
  "flags": ["\\Seen"],
  "subject": "...", "from": "...", "to": "...", "cc": "...",
  "date": "...", "message_id": "...",
  "text": "plain text body (may be empty if email is HTML-only)",
  "html": "HTML body (only if --include-html)",
  "attachments": [
    {"filename": "foo.pdf", "content_type": "application/pdf", "size": 12345}
  ]
}
```

Most TTT notifications are **HTML-only** — `text` will be empty. Pass `--include-html`.

## IMAP SEARCH speed notes

| Criterion | Speed |
|---|---|
| `FROM`, `TO`, `CC`, `SUBJECT`, `HEADER` | Fast — header-indexed |
| `SINCE`, `BEFORE`, `ON`, `UNSEEN`, `SEEN`, `FLAGGED` | Fast — server state |
| `LARGER`, `SMALLER` | Fast |
| `BODY` | Slow — linear body scan |
| `TEXT` | Slowest — headers + body scan |

The mailbox holds **140k+ messages**. Always combine slow criteria with a cheap one
(e.g. `--body "..." --since 01-Apr-2026`) to narrow the result set first.

## Date format

IMAP date grammar is strict: `DD-Mmm-YYYY` with an English 3-letter month.
Examples: `01-Apr-2026`, `31-Dec-2025`. Do **not** use ISO `2026-04-13`.

## UID vs sequence number

- **UID** — stable, server-assigned ID. Use it for `read`, referencing between sessions,
  or any place a message identity matters. `list`/`search` output includes `uid`.
- **seq** — 1-based index within current `SELECT`. Used internally for fast
  newest-first paging. Do not persist.

## Why not a browser + Roundcube UI?

A Playwright-based UI path was evaluated and rejected:
- UI navigation of a 140k-message list is slow and paginates 40 at a time in the UI
- The Roundcube search box is less expressive than IMAP SEARCH (no raw `HEADER`, `LARGER`, etc.)
- UI markup can shift between Roundcube versions
- The same mailbox is accessible over IMAP with zero UI overhead

If a future task genuinely needs the Roundcube UI behaviour (rendering bug, inline
reply editor, etc.), fall back to `playwright-browser` skill and use the form
`#rcmloginuser` / `#rcmloginpwd` / `button#rcmloginsubmit` on
`https://dev.noveogroup.com/mail/`.

## Why not an IMAP MCP server?

Several open-source IMAP MCP servers exist (`email-mcp`, `imap-mcp-server`, etc.).
They were rejected because:
- Dovecot on this host needs an IPv4-only socket workaround (Python `getaddrinfo`
  returns an error for `AF_UNSPEC` but succeeds for `AF_INET`). The bundled script
  handles this; a third-party MCP would need patching.
- One extra MCP to install, register, and maintain for a small scope.
- No third-party MCP is Roundcube-aware — they're all generic IMAP, same as this script.

If the scope grows (SMTP sending, multi-account, labels/flags mutations), reconsider
pulling in `email-mcp` and configuring its server-hostname override.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `gaierror: No address associated with hostname` | Not on corporate VPN, or IPv6 default lookup | Connect VPN; the script already forces IPv4. |
| `SSLCertVerificationError: IP address mismatch` | Connected by raw IP instead of hostname | Use hostname `dev.noveogroup.com` (default in config). |
| `LOGIN failed` | Wrong credentials or account locked | Verify `config/roundcube/envs/<env>.yaml`; try logging into the Roundcube UI once to confirm. |
| `SEARCH failed: BAD` with Cyrillic criterion | Server rejected charset | Confirm the mailbox speaks UTF-8; usually it does. |
| Empty `text` body | Email is HTML-only | Use `--include-html` or read HTML from the JSON `html` field. |
| Long runtime on `--body "..."` | Body scan across 140k messages | Add `--since` / `--from` to reduce candidate set first. |
| `ERROR: PyYAML required` | PyYAML missing | `python3 -m pip install pyyaml` (preinstalled on this box). |

## Files

- `scripts/roundcube_imap.py` — the CLI. Self-contained, no external deps beyond PyYAML + stdlib.
- `references/search-cheatsheet.md` — terse IMAP SEARCH crib sheet.

## Quick reference

```bash
ROOT=/home/v/Dev/ttt-expert-v2
SCRIPT="python3 $ROOT/.claude/skills/roundcube-access/scripts/roundcube_imap.py"

$SCRIPT --pretty mailboxes
$SCRIPT --pretty count
$SCRIPT --pretty list -n 20
$SCRIPT --pretty list -n 20 -o 20
$SCRIPT --pretty search --from timereporting --subject QA1 --since 01-Apr-2026 -n 10
$SCRIPT --pretty search --unseen -n 10
$SCRIPT --pretty search --subject "отпуск" -n 5
$SCRIPT --pretty read 607029 --include-html
$SCRIPT --pretty save 606889 606887
$SCRIPT --pretty save --from timereporting --since 13-Apr-2026 -n 20 -d artifacts/roundcube/ticket-3404
```
