import {
	create_store_class,
	WritableStore,
	WritableStoreMap,
} from './_base';

import {SI_STORE_WEB_APIS, XT_MINUTES} from '#/share/constants';
import type {Resource} from '#/meta/resource';
import type {ResponseCache, WebApi, WebApiPath} from '#/meta/web-api';
import {buffer_to_base64, sha256_sync, text_to_buffer} from '#/util/data';
import type {Values} from '#/meta/belt';
import type {Dict, JsonObject} from '#/meta/belt';
import {ode, oderac} from '#/util/belt';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

export const A_COINGECKO_VS = [
	'btc',
	'eth',
	'ltc',
	'bch',
	'bnb',
	'eos',
	'xrp',
	'xlm',
	'link',
	'dot',
	'yfi',
	'usd',
	'aed',
	'ars',
	'aud',
	'bdt',
	'bhd',
	'bmd',
	'brl',
	'cad',
	'chf',
	'clp',
	'cny',
	'czk',
	'dkk',
	'eur',
	'gbp',
	'hkd',
	'huf',
	'idr',
	'ils',
	'inr',
	'jpy',
	'krw',
	'kwd',
	'lkr',
	'mmk',
	'mxn',
	'myr',
	'ngn',
	'nok',
	'nzd',
	'php',
	'pkr',
	'pln',
	'rub',
	'sar',
	'sek',
	'sgd',
	'thb',
	'try',
	'twd',
	'uah',
	'vef',
	'vnd',
	'zar',
	'xdr',
	'xag',
	'xau',
	'bits',
	'sats',
];

export type CoinGeckoFiat = Values<typeof A_COINGECKO_VS>;

const coingecko_url = (a_coins: string[], si_versus: CoinGeckoFiat) => 'https://api.coingecko.com/api/v3/simple/price?'
	+new URLSearchParams(ode({
		ids: a_coins.join(','),
		vs_currencies: si_versus,
		include_last_updated_at: 'true',
	}));

type CoinGeckoSimplePrice<
	si_coin extends string=string,
	si_versus extends CoinGeckoFiat=CoinGeckoFiat,
> = Record<si_coin, Merge<{
	[si_v in si_versus]: number;
}, {
	last_updated_at: number;
}>>;

export const CoinGecko = {
	async coinsVersus(a_coins: string[], si_versus: CoinGeckoFiat='usd', xt_max_age=5*XT_MINUTES): Promise<Dict<number>> {
		// map each coin to request path
		const a_apis = a_coins.map(si => WebApis.pathFor('GET', coingecko_url([si], si_versus)));

		// read from store
		const ks_apis = await WebApis.read();

		// prep out map
		const h_out: Dict<number> = {};

		// try to use cache
		if(xt_max_age > 0) {
			// expiry cutoff
			const xt_cutoff = Date.now() - xt_max_age;

			// if cache is still valid
			let b_cache_valid = true;

			// each coin being requested
			for(let i_coin=0; i_coin<a_coins.length; i_coin++) {
				const g_api = ks_apis.at(a_apis[i_coin]);

				// not yet stale
				if(g_api && g_api.time > xt_cutoff) {
					const si_coin = a_coins[i_coin];
					h_out[si_coin] = (g_api.response.cache as CoinGeckoSimplePrice)[si_coin][si_versus]!;
				}
				// encountered stale entry
				else {
					b_cache_valid = false;
					break;
				}
			}

			// cache is still valid; return responses
			if(b_cache_valid) {
				return h_out;
			}
		}

		// fetch from api
		const d_res = await fetch(coingecko_url(a_coins, si_versus));

		// load response
		const h_response = await d_res.json() as CoinGeckoSimplePrice;

		// ref raw cache
		const h_cache = ks_apis.raw;

		// cache datetime
		const xt_now = Date.now();
		for(const [si_coin, g_coin] of ode(h_response)) {
			const g_cache = h_cache[si_coin] = h_cache[si_coin] || {};
			g_cache.response = g_coin;
			g_cache.time = xt_now;
			h_out[si_coin] = g_coin[si_versus]!;
		}

		return h_out;
	},
};

export const WebApis = create_store_class({
	store: SI_STORE_WEB_APIS,
	extension: 'map',
	class: class WebApisI extends WritableStoreMap<typeof SI_STORE_WEB_APIS> {
		static pathFor(si_method: WebApi['interface']['method'], p_api: string): WebApiPath {
			// generate hash
			const s_hash = buffer_to_base64(sha256_sync(text_to_buffer(si_method+' '+p_api)));

			// produce path
			return `/cache.web-api/sha256.${s_hash}`;
		}

		static pathFrom(g_api: WebApi['interface']): WebApiPath {
			return WebApisI.pathFor(g_api.method, g_api.path);
		}
	},
});

