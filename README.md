# New Calendar Suite

A unified Obsidian plugin merging Gregorian and New Calendar (16-month solar-term) views with full periodic note management across 9 granularities.

## Acknowledgements

This plugin builds upon and merges two excellent projects by [Liam Cain](https://github.com/liamcain):

- **[obsidian-calendar-plugin](https://github.com/liamcain/obsidian-calendar-plugin)** — the original GC calendar view, Svelte calendar grid, NC engine foundation, and dot-source pattern.
- **[obsidian-periodic-notes](https://github.com/liamcain/obsidian-periodic-notes)** — the periodic note CRUD pattern, template/token engine, settings organization, and multi-granularity architecture.

Thank you Liam for creating and maintaining these foundational plugins.

## Features

- **Dual calendar views**: Gregorian Calendar (GC) and New Calendar (NC, 16-month solar-term)
- **9 periodic note granularities**: daily, weekly, monthly, quarterly, yearly + nc-phase, nc-month, nc-season, nc-year
- **Dataview-compatible frontmatter**: `nc-type`, `nc-date`, `gc-date`, `calendar-info`
- **Dot system**: task-completion dots (red/orange/green) + word-count dots per cell
- **Sticky header**: full navigation bar floats above the calendar grid when scrolling
- **Svelte settings UI**: file/folder autocomplete, format preview, per-granularity toggles
- **Migration**: auto-imports settings from legacy periodic-notes and core daily-notes plugins
