#!/usr/bin/env python3
"""Resolve a user request to Maestro bundle and sub-skill paths."""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
from typing import Dict, Iterable, List, Tuple

try:
    import maestro_fetch as fetch
except ImportError as exc:  # pragma: no cover
    raise SystemExit(f"cannot import maestro_fetch.py from script directory: {exc}")


ROUTE_STOPWORDS = fetch.STOPWORDS | {"want", "wants", "would", "need", "needs", "please", "imagine"}

ALIASES = {
    "e-commerce": {"ecommerce", "commerce", "shop", "store", "catalog", "product", "products", "retail", "buy"},
    "ecommerce": {"ecommerce", "commerce", "shop", "store", "catalog", "product", "products", "retail", "buy"},
    "commerce": {"ecommerce", "shop", "store", "catalog", "product", "products", "retail"},
    "website": {"web", "site", "frontend", "design", "page", "landing", "layout"},
    "site": {"web", "website", "frontend", "design", "page", "landing", "layout"},
    "landing": {"landing", "page", "hero", "cta", "conversion"},
    "frontend": {"front", "frontend", "ui", "ux", "component", "components"},
    "front-end": {"front", "frontend", "ui", "ux", "component", "components"},
    "backend": {"back", "backend", "api", "database", "service", "services"},
    "back-end": {"back", "backend", "api", "database", "service", "services"},
    "responsive": {"responsive", "mobile", "breakpoint", "container", "layout"},
}


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def expand_terms(text: str) -> List[str]:
    terms = set(fetch.words(text.replace("/", " ")))
    lower = text.lower()
    compact = re.sub(r"[^a-z0-9]+", "", lower)

    for key, values in ALIASES.items():
        key_lower = key.lower()
        key_compact = re.sub(r"[^a-z0-9]+", "", key_lower)
        if key_lower in lower or key_lower.replace("-", " ") in lower or key_compact in compact:
            terms.add(key_compact)
            terms.update(values)

    terms = {term for term in terms if term not in ROUTE_STOPWORDS}
    return sorted(terms)


def parse_index(skill_file: pathlib.Path) -> Dict[str, Tuple[List[str], str]]:
    text = fetch.read_text(skill_file, limit=1_000_000)
    return fetch.parse_existing(fetch.known_bundles_block(text))


def build_index_from_root(bundle_root: pathlib.Path) -> Dict[str, Tuple[List[str], str]]:
    rows: Dict[str, Tuple[List[str], str]] = {}
    for bundle in sorted(bundle_root.iterdir()):
        if not bundle.is_dir() or bundle.name.startswith("."):
            continue
        rows[bundle.name] = (fetch.infer_keywords(bundle), str(bundle.resolve()))
    return rows



def path_within(path: pathlib.Path, root: pathlib.Path) -> bool:
    try:
        path.expanduser().resolve().relative_to(root.expanduser().resolve())
        return True
    except (OSError, ValueError):
        return False


def filter_rows_by_root(rows: Dict[str, Tuple[List[str], str]], bundle_root: pathlib.Path) -> Dict[str, Tuple[List[str], str]]:
    filtered: Dict[str, Tuple[List[str], str]] = {}
    for name, (keywords, path) in rows.items():
        bundle_path = pathlib.Path(path)
        if path_within(bundle_path, bundle_root):
            filtered[name] = (keywords, str(bundle_path.expanduser().resolve()))
    return filtered

def token_set(text: str) -> set[str]:
    return {term for term in fetch.words(text.replace("/", " ").replace("_", " ").replace("-", " ")) if term not in ROUTE_STOPWORDS}


def keyword_terms(bundle_name: str, keywords: Iterable[str]) -> set[str]:
    terms = set(fetch.words(bundle_name.replace("-", " ").replace("_", " ")))
    terms.add(norm(bundle_name))
    for keyword in keywords:
        terms.add(keyword.lower())
        terms.add(norm(keyword))
        terms.update(fetch.words(keyword.replace("-", " ").replace("_", " ")))
    return {term for term in terms if term and term not in fetch.STOPWORDS}


def score_path_terms(path: pathlib.PurePath, query_terms: set[str], weight: int) -> Tuple[int, set[str]]:
    path_terms = set()
    for part in path.parts:
        path_terms.update(token_set(pathlib.PurePath(part).stem))
    matches = query_terms & path_terms
    return len(matches) * weight, matches


