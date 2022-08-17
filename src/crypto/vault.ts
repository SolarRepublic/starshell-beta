import '#/dev';

import type { Store, StoreKey } from '#/meta/store';
import { F_NOOP, JsonObject, JsonValue, ode, type Dict } from '#/util/belt';
import {
	base93_to_buffer,
	buffer_to_base93,
	buffer_to_hex,
	buffer_to_string8,
	buffer_to_text,
	concat,
	hex_to_buffer,
	string8_to_buffer,
	text_to_buffer,
	zero_out,
} from '#/util/data';

import type { Merge } from 'ts-toolbelt/out/Object/Merge';


import { default as sha256_sync } from 'crypto-js/sha256';
import { default as sha512_sync } from 'crypto-js/sha512';

import SensitiveBytes from './sensitive-bytes';
import { NotAuthenticatedError } from '#/share/auth';
import { global_wait, global_broadcast } from '#/script/msg-global';
import { syserr, syswarn } from '#/app/common';
import { H_STORE_INITS } from '#/store/_init';
import { PublicStorage, storage_get } from '#/extension/public-storage';
import AsyncLockPool, { LockTimeoutError } from '#/util/async-lock-pool';


// sha256("starshell")
export const ATU8_SHA256_STARSHELL = hex_to_buffer(sha256_sync('starshell').toString());

// sha512("starshell")
export const ATU8_SHA512_STARSHELL = hex_to_buffer(sha512_sync('starshell').toString());

// identifies the schema version of the store
const SI_VERSION_SCHEMA_STORE = '1';

// number of key derivation iterations
// const N_ITERATIONS = 6942069;
// const N_ITERATIONS = 4206969;
const N_ITERATIONS = 696969;
// const N_ITERATIONS = 20;

const NB_PADDING = 512;

// size of salt in bytes
const NB_SALT = 256 >> 3;

// size of nonce in bytes
const NB_NONCE = 256 >> 3;

// pseudo-random hash function (OK to use SHA-512 with AES-256 since kdf will simply use higheset-order octets of hash)
// <https://crypto.stackexchange.com/questions/41476/is-there-any-benefit-from-using-sha-512-over-sha-256-when-aes-just-truncates-it>
const SI_PRF = 'SHA-512';

// size of derived AES key in bits
const NI_DERIVED_AES_KEY = 256;

const XC_CHAR_JSON_0 = '{'.charCodeAt(0);
const XC_CHAR_JSON_1 = '"'.charCodeAt(0);

// once this threshold is exceeded, do not enqueue any more recryption operations
const NB_RECRYPTION_THRESHOLD = 32 * 1024;  // 64 KiB

// algorithm options for deriving root signing key
const GC_DERIVE_ROOT_SIGNING = {
	name: 'HMAC',
	hash: 'SHA-256',
};

// algorithm options for deriving root encryption/decryption key
const GC_DERIVE_ROOT_CIPHER = {
	name: 'AES-GCM',
	length: NI_DERIVED_AES_KEY,
};

// params for hkdf common to all cases (salt gets overridden)
const GC_HKDF_COMMON = {
	name: 'HKDF',
	hash: 'SHA-256',
	salt: ATU8_SHA256_STARSHELL,
	info: Uint8Array.from([]),
};

const A_STORE_KEYS: Array<StoreKey | 'keys'> = ['keys', ...Object.keys(H_STORE_INITS) as Array<StoreKey>];

// identify this local frame
const SI_FRAME_LOCAL = crypto.randomUUID().slice(24);


interface VaultFields {
	atu8_ciphertext: Uint8Array;
}


async function unlock(atu8_import: Uint8Array) {
	// Web Crypto does not support the secp256k1 curve, but keeping the private key in heap memory
	// makes the user more vulnerable to key finding attacks. instead, try to leverage platform-specific
	// solutions provided by browser that ideally store the key within secure hardware boundaries.
	// more specifically, choose a supported elliptic curve that has larger `n` curve order than secp256k1
	// in order to make sure the private key won't be rejected upon import for exceeding the valid range.
	// secp256k1: <https://neuromancer.sk/std/secg/secp256k1>
	// secp384r1 (P-384): <https://neuromancer.sk/std/secg/secp384r1>
	await crypto.subtle.importKey('raw', atu8_import, {
		name: 'ECDSA',
		namedCurve: 'P-384',
	}, true, []);

	// 
	const atu8_a = crypto.getRandomValues(new Uint8Array(32));
	crypto.subtle.importKey('raw', atu8_a, {
		name: 'ECDSA',
		namedCurve: 'P-384',
	}, false, ['deriveBits']);
}


/**
 * Private fields for instances of `Vault`
 */
const hm_privates = new WeakMap<VaultEntry, VaultFields>();

// /**
//  * Keeps track of which stores have been checked out in order to prevent lost updates.
//  */
// const h_checked_outs: Dict<Vault> = {};


