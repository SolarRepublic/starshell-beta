import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { SI_STORE_NETWORKS } from '#/share/constants';
import type { Network, NetworkPath } from '#/meta/network';
import { buffer_to_base64, sha256_sync, text_to_buffer } from '#/util/data';
import { CosmosNetwork, IncidentTx, ModWsTxResult, PendingSend } from '#/chain/main';
import type { Bech32, Chain, HoldingPath } from '#/meta/chain';
import { yw_chain } from '#/app/mem';
import type { Coin } from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import type { Dict, JsonObject, Promisable } from '#/util/belt';
import { Chains } from './chains';
import type { TxConfirmed, TxPending, TxSynced } from '#/meta/incident';
import type { BroadcastMode, GetTxResponse } from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
import type { Account } from '#/meta/account';

export type BalanceBundle = {
	balance: Coin;
	cached: Cached<Coin> | null;
	holding: HoldingPath;
} & JsonObject;


export interface Transfer {
	sender: Bech32.String;
	recipient: Bech32.String;
	amount: string;
	height: string;
	timestamp: string;
	txhash: string;
}

export interface Cached<g_wrapped> extends JsonObject {
	timestamp: number;
	data: g_wrapped & JsonObject;
	block?: string;
}

export interface WsTxResult {
	height: string;
	tx: string;
	result: {
		data: string;
		events: {
			type: string;
			attributes: {
				key: string;
				value: string;
				index?: boolean;
			};
		}[];
		gas_used: string;
		gas_wanted: string;
		log: string;
	};
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

class MemoAccountError extends Error {
	constructor(s_msg: string, private readonly _sa_owner: string, private readonly _g_chain: Chain['interface']) {
		super(s_msg);
	}

	get owner(): string {
		return this._sa_owner;
	}

	get chain(): Chain['interface'] {
		return this._g_chain;
	}
}

export class UnpublishedAccountError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: Chain['interface']) {
		super(`Owner ${sa_owner} has not signed any messages yet on ${g_chain.name}.`, sa_owner, g_chain);
	}
}

export class MultipleSignersError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: Chain['interface']) {
		super(`Multiple accounts were discovered to be associated with ${sa_owner}.`, sa_owner, g_chain);
	}
}

export class WrongKeyTypeError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: Chain['interface']) {
		super(`Encountered the wrong type of key for ${sa_owner} on ${g_chain.name}.`, sa_owner, g_chain);
	}
}

export class NetworkTimeoutError extends Error {
	constructor() {
		super(`Network request timed out.`);
	}
}

export interface ActiveNetwork {
	/**
	 * Retrieves and updates the bank balance for a single coin
	 */
	bankBalance(sa_owner: Bech32.String, si_coin?: string): Promise<BalanceBundle>;

	/**
	 * Retrieves and updates the bank balance for all coins on this chain
	 */
	bankBalances(sa_owner: Bech32.String): Promise<Dict<BalanceBundle>>;

	bankSend(
		sa_sender: Bech32.String,
		sa_recipient: Bech32.String,
		si_coin: string,
		xg_amount: bigint,
		xg_limit: bigint,
		x_price: number,
		memo?: string,
		xc_mode?: BroadcastMode,
		g_chain?: Chain['interface']
	): Promise<TxPending>;

	e2eInfoFor(sa_other: Bech32.String, s_max_height?: string): Promise<E2eInfo>;

	ecdh(atu8_other_pubkey: Uint8Array, g_chain?: Chain['interface'], g_account?: Account['interface']): Promise<CryptoKey>;

	ecdhEncrypt(
		atu8_other_pubkey: Uint8Array,
		atu8_plaintext: Uint8Array,
		atu8_nonce: Uint8Array,
		g_chain?: Chain['interface'],
		g_account?: Account['interface']
	): Promise<Uint8Array>;

	ecdhDecrypt(
		atu8_other_pubkey: Uint8Array,
		atu8_ciphertext: Uint8Array,
		atu8_nonce: Uint8Array,
		g_chain?: Chain['interface'],
		g_account?: Account['interface']
	): Promise<Uint8Array>;

	isContract(sa_account: Bech32.String): Promise<boolean>;

	listen(a_events: string[], fke_receive: (d_kill: Event | null, g_tx?: JsonObject, si_txn?: string) => Promisable<void>): Promise<() => void>;

	get hasRpc(): boolean;

	onReceive(sa_owner: string, fke_receive: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void>;

	onSend(sa_owner: string, fke_send: (d_kill: Event | null, g_tx?: ModWsTxResult) => Promisable<void>): Promise<() => void>;

	cachedBalance(sa_owner: Bech32.String, si_coin: string): Cached<Coin> | null;

	fetchTx(si_txn: string): Promise<GetTxResponse>;

	downloadTxn(si_txn: string): Promise<TxSynced>;

	synchronizeAll(sa_owner: Bech32.String): AsyncIterableIterator<IncidentTx>;
}

export const Networks = create_store_class({
	store: SI_STORE_NETWORKS,
	extension: 'map',
	class: class NetworksI extends WritableStoreMap<typeof SI_STORE_NETWORKS> {
		static pathFor(p_base: string): NetworkPath {
			return `/network.${buffer_to_base64(sha256_sync(text_to_buffer(p_base)))}`;
		}

		static pathFrom(g_network: Network['interface']) {
			return NetworksI.pathFor(g_network.grpcWebUrl);
		}

		static activate(g_network: Network['interface'], g_chain: Chain['interface']=yw_chain.get()): ActiveNetwork {
			return new CosmosNetwork(g_network, g_chain);
		}

		static async activateDefaultFor(g_chain: Chain['interface']=yw_chain.get()): Promise<ActiveNetwork> {
			const p_chain = Chains.pathFrom(g_chain);

			const ks_networks = await Networks.read();

			for(const [p_network, g_network] of ks_networks.entries()) {
				if(p_chain === g_network.chain) {
					return NetworksI.activate(g_network, g_chain);
				}
			}

			throw new Error(`No network provider found for chain ${p_chain}`);
		}
	},
});
