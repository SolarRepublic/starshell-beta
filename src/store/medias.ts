import type { Replace } from 'ts-toolbelt/out/String/Replace';
import type { App, AppSchemeKey } from '#/meta/app';
import type { Resource } from '#/meta/resource';
import type { ImageMedia, Media } from '#/meta/media';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { SI_STORE_MEDIA } from '#/share/constants';

export const Medias = create_store_class({
	store: SI_STORE_MEDIA,
	extension: 'map',
	class: class MediaI extends WritableStoreMap<typeof SI_STORE_MEDIA> {

		// static pathFor<
		// 	s_host extends string,
		// 	s_scheme extends AppSchemeKey,
		// 	g_app extends App<Replace<s_host, ':', '+'>, s_scheme>,
		// >(s_host: s_host, s_scheme: s_scheme): Resource.Path<g_app> {
		// 	return `/scheme.${s_scheme}/host.${s_host.replace(/:/g, '+')}` as Resource.Path<g_app>;
		// }

		// static pathFrom<
		// 	g_app extends App,
		// >(g_app: App['interface']): Resource.Path<g_app> {
		// 	return MediaI.pathFor(g_app.host, g_app.scheme);
		// }

		// static get(s_host: string, s_scheme: AppSchemeKey): Promise<null | App['interface']> {
		// 	return Media.open(ks_apps => ks_apps.get(s_host, s_scheme));
		// }

		// get(s_host: string, s_scheme: AppSchemeKey): Media['interface'] | null {
		// 	// prepare app path
		// 	const p_app = MediaI.pathFor(s_host, s_scheme);

		// 	// fetch
		// 	return this._w_cache[p_app] ?? null;
		// }


		// async put(g_app: Media['interface']): Promise<void> {
		// 	// prepare app path
		// 	const p_app = MediaI.pathFor(g_app.host, g_app.scheme);

		// 	// update cache
		// 	this._w_cache[p_app] = g_app;

		// 	// attempt to save
		// 	await this.save();
		// }
	},
});

