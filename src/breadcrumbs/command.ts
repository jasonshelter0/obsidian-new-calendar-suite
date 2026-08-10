import type { TFile } from "obsidian";
import { Notice, normalizePath } from "obsidian";
import { get } from "svelte/store";
import { detectNoteType, resolveNoteMoment, computeUp, computeDown, computePrev, computeNext, toLink } from "./hierarchy";
import { readFieldStatus, normalizeValue, buildNewContent } from "./writer";
import { getBreadcrumbsSettings, getFrontmatterFromCache, getDateUID, getDailyNoteSettings, getWeeklyNoteSettings } from "../io/utils";
import { createMonthlyNote, createQuarterlyNote, createYearlyNote } from "../io/gcNotes";
import { createNCNote } from "../io/ncNotes";
import { createDailyNoteFile } from "../io/dailyNotes";
import { createWeeklyNoteFile } from "../io/weeklyNotes";
import { dailyNotes, weeklyNotes } from "../ui/stores";
import type { BcNoteType, ResolvedTarget, InsertResult } from "./types";

/**
 * Try to find an existing note: store → filesystem check → create.
 * Returns the file, or null with a console warning on failure.
 */
async function findOrCreate(target: ResolvedTarget, type: BcNoteType): Promise<TFile | null> {
  const { vault } = (window as any).app;

  // 1. Store lookup for daily/weekly notes
  if (type === "daily") {
    const uid = getDateUID(target.moment, "day");
    const existing = get(dailyNotes)[uid];
    if (existing) return existing;
  } else if (type === "weekly") {
    const uid = getDateUID(target.moment, "week");
    const existing = get(weeklyNotes)[uid];
    if (existing) return existing;
  }

  // 2. Filesystem check for daily/weekly (store may be stale)
  if (type === "daily" || type === "weekly") {
    const { format, folder } = type === "daily" ? getDailyNoteSettings() : getWeeklyNoteSettings();
    const filename = target.moment.format(format) + ".md";
    const path = normalizePath(folder ? `${folder}/${filename}` : filename);
    const diskFile = vault.getAbstractFileByPath(path);
    if (diskFile) return diskFile as TFile;
  }

  // 3. Create (all creators check existence internally and short-circuit)
  try {
    let file: TFile | undefined;
    switch (type) {
      case "daily": file = await createDailyNoteFile(target.moment); break;
      case "weekly": file = await createWeeklyNoteFile(target.moment); break;
      case "monthly": file = await createMonthlyNote(target.moment); break;
      case "quarterly": file = await createQuarterlyNote(target.moment); break;
      case "yearly": file = await createYearlyNote(target.moment); break;
      case "nc-phase": file = await createNCNote(target.moment, "nc-phase"); break;
      case "nc-month": file = await createNCNote(target.moment, "nc-month"); break;
      case "nc-season": file = await createNCNote(target.moment, "nc-season"); break;
      case "nc-year": file = await createNCNote(target.moment, "nc-year"); break;
    }
    if (!file) {
      console.warn(`[Breadcrumbs] Could not create ${type} note for ${target.moment.format("YYYY-MM-DD")}`);
    }
    return file || null;
  } catch (err) {
    console.error(`[Breadcrumbs] Failed to create ${type} note:`, err);
    new Notice(`Breadcrumbs: failed to create ${type} note — ${err.message || err}`);
    return null;
  }
}

// ── Orchestrator ───────────────────────────────────────────────────

