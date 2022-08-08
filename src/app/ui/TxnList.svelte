<script context="module" lang="ts">
	import type { PfpPath } from '#/meta/pfp';

	export enum TxnContext {
		NONE='none',
		TOKEN='token',
		CONTACT='contact',
	}

	interface Detail {
		icon: HTMLElement;
		name: string;
		title: string;
		subtitle: string;
		amount?: string;
		fiat?: string;
		pfp?: PfpPath;
		pending?: boolean;
		link?: null | {
			href: string;
			text: string;
		};
	}
</script>

<script lang="ts">
	import type { EventTypeKey, LogEvent } from '#/meta/store';
	import { dd, open_external_link } from '#/util/dom';

	import Row from '../ui/Row.svelte';

	import TimeAgo from 'javascript-time-ago';
	import english_locale from 'javascript-time-ago/locale/en';

	import SX_SEND from '#/icon/send.svg?raw';
	import SX_RECV from '#/icon/recv.svg?raw';
	import SX_ACC_CREATED from '#/icon/account-added.svg?raw';
	import BigNumber from 'bignumber.js';
	import { Chains } from '#/store/chains';
	import type { Promisable } from '#/util/belt';
	import { abbreviate_addr, format_amount } from '#/util/format';
	import { Accounts } from '#/store/accounts';
	import type { AccountPath } from '#/meta/account';
	import { Agents } from '#/store/agents';
	import Put from '../ui/Put.svelte';
	import PfpDisplay from '../ui/PfpDisplay.svelte';