// /**
//  * Loads metadata (incl. ciphertext) from storage.
//  */
// async function Vault$_load<
// 	k_this extends Vault,
// >(this: void, k_this: k_this): Promise<k_this> {
// 	// read from storage
// 	const w_storage = (await chrome.storage.local.get(k_this._si_key))[k_this._si_key];

// 	// destructure storage and fill in defaults
// 	const {
// 		salt: sh_salt_read,
// 		nonce: sh_nonce_read,
// 		schema: si_schema_read,
// 		data: sx_data,
// 	} = w_storage || {
// 		salt: '',
// 		nonce: '',
// 		schema: SI_VERSION_SCHEMA_STORE,
// 		data: '',
// 	};

// 	// save to local fields
// 	hm_privates.set(k_this, {
// 		sh_salt_read,
// 		sh_nonce_read,
// 		si_schema_read,
// 		atu8_ciphertext: string8_to_buffer(sx_data),
// 	});

// 	// mark as loaded
// 	k_this._b_loaded = true;

// 	// return instance
// 	return k_this;
// }


// async function Vault$_prederive(this: void, k_this: Vault, dk_phrase: CryptoKey): Promise<void> {
// 	// ref private struct
// 	const g_private = hm_privates.get(k_this)!;

// 	// generate salt to derive the next encryption key
// 	const atu8_salt_write = crypto.getRandomValues(new Uint8Array(NB_SALT));

// 	// derive the next encryption key
// 	const dk_aes_write = await pbkdf2_derive(dk_phrase, atu8_salt_write);

// 	// store the key so it is ready for the next encryption
// 	Object.assign(g_private, {
// 		dk_aes_write,
// 		sx_salt_write: buffer_to_hex(atu8_salt_write),
// 	});
// }

// /**
//  * Takes the passphrase key as input and uses it to derive the current decryption key.
//  */
// async function Vault$_rotate(this: void, k_this: Vault, dk_phrase: CryptoKey) {
// 	// ref private struct
// 	const g_private = hm_privates.get(k_this)!;

// 	// ref the salt to derive the decryption key
// 	const atu8_salt_read = hex_to_buffer(g_private.sh_salt_read);
	
// 	// derive the decryption key
// 	const dk_aes_read = await pbkdf2_derive(dk_phrase, atu8_salt_read);

// 	// return the decryption key
// 	return dk_aes_read;
// }

// async function Vault$_decrypt(this: void, k_this: Vault, dk_aes_read: CryptoKey): Promise<Uint8Array> {
// 	// destructure private field(s)
// 	const {
// 		sh_nonce_read,
// 		atu8_ciphertext,
// 	} = hm_privates.get(k_this)!;
	
// 	// prep the iv to decrypt the store
// 	const atu8_nonce_read = hex_to_buffer(sh_nonce_read);

// 	// return decrypted data
// 	return await crypto.subtle.decrypt({
// 		name: 'AES-GCM',
// 		iv: atu8_nonce_read,
// 	}, dk_aes_read, atu8_ciphertext);
// }

async function test_encryption_integrity(atu8_data: Uint8Array, dk_cipher: CryptoKey, atu8_vector: Uint8Array, atu8_verify=ATU8_SHA256_STARSHELL) {
	try {
		const atu8_encrypted = await encrypt(atu8_data, dk_cipher, atu8_vector, atu8_verify);
		const s_encrypted = buffer_to_string8(atu8_encrypted);
		const atu8_encrypted_b = string8_to_buffer(s_encrypted);
		const atu8_decrypted = await decrypt(atu8_encrypted_b, dk_cipher, atu8_vector, atu8_verify);

		if(atu8_data.byteLength !== atu8_decrypted.byteLength) {
			throw new Error(`Byte length mismatch`);
		}

		for(let ib_each=0; ib_each<atu8_data.byteLength; ib_each++) {
			if(atu8_data[ib_each] !== atu8_decrypted[ib_each]) {
				throw new Error(`Buffers are not identical`);
			}
		}
	}
	catch(e_identity) {
		throw new Error(`Failed to complete round-trip encryption/decryption: ${e_identity}`);
	}
}

export type SessionStorage = Merge<{
	root: {
		native: CryptoKey;
		wrapped: number[];
	};
	vector: {
		native: Uint8Array;
		wrapped: number[];
	};
	flow: {
		native: string;
		wrapped: string;
	};
}, {
	[si_lock in `lock_${string}`]: {
		native: string;
		wrapped: string;
	};
}>;

export type SessionStorageKey = keyof SessionStorage;

export namespace SessionStorage {
	export type Native<
		si_key extends SessionStorageKey=SessionStorageKey,
	> = SessionStorage[si_key] extends {native: infer w_native}
		? w_native
		: never;

	export type Wrapped<
		si_key extends SessionStorageKey=SessionStorageKey,
	> = SessionStorage[si_key] extends {wrapped: infer w_wrapped}
		? w_wrapped
		: never;

