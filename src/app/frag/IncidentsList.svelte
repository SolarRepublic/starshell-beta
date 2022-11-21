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
		rootClasses?: string;
		childClasses?: string;
		link?: null | {
			href: string;
			text: string;
		};
	}
</script>

<script lang="ts">
	import type {LocalAppContext, PartialLocalAppContext} from '../svelte';
	import type {AminoMsg} from '@cosmjs/amino';

	import type {AccountPath} from '#/meta/account';
	import type {AppPath} from '#/meta/app';
	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import type {ChainPath} from '#/meta/chain';
	import type {Incident, IncidentType} from '#/meta/incident';
	
	import BigNumber from 'bignumber.js';
	import TimeAgo from 'javascript-time-ago';
	import english_locale from 'javascript-time-ago/locale/en';
	import {getContext} from 'svelte';
	
	import {yw_account, yw_account_ref} from '../mem';
	
	import {Coins, parse_coin_amount} from '#/chain/coin';
	import {proto_to_amino} from '#/chain/cosmos-msgs';
	import type {ReviewedMessage} from '#/chain/messages/_types';
	import {H_INTERPRETTERS} from '#/chain/msg-interpreters';
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {Apps, G_APP_EXTERNAL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import type {IncidentFilterConfig} from '#/store/incidents';
	import {Histories, Incidents} from '#/store/incidents';
	import {base93_to_buffer} from '#/util/data';
	import {dd, open_external_link} from '#/util/dom';
	import {abbreviate_addr, format_amount} from '#/util/format';
	
	import type {Page} from '##/screen/_screens';
	
	import PfpDisplay from './PfpDisplay.svelte';
	import IncidentView from '../screen/IncidentView.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Put from '../ui/Put.svelte';
	import Row from '../ui/Row.svelte';

	import {oderac} from '#/util/belt';
	
	import SX_ICON_CONNECT from '#/icon/connect.svg?raw';
	import SX_ICON_ERROR from '#/icon/error.svg?raw';
	import SX_ICON_RECV from '#/icon/recv.svg?raw';
	import SX_ICON_SEND from '#/icon/send.svg?raw';
	import SX_ICON_SIGNATURE from '#/icon/signature.svg?raw';
	import SX_ICON_ACC_CREATED from '#/icon/user-add.svg?raw';
	import SX_ICON_ACC_EDITED from '#/icon/user-edit.svg?raw';


	type IncidentHandler<si_type extends IncidentType=IncidentType> = (
		g_incident: Incident.Struct<si_type>,
		g_context: PartialLocalAppContext,
	) => Promisable<Detail>;

	

	// import {definition} from '@fortawesome/free-solid-svg-icons/faRobot';
	// const SXP_ROBOT = definition.icon[4];
	const SXP_ROBOT = '';

	// import SX_PERSONAL from '@material-design-icons/svg/outlined/account_box.svg?raw';
	// import SX_CONTRACT from '@material-design-icons/svg/outlined/analytics.svg?raw';

	export let incidents: Promisable<Incident.Struct[]> | null = null;
	export let context: TxnContext = TxnContext.NONE;

	export let filterConfig: IncidentFilterConfig = {};

	const k_page = getContext<Page>('page');

	let xt_last_seen = Infinity;
	void Histories.lastSeen().then((_xt_seen) => {
		xt_last_seen = _xt_seen;

		// mark last seen
		setTimeout(() => {
			void Histories.markAllSeen();
		}, 10e3);
	});
	

	async function load_incidents(): Promise<Incident.Struct[]> {
		if(incidents) return await incidents;

		return incidents = [...await Incidents.filter(filterConfig)].sort((g_a, g_b) => g_b.time - g_a.time);
	}

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


	const mk_icon = (sx_icon: string, xt_when: number, b_pending=false) => {
		const dm_icon = dd('span', {
			class: 'event-icon global_svg-icon icon-diameter_18px'
				+(b_pending? ' global_pulse': '')
				+(xt_when >= xt_last_seen? ' unseen-incident': ''),
		});
		dm_icon.innerHTML = sx_icon;
		return dm_icon;
	};

	TimeAgo.setDefaultLocale(english_locale.locale);
	TimeAgo.addLocale(english_locale);
	const y_ago = new TimeAgo('en-US');

	function format_time_ago(xt_when: number): string {
		return y_ago.format(xt_when, 'twitter');
	}

	const H_INCIDENT_MAP: {
		[si_type in IncidentType]: IncidentHandler<si_type>;
	} = {
		async tx_out(g_incident, g_context) {
			const {
				time: xt_when,
				data: g_data,
				data: {
					stage: si_stage,
					hash: si_txn,
					events: h_events,
					code: xc_code,
					msgs: a_msgs,
				},
			} = g_incident;

			const g_account = $yw_account;
			const p_account = $yw_account_ref;

			const g_app = g_context.g_app || G_APP_EXTERNAL;
			const g_chain = g_context.g_chain!;

			// prep context
			const g_context_full: LocalAppContext = {
				p_app: g_context.p_app!,
				g_app,
				p_chain: g_context.p_chain!,
				g_chain,
				p_account,
				g_account,
				sa_owner: Chains.addressFor(g_account.pubkey, g_chain),
			};

			const b_pending = 'pending' === si_stage;
			// const b_confirmed = 'confirmed' === si_stage;
			const b_synced = 'synced' === si_stage;

			const b_absent = 'absent' === si_stage;

			const g_common = {
				icon: mk_icon(b_absent? SX_ICON_ERROR: SX_ICON_SEND, xt_when, b_pending),
				childClasses: b_absent? 'filter_desaturate opacity_32%': '',
				pending: b_pending,
			};

			// decode and convert messages to amino
			const a_msgs_amino: AminoMsg[] = a_msgs.map((g_msg) => {
				// destructure msg
				const {
					typeUrl: si_type,
					value: sxb93_value,
				} = g_msg;
	
				// decode to proto
				const g_proto = {
					typeUrl: si_type,
					value: base93_to_buffer(sxb93_value),
				};
	
				// convert to amino
				return proto_to_amino(g_proto, g_chain.bech32s.acc);
			});

			// multi-message
			if(a_msgs_amino.length > 1) {
				// return {
				// 	title: `${b_pending? 'Executing': 'Executed'} Contract${b_pending? '...': ''}`,
				// };

				return {
					...g_common,
					title: `Sen${b_pending? 'ding': 't'} Multi-Message Transaction${b_pending? '...': ''}`,
					subtitle: format_time_ago(xt_when)+` / ${a_msgs_amino.length} Messages`,
					name: g_chain.name,
					pfp: g_chain.pfp,
					// TODO: merge pfps?
				};
			}

			// 
			const g_msg_amino = a_msgs_amino[0];

			// interpret message
			const f_interpret = H_INTERPRETTERS[g_msg_amino.type];
			if(f_interpret) {
				const g_interpretted = await f_interpret(g_msg_amino.value as JsonObject, g_context_full);

				// 
				const g_reviewed = await g_interpretted?.review?.(b_pending);

				if(g_reviewed) {
					const s_infos = (g_reviewed.infos || []).map(s => ` / ${s}`).join('');

					return {
						...g_common,
						title: g_reviewed.title+(b_pending? '...': ''),
						subtitle: format_time_ago(xt_when)+s_infos,
						name: g_reviewed.resource.name,
						pfp: g_reviewed.resource.pfp || '',
					};
				}
			}

			// transfer
			if(h_events.transfer) {
				const a_transfers = h_events.transfer;

				for(const g_transfer of a_transfers) {
					const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_transfer.amount, g_chain);

					const x_amount = new BigNumber(xg_amount+'').shiftedBy(-g_coin.decimals).toNumber();

					const sa_recipient = g_transfer.recipient;
					const p_contact = Agents.pathForContactFromAddress(sa_recipient);
					const g_contact = await Agents.getContact(p_contact);

					return {
						...g_common,
						title: `${b_pending? 'Sending': 'Sent'} ${g_coin.name}${b_pending? '...': ''}`,
						name: si_coin,
						subtitle: `${format_time_ago(xt_when)} / ${g_contact? g_contact.name: abbreviate_addr(sa_recipient)}`,
						amount: `${format_amount(x_amount, true)} ${si_coin}`,
						pfp: g_coin.pfp,
					};
				}
			}
			// // execution
			// else if(h_events.executions) {
			// 	const a_executions = h_events.executions;

			// 	for(const g_execution of a_executions) {
			// 		// ref contract addr
			// 		const sa_contract = g_execution.contract;

			// 		// execution action
			// 		const si_action = Object.keys(g_execution.msg)[0];

			// 		// default detail
			// 		let s_detail = `${si_action} on ${abbreviate_addr(sa_contract)}`;

			// 		// lookup contract
			// 		const p_contract = Contracts.pathFor(p_chain, sa_contract);
			// 		const g_contract = await Contracts.at(p_contract);

			// 		// contract defined
			// 		if(g_contract) {
			// 			s_contract = g_contract.name;

			// 			// use contract name in detail
			// 			s_detail = `${si_action} on ${g_contract.name}`;

			// 			// on secretwasm
			// 			if(g_chain.features.secretwasm) {
			// 				// contract is token
			// 				const g_snip20 = g_contract.interfaces.snip20;
			// 				if(g_snip20) {
			// 					s_detail = `${si_action} on ${g_snip20.symbol} token`;
			// 				}
			// 			}
			// 		}

			// 		return {
			// 			title: `${b_pending? 'Executing': 'Executed'} Contract${b_pending? '...': ''}`,
			// 			name: s_contract,
			// 			icon: mk_icon(SX_SEND),
			// 			subtitle: `${format_time_ago(xt_when)} / ${s_detail}`,
			// 			// amount: `${format_amount(x_amount, true)} ${si_coin}`,
			// 			pfp: g_contract?.pfp || '',
			// 		};
			// 	}
			// }

			return {
				title: 'Outgoing Transaction',
				pending: b_pending,
				name: '',
				icon: mk_icon(SX_ICON_SEND, xt_when, b_pending, b_absent),
			};
		},

		async tx_in(g_incident, g_context) {
			const {
				time: xt_when,
				data: g_data,
				data: {
					stage: si_stage,
					hash: si_txn,
				},
			} = g_incident;

			const g_account = g_context.g_account!;
			const sa_owner = g_context.sa_owner!;

			const g_app = g_context.g_app || G_APP_EXTERNAL;
			const g_chain = g_context.g_chain!;

			// prep context
			const g_context_full: LocalAppContext = {
				p_app: g_context.p_app!,
				g_app,
				p_chain: g_context.p_chain!,
				g_chain,
				p_account: g_context.p_account!,
				g_account,
				sa_owner,
			};

			// const sa_owner = await Accounts.g_incident.data.account;

			const {
				events: h_events,
				code: xc_code,
				msgs: a_msgs_proto,
			} = g_data;

			const a_reviews: ReviewedMessage[] = [];

			// decode and convert messages to amino
			for(const g_msg_proto of a_msgs_proto) {
				// destructure msg
				const {
					typeUrl: si_type,
					value: sxb93_value,
				} = g_msg_proto;
	
				// decode to proto
				const g_proto = {
					typeUrl: si_type,
					value: base93_to_buffer(sxb93_value),
				};
	
				// convert to amino
				const g_msg_amino = proto_to_amino(g_proto, g_chain.bech32s.acc);

				// interpret message
				const f_interpret = H_INTERPRETTERS[g_msg_amino.type];
				if(f_interpret) {
					const g_interpretted = await f_interpret(g_msg_amino.value, g_context_full);

					// message does not affect account; skip it
					if(!await g_interpretted?.affects?.(h_events)) continue;

					// make review
					const g_reviewed = await g_interpretted?.review?.(false, true);
					if(g_reviewed) a_reviews.push(g_reviewed);
				}
			}

			// prep detail
			const g_detail: Detail = {
				icon: mk_icon(SX_ICON_RECV, xt_when),
				title: `Inbound Transaction`,
				name: '',
				subtitle: '',
			};

			// transfer event
			for(const g_event of h_events.coin_received || []) {
				const h_amounts: Dict<BigNumber> = {};
				if(sa_owner === g_event.receiver) {
					const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_event.amount, g_chain);

					h_amounts[si_coin] = (h_amounts[si_coin] || BigNumber(0))
						.plus(BigNumber(xg_amount+'').shiftedBy(-g_coin.decimals));
				}

				const s_coins = oderac(h_amounts, (si_coin, yg_amount) => format_amount(yg_amount.toNumber())+' '+si_coin)
					.join(' + ');

				g_detail.title = `Received ${s_coins}`;
			}

			// only one message affects user
			if(1 === a_reviews.length) {
				const g_reviewed = a_reviews[0];

				const s_infos = (g_reviewed.infos || []).map(s => ` / ${s}`).join('');

				Object.assign(g_detail, {
					title: g_reviewed.title,
					subtitle: s_infos,
					name: g_reviewed.resource.name,
					pfp: g_reviewed.resource.pfp || '',
				});
			}
			// multiple messages affect user
			else if(a_reviews.length > 1) {
				// const h_amounts: Dict<bigint> = {};

				// // coalesce
				// for(const g_reviewed of a_reviews) {
				// 	const si_resource = g_reviewed.resource.name;
				// 	h_amounts[si_resource]
				// }

				Object.assign(g_detail, {
					title: `${a_reviews.length} Inbound Messages`,
					// subtitle: s_infos,
					// name: g_reviewed.resource.name,
					// pfp: g_reviewed.resource.pfp || '',
				});
			}

			return {
				...g_detail,
				subtitle: format_time_ago(xt_when)+g_detail.subtitle,
			};
		},

		async account_created(g_event, {g_account}) {
			const {
				time: xt_when,
				data: {
					account: p_account,
				},
			} = g_event;

			return {
				title: `Account created`,
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_ACC_CREATED, xt_when),
				pfp: g_account!.pfp || '',
			};
		},

		async account_edited(g_event, {g_account}) {
			const {
				time: xt_when,
				data: {
					deltas: a_deltas,
				},
			} = g_event;

			return {
				title: `Account edited`,
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_ACC_EDITED, xt_when),
				pfp: g_account!.pfp || '',
			};
		},

		async app_connected(g_event, {g_app}) {
			const {
				time: xt_when,
				data: {
					accounts: a_accounts,
					connections: h_connections,
				},
			} = g_event;

			return {
				title: `App connected`,
				subtitle: `${format_time_ago(xt_when)} / ${g_app!.host}`,
				name: g_app!.name,
				icon: mk_icon(SX_ICON_CONNECT, xt_when),
				pfp: g_app!.pfp || '',
			};
		},

		async signed_json(g_event, {g_app, g_account}) {
			const {
				time: xt_when,
				data: g_data,
			} = g_event;

			return {
				title: 'Signed Document',
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_SIGNATURE, xt_when),
				pfp: g_app?.pfp || g_account!.pfp || '',
			};
		},

		async signed_query_permit(g_event, {g_app, g_account}) {
			const {
				time: xt_when,
				data: g_data,
			} = g_event;

			return {
				title: 'Signed Query Permit',
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_SIGNATURE, xt_when),
				pfp: g_app!.pfp || g_account!.pfp || '',
			};
		},
	};


	async function detail_incident(g_incident: Incident.Struct): Promise<Detail> {
		const g_data = g_incident.data;

		const p_app = g_data['app'] as AppPath;
		const p_chain = g_data['chain'] as ChainPath;
		const p_account = g_data['account'] as AccountPath;

		const [g_app, g_chain, g_account] = await Promise.all([
			(async() => p_app? await Apps.at(p_app): null)(),
			(async() => p_chain? await Chains.at(p_chain): null)(),
			(async() => p_account? await Accounts.at(p_account): null)(),
		]);

		const g_context: PartialLocalAppContext = {
			p_app,
			p_chain,
			p_account,
			g_app,
			g_chain,
			g_account,
			sa_owner: g_account && g_chain? Chains.addressFor(g_account.pubkey, g_chain): '',
		};

		return await (H_INCIDENT_MAP[g_incident.type] as (
			g_incident: Incident.Struct,
			g_context: PartialLocalAppContext
		) => Promisable<Detail>)(g_incident, g_context);
	}
</script>

<style lang="less">
	@import '../_base.less';

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

	:global(.unseen-incident) {
		background-color: var(--theme-color-sky);
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

	{#await load_incidents()}
		<LoadingRows />
	{:then a_incidents}
		{#each a_incidents as g_incident}
			{#await detail_incident(g_incident)}
				<LoadingRows />
			{:then g_detail}
				<Row
					rootClasses={g_detail.rootClasses || ''}
					childClasses={g_detail.childClasses || ''}
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
							<PfpDisplay dim={36} name={g_detail.name} path={g_detail.pfp} circular={'pending' === g_incident.data['stage']}
								rootStyle='margin-left: 1em;'
							/>
						{/if}
					</svelte:fragment>

					<svelte:fragment slot="below">
						<!-- {#if g_detail.pending}
							<span class="pill" class:display_none={!g_detail.pending}>
								Pending
							</span>
						{/if} -->

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
		{/each}
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
</div>