import { Entities } from '#/store/entities';
import { R_TRANSFER_AMOUNT } from '#/share/constants';

	// import {definition} from '@fortawesome/free-solid-svg-icons/faRobot';
	// const SXP_ROBOT = definition.icon[4];
	const SXP_ROBOT = '';

	// import SX_PERSONAL from '@material-design-icons/svg/outlined/account_box.svg?raw';
	// import SX_CONTRACT from '@material-design-icons/svg/outlined/analytics.svg?raw';

	export let events: LogEvent[];
	export let context: TxnContext = TxnContext.NONE;

	const b_ctx_contact = context === TxnContext.CONTACT;
	const b_ctx_token = context === TxnContext.TOKEN;

	// const H_TXN_ICONS = {
	// 	[Txn.Type.UNKN]: Icon.BLANK,
	// 	[Txn.Type.SEND]: Icon.fromHtml(SX_SEND, {class:'icon-20'}),
	// 	[Txn.Type.RECV]: Icon.fromHtml(SX_RECV, {class:'icon-20'}),
	// 	[Txn.Type.COMP]: Icon.fromHtml(`<svg><path d="${SXP_ROBOT}"/></svg>`, {class:'icon-20'}),
	// 	[Txn.Type.SNIP20_XFER]: Icon.fromHtml(SX_RECV, {class:'icon-20'}),
	// } as Record<Txn.Type | Txn.BankishType, Icon>;

	// const H_SUMMARIZERS = {
	// 	[Txn.Type.UNKN]: _ => 'Unknown',
	// 	[Txn.Type.SEND]: k => `Send on ${k.date()}`,
	// 	[Txn.Type.RECV]: k => `Recv on ${k.date()}`,
	// 	[Txn.Type.COMP]: k => `Compute on ${k.date()}`,
	// } as Record<Txn.Type | Txn.BankishType, (k_txn: Txn) => string>;

	// const H_TXN_CLASSES = {
	// 	[Txn.Type.SEND]: 'color-icon-send',
	// 	[Txn.Type.RECV]: 'color-icon-recv',
	// } as Record<Txn.Type | Txn.BankishType, string>;

	const mk_icon = (sx_icon: string) => {
		const dm_icon = dd('span', {
			class: 'event-icon',
		});
		dm_icon.innerHTML = sx_icon;
		return dm_icon;
	};

	const DM_ICON_SEND = mk_icon(SX_SEND);
	const DM_ICON_RECV = mk_icon(SX_RECV);
	const DM_ICON_ACC_CREATED = mk_icon(SX_ACC_CREATED);


	TimeAgo.addDefaultLocale(english_locale);
	const y_ago = new TimeAgo('en-US');

	function format_time_ago(xt_when: number): string {
		return y_ago.format(xt_when, 'twitter');
	}

	const H_EVENT_MAP: {
		[si_type in EventTypeKey]: (g: LogEvent<si_type>) => Promisable<Detail>;
	} = {
		async pending(g_event) {
			const {
				time: xt_when,
				data: {
					chain: p_chain,
					coin: si_coin,
					hash: si_txn,
					owner: sa_owner,
					msg: g_msg,
				},
			} = g_event;


			const g_chain = (await Chains.at(p_chain))!;

			const g_coin = g_chain.coins[si_coin];

			const x_amount = new BigNumber(g_event.data.msg.amount[0].amount).shiftedBy(-g_chain.coins[si_coin].decimals).toNumber();

			const sa_recipient = g_msg.toAddress;
			const p_contact = Agents.pathForContact(sa_recipient);
			const g_contact = await Agents.getContact(p_contact);

			return {
				title: `Send ${g_coin.name}`,
				name: si_coin,
				icon: DM_ICON_SEND,
				subtitle: `${format_time_ago(xt_when)} / ${g_contact? g_contact.name: sa_recipient}`,
				amount: `${format_amount(x_amount, true)} ${si_coin}`,
				pfp: g_coin.pfp,
				pending: true,
			};
		},

		async send(g_event) {
			const {
				time: xt_when,
				data: {
					chain: p_chain,
					coin: si_coin,
					hash: si_txn,
					owner: sa_owner,
					msg: g_msg,
					height: s_height,
				},
			} = g_event;


			const g_chain = (await Chains.at(p_chain))!;

			const g_coin = g_chain.coins[si_coin];

			const x_amount = new BigNumber(g_event.data.msg.amount[0].amount).shiftedBy(-g_chain.coins[si_coin].decimals).toNumber();

			const sa_recipient = g_msg.toAddress;
			const p_contact = Agents.pathForContact(sa_recipient);
			const g_contact = await Agents.getContact(p_contact);

			return {
				title: `Sent ${g_coin.name}`,
				name: si_coin,
				icon: mk_icon(SX_SEND),
				subtitle: `${format_time_ago(xt_when)} / ${g_contact? g_contact.name: abbreviate_addr(sa_recipient)}`,
				amount: `${format_amount(x_amount, true)} ${si_coin}`,
				link: 'SCRT' === si_coin
					? {
						href: `https://secretnodes.com/secret/chains/pulsar-2/blocks/${s_height}/transactions/${si_txn}`,
						text: 'View on block explorer',
					}
					: null,
				pfp: g_coin.pfp,
			};
		},

		async account_created(g_event) {
			const {
				time: xt_when,
				data: {
					account: p_account,
				},
			} = g_event;

			const g_account = (await Accounts.at(p_account))!;

			return {
				title: `Account created`,
				subtitle: `${format_time_ago(xt_when)} / ${g_account.name}`,
				name: g_account.name,
				icon: mk_icon(SX_ACC_CREATED),
				pfp: g_account.pfp || '',
			};
		},


		async receive(g_event) {
			const {
				time: xt_when,
				data: {
					height: s_height,
					amount: s_amount,
					chain: p_chain,
					coin: si_coin,
					recipient: sa_recipient,
					sender: sa_sender,
				},
			} = g_event;

			const sa_other = sa_sender;
			const p_contact = Agents.pathForContact(sa_other);
			const g_contact = await Agents.getContact(p_contact);

			const g_chain = (await Chains.at(p_chain))!;
			const g_coin = g_chain.coins[si_coin];

			const [, s_size] = R_TRANSFER_AMOUNT.exec(s_amount)!;

			const x_amount = new BigNumber(s_size).shiftedBy(-g_chain.coins[si_coin].decimals).toNumber();

			return {
				title: `Received ${g_coin.name}`,
				name: si_coin,
				icon: mk_icon(SX_RECV),
				subtitle: `${format_time_ago(xt_when)} / ${g_contact? g_contact.name: abbreviate_addr(sa_other)}`,
				amount: `${format_amount(x_amount, true)} ${si_coin}`,
				// link: 'SCRT' === si_coin? `<a href="https://secretnodes.com/secret/chains/pulsar-2/blocks/${s_height}/transactions/${si_txn}">View on block explorer</a>`: '',
				pfp: g_coin.pfp,
			};
		},

		transaction(g_event) {

		},
	};


	async function detail_event(g_event: LogEvent): Promise<Detail> {
		return await (H_EVENT_MAP[g_event.type] as (g: LogEvent<typeof g_event['type']>) => Promisable<Detail>)(g_event);
	}

	// function detail_bankish(g_bankish?: Txn.Bankish | null): {prefix: string; name: string; icon: string} {
	// 	if(!g_bankish) return {prefix:'', name:'', icon:''};
	
	// 	const k_contact = H_ADDR_TO_CONTACT[g_bankish.address];
	
	// 	return {
	// 		prefix: (Txn.BankishType.SEND === g_bankish.type? 'to': 'fr')+':',
	// 		name: k_contact? k_contact.def.label: '',
	// 		icon: k_contact
	// 			? Contact.Type.PERSON === k_contact.def.type
	// 				? SX_PERSONAL
	// 				: SX_CONTRACT
	// 			: '',
	// 	};
	// }
