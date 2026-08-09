<script lang="ts">
  import type { Moment } from "moment";
  import { NC, toChineseYearMonth, numToChinese, ncMonthColour } from "../utils/nc-engine";
  import type { ICalendarSource, IDayMetadata } from "obsidian-calendar-ui";
  import { createEventDispatcher, tick, onMount, afterUpdate } from "svelte";

  import type { App } from "obsidian";
  import { get } from "svelte/store";
  import { dailyNotes, holidays } from "./stores";
  import { getDateUID } from "../io/utils";

  const dispatch = createEventDispatcher();

  export let app: App;
  export let mode: "GC" | "NC" = "GC";
  export let displayedMonth: Moment; 
  export let today: Moment;
  
  $: dispatch("displayedMonthChange", displayedMonth);
  export let sources: ICalendarSource[] = [];
  export let selectedId: string | null = null;
  export let showWeekNums: boolean = false;
  export let metadataUpdateTrigger: number = 0;

  export let onClickDay: (date: Moment, isMetaPressed: boolean) => void;
  export let onClickWeek: (date: Moment, isMetaPressed: boolean) => void;
  export let onHoverDay: (date: Moment, targetEl: EventTarget) => void;
  export let onHoverWeek: (date: Moment, targetEl: EventTarget) => void;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => void;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => void;
  export let onClickNCMonth: ((ny: number, nm: number) => void) | null = null;
  export let onClickNCPhase: ((ny: number, nm: number, phase: number) => void) | null = null;
  export let onClickNCSeason: ((ny: number, season: number) => void) | null = null;

  let days: {
    date: Moment;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    metadata: IDayMetadata & { info?: string; holidayName?: string };
    nc: any;
    dayType: string;
  }[][] = [];

  let ncInfo: { ny: number; nm: number; color: string; phase: number; season: number; gcStart: string; gcEnd: string } | null = null;

  $: if (mode === "NC" && displayedMonth) {
    const info = NC.getNCDate(displayedMonth);
    const range = NC.getMonthRange(info.ny, info.nm);
    ncInfo = {
      ny: info.ny, nm: info.nm, color: info.color, phase: info.phase, season: info.season,
      gcStart: range[0].format("YYYY-MM-DD"),
      gcEnd: range[1].format("YYYY-MM-DD"),
    };
  } else {
    ncInfo = null;
  }

  $: title = (mode === "GC" && displayedMonth)
    ? displayedMonth.format("MMMM YYYY")
    : (ncInfo ? toChineseYearMonth(ncInfo.ny, ncInfo.nm) : "");

  const monthIndices = Array.from({ length: 16 }, (_, i) => (i + 1).toString().padStart(2, "0"));

  let hasScrolledToToday = false;

  $: if (displayedMonth && today) {
    updateGrid(displayedMonth, mode, sources, today);
  }

  onMount(() => {
    if (displayedMonth && today) {
      updateGrid(displayedMonth, mode, sources, today);
    }
  });

  afterUpdate(async () => {
    if (!hasScrolledToToday && days.length > 0) {
      await tick();
      // Use querySelector restricted to the component's container if possible, 
      // but is-today is a safe unique marker for now.
      const container = document.querySelector(".calendar-container");
      const todayEl = container?.querySelector(".is-today");
      if (todayEl) {
        todayEl.scrollIntoView({ block: "center", behavior: "auto" });
        hasScrolledToToday = true;
      }
    }
  });

  async function updateGrid(display: Moment, m: "GC" | "NC", srcs: ICalendarSource[], td: Moment) {
    if (!display || !td) return;
    const newDays: any[][] = [];
    let start: Moment;
    let end: Moment;

    if (m === "GC") {
      start = display.clone().startOf("month").startOf("week");
      end = display.clone().endOf("month").endOf("week");
    } else {
      const info = NC.toNewCalendar(display.year(), display.month() + 1, display.date());
      const monthStart = NC.getNCMonthStart(info.ny, info.nm);
      
      let nextNy = info.ny;
      let nextNm = info.nm + 1;
      const maxMonths = (info.ny === 2) ? 15 : 16;
      if (nextNm > maxMonths) {
        nextNy++;
        nextNm = 1;
      }
      const nextMonthStart = NC.getNCMonthStart(nextNy, nextNm);
      
      start = monthStart.clone().startOf("week");
      end = nextMonthStart.clone().subtract(1, "day").endOf("week");
    }

    let curr = start.clone();
    let prevPhase = -1;
    const allNotes = get(dailyNotes);
    const holidayData = get(holidays);
    // Collect dot-metadata promises during the first pass to avoid a second loop
    const dotPromises: Promise<void>[] = [];

    while (curr.isBefore(end) || curr.isSame(end, "day")) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const date = curr.clone();
        const dateStr = date.format("YYYY-MM-DD");
        const nc = NC.toNewCalendar(date.year(), date.month() + 1, date.date());
        const ncPhaseVal = NC.getPhase(nc.ny, nc.nm, nc.nd);
        const isPhaseStart = ncPhaseVal !== prevPhase;
        prevPhase = ncPhaseVal;
        
        let isCurrentMonth = false;
        if (m === "GC") {
          isCurrentMonth = date.isSame(display, "month");
        } else {
          isCurrentMonth = ncInfo && nc.ny === ncInfo.ny && nc.nm === ncInfo.nm;
        }

        // Fetch calendar-info from frontmatter
        let infoText = "";
        const note = allNotes[getDateUID(date, "day")] ?? null;
        if (note) {
          const cache = app.metadataCache.getFileCache(note);
          if (cache?.frontmatter && cache.frontmatter["calendar-info"]) {
            infoText = cache.frontmatter["calendar-info"];
          }
        }

        // Determine holiday status
        let dayType = "workday";
        let holidayName = "";
        const holidayEntry = holidayData[dateStr];
        if (holidayEntry) {
          dayType = holidayEntry.type;
          holidayName = holidayEntry.name;
        } else {
          const dow = date.isoWeekday(); // 1-7 (Mon-Sun)
          if (dow >= 6) {
            dayType = "public_holiday"; // Default weekend
          }
        }

        const dayObj = {
          date,
          isCurrentMonth,
          isToday: date.isSame(td, "day"),
          nc,
          dayType,
          isPhaseStart,
          ncPhaseVal,
          metadata: { dots: [], info: infoText, holidayName }
        };
        week.push(dayObj);

        // Kick off dot-metadata fetch now (will await all at once below)
        dotPromises.push(
          Promise.all(srcs.map(s => s.getDailyMetadata(date)))
            .then(metaResults => { dayObj.metadata.dots = metaResults.flatMap(m => m.dots || []); })
        );

        curr.add(1, "day");
      }
      week.phase = m === "NC" ? NC.getPhase(week[0].nc.ny, week[0].nc.nm, week[0].nc.nd) : 0;
      newDays.push(week);
    }
    days = newDays;

    // Await all dot-metadata fetches kicked off during the first pass
    await Promise.all(dotPromises);
    // Force Svelte to detect the dot updates
    days = days.map(week =>
      week.map(day => ({
        ...day,
        metadata: { ...day.metadata },
      }))
    );
  }

  function getSecondaryText(day: any, prevDay: any | null, mode: "GC" | "NC") {
    if (mode === "GC") {
      const nc = day.nc;
      if (!prevDay) return `${nc.pNm}-${nc.pNd}`;
      const prevNc = prevDay.nc;
      if (nc.ny !== prevNc.ny) return `${nc.pNy}-${nc.pNm}-${nc.pNd}`;
      if (nc.nm !== prevNc.nm) return `${nc.pNm}-${nc.pNd}`;
      return nc.pNd;
    } else {
      const date = day.date;
      if (!prevDay) return `${date.month() + 1}-${date.date()}`;
      const prevDate = prevDay.date;
      if (date.year() !== prevDate.year()) return `${date.year()}-${date.month() + 1}-${date.date()}`;
      if (date.month() !== prevDate.month()) return `${date.month() + 1}-${date.date()}`;
      return `${date.date()}`;
    }
  }

  function prevMonth() {
    if (mode === "GC") {
      displayedMonth = displayedMonth.clone().subtract(1, "month");
    } else {
      let ny = ncInfo.ny;
      let nm = ncInfo.nm - 1;
      if (nm < 1) {
        ny--;
        nm = (ny === 2) ? 15 : 16;
      }
      if (ny < 1) return;
      displayedMonth = NC.getNCMonthStart(ny, nm);
    }
  }

  function nextMonth() {
    if (mode === "GC") {
      displayedMonth = displayedMonth.clone().add(1, "month");
    } else {
      let ny = ncInfo.ny;
      let nm = ncInfo.nm + 1;
      const maxMonths = (ny === 2) ? 15 : 16;
      if (nm > maxMonths) {
        ny++;
        nm = 1;
      }
      displayedMonth = NC.getNCMonthStart(ny, nm);
    }
  }

  function goToday() {
    displayedMonth = today.clone();
  }

  function prevYear() {
    if (mode === "GC") {
      displayedMonth = displayedMonth.clone().subtract(1, "year");
    } else if (ncInfo) {
      const ny = ncInfo.ny - 1;
      if (ny < 1) return;
      displayedMonth = NC.getNCMonthStart(ny, ncInfo.nm);
    }
  }
  function nextYear() {
    if (mode === "GC") {
      displayedMonth = displayedMonth.clone().add(1, "year");
    } else if (ncInfo) {
      const ny = ncInfo.ny + 1;
      displayedMonth = NC.getNCMonthStart(ny, ncInfo.nm);
    }
  }
  function prevSeason() {
    if (!ncInfo) return;
    const s = ncInfo.season - 1;
    if (s < 1) {
      const ny = ncInfo.ny - 1;
      if (ny < 1) return;
      const maxMonths = (ny === 2) ? 15 : 16;
      displayedMonth = NC.getNCMonthStart(ny, maxMonths);
    } else {
      const [startNm] = NC.getSeasonMonths(ncInfo.ny, s);
      displayedMonth = NC.getNCMonthStart(ncInfo.ny, startNm);
    }
  }
  function nextSeason() {
    if (!ncInfo) return;
    const s = ncInfo.season + 1;
    if (s > 4) {
      const ny = ncInfo.ny + 1;
      displayedMonth = NC.getNCMonthStart(ny, 1);
    } else {
      const [startNm] = NC.getSeasonMonths(ncInfo.ny, s);
      displayedMonth = NC.getNCMonthStart(ncInfo.ny, startNm);
    }
  }

  $: seasonLabel = ncInfo ? `S${ncInfo.season}` : "";

  $: weekDays = Array.from({ length: 7 }, (_, i) => 
    today.clone().startOf("week").add(i, "days").format("ddd")
  );
