import { NC } from "./nc-engine";

/**
 * 从 GC moment 获取完整 NC 日期信息
 */
export function getNCDateInfo(date: any) {
  return NC.getNCDate(date);
}

/**
 * 生成 NC 周期笔记的规范排序 key
 *   nc-phase:  "nc-phase-24-03-2"  (ny-nm-phase)
 *   nc-month:  "nc-month-24-03"    (ny-nm)
 *   nc-season: "nc-season-24-2"    (ny-season)
 *   nc-year:   "nc-year-24"        (ny)
 */
export function buildNCKey(
  granularity: "nc-phase" | "nc-month" | "nc-season" | "nc-year",
  ny: number,
  nm: number,
  phaseOrSeason?: number,
): string {
  const pNy = ny.toString().padStart(2, "0");
  const pNm = nm.toString().padStart(2, "0");

  switch (granularity) {
    case "nc-phase":
      return `nc-phase-${pNy}-${pNm}-${phaseOrSeason}`;
    case "nc-month":
      return `nc-month-${pNy}-${pNm}`;
    case "nc-season":
      return `nc-season-${pNy}-${phaseOrSeason}`;
    case "nc-year":
      return `nc-year-${pNy}`;
  }
}

/**
 * 将 NC format pattern 转换为正则表达式
 * Token mapping:
 *   YY,MM,DD,ww,PP,SS → (\d{2})
 *   Y,M,D,w,P,S       → (\d+)
 *   CY,CM             → (.+)
 *   [text]            → 原样保留
 *   其他字符            → 转义
 */
export function buildNCFormatRegex(pattern: string): RegExp {
  let regexStr = "";

  // 移除 [text] 转义 （NC.format 使用前已处理，我们在此也处理）
  const cleaned = pattern.replace(/\[(.*?)\]/g, "$1");

  // 构建 token 正则，匹配 YY|MM|DD|ww|PP|SS|CY|CM|Y|M|D|w|P|S 和普通字符
  const tokenRegex = /YY|MM|DD|ww|PP|SS|CY|CM|Y|M|D|w|P|S|./g;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(cleaned)) !== null) {
    const token = match[0];
    switch (token) {
      case "YY":
      case "MM":
      case "DD":
      case "ww":
      case "PP":
      case "SS":
        regexStr += "(\\d{2})";
        break;
      case "Y":
      case "M":
      case "D":
      case "w":
      case "P":
      case "S":
        regexStr += "(\\d+)";
        break;
      case "CY":
      case "CM":
        regexStr += "(.+)";
        break;
      default:
        // 转义正则特殊字符
        regexStr += token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }

  return new RegExp("^" + regexStr + "$");
}

export interface ParsedNCFile {
  ny: number;
  nm: number;
  nd: number;
  phase: number;
  season: number;
}

/**
 * 从文件名解析 NC 日期
 * 先尝试正则匹配，再尝试从文件 frontmatter 读取
 */
export function parseNCFilename(
  filename: string,
  format: string,
  granularity: "nc-phase" | "nc-month" | "nc-season" | "nc-year",
  frontmatter?: Record<string, any> | null,
): ParsedNCFile | null {
  const basename = filename.replace(/\.md$/, "");
  const regex = buildNCFormatRegex(format);
  const match = basename.match(regex);

  if (match) {
    const tokens = match.slice(1); // 去掉完整匹配
    let yy = 0, mm = 0, dd = 1, pp = 1, ss = 1;

    // 根据 format 中的 token 顺序映射
    const cleaned = format.replace(/\[(.*?)\]/g, "$1");
    const tokenRegex = /YY|MM|DD|ww|PP|SS|CY|CM|Y|M|D|w|P|S/g;
    let idx = 0;
    let m2: RegExpExecArray | null;
    while ((m2 = tokenRegex.exec(cleaned)) !== null) {
      const token = m2[0];
      const val = parseInt(tokens[idx], 10);
      switch (token) {
        case "YY":
        case "Y":
          yy = val || 0;
          break;
        case "MM":
        case "M":
          mm = val || 0;
          break;
        case "DD":
        case "D":
          dd = val || 1;
          break;
        case "PP":
        case "P":
          pp = val || 1;
          break;
        case "SS":
        case "S":
          ss = val || 1;
          break;
      }
      idx++;
    }

    const phase = granularity === "nc-phase" ? pp : NC.getPhase(yy, mm, dd);
    const season = granularity === "nc-season" ? ss : NC.getSeason(yy, mm);

    return { ny: yy, nm: mm, nd: dd, phase, season };
  }

  // 回退：从 frontmatter 读取
  if (frontmatter && frontmatter["nc-date"]) {
    const ncDate: string = frontmatter["nc-date"];
    const parts = ncDate.split("-");
    if (parts.length === 3) {
      const yy = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      const dd = parseInt(parts[2], 10);
      const phase = NC.getPhase(yy, mm, dd);
      const season = NC.getSeason(yy, mm);
      return { ny: yy, nm: mm, nd: dd, phase, season };
    }
  }

  return null;
}

/**
 * 获取某个 Phase 的起始 GC moment
 */
export function getPhaseStart(ny: number, nm: number, phase: number) {
  const [start] = NC.getPhaseRange(ny, nm, phase);
  return start;
}

/**
 * 获取某个 Season 的起始 GC moment
 */
export function getSeasonStart(ny: number, season: number) {
  const [startNm] = NC.getSeasonMonths(ny, season);
  return NC.getNCMonthStart(ny, startNm);
}

/**
 * 获取某个 NC Year 的起始 GC moment
 */
export function getNCYearStart(ny: number) {
  return NC.getNCMonthStart(ny, 1);
}
