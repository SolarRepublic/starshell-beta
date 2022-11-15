
import type {AminoMsg} from '@cosmjs/amino';
import type {Block as CosmosBlock} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/types';
import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import type {BroadcastMode, GetTxResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';

import type {Block as TendermintBlock} from '@solar-republic/cosmos-grpc/dist/tendermint/types/block';
import type {U} from 'ts-toolbelt';

import type {Account, AccountPath, AccountStruct} from '#/meta/account';
import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {Bech32, ChainStruct, HoldingPath} from '#/meta/chain';
import type {TxPending, TxSynced} from '#/meta/incident';
import type {Provider, ProviderStruct, ProviderPath} from '#/meta/provider';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';
import {Chains} from './chains';

import {yw_chain} from '#/app/mem';

import type {CosmosNetwork, IncidentTx, ModWsTxResult} from '#/chain/cosmos-network';

import {SecretNetwork} from '#/chain/secret-network';
import {SI_STORE_PROVIDERS, XT_SECONDS} from '#/share/constants';
import {timeout_exec} from '#/util/belt';
import {buffer_to_base64, sha256_sync, text_to_buffer} from '#/util/data';


export type BalanceBundle = {
	balance: Coin;
	cached: Cached<Coin> | null;
	holding: HoldingPath;
} & JsonObject;


export interface Transfer {
	sender: Bech32 | Bech32[];
	recipient: Bech32 | Bech32[];
	amount: string;
	height: string;
	timestamp: string;
	txhash: string;
}

export interface Cached<g_wrapped=any> extends JsonObject {
	timestamp: number;
	data: g_wrapped & JsonObject;
	block?: string;
}


export interface E2eInfo {
	sequence: string;
	height: string;
	hash: string;
	// priorSequence: string | null;
	// priorHeight: string | null;
	// priorHash: string | null;
	pubkey: Uint8Array;
}

export enum ConnectionHealth {
	UNKNOWN = 0,
	LOADING = 1,
	CONNECTING = 2,
	CONNECTED = 3,
	DELINQUENT = 4,
	DISCONNECTED = 5,
}

export const H_HEALTH_COLOR: Record<ConnectionHealth, string> = {
	[ConnectionHealth.UNKNOWN]: 'var(--theme-color-graysoft)',
	[ConnectionHealth.LOADING]: 'var(--theme-color-graysoft)',
	[ConnectionHealth.CONNECTING]: 'var(--theme-color-sky)',
	[ConnectionHealth.CONNECTED]: 'var(--theme-color-green)',
	[ConnectionHealth.DELINQUENT]: 'var(--theme-color-caution)',
	[ConnectionHealth.DISCONNECTED]: 'var(--theme-color-red)',
};


class MemoAccountError extends Error {
	constructor(s_msg: string, private readonly _sa_owner: string, private readonly _g_chain: ChainStruct) {
		super(s_msg);
	}

	get owner(): string {
		return this._sa_owner;
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}
}

export class UnpublishedAccountError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: ChainStruct) {
		super(`Owner ${sa_owner} has not signed any messages yet on ${g_chain.name}.`, sa_owner, g_chain);
	}
}

export class MultipleSignersError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: ChainStruct) {
		super(`Multiple accounts were discovered to be associated with ${sa_owner}.`, sa_owner, g_chain);
	}
}

export class WrongKeyTypeError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: ChainStruct) {
		super(`Encountered the wrong type of key for ${sa_owner} on ${g_chain.name}.`, sa_owner, g_chain);
	}
}

export class NetworkTimeoutError extends Error {
	constructor() {
		super(`Network request timed out.`);
	}
}

export class ProviderHealthError extends Error {
	constructor() {
		super(`Provider in poor health.`);
	}
}

export class StaleBlockError extends Error {
	constructor() {
		super(`Most recent block is pretty old. Possible chain or network fault.`);
	}
}

export class NetworkExchangeError extends Error {
	constructor(e_original: Error) {
		super(`Network exchange error: ${e_original.name}:: ${e_original.message}`);
	}
}

export interface ActiveNetwork {
	get provider(): ProviderStruct;

	/**
	 * Retrieves and updates the bank balance for a single coin
	 */
	bankBalance(sa_owner: Bech32, si_coin?: string): Promise<BalanceBundle>;

