import type {Snip20} from './snip-20-def';
import type {Snip24} from './snip-24-def';
import type {PortableMessage, Snip2x, TransactionHistoryItem, TransferHistoryItem} from './snip-2x-def';

import type {Coin} from '@cosmjs/amino';
import type {L, N} from 'ts-toolbelt';

import type {AccountStruct} from '#/meta/account';
import type {Dict, JsonObject, JsonValue} from '#/meta/belt';
import type {Bech32, ChainPath, ChainStruct, ContractStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';

import type {SecretStruct} from '#/meta/secret';
import type {TokenStructDescriptor} from '#/meta/token';

import {Fee} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import BigNumber from 'bignumber.js';

import {syserr, syswarn} from '#/app/common';
import type {PrebuiltMessage} from '#/chain/messages/_types';
import {H_SNIP_TRANSACTION_HISTORY_HANDLER} from '#/chain/messages/snip-history';
import type {SecretNetwork} from '#/chain/secret-network';
import {SecretWasm} from '#/crypto/secret-wasm';
import type {NotificationConfig} from '#/extension/notifications';
import {system_notify} from '#/extension/notifications';

import {utility_key_child} from '#/share/account';
import {ATU8_SHA256_STARSHELL, R_SCRT_QUERY_ERROR} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Incidents} from '#/store/incidents';
import type {Cached} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {crypto_random_int, ode} from '#/util/belt';
import {base58_to_buffer, base64_to_buffer, buffer_to_base58, buffer_to_text, buffer_to_uint32_be, concat, json_to_buffer, ripemd160_sync, sha256_sync, text_to_buffer, uint32_to_buffer_be} from '#/util/data';


type TokenInfoResponse = Snip20.BaseQueryResponse<'token_info'>;

export class ViewingKeyError extends Error {}

export class ContractQueryError extends Error {
	constructor(protected _sx_plaintext: string) {
		super(`Contract returned error while attempting query: ${_sx_plaintext}`);
	}

	get data(): JsonObject {
		return JSON.parse(this._sx_plaintext);
	}
}

export const Snip2xUtil = {
	validate_token_info(g_token_info: TokenInfoResponse['token_info']): boolean | undefined | void {
		let n_decimals: number = g_token_info.decimals;

		if('number' !== typeof n_decimals) n_decimals = parseInt(n_decimals);

		if(!Number.isInteger(n_decimals) || n_decimals < 0 || n_decimals > 18) {
			return syswarn({
				title: 'Invalid SNIP-20 token info',
				text: `Expected 'decimals' to be an integer between 0 and 18, but contract returned "${g_token_info.decimals}"`,
			});
		}
	},

	async next_viewing_key(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		z_nonce: Uint8Array|string|null=null
	): Promise<string> {
		// generate the token's viewing key
		const atu8_viewing_key = await utility_key_child(g_account, 'secretNetworkKeys', 'snip20ViewingKey', async(atu8_key) => {
			// prep nonce
			let atu8_nonce = z_nonce as Uint8Array;

			// previous is defined
			DERIVE_NONCE:
			if(!(z_nonce instanceof Uint8Array) || 4 !== z_nonce.byteLength) {
				// nonce taken from previous viewing key
				if('string' === typeof z_nonce) {
					const s_previous = z_nonce;

					// previous is starshell format
					if(s_previous?.startsWith(SX_VIEWING_KEY_PREAMBLE)) {
						// attempt to parse
						try {
							// skip preamble
							const sxb58_data = s_previous.slice(SX_VIEWING_KEY_PREAMBLE.length);

							// base58-decode
							const atu8_data = base58_to_buffer(sxb58_data);

							// parse nonce
							const xg_nonce = BigInt(buffer_to_uint32_be(atu8_data));

							// produce new nonce
							atu8_nonce = uint32_to_buffer_be((xg_nonce + 1n) % (1n << 32n));

							// done
							break DERIVE_NONCE;
						}
						catch(e_parse) {}
					}

					// previous has enough entropy to use as source
					if(s_previous.length >= 4) {
						atu8_nonce = sha256_sync(text_to_buffer(s_previous)).subarray(0, 4);
					}
				}

				// derive nonce from random
				atu8_nonce = uint32_to_buffer_be(crypto_random_int(Number(1n << 32n)));
			}

			// import utility key
			const dk_input = await crypto.subtle.importKey('raw', atu8_key, 'HKDF', false, ['deriveBits']);

			// produce token info by concatenating: utf8-enc(caip-10) | nonce
			const [si_namespace, si_reference] = Chains.parsePath(g_token.chain);
			const atu8_info = concat([text_to_buffer(`${si_namespace}:${si_reference}:${g_token.bech32}:`), atu8_nonce]);

			// derive bits
			const ab_viewing_key = await crypto.subtle.deriveBits({
				name: 'HKDF',
				hash: 'SHA-256',
				salt: ATU8_SHA256_STARSHELL,
				info: atu8_info,
			}, dk_input, 256);

			// encode output vieiwng key
			return concat([atu8_nonce, new Uint8Array(ab_viewing_key)]);
		});

		if(!atu8_viewing_key) {
			throw syserr({
				title: 'No viewing key seed',
				text: `Account "${g_account.name}" is missing a Secret WASM viewing key seed.`,
			});
		}

		// base58-encode to create password
		return SX_VIEWING_KEY_PREAMBLE+buffer_to_base58(atu8_viewing_key);
	},
};


