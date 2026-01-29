<script lang="ts">
  import { t, type Lang } from "$lib/logic/i18n";

  export type Kpi = {
    label: string;
    value: string | number;
    status: boolean;
    showDot: boolean;
  };
  export let kpis: Kpi[] = [];
  export let lang: Lang = "fr";
</script>

<div class="info-bar" aria-label={t(lang, "summaryLabel")}>
  {#each kpis as kpi}
    <div class="info-chip">
      <div class="info-top">
        <span class="info-label">{kpi.label}</span>
        {#if kpi.showDot}
          <span
            class={`info-dot ${kpi.status ? "is-on" : "is-off"}`}
            aria-hidden="true"
          ></span>
        {/if}
      </div>
      <span class="info-value">{kpi.value}</span>
    </div>
  {/each}
</div>
