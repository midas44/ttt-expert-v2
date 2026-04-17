#!/usr/bin/env python3
"""Roundcube IMAP CLI for the TTT Expert System.

Reads the test mailbox that Roundcube Webmail serves as UI, via IMAPS.
Config loaded from config/roundcube/roundcube.yaml + config/roundcube/envs/<env>.yaml.

Subcommands: mailboxes | count | list | search | read
All output is JSON by default (--pretty for human-readable).
"""

import argparse
import email
import email.message
import imaplib
import json
import re
import socket
import ssl
import sys
from email.header import decode_header, make_header
from pathlib import Path
from urllib.parse import urlparse

_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_only(host, port, family=0, *args, **kwargs):
    return _orig_getaddrinfo(host, port, socket.AF_INET, *args, **kwargs)


socket.getaddrinfo = _ipv4_only

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML required (python3 -m pip install pyyaml)", file=sys.stderr)
    sys.exit(2)


DEFAULT_CONFIG = Path(__file__).resolve().parents[4] / "config" / "roundcube"


# -------- config --------


def load_config(config_dir: Path) -> dict:
    main_cfg = yaml.safe_load((config_dir / "roundcube.yaml").read_text())
    env_name = main_cfg["env"]
    env_cfg = yaml.safe_load((config_dir / "envs" / f"{env_name}.yaml").read_text())
    host = urlparse(main_cfg["appUrl"]).hostname
    return {
        "host": host,
        "username": env_cfg["username"],
        "password": env_cfg["password"],
        "app_url": main_cfg["appUrl"],
        "env": env_name,
        "app_name": main_cfg.get("appName", "Roundcube Webmail"),
    }


# -------- connection --------


def connect(cfg: dict, port: int = 993, timeout: int = 15) -> imaplib.IMAP4_SSL:
    imap = imaplib.IMAP4_SSL(cfg["host"], port, timeout=timeout)
    typ, _ = imap.login(cfg["username"], cfg["password"])
    if typ != "OK":
        raise RuntimeError(f"LOGIN failed: {typ}")
    return imap


def select_mailbox(imap: imaplib.IMAP4_SSL, mailbox: str) -> int:
    typ, data = imap.select(mailbox, readonly=True)
    if typ != "OK":
        raise RuntimeError(f"SELECT {mailbox} failed: {data!r}")
    return int(data[0])


# -------- helpers --------


def decode_mime(value):
    if value is None:
        return None
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def parse_fetch_tuple(meta_line: bytes, header_bytes: bytes) -> dict:
    """Parse one (meta, body) tuple from a FETCH response into a summary dict."""
    meta_str = meta_line.decode("utf-8", errors="replace")
    uid = _first_int(r"UID (\d+)", meta_str)
    seq = _first_int(r"^(\d+) \(", meta_str)
    idate = _first_group(r'INTERNALDATE "([^"]+)"', meta_str)
    flags = _first_group(r"FLAGS \(([^)]*)\)", meta_str) or ""
    size = _first_int(r"RFC822\.SIZE (\d+)", meta_str)
    msg = email.message_from_bytes(header_bytes)
    return {
        "uid": uid,
        "seq": seq,
        "internal_date": idate,
        "size": size,
        "flags": flags.split(),
        "subject": decode_mime(msg.get("Subject")),
        "from": decode_mime(msg.get("From")),
        "to": decode_mime(msg.get("To")),
        "cc": decode_mime(msg.get("Cc")),
        "date": msg.get("Date"),
        "message_id": msg.get("Message-ID"),
    }


def _first_int(pattern: str, text: str):
    m = re.search(pattern, text)
    return int(m.group(1)) if m else None


def _first_group(pattern: str, text: str):
    m = re.search(pattern, text)
    return m.group(1) if m else None


FETCH_SUMMARY_SPEC = (
    "(UID RFC822.SIZE INTERNALDATE FLAGS "
    "BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO CC DATE MESSAGE-ID)])"
)


def fetch_summaries(imap: imaplib.IMAP4_SSL, ids: list, by_uid: bool) -> list:
    if not ids:
        return []
    ranges = _compact_ranges(ids) if len(ids) > 200 else [",".join(str(i) for i in ids)]
    out = []
    for seq_set in ranges:
        if by_uid:
            typ, data = imap.uid("FETCH", seq_set, FETCH_SUMMARY_SPEC)
        else:
            typ, data = imap.fetch(seq_set, FETCH_SUMMARY_SPEC)
        if typ != "OK":
            raise RuntimeError(f"FETCH failed: {data!r}")
        for item in data:
            if isinstance(item, tuple) and len(item) >= 2:
                out.append(parse_fetch_tuple(item[0], item[1]))
    return out


