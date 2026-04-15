---
name: confluence-access
description: >
  Access the Confluence instance at projects.noveogroup.com — read pages, list page trees,
  download attachments (screenshots, images, documents), and search for pages within the
  Time Tracking Tool (TTT) and Company Staff (CS) project documentation. Use this skill whenever the user mentions
  a Confluence page, pastes a projects.noveogroup.com URL, asks to read/fetch/summarize
  Confluence documentation, asks about TTT or CS documentation structure, or wants to download
  images/screenshots from Confluence pages. Also use it when the user references
  TTT/Time Tracking Tool/Time Reporting Tool documentation, CS/Company Staff documentation
  (not GitLab issues — those go to the gitlab-access skill),
  asks to "list all Confluence pages", "read the vacations page",
  "download screenshots from Confluence", "search Confluence for X", or "build a page tree".
  If the user mentions both Confluence and GitLab, use this skill for the Confluence parts.
---

# Confluence Access — TTT + CS

**Scope:**
- TTT: full (primary project — Time Tracking Tool documentation tree)
- CS: full (secondary project — Company Staff documentation subtree)

This skill provides instructions for interacting with the **Time Tracking Tool** and **Company Staff**
documentation on the self-hosted Confluence Server instance at `projects.noveogroup.com`. Both project subtrees live under the `NOV` space.

| Project | Root page ID | Root page URL |
|---------|--------------|---------------|
| TTT (Time Tracking Tool) | `18940713` | https://projects.noveogroup.com/spaces/NOV/pages/18940713/Time+Tracking+Tool |
| CS (Company Staff) | `32899211` | https://projects.noveogroup.com/spaces/NOV/pages/32899211/Company+Staff |

When the user does not name a project, default to TTT. When a Confluence URL is pasted, infer the project from the page tree (any descendant of `32899211` is CS; otherwise TTT).

The bulk of this skill below is written for TTT specifically; the same MCP tools (`mcp__confluence__*`) apply to CS — substitute the CS root page ID and the same access patterns.

| Field | Value |
|---|---|
| Project name | Time Tracking Tool (TTT) / Time Reporting Tool |
| Space key | `NOV` |
| Root page ID | `18940713` |
| Root page URL | https://projects.noveogroup.com/spaces/NOV/pages/18940713/Time+Tracking+Tool |
| Total pages | ~49 (as of Feb 2026) |

All operations below work within this root page and its descendants.

## Authentication

The Personal Access Token is stored in `.claude/.mcp.json` under the `confluence` server
config → `env.CONFLUENCE_PERSONAL_TOKEN`.

Read that file at the start of any Confluence operation to get the current token:

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('.claude/.mcp.json'))['mcpServers']['confluence']['env']['CONFLUENCE_PERSONAL_TOKEN'])")
```

All API requests use Bearer auth:
```bash
curl -s -H "Authorization: Bearer $TOKEN" "$URL"
```

## API Base

```
https://projects.noveogroup.com/rest/api/content
```

---

## 1. Reading a Page

Given a URL like `.../pages/130385085/Vacations+...` or just a page ID, extract the
numeric page ID and fetch:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://projects.noveogroup.com/rest/api/content/$PAGE_ID?expand=body.storage"
```

The response JSON contains:
- `title` — page title
- `body.storage.value` — HTML body content
- `id`, `type`, `status`

### Extracting Page ID from URL

Confluence URLs follow this pattern:
```
https://projects.noveogroup.com/spaces/NOV/pages/{PAGE_ID}/{Page+Title}
```

Extract the numeric ID between `/pages/` and the next `/`:
```python
import re
page_id = re.search(r'/pages/(\d+)', url).group(1)
```

### Extracting Readable Text from HTML Body

The `body.storage.value` is Confluence storage format (HTML with `ac:` macros).
Strip tags and decode entities to get plain text:

```python
import re, html
body_html = data['body']['storage']['value']
text = re.sub(r'<[^>]+>', ' ', body_html)
text = html.unescape(text)
text = re.sub(r'\s+', ' ', text).strip()
```

### Extracting Image References

Images in the body use Confluence macros:
```xml
<ac:image ac:height="400">
  <ri:attachment ri:filename="image-2025-7-24_15-31-4.png" />
</ac:image>
```

Extract filenames:
```python
images = re.findall(r'ri:filename="([^"]+)"', body_html)
```

These correspond to attachments on the page (see section 3 for downloading).

---

## 2. Listing Pages / Building a Page Tree

### Direct Children of a Page

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://projects.noveogroup.com/rest/api/content/$PAGE_ID/child/page?limit=100"
```

Returns `results[]` array with `id`, `title` for each child page.

### Full Recursive Tree

To build the complete page tree, use BFS — start from the root page (18940713) and
recursively fetch children for each node:

```python
import json, urllib.request

