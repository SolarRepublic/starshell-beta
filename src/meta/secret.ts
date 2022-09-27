import type { Bip44Path } from '#/crypto/bip44';
import type { Snip24Permission } from '#/schema/snip-24';
import type {Cast} from 'ts-toolbelt/out/Any/Cast';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type {Nameable} from './able';
import type { App, AppPath } from './app';
import type { Bech32, ChainPath, ContractPath } from './chain';
import type { IncidentPath } from './incident';
import type {Resource} from './resource';

type SecurityTypeRegistry = {
	none: {};

	phrase: {
		interface: {
			algo: 'pbkdf2';
			iterations: number;
			salt: string;
			subtype: 'pin' | 'text';
			hint: string;
		};
	};

	webauthn: {
		interface: {
			data: string;
		};
	};

	otp: {
		interface: {
			data: string;
		};
	};
};

type SecurityType = keyof SecurityTypeRegistry;

namespace Security {
	export type Interface<
		si_type extends SecurityType=SecurityType,
	> = {
		[si_each in SecurityType]: Merge<{
			type: si_each;
		}, SecurityTypeRegistry[si_each] extends {interface: infer h_interface}
			? Cast<h_interface, object>
			: {}
		>
	}[si_type];
}


type SecretTypeRegistry = {
	mnemonic: {
		interface: {
			hint: string;  // its presence indicates the user has set a password ontop of this mnemonic
		};
	};

	bip32_node: {
		interface: {
			mnemonic: `/secret.mnemonic/uuid.${string}`;
			bip44: Bip44Path;
		};
	};

	private_key: {
		interface: {};
	};

	viewing_key: {
		interface: {
			contract: ContractPath;
			outlets: AppPath[];  // places that have a copy of the viewing key
		};
	};

	query_permit: {
		interface: {
			/**
			 * The app which initiated the query permit
			 */
			app: AppPath;

			/**
			 * List of outlets that have access to the permit
			 */
			outlets: AppPath[];

			/**
			 * The name of this permit, which identifies it to its involved contracts
			 */
			name: string;

			/**
			 * The chain that this permit exists on
			 */
			chain: ChainPath;

			/**
			 * Contracts and their status (non-empty value indicates the tx hash of the permit being revoked)
			 */
			contracts: Record<Bech32, string>;

			/**
			 * Canonicalized (sorted) list of permissions this permit contains
			 */
			permissions: Snip24Permission[];
		};
	};


	// software: {};
	// shared: {};
	// hardware: {};
};

export type SecretType = keyof SecretTypeRegistry;

namespace Secret {
	export type Interface<
		si_type extends SecretType=SecretType,
		si_security extends SecurityType=SecurityType,
	> = {
		[si_each in SecretType]: Merge<{
			type: si_each;
			uuid: string;
			security: Security.Interface<si_security>;
		}, SecretTypeRegistry[si_each] extends {interface: infer h_interface}
			? Cast<h_interface, object>
			: {}
		>
	}[si_type];
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
	interface: [Secret.Interface<si_type>, Nameable];
}>;

export type SecretPath<
	si_type extends SecretType=SecretType,
> = Resource.Path<Secret<si_type>>;

export type SecretInterface<
	si_type extends SecretType=SecretType,
> = Secret<si_type>['interface'];
