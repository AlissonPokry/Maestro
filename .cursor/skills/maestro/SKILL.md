---
name: maestro
description: Route work to the right skill bundle. Use when the user invokes /maestro, /maestro-fetch, /maestro-set, or /maestro-stats.
---

# Maestro Cursor Adapter

Read and follow `../../../maestro/SKILL.md`.

For `/maestro-fetch`, run the script from the source skill. With no path, it uses the saved bundle folder; with a path, it saves that path:

```bash
node ../../../maestro/scripts/maestro_fetch.js "<skill-bundle-folder>" --skill-file ../../../maestro/SKILL.md
```


For `/maestro-set`, run:

```bash
node ../../../maestro/scripts/maestro_config.js set "<skill-bundle-folder>" --skill-file ../../../maestro/SKILL.md
node ../../../maestro/scripts/maestro_fetch.js --skill-file ../../../maestro/SKILL.md
```
