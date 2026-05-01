#!/usr/bin/env python3
"""Update Maestro's known bundle index from a skill-bundle-folder."""

from __future__ import annotations

import argparse
import collections
import json
import pathlib
import re
import sys
from typing import Dict, Iterable, List, Tuple


START = " "
END = " "
ROOT_START = " "
ROOT_END = " "
KNOWN_HEADING = "## Known Bundles"
SELECTED_BUNDLE_PREFIX = "Selected bundle folder:"

TEXT_FILE_NAMES = {
    "skill.md",
    "readme.md",
    "readme.txt",
    "metadata.json",
    "agents/openai.yaml",
}
TEXT_SUFFIXES = {".md", ".markdown", ".skill", ".yaml", ".yml", ".txt", ".json"}
PATH_SIGNAL_SUFFIXES = TEXT_SUFFIXES | {".csv", ".tsv"}
SKIP_DIRS = {".git", ".hg", ".svn", "__pycache__", "node_modules", "dist", "build", ".next"}
MAX_DISCOVERY_FILES = 48
MAX_PATH_SIGNAL_FILES = 240
DOMAIN_SUFFIXES = (".com", ".org", ".net", ".io", ".dev", ".app")
CONFIG_FILE_NAME = "maestro_state.json"


def config_file(skill_file: pathlib.Path) -> pathlib.Path:
    return skill_file.resolve().parent / CONFIG_FILE_NAME


def load_saved_bundle_root(skill_file: pathlib.Path):
    try:
        data = json.loads(read_text(config_file(skill_file), limit=20000) or "{}")
    except json.JSONDecodeError:
        return None
    raw_path = data.get("bundle_root")
    if not raw_path:
        return None
    try:
        return pathlib.Path(str(raw_path)).expanduser().resolve()
    except OSError:
        return None


def save_bundle_root(skill_file: pathlib.Path, bundle_root: pathlib.Path) -> None:
    data = {"bundle_root": str(bundle_root.expanduser().resolve())}
    config_file(skill_file).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8", newline="\n")
    update_bundle_root_block(skill_file, bundle_root)

STOPWORDS = {
    "about",
    "added",
    "all",
    "and",
    "any",
    "are",
    "agent",
    "agents",
    "bundle",
    "bundles",
    "codex",
    "code",
    "community",
    "complete",
    "content",
    "core",
    "critical",
    "create",
    "csv",
    "data",
    "date",
    "default",
    "description",
    "directory",
    "end",
    "for",
    "file",
    "files",
    "folder",
    "folders",
    "from",
    "guide",
    "https",
    "guidelines",
    "help",
    "instruction",
    "instructions",
    "maestro",
    "metadata",
    "medium",
    "needed",
    "new",
    "name",
    "project",
    "reference",
    "references",
    "required",
    "requirements",
    "risk",
    "run",
    "pro",
    "readme",
    "resources",
    "scripts",
    "source",
    "skill",
    "skill.md",
    "skills",
    "task",
    "tasks",
    "that",
    "the",
    "this",
    "todo",
    "tool",
    "tools",
    "unknown",
    "use",
    "user",
    "version",
    "when",
    "work",
    "apply",
    "bash",
    "best",
    "development",
    "documentation",
    "github",
    "high",
    "how",
    "including",
    "install",
    "limitations",
    "not",
    "pattern",
    "patterns",
    "practice",
    "practices",
    "review",
    "script",
    "step",
    "steps",
    "you",
    "with",
}


def words(text: str) -> Iterable[str]:
    for token in re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{1,}", text.lower()):
        token = token.strip("-_.")
        if len(token) < 3 or token in STOPWORDS:
            continue
        if token.endswith(DOMAIN_SUFFIXES):
            continue
        yield token


def read_text(path: pathlib.Path, limit: int = 24000) -> str:
    try:
        data = path.read_bytes()[:limit]
    except OSError:
        return ""
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding, errors="ignore")
        except UnicodeError:
            continue
    return ""


def is_skipped(path: pathlib.Path) -> bool:
    return any(part.lower() in SKIP_DIRS or part.startswith(".") for part in path.parts)


def add_candidate(candidates: List[pathlib.Path], path: pathlib.Path) -> None:
    if path.exists() and path.is_file() and path not in candidates:
        candidates.append(path)


def scope_candidates(scope: pathlib.Path) -> List[pathlib.Path]:
    candidates: List[pathlib.Path] = []
    for rel in ("SKILL.md", "README.md", "README.txt", "metadata.json", "agents/openai.yaml"):
        add_candidate(candidates, scope / rel)
    try:
        children = sorted(child for child in scope.iterdir() if child.is_file())
    except OSError:
        return candidates
    candidates.extend(children)
    return candidates

