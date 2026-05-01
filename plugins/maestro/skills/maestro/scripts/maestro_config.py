#!/usr/bin/env python3
"""Read or update Maestro's saved skill-bundle-folder."""

from __future__ import annotations

import argparse
import json
import pathlib
from typing import Dict, Optional

try:
    import maestro_fetch as fetch
except ImportError as exc:  # pragma: no cover
    raise SystemExit(f"cannot import maestro_fetch.py from script directory: {exc}")


def result(status: str, skill_file: pathlib.Path, bundle_root: Optional[pathlib.Path] = None, message: Optional[str] = None) -> Dict[str, object]:
    payload: Dict[str, object] = {
        "status": status,
        "skill_file": str(skill_file),
        "config_file": str(fetch.config_file(skill_file)),
    }
    if bundle_root is not None:
        payload["bundle_root"] = str(bundle_root)
        payload["exists"] = bundle_root.is_dir()
    if message:
        payload["message"] = message
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Read or update Maestro's saved skill-bundle-folder.")
    parser.add_argument("command", choices=("get", "set"), help="Use get to read the saved path, set to replace it.")
    parser.add_argument("bundle_root", nargs="?", help="New skill-bundle-folder path for set.")
    parser.add_argument(
        "--skill-file",
        default=str(pathlib.Path(__file__).resolve().parents[1] / "SKILL.md"),
        help="Maestro SKILL.md path. Defaults to this skill's SKILL.md.",
    )
    parser.add_argument("--text", action="store_true", help="Print compact text instead of JSON.")
    args = parser.parse_args()

    skill_file = pathlib.Path(args.skill_file).expanduser().resolve()
    if not skill_file.is_file():
        raise SystemExit(f"skill file not readable: {skill_file}")

    if args.command == "get":
        bundle_root = fetch.load_saved_bundle_root(skill_file)
        if bundle_root is None:
            payload = result("missing", skill_file, message="bundle root not configured")
        else:
            payload = result("configured", skill_file, bundle_root=bundle_root)
    else:
        if not args.bundle_root:
            raise SystemExit("bundle_root required for set")
        bundle_root = pathlib.Path(args.bundle_root).expanduser().resolve()
        if not bundle_root.is_dir():
            raise SystemExit(f"bundle root not readable: {bundle_root}")
        fetch.save_bundle_root(skill_file, bundle_root)
        payload = result("configured", skill_file, bundle_root=bundle_root)

    if args.text:
        print(payload["status"])
        if "bundle_root" in payload:
            print(f"bundle_root: {payload['bundle_root']}")
        if "message" in payload:
            print(payload["message"])
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


