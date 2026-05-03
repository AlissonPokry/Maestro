#!/usr/bin/env node
"use strict";
/**
 * Resolve a user request to Maestro bundle and sub-skill paths.
 * Node.js port of maestro_route.py.
 */

const fs   = require("fs");
const path = require("path");
const fetch = require("./maestro_fetch.js");

// ── Constants ────────────────────────────────────────────────────────

const ROUTE_STOPWORDS = new Set([...fetch.STOPWORDS, "want", "wants", "would", "need", "needs", "please", "imagine"]);

const ALIASES = {
  "e-commerce": new Set(["ecommerce","commerce","shop","store","catalog","product","products","retail","buy"]),
  "ecommerce":  new Set(["ecommerce","commerce","shop","store","catalog","product","products","retail","buy"]),
  "commerce":   new Set(["ecommerce","shop","store","catalog","product","products","retail"]),
  "website":    new Set(["web","site","frontend","design","page","landing","layout"]),
  "site":       new Set(["web","website","frontend","design","page","landing","layout"]),
  "landing":    new Set(["landing","page","hero","cta","conversion"]),
  "frontend":   new Set(["front","frontend","ui","ux","component","components"]),
  "front-end":  new Set(["front","frontend","ui","ux","component","components"]),
  "backend":    new Set(["back","backend","api","database","service","services"]),
  "back-end":   new Set(["back","backend","api","database","service","services"]),
  "responsive": new Set(["responsive","mobile","breakpoint","container","layout"]),
};

// ── Helpers ──────────────────────────────────────────────────────────