def discovery_files(bundle: pathlib.Path) -> List[pathlib.Path]:
    found: List[pathlib.Path] = []
    seen = set()
    candidates = scope_candidates(bundle)
    try:
        subdirs = sorted(child for child in bundle.iterdir() if child.is_dir() and not is_skipped(child.relative_to(bundle)))
    except OSError:
        subdirs = []
    for subdir in subdirs:
        candidates.extend(scope_candidates(subdir))

    for child in candidates:
        rel = child.relative_to(bundle).as_posix().lower() if child.exists() else ""
        if not child.is_file() or child in seen:
            continue
        if rel in TEXT_FILE_NAMES or child.suffix.lower() in TEXT_SUFFIXES:
            found.append(child)
            seen.add(child)
        if len(found) >= MAX_DISCOVERY_FILES:
            break
    return found


def path_signal_files(bundle: pathlib.Path) -> Iterable[pathlib.Path]:
    count = 0
    for path in sorted(bundle.rglob("*")):
        try:
            rel = path.relative_to(bundle)
        except ValueError:
            continue
        if is_skipped(rel) or path.is_dir() or path.suffix.lower() not in PATH_SIGNAL_SUFFIXES:
            continue
        yield path
        count += 1
        if count >= MAX_PATH_SIGNAL_FILES:
            break


def score_path(score: collections.Counter[str], rel: pathlib.PurePath, weight: int) -> None:
    for part in rel.parts:
        stem = pathlib.PurePath(part).stem
        for token in words(stem.replace("-", " ").replace("_", " ")):
            score[token] += weight


def infer_keywords(bundle: pathlib.Path, max_keywords: int = 32) -> List[str]:
    score: collections.Counter[str] = collections.Counter()

    score[bundle.name.lower()] += 14
    name_text = bundle.name.replace("-", " ").replace("_", " ")
    for token in words(name_text):
        score[token] += 8
    for part in re.split(r"[-_\s]+", bundle.name.lower()):
        if part and len(part) >= 3 and part not in STOPWORDS:
            score[part] += 10

    for child in sorted(bundle.iterdir()):
        weight = 6 if child.is_dir() else 3
        for token in words(child.stem.replace("-", " ").replace("_", " ")):
            score[token] += weight

    for path in path_signal_files(bundle):
        score_path(score, path.relative_to(bundle), 3)

    for path in discovery_files(bundle):
        rel = path.relative_to(bundle).as_posix()
        for token in words(rel.replace("/", " ").replace("-", " ").replace("_", " ")):
            score[token] += 2
        text = read_text(path)
        frontmatter = re.search(r"^---\s*(.*?)\s*---", text, re.S | re.M)
        if frontmatter:
            for token in words(frontmatter.group(1)):
                score[token] += 5
        for heading in re.findall(r"^#{1,3}\s+(.+)$", text, re.M):
            for token in words(heading):
                score[token] += 4
        for command in re.findall(r"`(/?[A-Za-z0-9_.:-]+)`", text):
            for token in words(command):
                score[token] += 4
        for token in words(text[:6000]):
            score[token] += 1

    ranked = sorted(score.items(), key=lambda item: (-item[1], item[0]))
    return [token for token, _ in ranked[:max_keywords]]


def parse_existing(block: str) -> Dict[str, Tuple[List[str], str]]:
    rows: Dict[str, Tuple[List[str], str]] = {}
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("|") or "---" in line or "Bundle" in line:
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        name, keyword_text, path = cells[:3]
        if not name:
            continue
        keywords = []
        for item in keyword_text.split(","):
            item = item.strip()
            if item and item.lower() not in STOPWORDS and not item.lower().endswith(DOMAIN_SUFFIXES):
                keywords.append(item)
        rows[name] = (keywords, path.strip("`"))
    return rows


def render_bundle_root(bundle_root: pathlib.Path = None) -> str:
    if bundle_root is None:
        return "Selected bundle folder: Not configured. Run `/maestro-switch <skill-bundle-folder>`."
    return f"Selected bundle folder: `{str(bundle_root.expanduser().resolve())}`"


def known_bundles_bounds(text: str) -> Tuple[int, int, int]:
    heading = re.search(r"(?m)^## Known Bundles\s*$", text)
    if not heading:
        raise SystemExit("Known Bundles section missing")
    content_start = heading.end()
    next_heading = re.search(r"(?m)^##\s+.+$", text[content_start:])
    content_end = content_start + next_heading.start() if next_heading else len(text)
    return heading.start(), content_start, content_end


def known_bundles_block(text: str) -> str:
    _, content_start, content_end = known_bundles_bounds(text)
    return text[content_start:content_end]


