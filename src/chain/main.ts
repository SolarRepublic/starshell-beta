import { yw_account, yw_chain, yw_chain_ref, yw_network_active } from '#/app/mem';
import type { Bech32, Bip44, Chain, ChainPath, Family, HoldingPath, NativeCoin } from '#/meta/chain';
import type { Network } from '#/meta/network';
import { Chains } from '#/store/chains';
import { Entities } from '#/store/entities';
import { ActiveNetwork, BalanceBundle, Cached, E2eInfo, MultipleSignersError, NetworkTimeoutError, Transfer, UnpublishedAccountError, WrongKeyTypeError, WsTxResult } from '#/store/networks';
import { QueryCache } from '#/store/query-cache';
import { Dict, fodemtv, fold, JsonObject, oderom, Promisable, timeout, with_timeout } from '#/util/belt';
import {grpc} from '@improbable-eng/grpc-web';

import {
	GrpcWebImpl,
	QueryBalanceResponse,
	QueryClientImpl as BankQueryClient,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/query';

import {
	QueryClientImpl as AuthQueryClient, QueryParamsRequest,
} from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/query';

import type {
	Coin,
} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';

import {
	ServiceGetTxsEventDesc,
	GetTxsEventRequest,
	GetTxsEventResponse,
	ServiceClientImpl as TxServiceClient,
	OrderBy,
	BroadcastMode,
	BroadcastTxResponse,
	GetTxResponse,
} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';

import {
	GetLatestBlockResponse,
	ServiceClientImpl as TendermintServiceClient,
} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/query';

import type {
	TxResult,
} from '@solar-republic/cosmos-grpc/dist/tendermint/abci/types';

import {
	MsgSend,
	MsgClientImpl as BankMsgClient,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';
import { instantiateSecp256k1 } from '@solar-republic/wasm-secp256k1';

import type { Any } from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
import { PubKey } from '@solar-republic/cosmos-grpc/dist/cosmos/crypto/secp256k1/keys';

import { AuthInfo, ModeInfo, SignDoc, Tx, TxBody, TxRaw } from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import { base64_to_buffer, buffer_to_base64, buffer_to_string8, sha256, sha256_sync, string8_to_buffer, text_to_buffer, zero_out } from '#/util/data';
import { SignMode } from '@solar-republic/cosmos-grpc/dist/cosmos/tx/signing/v1beta1/signing';
import { Keyring } from '#/crypto/keyring';
import { Secrets } from '#/store/secrets';
import { Secp256k1Key } from '#/crypto/secp256k1';
import RuntimeKey from '#/crypto/runtime-key';
import { Accounts } from '#/store/accounts';
import { BaseAccount } from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/auth';
import BigNumber from 'bignumber.js';
import type { Account } from '#/meta/account';
import { syserr } from '#/app/common';
import type { Merge } from 'ts-toolbelt/out/Object/Merge';
import type { Cast } from 'ts-toolbelt/out/Any/Cast';
import { ATU8_SHA256_STARSHELL, encrypt, decrypt } from '#/crypto/vault';
import { Histories, Incidents } from '#/store/incidents';
import type { Incident, IncidentType, TxModeInfo, TxMsg, TxPending, TxSynced } from '#/meta/incident';
import type { Cw } from '#/meta/cosm-wasm';
import type { StringEvent, TxResponse } from '@solar-republic/cosmos-grpc/dist/cosmos/base/abci/v1beta1/abci';
import { XG_SYNCHRONIZE_PAGINATION_LIMIT } from '#/share/constants';

export type IncidentTx = Incident.Struct<'tx_in' | 'tx_out'>;

export interface TypedEvent {
	type: 'transfer' | 'message' | 'coin_spent' | 'coin_received';
	attributes: {
		key: string;
		value: string;
	}[];
}

export interface BroadcastConfig {
	chain: Chain['interface'];
	msgs: Any[];
	memo: string;
	gasLimit: bigint;
	gasFee: Coin | {
		price: number | string | BigNumber;
	};
	account: Account['interface'];
	mode: BroadcastMode;
}

export interface ModWsTxResult extends WsTxResult {
	hash: string;
}

export function fold_attrs<w_out extends object=Dict>(g_event: TypedEvent | StringEvent): w_out {
	return fold(g_event.attributes, g_attr => ({
		[g_attr.key]: g_attr.value,
	})) as w_out;
}


async function sign_doc(g_account: Account['interface'], xg_account_number: bigint, atu8_auth: Uint8Array, atu8_body: Uint8Array, si_chain: string): Promise<Uint8Array> {
	const g_doc = SignDoc.fromPartial({
		accountNumber: xg_account_number+'',
		authInfoBytes: atu8_auth,
		bodyBytes: atu8_body,
		chainId: si_chain,
	});

	// encode signdoc
	const atu8_doc = SignDoc.encode(g_doc).finish();

	// ref account secret path
	const p_secret = g_account.secret;

	// fetch secret
	const g_secret = await Secrets.get(p_secret);

	if('none' !== g_secret?.security.type) {
		throw new Error(`Keyring not yet implemented`);
	}

	// import signing key
	const k_key = await Secp256k1Key.import(await RuntimeKey.createRaw(string8_to_buffer(g_secret.data)));

	// sign document
	return await k_key.sign(atu8_doc, true);
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

function tx_to_synced(p_chain: ChainPath, si_txn: string, g_tx: Tx, g_result: TxResponse): TxSynced {
	return {
		stage: 'synced',
		chain: p_chain,
		hash: si_txn,
		code: g_result.code,
		raw_log: g_result.rawLog,
		fiats: {},

		height: g_result.height as Cw.Uint128,
		timestamp: g_result.timestamp as Cw.String,
		gas_used: g_result.gasUsed as Cw.Uint128,
		gas_wanted: g_result.gasWanted as Cw.Uint128,

		msgs: g_result.logs.map(g_log => ({
			events: fold(g_log.events, g_event => ({
				[g_event.type]: fold_attrs(g_event),
			})),
		})) as TxMsg[],

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
	owner: Bech32.String;
	coin: string;
	msg: JsonMsgSend;
	raw: string;
}

export class CosmosNetwork implements ActiveNetwork {
	private readonly _p_chain: ChainPath;
	private readonly _y_grpc: GrpcWebImpl;
	private _ks_cache: Awaited<ReturnType<typeof QueryCache.read>>;

	constructor(private readonly _g_network: Network['interface'], private readonly _g_chain: Chain['interface']) {
		this._p_chain = Chains.pathFrom(_g_chain);

		this._y_grpc = new GrpcWebImpl(_g_network.grpcWebUrl, {
			transport: grpc.CrossBrowserHttpTransport({withCredentials:false}),
		});

		void this.reloadCached();
	}

	protected async _signer_data(sa_sender: string): Promise<SignerData> {
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
			chainId: this._g_chain.id,
			accountNumber: BigInt(g_account.accountNumber),
			sequence: BigInt(g_account.sequence),
		};
	}

	protected async _update_balance(sa_owner: string, si_coin: string, g_balance: Coin, xt_when: number): Promise<[HoldingPath, Cached<Coin> | null]> {
		const p_holding = Entities.holdingPathFor(sa_owner, si_coin, this._p_chain);

		// read from cache
		const g_cached = (this._ks_cache || await this.reloadCached()).at(p_holding) as Cached<Coin> | null;

		// update cache
		await QueryCache.open(async(ks) => {
			// update entry
			await ks.set(p_holding, {
				timestamp: xt_when,
				data: JSON.parse(JSON.stringify(g_balance)),
			});

			// reset cached store instance
			this._ks_cache = ks;
		});

		// return updated balance and cached
		return [p_holding, g_cached];
	}

	async reloadCached(): Promise<typeof this._ks_cache> {
		return this._ks_cache = await QueryCache.read();
	}

	async latestBlock(): Promise<GetLatestBlockResponse> {
		return await new TendermintServiceClient(this._y_grpc).getLatestBlock({});
	}

	cachedBalance(sa_owner: string, si_coin: string): Cached<Coin> | null {
		const p_holding = Entities.holdingPathFor(sa_owner, si_coin, this._p_chain);

		if(!this._ks_cache) return null;

		return this._ks_cache.at(p_holding) as Cached<Coin> | null;
	}

	async bankBalance(sa_owner: Bech32.String, si_coin?: string, xt_since=0): Promise<BalanceBundle> {
		const xt_req = Date.now();

		// normalize coin id
		si_coin = si_coin || Object.keys(this._g_chain.coins)[0];

		// // normalize since
		// if(xt_since <= 0) xt_since += xt_req;

		// // read cache
		// const g_cached = this.cachedBalance(sa_owner, si_coin);

		// // cache is within asking time
		// if(g_cached?.timestamp >= xt_since) {
		// 	return 
		// }

		// query balance
		const g_response = await new BankQueryClient(this._y_grpc).balance({
			address: sa_owner,
			denom: this._g_chain.coins[si_coin].denom,
		});

		const {
			balance: g_balance,
		} = g_response;

		// no response
		if(!g_balance) {
			throw new Error(`Failed to fetch balance`);
		}

		// return updated balance
		const [p_holding, g_cached] = await this._update_balance(sa_owner, si_coin, g_balance, xt_req);
		return {
			balance: g_balance,
			cached: g_cached,
			holding: p_holding,
		} as BalanceBundle;
	}

	async bankBalances(sa_owner: Bech32.String): Promise<Dict<BalanceBundle>> {
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

	get hasRpc(): boolean {
		return !!this._g_network.rpcHost;
	}

	listen(a_events: string[], fke_receive: (d_kill: Event | null, g_value?: JsonObject, si_txn?: string) => Promisable<void>): Promise<() => void> {
		return new Promise((fk_resolve) => {
			const p_host = this._g_network.rpcHost;

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

				const si_txn = g_msg?.result?.events?.['tx.hash']?.[0] as string || '';

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


	onReceive(sa_owner: Bech32.String, fke_receive: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void> {
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

	onSend(sa_owner: Bech32.String, fke_send: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void> {
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

	async e2eInfoFor(sa_other: Bech32.String, s_height_max=''): Promise<E2eInfo> {
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
		// ref account secret path
		const p_secret = g_account.secret;

		// fetch secret
		const g_secret = await Secrets.get(p_secret);

		if('none' !== g_secret?.security.type) {
			throw new Error(`Keyring not yet implemented`);
		}

		// import signing key
		const k_key = await Secp256k1Key.import(await RuntimeKey.createRaw(string8_to_buffer(g_secret.data)));

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
			info: sha256_sync(text_to_buffer(g_chain.id)),
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

			// this._y_grpc = new GrpcWebImpl(_g_network.grpcWebUrl, {
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
					const h_attrs = fold_attrs(g_event) as Pick<Transfer, 'sender' | 'recipient' | 'amount'>;

					// push transfer object
					a_outs.push({
						...h_attrs,
						height: g_txn.height,
						timestamp: g_txn.timestamp,
						txhash: g_txn.txhash,
					});
				}
			}
		}

		console.log(a_outs);
		
		// TODO: cache txResponses at current height

		return a_outs;
	}

	async bankSend(
		sa_sender: Bech32.String,
		sa_recipient: Bech32.String,
		si_coin: string,
		xg_amount: bigint,
		xg_limit: bigint,
		x_price: number,
		s_memo='',
		xc_mode=BroadcastMode.BROADCAST_MODE_SYNC,
		g_chain=yw_chain.get()
	): Promise<TxPending> {
		const g_coin = g_chain.coins[si_coin];

		const g_msg_send = MsgSend.fromPartial({
			amount: [{
				denom: g_coin.denom,
				amount: xg_amount.toString(),
			}],
			fromAddress: sa_sender,
			toAddress: sa_recipient,
		});

		const g_encoded: Any = {
			typeUrl: '/cosmos.bank.v1beta1.MsgSend',
			value: MsgSend.encode(g_msg_send).finish(),
		};

		// locate account
		let g_account!: Account['interface'];
		const ks_accounts = await Accounts.read();
		for(const [, g_account_test] of ks_accounts.entries()) {
			if(sa_sender === Chains.addressFor(g_account_test.pubkey, g_chain)) {
				g_account = g_account_test;
				break;
			}
		}

		// account not found
		if(!g_account) {
			throw syserr({
				title: 'Critical Error',
				text: `Failed to locate account associated with ${sa_sender}`,
			});
		}

		const [g_response] = await this.broadcast({
			chain: g_chain,
			account: g_account,
			msgs: [g_encoded],
			memo: s_memo,
			gasLimit: xg_limit,
			gasFee: {
				price: x_price,
			},
			mode: xc_mode,
		});

		// construct pending transaction
		return {
			stage: 'pending',
			chain: Chains.pathFrom(g_chain),
			code: g_response.code,
			hash: g_response.txhash,
			gas_limit: `${xg_limit}` as Cw.Uint128,
			gas_wanted: g_response.gasWanted as Cw.Uint128,
			gas_used: g_response.gasUsed as Cw.Uint128,
			raw_log: g_response.rawLog,

			msgs: [
				{
					events: {
						transfer: {
							sender: g_msg_send.fromAddress as Cw.Bech32,
							recipient: g_msg_send.toAddress as Cw.Bech32,
							amount: `${g_msg_send.amount[0].amount as Cw.Uint128}${g_msg_send.amount[0].denom}` as Cw.Amount,
						},
					},
				},
			],
		};
	}

	async broadcast(gc_broadcast: BroadcastConfig): Promise<[TxResponse, Uint8Array]> {
		const {
			chain: g_chain,
			msgs: a_msgs,
			memo: s_memo,
			gasLimit: xg_gas_limit,
			gasFee: gc_fee,
			account: g_account,
			mode: xc_mode,
		} = gc_broadcast;

		// prep gas fee data
		let {
			amount: s_gas_fee_amount,
			denom: s_denom,
		} = gc_fee as Coin;

		// create gas fee from price
		if(gc_fee['price']) {
			// compute the gas fee amount based on gas price and gas limit
			s_gas_fee_amount = new BigNumber(gc_fee['price'] as BigNumber).times(xg_gas_limit.toString()).toString();

			// use default native coin
			s_denom = Object.values(g_chain.coins)[0].denom;
		}

		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// ref account secret path
		const p_secret = g_account.secret;

		// fetch secret
		const g_secret = await Secrets.get(p_secret);

		if('none' !== g_secret?.security.type) {
			throw new Error(`Keyring not yet implemented`);
		}

		// import signing key
		const k_secp = await Secp256k1Key.import(await RuntimeKey.create(() => string8_to_buffer(g_secret.data)), true);

		// export its public key
		const atu8_pk = k_secp.exportPublicKey();

		// encode txn body
		const g_tx_body = TxBody.fromPartial({
			messages: a_msgs,
			memo: s_memo,
		});
		const atu8_body = TxBody.encode(g_tx_body).finish();

		// fetch latest signer info
		const g_signer = await this._signer_data(sa_owner);

		// generate auth info bytes
		const g_auth_body = AuthInfo.fromPartial({
			signerInfos: [
				{
					publicKey: {
						typeUrl: '/cosmos.crypto.secp256k1.PubKey',
						value: PubKey.encode(PubKey.fromPartial({
							key: atu8_pk,
						})).finish(),
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

		const atu8_auth = AuthInfo.encode(g_auth_body).finish();

		// produce signed doc bytes
		const atu8_signature = await sign_doc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.id);

		// produce txn raw bytes
		const atu8_txn = TxRaw.encode(TxRaw.fromPartial({
			bodyBytes: atu8_body,
			authInfoBytes: atu8_auth,
			signatures: [atu8_signature],
		})).finish();

		// prep response
		let g_response: BroadcastTxResponse;

		// depending on broadcast mode
		switch(xc_mode) {
			// sync mode
			case BroadcastMode.BROADCAST_MODE_SYNC: {
				g_response = await new TxServiceClient(this._y_grpc).broadcastTx({
					txBytes: atu8_txn,
					mode: BroadcastMode.BROADCAST_MODE_SYNC,
				});
				break;
			}

			// async mode
			case BroadcastMode.BROADCAST_MODE_ASYNC: {
				g_response = await new TxServiceClient(this._y_grpc).broadcastTx({
					txBytes: atu8_txn,
					mode: BroadcastMode.BROADCAST_MODE_ASYNC,
				});
				break;
			}

			default: {
				throw new Error(`Invalid broadcast mode: ${xc_mode}`);
			}
		}

		// if(!si_txn) {
		// 	throw syserr({
		// 		title: 'Provider Error',
		// 		text: `The ${this._g_network.name} provider node failed to broadcast your transaction.`,
		// 	});
		// }

		return [g_response.txResponse!, atu8_txn];
	}

	async fetchParams() {
		const g_response = await new AuthQueryClient(this._y_grpc).params({});

		const {
			maxMemoCharacters: nl_memo_chars_max,
			txSizeCostPerByte: n_cost_per_byte,
		} = g_response.params!;
	}

	fetchTx(si_txn: string): Promise<GetTxResponse> {
		return new TxServiceClient(this._y_grpc).getTx({
			hash: si_txn,
		});
	}

	async downloadTxn(si_txn: string): Promise<TxSynced> {
		// download txn
		const g_response = await this.fetchTx(si_txn);

		if(!g_response?.tx || !g_response?.txResponse) {
			throw syserr({
				title: 'Transaction not fonud',
				text: `Transaction ${si_txn} was not found`,
			});
		}

		const {
			tx: g_tx,
			txResponse: g_result,
		} = g_response;

		return tx_to_synced(this._p_chain, si_txn, g_tx, g_result);

		// // start by inserting known event
		// await Incidents.open(async(ks_events) => {
		// 	await ks_events.insert(g_event);
		// });

		// // download txn
		// const g_response = await new TxServiceClient(this._y_grpc).getTx({
		// 	hash: g_event.data.hash!,
		// });

		// // fetch extra properties
		// const s_memo = g_response?.tx?.body?.memo || '';
		// const s_sequence = g_response?.tx?.authInfo?.signerInfos[0].sequence;

		// // update event
		// await Incidents.delete(g_event);
		// await Incidents.insert({
		// 	...g_event,
		// 	data: {
		// 		...g_event.data,
		// 		memo: s_memo,
		// 		sequence: s_sequence,
		// 		gasWanted: g_response.txResponse?.gasWanted,
		// 		gasUsed: g_response.txResponse?.gasUsed,
		// 	},
		// });
	}

	async* synchronize(si_type: IncidentType, a_events: string[]): AsyncIterableIterator<IncidentTx> {
		// 
		const y_service = new TxServiceClient(this._y_grpc);

		let xg_offset = 0n;
		let xg_seen = 0n;
		let atu8_key: Uint8Array | null = null;

		// fetch latest sync height
		const xg_synced = await Histories.syncHeight(this._p_chain, [si_type, ...a_events].join('\n'));

		// fetch current block height
		const g_latest = await this.latestBlock();
		const s_latest = g_latest.block?.header?.height;

		if(!s_latest) {
			throw syserr({
				title: 'Sync failed',
				text: `${this._g_network.name} returned an invalid block`,
			});
		}

		for(;;) {
			// fetch batch
			const g_response: GetTxsEventResponse = await y_service.getTxsEvent({
				events: a_events,
				orderBy: OrderBy.ORDER_BY_DESC,
				pagination: atu8_key
					? {
						limit: ''+XG_SYNCHRONIZE_PAGINATION_LIMIT,
						key: atu8_key,
					}
					: {
						limit: ''+XG_SYNCHRONIZE_PAGINATION_LIMIT,
						offset: ''+xg_offset,
					},
			});

			// destructure
			const {
				txs: a_txs,
				txResponses: a_infos,
			} = g_response;

			// 
			const a_yields: IncidentTx[] = [];

			// open incidents and histories stores
			const b_break = await Incidents.open(ks_incidents => Histories.open(async(ks_histories) => {  // eslint-disable-line @typescript-eslint/no-loop-func
				// process each transaction
				const nl_txns = a_txs.length;
				xg_seen += BigInt(nl_txns);
				for(let i_txn=0; i_txn<nl_txns; i_txn++) {
					const g_tx = a_txs[i_txn];
					const g_info = a_infos[i_txn];

					const si_txn = g_info.txhash;
					const p_incident = Incidents.pathFor(si_type, si_txn);

					// synced version of transaction does not yet exist in incidents
					const g_incident = ks_incidents.at(p_incident);
					if('synced' !== (g_incident?.data as TxSynced)?.stage) {
						// convert to synced
						const g_synced = tx_to_synced(this._p_chain, si_txn, g_tx, g_info);

						// wrap as incident
						const g_update: IncidentTx = {
							type: si_type as Extract<'tx_in' | 'tx_out', IncidentType>,
							id: si_txn,
							time: new Date(g_synced.timestamp).getTime(),
							data: g_synced,
						};

						// record in incidents list
						await ks_incidents.record(si_txn, g_update, ks_histories);

						// yield
						a_yields.push(g_update);
					}

					// chain is already synced below this height; stop archiving
					const xg_height = BigInt(g_info.height);
					if(xg_synced < xg_height) {
						return true;
					}
				}

				return false;
			}));

			for(const g_synced of a_yields) {
				yield g_synced;
			}

			if(b_break) {
				break;
			}

			// more results
			const s_total = g_response.pagination?.total || '0';
			if(s_total && (BigInt(s_total) - xg_seen) > 0n) {
				// use 'nextKey'
				atu8_key = g_response.pagination!.nextKey;
				xg_offset += XG_SYNCHRONIZE_PAGINATION_LIMIT;
				continue;
			}

			break;
		}

		// update histories sync info
		await Histories.updateSyncInfo(this._p_chain, [si_type, ...a_events].join('\n'), s_latest);
	}

	async* synchronizeAll(sa_owner: Bech32.String): AsyncIterableIterator<IncidentTx> {
		for await(const g_incident of this.synchronize('tx_in', [
			`transfer.recipient='${sa_owner}'`,
		])) {
			yield g_incident;
		}

		for await(const g_incident of this.synchronize('tx_out', [
			`message.sender='${sa_owner}'`,
		])) {
			yield g_incident;
		}
	}
}
