<script lang="ts">
  import type { Moment } from "moment";
  import { NC, toChineseYearMonth, numToChinese, ncMonthColour } from "../utils/nc-engine";
  import type { ICalendarSource, IDayMetadata } from "obsidian-calendar-ui";
  import { createEventDispatcher, tick, onMount, afterUpdate } from "svelte";

  import type { App } from "obsidian";
  import { getDailyNote, getDateUID } from "obsidian-daily-notes-interface";
  import { get } from "svelte/store";
  import { dailyNotes, holidays } from "./stores";

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

  let days: {
    date: Moment;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    metadata: IDayMetadata & { info?: string; holidayName?: string };
    nc: any;
    dayType: string;
  }[][] = [];

  let ncInfo: { ny: number; nm: number; color: string } | null = null;

  $: if (mode === "NC") {
    const info = NC.toNewCalendar(displayedMonth.year(), displayedMonth.month() + 1, displayedMonth.date());
    ncInfo = { ny: info.ny, nm: info.nm, color: info.color };
  } else {
    ncInfo = null;
  }

  $: title = (mode === "GC" && displayedMonth)
    ? displayedMonth.format("MMMM YYYY")
    : (ncInfo ? toChineseYearMonth(ncInfo.ny, ncInfo.nm) : "");

  const monthIndices = Array.from({ length: 16 }, (_, i) => (i + 1).toString().padStart(2, "0"));

  let hasScrolledToToday = false;

  $: if (displayedMonth && today && (metadataUpdateTrigger || true)) {
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
    const allNotes = get(dailyNotes);
    const holidayData = get(holidays);
    
    while (curr.isBefore(end) || curr.isSame(end, "day")) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const date = curr.clone();
        const dateStr = date.format("YYYY-MM-DD");
        const nc = NC.toNewCalendar(date.year(), date.month() + 1, date.date());
        
        let isCurrentMonth = false;
        if (m === "GC") {
          isCurrentMonth = date.isSame(display, "month");
        } else {
          isCurrentMonth = ncInfo && nc.ny === ncInfo.ny && nc.nm === ncInfo.nm;
        }

        // Fetch calendar-info from frontmatter
        let infoText = "";
        const note = getDailyNote(date, allNotes);
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

        week.push({
          date,
          isCurrentMonth,
          isToday: date.isSame(td, "day"),
          nc,
          dayType,
          metadata: { dots: [], info: infoText, holidayName }
        });
        curr.add(1, "day");
      }
      newDays.push(week);
    }
    days = newDays;

    // Fetch other metadata
    for (const week of days) {
      for (const day of week) {
        const metaResults = await Promise.all(srcs.map(s => s.getDailyMetadata(day.date)));
        day.metadata.dots = metaResults.flatMap(m => m.dots || []);
      }
    }
    days = [...days];
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

  $: weekDays = Array.from({ length: 7 }, (_, i) => 
    today.clone().startOf("week").add(i, "days").format("ddd")
  );
</script>

<div class="calendar-container">
  <div class="calendar-header">
    <div class="calendar-title">
      {#if mode === "GC"}
        {title}
      {:else if ncInfo}
        <div class="nc-title-text">
          新历{ncInfo.ny === 1 ? "元年" : `${numToChinese(ncInfo.ny)}年`}
          <span style="color: {ncInfo.color}">{numToChinese(ncInfo.nm)}月</span>
        </div>
        
        <div class="month-matrix">
          {#each monthIndices as mIdx}
            <div 
              class="month-dot" 
              class:active={ncInfo.nm === parseInt(mIdx)}
              style="--dot-color: {ncMonthColour[mIdx]};"
              title="{parseInt(mIdx)}月"
            ></div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="calendar-nav">
      <button class="nav-btn" on:click={prevMonth}>&lt;</button>
      <button class="nav-btn" on:click={goToday}>Today</button>
      <button class="nav-btn" on:click={nextMonth}>&gt;</button>
    </div>
  </div>

  <table class="calendar-grid">
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
    <tbody>
      {#each days as week, i}
        <tr>
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
  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    position: sticky;
    top: 0;
    background-color: var(--background-primary);
    z-index: 10;
    padding-top: 5px;
    padding-bottom: 10px;
  }
  .calendar-title {
    font-weight: bold;
    font-size: 1.1em;
    color: var(--text-accent);
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .nc-title-text {
    white-space: nowrap;
  }
  .month-matrix {
    display: grid;
    grid-template-rows: repeat(2, 1fr);
    grid-template-columns: repeat(8, 1fr);
    gap: 3px;
    margin-left: 8px;
  }
  .month-dot {
    width: 5px;
    height: 5px;
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
    padding: 2px 10px;
    margin-left: 4px;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 0.9em;
  }
  .nav-btn:hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-normal);
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
    width: 13.1%; /* Adjusted for wider week column */
    position: sticky;
    top: 52px; /* Adjusted to sit below .calendar-header */
    background-color: var(--background-primary);
    z-index: 9;
  }
  .week-num-header {
    width: 8% !important;
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
  .is-selected {
    box-shadow: inset 0 0 0 1px var(--text-accent) !important;
    border-radius: 4px;
    position: relative;
    z-index: 0;
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
    -webkit-line-clamp: 2; /* Allow up to 2 lines for info */
    -webkit-box-orient: vertical;
    overflow: hidden;
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
    color: var(--text-faint); /* Still using faint for secondary but not explicitly grayed out beyond that */
  }
</style>
