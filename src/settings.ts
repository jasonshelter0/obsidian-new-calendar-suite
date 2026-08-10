import {
  App,
  PluginSettingTab,
  Setting,
  AbstractInputSuggest,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";
import { get } from "svelte/store";

import { DEFAULT_WEEK_FORMAT, DEFAULT_WORDS_PER_DOT } from "src/constants";

import type CalendarPlugin from "./main";
import { holidayMeta } from "./ui/stores";

export interface IPeriodicNoteSettings {
  enabled: boolean;
  format: string;
  template: string;
  folder: string;
}

export interface ISettings {
  wordsPerDot: number;
  wordCountOffset: number;
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;

  // Weekly Note settings
  showWeeklyNote: boolean;
  weeklyNoteFormat: string;
  weeklyNoteTemplate: string;
  weeklyNoteFolder: string;

  localeOverride: ILocaleOverride;
  holidayRegion: string;

  // General (calendar-neutral)
  daily: IPeriodicNoteSettings;
  weekly: IPeriodicNoteSettings;
  // GC
  monthly: IPeriodicNoteSettings;
  quarterly: IPeriodicNoteSettings;
  yearly: IPeriodicNoteSettings;
  // NC
  ncPhase: IPeriodicNoteSettings;
  ncMonth: IPeriodicNoteSettings;
  ncSeason: IPeriodicNoteSettings;
  ncYear: IPeriodicNoteSettings;

  hasMigratedLegacySettings: boolean;
}

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function periodicDefaults(overrides?: Partial<IPeriodicNoteSettings>): IPeriodicNoteSettings {
  return { enabled: false, format: "", template: "", folder: "", ...overrides };
}

export const defaultSettings: ISettings = {
  shouldConfirmBeforeCreate: true,
  weekStart: "locale" as IWeekStartOption,

  wordsPerDot: DEFAULT_WORDS_PER_DOT,
  wordCountOffset: 0,

  showWeeklyNote: false,
  weeklyNoteFormat: "",
  weeklyNoteTemplate: "",
  weeklyNoteFolder: "",

  localeOverride: "system-default",
  holidayRegion: "None",

  daily: periodicDefaults({ enabled: true }),
  weekly: periodicDefaults(),
  monthly: periodicDefaults(),
  quarterly: periodicDefaults(),
  yearly: periodicDefaults(),

  ncPhase: periodicDefaults(),
  ncMonth: periodicDefaults({ enabled: true }),
  ncSeason: periodicDefaults(),
  ncYear: periodicDefaults(),

  hasMigratedLegacySettings: false,
};

export function appHasPeriodicNotesPluginLoaded(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodicNotes = (<any>window.app).plugins.getPlugin("periodic-notes");
  return periodicNotes && periodicNotes.settings?.weekly?.enabled;
}

// ── Autocomplete helpers for settings inputs ──────────────────────

class FileSuggest extends AbstractInputSuggest<TFile> {
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): TFile[] {
    const lower = query.toLowerCase();
    return this.app.vault
      .getFiles()
      .filter(
        (f) =>
          f.extension === "md" && f.path.toLowerCase().includes(lower)
      );
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = file.path;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): TFolder[] {
    const lower = query.toLowerCase();
    const folders: TFolder[] = [];
    // Walk all files/dirs to get folders
    const root = this.app.vault.getRoot();
    (this.app.vault as any).recurseChildren(root, (child: TAbstractFile) => {
      if (child instanceof TFolder && child.path.toLowerCase().includes(lower)) {
        folders.push(child);
      }
    });
    return folders;
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.inputEl.value = folder.path;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}

export class CalendarSettingsTab extends PluginSettingTab {
  private plugin: CalendarPlugin;

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    this.containerEl.createEl("h3", { text: "General Settings" });
    this.addDotThresholdSetting();
    this.addWordCountOffsetSetting();
    this.addWeekStartSetting();
    this.addConfirmCreateSetting();
    this.addShowWeeklyNoteSetting();

    this.containerEl.createEl("h3", { text: "General Notes" });
    this.addPeriodicSection("daily", "Daily", "YYYY-MM-DD");
    this.addPeriodicSection("weekly", "Weekly", "gggg-[W]ww");

    this.containerEl.createEl("h3", { text: "Gregorian Calendar Notes" });
    this.addPeriodicSection("monthly", "Monthly", "YYYY-MM");
    this.addPeriodicSection("quarterly", "Quarterly", "YYYY-[Q]Q");
    this.addPeriodicSection("yearly", "Yearly", "YYYY");

    this.containerEl.createEl("h3", { text: "New Calendar Notes" });
    this.addPeriodicSection("ncPhase", "NC Phase", "NC-YY-MM-[P]P");
    this.addPeriodicSection("ncMonth", "NC Month", "NC-YY-MM");
    this.addPeriodicSection("ncSeason", "NC Season", "NC-YY-[S]S");
    this.addPeriodicSection("ncYear", "NC Year", "NC-YY");

    this.containerEl.createEl("h3", { text: "Advanced Settings" });
    this.addLocaleOverrideSetting();

    this.containerEl.createEl("h3", { text: "Holiday System" });
    this.addHolidayRegionSetting();
  }

  addPeriodicSection(key: string, label: string, defaultFormat: string): void {
    const opts = (this.plugin.options as any)[key];

    new Setting(this.containerEl)
      .setName(`${label} Notes`)
      .setDesc(`Enable ${label.toLowerCase()} note creation`)
      .addToggle((toggle) => {
        toggle.setValue(opts?.enabled ?? false);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            [key]: { ...(s as any)[key], enabled: value },
          } as any));
          this.display();
        });
      });

    if (!opts?.enabled) return;

    new Setting(this.containerEl)
      .setName(`${label} format`)
      .addText((textfield) => {
        textfield.setPlaceholder(defaultFormat);
        textfield.setValue(opts?.format || "");
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            [key]: { ...(s as any)[key], format: value },
          } as any));
        });
      });

    new Setting(this.containerEl)
      .setName(`${label} template`)
      .addText((textfield) => {
        textfield.setPlaceholder("Example: Templates/Note.md");
        textfield.setValue(opts?.template || "");
        new FileSuggest(this.app, textfield.inputEl);
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            [key]: { ...(s as any)[key], template: value },
          } as any));
        });
      });

    new Setting(this.containerEl)
      .setName(`${label} folder`)
      .addText((textfield) => {
        textfield.setPlaceholder("Example: NC/Monthly");
        textfield.setValue(opts?.folder || "");
        new FolderSuggest(this.app, textfield.inputEl);
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            [key]: { ...(s as any)[key], folder: value },
          } as any));
        });
      });
  }

  async addHolidayRegionSetting(): Promise<void> {
    let regions: string[] = ["None"];

    try {
      const dataPath = `${this.plugin.manifest.dir}/holidays.json`;
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(dataPath)) {
        const content = await adapter.read(dataPath);
        const all = JSON.parse(content);
        const keys = Object.keys(all).filter((k) => k !== "None");
        regions = ["None", ...keys];
      }
    } catch (e) {
      console.error("Failed to read holiday regions", e);
    }

    new Setting(this.containerEl)
      .setName("Holiday Region")
      .setDesc("Select a region to load holiday data.")
      .addDropdown((dropdown) => {
        regions.forEach((r) => dropdown.addOption(r, r));
        dropdown.setValue(this.plugin.options.holidayRegion || "None");
        dropdown.onChange(async (value) => {
          await this.plugin.writeOptions(() => ({ holidayRegion: value }));
        });
      });

    const meta = get(holidayMeta);
    const statusEl = this.containerEl.createDiv({ cls: "setting-item-description" });
    if (meta.source) {
      statusEl.setText(`Holiday data: ${meta.source} (updated ${meta.updated || "unknown"})`);
    } else {
      statusEl.setText("Holiday data: not loaded. Select a region above to auto-download.");
    }
  }

  addDotThresholdSetting(): void {
    new Setting(this.containerEl)
      .setName("Words per dot")
      .setDesc("How many words should be represented by a single dot?")
      .addText((textfield) => {
        textfield.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
        textfield.inputEl.type = "number";
        textfield.setValue(String(this.plugin.options.wordsPerDot));
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            wordsPerDot: value !== "" ? Number(value) : undefined,
          }));
        });
      });
  }

  addWordCountOffsetSetting(): void {
    new Setting(this.containerEl)
      .setName("Word count offset")
      .setDesc("Ignore this number of words from the beginning of the note.")
      .addText((textfield) => {
        textfield.setPlaceholder("0");
        textfield.inputEl.type = "number";
        textfield.setValue(String(this.plugin.options.wordCountOffset));
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            wordCountOffset: value !== "" ? Number(value) : 0,
          }));
        });
      });
  }

  addWeekStartSetting(): void {
    const { moment } = window;

    const localizedWeekdays = moment.weekdays();
    const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
    const localeWeekStart = moment.weekdays()[localeWeekStartNum];

    new Setting(this.containerEl)
      .setName("Start week on:")
      .setDesc(
        "Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.options.weekStart);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            weekStart: value as IWeekStartOption,
          }));
        });
      });
  }

  addConfirmCreateSetting(): void {
    new Setting(this.containerEl)
      .setName("Confirm before creating new note")
      .setDesc("Show a confirmation modal before creating a new note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            shouldConfirmBeforeCreate: value,
          }));
        });
      });
  }

  addShowWeeklyNoteSetting(): void {
    new Setting(this.containerEl)
      .setName("Show week number")
      .setDesc("Enable this to add a column with the week number")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showWeeklyNote);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showWeeklyNote: value }));
          this.display(); // show/hide weekly settings
        });
      });
  }

  addWeeklyNoteFormatSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note format")
      .setDesc("For more syntax help, refer to format reference")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFormat);
        textfield.setPlaceholder(DEFAULT_WEEK_FORMAT);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFormat: value }));
        });
      });
  }

  addWeeklyNoteTemplateSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note template")
      .setDesc(
        "Choose the file you want to use as the template for your weekly notes"
      )
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteTemplate);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
        });
      });
  }

  addWeeklyNoteFolderSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note folder")
      .setDesc("New weekly notes will be placed here")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFolder);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
        });
      });
  }

  addLocaleOverrideSetting(): void {
    const { moment } = window;

    const sysLocale = navigator.language?.toLowerCase();

    new Setting(this.containerEl)
      .setName("Override locale:")
      .setDesc(
        "Set this if you want to use a locale different from the default"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("system-default", `Same as system (${sysLocale})`);
        moment.locales().forEach((locale) => {
          dropdown.addOption(locale, locale);
        });
        dropdown.setValue(this.plugin.options.localeOverride);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            localeOverride: value as ILocaleOverride,
          }));
        });
      });
  }
}
