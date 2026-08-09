import type { Moment, WeekSpec } from "moment";
import { App, Plugin, WorkspaceLeaf, TFile } from "obsidian";

import { VIEW_TYPE_CALENDAR, VIEW_TYPE_NC_CALENDAR, SETTINGS_UPDATED } from "./constants";
import { settings, holidays, dailyNotes, weeklyNotes, monthlyNotes, quarterlyNotes, yearlyNotes, ncPhaseNotes, ncMonthNotes, ncSeasonNotes, ncYearNotes } from "./ui/stores";
import {
  CalendarSettingsTab,
  ISettings,
  defaultSettings,
} from "./settings";
import { migrateIfNeeded } from "./migration";
import CalendarView from "./view";
import NCView from "./nc-view";
import { NC } from "./utils/nc-engine";
import { NCNotesAPI } from "./io/ncNotes";
import {
  getDailyNoteSettings,
  getWeeklyNoteSettings,
  getMonthlyNoteSettings,
  getQuarterlyNoteSettings,
  getYearlyNoteSettings,
  getNCPhaseSettings,
  getNCMonthSettings,
  getNCSeasonSettings,
  getNCYearSettings,
} from "./io/utils";
import { createMonthlyNote, createQuarterlyNote, createYearlyNote } from "./io/gcNotes";
import { createNCNote } from "./io/ncNotes";

declare global {
  interface Window {
    app: App;
    moment: () => Moment;
    _bundledLocaleWeekSpec: WeekSpec;
    NCEngine: typeof NC;
    NCNotes: typeof NCNotesAPI;
  }
}

export default class CalendarPlugin extends Plugin {
  public options: ISettings;
  private view: CalendarView;
  private ncView: NCView;
  private ribbonEl: HTMLElement | null = null;

  onunload(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach((leaf) => leaf.detach());
    this.app.workspace.getLeavesOfType(VIEW_TYPE_NC_CALENDAR).forEach((leaf) => leaf.detach());
  }

  async onload(): Promise<void> {
    window.NCEngine = NC;
    window.NCNotes = NCNotesAPI;
    this.options = defaultSettings;

    this.register(
      settings.subscribe((value) => {
        this.options = value;
        this.loadHolidays();
        this.onSettingsUpdate();
      })
    );

    await this.loadOptions();
    await migrateIfNeeded(this);

    this.registerView(VIEW_TYPE_CALENDAR, (leaf: WorkspaceLeaf) => (this.view = new CalendarView(leaf)));
    this.registerView(VIEW_TYPE_NC_CALENDAR, (leaf: WorkspaceLeaf) => (this.ncView = new NCView(leaf)));

    this.addCommand({
      id: "show-gc-calendar-view",
      name: "Open GC view",
      checkCallback: (checking: boolean) => {
        if (checking) return this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0;
        this.initLeaf(VIEW_TYPE_CALENDAR);
      },
    });

    this.addCommand({
      id: "show-nc-calendar-view",
      name: "Open NC view",
      checkCallback: (checking: boolean) => {
        if (checking) return this.app.workspace.getLeavesOfType(VIEW_TYPE_NC_CALENDAR).length === 0;
        this.initLeaf(VIEW_TYPE_NC_CALENDAR);
      },
    });

    this.addCommand({
      id: "reveal-active-note",
      name: "Reveal active note",
      callback: () => { this.view?.revealActiveNote(); if (this.ncView) this.ncView.revealActiveNote(); },
    });

    this.addSettingTab(new CalendarSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.onLayoutReady());
    if (this.app.workspace.layoutReady) this.onLayoutReady();
  }

  onLayoutReady(): void {
    this.configureCommands();
    this.configureRibbonIcons();
    this.initLeaf(VIEW_TYPE_CALENDAR);
  }

  // ── Commands ─────────────────────────────────────────────────

  private isEnabled(key: string): boolean {
    const o = this.options;
    switch (key) {
      case "daily": return o.daily?.enabled ?? true;
      case "weekly": return o.weekly?.enabled ?? false;
      case "monthly": return o.monthly?.enabled ?? false;
      case "quarterly": return o.quarterly?.enabled ?? false;
      case "yearly": return o.yearly?.enabled ?? false;
      case "nc-phase": return o.ncPhase?.enabled ?? false;
      case "nc-month": return o.ncMonth?.enabled ?? true;
      case "nc-season": return o.ncSeason?.enabled ?? false;
      case "nc-year": return o.ncYear?.enabled ?? false;
      default: return false;
    }
  }

