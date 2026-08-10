# 05 — Breadcrumbs Integration

New Calendar Suite can wire your calendar notes into [Breadcrumbs](https://github.com/michaelpporter/breadcrumbs) — an Obsidian plugin that builds directed, typed relationships between notes.

## What It Does

When you run the **"Insert Breadcrumbs relationships"** command on a calendar note, it:

1. Detects the note's type (`nc-type` or `gc-type` in YAML, or by filename pattern)
2. Calculates the parent, children, previous sibling, and next sibling
3. Creates any missing target notes (using your configured templates)
4. Inserts Breadcrumbs fields into the current note

This is **manual** — it never runs automatically. You decide when to wire up a note's hierarchy.

## The Two Hierarchies

```
GC:  yearly  ──→ quarterly ──→ monthly ──→ weekly ──→ daily
NC:  nc-year ──→ nc-season ──→ nc-month ──→ nc-phase ─→ weekly ──→ daily
```

## The Four Directions

| Direction | From `monthly` | Cardinality |
|-----------|---------------|-------------|
| **up** | Parent: `quarterly` | Single (dual for weekly/daily) |
| **down** | Children: all `weekly` notes in the month | Multi |
| **prev** | Previous: last month | Single |
| **next** | Next: next month | Single |

## Output Modes

### YAML (frontmatter)

```yaml
---
up:
  - "[[2026-Q3]]"
down:
  - "[[2026-08-04]]"
  - "[[2026-08-11]]"
  - "[[2026-08-18]]"
  - "[[2026-08-25]]"
prev: "[[2026-07]]"
next: "[[2026-09]]"
---
```

### Dataview Inline Fields

```
up:: [[2026-Q3]]
down:: [[2026-08-04]], [[2026-08-11]], [[2026-08-18]], [[2026-08-25]]
prev:: [[2026-07]]
next:: [[2026-09]]
```

Dataview mode creates both Breadcrumbs links AND Obsidian graph links, and links auto-update when files are renamed.

## Usage

1. **Install** the [Breadcrumbs plugin](https://github.com/michaelpporter/breadcrumbs) and Dataview
2. **Enable** Breadcrumbs integration in New Calendar Suite settings
3. **Configure** field names, link style, and output mode
4. **Open** any calendar note (daily, weekly, monthly, quarterly, yearly, nc-phase, nc-month, nc-season, nc-year)
5. **Run** "Insert Breadcrumbs relationships" from the Command Palette

The command is only available when the active note is a recognized calendar note (detected by YAML or filename).

## Dual Parents (Weekly & Daily)

Weekly and daily notes sit at the intersection of both hierarchies. When **Dual parents** is enabled (default), `up` from a weekly note inserts two parents:

```yaml
up:
  - "[[2026-08]]"        # GC monthly
  - "[[NC-04-06-P3]]"    # NC phase
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Field name: up | `up` | YAML/Dataview key for parent |
| Field name: down | `down` | YAML/Dataview key for children |
| Field name: prev | `prev` | YAML/Dataview key for previous |
| Field name: next | `next` | YAML/Dataview key for next |
| Link style | `[[wikilink]]` | Wiki or markdown links |
| Output mode | YAML | YAML frontmatter or Dataview `::` |
| Dataview template | `{field}:: {value}` | Template for inline fields |
| Dataview position | After YAML | Where in the note body |
| Dataview marker | `<!-- bc:insert -->` | Marker for position mode |
| Dual parents | On | Weekly/daily up inserts both parents |
| Auto-inverse | Off | Write reverse fields into targets |

## Behavior Notes

- **Idempotent**: Running the command twice won't duplicate fields. Existing matching fields are skipped.
- **Conflicts**: If a field already has a different value, it's skipped with a notice.
- **Missing files**: Target notes that don't exist are created using your configured templates.
- **Templates**: If no template is configured for a granularity, a minimal stub is created.
- **Breadcrumbs auto-infers reverse relationships**: If A declares `up: [[B]]`, Breadcrumbs knows B has A as `down`. Don't manually insert both sides.

## Week Boundary Logic

When a week spans two months (e.g., Jan 31 – Feb 6), the week belongs to the month containing its **Thursday**. This is locale-independent and matches ISO 8601 week-year rules.
