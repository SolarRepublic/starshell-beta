<script lang="ts">
	import type { Token } from "#/meta/token";
	import type { Dict } from "#/util/belt";
	import { onMount } from "svelte";
	import { yw_chain } from "../mem";
	import Row from "../ui/Row.svelte";
	import { Screen, Header, type Page } from './_screens';

	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import InlinePills, { PillItem } from "../ui/InlinePills.svelte";

	const H_REGISTRY: Dict<Token['interface'][]> = {
		'pulsar-2': [
			{
				chain: '/family.cosmos/chain.pulsar-2',
				name: 'Secret Secret',
				symbol: 'sSCRT',
				pfp: '/template.pfp/id.1',
				hash: '9587D60B8E6B078ACE12014CEEEE089530B9FABCD76535D93666A6C127AD8813',
				extra: {
					coingecko_id: 'secret',
				},
				origin: 'built-in',
				spec: 'snip-20',
				bech32: 'secret18vd8fpwxzck93qlwghaj6arh4p7c5n8978vsyg',
			},
		],
	};

	let a_staged: PillItem<Token['interface']>[] = [];

	function add_token(g_token: Token['interface']) {
		a_staged = a_staged.concat([{
			id: g_token.bech32,
			name: g_token.name,
			pfpPath: g_token.pfp,
			data: g_token,
		}]);
	}
</script>

<style lang="less">
	.staged {
		height: 100px;
	}
</style>

<Screen>
	<Header pops title='Add Tokens'
	/>

	<div class="staged">
		<InlinePills bind:items={a_staged} />
	</div>

	{#if H_REGISTRY[$yw_chain.id]}
		{#each H_REGISTRY[$yw_chain.id] as g_token}
			<Row resource={g_token} postname={g_token.symbol} pfpDim={32}
				--icon-diameter='32px'
			>
				<svelte:fragment slot="right">
					<span class="add icon text-align_right" style="--icon-diameter:22px; --icon-color:var(--theme-color-primary);" on:click={() => add_token(g_token)}>
						{@html SX_ICON_ADD}
					</span>
				</svelte:fragment>
			</Row>
		{/each}
	{/if}
</Screen>