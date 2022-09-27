<script type="ts">
	import {fade} from 'svelte/transition';
	import {quintOut} from 'svelte/easing';

	import SX_ICON_INFO from '#/icon/info.svg?raw';
	import {yw_blur, yw_curtain} from '../mem';

	export let showing = false;

	export let overlayStyle = '';

	// $: $yw_blur = b_showing;
	$: $yw_curtain = showing;
</script>

<style lang="less">
	@import './_base.less';

	.tooltip {
		position: relative;
		vertical-align: text-bottom;
		z-index: 15;

		.global_svg-icon {
			color: var(--theme-color-primary);

			&.showing {
				background-color: black;
				border-radius: 4px;
				box-shadow: 0 0 13px 7px balck;
			}
		}

		.tooltip-overlay {
			background-color: fade(black, 82%);
			border-radius: 12px;
			padding: 1.25em 1.5em;

			box-shadow: 0px 1px 22px 1px fade(@theme-color-yellow, 17%);
			border: 1px solid fade(@theme-color-yellow, 17%);

			position: absolute;
			top: 28px;
			width: 75vw;
			font-size: 13px;
		}

		.overlay {
			position: absolute;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			background-color: fade(black, 20%);
		}
	}

</style>

<span class="tooltip">
	<span class="global_svg-icon icon-diameter_20px" on:click={() => showing = !showing} class:highlight={showing}>
		{@html SX_ICON_INFO}
	</span>

	{#if showing}
		<div class="tooltip-overlay" style={overlayStyle} transition:fade={{duration:300, easing:quintOut}}>
			<slot />
		</div>
	{/if}
</span>
