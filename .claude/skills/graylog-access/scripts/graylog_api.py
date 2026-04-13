#!/usr/bin/env python3
"""Graylog REST API CLI for the TTT Expert System.

Authenticates via session token, selects streams, runs searches, tails newest
messages, and downloads results to artifacts/graylog/ with informative filenames.
Config loaded from config/graylog/graylog.yaml + config/graylog/envs/<env>.yaml
(with password optionally in config/graylog/envs/secret.yaml).

Subcommands: streams | count | search | tail | download
All output is JSON by default (--pretty for human-readable).
"""

import argparse
import base64
import hashlib
import json
import re
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Force IPv4-only DNS lookup: the corporate VPN returns an error for AF_UNSPEC
# IPv6 probes but resolves cleanly for AF_INET. Same workaround as roundcube-access.
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_only(host, port, family=0, *args, **kwargs):
    return _orig_getaddrinfo(host, port, socket.AF_INET, *args, **kwargs)


socket.getaddrinfo = _ipv4_only

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML required (python3 -m pip install pyyaml)", file=sys.stderr)
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_CONFIG = REPO_ROOT / "config" / "graylog"
DEFAULT_ARTIFACT_DIR = REPO_ROOT / "artifacts" / "graylog"
USER_AGENT = "ttt-expert-graylog-cli/1.0"



# -------- config --------


def _is_placeholder(value) -> bool:
    # YAML parses the unquoted placeholder "[secret]" as the list ["secret"] — treat
    # any non-string, empty string, or literal "[secret]" as a pointer to secret.yaml.
    return (
        value is None
        or not isinstance(value, str)
        or value in ("", "[secret]")
    )


def _load_secrets(config_dir: Path, env_name: str) -> dict:
    """Read secret.yaml — may be a bare scalar (password) or a {password,token} map."""
    secret_path = config_dir / "envs" / "secret.yaml"
    if not secret_path.exists():
        return {}
    parsed = yaml.safe_load(secret_path.read_text())
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, str):
        return {"password": parsed.strip()}
    return {}


def load_config(config_dir: Path) -> dict:
    main_cfg = yaml.safe_load((config_dir / "graylog.yaml").read_text())
    env_name = main_cfg["env"]
    env_cfg = yaml.safe_load((config_dir / "envs" / f"{env_name}.yaml").read_text())
    secrets = _load_secrets(config_dir, env_name)

    password = env_cfg.get("password")
    if _is_placeholder(password):
        password = secrets.get("password") or secrets.get(env_name)
    token = env_cfg.get("token")
    if _is_placeholder(token):
        token = secrets.get("token")

    if not password and not token:
        raise RuntimeError(
            f"No password or token available — check {config_dir}/envs/{env_name}.yaml "
            f"and {config_dir}/envs/secret.yaml"
        )
    base_url = main_cfg["appUrl"].rstrip("/")
    return {
        "base_url": base_url,
        "username": env_cfg["username"],
        "password": password or "",
        "token": token or "",
        "env": env_name,
        "app_name": main_cfg.get("appName", "GrayLog"),
    }


# -------- HTTP --------


class GraylogClient:
    def __init__(self, base_url: str, auth: tuple[str, str], timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._auth_header = self._build_basic_auth(*auth)
        self._opener = _make_opener(_make_ssl_ctx())

    @staticmethod
    def _build_basic_auth(user: str, pwd: str) -> str:
        token = base64.b64encode(f"{user}:{pwd}".encode("utf-8")).decode("ascii")
        return f"Basic {token}"

    def _request(
        self,
        method: str,
        path: str,
        params: dict | None = None,
        body: dict | None = None,
        accept: str = "application/json",
    ):
        url = self.base_url + path
        if params:
            # Graylog accepts repeated ?fields=x&fields=y — encode via doseq.
            url += "?" + urllib.parse.urlencode(
                {k: v for k, v in params.items() if v is not None}, doseq=True
            )
        data = None
        headers = {
            "Accept": accept,
            "Authorization": self._auth_header,
            "User-Agent": USER_AGENT,
            "X-Requested-By": "cli",
        }
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self._opener.open(req, timeout=self.timeout) as resp:
                payload = resp.read()
                ctype = resp.headers.get("Content-Type", "")
                if "json" in ctype or accept == "application/json":
                    return json.loads(payload) if payload else {}
                return payload  # raw bytes for CSV/text
        except urllib.error.HTTPError as e:
            body_text = ""
            try:
                body_text = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            raise RuntimeError(
                f"HTTP {e.code} {e.reason} for {method} {path}\n{body_text}"
            ) from None
        except urllib.error.URLError as e:
            raise RuntimeError(f"Network error: {e.reason} (VPN connected?)") from None

    def get(self, path, params=None, accept="application/json"):
        return self._request("GET", path, params=params, accept=accept)

    def post(self, path, body=None):
        return self._request("POST", path, body=body)


def _make_ssl_ctx() -> ssl.SSLContext:
    # The Graylog nginx frontend drops TLS 1.3 handshakes (Connection reset by peer)
    # on this host; cap at TLS 1.2 to match what curl negotiates successfully.
    ctx = ssl.create_default_context()
    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    return ctx


def _make_opener(ssl_ctx: ssl.SSLContext) -> urllib.request.OpenerDirector:
    # Must combine BOTH handlers in a single opener — urlopen(context=...) builds
    # its own HTTPSHandler and drops any proxy handlers we install separately, so
    # HTTPS_PROXY env (Throne) would leak back in and corrupt the TLS handshake.
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=ssl_ctx),
    )


