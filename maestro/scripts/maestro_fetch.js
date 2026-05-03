#!/usr/bin/env node
"use strict";
/**
 * Update Maestro's known bundle index from a skill-bundle-folder.
 * Maestro bundle index refresh script. Zero external dependencies.
 */

const fs   = require("fs");
const path = require("path");

// ── Markers & constants ──────────────────────────────────────────────
const KNOWN_HEADING          = "## Known Bundles";
const SELECTED_BUNDLE_PREFIX = "Selected bundle folder:";
const CONFIG_FILE_NAME       = "maestro_state.json";

const TEXT_FILE_NAMES = new Set([
  "skill.md", "readme.md", "readme.txt", "metadata.json", "agents/openai.yaml",
]);
const TEXT_SUFFIXES         = new Set([".md", ".markdown", ".skill", ".yaml", ".yml", ".txt", ".json"]);
const PATH_SIGNAL_SUFFIXES = new Set([...TEXT_SUFFIXES, ".csv", ".tsv"]);
const SKIP_DIRS            = new Set([".git", ".hg", ".svn", "__pycache__", "node_modules", "dist", "build", ".next"]);
const MAX_DISCOVERY_FILES     = 48;
const MAX_PATH_SIGNAL_FILES   = 240;
const MIN_KEYWORDS            = 10;
const MAX_MERGED_KEYWORDS     = 36;
const DOMAIN_SUFFIXES         = [".com", ".org", ".net", ".io", ".dev", ".app"];

const STOPWORDS = new Set([
  "about","added","all","and","any","are","agent","agents","bundle","bundles",
  "codex","code","community","complete","content","core","critical","create",
  "csv","data","date","default","description","directory","end","for","file",
  "files","folder","folders","from","guide","https","guidelines","help",
  "instruction","instructions","maestro","metadata","medium","needed","new",
  "name","project","reference","references","required","requirements","risk",
  "run","pro","readme","resources","scripts","source","skill","skill.md",
  "skills","task","tasks","that","the","this","todo","tool","tools","unknown",
  "use","user","version","when","work","apply","bash","best","development",
  "documentation","github","high","how","including","install","limitations",
  "not","pattern","patterns","practice","practices","review","script","step",
  "steps","you","with",
]);

// ── Helpers ───────────────────────────────────────────────────────────

function configFile(skillFile) {
  return path.join(path.dirname(path.resolve(skillFile)), CONFIG_FILE_NAME);
}

function readText(filePath, limit = 24000) {
  try {
    const buf = Buffer.alloc(limit);
    const fd  = fs.openSync(filePath, "r");
    const n   = fs.readSync(fd, buf, 0, limit, 0);
    fs.closeSync(fd);
    return buf.slice(0, n).toString("utf-8");
  } catch {
    return "";
  }
}

function words(text) {
  const matches = text.toLowerCase().match(/[a-z][a-z0-9+.#-]{1,}/g) || [];
  const result = [];
  for (let token of matches) {
    token = token.replace(/^[-_.]+|[-_.]+$/g, "");
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    if (DOMAIN_SUFFIXES.some(s => token.endsWith(s))) continue;
    result.push(token);
  }
  return result;
}

function cleanKeyword(keyword) {
  const cleaned = String(keyword || "")
    .toLowerCase()
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "")
    .replace(/\s+/g, "-");
  if (cleaned.length < 3 || STOPWORDS.has(cleaned)) return "";
  if (DOMAIN_SUFFIXES.some(s => cleaned.endsWith(s))) return "";
  return cleaned;
}

function addScore(score, keyword, weight) {
  const cleaned = cleanKeyword(keyword);
  if (!cleaned) return;
  score[cleaned] = (score[cleaned] || 0) + weight;
}

function scorePhrase(score, text, weight) {
  const normalized = String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9+.#_-]+/g, " ")
    .trim();
  if (!normalized) return;

  const compact = cleanKeyword(normalized.replace(/\s+/g, "-"));
  if (compact && compact.includes("-")) addScore(score, compact, weight);

  for (const token of words(normalized.replace(/[-_]/g, " "))) {
    addScore(score, token, weight);
  }
}

function isSkipped(relPath) {
  const parts = relPath.split(path.sep);
  return parts.some(p => SKIP_DIRS.has(p.toLowerCase()) || p.startsWith("."));
}

// ── Config persistence ───────────────────────────────────────────────

function loadSavedBundleRoot(skillFile) {
  const cfgPath = configFile(skillFile);
  const text = readText(cfgPath, 20000);
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (!data.bundle_root) return null;
    return path.resolve(data.bundle_root);
  } catch {
    return null;
  }
}

