#!/usr/bin/env node
"use strict";
/**
 * Read or update Maestro's saved skill-bundle-folder.
 * Node.js port of maestro_config.py.
 */

const fs   = require("fs");
const path = require("path");
const fetch = require("./maestro_fetch.js");

function result(status, skillFile, bundleRoot, message) {
  const payload = {
    status,
    skill_file: skillFile,
    config_file: fetch.configFile(skillFile),
  };
  if (bundleRoot != null) {
    payload.bundle_root = bundleRoot;
    payload.exists = fs.existsSync(bundleRoot) && fs.statSync(bundleRoot).isDirectory();
  }
  if (message) {
    payload.message = message;
  }
  return payload;
}

function main() {
  const args = process.argv.slice(2);
  let command      = null;
  let bundleRootArg = null;
  let skillFileArg  = path.resolve(path.join(__dirname, "..", "SKILL.md"));
  let textMode      = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skill-file" && args[i + 1]) { skillFileArg = args[++i]; }
    else if (args[i] === "--text") { textMode = true; }
    else if (!args[i].startsWith("-") && !command) { command = args[i]; }
    else if (!args[i].startsWith("-")) { bundleRootArg = args[i]; }
  }

  if (command !== "get" && command !== "set") {
    console.error("Usage: node maestro_config.js <get|set> [bundle_root] [--skill-file <path>] [--text]");
    process.exit(1);
  }

  const skillFile = path.resolve(skillFileArg);
  if (!fs.existsSync(skillFile)) {
    console.error(`skill file not readable: ${skillFile}`);
    process.exit(1);
  }

  let payload;
  if (command === "get") {
    const bundleRoot = fetch.loadSavedBundleRoot(skillFile);
    if (!bundleRoot) {
      payload = result("missing", skillFile, null, "bundle root not configured");
    } else {
      payload = result("configured", skillFile, bundleRoot);
    }
  } else {
    if (!bundleRootArg) {
      console.error("bundle_root required for set");
      process.exit(1);
    }
    const bundleRoot = path.resolve(bundleRootArg);
    try {
      if (!fs.statSync(bundleRoot).isDirectory()) throw new Error();
    } catch {
      console.error(`bundle root not readable: ${bundleRoot}`);
      process.exit(1);
    }
    fetch.saveBundleRoot(skillFile, bundleRoot);
    payload = result("configured", skillFile, bundleRoot);
  }

  if (textMode) {
    console.log(payload.status);
    if (payload.bundle_root) console.log(`bundle_root: ${payload.bundle_root}`);
    if (payload.message) console.log(payload.message);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

if (require.main === module) {
  main();
}
