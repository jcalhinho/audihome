<script lang="ts">
  import { t, type Lang } from "$lib/logic/i18n";

  export type Stream = {
    id: string;
    name: string;
    url: string;
    credit: string;
    cover: string;
  };

  export let isPlaying: boolean;
  export let volume: number;
  export let current: Stream;
  export let streams: Stream[] = [];
  export let carouselIndex: number;
  export let lang: Lang = "fr";
  export let play: () => void;
  export let pause: () => void;
  export let handleCarouselScroll: (event?: Event) => void;
  export let scrollToCarouselIndex: (index: number, behavior?: ScrollBehavior) => void;
  export let canvasEl: HTMLCanvasElement | null = null;
  export let vizParent: HTMLDivElement | null = null;
  export let carouselViewport: HTMLOListElement | null = null;
</script>

<div class="player-shell">
  <div class="player-row">
    <button
      class={`icon-btn primary ${isPlaying ? "active" : ""}`}
      type="button"
      on:click={isPlaying ? pause : play}
      aria-label={isPlaying ? t(lang, "pause") : t(lang, "play")}
    >
      {isPlaying ? "⏸" : "▶"}
    </button>
    <div class="viz-shell" bind:this={vizParent}>
      <canvas class="viz" bind:this={canvasEl} aria-hidden="true"></canvas>
    </div>
  </div>

  <div class="control global-volume">
    <label for="global-volume-player" class="volume-label global-volume-label"
      >{t(lang, "volumeGlobal")}</label
    >
    <input
      id="global-volume-player"
      type="range"
      min="0"
      max="1"
      step="0.01"
      bind:value={volume}
    />
  </div>

  <section class="carousel" aria-label={t(lang, "radios")}>
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
                scrollToCarouselIndex(index === 0 ? streams.length - 1 : index - 1)}
            >
              {t(lang, "previous")}
            </button>
            <button
              type="button"
              class="carousel__next"
              on:click={() =>
                scrollToCarouselIndex(index === streams.length - 1 ? 0 : index + 1)}
            >
              {t(lang, "next")}
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
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
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
              aria-label={`${t(lang, "goTo")} ${s.name}`}
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
      <p class="eyebrow">
        {isPlaying ? t(lang, "statusPlaying") : t(lang, "statusPaused")}
      </p>
    </div>
    <span class="pill success">{current.credit}</span>
  </div>
</div>
