<script context="module" lang="ts">
	import type {PfpTarget} from '#/meta/pfp';

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
		pfp?: PfpTarget;
		pending?: boolean;
		link?: null | {
			href: string;
			text: string;
		};
	}
</script>

<script lang="ts">
	import {dd, open_external_link} from '#/util/dom';

	import Row from '../ui/Row.svelte';

	import TimeAgo from 'javascript-time-ago';
	import english_locale from 'javascript-time-ago/locale/en';

	import BigNumber from 'bignumber.js';
	import {Chains} from '#/store/chains';
	import type {Promisable} from '#/meta/belt';
	import {abbreviate_addr, format_amount} from '#/util/format';
	import {Accounts} from '#/store/accounts';
	import type {AccountPath} from '#/meta/account';
	import {Agents} from '#/store/agents';
	import Put from '../ui/Put.svelte';
	import PfpDisplay from '../ui/PfpDisplay.svelte';
	import {Entities} from '#/store/entities';
	import {R_TRANSFER_AMOUNT} from '#/share/constants';
	import {getContext} from 'svelte';
	import IncidentView from '../screen/IncidentView.svelte';
	import type {Incident, IncidentType, TxConfirmed, TxPending, TxSynced} from '#/meta/incident';

	import SX_SEND from '#/icon/send.svg?raw';
	import SX_RECV from '#/icon/recv.svg?raw';
	import SX_ACC_CREATED from '#/icon/user-add.svg?raw';
	import SX_ACC_EDITED from '#/icon/user-edit.svg?raw';
	import SX_CONNECT from '#/icon/connect.svg?raw';
	import SX_ICON_SIGNATURE from '#/icon/signature.svg?raw';

	import type {
		Page,
	} from '##/screen/_screens';
	import {parse_coin_amount} from '#/chain/coin';
	import { Incidents } from '#/store/incidents';
    import { yw_account_editted } from '../mem';
    import { Apps } from '#/store/apps';

	// import {definition} from '@fortawesome/free-solid-svg-icons/faRobot';
	// const SXP_ROBOT = definition.icon[4];
	const SXP_ROBOT = '';

	// import SX_PERSONAL from '@material-design-icons/svg/outlined/account_box.svg?raw';
	// import SX_CONTRACT from '@material-design-icons/svg/outlined/analytics.svg?raw';

	export let incidents: Incident.Struct[];
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

	const k_page = getContext<Page>('page');

	const mk_icon = (sx_icon: string) => {
		const dm_icon = dd('span', {
			class: 'event-icon global_svg-icon icon-diameter_18px',
		});
		dm_icon.innerHTML = sx_icon;
		return dm_icon;
	};

	const DM_ICON_SEND = mk_icon(SX_SEND);
	const DM_ICON_RECV = mk_icon(SX_RECV);
	const DM_ICON_ACC_CREATED = mk_icon(SX_ACC_CREATED);

	TimeAgo.setDefaultLocale(english_locale.locale);
	TimeAgo.addLocale(english_locale);
	const y_ago = new TimeAgo('en-US');

	function format_time_ago(xt_when: number): string {
		return y_ago.format(xt_when, 'twitter');
	}

	const H_INCIDENT_MAP: {
		[si_type in IncidentType]: (g: Incident.Struct<si_type>) => Promisable<Detail>;
	} = {
		async tx_out(g_incident) {
			const {
				time: xt_when,
				data: g_data,
				data: {
					chain: p_chain,
					stage: si_stage,
					hash: si_txn,
				},
			} = g_incident;

			const g_chain = (await Chains.at(p_chain))!;

			const b_pending = 'pending' === si_stage;
			const b_confirmed = 'confirmed' === si_stage;
			const b_synced = 'synced' === si_stage;

			const {
				msgs: a_msgs,
				code: xc_code,
			} = g_data;

			// single message
			if(1 === a_msgs.length) {
				const {
					events: h_events,
				} = a_msgs[0];

				// transfer
				if(h_events.transfer) {
					const g_transfer = h_events.transfer;

					const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_transfer.amount, g_chain);

					const x_amount = new BigNumber(xg_amount+'').shiftedBy(-g_coin.decimals).toNumber();

					const sa_recipient = g_transfer.recipient;
					const p_contact = Agents.pathForContactFromAddress(sa_recipient);
					const g_contact = await Agents.getContact(p_contact);

					return {
						title: `${b_pending? 'Sending': 'Sent'} ${g_coin.name}${b_pending? '...': ''}`,
						name: si_coin,
						icon: mk_icon(SX_SEND),
						subtitle: `${format_time_ago(xt_when)} / ${g_contact? g_contact.name: abbreviate_addr(sa_recipient)}`,
						amount: `${format_amount(x_amount, true)} ${si_coin}`,
						pfp: g_coin.pfp,
					};
				}
			}

			return {
				title: 'Outgoing Transaction',
				name: '',
				icon: mk_icon(SX_SEND),
			};
		},

		async tx_in(g_incident) {
			const {
				time: xt_when,
				data: g_data,
				data: {
					chain: p_chain,
					stage: si_stage,
					hash: si_txn,
					msgs: a_msgs,
					code: xc_code,
				},
			} = g_incident;

			const g_chain = (await Chains.at(p_chain))!;

			const b_confirmed = 'confirmed' === si_stage;
			const b_synced = 'synced' === si_stage;

			// single message
			if(1 === a_msgs.length) {
				const {
					events: h_events,
				} = a_msgs[0];

				// transfer
				if(h_events.transfer) {
					const g_transfer = h_events.transfer;

					const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_transfer.amount, g_chain);

					const x_amount = new BigNumber(xg_amount+'').shiftedBy(-g_coin.decimals).toNumber();

					const sa_sender = g_transfer.sender;
					const p_contact = Agents.pathForContactFromAddress(sa_sender);
					const g_contact = await Agents.getContact(p_contact);

					return {
						title: `Received ${g_coin.name}`,
						name: si_coin,
						icon: mk_icon(SX_RECV),
						subtitle: `${format_time_ago(xt_when)} / ${g_contact? g_contact.name: abbreviate_addr(sa_sender)}`,
						amount: `${format_amount(x_amount, true)} ${si_coin}`,
						// link: 'SCRT' === si_coin? `<a href="https://secretnodes.com/secret/chains/pulsar-2/blocks/${s_height}/transactions/${si_txn}">View on block explorer</a>`: '',
						pfp: g_coin.pfp,
					};
				}
			}

			return {
				title: `Incoming Transaction`,
				name: '',
				icon: mk_icon(SX_RECV),
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

		async account_edited(g_event) {
			const {
				time: xt_when,
				data: {
					account: p_account,
					deltas: a_deltas,
				},
			} = g_event;

			const g_account = (await Accounts.at(p_account))!;

			return {
				title: `Account edited`,
				subtitle: `${format_time_ago(xt_when)} / ${g_account.name}`,
				name: g_account.name,
				icon: mk_icon(SX_ACC_EDITED),
				pfp: g_account.pfp || '',
			};
		},

		async app_connected(g_event) {
			const {
				time: xt_when,
				data: {
					app: p_app,
					accounts: a_accounts,
					connections: h_connections,
				},
			} = g_event;

			const g_app = (await Apps.at(p_app))!;

			return {
				title: `App connected`,
				subtitle: `${format_time_ago(xt_when)} / ${g_app.host}`,
				name: g_app.name,
				icon: mk_icon(SX_CONNECT),
				pfp: g_app.pfp || '',
			};
		},

		async signed_json(g_event) {
			const {
				time: xt_when,
				data: {
					account: p_account,
					events: h_events,
				},
			} = g_event;

			const g_account = (await Accounts.at(p_account))!;

			return {
				title: `Signed ${h_events.query_permit? 'query permit': 'document'}`,
				subtitle: `${format_time_ago(xt_when)} / ${g_account.name}`,
				name: g_account.name,
				icon: mk_icon(SX_ICON_SIGNATURE),
				pfp: g_account.pfp || '',
			};
		},
	};


	async function detail_incident(g_incident: Incident.Struct): Promise<Detail> {
		return await (H_INCIDENT_MAP[g_incident.type] as (g: Incident.Struct) => Promisable<Detail>)(g_incident);
	}

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

	{#each incidents as g_incident}
		{#await detail_incident(g_incident)}
			Loading event...
		{:then g_detail}
			<Row
				name={g_detail.title}
				detail={g_detail.subtitle}
				amount={g_detail.amount || ''}
				fiat={g_detail.fiat || ''}
				on:click={() => {
					k_page.push({
						creator: IncidentView,
						props: {
							incident: Incidents.pathFrom(g_incident),
						},
					});
				}}
			>
				<svelte:fragment slot="icon">
					<Put element={g_detail.icon} />
				</svelte:fragment>

				<svelte:fragment slot="right">
					{#if 'string' === typeof g_detail.pfp}
						<PfpDisplay dim={36} name={g_detail.name} ref={g_detail.pfp} circular={'pending' === g_incident.type}
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