<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import * as echarts from "echarts";

  type CardKey = "Zones" | "Player" | "KPIs" | "Controls" | "Chart";
  const cards: CardKey[] = ["Player", "Zones", "KPIs", "Controls", "Chart"];

  let collapsed: Record<CardKey, boolean> = {
    Zones: false,
    Player: false,
    KPIs: false,
    Controls: false,
    Chart: false,
  };

  const toggleCard = (key: CardKey) => {
    collapsed = { ...collapsed, [key]: !collapsed[key] };
  };

  // Player minimal (stream)
  const streams = [
    {
      id: "groove",
      name: "SomaFM — Groove Salad",
      url: "https://ice2.somafm.com/groovesalad-64-aac",
      credit: "SomaFM (AAC 64k)",
      cover: "/salon.png",
    },
    {
      id: "swissjazz",
      name: "Radio Swiss Jazz",
      url: "https://stream.srg-ssr.ch/m/rsj/mp3_128",
      credit: "SRG SSR (MP3 128k)",
      cover: "/bedroom.png",
    },
    {
      id: "fip",
      name: "FIP HiFi",
      url: "https://icecast.radiofrance.fr/fip-hifi.aac",
      credit: "Radio France (AAC)",
      cover: "/deskroom.png",
    },
  ];
  let current = streams[0];
  let volume = 1;
  let isPlaying = false;
  let audio: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  type ByteArr = Uint8Array<ArrayBuffer>;
  let dataArray: ByteArr | null = null;
  let rafId: number | null = null;
  let canvasEl: HTMLCanvasElement | null = null;
  let chartEl: HTMLDivElement | null = null;
  let chart: echarts.ECharts | null = null;
  let carouselViewport: HTMLOListElement | null = null;
  let carouselIndex = 0;
  let carouselRaf: number | null = null;
  let carouselTouchStartX = 0;
  let carouselTouchStartY = 0;
  let carouselTouchStartLeft = 0;
  let carouselTouchMoveHandler: ((event: TouchEvent) => void) | null = null;
  let carouselTouchStartHandler: ((event: TouchEvent) => void) | null = null;
  let micStream: MediaStream | null = null;
  let micAnalyser: AnalyserNode | null = null;
  let micDataArray: ByteArr | null = null;
  let micActive = false;
  let streamDbHistory: number[] = Array(120).fill(-80);
  let micDbHistory: number[] = Array(120).fill(-80);
  let timeLabels: string[] = Array(120).fill("");
  let tick = 0;
  let resizeHandler: (() => void) | null = null;
  let gainNode: GainNode | null = null;

  // Zones
  type Zone = { id: string; name: string; img: string; selected: boolean };
  let zones: Zone[] = [
    { id: "salon", name: "Salon", img: "/salon.png", selected: false },
    { id: "bureau", name: "Bureau", img: "/deskroom.png", selected: false },
    { id: "chambre", name: "Chambre", img: "/bedroom.png", selected: false },
    { id: "baby", name: "Chambre bébé", img: "/babyroom.png", selected: false },
    { id: "cuisine", name: "Cuisine", img: "/kitchen.png", selected: false },
    { id: "sdb", name: "Salle de bain", img: "/bathroom.png", selected: false },
  ];
  let attenuationDb: Record<string, number> = {
    salon: 0,
    bureau: 0,
    chambre: 0,
    baby: -12,
    cuisine: 0,
    sdb: 0,
  };
  let zoneVolume: Record<string, number> = {
    salon: 1,
    bureau: 1,
    chambre: 1,
    baby: 0.7,
    cuisine: 1,
    sdb: 1,
  };

  // KPIs dynamiques
  let kpis: { label: string; value: string | number }[] = [];

  // Controls
  let simSpeed = 120;

  // Chart (simple sparkline data)
  const energyLevels = [
    62, 65, 63, 67, 70, 66, 64, 62, 65, 68, 64, 63, 66, 67, 65,
  ];

  const toggleZone = (id: string) => {
    zones = zones.map((z) =>
      z.id === id ? { ...z, selected: !z.selected } : z,
    );
    updateGain();
  };

  const allSelected = () => zones.every((z) => z.selected);

  const toggleAllZones = () => {
    const next = !allSelected();
    zones = zones.map((z) => ({ ...z, selected: next }));
    updateGain();
  };

  const ensureAudio = () => {
    if (!audio) {
      audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = current.url;
      audio.preload = "auto";
      audio.volume = 1;
      audio.onended = () => (isPlaying = false);
    }
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (!analyser && audio && audioCtx) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength) as ByteArr;
    }
    if (!source && audio && audioCtx && analyser) {
      source = audioCtx.createMediaElementSource(audio);
      gainNode = audioCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      updateGain();
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
    await audioCtx?.resume();
    try {
      await audio!.play();
      isPlaying = true;
      startViz();
    } catch (e) {
      console.error("Playback failed", e);
    }
  };

  const pause = () => {
    audio?.pause();
    isPlaying = false;
    stopViz();
  };

  $: updateGain();

  const startViz = () => {
    if (!analyser || !dataArray || !canvasEl) return;
    const canvas = canvasEl;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      if (!analyser || !dataArray || !ctx) return;
      analyser.getByteFrequencyData(dataArray);
      if (++tick % 4 === 0) {
        pushDbSample("stream", getDbFromAnalyser(analyser, dataArray));
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / dataArray.length) * 1.6;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 255;
        const barHeight = v * canvas.height;
        const grad = ctx.createLinearGradient(
          0,
          canvas.height - barHeight,
          0,
          canvas.height,
        );
        grad.addColorStop(0, "#7c3aed");
        grad.addColorStop(1, "#0ea5e9");
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
      const ctx = canvasEl.getContext("2d");
      ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
  };

  onDestroy(() => {
    audio?.pause();
    stopViz();
    audioCtx?.close();
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
    }
    if (carouselRaf) cancelAnimationFrame(carouselRaf);
  });

  const getDbFromAnalyser = (an: AnalyserNode, arr: ByteArr) => {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
    const rms = Math.sqrt(sum / arr.length) / 255;
    const db = 20 * Math.log10(rms || 0.0001);
    return Math.max(-80, Math.round(db * 10) / 10);
  };

  const pushDbSample = (kind: "stream" | "mic", db: number) => {
    const label = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    timeLabels = [...timeLabels.slice(1), label];
    if (kind === "stream") {
      streamDbHistory = [...streamDbHistory.slice(1), db];
    } else {
      micDbHistory = [...micDbHistory.slice(1), db];
    }
    updateChart();
  };

  const updateChart = () => {
    if (!chart) return;
    chart.setOption({
      xAxis: {
        type: "category",
        data: timeLabels,
        boundaryGap: false,
        axisLabel: { color: "#4a5568", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        min: -80,
        max: 0,
        splitLine: {
          show: true,
          lineStyle: { color: "rgba(255,255,255,0.25)" },
        },
        axisLabel: { color: "#4a5568", fontSize: 10, formatter: "{value} dB" },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,23,42,0.8)",
        borderWidth: 0,
        textStyle: { color: "#fff" },
      },
      grid: { left: 10, right: 10, top: 10, bottom: 18 },
      series: [
        {
          type: "line",
          name: "Flux",
          data: streamDbHistory,
          smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(124,58,237,0.35)" },
              { offset: 1, color: "rgba(14,165,233,0.05)" },
            ]),
          },
          lineStyle: {
            color: "#7c3aed",
            width: 2,
            shadowBlur: 10,
            shadowColor: "rgba(124,58,237,0.35)",
          },
          showSymbol: false,
        },
        {
          type: "line",
          name: "Micro",
          data: micDbHistory,
          smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(14,165,233,0.3)" },
              { offset: 1, color: "rgba(14,165,233,0.05)" },
            ]),
          },
          lineStyle: {
            color: "#0ea5e9",
            width: 2,
            shadowBlur: 10,
            shadowColor: "rgba(14,165,233,0.25)",
          },
          showSymbol: false,
        },
      ],
    });
  };

  const initChart = () => {
    if (!chartEl) return;
    chart = echarts.init(chartEl);
    updateChart();
  };

  const toggleMic = async () => {
    if (micActive) {
      micStream?.getTracks().forEach((t) => t.stop());
      micStream = null;
      micAnalyser = null;
      micActive = false;
      return;
    }
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    if (!audioCtx) audioCtx = new AudioContext();
    micAnalyser = audioCtx.createAnalyser();
    micAnalyser.fftSize = 64;
    micDataArray = new Uint8Array(micAnalyser.frequencyBinCount) as ByteArr;
    const micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(micAnalyser);
    micActive = true;
    const loop = () => {
      if (!micActive || !micAnalyser || !micDataArray) return;
      micAnalyser.getByteFrequencyData(micDataArray);
      pushDbSample("mic", getDbFromAnalyser(micAnalyser, micDataArray));
      requestAnimationFrame(loop);
    };
    loop();
  };

  onMount(() => {
    initChart();
    resizeHandler = () => chart?.resize();
    window.addEventListener("resize", resizeHandler);
    if (carouselViewport) {
      carouselTouchStartHandler = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch) return;
        carouselTouchStartX = touch.clientX;
        carouselTouchStartY = touch.clientY;
        carouselTouchStartLeft = carouselViewport?.scrollLeft ?? 0;
      };
      carouselTouchMoveHandler = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch) return;
        const dx = touch.clientX - carouselTouchStartX;
        const dy = touch.clientY - carouselTouchStartY;
        if (Math.abs(dx) > Math.abs(dy)) {
          event.preventDefault();
          if (carouselViewport) {
            carouselViewport.scrollLeft = carouselTouchStartLeft - dx;
          }
        }
      };
      carouselViewport.addEventListener("touchstart", carouselTouchStartHandler, {
        passive: true,
      });
      carouselViewport.addEventListener("touchmove", carouselTouchMoveHandler, {
        passive: false,
      });
      requestAnimationFrame(handleCarouselScroll);
    }
  });

  onDestroy(() => {
    audio?.pause();
    stopViz();
    audioCtx?.close();
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
    }
    if (carouselViewport && carouselTouchStartHandler) {
      carouselViewport.removeEventListener(
        "touchstart",
        carouselTouchStartHandler,
      );
    }
    if (carouselViewport && carouselTouchMoveHandler) {
      carouselViewport.removeEventListener("touchmove", carouselTouchMoveHandler);
    }
  });

  const updateGain = () => {
    if (!gainNode) return;
    const selectedZones = zones.filter((z) => z.selected);
    const attDb = selectedZones.length
      ? Math.min(...selectedZones.map((z) => attenuationDb[z.id] ?? 0))
      : 0;
    const zoneVol = selectedZones.length
      ? Math.min(...selectedZones.map((z) => zoneVolume[z.id] ?? 1))
      : 1;
    const linear = Math.pow(10, attDb / 20);
    gainNode.gain.value = volume * zoneVol * linear;
  };

  const handleCarouselScroll = () => {
    if (!carouselViewport) return;
    if (carouselRaf) return;
    carouselRaf = requestAnimationFrame(() => {
      carouselRaf = null;
      const width = carouselViewport?.clientWidth ?? 0;
      if (!width) return;
      const rawIndex = Math.round(carouselViewport.scrollLeft / width);
      const nextIndex = Math.min(
        Math.max(0, rawIndex),
        Math.max(0, streams.length - 1),
      );
      if (nextIndex !== carouselIndex) {
        carouselIndex = nextIndex;
        const next = streams[carouselIndex];
        if (next && next.id !== current.id) {
          setStream(next.id);
        }
      }
    });
  };

  const scrollToCarouselIndex = (index: number) => {
    if (!carouselViewport) return;
    const width = carouselViewport.clientWidth;
    const clamped = Math.min(Math.max(0, index), streams.length - 1);
    carouselViewport.scrollTo({ left: clamped * width, behavior: "smooth" });
  };

  $: activeZones = zones.filter((z) => z.selected).length;
  $: appliedAtt = activeZones
    ? Math.min(
        ...zones.filter((z) => z.selected).map((z) => attenuationDb[z.id] ?? 0),
      )
    : 0;
  $: kpis = [
    { label: "Zones actives", value: activeZones },
    { label: "Atténuation", value: `${appliedAtt} dB` },
    { label: "Flux en cours", value: current.name },
    { label: "Volume", value: `${Math.round(volume * 100)}%` },
  ];
