import type {Nameable, Pfpable} from './able';
import type {ChainNamespace, ChainNamespaceKey} from './chain';
import type {Resource} from './resource';
import type {SecretPath} from './secret';

import type {Dict} from '#/meta/belt';

export interface UtilityKeyRegistry {
	secretWasmTx: {};
	snip20ViewingKey: {};
	antiPhishingArt: {};
}

export type UtilityKeyType = keyof UtilityKeyRegistry;

export type UtilityKeys = {
	[si_each in UtilityKeyType]?: SecretPath;
};

export type Account<
	si_family extends ChainNamespaceKey=ChainNamespaceKey,
	s_pubkey extends string=string,
> = Resource.New<{
	segments: [ChainNamespace.Segment<si_family>, `account.${s_pubkey}`];
	struct: [{
		/**
		 * The family of chains that the account seed is compatible with (corresponds to CAIP-2 namespace)
		 */
		family: si_family;

		/**
		 * the compressed, 33-byte public key as a base64-encoded string
		 */
		pubkey: s_pubkey;

		/**
		 * Path to secret responsible for deriving account key(s)
		 */
		secret: SecretPath<'mnemonic' | 'bip32_node' | 'private_key'>;

		/**
		 * Keys dervied from signatures used to generate data for specific purposes
		 */
		utilityKeys: UtilityKeys;

		/**
		 * Custom data extensions
		 */
		extra?: Dict<any>;
	}, Nameable, Pfpable];
}>;

export type AccountPath = Resource.Path<Account>;
export type AccountStruct = Account['struct'];


// export type NamedThingsMap = DataMap<Account | Chain, string>;

// const NamedThings: NamedThingsMap = {
// 	'/family.cosmos/account.0': 'Account Mars',

// };


