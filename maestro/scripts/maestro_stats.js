#!/usr/bin/env node
"use strict";
/**
 * Print Maestro's selected bundle folder and Known Bundles table.
 * Node.js port of maestro_stats.py.
 */

const fs   = require("fs");
const path = require("path");
const fetch = require("./maestro_fetch.js");

function knownRows(skillFile) {
  const text = fetch.readText(skillFile, 1000000);
  return fetch.parseExisting(fetch.knownBundlesBlock(text));
}

function main() {
  const args = process.argv.slice(2);
  let skillFileArg = path.resolve(path.join(__dirname, "..", "SKILL.md"));

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skill-file" && args[i + 1]) { skillFileArg = args[++i]; }
  }

  const skillFile = path.resolve(skillFileArg);
  if (!fs.existsSync(skillFile)) {
    console.error(`skill file not readable: ${skillFile}`);
    process.exit(1);
  }

  const bundleRoot = fetch.loadSavedBundleRoot(skillFile);
  console.log("## Known Bundles");
  console.log();
  console.log(fetch.renderBundleRoot(bundleRoot));
  console.log();
  console.log(fetch.renderIndex(knownRows(skillFile)));
}

if (require.main === module) {
  main();
}
