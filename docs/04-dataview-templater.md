# 04 — Dataview & Templater Examples

## Dataview Queries

### List all NC phase notes this season

```dataview
TABLE nc-date, gc-date, nc-phase
FROM "NC/Phase"
WHERE nc-type = "phase" AND nc-year = "04" AND nc-season = "2"
SORT nc-date ASC
```

### Filter notes by NC date range

```dataviewjs
const [start, end] = window.NCDates.getPeriodRange("nc-month", 4, 6);
dv.list(
  dv.pages()
    .where(p => p.file.day >= start && p.file.day < end)
    .file.link
);
```

### Group tasks by NC month

When using templates that insert `nc-date` into YAML:

```yaml
---
nc-type: phase
nc-date: "04-06-15"
nc-year: 04
nc-month: 06
nc-phase: 3
gc-date: 2026-09-06
---
```

```dataview
TABLE file.tasks.text AS Task
FROM "NC/Phase"
WHERE nc-year = "04" AND nc-month = "06"
FLATTEN file.tasks
```

### All notes created in a specific NC year

```dataview
TABLE nc-date, nc-type, gc-date
WHERE nc-year = "04"
SORT nc-date ASC
```

### Breadcrumbs hierarchy check

```dataview
TABLE up, down, prev, next
WHERE up OR down OR prev OR next
```

## Templater Templates

### Daily note with NC info (aliased)

Create a daily note named by GC date, with NC metadata:

```markdown
---
aliases: ["NC-<% window.NCDates.smartFormat(tp.file.title, "YY-MM-DD", "GC") %>"]
nc-date: "<% window.NCDates.smartFormat(tp.file.title, "YY-MM-DD", "GC") %>"
nc-year: "<% window.NCDates.smartFormat(tp.file.title, "YY", "GC") %>"
nc-month: "<% window.NCDates.smartFormat(tp.file.title, "MM", "GC") %>"
nc-day: "<% window.NCDates.smartFormat(tp.file.title, "DD", "GC") %>"
gc-date: "<% tp.date.now("YYYY-MM-DD") %>"
tags: [daily]
---

# <% tp.date.now("dddd, MMMM D, YYYY") %>

> 🌐 GC: <% tp.date.now("YYYY-MM-DD") %>
> 🗓️ NC: <% window.NCDates.smartFormat(tp.file.title, "YY-MM-DD", "GC") %>
```

### Weekly note with both GC and NC parents

```markdown
---
gc-type: weekly
gc-date: "<% tp.date.now("gggg-[W]ww") %>"
nc-info: "<% window.NCDates.smartFormat(tp.file.title, "YY-MM", "GC") %>"
nc-phase: <% window.NCDates.smartFormat(tp.file.title, "P", "GC") %>
up:
  - "[[<% tp.date.now("YYYY-MM") %>]]"
  - "[[NC-<% window.NCDates.smartFormat(tp.file.title, "YY-MM-[P]P", "GC") %>]]"
tags: [weekly]
---

# Week <% tp.date.now("ww") %>, <% tp.date.now("YYYY") %>
```

### NC Phase note (using built-in tokens)

```markdown
---
nc-type: phase
nc-date: "{{nc-date}}"
nc-year: {{nc-year}}
nc-month: {{nc-month}}
nc-phase: {{nc-phase}}
nc-season: {{nc-season}}
gc-date: "{{date}}"
---

# NC Phase {{nc-date}}

> 🌐 GC: {{date}} | 🕒 {{time}}
```

Note: the `{{...}}` tokens above are processed by the plugin's template engine, not by Templater. Use these in the template file set in plugin settings.

### Templater-only: Get NC week of month

```js
// Get the NC week number for today
<% window.NCDates.getNCWeekOfMonth(moment(), 4, 6) %>

// Get full NC info
<% const nc = window.NCDates.today(); %>
NC: <%= nc.pNy %>-<%= nc.pNm %>-<%= nc.pNd %>
Phase: <%= nc.phase %> / Season: <%= nc.season %>
```

## DataviewJS: Dynamic NC Calendar

```dataviewjs
const today = window.NCDates.today();
const [start, end] = window.NCDates.getPeriodRange("nc-month", today.ny, today.nm);

const pages = dv.pages()
  .where(p => p.file.day >= start && p.file.day <= end)
  .where(p => p["nc-type"] === "phase");

dv.table(
  ["Phase", "NC Date", "GC Date", "File"],
  pages.map(p => [
    p["nc-phase"],
    p["nc-date"],
    p["gc-date"],
    p.file.link
  ])
);
```

## GC Week Number in Templates

Use lowercase `ww` for locale-aware week numbers (respects your week-start setting), uppercase `WW` for ISO weeks:

```markdown
---
week-locale: {{gc-week}}
week-iso: {{date:WW}}
---
```

In Templater:
```
<% window.NCEngine.smartFormat(tp.file.title, "YYYY-ww", "GC") %>
```
