<script lang="ts">
  import { t, type Lang } from "$lib/logic/i18n";

  type Zone = { id: string; name: string; img: string; selected: boolean };
  type AttenuationOption = { label: string; value: number };

  export let volume: number;
  export let zones: Zone[] = [];
  export let attenuationDb: Record<string, number> = {};
  export let attenuationOptions: AttenuationOption[] = [];
  export let openAttenuationId: string | null = null;
  export let zoneVolume: Record<string, number> = {};
  export let toggleAttenuationMenu: (id: string) => void;
  export let selectAttenuation: (id: string, value: number) => void;
  export let onZoneVolumeInput: (id: string, value: number) => void;
  export let zoneLabel: (id: string) => string;
  export let lang: Lang = "fr";
</script>

<div class="control global-volume">
  <label for="global-volume-controls" class="volume-label global-volume-label"
    >{t(lang, "volumeGlobal")}</label
  >
  <input
    id="global-volume-controls"
    type="range"
    min="0"
    max="1"
    step="0.01"
    bind:value={volume}
  />
  <p class="hint">
    {Math.round(volume * 100)}% • {t(lang, "hintAffectsAll")}
  </p>
</div>
<div class="form-row zone-controls">
  {#each zones as zone}
    <div class="control">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label id={`att-label-${zone.id}`}>
        {t(lang, "attenuation")} {zoneLabel(zone.id)}
      </label>
      <div class="attenuation-dropdown">
        <button
          id={`att-${zone.id}`}
          type="button"
          class="attenuation-trigger"
          aria-haspopup="listbox"
          aria-expanded={openAttenuationId === zone.id}
          aria-labelledby={`att-label-${zone.id}`}
          aria-controls={`att-menu-${zone.id}`}
          on:click|stopPropagation={() => toggleAttenuationMenu(zone.id)}
        >
          <span>
            {attenuationOptions.find(
              (opt) => opt.value === attenuationDb[zone.id]
            )?.label ?? "0 dB"}
          </span>
        </button>
        {#if openAttenuationId === zone.id}
          <div class="attenuation-menu" id={`att-menu-${zone.id}`} role="listbox">
            {#each attenuationOptions as opt}
              <button
                type="button"
                class={`attenuation-item ${opt.value === attenuationDb[zone.id] ? "active" : ""}`}
                role="option"
                aria-selected={opt.value === attenuationDb[zone.id]}
                on:click={() => selectAttenuation(zone.id, opt.value)}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <label for={`vol-${zone.id}`} class="volume-label">
        {t(lang, "volume")} {zoneLabel(zone.id)} ({Math.round(
          Math.min(1, (zoneVolume[zone.id] ?? 1) * volume) * 100
        )}%)
      </label>
      <input
        id={`vol-${zone.id}`}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={Math.min(1, (zoneVolume[zone.id] ?? 1) * volume)}
        on:input={(e) =>
          onZoneVolumeInput(zone.id, Number((e.target as HTMLInputElement).value))}
      />
    </div>
  {/each}
</div>