	export type Struct<
		si_which extends 'native' | 'wrapped',
	> = {
		[si_key in SessionStorageKey]: {
			native: Native<si_key>;
			wrapped: Wrapped<si_key>;
		}[si_which];
	};
}

export async function restore_as_key(
	z_data: null | number[] | CryptoKey,
	w_kdf: AlgorithmIdentifier,
	b_extractable: boolean,
	a_usages: KeyUsage[],
): Promise<null | CryptoKey> {
	if(Array.isArray(z_data)) {
		return await crypto.subtle.importKey('raw', Uint8Array.from(z_data), w_kdf, false, a_usages);
	}

	return z_data;
}

export function restore_as_buffer(z_data: null | number[] | Uint8Array): null | Uint8Array {
	if(Array.isArray(z_data)) {
		return Uint8Array.from(z_data);
	}

	return z_data;
}


type SetNative = Partial<SessionStorage.Struct<'native'>>;
type SetWrapped = Partial<SessionStorage.Struct<'wrapped'>>;

export const {
	session_storage_get,
	session_storage_set_native,
	session_storage_set_wrapped,
	session_storage_remove,
	session_storage_clear,
	session_storage_is_native,
} = (() => {
	if(chrome.storage['session']) {
		const d_session = (chrome.storage as unknown as {
			session: chrome.storage.StorageArea;
		}).session;

		return {
			async session_storage_get<
				si_key extends SessionStorageKey,
			>(si_key: si_key): Promise<SessionStorage.Wrapped<si_key> | null> {
				return (await d_session.get([si_key]) as {
					[si in typeof si_key]: SessionStorage.Wrapped<si_key> | null;
				})[si_key];
			},

			session_storage_set_native(h_set_native: SetNative): Promise<void> {
				throw new Error('Implementation bug; cannot use native session storage');
			},

			async session_storage_set_wrapped(h_set_wrapped: SetWrapped): Promise<void> {
				return await d_session.set(h_set_wrapped);
			},

			async session_storage_remove(si_key: SessionStorageKey): Promise<void> {
				return await d_session.remove(si_key);
			},

			async session_storage_clear(): Promise<void> {
				return await d_session.clear();
			},

			session_storage_is_native: false,
		};
	}
	else {
		const dw_background = chrome.extension.getBackgroundPage();

		if(!dw_background) {
			throw new Error('Browser does not support any type of session storage');
		}

		// declare initial storage object
		let g_session: SetNative = dw_background['_g_session'] = {};

		return {
			/* eslint-disable @typescript-eslint/require-await */
			async session_storage_get<
				si_key extends SessionStorageKey,
			>(si_key: si_key): Promise<SessionStorage.Native<si_key> | null> {
				return g_session[si_key]! ?? null;
			},

			async session_storage_set_native(h_set_native: SetNative): Promise<void> {
				for(const [si_key, w_value] of ode(h_set_native)) {
					session_storage_remove(si_key);
					g_session[si_key as string] = w_value!;
				}
			},

			async session_storage_set_wrapped(h_set_wrapped: SetWrapped): Promise<void> {
				throw new Error('Implementation bug; cannot use wrapped session storage');
			},

			async session_storage_remove(si_key: SessionStorageKey): Promise<void> {
				const z_value = g_session[si_key];
				if(z_value && 'object' === typeof z_value) {
					if(Array.isArray(z_value) || ArrayBuffer.isView(z_value)) {
						zero_out(z_value);
					}
				}

				delete g_session[si_key];
			},

			async session_storage_clear(): Promise<void> {
				for(const [si_key, w_value] of ode(g_session)) {
					session_storage_remove(si_key);
				}

				// reset
				dw_background['_g_session'] = g_session = {};
			},

			session_storage_is_native: true,

			/* eslint-enable @typescript-eslint/require-await */
		};
	}
})();


async function session_storage_set_isomorphic(h_set: SetNative & SetWrapped): Promise<void> {
	if(session_storage_is_native) {
		await session_storage_set_native(h_set as SetNative);
	}
	else {
		await session_storage_set_wrapped(h_set as SetWrapped);
	}
}

async function hkdf_params(): Promise<typeof GC_HKDF_COMMON> {
	// get base
	const g_base = await Vault.getBase();

	// prep salt ref
	let atu8_salt: Uint8Array;

	// base exists and is valud
	if(Vault.isValidBase(g_base)) {
		// retrieve existing salt
		atu8_salt = (await Vault.getSalt())!;

		// does not exist
		if(!atu8_salt || NB_SALT !== atu8_salt.byteLength) {
			throw new Error('Vault is irreparably corrupted. No salt was found.');
		}
	}
	// base not yet exists
	else {
		// generate new salt
		atu8_salt = crypto.getRandomValues(new Uint8Array(NB_SALT));

		// save
		await Vault.setSalt(atu8_salt);
	}

	// parse base, return extended HKDF params
	return {
		...GC_HKDF_COMMON,
		salt: atu8_salt,
	};
}


