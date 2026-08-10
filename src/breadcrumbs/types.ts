import type { TFile } from "obsidian";

/**
 * Calendar note types that participate in Breadcrumbs hierarchy wiring.
 */
export type BcNoteType =
  | "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  | "nc-phase" | "nc-month" | "nc-season" | "nc-year";

/**
 * The four relationship directions supported by Breadcrumbs.
 * "same" is intentionally excluded — unordered siblings have no
 * meaningful interpretation in a calendar hierarchy.
 */
export type BcDirection = "up" | "down" | "prev" | "next";

/** Link rendering style. */
export type BcLinkStyle = "wikilink" | "markdown";

/** Where to insert Dataview inline fields in the note body. */
export type BcDataviewPosition = "after-yaml" | "end" | "marker";

/**
 * Breadcrumbs integration settings — persisted as `breadcrumbs` key in data.json.
 */
export interface IBreadcrumbsSettings {
  enabled: boolean;
  /** Field name for parent/up relationships (default "up") */
  fieldUp: string;
  /** Field name for children/down relationships (default "down") */
  fieldDown: string;
  /** Field name for previous-sibling (default "prev") */
  fieldPrev: string;
  /** Field name for next-sibling (default "next") */
  fieldNext: string;
  /** Wiki-link or markdown-link style */
  linkStyle: BcLinkStyle;
  /** YAML frontmatter or Dataview inline :: fields */
  outputMode: "yaml" | "dataview";
  /** Template for Dataview inline insertion; {field} and {value} are replaced */
  dataviewTemplate: string;
  /** Where in the note body to insert Dataview fields */
  dataviewPosition: BcDataviewPosition;
  /** Marker comment for "marker" position (default "<!-- bc:insert -->") */
  dataviewMarker: string;
  /** When true, weekly/daily "up" inserts both GC and NC parents */
  dualUpWeekly: boolean;
  /** When true, also write inverse relationships into target notes */
  autoInverse: boolean;
}

/** A resolved hierarchy target — the note to link to. */
export interface ResolvedTarget {
  type: BcNoteType;
  /** GC moment identifying the period (used for creation if file is null) */
  moment: any;
  /** The target file, or null if it hasn't been created yet */
  file: TFile | null;
}

/** One field to be inserted into the current note. */
export interface InsertPlanItem {
  /** The configured field name (e.g. "up", "parent") */
  key: string;
  /** Rendered link strings (wiki or markdown) */
  values: string[];
  /** Source targets (used when autoInverse writes reverse fields) */
  targets: ResolvedTarget[];
  /** Insertion status after checking existing content */
  status: "insert" | "exists-same" | "exists-different";
  /** The current rendered value, if status is not "insert" */
  existing: string | null;
}

/** Result of a breadcrumbs insertion operation. */
export interface InsertResult {
  inserted: number;
  created: number;
  skipped: number;
  conflicts: number;
}

/** Default field names, aligned with Breadcrumbs plugin defaults. */
export const DEFAULT_FIELD_UP = "up";
export const DEFAULT_FIELD_DOWN = "down";
export const DEFAULT_FIELD_PREV = "prev";
export const DEFAULT_FIELD_NEXT = "next";
