import type { Replace } from 'ts-toolbelt/out/String/Replace';
import type { App, AppSchemeKey } from '#/meta/app';
import type { Resource } from '#/meta/resource';
import type { ImageMedia, ImageMediaPath, Media, MediaInterface, MediaPath, MediaTypeKey } from '#/meta/media';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { R_DATA_IMAGE_URL_ANY, R_DATA_IMAGE_URL_WEB, SI_STORE_MEDIA } from '#/share/constants';
import { buffer_to_base64, sha256_sync, text_to_buffer } from '#/util/data';

export const Medias = create_store_class({
	store: SI_STORE_MEDIA,
	extension: 'map',
	class: class MediaI extends WritableStoreMap<typeof SI_STORE_MEDIA> {
		static pathFor<
			si_media extends MediaTypeKey=MediaTypeKey,
			s_hash extends string=string,
		>(si_type: si_media, s_hash: s_hash): MediaPath<si_media, s_hash> {
			return `/media.${si_type}/sha256.${s_hash}` as MediaPath<si_media, s_hash>;
		}

		static put<
			si_media extends MediaTypeKey=MediaTypeKey,
		>(si_media: si_media, p_data: string): Promise<MediaPath<si_media>> {
			return Medias.open(ks => ks.put(si_media, p_data));
		}

		// static get<
		// 	si_media extends MediaTypeKey=MediaTypeKey,
		// >(p_media: si_media, s_scheme: AppSchemeKey): Promise<null | AppInterface> {
		// 	return Media.open(ks => ks.get(s_host, s_scheme));
		// }

		// get(s_host: string, s_scheme: AppSchemeKey): Media['interface'] | null {
		// 	// prepare app path
		// 	const p_app = MediaI.pathFor(s_host, s_scheme);

		// 	// fetch
		// 	return this._w_cache[p_app] ?? null;
		// }


		async put<
			si_media extends MediaTypeKey=MediaTypeKey,
		>(si_media: si_media, p_data: string): Promise<MediaPath<si_media>> {
			// image
			if('image' === si_media) {
				// invalid data URL; reject request
				if(!R_DATA_IMAGE_URL_ANY.test(p_data)) {
					throw new Error(`Refusing to store arbitrary media having path data:\n${p_data}`);
				}
			}
			// unknown media type
			else {
				throw new Error(`Unsupported media type "${si_media}"`);
			}

			// hash data string
			const s_hash = buffer_to_base64(sha256_sync(text_to_buffer(p_data)));

			// prepare media path
			const p_media: MediaPath<si_media> = MediaI.pathFor(si_media, s_hash);

			// update cache
			this._w_cache[p_media as string] = {
				data: p_data,
				hash: s_hash,
			};

			// attempt to save
			await this.save();

			// return path to new media item
			return p_media;
		}
	},
});