function pbkdf2_derive2(ab_nonce: BufferSource, x_iteration_multiplier=0): (dk_base: CryptoKey) => Promise<SensitiveBytes> {
	return async function(dk_base) {
		return new SensitiveBytes(new Uint8Array(await crypto.subtle.deriveBits({
			name: 'PBKDF2',
			salt: ab_nonce,
			iterations: x_iteration_multiplier? Math.ceil(N_ITERATIONS * x_iteration_multiplier): N_ITERATIONS,
			hash: SI_PRF,
		}, dk_base, 256)));
	}
}

class DecryptionError extends Error {
	constructor(public original: Error) {
		super('Failed to decrypt data: '+original);
	}
}

export async function decrypt(atu8_data: Uint8Array, dk_key: CryptoKey, atu8_nonce: Uint8Array, atu8_verify=ATU8_SHA256_STARSHELL): Promise<Uint8Array> {
	try {
		return new Uint8Array(await crypto.subtle.decrypt({
			name: 'AES-GCM',
			iv: atu8_nonce,
			additionalData: atu8_verify,
		}, dk_key, atu8_data) as Uint8Array);
	}
	catch(e_decrypt) {
		throw new DecryptionError(e_decrypt as Error);
	}
}


class EncryptionError extends Error {
	constructor(public original: Error) {
		super('Failed to encrypt data: '+original);
	}
}

export async function encrypt(atu8_data: Uint8Array, dk_key: CryptoKey, atu8_nonce: Uint8Array, atu8_verify=ATU8_SHA256_STARSHELL): Promise<Uint8Array> {
	try {
		return new Uint8Array(await crypto.subtle.encrypt({
			name: 'AES-GCM',
			iv: atu8_nonce,
			additionalData: atu8_verify,
		}, dk_key, atu8_data) as Uint8Array);
	}
	catch(e_encrypt) {
		throw new EncryptionError(e_encrypt as Error);
	}
}

interface RootKeyStruct {
	key: CryptoKey;
	vector: Uint8Array;
	nonce: bigint;
}


interface BaseParams {
	version: number;
	entropy: string;
	nonce: string;
	signature: string;
}

interface ParsedBase {
	version: number;
	entropy: Uint8Array;
	nonce: bigint;
	signature: Uint8Array;
}

interface RootKeysData {
	old: RootKeyStruct;
	new: RootKeyStruct;
	export: SensitiveBytes | null;
}

// wait for release from local frame
const h_release_waiters_local: Dict<VoidFunction[]> = {};


// async function storage_put(si_key: PublicStorageKey, w_value: any): Promise<void> {
// 	const si_wire = `@${si_key}`;
// 	await chrome.storage.local.set({
// 		[si_wire]: w_value,
// 	});
// }

// async lock pools for stores
const h_lock_pools: Partial<Record<`lock_${StoreKey}`, AsyncLockPool>> = {};

let c_incidents = 0;

/**
 * Responsible for (un)marshalling data structs between encrypted-at-rest storage and unencrypted-in-use memory.
 * 
 * Example:
 * ```ts
 * const kp_contacts = await Vault.checkout('contacts');
 * await kp_contacts.unlock('password123', Store);
 * kp_contacts.save();
 * ```
 */
