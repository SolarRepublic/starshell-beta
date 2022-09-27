<script lang="ts">
	import type {Account, AccountInterface, AccountPath} from '#/meta/account';
	import type { SecretInterface } from '#/meta/secret';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import { Secrets } from '#/store/secrets';

	import {popup_receive, yw_chain} from '../mem';
	import { load_page_context } from '../svelte';
	import Address from '../ui/Address.svelte';
	import Portrait from '../ui/Portrait.svelte';
	import AccountEdit from './AccountEdit.svelte';
	import Send from './Send.svelte';

	import {Screen, Header} from './_screens';

	const {k_page} = load_page_context();

	export let accountPath: AccountPath;
	const p_account = accountPath;

	let g_account: AccountInterface;
	let g_secret: SecretInterface;

	async function load_account() {
		const ks_accounts = await Accounts.read();

		g_account = ks_accounts.at(p_account)!;
		g_secret = await Secrets.metadata(g_account.secret)!;
	}

	const gc_actions = {
		send: {
			label: 'Send',
			trigger() {
				k_page.push({
					creator: Send,
					props: {
						from: Chains.addressFor(g_account.pubkey, $yw_chain),
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
						accountPath: p_account,
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
				<Address copyable address={Chains.addressFor(g_account.pubkey, $yw_chain)} />
			</svelte:fragment>
		</Portrait>
	{/await}

</Screen>