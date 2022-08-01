<script lang="ts">
	import type { TokenSpecKey } from '#/meta/token';

	import { Entities, TokenDict } from '#/store/entities';
	import { Dict, forever, ode, oderom, Promisable } from '#/util/belt';
	import { getContext } from 'svelte';
	import { yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_popup, yw_context_popup, popup_receive, yw_network, yw_network_active, yw_owner } from '../mem';
	import Portrait from '../ui/Portrait.svelte';
	import Send from './Send.svelte';
	import PopupReceive from '../ui/PopupReceive.svelte';
	import Row from '../ui/Row.svelte';
	import { Header, Screen, type Page } from './_screens';
	import { Chains } from '#/store/chains';
	import { CoinGecko } from '#/store/web-apis';
	import { format_amount, format_fiat } from '#/util/format';
	import type { Coin } from 'cosmos-grpc/dist/cosmos/base/v1beta1/coin';
	import type { Chain, NativeCoin } from '#/meta/chain';
	import type { Values } from '#/meta/belt';
	import BigNumber from 'bignumber.js';
	import Address from '../ui/Address.svelte';
	import Gap from '../ui/Gap.svelte';
	import { open_external_link } from '#/util/dom';
	import TokensAdd from './TokensAdd.svelte';
	import { as_amount, to_fiat } from '#/chain/coin';
	import HoldingView from './HoldingView.svelte';
	import type { BalanceBundle } from '#/store/networks';
	import { syserr } from '../common';
	import { Accounts } from '#/store/accounts';

	// $: sa_owner = Chains.addressFor($yw_account.pubkey, $yw_chain);

	const merge_fungible_tokens = (h_fungibles: Record<TokenSpecKey, TokenDict>) => oderom(h_fungibles, (_, h) => h);

	// get page from context
	const k_page = getContext<Page>('page');

	let yg_total = new BigNumber(0);
	let c_balances = 0;
	let b_balances_ready = true;
	let a_no_gas: string[] = [];

	let fk_resolve_total: (s_total: string) => void;
	let dp_total = new Promise<string>((fk_resolve) => {
		fk_resolve_total = fk_resolve;
	});

	let g_chain_cached = $yw_chain;
	$: {
		if($yw_chain !== g_chain_cached) {
			g_chain_cached = $yw_chain;
			yg_total = new BigNumber(0);
			c_balances = 0;
			dp_total = new Promise<string>((fk_resolve) => {
				fk_resolve_total = fk_resolve;
			});
			a_no_gas = [];
		}
	}


	function check_total() {
		c_balances -= 1;
		if(b_balances_ready && !c_balances) {
			const s_total = format_fiat(yg_total.toNumber(), 'usd');
			fk_resolve_total(s_total);

			// save to cache
			const g_account = $yw_account;
			void Accounts.open(ks => ks.put({
				...g_account,
				extra: {
					total_fiat_cache: s_total,
				},
			}));
		}
	}

	type Submitter = (z_out: Promisable<BigNumber>) => Promise<BigNumber>;

	// async function with_balance<w_value>(dp_thing: Promisable<w_value>): Promise<[w_value, Submitter]> {
	// 	c_balances += 1;

	// 	const w_value = await dp_thing;

	// 	return [
	// 		w_value,
	// 		async(z_out: Promisable<BigNumber>): Promise<BigNumber> => {
	// 			const yg_balance = await z_out;

	// 			yg_total = yg_total.plus(yg_balance);

	// 			check_total();
	// 			return yg_balance;
	// 		},
	// 	];
	// }

	async function load_native_balances() {
		let h_balances: Dict<BalanceBundle>;
		try {
			h_balances = await $yw_network_active.bankBalances($yw_owner);
		}
		catch(e_network) {
			syserr({
				error: e_network as Error,
				text: 'Network error',
			});
			return [];
		}

		const a_outs: [string, NativeCoin, Coin, Submitter][] = [];

		for(const [si_coin, g_coin] of ode($yw_chain.coins)) {
			const g_bundle = h_balances[si_coin];

			if(!g_bundle || '0' === g_bundle.balance.amount) {
				a_no_gas.push(si_coin);
			}

			c_balances += 1;

			a_outs.push([
				si_coin,
				$yw_chain.coins[si_coin],
				g_bundle?.balance || {amount:'0', denom:g_coin.denom},
				async(z_out: Promisable<BigNumber>): Promise<BigNumber> => {
					const yg_balance = await z_out;

					yg_total = yg_total.plus(yg_balance);

					check_total();
					return yg_balance;
				},
			]);
		}

		if(!a_outs.length) {
			c_balances += 1;
			check_total();
		}

		a_no_gas = a_no_gas;

		return a_outs;
	}


	const H_FAUCETS = {
		'theta-testnet-001': 'https://discord.com/channels/669268347736686612/953697793476821092',
		'pulsar-2': 'https://faucet.secrettestnet.io/',
	};
