<script lang="ts">
	import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
	
	import type {CoinInfo, HoldingPath} from '#/meta/chain';
	import type {IncidentStruct, IncidentType} from '#/meta/incident';
	import type {PfpTarget} from '#/meta/pfp';
	
	import BigNumber from 'bignumber.js';
	import {getContext} from 'svelte';
	
	import {Header, Screen, type Page} from './_screens';
	import {yw_chain, yw_chain_ref, yw_network} from '../mem';
	
	import {coin_formats, parse_coin_amount} from '#/chain/coin';
	import {XT_MINUTES} from '#/share/constants';
	import {Chains} from '#/store/chains';
	import {Entities} from '#/store/entities';
	import {Incidents} from '#/store/incidents';
	import {format_amount, format_fiat} from '#/util/format';
	
	import HoldingWrap from './HoldingWrap.svelte';
	import Send from './Send.svelte';
	import IncidentsList from '../frag/IncidentsList.svelte';
	import Portrait, {type Actions} from '../frag/Portrait.svelte';
	import Gap from '../ui/Gap.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	
	import SX_ICON_PERSONAL from '#/icon/account_box.svg?raw';
	import SX_ICON_CONTRACT from '#/icon/analytics.svg?raw';
	import SX_ICON_RECV from '#/icon/recv.svg?raw';
	import SX_ICON_SEND from '#/icon/send.svg?raw';
    import StakingResourceControl from '../frag/StakingResourceControl.svelte';
	

	const k_page = getContext<Page>('page');

	/**
	 * Entity path should be either a holding or token
	 */
	export let holdingPath: HoldingPath;
	const p_holding = holdingPath;


	// the coin's id and object (if its a coin)
	let si_coin = '';
	let g_coin: CoinInfo | null = null;


	// its pfp
	let p_pfp: PfpTarget | '' = '';

	// its SYMBL
	let s_symbol = '';

	// its name
	let s_name = '';
	
	// the amount the owner holds
	let yg_amount: BigNumber | null = null;

	// the equivalent in fiat
	let s_fiat = '';

	// the fiat worth of exactly 1 coin
	let s_worth = '';


	// const x_versus_usd = H_VERSUS_USD[p_token].value;


	async function load_entity() {
		const ks_entities = await Entities.read();

		const g_info = Entities.parseEntityPath(p_holding);

		if(!g_info) {
			throw new Error(`Attempted to load holding view on non-entity path "${p_holding}"`);
		}

		// destructure
		({
			coin: si_coin,
		} = g_info);

		// lookup details from chain
		const p_chain = g_info.chainRef;
		const g_chain = p_chain === $yw_chain_ref? $yw_chain: (await Chains.at(p_chain))!;
		g_coin = g_chain.coins[si_coin];

		// set details
		s_symbol = si_coin;
		s_name = g_coin.name;
		p_pfp = g_coin.pfp;

		// read cache
		const g_cached = $yw_network.cachedCoinBalance(g_info.bech32, si_coin);

		let g_balance: Coin;

		// cache is within asking time
		if(g_cached && g_cached.timestamp >= Date.now() - (2 * XT_MINUTES)) {
			g_balance = g_cached.data;
		}
		else {
			// destructure balance
			({
				balance: g_balance,
			} = await $yw_network.bankBalance(g_info.bech32, si_coin));
		}

		// set amount
		yg_amount = new BigNumber(g_balance.amount).shiftedBy(-g_coin.decimals);

		// set fiat amount asynchronously
		void coin_formats(g_balance, g_coin).then((g_formats) => {
			s_fiat = format_fiat(g_formats.fiat, g_formats.versus);
			s_worth = format_fiat(g_formats.worth, g_formats.versus);
		});
	}

	void load_entity();


	// the set of actions available on this asset
	const gc_actions: Actions = {
		send: {
			trigger() {
				k_page.push({
					creator: Send,
					props: {
						assetPath: p_holding,
					},
				});
			},
		},

		wrap: {
			trigger() {
				k_page.push({
					creator: HoldingWrap,
					props: {
						si_coin,
					},
				});
			},
		},
	};

	
	// const a_allowances = gd_token.allowances.map((g_allowance) => {
	// 	const k_spender = H_ADDR_TO_CONTRACT[g_allowance.spender];
	// 	if(!k_spender) {
	// 		debugger;
	// 	}

	// 	let s_amount;
	// 	const yg_amount = new BigNumber(g_allowance.amount);
	// 	if(yg_amount.isGreaterThan(new BigNumber('1000000000000000000'))) {
	// 		s_amount = 'Limitless';
	// 	}
	// 	else {
	// 		format_amount(k_token.approx(BigInt(g_allowance.amount)));
	// 	}

	// 	let s_expiry;
	// 	const x_expires = g_allowance.expiration;
	// 	if(x_expires) {
	// 		const dt_when = new Date(x_expires * 1e3);

	// 		s_expiry = dt_when.toLocaleDateString('en-US', {
	// 			month: 'short',
	// 			day: 'numeric',
	// 			year: dt_when.getFullYear() !== (new Date()).getFullYear()? 'numeric': void 0,
	// 		});
	// 	}
	// 	else {
	// 		s_expiry = 'Never expires';
	// 	}

	// 	return {
	// 		...g_allowance,
	// 		k_spender,
	// 		s_amount,
	// 		s_expiry,
	// 	};
	// });

	const AS_TXN_TYPES = new Set<IncidentType>(['tx_in', 'tx_out']);

	async function load_incidents() {
		const a_incidents: IncidentStruct[] = [];

		const ks_incidents = await Incidents.read();
		for(const [, g_incident] of ks_incidents.entries()) {
			// skip non-transaction incidents
			if(!AS_TXN_TYPES.has(g_incident.type)) continue;

			const {
				events: h_events,
				chain: p_chain,
			} = (g_incident as IncidentStruct<'tx_in' | 'tx_out'>).data;

			// skip incidents from other chains
			if(p_chain !== $yw_chain_ref) continue;

			for(const g_event of h_events.transfer || []) {
				const [, si_parsed] = parse_coin_amount(g_event.amount, $yw_chain);

				if(si_parsed === si_coin) {
					a_incidents.push(g_incident);
				}
			}
		}

		return a_incidents;
	}
