#!/usr/bin/env python3
"""Read-only preservation audit. Never publishes content or connects to a database.

Run from a checked-out repository:
    python3 scripts/verify_preserved_assets.py --root . --output asset-integrity.json
A passing result means files are intact, NOT that the storefront is restored.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any


def safe_repo_file(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise ValueError("Expected a relative repository path")
    if ".." in Path(relative).parts:
        raise ValueError("Path traversal is not allowed")
    result = (root / relative).resolve()
    if not result.is_relative_to(root):
        raise ValueError("File resolves outside the repository")
    return result


def audit(root: Path) -> dict[str, Any]:
    root = root.resolve(strict=True)
    manifest_path = safe_repo_file(root, "docs/legacy-assets-manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, list) or not manifest:
        raise ValueError("Preservation manifest must be a nonempty array")
    checks: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in manifest:
        if not isinstance(entry, dict):
            raise ValueError("Invalid manifest entry")
        relative = entry.get("path", "")
        if relative in seen:
            raise ValueError("Duplicate asset in manifest: " + relative)
        seen.add(relative)
        if not relative.startswith("apps/web/public/legacy/"):
            raise ValueError("Unexpected asset namespace")
        digest = entry.get("sha256", "")
        size = entry.get("bytes")
        if not re.fullmatch(r"[0-9a-f]{64}", digest) or type(size) is not int or size < 1:
            raise ValueError("Missing valid hash/size: " + relative)
        check: dict[str, Any] = {"path": relative, "expected_sha256": digest, "expected_bytes": size}
        try:
            data = safe_repo_file(root, relative).read_bytes()
            actual = hashlib.sha256(data).hexdigest()
            check.update(actual_sha256=actual, actual_bytes=len(data), passed=(actual == digest and len(data) == size))
        except (OSError, ValueError) as exc:
            check.update(passed=False, error=str(exc))
        checks.append(check)

    seed = safe_repo_file(root, "apps/api/sql/006_unified_catalog.sql").read_text(encoding="utf-8")
    match = re.search(r"\bVALUES\s*\n(.*?)\nON CONFLICT", seed, flags=re.DOTALL)
    if not match:
        raise ValueError("Could not identify preserved reference records")
    reference_rows = re.findall(r"^\('(?:[^']|'')*',", match.group(1), flags=re.MULTILINE)
    image_paths = re.findall(r"'(/legacy/[^'\r\n]+\.(?:png|jpe?g|webp))'", match.group(1), flags=re.IGNORECASE)
    missing_images = [p for p in image_paths if not safe_repo_file(root, "apps/web/public" + p).is_file()]
    historical_only = "CHECK (is_sellable = false)" in seed
    required_sources = [
        "apps/web/src/lib/archive-catalog.ts",
        "apps/web/src/lib/archived-reference.ts",
        "apps/web/src/lib/merchandising.ts",
        "apps/web/src/components/hero-carousel.tsx",
    ]
    missing_sources = [p for p in required_sources if not safe_repo_file(root, p).is_file()]
    integrity_pass = all(c["passed"] for c in checks) and len(reference_rows) == 19 and not missing_images and not missing_sources and historical_only
    return {
        "purpose": "internal data preservation, not publication or purchase enablement",
        "asset_count": len(checks),
        "asset_hashes_passed": sum(c["passed"] for c in checks),
        "reference_rows": len(reference_rows),
        "reference_image_count": len(image_paths),
        "missing_reference_images": missing_images,
        "missing_source_files": missing_sources,
        "historical_read_only_constraint_present": historical_only,
        "file_integrity_passed": integrity_pass,
        "database_queried": False,
        "database_migrated": False,
        "storefront_restored": False,
        "content_published": False,
        "files": checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Checked-out repository root")
    parser.add_argument("--output", type=Path, help="Optional new JSON report path; refuses overwrite")
    args = parser.parse_args()
    try:
        report = audit(args.root)
        rendered = json.dumps(report, indent=2, ensure_ascii=True) + "\n"
        if args.output:
            with args.output.open("x", encoding="utf-8") as out:
                out.write(rendered)
        brief = {k: v for k, v in report.items() if k != "files"}
        print(json.dumps(brief, indent=2, ensure_ascii=True))
        return 0 if report["file_integrity_passed"] else 1
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("Preservation audit failed: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
