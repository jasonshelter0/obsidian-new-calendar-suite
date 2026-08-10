# 06 — Acknowledgements

New Calendar Suite builds upon and merges two excellent Obsidian plugins by **Liam Cain**:

## obsidian-calendar-plugin

The original GC calendar view, weekly/daily note integration, dot system, and calendar-info panel. This plugin's GC view is a direct descendant, enhanced with sticky headers, segmented controls, and GC title click navigation.

- **Author**: Liam Cain
- **Repository**: [liamcain/obsidian-calendar-plugin](https://github.com/liamcain/obsidian-calendar-plugin)
- **License**: MIT

## obsidian-periodic-notes

The original periodic note management system (daily, weekly, monthly, quarterly, yearly). This plugin extends the concept to 9 granularities with NC calendar support.

- **Author**: Liam Cain
- **Repository**: [liamcain/obsidian-periodic-notes](https://github.com/liamcain/obsidian-periodic-notes)
- **License**: MIT

## obsidian-daily-notes-interface

A shared library providing `getAllDailyNotes`, `getAllWeeklyNotes`, `getDateUID`, and other utilities used by both calendar and periodic-notes plugins. Used under the hood for daily/weekly note indexing.

- **Author**: Liam Cain
- **Repository**: [liamcain/obsidian-daily-notes-interface](https://github.com/liamcain/obsidian-daily-notes-interface)
- **License**: MIT

## obsidian-calendar-ui

Shared Svelte components and utilities (calendar grid, locale configuration). Used by the GC calendar view.

- **Author**: Liam Cain
- **Repository**: [liamcain/obsidian-calendar-ui](https://github.com/liamcain/obsidian-calendar-ui)
- **License**: MIT

## China Holiday Data

Holiday data sourced from the Chinese government's annual holiday schedule announcements (国务院办公厅节假日安排通知).

## NC Calendar Engine

The solar-term calculation engine uses the Kepler equation to approximate the Sun's ecliptic longitude, mapping it to the 24 Chinese solar terms. The NC calendar structure (checkpoints, year/month/phase/season mapping) is a custom design.

---

## Contributors

- **Jason Shelter** — Plugin development, NC engine, 9-granularity integration, Breadcrumbs support
- **Claude (Anthropic)** — Code review, bug fixes, template system, documentation

---

*"If I have seen further, it is by standing on the shoulders of giants."* — Isaac Newton
