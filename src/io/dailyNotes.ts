import type { Moment } from "moment";
import type { TFile } from "obsidian";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";
import { NC } from "../utils/nc-engine";
import {
  getDailyNoteSettings,
  getNotePath,
  getTemplateInfo,
  replaceTemplateTokens,
} from "./utils";

/**
 * Create a Daily Note for a given date.
 * Checks filesystem first — if the file already exists on disk (e.g. store
 * hasn't reindexed yet), opens it directly without showing the "Create?" dialog.
 */
export async function tryToCreateDailyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (newFile: TFile) => void
): Promise<void> {
  const { workspace, vault } = window.app;
  const { format, folder, template } = getDailyNoteSettings();
  const filename = date.format(format);
  const normalizedPath = await getNotePath(folder, filename);

  // ── Check filesystem first — file may exist even if store isn't indexed ──
  const existingFile = vault.getAbstractFileByPath(normalizedPath);
  if (existingFile && existingFile instanceof TFile) {
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    await leaf.openFile(existingFile, { active: true });
    cb?.(existingFile);
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
      console.error(`Failed to create daily note: '${normalizedPath}'`, err);
      // Last-resort fallback: re-check filesystem in case of race
      const file = vault.getAbstractFileByPath(normalizedPath);
      if (file instanceof TFile) {
        const leaf = inNewSplit
          ? workspace.splitActiveLeaf()
          : workspace.getUnpinnedLeaf();
        await leaf.openFile(file, { active: true });
        cb?.(file);
      }
    }
  };

  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: "Create",
      onAccept: createFile,
      text: `File ${filename} does not exist. Would you like to create it?`,
      title: "New Daily Note",
    });
  } else {
    await createFile();
  }
}
