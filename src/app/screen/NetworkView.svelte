<script lang="ts">
	import {yw_account, yw_chain} from '##/mem';
	import { Chains } from '#/store/chains';
	import { getContext } from 'svelte';
	
	import { Header, type Page, Screen } from '../screen/_screens';
	import Portrait from '##/ui/Portrait.svelte';
	import type { Network, NetworkPath } from '#/meta/network';
	import { Networks } from '#/store/networks';
	import type { Chain, ChainPath } from '#/meta/chain';
import Field from '../ui/Field.svelte';
import Info from '../ui/Info.svelte';
import Gap from '../ui/Gap.svelte';


	export let networkRef: NetworkPath;
	const p_network = networkRef;

	let g_network: Network['interface'];
	void Networks.at(p_network).then(g => g_network = g!);

	$: p_chain = g_network?.chain;

	let g_chain: Chain['interface'];
	$: if(p_chain) {
		void Chains.at(p_chain as ChainPath).then(g => g_chain = g!);
	}

	const k_page = getContext<Page>('page');

	const gc_actions = {
		// send: {
		// 	label: 'Send',
		// 	trigger() {
		// 		k_page.push({
		// 			creator: Send,
		// 			props: {
		// 				to: Chains.bech32(g_network.address),
		// 			},
		// 		});
		// 	},
		// },
		// edit: {
		// 	label: 'Edit',
		// 	trigger() {
		// 		k_page.push({
		// 			creator: ContactEdit,
		// 			props: {
		// 				contactRef: p_network,
		// 			},
		// 		});
		// 	},
		// },
		// delete: {
		// 	label: 'Delete',
		// 	trigger() {
		// 		k_page.push({
		// 			creator: DeadEnd,
		// 		});
		// 	},
		// },
	};

</script>

<style lang="less">
	@import '_base.less';


	.pfp-gen {
		.font(huge, @size: 30px);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 20%;
		outline: 1px solid var(--theme-color-primary);
		background: radial-gradient(ellipse farthest-side at bottom right, #07080a, #0f1317);
	}
</style>


<Screen nav slides>
	<Header pops search network account />

	{#if !g_chain}
		Loading network...
	{:else}
		<Portrait
			resource={g_network}
			resourcePath={p_network}
			actions={gc_actions}
		>
			<svelte:fragment slot="subtitle">
				<span class="font-family_mono">
					{g_chain.name} ({g_chain.id})
				</span>
			</svelte:fragment>address
		</Portrait>

		<Field
			name='gRPC-web URL'
			key='grpc-web'
		>
			<Info key='grpc-web-value'>
				{g_network.grpcWebUrl}
			</Info>
		</Field>

		{#if g_network.rpcHost}
			<Field
				name='RPC Host'
				key='rpc'
			>
				<Info key='rpc-value'>
					{g_network.rpcHost}
				</Info>
			</Field>
		{/if}
	{/if}

	<Gap />

</Screen>