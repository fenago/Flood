Source: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
Retrieved: 2026-11-26

# Architecture Decision Records (ADRs)

Michael Nygard, "Documenting Architecture Decisions", Cognitect blog, 2011-11-15. This is the original ADR format; `docs/decisions.md` follows it, adapted to the `docs-upkeep` skill's fields.

## 1. What an ADR is

- "a short text file in a format similar to an Alexandrian pattern."
- "Each record describes a set of forces and a single decision in response to those forces."
- One decision per record. Forces may repeat across records.

## 2. Sections (Nygard)

| Section | Content |
|---|---|
| Title | "short noun phrases", e.g. "ADR 9: LDAP for Multitenant Integration" |
| Context | "the forces at play, including technological, political, social, and project local". Value-neutral: "simply describing facts". |
| Decision | "our response to these forces ... in full sentences, with active voice. 'We will ...'" |
| Status | "proposed" until stakeholders agree, then "accepted"; later "deprecated" or "superseded" with a reference to the replacement |
| Consequences | "the resulting context, after applying the decision. All consequences should be listed here, not just the 'positive' ones." |

## 3. Numbering, storage, lifecycle

- Nygard stores them as `doc/arch/adr-NNN.md`, "numbered sequentially and monotonically. Numbers will not be reused."
- "If a decision is reversed, we will keep the old one around, but mark it as superseded."
- Length: "one or two pages long".
- Style: "as if it is a conversation with a future developer ... full sentences organized into paragraphs. Bullets are acceptable only for visual style".

## 4. Flood Watch adaptation (`docs/decisions.md`)

The `docs-upkeep` skill requires: date, decision, why, alternatives rejected, owner. Combined template:

```markdown
## ADR-NNN: <short noun phrase>

- Date: YYYY-MM-DD
- Status: proposed | accepted | superseded by ADR-MMM
- Owner: <agent or person who decides>
- Deciders consulted: <agents>

### Context
<forces, value-neutral, with cited official sources for every limit>

### Decision
We will ...

### Alternatives rejected
| Option | Why rejected |

### Consequences
Positive / negative / neutral, including new work and new risks.

### Sources
<official URLs>
```

Rules we add:
- All ADRs live in one file, `docs/decisions.md`, newest at the bottom; numbers never reused.
- A decision that touches a fixed decision in CLAUDE.md is `proposed` until the owner accepts it.
- Cite an official page for every external limit (CLAUDE.md working rule).
- Superseding: add the new ADR, then edit only the old one's Status line.

## 5. When to write one

Write an ADR when a choice is hard to reverse or affects more than one expert: where code runs (browser vs Function), storage keys and shapes, API contracts, auth model, deploy flow, adding or removing a dependency. Do not write one for local implementation details inside one module.

See `../examples/01-adr-browser-calls-open-meteo.md` for a filled-in ADR.
