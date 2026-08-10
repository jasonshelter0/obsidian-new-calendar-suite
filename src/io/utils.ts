import { normalizePath, TFile } from "obsidian";
import {
  DEFAULT_DAILY_FORMAT,
  DEFAULT_WEEKLY_FORMAT,
  DEFAULT_MONTHLY_FORMAT,
  DEFAULT_QUARTERLY_FORMAT,
  DEFAULT_YEARLY_FORMAT,
  DEFAULT_NC_PHASE_FORMAT,
  DEFAULT_NC_MONTH_FORMAT,
  DEFAULT_NC_SEASON_FORMAT,
  DEFAULT_NC_YEAR_FORMAT,
  DEFAULT_DATAVIEW_TEMPLATE,
  DEFAULT_DATAVIEW_MARKER,
} from "../constants";
import { ISettings } from "../settings";
import type { IBreadcrumbsSettings } from "../breadcrumbs/types";

// ── File path utilities ──────────────────────────────────────────

// Credit: @creationix/path.js
export function join(...partSegments: string[]): string {
  let parts: string[] = [];
  for (let i = 0, l = partSegments.length; i < l; i++) {
    parts = parts.concat(partSegments[i].split("/"));
  }
  const newParts: string[] = [];
  for (let i = 0, l = parts.length; i < l; i++) {
    const part = parts[i];
    if (!part || part === ".") continue;
    else newParts.push(part);
  }
  if (parts[0] === "") newParts.unshift("");
  return newParts.join("/");
}

export async function ensureFolderExists(path: string): Promise<void> {
  const dirs = path.replace(/\\/g, "/").split("/");
  dirs.pop(); // remove basename
  if (dirs.length) {
    const dir = join(...dirs);
    if (!window.app.vault.getAbstractFileByPath(dir)) {
      await window.app.vault.createFolder(dir);
    }
  }
}

export async function getNotePath(directory: string, filename: string): Promise<string> {
  if (!filename.endsWith(".md")) {
    filename += ".md";
  }
  const path = normalizePath(join(directory, filename));
  await ensureFolderExists(path);
  return path;
}

export async function getTemplateInfo(template: string): Promise<[string, any]> {
  const { metadataCache, vault } = window.app;
  const templatePath = normalizePath(template);
  if (templatePath === "/") {
    return Promise.resolve(["", null]);
  }
  try {
    const templateFile = metadataCache.getFirstLinkpathDest(templatePath, "");
    const contents = await vault.cachedRead(templateFile);
    const IFoldInfo = (window.app as any).foldManager.load(templateFile);
    return [contents, IFoldInfo];
  } catch (err) {
    console.error(`Failed to read the template '${templatePath}'`, err);
    return ["", null];
  }
}

// ── Date key utilities ───────────────────────────────────────────

/**
 * dateUID: canonical key for identifying daily/weekly/monthly/etc. notes
 * Format: "{granularity}-{ISO timestamp}"
 */
export function getDateUID(date: any, granularity: string = "day"): string {
  const ts = date.clone().startOf(granularity).format();
  return `${granularity}-${ts}`;
}

function removeEscapedCharacters(format: string): string {
  return format.replace(/\[[^\]]*\]/g, "");
}

/**
 * When parsing week formats that contain both week numbers and months,
 * moment chooses to ignore week numbers. Strip month/day formatting.
 */
function isFormatAmbiguous(format: string, granularity: string): boolean {
  if (granularity === "week") {
    const cleanFormat = removeEscapedCharacters(format);
    return (
      /w{1,2}/i.test(cleanFormat) &&
      (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat))
    );
  }
  return false;
}

export function getDateFromFilename(
  filename: string,
  granularity: string,
): any | null {
  const { moment } = window;

  const getSettings = {
    day: () => {
      const s = getDailyNoteSettings();
      return s.format;
    },
    week: () => {
      const s = getWeeklyNoteSettings();
      return s.format;
    },
    month: () => {
      const s = getMonthlyNoteSettings();
      return s.format;
    },
    quarter: () => {
      const s = getQuarterlyNoteSettings();
      return s.format;
    },
    year: () => {
      const s = getYearlyNoteSettings();
      return s.format;
    },
  };

  const formatFn = getSettings[granularity as keyof typeof getSettings];
  if (!formatFn) return null;

  const format = formatFn().split("/").pop();
  const noteDate = moment(filename, format, true);

  if (!noteDate.isValid()) {
    return null;
  }

  if (isFormatAmbiguous(format, granularity)) {
    if (granularity === "week") {
      const cleanFormat = removeEscapedCharacters(format);
      if (/w{1,2}/i.test(cleanFormat)) {
        return moment(
          filename,
          format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""),
          false,
        );
      }
    }
  }

  return noteDate;
}

export function getDateFromFile(file: TFile, granularity: string): any | null {
  return getDateFromFilename(file.basename, granularity);
}

