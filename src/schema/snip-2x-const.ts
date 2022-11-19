import type {Snip20} from './snip-20-def';
import type {PortableMessage, Snip2x} from './snip-2x-def';

import type {L, N, O} from 'ts-toolbelt';

import type {AccountStruct} from '#/meta/account';
import type {Bech32, ChainPath, ChainStruct, Contract, ContractStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';

import type {SecretStruct} from '#/meta/secret';
import type {TokenStructDescriptor} from '#/meta/token';

import {syswarn} from '#/app/common';
import type {SecretNetwork} from '#/chain/secret-network';
import {ATU8_SHA256_STARSHELL} from '#/share/constants';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Secrets} from '#/store/secrets';
import {crypto_random_int} from '#/util/belt';
import {base58_to_buffer, buffer_to_base58, buffer_to_text, buffer_to_uint32_be, concat, sha256_sync, text_to_buffer, uint32_to_buffer_be} from '#/util/data';
import type { PrebuiltMessage } from '#/chain/messages/_types';
import type { Snip24, Snip24PermitMsg } from './snip-24-def';
import type { Coin } from '@cosmjs/amino';



type TokenInfoResponse = Snip20.BaseQueryResponse<'token_info'>;

export class ViewingKeyError extends Error {}

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
		const atu8_viewing_key = await Secrets.borrowPlaintext(g_account.utilityKeys.snip20ViewingKey!, async(kn_utility) => {
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
				atu8_nonce = uint32_to_buffer_be(crypto_random_int(0, Number((1n << 32n) - 1n)));
			}

			// import utility key
			const dk_input = await crypto.subtle.importKey('raw', kn_utility.data, 'HKDF', false, ['deriveBits']);

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
				key: s_viewing_key as Cw.String,
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
		const g_msg: Snip24.BaseMessageParameters<'revoke_permit'> = {
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

	query<si_key extends Snip2x.AnyQueryKey=Snip2x.AnyQueryKey>(g_query: Snip2x.AnyQueryParameters<si_key>): QueryRes<si_key> {
		return this._k_network.queryContract<Snip2x.AnyQueryResponse<si_key>>(this._g_account, {
			bech32: this._g_contract.bech32,
			hash: this._g_contract.hash,
		}, g_query);
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
		await this._k_network.saveQueryCache(this._sa_owner, `${this._g_contract.bech32}:balance`, g_balance.balance, Date.now());

		return g_balance;
	}

	async transferHistory(nl_records=Number.MAX_SAFE_INTEGER): QueryRes<'transfer_history'> {
		return this.query({
			transfer_history: {
				address: this._sa_owner,
				key: await this._viewing_key_plaintext(),
				page_size: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_records)) as Cw.WholeNumber,
			},
		});
	}

	async transactionHistory(nl_records=Number.MAX_SAFE_INTEGER): QueryRes<'transaction_history'> {
		if(!this.snip22) throw new Error(`'transaction_history' not available on non SNIP-21 contract`);

		return this.query({
			transaction_history: {
				address: this._sa_owner,
				key: await this._viewing_key_plaintext(),
				page_size: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_records)) as Cw.WholeNumber,
			},
		});
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