export const SX_VIEWING_KEY_PREAMBLE = '🔑1';
export const ATU8_VIEWING_KEY_PREAMBLE = text_to_buffer(SX_VIEWING_KEY_PREAMBLE);
export const NB_VIEWING_KEY_PREAMBLE = ATU8_VIEWING_KEY_PREAMBLE.byteLength;
export const NB_VIEWING_KEY_STARSHELL = ATU8_VIEWING_KEY_PREAMBLE.byteLength + 4 + 32;

export const Snip2xMessageConstructor = {
	async set_viewing_key(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		s_viewing_key: string
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip20.BaseMessageParameters<'set_viewing_key'> = {
			set_viewing_key: {
				key: s_viewing_key as Cw.ViewingKey,
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},

	async generate_viewing_key(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		z_nonce: Uint8Array|string|null=null
	): Promise<PortableMessage> {
		return await Snip2xMessageConstructor.set_viewing_key(
			g_account,
			g_token,
			k_network,
			await Snip2xUtil.next_viewing_key(g_account, g_token, z_nonce)
		);
	},

	async revoke_permit(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		si_permit: string
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip24.BaseMessageParameters = {
			revoke_permit: {
				permit_name: si_permit,
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},

	async deposit(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		a_funds: Coin[]
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip20.NativeMessageParameters<'deposit'> = {
			deposit: {},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash, a_funds);
	},

	async redeem(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		s_amount: Cw.Uint128,
		s_denom?: Cw.String
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip20.NativeMessageParameters<'redeem'> = {
			redeem: {
				amount: s_amount,
				...s_denom? {denom:s_denom}: {},
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},


	async mint(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		sa_recipient: Cw.Bech32,
		s_amount: Cw.Uint128
	) {
		const g_msg: Snip20.MintableMessageParameters<'mint'> = {
			mint: {
				amount: s_amount,
				recipient: sa_recipient,
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},
};

type QueryRes<si_key extends Snip2x.AnyQueryKey=Snip2x.AnyQueryKey> = Promise<Snip2x.AnyQueryResponse<si_key>>;

export class Snip2xToken {
	static async discover(g_contract: ContractStruct, k_network: SecretNetwork, g_account: AccountStruct): Promise<Snip2xToken | null> {
		// construct token as if it is already snip-20
		const k_token = new Snip2xToken(g_contract, k_network, g_account);

		// snip-20 interface not defined
		if(!g_contract.interfaces.snip20) {
			// attempt token info query
			let g_info: Awaited<QueryRes>['token_info'];
			try {
				g_info = (await k_token.tokenInfo()).token_info;
			}
			catch(e_info) {
				return null;
			}

			// passing implies snip-20; update contract
			g_contract.name = g_contract.name || g_info.name || '';
			g_contract.interfaces.snip20 = {
				decimals: g_info.decimals as 0,
				symbol: g_info.symbol,
			};
			await Contracts.merge(g_contract);
		}

		// discover snip-21
		await Snip2xToken.checkSnip21(k_token);

		// // discover snip-24
		// await Snip2xToken.checkSnip24(k_token);

		return k_token;
	}

	static async checkSnip21(k_token: Snip2xToken): Promise<void> {
		const g_contract = k_token.contract;

		// snip-21 interface not defined
		if(!g_contract.interfaces.snip21) {
			// attempt transaction history query
			try {
				// eslint-disable-next-line @typescript-eslint/no-unused-expressions
				(await k_token.transactionHistory(1)).transaction_history.total;
			}
			catch(e_info) {
				return;
			}

			// passing implies snip-21; update contract
			g_contract.interfaces.snip21 = {};
			await Contracts.merge(g_contract);
		}
	}

	// static async checkSnip24(k_token: Snip2xToken) {
	// 	const g_contract = k_token.contract;

	// 	// snip-21 interface not defined
	// 	if(!g_contract.interfaces.snip22) {
	// 		// attempt transaction history query
	// 		try {
	// 			(await k_token.transactionHistory(1)).transaction_history.total;
	// 		}
	// 		catch(e_info) {
	// 			return;
	// 		}

	// 		// passing implies snip-22; update contract
	// 		g_contract.interfaces.snip22 = {};
	// 		await Contracts.merge(g_contract);
	// 	}
	// }

	static async viewingKeyFor(g_contract: ContractStruct, g_chain: ChainStruct, g_account: AccountStruct): Promise<readonly [Cw.ViewingKey, SecretStruct<'viewing_key'>] | null> {
		const a_keys = await Secrets.filter({
			type: 'viewing_key',
			contract: g_contract.bech32,
			chain: Chains.pathFrom(g_chain),
			owner: Chains.addressFor(g_account.pubkey, g_chain),
		});

		if(!a_keys?.length) return null;

		const p_viewing_key = Secrets.pathFrom(a_keys[0]!);
		return await Secrets.borrowPlaintext(p_viewing_key, (kn, g) => [
			buffer_to_text(kn.data) as Cw.ViewingKey,
			g as SecretStruct<'viewing_key'>,
		] as const);
	}

	static from(g_contract: ContractStruct, k_network: SecretNetwork, g_account: AccountStruct): Snip2xToken | null {
		if(!g_contract.interfaces.snip20) return null;

		return new Snip2xToken(g_contract, k_network, g_account);
	}

	protected _g_chain: ChainStruct;

	protected _sa_owner: Cw.Bech32;

	protected _g_snip20: TokenStructDescriptor<'snip20'>['snip20'];

	constructor(protected _g_contract: ContractStruct, protected _k_network: SecretNetwork, protected _g_account: AccountStruct) {
		this._g_chain = _k_network.chain;
		this._sa_owner = Chains.addressFor(_g_account.pubkey, _k_network.chain) as Cw.Bech32;
		this._g_snip20 = _g_contract.interfaces.snip20!;
	}

	get bech32(): Bech32 {
		return this._g_contract.bech32;
	}

	get contract(): ContractStruct {
		return this._g_contract;
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}

	get account(): AccountStruct {
		return this._g_account;
	}

	get owner(): Bech32 {
		return this._sa_owner;
	}

	get symbol(): string {
		return this._g_snip20.symbol;
	}

	get decimals(): L.UnionOf<N.Range<0, 18>> {
		return this._g_snip20.decimals;
	}

	get coingeckoId(): string | null {
		return this._g_snip20.extra?.coingecko_id || null;
	}

	get snip20(): TokenStructDescriptor['snip21'] {
		return this._g_snip20;
	}

	get snip21(): TokenStructDescriptor['snip21'] | null {
		return this._g_contract.interfaces.snip21 || null;
	}

	get snip22(): TokenStructDescriptor['snip22'] | null {
		return this._g_contract.interfaces.snip22 || null;
	}

	get snip23(): TokenStructDescriptor['snip23'] | null {
		return this._g_contract.interfaces.snip23 || null;
	}

	get snip24(): TokenStructDescriptor['snip24'] | null {
		return this._g_contract.interfaces.snip24 || null;
	}

	protected async _viewing_key_plaintext(): Promise<Cw.ViewingKey> {
		const a_viewing_key = await this.viewingKey();

		if(null === a_viewing_key) {
			throw new Error(`Viewing key is not set or missing for ${Contracts.pathFrom(this._g_contract)}`);
		}

		return a_viewing_key[0];
	}

	async mintable(): Promise<boolean> {
		const {
			_g_chain,
			_g_account,
			_g_contract,
			_k_network,
		} = this;

		try {
			const sa_recipient = Chains.addressFor(_g_account.pubkey, _g_chain) as Cw.Bech32;
			const s_amount = BigNumber('1').shiftedBy(this._g_snip20.decimals).toString() as Cw.Uint128;

			const g_mint = await Snip2xMessageConstructor.mint(_g_account, _g_contract, _k_network, sa_recipient, s_amount);

			// sign
			const {
				auth: atu8_auth,
				signer: g_signer,
			} = await this._k_network.authInfoDirect(_g_account, Fee.fromPartial({}));

			const g_sim = await this._k_network.simulate(_g_account, {
				messages: [
					g_mint.proto,
				],
			}, atu8_auth);
		}
		catch(e_simulate) {
			return false;
		}

		return true;
	}

	async query<si_key extends Snip2x.AnyQueryKey=Snip2x.AnyQueryKey>(g_query: Snip2x.AnyQueryParameters<si_key>): QueryRes<si_key> {
		const g_writeback: {atu8_nonce?: Uint8Array} = {};

		try {
			return await this._k_network.queryContract<Snip2x.AnyQueryResponse<si_key>>(this._g_account, {
				bech32: this._g_contract.bech32,
				hash: this._g_contract.hash,
			}, g_query, g_writeback);
		}
		catch(e_query) {
			// ref query nonce
			const atu8_nonce = g_writeback.atu8_nonce;

			// compute error
			if(2 === e_query['code']) {
				// parse contract error
				const m_error = R_SCRT_QUERY_ERROR.exec(e_query['message'] as string || '');

				// able to decrypt
				if(m_error && atu8_nonce) {
					const [, sxb64_error_ciphertext] = m_error;

					const atu8_ciphertext = base64_to_buffer(sxb64_error_ciphertext);

					// use nonce to decrypt
					const atu8_plaintext = await SecretWasm.decryptBuffer(this._g_account, this._g_chain, atu8_ciphertext, atu8_nonce);

					// utf-8 decode
					const sx_plaintext = buffer_to_text(atu8_plaintext);

					// throw decrypted error
					throw new ContractQueryError(sx_plaintext);
				}
			}

			throw e_query;
		}
	}

	viewingKey(): Promise<readonly [Cw.ViewingKey, SecretStruct<'viewing_key'>] | null> {
		return Snip2xToken.viewingKeyFor(this._g_contract, this._g_chain, this._g_account);
	}

	tokenInfo(): QueryRes<'token_info'> {
		return this.query({
			token_info: {},
		});
	}

	async balance(): QueryRes<'balance'> {
		const g_balance = await this.query({
			balance: {
				address: this._sa_owner,
				key: await this._viewing_key_plaintext(),
			},
		});

		// save to query cache
		await this.writeCache('balance', g_balance.balance);

		return g_balance;
	}

	readCache<w_return>(si_key: string): Promise<Cached<w_return> | null> {
		return this._k_network.readQueryCache(this._sa_owner, `${this._g_contract.bech32}:${si_key}`);
	}

	writeCache(si_key: string, g_data: JsonObject): Promise<void> {
		return this._k_network.saveQueryCache(this._sa_owner, `${this._g_contract.bech32}:${si_key}`, g_data, Date.now());
	}

	// async transferHistory(nl_records=Number.MAX_SAFE_INTEGER): QueryRes<'transfer_history'> {
	// 	nl_page_size = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_page_size));

	// 	// read from cache
	// 	const g_cache = await this.readCache<TransactionHistoryCache>('transaction_history');

	// 	// in async parallel
	// 	const [
	// 		a_txs_cached,
	// 		g_latest,
	// 	] = await Promise.all([
	// 		// read from cache
	// 		this.readCache<Snip2x.AnyQueryResponse<'transfer_history'>[]>('transfer_history'),

	// 		// query for latest
	// 		this.query({
	// 			transfer_history: {
	// 				address: this._sa_owner,
	// 				key: await this._viewing_key_plaintext(),
	// 				page_size: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_records)) as Cw.WholeNumber,
	// 			},
	// 		}),
	// 	]);

	// 	// number of transfers in this response
	// 	const a_latest = g_latest.transfer_history.txs;

	// 	// number of transfers total
	// 	const nl_total = g_latest.transfer_history.total;

	// 	// contract implements snip-21 total
	// 	if('number' === typeof nl_total) {

	// 	}

	// 	for(const g_transfer of a_latest) {
	// 		g_transfer.
	// 	}
	// }

	// async* _read_pages<
	// 	si_query extends Extract<Snip2x.AnyQueryKey, 'transfer_history' | 'transaction_history'>,
	// >(si_query: si_query, h_query: Snip2x.AnyQueryParameters<si_query>, nl_page_size=16) {
	// 	nl_page_size = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_page_size));


	// 	// new tx cache
	// 	const h_txs: TransactionHistoryCache = {...g_cache?.data};


	// 	// page index
	// 	let i_page = 0;

	// 	// loop while there are more pages
	// 	for(;;) {
	// 		// submit query
	// 		const g_response = await this.query({
	// 			[si_query]: {
	// 				...h_query,
	// 				page_size: nl_page_size as Cw.WholeNumber,
	// 				page: i_page as Cw.WholeNumber,
	// 			},
	// 		} as Snip2x.AnyQueryParameters) as unknown as Snip2x.AnyQueryResponse<si_query>;

	// 		// yield response
	// 		yield g_response;

	// 		// parse data
	// 		const g_data = g_response[si_query]!;

	// 		// ref txs list
	// 		const a_txs = g_data.txs;

	// 		// total count in cache
	// 		const nl_cached = Object.keys(h_txs).length;

	// 		// 
	// 		let nl_total = g_data['total'];
	// 		if('number' !== typeof nl_total) nl_total = Infinity;

	// 		// more items in history and result was full
	// 		if(nl_cached < nl_total && a_txs.length === nl_page_size) {
	// 			i_page += 1;
	// 			continue;
	// 		}

	// 		// done
	// 		break;
	// 	}
	// }


	async transferHistory(nl_page_size=16): QueryRes<'transfer_history'> {
		type TransferHistoryCache = TransferHistoryItem[];

		nl_page_size = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_page_size));

		// read from cache
		const g_cache = await this.readCache<{
			transfers: TransferHistoryCache;
			order: string[];
		}>('transfer_history');

		// new transfer cache
		const h_trs: TransferHistoryCache = g_cache?.data?.transfers || [];
		const a_order = g_cache?.data?.order || [];

		// count number of new trs
		let c_new = 0;

		// page index
		let i_page = 0;

		// number of transfers total
		let nl_total: number | undefined = 0;

		// collect notifications
		const a_notifs: NotificationConfig[] = [];

		// loop while there are more pages
		for(;;) {
			// query for latest
			const g_response = await this.query({
				transfer_history: {
					address: this._sa_owner,
					key: await this._viewing_key_plaintext(),
					page_size: nl_page_size as Cw.WholeNumber,
					page: i_page as Cw.WholeNumber,
				},
			});

			// destructure transfer history response
			const g_history = g_response.transfer_history;

			// update total
			nl_total = g_history.total;
			if('number' !== typeof nl_total) nl_total = Infinity;

			// each item in this response
			for(const g_tx of g_history.txs) {
				// hash tx
				const si_tx = buffer_to_base58(ripemd160_sync(sha256_sync(json_to_buffer(g_tx))));

				// item already exists in cache; skip
				if(si_tx in h_trs) continue;

				// new item
				h_trs[si_tx] = g_tx;
				a_order.push(si_tx);
				c_new++;

				// push to notif
				const gc_notif = await this._handle_new_transfer(g_tx, si_tx);
				if(gc_notif) a_notifs.push(gc_notif);
			}

			// total count in cache
			const nl_cached = a_order.length;

			// more items in history and result was full
			if(nl_cached < nl_total && g_history.txs.length === nl_page_size) {
				i_page += 1;
				continue;
			}

			// done
			break;
		}

		// commit cache
		await this.writeCache('transfer_history', {
			transfers: h_trs,
			order: a_order,
		});

		// trigger notifications
		if(a_notifs.length) {
			// TODO: group multiple inbound transfers
			for(const gc_notif of a_notifs) {
				void system_notify(gc_notif);
			}
		}

		// return complete cache
		return {
			transfer_history: {
				total: a_order.length as Cw.WholeNumber,
				txs: a_order.reverse().map((si_tx: string) => h_trs[si_tx]),
			},
		};
	}


	async transactionHistory(nl_page_size=16): QueryRes<'transaction_history'> {
		if(!this.snip22) throw new Error(`'transaction_history' not available on non SNIP-21 contract`);

		type TransactionHistoryCache = Dict<TransactionHistoryItem>;

		nl_page_size = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_page_size));

		// read from cache
		const g_cache = await this.readCache<TransactionHistoryCache>('transaction_history');

		// new tx cache
		const h_txs: TransactionHistoryCache = {...g_cache?.data};

		// count number of new txs
		let c_new = 0;

		// page index
		let i_page = 0;

		// number of transactions total
		let nl_total = 0;

		// collect notifications
		const a_notifs: NotificationConfig[] = [];

		// loop while there are more pages
		for(;;) {
			// query for latest
			const g_response = await this.query({
				transaction_history: {
					address: this._sa_owner,
					key: await this._viewing_key_plaintext(),
					page_size: nl_page_size as Cw.WholeNumber,
					page: i_page as Cw.WholeNumber,
				},
			});

			// destructure transaction history response
			const g_history = g_response.transaction_history;

			// update total
			nl_total = g_history.total;

			// each item in this response
			for(const g_tx of g_history.txs) {
				// hash tx
				const si_tx = buffer_to_base58(ripemd160_sync(sha256_sync(json_to_buffer(g_tx))));

				// item already exists in cache; skip
				if(si_tx in h_txs) continue;

				// new item
				h_txs[si_tx] = g_tx;
				c_new++;

				// push to notif
				const g_transfer = g_tx.action?.transfer;
				if(g_transfer) {
					const gc_notif = await this._handle_new_transfer({
						from: g_transfer.from,
						receiver: g_transfer.recipient,
						coins: g_tx.coins,
						block_time: g_tx.block_time,
						memo: g_tx.memo,
					}, si_tx);
					if(gc_notif) a_notifs.push(gc_notif);
				}
			}

			// total count in cache
			const nl_cached = Object.keys(h_txs).length;

			// more items in history and result was full
			if(nl_cached < nl_total && g_history.txs.length === nl_page_size) {
				i_page += 1;
				continue;
			}

			// done
			break;
		}

		// commit cache
		await this.writeCache('transaction_history', h_txs);

		// trigger notifications
		if(a_notifs.length) {
			// TODO: group multiple inbound transfers
			for(const gc_notif of a_notifs) {
				void system_notify(gc_notif);
			}
		}

		// return complete cache
		return {
			transaction_history: {
				total: nl_total as Cw.WholeNumber,
				txs: ode(h_txs).sort(([si_a, g_a], [si_b, g_b]) => {
					const n_block_diff = g_b.block_height - g_a.block_height;
					if(n_block_diff) return n_block_diff;

					if('number' === typeof g_b.id && 'number' === typeof g_a.id) return g_b.id - g_a.id;

					return si_a < si_b? -1: 1;
				}).map(([, g]) => g),
			},
		};
	}

	async _handle_new_transfer(g_transfer: TransferHistoryItem, si_tx: string): Promise<NotificationConfig | void> {
		const {
			_sa_owner,
			_g_snip20,
			_g_chain,
			_g_account,
			_g_contract,
		} = this;

		// incoming transfer
		if(_sa_owner === g_transfer.receiver) {
			const g_handled = await H_SNIP_TRANSACTION_HISTORY_HANDLER.transfer(g_transfer, {
				g_snip20: _g_snip20,
				g_contract: _g_contract,
				g_chain: _g_chain,
				g_account: _g_account,
			});

			const p_incident = await Incidents.record({
				type: 'token_in',
				data: {
					chain: _g_contract.chain,
					account: Accounts.pathFrom(_g_account),
					bech32: _g_contract.bech32,
					hash: si_tx,
				},
				time: g_transfer.block_time || Date.now(),
			});

			const g_notif = await g_handled?.apply?.();
			if(g_notif) {
				return {
					id: `@incident:${p_incident}`,
					incident: p_incident,
					item: g_notif,
				};
			}
		}
	}

	execute(g_msg: Snip2x.AnyMessageParameters): Promise<PrebuiltMessage> {
		return this._k_network.encodeExecuteContract(this._g_account, this._g_contract.bech32, g_msg, this._g_contract.hash);
	}

	async transfer(xg_amount: bigint, sa_recipient: Bech32, s_memo=''): Promise<PrebuiltMessage> {
		// prep snip-20 message
		const g_msg: Snip2x.AnyMessageParameters<'transfer'> = {
			transfer: {
				amount: xg_amount+'' as Cw.Uint128,
				recipient: sa_recipient as Cw.Bech32,
				memo: s_memo as Cw.String || void 0,
			},
		};

		// prep snip-20 exec
		return await this.execute(g_msg);
	}

	async exchangeRate(): QueryRes<'exchange_rate'> {
		return this.query({
			exchange_rate: {},
		});
	}
}



		// TODO: the below code attempts to detect if a contract is a SNIP-20, but this should not happen automatically
		// // contract was not declared to be a SNIP-20
		// if(!g_snip20) {
		// 	let g_response: TokenInfoResponse | undefined;
		// 	let xc_timeout: 0 | 1;

		// 	const k_network = await Providers.activateDefaultFor(g_chain) as SecretNetwork;

		// 	// fetch code hash
		// 	const s_hash = await k_network.codeHashByContractAddress(sa_contract);

		// 	// attempt to query for token info
		// 	try {
		// 		[g_response, xc_timeout] = await timeout_exec(XT_QUERY_TOKEN_INFO, async() => {
		// 			const g_query: Snip20.BaseQueryParameters<'token_info'> = {
		// 				token_info: {},
		// 			};

		// 			return await k_network.queryContract<TokenInfoResponse>(g_account, {
		// 				bech32: sa_contract,
		// 				hash: s_hash,
		// 			}, g_query);
		// 		});

		// 		if(xc_timeout) {
		// 			return syswarn({
		// 				title: 'Token info query timed out',
		// 				text: `Failed to update internal SNIP-20 viewing key while attempting to query token info from ${sa_contract} because the query took more than ${XT_QUERY_TOKEN_INFO / XT_SECONDS} seconds`,
		// 			});
		// 		}
		// 	}
		// 	catch(e_query) {
		// 		return syswarn({
		// 			title: 'Token info query failed',
		// 			text: `Failed to update internal SNIP-20 viewing key while attempting to query token info from ${sa_contract}: ${e_query.message}`,
		// 		});
		// 	}

		// 	const g_token_info = g_response!.token_info;

		// 	// invalid token info
		// 	if(!Snip20Util.validate_token_info(g_token_info)) {
		// 		return;
		// 	}

		// 	g_snip20 = {
		// 		decimals: g_token_info.decimals as L.UnionOf<N.Range<0, 18>>,
		// 		symbol: g_token_info.symbol,
		// 	};

		// 	g_contract_pseudo = {
		// 		bech32: sa_contract,
		// 		chain: p_chain,
		// 		hash: s_hash,
		// 		interfaces: {
		// 			snip20: g_snip20,
		// 		},
		// 		name: g_token_info.name,
		// 		origin: 'domain',
		// 		pfp: g_app.pfp,
		// 	};
		// }
