import type { TFile } from "obsidian";
import type { InsertPlanItem } from "./types";

// ── Field status detection ────────────────────────────────────────

/**
 * Read the current value of a Breadcrumbs field from a note's content.
 * Used for idempotency checks before insertion.
 */
export function readFieldStatus(
  content: string,
  key: string,
  mode: "yaml" | "dataview",
): { exists: boolean; value: string | null } {
  if (mode === "yaml") {
    return readYamlField(content, key);
  }
  return readDataviewField(content, key);
}

function readYamlField(
  content: string,
  key: string,
): { exists: boolean; value: string | null } {
  if (!content.startsWith("---")) return { exists: false, value: null };

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return { exists: false, value: null };

  const fm = content.slice(3, endIdx);
  // Match the key line and any indented list items that follow
  const keyRegex = new RegExp(`^${escapeRegex(key)}\\s*:\\s*(.*)`, "m");
  const match = fm.match(keyRegex);

  if (!match) return { exists: false, value: null };

  const lineValue = match[1]?.trim() || "";
  // If the value on the key line is empty/blank, check for indented list items below
  if (lineValue === "" || lineValue === "[]") {
    // Look for list items starting after the key line
    const keyLineIdx = fm.indexOf(match[0]);
    const afterKey = fm.slice(keyLineIdx + match[0].length);
    const listRegex = /^\s*-\s*(.+)$/gm;
    const items: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = listRegex.exec(afterKey)) !== null) {
      // Stop if we hit a non-indented key (next YAML field)
      const beforeMatch = afterKey.slice(0, m.index);
      const lastNewline = beforeMatch.lastIndexOf("\n");
      const afterLastNewline = beforeMatch.slice(lastNewline + 1);
      if (/^[a-zA-Z_]/.test(afterLastNewline)) break; // new top-level key
      items.push(m[1].trim());
    }
    if (items.length > 0) {
      return { exists: true, value: items.join(", ") };
    }
  }

  // Check for inline list syntax: key: [a, b]
  if (lineValue.startsWith("[") && lineValue.endsWith("]")) {
    return { exists: true, value: lineValue };
  }

  return { exists: true, value: lineValue };
}

function readDataviewField(
  content: string,
  key: string,
): { exists: boolean; value: string | null } {
  const regex = new RegExp(`^\\s*${escapeRegex(key)}\\s*::\\s*(.*)$`, "m");
  const match = content.match(regex);
  if (!match) return { exists: false, value: null };
  return { exists: true, value: match[1]?.trim() || null };
}

// ── Value comparison ──────────────────────────────────────────────

/**
 * Normalize a rendered Breadcrumbs value for comparison.
 * Strips quotes and whitespace so existing vs new values can be compared.
 */
export function normalizeValue(value: string): string {
  return value
    .replace(/^["']|["']$/g, "")   // surrounding quotes
    .replace(/\s*,\s*/g, ",")        // normalize comma spacing
    .trim();
}

// ── Field rendering ───────────────────────────────────────────────

/**
 * Build the YAML block for a single field.
 * Single-value: `key: "[[value]]"`
 * Multi-value:
 *   key:
 *     - "[[v1]]"
 *     - "[[v2]]"
 */
export function buildYamlBlock(key: string, values: string[]): string {
  if (values.length === 1) {
    return `${key}: "${values[0]}"`;
  }
  const lines = values.map((v) => `  - "${v}"`);
  return `${key}:\n${lines.join("\n")}`;
}

/**
 * Build a Dataview inline field line.
 * Multi-value fields are joined with ", " on one line (matching Breadcrumbs docs).
 */
export function buildDataviewLine(
  template: string,
  key: string,
  values: string[],
): string {
  const joined = values.join(", ");
  return template
    .replace(/\{field\}/g, key)
    .replace(/\{value\}/g, joined);
}

// ── Content mutation via vault.process ────────────────────────────

export interface InsertOptions {
  mode: "yaml" | "dataview";
  dataviewTemplate: string;
  dataviewPosition: "after-yaml" | "end" | "marker";
  dataviewMarker: string;
}

/**
 * Build the new note content with Breadcrumbs fields inserted.
 * Pure function — does not touch the vault (caller wraps in vault.process).
 *
 * @param current  Current file contents
 * @param items    Fields to insert (all with status "insert")
 * @param opts     Insertion options
 * @returns        Transformed contents
 */
export function buildNewContent(
  current: string,
  items: InsertPlanItem[],
  opts: InsertOptions,
): string {
  if (opts.mode === "yaml") {
    return insertYamlFields(current, items);
  }
  return insertDataviewFields(current, items, opts);
}

function insertYamlFields(current: string, items: InsertPlanItem[]): string {
  // Build blocks for each field
  const blocks = items.map((item) => buildYamlBlock(item.key, item.values));

  if (current.startsWith("---")) {
    // Has existing frontmatter — inject before closing ---
    const endIdx = current.indexOf("---", 3);
    if (endIdx !== -1) {
      return (
        current.slice(0, endIdx) +
        blocks.join("\n") +
        "\n" +
        current.slice(endIdx)
      );
    }
    // Malformed: starts with --- but no closing ---; treat as no frontmatter
  }

  // No frontmatter — prepend one
  return `---\n${blocks.join("\n")}\n---\n${current}`;
}

function insertDataviewFields(
  current: string,
  items: InsertPlanItem[],
  opts: InsertOptions,
): string {
  const lines = items.map((item) =>
    buildDataviewLine(opts.dataviewTemplate, item.key, item.values),
  );
  const block = lines.join("\n") + "\n";

  switch (opts.dataviewPosition) {
    case "after-yaml": {
      // Insert after YAML frontmatter block, or at top if none
      if (current.startsWith("---")) {
        const endIdx = current.indexOf("---", 3);
        if (endIdx !== -1) {
          const afterFm = endIdx + 3;
          // Skip any trailing newline after ---
          const skipNl = current[afterFm] === "\n" ? 1 : current[afterFm] === "\r" ? 1 : 0;
          return (
            current.slice(0, afterFm + skipNl) +
            "\n" +
            block +
            current.slice(afterFm + skipNl)
          );
        }
      }
      // No frontmatter — prepend at top
      return block + current;
    }

    case "end": {
      // Append at end of file
      const trail = current.endsWith("\n") ? "" : "\n";
      return current + trail + block;
    }

    case "marker": {
      // Insert after marker comment
      if (current.includes(opts.dataviewMarker)) {
        const idx = current.indexOf(opts.dataviewMarker) + opts.dataviewMarker.length;
        const afterMarker = current[idx] === "\n" ? 1 : 0;
        return (
          current.slice(0, idx + afterMarker) +
          "\n" +
          block +
          current.slice(idx + afterMarker)
        );
      }
      // Marker not found — append marker + block at end
      const trail = current.endsWith("\n") ? "" : "\n";
      return current + trail + opts.dataviewMarker + "\n" + block;
    }
  }

  return current;
}

// ── Utilities ─────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