export const Vault = {
	async getBase(): Promise<BaseParams | undefined> {
		return await storage_get<BaseParams>('base') || void 0;
	},

	isValidBase(z_test: unknown): z_test is BaseParams {
		return !!z_test && 'object' === typeof z_test
			&& 'number' === typeof z_test['version']
			&& 'string' === typeof z_test['entropy']
			&& 'string' === typeof z_test['nonce']
			&& 'string' === typeof z_test['signature'];
	},

	parseBase(g_base: BaseParams): ParsedBase {
		return {
			version: g_base.version,
			entropy: hex_to_buffer(g_base.entropy),
			nonce: BigInt(g_base.nonce),
			signature: hex_to_buffer(g_base.signature),
		};
	},

	async setParsedBase(g_base: Omit<ParsedBase, 'version'>): Promise<void> {
		return await chrome.storage.local.set({
			base: {
				version: 1,
				entropy: buffer_to_hex(g_base.entropy),
				nonce: g_base.nonce+'',
				signature: buffer_to_hex(g_base.signature),
			},
		});
	},

	async eraseBase(): Promise<void> {
		return await chrome.storage.local.remove(['base']);
	},

	/**
	 * Retrieve the existing salt value if defined
	 */
	async getSalt(): Promise<Uint8Array | undefined> {
		// fetch salt value
		const sx_salt = await storage_get<string>('salt');

		// convert to buffer if it exists
		return sx_salt? hex_to_buffer(sx_salt): void 0;
	},

	async setSalt(atu8_salt: Uint8Array): Promise<void> {
		// store salt as stringify'd buffer
		return await chrome.storage.local.set({
			salt: buffer_to_hex(atu8_salt),
		});
	},

	async getRootKey(): Promise<CryptoKey | null> {
		const w_root = await session_storage_get('root');
		if(!w_root) return null;

		return await restore_as_key(w_root, 'HKDF', false, ['deriveKey']);

		// // background page exists
		// let dw_background!: Window | null;
		// if(chrome.extension.getBackgroundPage && (dw_background=chrome.extension.getBackgroundPage())) {
		// 	return dw_background['_dk_root'] || null;
		// }
		// // mv3
		// else {
		// 	// read root key from session storage
		// 	const ax_root = await session_storage_get('root');

		// 	// no key; not authenticated
		// 	if(!ax_root) return null;

		// 	// return imported root key
		// 	return await crypto.subtle.importKey('raw', Uint8Array.from(ax_root), 'HKDF', false, ['deriveKey']);
		// }
	},

	async clearRootKey(): Promise<void> {
		// background page exists
		let dw_background!: Window | null;
		if(chrome.extension.getBackgroundPage && (dw_background=chrome.extension.getBackgroundPage())) {
			delete dw_background['_dk_root'];
		}

		// global broadcast logout event
		global_broadcast({
			type: 'logout',
		});

		// in parallel
		await Promise.all([
			// clear session storage
			session_storage_clear(),
		]);
	},

	/**
	 * Create the root key by importing the plaintext password string, using PBKDF2 to derive `root0`, then deferring
	 * to callbacks to complete child key derivation. Uses callbacks instead of a Promise to help make it obvious to
	 * the runtime that the password string does not need to put into heap memory (i.e., only exists in stack memory).
	 */
	deriveRootBits(
		atu8_phrase: Uint8Array,
		ab_nonce: BufferSource,
		x_iteration_multiplier=0
	): Promise<SensitiveBytes> {
		// import the passphrase to a managed key object
		return crypto.subtle.importKey('raw', atu8_phrase, 'PBKDF2', false, ['deriveBits'])
			// help allow the plaintext password to have a short life in the stack by forcing it out of scope as soon as possible
			.then(pbkdf2_derive2(ab_nonce, x_iteration_multiplier));
	},


	async deriveRootKeys(atu8_phrase: Uint8Array, atu8_entropy: Uint8Array, xg_nonce_old: bigint, b_export_new=false): Promise<RootKeysData> {
		// prep new nonce (this is intended to be reproducible in case program exits while rotating keys)
		const xg_nonce_new = (xg_nonce_old + 1n) % (2n ** 64n);

		// prep array buffer (8 bytes for fixed entropy + 8 bytes for nonce)
		const atu8_vector_old = new Uint8Array(16);
		const atu8_vector_new = new Uint8Array(16);

		// set entropy into buffer at leading 8 bytes
		atu8_vector_old.set(atu8_entropy, 0);
		atu8_vector_new.set(atu8_entropy, 0);

		// set nonce into buffer at bottom 8 bytes
		new DataView(atu8_vector_old.buffer).setBigUint64(8, xg_nonce_old, false);
		new DataView(atu8_vector_new.buffer).setBigUint64(8, xg_nonce_new, false);

		// migration
		let x_migrate_multiplier = 0;
		const g_last_seen = await PublicStorage.lastSeen();
		if(!g_last_seen) {
			x_migrate_multiplier = 20 / N_ITERATIONS;
		}

		// migrate init stores
		if(!g_last_seen || (+g_last_seen.version.replace(/^v?0\.0\./, '')) <= 6) {
			await chrome.storage.local.remove('chains');
			await chrome.storage.local.remove('agents');
			await chrome.storage.local.remove('networks');
			await chrome.storage.local.remove('contacts');
			await chrome.storage.local.remove('apps');
		}

		// derive the two root byte sequences for this session
		const [
			kn_root_old,
			kn_root_new,
		] = await Promise.all([
			Vault.deriveRootBits(atu8_phrase, atu8_vector_old, x_migrate_multiplier),
			Vault.deriveRootBits(atu8_phrase, atu8_vector_new),
		]);

		// zero out passphrase data
		zero_out(atu8_phrase);

		// derive root keys
		const [
			dk_root_old,
			dk_root_new,
		] = await Promise.all([
			crypto.subtle.importKey('raw', kn_root_old.data, 'HKDF', false, ['deriveKey']),
			crypto.subtle.importKey('raw', kn_root_new.data, 'HKDF', false, ['deriveKey']),
		]);

		// wipe root bits
		kn_root_old.wipe();
		if(!b_export_new) kn_root_new.wipe();

		// mark as seen
		await PublicStorage.markSeen();

		return {
			old: {
				key: dk_root_old,
				vector: atu8_vector_old,
				nonce: xg_nonce_old,
			},
			new: {
				key: dk_root_new,
				vector: atu8_vector_new,
				nonce: xg_nonce_new,
			},
			export: b_export_new? kn_root_new: null,
		};
	},


	async cipherKey(dk_root: CryptoKey, b_encrypt=false): Promise<CryptoKey> {
		// return crypto.subtle.deriveKey(await hkdf_params(), dk_root, GC_DERIVE_ROOT_CIPHER, false, b_encrypt? ['encrypt', 'decrypt']: ['decrypt']);
		return crypto.subtle.deriveKey(await hkdf_params(), dk_root, GC_DERIVE_ROOT_CIPHER, true, b_encrypt? ['encrypt', 'decrypt']: ['decrypt']);
	},

	async signatureKey(dk_root: CryptoKey, b_signer=false): Promise<CryptoKey> {
		return crypto.subtle.deriveKey(await hkdf_params(), dk_root, GC_DERIVE_ROOT_SIGNING, false, b_signer? ['sign']: ['verify']);
	},

	async generateRootKeySignature(dk_root: CryptoKey): Promise<Uint8Array> {
		// derive signature key
		const dk_verify = await Vault.signatureKey(dk_root, true);

		// return signature
		return new Uint8Array(await crypto.subtle.sign('HMAC', dk_verify, ATU8_SHA256_STARSHELL));
	},

	async verifyRootKey(dk_root: CryptoKey, atu8_test: Uint8Array): Promise<boolean> {
		// derive verification key
		const dk_verify = await Vault.signatureKey(dk_root, false);

		// return verification test result
		return await crypto.subtle.verify('HMAC', dk_verify, atu8_test, ATU8_SHA256_STARSHELL);
	},

	async recryptAll(dk_root_old: CryptoKey, atu8_nonce_old: Uint8Array, dk_root_new: CryptoKey, atu8_nonce_new: Uint8Array): Promise<void> {
		// prep list of async operations
		const a_promises: Array<Promise<void>> = [];

		// keep running total of bytes pending to be recrypted
		let cb_pending = 0;

		// derive aes keys
		const [
			dk_aes_old,
			dk_aes_new,
		] = await Promise.all([
			Vault.cipherKey(dk_root_old, false),
			Vault.cipherKey(dk_root_new, true),
		]);

		// each key
		for(const si_key of A_STORE_KEYS) {
			// ready from storage
			const sx_entry = await storage_get<string>(si_key);

			// skip no data
			if(!sx_entry) continue;


			// TODO: deserialize using base93 if migration has been completed

			// deserialize
			const atu8_entry = string8_to_buffer(sx_entry);

			// byte length
			cb_pending += atu8_entry.byteLength;

			/* eslint-disable @typescript-eslint/no-loop-func */
			// enqueue async operation
			a_promises.push((async() => {
				// decrypt its data with old root key
				let atu8_data: Uint8Array;
				try {
					atu8_data = await decrypt(atu8_entry, dk_aes_old, atu8_nonce_old);
				}
				// decryption failed; retry with new key (let it throw if it fails)
				catch(e_decrypt) {
					atu8_data = await decrypt(atu8_entry, dk_aes_new, atu8_nonce_old);
				}

				// encrypt it with new root key
				const atu8_replace = await encrypt(atu8_data, dk_aes_new, atu8_nonce_new);

				// save encrypted data back to store
				await chrome.storage.local.set({
					[si_key]: buffer_to_string8(atu8_replace),
					// [si_key]: buffer_to_base93(atu8_replace),
				});

				// done; clear bytes from pending
				cb_pending -= atu8_entry.byteLength;
			})());
			/* eslint-enable @typescript-eslint/no-loop-func */

			// exceeded threshold
			if(cb_pending > NB_RECRYPTION_THRESHOLD) {
				// wait for operations to finish
				await Promise.all(a_promises);

				// continue
				a_promises.length = 0;
			}
		}

		// wait for all operations to finish
		await Promise.all(a_promises);
	},


	async peekJson(si_key: keyof Store, dk_cipher: CryptoKey): Promise<null | Store[typeof si_key]> {
		// checkout store
		const kp_store = await Vault.readonly(si_key);

		// read from it
		const w_read = kp_store.readJson(dk_cipher);

		// return the json
		return w_read;
	},


	/**
	 * Obtain a readonly vault entry by its given key identifier.
	 */
	async readonly(si_key: keyof Store): Promise<VaultEntry> {
		// read entry ciphertext
		const sx_entry = await storage_get<string>(si_key);

		// create instance
		return new VaultEntry(si_key, sx_entry ?? '');
	},


	/**
	 * Acquires an exclusive lock to a writable vault entry by its given key identifier.
	 * @param si_key key identifier
	 * @returns new vault entry
	 */
	async acquire(si_key: StoreKey, c_attempts=0): Promise<WritableVaultEntry<typeof si_key>> {
		// prep lock id and self id
		const si_lock = `lock_${si_key}` as const;

		let b_debug = false;

		let si_log = `${si_lock}/${c_incidents++}]:`;

		// check if the lock is busy locally and wait for it
		const k_pool = h_lock_pools[si_lock] = h_lock_pools[si_lock] || new AsyncLockPool(1);

		if(b_debug) console.log(`${si_log} acquire(${k_pool._c_free} free)`);

		let f_release = F_NOOP;
		try {
			f_release = await k_pool.acquire(null, 10e3);
		}
		catch(e_acquire) {
			if(e_acquire instanceof LockTimeoutError) {
				throw new Error(`Timed out while waiting for ${si_lock} on same thread`);
			}
			else {
				throw e_acquire;
			}
		}

		if(b_debug) console.log(`${si_log} CONTINUING`);

		// read lock status
		const sx_owner = await session_storage_get(si_lock);

		// busy; wait for owner to release
		if(sx_owner) {
			if(b_debug) console.warn(`${si_log} is still locked on some frame...`);

			// parse owner
			const [si_frame, si_moment] = sx_owner.split(':');

			// frame is local
			if(SI_FRAME_LOCAL === si_frame) {
				// wait for release
				await new Promise((fk_resolve) => {
					// prep timeout id
					let i_timeout = 0;

					// add resolve callback to list
					(h_release_waiters_local[si_key] = h_release_waiters_local[si_key] || []).push(() => {
						// cancel timeout
						clearTimeout(i_timeout);

						// resolve promise
						fk_resolve(void 0);
					});

					// timeout
					i_timeout = globalThis.setTimeout(() => {
						syserr({
							title: 'I/O Error',
							text: `Local lock on '${si_key}' lasted more than 5 seconds; possible disk error or bug in implementation.`,
						});
					}, 5e3);
				});
			}
			// owner is remote
			else {
				console.warn(`'${si_key}' store is currently locked on a remote frame: ${sx_owner}; waiting for release`);

				// attempt to wait
				try {
					await global_wait('releaseStore', g_release => si_key === g_release.key, 5000);
				}
				// timeout error; user likely interupted before lock was released; forcefully remove the lock and continue
				catch(e_timeout) {
					syswarn({
						text: 'Recovered from previous interrupted shutdown.',
					});

					await session_storage_remove(`lock_${si_key}`);
				}

				console.warn(`'${si_key}' store was released`);
			}
		}
		else {
			if(b_debug) console.log(`${si_log} NO OWNERS`);
		}

		// create self id
		const si_self = SI_FRAME_LOCAL+':'+crypto.randomUUID().slice(24);

		if(b_debug) console.log(`${si_log} attempting to acquire exclusive lock`);

		// acquire lock
		await session_storage_set_isomorphic({[si_lock]:si_self});

		// verify ownership
		const si_verify = await session_storage_get(si_lock);

		// failed to acquire exclusive lock
		if(si_self !== si_verify) {
			if(b_debug) console.warn(`${si_log} FAILED TO ACQUIRE EXCLUSIVE ${si_verify} !== ${si_self}`);

			// exceeded retry limit
			if(c_attempts > 10) {
				throw new Error(`Exceeded maximum retry count while trying to checkout "${si_key}" from the vault`);
			}

			// retry
			return await Vault.acquire(si_key, c_attempts+1);
		}
		else {
			if(b_debug) console.log(`${si_log} acquired ${si_verify} === ${si_self}`);
		}

		// broadcast global
		global_broadcast({
			type: 'acquireStore',
			value: {
				key: si_key,
			},
		});

		// read entry ciphertext
		const sx_entry = await storage_get<string>(si_key);

		// create instance
		return new WritableVaultEntry(si_key, sx_entry ?? '', f_release);
	},
};


