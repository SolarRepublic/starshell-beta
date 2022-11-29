import type {Nameable} from './able';
import type {AppPath} from './app';
import type {Bech32, ChainPath} from './chain';
import type {Resource} from './resource';
import type {Cast} from 'ts-toolbelt/out/Any/Cast';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {Snip24Permission} from '#/schema/snip-24-def';

import type {Bip44Path} from '#/crypto/bip44';

type SecurityTypeRegistry = {
	none: {};

	phrase: {
		struct: {
			algo: 'pbkdf2';
			iterations: number;
			salt: string;
			subtype: 'pin' | 'text';
			hint: string;
		};
	};

	webauthn: {
		struct: {
			data: string;
		};
	};

	otp: {
		struct: {
			data: string;
		};
	};
};

type SecurityType = keyof SecurityTypeRegistry;

namespace Security {
	export type Struct<
		si_type extends SecurityType=SecurityType,
	> = {
		[si_each in SecurityType]: Merge<{
			type: si_each;
		}, SecurityTypeRegistry[si_each] extends {struct: infer h_struct}
			? Cast<h_struct, object>
			: {}
		>
	}[si_type];
}


type SecretTypeRegistry = {
	mnemonic: {
		struct: {
			hint: string;  // its presence indicates the user has set a password ontop of this mnemonic
		};
	};

	bip32_node: {
		struct: {
			mnemonic: `/secret.mnemonic/uuid.${string}`;
			bip44: Bip44Path;
		};
	};

	private_key: {
		struct: {};
	};

	viewing_key: {
		struct: {
			/**
			 * The chain that this viewing key exists on
			 */
			chain: ChainPath;

			/**
			 * The account which the viewing key belongs to
			 */
			owner: Bech32;

			/**
			 * The contract the viewing key is for
			 */
			contract: Bech32;

			/**
			 * List of outlets that have access to the viewing key
			 */
			outlets: AppPath[];  // places that have a copy of the viewing key
		};
	};

	query_permit: {
		struct: {
			/**
			 * The chain that this permit exists on
			 */
			chain: ChainPath;

			/**
			 * The account which the permit belongs to
			 */
			owner: Bech32;

			/**
			 * Contracts and their status (non-empty value indicates the tx hash of the permit being revoked)
			 */
			contracts: Record<Bech32, string>;

			/**
			 * List of outlets that have access to the permit (first app is the initiator)
			 */
			outlets: [AppPath, ...AppPath[]];

			/**
			 * The name of this permit, which identifies it to its involved contracts
			 */
			name: string;

			/**
			 * Canonicalized (sorted) list of permissions this permit contains
			 */
			permissions: Snip24Permission[];

			/**
			 * Custom alias assigned by user to use in place of the permit's name
			 */
			alias?: string;
		};
	};


	// software: {};
	// shared: {};
	// hardware: {};
};

export type SecretType = keyof SecretTypeRegistry;

export namespace Secret {
	export type Struct<
		si_type extends SecretType=SecretType,
		si_security extends SecurityType=SecurityType,
	> = {
		[si_each in SecretType]: Merge<{
			type: si_each;
			uuid: string;
			security: Security.Struct<si_security>;
		}, SecretTypeRegistry[si_each] extends {struct: infer h_struct}
			? Cast<h_struct, object>
			: {}
		>
	}[si_type];

	export type StructFromPath<
		p_secret extends SecretPath<si_type>,
	> = p_secret extends SecretPath<'query_permit'> ? SecretStruct<'query_permit'> : SecretStruct;
}


// interface KeyStruct {
	// 	type: KeySecurity;
	// 	data: Uint8Array;
	// 	extra: string;
// }

// interface KeyringStruct {
// 	secp256k1: Dict<KeyStruct>;
// }

// export interface GenericSecret<
// 	si_type extends SecretType=SecretType,
// > extends JsonObject {
// 	type: si_type;
// }

// interface SoftSeedSecret extends GenericSecret<'soft_seed'> {
// 	data: string;
// 	security: Security.Interface;
// }

// interface SharedSecret extends GenericSecret<'shared'> {
// 	devices: 2 | 3 | 4 | 5;
// 	index: 0 | 1 | 2 | 3 | 4;
// }

type DeviceTypeRegistry = {
	ledger: {};
};

type DeviceType = keyof DeviceTypeRegistry;

// interface HardwareSecret extends GenericSecret<'hardware'> {
// 	device: DeviceType;
// }

// type ManagedSecret = SoftSeedSecret | SharedSecret | HardwareSecret;

export type Secret<
	si_type extends SecretType=SecretType,
> = Resource.New<{
	segments: [`secret.${si_type}`, `uuid.${string}`];
	struct: [Secret.Struct<si_type>, Nameable];
}>;

export type SecretPath<
	si_type extends SecretType=SecretType,
> = Resource.Path<Secret<si_type>>;

export type SecretStruct<
	si_type extends SecretType=SecretType,
> = Secret<si_type>['struct'];
