import type {Dict} from '#/meta/belt';
import {Vault} from './vault';
import RuntimeKey from './runtime-key';
import {Secp256k1Key} from './secp256k1';

type KeyDerivationAlgo = 'pbkdf2';

type KeyDerivationExtras = {
	algo: KeyDerivationAlgo;
	iterations: number;
};

enum KeyType {
	Raw = 0,
	Pin = 1,
	Passphrase = 2,
	Shared = 3,
}

interface KeyStruct {
	type: KeyType;
	data: Uint8Array;
	extra: string;
}

interface KeyringStruct {
	secp256k1: Dict<KeyStruct>;
}

const G_KEYRING_NEW: KeyringStruct = {
	secp256k1: {},
};

export class Key {

}

interface KeyringFields {
	struct: KeyringStruct;
}

const hm_privates = new Map<Keyring, KeyringFields>();


export class Keyring {
	static async unlockKeyring(dk_phrase: CryptoKey) {
		const kp_keys = await Vault.acquire('keys');

		const atu8_data = await kp_keys.read(dk_phrase);

		// new keyring
		if(!atu8_data.byteLength) {
			return new Keyring(G_KEYRING_NEW);
		}

		// protobuf
		const y_pbf = new Pbf(atu8_data);

		// read into struct
		const g_keyring = KeyringProtoDef.read(y_pbf);

		// const {
		// 	schema: SI_VERSION_SCHEMA_KEYRING,
		// 	keys: h_keys,
		// } = g_keyring as KeyringStruct;

		const k_ring = new Keyring(g_keyring);
	}

	private constructor(g_keyring: KeyringStruct, fk_ready: VoidFunction) {
		const h_keys = {};

		const a_imports: Promise<ManagedKey<KeyType>>[] = [];

		const a_errors: string[] = [];

		// convert each key into a runtime object
		const h_keys_secp256k1 = g_keyring.secp256k1;

		IMPORTING:
		for(const si_pubkey in h_keys_secp256k1) {
			const g_key = h_keys_secp256k1[si_pubkey];

			switch(g_key.type) {
				// raw key
				case KeyType.Raw: {
					// validate length
					if(32 !== g_key.data.byteLength) {
						a_errors.push(`Refusing to import ${g_key.data.byteLength}-byte secp256k1 private key`);
						continue IMPORTING;
					}

					// create runtime private key
					a_imports.push(RuntimeKey.create(() => g_key.data)
						// wrap in secp instance
						.then(kk_sk => Secp256k1Key.import(kk_sk, true)));

					break;
				}

				// pin/passphrase-protected key
				case KeyType.Pin:
				case KeyType.Passphrase: {
					// parse extras
					const g_extra = JSON.parse(g_key.extra);

					break;
				}
			}
		}

		Promise.all(a_imports).then((a_keys) => {
			fk_ready();
		}, () => {

		});
	}


	delete(atu8_pubkey: Uint8Array): Promise<void> {

	}
}

type KeyFeatures<si_type extends KeyType> = {
	[KeyType.Raw]: {};
	[KeyType.Pin]: KeyDerivationExtras;
	[KeyType.Passphrase]: KeyDerivationExtras;
	[KeyType.Shared]: {};
}[si_type];

export abstract class ManagedKey<si_type extends KeyType> {
	abstract get type(): si_type;
	abstract get name(): string;
	abstract get extra(): KeyFeatures<si_type>;

	abstract rename(s_name: string): Promise<void>;

	abstract delete(): Promise<void>;

	abstract sign(atu8_message: Uint8Array): Promise<Signature>;

	abstract verify(atu8_message: Uint8Array, atu8_signature: Uint8Array): Promise<boolean>;

	abstract exportPublicKey(): Promise<Uint8Array>;
}