function VaultEntry$_fields(kv_this: VaultEntry<StoreKey>): VaultFields {
	// lookup private fields
	const g_privates = hm_privates.get(kv_this);

	// store is not loaded
	if(!g_privates) {
		throw new Error(`Attempted to use '${kv_this._si_key}' store after it was released or it was never opened for writing.`);
	}

	return g_privates;
}


export class VaultEntry<
	si_key extends StoreKey=StoreKey,
	w_entry extends Store[si_key]=Store[si_key],
> {
	/**
	 * Not for public use. Instead, use static method {@linkcode Vault.acquire}
	 */
	constructor(public _si_key: si_key, sx_store: string) {
		hm_privates.set(this, {
			atu8_ciphertext: string8_to_buffer(sx_store),
			// atu8_ciphertext: base93_to_buffer(sx_store),
		});
	}


	/**
	 * Reads raw byte stream from decrypted storage entry
	 */
	async read(dk_cipher: CryptoKey): Promise<Uint8Array> {
		// load decryption vector
		const atu8_vector = restore_as_buffer(await session_storage_get('vector'));
		if(!atu8_vector) {
			throw new NotAuthenticatedError();
		}

		// ref private field struct
		const g_privates = VaultEntry$_fields(this);

		// // prederive next encryption key
		// await Vault$_prederive(this, dk_phrase);

		// nothing to decrypt; return blank data
		if(!g_privates.atu8_ciphertext.byteLength) {
			return new Uint8Array(0);
		}

		// // only
		// if(this._b_unlocked) throw new Error('Attempted to unlock persistence but is already unlocked');

		// // acquire decryption key
		// const dk_aes_read = await Vault$_rotate(this, dk_phrase);


		// decrypt
		const atu8_decrypted = await decrypt(g_privates.atu8_ciphertext, dk_cipher, atu8_vector);

		// TODO: REMOVE (temporary migration for beta participants)
		if(0 !== atu8_decrypted[0]) {
			return atu8_decrypted;
		}

		// decode
		const dv_decrypted = new DataView(atu8_decrypted.buffer);
		const nb_data = dv_decrypted.getUint32(0);
		return atu8_decrypted.subarray(4, nb_data+4);
	}


	/**
	 * Reads decrypted storage entry as JSON
	 */
	async readJson(dk_cipher: CryptoKey): Promise<null | w_entry> {
		// read
		let h_store: JsonObject = {};
		try {
			// decrypt
			const atu8_store = await this.read(dk_cipher);

			// empty
			if(!atu8_store.byteLength) return null;

			// deserialize
			h_store = JSON.parse(buffer_to_text(atu8_store));

			// zero out
			zero_out(atu8_store);
		}
		// read error
		catch(e_read) {
			// attempt to release store
			try {
				if(this instanceof WritableVaultEntry) {
					void this.release();
				}
			}
			catch(e_ignore) {}

			// throw
			throw e_read;
		}

		// return deserialized object
		return h_store as w_entry;
	}
}