// ── Template token engine ────────────────────────────────────────

function getDaysOfWeek(): string[] {
  const { moment } = window;
  let weekStart = moment.localeData()._week.dow;
  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  while (weekStart) {
    daysOfWeek.push(daysOfWeek.shift()!);
    weekStart--;
  }
  return daysOfWeek;
}

function getDayOfWeekNumericalValue(dayOfWeekName: string): number {
  return getDaysOfWeek().indexOf(dayOfWeekName.toLowerCase());
}

export interface TokenReplaceOptions {
  format: string;
  nc?: boolean;
  ncInfo?: { ny: number; nm: number; nd: number; pNy: string; pNm: string; pNd: string; phase: number; season: number };
}

export function replaceTemplateTokens(
  contents: string,
  date: any,
  opts: TokenReplaceOptions,
): string {
  const { moment } = window;
  const { format } = opts;

  // Use GC format (YYYY-MM-DD) for {{date}} in NC context;
  // NC templates use {{nc-date}} for the NC date.
  const displayFormat = opts.nc ? "YYYY-MM-DD" : format;

  let result = contents
    .replace(/{{\s*date\s*}}/gi, date.format(displayFormat))
    .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
    .replace(/{{\s*title\s*}}/gi, date.format(format))
    .replace(
      /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
      (_: string, _timeOrDate: string, calc: string, timeDelta: string, unit: string, momentFormat: string) => {
        const now = moment();
        const currentDate = date.clone().set({
          hour: now.get("hour"),
          minute: now.get("minute"),
          second: now.get("second"),
        });
        if (calc) {
          currentDate.add(parseInt(timeDelta, 10), unit as any);
        }
        if (momentFormat) {
          return currentDate.format(momentFormat.substring(1).trim());
        }
        return currentDate.format(displayFormat);
      },
    );

  // GC calendar tokens
  result = result
    .replace(/{{\s*gc-year\s*}}/gi, date.format("YYYY"))
    .replace(/{{\s*gc-month\s*}}/gi, date.format("MM"))
    .replace(/{{\s*gc-week\s*}}/gi, date.format("ww"))
    .replace(/{{\s*gc-quarter\s*}}/gi, String(Math.floor(date.month() / 3) + 1));

  // NC date tokens
  if (opts.nc && opts.ncInfo) {
    const ncDateStr = `${opts.ncInfo.pNy}-${opts.ncInfo.pNm}-${opts.ncInfo.pNd}`;
    result = result
      .replace(/{{\s*nc-date\s*}}/gi, ncDateStr)
      .replace(/{{\s*nc-year\s*}}/gi, opts.ncInfo.pNy)
      .replace(/{{\s*nc-month\s*}}/gi, opts.ncInfo.pNm)
      .replace(/{{\s*nc-day\s*}}/gi, opts.ncInfo.pNd)
      .replace(/{{\s*nc-phase\s*}}/gi, String(opts.ncInfo.phase))
      .replace(/{{\s*nc-season\s*}}/gi, String(opts.ncInfo.season))
      .replace(/{{\s*nc-week\s*}}/gi, String(
        window.NCEngine?.getNCWeekOfMonth?.(date, opts.ncInfo.ny, opts.ncInfo.nm) ?? ""
      ));
  }

  // Daily note specific
  result = result
    .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
    .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "day").format(format));

  // Weekly note specific: day-of-week tokens
  result = result.replace(
    /{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi,
    (_: string, dayOfWeek: string, fmt: string) => {
      const day = getDayOfWeekNumericalValue(dayOfWeek);
      return date.weekday(day).format(fmt.trim());
    },
  );

  return result;
}

// ── Frontmatter utilities ────────────────────────────────────────

export function getFrontmatterFromCache(file: TFile): Record<string, any> | null {
  const cache = window.app.metadataCache.getFileCache(file);
  return cache?.frontmatter || null;
}

// ── Settings readers ─────────────────────────────────────────────
// (defined here to avoid circular imports; re-exported from io/settings.ts)

function getPlugin(): any {
  return (window.app as any).plugins.getPlugin("new-calendar-suite");
}

function getSuiteSettings(): ISettings | null {
  const plugin = getPlugin();
  return plugin?.settings || plugin?.options || null;
}

export function getDailyNoteSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  const ds = suiteSettings?.daily;

  // Read core daily-notes plugin settings as base fallback
  let coreFormat = DEFAULT_DAILY_FORMAT;
  let coreFolder = "";
  let coreTemplate = "";
  try {
    const { internalPlugins } = window.app;
    const dailyNotesPlugin = (internalPlugins as any).getPluginById("daily-notes")?.instance;
    const options = dailyNotesPlugin?.options || {};
    coreFormat = options.format || DEFAULT_DAILY_FORMAT;
    coreFolder = options.folder?.trim() || "";
    coreTemplate = options.template?.trim() || "";
  } catch {
    // Core plugin not available — use defaults
  }

  // Per-field override: suite value if non-empty, otherwise fall back to core
  return {
    format: ds?.format || coreFormat,
    folder: ds?.folder?.trim() || coreFolder,
    template: ds?.template?.trim() || coreTemplate,
  };
}

