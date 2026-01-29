<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import PlayerCard from "$lib/components/PlayerCard.svelte";
  import ZonesCard from "$lib/components/ZonesCard.svelte";
  import ControlsCard from "$lib/components/ControlsCard.svelte";
  import ChartCard from "$lib/components/ChartCard.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import InfoBar from "$lib/components/InfoBar.svelte";
  import { getDbFromAnalyser, dbToLevel } from "$lib/logic/audioMath";
  import { buildChartOptions } from "$lib/logic/chartOptions";
  import {
    buildKpis,
    computeGainValue,
    computeSelectedZoneStats,
    type Kpi,
  } from "$lib/logic/zoneAudio";
  import { t, type I18nKey, type Lang } from "$lib/logic/i18n";

  // Layout state for collapsible cards.
  type CardKey = "Zones" | "Player" | "Controls" | "Chart";
  const cards: CardKey[] = ["Player", "Zones", "Controls", "Chart"];
  const cardTitleKey: Record<CardKey, I18nKey> = {
    Player: "cardPlayer",
    Zones: "cardZones",
    Controls: "cardControls",
    Chart: "cardChart",
  };

  let collapsed: Record<CardKey, boolean> = {
    Zones: false,
    Player: false,
    Controls: false,
    Chart: false,
  };

  const toggleCard = (key: CardKey) => {
    collapsed = { ...collapsed, [key]: !collapsed[key] };
  };

  // Global UI language (FR/EN toggle).
  let lang: Lang = "fr";

  const toggleLang = () => {
    lang = lang === "fr" ? "en" : "fr";
  };

  let zoneLabel: (id: string) => string;
  $: zoneLabel = (id: string) => t(lang, `zone_${id}` as I18nKey);

  // Stream catalog and playback state.
  const streams = [
    {
      id: "fip",
      name: "FIP HiFi",
      url: "https://icecast.radiofrance.fr/fip-hifi.aac",
      credit: "Radio France (AAC)",
      cover: "/fip.webp",
    },
    {
      id: "groove",
      name: "Groove Salad",
      url: "https://ice2.somafm.com/groovesalad-64-aac",
      credit: "SomaFM (AAC 64k)",
      cover: "/soma.webp",
    },
    {
      id: "swissjazz",
      name: "Radio Swiss Jazz",
      url: "https://stream.srg-ssr.ch/m/rsj/mp3_128",
      credit: "SRG SSR (MP3 128k)",
      cover: "/radioswiss.webp",
    },
  ];
  let current = streams[0];
  let volume = 1;
  let isPlaying = false;
  // Web Audio graph references (initialized lazily).
  let audio: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  type ByteArr = Uint8Array<ArrayBuffer>;
  let dataArray: ByteArr | null = null;
  let rafId: number | null = null;
  // Visualizer rendering state.
  let canvasEl: HTMLCanvasElement | null = null;
  let vizParent: HTMLDivElement | null = null;
  let vizWidth = 0;
  let vizHeight = 60;
  let vizDpr = 1;
  let lastVizValues: number[] | null = null;
  // ECharts state (lazy loaded).
  let chartEl: HTMLDivElement | null = null;
  type EChartsCore = typeof import("echarts/core");
  let echarts: EChartsCore | null = null;
  let chart: import("echarts/core").ECharts | null = null;
  let chartObserver: IntersectionObserver | null = null;
  // Carousel interaction state.
  let carouselViewport: HTMLOListElement | null = null;
  let carouselIndex = 0;
  let pendingCarouselIndex = 0;
  let carouselRaf: number | null = null;
  let carouselScrollEndTimer: number | null = null;
  let carouselPointerUpHandler: ((event: PointerEvent) => void) | null = null;
  let attenuationClickHandler: ((event: MouseEvent) => void) | null = null;
  let attenuationKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  // Microphone capture state.
  let micStream: MediaStream | null = null;
  let micAnalyser: AnalyserNode | null = null;
  let micDataArray: ByteArr | null = null;
  let micActive = false;
  let streamDbHistory: number[] = Array(120).fill(0);
  let micDbHistory: number[] = Array(120).fill(0);
  let timeLabels: string[] = Array(120).fill("");
  let resizeHandler: (() => void) | null = null;
  let gainNode: GainNode | null = null;
  let lastStreamChange = 0;
  let pendingStreamId: string | null = null;
  let streamChangeTimer: number | null = null;

  // Zones and attenuation settings.
  type Zone = { id: string; name: string; img: string; selected: boolean };
  let zones: Zone[] = [
    { id: "salon", name: "Salon", img: "/salon.webp", selected: true },
    { id: "bureau", name: "Bureau", img: "/deskroom.webp", selected: false },
    { id: "chambre", name: "Chambre", img: "/bedroom.webp", selected: false },
    {
      id: "baby",
      name: "Chambre bébé",
      img: "/babyroom.webp",
      selected: false,
    },
    { id: "cuisine", name: "Cuisine", img: "/kitchen.webp", selected: true },
    {
      id: "sdb",
      name: "Salle de bain",
      img: "/bathroom.webp",
      selected: false,
    },
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
  const attenuationOptions = [
    { label: "0 dB", value: 0 },
    { label: "-6 dB", value: -6 },
    { label: "-12 dB", value: -12 },
  ];
  let openAttenuationId: string | null = null;

  // KPI snapshot shown in the info bar.
  let kpis: Kpi[] = [];

  // Sampling cadence for the chart (ms).
  let simSpeed = 120;
  let lastStreamSampleTime = 0;
  let lastMicSampleTime = 0;

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

  const toggleAttenuationMenu = (id: string) => {
    openAttenuationId = openAttenuationId === id ? null : id;
  };

  const selectAttenuation = (id: string, value: number) => {
    attenuationDb = { ...attenuationDb, [id]: value };
    updateGain();
    openAttenuationId = null;
  };

  const handleZoneVolumeInput = (id: string, rawValue: number) => {
    const base = volume > 0 ? rawValue / volume : 0;
    zoneVolume = {
      ...zoneVolume,
      [id]: Math.min(1, Math.max(0, base)),
    };
    updateGain();
  };

  // Create AudioContext + nodes only when first needed.
  const ensureAudio = () => {
    if (!audio) {
      audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = current.url;
      audio.preload = "auto";
      audio.volume = volume;
      audio.onended = () => (isPlaying = false);
    }
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (!analyser && audio && audioCtx) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.3;
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
    const now = performance.now();
    if (now - lastStreamChange < 300) {
      pendingStreamId = id;
      if (streamChangeTimer) clearTimeout(streamChangeTimer);
      streamChangeTimer = window.setTimeout(() => {
        if (pendingStreamId) {
          const nextId = pendingStreamId;
          pendingStreamId = null;
          setStream(nextId);
        }
      }, 300);
      return;
    }
    lastStreamChange = now;
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

  // Playback controls keep UI state and visualizer in sync.
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

  // Keep the HTMLAudioElement in sync with the UI volume slider.
  $: if (audio) audio.volume = volume;
  $: updateGain();

  const resizeViz = () => {
    if (!canvasEl || !vizParent) return;
    const rect = vizParent.getBoundingClientRect();
    if (!rect.width) return;
    vizDpr = Math.min(window.devicePixelRatio || 1, 2);
    vizWidth = rect.width;
    vizHeight = 60;
    canvasEl.width = Math.round(vizWidth * vizDpr);
    canvasEl.height = Math.round(vizHeight * vizDpr);
    canvasEl.style.width = `${vizWidth}px`;
    canvasEl.style.height = `${vizHeight}px`;
  };

  // Render a single visualizer frame into the canvas.
  const drawVizFrame = (values: number[]) => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const displayWidth = canvasEl.width / vizDpr;
    const displayHeight = canvasEl.height / vizDpr;
    ctx.setTransform(vizDpr, 0, 0, vizDpr, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const padding = 6;
    const innerWidth = Math.max(0, displayWidth - padding * 2);
    const innerHeight = Math.max(0, displayHeight - padding * 2);
    const barCount = values.length;
    const barSlot = innerWidth / Math.max(1, barCount);
    const barWidth = Math.max(2, barSlot * 0.65);
    let x = padding + (barSlot - barWidth) / 2;
    for (let i = 0; i < barCount; i++) {
      const value = Math.max(0, Math.min(1, values[i] ?? 0));
      const barHeight = value * innerHeight;
      const grad = ctx.createLinearGradient(
        0,
        padding + innerHeight - barHeight,
        0,
        padding + innerHeight,
      );
      grad.addColorStop(0, "#38bdf8");
      grad.addColorStop(1, "#0ea5e9");
      ctx.fillStyle = grad;
      const y = padding + innerHeight - barHeight;
      const radius = Math.min(6, barWidth / 2, barHeight / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
      ctx.lineTo(x + barWidth, y + barHeight);
      ctx.lineTo(x, y + barHeight);
      ctx.closePath();
      ctx.fill();
      x += barSlot;
    }

    ctx.save();
    ctx.strokeStyle = "rgba(15,23,42,0.22)";
    ctx.fillStyle = "rgba(15,23,42,0.65)";
    ctx.font = "9px system-ui, sans-serif";
    const minFreq = 50;
    const nyquist = (audioCtx?.sampleRate ?? 44100) / 2;
    const maxFreq = Math.min(16000, nyquist);
    const logRange = Math.log10(maxFreq / minFreq);
    const freqs = [30, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000];
    let lastLabelX = -999;
    freqs.forEach((freq) => {
      const px = Math.round(
        padding +
          innerWidth *
            (Math.log10(Math.max(freq, minFreq) / minFreq) / logRange),
      );
      if (px <= 8 || px >= displayWidth - 8) return;
      ctx.beginPath();
      ctx.moveTo(px, padding);
      ctx.lineTo(px, displayHeight - padding);
      ctx.stroke();
      const label = freq >= 1000 ? `${freq / 1000}kHz` : `${freq}Hz`;
      if (px - lastLabelX >= 28) {
        ctx.fillText(label, px + 4, 12);
        lastLabelX = px;
      }
    });
    ctx.restore();
  };

  const drawIdleViz = () => {
    const barCount = 24;
    const values = Array.from({ length: barCount }, (_, i) => {
      const wave = Math.sin((i / barCount) * Math.PI * 2);
      return 0.015 + Math.max(0, wave) * 0.02;
    });
    drawVizFrame(values);
  };

  // Drive the visualizer and feed the chart sampling loop.
  const startViz = () => {
    if (!analyser || !dataArray || !canvasEl) return;
    const canvas = canvasEl;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    resizeViz();
    const draw = () => {
      if (!analyser || !dataArray || !ctx) return;
      analyser.getByteFrequencyData(dataArray);
      const now = performance.now();
      if (now - lastStreamSampleTime >= simSpeed) {
        lastStreamSampleTime = now;
        pushDbSample("stream", getDbFromAnalyser(analyser, dataArray));
      }
      const barCount = 24;
      const minFreq = 50;
      const nyquist = (audioCtx?.sampleRate ?? 44100) / 2;
      const maxFreq = Math.min(16000, nyquist);
      const logRange = Math.log10(maxFreq / minFreq);
      const values: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const freq = minFreq * Math.pow(10, (i / (barCount - 1)) * logRange);
        const bin = Math.min(
          dataArray.length - 1,
          Math.max(0, Math.round((freq / nyquist) * (dataArray.length - 1))),
        );
        const v =
          (dataArray[bin - 1] ?? dataArray[bin] ?? 0) / 255 +
          (dataArray[bin] ?? 0) / 255 +
          (dataArray[bin + 1] ?? dataArray[bin] ?? 0) / 255;
        const value = v / 3;
        const norm = Math.log10(freq / minFreq) / logRange;
        const tilt = 0.45 + 0.55 * norm;
        values.push(Math.min(1, value * tilt * 1.1));
      }
      lastVizValues = values;
      drawVizFrame(values);

      rafId = requestAnimationFrame(draw);
    };
    if (rafId) cancelAnimationFrame(rafId);
    draw();
  };

  // Stop the visualizer and leave a subtle idle state.
  const stopViz = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (lastVizValues && lastVizValues.length) {
      drawVizFrame(lastVizValues.map((v) => Math.max(0.015, v * 0.15)));
    } else {
      drawIdleViz();
    }
  };

  // Append a new sample to the rolling time series and update the chart.
  const pushDbSample = (kind: "stream" | "mic", db: number) => {
    const label = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    timeLabels = [...timeLabels.slice(1), label];
    const level = dbToLevel(db) * volume;
    if (kind === "stream") {
      streamDbHistory = [...streamDbHistory.slice(1), level];
    } else {
      micDbHistory = [...micDbHistory.slice(1), level];
    }
    updateChart();
  };

  // Push new data into the chart without re-creating the instance.
  const updateChart = () => {
    if (!chart || !echarts) return;
    chart.setOption(
      buildChartOptions(echarts, timeLabels, streamDbHistory, micDbHistory, {
        stream: t(lang, "kpiStream"),
        mic: t(lang, "mic"),
      }),
    );
  };

  // Lazy-load ECharts core + components only when the card is visible.
  const ensureEcharts = async () => {
    if (echarts) return;
    const echartsCore = await import("echarts/core");
    const { LineChart } = await import("echarts/charts");
    const { GridComponent, TooltipComponent, LegendComponent } = await import(
      "echarts/components"
    );
    const { CanvasRenderer } = await import("echarts/renderers");
    echartsCore.use([
      LineChart,
      GridComponent,
      TooltipComponent,
      LegendComponent,
      CanvasRenderer,
    ]);
    echarts = echartsCore;
  };

  const initChart = async () => {
    if (!chartEl || chart) return;
    await ensureEcharts();
    if (!echarts) return;
    chart = echarts.init(chartEl);
    updateChart();
  };

  // Toggle microphone capture and feed samples into the chart.
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
      const now = performance.now();
      if (now - lastMicSampleTime >= simSpeed) {
        lastMicSampleTime = now;
        pushDbSample("mic", getDbFromAnalyser(micAnalyser, micDataArray));
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  // Global event wiring for resize, carousel gestures, and menu close logic.
  onMount(() => {
    resizeHandler = () => {
      chart?.resize();
      resizeViz();
    };
    window.addEventListener("resize", resizeHandler);
    if (chartEl) {
      if ("IntersectionObserver" in window) {
        chartObserver = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              void initChart();
              chartObserver?.disconnect();
              chartObserver = null;
            }
          },
          { rootMargin: "200px" },
        );
        chartObserver.observe(chartEl);
      } else {
        void initChart();
      }
    }
    attenuationClickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".attenuation-dropdown")) {
        openAttenuationId = null;
      }
    };
    attenuationKeyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") openAttenuationId = null;
    };
    document.addEventListener("click", attenuationClickHandler);
    document.addEventListener("keydown", attenuationKeyHandler);
    if (carouselViewport) {
      scrollToCarouselIndex(carouselIndex, "auto");
      carouselPointerUpHandler = () => {
        commitCarouselSelection();
      };
      carouselViewport.addEventListener("pointerup", carouselPointerUpHandler, {
        passive: true,
      });
      requestAnimationFrame(handleCarouselScroll);
    }
    resizeViz();
    drawIdleViz();
  });

  onDestroy(() => {
    audio?.pause();
    stopViz();
    audioCtx?.close();
    chart?.dispose();
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
    }
    if (carouselViewport && carouselPointerUpHandler) {
      carouselViewport.removeEventListener(
        "pointerup",
        carouselPointerUpHandler,
      );
    }
    if (attenuationClickHandler) {
      document.removeEventListener("click", attenuationClickHandler);
    }
    if (attenuationKeyHandler) {
      document.removeEventListener("keydown", attenuationKeyHandler);
    }
    if (chartObserver) {
      chartObserver.disconnect();
      chartObserver = null;
    }
    if (carouselRaf) cancelAnimationFrame(carouselRaf);
    if (carouselScrollEndTimer) {
      window.clearTimeout(carouselScrollEndTimer);
    }
  });

  // Apply the min attenuation + volume from selected zones to the gain node.
  const updateGain = () => {
    if (!gainNode) return;
    gainNode.gain.value = computeGainValue(zones, attenuationDb, zoneVolume);
  };

  // Track the closest carousel card while the user scrolls/swipes.
  const handleCarouselScroll = () => {
    if (!carouselViewport) return;
    if (carouselRaf) return;
    carouselRaf = requestAnimationFrame(() => {
      carouselRaf = null;
      if (!carouselViewport) return;
      const width = carouselViewport.clientWidth;
      if (!width) return;
      const rawIndex = Math.round(carouselViewport.scrollLeft / width);
      const nextIndex = Math.min(
        Math.max(0, rawIndex),
        Math.max(0, streams.length - 1),
      );
      if (nextIndex !== pendingCarouselIndex) {
        pendingCarouselIndex = nextIndex;
      }
      if (carouselScrollEndTimer) {
        window.clearTimeout(carouselScrollEndTimer);
      }
      carouselScrollEndTimer = window.setTimeout(() => {
        commitCarouselSelection();
      }, 140);
    });
  };

  // Commit the pending carousel index and switch stream if needed.
  const commitCarouselSelection = () => {
    if (pendingCarouselIndex === carouselIndex) return;
    carouselIndex = pendingCarouselIndex;
    const next = streams[carouselIndex];
    if (next && next.id !== current.id) {
      setStream(next.id);
    }
  };

  const scrollToCarouselIndex = (
    index: number,
    behavior: ScrollBehavior = "smooth",
  ) => {
    if (!carouselViewport) return;
    const width = carouselViewport.clientWidth;
    const clamped = Math.min(Math.max(0, index), streams.length - 1);
    pendingCarouselIndex = clamped;
    carouselIndex = clamped;
    const next = streams[clamped];
    if (next && next.id !== current.id) {
      setStream(next.id);
    }
    carouselViewport.scrollTo({ left: clamped * width, behavior });
  };

  // Derived UI state (KPIs).
  $: ({ activeCount: activeZones, appliedAtt } = computeSelectedZoneStats(
    zones,
    attenuationDb,
    zoneVolume,
  ));
  $: kpis = buildKpis(lang, activeZones, appliedAtt, isPlaying, volume);
