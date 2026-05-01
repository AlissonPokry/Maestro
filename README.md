# Maestro

Maestro is a powerful orchestrator for project skill bundles. It intelligently routes tasks to specialized skill folders (such as `Angular-pro`, `Architecture-pro`, `Front-end-expert`, etc.), loading only the relevant context for AI agents (Codex, Claude, Cursor, Gemini).

## Purpose

The primary goal of Maestro is to optimize agent memory and token usage by dynamically loading the precise instructions, resources, and configurations needed for a specific task. Rather than stuffing all guidelines into a single prompt, Maestro reads the user request, resolves the most applicable skill bundle, and injects only those rules into the agent's context.

## Key Features

- **Dynamic Task Routing:** Automatically selects the right skill bundle using the `maestro_route.py` resolver.
- **Token Optimization:** Loads only necessary files (`SKILL.md`, `README.md`, `.skill`) instead of flooding context.
- **Saved Bundle Roots:** Persists the active skill folder path across sessions for seamless workflows.
- **Auto-Discovery:** Scans folders to infer keywords and maintain an up-to-date `Known Bundles` index.

## Commands

- `/maestro`: Route a task through the best matching skill bundle.
- `/maestro-switch <skill-bundle-folder>`: Change Maestro's saved bundle folder path.
- `/maestro-stats`: Show the selected folder and the current `Known Bundles` index.
- `/maestro-fetch`: Refresh and update the bundle index from the configured folder.

## Getting Started

1. Place Maestro inside your project.
2. Ensure you have a folder with skill bundles (e.g., `MaestroTest/Angular-pro`).
3. Run `/maestro` or `/maestro-switch <path>` to set your `skill-bundle-folder`.
4. Ask your AI to perform tasks, and Maestro will orchestrate the underlying skills.

## Supported Bundles (Example)

- `Angular-pro`: Advanced Angular 19+ architecture, zoneless, signals.
- `Architecture-pro`: System design, workflows, analyzer tools.
- `Back-end-expert`: APIs, microservices, Prisma, security.
- `Front-end-expert`: Next.js, React, performance, testing.
- `Python-pro`: FastAPI, Django, modern packaging.
- `Seo-pro`: SEO audits, E-E-A-T, DataForSEO strategy.
- `Tailwind-pro`: Advanced design systems, Oklch, custom extraction.
- `Web-designer`: Aesthetics, UI/UX, animations, layout structures.