function norm(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function expandTerms(text) {
  const terms = new Set(fetch.words(text.replace(/\//g, " ")));
  const lower   = text.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]+/g, "");

  for (const [key, values] of Object.entries(ALIASES)) {
    const keyLower   = key.toLowerCase();
    const keyCompact = keyLower.replace(/[^a-z0-9]+/g, "");
    if (lower.includes(keyLower) || lower.includes(keyLower.replace(/-/g, " ")) || compact.includes(keyCompact)) {
      terms.add(keyCompact);
      for (const v of values) terms.add(v);
    }
  }

  for (const term of terms) {
    if (ROUTE_STOPWORDS.has(term)) terms.delete(term);
  }
  return [...terms].sort();
}

function tokenSet(text) {
  const tokens = new Set(fetch.words(text.replace(/\//g, " ").replace(/_/g, " ").replace(/-/g, " ")));
  for (const t of tokens) {
    if (ROUTE_STOPWORDS.has(t)) tokens.delete(t);
  }
  return tokens;
}

function keywordTerms(bundleName, keywords) {
  const terms = new Set(fetch.words(bundleName.replace(/-/g, " ").replace(/_/g, " ")));
  terms.add(norm(bundleName));
  for (const keyword of keywords) {
    terms.add(keyword.toLowerCase());
    terms.add(norm(keyword));
    for (const w of fetch.words(keyword.replace(/-/g, " ").replace(/_/g, " "))) terms.add(w);
  }
  for (const t of terms) {
    if (!t || fetch.STOPWORDS.has(t)) terms.delete(t);
  }
  return terms;
}

// ── Scoring ──────────────────────────────────────────────────────────

function scorePathTerms(relPath, queryTerms, weight) {
  const parts = relPath.split(path.sep);
  const pathTerms = new Set();
  for (const part of parts) {
    for (const t of tokenSet(path.parse(part).name)) pathTerms.add(t);
  }
  const matches = new Set([...queryTerms].filter(t => pathTerms.has(t)));
  return [matches.size * weight, matches];
}

function scanBundle(bundlePath, queryTerms) {
  try { if (!fs.statSync(bundlePath).isDirectory()) return [0, new Set()]; } catch { return [0, new Set()]; }

  let score = 0;
  const matches = new Set();

  for (const p of fetch.pathSignalFiles(bundlePath)) {
    const rel = path.relative(bundlePath, p);
    const [s, m] = scorePathTerms(rel, queryTerms, 4);
    score += s;
    for (const t of m) matches.add(t);
  }

  for (const p of fetch.discoveryFiles(bundlePath)) {
    const rel = path.relative(bundlePath, p);
    const [pathScore, pathMatches] = scorePathTerms(rel, queryTerms, 3);
    score += pathScore;
    for (const t of pathMatches) matches.add(t);

    const text = fetch.readText(p, 12000);
    const fmMatch = text.match(/^---\s*([\s\S]*?)\s*---/m);
    if (fmMatch) {
      const fmMatches = new Set([...queryTerms].filter(t => tokenSet(fmMatch[1]).has(t)));
      score += fmMatches.size * 5;
      for (const t of fmMatches) matches.add(t);
    }
    const headings = (text.match(/^#{1,3}\s+(.+)$/gm) || []).map(h => h.replace(/^#{1,3}\s+/, "")).join("\n");
    const headingMatches = new Set([...queryTerms].filter(t => tokenSet(headings).has(t)));
    score += headingMatches.size * 4;
    for (const t of headingMatches) matches.add(t);

    const bodyMatches = new Set([...queryTerms].filter(t => tokenSet(text.slice(0, 6000)).has(t)));
    score += bodyMatches.size;
    for (const t of bodyMatches) matches.add(t);
  }

  return [score, matches];
}

function scoreBundle(name, keywords, bundlePath, rawQuery, queryTerms, scan) {
  const terms   = keywordTerms(name, keywords);
  const matches = new Set([...queryTerms].filter(t => terms.has(t)));
  let score     = matches.size * 10;

  const rawNorm  = norm(rawQuery);
  const nameNorm = norm(name);
  if (nameNorm && rawNorm.includes(nameNorm)) {
    score += 100;
    matches.add(nameNorm);
  }

  const partialMatches = new Set();
  for (const qt of queryTerms) {
    for (const t of terms) {
      if (qt.length >= 4 && t.length >= 4 && (qt.includes(t) || t.includes(qt))) {
        partialMatches.add(qt);
        break;
      }
    }
  }
  const newPartials = [...partialMatches].filter(t => !matches.has(t));
  score += newPartials.length * 3;
  for (const t of partialMatches) matches.add(t);

  let scanScore = 0;
  if (scan) {
    const [ss, sm] = scanBundle(bundlePath, queryTerms);
    scanScore = ss;
    score += scanScore;
    for (const t of sm) matches.add(t);
  }

  return {
    bundle: name,
    bundle_path: bundlePath,
    score,
    index_score: score - scanScore,
    scan_score: scanScore,
    matched_terms: [...matches].sort(),
  };
}

// ── Skill file discovery ─────────────────────────────────────────────

function skillFiles(bundlePath) {
  try { if (!fs.statSync(bundlePath).isDirectory()) return []; } catch { return []; }
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel  = path.relative(bundlePath, full);
      if (entry.isDirectory()) {
        if (!fetch.isSkipped(rel)) walk(full);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        if (!fetch.isSkipped(rel)) {
          files.push(full);
          if (files.length >= 32) return;
        }
      }
    }
  };
  walk(bundlePath);
  return files;
}

function scoreSkillFile(filePath, bundlePath, queryTerms) {
  const rel = path.relative(bundlePath, filePath);
  const [score0, matches] = scorePathTerms(rel, queryTerms, 6);
  let score = score0;
  const text = fetch.readText(filePath, 16000);
  const fmMatch = text.match(/^---\s*([\s\S]*?)\s*---/m);
  if (fmMatch) {
    const fmMatches = new Set([...queryTerms].filter(t => tokenSet(fmMatch[1]).has(t)));
    score += fmMatches.size * 5;
    for (const t of fmMatches) matches.add(t);
  }
  const headings = (text.match(/^#{1,3}\s+(.+)$/gm) || []).map(h => h.replace(/^#{1,3}\s+/, "")).join("\n");
  const headingMatches = new Set([...queryTerms].filter(t => tokenSet(headings).has(t)));
  score += headingMatches.size * 4;
  for (const t of headingMatches) matches.add(t);
  const bodyMatches = new Set([...queryTerms].filter(t => tokenSet(text.slice(0, 8000)).has(t)));
  score += bodyMatches.size;
  for (const t of bodyMatches) matches.add(t);
  return [score, [...matches].sort()];
}

function selectSkills(bundlePath, queryTerms, maxCount) {
  const scored = [];
  for (const p of skillFiles(bundlePath)) {
    const [score, matches] = scoreSkillFile(p, bundlePath, queryTerms);
    scored.push({ path: path.resolve(p), score, matched_terms: matches });
  }
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const positives = scored.filter(s => s.score > 0);
  return (positives.length ? positives : scored).slice(0, maxCount);
}

// ── Index parsing ────────────────────────────────────────────────────

function parseIndex(skillFile) {
  const text = fetch.readText(skillFile, 1000000);
  return fetch.parseExisting(fetch.knownBundlesBlock(text));
}

function buildIndexFromRoot(bundleRoot) {
  const rows = {};
  let entries;
  try { entries = fs.readdirSync(bundleRoot).sort(); } catch { return rows; }
  for (const entry of entries) {
    const full = path.join(bundleRoot, entry);
    try { if (!fs.statSync(full).isDirectory() || entry.startsWith(".")) continue; } catch { continue; }
    rows[entry] = [fetch.inferKeywords(full), path.resolve(full)];
  }
  return rows;
}

function pathWithin(filePath, root) {
  try {
    const rel = path.relative(path.resolve(root), path.resolve(filePath));
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

function filterRowsByRoot(rows, bundleRoot) {
  const filtered = {};
  for (const [name, [keywords, p]] of Object.entries(rows)) {
    if (pathWithin(p, bundleRoot)) {
      filtered[name] = [keywords, path.resolve(p)];
    }
  }
  return filtered;
}

// ── Route ────────────────────────────────────────────────────────────

function route(opts) {
  const skillFile      = path.resolve(opts.skillFile);
  const configuredRoot = fetch.loadSavedBundleRoot(skillFile);
  const explicitRoot   = opts.bundleRoot ? path.resolve(opts.bundleRoot) : null;
  const bundleRoot     = explicitRoot || configuredRoot;

  if (!bundleRoot) {
    return {
      query: opts.query,
      status: "needs_bundle_root",
      message: "Bundle folder not configured. Ask the user for the skill-bundle-folder path, then run /maestro-set <path>.",
    };
  }
  try { if (!fs.statSync(bundleRoot).isDirectory()) throw new Error(); } catch {
    return {
      query: opts.query,
      status: "invalid_bundle_root",
      bundle_root: bundleRoot,
      message: "Saved bundle folder cannot be read. Ask for a valid path or run /maestro-set <path>.",
    };
  }

  let rows = filterRowsByRoot(parseIndex(skillFile), bundleRoot);
  if (Object.keys(rows).length === 0) {
    rows = buildIndexFromRoot(bundleRoot);
  }
  if (Object.keys(rows).length === 0) {
    return {
      query: opts.query,
      status: "no_index",
      bundle_root: bundleRoot,
      message: "No bundle folders found. Run /maestro-fetch or /maestro-set with a folder containing bundle directories.",
    };
  }

  const queryTerms = new Set(expandTerms(opts.query));
  const scored = Object.entries(rows).map(([name, [keywords, p]]) =>
    scoreBundle(name, keywords, p, opts.query, queryTerms, !opts.noScan)
  );
  scored.sort((a, b) => b.score - a.score || a.bundle.localeCompare(b.bundle));

  const positives = scored.filter(s => s.score > 0);
  if (positives.length === 0) {
    return {
      query: opts.query,
      bundle_root: bundleRoot,
      query_terms: [...queryTerms].sort(),
      status: "no_match",
      candidates: scored.slice(0, opts.maxBundles),
    };
  }

  const topScore  = positives[0].score;
  const threshold = Math.max(opts.minScore, Math.floor(topScore * opts.secondaryRatio));
  const selected  = positives.filter(s => s.score >= threshold).slice(0, opts.maxBundles);

  for (let i = 0; i < selected.length; i++) {
    selected[i].role = i === 0 ? "primary" : "supporting";
    selected[i].skill_paths = selectSkills(selected[i].bundle_path, queryTerms, opts.maxSkillsPerBundle);
  }

  return {
    query: opts.query,
    bundle_root: bundleRoot,
    query_terms: [...queryTerms].sort(),
    status: "matched",
    terminology: {
      bundle: "Immediate child folder of the selected skill-bundle-folder. Example: Angular-pro. A bundle is not a skill.",
      skill: "Concrete SKILL.md file inside a selected bundle. Report these when the user asks which skills were used.",
    },
    selected_bundles: selected,
    other_candidates: positives.filter(s => !selected.includes(s)).slice(0, opts.maxCandidates),
    agent_instruction: "Read only selected_bundles[].skill_paths first. selected_bundles[].bundle are bundles, not skills. Skills are selected_bundles[].skill_paths[].path. When reporting used skills, list skill_paths, not bundle names.",
  };
}

function printText(result) {
  console.log(`status: ${result.status}`);
  if (result.status !== "matched") {
    console.log(result.message || "no route");
    return;
  }
  console.log(`query: ${result.query}`);
  for (const bundle of (result.selected_bundles || [])) {
    console.log(`${bundle.role}_bundle: ${bundle.bundle} score=${bundle.score} matched=${bundle.matched_terms.join(", ")}`);
    console.log(`  bundle_path: ${bundle.bundle_path}`);
    for (const skill of (bundle.skill_paths || [])) {
      console.log(`  skill_file: ${skill.path} score=${skill.score}`);
    }
  }
}

// ── CLI ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const opts = {
    query: null,
    skillFile: path.resolve(path.join(__dirname, "..", "SKILL.md")),
    bundleRoot: null,
    maxBundles: 4,
    maxSkillsPerBundle: 4,
    maxCandidates: 4,
    minScore: 8,
    secondaryRatio: 0.35,
    noScan: false,
    textMode: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skill-file" && args[i + 1])              opts.skillFile = args[++i];
    else if (args[i] === "--bundle-root" && args[i + 1])        opts.bundleRoot = args[++i];
    else if (args[i] === "--max-bundles" && args[i + 1])        opts.maxBundles = parseInt(args[++i]);
    else if (args[i] === "--max-skills-per-bundle" && args[i + 1]) opts.maxSkillsPerBundle = parseInt(args[++i]);
    else if (args[i] === "--max-candidates" && args[i + 1])     opts.maxCandidates = parseInt(args[++i]);
    else if (args[i] === "--min-score" && args[i + 1])          opts.minScore = parseInt(args[++i]);
    else if (args[i] === "--secondary-ratio" && args[i + 1])    opts.secondaryRatio = parseFloat(args[++i]);
    else if (args[i] === "--no-scan")                           opts.noScan = true;
    else if (args[i] === "--text")                              opts.textMode = true;
    else if (args[i] === "--query" && args[i + 1])              opts.query = args[++i];
    else if (!args[i].startsWith("-") && !opts.query)           opts.query = args[i];
  }

  if (!opts.query) {
    console.error("query required");
    process.exit(1);
  }

  const result = route(opts);
  if (opts.textMode) {
    printText(result);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

if (require.main === module) {
  main();
}