</script>

<svelte:head>
  <title>AUDIHOME</title>
</svelte:head>

<TopBar
  title="AudiHome"
  iconSrc="/favicon.webp"
  langLabel={lang === "fr" ? "EN" : "FR"}
  {lang}
  onToggleLang={toggleLang}
/>
<main>
  <InfoBar {kpis} {lang} />
  <div class="grid" aria-label={t(lang, "cardsGridLabel")}>
    {#each cards as key (key)}
      <section
        class={`glass-card ${key === "Chart" ? "chart-card" : ""} ${key === "Controls" ? "wide-card controls-card" : ""} ${key === "Player" ? "player-card" : ""} ${collapsed[key] ? "is-collapsed" : ""}`}
      >
        <header class="card-header">
          <div class="card-title-row">
            <h2>{t(lang, cardTitleKey[key])}</h2>
            {#if key === "Zones"}
              <button
                class="btn ghost small header-action"
                type="button"
                on:click={toggleAllZones}
              >
                {allSelected()
                  ? t(lang, "deselectAll")
                  : t(lang, "selectAll")}
              </button>
            {:else if key === "Chart"}
              <button
                class="btn ghost small header-action"
                type="button"
                on:click={toggleMic}
              >
                {micActive ? t(lang, "stopMic") : t(lang, "startMic")}
              </button>
            {/if}
            <button
              class="btn ghost small toggle-mobile"
              type="button"
              aria-label={`${collapsed[key] ? t(lang, "open") : t(lang, "close")} ${t(lang, cardTitleKey[key])}`}
              aria-expanded={!collapsed[key]}
              aria-controls={key === "Controls"
                ? "card-controls"
                : `card-${key}`}
              on:click={() => toggleCard(key)}
            >
              {collapsed[key] ? "Ouvrir" : "Fermer"}
            </button>
          </div>
        </header>

        <div
          class={`card-body ${collapsed[key] ? "collapsed" : ""}`}
          id={key === "Controls" ? "card-controls" : `card-${key}`}
        >
          {#if key === "Player"}
            <PlayerCard
              bind:canvasEl
              bind:carouselViewport
              bind:vizParent
              {carouselIndex}
              {current}
              {handleCarouselScroll}
              {isPlaying}
              {lang}
              {pause}
              {play}
              {scrollToCarouselIndex}
              {streams}
              bind:volume
            />
          {:else if key === "Zones"}
            <ZonesCard {zones} {toggleZone} {zoneLabel} />
          {:else if key === "Controls"}
            <ControlsCard
              {attenuationDb}
              {attenuationOptions}
              {lang}
              {openAttenuationId}
              {selectAttenuation}
              {toggleAttenuationMenu}
              {zoneVolume}
              {zoneLabel}
              {zones}
              bind:volume
              onZoneVolumeInput={handleZoneVolumeInput}
            />
          {:else}
            <ChartCard bind:chartEl bind:simSpeed {lang} />
          {/if}
        </div>
      </section>
    {/each}
  </div>
</main>
