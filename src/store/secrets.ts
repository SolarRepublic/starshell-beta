import {
	fetch_cipher,
} from './_base';

import type {SecretInterface, SecretPath, SecretType} from '#/meta/secret';
import {base93_to_buffer, buffer_to_base93, buffer_to_json, concat, json_to_buffer, sha256_sync, text_to_buffer, zero_out} from '#/util/data';
import SensitiveBytes from '#/crypto/sensitive-bytes';
import {Vault} from '#/crypto/vault';
import type {Promisable} from '#/meta/belt';
import type {Bip44Path} from '#/crypto/bip44';
import type {AppPath} from '#/meta/app';
import type {Bech32, ChainPath} from '#/meta/chain';
import type {Snip24Permission} from '#/schema/snip-24';
import {storage_get_all} from '#/extension/public-storage';
import {ode, oderac} from '#/util/belt';

type PathFrom<
	g_secret extends SecretInterface,
> = `/secret.${g_secret['type']}/uuid.${g_secret['uuid']}`;

interface SecretFilterConfig {
	type?: SecretType;
	name?: string;
	bip44?: Bip44Path;
	app?: AppPath;
	chain?: ChainPath;
	activeContracts?: Bech32[];
	permissions?: Snip24Permission[];
	outlets?: AppPath[];
}


async function filter_secrets(gc_filter: SecretFilterConfig={}): Promise<SecretInterface[]> {
	// TODO: replace with index store
	// fetch secrets
	const h_everything = await storage_get_all();

	// fetch cipher key
	const dk_cipher = await fetch_cipher();

	// keep only secrets
	const a_entries = await Promise.all(
		oderac(h_everything, (si_key) => {
			// only return a promise for interested items so that oderac filters out others
			if(':' === si_key[0]) {
				return (async() => {
					// read vault entry
					const k_entry = await Vault.readonly(si_key as `:${string}`);

					// read entry's data
					const atu8_secret = await k_entry.read(dk_cipher);

					// parse secret data
					const nb_data = new DataView(atu8_secret.buffer).getUint32(atu8_secret.byteOffset, false);

					// rest is the complementary json
					const g_secret = buffer_to_json(atu8_secret.subarray(4+nb_data)) as SecretInterface;

					// zero out key material
					zero_out(atu8_secret);

					// return metadata
					return g_secret;
				})();
			}
		}) as Promise<SecretInterface>[]
	);

	// no filter; return everything
	if(!Object.keys(gc_filter || {}).length) return a_entries;

	// list of secrets matching given filter
	const a_matches: SecretInterface[] = [];

	// iterate through
	FILTERING_SECRETS:
	for(const g_secret of a_entries) {
		// each criterion in filter
		for(const [si_key, z_expect] of ode(gc_filter)) {
			// cache value
			const z_actual = g_secret[si_key];

			// cache typeof
			const si_typeof = typeof z_actual;

			// not defined; disqualified
			if('undefined' === si_typeof) {
				continue FILTERING_SECRETS;
			}
			// comparable json primitive
			else if(['boolean', 'number', 'string'].includes(si_typeof)) {
				// filter doesn't match; skip
				if(z_expect !== z_actual) continue FILTERING_SECRETS;
			}
			// actual item is array
			else if(Array.isArray(z_actual)) {
				// filter provided not array
				if(!Array.isArray(z_expect)) throw new TypeError(`Improper non-array filter type for array`);

				// ensure every item in expect is present in actual
				for(const w_check of z_expect) {
					if(!z_actual.includes(w_check)) continue FILTERING_SECRETS;
				}
			}
			// actual item is null
			else if(null === z_actual) {
				// filter is not null
				if(z_expect !== null) continue FILTERING_SECRETS;
			}
			// actual item is undefined; skip
			else if('undefined' === typeof z_actual) {
				// filter is not undefined
				if('undefined' !== typeof z_expect) continue FILTERING_SECRETS;
			}
			// activeContracts
			else if('activeContracts' === si_key && Array.isArray(z_expect)) {
				// each expected contract
				for(const sa_contract of z_expect) {
					if('' !== z_actual[sa_contract]) continue FILTERING_SECRETS;
				}
			}
			// anything else
			else {
				throw new Error(`Filter type mismatch on key ${si_key}`);
			}
		}

		// passed filter
		a_matches.push(g_secret);
	}

	// return matches
	return a_matches;
}

