<script lang="ts">
	import type {AccountStruct, AccountPath} from '#/meta/account';
	import type {Promisable} from '#/meta/belt';
	import type {Bech32} from '#/meta/chain';
	import type {SecretStruct} from '#/meta/secret';
	
	import {Screen, Header} from './_screens';
	import {popup_receive, yw_chain} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {Secrets} from '#/store/secrets';
	import {forever, proper} from '#/util/belt';
	
	import AccountEdit from './AccountEdit.svelte';
	import AddressResourceControl from './AddressResourceControl.svelte';
	import Send from './Send.svelte';
	import Gap from '../ui/Gap.svelte';
	import Portrait from '../ui/Portrait.svelte';
    import IncidentsList from '../ui/IncidentsList.svelte';
	

	const {k_page} = load_page_context();

	export let accountPath: AccountPath;
	const p_account = accountPath;

	let g_account: AccountStruct;
	let g_secret: SecretStruct;


	let s_header_post_title: Promisable<string> = forever('');
	$: {
		if(g_account && $yw_chain) {
			s_header_post_title = proper(g_account.family);
		}
	}

	// reactively assign account address for current chain
	$: sa_owner = g_account?.pubkey? Chains.addressFor(g_account.pubkey, $yw_chain): forever('' as Bech32);

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
		postTitle={s_header_post_title}
		subtitle={`on ${$yw_chain.name}`}
	></Header>

	{#await load_account()}
		<Portrait loading
			resourcePath={p_account}
			actions={gc_actions}
		/>
	{:then}
		<Portrait
			resource={g_account}
			resourcePath={p_account}
			actions={gc_actions}
		>
			<svelte:fragment slot="subtitle">
				
			</svelte:fragment>
		</Portrait>

		<!-- account address on this chain -->
		<AddressResourceControl address={sa_owner} />
	{/await}

	<Gap />

	<IncidentsList filterConfig={{
		account: accountPath,
	}} />
</Screen>