</script>

<style lang="less">
	@import './_base.less';

	.row .main .title {
		:global(&) {
			min-width: min-content;
		}
	}

	.row .pfp.icon {
		:global(&) {
			color: var(--theme-color-text-light);
		}
	}

	.txn-type.icon {
		vertical-align: middle;
		--icon-diameter: 18px;
		--icon-color: var(--theme-color-text-med);
	}

	:global(.event-icon) {
		display: flex;
		background: var(--theme-color-border);
		padding: 9px;
		border-radius: 18px;
	}

	:global(.txns>.row>.rest>*) {
		margin-left: -11px;
	}

	.pill {
		display: inline-block;
		padding: 0.4em 1em;
		color: var(--theme-color-graymed);
		border: 1px solid var(--theme-color-graydark);
		border-radius: 400em;
		margin: 0;
		margin-top: 0.5em;
	}
</style>

<div class="txns no-margin">
	<slot name="first"></slot>

	{#each events as g_event}
		{#await detail_event(g_event)}
			Loading event...
		{:then g_detail}
			<Row
				name={g_detail.title}
				detail={g_detail.subtitle}
				amount={g_detail.amount || ''}
				fiat={g_detail.fiat || ''}
			>
				<svelte:fragment slot="icon">
					<Put element={g_detail.icon} />
				</svelte:fragment>

				<svelte:fragment slot="right">
					{#if 'string' === typeof g_detail.pfp}
						<PfpDisplay dim={36} name={g_detail.name} ref={g_detail.pfp} circular={'pending' === g_event.type}
							rootStyle='margin-left: 1em;'
						/>
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="below">
					{#if g_detail.pending}
						<span class="pill" class:display_none={!g_detail.pending}>
							Pending
						</span>
					{/if}

					{#if g_detail.link}
						<span class="link">
							<a href={g_detail.link.href} on:click={() => open_external_link(g_detail.link.href)}>
								{g_detail.link.text}
							</a>
						</span>
					{/if}
				</svelte:fragment>
			</Row>
		{/await}
<!-- 
		{#if g_bankish}
			<Row

				icon={H_TXN_ICONS[g_bankish.type]}
				iconClass={H_TXN_CLASSES[g_bankish.type] || ''}
				name={H_SUMMARIZERS[g_bankish.type](g_event)}
				address={g_bankish.address}
				detail={g_detail.name}
				prefix={g_detail.prefix}
				amount={format_amount(k_token.approx(g_bankish.amount))+(b_ctx_token? '': ` ${k_token.def.symbol}`)}
				fiat={amount_to_fiat(k_token.approx(g_bankish.amount), k_token)}
				on:click={() => {
					// push_screen(TxnView, {
					// 	txn: k_txn,
					// });
					push_screen(DeadEnd);
				}}
			>
				<svelte:fragment slot="detail">
					{#if !b_ctx_contact}
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
					{/if}
				</svelte:fragment>
			</Row>
		{:else}
			<Row
				icon={H_TXN_ICONS[gd_txn.type]}
				iconClass={H_TXN_CLASSES[gd_txn.type] || ''}
				name={H_SUMMARIZERS[gd_txn.type](g_event)}
				address={gd_txn.address}
				amount={format_amount(k_token.approx(gd_txn.amount))}
				fiat={amount_to_fiat(k_token.approx(gd_txn.amount), k_token)}
			/>
		{/if} -->
	{/each}
</div>