def _compact_ranges(sorted_ids: list) -> list:
    """Compact a sorted list of ints into IMAP sequence sets like '1:5,7,10:12'."""
    parts = []
    run_start = sorted_ids[0]
    prev = sorted_ids[0]
    for x in sorted_ids[1:]:
        if x == prev + 1:
            prev = x
            continue
        parts.append(f"{run_start}" if run_start == prev else f"{run_start}:{prev}")
        run_start = prev = x
    parts.append(f"{run_start}" if run_start == prev else f"{run_start}:{prev}")
    # Return as one string; caller wraps in list for parity with other branch
    return [",".join(parts)]


# -------- commands --------


def cmd_mailboxes(imap, args):
    typ, data = imap.list()
    if typ != "OK":
        raise RuntimeError(f"LIST failed: {data!r}")
    folders = []
    for line in data or []:
        if not line:
            continue
        # e.g. b'(\\HasNoChildren \\UnMarked \\Trash) "/" Trash'
        m = re.match(rb"\(([^)]*)\) \"([^\"]*)\" (.+)", line)
        if m:
            attrs, sep, name = m.groups()
            folders.append({
                "name": name.decode().strip('"'),
                "separator": sep.decode(),
                "attributes": attrs.decode().split(),
            })
    return folders


def cmd_count(imap, args):
    total = select_mailbox(imap, args.mailbox)
    unseen = 0
    typ, data = imap.search(None, "UNSEEN")
    if typ == "OK" and data and data[0]:
        unseen = len(data[0].split())
    recent = 0
    typ, data = imap.search(None, "RECENT")
    if typ == "OK" and data and data[0]:
        recent = len(data[0].split())
    return {"mailbox": args.mailbox, "total": total, "unseen": unseen, "recent": recent}


def cmd_list(imap, args):
    total = select_mailbox(imap, args.mailbox)
    if total == 0:
        return {"mailbox": args.mailbox, "total": 0, "offset": args.offset,
                "limit": args.limit, "items": []}
    end = total - args.offset
    if end < 1:
        return {"mailbox": args.mailbox, "total": total, "offset": args.offset,
                "limit": args.limit, "items": []}
    start = max(1, end - args.limit + 1)
    seq_set = f"{start}:{end}"
    typ, data = imap.fetch(seq_set, FETCH_SUMMARY_SPEC)
    if typ != "OK":
        raise RuntimeError(f"FETCH failed: {data!r}")
    items = [parse_fetch_tuple(it[0], it[1]) for it in data if isinstance(it, tuple) and len(it) >= 2]
    items.sort(key=lambda x: x.get("seq") or 0, reverse=True)
    return {
        "mailbox": args.mailbox,
        "total": total,
        "offset": args.offset,
        "limit": args.limit,
        "items": items,
    }