  configureCommands(): void {
    const app = this.app;
    const all = ["daily","weekly","monthly","quarterly","yearly","nc-phase","nc-month","nc-season","nc-year"];

    for (const p of all) {
      if (!this.isEnabled(p)) {
        ["open","next","prev"].forEach((a) => (this.app.commands as any).removeCommand(`new-calendar-suite:${a}-${p}-note`));
        continue;
      }

      const openFn = async (date: any, split: boolean) => {
        let note: TFile | undefined;
        if (["monthly","quarterly","yearly"].includes(p)) {
          const creators: Record<string, (d: any) => Promise<TFile | undefined>> = { monthly: createMonthlyNote, quarterly: createQuarterlyNote, yearly: createYearlyNote };
          note = await creators[p](date.clone().startOf(p === "yearly" ? "year" : p === "quarterly" ? "quarter" : "month"));
        } else if (p.startsWith("nc-")) {
          note = await createNCNote(date, p as any);
        } else if (p === "daily") {
          this.view?.openOrCreateDailyNote(date, split);
          return;
        } else if (p === "weekly") {
          this.view?.openOrCreateWeeklyNote(date, split);
          return;
        }
        if (note) {
          const leaf = split ? app.workspace.splitActiveLeaf() : app.workspace.getUnpinnedLeaf();
          await leaf.openFile(note, { active: true });
        }
      };

      this.addCommand({ id: `open-${p}-note`, name: `Open ${p} note`, callback: () => openFn(window.moment(), false) });
    }
  }

  // ── Ribbon ───────────────────────────────────────────────────

  configureRibbonIcons(): void {
    if (this.ribbonEl) { this.ribbonEl.detach(); this.ribbonEl = null; }
    const first = ["daily","weekly","monthly","quarterly","yearly","nc-phase","nc-month","nc-season","nc-year"].find((p) => this.isEnabled(p));
    if (!first) return;
    this.ribbonEl = (this as any).addRibbonIcon("calendar-with-checkmark", `Open ${first} note`, (ev: MouseEvent) => {
      const app = this.app;
      (async () => {
        let note: TFile | undefined;
        if (["monthly","quarterly","yearly"].includes(first)) {
          const creators: Record<string, (d: any) => Promise<TFile | undefined>> = { monthly: createMonthlyNote, quarterly: createQuarterlyNote, yearly: createYearlyNote };
          note = await creators[first](window.moment().clone().startOf(first === "yearly" ? "year" : first === "quarterly" ? "quarter" : "month"));
        } else if (first.startsWith("nc-")) {
          note = await createNCNote(window.moment(), first as any);
        }
        if (note) {
          const leaf = app.workspace.getUnpinnedLeaf();
          await leaf.openFile(note, { active: true });
        }
      })();
    });
  }

  onSettingsUpdate(): void {
    this.configureCommands();
    this.configureRibbonIcons();
    dailyNotes.reindex(); weeklyNotes.reindex();
    monthlyNotes.reindex(); quarterlyNotes.reindex(); yearlyNotes.reindex();
    ncPhaseNotes.reindex(); ncMonthNotes.reindex(); ncSeasonNotes.reindex(); ncYearNotes.reindex();
    this.app.workspace.trigger(SETTINGS_UPDATED);
  }

  // ── View init ────────────────────────────────────────────────

  initLeaf(type: string): void {
    if (this.app.workspace.getLeavesOfType(type).length) return;
    this.app.workspace.getRightLeaf(false).setViewState({ type });
  }

  async loadOptions(): Promise<void> {
    const options = await this.loadData();
    settings.update((old) => ({ ...old, ...(options || {}) }));
    await this.saveData(this.options);
  }

  async writeOptions(changeOpts: (s: ISettings) => Partial<ISettings>): Promise<void> {
    settings.update((old) => ({ ...old, ...changeOpts(old) }));
    await this.saveData(this.options);
  }

  async loadHolidays(): Promise<void> {
    const region = this.options.holidayRegion;
    if (!region || region === "None") { holidays.set({}); return; }
    const holidayPath = `${this.manifest.dir}/holidays/${region}`;
    const adapter = this.app.vault.adapter;
    const holidayMap: Record<string, { type: string; name: string }> = {};
    try {
      if (await adapter.exists(holidayPath)) {
        const result = await adapter.list(holidayPath);
        for (const file of result.files) {
          if (file.endsWith(".json")) {
            const content = await adapter.read(file);
            const data = JSON.parse(content);
            if (data.dates && Array.isArray(data.dates)) {
              data.dates.forEach((d: any) => { if (d.date && d.type) holidayMap[d.date] = { type: d.type, name: d.name || "" }; });
            }
          }
        }
      }
    } catch (e) { console.error("Failed to load holidays", e); }
    holidays.set(holidayMap);
  }
}
