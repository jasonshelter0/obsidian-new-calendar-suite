import type { Moment } from "moment";
import { TFile, parseYaml, parseFrontMatterTags } from "obsidian";
import type { ICalendarSource, IDayMetadata } from "obsidian-calendar-ui";
import { getDailyNote, getWeeklyNote } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import { partition } from "src/ui/utils";

import { dailyNotes, weeklyNotes } from "../stores";

/**
 * Read frontmatter from a note — cache-first, with filesystem fallback.
 * The fallback is essential for files synced via WebDAV or external tools:
 * Obsidian's metadata cache may not be populated yet when the file first
 * appears, so we parse the YAML frontmatter directly from disk.
 */
async function getNoteFrontmatter(note: TFile | null): Promise<Record<string, any> | null> {
  if (!note) return null;

  // 1. Fast path: metadata cache (populated after Obsidian indexes the file)
  const cached = window.app.metadataCache.getFileCache(note)?.frontmatter;
  if (cached) return cached;

  // 2. Slow path: read the file and parse YAML frontmatter ourselves.
  //    Needed when files arrive via external sync before Obsidian indexes them.
  try {
    const raw = await window.app.vault.cachedRead(note);
    if (raw.startsWith("---")) {
      const endIdx = raw.indexOf("---", 3);
      if (endIdx !== -1) {
        const yamlBlock = raw.slice(3, endIdx);
        return parseYaml(yamlBlock) || null;
      }
    }
  } catch {
    // File may be inaccessible — that's fine, just return null
  }

  return null;
}

async function getNoteTags(note: TFile | null): Promise<string[]> {
  const frontmatter = await getNoteFrontmatter(note);
  if (!frontmatter) return [];
  const tags = parseFrontMatterTags(frontmatter) || [];
  // strip the '#' at the beginning
  return tags.map((tag: string) => tag.replace(/^#/, ""));
}

async function getFormattedTagAttributes(note: TFile | null): Promise<Record<string, string>> {
  const attrs: Record<string, string> = {};
  const tags = await getNoteTags(note);

  const [emojiTags, nonEmojiTags] = partition(tags, (tag) =>
    /(?:[✀-➿]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[#-9]️?⃣|㊙|㊗|〽|〰|Ⓜ|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|🆎|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|🈚|🈯|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|‼|⁉|[▪-▫]|▶|◀|[◻-◾]|©|®|™|ℹ|🀄|[☀-⛿]|⬅|⬆|⬇|⬛|⬜|⭐|⭕|⌚|⌛|⌨|⏏|[⏩-⏳]|[⏸-⏺]|🃏|⤴|⤵|[←-⇿])/.test(
      tag
    )
  );

  if (nonEmojiTags) {
    attrs["data-tags"] = nonEmojiTags.join(" ");
  }
  if (emojiTags) {
    attrs["data-emoji-tag"] = emojiTags[0];
  }

  return attrs;
}

export const customTagsSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getDailyNote(date, get(dailyNotes));
    return {
      dataAttributes: await getFormattedTagAttributes(file),
      dots: [],
    };
  },
  getWeeklyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getWeeklyNote(date, get(weeklyNotes));
    return {
      dataAttributes: await getFormattedTagAttributes(file),
      dots: [],
    };
  },
};
