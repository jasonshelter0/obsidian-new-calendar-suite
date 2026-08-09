import type CalendarPlugin from "./main";
import type { ISettings } from "./settings";

/**
 * Migrate legacy settings from:
 * 1. Periodic Notes plugin data.json
 * 2. Old calendar plugin weekly note settings
 * 3. Core daily-notes plugin options
 */
export async function migrateIfNeeded(plugin: CalendarPlugin): Promise<void> {
  if (plugin.options.hasMigratedLegacySettings) return;

  const adapter = plugin.app.vault.adapter;
  let migrated = false;

  // 1. Try to read periodic-notes data.json
  try {
    const pnPath = ".obsidian/plugins/periodic-notes/data.json";
    if (await adapter.exists(pnPath)) {
      const content = await adapter.read(pnPath);
      const pnSettings = JSON.parse(content);

      if (pnSettings.daily) {
        plugin.options.daily = { ...plugin.options.daily, ...pnSettings.daily };
      }
      if (pnSettings.weekly) {
        plugin.options.weekly = { ...plugin.options.weekly, ...pnSettings.weekly };
      }
      if (pnSettings.monthly) {
        plugin.options.monthly = { ...plugin.options.monthly, ...pnSettings.monthly };
      }
      if (pnSettings.quarterly) {
        plugin.options.quarterly = { ...plugin.options.quarterly, ...pnSettings.quarterly };
      }
      if (pnSettings.yearly) {
        plugin.options.yearly = { ...plugin.options.yearly, ...pnSettings.yearly };
      }
      migrated = true;
    }
  } catch (e) {
    console.log("[New Calendar Suite] No periodic-notes settings to migrate");
  }

  // 2. Check for old calendar plugin weekly note settings in our own data
  try {
    const oldOptions = plugin.options as any;
    // If old flat fields exist, migrate them to new nested format
    if (oldOptions.weeklyNoteFormat || oldOptions.weeklyNoteTemplate || oldOptions.weeklyNoteFolder) {
      if (!plugin.options.weekly.enabled) {
        plugin.options.weekly = {
          enabled: true,
          format: oldOptions.weeklyNoteFormat || plugin.options.weekly.format,
          template: oldOptions.weeklyNoteTemplate || plugin.options.weekly.template,
          folder: oldOptions.weeklyNoteFolder || plugin.options.weekly.folder,
        };
      }
      migrated = true;
    }
    // Migrate showWeeklyNote flag
    if (oldOptions.showWeeklyNote && !plugin.options.weekly.enabled) {
      plugin.options.weekly.enabled = true;
    }
  } catch (e) {
    // ignore
  }

  // 3. Seed daily from core daily-notes plugin
  try {
    const dailyNotesPlugin = (plugin.app as any).internalPlugins?.getPluginById("daily-notes")?.instance;
    if (dailyNotesPlugin?.options) {
      const opts = dailyNotesPlugin.options;
      if (opts.format && !plugin.options.daily.format) {
        plugin.options.daily.format = opts.format;
      }
      if (opts.folder && !plugin.options.daily.folder) {
        plugin.options.daily.folder = opts.folder;
      }
      if (opts.template && !plugin.options.daily.template) {
        plugin.options.daily.template = opts.template;
      }
    }
  } catch (e) {
    // ignore
  }

  plugin.options.hasMigratedLegacySettings = true;
  await plugin.saveData(plugin.options);

  if (migrated) {
    console.log("[New Calendar Suite] Migrated legacy settings from periodic-notes and calendar plugins");
  }
}
