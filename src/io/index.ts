// Public API surface for IO modules
export {
  join,
  ensureFolderExists,
  getNotePath,
  getTemplateInfo,
  getDateUID,
  getDateFromFilename,
  getDateFromFile,
  replaceTemplateTokens,
  getFrontmatterFromCache,
  getDailyNoteSettings,
  getWeeklyNoteSettings,
  getMonthlyNoteSettings,
  getQuarterlyNoteSettings,
  getYearlyNoteSettings,
  getNCPhaseSettings,
  getNCMonthSettings,
  getNCSeasonSettings,
  getNCYearSettings,
  appHasDailyNotesPluginLoaded,
  appHasWeeklyNotesPluginLoaded,
  appHasMonthlyNotesPluginLoaded,
} from "./utils";

export {
  createMonthlyNote,
  createQuarterlyNote,
  createYearlyNote,
  getMonthlyNote,
  getQuarterlyNote,
  getYearlyNote,
  getAllMonthlyNotes,
  getAllQuarterlyNotes,
  getAllYearlyNotes,
} from "./gcNotes";

export {
  createNCNote,
  getNCNote,
  getAllNCNotes,
} from "./ncNotes";

export {
  tryToCreateDailyNote,
} from "./dailyNotes";

export {
  tryToCreateWeeklyNote,
} from "./weeklyNotes";
