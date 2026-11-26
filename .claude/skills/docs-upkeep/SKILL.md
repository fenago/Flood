---
name: docs-upkeep
description: Keep the docs/ folder accurate as the Flood Watch design changes. Use after any decision, interface change, or discovery that contradicts a doc.
user-invocable: false
---
# Docs upkeep

- `docs/README.md` is the index; every new doc gets a row.
- Record decisions in `docs/decisions.md` as: date, decision, why, alternatives rejected, owner.
- When code contradicts a doc, fix whichever is wrong in the same change; never leave both.
- Replace "(verify)" markers once checked, citing the source URL.
- Write plainly: short sentences, define acronyms on first use, cite official docs for every external limit or number.
