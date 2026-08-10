# 03 — API Reference

The plugin exposes three public APIs on `window` for use in DataviewJS, Templater, and other plugins.

## `window.NCDates` — Full NC Date API

Access via `window.NCDates` in DataviewJS blocks or `<% window.NCDates %>` in Templater.

### Date Info

```js
// Today's NC date
const today = window.NCDates.today();
// → { ny: 4, nm: 6, nd: 15, pNy: "04", pNm: "06", pNd: "15", phase: 3, season: 2, color: "#00A091" }

// Yesterday / tomorrow
const yesterday = window.NCDates.yesterday();
const tomorrow = window.NCDates.tomorrow();

// Get NC info for any GC moment or date string
const nc = window.NCDates.get(moment("2026-08-10"));
const nc2 = window.NCDates.get("2026-08-10");

// Convert GC (gy, gm, gd) to NC
const nc3 = window.NCDates.convert(2026, 8, 10);
```

### Navigation

```js
const today = window.NCDates.today();

// Next/previous period
const nextMonth = window.NCDates.nextPeriod(today, "nc-month");
const prevPhase = window.NCDates.prevPeriod(today, "nc-phase");
// Valid granularities: "day", "nc-phase", "nc-month", "nc-season", "nc-year"

// Add NC days
const plus7 = window.NCDates.addDays(today.ny, today.nm, today.nd, 7);
```

### Comparison

```js
const a = { ny: 4, nm: 6, nd: 1 };
const b = { ny: 4, nm: 6, nd: 15 };
window.NCDates.compare(a, b); // -1 (a is before b)
```

### Ranges (for Dataview WHERE clauses)

```js
// Get GC moment range for any NC period
const [start, end] = window.NCDates.getPeriodRange("nc-month", 4, 6);
// → [moment("2026-08-06"), moment("2026-09-05")] (approximate)

// Use in Dataview:
dv.pages()
  .where(p => p.file.day >= start && p.file.day < end)
  .where(p => p["nc-type"] === "phase")
```

Valid granularities: `"day"`, `"nc-phase"`, `"nc-month"`, `"nc-season"`, `"nc-year"`.

For `day`: `getPeriodRange("day", ny, nm, nd)`
For `nc-phase`: `getPeriodRange("nc-phase", ny, nm, phase)`
For `nc-season`: `getPeriodRange("nc-season", ny, season)`

### String Helpers

```js
// Format NC date as canonical string
const str = window.NCDates.toDateString({ ny: 4, nm: 6, nd: 15 });
// → "04-06-15"

// Parse canonical string back to NC object
const parsed = window.NCDates.parseDateString("04-06-15");
// → { ny: 4, nm: 6, nd: 15, phase: 3, season: 2, color: "#00A091", ... }

// Format any GC date using NC format engine
const formatted = window.NCDates.format(moment(), "NC-YY-MM-[P]P");
// → "NC-04-06-P3"

// Smart format from filename or now
const smart = window.NCDates.smartFormat("2026-08-10", "YYYY-ww", "GC");
// → "2026-33"
```

### Calendar Structure

```js
window.NCDates.getPhase(ny, nm, nd);        // → phase (1-4)
window.NCDates.getSeason(ny, nm);            // → season (1-4)
window.NCDates.getPhaseRange(ny, nm, phase); // → [startMoment, endMoment]
window.NCDates.getSeasonMonths(ny, season);  // → [startMonth, endMonth]
window.NCDates.getMonthRange(ny, nm);        // → [startMoment, endMoment]
window.NCDates.getNCMonthStart(ny, nm);      // → GC moment
window.NCDates.getNCWeekOfMonth(date, ny, nm); // → week number
```

### Filename Parsing

```js
// Parse an NC filename
window.NCDates.parseFilename("NC-04-06-P3", "NC-YY-MM-[P]P", "nc-phase");

// Build canonical key
window.NCDates.buildKey("nc-month", 4, 6); // → "nc-month-04-06"

// Build regex from NC format
window.NCDates.buildFormatRegex("NC-YY-MM");
```

### Cross-Calendar Mapping

```js
// Approximate GC year for an NC period
window.NCDates.approxGCYear(4);       // GC year of NC year 4 start
window.NCDates.approxGCYear(4, 6);    // GC year of NC month 6
window.NCDates.approxGCYear(4, 2, true); // GC year of NC season 2
```

### i18n

```js
window.NCDates.numToChinese(4);  // → "四"
```

## `window.NCEngine` — Low-Level Engine

The raw NC object with all computational methods. Prefer `window.NCDates` for most use cases.

```js
window.NCEngine.toNewCalendar(2026, 8, 10);  // GC → NC
window.NCEngine.format(moment(), "NC-YY-MM");
window.NCEngine.getPhase(4, 6, 15);
window.NCEngine.getSeason(4, 6);
window.NCEngine.getPhaseRange(4, 6, 3);
window.NCEngine.getSeasonMonths(4, 2);
window.NCEngine.getMonthRange(4, 6);
window.NCEngine.getNCMonthStart(4, 6);
window.NCEngine.getNCWeekOfMonth(moment(), 4, 6);
window.NCEngine.smartFormat("2026-08-10", "YYYY-ww", "GC");
window.NCEngine.nextPeriod(ncInfo, "nc-month");
window.NCEngine.prevPeriod(ncInfo, "nc-month");
window.NCEngine.getPeriodRange("nc-month", 4, 6);
window.NCEngine.numToChinese(4);
```

## `window.NCNotes` — Note Management API

```js
// Create an NC note
const note = await window.NCNotes.createNCNote(moment(), "nc-phase");

// Look up by key
const key = window.NCDates.buildKey("nc-phase", 4, 6, 3);
const found = window.NCNotes.getNCNote(key, allPhaseNotes);

// Get all notes of a type
const allPhases = window.NCNotes.getAllNCPhaseNotes();
const allMonths = window.NCNotes.getAllNCMonthNotes();

// Convenience: get note for a GC date
const phaseNote = window.NCNotes.getNCPhaseNote(moment(), allPhases);
const monthNote = window.NCNotes.getNCMonthNote(moment(), allMonths);
const seasonNote = window.NCNotes.getNCSeasonNote(moment(), allSeasons);
const yearNote = window.NCNotes.getNCYearNote(moment(), allYears);
```
