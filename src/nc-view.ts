import type { Moment } from "moment";
import { FileView, TFile, ItemView, WorkspaceLeaf, Notice, normalizePath } from "obsidian";
import { get } from "svelte/store";

import { TRIGGER_ON_OPEN, VIEW_TYPE_NC_CALENDAR } from "src/constants";
import { tryToCreateDailyNote } from "src/io/dailyNotes";
import { tryToCreateWeeklyNote } from "src/io/weeklyNotes";
import { NC } from "./utils/nc-engine";
import { getNCYearStart } from "./utils/nc-dates";
import { createNCNote } from "./io/ncNotes";
import {
  getDailyNoteSettings,
  getWeeklyNoteSettings,
  getDateFromFile,
  getDateUID,
} from "./io/utils";

import CalendarGrid from "./ui/CalendarGrid.svelte";
import { showFileMenu } from "./ui/fileMenu";
import { activeFile, dailyNotes, weeklyNotes, settings } from "./ui/stores";
import {
  contentSource,
  customTagsSource,
  streakSource,
} from "./ui/sources";
import { configureGlobalMomentLocale } from "obsidian-calendar-ui";

function getDailyNote(date: Moment, all: Record<string, TFile>): TFile | null {
  return all[getDateUID(date, "day")] ?? null;
}
function getWeeklyNote(date: Moment, all: Record<string, TFile>): TFile | null {
  return all[getDateUID(date, "week")] ?? null;
}

export default class NCView extends ItemView {
  private calendar: CalendarGrid;
  private displayedMonth: Moment;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.displayedMonth = window.moment();

    this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
    this.openOrCreateWeeklyNote = this.openOrCreateWeeklyNote.bind(this);

    this.onFileCreated = this.onFileCreated.bind(this);
    this.onFileDeleted = this.onFileDeleted.bind(this);
    this.onFileModified = this.onFileModified.bind(this);
    this.onFileOpen = this.onFileOpen.bind(this);

    this.onHoverDay = this.onHoverDay.bind(this);
    this.onHoverWeek = this.onHoverWeek.bind(this);

    this.onContextMenuDay = this.onContextMenuDay.bind(this);
    this.onContextMenuWeek = this.onContextMenuWeek.bind(this);

