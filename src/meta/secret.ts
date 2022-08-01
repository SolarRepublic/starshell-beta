import type { JsonObject } from '#/util/belt';
import type { Cast } from 'ts-toolbelt/out/Any/Cast';
import type { Merge } from 'ts-toolbelt/out/Object/Merge';
import type { Nameable } from './able';
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
};

type SecurityType = keyof SecurityTypeRegistry;

namespace Security {
	export type Interface<
		si_type extends SecurityType=SecurityType,
	> = Merge<{
		type: si_type;
	}, SecurityTypeRegistry[si_type] extends {interface: infer h_interface}
		? Cast<h_interface, object>
		: {}
	>;
}


type SecretTypeRegistry = {
	mnemonic: {
		interface: {
			data: string;
			hint: string;  // its presence indicates the user has set a password ontop of this mnemonic
		};
	};
	private_key: {
		interface: {
			data: string;
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
	> = Merge<{
		type: si_type;
		uuid: string;
		security: Security.Interface<si_security>;
	}, SecretTypeRegistry[si_type] extends {interface: infer h_interface}
		? Cast<h_interface, object>
		: {}
	>;
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
	interface: [Secret.Interface, Nameable];
}>;

export type SecretPath = Resource.Path<Secret>;
