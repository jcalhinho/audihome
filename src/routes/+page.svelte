<script lang="ts">
  import { onDestroy } from 'svelte';

  type CardKey = 'Zones' | 'Player' | 'KPIs' | 'Controls' | 'Chart';
  const cards: CardKey[] = ['Player', 'Zones', 'KPIs', 'Controls', 'Chart'];

  let collapsed: Record<CardKey, boolean> = {
    Zones: false,
    Player: false,
    KPIs: false,
    Controls: false,
    Chart: false
  };

  const toggleCard = (key: CardKey) => {
    collapsed = { ...collapsed, [key]: !collapsed[key] };
  };

  // Player minimal (stream)
  const streams = [
    {
      id: 'groove',
      name: 'SomaFM — Groove Salad',
      url: 'https://ice2.somafm.com/groovesalad-64-aac',
      credit: 'SomaFM (AAC 64k)'
    },
    {
      id: 'swissjazz',
      name: 'Radio Swiss Jazz',
      url: 'https://stream.srg-ssr.ch/m/rsj/mp3_128',
      credit: 'SRG SSR (MP3 128k)'
    },
    {
      id: 'fip',
      name: 'FIP HiFi',
      url: 'https://icecast.radiofrance.fr/fip-hifi.aac',
      credit: 'Radio France (AAC)'
    }
  ];
  let current = streams[0];
  let volume = 0.7;
  let isPlaying = false;
  let audio: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let dataArray: Uint8Array | null = null;
  let rafId: number | null = null;
  let canvasEl: HTMLCanvasElement | null = null;

  // Zones
  type Zone = { id: string; name: string; img: string; selected: boolean };
  let zones: Zone[] = [
    { id: 'salon', name: 'Salon', img: '/salon.png', selected: false },
    { id: 'bureau', name: 'Bureau', img: '/deskroom.png', selected: false },
    { id: 'chambre', name: 'Chambre', img: '/bedroom.png', selected: false },
    { id: 'baby', name: 'Chambre bébé', img: '/babyroom.png', selected: false },
    { id: 'cuisine', name: 'Cuisine', img: '/kitchen.png', selected: false },
    { id: 'sdb', name: 'Salle de bain', img: '/bathroom.png', selected: false }
  ];

  const toggleZone = (id: string) => {
    zones = zones.map((z) => (z.id === id ? { ...z, selected: !z.selected } : z));
  };

  const allSelected = () => zones.every((z) => z.selected);

  const toggleAllZones = () => {
    const next = !allSelected();
    zones = zones.map((z) => ({ ...z, selected: next }));
  };

  const ensureAudio = () => {
    if (!audio) {
      audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = current.url;
      audio.preload = 'auto';
      audio.volume = volume;
      audio.onended = () => (isPlaying = false);
    }
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (!analyser && audio && audioCtx) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }
    if (!source && audio && audioCtx && analyser) {
      source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
  };

  const setStream = (id: string) => {
    const next = streams.find((s) => s.id === id);
    if (!next) return;
    const shouldResume = isPlaying;
    current = next;
    ensureAudio();
    audio!.pause();
    audio!.src = current.url;
    audio!.load();
    isPlaying = false;
    if (shouldResume) {
      play();
    }
  };

  const play = async () => {
    ensureAudio();
    audio!.volume = volume;
    await audioCtx?.resume();
    try {
      await audio!.play();
      isPlaying = true;
      startViz();
    } catch (e) {
      console.error('Playback failed', e);
    }
  };

  const pause = () => {
    audio?.pause();
    isPlaying = false;
    stopViz();
  };

  $: if (audio) audio.volume = volume;

  const startViz = () => {
    if (!analyser || !dataArray || !canvasEl) return;
    const canvas = canvasEl;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      if (!analyser || !dataArray || !ctx) return;
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / dataArray.length) * 1.6;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 255;
        const barHeight = v * canvas.height;
        const grad = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        grad.addColorStop(0, '#7c3aed');
        grad.addColorStop(1, '#0ea5e9');
        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
      rafId = requestAnimationFrame(draw);
    };
    if (rafId) cancelAnimationFrame(rafId);
    draw();
  };

  const stopViz = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
  };

  onDestroy(() => {
    audio?.pause();
    stopViz();
    audioCtx?.close();
  });
</script>

<svelte:head>
  <title>Glasswave — Grid</title>
</svelte:head>

<main>
  <div class="grid" aria-label="cards grid">
    {#each cards as key (key)}
      <section class={`glass-card ${key === 'Chart' ? 'chart-card' : ''} ${collapsed[key] ? 'is-collapsed' : ''}`}>
        <header class="card-header">
          <h2>{key}</h2>
          <button
            class="toggle-mobile"
            type="button"
            aria-label={`${collapsed[key] ? 'Ouvrir' : 'Fermer'} ${key}`}
            aria-expanded={!collapsed[key]}
            aria-controls={`card-${key}`}
            on:click={() => toggleCard(key)}
          >
            {collapsed[key] ? 'Ouvrir' : 'Fermer'}
          </button>
        </header>

        <div class={`card-body ${collapsed[key] ? 'collapsed' : ''}`} id={`card-${key}`}>
          {#if key === 'Player'}
            <div class="player-shell">
              <div class="player-row">
                <button
                  class={`icon-btn primary ${isPlaying ? 'active' : ''}`}
                  type="button"
                  on:click={isPlaying ? pause : play}
                  aria-label={isPlaying ? 'Pause' : 'Lecture'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <canvas class="viz" bind:this={canvasEl} width="360" height="60" aria-hidden="true"></canvas>
              </div>

              <div class="player-meta">
                <div>
                  <p class="eyebrow">En cours</p>
                  <p class="title">{current.name}</p>
                </div>
                <span class="pill success">{current.credit}</span>
              </div>

              <div class="track-stack">
                {#each streams as s}
                  <button
                    class={`track ${s.id === current.id ? 'active' : ''}`}
                    type="button"
                    on:click={() => setStream(s.id)}
                    aria-pressed={s.id === current.id}
                  >
                    <div class="track-text">
                      <span class="track-title">{s.name}</span>
                      <span class="track-sub">{s.credit}</span>
                    </div>
                    <span class="track-dot">{s.id === current.id ? '●' : '○'}</span>
                  </button>
                {/each}
              </div>

              <label class="control volume-row">
                Volume ({Math.round(volume * 100)}%)
                <input type="range" min="0" max="1" step="0.01" bind:value={volume} />
              </label>
            </div>
          {:else if key === 'Zones'}
            <div class="zone-toolbar">
              <button class="btn ghost" type="button" on:click={toggleAllZones}>
                {allSelected() ? 'Tout décocher' : 'Tout sélectionner'}
              </button>
            </div>
            <div class="zone-grid">
              {#each zones as zone (zone.id)}
                <button
                  type="button"
                  class={`zone-card ${zone.selected ? 'active' : ''}`}
                  on:click={() => toggleZone(zone.id)}
                  aria-pressed={zone.selected}
                >
                  <div class="zone-header">
                    <span class="zone-pill top">{zone.name}</span>
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
                    <img src={zone.img} alt={zone.name} loading="lazy" />
                  </div>
                </button>
              {/each}
            </div>
          {:else if key === 'KPIs'}
            <p class="muted">KPIs d’usage audio (placeholder).</p>
          {:else if key === 'Controls'}
            <p class="muted">Presets de volume et mute par zone (placeholder).</p>
          {:else}
            <p class="muted">Courbe audio / historique (placeholder).</p>
          {/if}
        </div>
      </section>
    {/each}
  </div>
</main>
