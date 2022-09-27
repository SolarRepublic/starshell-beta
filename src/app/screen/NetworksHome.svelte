<script lang="ts">
	import {Chains} from '#/store/chains';
	import {Networks} from '#/store/networks';
	import {getContext} from 'svelte';
	import Header from '../ui/Header.svelte';
	import Row from '../ui/Row.svelte';
	import NetworkView from './NetworkView.svelte';
	import {Screen, SubHeader, type Page} from './_screens';

	const k_page = getContext<Page>('page');

	let ks_chains: Awaited<ReturnType<typeof Chains.read>>;
	let ks_networks: Awaited<ReturnType<typeof Networks.read>>;
	async function load_networks() {
		[
			ks_chains,
			ks_networks,
		] = await Promise.all([
			Chains.read(),
			Networks.read(),
		]);

		return ks_networks.entries();
	}

	// function add_new_network() {
	// 	k_page.push({
	// 		creator: NetworkCreate,
	// 	});
	// }
</script>

<style lang="less">
	
</style>

<Screen debug='NetworksHome' nav root>
	<Header search network account />

	<SubHeader bare
		title='Networks'
	/>
		<!-- on:add_new={add_new_network} -->

	<div class="rows no-margin">
		{#await load_networks()}
			Loading...
		{:then a_networks} 
			{#each a_networks as [p_network, g_network]}
				{@const g_chain = ks_chains.at(g_network.chain)}
				<Row
					resource={g_network}
					resourcePath={p_network}
					iconClass={'square pfp'}
					detail={`${g_chain?.name} (${g_chain?.reference})`}
					on:click={() => {
						k_page.push({
							creator: NetworkView,
							props: {
								networkRef: p_network,
							},
						});
					}}
				>
				</Row>
			{/each}
		{/await}
	</div>
</Screen>