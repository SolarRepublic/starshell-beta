import type { Replace } from 'ts-toolbelt/out/String/Replace';
import type { App, AppSchemeKey } from '#/meta/app';
import type { Resource } from '#/meta/resource';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { SI_STORE_APPS } from '#/share/constants';

export const Apps = create_store_class({
	store: SI_STORE_APPS,
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
		>(g_app: App['interface']): Resource.Path<g_app> {
			return AppsI.pathFor(g_app.host, g_app.scheme);
		}

		static get(s_host: string, s_scheme: AppSchemeKey): Promise<null | App['interface']> {
			return Apps.open(ks_apps => ks_apps.get(s_host, s_scheme));
		}

		get(s_host: string, s_scheme: AppSchemeKey): App['interface'] | null {
			// prepare app path
			const p_app = AppsI.pathFor(s_host, s_scheme);

			// fetch
			return this._w_cache[p_app] ?? null;
		}


		async put(g_app: App['interface']): Promise<void> {
			// prepare app path
			const p_app = AppsI.pathFor(g_app.host, g_app.scheme);

			// update cache
			this._w_cache[p_app] = g_app;

			// attempt to save
			await this.save();
		}
	},
});

