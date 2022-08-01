import {
	create_store_class,
	WritableStoreDict,
} from './_base';

import { SI_STORE_SECRETS } from '#/share/constants';
import type { Secret } from '#/meta/secret';
import type { Resource } from '#/meta/resource';

type PathFrom<
	g_secret extends Secret['interface'],
> = `/secret.${g_secret['type']}/uuid.${g_secret['uuid']}`;

export const Secrets = create_store_class({
	store: SI_STORE_SECRETS,
	extension: 'dict',
	class: class SecretsI extends WritableStoreDict<typeof SI_STORE_SECRETS> {
		static pathFrom(g_secret: Secret['interface']): PathFrom<typeof g_secret> {
			return `/secret.${g_secret.type}/uuid.${g_secret.uuid}`;
		}

		// for(p_resource: string): number[] {
		// 	return this._w_cache.map[p_resource] ?? [];
		// }

		async put(g_secret: Secret['interface']): Promise<PathFrom<typeof g_secret>> {
			// prepare path
			const p_res = SecretsI.pathFrom(g_secret);

			// update cache
			this._w_cache[p_res] = g_secret;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}


	},
});

