import type {Replace} from 'ts-toolbelt/out/String/Replace';
import type {App, AppInterface, AppPath, AppSchemeKey} from '#/meta/app';
import type {Resource} from '#/meta/resource';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {SI_STORE_APPS} from '#/share/constants';
import type {Dict, JsonObject} from '#/meta/belt';
import {ode} from '#/util/belt';
import type {ContractInterface} from '#/meta/chain';

export interface AppFilterConfig extends Partial<AppInterface> {}

export interface AppProfile extends JsonObject {
	name?: string | null | undefined;
	pfps?: Dict;
	contracts?: Dict<ContractInterface>;
}

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
		>(g_app: AppInterface): Resource.Path<g_app> {
			return AppsI.pathFor(g_app.host, g_app.scheme);
		}

		static parsePath(p_app: AppPath): [AppSchemeKey, string] {
			const [, s_scheme, s_host] = /^scheme\.([^/]+)\/host\.(.+)$/.exec(p_app)!;
			return [s_scheme as AppSchemeKey, s_host];
		}

		static scriptMatchPatternFrom<
			g_app extends App,
		>(g_app: AppInterface): `${g_app['interface']['scheme']}://${g_app['interface']['host']}/*` {
			return `${g_app.scheme}://${g_app.host}/*` as `${g_app['interface']['scheme']}://${g_app['interface']['host']}/*`;
		}

		static async get(s_host: string, s_scheme: AppSchemeKey | `${AppSchemeKey}:`): Promise<null | AppInterface> {
			return (await Apps.read()).get(s_host, s_scheme.replace(/:$/, '') as AppSchemeKey);
		}

		static async filter(gc_filter: AppFilterConfig) {
			return (await Apps.read()).filter(gc_filter);
		}

		/**
		 * Adds a new app only if it does not yet exist
		 */
		static async add(g_app: AppInterface): Promise<void> {
			// derive app path
			const p_app = Apps.pathFrom(g_app);

			// save app def to storage
			return await Apps.open(ks => ks.put(ks.at(p_app) || g_app));
		}

		static async put(g_app: AppInterface): Promise<void> {
			// save app def to storage
			return await Apps.open(ks => ks.put(g_app));
		}

		get(s_host: string, s_scheme: AppSchemeKey): AppInterface | null {
			// prepare app path
			const p_app = AppsI.pathFor(s_host, s_scheme);

			// fetch
			return this._w_cache[p_app] ?? null;
		}

		async put(g_app: AppInterface): Promise<void> {
			// prepare app path
			const p_app = AppsI.pathFor(g_app.host, g_app.scheme);

			// update cache
			this._w_cache[p_app] = g_app;

			// attempt to save
			await this.save();
		}

		filter(gc_filter: AppFilterConfig): AppInterface[] {
			// no filter; return values list
			if(!Object.keys(gc_filter).length) return Object.values(this._w_cache);

			// list of apps matching given filter
			const a_apps: AppInterface[] = [];

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

