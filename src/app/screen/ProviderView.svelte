<script lang="ts">
	import {Chains} from '#/store/chains';
	
	import {Header, Screen} from './_screens';
	import Portrait from '##/ui/Portrait.svelte';
	import type {ProviderInterface, ProviderPath} from '#/meta/provider';
	import {Providers} from '#/store/providers';
	import type {ChainInterface, ChainPath} from '#/meta/chain';
	import Field from '../ui/Field.svelte';
	import Info from '../ui/Info.svelte';
	import Gap from '../ui/Gap.svelte';


	export let providerPath: ProviderPath;
	const p_provider = providerPath;

	let g_provider: ProviderInterface;
	void Providers.at(p_provider).then(g => g_provider = g!);

	$: p_chain = g_provider?.chain;

	let g_chain: ChainInterface;
	$: if(p_chain) {
		void Chains.at(p_chain as ChainPath).then(g => g_chain = g!);
	}

	const gc_actions = {
		// send: {
		// 	label: 'Send',
		// 	trigger() {
		// 		k_page.push({
		// 			creator: Send,
		// 			props: {
		// 				to: Chains.bech32(g_provider.address),
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
		// 				contactRef: p_provider,
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
		Loading provider...
	{:else}
		<Portrait
			resource={g_provider}
			resourcePath={p_provider}
			actions={gc_actions}
		>
			<svelte:fragment slot="subtitle">
				<span class="font-family_mono">
					{g_chain.name} ({g_chain.reference})
				</span>
			</svelte:fragment>address
		</Portrait>

		<Field
			name='gRPC-web URL'
			key='grpc-web'
		>
			<Info key='grpc-web-value'>
				{g_provider.grpcWebUrl}
			</Info>
		</Field>

		{#if g_provider.rpcHost}
			<Field
				name='RPC Host'
				key='rpc'
			>
				<Info key='rpc-value'>
					{g_provider.rpcHost}
				</Info>
			</Field>
		{/if}
	{/if}

	<Gap />

</Screen>