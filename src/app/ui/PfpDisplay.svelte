<script lang="ts">
	import type { PfpPath } from '#/meta/pfp';

	import Put from './Put.svelte';
	import { Pfps } from '#/store/pfps';
	import { Medias } from '#/store/medias';
	import {yw_store_medias} from '../mem';
	import type { Nameable, Pfpable } from '#/meta/able';
	import { F_NOOP } from '#/util/belt';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	/**
	 * Extract ref and name from a resource
	 */
	export let resource: (Pfpable & Nameable) | null = null;
	const g_resource = resource;

	/**
	 * Resource path to the pfp
	 */
	export let ref: PfpPath | null | '' = g_resource?.pfp || '';

	/**
	 * Name to use for alt and fallback
	 */
	export let name = g_resource?.name || '';
	const s_name = name;

	/**
	 * Square dimensions of the output element
	 */
	export let dim: number;
	const x_dim = dim;

	/**
	 * Applies a predetermind styling to the border
	 */
	export let circular = false;
	const s_classes = circular? '': 'square';

	/**
	 * Applies a predetermined styling to the background
	 */
	export let bg: 'satin' | undefined = void 0;
	const si_style_bg = bg;

	export let genStyle = '';
	const sx_style_gen = `width:${x_dim}px; height:${x_dim}px; `
		+(genStyle || '')
		+(ref? `font-size:${x_dim}px;`: '')
		+(circular? `border-radius:${x_dim}px;`: '');

	export let rootStyle = '';
	const sx_style_root = rootStyle;

	export let settle: VoidFunction | undefined = void 0;

	async function load_pfp() {
		// load media store if it's not cached
		const ks_medias = $yw_store_medias || await Medias.read();

		// load pfp by ref
		const dm_pfp = await Pfps.load(ref as PfpPath, {
			alt: s_name,
			dim: x_dim,
			medias: ks_medias,
		});

		queueMicrotask(() => {
			dispatch('loaded');
		});

		return dm_pfp;
	}

	function settle_inner(): Promise<never> {
		if(settle) queueMicrotask(() => settle!());
		return new Promise(F_NOOP);
	}
</script>

<style lang="less">
	@import './_base.less';

	.tile {
		display: inline-flex;
		vertical-align: middle;
		line-height: 0;
		cursor: pointer;

		&.satin {
			background: radial-gradient(ellipse farthest-side at bottom right, #07080a, #0f1317);
		}
	}

	// .icon {
	// 	&.default {
	// 		// background-color: var(--theme-color-graysoft);
	// 		background-color: var(--theme-color-bg);
	// 		background: radial-gradient(ellipse farthest-side at bottom right, darken(@theme-color-black, 50%), var(--theme-color-bg));
	// 		outline: 1px solid var(--theme-color-primary);
	// 	}
	// }

	.icon-dom {
		color: var(--theme-color-text-light);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30px;

		background-color: var(--theme-color-bg);
		background: radial-gradient(ellipse farthest-side at bottom right, darken(@theme-color-black, 50%), var(--theme-color-bg));
		outline: 1px solid var(--theme-color-border);
	}
</style>

<!-- class:default={!k_icon}  -->
<span class="global_pfp tile {s_classes}"
	class:satin={'satin' === si_style_bg}
	style={sx_style_root}
	data-path={ref}
>
	{#if ref}
		{#await load_pfp()}
			Loading pfp...
		{:then dm_pfp}
			{#if dm_pfp}
				<Put element={dm_pfp} />
			{:else}
				<!-- TODO: error placeholder -->
				<span class="error">
					Error
				</span>
			{/if}

			{#await settle_inner() then _}_{/await}
		{/await}
	{:else}
		<span class="icon-dom" style={sx_style_gen}>
			{s_name[0] || ''}
		</span>
		{#await settle_inner() then _}_{/await}
	{/if}
</span>