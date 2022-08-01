<script lang="ts">
	import type {Account, AccountPath} from '#/meta/account';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';

	import {getContext} from 'svelte';
	import {popup_receive} from '../mem';
	import Address from '../ui/Address.svelte';
	import Portrait from '../ui/Portrait.svelte';
	import AccountEdit from './AccountEdit.svelte';
	import Send from './Send.svelte';

	import {
		Screen,
		Header,
		type Page,
	} from './_screens';

	export let accountRef: AccountPath;
	const p_account = accountRef;

	let g_account: Account['interface'];

	const k_page = getContext<Page>('page');


	async function load_account(): Promise<Account['interface']> {
		const ks_accounts = await Accounts.read();

		return g_account = ks_accounts.at(p_account)!;
	}

	const gc_actions = {
		send: {
			label: 'Send',
			trigger() {
				k_page.push({
					creator: Send,
					props: {
						from: Chains.addressFor(g_account.pubkey),
					},
				});
			},
		},
		recv: {
			label: 'Receive',
			trigger() {
				popup_receive(p_account);
			},
		},
		edit: {
			label: 'Edit',
			trigger() {
				k_page.push({
					creator: AccountEdit,
					props: {
						account: p_account,
					},
				});
			},
		},
	};

</script>

<!-- 
<svelte:fragment slot="pfp">
	{#if H_ICONS[account.def.iconRef]}
		<Put element={H_ICONS[account.def.iconRef].render()} />
	{:else}
		<span class="pfp-gen">
			{account.def.label[0]}
		</span>
	{/if}
</svelte:fragment> -->

<Screen nav>
	<Header pops search network
		title="Account"
	></Header>

	{#await load_account()}
		Loading...
	{:then}
		<Portrait
			resource={g_account}
			resourcePath={p_account}
			actions={gc_actions}
		>
			<svelte:fragment slot="subtitle">
				<Address copyable address={Chains.addressFor(g_account.pubkey)} />
			</svelte:fragment>
		</Portrait>
	{/await}

</Screen>