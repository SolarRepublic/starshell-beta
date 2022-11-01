import type {JsonObject} from '#/meta/belt';
import type {Bech32, ChainPath, HoldingPath} from '#/meta/chain';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {Chains} from './chains';

import {SI_STORE_QUERY_CACHE} from '#/share/constants';
import type { Cached } from './providers';


export const QueryCache = create_store_class({
	store: SI_STORE_QUERY_CACHE,
	extension: 'map',
	class: class QueryCacheI extends WritableStoreMap<typeof SI_STORE_QUERY_CACHE> {
		static pathFor(p_chain: ChainPath, sa_owner: Bech32) {
			const [si_namespace, si_reference] = Chains.parsePath(p_chain);
			return `${si_namespace}:${si_reference}:${sa_owner}`;
		}

		// save an entry
		async set(p_chain: ChainPath, sa_owner: Bech32, si_key: string, g_data: JsonObject) {
			const p_cache = QueryCacheI.pathFor(p_chain, sa_owner);

			// update cache
			const h_entries = this._w_cache[p_cache] = this._w_cache[p_cache] || {};
			h_entries[si_key] = g_data;

			// save
			await this.save();
		}

		get(p_chain: ChainPath, sa_owner: Bech32, si_key: string): Cached | null {
			const p_cache = QueryCacheI.pathFor(p_chain, sa_owner);

			return (this._w_cache[p_cache]?.[si_key] as Cached) || null;
		}
	},
});