</script>

<style lang="less">
	@import './_base.less';

	.testnet-reminder {
		.font(tiny);
		text-align: center;
		color: var(--theme-color-text-med);
		transform: scaleX(1.25);
		margin-bottom: calc(0px - var(--ui-padding) - var(--inline-padding));
	}

	.subinfo {
		border-top: 1px solid var(--theme-color-border);
		padding-top: var(--ui-padding);
	}

	.no-gas {
		display: flex;
		flex-direction: column;
		gap: var(--inline-padding);
		.message {
			.font(tiny);
		}
	}

	.owner-address {
	}

</style>

<Screen debug='HoldingsHome' nav root keyed>

	<Header search network account >
		<svelte:fragment slot="title">

		</svelte:fragment>
	</Header>

	{#if $yw_chain.testnet}
		<div class="testnet-reminder no-margin">
			TESETNET
		</div>
	{/if}

	<!-- title={format_fiat(x_usd_balance)} -->
	<Portrait
		noPfp
		title={dp_total}
		subtitle={$yw_account.name}
		resource={$yw_account}
		resourcePath={$yw_account_ref}
		actions={{
			send: {
				label: 'Send',
				trigger() {
					k_page.push({
						creator: Send,
						props: {
							from: $yw_account,
						},
					});
				},
			},
			recv: {
				label: 'Receive',
				trigger() {
					popup_receive($yw_account_ref);
				},
			},
			// add: {
			// 	label: 'Add Token',
			// 	trigger() {
			// 		k_page.push({
			// 			creator: TokensAdd,
			// 		});
			// 	},
			// },
		}}
	/>

	{#key $yw_chain}
		{#if a_no_gas.length}
			<div class="no-gas text-align_center subinfo">
				<div class="message">
					<span class="warning">Warning:</span> you don't have any {$yw_chain.testnet? 'testnet ':''}{a_no_gas.join(' or ')} to pay gas fees.
				</div>

				<div class="buttons">
					{#if $yw_chain.testnet}
						<button class="pill" on:click={() => open_external_link(H_FAUCETS[$yw_chain.id])}>Get {a_no_gas.join(' or ')} from faucet</button>
					{:else}
						<button class="pill">Buy {a_no_gas.join(' or ')}</button>
					{/if}
				</div>
			</div>
		{/if}

		<div class="owner-address subinfo">
			<Address address={$yw_owner} copyable='text' />
		</div>
	{/key}


	<Gap />

	<!-- {#key a_holdings}
		<HoldingsList holdings={a_holdings} />
	{/key} -->

	{#key $yw_network_active}
		<div class="rows no-margin">
			<!-- native coin(s) -->
			{#await load_native_balances()}
				{#each ode($yw_chain.coins) as [si_coin, g_bundle]}
					{@const p_entity = Entities.holdingPathFor($yw_owner, si_coin)}
					<Row lockIcon detail='Native Coin'
						name={si_coin}
						pfp={$yw_chain.pfp}
						amount={forever('')}
						on:click={() => {
							k_page.push({
								creator: HoldingView,
								props: {
									entityRef: p_entity,
								},
							});
						}}
					/>
				{/each}
			{:then a_balances}
				{#each a_balances as [si_coin, g_coin, g_balance, f_submit]}
				{@const p_entity = Entities.holdingPathFor($yw_owner, si_coin)}
					{@const g_resource = {
						name: si_coin,
						pfp: $yw_chain.pfp,
					}}
					{@const dp_worth = f_submit(to_fiat(g_balance, g_coin))}
					<Row lockIcon detail='Native Coin'
						resourcePath={p_entity}
						resource={g_resource}
						amount={as_amount(g_balance, g_coin)}
						fiat={dp_worth.then(yg => format_fiat(yg.toNumber(), 'usd'))}
						on:click={() => {
							k_page.push({
								creator: HoldingView,
								props: {
									entityRef: p_entity,
								},
							});
						}}
					/>
				{/each}
			{/await}


			{#await Entities.readFungibleTokens($yw_chain)}
				Loading tokens...
			{:then h_fungibles}
				{#each ode(merge_fungible_tokens(h_fungibles)) as [p_token, g_token]}
					{g_token.spec}
				{/each}
			{/await}
		</div>
	{/key}
</Screen>
