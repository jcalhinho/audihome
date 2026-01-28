<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import * as echarts from "echarts";

  type CardKey = "Zones" | "Player" | "Controls" | "Chart";
  const cards: CardKey[] = ["Player", "Zones", "Controls", "Chart"];

  let collapsed: Record<CardKey, boolean> = {
    Zones: false,
    Player: false,
    Controls: false,
    Chart: false,
  };

  const toggleCard = (key: CardKey) => {
    collapsed = { ...collapsed, [key]: !collapsed[key] };
  };

  // Player minimal (stream)
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
  let audio: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  type ByteArr = Uint8Array<ArrayBuffer>;
  let dataArray: ByteArr | null = null;
  let rafId: number | null = null;
  let canvasEl: HTMLCanvasElement | null = null;
  let vizParent: HTMLDivElement | null = null;
  let vizWidth = 0;
  let vizHeight = 60;
  let vizDpr = 1;
  let lastVizValues: number[] | null = null;
  let chartEl: HTMLDivElement | null = null;
  let chart: echarts.ECharts | null = null;
  let carouselViewport: HTMLOListElement | null = null;
  let carouselIndex = 0;
  let pendingCarouselIndex = 0;
  let carouselRaf: number | null = null;
  let carouselTouchStartX = 0;
  let carouselTouchStartY = 0;
  let carouselTouchStartLeft = 0;
  let carouselTouchMoveHandler: ((event: TouchEvent) => void) | null = null;
  let carouselTouchStartHandler: ((event: TouchEvent) => void) | null = null;
  let carouselTouchEndHandler: ((event: TouchEvent) => void) | null = null;
  let carouselPointerUpHandler: ((event: PointerEvent) => void) | null = null;
  let attenuationClickHandler: ((event: MouseEvent) => void) | null = null;
  let attenuationKeyHandler: ((event: KeyboardEvent) => void) | null = null;
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

  // Zones
  type Zone = { id: string; name: string; img: string; selected: boolean };
  let zones: Zone[] = [
    { id: "salon", name: "Salon", img: "/salon.webp", selected: true },
    { id: "bureau", name: "Bureau", img: "/deskroom.webp", selected: false },
    { id: "chambre", name: "Chambre", img: "/bedroom.webp", selected: false },
    { id: "baby", name: "Chambre bébé", img: "/babyroom.webp", selected: false },
    { id: "cuisine", name: "Cuisine", img: "/kitchen.webp", selected: true },
    { id: "sdb", name: "Salle de bain", img: "/bathroom.webp", selected: false },
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

  // KPIs dynamiques
  let kpis: { label: string; value: string | number }[] = [];

  // Controls
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

  const stopViz = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (lastVizValues && lastVizValues.length) {
      drawVizFrame(lastVizValues.map((v) => Math.max(0.015, v * 0.15)));
    } else {
      drawIdleViz();
    }
  };

  const getDbFromAnalyser = (an: AnalyserNode, arr: ByteArr) => {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
    const rms = Math.sqrt(sum / arr.length) / 255;
    const db = 20 * Math.log10(rms || 0.0001);
    return Math.max(-80, Math.round(db * 10) / 10);
  };

  const dbToLevel = (db: number) => {
    const norm = Math.max(0, Math.min(1, (db + 80) / 80));
    const boosted = Math.pow(norm, 0.6);
    return Math.round(boosted * 80 * 10) / 10;
  };

  const hexToRgba = (hex: string, opacity: number) => {
    const sanitized = hex.replace("#", "");
    if (sanitized.length !== 6) return `rgba(0,0,0,${opacity})`;
    const r = parseInt(sanitized.slice(0, 2), 16);
    const g = parseInt(sanitized.slice(2, 4), 16);
    const b = parseInt(sanitized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

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

  const updateChart = () => {
    if (!chart) return;
    const fluxColor = "#0ea5e9";
    const micColor = "#36ce9e";
    chart.setOption({
      backgroundColor: "transparent",
      legend: {
        top: 6,
        left: "center",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "#4a5568", fontSize: 10 },
      },
      xAxis: {
        type: "category",
        data: timeLabels,
        boundaryGap: false,
        axisLabel: { color: "#4a5568", fontSize: 10 },
        axisLine: { lineStyle: { color: "rgba(15,23,42,0.18)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 80,
        splitLine: {
          show: true,
          lineStyle: { color: "rgba(15,23,42,0.12)", type: "dashed" },
        },
        axisLabel: { color: "#4a5568", fontSize: 10, formatter: "{value} dB" },
        axisLine: { lineStyle: { color: "rgba(15,23,42,0.18)" } },
        axisTick: { show: false },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255,255,255,0.98)",
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.08)",
        textStyle: { color: "#0f172a", fontSize: 12 },
        extraCssText:
          "border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.12);",
      },
      grid: { left: 10, right: 10, top: 34, bottom: 22 },
      series: [
        {
          type: "line",
          name: "Flux",
          data: streamDbHistory,
          smooth: true,
          symbolSize: 6,
          showSymbol: false,
          lineStyle: {
            color: fluxColor,
            width: 2.5,
            shadowBlur: 10,
            shadowColor: hexToRgba(fluxColor, 0.4),
            shadowOffsetY: 6,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: hexToRgba(fluxColor, 0.28) },
              { offset: 1, color: hexToRgba(fluxColor, 0.08) },
            ]),
          },
        },
        {
          type: "line",
          name: "Micro",
          data: micDbHistory,
          smooth: true,
          symbolSize: 6,
          showSymbol: false,
          lineStyle: {
            color: micColor,
            width: 2,
            shadowBlur: 10,
            shadowColor: hexToRgba(micColor, 0.35),
            shadowOffsetY: 6,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: hexToRgba(micColor, 0.25) },
              { offset: 1, color: hexToRgba(micColor, 0.06) },
            ]),
          },
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
      const now = performance.now();
      if (now - lastMicSampleTime >= simSpeed) {
        lastMicSampleTime = now;
        pushDbSample("mic", getDbFromAnalyser(micAnalyser, micDataArray));
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  onMount(() => {
    initChart();
    resizeHandler = () => {
      chart?.resize();
      resizeViz();
    };
    window.addEventListener("resize", resizeHandler);
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
          if (event.cancelable) event.preventDefault();
          if (carouselViewport) {
            carouselViewport.scrollLeft = carouselTouchStartLeft - dx;
          }
        }
      };
      carouselTouchEndHandler = () => {
        commitCarouselSelection();
      };
      carouselPointerUpHandler = () => {
        commitCarouselSelection();
      };
      carouselViewport.addEventListener(
        "touchstart",
        carouselTouchStartHandler,
        {
          passive: true,
        },
      );
      carouselViewport.addEventListener(
        "touchstart",
        carouselTouchStartHandler,
        {
          passive: true,
        },
      );
      carouselViewport.addEventListener("touchmove", carouselTouchMoveHandler, {
        passive: false,
      });
      carouselViewport.addEventListener("touchend", carouselTouchEndHandler, {
        passive: true,
      });
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
    if (carouselViewport && carouselTouchStartHandler) {
      carouselViewport.removeEventListener(
        "touchstart",
        carouselTouchStartHandler,
      );
    }
    if (carouselViewport && carouselTouchMoveHandler) {
      carouselViewport.removeEventListener(
        "touchmove",
        carouselTouchMoveHandler,
      );
    }
    if (carouselViewport && carouselTouchEndHandler) {
      carouselViewport.removeEventListener("touchend", carouselTouchEndHandler);
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
    if (carouselRaf) cancelAnimationFrame(carouselRaf);
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
    gainNode.gain.value = zoneVol * linear;
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
      if (nextIndex !== pendingCarouselIndex) {
        pendingCarouselIndex = nextIndex;
      }
    });
  };

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

  $: activeZones = zones.filter((z) => z.selected).length;
  $: appliedAtt = activeZones
    ? Math.min(
        ...zones.filter((z) => z.selected).map((z) => attenuationDb[z.id] ?? 0),
      )
    : 0;
  $: kpis = [
    { label: "Zones actives", value: activeZones, status: activeZones > 0 },
    { label: "Atténuation", value: `${appliedAtt} dB`, status: appliedAtt < 0 },
    {
      label: "Flux",
      value: isPlaying ? "Lecture" : "Pause",
      status: isPlaying,
    },
    { label: "Volume", value: `${Math.round(volume * 100)}%` },
  ];