function saveBundleRoot(skillFile, bundleRoot) {
  const resolved = path.resolve(bundleRoot);
  const data = { bundle_root: resolved };
  fs.writeFileSync(configFile(skillFile), JSON.stringify(data, null, 2) + "\n", "utf-8");
  updateBundleRootBlock(skillFile, resolved);
}

// ── File discovery ───────────────────────────────────────────────────

function addCandidate(candidates, filePath) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && !candidates.includes(filePath)) {
      candidates.push(filePath);
    }
  } catch { /* skip */ }
}

function scopeCandidates(scope) {
  const candidates = [];
  for (const rel of ["SKILL.md", "README.md", "README.txt", "metadata.json", path.join("agents", "openai.yaml")]) {
    addCandidate(candidates, path.join(scope, rel));
  }
  try {
    const children = fs.readdirSync(scope)
      .map(c => path.join(scope, c))
      .filter(c => { try { return fs.statSync(c).isFile(); } catch { return false; } })
      .sort();
    candidates.push(...children);
  } catch { /* skip */ }
  return candidates;
}

function discoveryFiles(bundle) {
  const found = [];
  const seen  = new Set();
  const candidates = scopeCandidates(bundle);

  let subdirs = [];
  try {
    subdirs = fs.readdirSync(bundle)
      .map(c => path.join(bundle, c))
      .filter(c => {
        try {
          if (!fs.statSync(c).isDirectory()) return false;
          const rel = path.relative(bundle, c);
          return !isSkipped(rel);
        } catch { return false; }
      })
      .sort();
  } catch { /* skip */ }

  for (const subdir of subdirs) {
    candidates.push(...scopeCandidates(subdir));
  }

  for (const child of candidates) {
    if (seen.has(child)) continue;
    try { if (!fs.statSync(child).isFile()) continue; } catch { continue; }
    const rel = path.relative(bundle, child).replace(/\\/g, "/").toLowerCase();
    if (TEXT_FILE_NAMES.has(rel) || TEXT_SUFFIXES.has(path.extname(child).toLowerCase())) {
      found.push(child);
      seen.add(child);
    }
    if (found.length >= MAX_DISCOVERY_FILES) break;
  }
  return found;
}

function* pathSignalFiles(bundle) {
  let count = 0;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)); } catch { return []; }
    const results = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel  = path.relative(bundle, full);
      if (entry.isDirectory()) {
        if (!isSkipped(rel)) results.push(...walk(full));
      } else if (entry.isFile() && PATH_SIGNAL_SUFFIXES.has(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
    return results;
  };
  for (const p of walk(bundle)) {
    yield p;
    count++;
    if (count >= MAX_PATH_SIGNAL_FILES) return;
  }
}

// ── Keyword inference ────────────────────────────────────────────────

function scorePath(score, relPath, weight) {
  const parts = relPath.split(path.sep);
  for (const part of parts) {
    const stem = path.parse(part).name;
    scorePhrase(score, stem, weight);
  }
}