def scan_bundle(bundle_path: pathlib.Path, query_terms: set[str]) -> Tuple[int, set[str]]:
    if not bundle_path.is_dir():
        return 0, set()

    score = 0
    matches: set[str] = set()

    for path in fetch.path_signal_files(bundle_path):
        try:
            rel = path.relative_to(bundle_path)
        except ValueError:
            continue
        path_score, path_matches = score_path_terms(rel, query_terms, 4)
        score += path_score
        matches.update(path_matches)

    for path in fetch.discovery_files(bundle_path):
        try:
            rel = path.relative_to(bundle_path)
        except ValueError:
            rel = path
        path_score, path_matches = score_path_terms(rel, query_terms, 3)
        score += path_score
        matches.update(path_matches)

        text = fetch.read_text(path, limit=12000)
        frontmatter = re.search(r"^---\s*(.*?)\s*---", text, re.S | re.M)
        if frontmatter:
            fm_matches = query_terms & token_set(frontmatter.group(1))
            score += len(fm_matches) * 5
            matches.update(fm_matches)
        heading_text = "\n".join(re.findall(r"^#{1,3}\s+(.+)$", text, re.M))
        heading_matches = query_terms & token_set(heading_text)
        score += len(heading_matches) * 4
        matches.update(heading_matches)
        body_matches = query_terms & token_set(text[:6000])
        score += len(body_matches)
        matches.update(body_matches)

    return score, matches


def score_bundle(name: str, keywords: List[str], path: str, raw_query: str, query_terms: set[str], scan: bool) -> Dict[str, object]:
    terms = keyword_terms(name, keywords)
    matches = query_terms & terms
    score = len(matches) * 10

    raw_norm = norm(raw_query)
    name_norm = norm(name)
    if name_norm and name_norm in raw_norm:
        score += 100
        matches.add(name_norm)

    partial_matches = set()
    for query_term in query_terms:
        for term in terms:
            if len(query_term) >= 4 and len(term) >= 4 and (query_term in term or term in query_term):
                partial_matches.add(query_term)
                break
    score += len(partial_matches - matches) * 3
    matches.update(partial_matches)

    scan_score = 0
    if scan:
        scan_score, scan_matches = scan_bundle(pathlib.Path(path), query_terms)
        score += scan_score
        matches.update(scan_matches)

    return {
        "bundle": name,
        "bundle_path": path,
        "score": score,
        "index_score": score - scan_score,
        "scan_score": scan_score,
        "matched_terms": sorted(matches),
    }


def skill_files(bundle_path: pathlib.Path) -> List[pathlib.Path]:
    if not bundle_path.is_dir():
        return []
    files: List[pathlib.Path] = []
    for path in sorted(bundle_path.rglob("SKILL.md")):
        try:
            rel = path.relative_to(bundle_path)
        except ValueError:
            continue
        if fetch.is_skipped(rel):
            continue
        files.append(path)
        if len(files) >= 32:
            break
    return files


def score_skill_file(path: pathlib.Path, bundle_path: pathlib.Path, query_terms: set[str]) -> Tuple[int, List[str]]:
    try:
        rel = path.relative_to(bundle_path)
    except ValueError:
        rel = path
    score, matches = score_path_terms(rel, query_terms, 6)
    text = fetch.read_text(path, limit=16000)
    frontmatter = re.search(r"^---\s*(.*?)\s*---", text, re.S | re.M)
    if frontmatter:
        fm_matches = query_terms & token_set(frontmatter.group(1))
        score += len(fm_matches) * 5
        matches.update(fm_matches)
    heading_text = "\n".join(re.findall(r"^#{1,3}\s+(.+)$", text, re.M))
    heading_matches = query_terms & token_set(heading_text)
    score += len(heading_matches) * 4
    matches.update(heading_matches)
    body_matches = query_terms & token_set(text[:8000])
    score += len(body_matches)
    matches.update(body_matches)
    return score, sorted(matches)


def select_skills(bundle_path: pathlib.Path, query_terms: set[str], max_count: int) -> List[Dict[str, object]]:
    scored = []
    for path in skill_files(bundle_path):
        score, matches = score_skill_file(path, bundle_path, query_terms)
        scored.append({"path": str(path.resolve()), "score": score, "matched_terms": matches})
    scored.sort(key=lambda item: (-int(item["score"]), str(item["path"])))
    positives = [item for item in scored if int(item["score"]) > 0]
    return (positives or scored)[:max_count]




