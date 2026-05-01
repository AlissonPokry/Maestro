#!/usr/bin/env python3
"""Print Maestro's selected bundle folder and Known Bundles table."""

from __future__ import annotations

import argparse
import pathlib

try:
    import maestro_fetch as fetch
except ImportError as exc:  # pragma: no cover
    raise SystemExit(f"cannot import maestro_fetch.py from script directory: {exc}")


def known_rows(skill_file: pathlib.Path):
    text = fetch.read_text(skill_file, limit=1_000_000)
    return fetch.parse_existing(fetch.known_bundles_block(text))


def main() -> int:
    parser = argparse.ArgumentParser(description="Print Maestro Known Bundles table.")
    parser.add_argument(
        "--skill-file",
        default=str(pathlib.Path(__file__).resolve().parents[1] / "SKILL.md"),
        help="Maestro SKILL.md path. Defaults to this skill's SKILL.md.",
    )
    args = parser.parse_args()

    skill_file = pathlib.Path(args.skill_file).expanduser().resolve()
    if not skill_file.is_file():
        raise SystemExit(f"skill file not readable: {skill_file}")

    bundle_root = fetch.load_saved_bundle_root(skill_file)
    print("## Known Bundles")
    print()
    print(fetch.render_bundle_root(bundle_root))
    print()
    print(fetch.render_index(known_rows(skill_file)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