def render_known_bundles_section(rows: Dict[str, Tuple[List[str], str]], bundle_root: pathlib.Path = None) -> str:
    return KNOWN_HEADING + "\n" + render_bundle_root(bundle_root) + "\n\n" + render_index(rows) + "\n\n"


def set_known_bundles_section(text: str, rows: Dict[str, Tuple[List[str], str]], bundle_root: pathlib.Path = None) -> str:
    section_start, _, content_end = known_bundles_bounds(text)
    return text[:section_start] + render_known_bundles_section(rows, bundle_root) + text[content_end:].lstrip("\r\n")


def set_bundle_root_block(text: str, bundle_root: pathlib.Path = None) -> str:
    rows = parse_existing(known_bundles_block(text))
    return set_known_bundles_section(text, rows, bundle_root)


def update_bundle_root_block(skill_file: pathlib.Path, bundle_root: pathlib.Path = None) -> None:
    text = read_text(skill_file, limit=1_000_000)
    if not text:
        return
    skill_file.write_text(set_bundle_root_block(text, bundle_root), encoding="utf-8", newline="\n")


def render_index(rows: Dict[str, Tuple[List[str], str]]) -> str:
    if not rows:
        return "No bundles indexed yet. Run `/maestro-fetch <skill-bundle-folder>`."
    lines = [
        "| Bundle | Keywords | Path |",
        "| --- | --- | --- |",
    ]
    for name in sorted(rows, key=str.lower):
        keywords, path = rows[name]
        clean_keywords = ", ".join(dict.fromkeys(keywords))
        escaped_path = path.replace("|", r"\|")
        lines.append(f"| {name} | {clean_keywords} | `{escaped_path}` |")
    return "\n".join(lines)


def update_skill(skill_file: pathlib.Path, bundle_root: pathlib.Path, keep_missing: bool = False) -> Tuple[int, int, int, int]:
    text = read_text(skill_file, limit=1_000_000)
    old_block = known_bundles_block(text)
    rows = parse_existing(old_block)
    before_count = len(rows)
    existing_names = set(rows)
    scanned_rows: Dict[str, Tuple[List[str], str]] = {}

    for bundle in sorted(bundle_root.iterdir()):
        if not bundle.is_dir() or bundle.name.startswith("."):
            continue
        inferred = infer_keywords(bundle)
        existing_keywords, _ = rows.get(bundle.name, ([], ""))
        merged_keywords = list(dict.fromkeys(existing_keywords + inferred))[:36]
        scanned_rows[bundle.name] = (merged_keywords, str(bundle.resolve()))

    scanned_names = set(scanned_rows)
    added_count = len(scanned_names - existing_names)
    pruned_count = 0 if keep_missing else len(existing_names - scanned_names)
    if keep_missing:
        rows.update(scanned_rows)
        next_rows = rows
    else:
        next_rows = scanned_rows

    new_text = set_known_bundles_section(text, next_rows, bundle_root)
    skill_file.write_text(new_text, encoding="utf-8", newline="\n")
    return before_count, len(next_rows), added_count, pruned_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Update Maestro bundle index.")
    parser.add_argument("bundle_root", nargs="?", help="Folder containing immediate child skill bundles. If omitted, uses saved Maestro bundle root.")
    parser.add_argument(
        "--skill-file",
        default=str(pathlib.Path(__file__).resolve().parents[1] / "SKILL.md"),
        help="Maestro SKILL.md path. Defaults to this skill's SKILL.md.",
    )
    parser.add_argument(
        "--keep-missing",
        action="store_true",
        help="Keep existing index rows whose bundle folders are missing. Default prunes them.",
    )
    parser.add_argument(
        "--no-save-root",
        action="store_true",
        help="Do not save this bundle root as Maestro's default skill-bundle-folder.",
    )
    args = parser.parse_args()

    skill_file = pathlib.Path(args.skill_file).expanduser().resolve()
    if not skill_file.is_file():
        raise SystemExit(f"skill file not readable: {skill_file}")

    if args.bundle_root:
        bundle_root = pathlib.Path(args.bundle_root).expanduser().resolve()
    else:
        bundle_root = load_saved_bundle_root(skill_file)
        if bundle_root is None:
            raise SystemExit("bundle root not configured. Run /maestro-switch <skill-bundle-folder> or pass bundle_root.")

    if not bundle_root.is_dir():
        raise SystemExit(f"bundle root not readable: {bundle_root}")

    if not args.no_save_root:
        save_bundle_root(skill_file, bundle_root)

    _, after, added, pruned = update_skill(skill_file, bundle_root, keep_missing=args.keep_missing)
    print(f"indexed {after} bundles ({added} new, {pruned} pruned) in {skill_file} using {bundle_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())







