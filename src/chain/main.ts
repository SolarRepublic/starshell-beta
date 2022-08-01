import { yw_account, yw_chain, yw_chain_ref } from '#/app/mem';
import type { Bech32, Chain, ChainPath, Family, HoldingPath } from '#/meta/chain';
import type { Network } from '#/meta/network';
import { Chains } from '#/store/chains';
import { Entities } from '#/store/entities';
import type { ActiveNetwork, BalanceBundle, Cached, Transfer, WsTxResult } from '#/store/networks';
import { QueryCache } from '#/store/query-cache';
import { Dict, fodemtv, fold, JsonObject, oderom, Promisable } from '#/util/belt';
import {grpc} from '@improbable-eng/grpc-web';

import * as secp from '@noble/secp256k1';

import {
	GrpcWebImpl,
	QueryBalanceResponse,
	QueryClientImpl as BankQueryClient,
} from 'cosmos-grpc/dist/cosmos/bank/v1beta1/query';

import {
	QueryClientImpl as AuthQueryClient,
} from 'cosmos-grpc/dist/cosmos/auth/v1beta1/query';

import type {
	Coin,
} from 'cosmos-grpc/dist/cosmos/base/v1beta1/coin';

import {
	ServiceGetTxsEventDesc,
	GetTxsEventRequest,
	GetTxsEventResponse,
	ServiceClientImpl as TxServiceClient,
	OrderBy,
	BroadcastMode,
} from 'cosmos-grpc/dist/cosmos/tx/v1beta1/service';

import type {
	TxResult,
} from 'cosmos-grpc/dist/tendermint/abci/types';

import {
	MsgSend,
	MsgClientImpl as BankMsgClient,
} from 'cosmos-grpc/dist/cosmos/bank/v1beta1/tx';
import { instantiateSecp256k1 } from '@solar-republic/wasm-secp256k1';

import type { Any } from 'cosmos-grpc/dist/google/protobuf/any';
import { PubKey } from 'cosmos-grpc/dist/cosmos/crypto/secp256k1/keys';

import { AuthInfo, SignDoc, TxBody, TxRaw } from 'cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import { base64_to_buffer, buffer_to_base64, buffer_to_string8, sha256, sha256_sync, string8_to_buffer } from '#/util/data';
import { SignMode } from 'cosmos-grpc/dist/cosmos/tx/signing/v1beta1/signing';
import { Keyring } from '#/crypto/keyring';
import { Secrets } from '#/store/secrets';
import { Secp256k1Key } from '#/crypto/secp256k1';
import RuntimeKey from '#/crypto/runtime-key';
import { Accounts } from '#/store/accounts';
import { BaseAccount } from 'cosmos-grpc/dist/cosmos/auth/v1beta1/auth';
import BigNumber from 'bignumber.js';
import type { Account } from '#/meta/account';
import { syserr } from '#/app/common';
import type { Merge } from 'ts-toolbelt/out/Object/Merge';
import type { Cast } from 'ts-toolbelt/out/Any/Cast';

export interface TypedEvent {
	type: 'transfer' | 'message' | 'coin_spent' | 'coin_received';
	attributes: {
		key: string;
		value: string;
	}[];
}

export interface BroadcastConfig {
	msgs: Any[];
	memo: string;
	gasLimit: bigint;
	gasFee: Coin | {
		price: number | string | BigNumber;
	};
	account?: Account['interface'];
}


export const fold_attrs = (g_event: TypedEvent): Dict => fold(g_event.attributes, g_attr => ({
	[g_attr.key]: g_attr.value,
}));


