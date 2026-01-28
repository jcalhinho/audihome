<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href="/favicon.webp" />
  <meta name="theme-color" content="#e9eef5" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
