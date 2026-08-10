# 01 — New Calendar Concept

The New Calendar (NC) is a solar-term-based calendar system derived from the 24 Chinese solar terms (节气). Unlike the Gregorian Calendar (GC), which has arbitrary month lengths, the NC calendar is astronomically grounded.

## How It Works

### The 24 Solar Terms

The Sun's apparent path along the ecliptic is divided into 24 segments of 15° each. These are the solar terms — equinoxes, solstices, and intermediate points. Four of these terms serve as **checkpoints** that partition the NC year into months.

### NC Years and Months

- Each NC year contains **15 or 16 months** (year 2 has 15 due to an astronomical adjustment)
- Each month spans roughly **4–5 weeks** (28–35 days)
- Months are grouped into **4 seasons** (3–4 months each)
- Each month is divided into **4 phases** (roughly 1 week each)
- The NC epoch starts at **2013** (NC year 1)

### The Color System

Each of the 16 possible month positions has a unique color:

| Month | Color | Name |
|-------|-------|------|
| 01 | `#E63C3C` | Crimson / 绯红 |
| 02 | `#F27828` | Persimmon / 柿橙 |
| 03 | `#C89100` | Goldenrod / 金珀 |
| 04 | `#82A528` | Olive / 橄榄绿 |
| 05 | `#28AA5A` | Jade / 翡翠 |
| 06 | `#00A091` | Teal / 碧青 |
| 07 | `#0096C8` | Lake Blue / 湖蓝 |
| 08 | `#3278E6` | Azure / 蔚蓝 |
| 09 | `#6464F0` | Indigo / 靛青 |
| 10 | `#9655E6` | Grape / 葡萄紫 |
| 11 | `#BE4BC8` | Orchid / 兰花紫 |
| 12 | `#DC4696` | Magenta / 玫红 |
| 13 | `#EB6478` | Coral Pink / 珊瑚粉 |
| 14 | `#6E829B` | Slate / 石板灰 |
| 15 | `#AF6E4B` | Ochre / 赭石 |
| 16 | `#558773` | Deep Moss / 墨绿 |

The 16-color dot array in the NC view toolbar represents all possible months, with the current month highlighted.

### Phase Formula

For an NC month with `T` total weeks, the 4 phases are allocated as:

```
Num(i) = floor(T / 4) + (i ≤ T % 4 ? 1 : 0)
```

Remainder weeks go to **early** phases (1, 2, ...), not the last phase.

### Season Structure

| Year Type | Season 1 | Season 2 | Season 3 | Season 4 |
|-----------|----------|----------|----------|----------|
| Standard (16 months) | Months 1–4 | Months 5–8 | Months 9–12 | Months 13–16 |
| Year 2 (15 months) | Months 1–4 | Months 5–8 | Months 9–11 | Months 12–15 |

### GC ↔ NC Mapping

The `NC.getNCDate(date)` function converts any GC date to its NC equivalent:

```js
const today = window.NCDates.today();
// { ny: 4, nm: 6, nd: 15, pNy: "04", pNm: "06", pNd: "15", phase: 3, season: 2, color: "#00A091" }
```

Mapping is deterministic and memoized — any GC date always maps to the same NC date.

### The Two Hierarchies

```
GC:  yearly  ──→ quarterly ──→ monthly ──→ weekly ──→ daily
NC:  nc-year ──→ nc-season ──→ nc-month ──→ nc-phase ─→ weekly ──→ daily
```

Weekly and daily notes sit at the bottom of both hierarchies — they have dual parentage when used with Breadcrumbs integration.

## NC Date Format

The NC format engine supports these tokens in filename patterns:

| Token | Output (padded) | Output (raw) | Example |
|-------|-----------------|-------------|---------|
| `YY` / `Y` | Year padded | Year raw | `04` / `4` |
| `MM` / `M` | Month padded | Month raw | `06` / `6` |
| `DD` / `D` | Day padded | Day raw | `15` / `15` |
| `ww` / `w` | Week of month | Week raw | `03` / `3` |
| `PP` / `P` | Phase padded | Phase raw | `03` / `3` |
| `SS` / `S` | Season padded | Season raw | `02` / `2` |
| `CY` | Chinese year | | `四年` |
| `CM` | Chinese month | | `六月` |
| `[...]` | Literal text | | `[P]P` → `P3` |
