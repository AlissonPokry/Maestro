# Maestro

[![npm version](https://img.shields.io/npm/v/@alissonpokry/maestro.svg)](https://www.npmjs.com/package/@alissonpokry/maestro)
[![npm package](https://img.shields.io/badge/npm-@alissonpokry%2Fmaestro-red.svg)](https://www.npmjs.com/package/@alissonpokry/maestro)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Dynamic skill bundle manager for AI coding assistants.

[Brazilian Portuguese](README.pt-BR.md)

Maestro helps agents load the right instructions for the task in front of them. Instead of keeping every language, framework, and workflow rule in the active prompt, Maestro routes the request to a focused bundle of skills and keeps the agent context smaller.

## Install

Run the installer directly from npm:

```bash
npm i @alissonpokry/maestro
```

Then execute the installer:

```bash
npx @alissonpokry/maestro
```

## Package

| Field | Value |
| --- | --- |
| Package | `@alissonpokry/maestro` |
| Current version | `1.0.3` |
| npm install | `npm i @alissonpokry/maestro` |
| npx usage | `npx @alissonpokry/maestro` |
| CLI binary | `maestro` |
| License | MIT |
| Runtime dependencies | None |
| Node.js | `>=18` |

## What Maestro Does

- Installs slash-command skills for Cursor, Claude, Antigravity/Gemini, and Codex/Agents.
- Stores one active `skill-bundle-folder` path for Maestro.
- Scans bundle folders and builds a compact `Known Bundles` index.
- Routes `/maestro` requests to the best matching bundle and skill files.
- Provides maintenance commands for switching folders, refreshing the index, and checking current configuration.

## Quick Start

1. Install Maestro in your project or user folder as stated in the install section above.

2. Set your skill bundle folder:

```text
/maestro-set C:\Users\user\Desktop\My-Skill-Bundles
```

3. Route a task through Maestro:

```text
/maestro Build a login page in Angular.
```

Maestro checks the request, selects the most relevant bundle, reads only the matched skill instructions, and then continues the task with focused context.

## Installer Options

The installer asks for:

- Action: installation or uninstallation.
- Scope: local project or global user folder.
- AI environment: Cursor, Claude, Antigravity/Gemini, Codex/Agents, or all supported environments.

Local installs place Maestro files into the current project. Global installs place them under the relevant user-level assistant folders.

## Commands

| Command | Purpose |
| --- | --- |
| `/maestro <task>` | Route a task through the best matching bundle. |
| `/maestro-set <folder-path>` | Save or switch the active `skill-bundle-folder`. |
| `/maestro-fetch [folder-path]` | Refresh the `Known Bundles` index. |
| `/maestro-stats` | Show the active bundle folder and indexed bundles. |

If your agent exposes only `/maestro`, use these aliases:

| Alias | Equivalent command |
| --- | --- |
| `/maestro switch <folder-path>` | `/maestro-set <folder-path>` |
| `/maestro fetch [folder-path]` | `/maestro-fetch [folder-path]` |
| `/maestro stats` | `/maestro-stats` |

## Skill Bundle Layout

Maestro expects a folder whose direct children are bundles. Each bundle can contain one or more skills, and each skill is represented by a `SKILL.md` file.

```text
My-Skill-Bundles/
|
+-- Angular-pro/
|   +-- angular-architecture/
|   |   +-- SKILL.md
|   +-- angular-ui-patterns/
|       +-- SKILL.md
|
+-- Python-pro/
|   +-- python-testing/
|       +-- SKILL.md
|
+-- Seo-pro/
    +-- seo-audit/
        +-- SKILL.md
```

In Maestro terminology:

- `skill-bundle-folder` is the folder that contains all bundles.
- `bundle` is an immediate child folder, such as `Angular-pro`.
- `skill` is a specific `SKILL.md` inside a bundle.

## Supported Environments

Maestro can install command and skill files for:

- Cursor
- Claude
- Antigravity/Gemini
- Codex/Agents

## Repository Development

This package has no runtime dependencies. The CLI entry point is:

```bash
bin/cli.js
```

Useful local commands:

```bash
node bin/cli.js init
node bin/cli.js uninstall
npm test
npm run pack:dry-run
```

## License

MIT. See [LICENSE](LICENSE).