    this.registerEvent(this.app.vault.on("create", this.onFileCreated));
    this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
    this.registerEvent(this.app.vault.on("modify", this.onFileModified));
    this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));

    settings.subscribe((val) => {
      configureGlobalMomentLocale(val.localeOverride, val.weekStart);
      if (this.calendar) {
        this.calendar.$set({ 
          today: window.moment(),
          showWeekNums: val.showWeeklyNote
        });
      }
    });
  }

  getViewType(): string {
    return VIEW_TYPE_NC_CALENDAR;
  }

  getDisplayText(): string {
    return "NC Calendar";
  }

  getIcon(): string {
    return "calendar-with-checkmark";
  }

  onClose(): Promise<void> {
    if (this.calendar) {
      this.calendar.$destroy();
    }
    return Promise.resolve();
  }

  async onOpen(): Promise<void> {
    // Index notes
    dailyNotes.reindex();
    weeklyNotes.reindex();

    const sources = [
      contentSource,
      customTagsSource,
      streakSource,
    ];
    this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);

    this.calendar = new CalendarGrid({
      target: this.contentEl,
      props: {
        app: this.app,
        mode: "NC",
        displayedMonth: this.displayedMonth,
        today: window.moment(),
        onClickDay: this.openOrCreateDailyNote,
        onClickWeek: this.openOrCreateWeeklyNote,
        onHoverDay: this.onHoverDay,
        onHoverWeek: this.onHoverWeek,
        onContextMenuDay: this.onContextMenuDay,
        onContextMenuWeek: this.onContextMenuWeek,
        onClickNCMonth: this.openOrCreateNCMonthNote.bind(this),
        onClickNCPhase: this.openOrCreateNCPhaseNote.bind(this),
        onClickNCSeason: this.openOrCreateNCSeasonNote.bind(this),
        onClickNCYear: this.openOrCreateNCYearNote.bind(this),
        sources,
        showWeekNums: get(settings).showWeeklyNote,
      },
    });

    this.calendar.$on("displayedMonthChange", (event: CustomEvent) => {
      this.displayedMonth = event.detail;
    });

    this.updateActiveFile();

    this.register(
      activeFile.subscribe((val) => {
        if (this.calendar) {
          this.calendar.$set({ selectedId: val });
        }
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", () => {
        this.tick();
      })
    );
  }

  public tick() {
    if (this.calendar) {
      const current = (this.calendar as any).metadataUpdateTrigger || 0;
      this.calendar.$set({ 
        metadataUpdateTrigger: current + 1,
        today: window.moment() 
      });
    }
  }

  private async onFileModified(file: TFile): Promise<void> {
    const date = getDateFromFile(file, "day") || getDateFromFile(file, "week");
    if (date && this.calendar) {
      this.tick();
    }
  }

  private onFileCreated(file: TFile): void {
    if (this.app.workspace.layoutReady && this.calendar) {
      if (getDateFromFile(file, "day")) {
        dailyNotes.reindex();
        this.tick();
      }
      if (getDateFromFile(file, "week")) {
        weeklyNotes.reindex();
        this.tick();
      }
    }
  }

  private onFileDeleted(file: TFile): void {
    if (this.app.workspace.layoutReady && this.calendar) {
      if (getDateFromFile(file, "day")) {
        dailyNotes.reindex();
        this.tick();
      }
      if (getDateFromFile(file, "week")) {
        weeklyNotes.reindex();
        this.tick();
      }
    }
  }

  public onFileOpen(_file: TFile): void {
    if (this.app.workspace.layoutReady) {
      this.updateActiveFile();
    }
  }

  private updateActiveFile(): void {
    const { view } = this.app.workspace.activeLeaf;

    let file = null;
    if (view instanceof FileView) {
      file = view.file;
    }
    activeFile.setFile(file);

    this.tick();
  }

  onHoverDay(
    date: Moment,
    targetEl: EventTarget
  ): void {
    // hover logic from original view.ts
    const { format } = getDailyNoteSettings();
    const note = getDailyNote(date, get(dailyNotes));
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      date.format(format),
      note?.path
    );
  }

  onHoverWeek(
    date: Moment,
    targetEl: EventTarget
  ): void {
    const note = getWeeklyNote(date, get(weeklyNotes));
    const { format } = getWeeklyNoteSettings();
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      date.format(format),
      note?.path
    );
  }

  private onContextMenuDay(date: Moment, event: MouseEvent): void {
    const note = getDailyNote(date, get(dailyNotes));
    if (!note) return;
    showFileMenu(this.app, note, {
      x: event.pageX,
      y: event.pageY,
    });
  }

  private onContextMenuWeek(date: Moment, event: MouseEvent): void {
    const note = getWeeklyNote(date, get(weeklyNotes));
    if (!note) return;
    showFileMenu(this.app, note, {
      x: event.pageX,
      y: event.pageY,
    });
  }

  public revealActiveNote(): void {
    const { moment } = window;
    const { activeLeaf } = this.app.workspace;

    if (activeLeaf.view instanceof FileView) {
      let date = getDateFromFile(activeLeaf.view.file, "day");
      if (date) {
        this.calendar.$set({ displayedMonth: date });
        return;
      }

      const { format } = getWeeklyNoteSettings();
      date = moment(activeLeaf.view.file.basename, format, true);
      if (date.isValid()) {
        this.calendar.$set({ displayedMonth: date });
        return;
      }
    }
  }

  async openOrCreateWeeklyNote(
    date: Moment,
    inNewSplit: boolean
  ): Promise<void> {
    const { workspace } = this.app;
    const startOfWeek = date.clone().startOf("week");
    const existingFile = getWeeklyNote(date, get(weeklyNotes));

    if (existingFile) {
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();
      await leaf.openFile(existingFile);
      activeFile.setFile(existingFile);
      workspace.setActiveLeaf(leaf, true, true);
      return;
    }

    // Store miss — check filesystem directly before showing "Create?" dialog
    const { format, folder } = getWeeklyNoteSettings();
    const filename = startOfWeek.format(format);
    const diskPath = normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);
    const diskFile = this.app.vault.getAbstractFileByPath(diskPath);
    if (diskFile instanceof TFile) {
      weeklyNotes.reindex();
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();
      await leaf.openFile(diskFile);
      activeFile.setFile(diskFile);
      workspace.setActiveLeaf(leaf, true, true);
      return;
    }

    tryToCreateWeeklyNote(startOfWeek, inNewSplit, get(settings), (file) => {
      activeFile.setFile(file);
    });
  }

  async openOrCreateDailyNote(
    date: Moment,
    inNewSplit: boolean
  ): Promise<void> {
    const { workspace } = this.app;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mode = (this.app.vault as any).getConfig("defaultViewMode");

    const existingFile = getDailyNote(date, get(dailyNotes));
    if (existingFile) {
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();
      await leaf.openFile(existingFile, { active: true, mode });
      activeFile.setFile(existingFile);
      return;
    }

    // Store miss — check filesystem directly before showing "Create?" dialog
    const { format, folder } = getDailyNoteSettings();
    const filename = date.format(format);
    const diskPath = normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);
    const diskFile = this.app.vault.getAbstractFileByPath(diskPath);
    if (diskFile instanceof TFile) {
      dailyNotes.reindex();
      const leaf = inNewSplit
        ? workspace.splitActiveLeaf()
        : workspace.getUnpinnedLeaf();
      await leaf.openFile(diskFile, { active: true, mode });
      activeFile.setFile(diskFile);
      return;
    }

    tryToCreateDailyNote(
      date,
      inNewSplit,
      get(settings),
      (dailyNote: TFile) => {
        activeFile.setFile(dailyNote);
      }
    );
  }

  async openOrCreateNCYearNote(ny: number): Promise<void> {
    try {
      const yearStart = getNCYearStart(ny);
      const note = await createNCNote(yearStart, "nc-year");
      if (note) {
        const leaf = this.app.workspace.getUnpinnedLeaf();
        await leaf.openFile(note, { active: true });
        activeFile.setFile(note);
      }
    } catch (e) {
      console.error("[New Calendar Suite] Error opening NC year note:", e);
      new Notice(`Error: ${e.message || e}`);
    }
  }

  async openOrCreateNCSeasonNote(ny: number, season: number): Promise<void> {
    try {
      const [startNm] = NC.getSeasonMonths(ny, season);
      const start = NC.getNCMonthStart(ny, startNm);
      const note = await createNCNote(start, "nc-season");
      if (note) {
        const leaf = this.app.workspace.getUnpinnedLeaf();
        await leaf.openFile(note, { active: true });
        activeFile.setFile(note);
      }
    } catch (e) {
      console.error("[New Calendar Suite] Error opening NC season note:", e);
      new Notice(`Error: ${e.message || e}`);
    }
  }

  async openOrCreateNCMonthNote(ny: number, nm: number): Promise<void> {
    try {
      const monthStart = NC.getNCMonthStart(ny, nm);
      const note = await createNCNote(monthStart, "nc-month");
      if (note) {
        const leaf = this.app.workspace.getUnpinnedLeaf();
        await leaf.openFile(note, { active: true });
        activeFile.setFile(note);
      }
    } catch (e) {
      console.error("[New Calendar Suite] Error opening NC month note:", e);
      new Notice(`Error: ${e.message || e}`);
    }
  }

  async openOrCreateNCPhaseNote(ny: number, nm: number, phase: number): Promise<void> {
    try {
      const [start] = NC.getPhaseRange(ny, nm, phase);
      const note = await createNCNote(start, "nc-phase");
      if (note) {
        const leaf = this.app.workspace.getUnpinnedLeaf();
        await leaf.openFile(note, { active: true });
        activeFile.setFile(note);
      }
    } catch (e) {
      console.error("[New Calendar Suite] Error opening NC phase note:", e);
      new Notice(`Error: ${e.message || e}`);
    }
  }
}
