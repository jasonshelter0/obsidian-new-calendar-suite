import type { TFile } from "obsidian";
import {
  getAllDailyNotes,
  getAllWeeklyNotes,
} from "obsidian-daily-notes-interface";
import { writable } from "svelte/store";

import { defaultSettings, ISettings } from "../settings";
import {
  getDailyNoteSettings,
  getWeeklyNoteSettings,
} from "../io/utils";
import {
  getAllMonthlyNotes,
  getAllQuarterlyNotes,
  getAllYearlyNotes,
} from "../io/gcNotes";
import {
  getAllNCNotes,
} from "../io/ncNotes";
import { getDateUIDFromFile } from "./utils";

// ── Generalized note store factory ─────────────────────────────

function createNotesStore(name: string, getAllFn: () => Record<string, TFile>) {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const notes = getAllFn();
        store.set(notes);
        hasError = false;
      } catch (err) {
        if (!hasError) {
          console.log(`[New Calendar Suite] Failed to find ${name} notes folder`, err);
        }
        store.set({});
        hasError = true;
      }
    },
    ...store,
  };
}

/**
 * Fallback: scan all markdown files in the vault, filtering by the given
 * format string. Used when the daily/weekly notes folder is not configured.
 */
function scanVaultForNotes(format: string, granularity: "day" | "week"): Record<string, TFile> {
  const notes: Record<string, TFile> = {};
  const files = window.app.vault.getMarkdownFiles();
  for (const file of files) {
    const date = window.moment(file.basename, format, true);
    if (date.isValid()) {
      const key = `${granularity}-${date.clone().startOf(granularity).format()}`;
      notes[key] = file;
    }
  }
  return notes;
}

function createDailyNotesStore() {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const notes = getAllDailyNotes();
        store.set(notes);
        hasError = false;
      } catch (err) {
        // Folder not configured — fall back to scanning entire vault
        try {
          const { format } = getDailyNoteSettings();
          const notes = scanVaultForNotes(format, "day");
          store.set(notes);
          hasError = false;
        } catch (e) {
          if (!hasError) console.log("[New Calendar Suite] Failed to find daily notes", e);
          store.set({});
          hasError = true;
        }
      }
    },
    ...store,
  };
}

function createWeeklyNotesStore() {
  let hasError = false;
  const store = writable<Record<string, TFile>>(null);
  return {
    reindex: () => {
      try {
        const notes = getAllWeeklyNotes();
        store.set(notes);
        hasError = false;
      } catch (err) {
        // Folder not configured — fall back to scanning entire vault
        try {
          const { format } = getWeeklyNoteSettings();
          const notes = scanVaultForNotes(format, "week");
          store.set(notes);
          hasError = false;
        } catch (e) {
          if (!hasError) console.log("[New Calendar Suite] Failed to find weekly notes", e);
          store.set({});
          hasError = true;
        }
      }
    },
    ...store,
  };
}

export const settings = writable<ISettings>(defaultSettings);
export const dailyNotes = createDailyNotesStore();
export const weeklyNotes = createWeeklyNotesStore();

export const monthlyNotes = createNotesStore("monthly", getAllMonthlyNotes);
export const quarterlyNotes = createNotesStore("quarterly", getAllQuarterlyNotes);
export const yearlyNotes = createNotesStore("yearly", getAllYearlyNotes);

export const ncPhaseNotes = createNotesStore("nc-phase", () => getAllNCNotes("nc-phase"));
export const ncMonthNotes = createNotesStore("nc-month", () => getAllNCNotes("nc-month"));
export const ncSeasonNotes = createNotesStore("nc-season", () => getAllNCNotes("nc-season"));
export const ncYearNotes = createNotesStore("nc-year", () => getAllNCNotes("nc-year"));

function createSelectedFileStore() {
  const store = writable<string>(null);
  return {
    setFile: (file: TFile) => {
      const id = getDateUIDFromFile(file);
      store.set(id);
    },
    ...store,
  };
}

export const activeFile = createSelectedFileStore();
export const holidays = writable<Record<string, { type: string; name: string }>>({});
export const holidayMeta = writable<{ source?: string; updated?: string }>({});
