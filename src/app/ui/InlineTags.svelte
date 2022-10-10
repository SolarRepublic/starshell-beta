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

	import {
		yw_popup,
		yw_context_popup,
		yw_store_tags,
	} from '##/mem';

	import PopupTagsSelect from './PopupTagsSelect.svelte';
	import type {Tags} from '#/store/tags';
	import {onDestroy} from 'svelte';
	import type {Dict} from '#/meta/belt';
	import type {Tag} from '#/meta/tag';

	/**
	 * Path to the resource to fetch tags for
	 */
	export let resourcePath: string;
	const p_resource = resourcePath;

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
	let c_reload_tags = 0;
	const f_unsubscribe = yw_store_tags.subscribe(() => c_reload_tags++);
	onDestroy(() => {
		f_unsubscribe();
	});

	// cache the tags store for editting
	let ks_tags: InstanceType<typeof Tags>;

	// cache the list of tags for this resource
	$: a_tags = $yw_store_tags!.getTagsFor(p_resource);
	// let a_tags: TagInterface[];

	// // fetch tags for the given resource
	// async function resource_tags() {
	// 	// load media store if it's not cached
	// 	ks_tags = $yw_store_tags || await Tags.read();

	// 	// destructure tags store
	// 	const {
	// 		registry: a_registry,
	// 		map: h_map,
	// 	} = ks_tags.raw;

	// 	// lookup resource tag ids and save to cache
	// 	return a_tags=(h_map[p_resource] ?? []).map(i_tag => a_registry[i_tag]);
	// }

	if(b_editable) {
		yw_context_popup.subscribe((g_ctx: Dict<any> | null) => {
			if(g_ctx?.tags) {
				a_tags = g_ctx.tags;
			}
		});

		onDestroy(() => {
			$yw_context_popup= null;
		});
	}

	function show_tag_selector() {
		$yw_context_popup= {
			resource: p_resource,
		};

		$yw_popup = PopupTagsSelect;
	}

	let dm_cluster: HTMLElement;

	async function remove_tag(g_tag: TagInterface) {
		// find tag by id
		const i_tag = a_tags.findIndex(g => g.index === g_tag.index);

		// (qsa(dm_cluster, '.delete.icon')[Math.min(tags.length - 1, i_tag + 1)] as HTMLElement).style.display = 'none';

		// remove it from the mutable list
		a_tags.splice(i_tag, 1);

		// save it back to the store
		await ks_tags.save();
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
			css: xt => '--delete-display: none;'
				+ 'overflow: hidden;'
				+ `opacity: ${Math.min(xt * 20, 1) * x_opacity};`
				+ `width: ${xt * x_width}px;`
				+ `padding-left: ${xt * x_padding_left}px;`
				+ `padding-right: ${xt * x_padding_right}px;`
				+ `margin-left: ${xt * x_margin_left}px;`
				+ `margin-right: ${xt * x_margin_right}px;`
				+ `border-left-width: ${xt * x_border_left_width}px;`
				+ `border-right-width: ${xt * x_border_right_width}px;`,
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

			>.tag {
				padding-right: 2px;
			}

			 margin-top:-10px;
			 margin-bottom:5px;
		}

		>.tag {
			--tag-width: auto;
			--tag-height: 22px;

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
				--tag-width: var(--app-tag-diameter);
				--tag-height: var(--app-tag-diameter);
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

	{#key c_reload_tags}
		{#each a_tags as g_tag, i_tag}
			<span class="tag" style="background-color:{g_tag.color};" class:collapsed={b_collapsed} out:sslide={{duration:b_editable? 300: 0}}>
				{#if !b_collapsed}
					<span class="label">
						{g_tag.name}
					</span>
				{/if}

				{#if b_editable}
					<span class="delete icon" on:click={() => remove_tag(g_tag)}>
						{@html SX_ICON_ADD}
					</span>
				{/if}
			</span>
		{/each}
	{/key}

	{#if b_editable}
		<span class="edit" on:click={() => show_tag_selector()}>
			<span class="icon">
				{@html SX_ICON_EDIT}
			</span>
		</span>
	{/if}

	{#if $$slots.suffix}
		<span class="suffix {suffixClass}">
			<slot name="suffix"></slot>
		</span>
	{/if}
</span>