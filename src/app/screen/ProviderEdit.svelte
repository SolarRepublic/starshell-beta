<script lang="ts">
	import type {Provider, ProviderInterface} from '#/meta/provider';
import { Chains } from '#/store/chains';

	import Portrait from '../ui/Portrait.svelte';

	import {
		Screen,
		Header,
	} from './_screens';


	export let provider: ProviderInterface;
	const g_provider = provider;

	// Address,
	// 	Portrait,
	// 	Put,
	// 	Row,


	// const k_chain = H_CHAINS[g_provider.chain];
	export const networkId = network.def.id;
	export const chainId = k_chain.def.id;

</script>

<style lang="less">

</style>


<Screen nav slides>
	<Header pops search network account
	>
	</Header>

	{#await Chains.read()}
		Loading chains....
	{:then ks_chains}
		{@const g_chain = ks_chains.at(g_provider.chain)}

		<Portrait
			resource={g_provider}
		>
			<!-- subtitle={g_chain.def.label} -->
		</Portrait>
	{/await}



</Screen>