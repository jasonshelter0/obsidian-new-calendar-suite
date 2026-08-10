import {
  App,
  PluginSettingTab,
  Setting,
  AbstractInputSuggest,
  TAbstractFile,
  TFile,
  TFolder,
  Vault,
  Notice,
  requestUrl,
} from "obsidian";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";
import { get } from "svelte/store";

import { DEFAULT_WEEK_FORMAT, DEFAULT_WORDS_PER_DOT, DEFAULT_DATAVIEW_TEMPLATE, DEFAULT_DATAVIEW_MARKER } from "src/constants";
import type { IBreadcrumbsSettings } from "./breadcrumbs/types";

import type CalendarPlugin from "./main";
import { holidayMeta, holidays } from "./ui/stores";

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

  // Breadcrumbs integration
  breadcrumbs: IBreadcrumbsSettings;

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

  breadcrumbs: {
    enabled: false,
    fieldUp: "up",
    fieldDown: "down",
    fieldPrev: "prev",
    fieldNext: "next",
    linkStyle: "wikilink",
    outputMode: "yaml",
    dataviewTemplate: DEFAULT_DATAVIEW_TEMPLATE,
    dataviewPosition: "after-yaml",
    dataviewMarker: DEFAULT_DATAVIEW_MARKER,
    dualUpWeekly: true,
    autoInverse: false,
  },

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
    Vault.recurseChildren(root, (child: TAbstractFile) => {
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

    this.containerEl.createEl("h3", { text: "Breadcrumbs Integration" });
    this.addBreadcrumbsSection();
  }

  addPeriodicSection(key: string, label: string, defaultFormat: string): void {
    const opts = (this.plugin.options as any)[key];
    const enabled = opts?.enabled ?? false;

    // Container for the collapsible sub-settings
    const sectionBody = this.containerEl.createDiv({ cls: "periodic-section-body" });
    if (!enabled) sectionBody.style.display = "none";

    new Setting(this.containerEl)
      .setName(`${label} Notes`)
      .setDesc(`Enable ${label.toLowerCase()} note creation`)
      .addToggle((toggle) => {
        toggle.setValue(enabled);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            [key]: { ...(s as any)[key], enabled: value },
          } as any));
          sectionBody.style.display = value ? "" : "none";
        });
      });

    new Setting(sectionBody)
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

    new Setting(sectionBody)
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

    new Setting(sectionBody)
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
    const dataPath = `${this.plugin.manifest.dir}/holidays.json`;
    const adapter = this.app.vault.adapter;
    let regions: string[] = ["None"];

    // Read meta directly from file (not just the store — store may not be set yet)
    let fileMeta: any = {};
    try {
      if (await adapter.exists(dataPath)) {
        const content = await adapter.read(dataPath);
        const all = JSON.parse(content);
        const keys = Object.keys(all).filter((k) => k !== "_meta" && k !== "None");
        regions = ["None", ...keys];
        fileMeta = all._meta || {};
      }
    } catch (e) {
      console.error("Failed to read holiday regions", e);
    }

    // Status display element (will be updated by refresh/download actions)
    const statusEl = this.containerEl.createDiv({ cls: "setting-item-description" });
    const updateStatus = () => {
      const m = get(holidayMeta);
      if (m.source) {
        statusEl.setText(`Holiday data: ${m.source} (updated ${m.updated || "unknown"})`);
      } else if (fileMeta.source) {
        statusEl.setText(`Holiday data: ${fileMeta.source} (updated ${fileMeta.updated || "unknown"})`);
      } else {
        statusEl.setText("Holiday data: not downloaded. Use the button below to fetch it.");
      }
    };
    updateStatus();

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

    // Refresh + Download buttons
    const btnRow = this.containerEl.createDiv({ cls: "setting-item" });
    const btnContainer = btnRow.createDiv({ cls: "setting-item-control" });

    const refreshBtn = btnContainer.createEl("button", { text: "Refresh status" });
    refreshBtn.onclick = async () => {
      try {
        if (await adapter.exists(dataPath)) {
          const content = await adapter.read(dataPath);
          const all = JSON.parse(content);
          holidayMeta.set(all._meta || {});
          new Notice("Holiday status refreshed");
        } else {
          holidayMeta.set({});
          new Notice("holidays.json not found locally");
        }
        updateStatus();
      } catch (e) {
        new Notice("Failed to read holidays.json");
      }
    };

    const downloadBtn = btnContainer.createEl("button", { text: "Download from GitHub" });
    downloadBtn.style.marginLeft = "8px";
    downloadBtn.onclick = async () => {
      new Notice("Downloading holidays.json...");
      try {
        const url = "https://raw.githubusercontent.com/jasonshelter0/obsidian-new-calendar-suite/main/holidays.json";
        const resp = await requestUrl({ url });
        if (resp.status === 200) {
          const raw = JSON.parse(resp.text);
          raw._meta = { source: "v" + this.plugin.manifest.version, updated: new Date().toISOString().slice(0, 10) };
          await adapter.write(dataPath, JSON.stringify(raw, null, 2));
          holidayMeta.set(raw._meta);
          holidays.set({});
          new Notice("holidays.json downloaded successfully!");
          updateStatus();
        } else {
          new Notice("Download failed — HTTP " + resp.status);
        }
      } catch (e) {
        new Notice("Download failed. Check console for details.");
        console.warn("[New Calendar Suite] Manual download failed:", e);
      }
    };
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

  // ── Breadcrumbs section ─────────────────────────────────────────

  addBreadcrumbsSection(): void {
    const bc = this.plugin.options.breadcrumbs;
    const enabled = bc?.enabled ?? false;

    const sectionBody = this.containerEl.createDiv({ cls: "periodic-section-body" });
    if (!enabled) sectionBody.style.display = "none";

    new Setting(this.containerEl)
      .setName("Enable Breadcrumbs integration")
      .setDesc("Add commands to insert Breadcrumbs hierarchy fields (up/down/prev/next) into calendar notes")
      .addToggle((toggle) => {
        toggle.setValue(enabled);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, enabled: value },
          }));
          sectionBody.style.display = value ? "" : "none";
        });
      });

    // ── Field names ──
    new Setting(sectionBody)
      .setName("Field name: up (parent)")
      .setDesc("YAML key or Dataview field name for parent/ancestor relationships")
      .addText((textfield) => {
        textfield.setPlaceholder("up");
        textfield.setValue(bc?.fieldUp || "up");
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, fieldUp: value || "up" },
          }));
        });
      });

    new Setting(sectionBody)
      .setName("Field name: down (children)")
      .setDesc("YAML key or Dataview field name for child/descendant relationships")
      .addText((textfield) => {
        textfield.setPlaceholder("down");
        textfield.setValue(bc?.fieldDown || "down");
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, fieldDown: value || "down" },
          }));
        });
      });

    new Setting(sectionBody)
      .setName("Field name: prev (previous)")
      .setDesc("YAML key or Dataview field name for previous-sibling relationships")
      .addText((textfield) => {
        textfield.setPlaceholder("prev");
        textfield.setValue(bc?.fieldPrev || "prev");
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, fieldPrev: value || "prev" },
          }));
        });
      });

    new Setting(sectionBody)
      .setName("Field name: next")
      .setDesc("YAML key or Dataview field name for next-sibling relationships")
      .addText((textfield) => {
        textfield.setPlaceholder("next");
        textfield.setValue(bc?.fieldNext || "next");
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, fieldNext: value || "next" },
          }));
        });
      });

    // ── Link style ──
    new Setting(sectionBody)
      .setName("Link style")
      .setDesc("Wiki-style [[links]] or Markdown [links](path)")
      .addDropdown((dropdown) => {
        dropdown.addOption("wikilink", "[[wikilink]]");
        dropdown.addOption("markdown", "[markdown](path)");
        dropdown.setValue(bc?.linkStyle || "wikilink");
        dropdown.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, linkStyle: value as "wikilink" | "markdown" },
          }));
        });
      });

    // ── Output mode ──
    new Setting(sectionBody)
      .setName("Output mode")
      .setDesc("YAML frontmatter (between ---) or Dataview inline fields (:: syntax)")
      .addDropdown((dropdown) => {
        dropdown.addOption("yaml", "YAML frontmatter");
        dropdown.addOption("dataview", "Dataview inline (::)");
        dropdown.setValue(bc?.outputMode || "yaml");
        dropdown.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, outputMode: value as "yaml" | "dataview" },
          }));
        });
      });

    // ── Dataview template (textarea) ──
    new Setting(sectionBody)
      .setName("Dataview template")
      .setDesc("Template for inline Dataview fields. {field} = direction name, {value} = rendered link(s)")
      .addTextArea((textarea) => {
        textarea.setPlaceholder("{field}:: {value}");
        textarea.setValue(bc?.dataviewTemplate || "{field}:: {value}");
        textarea.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, dataviewTemplate: value || "{field}:: {value}" },
          }));
        });
      });

    // ── Dataview position ──
    new Setting(sectionBody)
      .setName("Dataview insert position")
      .setDesc("Where to insert inline fields in the note body")
      .addDropdown((dropdown) => {
        dropdown.addOption("after-yaml", "After YAML frontmatter");
        dropdown.addOption("end", "End of file");
        dropdown.addOption("marker", "After marker comment");
        dropdown.setValue(bc?.dataviewPosition || "after-yaml");
        dropdown.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, dataviewPosition: value as "after-yaml" | "end" | "marker" },
          }));
        });
      });

    // ── Dataview marker ──
    new Setting(sectionBody)
      .setName("Dataview marker")
      .setDesc("Marker comment used when position is 'After marker comment'")
      .addText((textfield) => {
        textfield.setPlaceholder("<!-- bc:insert -->");
        textfield.setValue(bc?.dataviewMarker || "<!-- bc:insert -->");
        textfield.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, dataviewMarker: value || "<!-- bc:insert -->" },
          }));
        });
      });

    // ── Dual up for weekly/daily ──
    new Setting(sectionBody)
      .setName("Dual parents for weekly/daily")
      .setDesc("When enabled, weekly and daily 'up' inserts both GC and NC parents")
      .addToggle((toggle) => {
        toggle.setValue(bc?.dualUpWeekly ?? true);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, dualUpWeekly: value },
          }));
        });
      });

    // ── Auto-inverse ──
    new Setting(sectionBody)
      .setName("Auto-insert inverse relationships")
      .setDesc("Also write reverse fields into target notes (e.g., 'down' in the parent when inserting 'up' here)")
      .addToggle((toggle) => {
        toggle.setValue(bc?.autoInverse ?? false);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((s) => ({
            breadcrumbs: { ...s.breadcrumbs, autoInverse: value },
          }));
        });
      });
  }
}
