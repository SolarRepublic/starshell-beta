import type {AminoMsg} from '@cosmjs/amino';

import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {ChainStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';
import type {IncidentStruct, IncidentType, TxError, TxSynced} from '#/meta/incident';

import {decodeTxRaw} from '@cosmjs/proto-signing';

import {global_broadcast} from './msg-global';

import type {LocalAppContext} from '#/app/svelte';
import {proto_to_amino} from '#/chain/cosmos-msgs';
import type {CosmosNetwork} from '#/chain/cosmos-network';
import {H_INTERPRETTERS} from '#/chain/msg-interpreters';
import type {TmJsonRpcWebsocket} from '#/cosmos/tm-json-rpc-ws-const';
import type {WsTxResponse, WsTxResultError} from '#/cosmos/tm-json-rpc-ws-def';
import type {NotificationConfig, NotifyItemConfig} from '#/extension/notifications';
import {R_TX_ERR_ACC_SEQUENCE} from '#/share/constants';
import {Apps} from '#/store/apps';
import {parse_date, TransactionNotFoundError} from '#/store/chains';
import {Incidents} from '#/store/incidents';

import {fodemtv, oderac} from '#/util/belt';
import {base64_to_buffer, buffer_to_hex, sha256_sync_insecure} from '#/util/data';
import {format_amount} from '#/util/format';


export interface CosmosEvents {
	'tx.hash': [Cw.Hex];
	'tx.height': [Cw.NaturalNumber];
	'tx.acc_seq'?: `${Cw.Bech32}/${Cw.NaturalNumber}`[];
	'tx.fee'?: Cw.Coin[];
	'tm.event'?: Cw.String[];
	'tx.signature'?: Cw.Base64[];
	'message.action'?: Cw.String[];
	'message.module'?: Cw.String[];
	'message.sender'?: Cw.Bech32[];
	'message.contract_address'?: Cw.Bech32[];
	'transfer.sender'?: Cw.Bech32[];
	'transfer.recipient'?: Cw.Bech32[];
	'transfer.amount'?: Cw.Coin[];
	'coin_spent.spender'?: Cw.Bech32[];
	'coin_spent.amount'?: Cw.Coin[];
	'coin_received.receiver'?: Cw.Bech32[];
	'coin_received.amount'?: Cw.Coin[];
	'wasm.contract_address'?: Cw.Bech32[];
}


interface AbciExtras {
	g_synced?: TxSynced | TxError;
	si_txn?: string;
}

interface TxDataExtra extends AbciExtras {
	si_txn: string;
	s_height: string;
	s_gas_used: string;
	s_gas_wanted: string;
}

export interface TxAbciConfig {
	type: Extract<IncidentType, 'tx_out' | 'tx_in'>;
	filter: string | string[];
	data?(a_msgs: AminoMsg[], g_extra: TxDataExtra, g_synced?: TxSynced): Promisable<void>;
	error?(a_msgs: AminoMsg[], g_error: WsTxResultError, si_txn: string): Promisable<void>;
}

export interface ReceiverError {
	code: number;
	reason: string;
	wasClean: boolean;
	error: Event | undefined;
}


export type ReceiverHooks = {
	connect?(this: TmJsonRpcWebsocket): Promisable<void>;

	error?(this: TmJsonRpcWebsocket, g_error: ReceiverError): Promisable<void>;
};

export type AbciHooks = {
	data(this: TmJsonRpcWebsocket, g_data: {}, g_extras: AbciExtras): Promisable<void>;
};

export interface AbciConfig {
	filter: string[];
	type: Extract<IncidentType, 'tx_out' | 'tx_in'>;
	hooks: AbciHooks;
}



const H_TX_ERROR_HANDLERS: Dict<Dict<(g_result: WsTxResultError) => Promisable<NotifyItemConfig | void>>> = {
	sdk: {
		// ErrTxDecode                = Register(testCodespace, 2, "tx parse error")
		// ErrInvalidSequence         = Register(testCodespace, 3, "invalid sequence")
		// ErrUnauthorized            = Register(testCodespace, 4, "unauthorized")
		// ErrInsufficientFunds       = Register(testCodespace, 5, "insufficient funds")
		// ErrUnknownRequest          = Register(testCodespace, 6, "unknown request")
		// ErrInvalidAddress          = Register(testCodespace, 7, "invalid address")
		// ErrInvalidPubKey           = Register(testCodespace, 8, "invalid pubkey")
		// ErrUnknownAddress          = Register(testCodespace, 9, "unknown address")
		// ErrInvalidCoins            = Register(testCodespace, 10, "invalid coins")
		// ErrOutOfGas                = Register(testCodespace, 11, "out of gas")
		// ErrInsufficientFee         = Register(testCodespace, 13, "insufficient fee")
		// ErrTooManySignatures       = Register(testCodespace, 14, "maximum number of signatures exceeded")
		// ErrNoSignatures            = Register(testCodespace, 15, "no signatures supplied")
		// ErrJSONMarshal             = Register(testCodespace, 16, "failed to marshal JSON bytes")
		// ErrJSONUnmarshal           = Register(testCodespace, 17, "failed to unmarshal JSON bytes")
		// ErrInvalidRequest          = Register(testCodespace, 18, "invalid request")
		// ErrMempoolIsFull           = Register(testCodespace, 20, "mempool is full")
		// ErrTxTooLarge              = Register(testCodespace, 21, "tx too large")
		// ErrKeyNotFound             = Register(testCodespace, 22, "key not found")
		// ErrorInvalidSigner         = Register(testCodespace, 24, "tx intended signer does not match the given signer")
		// ErrInvalidChainID          = Register(testCodespace, 28, "invalid chain-id")
		// ErrInvalidType             = Register(testCodespace, 29, "invalid type")
		// ErrUnknownExtensionOptions = Register(testCodespace, 31, "unknown extension options")
		// ErrPackAny                 = Register(testCodespace, 33, "failed packing protobuf message to Any")
		// ErrLogic                   = Register(testCodespace, 35, "internal logic error")
		// ErrConflict                = RegisterWithGRPCCode(testCodespace, 36, codes.FailedPrecondition, "conflict")
		// ErrNotSupported            = RegisterWithGRPCCode(testCodespace, 37, codes.Unimplemented, "feature not supported")
		// ErrNotFound                = RegisterWithGRPCCode(testCodespace, 38, codes.NotFound, "not found")
		// ErrIO                      = Register(testCodespace, 39, "Internal IO error")

		11: g_result => ({
			title: '❌ Not Enough Gas',
			message: `The transaction failed because ${format_amount(Number(g_result.gas_wanted))} GAS was not enough.`,
		}),

		21: g_result => ({
			title: '❌ Transaction Too Large',
			message: `The transaction was rejected because it is too large.`,
		}),
	},
};

export function tx_abcis(g_chain: ChainStruct, h_abcis: Dict<TxAbciConfig>): Dict<AbciConfig> {
	return fodemtv(h_abcis, gc_event => ({
		type: gc_event.type,

		filter: [
			// `tm.event='Tx'`,  // this event seems to be excluded from grpc-web TxServiceClient responses
			...Array.isArray(gc_event.filter)? gc_event.filter: [gc_event.filter],
		],

		hooks: {
			async data(g_value, g_extras) {
				const {
					height: s_height,
					tx: sxb64_raw,
					result: g_result,
				} = g_value.TxResult as unknown as WsTxResponse;

				// decode raw txn attempted
				const atu8_raw = base64_to_buffer(sxb64_raw);
				const g_decoded_tx = decodeTxRaw(atu8_raw);

				// produce transaction hash
				const si_txn = buffer_to_hex(sha256_sync_insecure(atu8_raw)).toUpperCase();

				// hashes do not match
				if(g_extras.si_txn?.length && g_extras.si_txn !== si_txn) {
					throw new Error(`Computed transaction hash did not match hash returned by node (${g_extras.si_txn}): ${sxb64_raw}`);
				}

				// access messages as amino
				const s_hrp = g_chain.bech32s.acc;
				const a_msgs_amino = g_decoded_tx.body.messages.map(g_msg => proto_to_amino(g_msg, s_hrp));

				// tx error
				if(g_result.code) {
					console.warn(`Tx error: %o`, g_result);

					await gc_event.error?.(a_msgs_amino, g_result, si_txn);
				}
				// tx success
				else if(g_result.gas_used) {
					const {
						// data: sxb64_data,
						gas_used: s_gas_used,
						gas_wanted: s_gas_wanted,
					} = g_result;

					console.log({
						a_msgs_amino,
						s_gas_wanted,
						s_gas_used,
						s_height,
						g_extras,
					});

					// data callback with msgs as amino and extras
					await gc_event.data?.(a_msgs_amino, {
						...g_extras,
						si_txn,
						s_gas_wanted,
						s_gas_used,
						s_height,
					});
				}
			},
		},
	}));
}

function merge_notifies(a_notifies: NotifyItemConfig[], g_chain: ChainStruct, s_title_multiple: string) {
	// distill into single notify item
	let g_notify_merged = a_notifies[0];

	const f_other_group = nl => `other event${1 === nl? '': 's'}`;

	// multiple notifies; merge
	if(a_notifies.length > 1) {
		// prep groups dict
		const h_groups: Dict<{group: typeof f_other_group; count: number}> = {};

		// each notify item
		for(const g_notify of a_notifies) {
			const f_group = g_notify.group || f_other_group;

			// produce grouping as if only 1
			const s_grouped = f_other_group(1);

			const g_group = h_groups[s_grouped] = h_groups[s_grouped] || {
				group: f_group,
				count: 0,
			};

			g_group.count += 1;
		}

		// transform groups
		const a_groups = oderac(h_groups, (si, {group:f_group, count:nl_items}) => nl_items+' '+f_group(nl_items));

		// final notify item
		g_notify_merged = {
			title: s_title_multiple,
			message: (1 === a_groups.length
				? a_groups[0]
				: a_groups.slice(0, -1).join(', ')+' and '+a_groups.at(-1))
				+` on ${g_chain.name}`,
		};
	}

	return g_notify_merged;
}

export function account_abcis(
	k_network: CosmosNetwork,
	g_context_vague: LocalAppContext,
	fk_notify: (gc_notify: NotificationConfig) => void
): Dict<AbciConfig> {
	const {
		g_app: _g_app,
		p_app: _p_app,
		g_chain: _g_chain,
		p_chain: _p_chain,
		g_account: _g_account,
		p_account: _p_account,
		sa_owner: sa_agent,
	} = g_context_vague;

	// const sa_agent = Chains.addressFor(_g_account.pubkey, _g_chain);

	return tx_abcis(_g_chain, {
		sent: {
			type: 'tx_out',

			filter: `message.sender='${sa_agent}'`,

			async error(a_msgs, g_result, si_txn) {
				// notify tx failure
				global_broadcast({
					type: 'txError',
					value: {
						hash: si_txn,
					},
				});

				// copy context from outer scope
				const g_context = {...g_context_vague};

				// fetch pending tx from history
				const p_incident = Incidents.pathFor('tx_out', si_txn);
				const g_pending = await Incidents.at(p_incident) as IncidentStruct<'tx_out'>;

				// prep error incident data
				const g_incident_data: TxError = {
					stage: 'synced',
					account: _p_account,
					app: _p_app,
					chain: _p_chain,
					gas_limit: g_result.gas_wanted as Cw.Uint128,
					gas_used: g_result.gas_used as Cw.Uint128,
					gas_wanted: g_result.gas_wanted as Cw.Uint128,
					code: g_result.code,
					codespace: g_result.codespace,
					timestamp: g_result.timestamp,
					raw_log: g_result['rawLog'] as string,
					events: {},
					hash: g_result['txhash'],
					msgs: [],
					log: g_result.log,
				};

				// pending tx exists
				if(g_pending) {
					// set app context from pending tx record
					const p_app = g_pending.data.app!;
					if(p_app) {
						// load app
						const g_app = await Apps.at(p_app);
						if(g_app) {
							Object.assign(g_context, {
								p_app,
								g_app,
							});
						}
					}

					// update incident
					await Incidents.mutateData(p_incident, {
						...g_pending,
						...g_incident_data,
						app: p_app || _p_app,
					});
				}
				// insert incident
				else {
					await Incidents.record({
						type: 'tx_out',
						id: si_txn,
						data: g_incident_data,
					});
				}

				// attempt tx error handling
				const g_notify_tx = await H_TX_ERROR_HANDLERS[g_result.codespace]?.[g_result?.code]?.(g_result);
				if(g_notify_tx) {
					fk_notify({
						id: `@incident:${p_incident}`,
						incident: p_incident,
						item: g_notify_tx,
					});
				}
				// not handled, forward to message handlers
				else {
					// notify configs
					const a_notifies: NotifyItemConfig[] = [];

					// route messages
					for(const g_msg of a_msgs) {
						const si_type = g_msg.type;

						let g_notify: NotifyItemConfig | undefined;

						// interpret message
						const f_interpretter = H_INTERPRETTERS[si_type];
						if(f_interpretter) {
							const g_interpretted = await f_interpretter(g_msg.value as JsonObject, g_context);

							// apply message
							g_notify = await g_interpretted.fail?.(a_msgs.length, g_result);
						}

						// not interpretted
						if(!g_notify) {
							let s_reason = g_result.log;

							// generic errors
							if(R_TX_ERR_ACC_SEQUENCE.test(g_result.log)) {
								s_reason = `Previous transaction stuck in mempool on provider.\n${g_result.log}`;
							}

							// 
							g_notify = {
								title: '❌ Transaction Failed',
								message: s_reason,
							};
						}

						if(g_notify) {
							a_notifies.push(g_notify);
						}
					}

					// merge notify items
					const g_notify_merged = merge_notifies(a_notifies, _g_chain, '❌ Transaction Failed');

					// notifcation
					if(g_notify_merged) {
						fk_notify({
							id: `@incident:${p_incident}`,
							incident: p_incident,
							item: g_notify_merged,
						});
					}
				}

				// TODO: finish notification impl
			},

			async data(a_msgs, g_extra) {
				// transaction hash
				const {si_txn} = g_extra;

				// notify tx success
				global_broadcast({
					type: 'txSuccess',
					value: {
						hash: si_txn,
					},
				});

				// copy context from outer scope
				const g_context = {...g_context_vague};

				// fetch pending tx from history
				const p_incident = Incidents.pathFor('tx_out', si_txn);
				const g_pending = await Incidents.at(p_incident) as IncidentStruct<'tx_out'>;

				// pending tx exists
				if(g_pending) {
					// set app context from pending tx record
					const p_app = g_pending.data.app!;
					if(p_app) {
						// load app
						const g_app = await Apps.at(p_app);
						if(g_app) {
							Object.assign(g_context, {
								p_app,
								g_app,
							});
						}
					}
				}

				// download all transaction data from chain
				let g_synced = g_extra.g_synced;
				if(!g_synced) {
					try {
						g_synced = await k_network.downloadTxn(si_txn, g_context.p_account, g_context.p_app, g_pending?.data.events);
					}
					catch(e_download) {
						if(e_download instanceof TransactionNotFoundError) {
							await Incidents.mutateData(p_incident, {
								stage: 'absent',
							});
						}
						else {
							console.error(e_download);
						}

						return;
					}
				}

				// create/overwrite incident
				await Incidents.record({
					type: 'tx_out',
					id: si_txn,
					time: parse_date(g_synced.timestamp as string),
					data: g_synced,
				});

				// notify configs
				const a_notifies: NotifyItemConfig[] = [];

				// route messages
				for(const g_msg of a_msgs) {
					const si_type = g_msg.type;

					let g_notify: NotifyItemConfig | undefined;

					// interpret message
					const f_interpretter = H_INTERPRETTERS[si_type];
					if(f_interpretter) {
						const g_interpretted = await f_interpretter(g_msg.value as JsonObject, g_context);

						// apply message
						g_notify = await g_interpretted.apply?.(a_msgs.length, si_txn);
					}
					// no interpretter
					else {
						// 
						g_notify = {
							title: '✅ Transaction Complete',
							message: '',
						};
					}

					if(g_notify) {
						a_notifies.push(g_notify);
					}
				}

				// merge notify items
				const g_notify_merged = merge_notifies(a_notifies, _g_chain, '🎳 Multi-Message Transaction Success');

				// notifcation
				if(g_notify_merged) {
					fk_notify({
						id: `@incident:${p_incident}`,
						incident: p_incident,
						item: g_notify_merged,
						timeout: 0,  // automatically clear notification after default timeout
					});
				}

				// broadcast reload
				global_broadcast({
					type: 'reload',
				});
			},
		},

		receive: {
			type: 'tx_in',

			filter: `transfer.recipient='${sa_agent}'`,

			async data(a_msgs, g_extra) {
				// transaction hash
				const {si_txn} = g_extra;

				// ref or download tx
				let g_synced = g_extra.g_synced as TxSynced;
				if(!g_synced) {
					try {
						g_synced = await k_network.downloadTxn(si_txn, g_context_vague.p_account);
					}
					catch(e_download) {
						if(e_download instanceof TransactionNotFoundError) {
							await Incidents.mutateData(Incidents.pathFor('tx_in', si_txn), {
								stage: 'absent',
							});
						}

						return;
					}
				}

				// save incident
				const p_incident = await Incidents.record({
					type: 'tx_in',
					id: si_txn,
					time: parse_date(g_extra.g_synced?.timestamp as string),
					data: g_synced,
				});

				// notify configs
				const a_notifies: NotifyItemConfig[] = [];

				// scan messages for those that pertains to this account
				for(const g_msg of a_msgs) {
					const si_type = g_msg.type;

					// prep notify item
					let g_notify: NotifyItemConfig | undefined;

					// interpret message
					const f_interpretter = H_INTERPRETTERS[si_type];
					if(f_interpretter) {
						const g_interpretted = await f_interpretter(g_msg.value as JsonObject, g_context_vague);

						// receive message
						g_notify = await g_interpretted.receive?.(a_msgs.length);
					}
					// no interpretter; use fallback notifiy item
					else {
						g_notify = {
							title: '💵 Received Transfer',
							message: '',
						};
					}

					// push notify item to list
					if(g_notify) a_notifies.push(g_notify);
				}

				// merge notify items
				const g_notify_merged = merge_notifies(a_notifies, _g_chain, '💰 Multiple Transfers Received');

				// notifcation
				if(g_notify_merged) {
					fk_notify({
						id: `@incident:${p_incident}`,
						incident: p_incident,
						item: g_notify_merged,
					});
				}
			},
		},

		granted: {
			type: 'tx_in',

			filter: `message.grantee='${sa_agent}'`,

			data() {
				const s_contact = 'Someone';
				const s_account = _g_account.name;
				const s_action = `send certain messages on their behalf`;

				const g_notify = {
					title: `🤝 Received Authorization`,
					text: `${s_contact} granted ${s_account} the ability to ${s_action}`,
				};
			},
		},
	});
}
