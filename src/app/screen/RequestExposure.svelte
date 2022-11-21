<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	
	import type {Bech32} from '#/meta/chain';
	
	import {load_app_context, produce_contracts} from '../svelte';
	
	import {Accounts} from '#/store/accounts';
	
	import Screen from '../container/Screen.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	
	import TokenRow from '../frag/TokenRow.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Tooltip from '../ui/Tooltip.svelte';


	const g_context = load_app_context();
	const {
		g_app,
		p_app,
		p_chain,
		g_chain,
		p_account,
		completed,
		k_page,
	} = g_context;

	export let bech32s: Bech32[];

	const dp_account = Accounts.at(p_account) as Promise<AccountStruct>;

	const s_title = 'Expose Viewing Key';

	let b_tooltip_showing = false;

	const b_plural = 1 !== bech32s.length;

	function cancel() {

	}

	async function load_contracts() {
		return await produce_contracts(bech32s, g_chain, g_app);
	}
</script>


<Screen>
	{#await dp_account}
		<AppBanner app={g_app} chain={g_chain} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				{s_title}
			</span>
			<span slot="context" style="display:contents;">
				[...]
			</span>
		</AppBanner>
	{:then g_account}
		<AppBanner app={g_app} chain={g_chain} account={g_account} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				<!-- let the title appear with the tooltip -->
				<span style="position:relative; z-index:16;">
					{s_title}
				</span>
				<Tooltip bind:showing={b_tooltip_showing}>
					Once you share {b_plural? 'these': 'this'} viewing key{b_plural? 's': ''} with the app, it will be able to view your private balance and transfer history forever, or until you rotate {b_plural? 'their': 'its'} viewing key{b_plural? 's': ''}.
				</Tooltip>
			</span>
			<span slot="context" style="display:contents;">
				{g_account?.name || ''}
			</span>
		</AppBanner>
	{/await}
	
	{#await load_contracts()}
		<LoadingRows count={bech32s.length} />
	{:then a_contracts}
		{#each a_contracts as g_contract}
			<TokenRow contract={g_contract} />
		{/each}
	{/await}
</Screen>