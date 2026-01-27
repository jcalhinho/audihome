<script lang="ts">
  type CardKey = 'Zones' | 'Player' | 'KPIs' | 'Controls' | 'Chart';
  const cards: CardKey[] = ['Zones', 'Player', 'KPIs', 'Controls', 'Chart'];
  let hidden: Record<CardKey, boolean> = {
    Zones: false,
    Player: false,
    KPIs: false,
    Controls: false,
    Chart: false
  };

  const closeMobile = (key: CardKey) => {
    hidden = { ...hidden, [key]: true };
  };
</script>

<svelte:head>
  <title>Glasswave — Grid</title>
</svelte:head>

<main>
  <div class="grid" aria-label="cards grid">
    {#each cards as key (key)}
      {#if !hidden[key]}
        <section class={`glass-card ${key === 'Chart' ? 'chart-card' : ''}`}>
          <header class="card-header">
            <h2>{key}</h2>
            <button class="close-mobile" type="button" aria-label={`Hide ${key}`} on:click={() => closeMobile(key)}>
              ×
            </button>
          </header>
        </section>
      {/if}
    {/each}
  </div>
</main>
