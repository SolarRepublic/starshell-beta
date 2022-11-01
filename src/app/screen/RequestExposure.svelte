<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	
	import {load_app_context} from '../svelte';
	
	import {Accounts} from '#/store/accounts';
	
	import Screen from '../container/Screen.svelte';
	import AppBanner from '../ui/AppBanner.svelte';
	import Tooltip from '../ui/Tooltip.svelte';


	const g_context = load_app_context();
	const {
		g_app,
		p_app,
		g_chain,
		p_account,
		completed,
		k_page,
	} = g_context;

	const dp_account = Accounts.at(p_account) as Promise<AccountStruct>;

	const s_title = '';

	let b_tooltip_showing = false;

	function cancel() {

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
					Viewing key tooltip text
				</Tooltip>
			</span>
			<span slot="context" style="display:contents;">
				{g_account?.name || ''}
			</span>
		</AppBanner>
	{/await}
	
</Screen>