import { TFile, Notice } from "obsidian";
import { NC } from "../utils/nc-engine";
import { buildNCKey, parseNCFilename, getPhaseStart, getSeasonStart, getNCYearStart } from "../utils/nc-dates";
import {
  getNotePath,
  getTemplateInfo,
  replaceTemplateTokens,
  getFrontmatterFromCache,
  getNCPhaseSettings,
  getNCMonthSettings,
  getNCSeasonSettings,
  getNCYearSettings,
} from "./utils";

// ── Frontmatter injection ────────────────────────────────────────

function injectFrontmatter(
  contents: string,
  ncType: string,
  ncDate: string,
  gcDate: string,
): string {
  const fmBlock = [
    `nc-type: ${ncType}`,
    `nc-date: "${ncDate}"`,
    `gc-date: ${gcDate}`,
  ].join("\n");

  // If template already has frontmatter, insert into existing block
  if (contents.startsWith("---")) {
    const endIdx = contents.indexOf("---", 3);
    if (endIdx !== -1) {
      return (
        contents.slice(0, endIdx) +
        fmBlock +
        "\n" +
        contents.slice(endIdx)
      );
    }
  }

  // Prepend new frontmatter block
  return `---\n${fmBlock}\n---\n${contents}`;
}

// ── NC Note creator ──────────────────────────────────────────────

type NCGranularity = "nc-phase" | "nc-month" | "nc-season" | "nc-year";

export async function createNCNote(
  date: any,
  granularity: NCGranularity,
): Promise<TFile | undefined> {
  const { vault } = window.app;
  const moment = window.moment;
  const m = moment(date);

  const getSettings = {
    "nc-phase": getNCPhaseSettings,
    "nc-month": getNCMonthSettings,
    "nc-season": getNCSeasonSettings,
    "nc-year": getNCYearSettings,
  };

  const { template, format, folder } = getSettings[granularity]();
  const ncInfo = NC.getNCDate(m);

  // Determine period-start GC moment
  let periodStart: any;
  let ncDateStr: string;

  switch (granularity) {
    case "nc-phase": {
      const phase = ncInfo.phase;
      periodStart = getPhaseStart(ncInfo.ny, ncInfo.nm, phase);
      ncDateStr = `${ncInfo.pNy}-${ncInfo.pNm}-${phase.toString().padStart(2, "0")}`;
      break;
    }
    case "nc-month": {
      periodStart = NC.getNCMonthStart(ncInfo.ny, ncInfo.nm);
      ncDateStr = `${ncInfo.pNy}-${ncInfo.pNm}-01`;
      break;
    }
    case "nc-season": {
      const season = ncInfo.season;
      periodStart = getSeasonStart(ncInfo.ny, season);
      ncDateStr = `${ncInfo.pNy}-${season.toString().padStart(2, "0")}-01`;
      break;
    }
    case "nc-year": {
      periodStart = getNCYearStart(ncInfo.ny);
      ncDateStr = `${ncInfo.pNy}-01-01`;
      break;
    }
    default:
      periodStart = m;
      ncDateStr = "00-00-00";
  }

  const filename = NC.format(periodStart, format);
  const normalizedPath = await getNotePath(folder, filename);

  // Return existing file if already created
  const existingFile = vault.getAbstractFileByPath(normalizedPath);
  if (existingFile && existingFile instanceof TFile) return existingFile;

  const [templateContents, IFoldInfo] = await getTemplateInfo(template);
  const periodNcInfo = NC.getNCDate(periodStart);
  const gcDateStr = periodStart.format("YYYY-MM-DD");

  const tokenContents = replaceTemplateTokens(templateContents, periodStart, {
    format,
    nc: true,
    ncInfo: periodNcInfo,
  });

  const contentsWithFm = injectFrontmatter(
    tokenContents,
    granularity === "nc-phase" ? "phase" : granularity === "nc-month" ? "month" : granularity === "nc-season" ? "season" : "year",
    ncDateStr,
    gcDateStr,
  );

  try {
    const createdFile = await vault.create(normalizedPath, contentsWithFm);
    if (IFoldInfo) {
      (window.app as any).foldManager.save(createdFile, IFoldInfo);
    }
    return createdFile;
  } catch (err) {
    console.error(`Failed to create NC note: '${normalizedPath}'`, err);
    new Notice(`Failed to create ${granularity} note: ${err.message || err}`);
    return undefined;
  }
}

// ── NC Note lookup ───────────────────────────────────────────────

export function getNCNote(
  key: string,
  allNotes: Record<string, TFile>,
): TFile | null {
  return allNotes[key] ?? null;
}

// ── NC Note indexing ─────────────────────────────────────────────

export function getAllNCNotes(
  granularity: NCGranularity,
): Record<string, TFile> {
  const notes: Record<string, TFile> = {};

  try {
    const { vault } = window.app;

    const getSettings = {
      "nc-phase": getNCPhaseSettings,
      "nc-month": getNCMonthSettings,
      "nc-season": getNCSeasonSettings,
      "nc-year": getNCYearSettings,
    };

    const { folder, format } = getSettings[granularity]();
    if (!folder) return notes;

    const folderObj = vault.getAbstractFileByPath(folder);
    if (!folderObj) return notes;

    (vault as any).recurseChildren(folderObj, (note: TFile) => {
      if (note instanceof TFile) {
        const basename = note.basename;
        const frontmatter = getFrontmatterFromCache(note);
        const parsed = parseNCFilename(basename, format, granularity, frontmatter);

        if (parsed) {
          const key = buildNCKey(
            granularity,
            parsed.ny,
            parsed.nm,
            granularity === "nc-phase" ? parsed.phase : granularity === "nc-season" ? parsed.season : undefined,
          );
          notes[key] = note;
        }
      }
    });
  } catch (err) {
    console.log(`[New Calendar Suite] Failed to find ${granularity} notes folder`, err);
  }

  return notes;
}

// ── window.NCNotes API for DataviewJS / Templater ─────────────────

export const NCNotesAPI = {
  createNCNote,
  getNCNote,
  getAllNCNotes,
  getNCPhaseNote: (date: any, all: Record<string, TFile>) => {
    const info = NC.getNCDate(window.moment(date));
    const key = buildNCKey("nc-phase", info.ny, info.nm, info.phase);
    return getNCNote(key, all);
  },
  getNCMonthNote: (date: any, all: Record<string, TFile>) => {
    const info = NC.getNCDate(window.moment(date));
    const key = buildNCKey("nc-month", info.ny, info.nm);
    return getNCNote(key, all);
  },
  getNCSeasonNote: (date: any, all: Record<string, TFile>) => {
    const info = NC.getNCDate(window.moment(date));
    const key = buildNCKey("nc-season", info.ny, info.nm, info.season);
    return getNCNote(key, all);
  },
  getNCYearNote: (date: any, all: Record<string, TFile>) => {
    const info = NC.getNCDate(window.moment(date));
    const key = buildNCKey("nc-year", info.ny, info.nm);
    return getNCNote(key, all);
  },
  getAllNCPhaseNotes: () => getAllNCNotes("nc-phase"),
  getAllNCMonthNotes: () => getAllNCNotes("nc-month"),
  getAllNCSeasonNotes: () => getAllNCNotes("nc-season"),
  getAllNCYearNotes: () => getAllNCNotes("nc-year"),
  NC,
};
