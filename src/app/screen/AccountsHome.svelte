<script lang="ts">
	import type { Account, AccountInterface, AccountPath } from '#/meta/account';
	import type { SecretInterface } from '#/meta/secret';
	import { Accounts } from '#/store/accounts';
	import { Chains } from '#/store/chains';
	import { Secrets } from '#/store/secrets';

	import { yw_chain } from '../mem';
	import { load_page_context } from '../svelte';
	import Address from '../ui/Address.svelte';
	import Row from '../ui/Row.svelte';
	import AccountCreate from './AccountCreate.svelte';
	import AccountView from './AccountView.svelte';

	import {
		Screen,
		Header,
		SubHeader,
	} from './_screens';

	const {
		k_page,
	} = load_page_context();

	const hm_secrets = new Map<AccountInterface, SecretInterface>();

	let a_accounts: [AccountPath, AccountInterface][];
	async function load_accounts(): Promise<typeof a_accounts> {
		const ks_accounts = await Accounts.read();

		a_accounts = ks_accounts.entries();

		await Promise.all(a_accounts.map(async([, g_account]) => {
			hm_secrets.set(g_account, await Secrets.metadata(g_account.secret)!);
		}));

		return a_accounts;
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

	<SubHeader bare
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
					{@const g_secret = hm_secrets.get(g_account)}
					{@const sa_owner = Chains.addressFor(g_account.pubkey, $yw_chain)}
					<Row
						resource={g_account}
						resourcePath={p_account}
						address={sa_owner}
						iconClass={'square pfp'}
						on:click={() => k_page.push({
							creator: AccountView,
							props: {
								accountPath: p_account,
							},
						})}
					>
						<svelte:fragment slot="detail">
							<div class="hd-path">
								StarShell
								{#if 'bip32_node' === g_secret?.type}
									- {g_secret.bip44}
								{/if}
							</div>

							<Address address={sa_owner} />
						</svelte:fragment>
					</Row>
				{/each}
			{/key}
		{/await}
	</div>
</Screen>