</script>

<svelte:head>
  <title>Glasswave — Grid</title>
</svelte:head>

<main>
  <div class="grid" aria-label="cards grid">
    {#each cards as key (key)}
      <section
        class={`glass-card ${key === "Chart" ? "chart-card" : ""} ${collapsed[key] ? "is-collapsed" : ""}`}
      >
        <header class="card-header">
          <div class="card-title-row">
            <h2>{key}</h2>
            {#if key === "Zones"}
              <button class="btn ghost small" type="button" on:click={toggleAllZones}>
                {allSelected() ? "Tout décocher" : "Tout sélectionner"}
              </button>
            {:else if key === "Chart"}
              <button class="btn ghost small" type="button" on:click={toggleMic}>
                {micActive ? "Arrêter micro" : "Activer micro"}
              </button>
            {/if}
          </div>
          <button
            class="toggle-mobile"
            type="button"
            aria-label={`${collapsed[key] ? "Ouvrir" : "Fermer"} ${key}`}
            aria-expanded={!collapsed[key]}
            aria-controls={`card-${key}`}
            on:click={() => toggleCard(key)}
          >
            {collapsed[key] ? "Ouvrir" : "Fermer"}
          </button>
        </header>

        <div
          class={`card-body ${collapsed[key] ? "collapsed" : ""}`}
          id={`card-${key}`}
        >
          {#if key === "Player"}
            <div class="player-shell">
              <div class="player-row">
                <button
                  class={`icon-btn primary ${isPlaying ? "active" : ""}`}
                  type="button"
                  on:click={isPlaying ? pause : play}
                  aria-label={isPlaying ? "Pause" : "Lecture"}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <canvas
                  class="viz"
                  bind:this={canvasEl}
                  width="360"
                  height="60"
                  aria-hidden="true"
                ></canvas>
              </div>

              <div class="player-meta">
                <div>
                  <p class="eyebrow">En cours</p>
                  <p class="title">{current.name}</p>
                </div>
                <span class="pill success">{current.credit}</span>
              </div>

              <section class="carousel" aria-label="Radios">
                <ol
                  class="carousel__viewport"
                  bind:this={carouselViewport}
                  on:scroll={handleCarouselScroll}
                >
                  {#each streams as s, index (s.id)}
                    <li
                      class="carousel__slide"
                    >
                      <div class="carousel__snapper">
                        <button
                          type="button"
                          class="carousel__prev"
                          on:click={() =>
                            scrollToCarouselIndex(
                              index === 0 ? streams.length - 1 : index - 1,
                            )}
                        >
                          Précédent
                        </button>
                        <button
                          type="button"
                          class="carousel__next"
                          on:click={() =>
                            scrollToCarouselIndex(
                              index === streams.length - 1 ? 0 : index + 1,
                            )}
                        >
                          Suivant
                        </button>
                      </div>
                      <button
                        class={`carousel__card ${s.id === current.id ? "active" : ""}`}
                        type="button"
                        on:click={() => setStream(s.id)}
                        aria-pressed={s.id === current.id}
                      >
                        <div class="carousel__cover">
                          <img
                            src={s.cover}
                            alt={`Pochette ${s.name}`}
                            loading="lazy"
                          />
                        </div>
                        <div class="carousel__info">
                          <span class="carousel__title">{s.name}</span>
                          <span class="carousel__subtitle">{s.credit}</span>
                        </div>
                      </button>
                    </li>
                  {/each}
                </ol>
                <aside class="carousel__navigation">
                  <ol class="carousel__navigation-list">
                    {#each streams as s, index (s.id)}
                      <li class="carousel__navigation-item">
                        <button
                          type="button"
                          class="carousel__navigation-button"
                          aria-label={`Aller à ${s.name}`}
                          on:click={() => scrollToCarouselIndex(index)}
                        >
                          {index + 1}
                        </button>
                      </li>
                    {/each}
                  </ol>
                </aside>
              </section>
              <p class="hint">Swipe ou utilise les points pour changer de radio.</p>
            </div>
          {:else if key === "Zones"}
            <div class="zone-grid">
              {#each zones as zone (zone.id)}
                <button
                  type="button"
                  class={`zone-card ${zone.selected ? "active" : ""}`}
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
          {:else if key === "KPIs"}
            <div class="kpi-grid">
              {#each kpis as kpi}
                <div class="kpi">
                  <span class="label">{kpi.label}</span>
                  <span class="value">{kpi.value}</span>
                </div>
              {/each}
            </div>
          {:else if key === "Controls"}
            <div class="control global-volume">
              <label for="global-volume" class="volume-label">Volume global</label>
              <input
                id="global-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                bind:value={volume}
              />
              <p class="hint">{Math.round(volume * 100)}% • agit sur toutes les zones</p>
            </div>
            <div class="form-row zone-controls">
              {#each zones as zone}
                <div class="control">
                  <label for={`att-${zone.id}`}>Atténuation {zone.name}</label>
                  <select
                    id={`att-${zone.id}`}
                    class="attenuation-select"
                    on:change={(e) => {
                      const val = Number((e.target as HTMLSelectElement).value);
                      attenuationDb = { ...attenuationDb, [zone.id]: val };
                      updateGain();
                    }}
                  >
                    <option value="0" selected={attenuationDb[zone.id] === 0}
                      >0 dB</option
                    >
                    <option value="-6" selected={attenuationDb[zone.id] === -6}
                      >-6 dB</option
                    >
                    <option
                      value="-12"
                      selected={attenuationDb[zone.id] === -12}>-12 dB</option
                    >
                  </select>
                  <label for={`vol-${zone.id}`} class="volume-label">
                    Volume {zone.name} ({Math.round(Math.min(1, (zoneVolume[zone.id] ?? 1) * volume) * 100)}%)
                  </label>
                  <input
                    id={`vol-${zone.id}`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Math.min(1, (zoneVolume[zone.id] ?? 1) * volume)}
                    on:input={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      const base = volume > 0 ? val / volume : 0;
                      zoneVolume = {
                        ...zoneVolume,
                        [zone.id]: Math.min(1, Math.max(0, base)),
                      };
                      updateGain();
                    }}
                  />
                </div>
              {/each}
            </div>
          {:else}
            <div class="chart-shell">
              <div class="chart-header">
                <div>
                  <p class="eyebrow">Live dB</p>
                  <p class="muted">Flux / Micro</p>
                </div>
              </div>
              <div class="control">
                <label for="sim">Vitesse simulation (ms)</label>
                <input
                  id="sim"
                  type="range"
                  min="60"
                  max="240"
                  step="5"
                  bind:value={simSpeed}
                />
                <p class="hint">{simSpeed} ms • jitter doux</p>
              </div>
              <div bind:this={chartEl} class="echart"></div>
            </div>
          {/if}
        </div>
      </section>
    {/each}
  </div>
</main>
