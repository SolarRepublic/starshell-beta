<script lang="ts">
	import {Screen} from './_screens';

	import type {AppInterface} from '#/meta/app';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import AppBanner from '../ui/AppBanner.svelte';
	import type {Caip2, ChainInterface} from '#/meta/chain';
	import type {SessionRequest} from '#/meta/api';
	import {Accounts} from '#/store/accounts';
	import type {AccountInterface, AccountPath} from '#/meta/account';
	import Row from '../ui/Row.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	import {fodemtv, F_NOOP, ode, oderac} from '#/util/belt';
	import type {Dict} from '#/meta/belt';
	import {yw_account_ref} from '../mem';
	import RequestConnectionPermissions from './RequestConnection_Permissions.svelte';
	import { load_flow_context } from '../svelte';


	const {
		completed,
		k_page,
	} = load_flow_context();

	export let app: AppInterface;

	export let chains: Record<Caip2.String, ChainInterface>;
	const h_chains = chains;

	const g_single_chain = 1 === Object.keys(h_chains).length? Object.values(h_chains)[0]: null;

	export let sessions: Dict<SessionRequest>;

	function connect() {
		completed(true);
	}

	type AccountMap = Record<AccountPath, AccountInterface>;

	let h_accounts: AccountMap;

	
	// selected state of each account
	let h_selected: Record<AccountPath, boolean> = {};

	$: b_none_selected = Object.values(h_selected).every(b => !b);

	async function load_accounts() {
		const ks_accounts = await Accounts.read();
		h_accounts = ks_accounts.raw;

		// only one account; skip screen automatically
		if(Object.keys(h_accounts).length) {
			k_page.push({
				creator: RequestConnectionPermissions,
				props: {
					app,
					chains,
					sessions,
					accounts: Object.values(h_accounts),
				},
			});
		}

		h_selected = fodemtv(h_accounts, (g_account, p_account) => p_account === $yw_account_ref);
	}
</script>

<Screen>
	{#if g_single_chain}
		<AppBanner {app} chain={Object.values(h_chains)[0]} on:close={() => completed(false)}>
			Which accounts do you want to use on<br><strong>{Object.values(h_chains)[0].name}</strong> with this app?
		</AppBanner>
	{:else}
		<AppBanner {app} on:close={() => completed(false)}>
			Which accounts do you want to use?
		</AppBanner>
	{/if}


	<div class="rows no-margin">
		{#await load_accounts()}
			Loading accounts...
		{:then}
			{#each ode(h_accounts) as [p_account, g_account]}
				<Row
					name={g_account.name}
					pfp={g_account.pfp}
					on:click={toggleChildCheckbox}
				>
					<CheckboxField id={p_account} slot='right' checked={h_selected[p_account]}
						on:change={({detail:b_checked}) => h_selected[p_account] = b_checked} />
				</Row>
			{/each}
		{/await}
	</div>

	<ActionsLine cancel={() => completed(false)} confirm={['Next', F_NOOP, b_none_selected]} contd={{
		creator: RequestConnectionPermissions,
		props: {
			app,
			chains,
			sessions,
			accounts: oderac(h_selected, (p, b) => b? p: void 0).map(p => h_accounts[p]),
		},
	}} />
</Screen>