</script>

<style lang="less">
	@import '../_base.less';

	.txns {
		.row .icon {
			:global(&) {
				color: var(--theme-color-text-light);
				border-radius: 32px;
			}
		}
	}

	.section {
		margin: 0;

		.bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: var(--ui-padding);

			.left {
				display: flex;
				flex-direction: column;
				gap: 0.5ex;

				>.title {
					.font(regular);
				}

				>.info {
					.font(tiny);
					color: var(--theme-color-text-med);
				}
			}

			.right {

			}
		}
	}

	.txn-type.icon {
		vertical-align: middle;
		--icon-diameter: 18px;
		--icon-color: var(--theme-color-text-med);
	}
</style>

<Screen debug='HoldingView' nav slides>
	<Header pops account network
		title={s_symbol}
		subtitle={s_name}
	>
		<svelte:fragment slot="title">

		</svelte:fragment>
	</Header>

	<Portrait
		pfp={p_pfp}
		resource={g_coin || null}
		resourcePath={p_holding}
		title={yg_amount? `${format_amount(yg_amount.toNumber())} ${s_symbol}`: '...'}
		subtitle={`${s_fiat} (${s_worth} per coin)`}
		actions={gc_actions}
		circular
	/>

<!-- 
	<div class="resource-controls">
		<StakingResourceControl si_coin={si_coin} />
	</div> -->

	<Gap />

	<div class="txns no-margin">
		{#await load_incidents()}
			<LoadingRows count={3} />
		{:then a_incidents}
			<IncidentsList incidents={a_incidents} />
		{/await}

		<!-- {#if k_ibct_native}
			<div class="section">
				<div class="bar">
					<span class="left">
						<div class="label">
							Stake
						</div>
						<div class="info">
							Earn up to 24% per year
						</div>
					</span>
					<span class="right">
						<button class="pill">
							Stake {gd_token.symbol}
						</button>
					</span>
				</div>
			</div>
			 -->
		<!-- {:else if $yw_chain.def.id.startsWith('secret-')} -->
<!-- 
			<div class="section">
				<div class="bar" style={a_allowances.length? "border-bottom: 1px solid var(--theme-color-border);": ''}>
					<span class="left">
						<div class="label">
							Allowances ({gd_token.allowances.length})
						</div>
						<div class="info">
							Accounts allowed to spend this token
						</div>
					</span>
					<span class="right">
						<button class="pill" on:click={() => push_screen(DeadEnd)}>
							Manage
						</button>
					</span>
				</div>

				{#each a_allowances as g_allowance, i_allowance}
					<Row
						name={g_allowance.k_spender.def.label}
						address={g_allowance.k_spender.def.address}
						amount={g_allowance.s_amount}
						fiat={g_allowance.s_expiry}
						iconRef={g_allowance.k_spender.def.iconRef}
						iconClass='site'
						on:click={() => push_screen(DeadEnd)}
						rootStyle={i_allowance === a_allowances.length-1? 'border-bottom: none;': ''}
					>
					</Row>
				{/each}
			</div> -->

		<!-- {/if} -->
<!-- 
		{#each a_history as k_txn}
			{@const g_bankish = k_txn.bankish($yw_account.address($yw_chain))}
			{@const gd_txn = k_txn.def}
			{@const g_detail = detail_bankish(g_bankish)}

			{#if g_bankish}
				<Row
					icon={H_TXN_ICONS[g_bankish.type]}
					iconClass={H_TXN_CLASSES[g_bankish.type] || ''}
					name={H_SUMMARIZERS[g_bankish.type](k_txn)}
					address={g_bankish.address}
					detail={g_detail.name}
					prefix={g_detail.prefix}
					amount={format_amount(k_token.approx(g_bankish.amount))}
					fiat={amount_to_fiat(k_token.approx(g_bankish.amount), k_token)}
					on:click={() => push_screen(DeadEnd)}
				>
					<svelte:fragment slot="detail">
						{#if g_detail.icon}
							<span class="txn-type icon">
								{@html g_detail.icon}
							</span>
						{/if}
						{#if g_detail.name}
							{g_detail.name}
						{:else if g_bankish.address}
							<Address address={g_bankish.address} />
						{/if}
					</svelte:fragment>
				</Row>
			{:else}
				<Row
					icon={H_TXN_ICONS[gd_txn.type]}
					iconClass={H_TXN_CLASSES[gd_txn.type] || ''}
					name={H_SUMMARIZERS[gd_txn.type](k_txn)}
					address={gd_txn.address}
					amount={format_amount(k_token.approx(gd_txn.amount))}
					fiat={amount_to_fiat(k_token.approx(gd_txn.amount), k_token)}
					on:click={() => push_screen(DeadEnd)}
				/>
			{/if}
		{/each} -->
	</div>
</Screen>