import type { Moment, WeekSpec } from "moment";
import { App, Plugin, WorkspaceLeaf } from "obsidian";

import { VIEW_TYPE_CALENDAR, VIEW_TYPE_NC_CALENDAR } from "./constants";
import { settings, holidays } from "./ui/stores";
import {
  appHasPeriodicNotesPluginLoaded,
  CalendarSettingsTab,
  ISettings,
} from "./settings";
import CalendarView from "./view";
import NCView from "./nc-view";
import { NC } from "./utils/nc-engine";

declare global {
  interface Window {
    app: App;
    moment: () => Moment;
    _bundledLocaleWeekSpec: WeekSpec;
    NCEngine: typeof NC;
  }
}

export default class CalendarPlugin extends Plugin {
  public options: ISettings;
  private view: CalendarView;
  private ncView: NCView;

  onunload(): void {
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR)
      .forEach((leaf) => leaf.detach());
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_NC_CALENDAR)
      .forEach((leaf) => leaf.detach());
  }

  async onload(): Promise<void> {
    window.NCEngine = NC;

    this.register(
      settings.subscribe((value) => {
        this.options = value;
        this.loadHolidays();
      })
    );

    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf: WorkspaceLeaf) => (this.view = new CalendarView(leaf))
    );

    this.registerView(
      VIEW_TYPE_NC_CALENDAR,
      (leaf: WorkspaceLeaf) => (this.ncView = new NCView(leaf))
    );

    this.addCommand({
      id: "show-gc-calendar-view",
      name: "Open GC view",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0
          );
        }
        this.initLeaf(VIEW_TYPE_CALENDAR);
      },
    });

    this.addCommand({
      id: "show-nc-calendar-view",
      name: "Open NC view",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.getLeavesOfType(VIEW_TYPE_NC_CALENDAR).length === 0
          );
        }
        this.initLeaf(VIEW_TYPE_NC_CALENDAR);
      },
    });

    this.addCommand({
      id: "open-weekly-note",
      name: "Open Weekly Note",
      checkCallback: (checking) => {
        if (checking) {
          return !appHasPeriodicNotesPluginLoaded();
        }
        this.view.openOrCreateWeeklyNote(window.moment(), false);
      },
    });

    this.addCommand({
      id: "reveal-active-note",
      name: "Reveal active note",
      callback: () => {
        this.view.revealActiveNote();
        if (this.ncView) this.ncView.revealActiveNote();
      },
    });

    await this.loadOptions();

    this.addSettingTab(new CalendarSettingsTab(this.app, this));

    if (this.app.workspace.layoutReady) {
      this.initLeaf(VIEW_TYPE_CALENDAR);
    } else {
      this.registerEvent(
        this.app.workspace.on("layout-ready", () => {
          this.initLeaf(VIEW_TYPE_CALENDAR);
        })
      );
    }
  }

  initLeaf(type: string): void {
    if (this.app.workspace.getLeavesOfType(type).length) {
      return;
    }
    this.app.workspace.getRightLeaf(false).setViewState({
      type: type,
    });
  }

  async loadOptions(): Promise<void> {
    const options = await this.loadData();
    settings.update((old) => {
      return {
        ...old,
        ...(options || {}),
      };
    });

    await this.saveData(this.options);
  }

  async writeOptions(
    changeOpts: (settings: ISettings) => Partial<ISettings>
  ): Promise<void> {
    settings.update((old) => ({ ...old, ...changeOpts(old) }));
    await this.saveData(this.options);
  }

  async loadHolidays(): Promise<void> {
    const region = this.options.holidayRegion;
    if (!region || region === "None") {
      holidays.set({});
      return;
    }

    const holidayPath = `${this.manifest.dir}/holidays/${region}`;
    const adapter = this.app.vault.adapter;
    const holidayMap: Record<string, string> = {};

    try {
      if (await adapter.exists(holidayPath)) {
        const result = await adapter.list(holidayPath);
        for (const file of result.files) {
          if (file.endsWith(".json")) {
            const content = await adapter.read(file);
            const data = JSON.parse(content);
            if (data.dates && Array.isArray(data.dates)) {
              data.dates.forEach((d: any) => {
                if (d.date && d.type) {
                  holidayMap[d.date] = { type: d.type, name: d.name || "" };
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to load holidays", e);
    }
    holidays.set(holidayMap);
  }
}