async function sign_doc(xg_account_number: bigint, atu8_auth: Uint8Array, atu8_body: Uint8Array, si_chain: string): Promise<Uint8Array> {
	const g_doc = SignDoc.fromPartial({
		accountNumber: xg_account_number+'',
		authInfoBytes: atu8_auth,
		bodyBytes: atu8_body,
		chainId: si_chain,
	});

	// encode signdoc
	const atu8_doc = SignDoc.encode(g_doc).finish();

	// ref account secret path
	const p_secret = yw_account.get().secret;

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

interface JsonMsgSend extends JsonObject {
	fromAddress: string;
	toAddress: string;
	amount: {
		denom: string;
		amount: string;
	}[];
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
		const g_cached = this._ks_cache.at(p_holding) as Cached<Coin> | null;

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

	async reloadCached(): Promise<void> {
		this._ks_cache = await QueryCache.read();
	}

	cachedBalance(sa_owner: string, si_coin: string): Cached<Coin> | null {
		const p_holding = Entities.holdingPathFor(sa_owner, si_coin, this._p_chain);

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

	listen(a_events: string[], fke_receive: (d_kill: Event | null, g_value?: JsonObject) => Promisable<void>): () => void {
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
		};

		d_ws.onmessage = (d_event: MessageEvent<string>) => {
			// console.log(d_event.data);

			const g_msg = JSON.parse(d_event.data || '{}');

			const g_value = g_msg?.result?.data?.value;

			if(g_value) {
				void fke_receive(null, g_value as JsonObject);
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

		return () => {
			b_user_closed = true;
			d_ws.close();
		};
	}


	onReceive(sa_owner: Bech32.String, fke_receive: (d_kill: Event | null, g_tx?: WsTxResult) => Promisable<void>): () => void {
		return this.listen([
			`tm.event='Tx'`,
			`transfer.recipient='${sa_owner}'`,
		], (d_kill, g_value) => {
			void fke_receive(d_kill, (g_value?.TxResult || void 0) as WsTxResult | undefined);
		});
	}

	onSend(sa_owner: Bech32.String, fke_send: (d_kill: Event | null, g_tx?: WsTxResult) => Promisable<void>): () => void {
		return this.listen([
			`tm.event='Tx'`,
			`transfer.sender='${sa_owner}'`,
		], (d_kill, g_value) => {
			void fke_send(d_kill, (g_value?.TxResult || void 0) as WsTxResult | undefined);
		});
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

	async bankSend(sa_sender: Bech32.String, sa_recipient: Bech32.String, si_coin: string, xg_amount: bigint, s_memo='', g_chain=yw_chain.get()): Promise<PendingSend> {
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

		const [si_txn, atu8_txn] = await this.broadcast({
			msgs: [g_encoded],
			memo: s_memo,
			gasLimit: 20_000n,
			gasFee: {
				price: 0.25,
			},
		});

		return {
			chain: yw_chain_ref.get(),
			owner: sa_sender,
			hash: si_txn,
			coin: si_coin,
			msg: g_msg_send as JsonMsgSend,
			raw: buffer_to_string8(atu8_txn),
		};
	}

	async broadcast(gc_broadcast: BroadcastConfig): Promise<[string, Uint8Array]> {
		const {
			msgs: a_msgs,
			memo: s_memo,
			gasLimit: xg_gas_limit,
			gasFee: gc_fee,
			account: g_account=yw_account.get(),
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
			s_denom = Object.values(yw_chain.get().coins)[0].denom;
		}

		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// ref account secret path
		const p_secret = yw_account.get().secret;

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
		const atu8_signature = await sign_doc(g_signer.accountNumber, atu8_auth, atu8_body, yw_chain.get().id);

		// produce txn raw bytes
		const atu8_txn = TxRaw.encode(TxRaw.fromPartial({
			bodyBytes: atu8_body,
			authInfoBytes: atu8_auth,
			signatures: [atu8_signature],
		})).finish();

		// broadcast txn
		const g_response = await new TxServiceClient(this._y_grpc).broadcastTx({
			txBytes: atu8_txn,
			mode: BroadcastMode.BROADCAST_MODE_ASYNC,
		});

		const si_txn = g_response.txResponse?.txhash;

		if(!si_txn) {
			throw syserr({
				text: 'Txn failed to broadcast',
			});
		}

		return [si_txn, atu8_txn];
	}
}
