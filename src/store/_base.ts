import type {Class, Instance} from 'ts-toolbelt/out/Class/_api';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {JsonObject, JsonValue, Promisable} from '#/meta/belt';
import {ode, oderac} from '#/util/belt';

import type {Access} from '#/meta/belt';
import type {Store, StoreKey} from '#/meta/store';

import {Vault, WritableVaultEntry} from '#/crypto/vault';
import {H_STORE_INITS} from './_init';
import type {Unsubscriber} from 'svelte/store';
import {global_receive} from '#/script/msg-global';
import {NotAuthenticatedError} from '#/share/errors';

type StorageValue = JsonObject | JsonValue[];

interface WritableStoreFields {
	dk_cipher: CryptoKey;
}

const hm_privates = new WeakMap<WritableStore<StoreKey, StorageValue>, WritableStoreFields>();


export class WritableStore<
	si_store extends StoreKey=StoreKey,
	w_cache extends StorageValue=Store[si_store],
> {
	constructor(protected _kv_store: WritableVaultEntry<si_store>, protected _w_cache: w_cache, dk_cipher: CryptoKey) {
		hm_privates.set(this, {
			dk_cipher,
		});
	}

	get raw(): w_cache {
		return this._w_cache;
	}

	// releases the store
	release(): void {
		return this._kv_store.release();
	}

	// saves the store from based on (presumably modified) cache value
	save(b_init=false): Promise<void> {
		return this._kv_store.writeJson(this._w_cache, hm_privates.get(this)!.dk_cipher, b_init);
	}
}

export class WritableStoreArray<
	si_store extends StoreKey=StoreKey,
	a_cache extends Store.Array<si_store>=Store.Array<si_store>,
> extends WritableStore<si_store, a_cache> {
	get size(): a_cache['length'] {
		return this._w_cache.length;
	}

	at(i_key: keyof a_cache): a_cache[typeof i_key] | null {
		return this._w_cache[i_key] ?? null;
	}

	map(f_map: (w_value: a_cache[number], i_key: number) => any): ReturnType<typeof f_map>[] {
		return this._w_cache.map(f_map);
	}

	async prepend(w_value: a_cache[number]): Promise<void> {
		// update cache
		this._w_cache.unshift(w_value);

		// attempt to save
		await this.save();
	}

	async append(w_value: a_cache[number]): Promise<void> {
		// update cache
		this._w_cache.unshift(w_value);

		// attempt to save
		await this.save();
	}
}

export class WritableStoreMap<
	si_store extends StoreKey=StoreKey,
	h_cache extends Store.Map<si_store>=Store.Map<si_store>,
> extends WritableStore<si_store, h_cache> {
	/**
	 * Entries iterator
	 */
	* [Symbol.iterator](): IterableIterator<[keyof h_cache, h_cache[keyof h_cache]]> {
		for(const a_pair of ode(this._w_cache)) {
			yield a_pair;
		}
	}

	at(p_res: keyof h_cache): h_cache[typeof p_res] | null {
		return this._w_cache[p_res] ?? null;
	}

	reduce<
		w_out extends any,
	>(f_map: (si_key: keyof h_cache, w_value: h_cache[keyof h_cache]) => w_out): w_out[] {
		return oderac(this._w_cache, f_map as (si: string, w_value: h_cache[keyof h_cache]) => w_out);
	}

	entries(): [keyof h_cache, h_cache[keyof h_cache]][] {
		return ode(this._w_cache);
	}

	async delete(p_res: keyof h_cache): Promise<boolean> {
		if(!(p_res in this._w_cache)) return false;

		delete this._w_cache[p_res];

		await this.save();

		return true;
	}

	// async put(g_info: h_cache[keyof h_cache]): Promise<void> {
	// 	// prepare app path
	// 	const p_app = AppsI.pathFor(g_app.host, g_app.scheme);

	// 	// update cache
	// 	this._w_cache[p_app] = g_app;

	// 	// attempt to save
	// 	await this.save();
	// }
}



export class WritableStoreDict<
	si_store extends StoreKey,
	h_cache extends Store.Map<si_store>=Store.Map<si_store>,
> extends WritableStore<si_store, h_cache> {
	get<si_key extends keyof h_cache>(si_key: si_key): h_cache[si_key] | null {
		return this._w_cache[si_key] ?? null;
	}

	async set(si_key: keyof h_cache, w_value: h_cache[typeof si_key]): Promise<void> {
		// update cache
		this._w_cache[si_key] = w_value;

		// attempt to save
		await this.save();
	}
}

export type StoreClassImpl<
	si_store extends StoreKey=StoreKey,
	w_cache extends Store[si_store]=Store[si_store],
> = Class<[WritableVaultEntry<si_store>, w_cache, CryptoKey], WritableStore<si_store, w_cache>>;

export type UseStore<
	dc_store extends StoreClassImpl,
	w_return extends any=void,
> = (ks_store: InstanceType<dc_store>) => Promisable<w_return>;

type StoreExtensionKey = 'array' | 'map' | 'dict';

export type StaticStore<
	si_store extends StoreKey=StoreKey,
	dc_store extends StoreClassImpl<si_store>=StoreClassImpl<si_store>,
	s_extension extends undefined | StoreExtensionKey=undefined | StoreExtensionKey,