def _quote(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def build_search_criteria(args) -> list:
    parts = []
    if args.unseen:
        parts.append("UNSEEN")
    if args.seen:
        parts.append("SEEN")
    if args.flagged:
        parts.append("FLAGGED")
    if args.answered:
        parts.append("ANSWERED")
    if args.from_:
        parts += ["FROM", _quote(args.from_)]
    if args.to:
        parts += ["TO", _quote(args.to)]
    if args.cc:
        parts += ["CC", _quote(args.cc)]
    if args.subject:
        parts += ["SUBJECT", _quote(args.subject)]
    if args.body:
        parts += ["BODY", _quote(args.body)]
    if args.text:
        parts += ["TEXT", _quote(args.text)]
    if args.since:
        parts += ["SINCE", args.since]
    if args.before:
        parts += ["BEFORE", args.before]
    if args.on:
        parts += ["ON", args.on]
    if args.larger is not None:
        parts += ["LARGER", str(args.larger)]
    if args.smaller is not None:
        parts += ["SMALLER", str(args.smaller)]
    if args.header:
        for h in args.header:
            name, _, val = h.partition(":")
            parts += ["HEADER", name.strip(), _quote(val.strip())]
    if not parts:
        parts = ["ALL"]
    return parts


def cmd_search(imap, args):
    select_mailbox(imap, args.mailbox)
    criteria = build_search_criteria(args)
    needs_utf8 = any(isinstance(c, str) and not c.isascii() for c in criteria)
    if needs_utf8:
        encoded = [c.encode("utf-8") if isinstance(c, str) and not c.isascii() else c
                   for c in criteria]
        typ, data = imap.uid("SEARCH", "CHARSET", "UTF-8", *encoded)
    else:
        typ, data = imap.uid("SEARCH", None, *criteria)
    if typ != "OK":
        raise RuntimeError(f"SEARCH failed: {data!r}")
    uids = [int(u) for u in (data[0].split() if data and data[0] else [])]
    uids_desc = sorted(uids, reverse=True)
    total = len(uids_desc)
    page = uids_desc[args.offset:args.offset + args.limit]
    items = fetch_summaries(imap, sorted(page), by_uid=True) if page else []
    items.sort(key=lambda x: x.get("uid") or 0, reverse=True)
    return {
        "mailbox": args.mailbox,
        "criteria": criteria,
        "total": total,
        "offset": args.offset,
        "limit": args.limit,
        "items": items,
    }


def extract_body(msg: email.message.Message) -> tuple:
    text_parts, html_parts = [], []
    for part in msg.walk():
        if part.is_multipart():
            continue
        disp = (part.get("Content-Disposition") or "").lower()
        if "attachment" in disp:
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or "utf-8"
        try:
            text = payload.decode(charset, errors="replace")
        except (LookupError, UnicodeDecodeError):
            text = payload.decode("utf-8", errors="replace")
        ctype = part.get_content_type()
        if ctype == "text/plain":
            text_parts.append(text)
        elif ctype == "text/html":
            html_parts.append(text)
    return "\n".join(text_parts), "\n".join(html_parts)


_slug_re = re.compile(r"[^A-Za-z0-9._-]+")


def _slugify(s: str, max_len: int = 60) -> str:
    if not s:
        return ""
    # prefer the local part of an email address if present
    m = re.search(r"([A-Za-z0-9._+-]+)@", s)
    if m:
        s = m.group(1)
    slug = _slug_re.sub("-", s).strip("-.")
    return slug[:max_len] or ""


def _filename_for(msg_bytes: bytes, uid: int) -> str:
    msg = email.message_from_bytes(msg_bytes)
    to_slug = _slugify(decode_mime(msg.get("To") or "") or "")
    if to_slug:
        return f"{uid}-{to_slug}.eml"
    subj_slug = _slugify(decode_mime(msg.get("Subject") or "") or "")
    return f"{uid}-{subj_slug}.eml" if subj_slug else f"{uid}.eml"


def _resolve_uids_for_save(imap, args) -> list:
    if args.uids:
        return args.uids
    criteria = build_search_criteria(args)
    needs_utf8 = any(isinstance(c, str) and not c.isascii() for c in criteria)
    if needs_utf8:
        encoded = [c.encode("utf-8") if isinstance(c, str) and not c.isascii() else c
                   for c in criteria]
        typ, data = imap.uid("SEARCH", "CHARSET", "UTF-8", *encoded)
    else:
        typ, data = imap.uid("SEARCH", None, *criteria)
    if typ != "OK":
        raise RuntimeError(f"SEARCH failed: {data!r}")
    uids = [int(u) for u in (data[0].split() if data and data[0] else [])]
    return sorted(uids, reverse=True)[:args.limit]


def cmd_save(imap, args):
    select_mailbox(imap, args.mailbox)
    uids = _resolve_uids_for_save(imap, args)
    if not uids:
        return {"mailbox": args.mailbox, "saved": [], "skipped": [], "dir": str(args.dir)}
    out_dir = Path(args.dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    saved, skipped = [], []
    for uid in uids:
        typ, data = imap.uid("FETCH", str(uid), "(BODY.PEEK[])")
        if typ != "OK" or not data or not isinstance(data[0], tuple):
            skipped.append({"uid": uid, "reason": f"FETCH {typ}"})
            continue
        raw = data[0][1]
        name = args.name or _filename_for(raw, uid)
        path = out_dir / name
        if path.exists() and args.skip_existing:
            skipped.append({"uid": uid, "reason": "exists", "path": str(path)})
            continue
        path.write_bytes(raw)
        saved.append({"uid": uid, "path": str(path), "size": len(raw)})
    return {"mailbox": args.mailbox, "dir": str(out_dir),
            "saved": saved, "skipped": skipped}


def cmd_read(imap, args):
    select_mailbox(imap, args.mailbox)
    typ, data = imap.uid("FETCH", str(args.uid), "(UID RFC822.SIZE INTERNALDATE FLAGS BODY.PEEK[])")
    if typ != "OK" or not data or not isinstance(data[0], tuple):
        raise RuntimeError(f"FETCH UID {args.uid} failed: {data!r}")
    meta_line, raw = data[0]
    meta_str = meta_line.decode("utf-8", errors="replace")
    uid = _first_int(r"UID (\d+)", meta_str) or args.uid
    idate = _first_group(r'INTERNALDATE "([^"]+)"', meta_str)
    flags = (_first_group(r"FLAGS \(([^)]*)\)", meta_str) or "").split()
    size = _first_int(r"RFC822\.SIZE (\d+)", meta_str)

    msg = email.message_from_bytes(raw)
    text, html = extract_body(msg)
    attachments = []
    for part in msg.walk():
        disp = (part.get("Content-Disposition") or "").lower()
        if "attachment" in disp or part.get_filename():
            payload = part.get_payload(decode=True) or b""
            attachments.append({
                "filename": decode_mime(part.get_filename()),
                "content_type": part.get_content_type(),
                "size": len(payload),
            })
    return {
        "uid": uid,
        "size": size,
        "internal_date": idate,
        "flags": flags,
        "subject": decode_mime(msg.get("Subject")),
        "from": decode_mime(msg.get("From")),
        "to": decode_mime(msg.get("To")),
        "cc": decode_mime(msg.get("Cc")),
        "date": msg.get("Date"),
        "message_id": msg.get("Message-ID"),
        "text": text,
        "html": html if args.include_html else None,
        "attachments": attachments,
    }


# -------- output --------


def pretty_print(result):
    if isinstance(result, list):
        for it in result:
            if isinstance(it, dict) and "name" in it:
                print(f"{it['name']}  [{' '.join(it.get('attributes', []))}]")
            else:
                print(it)
        return
    if isinstance(result, dict) and "items" in result:
        total = result.get("total")
        mb = result.get("mailbox")
        off = result.get("offset", 0)
        shown = len(result["items"])
        print(f"# {mb}  total={total}  offset={off}  shown={shown}")
        if result.get("criteria"):
            print(f"# criteria: {' '.join(result['criteria'])}")
        for it in result["items"]:
            uid = it.get("uid")
            date = it.get("internal_date") or it.get("date") or ""
            frm = (it.get("from") or "")[:40]
            sub = (it.get("subject") or "")[:80]
            flags = ",".join(it.get("flags") or [])
            size = it.get("size")
            print(f"UID={uid:<6} {date:<30} {frm:<40} | {sub}  [{flags}] ({size}b)")
        return
    if isinstance(result, dict) and "saved" in result and "dir" in result:
        print(f"# saved to {result['dir']}  (saved={len(result['saved'])}, skipped={len(result['skipped'])})")
        for s in result["saved"]:
            print(f"  + UID={s['uid']:<7} {s['size']:>7}b  {s['path']}")
        for s in result["skipped"]:
            extra = f"  ({s.get('path', '')})" if s.get("path") else ""
            print(f"  - UID={s['uid']:<7} {s['reason']}{extra}")
        return
    if isinstance(result, dict) and "text" in result:
        print(f"From:    {result.get('from')}")
        print(f"To:      {result.get('to')}")
        print(f"Date:    {result.get('date')}")
        print(f"Subject: {result.get('subject')}")
        print(f"UID:     {result.get('uid')}  Flags: {','.join(result.get('flags') or [])}  Size: {result.get('size')}")
        if result.get("attachments"):
            print(f"Attachments: {len(result['attachments'])}")
            for a in result["attachments"]:
                print(f"  - {a['filename']}  ({a['content_type']}, {a['size']}b)")
        print("-" * 60)
        print(result.get("text") or "(no plain text body)")
        if result.get("html"):
            print("-" * 60)
            print("[HTML]")
            print(result["html"])
        return
    print(json.dumps(result, indent=2, default=str, ensure_ascii=False))


# -------- argparse --------


def build_parser():
    p = argparse.ArgumentParser(description="Roundcube / Dovecot IMAP CLI")
    p.add_argument("--config-dir", default=str(DEFAULT_CONFIG),
                   help=f"Config dir (default: {DEFAULT_CONFIG})")
    p.add_argument("--pretty", action="store_true", help="Human-readable output")

    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("mailboxes", help="List mailbox folders")

    pc = sub.add_parser("count", help="Count messages (total/unseen/recent)")
    pc.add_argument("-m", "--mailbox", default="INBOX")

    pl = sub.add_parser("list", help="List recent messages (newest first)")
    pl.add_argument("-m", "--mailbox", default="INBOX")
    pl.add_argument("-n", "--limit", type=int, default=20)
    pl.add_argument("-o", "--offset", type=int, default=0)

    ps = sub.add_parser("search", help="IMAP SEARCH with pagination")
    ps.add_argument("-m", "--mailbox", default="INBOX")
    ps.add_argument("-n", "--limit", type=int, default=20)
    ps.add_argument("-o", "--offset", type=int, default=0)
    ps.add_argument("--from", dest="from_", help="FROM header contains")
    ps.add_argument("--to", help="TO header contains")
    ps.add_argument("--cc", help="CC header contains")
    ps.add_argument("--subject", help="SUBJECT contains")
    ps.add_argument("--body", help="BODY contains (slower)")
    ps.add_argument("--text", help="Full-message TEXT contains (slowest)")
    ps.add_argument("--since", help="Since DD-Mmm-YYYY (e.g. 01-Apr-2026)")
    ps.add_argument("--before", help="Before DD-Mmm-YYYY")
    ps.add_argument("--on", help="On DD-Mmm-YYYY")
    ps.add_argument("--unseen", action="store_true")
    ps.add_argument("--seen", action="store_true")
    ps.add_argument("--flagged", action="store_true")
    ps.add_argument("--answered", action="store_true")
    ps.add_argument("--larger", type=int, help="LARGER bytes")
    ps.add_argument("--smaller", type=int, help="SMALLER bytes")
    ps.add_argument("--header", action="append",
                    help='Arbitrary "Header-Name: value" (repeatable)')

    pr = sub.add_parser("read", help="Read full message by UID")
    pr.add_argument("uid", type=int)
    pr.add_argument("-m", "--mailbox", default="INBOX")
    pr.add_argument("--include-html", action="store_true",
                    help="Include HTML body in output (large)")

    pv = sub.add_parser("save", help="Save raw .eml files for one or more messages")
    pv.add_argument("uids", type=int, nargs="*",
                    help="UIDs to save. If omitted, use the --... search flags.")
    pv.add_argument("-m", "--mailbox", default="INBOX")
    pv.add_argument("-d", "--dir", default="artifacts/roundcube",
                    help="Output directory (default: artifacts/roundcube)")
    pv.add_argument("--name", help="Override filename (single-UID save only)")
    pv.add_argument("--skip-existing", action="store_true",
                    help="Skip UIDs whose target file already exists")
    pv.add_argument("-n", "--limit", type=int, default=20,
                    help="Max messages to save when using search criteria")
    pv.add_argument("--from", dest="from_")
    pv.add_argument("--to")
    pv.add_argument("--cc")
    pv.add_argument("--subject")
    pv.add_argument("--body")
    pv.add_argument("--text")
    pv.add_argument("--since")
    pv.add_argument("--before")
    pv.add_argument("--on")
    pv.add_argument("--unseen", action="store_true")
    pv.add_argument("--seen", action="store_true")
    pv.add_argument("--flagged", action="store_true")
    pv.add_argument("--answered", action="store_true")
    pv.add_argument("--larger", type=int)
    pv.add_argument("--smaller", type=int)
    pv.add_argument("--header", action="append")

    return p


def main():
    args = build_parser().parse_args()
    cfg = load_config(Path(args.config_dir))
    imap = connect(cfg)
    try:
        handlers = {
            "mailboxes": cmd_mailboxes,
            "count": cmd_count,
            "list": cmd_list,
            "search": cmd_search,
            "read": cmd_read,
            "save": cmd_save,
        }
        result = handlers[args.command](imap, args)
    finally:
        try:
            imap.logout()
        except Exception:
            pass
    if args.pretty:
        pretty_print(result)
    else:
        print(json.dumps(result, indent=2, default=str, ensure_ascii=False))


if __name__ == "__main__":
    main()