export async function insertBreadcrumbsRelationships(file: TFile): Promise<InsertResult> {
  const result: InsertResult = { inserted: 0, created: 0, skipped: 0, conflicts: 0 };

  // 1. Detect note type
  const fm = getFrontmatterFromCache(file);
  const type = detectNoteType(file, fm);
  if (!type) {
    new Notice("Not a calendar note — cannot insert Breadcrumbs relationships.");
    return result;
  }

  // 2. Resolve period-anchor moment
  const moment = resolveNoteMoment(file, type, fm);
  if (!moment) {
    new Notice("Could not determine the date of this calendar note.");
    return result;
  }

  // 3. Read settings
  const bc = getBreadcrumbsSettings();
  if (!bc.enabled) return result;

  // 4. Compute all four directions
  const upTargets = computeUp(type, moment, bc.dualUpWeekly);
  const downTargets = computeDown(type, moment);
  const prevTarget = computePrev(type, moment);
  const nextTarget = computeNext(type, moment);

  // 5. Find or create target files, tracking failures
  const created: TFile[] = [];
  let failed = 0;

  const ensureTargets = async (targets: ResolvedTarget[]): Promise<TFile[]> => {
    const files: TFile[] = [];
    for (const t of targets) {
      const f = await findOrCreate(t, t.type);
      if (f) {
        t.file = f;
        if (!created.includes(f)) created.push(f);
        files.push(f);
      } else {
        failed++;
      }
    }
    return files;
  };

  const upFiles = await ensureTargets(upTargets);
  const downFiles = await ensureTargets(downTargets);
  const prevFiles = prevTarget ? await ensureTargets([prevTarget]) : [];
  const nextFiles = nextTarget ? await ensureTargets([nextTarget]) : [];

  result.created = created.length;
  if (failed > 0) {
    console.warn(`[Breadcrumbs] ${failed} target(s) could not be found or created`);
  }

  // 6. Build insert plan items
  const items: InsertPlanItem[] = [];

  const addItem = (key: string, files: TFile[], targets: ResolvedTarget[]) => {
    if (files.length === 0) return;
    const values = files.map((f) => toLink(f, file, bc.linkStyle));
    items.push({
      key,
      values,
      targets: targets.filter((t) => t.file),
      status: "insert",
      existing: null,
    });
  };

  addItem(bc.fieldUp, upFiles, upTargets);
  addItem(bc.fieldDown, downFiles, downTargets);
  if (prevFiles.length > 0) addItem(bc.fieldPrev, prevFiles, prevTarget ? [prevTarget] : []);
  if (nextFiles.length > 0) addItem(bc.fieldNext, nextFiles, nextTarget ? [nextTarget] : []);

  if (items.length === 0) {
    new Notice("No Breadcrumbs relationships to insert.");
    return result;
  }

  // 7. Read current note content and check for conflicts
  const { vault } = (window as any).app;
  const currentContent = await vault.read(file);

  for (const item of items) {
    const status = readFieldStatus(currentContent, item.key, bc.outputMode);
    if (status.exists) {
      const existingNorm = normalizeValue(status.value || "");
      const newNorm = normalizeValue(item.values.join(", "));
      if (existingNorm === newNorm) {
        item.status = "exists-same";
        result.skipped++;
      } else {
        item.status = "exists-different";
        result.conflicts++;
      }
    }
  }

  const toInsert = items.filter((i) => i.status === "insert");
  const conflicts = items.filter((i) => i.status === "exists-different");

  if (conflicts.length > 0) {
    const conflictKeys = conflicts.map((c) => c.key).join(", ");
    new Notice(`Breadcrumbs: skipped ${conflicts.length} conflicting field(s) (${conflictKeys}) — already set`);
  }

  if (toInsert.length === 0) {
    const msg = result.created > 0
      ? `Breadcrumbs: ${result.created} file(s) created, but all fields already exist`
      : "Breadcrumbs relationships already up to date.";
    new Notice(msg);
    return result;
  }

  // 8. Insert fields via vault.process
  try {
    await vault.process(file, (current: string) => buildNewContent(current, toInsert, {
      mode: bc.outputMode,
      dataviewTemplate: bc.dataviewTemplate,
      dataviewPosition: bc.dataviewPosition,
      dataviewMarker: bc.dataviewMarker,
    }));
    result.inserted = toInsert.length;
  } catch (err) {
    console.error("[Breadcrumbs] Failed to insert fields:", err);
    new Notice(`Breadcrumbs: failed to insert — ${err.message || err}`);
    return result;
  }

  // 9. Summary notice
  const parts: string[] = [];
  if (result.inserted > 0) parts.push(`${result.inserted} field(s) inserted`);
  if (result.created > 0) parts.push(`${result.created} file(s) created`);
  if (result.skipped > 0) parts.push(`${result.skipped} field(s) already set`);
  if (failed > 0) parts.push(`${failed} target(s) failed`);
  new Notice(`Breadcrumbs: ${parts.join(", ")}`);

  return result;
}
