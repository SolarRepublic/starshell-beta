
import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {SI_STORE_QUERY_CACHE} from '#/share/constants';
import type {ChainPath, HoldingPath} from '#/meta/chain';
import type {TokenPath} from '#/meta/token';
import type {JsonObject} from '#/meta/belt';


export const QueryCache = create_store_class({
	store: SI_STORE_QUERY_CACHE,
	extension: 'map',
	class: class QueryCacheI extends WritableStoreMap<typeof SI_STORE_QUERY_CACHE> {
		// save an entry
		async set(p_query: HoldingPath | TokenPath, g_result: JsonObject) {
			// update cache
			this._w_cache[p_query] = g_result;

			// save
			await this.save();
		}
	},
});