export function getWeeklyNoteSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  if (suiteSettings?.weekly?.enabled) {
    return {
      format: suiteSettings.weekly.format || DEFAULT_WEEKLY_FORMAT,
      folder: suiteSettings.weekly.folder?.trim() || "",
      template: suiteSettings.weekly.template?.trim() || "",
    };
  }
  return { format: DEFAULT_WEEKLY_FORMAT, folder: "", template: "" };
}

export function getMonthlyNoteSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  return {
    format: suiteSettings?.monthly?.format || DEFAULT_MONTHLY_FORMAT,
    folder: suiteSettings?.monthly?.folder?.trim() || "",
    template: suiteSettings?.monthly?.template?.trim() || "",
  };
}

export function getQuarterlyNoteSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  return {
    format: suiteSettings?.quarterly?.format || DEFAULT_QUARTERLY_FORMAT,
    folder: suiteSettings?.quarterly?.folder?.trim() || "",
    template: suiteSettings?.quarterly?.template?.trim() || "",
  };
}

export function getYearlyNoteSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  return {
    format: suiteSettings?.yearly?.format || DEFAULT_YEARLY_FORMAT,
    folder: suiteSettings?.yearly?.folder?.trim() || "",
    template: suiteSettings?.yearly?.template?.trim() || "",
  };
}

// NC settings readers
export function getNCPhaseSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  return {
    format: suiteSettings?.ncPhase?.format || DEFAULT_NC_PHASE_FORMAT,
    folder: suiteSettings?.ncPhase?.folder?.trim() || "",
    template: suiteSettings?.ncPhase?.template?.trim() || "",
  };
}

export function getNCMonthSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  return {
    format: suiteSettings?.ncMonth?.format || DEFAULT_NC_MONTH_FORMAT,
    folder: suiteSettings?.ncMonth?.folder?.trim() || "",
    template: suiteSettings?.ncMonth?.template?.trim() || "",
  };
}

export function getNCSeasonSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  return {
    format: suiteSettings?.ncSeason?.format || DEFAULT_NC_SEASON_FORMAT,
    folder: suiteSettings?.ncSeason?.folder?.trim() || "",
    template: suiteSettings?.ncSeason?.template?.trim() || "",
  };
}

export function getNCYearSettings(): { format: string; folder: string; template: string } {
  const suiteSettings = getSuiteSettings();
  return {
    format: suiteSettings?.ncYear?.format || DEFAULT_NC_YEAR_FORMAT,
    folder: suiteSettings?.ncYear?.folder?.trim() || "",
    template: suiteSettings?.ncYear?.template?.trim() || "",
  };
}

// ── App has plugin checks (for compatibility) ────────────────────

export function appHasDailyNotesPluginLoaded(): boolean {
  const { app } = window;
  const dailyNotesPlugin = (app as any).internalPlugins?.plugins?.["daily-notes"];
  if (dailyNotesPlugin && dailyNotesPlugin.enabled) return true;
  const suiteSettings = getSuiteSettings();
  return suiteSettings?.daily?.enabled === true;
}

export function appHasWeeklyNotesPluginLoaded(): boolean {
  const suiteSettings = getSuiteSettings();
  return suiteSettings?.weekly?.enabled === true;
}

export function appHasMonthlyNotesPluginLoaded(): boolean {
  const suiteSettings = getSuiteSettings();
  return suiteSettings?.monthly?.enabled === true;
}

// ── Breadcrumbs settings reader ───────────────────────────────────

export function getBreadcrumbsSettings(): IBreadcrumbsSettings {
  const suiteSettings = getSuiteSettings();
  const bc = suiteSettings?.breadcrumbs;
  return {
    enabled: bc?.enabled ?? false,
    fieldUp: bc?.fieldUp || "up",
    fieldDown: bc?.fieldDown || "down",
    fieldPrev: bc?.fieldPrev || "prev",
    fieldNext: bc?.fieldNext || "next",
    linkStyle: bc?.linkStyle || "wikilink",
    outputMode: bc?.outputMode || "yaml",
    dataviewTemplate: bc?.dataviewTemplate || DEFAULT_DATAVIEW_TEMPLATE,
    dataviewPosition: bc?.dataviewPosition || "after-yaml",
    dataviewMarker: bc?.dataviewMarker || DEFAULT_DATAVIEW_MARKER,
    dualUpWeekly: bc?.dualUpWeekly ?? true,
    autoInverse: bc?.autoInverse ?? false,
  };
}
