# IMAP SEARCH cheatsheet (Dovecot)

CLI flags map to these IMAP keywords:

## Header matches (fast, case-insensitive substring)
- `--from STR` → `FROM "STR"`
- `--to STR` → `TO "STR"`
- `--cc STR` → `CC "STR"`
- `--subject STR` → `SUBJECT "STR"`
- `--header "Name: val"` → `HEADER Name "val"` (repeatable — AND across headers)

## Body / full-text (slow)
- `--body STR` → `BODY "STR"` — message body only
- `--text STR` → `TEXT "STR"` — headers + body

## Dates (format: DD-Mmm-YYYY, e.g. 01-Apr-2026)
- `--since DATE` → `SINCE DATE` (INTERNALDATE ≥ DATE)
- `--before DATE` → `BEFORE DATE` (INTERNALDATE < DATE)
- `--on DATE` → `ON DATE` (INTERNALDATE = DATE)

## Flags / state
- `--unseen` → `UNSEEN`
- `--seen` → `SEEN`
- `--flagged` → `FLAGGED` (starred)
- `--answered` → `ANSWERED` (replied)

## Size
- `--larger N` → `LARGER N` (bytes)
- `--smaller N` → `SMALLER N` (bytes)

## Combining
All flags combine with implicit AND. If nothing is passed, the criterion is `ALL`.
There is no built-in OR / NOT from the CLI — if you need them, call the script as a
library from Python, or add a new `--raw` passthrough.

## Non-ASCII
Auto-detected. Script inserts `CHARSET UTF-8` and sends bytes.

## Useful combos for TTT QA

| Goal | Command |
|---|---|
| TTT emails in the last 24h | `--from timereporting --since 12-Apr-2026` |
| Unread from TTT | `--from timereporting --unseen` |
| Vacation-related (Cyrillic subject) | `--subject "отпуск"` |
| Emails about day-off carryover (Cyrillic) | `--subject "перенос"` |
| Delayed notifications (Cyrillic body keyword) | `--body "напоминание" --since 01-Apr-2026` |
| Large emails (likely with attachments) | `--larger 50000` |
| A specific environment's messages | `--subject "[QA1]"` / `--subject "[STAGE]"` |

## Speed budget on 140k INBOX

| Query shape | Typical time |
|---|---|
| Header-only, no date | <1s |
| `--body` + wide date range | 10–60s |
| `--text` + no date | minutes — avoid |

Always narrow with at least one fast predicate (`--from`, `--since`, `--subject`)
before slow ones.