	/**
	 * Retrieves and updates the bank balance for all coins on this chain
	 */
	bankBalances(sa_owner: Bech32): Promise<Dict<BalanceBundle>>;

	bankSend(
		sa_sender: Bech32,
		sa_recipient: Bech32,
		si_coin: string,
		xg_amount: bigint,
		xg_limit: bigint,
		x_price: number,
		memo?: string,
		xc_mode?: BroadcastMode,
		g_chain?: ChainStruct
	): Promise<TxPending>;

	e2eInfoFor(sa_other: Bech32, s_max_height?: string): Promise<E2eInfo>;

	ecdh(atu8_other_pubkey: Uint8Array, g_chain?: ChainStruct, g_account?: AccountStruct): Promise<CryptoKey>;

	ecdhEncrypt(
		atu8_other_pubkey: Uint8Array,
		atu8_plaintext: Uint8Array,
		atu8_nonce: Uint8Array,
		g_chain?: ChainStruct,
		g_account?: AccountStruct
	): Promise<Uint8Array>;

	ecdhDecrypt(
		atu8_other_pubkey: Uint8Array,
		atu8_ciphertext: Uint8Array,
		atu8_nonce: Uint8Array,
		g_chain?: ChainStruct,
		g_account?: AccountStruct
	): Promise<Uint8Array>;

	isContract(sa_account: Bech32): Promise<boolean>;

	listen(a_events: string[], fke_receive: (d_kill: Event | null, g_tx?: JsonObject, si_txn?: string) => Promisable<void>): Promise<() => void>;

	get hasRpc(): boolean;

	onReceive(sa_owner: string, fke_receive: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void>;

	onSend(sa_owner: string, fke_send: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void>;

	cachedCoinBalance(sa_owner: Bech32, si_coin: string): Cached<Coin> | null;

	fetchTx(si_txn: string): Promise<GetTxResponse>;

	downloadTxn(si_txn: string, p_account: AccountPath): Promise<TxSynced>;

	encodeExecuteContract(g_account: AccountStruct, sa_contract: Bech32, h_exec: JsonObject, s_code_hash: string): Promise<{amino: AminoMsg; proto: Any}>;

	secretConsensusIoPubkey(): Promise<Uint8Array>;
}

export const Providers = create_store_class({
	store: SI_STORE_PROVIDERS,
	extension: 'map',
	class: class ProviderI extends WritableStoreMap<typeof SI_STORE_PROVIDERS> {
		static pathFor(p_base: string): ProviderPath {
			return `/provider.${buffer_to_base64(sha256_sync(text_to_buffer(p_base)))}`;
		}

		static pathFrom(g_provider: ProviderStruct) {
			return ProviderI.pathFor(g_provider.grpcWebUrl);
		}

		static activate(g_provider: ProviderStruct, g_chain: ChainStruct=yw_chain.get()): SecretNetwork {
			return new SecretNetwork(g_provider, g_chain);
		}

		static async activateDefaultFor(g_chain: ChainStruct=yw_chain.get()): Promise<SecretNetwork | CosmosNetwork> {
			const p_chain = Chains.pathFrom(g_chain);

			const ks_providers = await Providers.read();

			for(const [p_provider, g_provider] of ks_providers.entries()) {
				if(p_chain === g_provider.chain) {
					return ProviderI.activate(g_provider, g_chain);
				}
			}

			throw new Error(`No network provider found for chain ${p_chain}`);
		}

		static async quickTest(g_provider: ProviderStruct, g_chain: ChainStruct) {
			const k_network = ProviderI.activate(g_provider, g_chain);

			try {
				const [g_latest, xc_timeout] = await timeout_exec(15e3, () => k_network.latestBlock());
				let g_block: TendermintBlock | CosmosBlock | undefined;

				if(xc_timeout) {
					throw new NetworkTimeoutError();
				}
				// cosmos-sdk >= 0.47
				else if((g_block=g_latest?.sdkBlock || g_latest?.block) && g_block.header?.time) {
					const g_time = g_block.header.time;
					const xt_when = +g_time.seconds * XT_SECONDS;

					// more than a minute old
					if(Date.now() - xt_when > 60e3) {
						throw new StaleBlockError();
					}
				}
				// no block info
				else {
					throw new ProviderHealthError();
				}
			}
			catch(e_latest) {
				throw new NetworkExchangeError(e_latest as Error);
			}
		}
	},
});
