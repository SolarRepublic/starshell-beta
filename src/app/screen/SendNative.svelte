<script context="module" lang="ts">

</script>

<script lang="ts">
	import type { Account, AccountPath } from "#/meta/account";
	import type { Bech32 } from "#/meta/chain";
	import type { Contact } from "#/meta/contact";
	import { Accounts } from "#/store/accounts";
	import { Agents } from "#/store/agents";
	import { Chains } from "#/store/chains";
	import { Events } from "#/store/events";
	import { CoinGecko } from "#/store/web-apis";
	import { format_fiat } from "#/util/format";
	import BigNumber from "bignumber.js";

	import { getContext, onMount } from "svelte";
	import { ThreadId } from "../def";
	import { yw_chain, yw_navigator, yw_network_active } from "../mem";
	import ActionsLine from "../ui/ActionsLine.svelte";
	import Address from "../ui/Address.svelte";
	import Field from "../ui/Field.svelte";
	import { Screen, Header, type Page } from './_screens';

	const k_page = getContext<Page>('page');

	/**
	 * Native coin id
	 */
	export let coin: string;
	const si_coin = coin;

	const g_coin = $yw_chain.coins[si_coin];

	export let accountRef: AccountPath;
	let g_account: Account['interface'];
	let sa_sender: Bech32.String;

	export let amount: string;
	const s_amount = amount;

	export let recipient: Bech32.String;
	const sa_recipient = recipient;

	let s_recipient_title = '';

	let g_contact: Contact['interface'] | null;

	export let fee: string;
	const s_fee = fee;

	$: s_total = new BigNumber(s_amount).plus(fee).toString();

	export let memo: string;

	let x_worth = 0;

	(async(fk_resolve) => {
		const si_coingecko = g_coin.extra?.coingecko_id || '';

		if(si_coingecko) {
			const h_versus = await CoinGecko.coinsVersus([si_coingecko], 'usd', 0);
			x_worth = h_versus[si_coingecko];
		}
	})();

	(async() => {
		const ks_accounts = await Accounts.read();

		g_account = ks_accounts.at(accountRef)!;
		sa_sender = Chains.addressFor(g_account.pubkey);

		const p_contact = Agents.pathForContact(sa_recipient);
		g_contact = await Agents.getContact(p_contact);

		s_recipient_title = g_contact?.name || '';
	})();

	async function approve() {
		const xg_amount = BigInt(new BigNumber(s_amount).shiftedBy(g_coin.decimals).toString());

		const g_attempt = await $yw_network_active.bankSend(sa_sender, sa_recipient, si_coin, xg_amount, memo);

		// prepend pending event to events store
		await Events.insert({
			type: 'pending',
			time: Date.now(),
			data: g_attempt,
		});

		// reset page
		k_page.reset();

		// activate history thread
		void $yw_navigator.activateThread(ThreadId.HISTORY);
	}

</script>

<style lang="less">
	@import './_base.less';

	.title {

	}

	.subtitle {
		.font(tiny);
		color: var(--theme-color-text-med);
	}

	.empty-memo {
		.font(tiny);
		font-style: italic;
		color: var(--theme-color-text-med);
	}
</style>

<Screen debug='SendNative' slides>
	<Header pops exits
		on:close={() => k_page.reset()}
		title='Sending'
		symbol={si_coin}
		subtitle={$yw_chain.name}
	/>

	<Field short
		key='sender'
		name='From'
	>
		<div class="title">
			{g_account?.name || '[...]'}
		</div>

		<div class="subtitle">
			{g_account?.extra?.total_fiat_cache || '(?)'}
		</div>
	</Field>

	<hr>

	<Field short
		key='recipient'
		name='To'
	>
		<div class="title">
			{s_recipient_title || '[...]'}
		</div>

		<div class="subtitle">
			<Address address={sa_recipient} />
		</div>
	</Field>

	<hr>

	<Field short
		key='amount'
		name='Amount'
	>
		<div class="title">
			{s_amount} {si_coin}
		</div>

		<div class="subtitle">
			{#if x_worth}
				{format_fiat(new BigNumber(s_amount).times(x_worth).toNumber())}
			{:else}
				=[...]
			{/if}
		</div>
	</Field>

	<hr>
	
	<Field short
		key='fee-review'
		name='Fee'
	>
		<div class="title">
			{s_fee} {si_coin}
		</div>

		<div class="subtitle">
			{#if x_worth}
				{format_fiat(new BigNumber(s_fee).times(x_worth).toNumber())}
			{:else}
				=[...]
			{/if}
		</div>
	</Field>

	<hr>
	
	<Field short
		key='total'
		name='Total'
	>
		<div class="title">
			{s_total || '[...]'} {si_coin}
		</div>

		<div class="subtitle">
			{#if x_worth}
				{format_fiat(new BigNumber(s_total).times(x_worth).toNumber())}
			{:else}
				=[...]
			{/if}
		</div>
	</Field>

	<hr>
	
	<Field short
		key='memo'
		name='Memo'
	>
		{#if memo}
			<textarea disabled>{memo}</textarea>
		{:else}
			<span class="empty-memo">(empty)</span>
		{/if}
	</Field>


	<ActionsLine back confirm={['Approve', () => approve()]} />

</Screen>
