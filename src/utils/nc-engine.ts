'use strict';

/**
 * 辅助函数：将数字转化为中文
 */
export const numToChinese = (num: number): string => {
  const chars = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六'];
  return chars[num] || num.toString();
};

/**
 * 辅助函数：生成新历年月的中文字符串
 */
export const toChineseYearMonth = (ny: number, nm: number): string => {
  const yearStr = ny === 1 ? "元年" : `${numToChinese(ny)}年`;
  return `新历${yearStr}${numToChinese(nm)}月`;
};

/**
 * 独有的 16 个月份色彩映射表
 */


export const ncMonthColour: Record<string, string> = {
  '01': '#E63C3C', // Crimson / 绯红
  '02': '#F27828', // Persimmon / 柿橙
  '03': '#C89100', // Goldenrod / 金珀
  '04': '#82A528', // Olive / 橄榄绿
  '05': '#28AA5A', // Jade / 翡翠
  '06': '#00A091', // Teal / 碧青
  '07': '#0096C8', // Lake Blue / 湖蓝
  '08': '#3278E6', // Azure / 蔚蓝
  '09': '#6464F0', // Indigo / 靛青
  '10': '#9655E6', // Grape / 葡萄紫
  '11': '#BE4BC8', // Orchid / 兰花紫
  '12': '#DC4696', // Magenta / 玫红
  '13': '#EB6478', // Coral Pink / 珊瑚粉
  '14': '#6E829B', // Slate / 石板灰 (中性偏冷)
  '15': '#AF6E4B', // Ochre / 赭石 (大地色系)
  '16': '#558773', // Deep Moss / 墨绿 (低调冷色)
}

// 旧，因区分度不高与暗色模式下可见度不高而废弃
// export const ncMonthColour: Record<string, string> = {
//   '01': '#CE3738', '02': '#FF8000', '03': '#2D756D', '04': '#2D5F5C',
//   '05': '#243D62', '06': '#656981', '07': '#AC6A6A', '08': '#BCBA63',
//   '09': '#95B26F', '10': '#7CC1B3', '11': '#3F36EE', '12': '#B4A758',
//   '13': '#9B9992', '14': '#2D3037', '15': '#78979F', '16': '#3F4F61',
// };

/**
 * 特殊日期的强制覆盖规则
 */
const OVERRIDES: Record<string, string> = {
  '2024-4': '2024-11-03', '2021-3': '2021-08-01', '2021-4': '2021-10-31', 
  '2019-4': '2019-11-10', '2018-1': '2018-03-21', '2390-4': '2390-11-04'
};

/**
 * 核心天文计算：根据年份和节气索引计算公历日期 (儒略日/黄经计算)
 */
const getSolarTermDate = (y: number, termIndex: number): Date => {
  const termLong = (termIndex * 15 + 270) % 360;
  let jd = (Date.UTC(y, 0, 1) / 86400000) + 2440587.5;
  jd += (termLong - 280 + 360) % 360;
  
  for (let i = 0; i < 20; i++) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T;
    const M = (357.52911 + 35999.05029 * T) * Math.PI / 180;
    const C = 1.914602 * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const lambda = (L0 + C + 360) % 360;
    let diff = (lambda - termLong + 540) % 360 - 180;
    jd -= diff * 1.0145;
  }
  
  const date = new Date((jd + 8/24 - 2440587.5) * 86400000 + 0.001);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

/**
 * 辅助规则：获取最近的星期日
 */