def route(args: argparse.Namespace) -> Dict[str, object]:
    skill_file = pathlib.Path(args.skill_file).expanduser().resolve()
    configured_root = fetch.load_saved_bundle_root(skill_file)
    explicit_root = pathlib.Path(args.bundle_root).expanduser().resolve() if args.bundle_root else None
    bundle_root = explicit_root or configured_root

    if bundle_root is None:
        return {
            "query": args.query,
            "status": "needs_bundle_root",
            "message": "Bundle folder not configured. Ask the user for the skill-bundle-folder path, then run /maestro-set <path>.",
        }
    if not bundle_root.is_dir():
        return {
            "query": args.query,
            "status": "invalid_bundle_root",
            "bundle_root": str(bundle_root),
            "message": "Saved bundle folder cannot be read. Ask for a valid path or run /maestro-set <path>.",
        }

    rows = filter_rows_by_root(parse_index(skill_file), bundle_root)
    if not rows:
        rows = build_index_from_root(bundle_root)
    if not rows:
        return {
            "query": args.query,
            "status": "no_index",
            "bundle_root": str(bundle_root),
            "message": "No bundle folders found. Run /maestro-fetch or /maestro-set with a folder containing bundle directories.",
        }

    query_terms = set(expand_terms(args.query))
    scored = [score_bundle(name, keywords, path, args.query, query_terms, not args.no_scan) for name, (keywords, path) in rows.items()]
    scored.sort(key=lambda item: (-int(item["score"]), str(item["bundle"])))

    positives = [item for item in scored if int(item["score"]) > 0]
    if not positives:
        return {
            "query": args.query,
            "bundle_root": str(bundle_root),
            "query_terms": sorted(query_terms),
            "status": "no_match",
            "candidates": scored[: args.max_bundles],
        }

    top_score = int(positives[0]["score"])
    threshold = max(args.min_score, int(top_score * args.secondary_ratio))
    selected = [item for item in positives if int(item["score"]) >= threshold][: args.max_bundles]

    for index, item in enumerate(selected):
        item["role"] = "primary" if index == 0 else "supporting"
        item["skill_paths"] = select_skills(pathlib.Path(str(item["bundle_path"])), query_terms, args.max_skills_per_bundle)

    result = {
        "query": args.query,
        "bundle_root": str(bundle_root),
        "query_terms": sorted(query_terms),
        "status": "matched",
        "terminology": {
            "bundle": "Immediate child folder of the selected skill-bundle-folder. Example: Angular-pro. A bundle is not a skill.",
            "skill": "Concrete SKILL.md file inside a selected bundle. Report these when the user asks which skills were used.",
        },
        "selected_bundles": selected,
        "other_candidates": [item for item in positives if item not in selected][: args.max_candidates],
        "agent_instruction": "Read only selected_bundles[].skill_paths first. selected_bundles[].bundle are bundles, not skills. Skills are selected_bundles[].skill_paths[].path. When reporting used skills, list skill_paths, not bundle names.",
    }
    return result


def print_text(result: Dict[str, object]) -> None:
    print(f"status: {result.get('status')}")
    if result.get("status") != "matched":
        print(result.get("message", "no route"))
        return
    print(f"query: {result.get('query')}")
    for bundle in result.get("selected_bundles", []):
        print(f"{bundle['role']}_bundle: {bundle['bundle']} score={bundle['score']} matched={', '.join(bundle['matched_terms'])}")
        print(f"  bundle_path: {bundle['bundle_path']}")
        for skill in bundle.get("skill_paths", []):
            print(f"  skill_file: {skill['path']} score={skill['score']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve a Maestro request to bundle and skill paths.")
    parser.add_argument("query", nargs="?", help="User task/request to route.")
    parser.add_argument("--query", dest="query_flag", help="User task/request to route.")
    parser.add_argument("--skill-file", default=str(pathlib.Path(__file__).resolve().parents[1] / "SKILL.md"), help="Maestro SKILL.md containing Known Bundles.")
    parser.add_argument("--bundle-root", help="Override saved bundle root for this routing run.")
    parser.add_argument("--max-bundles", type=int, default=4)
    parser.add_argument("--max-skills-per-bundle", type=int, default=4)
    parser.add_argument("--max-candidates", type=int, default=4)
    parser.add_argument("--min-score", type=int, default=8)
    parser.add_argument("--secondary-ratio", type=float, default=0.35)
    parser.add_argument("--no-scan", action="store_true", help="Use only Known Bundles keywords, no bundle filesystem scan.")
    parser.add_argument("--text", action="store_true", help="Print compact text instead of JSON.")
    args = parser.parse_args()

    args.query = args.query_flag or args.query
    if not args.query:
        raise SystemExit("query required")

    result = route(args)
    if args.text:
        print_text(result)
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())





