import type { TFile } from "obsidian";
import { NC } from "../utils/nc-engine";
import {
  getPhaseStart,
  getSeasonStart,
  getNCYearStart,
  parseNCFilename,
} from "../utils/nc-dates";
import {
  getDateFromFile,
  getMonthlyNoteSettings,
  getQuarterlyNoteSettings,
  getYearlyNoteSettings,
  getNCPhaseSettings,
  getNCMonthSettings,
  getNCSeasonSettings,
  getNCYearSettings,
} from "../io/utils";
import type { BcNoteType, ResolvedTarget } from "./types";

// ── Type detection ────────────────────────────────────────────────

/**
 * Detect the calendar note type from YAML frontmatter fields or filename.
 * Priority: nc-type/gc-type YAML → filename format matching.
 */
export function detectNoteType(
  file: TFile,
  frontmatter?: Record<string, any> | null,
): BcNoteType | null {
  // 1. YAML: nc-type (values set by injectFrontmatter in ncNotes.ts)
  const ncType = frontmatter?.["nc-type"];
  if (ncType) {
    switch (ncType) {
      case "phase": return "nc-phase";
      case "month": return "nc-month";
      case "season": return "nc-season";
      case "year": return "nc-year";
    }
  }

  // 2. YAML: gc-type
  const gcType = frontmatter?.["gc-type"];
  if (gcType) {
    switch (gcType) {
      case "daily": case "weekly": case "monthly":
      case "quarterly": case "yearly":
        return gcType;
    }
  }

  // 3. Filename fallback — GC first (simpler)
  if (getDateFromFile(file, "day")) return "daily";
  if (getDateFromFile(file, "week")) return "weekly";
  if (getDateFromFile(file, "month")) return "monthly";
  // Quarterly: default format YYYY-[Season] becomes YYYY-[Q1]…Q4;
  // also try strict [Q]Q parsing
  if (getDateFromFile(file, "quarter")) return "quarterly";
  // Try explicit [Qn] format for quarterly
  try {
    const m = window.moment(file.basename, "YYYY-[Q]Q", true);
    if (m.isValid()) return "quarterly";
  } catch { /* ignore */ }
  if (getDateFromFile(file, "year")) return "yearly";

  // 4. Filename fallback — NC
  const ncFormats: { g: BcNoteType; f: () => { format: string } }[] = [
    { g: "nc-phase", f: getNCPhaseSettings },
    { g: "nc-month", f: getNCMonthSettings },
    { g: "nc-season", f: getNCSeasonSettings },
    { g: "nc-year", f: getNCYearSettings },
  ];
  for (const { g, f } of ncFormats) {
    const { format } = f();
    if (parseNCFilename(file.basename, format, g as any)) return g;
  }

  return null;
}

// ── Period anchor ─────────────────────────────────────────────────

/**
 * Resolve the GC moment that anchors a calendar note to its period.
 * For NC types this is the start of the period (phase/month/season/year).
 */
