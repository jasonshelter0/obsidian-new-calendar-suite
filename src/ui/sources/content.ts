import type { Moment } from "moment";
import type { TFile } from "obsidian";
import type { ICalendarSource, IDayMetadata, IDot } from "obsidian-calendar-ui";
import { getDailyNote, getWeeklyNote } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import { DEFAULT_WORDS_PER_DOT } from "src/constants";

import { dailyNotes, settings, weeklyNotes } from "../stores";
import { clamp, getWordCount } from "../utils";

const NUM_MAX_DOTS = 5;

/**
 * Merged source: reads each daily/weekly note once and returns both
 * task-completion dots and word-count dots together.
 */
async function getDotsForNote(note: TFile | null): Promise<IDot[]> {
  if (!note) return [];

  const { wordsPerDot = DEFAULT_WORDS_PER_DOT, wordCountOffset = 0 } = get(settings);
  const fileContents = await window.app.vault.cachedRead(note);

  const dots: IDot[] = [];

  // ── Task dots ──────────────────────────────────────────────
  const remaining = (fileContents.match(/(-|\*) \[ \]/g) || []).length;
  const completed = (fileContents.match(/(-|\*) \[x\]/gi) || []).length;

  if (remaining > 0) {
    dots.push({
      className: completed === 0 ? "task-todo-urgent" : "task-todo",
      color: completed === 0 ? "#F44336" : "#FF9800",
      isFilled: true,
    });
  } else if (completed > 0) {
    dots.push({
      className: "task-done",
      color: "#4CAF50",
      isFilled: true,
    });
  }

  // ── Word-count dots ────────────────────────────────────────
  const totalWordCount = getWordCount(fileContents);
  const effectiveWordCount = totalWordCount - wordCountOffset;

  if (effectiveWordCount > 0) {
    const rawDotCount = effectiveWordCount / wordsPerDot;
    if (rawDotCount > NUM_MAX_DOTS) {
      dots.push({ color: "default", isFilled: true, className: "overflow-dot" });
    } else {
      const numSolidDots = clamp(Math.floor(rawDotCount), 1, NUM_MAX_DOTS);
      for (let i = 0; i < numSolidDots; i++) {
        dots.push({ color: "default", isFilled: true });
      }
    }
  } else if (totalWordCount > 0) {
    dots.push({
      color: "var(--text-normal)",
      isFilled: false,
      className: "template-only-dot",
    });
  }

  return dots;
}

export const contentSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getDailyNote(date, get(dailyNotes));
    const dots = await getDotsForNote(file);
    return { dots };
  },

  getWeeklyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getWeeklyNote(date, get(weeklyNotes));
    const dots = await getDotsForNote(file);
    return { dots };
  },
};
