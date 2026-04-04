#!/usr/bin/env python3
"""
Process a Curated Test Collection — resolve references, inject tags, report missing specs.

A collection is an XLSX workbook at test-docs/collections/<name>/<name>.xlsx with a
COL-<name> sheet that references test cases from other modules. Processing:
  1. Parses the collection XLSX
  2. Resolves each reference against the main manifest (test-cases.json)
  3. For specs that exist: injects @col-<name> tag into the test title
  4. For specs that don't exist: records them as needing generation
  5. Outputs a report JSON at autotests/manifest/collection-<name>.json

Usage:
    python3 autotests/scripts/process_collection.py --collection <name> [--dry-run]
    python3 autotests/scripts/process_collection.py --collection absences
    python3 autotests/scripts/process_collection.py --collection absences --dry-run
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl not installed. Run: pip3 install openpyxl", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# Module name → spec filename prefix mapping
MODULE_SPEC_PREFIX = {
    "vacation": "vacation",
    "day-off": "dayoff",
    "cross-service": "cross-service",
    "planner": "planner",
    "reports": "reports",
    "sick-leave": "sick-leave",
    "accounting": "accounting",
    "statistics": "statistics",
    "admin": "admin",
    "security": "security",
}

# test_id pattern: TC-XXX-NNN → extract the numeric part
TC_NUM_RE = re.compile(r"TC-[A-Z0-9]+-(\d+)")


def parse_collection_xlsx(xlsx_path: Path) -> list[dict]:
    """Parse a collection XLSX and return list of reference entries."""
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)

    col_sheet = None
    for name in wb.sheetnames:
        if name.startswith("COL-"):
            col_sheet = wb[name]
            break

    if col_sheet is None:
        print(f"ERROR: No COL-* sheet found in {xlsx_path}", file=sys.stderr)
        sys.exit(1)

    entries = []
    for row_idx, row in enumerate(col_sheet.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0]:
            continue
        test_id = str(row[0]).strip()
        if not test_id.startswith("TC-"):
            continue
        entries.append({
            "test_id": test_id,
            "source_module": str(row[1] or "").strip(),
            "source_suite": str(row[2] or "").strip(),
            "title": str(row[3] or "").strip(),
            "inclusion_reason": str(row[4] or "").strip(),
            "priority_override": str(row[5] or "").strip(),
        })

    wb.close()
    return entries


def load_manifest(manifest_path: Path) -> dict:
    """Load the test-cases.json manifest."""
    if not manifest_path.exists():
        print(f"ERROR: Manifest not found: {manifest_path}", file=sys.stderr)
        print("Run: python3 autotests/scripts/parse_xlsx.py", file=sys.stderr)
        sys.exit(1)
    with open(manifest_path) as f:
        return json.load(f)


def find_spec_path(module: str, test_id: str) -> Path | None:
    """Find the spec file path for a test case. Returns None if not found."""
    prefix = MODULE_SPEC_PREFIX.get(module)
    if not prefix:
        return None

    match = TC_NUM_RE.search(test_id)
    if not match:
        return None

    num = match.group(1)
    # Spec naming: <prefix>-tc<num>.spec.ts (num without leading zeros for some, with for others)
    # Try both zero-padded and non-padded
    tests_dir = PROJECT_ROOT / "autotests" / "e2e" / "tests" / module

    candidates = [
        tests_dir / f"{prefix}-tc{num}.spec.ts",
        tests_dir / f"{prefix}-tc{num.lstrip('0') or '0'}.spec.ts",
        tests_dir / f"{prefix}-tc{num.zfill(3)}.spec.ts",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def add_tag_to_spec(spec_path: Path, tag: str, dry_run: bool = False) -> bool:
    """Add a collection tag to the test title in a spec file. Returns True if modified."""
    content = spec_path.read_text(encoding="utf-8")

    if tag in content:
        return False  # Already has the tag

    # Match the test() title line: test("TC-XXX-NNN: ... @tag1 @tag2", async
    # Insert the new tag before the closing quote
    pattern = re.compile(r'(test\("TC-[A-Z0-9]+-\d+:.*?@\w[\w-]*)(")')
    match = pattern.search(content)
    if not match:
        return False  # Could not find the test title pattern

    new_content = content[: match.end(1)] + " " + tag + content[match.start(2) :]

    if not dry_run:
        spec_path.write_text(new_content, encoding="utf-8")
    return True


def resolve_in_manifest(manifest: dict, test_id: str, module: str) -> dict | None:
    """Find a test case in the manifest by test_id and module."""
    mod = manifest.get("modules", {}).get(module, {})
    for suite_name, suite in mod.get("suites", {}).items():
        for tc in suite.get("test_cases", []):
            if tc.get("test_id") == test_id:
                return tc
    return None


def process_collection(collection_name: str, dry_run: bool = False) -> dict:
    """Process a collection: parse XLSX, inject tags, produce report."""
    xlsx_path = PROJECT_ROOT / "test-docs" / "collections" / collection_name / f"{collection_name}.xlsx"
    if not xlsx_path.exists():
        print(f"ERROR: Collection XLSX not found: {xlsx_path}", file=sys.stderr)
        sys.exit(1)

    manifest_path = PROJECT_ROOT / "autotests" / "manifest" / "test-cases.json"
    manifest = load_manifest(manifest_path)

    entries = parse_collection_xlsx(xlsx_path)
    tag = f"@col-{collection_name}"

    results = []
    tagged_count = 0
    already_tagged = 0
    needs_generation = 0
    not_in_manifest = 0

    for entry in entries:
        test_id = entry["test_id"]
        module = entry["source_module"]

        # Resolve in manifest
        manifest_tc = resolve_in_manifest(manifest, test_id, module)
        if manifest_tc is None:
            results.append({
                "test_id": test_id,
                "module": module,
                "spec_file": None,
                "action": "not_in_manifest",
                "detail": f"Test case {test_id} not found in manifest for module {module}",
            })
            not_in_manifest += 1
            continue

        # Check if spec exists
        spec_path = find_spec_path(module, test_id)

        if spec_path is not None:
            modified = add_tag_to_spec(spec_path, tag, dry_run=dry_run)
            if modified:
                action = "tag_added" if not dry_run else "tag_would_add"
                tagged_count += 1
            else:
                action = "tag_already_present"
                already_tagged += 1

            results.append({
                "test_id": test_id,
                "module": module,
                "spec_file": str(spec_path.relative_to(PROJECT_ROOT)),
                "action": action,
            })
        else:
            results.append({
                "test_id": test_id,
                "module": module,
                "spec_file": None,
                "action": "needs_generation",
                "manifest_title": manifest_tc.get("title", ""),
                "manifest_type": manifest_tc.get("classified_type", manifest_tc.get("type", "")),
                "manifest_priority": entry.get("priority_override") or manifest_tc.get("priority", ""),
            })
            needs_generation += 1

    report = {
        "collection_name": collection_name,
        "tag": tag,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "total_cases": len(entries),
        "summary": {
            "tags_added": tagged_count,
            "tags_already_present": already_tagged,
            "needs_generation": needs_generation,
            "not_in_manifest": not_in_manifest,
        },
        "cases": results,
    }

    return report


def main():
    parser = argparse.ArgumentParser(description="Process a Curated Test Collection")
    parser.add_argument("--collection", required=True, help="Collection name (e.g., absences)")
    parser.add_argument("--dry-run", action="store_true", help="Report without modifying files")
    args = parser.parse_args()

    print(f"Processing collection: {args.collection}" + (" [DRY RUN]" if args.dry_run else ""))

    report = process_collection(args.collection, dry_run=args.dry_run)

    # Save report
    report_path = PROJECT_ROOT / "autotests" / "manifest" / f"collection-{args.collection}.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    # Print summary
    s = report["summary"]
    print(f"\n{'=' * 60}")
    print(f"Collection: {report['collection_name']}")
    print(f"Tag:        {report['tag']}")
    print(f"Total:      {report['total_cases']} test cases")
    print(f"{'=' * 60}")
    print(f"  Tags added:           {s['tags_added']}")
    print(f"  Already tagged:       {s['tags_already_present']}")
    print(f"  Needs generation:     {s['needs_generation']}")
    print(f"  Not in manifest:      {s['not_in_manifest']}")
    print(f"{'=' * 60}")
    print(f"Report saved: {report_path}")

    if s["needs_generation"] > 0:
        print(f"\nTest cases needing generation:")
        for case in report["cases"]:
            if case["action"] == "needs_generation":
                print(f"  {case['test_id']} ({case['module']}) — {case.get('manifest_title', '')[:60]}")

    if s["not_in_manifest"] > 0:
        print(f"\nWARNING: Test cases not found in manifest:")
        for case in report["cases"]:
            if case["action"] == "not_in_manifest":
                print(f"  {case['test_id']} ({case['module']}) — {case.get('detail', '')}")


if __name__ == "__main__":
    main()