export function resolveNoteMoment(
  file: TFile,
  type: BcNoteType,
  frontmatter?: Record<string, any> | null,
): any | null {
  const moment = window.moment;

  switch (type) {
    case "daily": {
      const d = getDateFromFile(file, "day");
      return d ? d.clone().startOf("day") : null;
    }
    case "weekly": {
      const w = getDateFromFile(file, "week");
      return w ? w.clone().startOf("week") : null;
    }
    case "monthly": {
      const m = getDateFromFile(file, "month");
      return m ? m.clone().startOf("month") : null;
    }
    case "quarterly": {
      // Try standard quarter format first
      const q = getDateFromFile(file, "quarter");
      if (q) return q.clone().startOf("quarter");
      // Try [Q]Q format
      const qm = moment(file.basename, "YYYY-[Q]Q", true);
      if (qm.isValid()) {
        const mon = (parseInt(qm.format("Q"), 10) - 1) * 3;
        return qm.clone().month(mon).startOf("month");
      }
      return null;
    }
    case "yearly": {
      const y = getDateFromFile(file, "year");
      return y ? y.clone().startOf("year") : null;
    }
    // NC types — read nc-date from YAML directly; fall back to filename parsing
    case "nc-phase":
    case "nc-month":
    case "nc-season":
    case "nc-year": {
      // Primary: parse nc-date from YAML frontmatter (always present in NC notes)
      const ncDate = frontmatter?.["nc-date"];
      if (ncDate && typeof ncDate === "string") {
        const parts = ncDate.replace(/"/g, "").split("-");
        if (parts.length === 3) {
          const ny = parseInt(parts[0], 10);
          const nm = parseInt(parts[1], 10);
          if (!isNaN(ny) && !isNaN(nm)) {
            switch (type) {
              case "nc-phase": {
                const phase = NC.getPhase(ny, nm, parseInt(parts[2], 10) || 1);
                return getPhaseStart(ny, nm, phase);
              }
              case "nc-month":
                return NC.getNCMonthStart(ny, nm);
              case "nc-season": {
                const season = NC.getSeason(ny, nm);
                return getSeasonStart(ny, season);
              }
              case "nc-year":
                return getNCYearStart(ny);
            }
          }
        }
      }
      // Fallback: try filename parsing with frontmatter
      const ncFormats: Record<string, () => { format: string }> = {
        "nc-phase": getNCPhaseSettings,
        "nc-month": getNCMonthSettings,
        "nc-season": getNCSeasonSettings,
        "nc-year": getNCYearSettings,
      };
      const { format } = ncFormats[type]();
      const parsed = parseNCFilename(file.basename, format, type, frontmatter);
      if (!parsed) return null;
      switch (type) {
        case "nc-phase": return getPhaseStart(parsed.ny, parsed.nm, parsed.phase);
        case "nc-month": return NC.getNCMonthStart(parsed.ny, parsed.nm);
        case "nc-season": return getSeasonStart(parsed.ny, parsed.season);
        case "nc-year": return getNCYearStart(parsed.ny);
        default: return null;
      }
    }
    default:
      return null;
  }
}

// ── Week helpers ───────────────────────────────────────────────────

/**
 * The Thursday of a week determines which month/phase that week belongs to,
 * independent of locale's week-start configuration.
 * weekStart is a moment at the start of a week (Monday or Sunday depending on locale).
 * Thursday = weekStart + 3 days.
 */
export function thursdayOfWeek(weekStart: any): any {
  return weekStart.clone().add(3, "days");
}

/**
 * Generate all week-start moments whose Thursday falls within [rangeStart, rangeEnd].
 */
export function weeksInRange(rangeStart: any, rangeEnd: any): any[] {
  const weeks: any[] = [];
  let cursor = rangeStart.clone().startOf("week");
  const end = rangeEnd.clone();

  while (true) {
    const thu = thursdayOfWeek(cursor);
    if (thu.isAfter(end, "day")) break;
    if (thu.isSameOrAfter(rangeStart, "day")) {
      weeks.push(cursor.clone());
    }
    cursor.add(1, "week");
  }
  return weeks;
}

// ── Direction computation ─────────────────────────────────────────

const GC_CHAIN: BcNoteType[] = ["yearly", "quarterly", "monthly", "weekly", "daily"];
const NC_CHAIN: BcNoteType[] = ["nc-year", "nc-season", "nc-month", "nc-phase", "weekly", "daily"];

function gcParent(type: BcNoteType): BcNoteType | null {
  const idx = GC_CHAIN.indexOf(type);
  if (idx <= 0) return null;
  return GC_CHAIN[idx - 1];
}

function ncParent(type: BcNoteType): BcNoteType | null {
  const idx = NC_CHAIN.indexOf(type);
  if (idx <= 0) return null;
  return NC_CHAIN[idx - 1];
}

function gcChildren(type: BcNoteType): BcNoteType[] {
  const idx = GC_CHAIN.indexOf(type);
  if (idx < 0 || idx >= GC_CHAIN.length - 1) return [];
  return [GC_CHAIN[idx + 1]];
}

function ncChildren(type: BcNoteType): BcNoteType[] {
  const idx = NC_CHAIN.indexOf(type);
  if (idx < 0 || idx >= NC_CHAIN.length - 1) return [];
  return [NC_CHAIN[idx + 1]];
}

// ── Moment-based target builders ───────────────────────────────────

function makeTarget(type: BcNoteType, moment: any): ResolvedTarget {
  return { type, moment: moment.clone(), file: null };
}

/**
 * Compute the parent(s) for a calendar note.
 * Weekly and daily have dual parents when dualUp is true.
 */
export function computeUp(
  type: BcNoteType,
  moment: any,
  dualUp: boolean,
): ResolvedTarget[] {
  const targets: ResolvedTarget[] = [];

  switch (type) {
    case "daily": {
      // GC: weekly
      targets.push(makeTarget("weekly", moment.clone().startOf("week")));
      if (dualUp) {
        // NC: the nc-phase containing this day
        const ncInfo = NC.getNCDate(moment);
        const [phaseStart] = NC.getPhaseRange(ncInfo.ny, ncInfo.nm, ncInfo.phase);
        targets.push(makeTarget("nc-phase", phaseStart));
      }
      break;
    }
    case "weekly": {
      // GC: the monthly containing Thursday of this week
      const thu = thursdayOfWeek(moment);
      targets.push(makeTarget("monthly", thu.clone().startOf("month")));
      if (dualUp) {
        // NC: the nc-phase containing Thursday of this week
        const ncInfo = NC.getNCDate(thu);
        const [phaseStart] = NC.getPhaseRange(ncInfo.ny, ncInfo.nm, ncInfo.phase);
        targets.push(makeTarget("nc-phase", phaseStart));
      }
      break;
    }
    case "monthly":
      targets.push(makeTarget("quarterly", moment.clone().startOf("quarter")));
      break;
    case "quarterly":
      targets.push(makeTarget("yearly", moment.clone().startOf("year")));
      break;
    case "yearly":
      // Top of GC chain — no parent
      break;
    case "nc-phase": {
      const ncInfo = NC.getNCDate(moment);
      const monthStart = NC.getNCMonthStart(ncInfo.ny, ncInfo.nm);
      targets.push(makeTarget("nc-month", monthStart));
      break;
    }
    case "nc-month": {
      const ncInfo = NC.getNCDate(moment);
      const seasonStart = getSeasonStart(ncInfo.ny, ncInfo.season);
      targets.push(makeTarget("nc-season", seasonStart));
      break;
    }
    case "nc-season": {
      const ncInfo = NC.getNCDate(moment);
      const yearStart = getNCYearStart(ncInfo.ny);
      targets.push(makeTarget("nc-year", yearStart));
      break;
    }
    case "nc-year":
      // Top of NC chain — no parent
      break;
  }

  return targets;
}

/**
 * Compute all children for a calendar note.
 * Creates targets for every sub-period.
 */
export function computeDown(
  type: BcNoteType,
  moment: any,
): ResolvedTarget[] {
  const targets: ResolvedTarget[] = [];

  switch (type) {
    case "yearly": {
      // 4 quarters: Q1 (Jan), Q2 (Apr), Q3 (Jul), Q4 (Oct)
      for (let q = 0; q < 4; q++) {
        targets.push(makeTarget("quarterly", moment.clone().month(q * 3).startOf("month")));
      }
      break;
    }
    case "quarterly": {
      // 3 months
      for (let m = 0; m < 3; m++) {
        targets.push(makeTarget("monthly", moment.clone().add(m, "months")));
      }
      break;
    }
    case "monthly": {
      // All weeks whose Thursday is in the month
      const monthEnd = moment.clone().endOf("month");
      const weeks = weeksInRange(moment, monthEnd);
      weeks.forEach((w) => targets.push(makeTarget("weekly", w)));
      break;
    }
    case "weekly": {
      // 7 days
      for (let d = 0; d < 7; d++) {
        targets.push(makeTarget("daily", moment.clone().add(d, "days")));
      }
      break;
    }
    case "daily":
      // Bottom of chain
      break;
    case "nc-year": {
      // All 4 seasons
      const ncInfo = NC.getNCDate(moment);
      for (let s = 1; s <= 4; s++) {
        targets.push(makeTarget("nc-season", getSeasonStart(ncInfo.ny, s)));
      }
      break;
    }
    case "nc-season": {
      const ncInfo = NC.getNCDate(moment);
      const season = NC.getSeason(ncInfo.ny, ncInfo.nm);
      const [startNm, endNm] = NC.getSeasonMonths(ncInfo.ny, season);
      for (let m = startNm; m <= endNm; m++) {
        targets.push(makeTarget("nc-month", NC.getNCMonthStart(ncInfo.ny, m)));
      }
      break;
    }
    case "nc-month": {
      // All 4 phases
      const ncInfo = NC.getNCDate(moment);
      for (let p = 1; p <= 4; p++) {
        const [phaseStart] = NC.getPhaseRange(ncInfo.ny, ncInfo.nm, p);
        targets.push(makeTarget("nc-phase", phaseStart));
      }
      break;
    }
    case "nc-phase": {
      // All weeks whose Thursday is in the phase range
      const ncInfo = NC.getNCDate(moment);
      const [phaseStart, phaseEnd] = NC.getPhaseRange(ncInfo.ny, ncInfo.nm, ncInfo.phase);
      const weeks = weeksInRange(phaseStart, phaseEnd);
      weeks.forEach((w) => targets.push(makeTarget("weekly", w)));
      break;
    }
  }

  return targets;
}

/**
 * Compute the previous sibling (same granularity, earlier in time).
 */
export function computePrev(
  type: BcNoteType,
  moment: any,
): ResolvedTarget | null {
  switch (type) {
    case "daily":
      return makeTarget("daily", moment.clone().subtract(1, "day"));
    case "weekly":
      return makeTarget("weekly", moment.clone().subtract(1, "week"));
    case "monthly":
      return makeTarget("monthly", moment.clone().subtract(1, "month"));
    case "quarterly":
      return makeTarget("quarterly", moment.clone().subtract(1, "quarter"));
    case "yearly":
      return makeTarget("yearly", moment.clone().subtract(1, "year"));
    case "nc-phase":
    case "nc-month":
    case "nc-season":
    case "nc-year": {
      const ncInfo = NC.getNCDate(moment);
      const prev = NC.prevPeriod(ncInfo, type);
      // Boundary guard: if prev is same as current, we're at the start
      if (NC.compare(prev, ncInfo) === 0) return null;
      // Map back to a period-start moment
      const startMoment = ncPeriodToMoment(type, prev);
      return startMoment ? makeTarget(type, startMoment) : null;
    }
  }
  return null;
}

/**
 * Compute the next sibling (same granularity, later in time).
 */
export function computeNext(
  type: BcNoteType,
  moment: any,
): ResolvedTarget | null {
  switch (type) {
    case "daily":
      return makeTarget("daily", moment.clone().add(1, "day"));
    case "weekly":
      return makeTarget("weekly", moment.clone().add(1, "week"));
    case "monthly":
      return makeTarget("monthly", moment.clone().add(1, "month"));
    case "quarterly":
      return makeTarget("quarterly", moment.clone().add(1, "quarter"));
    case "yearly":
      return makeTarget("yearly", moment.clone().add(1, "year"));
    case "nc-phase":
    case "nc-month":
    case "nc-season":
    case "nc-year": {
      const ncInfo = NC.getNCDate(moment);
      const next = NC.nextPeriod(ncInfo, type);
      if (NC.compare(next, ncInfo) === 0) return null;
      const startMoment = ncPeriodToMoment(type, next);
      return startMoment ? makeTarget(type, startMoment) : null;
    }
  }
  return null;
}

/**
 * Convert an NC period result from nextPeriod/prevPeriod back to a GC moment.
 */
function ncPeriodToMoment(
  type: BcNoteType,
  nc: { ny: number; nm: number; nd: number; phase: number; season: number },
): any | null {
  switch (type) {
    case "nc-phase": {
      const [start] = NC.getPhaseRange(nc.ny, nc.nm, nc.phase);
      return start;
    }
    case "nc-month":
      return NC.getNCMonthStart(nc.ny, nc.nm);
    case "nc-season":
      return getSeasonStart(nc.ny, nc.season);
    case "nc-year":
      return getNCYearStart(nc.ny);
    default:
      return null;
  }
}

// ── Link rendering ────────────────────────────────────────────────

/**
 * Render a link from sourceFile to targetFile in the configured style.
 *
 * YAML values are always raw [[wikilink]] or [alias](path) — never
 * Obsidian's pipe-link [[path|alias]] because Breadcrumbs resolves by
 * basename. The double-quote wrapping and YAML list formatting are
 * handled by the writer, not the renderer.
 */
export function toLink(
  target: TFile,
  _sourceFile: TFile,
  style: "wikilink" | "markdown",
): string {
  if (style === "markdown") {
    const alias = target.basename;
    return `[${alias}](${encodeURI(target.path)})`;
  }
  // wikilink: use basename (no .md extension)
  return `[[${target.basename}]]`;
}
