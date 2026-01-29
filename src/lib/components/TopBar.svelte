<script lang="ts">
  import { t, type Lang } from "$lib/logic/i18n";

  export let title = "AudiHome";
  export let iconSrc = "/favicon.webp";
  export let langLabel = "FR/EN";
  export let lang: Lang = "fr";
  export let onToggleLang: () => void;
</script>

<header class="topbar" aria-label={t(lang, "headerLabel")}>
  <div class="topbar-inner">
    <span class="brand">
      <img class="brand-icon" src={iconSrc} alt="" aria-hidden="true" />
      {title}
    </span>
    <button
      class="btn ghost small"
      type="button"
      aria-label={t(lang, "langAria")}
      on:click={onToggleLang}
    >
      {langLabel}
    </button>
  </div>
</header>