def create_session(base_url: str, username: str, password: str, host: str) -> str:
    """POST /api/system/sessions → return session_id (used as Basic user for later calls)."""
    opener = _make_opener(_make_ssl_ctx())
    url = base_url.rstrip("/") + "/api/system/sessions"
    body = json.dumps({"username": username, "password": password, "host": host}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
            "X-Requested-By": "cli",
        },
    )
    try:
        with opener.open(req, timeout=20) as resp:
            data = json.loads(resp.read())
            return data["session_id"]
    except urllib.error.HTTPError as e:
        body_text = ""
        try:
            body_text = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        raise RuntimeError(
            f"Session auth failed: HTTP {e.code} {e.reason}\n{body_text}"
        ) from None
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"Cannot reach {url}: {e.reason} (VPN connected?)"
        ) from None


def make_client(cfg: dict) -> GraylogClient:
    # Auth precedence: access token → session token → direct Basic username/password.
    # Access tokens don't depend on the corporate LDAP/AD backend, so they remain
    # usable when `/api/system/sessions` returns 503 "Authentication service
    # unavailable". Graylog accepts the token as the Basic username with the literal
    # password "token".
    if cfg.get("token"):
        return GraylogClient(cfg["base_url"], (cfg["token"], "token"))
    host = urllib.parse.urlparse(cfg["base_url"]).hostname or ""
    try:
        session_id = create_session(cfg["base_url"], cfg["username"], cfg["password"], host)
        return GraylogClient(cfg["base_url"], (session_id, "session"))
    except RuntimeError:
        if not cfg.get("password"):
            raise
        return GraylogClient(cfg["base_url"], (cfg["username"], cfg["password"]))


# -------- time parsing --------


_REL_RE = re.compile(r"^\s*(\d+)\s*([smhdw])\s*$", re.IGNORECASE)
_UNIT_SECS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


