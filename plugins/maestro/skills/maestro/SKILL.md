---
name: maestro
description: Orchestrate project skill bundles from a saved user-provided skill-bundle-folder. Use when the user invokes /maestro, /maestro-fetch, /maestro-switch, or /maestro-stats; asks Codex to choose and use skills from bundle folders such as front-end-expert; or wants bundle names and keywords scanned into Maestro's known bundle index.
---

# Maestro

## Purpose

Route work to the right skill bundle folder, load only the relevant bundle content, and follow the skills inside that bundle. A bundle is an immediate child directory of the user-provided `skill-bundle-folder`.

## Agent Entry

For Codex, Claude, Cursor, and Antigravity/Gemini, treat this file as the source of truth. Project entrypoint files may only route `/maestro`, `/maestro-fetch`, `/maestro-switch`, and `/maestro-stats` here; do not duplicate behavior elsewhere unless syncing the same changes back into this file.

## Bundle Folder Memory

Maestro uses one saved `skill-bundle-folder` per active `SKILL.md`. The first time `/maestro` runs and no saved path exists, the agent MUST ask: `What is the skill-bundle-folder path Maestro should use?` Do not infer the first path from `Known Bundles`, because that table can be stale or copied.

Check the saved path with:

```bash
python scripts/maestro_config.py get --skill-file "<path-to-this-SKILL.md>"
```

After the user provides a path, run `/maestro-switch <skill-bundle-folder>`. After that, `/maestro`, `/maestro-fetch`, and `/maestro-stats` use the saved path until `/maestro-switch` changes it.

## Commands

### `/maestro`

Use `/maestro` to execute a task through the best matching skill bundle.

1. Run `maestro_config.py get`. If status is `missing`, ask for the `skill-bundle-folder` path and do not route until the user provides it.
2. If the user provides a path during first setup, run `/maestro-switch <skill-bundle-folder>`, then continue.
3. Extract the user task/request exactly enough to route it.
4. Run the route resolver from this skill directory:

```bash
python scripts/maestro_route.py --query "<user task>" --skill-file "<path-to-this-SKILL.md>"
```

5. If the resolver returns `needs_bundle_root` or `invalid_bundle_root`, ask for a valid path and run `/maestro-switch <skill-bundle-folder>`.
6. Read only the returned `selected_bundles[].skill_paths` first. Open more bundle files only when those skill files require it.
7. Select one primary bundle and supporting bundles from the resolver output. Do not manually search all bundles when the resolver returns a clear match.
8. If the resolver returns `no_match`, inspect only likely candidates inside the saved `skill-bundle-folder`: `SKILL.md`, `README.md`, `*.skill`, `agents/openai.yaml`, and top-level filenames.
9. If matching remains ambiguous after inspecting candidates, ask one concise clarification with the top choices.
10. If the bundle index is stale or missing useful bundles, suggest `/maestro-fetch` after finishing the task.

Prefer explicit user bundle names over inferred keywords. Prefer high-signal files over bulk reading. Never load every bundle unless the user asks for a full audit.

### `/maestro-switch`

Use `/maestro-switch` to change Maestro's saved `skill-bundle-folder`.

1. Get the new `skill-bundle-folder` path from the command args. If absent, ask for it.
2. From this skill directory, run:

```bash
python scripts/maestro_config.py set "<skill-bundle-folder>" --skill-file "<path-to-this-SKILL.md>"
python scripts/maestro_fetch.py --skill-file "<path-to-this-SKILL.md>"
```

3. Report the saved path and fetch summary. The fetch refreshes `Known Bundles`, updates the selected bundle-folder line, and prunes rows for bundles missing from the new folder.

### `/maestro-stats`

Use `/maestro-stats` to show the selected `skill-bundle-folder` and the current `Known Bundles` table. It does not estimate token savings.

```bash
python scripts/maestro_stats.py --skill-file "<path-to-this-SKILL.md>"
```

Return the script output to the user. If the selected bundle folder is not configured, say that `/maestro-switch <skill-bundle-folder>` is needed before `/maestro` can route tasks.

### `/maestro-fetch`

Use `/maestro-fetch` to refresh this skill's bundle index.

1. If the user provides a `skill-bundle-folder`, use it and save it as Maestro's current path. If no path is provided, use the saved path.
2. From this skill directory, run one of:

```bash
python scripts/maestro_fetch.py "<skill-bundle-folder>" --skill-file "<path-to-this-SKILL.md>"
python scripts/maestro_fetch.py --skill-file "<path-to-this-SKILL.md>"
```

If `python` is unavailable, use any available Python runtime. If no path is saved, ask for the path and run `/maestro-switch <skill-bundle-folder>`. If the script cannot run, manually inspect immediate child bundle folders and update the `Known Bundles` section below.

3. The script scans immediate child bundle directories, nested sub-skill docs, and file/path name signals, infers keywords, prunes index rows for missing/deleted bundle folders, saves the active bundle path, updates the selected bundle-folder line, and updates only the `Known Bundles` section in this `SKILL.md`.
4. Review the resulting `SKILL.md` diff. Keep useful manually-added keywords for bundles that still exist unless they are wrong. Use `--keep-missing` only when intentionally preserving references to bundles outside the current folder.

### Internal route resolver

Use the route resolver internally when the agent only needs bundle and skill paths. It returns compact JSON by default. This is not a user-facing command.

```bash
python scripts/maestro_route.py --query "<user task>" --skill-file "<path-to-this-SKILL.md>"
```

The resolver requires a saved bundle path unless `--bundle-root` is explicitly passed. The output gives `selected_bundles`, `bundle_path`, `skill_paths`, scores, and matched terms. Treat it as the routing plan for `/maestro`.

## Keyword Rules

Build keyword evidence from:

- Bundle folder names and aliases.
- Skill frontmatter `name` and `description`.
- Headings and command names in top-level Markdown or `.skill` files.
- Top-level filenames and directory names.
- Nested sub-skill folder names plus SKILL.md, README.md, metadata.json, and path signals from resource files.
- Frameworks, languages, product names, file extensions, and domain terms.

Use compact keyword lists. Avoid generic terms such as `skill`, `task`, `guide`, `help`, `project`, `folder`, `agent`, and `codex` unless they disambiguate a bundle.

## Known Bundles
Selected bundle folder: Not configured. Run `/maestro-switch <skill-bundle-folder>`.

No bundles indexed yet. Run `/maestro-fetch <skill-bundle-folder>`.

## Failure Handling
If the bundle path is invalid, say the path cannot be read and ask for a valid folder. If a selected bundle lacks usable instructions, inspect filenames and nearby docs, then proceed with normal engineering judgment while noting the missing bundle guidance.










