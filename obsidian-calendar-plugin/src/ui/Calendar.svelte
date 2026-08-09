<svelte:options immutable />

<script lang="ts">
  import type { Moment } from "moment";
  import { onDestroy } from "svelte";

  import type { ISettings } from "src/settings";
  import { activeFile, dailyNotes, settings, weeklyNotes } from "./stores";
  import CalendarGrid from "./CalendarGrid.svelte";
  import { configureGlobalMomentLocale } from "obsidian-calendar-ui";

  import type { App } from "obsidian";

  let today: Moment = window.moment();

  $: today = getToday($settings);

  export let app: App;
  export let displayedMonth: Moment = window.moment();
  export let sources: any[];
  export let onHoverDay: (date: Moment, targetEl: EventTarget) => void;
  export let onHoverWeek: (date: Moment, targetEl: EventTarget) => void;
  export let onClickDay: (date: Moment, isMetaPressed: boolean) => void;
  export let onClickWeek: (date: Moment, isMetaPressed: boolean) => void;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => void;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => void;

  let metadataUpdateTrigger = 0;

  export function tick() {
    today = window.moment();
    metadataUpdateTrigger += 1;
  }

  function getToday(settings: ISettings) {
    configureGlobalMomentLocale(settings.localeOverride, settings.weekStart);
    dailyNotes.reindex();
    weeklyNotes.reindex();
    return window.moment();
  }

  // 1 minute heartbeat to keep `today` reflecting the current day
  let heartbeat = setInterval(() => {
    tick();

    const isViewingCurrentMonth = displayedMonth.isSame(today, "day");
    if (isViewingCurrentMonth) {
      displayedMonth = today;
    }
  }, 1000 * 60);

  onDestroy(() => {
    clearInterval(heartbeat);
  });
</script>

<CalendarGrid
  mode="GC"
  {app}
  {sources}
  {today}
  {onHoverDay}
  {onHoverWeek}
  {onContextMenuDay}
  {onContextMenuWeek}
  {onClickDay}
  {onClickWeek}
  {metadataUpdateTrigger}
  bind:displayedMonth
  selectedId={$activeFile}
  showWeekNums={$settings.showWeeklyNote}
/>
