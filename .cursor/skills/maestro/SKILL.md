---
name: maestro
description: Cursor adapter for Maestro. Use when the user invokes /maestro, /maestro-fetch, /maestro-switch, or /maestro-stats; asks Cursor to route work to a project skill bundle; or wants bundle keywords refreshed from a skill-bundle-folder.
---

# Maestro Cursor Adapter

Read and follow `../../../maestro/SKILL.md`.

For `/maestro-fetch`, run the script from the source skill. With no path, it uses the saved bundle folder; with a path, it saves that path:

```bash
python ../../../maestro/scripts/maestro_fetch.py "<skill-bundle-folder>" --skill-file ../../../maestro/SKILL.md
```


For `/maestro-switch`, run:

```bash
python ../../../maestro/scripts/maestro_config.py set "<skill-bundle-folder>" --skill-file ../../../maestro/SKILL.md
python ../../../maestro/scripts/maestro_fetch.py --skill-file ../../../maestro/SKILL.md
```
