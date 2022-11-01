import type {Replace} from 'ts-toolbelt/out/String/Replace';
import type {Resource} from '#/meta/resource';
import type {App, AppStruct, AppPath, AppSchemeKey} from '#/meta/app';
import {AppApiMode} from '#/meta/app';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {SI_STORE_APPS} from '#/share/constants';
import type {Dict, JsonObject} from '#/meta/belt';
import {ode} from '#/util/belt';
import type {ContractStruct} from '#/meta/chain';
import { H_LOOKUP_PFP } from './_init';

export interface AppFilterConfig extends Partial<AppStruct> {}

export interface AppProfile extends JsonObject {
	name?: string | null | undefined;
	pfps?: Dict;
	contracts?: Dict<ContractStruct>;
}


export const G_APP_STARSHELL: AppStruct = {
	scheme: 'wallet',
	on: 1,
	host: 'StarShell',
	api: AppApiMode.STARSHELL,
	connections: {},
	name: 'StarShell',
	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
};

export const G_APP_EXTERNAL: AppStruct = {
	scheme: 'wallet',
	on: 0,
	host: 'External',
	api: AppApiMode.UNKNOWN,
	connections: {},
	name: 'Some External Source',
	pfp: '',
};

export const G_APP_NULL: AppStruct = {
	scheme: 'wallet',
	on: 0,
	host: 'null',
	api: AppApiMode.UNKNOWN,
	connections: {},
	name: 'null',
	pfp: '',
};

export const G_APP_NOT_FOUND: AppStruct = {
	scheme: 'wallet',
	on: 0,
	host: 'not-found',
	api: AppApiMode.UNKNOWN,
	connections: {},
	name: 'App not found',
	pfp: '',
};

export const H_WALLET_APPS = {
	[G_APP_STARSHELL.host]: G_APP_STARSHELL,
	[G_APP_EXTERNAL.host]: G_APP_EXTERNAL,
};


export const Apps = create_store_class({
	store: SI_STORE_APPS,
	extension: 'map',
	class: class AppsI extends WritableStoreMap<typeof SI_STORE_APPS> {
		static pathFor<
			s_host extends string,
			s_scheme extends AppSchemeKey,
			g_app extends App<Replace<s_host, ':', '+'>, s_scheme>,
		>(s_host: s_host, s_scheme: s_scheme): Resource.Path<g_app> {
			return `/scheme.${s_scheme}/host.${s_host.replace(/:/g, '+')}` as Resource.Path<g_app>;
		}

		static pathFrom<
			g_app extends App,
		>(g_app: AppStruct): Resource.Path<g_app> {
			return AppsI.pathFor(g_app.host, g_app.scheme);
		}

		static parsePath(p_app: AppPath): [AppSchemeKey, string] {
			const [, s_scheme, s_host] = /^\/scheme\.([^/]+)\/host\.(.+)$/.exec(p_app)!;
			return [s_scheme as AppSchemeKey, s_host];
		}

		static scriptMatchPatternFrom<
			g_app extends App,
		>(g_app: AppStruct): `${g_app['struct']['scheme']}://${g_app['struct']['host']}/*` {
			return `${g_app.scheme}://${g_app.host}/*` as `${g_app['struct']['scheme']}://${g_app['struct']['host']}/*`;
		}

		static async get(s_host: string, s_scheme: AppSchemeKey | `${AppSchemeKey}:`): Promise<null | AppStruct> {
			return (await Apps.read()).get(s_host, s_scheme.replace(/:$/, '') as AppSchemeKey);
		}

		static async filter(gc_filter: AppFilterConfig) {
			return (await Apps.read()).filter(gc_filter);
		}

		/**
		 * Adds a new app only if it does not yet exist
		 */
		static async add(g_app: AppStruct): Promise<void> {
			// derive app path
			const p_app = Apps.pathFrom(g_app);

			// save app def to storage
			await Apps.open(ks => ks._w_cache[p_app]? void 0: ks.put(g_app));
		}

		static async put(g_app: AppStruct): Promise<void> {
			// save app def to storage
			return await Apps.open(ks => ks.put(g_app));
		}

		override at(p_app: AppPath): AppStruct {
			const [s_scheme, s_host] = Apps.parsePath(p_app);

			if('wallet' === s_scheme) {
				return H_WALLET_APPS[s_host] || G_APP_NULL;
			}

			return this._w_cache[p_app] || G_APP_NOT_FOUND;
		}

		get(s_host: string, s_scheme: AppSchemeKey): AppStruct | null {
			// prepare app path
			const p_app = AppsI.pathFor(s_host, s_scheme);

			// fetch
			return this._w_cache[p_app] ?? null;
		}

		async put(g_app: AppStruct): Promise<void> {
			// prepare app path
			const p_app = AppsI.pathFor(g_app.host, g_app.scheme);

			// update cache
			this._w_cache[p_app] = g_app;

			// attempt to save
			await this.save();
		}

		filter(gc_filter: AppFilterConfig): AppStruct[] {
			// no filter; return values list
			if(!Object.keys(gc_filter).length) return Object.values(this._w_cache);

			// list of apps matching given filter
			const a_apps: AppStruct[] = [];

			// each app in store
			FILTERING_APPS:
			for(const [p_app, g_app] of ode(this._w_cache)) {
				// each criterion in filter
				for(const [si_key, w_value] of ode(gc_filter)) {
					// one of the filters doesn't match; skip it
					if(g_app[si_key] !== w_value) continue FILTERING_APPS;
				}

				// app passed filter criteria; add it to list
				a_apps.push(g_app);
			}

			// return list
			return a_apps;
		}
	},
});