def parse_duration(value) -> int | None:
    """5m / 2h / 1d / 86400 / "300" → seconds."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if s.isdigit():
        return int(s)
    m = _REL_RE.match(s)
    if m:
        n, unit = m.groups()
        return int(n) * _UNIT_SECS[unit.lower()]
    raise ValueError(f"Cannot parse duration: {value!r}")


def to_iso_utc(value) -> str:
    """'now' | '5m' (before now) | '2026-04-13' | '2026-04-13T10:00' | full ISO → ISO 8601 Z."""
    if value is None:
        raise ValueError("time value required")
    s = str(value).strip()
    now = datetime.now(timezone.utc)
    if s.lower() == "now":
        dt = now
    elif _REL_RE.match(s):
        from datetime import timedelta

        dt = now - timedelta(seconds=parse_duration(s))
    else:
        # Accept date or datetime.
        for fmt in (
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ):
            try:
                dt = datetime.strptime(s.rstrip("Z"), fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"Cannot parse time: {value!r}")
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


# -------- streams --------


def list_streams(client: GraylogClient) -> list[dict]:
    resp = client.get("/api/streams")
    return resp.get("streams", [])


def resolve_stream(client: GraylogClient, ident: str) -> dict:
    """Accept stream name (case-insensitive exact) or stream ID (24-hex hex string)."""
    if not ident:
        raise RuntimeError("stream required (--stream)")
    streams = list_streams(client)
    # Try exact ID match.
    for s in streams:
        if s.get("id") == ident:
            return s
    # Then case-insensitive title match.
    for s in streams:
        if (s.get("title") or "").strip().lower() == ident.strip().lower():
            return s
    # Then substring, but only if unambiguous.
    matches = [s for s in streams if ident.lower() in (s.get("title") or "").lower()]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        names = ", ".join(repr(s["title"]) for s in matches)
        raise RuntimeError(f"Ambiguous stream {ident!r}, matches: {names}")
    raise RuntimeError(
        f"Stream not found: {ident!r}. Use `streams` subcommand to list available streams."
    )


# -------- search --------


def _build_search_params(args, stream: dict | None) -> tuple[str, dict]:
    """Return (endpoint_path, params) for search/universal/{relative|absolute}."""
    query = args.query or "*"
    params: dict = {"query": query, "limit": args.limit, "offset": args.offset}
    if args.fields:
        params["fields"] = ",".join(args.fields)
    if args.sort:
        params["sort"] = args.sort
    if stream:
        # Graylog supports `filter=streams:<id>` or `streams=<id>`. The newer endpoints
        # accept `filter`; universal-search accepts `filter=streams:<id>`.
        params["filter"] = f"streams:{stream['id']}"

    range_secs = parse_duration(args.range)
    if range_secs is not None:
        params["range"] = range_secs
        return "/api/search/universal/relative", params
    if args.since or args.until:
        since = args.since or "1h"
        until = args.until or "now"
        params["from"] = to_iso_utc(since)
        params["to"] = to_iso_utc(until)
        return "/api/search/universal/absolute", params
    # Default: last 5 minutes.
    params["range"] = 300
    return "/api/search/universal/relative", params


def run_search(client: GraylogClient, args, stream: dict | None) -> dict:
    path, params = _build_search_params(args, stream)
    return client.get(path, params=params)


def search_csv(client: GraylogClient, args, stream: dict | None) -> bytes:
    path, params = _build_search_params(args, stream)
    return client.get(path, params=params, accept="text/csv")


# -------- formatting --------


def to_text_lines(messages: list[dict]) -> str:
    out: list[str] = []
    for item in messages:
        m = item.get("message", {}) if isinstance(item, dict) else {}
        ts = m.get("timestamp", "")
        src = m.get("source", "")
        lvl = m.get("level", "")
        msg = (m.get("message") or "").replace("\n", " ")
        out.append(f"{ts} {src} [{lvl}] {msg}".rstrip())
    return "\n".join(out)


def to_ndjson(messages: list[dict]) -> str:
    return "\n".join(
        json.dumps(item.get("message", item), ensure_ascii=False, sort_keys=True)
        for item in messages
    )


# -------- filename --------


_SLUG_RE = re.compile(r"[^A-Za-z0-9._-]+")


def slugify(value: str, max_len: int = 40) -> str:
    s = _SLUG_RE.sub("-", value or "").strip("-")
    return s[:max_len] if len(s) > max_len else s


def compact_iso(iso: str) -> str:
    # '2026-04-13T10:00:00.000Z' → '20260413T100000Z'
    return re.sub(r"[:.-]", "", iso).replace("T", "T").replace("000Z", "Z")


def default_filename(args, stream: dict | None, ext: str) -> str:
    parts: list[str] = []
    if stream:
        parts.append(slugify(stream["title"]).lower())
    else:
        parts.append("all")

    range_secs = parse_duration(args.range)
    if range_secs is not None:
        parts.append(f"last-{range_secs}s")
    elif args.since or args.until:
        since = to_iso_utc(args.since or "1h")
        until = to_iso_utc(args.until or "now")
        parts.append(compact_iso(since))
        parts.append(compact_iso(until))
    else:
        parts.append("last-300s")

    q = (args.query or "*").strip()
    if q and q != "*":
        parts.append(f"q-{slugify(q, 30)}")

    parts.append(datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))

    # short content-independent hash for uniqueness in case of repeated runs.
    tag = hashlib.sha1(
        (json.dumps(vars(args), sort_keys=True, default=str)).encode("utf-8")
    ).hexdigest()[:6]
    parts.append(tag)

    return "_".join(p for p in parts if p) + f".{ext}"


# -------- commands --------


def cmd_streams(client: GraylogClient, args) -> dict:
    streams = list_streams(client)
    if args.name:
        streams = [s for s in streams if args.name.lower() in (s.get("title") or "").lower()]
    return {
        "total": len(streams),
        "items": [
            {
                "id": s.get("id"),
                "title": s.get("title"),
                "description": s.get("description"),
                "disabled": s.get("disabled"),
                "is_default": s.get("is_default"),
                "index_set_id": s.get("index_set_id"),
                "rules": len(s.get("rules") or []),
            }
            for s in streams
        ],
    }


def cmd_count(client: GraylogClient, args) -> dict:
    stream = resolve_stream(client, args.stream) if args.stream else None
    # Force limit=0 when possible — but universal-search requires limit >= 1.
    args.limit = 1
    args.offset = 0
    args.fields = None
    args.sort = None
    resp = run_search(client, args, stream)
    return {
        "stream": stream["title"] if stream else None,
        "query": args.query or "*",
        "total": resp.get("total_results"),
        "from": resp.get("from"),
        "to": resp.get("to"),
        "duration_ms": resp.get("time"),
    }


def cmd_search(client: GraylogClient, args) -> dict:
    stream = resolve_stream(client, args.stream) if args.stream else None
    resp = run_search(client, args, stream)
    msgs = resp.get("messages", [])
    return {
        "stream": stream["title"] if stream else None,
        "query": resp.get("query"),
        "total": resp.get("total_results"),
        "returned": len(msgs),
        "from": resp.get("from"),
        "to": resp.get("to"),
        "duration_ms": resp.get("time"),
        "messages": [m.get("message", m) for m in msgs],
    }


def cmd_tail(client: GraylogClient, args) -> dict:
    stream = resolve_stream(client, args.stream) if args.stream else None
    # tail = latest N messages by timestamp desc, default 5 min window.
    if args.range is None and not args.since and not args.until:
        args.range = "5m"
    if not args.sort:
        args.sort = "timestamp:desc"
    resp = run_search(client, args, stream)
    msgs = resp.get("messages", [])
    return {
        "stream": stream["title"] if stream else None,
        "query": resp.get("query"),
        "window_from": resp.get("from"),
        "window_to": resp.get("to"),
        "returned": len(msgs),
        "messages": [m.get("message", m) for m in msgs],
    }


def cmd_download(client: GraylogClient, args) -> dict:
    stream = resolve_stream(client, args.stream) if args.stream else None
    fmt = (args.format or "json").lower()
    ext = {"json": "json", "ndjson": "ndjson", "text": "log", "csv": "csv"}.get(fmt)
    if not ext:
        raise RuntimeError(f"Unknown format {fmt!r} (json|ndjson|text|csv)")

    out_dir = Path(args.output_dir).resolve() if args.output_dir else DEFAULT_ARTIFACT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    name = args.name or default_filename(args, stream, ext)
    out_path = out_dir / name

    if fmt == "csv":
        # Universal-search CSV export requires an explicit fields list; seed with
        # the common quartet if the caller didn't pass one.
        if not args.fields:
            args.fields = ["timestamp", "source", "level", "message"]
        raw = search_csv(client, args, stream)
        if isinstance(raw, (bytes, bytearray)):
            out_path.write_bytes(raw)
        else:
            out_path.write_text(str(raw), encoding="utf-8")
        summary_total = None
        returned = None
    else:
        resp = run_search(client, args, stream)
        msgs = resp.get("messages", [])
        summary_total = resp.get("total_results")
        returned = len(msgs)
        if fmt == "json":
            out_path.write_text(
                json.dumps(
                    {
                        "stream": stream["title"] if stream else None,
                        "query": resp.get("query"),
                        "total_results": resp.get("total_results"),
                        "from": resp.get("from"),
                        "to": resp.get("to"),
                        "messages": [m.get("message", m) for m in msgs],
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
        elif fmt == "ndjson":
            out_path.write_text(
                to_ndjson(msgs) + ("\n" if msgs else ""), encoding="utf-8"
            )
        elif fmt == "text":
            out_path.write_text(
                to_text_lines(msgs) + ("\n" if msgs else ""), encoding="utf-8"
            )

    return {
        "stream": stream["title"] if stream else None,
        "query": args.query or "*",
        "format": fmt,
        "path": str(out_path),
        "size": out_path.stat().st_size,
        "total": summary_total,
        "returned": returned,
    }


# -------- CLI --------


def _add_search_args(p):
    p.add_argument("-s", "--stream", help="Stream name or ID (e.g. TTT-QA-1)")
    p.add_argument("--query", default=None, help="Graylog query string (default '*')")
    p.add_argument("--range", default=None,
                   help="Relative range: 300 | 5m | 2h | 1d (uses /relative endpoint)")
    p.add_argument("--since", default=None,
                   help="Absolute start: ISO date/time or relative like '1h' (uses /absolute)")
    p.add_argument("--until", default=None, help="Absolute end (default 'now')")
    p.add_argument("-n", "--limit", type=int, default=100, help="Max messages (default 100)")
    p.add_argument("-o", "--offset", type=int, default=0, help="Pagination offset (default 0)")
    p.add_argument("--field", dest="fields", action="append",
                   help="Include only these fields (repeatable)")
    p.add_argument("--sort", default=None,
                   help="Sort: field:asc|desc (e.g. timestamp:desc)")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="graylog_api",
        description="Graylog REST CLI (session auth, stream search, artifact download)",
    )
    p.add_argument("--config-dir", type=Path, default=DEFAULT_CONFIG,
                   help=f"Config dir (default {DEFAULT_CONFIG})")
    p.add_argument("--pretty", action="store_true",
                   help="Human-readable output (default: JSON)")

    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("streams", help="List available streams")
    sp.add_argument("--name", default=None, help="Substring filter on stream title")

    sp = sub.add_parser("count", help="Count messages matching a query")
    _add_search_args(sp)

    sp = sub.add_parser("search", help="Search messages")
    _add_search_args(sp)

    sp = sub.add_parser("tail", help="Latest messages (newest-first, sort=timestamp:desc)")
    _add_search_args(sp)

    sp = sub.add_parser("download", help="Run search and save results to artifacts/graylog/")
    _add_search_args(sp)
    sp.add_argument("-d", "--output-dir", default=None,
                    help=f"Output dir (default {DEFAULT_ARTIFACT_DIR})")
    sp.add_argument("--format", default="json",
                    choices=["json", "ndjson", "text", "csv"],
                    help="Output format (default json)")
    sp.add_argument("--name", default=None,
                    help="Override generated filename (single run only)")

    return p


def render(result, pretty: bool):
    if pretty:
        if isinstance(result, dict) and "items" in result and "total" in result:
            # streams output
            print(f"total: {result['total']}")
            for it in result["items"]:
                flag = " [disabled]" if it.get("disabled") else ""
                dflt = " [default]" if it.get("is_default") else ""
                print(f"  - {it.get('id')}  {it.get('title')!r}{flag}{dflt}")
            return
        if isinstance(result, dict) and "messages" in result:
            hdr = (
                f"stream={result.get('stream')}  "
                f"query={result.get('query')!r}  "
                f"returned={result.get('returned')}/{result.get('total')}  "
                f"window={result.get('window_from') or result.get('from')}..."
                f"{result.get('window_to') or result.get('to')}"
            )
            print(hdr)
            for msg in result["messages"]:
                ts = msg.get("timestamp", "")
                src = msg.get("source", "")
                lvl = msg.get("level", "")
                txt = (msg.get("message") or "").replace("\n", " ")
                print(f"  {ts} {src} [{lvl}] {txt}")
            return
        if isinstance(result, dict) and "path" in result:
            print(f"saved: {result['path']} ({result['size']} B)")
            for k in ("stream", "query", "format", "total", "returned"):
                if result.get(k) is not None:
                    print(f"  {k}: {result[k]}")
            return
        if isinstance(result, dict) and "total" in result and "query" in result:
            # count output
            for k, v in result.items():
                print(f"{k}: {v}")
            return
    print(json.dumps(result, ensure_ascii=False, indent=2 if pretty else None))


def main():
    args = build_parser().parse_args()
    try:
        cfg = load_config(Path(args.config_dir))
        client = make_client(cfg)

        if args.cmd == "streams":
            result = cmd_streams(client, args)
        elif args.cmd == "count":
            result = cmd_count(client, args)
        elif args.cmd == "search":
            result = cmd_search(client, args)
        elif args.cmd == "tail":
            result = cmd_tail(client, args)
        elif args.cmd == "download":
            result = cmd_download(client, args)
        else:
            print(f"Unknown subcommand: {args.cmd}", file=sys.stderr)
            sys.exit(2)

        render(result, args.pretty)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
