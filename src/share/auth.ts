import {
	session_storage_is_native,
	session_storage_set_native,
	session_storage_set_wrapped,
	Vault,
} from '#/crypto/vault';

import { F_NOOP } from '#/util/belt';
import { text_to_buffer } from '#/util/data';
import { global_broadcast } from '#/script/msg-global';
import { PublicStorage } from '#/extension/public-storage';


export class NotAuthenticatedError extends Error {}

export class AlreadyRegisteredError extends Error {}

export class InvalidPassphraseError extends Error {}

export class UnregisteredError extends Error {}

export class RecoverableVaultError extends Error {}

export class CorruptedVaultError extends Error {}


// cache dummy values to estimate time to completion
export const ATU8_DUMMY_PHRASE = text_to_buffer('32-character-long-dummy-password');
export const ATU8_DUMMY_VECTOR = new Uint8Array(crypto.getRandomValues(new Uint8Array(16)));

// minimum password length
export const NL_PASSPHRASE_MINIMUM = 5;

// maximum password length
export const NL_PASSPHRASE_MAXIMUM = 1024;


/**
 * Test the acceptable-ness of a given passphrase
 */
export function acceptable(sh_phrase: string): boolean {
	return 'string' === typeof sh_phrase && sh_phrase.length >= NL_PASSPHRASE_MINIMUM && sh_phrase.length <= NL_PASSPHRASE_MAXIMUM;
}


/**
 * Register new credentials
 */
export async function register(sh_phrase: string, f_update: ((s_state: string) => void)=F_NOOP): Promise<void> {
	f_update('Reading from storage');

	// retrieve root
	const g_root = await Vault.getBase();

	// root is already set
	if(Vault.isValidBase(g_root)) {
		throw new AlreadyRegisteredError();
	}

	// check password requirements
	if(!sh_phrase || !acceptable(sh_phrase)) {
		throw new InvalidPassphraseError();
	}

	// encode passphrase
	const atu8_phrase = text_to_buffer(sh_phrase);

	f_update('Deriving root keys');

	// select uint64 entropy at random
	const atu8_entropy = crypto.getRandomValues(new Uint8Array(8));

	// select initial uint64 nonce at random 
	const dv_random = new DataView(crypto.getRandomValues(new Uint32Array(2)).buffer);
	const xg_nonce_init = dv_random.getBigUint64(0, false);

	// set last seen
	await PublicStorage.markSeen();

	// import base key from passphrase and derive the new root key
	const {
		new: {
			key: dk_root_new,
			nonce: xg_nonce_new,
		},
	} = await Vault.deriveRootKeys(atu8_phrase, atu8_entropy, xg_nonce_init);

	f_update('Generating signature');

	// generate signature
	const atu8_signature = await Vault.generateRootKeySignature(dk_root_new);

	f_update('Saving to storage');

	// save to storage
	await Vault.setParsedBase({
		entropy: atu8_entropy,
		nonce: xg_nonce_new,
		signature: atu8_signature,
	});
}


/**
 * Unlock the vault using the given passphrase
 */
export async function login(sh_phrase: string, b_recover=false, f_update: ((s_state: string) => void)=F_NOOP): Promise<void> {
	f_update('Reading from storage');

	// retrieve root
	const g_root = await Vault.getBase();

	// no root set, need to register
	if(!g_root) {
		throw new UnregisteredError();
	}

	// root is corrupt
	if(!Vault.isValidBase(g_root)) {
		throw new CorruptedVaultError(`Storage is corrupt; root object is missing or partially damaged`);
	}

	// parse root fields
	const {
		entropy: atu8_entropy,
		nonce: xg_nonce_old,
		signature: atu8_signature_old,
		version: n_version,
	} = Vault.parseBase(g_root);

	// incompatible version
	if(n_version < 1) {
		throw new CorruptedVaultError(`Vault reports to be encrypted with an unknown version identifier`);
	}
	// newer version
	else if(n_version > 1) {
		throw new CorruptedVaultError(`Vault reports to be encrypted with a newer version identifier`);
	}

	// empty; reject
	if(!sh_phrase) throw new InvalidPassphraseError();

	// convert to buffer
	const atu8_phrase = text_to_buffer(sh_phrase);

	f_update('Deriving root keys');

	// import base key from passphrase and derive old and new root keys
	const {
		old: {
			key: dk_root_old,
			vector: atu8_vector_old,
		},
		new: {
			key: dk_root_new,
			vector: atu8_vector_new,
			nonce: xg_nonce_new,
		},
		export: kn_root_new,
	} = await Vault.deriveRootKeys(atu8_phrase, atu8_entropy, xg_nonce_old, true);

	// before any failures, zero out key material
	try {
		// invalid old root key
		if(!await Vault.verifyRootKey(dk_root_old, atu8_signature_old)) {
			// new root does not work either; bad passphrase
			if(!await Vault.verifyRootKey(dk_root_new, atu8_signature_old)) {
				throw new InvalidPassphraseError();
			}
			// program was for closed amid recryption
			else if(!b_recover) {
				throw new RecoverableVaultError();
			}
		}

		f_update('Rotating keys');

		// recrypt everything
		await Vault.recryptAll(dk_root_old, atu8_vector_old, dk_root_new, atu8_vector_new);

		f_update('Generating signature');

		// generate new signature
		const atu8_signature_new = await Vault.generateRootKeySignature(dk_root_new);

		f_update('Saving to storage');

		// update root
		await Vault.setParsedBase({
			entropy: atu8_entropy,
			nonce: xg_nonce_new,
			signature: atu8_signature_new,
		});

		// set session
		if(session_storage_is_native) {
			await session_storage_set_native({
				root: dk_root_new,
				vector: atu8_vector_new,
			});
		}
		else {
			await session_storage_set_wrapped({
				root: Array.from(kn_root_new!.data),
				vector: Array.from(atu8_vector_new),
			});
		}

		// wipe root key material
		kn_root_new?.wipe();

		// fire logged in event
		global_broadcast({
			type: 'login',
		});

		f_update('Done');
	}
	// intercept error
	catch(e_thrown) {
		// zero out key material
		kn_root_new?.wipe();

		// rethrow
		throw e_thrown;
	}
}


/**
 * Lock the vault
 */
export async function logout(): Promise<void> {
	await Vault.clearRootKey();
}
