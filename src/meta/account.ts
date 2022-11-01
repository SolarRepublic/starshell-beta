import type { Dict, JsonObject } from '#/meta/belt';
import type {Nameable, Pfpable} from './able';
import type {ChainPath, ChainNamespace, ChainNamespaceKey} from './chain';
import type {Resource} from './resource';
import type { Secret, SecretPath } from './secret';

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
		family: si_family;

		/**
		 * the compressed, 33-byte public key as a base64-encoded string
		 */
		pubkey: s_pubkey;

		secret: SecretPath<'mnemonic' | 'bip32_node' | 'private_key'>;
		utilityKeys: UtilityKeys;
		extra?: Dict<any>;
	}, Nameable, Pfpable];
}>;

export type AccountPath = Resource.Path<Account>;
export type AccountStruct = Account['struct'];


// export type NamedThingsMap = DataMap<Account | Chain, string>;

// const NamedThings: NamedThingsMap = {
// 	'/family.cosmos/account.0': 'Account Mars',

// };


