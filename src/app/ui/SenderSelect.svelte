<script lang="ts">
	import {yw_account_ref} from '##/mem';
	import type {Account, AccountStruct, AccountPath} from '#/meta/account';
	import {Accounts} from '#/store/accounts';
	import {oderac} from '#/util/belt';
	import { createEventDispatcher } from 'svelte';
    import Load from './Load.svelte';

	const dispatch = createEventDispatcher();

	import StarSelect, {type SelectOption} from './StarSelect.svelte';

	export let accountPath: AccountPath = $yw_account_ref;
	// const p_account = accountPath;


	const mk_account = (p_acc: AccountPath, g_acc: AccountStruct) => ({
		value: p_acc,
		primary: g_acc.name,
		secondary: g_acc.extra?.total_fiat_cache || '(?)',
		// secondary: format_fiat(g_acc.holdings(H_HOLDINGS, $yw_chain)
			// .reduce((c_sum, k_holding) => c_sum + k_holding.toUsd(H_TOKENS, H_VERSUS_USD), 0)),
	});

	let g_selected: SelectOption<AccountPath>;  // = mk_account($yw_account_ref, $yw_account);
	let a_options: typeof g_selected[];

	// reactively update the exported account ref binding
	$: if(g_selected) {
		accountPath = g_selected.value;
	}

	async function load_accounts() {
		const ks_accounts = await Accounts.read();

		a_options = oderac(ks_accounts.raw, mk_account);
		g_selected = a_options.find(g => accountPath === g.value)!;

		setTimeout(() => {
			dispatch('load');
		}, 5);

		return a_options;
	}
</script>


<style lang="less">
	@import '_base.less';
</style>


<div class="sender">
	{#await load_accounts()}
		<Load forever />
	{:then a_options}
		<StarSelect id="sender-select"
			placeholder="Select account"
			secondaryClass='balance'
			items={a_options}
			bind:value={g_selected}
		/>
	{/await}
</div>