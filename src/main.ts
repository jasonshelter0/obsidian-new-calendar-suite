import type { Moment, WeekSpec } from "moment";
import { App, Plugin, WorkspaceLeaf, TFile, FileView, requestUrl } from "obsidian";
import { configureGlobalMomentLocale } from "obsidian-calendar-ui";

import { VIEW_TYPE_CALENDAR, VIEW_TYPE_NC_CALENDAR, SETTINGS_UPDATED } from "./constants";
import { settings, holidays, holidayMeta, dailyNotes, weeklyNotes, monthlyNotes, quarterlyNotes, yearlyNotes, ncPhaseNotes, ncMonthNotes, ncSeasonNotes, ncYearNotes } from "./ui/stores";
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
import { parseNCFilename, buildNCKey, buildNCFormatRegex } from "./utils/nc-dates";
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
import { createDailyNoteFile } from "./io/dailyNotes";
import { createWeeklyNoteFile } from "./io/weeklyNotes";
import { detectNoteType } from "./breadcrumbs/hierarchy";
import { insertBreadcrumbsRelationships } from "./breadcrumbs/command";
import { getFrontmatterFromCache } from "./io/utils";

declare global {
  interface Window {
    app: App;
    moment: () => Moment;
    _bundledLocaleWeekSpec: WeekSpec;
    NCEngine: typeof NC;
    NCNotes: typeof NCNotesAPI;
    NCDates: typeof NCDatesAPI;
  }
}

/**
 * Public API for DataviewJS, Templater, and other plugins.
 * Access via `window.NCDates`.
 *
 * Usage examples:
 *   // Today's NC date
 *   const today = window.NCDates.today();
 *
 *   // Navigate to next NC month's start
 *   const next = window.NCDates.nextPeriod(today, "nc-month");
 *
 *   // Get GC moments for a Dataview WHERE clause
 *   const [start, end] = window.NCDates.getPeriodRange("nc-month", 4, 6);
 *   dv.pages().where(p => p.file.day >= start && p.file.day < end);
 *
 *   // Parse an NC filename
 *   const parsed = window.NCDates.parseFilename("NC-04-06-P2", "NC-YY-MM-[P]P", "nc-phase");
 *
 *   // Compare two NC dates
 *   window.NCDates.compare({ny:4,nm:6,nd:1}, {ny:4,nm:6,nd:15}); // -1
 */
