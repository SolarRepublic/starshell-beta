import type {SignedDoc} from './signing';
import type {AminoMsg} from '@cosmjs/amino';
import type {QueryBalanceResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/query';
import type {StringEvent, TxResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/base/abci/v1beta1/abci';
import type {GetLatestBlockResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/query';
import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';

import type {Proposal, TallyResult} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/gov';
import type {ParamChange} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/params';
import type {
	QueryParamsRequest as ParamsQueryConfig} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/query';
import type {
	GetTxsEventResponse,
	BroadcastTxResponse,
	GetTxResponse,
	SimulateResponse,
} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';


import type {ModeInfo, Tx} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';

import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';

import type {
	CodeInfoResponse,
	ContractInfoWithAddress} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';

import type {Account, AccountPath, AccountStruct} from '#/meta/account';
import type {AppPath} from '#/meta/app';
import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {
	Bech32,
	ChainPath,
	HoldingPath,
	ChainStruct,
} from '#/meta/chain';

import type {Cw} from '#/meta/cosm-wasm';
import type {Incident, IncidentStruct, IncidentType, MsgEventRegistry, TxError, TxModeInfo, TxMsg, TxPending, TxSynced} from '#/meta/incident';
import type {Provider, ProviderStruct} from '#/meta/provider';

import type {AdaptedStdSignDoc, GenericAminoMessage} from '#/schema/amino';

import {grpc} from '@improbable-eng/grpc-web';

import {BaseAccount} from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/auth';
import {QueryClientImpl as AuthQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/query';
import {
	GrpcWebImpl,
	QueryClientImpl as BankQueryClient,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/query';

import {MsgSend} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';
import {ServiceClientImpl as TendermintServiceClient} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/query';
import {PubKey} from '@solar-republic/cosmos-grpc/dist/cosmos/crypto/secp256k1/keys';
import {QueryClientImpl as GovQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/query';
import {QueryClientImpl as ParamsQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/query';
import {QueryClientImpl as StakingQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/query';

import {
	BondStatus, bondStatusToJSON,
	type DelegationResponse,
	type Validator,
} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/staking';
import {SignMode} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/signing/v1beta1/signing';
import {
	ServiceGetTxsEventDesc,
	GetTxsEventRequest,
	ServiceClientImpl as TxServiceClient,
	OrderBy,
	BroadcastMode,
	SimulateRequest,
} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
import {Fee, AuthInfo, SignDoc, TxBody, TxRaw} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import {MsgClientImpl as ExecContractClient, MsgExecuteContract, MsgExecuteContractResponse} from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/tx';

import {QueryClientImpl as ComputeQueryClient} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';

import BigNumber from 'bignumber.js';

import {amino_to_base, encode_proto, ProtoMsg, proto_to_amino, TypedValue} from './cosmos-msgs';
import {H_INTERPRETTERS} from './msg-interpreters';
import {signDirectDoc} from './signing';

import {syserr} from '#/app/common';
import {yw_account, yw_chain} from '#/app/mem';

import type {LoadedAppContext, LocalAppContext} from '#/app/svelte';
import type {WsTxResponse} from '#/cosmos/tm-json-rpc-ws-def';
import RuntimeKey from '#/crypto/runtime-key';
import {Secp256k1Key} from '#/crypto/secp256k1';
import {SecretWasm} from '#/crypto/secret-wasm';
import {encrypt, decrypt} from '#/crypto/vault';
import {ATU8_SHA256_STARSHELL, RT_UINT, XG_SYNCHRONIZE_PAGINATION_LIMIT} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {Chains, parse_date, TransactionNotFoundError} from '#/store/chains';
import {Entities} from '#/store/entities';
import {Histories, Incidents} from '#/store/incidents';
import type {
	ActiveNetwork,
	BalanceBundle,
	Cached,
	E2eInfo,
	Transfer} from '#/store/providers';
import {
	MultipleSignersError,
	NetworkTimeoutError,
	UnpublishedAccountError,
	WrongKeyTypeError,
} from '#/store/providers';
import {QueryCache} from '#/store/query-cache';
import {Secrets} from '#/store/secrets';
import {
	fodemtv,
	fold,
	ode,
	oderom,
	with_timeout,
} from '#/util/belt';



import {base64_to_buffer, base93_to_buffer, buffer_to_base64, buffer_to_base93, buffer_to_hex, sha256_sync, sha256_sync_insecure, text_to_buffer, zero_out} from '#/util/data';



export type IncidentTx = Incident.Struct<'tx_in' | 'tx_out'>;

export interface TypedEvent {
	type: 'transfer' | 'message' | 'coin_spent' | 'coin_received';
	attributes: {
		key: string;
		value: string;
	}[];
}

export interface AminoTxConfig {
	account: AccountStruct;
	messages: GenericAminoMessage[];
}

export interface TxConfig {
	chain: ChainStruct;
	msgs: Any[];
	memo: string;
	gasLimit: bigint;
	gasFee: Coin | {
		price: number | string | BigNumber;
	};
	account: AccountStruct;
	mode: BroadcastMode;
}

export interface BroadcastConfig {
	body: Uint8Array;
	auth: Uint8Array;
	signature: Uint8Array;
	mode?: BroadcastMode;
}

export interface ModWsTxResult extends WsTxResponse {
	hash: string;
}

export function fold_attrs<w_out extends object=Dict>(g_event: TypedEvent | StringEvent): w_out {
	// reduce into dict of sets
	const h_pre: Dict<Set<string>> = {};
	for(const g_attr of g_event.attributes) {
		(h_pre[g_attr.key] = h_pre[g_attr.key] || new Set()).add(g_attr.value);
	}

	// convert to strings or lists
	return fodemtv(h_pre, (as_values) => {
		const a_values = [...as_values];

		// single item
		if(1 === a_values.length) return a_values[0];

		// multiple items
		return a_values;
	}) as w_out;
}


function convert_mode_info(g_info: ModeInfo): TxModeInfo {
	if(g_info.multi) {
		return {
			multi: {
				bitarray: Array.from(g_info.multi.bitarray!.elems).reduce((s, xb) => s+xb.toString(2).padStart(8, '0'), '')
					.slice(0, -g_info.multi.bitarray!.extraBitsStored),
				modeInfos: g_info.multi.modeInfos.map(convert_mode_info),
			},
		};
	}

	return g_info as TxModeInfo;
}

interface FetchedTxConfig {
	g_chain: ChainStruct;
	p_chain: ChainPath;
	p_account: AccountPath;
	si_txn: string;
	g_tx: Tx;
	g_result: TxResponse;
	p_app?: AppPath | null;
	h_events?: Partial<MsgEventRegistry>;
}

function fetched_tx_to_synced_record(gc_fetched: FetchedTxConfig): TxSynced {
	const {
		g_tx,
		g_result,
		si_txn,
		g_chain,
		p_chain,
		p_account,
		p_app,
		h_events,
	} = gc_fetched;

	const h_events_merged = h_events || {};

	for(const g_log_msg of g_result.logs) {
		for(const g_event of g_log_msg.events) {
			const si_event = g_event.type;

			(h_events_merged[si_event] = h_events_merged[si_event] || []).push(fold_attrs(g_event));
		}
	}

	// // attempt to parse raw log
	// let a_raw_log = [];
	// try {
	// 	a_raw_log = JSON.parse(g_result.rawLog);
	// }
	// catch(e_parse) {}

	// {
	// 	events: {
	// 		type: string;
	// 		attributes: {
	// 			key: string;
	// 			value: string;
	// 		}[];
	// 	}[];
	// }[];

	return {
		stage: 'synced',
		app: p_app || null,
		chain: p_chain,
		account: p_account,
		hash: si_txn,
		code: g_result.code,
		raw_log: g_result.rawLog,
		fiats: {},
		events: h_events_merged,

		height: g_result.height as Cw.Uint128,
		timestamp: g_result.timestamp as Cw.String,
		gas_used: g_result.gasUsed as Cw.Uint128,
		gas_wanted: g_result.gasWanted as Cw.Uint128,

		// serialize proto messages
		msgs: g_tx.body?.messages.map(g => ({
			typeUrl: g.typeUrl,
			value: buffer_to_base93(g.value),
		})) || [],

		// authInfo
		...g_tx.authInfo
			? (g_auth => ({
				// fee
				...g_auth.fee
					? (g_fee => ({
						fee_amounts: g_fee.amount as Cw.Coin[],
						gas_limit: g_fee.gasLimit as Cw.Uint128,
						payer: g_fee.payer as Cw.Bech32,
						granter: g_fee.granter as Cw.Bech32,
					}))(g_auth.fee)
					: {
						gas_limit: '' as Cw.Uint128,
					},

				// signerInfos
				signers: g_auth.signerInfos.map(g_signer => ({
					pubkey: buffer_to_base64(g_signer.publicKey?.value || new Uint8Array(0)),
					sequence: g_signer.sequence as Cw.Uint128,
					mode_info: convert_mode_info(g_signer.modeInfo!),
				})),
			}))(g_tx.authInfo)
			: {
				gas_limit: '' as Cw.Uint128,
			},

		memo: g_tx.body?.memo || '',
	};
}

// async function depaginate<g_response>(fk_call: () => Promise<g_response>): Promise<g_response> {
// 	const g_response = await fk_call({
// 		pagination: {
// 			limit: ,
// 		},
// 	});
// }

/**
 * Signing information for a single signer that is not included in the transaction.
 *
 * @see https://github.com/cosmos/cosmos-sdk/blob/v0.42.2/x/auth/signing/sign_mode_handler.go#L23-L37
 */
export interface SignerData {
	readonly accountNumber: bigint;
	readonly sequence: bigint;
	readonly chainId: string;
}

export interface JsonMsgSend extends JsonObject {
	fromAddress: string;
	toAddress: string;
	amount: Cw.Coin[];
}

export interface PendingSend extends JsonObject {
	chain: ChainPath;
	hash: string;
	owner: Bech32;
	coin: string;
	msg: JsonMsgSend;
	raw: string;
}

export class CosmosNetwork implements ActiveNetwork {
	protected readonly _p_chain: ChainPath;
	protected readonly _y_grpc: GrpcWebImpl;
	protected _ks_cache: Awaited<ReturnType<typeof QueryCache.read>>;

	constructor(protected readonly _g_provider: ProviderStruct, protected readonly _g_chain: ChainStruct) {
		this._p_chain = Chains.pathFrom(_g_chain);

		this._y_grpc = new GrpcWebImpl(_g_provider.grpcWebUrl, {
			transport: grpc.CrossBrowserHttpTransport({withCredentials:false}),
		});

		void this.reloadCached();
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}

	// TODO: delete?
	protected async _sync_outgoing(g_tx: Tx, g_incident: IncidentStruct<'tx_out'> | null, sa_owner: Bech32): Promise<void> {
		const g_chain = this._g_chain;

		const [p_account, g_account] = await Accounts.find(sa_owner, g_chain);

		const g_data = g_incident?.data;

		const p_app = g_data?.app! || null;

		const g_app = (p_app? await Apps.at(p_app): G_APP_EXTERNAL)!;

		// prep context
		const g_context: LocalAppContext = {
			p_account,
			g_account,
			// p_app: Apps.pathFrom(g_app),
			p_app: p_app,
			g_app,
			g_chain,
			p_chain: Chains.pathFrom(g_chain),
			sa_owner,
		};

		// decode messages
		const a_msgs_amino = g_tx.body!.messages.map(g_msg => proto_to_amino(g_msg, g_chain.bech32s.acc));

		// secret wasm chain
		if(g_chain.features.secretwasm) {
			// each message in amino equivalent form
			for(const g_msg of a_msgs_amino) {
				const si_msg = g_msg.type;

				// locate message interpretter
				const f_interpret = H_INTERPRETTERS[si_msg];
				if(f_interpret) {
					// interpret message
					const g_interpretted = await f_interpret(g_msg.value, g_context);

					// apply message if hook is defined
					await g_interpretted.apply?.();
				}
			}
		}
	}

	async saveQueryCache(sa_owner: Bech32, si_key: string, g_data: JsonObject, xt_when: number) {
		// update cache
		await QueryCache.open(async(ks_cache) => {
			// update entry
			await ks_cache.set(this._p_chain, sa_owner, si_key, {
				timestamp: xt_when,
				data: g_data,
			});

			// reset cached store instance
			this._ks_cache = ks_cache;
		});
	}

	protected async _update_balance(
		sa_owner: Bech32,
		si_coin: string,
		g_balance: Coin,
		xt_when: number
	): Promise<[HoldingPath, Cached<Coin> | null]> {
		// read from cache
		const g_cached = (this._ks_cache || await this.reloadCached()).get(this._p_chain, sa_owner, si_coin) as Cached<Coin> | null;

		// update cache
		await this.saveQueryCache(sa_owner, si_coin, JSON.parse(JSON.stringify(g_balance)), xt_when);

		// return updated balance and cached
		const p_holding = Entities.holdingPathFor(sa_owner, si_coin, this._p_chain);
		return [p_holding, g_cached];
	}

	async signerData(sa_sender: string): Promise<SignerData> {
		// get account data
		const g_response = await new AuthQueryClient(this._y_grpc).account({
			address: sa_sender,
		});

		// destructure response
		const {
			typeUrl: si_type,
			value: atu8_data,
		} = g_response?.account || {};

		// not found
		if(!si_type) {
			throw new Error(`Account for ${sa_sender} was not found on chain. Likely has zero balance.`);
		}
		else if(si_type !== '/cosmos.auth.v1beta1.BaseAccount') {
			throw new Error(`Cannot sign with account of type "${si_type}", can only sign with BaseAccount.`);
		}

		// decode data
		const g_account = BaseAccount.decode(atu8_data!);

		return {
			chainId: this._g_chain.reference,
			accountNumber: BigInt(g_account.accountNumber),
			sequence: BigInt(g_account.sequence),
		};
	}

	async reloadCached(): Promise<typeof this._ks_cache> {
		return this._ks_cache = await QueryCache.read();
	}

	async latestBlock(): Promise<GetLatestBlockResponse> {
		return await new TendermintServiceClient(this._y_grpc).getLatestBlock({});
	}

	cachedCoinBalance(sa_owner: Bech32, si_asset: string): Cached<Coin> | null {
		if(!this._ks_cache) return null;

		return this._ks_cache.get(this._p_chain, sa_owner, si_asset) as Cached<Coin> | null;
	}

	async bankBalance(sa_owner: Bech32, si_coin?: string, xt_age=0): Promise<BalanceBundle> {
		// normalize coin id
		si_coin = si_coin || Object.keys(this._g_chain.coins)[0];

		// prep balance response
		let g_response!: QueryBalanceResponse;

		// acquire lock before loading balance
		await navigator.locks.request(`net:balance:${si_coin}:${sa_owner}:${this._p_chain}`, async() => {
			// cache attempt
			try {
				// read cache
				const g_cached = this.cachedCoinBalance(sa_owner, si_coin!);

				// cache exists and is within age limit
				if(g_cached && Date.now() - g_cached?.timestamp <= xt_age) {
					g_response = {
						balance: g_cached.data,
						cached: g_cached.data,
						holding: Entities.holdingPathFor(sa_owner, si_coin!, this._p_chain),
					};
				}
			}
			// in case of failure
			catch(e_cached) {
				// ignore
			}

			// query balance
			g_response = await new BankQueryClient(this._y_grpc).balance({
				address: sa_owner,
				denom: this._g_chain.coins[si_coin!].denom,
			});
		});

		// destructure response
		const {
			balance: g_balance,
		} = g_response;

		// no response
		if(!g_balance) {
			throw new Error(`Failed to fetch balance`);
		}

		// TODO: refactor `_update_balance`

		// return updated balance
		const [p_holding, g_cached] = await this._update_balance(sa_owner, si_coin, g_balance, Date.now());
		return {
			balance: g_balance,
			cached: g_cached,
			holding: p_holding,
		} as BalanceBundle;
	}

	async bankBalances(sa_owner: Bech32): Promise<Dict<BalanceBundle>> {
		const xt_req = Date.now();

		const g_response = await new BankQueryClient(this._y_grpc).allBalances({
			address: sa_owner,
		});

		const {
			balances: a_balances,
		} = g_response;

		// ref coins
		const h_coins = this._g_chain.coins;

		// create lookup table for denoms
		const h_denoms = oderom(h_coins, (si_coin, g_coin) => ({
			[g_coin.denom]: si_coin,
		}));

		// prep outputs
		const h_outs: Dict<BalanceBundle> = {};

		// each returned balance
		for(const g_balance of a_balances) {
			// lookup coin
			const si_coin = h_denoms[g_balance.denom];
			const g_coin = h_coins[si_coin];

			// add tuple to dict
			const [p_holding, g_cached] = await this._update_balance(sa_owner, si_coin, g_balance, xt_req);
			h_outs[si_coin] = {
				balance: g_balance,
				cached: g_cached,
				holding: p_holding,
			} as BalanceBundle;
		}

		return h_outs;
	}

	get provider(): ProviderStruct {
		return this._g_provider;
	}

	get hasRpc(): boolean {
		return !!this._g_provider.rpcHost;
	}

	listen(a_events: string[], fke_receive: (d_kill: Event | null, g_value?: JsonObject, si_txn?: string) => Promisable<void>): Promise<() => void> {
		return new Promise((fk_resolve) => {
			const p_host = this._g_provider.rpcHost;

			if(!p_host) throw new Error('Cannot subscribe to events; no RPC host configured on network');

			const d_ws = new WebSocket(`wss://${p_host}/websocket`);

			d_ws.onopen = (d_event) => {
				d_ws.send(JSON.stringify({
					jsonrpc: '2.0',
					method: 'subscribe',
					id: '0',
					params: {
						query: a_events.join(' AND '),
					},
				}));

				fk_resolve(() => {
					b_user_closed = true;
					d_ws.close();
				});
			};

			d_ws.onmessage = (d_event: MessageEvent<string>) => {
				const g_msg = JSON.parse(d_event.data || '{}');

				const g_value = g_msg?.result?.data?.value;

				const si_txn = (g_msg?.result?.events?.['tx.hash']?.[0] as string || '').toUpperCase();

				if(g_value) {
					void fke_receive(null, g_value as JsonObject, si_txn);
				}
			};

			let b_user_closed = false;
			d_ws.onclose = (d_event) => {
				if(!b_user_closed) {
					void fke_receive(d_event);
				}
			};

			d_ws.onerror = (d_event) => {
				void fke_receive(d_event);
			};
		});
	}


	onReceive(sa_owner: Bech32, fke_receive: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void> {
		return this.listen([
			`tm.event='Tx'`,
			`transfer.recipient='${sa_owner}'`,
		], (d_kill, g_value, si_txn) => {
			const g_result = g_value?.TxResult as JsonObject;
			void fke_receive(d_kill, g_result? {
				...g_result,
				hash: si_txn,
			} as ModWsTxResult: void 0);
		});
	}

	onSend(sa_owner: Bech32, fke_send: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void> {
		return this.listen([
			`tm.event='Tx'`,
			`transfer.sender='${sa_owner}'`,
		], (d_kill, g_value, si_txn) => {
			const g_result = g_value?.TxResult as JsonObject;
			void fke_send(d_kill, g_result? {
				...g_result,
				hash: si_txn,
			} as ModWsTxResult: void 0);
		});
	}

	async e2eInfoFor(sa_other: Bech32, s_height_max=''): Promise<E2eInfo> {
		return await with_timeout({
			duration: 10e3,
			trip: () => new NetworkTimeoutError(),
			run: async() => {
				const g_response = await new TxServiceClient(this._y_grpc).getTxsEvent({
					events: [
						`message.sender='${sa_other}'`,
						...s_height_max? [`block.height<${s_height_max}`]: [],
					],
					pagination: {
						limit: '1',
					},
					orderBy: OrderBy.ORDER_BY_DESC,
				});

				if(!g_response?.txs?.length) {
					throw new UnpublishedAccountError(sa_other, this._g_chain);
				}

				const a_signers = g_response.txs[0].authInfo!.signerInfos;
				if(1 !== a_signers.length) {
					throw new MultipleSignersError(sa_other, this._g_chain);
				}

				const {
					typeUrl: si_pubkey_type,
					value: atu8_pubkey_35,
				} = a_signers[0].publicKey!;

				if('/cosmos.crypto.secp256k1.PubKey' !== si_pubkey_type) {
					throw new WrongKeyTypeError(sa_other, this._g_chain);
				}

				// ensure the module is initialized
				await Secp256k1Key.init();

				return {
					sequence: a_signers[0].sequence,
					height: g_response.txResponses[0].height,
					hash: g_response.txResponses[0].txhash,
					// priorSequence: a_signers[1]?.sequence,
					// priorHeight: g_response.txResponses[1]?.height,
					// priorHash: g_response.txResponses[1]?.txhash,
					pubkey: Secp256k1Key.uncompressPublicKey(atu8_pubkey_35.subarray(2)),
				};
			},
		});
	}

	async ecdh(atu8_other_pubkey: Uint8Array, g_chain=yw_chain.get(), g_account=yw_account.get()): Promise<CryptoKey> {
		// get account's signing key
		const k_key = await Accounts.getSigningKey(g_account);

		// derive shared secret
		const atu8_shared = await k_key.ecdh(atu8_other_pubkey);

		// import base key
		const dk_hkdf = await crypto.subtle.importKey('raw', atu8_shared, 'HKDF', false, ['deriveBits', 'deriveKey']);

		// zero out shared secret
		zero_out(atu8_shared);

		// derive encryption/decryption key
		const dk_aes = await crypto.subtle.deriveKey({
			name: 'HKDF',
			hash: 'SHA-256',
			salt: ATU8_SHA256_STARSHELL,  // TODO: ideas for salt?
			info: sha256_sync(text_to_buffer(g_chain.reference)),
		}, dk_hkdf, {
			name: 'AES-GCM',
			length: 256,
		}, false, ['encrypt', 'decrypt']);

		return dk_aes;
	}

	async ecdhEncrypt(atu8_other_pubkey: Uint8Array, atu8_plaintext: Uint8Array, atu8_nonce: Uint8Array, g_chain=yw_chain.get(), g_account=yw_account.get()): Promise<Uint8Array> {
		// derive encryption key
		const dk_aes = await this.ecdh(atu8_other_pubkey, g_chain, g_account);

		// encrypt memo
		const atu8_encrypted = await encrypt(atu8_plaintext, dk_aes, atu8_nonce);

		return atu8_encrypted;
	}

	async ecdhDecrypt(atu8_other_pubkey: Uint8Array, atu8_ciphertext: Uint8Array, atu8_nonce: Uint8Array, g_chain=yw_chain.get(), g_account=yw_account.get()): Promise<Uint8Array> {
		// derive encryption key
		const dk_aes = await this.ecdh(atu8_other_pubkey, g_chain, g_account);

		// decrypt memo
		const atu8_decrypted = await decrypt(atu8_ciphertext, dk_aes, atu8_nonce);

		return atu8_decrypted;
	}

	async isContract(sa_account: string): Promise<boolean> {
		const g_response = await new TxServiceClient(this._y_grpc).getTxsEvent({
			events: [
				`message.contract_address='${sa_account}'`,
			],
			orderBy: OrderBy.ORDER_BY_ASC,
			pagination: {
				limit: '1',
			},
		});

		return g_response.txResponses.length > 0;
	}

	async received(sa_owner: string, n_min_block=0): Promise<Transfer[]> {
		const g_response = await new TxServiceClient(this._y_grpc).getTxsEvent({
			events: [
				`transfer.recipient='${sa_owner}'`,
				`tx.height>=${n_min_block}`,
			],
			pagination: {
				limit: '100',
			},
		});


		const y_client = grpc.client(ServiceGetTxsEventDesc, {
			host: 'wss://rpc.testnet.secretsaturn.net/websocket',
			transport: grpc.WebsocketTransport(),
			debug: true,
		});

		y_client.onHeaders((g_headers) => {
			console.log(g_headers);
			debugger;
		});

		y_client.onMessage((g_msg) => {
			console.log(g_msg);
			debugger;
		});

		y_client.onEnd((w_status, s_msg, g_trailers) => {
			console.log({
				w_status,
				s_msg,
				g_trailers,
			});
			debugger;
			console.log('#end');
		});

		y_client.start();

		const g_tx = GetTxsEventRequest.fromPartial({
			events: [
				`tm.event='Tx'`,
			],
		});
		debugger;
		y_client.send({
			...g_tx,
			...ServiceGetTxsEventDesc.requestType,
		});
		y_client.finishSend();

			// this._y_grpc = new GrpcWebImpl(_g_provider.grpcWebUrl, {
			// 	transport: grpc.CrossBrowserHttpTransport({withCredentials:false}),
			// });',
			// transport: grpc.CrossBrowserHttpTransport({withCredentials:false}),
		// });

		// 
		if(!g_response) {
			throw new Error('Failed to fetch transaction');
		}

		// more pages
		const n_pages = +(g_response.pagination?.total || 1);
		if(n_pages > 1) {
			throw new Error('Not yet implemented');
		}

		const a_outs: Transfer[] = [];

		// each txn
		for(const g_txn of g_response.txResponses) {
			// parse events
			const a_events = JSON.parse(g_txn.rawLog)[0].events! as TypedEvent[];

			// each event
			for(const g_event of a_events) {
				// locate the transfer event
				if('transfer' === g_event.type) {
					// parse the attributes into dict
					const h_attrs = fold_attrs(g_event);

					// push transfer object
					a_outs.push({
						...h_attrs,
						height: g_txn.height,
						timestamp: g_txn.timestamp,
						txhash: g_txn.txhash,
					} as Transfer);
				}
			}
		}

		console.log(a_outs);

		// TODO: cache txResponses at current height

		return a_outs;
	}


	// async signAmino(gc_amino: AminoTxConfig) {
	// 	// prep gas fee data
	// 	const {
	// 		messages: a_msgs,
	// 	} = gc_amino as Coin;

	// 	// prep gas fee data
	// 	let {
	// 		amount: s_gas_fee_amount,
	// 		denom: s_denom,
	// 	} = gc_fee as Coin;

	// 	// create gas fee from gas price and gas limit
	// 	if(gc_fee['price']) {
	// 		// compute the gas fee amount based on gas price and gas limit
	// 		s_gas_fee_amount = new BigNumber(gc_fee['price'] as BigNumber).times(xg_gas_limit.toString()).toString();

	// 		// use default native coin
	// 		s_denom = Object.values(g_chain.coins)[0].denom;
	// 	}

	// 	// derive account's address
	// 	const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

	// 	// get account's signing key
	// 	const k_secp = await Accounts.getSigningKey(g_account);

	// 	// export its public key
	// 	const atu8_pk = k_secp.exportPublicKey();

	// 	// encode txn body
	// 	const atu8_body = encode_proto(TxBody, {
	// 		messages: a_msgs,
	// 		memo: s_memo,
	// 	});

	// 	// fetch latest signer info
	// 	const g_signer = await this.signerData(sa_owner);

	// 	// generate auth info bytes
	// 	const atu8_auth = encode_proto(AuthInfo, {
	// 		signerInfos: [
	// 			{
	// 				publicKey: {
	// 					typeUrl: '/cosmos.crypto.secp256k1.PubKey',
	// 					value: encode_proto(PubKey, {
	// 						key: atu8_pk,
	// 					}),
	// 				},
	// 				modeInfo: {
	// 					single: {
	// 						mode: SignMode.,
	// 					},
	// 				},
	// 				sequence: g_signer.sequence+'',
	// 			},
	// 		],
	// 		fee: {
	// 			amount: [{
	// 				amount: s_gas_fee_amount,
	// 				denom: s_denom,
	// 			}],
	// 			gasLimit: xg_gas_limit+'',
	// 		},
	// 	});

	// 	// produce signed doc bytes
	// 	const {signature:atu8_signature} = await signDirectDoc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.reference);

	// 	return this.broadcastDirect({
	// 		body: atu8_body,
	// 		auth: atu8_auth,
	// 		signature: atu8_signature,
	// 		mode: xc_mode,
	// 	});
	// }

	packAmino(g_amino: AdaptedStdSignDoc, atu8_auth: Uint8Array, atu8_signature: Uint8Array) {
		const atu8_body = encode_proto(TxBody, {
			messages: g_amino.msgs.map(g => amino_to_base(g).encode()),
			memo: g_amino.memo,
		});

		return this.finalizeTxRaw({
			body: atu8_body,
			auth: atu8_auth,
			signature: atu8_signature,
		});
	}

	async signDirectAndBroadcast(gc_tx: TxConfig): Promise<[TxResponse, Uint8Array]> {
		const {
			chain: g_chain,
			msgs: a_msgs,
			memo: s_memo,
			gasLimit: xg_gas_limit,
			gasFee: gc_fee,
			account: g_account,
			mode: xc_mode,
		} = gc_tx;

		// prep gas fee data
		let {
			amount: s_gas_fee_amount,
			denom: s_denom,
		} = gc_fee as Coin;

		// create gas fee from gas price and gas limit
		if(gc_fee['price']) {
			// compute the gas fee amount based on gas price and gas limit
			s_gas_fee_amount = new BigNumber(gc_fee['price'] as BigNumber).times(xg_gas_limit.toString()).toString();

			// use default native coin
			s_denom = Object.values(g_chain.coins)[0].denom;
		}

		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// get account's signing key
		const k_secp = await Accounts.getSigningKey(g_account);

		// export its public key
		const atu8_pk = k_secp.exportPublicKey();

		// encode txn body
		const atu8_body = encode_proto(TxBody, {
			messages: a_msgs,
			memo: s_memo,
		});

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		// generate auth info bytes
		const atu8_auth = encode_proto(AuthInfo, {
			signerInfos: [
				{
					publicKey: {
						typeUrl: '/cosmos.crypto.secp256k1.PubKey',
						value: encode_proto(PubKey, {
							key: atu8_pk,
						}),
					},
					modeInfo: {
						single: {
							mode: SignMode.SIGN_MODE_DIRECT,
						},
					},
					sequence: g_signer.sequence+'',
				},
			],
			fee: {
				amount: [{
					amount: s_gas_fee_amount,
					denom: s_denom,
				}],
				gasLimit: xg_gas_limit+'',
			},
		});

		// produce signed doc bytes
		const {signature:atu8_signature} = await signDirectDoc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.reference);

		return this.broadcastDirect({
			body: atu8_body,
			auth: atu8_auth,
			signature: atu8_signature,
			mode: xc_mode,
		});
	}

	finalizeTxRaw(gc_tx: BroadcastConfig): {atu8_tx: Uint8Array; sxb16_hash: string} {
		// deststructure args
		const {
			body: atu8_body,
			auth: atu8_auth,
			signature: atu8_signature,
		} = gc_tx;

		// produce txn raw bytes
		const atu8_tx = encode_proto(TxRaw, {
			bodyBytes: atu8_body,
			authInfoBytes: atu8_auth,
			signatures: [atu8_signature],
		});

		return {
			atu8_tx,
			sxb16_hash: buffer_to_hex(sha256_sync_insecure(atu8_tx)).toUpperCase(),
		};
	}

	async broadcastDirect(gc_broadcast: BroadcastConfig): Promise<[TxResponse, Uint8Array]> {
		const {
			atu8_tx,
			sxb16_hash,
		} = this.finalizeTxRaw(gc_broadcast);

		// deststructure args
		const {
			mode: xc_mode=BroadcastMode.BROADCAST_MODE_SYNC,
		} = gc_broadcast;

		// prep response
		let g_response: BroadcastTxResponse;

		// depending on broadcast mode
		switch(xc_mode) {
			// sync mode
			case BroadcastMode.BROADCAST_MODE_SYNC: {
				g_response = await new TxServiceClient(this._y_grpc).broadcastTx({
					txBytes: atu8_tx,
					mode: BroadcastMode.BROADCAST_MODE_SYNC,
				});
				break;
			}

			// async mode
			case BroadcastMode.BROADCAST_MODE_ASYNC: {
				g_response = await new TxServiceClient(this._y_grpc).broadcastTx({
					txBytes: atu8_tx,
					mode: BroadcastMode.BROADCAST_MODE_ASYNC,
				});
				break;
			}

			default: {
				throw new Error(`Invalid broadcast mode: ${xc_mode}`);
			}
		}

		console.debug(`Broadcast tx response: %o`, g_response);

		// if(!si_txn) {
		// 	throw syserr({
		// 		title: 'Provider Error',
		// 		text: `The ${this._g_provider.name} provider node failed to broadcast your transaction.`,
		// 	});
		// }

		return [g_response.txResponse!, atu8_tx];
	}

	async fetchParams() {
		const g_response = await new AuthQueryClient(this._y_grpc).params({});

		const {
			maxMemoCharacters: nl_memo_chars_max,
			txSizeCostPerByte: n_cost_per_byte,
		} = g_response.params!;
	}


	async networkParam(gc_params: ParamsQueryConfig): Promise<ParamChange | undefined> {
		const g_response = await new ParamsQueryClient(this._y_grpc).params(gc_params);

		return g_response.param;
	}

	async proposal(si_proposal: string): Promise<Proposal | undefined> {
		const g_response = await new GovQueryClient(this._y_grpc).proposal({
			proposalId: si_proposal,
		});

		return g_response?.proposal;
	}


	async tallyResult(si_proposal: string): Promise<TallyResult | undefined> {
		const g_response = await new GovQueryClient(this._y_grpc).tallyResult({
			proposalId: si_proposal,
		});

		return g_response.tally;
	}

	fetchTx(si_txn: string): Promise<GetTxResponse> {
		return new TxServiceClient(this._y_grpc).getTx({
			hash: si_txn,
		});
	}

	async downloadTxn(si_txn: string, p_account: AccountPath, p_app?: AppPath | null, h_events?: Partial<MsgEventRegistry>): Promise<TxSynced> {
		// download txn
		let g_response: GetTxResponse;
		try {
			g_response = await this.fetchTx(si_txn);
		}
		catch(e_fetch) {
			if(e_fetch instanceof Error) {
				if(e_fetch.message.includes('tx not found')) {
					throw new TransactionNotFoundError();
				}
			}

			throw e_fetch;
			// throw syserr({
			// 	title: 'Critical tx error',
			// 	text: `${e_fetch.message}`,
			// });
		}

		// validate response
		if(!g_response?.tx || !g_response?.txResponse) {
			throw syserr({
				title: 'Transaction not fonud',
				text: `Transaction ${si_txn} was not found`,
			});
		}

		// destructure response
		const {
			tx: g_tx,
			txResponse: g_result,
		} = g_response;

		// convert to synced record struct
		return fetched_tx_to_synced_record({
			g_tx,
			g_result,
			p_app: p_app || Apps.pathFrom(G_APP_EXTERNAL),
			p_chain: this._p_chain,
			g_chain: this._g_chain,
			p_account,
			si_txn,
			h_events: h_events || {},
		});
	}

	async* synchronize_v2(
		si_type: IncidentType,
		a_events: string[],
		p_account: AccountPath
	): AsyncIterableIterator<{
		g_tx: Tx;
		g_result: TxResponse;
		g_synced: TxSynced | TxError;
	}> {
		// create sync id
		const si_sync = a_events.join('\n');

		// fetch latest sync height
		const xg_synced = await Histories.syncHeight(this._p_chain, si_sync);

		// prep grpc client
		const y_service = new TxServiceClient(this._y_grpc);

		// fetch current block height
		const g_latest = await this.latestBlock();
		const s_latest = String(g_latest.block?.header?.height || '');

		// ensure the data is good
		if(!RT_UINT.test(s_latest)) {
			throw syserr({
				title: 'Sync failed',
				text: `${this._g_provider.name} returned an invalid block`,
			});
		}

		// pagination control
		let xg_offset = 0n;
		let xg_seen = 0n;
		let atu8_key: Uint8Array | null = null;

		// // start with a single probe
		// let xg_limit = 1n;

		// start with a small probe
		let xg_limit = 6n;

		// prep context used across all paginations
		const g_apriori = {
			p_chain: this._p_chain,
			g_chain: this._g_chain,
			p_account: p_account,
		};

		ARCHIVING:
		for(;;) {
			// fetch in batch
			const g_response: GetTxsEventResponse = await y_service.getTxsEvent({
				events: a_events,
				orderBy: OrderBy.ORDER_BY_DESC,
				pagination: atu8_key
					? {
						limit: ''+xg_limit,
						key: atu8_key,
					}
					: {
						limit: ''+xg_limit,
						offset: ''+xg_offset,
					},
			});

			// destructure response
			const {
				txs: a_txs,
				txResponses: a_results,
			} = g_response;

			// cache incidents store
			const ks_incidents_former = await Incidents.read();

			// height range of sync
			let xg_height_hi = 0n;
			let xg_height_lo = BigInt(s_latest);

			// process each transaction
			const nl_txns = a_txs.length;
			xg_seen += BigInt(nl_txns);
			for(let i_txn=0; i_txn<nl_txns; i_txn++) {
				// ref tx raw and info
				const g_tx = a_txs[i_txn];
				const g_result = a_results[i_txn];

				// ref transaction hash
				const si_txn = g_result.txhash.toUpperCase();

				// construct incident path
				const p_incident = Incidents.pathFor(si_type, si_txn);

				// check for existing incident
				const g_incident = ks_incidents_former.at(p_incident) as IncidentStruct<'tx_in' | 'tx_out'>;
				const g_data = g_incident?.data as TxSynced;

				// final version of transaction does not yet exist in incidents
				if('synced' !== g_data?.stage) {
					// convert to synced
					const g_synced = fetched_tx_to_synced_record({
						...g_apriori,
						g_tx,
						g_result,
						si_txn,
						p_app: g_data?.app,
						h_events: g_data?.events || {},
					});

					// yield
					yield {
						g_tx,
						g_result,
						g_synced,
					};
				}

				// parse height of tx
				const xg_height = BigInt(g_result.height);

				// update height range
				if(xg_height > xg_height_hi) xg_height_hi = xg_height;
				if(xg_height < xg_height_lo) xg_height_lo = xg_height;
			}

			// synced with chain
			if(xg_synced > xg_height_lo) break;

			// more results
			const s_total = g_response.pagination?.total || '0';
			if(s_total && (BigInt(s_total) - xg_seen) > 0n) {
				// use 'nextKey'
				atu8_key = g_response.pagination!.nextKey;
				xg_offset += xg_limit;

				// use full limit now
				xg_limit = XG_SYNCHRONIZE_PAGINATION_LIMIT;
				continue;
			}

			// reached very end
			break;
		}

		// there are still pending txs
		{
			const a_pending = [...await Incidents.filter({
				type: 'tx_out',
				stage: 'pending',
			})];

			// check each one explicityl
			if(a_pending.length) {
				for(const g_pending of a_pending) {
					const {
						hash: si_txn,
						app: p_app,
					} = g_pending.data as TxPending;

					const p_incident = Incidents.pathFrom(g_pending);

					let g_synced!: TxSynced;
					try {
						g_synced = await this.downloadTxn(si_txn, p_account, p_app);
					}
					catch(e_download) {
						if(e_download instanceof TransactionNotFoundError) {
							// update incident
							await Incidents.mutateData(p_incident, {
								stage: 'absent',
							});
						}
					}

					// synced with chain; merge incident
					if(g_synced) {
						await Incidents.mutateData(p_incident, g_synced);
					}
				}

				// debugger;
				// console.log(a_pending);
			}
		}

		// update histories sync info
		await Histories.updateSyncInfo(this._p_chain, si_sync, s_latest);
	}

	async delegations(sa_owner: Bech32): Promise<DelegationResponse[]> {
		const g_response = await new StakingQueryClient(this._y_grpc).delegatorDelegations({
			delegatorAddr: sa_owner,
			pagination: {
				limit: '200',
			},
		});

		return g_response.delegationResponses;
	}

	async stakingInfo() {
		const g_params = await new StakingQueryClient(this._y_grpc).params({});
		const g_pool = await new StakingQueryClient(this._y_grpc).pool({});

		console.log({
			g_params,
			g_pool,
		});
	}

	async validators(): Promise<Validator[]> {
		const g_response = await new StakingQueryClient(this._y_grpc).validators({
			status: bondStatusToJSON(BondStatus.BOND_STATUS_BONDED),
			pagination: {
				limit: '200',
			},
		});

		return g_response.validators;
	}


	async codeInfo(si_code: `${bigint}`): Promise<CodeInfoResponse | undefined> {
		return (await new ComputeQueryClient(this._y_grpc).code({
			codeId: si_code,
		})).codeInfo;
	}

	async contractsByCode(si_code: `${bigint}`): Promise<ContractInfoWithAddress[]> {
		const g_response = await new ComputeQueryClient(this._y_grpc).contractsByCodeId({
			codeId: si_code,
		});

		return g_response.contractInfos;
	}

	async codeHashByContractAddress(sa_contract: Bech32): Promise<string> {
		const g_response = await new ComputeQueryClient(this._y_grpc).codeHashByContractAddress({
			contractAddress: sa_contract,
		});

		return g_response.codeHash;
	}

	async encodeExecuteContract(
		g_account: AccountStruct,
		sa_contract: Bech32,
		g_msg: JsonObject,
		s_code_hash: string,
		a_funds: Coin[]=[]
	): Promise<{amino: AminoMsg; proto: Any}> {
		const y_client = new ExecContractClient(this._y_grpc);

		if(!s_code_hash) {
			s_code_hash = await this.codeHashByContractAddress(sa_contract);
		}

		let atu8_msg: Uint8Array;

		const k_secp = await Accounts.getSigningKey(g_account);

		// ref features
		const h_features = this._g_chain.features;

		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);


		let si_amino_msg: string;

		// secretwasm chain
		if(h_features['secretwasm']) {
			const sxb93_consensus_pk = this._g_chain.features.secretwasm?.consensusIoPubkey;
			if(!sxb93_consensus_pk) {
				throw syserr({
					title: 'Missing Chain Information',
					text: 'No consensus IO public key found.',
				});
			}

			const atu8_consensus_pk = base93_to_buffer(sxb93_consensus_pk);

			si_amino_msg = '/';

			// prep wasm instance
			let k_wasm!: SecretWasm;

			// account has signed a wasm seed; load secretwasm
			const p_secret_wasm = g_account.utilityKeys['secretWasmTx'];
			if(p_secret_wasm) {
				k_wasm = await Secrets.borrow(p_secret_wasm, kn_seed => new SecretWasm(atu8_consensus_pk, kn_seed.data));
			}

			// no pre-existing tx encryption key; generate a random seed
			if(!k_wasm) {
				k_wasm = new SecretWasm(atu8_consensus_pk);
			}

			atu8_msg = await k_wasm.encrypt(s_code_hash, g_msg);
		}
		// cosmwasm chain
		else if(h_features['cosmwasm']) {
			// TODO: implement
			throw new Error('not yet implemented');
			// atu8_msg
		}
		// does not support smart contracts
		else {
			throw new Error(`Chain does not support CosmWasm`);
		}

		// construct as amino message
		const g_amino: AminoMsg = {
			type: 'wasm/MsgExecuteContract',
			value: {
				sender: sa_owner,
				contract: sa_contract,
				msg: buffer_to_base64(atu8_msg),
				sent_funds: a_funds,
			},
		};

		// safely convert to proto
		const g_proto = amino_to_base(g_amino).encode();

		return {
			amino: g_amino,
			proto: g_proto,
		};
	}


	// -----------

	async authInfoDirect(g_account: AccountStruct, gc_fee: Partial<Fee>): Promise<{auth: Uint8Array; signer: SignerData}> {
		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// get account's signing key
		const k_secp = await Accounts.getSigningKey(g_account);

		// export its public key
		const atu8_pk = k_secp.exportPublicKey();

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		// generate auth info bytes
		const atu8_auth = encode_proto(AuthInfo, {
			signerInfos: [
				{
					publicKey: {
						typeUrl: '/cosmos.crypto.secp256k1.PubKey',
						value: encode_proto(PubKey, {
							key: atu8_pk,
						}),
					},
					modeInfo: {
						single: {
							mode: SignMode.SIGN_MODE_DIRECT,
						},
					},
					sequence: g_signer.sequence+'',
				},
			],
			fee: Fee.fromPartial(gc_fee),
		});

		return {
			auth: atu8_auth,
			signer: g_signer,
		};
	}


	async authInfoAmino(g_account: AccountStruct, gc_fee: Partial<Fee>): Promise<{auth: Uint8Array; signer: SignerData}> {
		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// get account's signing key
		const k_secp = await Accounts.getSigningKey(g_account);

		// export its public key
		const atu8_pk = k_secp.exportPublicKey();

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		// generate auth info bytes
		const atu8_auth = encode_proto(AuthInfo, {
			signerInfos: [
				{
					publicKey: {
						typeUrl: '/cosmos.crypto.secp256k1.PubKey',
						value: encode_proto(PubKey, {
							key: atu8_pk,
						}),
					},
					modeInfo: {
						single: {
							mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
						},
					},
					sequence: g_signer.sequence+'',
				},
			],
			fee: Fee.fromPartial(gc_fee),
		});

		return {
			auth: atu8_auth,
			signer: g_signer,
		};
	}


	/**
	 * 
	 */
	async signDirect(g_account: AccountStruct, g_chain: ChainStruct, atu8_body: Uint8Array, g_fee: Fee): Promise<SignedDoc> {
		// fetch auth and signer info
		const {
			auth: atu8_auth,
			signer: g_signer,
		} = await this.authInfoDirect(g_account, g_fee);

		// produce signed doc bytes
		return await signDirectDoc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.reference);
	}


	// async 

	async simulate(g_account: AccountStruct, g_body: Partial<TxBody>, atu8_auth: Uint8Array): Promise<SimulateResponse> {
		const g_chain = this._g_chain;

		const atu8_body = encode_proto(TxBody, g_body);

		const sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		const {
			signature: atu8_signature,
		} = await signDirectDoc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.reference);


		const atu8_tx = encode_proto(TxRaw, {
			bodyBytes: atu8_body,
			authInfoBytes: atu8_auth,
			signatures: [atu8_signature],
		});

		const g_simulated = await new TxServiceClient(this._y_grpc).simulate({
			txBytes: atu8_tx,
		});

		return g_simulated;
	}
}
