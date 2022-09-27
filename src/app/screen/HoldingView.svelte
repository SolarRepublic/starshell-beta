<script lang="ts">
	import BigNumber from 'bignumber.js';

	import SX_ICON_SEND from '#/icon/send.svg?raw';
	import SX_ICON_RECV from '#/icon/recv.svg?raw';

	// import {definition} from '@fortawesome/free-solid-svg-icons/faRobot';
	// const SXP_ROBOT = definition.icon[4];
	const SXP_ROBOT = '';

	// import SX_NORTH_EAST from '@material-design-icons/svg/filled/north_east.svg?raw';
	// import SX_EDIT from '@material-design-icons/svg/filled/edit.svg?raw';
	// import SX_INFO from '@material-design-icons/svg/outlined/info.svg?raw';

	import SX_ICON_PERSONAL from '#/icon/account_box.svg?raw';
	import SX_ICON_CONTRACT from '#/icon/analytics.svg?raw';
	import { Header, Screen, type Page } from './_screens';
	import Portrait, {type Actions} from '../ui/Portrait.svelte';
	import type { ContractInterface, ContractPath, EntityPath, NativeCoin } from '#/meta/chain';
	import { Entities } from '#/store/entities';
	import { yw_chain, yw_chain_ref, yw_network_active } from '../mem';
	import { SI_STORE_CHAINS, XT_MINUTES } from '#/share/constants';
	import { getContext } from 'svelte';
	import Send from './Send.svelte';
	import { Chains } from '#/store/chains';
	import { coin_formats, to_fiat } from '#/chain/coin';
	import { format_amount, format_fiat } from '#/util/format';
	import type { Coin } from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
	import type { PfpTarget } from '#/meta/pfp';
	import Gap from '../ui/Gap.svelte';
	import Row from '../ui/Row.svelte';

	const k_page = getContext<Page>('page');

	/**
	 * Entity path should be either a holding or token
	 */
	export let entityRef: EntityPath;
	const p_entity = entityRef;


	// either a native coin or a fungible token
	let si_type: 'coin' | 'token' | '' = '';

	// the coin's id and object (if its a coin)
	let si_coin = '';
	let g_coin: NativeCoin | null = null;

	// the token's path and object (if it's a token)
	let p_token: ContractPath | '' = '';
	let g_token: ContractInterface | null = null;


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

	// the fiat worth of exactly 1 coin/token
	let s_worth = '';


	// const x_versus_usd = H_VERSUS_USD[p_token].value;


	async function load_entity() {
		const ks_entities = await Entities.read();

		const g_info = Entities.parseEntityPath(p_entity);

		if(!g_info) {
			throw new Error(`Attempted to load holding view on non-entity path "${p_entity}"`);
		}

		switch(g_info.type) {
			// native coin
			case 'holding': {
				si_type = 'coin';

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
				const g_cached = $yw_network_active.cachedBalance(g_info.bech32, si_coin);

				let g_balance: Coin;

				// cache is within asking time
				if(g_cached && g_cached.timestamp >= Date.now() - (2 * XT_MINUTES)) {
					g_balance = g_cached.data;
				}
				else {
					// destructure balance
					({
						balance: g_balance,
					} = await $yw_network_active.bankBalance(g_info.bech32, si_coin));
				}

				// set amount
				yg_amount = new BigNumber(g_balance.amount).shiftedBy(-g_coin.decimals);

				// set fiat amount asynchronously
				void coin_formats(g_balance, g_coin).then((g_formats) => {
					s_fiat = format_fiat(g_formats.fiat, g_formats.versus);
					s_worth = format_fiat(g_formats.worth, g_formats.versus);
				});

				break;
			}

			// token
			case 'token': {
				si_type = 'token';

				// set token path
				p_token = p_entity as ContractPath;

				// read token interfaces
				const ks_entites = await Entities.read();
				const h_ifaces = ks_entites.tokens(g_info.entityRef, Entities.fungibleInterfacesFor($yw_chain));
				debugger;

				break;
			}

			default: {
				throw new Error(`Unhandled entity type: "${g_info.type}"`);
			}
		}
	}

	load_entity();

	// export const accountId = Object.values(H_ACCOUNTS).find((k) => k.address(k_chain) === holding.def.holderAddr)?.def.id || $yw_chain.def.id;

	// const k_account = $yw_account;
	// yw_account.subscribe((_k_account) => {
	// 	if($yw_pattern.endsWith('/tokens/{tokenId}/holdings/{accountId}/view') && k_account.def.pubkey !== _k_account.def.pubkey) {
	// 		restart();
	// 	}
	// });

	// const H_TXN_ICONS = {
	// 	[Txn.Type.UNKN]: Icon.BLANK,
	// 	[Txn.Type.SEND]: Icon.fromHtml(SX_ICON_SEND, {class:'icon-20'}),
	// 	[Txn.Type.RECV]: Icon.fromHtml(SX_ICON_RECV, {class:'icon-20'}),
	// 	[Txn.Type.COMP]: Icon.fromHtml(`<svg><path d="${SXP_ROBOT}"/></svg>`, {class:'icon-20'}),
	// 	[Txn.Type.SNIP20_XFER]: Icon.fromHtml(SX_ICON_RECV, {class:'icon-20'}),
	// } as Record<Txn.Type | Txn.BankishType, Icon>;

	// const H_SUMMARIZERS = {
	// 	[Txn.Type.UNKN]: (_) => 'Unknown',
	// 	[Txn.Type.SEND]: (k) => `Send on ${k.date()}`,
	// 	[Txn.Type.RECV]: (k) => `Receive on ${k.date()}`,
	// 	[Txn.Type.COMP]: (k) => `Compute on ${k.date()}`,
	// } as Record<Txn.Type | Txn.BankishType, (k_txn: Txn) => string>;

	// const H_TXN_CLASSES = {
	// 	[Txn.Type.SEND]: 'color-icon-send',
	// 	[Txn.Type.RECV]: 'color-icon-recv',
	// } as Record<Txn.Type | Txn.BankishType, string>;

	// the set of actions available on this asset
	const gc_actions: Actions = {
		send: {
			trigger() {
				k_page.push({
					creator: Send,
					props: g_token
						? {
							token: g_token,
						}
						: si_coin
							? {
								native: si_coin,
							}
							: {},
				});
			},
		},
	};

	// // home token
	// const k_ibct_native = H_IBCTS[Ibct.refFromHomeToken(gd_token.iri)];
	// if(k_ibct_native) {
	// 	gc_actions.wrap = {
	// 		label: 'Wrap',
	// 		trigger() {
	// 			push_screen(DeadEnd);
	// 		},
	// 	};
	// }

	// // colony token
	// if(k_token.ibct) {
	// 	gc_actions.unwrap = {
	// 		label: 'Unwrap',
	// 		trigger() {
	// 			push_screen(DeadEnd);
	// 		},
	// 	};
	// }

	// // non-native token
	// if(!gd_token.native) {
	// 	Object.assign(gc_actions, {
	// 		edit: {
	// 			label: 'Edit',
	// 			trigger() {
	// 				push_screen(TokenEdit, {
	// 					token: k_token,
	// 				});
	// 			},
	// 		},
	// 	});
	// }

	// function detail_bankish(g_bankish?: Txn.Bankish | null): {prefix:string, name:string, icon:string} {
	// 	if(!g_bankish) return {prefix:'', name:'', icon:''};

	// 	const k_contact = H_ADDR_TO_CONTACT[g_bankish.address];

	// 	return {
	// 		prefix: (Txn.BankishType.SEND === g_bankish.type? 'to': 'fr')+':',
	// 		name: k_contact? k_contact.def.label: '',
	// 		icon: k_contact
	// 			? Contact.Type.PERSON === k_contact.def.type
	// 				? SX_ICON_PERSONAL
	// 				: SX_ICON_CONTRACT
	// 			: '',
	// 	};
	// }

	
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

	// if(Tasks.VERIFY === $yw_task && 'ATOM' === gd_token.symbol && gd_token.native && '2' === $yw_account.def.id) {
	// 	setTimeout(() => {
	// 		$yw_task = -$yw_task;
	// 	}, 1400);
	// }
</script>

<style lang="less">
	@import './_base.less';

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
		border-top: 6px solid black;
		border-bottom: 6px solid black;

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
		resource={g_coin || g_token || null}
		resourcePath={p_entity}
		title={yg_amount? `${format_amount(yg_amount.toNumber())} ${s_symbol}`: '...'}
		subtitle={`${s_fiat} (${s_worth} per ${si_type})`}
		actions={gc_actions}
		circular
	/>

	<Gap />

	<div class="rows">
<!-- 		
		<div class="section">
			<span class="content">
				<span class="title">
					Stake
				</span>
				</span>
			</span>

			<button class="pill">
				Stake {si_coin}
			</button>
		</div> -->
	</div>

	<Gap />

	<div class="txns no-margin">

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