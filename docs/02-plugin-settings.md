# 02 — Plugin Settings

Access via **Settings → Community Plugins → New Calendar Suite** (gear icon).

## General Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Dot threshold | 250 | Words per dot in calendar cells |
| Word count offset | 0 | Subtract this many words before threshold calculation |
| Week start | Locale | First day of week (Sunday, Monday, or locale-default) |
| Confirm before creating | Enabled | Show "Create?" dialog before creating new notes |
| Weekly note settings | Disabled | Toggle to show/hide legacy weekly format settings |
| Override locale | System default | Force a specific moment.js locale for date formatting |

## General Notes

### Daily & Weekly

Configure daily and weekly note formats, templates, and folders. The daily settings fall back to Obsidian's core Daily Notes plugin values when the suite's fields are empty.

**Template tokens** (work in daily/weekly templates):

| Token | Output | Example |
|-------|--------|---------|
| `{{date}}` | GC date | `2026-08-10` |
| `{{time}}` | Current time | `14:30` |
| `{{title}}` | Same as `{{date}}` | `2026-08-10` |
| `{{gc-year}}` | Year | `2026` |
| `{{gc-month}}` | Month (01-12) | `08` |
| `{{gc-week}}` | Locale-aware week number | `33` |
| `{{gc-quarter}}` | Quarter (1-4) | `3` |
| `{{nc-date}}` | NC date | `04-06-15` |
| `{{nc-year}}` | NC year | `04` |
| `{{nc-month}}` | NC month | `06` |
| `{{nc-day}}` | NC day | `15` |
| `{{nc-phase}}` | Phase (1-4) | `3` |
| `{{nc-season}}` | Season (1-4) | `2` |
| `{{nc-week}}` | NC week of month | `4` |
| `{{yesterday}}` | Day before (daily only) | `2026-08-09` |
| `{{tomorrow}}` | Day after (daily only) | `2026-08-11` |
| `{{monday:...}}` – `{{sunday:...}}` | Day of week (weekly) | `08-10` |

## Gregorian Calendar Notes

Configure monthly, quarterly, and yearly notes. Each section has a toggle to enable/disable, plus format, template, and folder fields with autocomplete.

**Default formats:**
- Monthly: `YYYY-MM`
- Quarterly: `YYYY-[Season]` (renders as `YYYY-[Q1]` through `YYYY-[Q4]`)
- Yearly: `YYYY`

## New Calendar Notes

Configure NC Phase, NC Month, NC Season, and NC Year notes. Same structure as GC notes but use NC format tokens.

**Default formats:**
- NC Phase: `NC-YY-MM-[P]P`
- NC Month: `NC-YY-MM`
- NC Season: `NC-YY-[S]S`
- NC Year: `NC-YY`

**Additional NC-only template tokens:**
`{{nc-date}}`, `{{nc-year}}`, `{{nc-month}}`, `{{nc-day}}`, `{{nc-phase}}`, `{{nc-season}}`, `{{nc-week}}`

## Advanced Settings

### Override Locale

Select a specific locale for moment.js date formatting. Default is "Same as system."

## Holiday System

| Setting | Default | Description |
|---------|---------|-------------|
| Region | None | Select a region for holiday display |
| Refresh status | — | Button to re-read the local `holidays.json` file |
| Download from GitHub | — | Button to download/update `holidays.json` from the plugin's GitHub repository |

Holidays appear as colored dots in calendar cells with the holiday name as tooltip.

## Breadcrumbs Integration

See [05 — Breadcrumbs Integration](#) for full details.

| Setting | Default | Description |
|---------|---------|-------------|
| Enable | Off | Toggle Breadcrumbs integration |
| Field names | up/down/prev/next | Customizable YAML/Dataview field names |
| Link style | [[wikilink]] | Wiki or markdown link format |
| Output mode | YAML | YAML frontmatter or Dataview inline `::` fields |
| Dataview template | `{field}:: {value}` | Template for inline field rendering |
| Dataview position | After YAML | Where to insert Dataview fields |
| Marker | `<!-- bc:insert -->` | Marker comment for position mode |
| Dual parents | On | Weekly/daily `up` inserts both GC and NC parents |
| Auto-inverse | Off | Also write reverse fields into target notes |