export const Secrets = {
	pathFrom(g_secret: SecretInterface): PathFrom<typeof g_secret> {
		return `/secret.${g_secret.type}/uuid.${g_secret.uuid}`;
	},

	pathAndKeyFrom(g_secret: SecretInterface): [PathFrom<typeof g_secret>, `:${string}`] {
		const p_secret = Secrets.pathFrom(g_secret);
		return [p_secret, Secrets.keyFromPath(p_secret)];
	},

	keyFromPath(p_secret: SecretPath): `:${string}` {
		return `:${buffer_to_base93(sha256_sync(text_to_buffer(p_secret)))}`;
	},

	async put<g_secret extends SecretInterface>(atu8_data: Uint8Array, g_secret: g_secret): Promise<PathFrom<typeof g_secret>> {
		// prepare path
		const [p_res, si_secret] = Secrets.pathAndKeyFrom(g_secret);

		// produce length prefix
		const ab_len = new Uint32Array(1).buffer;
		new DataView(ab_len).setUint32(0, atu8_data.byteLength);

		// serialize secret
		const atu8_secret = concat([new Uint8Array(ab_len), atu8_data, json_to_buffer(g_secret)]);

		// fetch cipher key
		const dk_cipher = await fetch_cipher();

		// acquire vault entry
		const k_entry = await Vault.acquire(si_secret);

		// write to entry
		await k_entry.write(atu8_secret, dk_cipher);

		// release entry
		k_entry.release();

		// TODO: create fake entries to pad the rest with noise up to 16 entry blocks

		// return path
		return p_res as PathFrom<typeof g_secret>;
	},

	async borrow<w_return extends any=any>(p_secret: SecretPath, fk_use: (kn_data: SensitiveBytes, g_secret: SecretInterface) => Promisable<w_return>): Promise<Awaited<w_return>> {
		// create key from path
		const si_secret = Secrets.keyFromPath(p_secret);

		// fetch cipher key
		const dk_cipher = await fetch_cipher();

		// acquire vault entry
		const k_entry = await Vault.readonly(si_secret);

		// read entry's data
		const atu8_secret = await k_entry.read(dk_cipher);

		// parse secret data
		const nb_data = new DataView(atu8_secret.buffer).getUint32(atu8_secret.byteOffset, false);
		const atu8_data = atu8_secret.subarray(4, 4+nb_data);

		// rest is the complementary json
		const g_secret = buffer_to_json(atu8_secret.subarray(4+nb_data)) as SecretInterface;

		// wrap data
		const kn_data = new SensitiveBytes(atu8_data);

		// let caller use secret
		let w_return: Awaited<w_return>;
		try {
			w_return = await fk_use(kn_data, g_secret);
		}
		// wipe secret data after use
		finally {
			kn_data.wipe();
		}

		// return whatever caller wanted
		return w_return;
	},

	async metadata(p_secret: SecretPath): Promise<SecretInterface> {
		return await Secrets.borrow(p_secret, (kn, g) => g);
	},

	/**
	 * Handles the extra security layer and borrows the plaintext secret as SensitiveBytes
	 * @param g_secret 
	 * @returns 
	 */
	borrowPlaintext<w_return extends any=any>(p_secret: SecretPath, fk_use: (kn_data: SensitiveBytes, g_secret: SecretInterface) => Promisable<w_return>): Promise<Awaited<w_return>> {
		return Secrets.borrow(p_secret, (kn, g) => Secrets.plaintext(kn, g, fk_use));
	},

	/**
	 * Handles the extra security layer and borrows the plaintext secret as SensitiveBytes
	 * @param g_secret 
	 * @returns 
	 */
	async plaintext<w_return extends any=any>(kn_ciphertext: SensitiveBytes, g_secret: SecretInterface, fk_use: (kn_data: SensitiveBytes, g_secret: SecretInterface) => Promisable<w_return>): Promise<Awaited<w_return>> {
		// ref security type
		const si_security = g_secret.security.type;

		// prep to receive data
		let kn_data: SensitiveBytes;

		// otp security
		if('otp' === si_security) {
			kn_data = kn_ciphertext.xor(new SensitiveBytes(base93_to_buffer(g_secret.security.data)));
		}
		// none; clone raw
		else if('none' === si_security) {
			kn_data = kn_ciphertext.clone();
		}
		// other security
		else {
			throw new Error('Unknown security type');
		}

		// let caller use secret
		const w_return = await fk_use(kn_data, g_secret);

		// wipe secret data
		kn_data.wipe();

		// return whatever caller wanted
		return w_return;
	},

	async filter(...a_filters: SecretFilterConfig[]): Promise<SecretInterface[]> {
		if(a_filters.length <= 1) return filter_secrets(...a_filters);

		const as_secrets = new Set<SecretInterface>();

		for(const gc_filter of a_filters) {
			for(const g_secret of await filter_secrets(gc_filter)) {
				as_secrets.add(g_secret);
			}
		}

		return [...as_secrets];
	},

	async delete(g_secret: SecretInterface): Promise<void> {
		// prepare path
		const [p_res, si_secret] = Secrets.pathAndKeyFrom(g_secret);

		// fetch cipher key
		const dk_cipher = await fetch_cipher();

		// acquire vault entry
		const k_entry = await Vault.acquire(si_secret);

		// delete entry
		await Vault.delete(si_secret);

		// release entry
		k_entry.release();
	},
};

