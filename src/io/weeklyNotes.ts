import type { Moment } from "moment";
import { TFile } from "obsidian";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";
import { NC } from "../utils/nc-engine";
import {
  getWeeklyNoteSettings,
  getNotePath,
  getTemplateInfo,
  replaceTemplateTokens,
} from "./utils";

/**
 * Create a Weekly Note for a given date.
 * Checks filesystem first — if the file already exists on disk (e.g. store
 * hasn't reindexed yet), opens it directly without showing the "Create?" dialog.
 */
export async function tryToCreateWeeklyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (file: TFile) => void
): Promise<void> {
  const { workspace, vault } = window.app;
  const { format, folder, template } = getWeeklyNoteSettings();
  const filename = date.format(format);
  const normalizedPath = await getNotePath(folder, filename);

  // ── Check filesystem first — file may exist even if store isn't indexed ──
  const existingFile = vault.getAbstractFileByPath(normalizedPath);
  if (existingFile) {
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    await leaf.openFile(existingFile as TFile, { active: true });
    cb?.(existingFile as TFile);
    return;
  }

  // ── File truly doesn't exist — create it ──
  const createFile = async () => {
    try {
      const [templateContents, IFoldInfo] = await getTemplateInfo(template);
      const contents = replaceTemplateTokens(templateContents, date, {
        format,
        nc: true,
        ncInfo: NC.getNCDate(date),
      });
      const createdFile = await vault.create(normalizedPath, contents);
      if (IFoldInfo) {
        (window.app as any).foldManager.save(createdFile, IFoldInfo);
      }
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();
      await leaf.openFile(createdFile, { active: true });
      cb?.(createdFile);
    } catch (err) {
      console.error(`Failed to create weekly note: '${normalizedPath}'`, err);
      // Last-resort fallback: re-check filesystem in case of race
      const file = vault.getAbstractFileByPath(normalizedPath);
      if (file) {
        const leaf = inNewSplit
          ? workspace.splitActiveLeaf()
          : workspace.getUnpinnedLeaf();
        await leaf.openFile(file as TFile, { active: true });
        cb?.(file as TFile);
      }
    }
  };

  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: "Create",
      onAccept: createFile,
      text: `File ${filename} does not exist. Would you like to create it?`,
      title: "New Weekly Note",
    });
  } else {
    await createFile();
  }
}

/**
 * Headless weekly note creator — no confirmation dialog, no leaf opening.
 * Used by breadcrumbs auto-creation where files must be created silently.
 */
export async function createWeeklyNoteFile(date: Moment): Promise<TFile | undefined> {
  const { vault } = window.app;
  const { format, folder, template } = getWeeklyNoteSettings();
  const filename = date.format(format);
  const path = folder ? `${folder}/${filename}.md` : `${filename}.md`;

  try {
    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
    const contents = replaceTemplateTokens(templateContents, date, {
      format,
      nc: true,
      ncInfo: NC.getNCDate(date),
    });
    const file = await vault.create(path, contents);
    if (IFoldInfo) (window.app as any).foldManager.save(file, IFoldInfo);
    return file;
  } catch (err) {
    // File already exists — vault.create rejects, just look it up
    const existing = vault.getAbstractFileByPath(path) as TFile;
    if (existing) return existing;
    console.error(`Failed to create weekly note: '${path}'`, err);
    return undefined;
  }
}
