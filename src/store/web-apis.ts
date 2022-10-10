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
import {fodemtv, ode, oderac} from '#/util/belt';
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
> = Record<si_coin, {
	[si_v in si_versus]: number;
}>;

const SI_CACHE_COINGECKO = 'coingecko';


async function cached_fetch(p_url: string, xt_max_age: number, c_retries=0): Promise<Response> {
	// open cache
	const d_cache = await caches.open(SI_CACHE_COINGECKO);

	// attempt to match cache
	const d_res = await d_cache.match(p_url);

	// cache hit
	CACHE_HIT:
	if(d_res) {
		// check cache info
		const sx_cache_info = sessionStorage.getItem(`@cache:${p_url}`);

		// non-existant, don't trust
		if(!sx_cache_info) break CACHE_HIT;

		// parse
		let g_cache_info: {time: number};
		try {
			g_cache_info = JSON.parse(sx_cache_info);
		}
		catch(e_parse) {
			break CACHE_HIT;
		}

		// invalid type
		if('number' !== typeof g_cache_info?.time) break CACHE_HIT;

		// parse cache time
		const xt_cache = +g_cache_info.time;

		// expired cache
		if(Date.now() - xt_cache > xt_max_age) break CACHE_HIT;

		// cache still valid, use it
		return d_res;
	}

	// prevent infinite loop; give up on cache and use fetch directly
	if(c_retries) {
		return await fetch(p_url);
	}

	// make new request and add to cache
	await d_cache.add(p_url);

	// save time of cache
	sessionStorage.setItem(`@cache:${p_url}`, JSON.stringify({
		time: Date.now(),
	}));

	// retry
	return await cached_fetch(p_url, xt_max_age, c_retries+1);
}

export const CoinGecko = {
	async coinsVersus(a_coins: string[], si_versus: CoinGeckoFiat='usd', xt_max_age=5*XT_MINUTES): Promise<Dict<number>> {
		// fetch from api
		const d_res = await cached_fetch(coingecko_url(a_coins, si_versus), xt_max_age);

		// load response
		const h_response = await d_res.json() as CoinGeckoSimplePrice;

		// transform by selecting the versus coin
		return fodemtv(h_response, g_coin => g_coin[si_versus]);
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

