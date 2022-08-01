<script context="module" lang="ts">
	export interface PillItem<w_data extends any=any> {
		id: string;
		pfpPath: PfpPath;
		name: string;
		data: w_data;
		color?: string;
	}
</script>

<script lang="ts">
	import {
		cubicOut,
	} from 'svelte/easing';

	import type {
		SlideParams,
		TransitionConfig,
	} from 'svelte/transition';

	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit-small.svg?raw';

	import PfpDisplay from './PfpDisplay.svelte';
	import type { PfpPath } from '#/meta/pfp';

	/**
	 * List of items being displayed
	 */
	export let items: PillItem[];

	// /**
	//  * Path to the resource to fetch tags for
	//  */
	// export let resourcePath: string;
	// const p_resource = resourcePath;

	/**
	 * Enables editting the tags here
	 */
	export let editable = false;
	const b_editable = editable;

	/**
	 * If `true`, displays the tags in collapsed form
	 */
	export let collapsed = false;
	const b_collapsed = collapsed;

	export let prefixClass = '';
	export let suffixClass = '';

	export let rootStyle = '';

	// subscribe to tag store changes and reload
	let c_reload_items = 0;
	// const f_unsubscribe = yw_store_tags.subscribe(() => c_reload_items++);
	// onDestroy(() => {
	// 	f_unsubscribe();
	// });

	// if(b_editable) {
	// 	yw_context_popup.subscribe((g_ctx: Dict<any> | null) => {
	// 		if(g_ctx?.tags) {
	// 			a_tags = g_ctx.tags;
	// 		}
	// 	});

	// 	onDestroy(() => {
	// 		$yw_context_popup= null;
	// 	});
	// }

	let dm_cluster: HTMLElement;

	function remove_item(g_item: PillItem) {
		// find item by id
		const i_item = items.findIndex(g => g.id === g_item.id);

		// remove it from the mutable list
		items.splice(i_item, 1);

		// reactively reload
		items = items;
	}


	function sslide(dm_node: Element, {
		delay: xt_delay = 0,
		duration: xt_duration = 400,
		easing: f_easing = cubicOut,
	}: SlideParams = {}): TransitionConfig {
		const d_style = getComputedStyle(dm_node);
		const x_opacity = +d_style.opacity;
		const x_width = parseFloat(d_style.width);
		const x_padding_left = parseFloat(d_style.paddingLeft);
		const x_padding_right = parseFloat(d_style.paddingRight);
		const x_margin_left = parseFloat(d_style.marginLeft);
		const x_margin_right = parseFloat(d_style.marginRight);
		const x_border_left_width = parseFloat(d_style.borderLeftWidth);
		const x_border_right_width = parseFloat(d_style.borderRightWidth);

		return {
			delay: xt_delay,
			duration: xt_duration,
			easing: f_easing,
			css: xt =>
				'--delete-display: none;' +
				'overflow: hidden;' +
				`opacity: ${Math.min(xt * 20, 1) * x_opacity};` +
				`width: ${xt * x_width}px;` +
				`padding-left: ${xt * x_padding_left}px;` +
				`padding-right: ${xt * x_padding_right}px;` +
				`margin-left: ${xt * x_margin_left}px;` +
				`margin-right: ${xt * x_margin_right}px;` +
				`border-left-width: ${xt * x_border_left_width}px;` +
				`border-right-width: ${xt * x_border_right_width}px;`
		};
	}
</script>

<style lang="less">
	@import './_base.less';

	.cluster {
		display: inline-flex;
		vertical-align: middle;
		justify-content: center;
		align-items: center;
		gap: 4px;
		flex-flow: row wrap;
		
		&.collapsed {
			margin: var(--tag-cluster-margin, 0);
			margin-top: 5px;
			justify-content: flex-start;
			display: flex;
		}

		&.editable {
			justify-content: flex-start;
			// margin: var(--tag-cluster-margin, 0 var(--ui-padding));

			>.item {
				padding-right: 2px;
			}

			 margin-top:-10px;
			 margin-bottom:5px;
		}

		>.item {
			--item-width: auto;
			--item-height: 22px;

			display: inline-flex;
			width: var(--tag-width);
			height: var(--tag-height);
			border-radius: 1em;
			padding: 0 1ch;
			font-size: 13px;

			>.label {
				margin-top: 1px;
				text-shadow: -1px 1px 1.3px rgb(0 0 0 / 40%);
			}

			// &:nth-child(n+2) {
			// 	margin-left: 8px;
			// }

			&.collapsed {
				--item-width: var(--app-tag-diameter);
				--item-height: var(--app-tag-diameter);
				padding: 0;
			}

			.delete.icon {
				--icon-diameter: 22px;
				transform: rotate(45deg);
				transition: transform 200ms ease-out, filter 200ms ease-out;
				cursor: pointer;
				filter: drop-shadow(0px 0px 0px black);
				display: var(--delete-display, initial);

				&:hover {
					transform: rotate(45deg) scale(1.075);
					filter: drop-shadow(-1px 3px 2px rgba(0, 0, 0, 0.4));
				}
			}
		}

		>.edit {
			cursor: pointer;

			>.icon {
				--icon-color: var(--theme-color-primary);
				--icon-diameter: 22px;
				display: flex;
				background-color: transparent;

				// --icon-color: var(--theme-color-primary);
				// --icon-diameter: 16px;
				// --button-diameter: 22px;
				// display: flex;
				// padding: 2px;
				// background-color: transparent;

				// margin-left: 4px;

				// &::before {
				// 	--offset: 0px;
				// 	content: "";
				// 	outline: 2px solid var(--theme-color-primary);
				// 	border-radius: var(--button-diameter);
				// 	min-width: calc(var(--button-diameter) - (2 * var(--offset)));
				// 	min-height: calc(var(--button-diameter) - (2 * var(--offset)));
				// 	margin-left: -3px;
				// 	margin-top: 1px;
				// 	position: absolute;
				// }
			}
		}

		.prefix,.suffix {
			.font(tiny);
			color: var(--theme-color-text-light);
			display: inline-flex;
			text-align: center;
		}
	}
</style>

<span class="cluster" class:editable={b_editable} class:collapsed={b_collapsed} bind:this={dm_cluster} style={rootStyle}>
	{#if $$slots.prefix}
		<span class="prefix {prefixClass}">
			<slot name="prefix"></slot>
		</span>
	{/if}

	{#key c_reload_items}
		{#each items as g_item, i_item}
			<span class="item" style="background-color:{g_item.color || 'transparent'};" class:collapsed={b_collapsed} out:sslide={{duration:b_editable? 300: 0}}>
				{#if g_item.pfpPath}
					<PfpDisplay dim={16} circular={true} name={g_item.name} ref={g_item.pfpPath} />
				{/if}

				{#if !b_collapsed}
					<span class="label">
						{g_item.name}
					</span>
				{/if}

				{#if b_editable}
					<span class="delete icon" on:click={() => remove_item(g_item)}>
						{@html SX_ICON_ADD}
					</span>
				{/if}
			</span>
		{/each}
	{/key}

	{#if $$slots.suffix}
		<span class="suffix {suffixClass}">
			<slot name="suffix"></slot>
		</span>
	{/if}
</span>