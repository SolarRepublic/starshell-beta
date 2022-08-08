import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { SI_STORE_NETWORKS } from '#/share/constants';
import type { Network, NetworkPath } from '#/meta/network';
import { buffer_to_base64, sha256_sync, text_to_buffer } from '#/util/data';
import type { QueryBalanceResponse } from 'cosmos-grpc/dist/cosmos/bank/v1beta1/query';
import { CosmosNetwork, PendingSend } from '#/chain/main';
import type { Bech32, Chain, HoldingPath } from '#/meta/chain';
import { yw_chain } from '#/app/mem';
import type { Coin } from 'cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import type { Dict, JsonObject, Promisable } from '#/util/belt';
import type { TxResult } from 'cosmos-grpc/dist/tendermint/abci/types';

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
	pubkey: Uint8Array;
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

	bankSend(sa_sender: Bech32.String, sa_recipient: Bech32.String, si_coin: string, xg_amount: bigint, memo?: string, g_chain?: Chain['interface']): Promise<PendingSend>;

	e2eInfoFor(sa_other: Bech32.String): Promise<E2eInfo>;

	ecdhEncrypt(atu8_other_pubkey: Uint8Array, atu8_input: Uint8Array, atu8_nonce: Uint8Array, g_chain: Chain['interface']): Promise<Uint8Array>

	isContract(sa_account: Bech32.String): Promise<boolean>;

	listen(a_events: string[], fke_receive: (d_kill: Event | null, g_value?: JsonObject) => Promisable<void>): () => void;

	get hasRpc(): boolean;

	onReceive(sa_owner: string, fke_receive: (d_kill: Event | null, g_tx?: WsTxResult) => Promisable<void>): () => void;

	onSend(sa_owner: string, fke_send: (d_kill: Event | null, g_tx?: WsTxResult) => Promisable<void>): () => void;

	cachedBalance(sa_owner: Bech32.String, si_coin: string): Cached<Coin> | null;

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
	},
});
