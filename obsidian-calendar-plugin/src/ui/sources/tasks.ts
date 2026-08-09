import type { Moment } from "moment";
import type { TFile } from "obsidian";
import type { ICalendarSource, IDayMetadata, IDot } from "obsidian-calendar-ui";
import { getDailyNote, getWeeklyNote } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import { dailyNotes, weeklyNotes } from "../stores";

export async function getTaskCounts(note: TFile): Promise<{ remaining: number; completed: number }> {
  if (!note) {
    return { remaining: 0, completed: 0 };
  }

  const { vault } = window.app;
  const fileContents = await vault.cachedRead(note);
  const remaining = (fileContents.match(/(-|\*) \[ \]/g) || []).length;
  const completed = (fileContents.match(/(-|\*) \[x\]/g) || []).length;
  return { remaining, completed };
}

export async function getDotsForDailyNote(
  dailyNote: TFile | null
): Promise<IDot[]> {
  if (!dailyNote) {
    return [];
  }
  const { remaining, completed } = await getTaskCounts(dailyNote);

  const dots = [];
  if (remaining > 0) {
    if (completed === 0) {
      // 有待办且全未完成：红色实心
      dots.push({
        className: "task-todo-urgent",
        color: "#F44336",
        isFilled: true,
      });
    } else {
      // 橙色不变 (有待办但也有已完成的)：橙色实心
      dots.push({
        className: "task-todo",
        color: "#FF9800",
        isFilled: true,
      });
    }
  } else if (completed > 0) {
    // 所有任务都完成了：绿色实心
    dots.push({
      className: "task-done",
      color: "#4CAF50",
      isFilled: true,
    });
  }
  return dots;
}

export const tasksSource: ICalendarSource = {
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
