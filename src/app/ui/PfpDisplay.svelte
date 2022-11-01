<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {createEventDispatcher} from 'svelte';
	
	import {yw_store_medias} from '../mem';
	
	import {Medias} from '#/store/medias';
	import {Pfps} from '#/store/pfps';
	import {F_NOOP} from '#/util/belt';
	
	import Put from './Put.svelte';
	
	

	const dispatch = createEventDispatcher();

	/**
	 * Extract ref and name from a resource
	 */
	export let resource: (Pfpable & Nameable) | null = null;

	/**
	 * Resource path to the pfp
	 */
	export let path: PfpTarget | null | '' = resource?.pfp || '';

	/**
	 * Name to use for alt and fallback
	 */
	export let name = resource?.name || '';

	/**
	 * Square dimensions of the output element
	 */
	export let dim: number;

	/**
	 * Applies a predetermind styling to the border
	 */
	export let circular = false;
	export let appRelated = false;
	export let classes = '';
	const s_classes = (circular? '': appRelated? 'square app': 'square')+classes;

	export let updates = 0;

	/**
	 * Applies a predetermined styling to the background
	 */
	export let bg: 'satin' | undefined = void 0;
	const si_style_bg = bg;

	export let genStyle = '';

	// const sx_style_border_radius = (circular? `border-radius:${dim}px;`: '');

	const sx_style_gen = `width:${dim}px; height:${dim}px; `
		+(genStyle || '')
		+(path? `font-size:${dim}px;`: `font-size:${dim * 0.55}px;`);

	export let rootStyle = '';
	const sx_style_root = rootStyle;

	// fallback dom style to use for icon-dom element
	const sx_dom_style = sx_style_gen+`font-size:${dim * 0.55}px;`;

	export let settle: VoidFunction | undefined = void 0;

	async function load_pfp() {
		// load media store if it's not cached
		const ks_medias = $yw_store_medias || await Medias.read();

		// load pfp by ref
		const dm_pfp = await Pfps.load(path!, {
			alt: name,
			dim: dim,
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

		.error {
			text-align: center;
		}

		&.app {
			outline: 1px solid var(--theme-color-border);
			border-radius: 4px;
		}

		&.circular {
			border-radius: 50%;

			img {
				:global(&) {
					border-radius: 50%;
				}
			}
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
{#key updates || path || name || dim}
	<span class="global_pfp tile {s_classes}"
		class:satin={'satin' === si_style_bg}
		class:circular={circular}
		style={sx_style_root}
		data-path={path}
	>
		{#if path}
			{#await load_pfp()}
				<span class="icon-dom global_loading dynamic-pfp" style={sx_dom_style} data-pfp-args={JSON.stringify({
					alt: name,
					dim: dim,
				})}>
					⊚
				</span>
			{:then dm_pfp}
				{#if dm_pfp}
					<Put element={dm_pfp} />
				{:else}
					<!-- fallback to icon dom -->
					<span class="icon-dom" style={sx_dom_style}>
						{name[0] || ''}
					</span>

					<!-- TODO: error placeholder -->
					<!-- <span class="error">
						⚠️
					</span> -->
				{/if}

				{#await settle_inner() then _}_{/await}
			{/await}
		{:else}
			<span class="icon-dom" style={sx_style_gen}>
				{name[0] || ''}
			</span>
			{#await settle_inner() then _}_{/await}
		{/if}
	</span>
{/key}