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
 * 获取公历对应的“检查点” (用于切分新历月份)
 */
const getGCheckPoint = (y: number, tgt: number): Date => {
  const key = `${y}-${tgt}`;
  if (OVERRIDES[key]) return new Date(OVERRIDES[key] + 'T00:00:00Z');
  
  let m = (tgt - 1) * 6 + (y >= 2020 ? 3 : 6);
  let useSunday = (y >= 2020);
  
  if (y === 2019) {
    if (tgt === 3) { m = 21; useSunday = true; }
    else if (tgt === 4) { m = 0; }
  }
  
  let d = getSolarTermDate(y, m % 24);
  if (useSunday) d = getNearestSunday(d);
  return d;
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
   */
  toNewCalendar: (gy: number, gm: number, gd: number) => {
    const targetDate = new Date(Date.UTC(gy, gm - 1, gd));
    
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
          
          return { ny: res.ny, nm: res.nm, nd: nd, pNy, pNm, pNd, color: ncMonthColour[pNm] };
        }
      }
    }
    return { ny: 0, nm: 0, nd: 0, pNy: '00', pNm: '00', pNd: '00', color: '#333' };
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
   * 支持 CY: 汉字年, CM: 汉字月
   * 支持 [text]: 原样保留文本
   */
  format: (date: any, pattern: string) => {
    const m = window.moment(date);
    if (!m.isValid()) return "";

    const nc = NC.toNewCalendar(m.year(), m.month() + 1, m.date());
    const weekNum = NC.getNCWeekOfMonth(m, nc.ny, nc.nm);
    const pWw = weekNum.toString().padStart(2, "0");

    let res = pattern;

    // 处理转义 [text] -> text (支持多组)
    res = res.replace(/\[(.*?)\]/g, "$1");

    // 注意替换顺序，先替换长的 YY 再替换 Y
    res = res.replace("YY", nc.pNy);
    res = res.replace("Y", nc.ny.toString());
    res = res.replace("MM", nc.pNm);
    res = res.replace("M", nc.nm.toString());
    res = res.replace("DD", nc.pNd);
    res = res.replace("D", nc.nd.toString());
    res = res.replace("ww", pWw);
    res = res.replace("w", weekNum.toString());
    res = res.replace("CY", nc.ny === 1 ? "元年" : numToChinese(nc.ny) + "年");
    res = res.replace("CM", numToChinese(nc.nm) + "月");
    
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
  }
};
