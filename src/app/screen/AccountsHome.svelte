<script lang="ts">
	import type { Account, AccountPath } from '#/meta/account';
	import { Accounts } from '#/store/accounts';
	import { Chains } from '#/store/chains';

	import { getContext } from 'svelte';
	import { yw_chain } from '../mem';
	import Address from '../ui/Address.svelte';
	import Row from '../ui/Row.svelte';
	import AccountCreate from './AccountCreate.svelte';
	import AccountView from './AccountView.svelte';

	import {
		Screen,
		Header,
		SubHeader,
		type Page,
	} from './_screens';

	const k_page = getContext<Page>('page');

	let a_accounts: [AccountPath, Account['interface']][];
	async function load_accounts(): Promise<typeof a_accounts> {
		const ks_accounts = await Accounts.read();

		return a_accounts = ks_accounts.entries();
	}
</script>

<style lang="less">
	@import './_base.less';

	.hd-path {
		:global(&) {
			.font(tiny);
			color: var(--theme-color-text-med);
		}
	}
</style>

<Screen debug='Accounts' nav root>
	<Header search network account
	>
	</Header>

	<SubHeader
		title="Accounts"
	/>
		<!-- on:add_new={() => k_page.push({
			creator: AccountCreate,
		})} -->

	<div class="rows no-margin">
		{#await load_accounts()}
			Loading...
		{:then}
			{#key $yw_chain}
				{#each a_accounts as [p_account, g_account]}
					{@const sa_owner = Chains.addressFor(g_account.pubkey)}
					<Row
						resource={g_account}
						resourcePath={p_account}
						address={sa_owner}
						iconClass={'square pfp'}
						on:click={() => k_page.push({
							creator: AccountView,
							props: {
								accountRef: p_account,
							},
						})}
					>
						<svelte:fragment slot="detail">
							<div class="hd-path">
								StarShell - - m/44'/118'/0'/0/??
								<!-- StarShell - m/44'/118'/0'/0/{+g_account.id-1} -->
							</div>

							<Address address={sa_owner} />
						</svelte:fragment>
					</Row>
				{/each}
			{/key}
		{/await}
	</div>
</Screen>