export class WritableVaultEntry<
	si_key extends StoreKey=StoreKey,
	w_entry extends Store[si_key]=Store[si_key],
> extends VaultEntry<si_key, w_entry> {
	constructor(si_key: si_key, sx_store: string, private readonly _f_release=F_NOOP) {
		super(si_key, sx_store);
	}

	/**
	 * Destroy's this instance and returns the store's key to the registry.
	 */
	async release(): Promise<void> {
		// assert that store is loaded
		VaultEntry$_fields(this);

		// neuter private fields
		hm_privates.delete(this);

// console.warn(`Releasing lock on store '${this._si_key}': ${localStorage.getItem(`chrome.session:lock_${this._si_key}`)!}`);

		// remove lock
		await session_storage_remove(`lock_${this._si_key}` as const);

		// local notify
		if(this._si_key in h_release_waiters_local) {
			for(const f_notify of h_release_waiters_local[this._si_key]) {
				f_notify();
			}
		}

		// local lock release
		this._f_release();

		// broadcast lock removal
		global_broadcast({
			type: 'releaseStore',
			value: {
				key: this._si_key,
			},
		});
	}


	/**
	 * Save the given data to the underlying storage.
	 */
	async write(atu8_data: Uint8Array, dk_cipher: CryptoKey, b_init=false): Promise<void> {
		// ref private fields
		const g_privates = VaultEntry$_fields(this);

		// load encryption vector
		const atu8_vector = restore_as_buffer(await session_storage_get('vector'));
		if(!atu8_vector) {
			throw new NotAuthenticatedError();
		}

		// pad and encode the input data
		const nb_data = atu8_data.byteLength;
		const nb_padded = (Math.ceil((nb_data + 4) / NB_PADDING) * NB_PADDING) - 4;
		const atu8_padding = crypto.getRandomValues(new Uint8Array(nb_padded - nb_data));
		const atu8_padded = concat([new Uint8Array(4), atu8_data, atu8_padding]);
		const dv_padded = new DataView(atu8_padded.buffer);
		dv_padded.setUint32(0, nb_data);

		// encrypt the store
		const atu8_ciphertext = await encrypt(atu8_padded, dk_cipher, atu8_vector);

		// save
		await chrome.storage.local.set({
			[this._si_key]: buffer_to_string8(atu8_ciphertext),
			// [this._si_key]: buffer_to_base93(atu8_ciphertext),
		});

		// zero out previous data in memory
		zero_out(g_privates.atu8_ciphertext);

		// reload cache
		g_privates.atu8_ciphertext = atu8_ciphertext;

		// broadcast event
		queueMicrotask(() => {
			global_broadcast({
				type: 'updateStore',
				value: {
					key: this._si_key,
					init: b_init,
				},
			});
		});
	}


	/**
	 * Reads decrypted storage entry as JSON
	 */
	async writeJson(w_value: JsonValue, dk_cipher: CryptoKey, b_init=false): Promise<void> {
		// encode stringified json
		const atu8_data = text_to_buffer(JSON.stringify(w_value));

		// write to vault
		return await this.write(atu8_data, dk_cipher, b_init);
	}
}

