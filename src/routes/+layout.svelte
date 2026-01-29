<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href="/favicon.webp" />
  <meta name="theme-color" content="#e9eef5" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta
    name="description"
    content="AUDIHOME — contrôle audio multi-pièces avec streaming, visualisation et réglages d'atténuation par zone."
  />
  <meta property="og:title" content="AUDIHOME" />
  <meta
    property="og:description"
    content="Contrôle audio multi-pièces avec streaming, visualisation et réglages d'atténuation par zone."
  />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="/bg.webp" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

{@render children()}
