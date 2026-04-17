#!/usr/bin/env python3
"""Create a GitLab issue in noveo-internal-tools/ttt-spring with labels, assignee, and links.

Handles the quirks of GitLab CE 16.11 at gitlab.noveogroup.com:
- TLS chain requires verify=False.
- assignee_ids is silently dropped on form-encoded POST — we use JSON POST and
  fall back to PUT if the response shows empty assignees.
- link_type `is_blocked_by` returns HTTP 400; `relates_to` and `blocks` work.
- Labels are case-sensitive; we verify each one exists before posting and abort
  on a mismatch so nothing is silently dropped.

Usage:
    create_issue.py --title "[QA Automation] My task" \\
                    --body-file docs/tasks/foo/foo.md \\
                    --labels "Sprint 16,Auto QA,In Progress" \\
                    --assignee vulyanov \\
                    --link 3402 --link 3417:blocks
"""
from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

GITLAB_BASE = "https://gitlab.noveogroup.com/api/v4"
DEFAULT_PROJECT_ID = 1288
MCP_CONFIG_PATH = ".claude/.mcp.json"


def die(msg: str, code: int = 1) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def read_token() -> str:
    path = Path(MCP_CONFIG_PATH)
    if not path.exists():
        die(f"{MCP_CONFIG_PATH} not found; run from the repo root")
    text = path.read_text()
    m = re.search(r'"GITLAB_PERSONAL_ACCESS_TOKEN"\s*:\s*"([^"]+)"', text)
    if not m:
        die("GITLAB_PERSONAL_ACCESS_TOKEN not found in .claude/.mcp.json")
    return m.group(1)


def _ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def api(
    method: str,
    path: str,
    token: str,
    *,
    json_body: Any | None = None,
    query: dict[str, str] | None = None,
) -> Any:
    url = f"{GITLAB_BASE}{path}"
    if query:
        url += "?" + urllib.parse.urlencode(query)
    data = json.dumps(json_body).encode() if json_body is not None else None
    headers = {"PRIVATE-TOKEN": token}
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=_ssl_ctx()) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        die(f"HTTP {e.code} {method} {path}: {body[:500]}")


def verify_labels(labels: list[str], project_id: int, token: str) -> None:
    """Abort if any requested label doesn't exist with exact casing."""
    missing: list[str] = []
    for label in labels:
        hits = api(
            "GET",
            f"/projects/{project_id}/labels",
            token,
            query={"search": label, "per_page": "100"},
        )
        names = {h["name"] for h in (hits or [])}
        if label not in names:
            suggestions = [n for n in names if n.lower() == label.lower()]
            if suggestions:
                missing.append(f"'{label}' (did you mean '{suggestions[0]}'?)")
            else:
                missing.append(f"'{label}' (no match)")
    if missing:
        die("label casing mismatch: " + "; ".join(missing))


def resolve_assignee(username: str, token: str) -> int:
    users = api("GET", "/users", token, query={"username": username})
    if not users:
        die(f"user '{username}' not found")
    return int(users[0]["id"])


def create_issue(
    *,
    project_id: int,
    title: str,
    body: str,
    labels: list[str],
    assignee_id: int | None,
    token: str,
) -> dict:
    payload = {"title": title, "description": body}
    if labels:
        payload["labels"] = ",".join(labels)
    if assignee_id is not None:
        payload["assignee_ids"] = [assignee_id]
    issue = api("POST", f"/projects/{project_id}/issues", token, json_body=payload)
    # Some GitLab CE versions silently drop assignee_ids on POST — compensate via PUT.
    if assignee_id is not None and not issue.get("assignees"):
        issue = api(
            "PUT",
            f"/projects/{project_id}/issues/{issue['iid']}",
            token,
            json_body={"assignee_ids": [assignee_id]},
        )
    return issue


def link_issue(
    *,
    project_id: int,
    source_iid: int,
    target_iid: int,
    link_type: str,
    token: str,
) -> None:
    if link_type not in {"relates_to", "blocks"}:
        die(
            f"link_type '{link_type}' not supported on CE 16.11 "
            "(use 'relates_to' or 'blocks')"
        )
    api(
        "POST",
        f"/projects/{project_id}/issues/{source_iid}/links",
        token,
        json_body={
            "target_project_id": project_id,
            "target_issue_iid": target_iid,
            "link_type": link_type,
        },
    )


def parse_link_flag(s: str) -> tuple[int, str]:
    if ":" in s:
        iid_str, link_type = s.split(":", 1)
    else:
        iid_str, link_type = s, "relates_to"
    if not iid_str.isdigit():
        die(f"--link expects <iid> or <iid>:<link_type>, got '{s}'")
    return int(iid_str), link_type


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--title", required=True)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--body", help="Inline markdown body")
    g.add_argument("--body-file", help="Path to a markdown file whose contents become the body")
    p.add_argument("--labels", default="", help="Comma-separated exact label names")
    p.add_argument("--assignee", help="GitLab username (not display name)")
    p.add_argument(
        "--link",
        action="append",
        default=[],
        help="Related-issue link: <iid> or <iid>:<relates_to|blocks>. Repeatable.",
    )
    p.add_argument("--project-id", type=int, default=DEFAULT_PROJECT_ID)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    if args.body_file:
        body_path = Path(args.body_file)
        if not body_path.exists():
            die(f"body file not found: {args.body_file}")
        body = body_path.read_text()
    else:
        body = args.body

    labels = [s.strip() for s in args.labels.split(",") if s.strip()]
    links = [parse_link_flag(s) for s in args.link]

    if args.dry_run:
        print(json.dumps(
            {
                "project_id": args.project_id,
                "title": args.title,
                "labels": labels,
                "assignee": args.assignee,
                "links": links,
                "body_chars": len(body),
            },
            indent=2,
        ))
        return 0

    token = read_token()

    if labels:
        verify_labels(labels, args.project_id, token)

    assignee_id = resolve_assignee(args.assignee, token) if args.assignee else None

    issue = create_issue(
        project_id=args.project_id,
        title=args.title,
        body=body,
        labels=labels,
        assignee_id=assignee_id,
        token=token,
    )

    created_links: list[dict] = []
    for target_iid, link_type in links:
        link_issue(
            project_id=args.project_id,
            source_iid=issue["iid"],
            target_iid=target_iid,
            link_type=link_type,
            token=token,
        )
        created_links.append({"target_iid": target_iid, "link_type": link_type})

    result = {
        "iid": issue["iid"],
        "web_url": issue["web_url"],
        "title": issue["title"],
        "labels": issue.get("labels", []),
        "assignees": [a.get("username") for a in issue.get("assignees", [])],
        "links": created_links,
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
