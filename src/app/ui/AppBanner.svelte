<script lang="ts">
	import {createEventDispatcher} from 'svelte';

	import type {AppInterface} from '#/meta/app';
	import PfpDisplay from './PfpDisplay.svelte';
	import Close from './Close.svelte';
	import type {ChainInterface} from '#/meta/chain';
	import type {AccountInterface} from '#/meta/account';
import { text_to_base64 } from '#/util/data';

	export let app: AppInterface;

	export let chain: ChainInterface | null = null;

	export let account: AccountInterface | null = null;

	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}
</script>

<style lang="less">
	@import './_base.less';

	.column {
		display: flex;
		flex-flow: column;
		align-items: center;
		justify-content: center;
	}

	.app-info {
		background-color: var(--theme-color-black);
		position: relative;

		.aura {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: black;

			img {
				object-fit: cover;
				width: 100%;
				height: 100%;
				opacity: 0.66;
			}
		}

		.content {
			position: relative;
			gap: 8px;
			padding: calc(1.75 * var(--ui-padding));
			padding-bottom: calc(1.25 * var(--ui-padding));
			border-bottom: 1px solid fade(black, 80%);
		}

		.bubbles {
			display: flex;
			flex-flow: row-reverse;
			position: relative;

			// safari fix
			height: 72px;

			// helps center the display on safari
			margin-left: auto;
			margin-right: auto;

			.context {
				position: relative;
				display: flex;
				align-items: center;
				aspect-ratio: 1;
				padding: 16px;
				border-radius: 51%;
				border: 1px solid transparent;
				background-color: fade(black, 63%);
				z-index: 2;

				&.overlap {
					margin-left: -10px;
				}

				&.thru {
					border: none;
					margin-left: 1em;
					margin-right: 1em;
					background-color: transparent;

					// safari fix
					height: auto;

					&::before {
						border: none !important;
					}
				}

				&::before {
					content: "\a0";

					// safari has trouble with 100%, use hard-coded, precomputed dimensinos
					width: 72px;
					height: 72px;

					position: absolute;
					// offset for the 1px transparent border set in non-pseudo element
					left: -1px;
					top: -1px;
					border-radius: 50%;
					border: 1px solid white;
					opacity: 0.2;
				}
			}

			.thru-line {
				border-top: 2px dotted var(--theme-color-border);
				content: "\a0";
				width: calc(100% - 60px);
				position: absolute;
				top: calc(50% - 1px);
				left: 30px;
				z-index: 1;
			}
		}

		.host {
			padding: 5px 12px;
			border-radius: 8px;
			// background-color: fade(black, 20%);
			// border: 1px solid black;

			.name {
				.font(tiny);
				color: var(--theme-color-graymed);
			}
		}
	}
	
	.request-summary {
		text-align: center;
		margin: calc(0.5 * var(--ui-padding)) calc(2 * var(--ui-padding));

		.name {
			color: var(--theme-color-blue);
			font-weight: 500;
		}

		.context {
			.font(tiny);
			color: var(--theme-color-text-med);
		}
	}
</style>

<div class="app-info no-margin">
	{#if account?.extra?.aura}
		<div class="aura">
			<!-- svelte-ignore a11y-missing-attribute -->
			<img src={`data:image/svg+xml;base64,${text_to_base64(account.extra.aura)}`}>
		</div>
	{/if}

	<div class="content column">

		<div class="bubbles">
			{#if chain}
				{#if account}
					<span class="context">
						<PfpDisplay dim={40} resource={chain} />
					</span>
					<span class="context thru">
						<PfpDisplay dim={40} resource={account} rootStyle='border:1px solid rgba(255,255,255,0.08); border-radius:9px;' />
					</span>
					<span class="context">
						<PfpDisplay dim={40} resource={app} />
					</span>
					<span class="thru-line">&nbsp;</span>
				{:else}
					<span class="context overlap">
						<PfpDisplay dim={40} resource={chain} />
					</span>
					<span class="context underlap">
						<PfpDisplay dim={40} resource={app} />
					</span>
				{/if}
			{:else if account}
				<span class="context overlap">
					<PfpDisplay dim={40} resource={account} />
				</span>
				<span class="context underlap">
					<PfpDisplay dim={40} resource={app} />
				</span>
			{:else}
				<span class="context">
					<PfpDisplay dim={40} resource={app} />
				</span>
			{/if}
		</div>

		<div class="host column">
			<span class="origin">
				{app.host}
			</span>
			<span class="name">
				{#if chain}
					{chain.name}
				{:else if account}
					{account.name}
				{:else}
					{app.name}
				{/if}
			</span>
		</div>

		<Close absolute bgColor='#000000' on:click={() => close()} />
	</div>
</div>

{#if $$slots.default}
	<div class="request-summary no-margin">
		<slot />

		{#if $$slots.context}
			<div class="context no-margin">
				<slot name="context" />
			</div>
		{/if}
	</div>
{/if}