</script>

<svelte:head>
  <title>AUDIHOME</title>
</svelte:head>

<header class="topbar" aria-label="Header principal">
  <div class="topbar-inner">
    <span class="brand">
      <img class="brand-icon" src="/favicon.webp" alt="" aria-hidden="true" />
      AudiHome
    </span>
    <button class="btn ghost small" type="button" aria-label="Langue">
      FR/EN
    </button>
  </div>
</header>
<main>
  <div class="info-bar" aria-label="Résumé des infos">
    {#each kpis as kpi}
      <div class="info-chip">
        <div class="info-top">
          <span class="info-label">{kpi.label}</span>
          {#if kpi.label !== "Volume"}
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
  <div class="grid" aria-label="cards grid">
    {#each cards as key (key)}
      <section
        class={`glass-card ${key === "Chart" ? "chart-card" : ""} ${key === "Controls" ? "wide-card controls-card" : ""} ${key === "Player" ? "player-card" : ""} ${collapsed[key] ? "is-collapsed" : ""}`}
      >
        <header class="card-header">
          <div class="card-title-row">
            <h2>{key}</h2>
            {#if key === "Zones"}
              <button
                class="btn ghost small header-action"
                type="button"
                on:click={toggleAllZones}
              >
                {allSelected() ? "Tout décocher" : "Tout sélectionner"}
              </button>
            {:else if key === "Chart"}
              <button
                class="btn ghost small header-action"
                type="button"
                on:click={toggleMic}
              >
                {micActive ? "Arrêter micro" : "Activer micro"}
              </button>
            {/if}
            <button
              class="btn ghost small toggle-mobile"
              type="button"
              aria-label={`${collapsed[key] ? "Ouvrir" : "Fermer"} ${key}`}
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
                <div class="viz-shell" bind:this={vizParent}>
                  <canvas class="viz" bind:this={canvasEl} aria-hidden="true"
                  ></canvas>
                </div>
              </div>

              <div class="control global-volume">
                <label
                  for="global-volume"
                  class="volume-label global-volume-label">Volume global</label
                >
                <input
                  id="global-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={volume}
                />
              </div>

              <section class="carousel" aria-label="Radios">
                <ol
                  class="carousel__viewport"
                  bind:this={carouselViewport}
                  on:scroll={handleCarouselScroll}
                >
                  {#each streams as s, index (s.id)}
                    <li class="carousel__slide">
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
                          class={`carousel__navigation-button ${index === carouselIndex ? "active" : ""}`}
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

              <div class="player-meta">
                <div>
                  <p class="eyebrow">{isPlaying ? "En cours" : "En pause"}</p>
                </div>
                <span class="pill success">{current.credit}</span>
              </div>
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
          {:else if key === "Controls"}
            <div class="control global-volume">
              <label
                for="global-volume"
                class="volume-label global-volume-label">Volume global</label
              >
              <input
                id="global-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                bind:value={volume}
              />
              <p class="hint">
                {Math.round(volume * 100)}% • agit sur toutes les zones
              </p>
            </div>
            <div class="form-row zone-controls">
              {#each zones as zone}
                <div class="control">
                  <label for={`att-${zone.id}`}>Atténuation {zone.name}</label>
                  <div class="attenuation-dropdown">
                    <button
                      id={`att-${zone.id}`}
                      type="button"
                      class="attenuation-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={openAttenuationId === zone.id}
                      on:click|stopPropagation={() =>
                        toggleAttenuationMenu(zone.id)}
                    >
                      <span>
                        {attenuationOptions.find(
                          (opt) => opt.value === attenuationDb[zone.id],
                        )?.label ?? "0 dB"}
                      </span>
                    </button>
                    {#if openAttenuationId === zone.id}
                      <div class="attenuation-menu" role="listbox">
                        {#each attenuationOptions as opt}
                          <button
                            type="button"
                            class={`attenuation-item ${opt.value === attenuationDb[zone.id] ? "active" : ""}`}
                            role="option"
                            aria-selected={opt.value === attenuationDb[zone.id]}
                            on:click={() =>
                              selectAttenuation(zone.id, opt.value)}
                          >
                            {opt.label}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <label for={`vol-${zone.id}`} class="volume-label">
                    Volume {zone.name} ({Math.round(
                      Math.min(1, (zoneVolume[zone.id] ?? 1) * volume) * 100,
                    )}%)
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
                <p class="eyebrow">Live dB • Flux / Micro</p>
              </div>
              <div class="control">
                <label for="sim">Vitesse simulation ({simSpeed} ms)</label>
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
          {/if}
        </div>
      </section>
    {/each}
  </div>
</main>
