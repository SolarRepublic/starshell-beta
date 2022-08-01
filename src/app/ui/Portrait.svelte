<script context="module" lang="ts">
	export enum ActionId {
		SEND = 'send',
		RECV = 'recv',
		ADD = 'add',
		EDIT = 'edit',
		WRAP = 'wrap',
		UNWRAP = 'unwrap',
	}

	export interface ActionConfig {
		label: string;
		trigger: VoidFunction;
	}

	export type Actions = Partial<Record<ActionId, ActionConfig>>;
</script>

<script lang="ts">
	import {ode, Promisable} from '#/util/belt';
	
	import SX_ICON_SEND from '#/icon/send.svg?raw';
	import SX_ICON_RECV from '#/icon/recv.svg?raw';
	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import SX_ICON_INFO from '#/icon/info.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit.svg?raw';
	import SX_ICON_DELETE from '#/icon/delete.svg?raw';
	import SX_ICON_WRAP from '#/icon/wrap.svg?raw';
	import SX_ICON_UNWRAP from '#/icon/unwrap.svg?raw';

	import type { Resource } from '#/meta/resource';
	import type { Pfp, PfpPath } from '#/meta/pfp';
	import PfpDisplay from './PfpDisplay.svelte';
	import type { Nameable, Pfpable } from '#/meta/able';
	import { yw_store_tags } from '../mem';
	import InlineTags from './InlineTags.svelte';

	const H_ACTION_ICONS: Record<string, string> = {
		send: SX_ICON_SEND,
		recv: SX_ICON_RECV,
		add: SX_ICON_ADD,
		edit: SX_ICON_EDIT,
		wrap: SX_ICON_WRAP,
		unwrap: SX_ICON_UNWRAP,
		delete: SX_ICON_DELETE,
	};

	/**
	 * Extract pfp and name from a resource
	 */
	export let resource: (Pfpable & Nameable) | null = null;

	/**
	 * Infer pfp from resource
	 */
	export let pfp: PfpPath | '' = resource?.pfp || '';
	// const p_pfp = pfp;

	/**
	 * Set to true to use a circular pfp
	 */
	export let circular = false;
	const b_circular = circular;

	/**
	 * Set to true to disable pfp
	 */
	export let noPfp = false;
	const b_no_pfp = noPfp;

	/**
	 * Path to the resource
	 */
	export let resourcePath: string;
	const p_resource = resourcePath;

	// reactively load tags for this resource
	$: a_tags = $yw_store_tags!.getTagsFor(p_resource);

	export let rootClasses = '';
	const s_classes = rootClasses;

	export let title: Promisable<string> = resource?.name || '';

	export let subtitle = '';

	/**
	 * Configure which actions are available to this resource
	 */
	export let actions: null | Partial<Actions> = null;
	const h_actions = actions as Actions;


	export let info = false;


</script>

<style lang="less">
	@import './_base.less';

	.portrait {
		display: flex;
		flex-direction: column;
		padding-top: 1em;

		>.pfp {
			width: 100%;
			text-align: center;
			margin-bottom: 10px;
			
			>.icon {
				--icon-diameter: 64px;

				.group {
					:global(&) {
						transform: scale(1.5);
					}
				}

				img {
					:global(&) {
						border-radius: 20%;
					}
				}
			}
		}

		>.title {
			.font(huge);
			display: flex;
			justify-content: center;
			gap: 4px;
			white-space: nowrap;
			overflow: scroll;
			.hide-scrollbar();

			>.info {
				fill: var(--theme-color-primary);
				vertical-align: baseline;

				>svg {
					:global(&) {
						margin-top: -4px;
						vertical-align: middle;
						width: 20px;
						height: 20px;
					}
				}
			}
		}

		>.subtitle {
			.font(regular);
			text-align: center;
			color: var(--theme-color-text-med);
			margin-top: 4px;
		}

		>.actions {
			display: flex;
			justify-content: center;
			margin-top: 1rem;
			margin-bottom: 1rem;

			>.action {
				.font(tiny);

				cursor: pointer;
				flex: 0;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 5px;

				color: var(--theme-color-text-med);
				min-width: calc(48px + 3.5ex);

				>.icon {
					--button-diameter: 48px;
					--icon-diameter: 20px;
					background-color: var(--theme-color-border);

					display: inline-flex;
					justify-content: center;
					align-items: center;
				}

				&:hover {
					>.icon {
						--icon-color: black;
						background-color: var(--theme-color-primary);
					}
				}
			}
		}
	}
</style>


<div class="portrait {s_classes}" data-path={p_resource}>
	{#if !b_no_pfp}
		<div class="pfp">
			{#if $$slots.pfp}
				<span class="icon">
					<slot name="pfp">
						Empty pfp slot
					</slot>
				</span>
			{:else}
				<PfpDisplay ref={pfp} resource={resource} dim={64} circular={b_circular} />
			{/if}
		</div>
	{/if}
	<div class="title">
		<span class="text">
			{#await title}
				...
			{:then s_title}
				{s_title}
			{/await}
		</span>
		{#if info}
			<span class="info">
				{@html SX_ICON_INFO}
			</span>
		{/if}
	</div>
	{#if subtitle || $$slots.subtitle}
		<div class="subtitle">
			<span class="text">
				<slot name="subtitle">
					{subtitle}
				</slot>
			</span>
		</div>
	{/if}

	<InlineTags resourcePath={p_resource} rootStyle='margin: var(--ui-padding) 0 0 0;' />

	{#if h_actions}
		<div class="actions">
			{#each ode(h_actions) as [si_action, gc_action]}
				<span class="action action-{si_action}" on:click={() => gc_action.trigger()}>
					<span class="icon">
						{@html H_ACTION_ICONS[si_action]}
					</span>
					<span class="label">
						{gc_action.label}
					</span>
				</span>
			{/each}
		</div>
	{/if}

	
</div>