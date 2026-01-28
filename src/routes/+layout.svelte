<script lang="ts">
  import favicon from "$lib/assets/favicon.png";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <meta name="theme-color" content="#e9eef5" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
