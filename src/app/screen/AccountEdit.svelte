<script lang="ts">
	import { getContext } from 'svelte';

	import type { Completed } from '#/entry/flow';

	import type {Account, AccountPath} from '#/meta/account';
	import type {Bech32} from '#/meta/chain';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {yw_account_ref, yw_chain} from '../mem';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Address from '../ui/Address.svelte';
	import Field from '../ui/Field.svelte';
	import InlineTags from '../ui/InlineTags.svelte';
	import Info from '##/ui/Info.svelte';
	import {Screen, type Page} from './_screens';


	export let account: AccountPath;
	const p_account = account;

	let g_account: Account['interface'];

	let s_name = '';
	let sa_account: Bech32.String;

	$: b_form_valid = !!s_name;

	$: sa_account = g_account? Chains.addressFor(g_account.pubkey, $yw_chain): '';

	const completed = getContext<Completed | undefined>('completed');
	const k_page = getContext<Page>('page');

	async function load_account() {
		const ks_accounts = await Accounts.read();
		g_account = ks_accounts.at(p_account)!;
		s_name = g_account.name;
	}

	async function save_account() {
		Object.assign(g_account, {
			name: s_name,
		});

		await Accounts.open(ks_accounts => ks_accounts.put(g_account));

		// editted active account; reload
		if(p_account === $yw_account_ref) {
			$yw_account_ref = p_account;
		}

		if(completed) {
			completed(true);
		}
		else {
			k_page.reset();
		}
	}

	// function save() {
	// 	if(!b_form_valid) return;

	// 	const g_save = {
	// 		label: accountName,
	// 		tagRefs: a_tags.map(k => k.def.iri),
	// 	};

	// 	if(account) {
	// 		Object.assign(account.def, g_save);

	// 		restart();

	// 		if(Tasks.ADD_TAG === $yw_task) {
	// 			setTimeout(() => {
	// 				$yw_task = -$yw_task;
	// 			}, 1200);
	// 		}
	// 	}
	// 	else {
	// 		const gd_account = Account.Def.fromConfig({
	// 			...g_save,
	// 			pubkey: sa_account.replace(/^\w+1/g, ''),
	// 			iconRef: p_icon,
	// 		});

	// 		const k_account = H_ACCOUNTS[gd_account.iri] = new Account(gd_account);

	// 		restart();

	// 		push_screen(AccountView, {
	// 			account: k_account,
	// 		});
	// 	}
	// }

</script>

<Screen>
	<h3>
		{account? 'Edit': 'New'} account
	</h3>

	{#await load_account()}
		Loading accounts...
	{:then}
		<Field key="profile-icon" name="Profile icon">
			<!-- <IconEditor intent='person' iconRef={p_icon} /> -->
		</Field>

		<Field key="account-name" name="Name">
			<input id="account-name" type="text" bind:value={s_name} placeholder="Satoshi">
		</Field>

		<!-- <Field key="account-path" name="Derivation path">
			<Info key="account-path">
				m/44'/118'/0'/0/{Object.values(H_ACCOUNTS).length}
			</Info>
		</Field> -->

		<Field key="account-address" name="Public address">
			<Info address key="account-address">
				<Address copyable address={sa_account} />
			</Info>
		</Field>
<!-- 
		<Field key="account-tags" name="Add tags">
			<InlineTags editable resourcePath={p_account} />
		</Field> -->

		<ActionsLine cancel={!completed} back confirm={['Finish', save_account, !b_form_valid]} />

		<!-- <div class="action-line clickable">
			<button on:click={() => pop()}>
				Cancel
			</button>

			<button class="primary" readonly={!b_form_valid} on:click={() => save()}>
				Finish
			</button>
		</div> -->
	{/await}
</Screen>