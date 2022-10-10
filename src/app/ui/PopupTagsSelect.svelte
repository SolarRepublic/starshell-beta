<script lang="ts">
	import {yw_popup, yw_context_popup, yw_store_tags} from '##/mem';
	import type { Resource } from '#/meta/resource';
	import type { Tag, TagInterface } from '#/meta/tag';

	import ActionsLine from './ActionsLine.svelte';
	import CheckboxField from './CheckboxField.svelte';
	import InlineTags from './InlineTags.svelte';

	import Row from './Row.svelte';
	import SubHeader from './SubHeader.svelte';

	// fetch the resource path from popup context store
	const p_resource = ($yw_context_popup as {
		resource: Resource.Path;
	})['resource'];

	interface TagOption {
		tag: TagInterface;
		selected: boolean;
	}

	const f_sort_tags = (g_a: TagInterface, g_b: TagInterface) => g_a.index - g_b.index;

	// cache the tags for the resource
	const as_preapplied = new Set($yw_store_tags!.getIdsFor(p_resource));
	let a_tag_options: TagOption[] = $yw_store_tags!.raw.registry.sort(f_sort_tags).map(g_tag => ({
		tag: g_tag,
		selected: as_preapplied.has(g_tag.index),
	}));

	// let h_tags_sel = oderom(H_TAGS, (p_tag, k_tag) => ({
	// 	[p_tag]: {
	// 		object: k_tag,
	// 		selected: ($yw_popup_context!.tags as Tag[]).includes(k_tag),
	// 	},
	// }));

	// ($yw_popup_context!.tags as Tag[]);

	// function select_tag(k_tag: Tag) {
	// 	$yw_popup_context!.tags = [...$yw_popup_context!.tags, k_tag];
	// 	$yw_popup = null;
	// }

	function toggle_tag(i_tag: number) {
		// find option by tag index
		const g_option = a_tag_options.find(g => i_tag === g.tag.index)!;

		// toggle selection
		g_option.selected = !g_option.selected;

		// mark as dirty
		a_tag_options = a_tag_options;
	}

	async function apply_tags() {
		// update store
		await $yw_store_tags!.setTagsFor(p_resource, a_tags);

		// dismiss popup
		$yw_popup = null;
	}
</script>

<style lang="less">
	@import './_base.less';

	.rows {
		margin-left: calc(0px - var(--ui-padding));
		margin-right: calc(0px - var(--ui-padding));
		margin-top: 1em;
		margin-bottom: 1em;
	}

	.float {
		--anti-padding: calc(0px - var(--ui-padding));
		position: sticky;
		width: 100%;
		background-color: var(--theme-color-bg);
		margin-left: var(--anti-padding);
		margin-right: var(--anti-padding);
		padding-left: var(--ui-padding);
		padding-right: var(--ui-padding);
		padding-top: var(--ui-padding);
		bottom: var(--anti-padding);
		background: linear-gradient(0deg, var(--theme-color-bg) 0%, var(--theme-color-bg) 80%, transparent);
	}
</style>

<section class="screen">
	<SubHeader title="Select Tag(s)" bare closes />

	<div class="rows">
		{#each a_tag_options as {tag:g_tag, selected:b_selected}}
			<Row
				rootStyle="--app-icon-diameter:12px;"
				iconClass='align-self_center'
				name={g_tag.name}
				on:click={() => toggle_tag(g_tag.index)}
			>
				<!-- <InlineTags collapsed={b_collapsed} slot="icon" /> -->

				<svelte:fragment slot="right">
					<CheckboxField id="tag-${g_tag.index}" bind:checked={b_selected} disableHandler />
				</svelte:fragment>
			</Row>
		{/each}

		<!-- {#each ode(h_tags_sel) as [p_tag, {object:k_tag, selected:b_selected}]}
		{/each} -->
	</div>

	<div class="float">
		<ActionsLine confirm={['Apply', apply_tags]} />

		<!-- <div class="action-line">
			<button class="primary" on:click={() => apply_tags()}>
				Apply
			</button>
		</div> -->
	</div>
</section>
