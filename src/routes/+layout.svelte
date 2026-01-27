<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/drag.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#e9eef5" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<svg style="position: absolute; width: 0; height: 0; pointer-events: none" aria-hidden="true">
	<filter id="glass-noise" x="0%" y="0%" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
		<feGaussianBlur in="noise" stdDeviation="0.02" result="blur" />
		<feDisplacementMap in="SourceGraphic" in2="blur" scale="70" xChannelSelector="R" yChannelSelector="G" />
	</filter>
	<filter id="morph-liquid" x="-20%" y="-20%" width="140%" height="140%">
		<feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="9" result="turb">
			<animate attributeName="baseFrequency" values="0.007;0.012;0.007" dur="8s" repeatCount="indefinite" />
		</feTurbulence>
		<feDisplacementMap in="SourceGraphic" in2="turb" scale="40" xChannelSelector="R" yChannelSelector="G" />
	</filter>
</svg>

{@render children()}