TOKEN = "..."  # read from .mcp.json
BASE = "https://projects.noveogroup.com/rest/api/content"

def get_children(page_id):
    url = f"{BASE}/{page_id}/child/page?limit=100"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        return [(str(r['id']), r['title']) for r in data.get('results', [])]

tree = {}
titles = {"18940713": "Time Tracking Tool"}
queue = ["18940713"]
visited = set()

while queue:
    pid = queue.pop(0)
    if pid in visited:
        continue
    visited.add(pid)
    children = get_children(pid)
    tree[pid] = children
    for cid, title in children:
        titles[cid] = title
        queue.append(cid)
```

The CQL search approach (`ancestor=18940713`) returns a flat list of all descendants
but loses parent-child relationships. Use it only for keyword search (section 4), not
for building the tree.

### Printing the Tree

```python
def print_tree(node_id, prefix="", is_last=True):
    title = titles.get(node_id, "???")
    has_kids = bool(tree.get(node_id, []))
    icon = "📁" if has_kids else "📄"
    if node_id == "18940713":
        print(f"{icon} {title}")
    else:
        connector = "└── " if is_last else "├── "
        print(f"{prefix}{connector}{icon} {title}")
    new_prefix = prefix + ("    " if is_last else "│   ")
    kids = tree.get(node_id, [])
    for i, (cid, _) in enumerate(kids):
        print_tree(cid, new_prefix, i == len(kids) - 1)

print_tree("18940713")
```

---

## 3. Downloading Attachments

### List Attachments on a Page

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://projects.noveogroup.com/rest/api/content/$PAGE_ID/child/attachment?limit=50"
```

Each attachment in `results[]` has:
- `title` — filename
- `_links.download` — relative download path

### Download All Attachments

Save to `artifacts/confluence/` by default (create the directory first):

```bash
mkdir -p artifacts/confluence

# Get attachment list and download each file
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/$PAGE_ID/child/attachment?limit=50" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for att in data.get('results', []):
    title = att['title']
    dl = att['_links']['download']
    print(f'{title}|{dl}')
" > /tmp/confluence_attachments.txt

while IFS='|' read -r filename path; do
    curl -s -H "Authorization: Bearer $TOKEN" \
      -o "artifacts/confluence/$filename" \
      "https://projects.noveogroup.com${path}"
    echo "Downloaded: $filename"
done < /tmp/confluence_attachments.txt
```

Verify downloads with `ls -lh artifacts/confluence/` — real images will be several KB
or more. If they're tiny HTML files, auth has failed.

---

## 4. Searching Pages

Use CQL (Confluence Query Language) scoped to the TTT root page:

```bash
# Search by keyword
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://projects.noveogroup.com/rest/api/content/search?cql=ancestor=18940713+and+type=page+and+text~\"KEYWORD\"&limit=50"
```

Results are in `results[]`, each with a nested `content` object containing `id` and `title`.

### Search Examples

```bash
# Find pages mentioning "vacation"
cql='ancestor=18940713+and+type=page+and+text~"vacation"'

# Find pages mentioning "sprint 14"
cql='ancestor=18940713+and+type=page+and+text~"sprint 14"'

# Find pages by title
cql='ancestor=18940713+and+type=page+and+title~"release notes"'
```

### Parsing Search Results

```python
import json, sys
data = json.load(sys.stdin)
for r in data.get('results', []):
    content = r.get('content', r)
    print(f"{content['id']} | {content['title']}")
```

---

## 5. Page Structure Reference

The TTT section has ~49 pages organized as follows (major sections):

| Section | Children | Content |
|---|---|---|
| TTT Requirements | 8 pages | Functional specs: Vacations, Accounting, Planner, Statistics, Confirmation |
| TTT Release notes | 12 pages | Sprint release notes from 2020 through Sprint 15 |
| TTT CustDev | 7 pages | Customer development, feature requests, sick leave |
| TTT Ретроспективы | 4 pages | Sprint retrospectives |
| Testing docs | 4 pages | API tests, front-end tests, BDD integration |
| Top-level pages | 14 pages | Roadmap, cron, WebSocket, frontend, AI tools, integrations |

Key page IDs for common lookups:
- Root (TTT): `18940713`
- Vacations / Отпуск: `130385085`
- TTT Requirements: `119244529`
- TTT Release notes: `18943945`
- Roadmap: `18947016`
- TTT CustDev: `32902116`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Token expired or wrong | Re-read token from `.claude/.mcp.json` |
| Empty results array | Wrong page ID or no children | Verify page ID from URL |
| Downloaded file is HTML | Auth failed on download | Check Bearer token is included |
| Search returns nothing | CQL syntax error | Check quoting and URL encoding |
| Flat tree (no nesting) | Used CQL search instead of child API | Use recursive child/page approach for tree |