const NCDatesAPI = {
  // ── NC date info ──────────────────────────────────
  today: NC.today,
  yesterday: NC.yesterday,
  tomorrow: NC.tomorrow,
  /** Get full NC info for any GC moment or date string */
  get: NC.getNCDate,
  /** Convert GC (gy, gm, gd) to NC */
  convert: NC.toNewCalendar,

  // ── Navigation ────────────────────────────────────
  nextPeriod: NC.nextPeriod,
  prevPeriod: NC.prevPeriod,
  addDays: NC.addDays,

  // ── Comparison ────────────────────────────────────
  compare: NC.compare,

  // ── Ranges (for Dataview WHERE clauses) ───────────
  /** Get [startMoment, endMoment] for any NC period */
  getPeriodRange: NC.getPeriodRange,

  // ── String helpers ────────────────────────────────
  /** Format NC {ny,nm,nd} as "YY-MM-DD" */
  toDateString: NC.toDateString,
  /** Parse "YY-MM-DD" → {ny,nm,nd,phase,season,color} */
  parseDateString: NC.parseDateString,
  /** Format any GC date using NC.format(pattern) */
  format: NC.format,
  /** Smart format from filename or now */
  smartFormat: NC.smartFormat,

  // ── NC calendar structure ─────────────────────────
  getPhase: NC.getPhase,
  getSeason: NC.getSeason,
  getPhaseRange: NC.getPhaseRange,
  getSeasonMonths: NC.getSeasonMonths,
  getMonthRange: NC.getMonthRange,
  getNCMonthStart: NC.getNCMonthStart,
  getNCWeekOfMonth: NC.getNCWeekOfMonth,

  // ── Filename parsing ──────────────────────────────
  parseFilename: parseNCFilename,
  buildKey: buildNCKey,
  buildFormatRegex: buildNCFormatRegex,

  // ── Cross-calendar mapping ────────────────────────
  /** Rough GC year for an NC year / month / season (use start boundary) */
  approxGCYear: NC.approxGCYear,

  // ── i18n ──────────────────────────────────────────
  numToChinese: NC.numToChinese,
};

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
    window.NCDates = NCDatesAPI;
    this.options = defaultSettings;

    this.register(
      settings.subscribe((value) => {
        this.options = value;
        configureGlobalMomentLocale(value.localeOverride, value.weekStart);
        this.loadHolidays();
        this.onSettingsUpdate();
      })
    );

    await this.loadOptions();
    configureGlobalMomentLocale(this.options.localeOverride, this.options.weekStart);
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
    this.initLeaf(VIEW_TYPE_NC_CALENDAR);
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
          note = await createDailyNoteFile(date);
        } else if (p === "weekly") {
          note = await createWeeklyNoteFile(date);
        }
        if (note) {
          const leaf = split ? app.workspace.splitActiveLeaf() : app.workspace.getUnpinnedLeaf();
          await leaf.openFile(note, { active: true });
        }
      };

      this.addCommand({ id: `open-${p}-note`, name: `Open ${p} note`, callback: () => openFn(window.moment(), false) });
    }

    // Breadcrumbs integration command
    const bc = this.options.breadcrumbs;
    if (bc?.enabled) {
      this.addCommand({
        id: "insert-breadcrumbs",
        name: "Insert Breadcrumbs relationships",
        checkCallback: (checking: boolean) => {
          const leaf = this.app.workspace.activeLeaf;
          const activeFile = leaf?.view instanceof FileView ? leaf.view.file : null;
          const valid = !!activeFile && detectNoteType(activeFile, getFrontmatterFromCache(activeFile)) !== null;
          if (!checking && valid && activeFile) {
            void insertBreadcrumbsRelationships(activeFile);
          }
          return valid;
        },
      });
    } else {
      (this.app.commands as any).removeCommand("new-calendar-suite:insert-breadcrumbs");
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
    const holidayMap: Record<string, { type: string; name: string }> = {};
    try {
      const dataPath = `${this.manifest.dir}/holidays.json`;
      const adapter = this.app.vault.adapter;

      // Auto-download from GitHub if file missing (e.g. BRAT installs)
      if (!(await adapter.exists(dataPath))) {
        console.log("[New Calendar Suite] holidays.json not found — downloading from GitHub...");
        try {
          const url = "https://raw.githubusercontent.com/jasonshelter0/obsidian-new-calendar-suite/main/holidays.json";
          const resp = await requestUrl({ url });
          if (resp.status === 200) {
            const raw = JSON.parse(resp.text);
            raw._meta = { source: "v" + this.manifest.version, updated: new Date().toISOString().slice(0, 10) };
            await adapter.write(dataPath, JSON.stringify(raw, null, 2));
            console.log("[New Calendar Suite] holidays.json downloaded successfully");
          } else {
            console.warn("[New Calendar Suite] holidays.json download failed — HTTP", resp.status);
          }
        } catch (e) {
          console.warn("[New Calendar Suite] holidays.json download failed:", e.message || e);
          console.warn("[New Calendar Suite] Holiday data unavailable. You can download it manually from the plugin's GitHub releases.");
        }
      }

      if (await adapter.exists(dataPath)) {
        const content = await adapter.read(dataPath);
        const all = JSON.parse(content);
        holidayMeta.set(all._meta || {});
        const regionData = all[region];
        if (regionData) {
          for (const year of Object.values(regionData) as any[]) {
            if (year.dates && Array.isArray(year.dates)) {
              year.dates.forEach((d: any) => {
                if (d.date && d.type) holidayMap[d.date] = { type: d.type, name: d.name || "" };
              });
            }
          }
        }
      }
    } catch (e) { console.error("Failed to load holidays", e); }
    holidays.set(holidayMap);
  }
}