function inferKeywords(bundle, maxKeywords = 32) {
  const score = {};

  // Bundle folder name
  const bundleName = path.basename(bundle).toLowerCase();
  addScore(score, bundleName, 14);
  scorePhrase(score, path.basename(bundle), 12);
  for (const part of path.basename(bundle).toLowerCase().split(/[-_\s]+/)) {
    if (part && part.length >= 3 && !STOPWORDS.has(part)) {
      addScore(score, part, 10);
    }
  }

  // Direct children
  try {
    const children = fs.readdirSync(bundle).sort();
    for (const child of children) {
      const full = path.join(bundle, child);
      let weight;
      try { weight = fs.statSync(full).isDirectory() ? 6 : 3; } catch { weight = 3; }
      const stem = path.parse(child).name;
      scorePhrase(score, stem, weight);
    }
  } catch { /* skip */ }

  // Path signal files
  for (const p of pathSignalFiles(bundle)) {
    scorePath(score, path.relative(bundle, p), 3);
  }

  // Discovery files content
  for (const p of discoveryFiles(bundle)) {
    const rel = path.relative(bundle, p).replace(/\\/g, "/");
    scorePath(score, rel, 2);
    const text = readText(p);
    const fmMatch = text.match(/^---\s*([\s\S]*?)\s*---/m);
    if (fmMatch) {
      for (const token of words(fmMatch[1])) {
        addScore(score, token, 5);
      }
    }
    const headings = text.match(/^#{1,3}\s+(.+)$/gm) || [];
    for (const heading of headings) {
      scorePhrase(score, heading.replace(/^#{1,3}\s+/, ""), 4);
    }
    const commands = text.match(/`(\/?[A-Za-z0-9_.:-]+)`/g) || [];
    for (const cmd of commands) {
      scorePhrase(score, cmd.replace(/`/g, ""), 4);
    }
    for (const token of words(text.slice(0, 6000))) {
      addScore(score, token, 1);
    }
  }

  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.slice(0, maxKeywords).map(([token]) => token);
}

function normalizeKeywords(keywords) {
  const result = [];
  const seen = new Set();
  for (const keyword of keywords || []) {
    const cleaned = cleanKeyword(keyword);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function padKeywords(keywords, bundleName, minKeywords = MIN_KEYWORDS) {
  const padded = normalizeKeywords(keywords);
  const seen = new Set(padded);
  const bases = normalizeKeywords([bundleName, ...String(bundleName || "").split(/[-_\s]+/)]);
  const base = bases[0] || "bundle";
  const suffixes = [
    "workflow", "patterns", "reference", "tools", "automation",
    "configuration", "commands", "routing", "docs", "usage", "setup", "examples",
  ];

  for (const suffix of suffixes) {
    if (padded.length >= minKeywords) break;
    const keyword = cleanKeyword(`${base}-${suffix}`);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    padded.push(keyword);
  }

  return padded;
}

function mergeKeywords(existingKeywords, inferredKeywords, bundleName = "", minKeywords = MIN_KEYWORDS, maxKeywords = MAX_MERGED_KEYWORDS) {
  const merged = normalizeKeywords(existingKeywords);
  const seen = new Set(merged);

  for (const keyword of normalizeKeywords(inferredKeywords)) {
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    merged.push(keyword);
  }

  return padKeywords(merged, bundleName, minKeywords).slice(0, Math.max(minKeywords, maxKeywords));
}

// ── Known Bundles section parsing & rendering ────────────────────────

function parseExisting(block) {
  const rows = {};
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---") || /^\|\s*Bundle\s*\|/.test(trimmed)) continue;
    const cells = trimmed.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    if (cells.length < 3) continue;
    const [name, keywordText, rawPath] = cells;
    if (!name) continue;
    const keywords = normalizeKeywords(keywordText.split(","));
    rows[name] = [keywords, rawPath.replace(/`/g, "")];
  }
  return rows;
}

function renderBundleRoot(bundleRoot) {
  if (!bundleRoot) {
    return "Selected bundle folder: Not configured. Run `/maestro-set <skill-bundle-folder>`.";
  }
  return `Selected bundle folder: \`${path.resolve(bundleRoot)}\``;
}

function knownBundlesBounds(text) {
  const headingMatch = text.match(/^## Known Bundles\s*$/m);
  if (!headingMatch) {
    throw new Error("Known Bundles section missing");
  }
  const headingStart  = headingMatch.index;
  const contentStart  = headingStart + headingMatch[0].length;
  const rest          = text.slice(contentStart);
  const nextHeading   = rest.match(/^##\s+.+$/m);
  const contentEnd    = nextHeading ? contentStart + nextHeading.index : text.length;
  return [headingStart, contentStart, contentEnd];
}

function knownBundlesBlock(text) {
  const [, contentStart, contentEnd] = knownBundlesBounds(text);
  return text.slice(contentStart, contentEnd);
}

function renderIndex(rows) {
  const names = Object.keys(rows).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  if (names.length === 0) {
    return "No bundles indexed yet. Run `/maestro-fetch <skill-bundle-folder>`.";
  }
  const lines = [
    "| Bundle | Keywords | Path |",
    "| --- | --- | --- |",
  ];
  for (const name of names) {
    const [keywords, p] = rows[name];
    const cleanKeywords = normalizeKeywords(keywords).join(", ");
    const escapedPath = p.replace(/\|/g, "\\|");
    lines.push(`| ${name} | ${cleanKeywords} | \`${escapedPath}\` |`);
  }
  return lines.join("\n");
}

function renderKnownBundlesSection(rows, bundleRoot) {
  return KNOWN_HEADING + "\n" + renderBundleRoot(bundleRoot) + "\n\n" + renderIndex(rows) + "\n\n";
}

function setKnownBundlesSection(text, rows, bundleRoot) {
  const [sectionStart, , contentEnd] = knownBundlesBounds(text);
  return text.slice(0, sectionStart) + renderKnownBundlesSection(rows, bundleRoot) + text.slice(contentEnd).replace(/^[\r\n]+/, "");
}

function setBundleRootBlock(text, bundleRoot) {
  const rows = parseExisting(knownBundlesBlock(text));
  return setKnownBundlesSection(text, rows, bundleRoot);
}

function updateBundleRootBlock(skillFile, bundleRoot) {
  const text = readText(skillFile, 1000000);
  if (!text) return;
  fs.writeFileSync(skillFile, setBundleRootBlock(text, bundleRoot), "utf-8");
}

// ── Main update logic ────────────────────────────────────────────────

function updateSkill(skillFile, bundleRoot, keepMissing = false) {
  const text     = readText(skillFile, 1000000);
  const oldBlock = knownBundlesBlock(text);
  const rows     = parseExisting(oldBlock);
  const beforeCount   = Object.keys(rows).length;
  const existingNames = new Set(Object.keys(rows));
  const scannedRows   = {};

  let entries;
  try { entries = fs.readdirSync(bundleRoot).sort(); } catch { entries = []; }
  for (const entry of entries) {
    const bundlePath = path.join(bundleRoot, entry);
    try { if (!fs.statSync(bundlePath).isDirectory() || entry.startsWith(".")) continue; } catch { continue; }
    const inferred = inferKeywords(bundlePath);
    const [existingKeywords] = rows[entry] || [[], ""];
    const mergedKeywords = mergeKeywords(existingKeywords, inferred, entry);
    scannedRows[entry] = [mergedKeywords, path.resolve(bundlePath)];
  }

  const scannedNames = new Set(Object.keys(scannedRows));
  const addedCount  = [...scannedNames].filter(n => !existingNames.has(n)).length;
  const prunedCount = keepMissing ? 0 : [...existingNames].filter(n => !scannedNames.has(n)).length;

  let nextRows;
  if (keepMissing) {
    nextRows = { ...rows, ...scannedRows };
  } else {
    nextRows = scannedRows;
  }

  const newText = setKnownBundlesSection(text, nextRows, bundleRoot);
  fs.writeFileSync(skillFile, newText, "utf-8");
  return [beforeCount, Object.keys(nextRows).length, addedCount, prunedCount];
}

// ── CLI ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let bundleRootArg = null;
  let skillFileArg  = path.join(__dirname, "..", "SKILL.md");
  let keepMissing   = false;
  let noSaveRoot    = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skill-file" && args[i + 1]) { skillFileArg = args[++i]; }
    else if (args[i] === "--keep-missing") { keepMissing = true; }
    else if (args[i] === "--no-save-root") { noSaveRoot = true; }
    else if (!args[i].startsWith("-")) { bundleRootArg = args[i]; }
  }

  const skillFile = path.resolve(skillFileArg);
  if (!fs.existsSync(skillFile)) {
    console.error(`skill file not readable: ${skillFile}`);
    process.exit(1);
  }

  let bundleRoot;
  if (bundleRootArg) {
    bundleRoot = path.resolve(bundleRootArg);
  } else {
    bundleRoot = loadSavedBundleRoot(skillFile);
    if (!bundleRoot) {
      console.error("bundle root not configured. Run /maestro-set <skill-bundle-folder> or pass bundle_root.");
      process.exit(1);
    }
  }

  try {
    if (!fs.statSync(bundleRoot).isDirectory()) throw new Error();
  } catch {
    console.error(`bundle root not readable: ${bundleRoot}`);
    process.exit(1);
  }

  if (!noSaveRoot) {
    saveBundleRoot(skillFile, bundleRoot);
  }

  const [, after, added, pruned] = updateSkill(skillFile, bundleRoot, keepMissing);
  console.log(`indexed ${after} bundles (${added} new, ${pruned} pruned) in ${skillFile} using ${bundleRoot}`);
}



// ── Exports (for use by other scripts) ───────────────────────────────
module.exports = {
  configFile, readText, words, isSkipped, loadSavedBundleRoot, saveBundleRoot,
  discoveryFiles, pathSignalFiles, inferKeywords, parseExisting, renderBundleRoot,
  knownBundlesBounds, knownBundlesBlock, renderIndex, renderKnownBundlesSection,
  setKnownBundlesSection, setBundleRootBlock, updateBundleRootBlock, updateSkill,
  normalizeKeywords, padKeywords, mergeKeywords, STOPWORDS, DOMAIN_SUFFIXES, MIN_KEYWORDS,
};

if (require.main === module) {
  main();
}
