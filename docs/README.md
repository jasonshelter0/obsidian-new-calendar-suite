# New Calendar Suite — Documentation

A unified Obsidian plugin merging Gregorian Calendar (GC) and New Calendar (NC) views with periodic note management across 9 granularities.

## Quick Start

1. **Install** from [GitHub Releases](https://github.com/jasonshelter0/obsidian-new-calendar-suite/releases) (or BRAT)
2. **Open the GC view**: Command Palette → "Open GC view"
3. **Open the NC view**: Command Palette → "Open NC view"
4. **Click** any day, week, month title, or NC period to create/open its note
5. **Configure** in Settings → New Calendar Suite

## Table of Contents

| Document | What it covers |
|----------|---------------|
| [01 — New Calendar Concept](#) | The NC calendar: solar terms, months, phases, seasons, and how it differs from GC |
| [02 — Plugin Settings](#) | Every settings section explained: formats, folders, templates, holidays |
| [03 — API Reference](#) | `window.NCDates`, `window.NCEngine`, `window.NCNotes` — full API for DataviewJS and Templater |
| [04 — Dataview & Templater](#) | Practical examples: Dataview WHERE clauses, Templater templates, YAML frontmatter |
| [05 — Breadcrumbs Integration](#) | Wiring calendar hierarchy into Breadcrumbs: up/down/prev/next relationships |
| [06 — Acknowledgements](#) | Credits and thanks |

## The Nine Periodic Note Types

| System | Granularities |
|--------|--------------|
| **General (shared)** | Daily, Weekly |
| **GC (Gregorian)** | Monthly, Quarterly, Yearly |
| **NC (New Calendar)** | NC Phase, NC Month, NC Season, NC Year |

## Key Features

- **Dual calendar views**: GC (standard Gregorian) and NC (solar-term-based) in Obsidian sidebars
- **Periodic notes**: 9 granularities with configurable formats, folders, and templates
- **Template tokens**: 20+ tokens for YAML and note body (`{{date}}`, `{{nc-year}}`, `{{gc-quarter}}`, etc.)
- **Public API**: `window.NCDates` for DataviewJS and Templater integration
- **Holiday system**: Region-specific holiday display in calendar cells
- **Breadcrumbs integration**: Automatic hierarchy wiring for structured note graphs
- **Customizable**: Week start, locale, colors, dot thresholds, and more
