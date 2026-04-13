# Graylog query-language cheat sheet

Graylog search uses a Lucene-style query syntax. These are the patterns that
come up most often against the TTT streams.

## Full-text and field searches

| Need | Query |
|---|---|
| Plain term (message body or `message` field) | `exception` |
| Exact phrase | `"Cannot invoke \"x\" because"` |
| Specific field equals | `level:3` |
| Specific field phrase | `source:"ttt-qa-1.noveogroup.com"` |
| Substring in a field | `message:sendEmails` |
| Regex in a field | `message:/send.*finished/` |
| Fuzzy | `NullPointerExcepton~` |
| Wildcard (prefix) | `message:request_*` |
| Field exists | `_exists_:http_status` |
| Field missing | `NOT _exists_:user` |

Escape special chars (`:\+-!()[]^"~*?&|/`) with `\`. Bare terms match the
`message` field by default.

## Booleans

```
level:3 OR level:4
level:3 AND source:ttt-qa-1.noveogroup.com
(level:3 OR level:4) AND NOT user:"system"
```

Boolean operators MUST be uppercase. Implicit operator between terms is `OR`
— use parentheses to disambiguate.

## Ranges

| Need | Query |
|---|---|
| Numeric range inclusive | `level:[3 TO 5]` |
| Numeric range exclusive | `http_status:{400 TO 499}` |
| `>` / `<` | `duration_ms:>500` or `level:<5` |
| Date range | `timestamp:["2026-04-13T10:00:00.000Z" TO "2026-04-13T10:30:00.000Z"]` |

## Common TTT levels (syslog severity)

| Level | Meaning |
|---|---|
| `0` | emergency |
| `1` | alert |
| `2` | critical |
| `3` | error |
| `4` | warning |
| `5` | notice |
| `6` | info |
| `7` | debug |

`level:<=4` catches everything at warning or worse.

## Useful combinations for TTT

| Goal | Query |
|---|---|
| Errors only in last 30m | `level:3` + `--range 30m` |
| Warnings+errors | `level:[3 TO 4]` |
| HTTP 5xx in app logs | `http_status:[500 TO 599]` |
| Exceptions | `message:Exception OR message:Error` |
| Specific endpoint | `message:"/api/vacation/"` |
| User-specific activity | `message:"vulyanov"` |
| Notifications dispatch | `message:sendEmails` |
| Long-running requests (>1s) | `duration_ms:>1000` |

## Time-range shortcuts

The CLI exposes two mutually-exclusive modes:

| CLI option | Endpoint | Example |
|---|---|---|
| `--range 5m` | `/api/search/universal/relative` | last 5 min from now |
| `--since X --until Y` | `/api/search/universal/absolute` | any fixed window |

For relative, units are `s` / `m` / `h` / `d` / `w`. Bare digits mean seconds.
For absolute, UTC ISO (`2026-04-13T10:00`) or date (`2026-04-13`).

## Sorting

```
--sort timestamp:desc   # newest first (default for `tail`)
--sort timestamp:asc    # oldest first (chronological replay)
--sort level:asc        # errors first within window
```

## Tips

- `count` is cheaper than `search`: use it when you only need totals.
- Combine a cheap filter (`level:3`, `source:...`) with a body search to cut
  response time: body scans are O(messages × bytes).
- Use `--field timestamp --field message` to reduce response payload; fields
  you don't request still sort correctly server-side.
- Streams carry an implicit source filter — you don't need to repeat
  `source:...` in the query if you already passed `--stream TTT-QA-1`.
