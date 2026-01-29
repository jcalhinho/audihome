<script lang="ts">
  type Zone = { id: string; name: string; img: string; selected: boolean };

  export let zones: Zone[] = [];
  export let toggleZone: (id: string) => void;
  export let zoneLabel: (id: string) => string;
</script>

<div class="zone-grid">
  {#each zones as zone (zone.id)}
    <button
      type="button"
      class={`zone-card ${zone.selected ? "active" : ""}`}
      on:click={() => toggleZone(zone.id)}
      aria-pressed={zone.selected}
    >
      <div class="zone-header">
        <span class="zone-pill top">{zoneLabel(zone.id)}</span>
        <label class="switch">
          <input
            type="checkbox"
            checked={zone.selected}
            on:click|stopPropagation
            on:change={() => toggleZone(zone.id)}
          />
          <span class="slider"></span>
        </label>
      </div>
      <div class="zone-image">
        <img
          src={zone.img}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
      </div>
    </button>
  {/each}
</div>
