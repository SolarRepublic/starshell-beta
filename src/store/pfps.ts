import type { Resource } from '#/meta/resource';
import type { ImageSet, Pfp } from '#/meta/pfp';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { SI_STORE_PFPS } from '#/share/constants';
import { dd } from '#/util/dom';
import type { Medias } from './medias';
import type { Dict } from '#/util/belt';

export type RenderConfig = {
	alt?: string;
	dim: number;
	medias: InstanceType<typeof Medias>;
};


function picture(h_image: ImageSet, gc_render: RenderConfig, h_attrs: Dict={}): HTMLPictureElement {
	// destructure resolutions
	const {
		default: p_default,
		16: p_16,
		32: p_32,
		48: p_48,
		64: p_64,
		96: p_96,
		128: p_128,
		256: p_256,
	} = h_image;

	// ref medias store
	const ks_medias = gc_render.medias;

	// read each resolution
	/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
	const sx_16 = p_16? ks_medias.at(p_16)?.data!: null;
	const sx_32 = p_32? ks_medias.at(p_32)?.data!: null;
	const sx_48 = p_48? ks_medias.at(p_48)?.data!: null;
	const sx_64 = p_64? ks_medias.at(p_64)?.data!: null;
	const sx_96 = p_96? ks_medias.at(p_96)?.data!: null;
	const sx_128 = p_128? ks_medias.at(p_128)?.data!: null;
	const sx_256 = p_256? ks_medias.at(p_256)?.data!: null;
	const sx_default = ks_medias.at(p_default)!.data;
	/* eslint-enable @typescript-eslint/no-non-null-asserted-optional-chain */

	const sx_any_x = sx_16 || sx_32 || sx_48 || sx_64 || sx_96 || sx_128 || sx_256;

	const x_dim_1x = gc_render.dim;
	const x_dim_2x = x_dim_1x * 2;

	let sx_1x: string | null = null;
	let sx_2x: string | null = null;

	// some option exists
	if(sx_any_x) {
		// 1x resolution
		if(x_dim_1x <= 64) {
			if(x_dim_1x <= 32) {
				if(x_dim_1x <= 16) {
					sx_1x = sx_any_x;
				}
				else {
					sx_1x = sx_32 || sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
				}
			}
			else if(x_dim_1x <= 48) {
				sx_1x = sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
			}
			else {
				sx_1x = sx_64 || sx_96 || sx_128 || sx_256;
			}
		}
		else if(x_dim_1x <= 128) {
			if(x_dim_1x <= 96) {
				sx_1x = sx_96 || sx_128 || sx_256;
			}
			else {
				sx_1x = sx_128 || sx_256;
			}
		}
		else if(x_dim_1x <= 256) {
			sx_1x = sx_256;
		}

		// 2x resolution
		if(x_dim_2x <= 64) {
			if(x_dim_2x <= 32) {
				if(x_dim_2x <= 16) {
					sx_2x = sx_any_x;
				}
				else {
					sx_2x = sx_32 || sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
				}
			}
			else if(x_dim_2x <= 48) {
				sx_2x = sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
			}
			else {
				sx_2x = sx_64 || sx_96 || sx_128 || sx_256;
			}
		}
		else if(x_dim_2x <= 128) {
			if(x_dim_2x <= 96) {
				sx_2x = sx_96 || sx_128 || sx_256;
			}
			else {
				sx_2x = sx_128 || sx_256;
			}
		}
		else if(x_dim_2x <= 256) {
			sx_2x = sx_256;
		}
	}

	// picture element
	return dd('picture', {
		...h_attrs,
	}, [
		// 2x version
		...sx_2x? [dd('source', {
			srcset: sx_2x,
			media: '(min-resolution: 2dppx)',
		})]: [],

		// default img
		dd('img', {
			src: sx_1x || sx_default,
			alt: gc_render.alt || '',
		}),
	]);
}

export const Pfps = create_store_class({
	store: SI_STORE_PFPS,
	extension: 'map',
	class: class PfpI extends WritableStoreMap<typeof SI_STORE_PFPS> {
		static async load(p_pfp: Resource.Path<Pfp>, gc_render: RenderConfig): Promise<HTMLElement | null> {
			const g_pfp = await Pfps.at(p_pfp);

			if(!g_pfp) return null;

			return Pfps.render(g_pfp, gc_render);
		}

		static render(g_pfp: Pfp['interface'], gc_render: RenderConfig): HTMLElement {
			// dimension styling
			const sx_style_picture = `width:${gc_render.dim}px; height:${gc_render.dim}px;`;

			// depending on pfp type
			switch(g_pfp.type) {
				// plain pfp type
				case 'plain': {
					return picture(g_pfp.image, gc_render, {
						class: 'global_pfp',
						style: sx_style_picture,
					});
				}

				// a pair of icons of equal visual significance
				case 'pair': {

					break;
				}

				// a composite consisting of a foreground icon and background icon
				case 'composite': {

					break;
				}

				default: {
					// TODO: log error
				}
			}

		}

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

