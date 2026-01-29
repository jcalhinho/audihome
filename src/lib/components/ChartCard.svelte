<script lang="ts">
  import { t, type Lang } from "$lib/logic/i18n";

  export let simSpeed: number;
  export let chartEl: HTMLDivElement | null = null;
  export let lang: Lang = "fr";
</script>

<div class="chart-shell">
  <div class="chart-header">
    <p class="eyebrow">{t(lang, "liveDb")}</p>
  </div>
  <div class="control">
    <label for="sim">{t(lang, "simulationSpeed")} ({simSpeed} ms)</label>
    <input
      id="sim"
      type="range"
      min="100"
      max="500"
      step="5"
      bind:value={simSpeed}
    />
  </div>
  <div bind:this={chartEl} class="echart"></div>
</div>