> = Merge<{
	open<w_return extends any>(fk_use: UseStore<dc_store, w_return>): Promise<w_return>;
	read(): Promise<Instance<dc_store>>;
}, Access<{
	array: {
		prepend(w_value: Store[si_store][Extract<number, keyof Store[si_store]>]): Promise<void>;

		append(w_value: Store[si_store][Extract<number, keyof Store[si_store]>]): Promise<void>;
	};
	map: {
		at(si_key: Store.Key<si_store>): Promise<null | Store[si_store][typeof si_key]>;

		delete(si_key: Store.Key<si_store>): Promise<boolean>;
	};
	dict: {
		get<si_key extends Store.Key<si_store>>(si_key: si_key): Promise<null | Store[si_store][si_key]>;

		set(si_key: Store.Key<si_store>, w_value: Store[si_store][typeof si_key]): Promise<void>;
	};
}, s_extension>>;


export async function fetch_cipher(): Promise<CryptoKey> {
	// fetch the root key
	const dk_root = await Vault.getRootKey();

	// not authenticated; throw
	if(!dk_root) throw new NotAuthenticatedError();

	// derive the cipher key
	return await Vault.cipherKey(dk_root, true);
}


export function create_store_class<
	si_store extends StoreKey,
	dc_store extends StoreClassImpl,
	w_cache extends Store[si_store],
	s_extends extends undefined | StoreExtensionKey,
// >(si_store: si_store, dc_store: dc_store): StaticStore<si_store, dc_store> & dc_store {
>({
	store: si_store,
	class: dc_store,
	extension: s_extension,
}: {
	store: si_store;
	class: dc_store;
	extension?: s_extends;
}): dc_store & StaticStore<si_store, dc_store, s_extends> {
	async function open_or_initialize(dk_cipher: CryptoKey) {
		// checkout the store from the vault
		const kv_store = await Vault.acquire(si_store);

		try {
			// read the store as json
			let w_store = await kv_store.readJson(dk_cipher) as w_cache;

			// if this creates the store, save it immediately
			let b_save = false;

			// not exists; initialize
			if(!w_store) {
				// save to the store after this
				b_save = true;

				// load default value from code
				w_store = H_STORE_INITS[si_store] as w_cache;

				// default value wasn't defined in code
				if(!w_store) {
					// too late to do anything about it now
					console.error(`Critical error: no default store object defined for "${si_store}"; using object as fallback`);

					// at the very least, attempt to fill with a plain object
					w_store = {} as w_cache;
				}
			}

			return [b_save, w_store, kv_store] as const;
		}
		// only in case of error
		catch(e_read) {
			// release store
			kv_store.release();

			// rethrow
			throw e_read;
		}
	}

	return Object.assign(dc_store, {
		async open<w_return extends any>(fk_use: UseStore<dc_store, w_return>): Promise<w_return> {
			// fetch cipher key
			const dk_cipher = await fetch_cipher();

			// 
			const [b_save, w_store, kv_store] = await open_or_initialize(dk_cipher);

			// instantiate the store class
			const ks_store = new dc_store(kv_store, w_store, dk_cipher) as InstanceType<dc_store>;

			// save the newly created store
			if(b_save) await ks_store.save(true);

			// use the store
			let w_return: w_return;
			try {
				w_return = await fk_use(ks_store);
			}
			finally {
				// release the store
				ks_store.release();
			}

			// return
			return w_return;
		},

		async read(): Promise<Instance<dc_store>> {
			// fetch cipher key
			const dk_cipher = await fetch_cipher();

			// read from the store
			let kv_store = await Vault.readonly(si_store) as WritableVaultEntry;

			// read the store as json
			let w_store = await kv_store.readJson(dk_cipher) as w_cache;

			// not exists; initialize
			let b_save = false;
			let b_writable = false;
			if(!w_store) {
				b_writable = true;
				[b_save, w_store, kv_store] = await open_or_initialize(dk_cipher);
			}

			// instantiate store class
			const ks_store = new dc_store(kv_store, w_store, dk_cipher) as InstanceType<dc_store>;

			// need to save it
			if(b_save) await ks_store.save(true);

			// then immediately release
			if(b_writable) kv_store.release();

			// return the instance
			return ks_store;
		},

		...('array' === s_extension) && {
			async prepend(w_value: Store[si_store][Extract<number, keyof Store[si_store]>]): Promise<number> {
				return await dc_store['open'](ks_self => ks_self.prepend(w_value));
			},

			async append(w_value: Store[si_store][Extract<number, keyof Store[si_store]>]): Promise<number> {
				return await dc_store['open'](ks_self => ks_self.append(w_value));
			},
		},

		...('map' === s_extension) && {
			async at<si_key extends Store.Key<si_store>>(si_key: si_key): Promise<null | Store[si_store][si_key]> {
				return (await dc_store['read']()).at(si_key);
			},

			async delete<si_key extends Store.Key<si_store>>(si_key: si_key): Promise<boolean> {
				return (await dc_store['open']()).delete(si_key);
			},
		},

		...('dict' === s_extension) && {
			async get<si_key extends Store.Key<si_store>>(si_key: si_key): Promise<null | Store[si_store][si_key]> {
				return (await dc_store['read']()).get(si_key);
			},

			async set(si_key: Store.Key<si_store>, w_value: Store[si_store][typeof si_key]): Promise<void> {
				return await dc_store['open'](ks_self => ks_self.set(si_key, w_value));
			},
		},
	}) as StaticStore<si_store, dc_store, s_extends> & dc_store;
}


export function subscribe_store(si_key: StoreKey, f_callback: (b_init: boolean) => void): Unsubscriber {
	return global_receive({
		updateStore({key:si_store, init:b_init}) {
			if(si_store === si_key) {
				f_callback(b_init);
			}
		},
	});
}