const getNearestSunday = (d: Date): Date => {
  const w = d.getUTCDay();
  const offset = (w >= 4) ? (7 - w) : -w;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

/**
 * 获取公历对应的”检查点” (用于切分新历月份)
 * Results are memoized — checkpoint dates are deterministic and never change.
 */
const _cpCache = new Map<string, Date>();
const _ncCache = new Map<string, { ny: number; nm: number; nd: number; pNy: string; pNm: string; pNd: string; color: string }>();
const getGCheckPoint = (y: number, tgt: number): Date => {
  const key = `${y}-${tgt}`;
  const cached = _cpCache.get(key);
  if (cached) return new Date(cached);

  let d: Date;
  if (OVERRIDES[key]) {
    d = new Date(OVERRIDES[key] + 'T00:00:00Z');
  } else {
    let m = (tgt - 1) * 6 + (y >= 2020 ? 3 : 6);
    let useSunday = (y >= 2020);
    if (y === 2019) {
      if (tgt === 3) { m = 21; useSunday = true; }
      else if (tgt === 4) { m = 0; }
    }
    d = getSolarTermDate(y, m % 24);
    if (useSunday) d = getNearestSunday(d);
  }
  _cpCache.set(key, d);
  return new Date(d);
};

/**
 * 年月转换规则：公历转内部目标系
 */
const toTN = (y: number, tgt: number) => {
  let ny = Math.floor((y - 2013) / 4) + 1;
  let nm = (y - 2013 - 4 * (ny - 1)) * 4 + tgt;
  if (ny === 2 && nm >= 12) nm -= 1;
  return { ny, nm };
};

/**
 * 年月转换规则：内部目标系转公历
 */
const toNT = (ny: number, nm: number) => {
  if (ny === 2) {
    if (nm <= 10) return { y: 2017 + Math.floor((nm - 1) / 4), tgt: (nm - 1) % 4 + 1 };
    if (nm === 11) return { y: 2019, tgt: 3 };
    return { y: 2020, tgt: nm - 11 };
  }
  return { y: 2013 + 4 * (ny - 1) + Math.floor((nm - 1) / 4), tgt: (nm - 1) % 4 + 1 };
};

/**
 * 对外暴露的核心 API 对象
 */
export const NC = {
  /**
   * 将给定的公历年月日 (gy, gm, gd) 转换为新历对象
   * Results are memoized — the NC date for any GC date is deterministic.
   */
  toNewCalendar: (gy: number, gm: number, gd: number) => {
    const dateKey = `${gy}-${gm}-${gd}`;
    const cached = _ncCache.get(dateKey);
    if (cached) return cached;

    const targetDate = new Date(Date.UTC(gy, gm - 1, gd));
    let result = { ny: 0, nm: 0, nd: 0, pNy: '00', pNm: '00', pNd: '00', color: '#333' };

    for (let y = gy - 1; y <= gy + 1; y++) {
      for (let tgt = 1; tgt <= 4; tgt++) {
        const cp = getGCheckPoint(y, tgt);
        const nextCp = (tgt === 4) ? getGCheckPoint(y + 1, 1) : getGCheckPoint(y, tgt + 1);

        if (targetDate >= cp && targetDate < nextCp) {
          let nd = Math.floor((targetDate.getTime() - cp.getTime()) / 86400000) + 1;
          let res = toTN(y, tgt);

          if (y === 2019 && tgt === 3) res = { ny: 2, nm: 11 };
          else if (y === 2019 && tgt === 4) {
            res = { ny: 2, nm: 11 };
            nd = nd + Math.round((cp.getTime() - getGCheckPoint(2019, 3).getTime())/86400000);
          }

          const pNy = res.ny.toString().padStart(2, '0');
          const pNm = res.nm.toString().padStart(2, '0');
          const pNd = nd.toString().padStart(2, '0');

          result = { ny: res.ny, nm: res.nm, nd: nd, pNy, pNm, pNd, color: ncMonthColour[pNm] };
        }
      }
    }
    _ncCache.set(dateKey, result);
    return result;
  },

  /**
   * 获取某一年/某个月的新历起始日期的 moment 对象 (需确保环境中存在 window.moment)
   */
  getNCMonthStart: (ny: number, nm: number) => {
    const { y, tgt } = toNT(ny, nm);
    return window.moment(getGCheckPoint(y, tgt)); 
  },

  /**
   * 计算某日期属于特定新历年月的第几周
   */
  getNCWeekOfMonth: (date: any, ny: number, nm: number) => {
    const monthStart = NC.getNCMonthStart(ny, nm);
    const firstWeekStart = monthStart.clone().startOf("week");
    const mDate = window.moment(date).startOf("day");
    const diffDays = mDate.diff(firstWeekStart, "days");
    return Math.floor(diffDays / 7) + 1;
  },

  /**
   * 格式化新历日期
   * 支持 Y: 年, M: 月, D: 日 (不足2位不补0)
   * 支持 YY, MM, DD (不足2位补0)
   * 支持 ww: 新历月周序 (补0), w: 不补0
   * 支持 PP: Phase (补0), P: 不补0
   * 支持 SS: Season (补0), S: 不补0
   * 支持 CY: 汉字年, CM: 汉字月
   * 支持 [text]: 原样保留文本
   */
  format: (date: any, pattern: string) => {
    const m = window.moment(date);
    if (!m.isValid()) return "";

    const nc = NC.toNewCalendar(m.year(), m.month() + 1, m.date());
    const weekNum = NC.getNCWeekOfMonth(m, nc.ny, nc.nm);
    const phase = NC.getPhase(nc.ny, nc.nm, nc.nd);
    const season = NC.getSeason(nc.ny, nc.nm);
    const pWw = weekNum.toString().padStart(2, "0");
    const pPp = phase.toString().padStart(2, "0");
    const pSs = season.toString().padStart(2, "0");

    let res = pattern;

    // 将括号内容替换为占位符，防止 token 匹配括号内的字符
    const bracketContents: string[] = [];
    res = res.replace(/\[(.*?)\]/g, (_m, content: string) => {
      bracketContents.push(content);
      return `\x00B${bracketContents.length - 1}\x00`;
    });

    // 注意替换顺序，先替换长的再替换短的
    res = res.replace("YY", nc.pNy);
    res = res.replace("Y", nc.ny.toString());
    res = res.replace("MM", nc.pNm);
    res = res.replace("M", nc.nm.toString());
    res = res.replace("DD", nc.pNd);
    res = res.replace("D", nc.nd.toString());
    res = res.replace("ww", pWw);
    res = res.replace("w", weekNum.toString());
    res = res.replace("PP", pPp);
    res = res.replace("P", phase.toString());
    res = res.replace("SS", pSs);
    res = res.replace("S", season.toString());
    res = res.replace("CY", nc.ny === 1 ? "元年" : numToChinese(nc.ny) + "年");
    res = res.replace("CM", numToChinese(nc.nm) + "月");

    // 恢复括号内容
    res = res.replace(/\x00B(\d+)\x00/g, (_m, i: string) => bracketContents[parseInt(i)]);

    return res;
  },

  /**
   * 获取新历某月的公历日期范围 [开始, 结束]
   */
  getMonthRange: (ny: number, nm: number) => {
    const start = NC.getNCMonthStart(ny, nm);
    let nextNy = ny;
    let nextNm = nm + 1;
    const maxMonths = (ny === 2) ? 15 : 16;
    if (nextNm > maxMonths) {
      nextNy++;
      nextNm = 1;
    }
    const end = NC.getNCMonthStart(nextNy, nextNm).clone().subtract(1, "day");
    return [start, end];
  },

  /**
   * 计算该月总周数
   */
  _getTotalWeeks: (ny: number, nm: number) => {
    const [start, end] = NC.getMonthRange(ny, nm);
    return NC.getNCWeekOfMonth(end, ny, nm);
  },

  /**
   * Phase 周数分配: Num(i) = floor(T/4) + (i <= T%4 ? 1 : 0)
   * Remainder weeks distributed to early phases, not the last.
   */
  _getPhaseSizes: (ny: number, nm: number) => {
    const T = NC._getTotalWeeks(ny, nm);
    const base = Math.floor(T / 4);
    const rem = T % 4;
    return [1,2,3,4].map(i => base + (i <= rem ? 1 : 0));
  },

  /**
   * 计算给定 NC 月中的 Phase (1-4)
   */
  getPhase: (ny: number, nm: number, nd: number): number => {
    const [start] = NC.getMonthRange(ny, nm);
    const day = start.clone().add(nd - 1, 'days');
    const weekNum = NC.getNCWeekOfMonth(day, ny, nm);
    const [s1, s2, s3] = NC._getPhaseSizes(ny, nm);
    if (weekNum <= s1) return 1;
    if (weekNum <= s1 + s2) return 2;
    if (weekNum <= s1 + s2 + s3) return 3;
    return 4;
  },

  /**
   * 计算给定 NC 月所属的 Season (1-4)
   * Year 2 (15个月): S1=1-4, S2=5-8, S3=9-11, S4=12-15
   */
  getSeason: (ny: number, nm: number): number => {
    if (ny === 2) {
      if (nm <= 4) return 1;
      if (nm <= 8) return 2;
      if (nm <= 11) return 3;
      return 4;
    }
    return Math.ceil(nm / 4);
  },

  /**
   * 获取某个 Phase 的 GC 日期范围 [start, end]
   */
  getPhaseRange: (ny: number, nm: number, phase: number) => {
    const [monthStart, monthEnd] = NC.getMonthRange(ny, nm);
    const monthDays = monthEnd.diff(monthStart, 'days') + 1;
    let startDay = monthDays + 1, endDay = 0;
    for (let d = 1; d <= monthDays; d++) {
      if (NC.getPhase(ny, nm, d) === phase) {
        if (d < startDay) startDay = d;
        if (d > endDay) endDay = d;
      }
    }
    if (startDay > monthDays) return [monthStart.clone(), monthStart.clone()];
    const start = monthStart.clone().add(startDay - 1, 'days');
    const end = monthStart.clone().add(endDay - 1, 'days');
    return [start, end];
  },

  /**
   * 获取一个 Season 包含的月份范围 [startMonth, endMonth]
   */
  getSeasonMonths: (ny: number, season: number): [number, number] => {
    const maxMonths = (ny === 2) ? 15 : 16;
    if (ny === 2) {
      if (season === 1) return [1, 4];
      if (season === 2) return [5, 8];
      if (season === 3) return [9, 11];
      return [12, 15];
    }
    const start = (season - 1) * 4 + 1;
    return [start, Math.min(start + 3, maxMonths)];
  },

  /**
   * 便捷方法：从 moment 对象获取完整 NC 信息 (含 phase/season)
   */
  getNCDate: (date: any) => {
    const m = window.moment(date);
    const nc = NC.toNewCalendar(m.year(), m.month() + 1, m.date());
    const phase = NC.getPhase(nc.ny, nc.nm, nc.nd);
    const season = NC.getSeason(nc.ny, nc.nm);
    return { ...nc, phase, season };
  },

  /**
   * 暴露汉字转换
   */
  numToChinese: (num: number) => numToChinese(num),

  /**
   * 智能格式化：根据文件名标题自动解析日期并格式化
   * @param title 文件标题 (通常是 tp.file.title)
   * @param pattern 格式字符串
   * @param type 历法类型: 'GC' (公历) 或 'NC' (新历)
   */
  smartFormat: (title: string, pattern: string, type: 'GC' | 'NC' = 'NC') => {
    // 1. 尝试解析标题中的 YYYY-MM-DD 日期
    let m = window.moment(title, "YYYY-MM-DD", true);
    // 2. 如果标题不是合法日期，则回退到当前时间
    if (!m.isValid()) {
      m = window.moment();
    }

    if (type === 'GC') {
      return m.format(pattern);
    } else {
      return NC.format(m, pattern);
    }
  },

  // ── NC date arithmetic & navigation ──────────────────────────

  /**
   * Add NC days to an NC date. Returns new {ny, nm, nd}.
   */
  addDays: (ny: number, nm: number, nd: number, days: number) => {
    const start = NC.getNCMonthStart(ny, nm);
    const gc = start.clone().add(nd - 1 + days, "days");
    return NC.toNewCalendar(gc.year(), gc.month() + 1, gc.date());
  },

  /**
   * Compare two NC dates. Returns -1 if a < b, 0 if equal, 1 if a > b.
   */
  compare: (a: {ny:number,nm:number,nd:number}, b: {ny:number,nm:number,nd:number}): number => {
    if (a.ny !== b.ny) return a.ny - b.ny;
    if (a.nm !== b.nm) return a.nm - b.nm;
    return a.nd - b.nd;
  },

  /**
   * Get today's NC date info.
   */
  today: () => NC.getNCDate(window.moment()),

  /**
   * Get yesterday's NC date info.
   */
  yesterday: () => NC.getNCDate(window.moment().subtract(1, "day")),

  /**
   * Get tomorrow's NC date info.
   */
  tomorrow: () => NC.getNCDate(window.moment().add(1, "day")),

  /**
   * Navigate to the next NC period of the given granularity.
   * Returns {ny, nm, nd, phase?, season?} for the start of the next period.
   */
  nextPeriod: (currentNC: {ny:number,nm:number,nd:number,phase:number,season:number}, granularity: string) => {
    const maxMonths = currentNC.ny === 2 ? 15 : 16;
    switch (granularity) {
      case "day": {
        const start = NC.getNCMonthStart(currentNC.ny, currentNC.nm);
        const gc = start.clone().add(currentNC.nd, "days"); // nd is 1-based, so this gives next day
        return NC.getNCDate(gc);
      }
      case "nc-phase": {
        let nextPhase = currentNC.phase + 1;
        let nextNy = currentNC.ny, nextNm = currentNC.nm;
        if (nextPhase > 4) {
          nextPhase = 1;
          nextNm++;
          if (nextNm > maxMonths) { nextNy++; nextNm = 1; }
        }
        const [start] = NC.getPhaseRange(nextNy, nextNm, nextPhase);
        return NC.getNCDate(start);
      }
      case "nc-month": {
        let nextNm = currentNC.nm + 1;
        let nextNy = currentNC.ny;
        if (nextNm > maxMonths) { nextNy++; nextNm = 1; }
        const start = NC.getNCMonthStart(nextNy, nextNm);
        return NC.getNCDate(start);
      }
      case "nc-season": {
        const season = NC.getSeason(currentNC.ny, currentNC.nm);
        let nextSeason = season + 1;
        let nextNy = currentNC.ny;
        if (nextSeason > 4) { nextNy++; nextSeason = 1; }
        const [startNm] = NC.getSeasonMonths(nextNy, nextSeason);
        const start = NC.getNCMonthStart(nextNy, startNm);
        return NC.getNCDate(start);
      }
      case "nc-year": {
        const start = NC.getNCMonthStart(currentNC.ny + 1, 1);
        return NC.getNCDate(start);
      }
      default: return currentNC;
    }
  },

  /**
   * Navigate to the previous NC period. Inverse of nextPeriod.
   */
  prevPeriod: (currentNC: {ny:number,nm:number,nd:number,phase:number,season:number}, granularity: string) => {
    const maxMonths = currentNC.ny === 2 ? 15 : 16;
    switch (granularity) {
      case "day": {
        const start = NC.getNCMonthStart(currentNC.ny, currentNC.nm);
        const gc = start.clone().add(currentNC.nd - 2, "days"); // nd is 1-based
        return NC.getNCDate(gc);
      }
      case "nc-phase": {
        let prevPhase = currentNC.phase - 1;
        let prevNy = currentNC.ny, prevNm = currentNC.nm;
        if (prevPhase < 1) {
          prevPhase = 4;
          prevNm--;
          if (prevNm < 1) { prevNy--; prevNm = prevNy === 2 ? 15 : 16; }
        }
        if (prevNy < 1) return currentNC;
        const [start] = NC.getPhaseRange(prevNy, prevNm, prevPhase);
        return NC.getNCDate(start);
      }
      case "nc-month": {
        let prevNm = currentNC.nm - 1;
        let prevNy = currentNC.ny;
        if (prevNm < 1) {
          prevNy--;
          if (prevNy < 1) return currentNC;
          prevNm = prevNy === 2 ? 15 : 16;
        }
        const start = NC.getNCMonthStart(prevNy, prevNm);
        return NC.getNCDate(start);
      }
      case "nc-season": {
        const season = NC.getSeason(currentNC.ny, currentNC.nm);
        let prevSeason = season - 1;
        let prevNy = currentNC.ny;
        if (prevSeason < 1) {
          prevNy--;
          if (prevNy < 1) return currentNC;
          prevSeason = 4;
        }
        const [startNm] = NC.getSeasonMonths(prevNy, prevSeason);
        const start = NC.getNCMonthStart(prevNy, startNm);
        return NC.getNCDate(start);
      }
      case "nc-year": {
        if (currentNC.ny <= 1) return currentNC;
        const start = NC.getNCMonthStart(currentNC.ny - 1, 1);
        return NC.getNCDate(start);
      }
      default: return currentNC;
    }
  },

  /**
   * Get the GC date range [start, end] for an NC period, suitable for Dataview WHERE clauses.
   * @returns [moment, moment] — GC start and end moments
   */
  getPeriodRange: (granularity: string, ny: number, nm: number, ndOrPhaseOrSeason?: number) => {
    switch (granularity) {
      case "day": {
        const start = NC.getNCMonthStart(ny, nm).clone().add((ndOrPhaseOrSeason || 1) - 1, "days");
        return [start.clone(), start.clone().endOf("day")];
      }
      case "nc-phase":
        return NC.getPhaseRange(ny, nm, ndOrPhaseOrSeason || 1);
      case "nc-month":
        return NC.getMonthRange(ny, nm);
      case "nc-season": {
        // Supports both calling patterns:
        //   (granularity, ny, season)          → season in nm
        //   (granularity, ny, placeholder, s)  → season in ndOrPhaseOrSeason
        const season = ndOrPhaseOrSeason || nm || 1;
        const [startNm, endNm] = NC.getSeasonMonths(ny, season);
        const start = NC.getNCMonthStart(ny, startNm);
        const maxMonths = ny === 2 ? 15 : 16;
        let nextNy = ny, nextNm = endNm + 1;
        if (nextNm > maxMonths) { nextNy++; nextNm = 1; }
        const end = NC.getNCMonthStart(nextNy, nextNm);
        return [start.clone(), end.clone().subtract(1, "day")];
      }
      case "nc-year": {
        const start = NC.getNCMonthStart(ny, 1);
        const maxMonths = ny === 2 ? 15 : 16;
        let endNy = ny, endNm = maxMonths + 1;
        if (endNm > maxMonths) { endNy++; endNm = 1; }
        const end = NC.getNCMonthStart(endNy, endNm);
        return [start.clone(), end.clone().subtract(1, "day")];
      }
      default:
        return [window.moment(), window.moment()];
    }
  },

  /**
   * Format an NC date {ny, nm, nd} as a canonical sortable string "YY-MM-DD".
   */
  toDateString: (nc: {ny:number, nm:number, nd:number}): string => {
    return `${nc.ny.toString().padStart(2,"0")}-${nc.nm.toString().padStart(2,"0")}-${nc.nd.toString().padStart(2,"0")}`;
  },

  /**
   * Get the approximate GC year for an NC period.
   *   approxGCYear(4)           → GC year of NC year 4 start
   *   approxGCYear(4, 6)        → GC year of NC month 6 start
   *   approxGCYear(4, 2, true)  → GC year of NC season 2 start
   */
  approxGCYear: (ny: number, nmOrSeason?: number, isSeason?: boolean): number => {
    let gc: any;
    if (nmOrSeason == null) {
      gc = NC.getNCMonthStart(ny, 1);
    } else if (isSeason) {
      const [startNm] = NC.getSeasonMonths(ny, nmOrSeason);
      gc = NC.getNCMonthStart(ny, startNm);
    } else {
      gc = NC.getNCMonthStart(ny, nmOrSeason);
    }
    return gc.year();
  },

  /**
   * Parse a canonical NC date string "YY-MM-DD" back into {ny, nm, nd}.
   */
  parseDateString: (str: string) => {
    const parts = str.split("-");
    if (parts.length !== 3) return null;
    const ny = parseInt(parts[0], 10);
    const nm = parseInt(parts[1], 10);
    const nd = parseInt(parts[2], 10);
    if (isNaN(ny) || isNaN(nm) || isNaN(nd)) return null;
    const phase = NC.getPhase(ny, nm, nd);
    const season = NC.getSeason(ny, nm);
    const color = ncMonthColour[nm.toString().padStart(2,"0")] || "#333";
    return { ny, nm, nd, pNy: parts[0], pNm: parts[1], pNd: parts[2], phase, season, color };
  },
};