// export const Secrets = create_store_class({
// 	store: SI_STORE_SECRETS,
// 	extension: 'dict',
// 	class: class SecretsI extends WritableStoreDict<typeof SI_STORE_SECRETS> {
// 		static pathFrom(g_secret: SecretInterface): PathFrom<typeof g_secret> {
// 			return `/secret.${g_secret.type}/uuid.${g_secret.uuid}`;
// 		}

// 		// for(p_resource: string): number[] {
// 		// 	return this._w_cache.map[p_resource] ?? [];
// 		// }

// 		/**
// 		 * Handles the extra security layer and returns the plaintext secret as SensitiveBytes
// 		 * @param g_secret 
// 		 * @returns 
// 		 */
// 		static async plaintext(g_secret: SecretInterface): Promise<SensitiveBytes> {
// 			// ref data
// 			const sx_data = g_secret.data;

// 			// ref security type
// 			const si_security = g_secret.security.type;

// 			// prep to receive data
// 			let kn_data: SensitiveBytes;

// 			// otp security
// 			if('otp' === si_security) {
// 				kn_data = deserialize_private_key(sx_data, g_secret.security.data);
// 			}
// 			// none; deserialize raw
// 			else if('none' === si_security) {
// 				kn_data = new SensitiveBytes(base64_to_buffer(sx_data));
// 			}
// 			// other security
// 			else {
// 				throw new Error('Unknown security type');
// 			}

// 			return kn_data;
// 		}

// 		async put(g_secret: SecretInterface): Promise<PathFrom<typeof g_secret>> {
// 			// prepare path
// 			const p_res = SecretsI.pathFrom(g_secret);

// 			// update cache
// 			this._w_cache[p_res] = g_secret;

// 			// attempt to save
// 			await this.save();

// 			// return path
// 			return p_res;
// 		}

// 	},
// });

