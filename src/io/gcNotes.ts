import { TFile, Vault } from "obsidian";
import {
  getNotePath,
  getTemplateInfo,
  getDateUID,
  getDateFromFile,
  replaceTemplateTokens,
  getMonthlyNoteSettings,
  getQuarterlyNoteSettings,
  getYearlyNoteSettings,
} from "./utils";

// ── Shared periodic note creator ─────────────────────────────────

type Granularity = "month" | "quarter" | "year";

async function createPeriodicNote(
  date: any,
  granularity: Granularity,
): Promise<TFile | undefined> {
  const { vault } = window.app;

  const getSettings = {
    month: getMonthlyNoteSettings,
    quarter: getQuarterlyNoteSettings,
    year: getYearlyNoteSettings,
  };

  const { template, format, folder } = getSettings[granularity]();
  const filename = date.format(format);
  const normalizedPath = await getNotePath(folder, filename);

  // Return existing file if already created
  const existingFile = vault.getAbstractFileByPath(normalizedPath);
  if (existingFile && existingFile instanceof TFile) return existingFile;

  const [templateContents, IFoldInfo] = await getTemplateInfo(template);

  try {
    const contents = replaceTemplateTokens(templateContents, date, { format });
    const createdFile = await vault.create(normalizedPath, contents);
    if (IFoldInfo) (window.app as any).foldManager.save(createdFile, IFoldInfo);
    return createdFile;
  } catch (err) {
    console.error(`Failed to create file: '${normalizedPath}'`, err);
    return undefined;
  }
}

// ── Monthly ──────────────────────────────────────────────────────

export async function createMonthlyNote(date: any): Promise<TFile | undefined> {
  return createPeriodicNote(date, "month");
}

export function getMonthlyNote(
  date: any,
  monthlyNotes: Record<string, TFile>,
): TFile | null {
  return monthlyNotes[getDateUID(date, "month")] ?? null;
}

export function getAllMonthlyNotes(): Record<string, TFile> {
  const monthlyNotes: Record<string, TFile> = {};
  try {
    const { vault } = window.app;
    const { folder } = getMonthlyNoteSettings();
    const folderPath = folder;
    if (!folderPath) return monthlyNotes;
    const monthlyNotesFolder = vault.getAbstractFileByPath(folderPath);
    if (!monthlyNotesFolder) return monthlyNotes;
    Vault.recurseChildren(monthlyNotesFolder, (note: TFile) => {
      if (note instanceof TFile) {
        const date = getDateFromFile(note, "month");
        if (date) {
          monthlyNotes[getDateUID(date, "month")] = note;
        }
      }
    });
  } catch (err) {
    console.log("[New Calendar Suite] Failed to find monthly notes folder", err);
  }
  return monthlyNotes;
}

// ── Quarterly ────────────────────────────────────────────────────

export async function createQuarterlyNote(date: any): Promise<TFile | undefined> {
  return createPeriodicNote(date, "quarter");
}

export function getQuarterlyNote(
  date: any,
  quarterlyNotes: Record<string, TFile>,
): TFile | null {
  return quarterlyNotes[getDateUID(date, "quarter")] ?? null;
}

export function getAllQuarterlyNotes(): Record<string, TFile> {
  const quarterly: Record<string, TFile> = {};
  try {
    const { vault } = window.app;
    const { folder } = getQuarterlyNoteSettings();
    if (!folder) return quarterly;
    const folderObj = vault.getAbstractFileByPath(folder);
    if (!folderObj) return quarterly;
    Vault.recurseChildren(folderObj, (note: TFile) => {
      if (note instanceof TFile) {
        const date = getDateFromFile(note, "quarter");
        if (date) {
          quarterly[getDateUID(date, "quarter")] = note;
        }
      }
    });
  } catch (err) {
    console.log("[New Calendar Suite] Failed to find quarterly notes folder", err);
  }
  return quarterly;
}

// ── Yearly ───────────────────────────────────────────────────────

export async function createYearlyNote(date: any): Promise<TFile | undefined> {
  return createPeriodicNote(date, "year");
}

export function getYearlyNote(
  date: any,
  yearlyNotes: Record<string, TFile>,
): TFile | null {
  return yearlyNotes[getDateUID(date, "year")] ?? null;
}

export function getAllYearlyNotes(): Record<string, TFile> {
  const yearly: Record<string, TFile> = {};
  try {
    const { vault } = window.app;
    const { folder } = getYearlyNoteSettings();
    if (!folder) return yearly;
    const folderObj = vault.getAbstractFileByPath(folder);
    if (!folderObj) return yearly;
    Vault.recurseChildren(folderObj, (note: TFile) => {
      if (note instanceof TFile) {
        const date = getDateFromFile(note, "year");
        if (date) {
          yearly[getDateUID(date, "year")] = note;
        }
      }
    });
  } catch (err) {
    console.log("[New Calendar Suite] Failed to find yearly notes folder", err);
  }
  return yearly;
}
