import type { Dict, JsonObject, JsonValue } from '#/util/belt';

import SX_SUFFIXES_BUNDLED from '#/../submodules/publicsuffix-list/public_suffix_list.dat?raw';

import {
	P_PUBLIC_SUFFIX_LIST,
	P_STARSHELL_DECREES,
} from "#/share/constants";
import { storage_get } from '#/extension/public-storage';

const $_EXISTING = Symbol('use-existing-cache');

type $_EXISTING = typeof $_EXISTING;

interface GenericEntry {
	query?: () => Dict;
}

interface TextEntry extends GenericEntry {
	format: 'text';
	parse?(sx_data: string): $_EXISTING | JsonValue;
}

interface JsonEntry extends GenericEntry {
	format: 'json';
	filter?(w_value: JsonValue): JsonValue;
}

interface BinaryEntry extends GenericEntry {
	format: 'binary';
}

type Entry = TextEntry | JsonEntry | BinaryEntry;

export interface Decree extends JsonObject {
	affects: string;
	action: 'restrict';
	suggestion: 'upgrade';
}

const H_REGISTRY = {
	[P_PUBLIC_SUFFIX_LIST]: {
		format: 'text',
		parse(sx_data): $_EXISTING | string[] {	
			// failed for some reason; not critical
			if(!sx_data) return $_EXISTING;

			// parse suffix list
			const a_suffixes: string[] = [];
			for(let sx_line of sx_data.split(/\n/g)) {
				sx_line = sx_line.replace(/\s+|\/\/.*$/, '');
				if(sx_line) a_suffixes.push(sx_line);
			}

			// return suffix list
			return a_suffixes;
		},
	},

	[P_STARSHELL_DECREES]: {
		format: 'json',
		filter(z_data: JsonValue): JsonValue {
			return (z_data as Decree[]).filter((g_decree) => {
				return true;
			}) as JsonValue;
		},
	},
} as const;


type CacheKey = keyof typeof H_REGISTRY;

interface Cache {
	etag: string;
	data: JsonValue;
}

async function cache_put(p_res: CacheKey, g_cache: Cache) {
	return await chrome.storage.local.set({[`@cache:${p_res}`]:g_cache});
}

async function cache_get(p_res: CacheKey): Promise<Cache | null> {
	return await storage_get<Cache>(`@cache:${p_res}`);
}

export class WebResourceCache {
	static async updateAll() {
		for(const p_res in H_REGISTRY) {
			const g_entry = H_REGISTRY[p_res as CacheKey];

			// // build query
			// if('query' in g_entry) {
			// 	const g_query = g_entry.query();
			// 	if(g_query && 'object' === typeof g_query) {
			// 		const sx_params = new URLSearchParams(g_query).toString();
			// 	}
			// }

			// fetch the resource
			const d_res = await fetch(p_res);

			// depending on format
			switch(g_entry.format) {
				// load response as text
				case 'text': {
					const s_data = await d_res.text();

					// parse the textual data
					const z_parsed = g_entry.parse(s_data);

					// do not update anything
					if($_EXISTING === z_parsed) continue;

					// set/overwrite
					await cache_put(p_res as CacheKey, {
						etag: d_res.headers.get('etag') ?? '',
						data: s_data,
					});
					break;
				}

				// load response as json
				case 'json': {
					let w_data: JsonValue = await d_res.json();

					// apply filter
					if('filter' in g_entry) {
						w_data = g_entry.filter(w_data);
					}

					// set/overwrite
					await cache_put(p_res as CacheKey, {
						etag: d_res.headers.get('etag') ?? '',
						data: w_data,
					});
					break;
				}

				default: {
					// ignore
				}
			}
		}
	}

	static async get(p_res: CacheKey): Promise<JsonValue | null> {
		return (await cache_get(p_res))?.data || null;
	}
}