</script>

<div class="calendar-container">
  <div class="calendar-top-bar">
  <!-- Row 1: Title centered -->
  <div class="calendar-title-row">
    {#if mode === "GC"}
      <span class="gc-title-text">{title}</span>
    {:else if ncInfo}
      <span class="nc-year-text" on:click={() => onClickNCMonth?.(ncInfo.ny, 1)} title="Open NC Year note">
        {ncInfo.ny === 1 ? "元年" : `${numToChinese(ncInfo.ny)}年`}
      </span>
      <span class="nc-sep">&middot;</span>
      <span class="nc-season-text" style="color: {ncInfo.color}" on:click={() => onClickNCSeason?.(ncInfo.ny, ncInfo.season)} title="Open NC Season note">
        第{numToChinese(ncInfo.season)}季
      </span>
      <span class="nc-sep">&middot;</span>
      <span class="nc-month-text" style="color: {ncInfo.color}" on:click={() => onClickNCMonth?.(ncInfo.ny, ncInfo.nm)} title="Open NC Month note">
        {numToChinese(ncInfo.nm)}月
      </span>
    {/if}
  </div>

  <!-- Row 1.5: GC date range for current NC month -->
  {#if mode === "NC" && ncInfo}
    <div class="calendar-gc-range">
      {ncInfo.gcStart || ""} – {ncInfo.gcEnd || ""}
    </div>
  {/if}

  <!-- Row 2: Nav with dots in middle -->
  <div class="calendar-header">
    <div class="calendar-nav">
      <button class="nav-btn nav-btn-year" on:click={prevYear} title="Previous year">{mode === "NC" ? "年-" : "Y-"}</button>
      {#if mode === "NC" && ncInfo}
        <button class="nav-btn" on:click={prevSeason} title="Previous season">季-</button>
      {/if}
      <button class="nav-btn" on:click={prevMonth}>{mode === "NC" ? "月-" : "M-"}</button>
    </div>

    {#if mode === "NC" && ncInfo}
      <span class="month-matrix">
        {#each monthIndices as mIdx}<span class="month-dot" class:active={ncInfo.nm === parseInt(mIdx)} style="--dot-color: {ncMonthColour[mIdx]};" title="{parseInt(mIdx)}月"></span>{/each}
      </span>
    {/if}

    <div class="calendar-nav">
      <button class="nav-btn" on:click={nextMonth}>{mode === "NC" ? "月+" : "M+"}</button>
      {#if mode === "NC" && ncInfo}
        <button class="nav-btn" on:click={nextSeason} title="Next season">季+</button>
      {/if}
      <button class="nav-btn nav-btn-year" on:click={nextYear} title="Next year">{mode === "NC" ? "年+" : "Y+"}</button>
    </div>
  </div>

  <!-- Row 3: Phase buttons + Today -->
  <div class="calendar-subheader">
    {#if mode === "NC" && ncInfo}
      <div class="nc-phase-buttons">
        {#each [1, 2, 3, 4] as phase}
          <button class="nc-phase-btn" class:active={ncInfo.phase === phase} style={ncInfo.phase === phase ? "background-color:" + ncInfo.color : ""} on:click={() => onClickNCPhase?.(ncInfo.ny, ncInfo.nm, phase)} title={"Open Phase " + phase + " note"}>P{phase}</button>
        {/each}
      </div>
    {/if}
    <button class="nav-btn nav-btn-today" on:click={goToday}>Today</button>
  </div>
  <table class="calendar-grid calendar-grid-head">
    <thead>
      <tr>
        {#if showWeekNums}
          <th class="week-num-header"></th>
        {/if}
        {#each weekDays as day}
          <th>{day}</th>
        {/each}
      </tr>
    </thead>
  </table>
  </div>
  <table class="calendar-grid calendar-grid-body">
    <tbody>
      {#each days as week, i}
        <tr class:phase-start={i > 0 && mode === "NC" && week.phase !== days[i-1].phase}>
          {#if showWeekNums}
            <td 
              class="week-num" 
              class:is-selected={selectedId === getDateUID(week[0].date, "week")}
              on:click={() => onClickWeek(week[0].date, false)}
            >
              {#if mode === "NC" && ncInfo}
                <div class="week-num-stack">
                  <div class="nc-week" style="color: {ncInfo.color}">
                    {NC.getNCWeekOfMonth(week[0].date, ncInfo.ny, ncInfo.nm)}
                  </div>
                  <div class="gc-week">
                    {week[0].date.format("ww")}
                  </div>
                </div>
              {:else}
                {week[0].date.format("ww")}
              {/if}
            </td>
          {/if}
          {#each week as day, j}
            <td
              class:is-today={day.isToday}
              class:is-selected={selectedId === getDateUID(day.date, "day")}
              class:not-current-month={!day.isCurrentMonth}
              class:is-holiday={day.dayType === 'public_holiday'}
              class:is-transfer-workday={day.dayType === 'transfer_workday'}
              on:click={(e) => onClickDay(day.date, e.metaKey || e.ctrlKey)}
              on:mouseenter={(e) => onHoverDay(day.date, e.target)}
              on:contextmenu={(e) => onContextMenuDay(day.date, e)}
            >
              <div class="day-content">
                <div class="primary-date" style="color: {mode === 'NC' ? day.nc.color : 'inherit'}">
                  {mode === "GC" ? day.date.date() : day.nc.pNd}
                </div>
                <div class="secondary-date" style="color: {mode === 'GC' ? day.nc.color : 'inherit'}">
                  {getSecondaryText(day, (j > 0 ? week[j-1] : (i > 0 ? days[i-1][6] : null)), mode)}
                </div>
                {#if day.metadata.holidayName}
                  <div class="holiday-name">{day.metadata.holidayName}</div>
                {/if}
                {#if mode === "NC" && day.isPhaseStart && day.isCurrentMonth}
                  <div class="nc-phase-chip" style="background: {day.nc.color}; color: #fff;">P{day.ncPhaseVal}</div>
                {/if}
                <div class="dots">
                  {#each day.metadata.dots as dot}
                    <span 
                      class="dot {dot.className || ''}" 
                      class:hollow={!dot.isFilled}
                      style="--dot-color: {dot.color === 'default' ? 'var(--text-muted)' : dot.color};"
                    ></span>
                  {/each}
                </div>
                {#if day.metadata.info}
                  <div class="day-info">{day.metadata.info}</div>
                {/if}
              </div>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .calendar-container {
    padding: 10px;
    user-select: none;
    background-color: var(--background-primary);
    color: var(--text-normal);
  }
  .calendar-top-bar {
    position: sticky;
    top: 0;
    background-color: var(--background-primary);
    z-index: 10;
    padding-bottom: 4px;
  }
  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 6px;
    padding-top: 2px;
    padding-bottom: 4px;
  }
  .month-matrix {
    display: grid;
    grid-template-rows: repeat(2, 1fr);
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }
  .calendar-title-row {
    text-align: center;
    margin-bottom: 4px;
    font-weight: bold;
    font-size: 1.1em; color: var(--text-accent);
    white-space: nowrap; min-width: 22em;
    display: flex;
    align-items: center;
    gap: 6px; justify-content: center;
    flex: 1;
  }
  .nc-month-text {
    white-space: nowrap;
  }
  .calendar-gc-range {
    text-align: center;
    font-size: 0.75em;
    color: var(--text-faint);
    margin-bottom: 4px;
  }
  .month-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--dot-color);
    opacity: 0.25;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .month-dot.active {
    opacity: 1;
    transform: scale(1.4);
    box-shadow: 0 0 5px var(--dot-color);
  }
  .nav-btn {
    cursor: pointer;
    background: none;
    border: 1px solid var(--background-modifier-border);
    padding: 2px 8px;
    
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 0.9em;
  }
  .nav-btn:hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-normal);
  }

       .nav-btn-year {
         font-weight: bold;
         font-size: 0.9em;
       }
       .nav-btn-today {
         margin-left: 6px;
         font-size: 0.8em;
       }
       .gc-title-text {
         color: var(--text-accent);
       }
       .nc-year-text {
         cursor: pointer;
         color: var(--text-normal);
         transition: opacity 0.15s;
       }
       .nc-year-text:hover { opacity: 0.7; }
       .nc-season-text {
         cursor: pointer;
         font-weight: bold;
         transition: opacity 0.15s;
       }
       .nc-season-text:hover { opacity: 0.7; }
       .nc-month-text {
         cursor: pointer;
         font-weight: bold;
         white-space: nowrap;
         transition: opacity 0.15s;
       }
       .nc-month-text:hover { opacity: 0.7; }
       .nc-sep {
         color: var(--text-faint);
         font-weight: normal;
       }

       .nc-phase-buttons {
         display: flex;
         justify-content: center;
         gap: 6px;
         margin: 4px 0 8px 0;
       }

       .calendar-subheader {
         display: flex;
         align-items: center;
         justify-content: center;
         gap: 12px;
         margin-bottom: 8px;
       }
       .calendar-nav {
         display: flex;
         align-items: center;
         gap: 2px;
         flex-shrink: 0;
       }
  .calendar-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .calendar-grid th {
    font-size: 0.75em;
    color: var(--text-faint);
    text-transform: uppercase;
    font-weight: normal;
    padding-bottom: 8px;
    width: 13.1%;
  }
  .calendar-grid-head {
    margin-bottom: 0;
  }
  .calendar-grid-body {
    margin-top: 0;
  }
  .week-num-header {
    width: 8% !important;
  }
  .week-num {
    font-size: 0.7em;
    color: var(--text-faint);
    vertical-align: middle !important;
  }
  .week-num-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.2;
  }
  .nc-week {
    font-size: 1.3em;
    font-weight: bold;
  }
  .gc-week {
    font-size: 0.85em;
    color: var(--text-faint);
  }
  .calendar-grid td {
    cursor: pointer;
    vertical-align: top;
    height: 92px; /* Increased to accommodate 5 layers with wrapping */
    border: 1px solid transparent;
    transition: background-color 0.1s;
    overflow: hidden;
  }
  .calendar-grid td:hover {
    background-color: var(--background-modifier-hover);
    border-radius: 4px;
  }
  .day-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start; /* Align content to top */
    height: 100%;
    padding: 4px 2px;
  }
  .primary-date {
    font-size: 1em;
    line-height: 1.2;
  }
  .secondary-date {
    font-size: 0.7em;
    line-height: 1.2;
    margin-top: 1px;
    white-space: nowrap;
  }
  .not-current-month {
    opacity: 0.3;
  }
  .is-holiday {
    background-color: rgba(255, 0, 0, 0.05);
  }
  .is-transfer-workday {
    background-color: rgba(var(--text-muted-rgb), 0.1);
  }
  tr.phase-start td {
    border-top: 1px solid var(--text-accent) !important;
  }
  .is-today {
    box-shadow: inset 0 0 0 2px var(--text-accent) !important;
    border-radius: 4px;
    z-index: 1;
    position: relative;
  }
  .is-today .primary-date {
    color: var(--text-accent);
    font-weight: bold;
  }
  .is-selected {
    box-shadow: inset 0 0 0 1px var(--text-accent) !important;
    border-radius: 4px;
    position: relative;
    z-index: 0;
  }
  .holiday-name {
    font-size: 0.65em;
    line-height: 1.1;
    color: var(--text-accent);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
    font-weight: 500;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 2px;
    margin-top: 2px;
    min-height: 6px;
  }
  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--dot-color);
    border: 1px solid var(--dot-color);
  }
  .dot.hollow {
    background-color: transparent !important;
  }
  .dot.overflow-dot {
    width: 6px;
    height: 6px;
    border-radius: 1px;
    background-color: var(--text-accent);
    border-color: var(--text-accent);
    transform: rotate(45deg);
  }
  .day-info {
    font-size: 0.65em;
    line-height: 1.1;
    margin-top: 2px;
    color: var(--text-muted);
    text-align: center;
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .nc-phase-chip {
    font-size: 0.55em;
    line-height: 1;
    padding: 1px 3px;
    border-radius: 3px;
    font-weight: 600;
    margin-top: 1px;
    opacity: 0.7;
    text-align: center;
  }
</style>
