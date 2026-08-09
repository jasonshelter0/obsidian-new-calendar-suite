import type { Moment } from "moment";
import type { TFile } from "obsidian";
import type { ICalendarSource, IDayMetadata, IDot } from "obsidian-calendar-ui";
import { getDailyNote, getWeeklyNote } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import { DEFAULT_WORDS_PER_DOT } from "src/constants";

import { dailyNotes, settings, weeklyNotes } from "../stores";
import { clamp, getWordCount } from "../utils";

const NUM_MAX_DOTS = 5;

export async function getWordLengthAsDots(note: TFile): Promise<number> {
  const { wordsPerDot = DEFAULT_WORDS_PER_DOT, wordCountOffset = 0 } = get(settings);
  if (!note || wordsPerDot <= 0) {
    return 0;
  }
  const fileContents = await window.app.vault.cachedRead(note);

  const wordCount = Math.max(0, getWordCount(fileContents) - wordCountOffset);
  const numDots = wordCount / wordsPerDot;
  return wordCount > 0 ? clamp(Math.floor(numDots), 1, NUM_MAX_DOTS) : 0;
}

export async function getDotsForDailyNote(
  dailyNote: TFile | null
): Promise<IDot[]> {
  if (!dailyNote) {
    return [];
  }
  const { wordsPerDot = DEFAULT_WORDS_PER_DOT, wordCountOffset = 0 } = get(settings);
  const fileContents = await window.app.vault.cachedRead(dailyNote);
  const totalWordCount = getWordCount(fileContents);
  
  const effectiveWordCount = totalWordCount - wordCountOffset;
  const dots = [];

  if (effectiveWordCount > 0) {
    const rawDotCount = effectiveWordCount / wordsPerDot;
    if (rawDotCount > NUM_MAX_DOTS) {
      // Too many dots — replace with a single overflow indicator
      dots.push({
        color: "default",
        isFilled: true,
        className: "overflow-dot",
      });
    } else {
      const numSolidDots = clamp(Math.floor(rawDotCount), 1, NUM_MAX_DOTS);
      for (let i = 0; i < numSolidDots; i++) {
        dots.push({
          color: "default",
          isFilled: true,
        });
      }
    }
  } else if (totalWordCount > 0) {
    // 未超过偏置项但有内容：显示一个空心黑点 (表示仅有模板)
    dots.push({
      color: "var(--text-normal)",
      isFilled: false,
      className: "template-only-dot"
    });
  }

  return dots;
}

export const wordCountSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getDailyNote(date, get(dailyNotes));
    const dots = await getDotsForDailyNote(file);
    return {
      dots,
    };
  },

  getWeeklyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getWeeklyNote(date, get(weeklyNotes));
    const dots = await getDotsForDailyNote(file);

    return {
      dots,
    };
  },
};
