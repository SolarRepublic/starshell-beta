import type {Nameable, Pfpable} from './able';
import type {Bech32, ChainNamespace, ChainNamespaceKey, ChainPath, ContractPath} from './chain';
import type {Resource} from './resource';
import type {SecretPath} from './secret';

import type {Dict} from '#/meta/belt';
import type { Cw } from './cosm-wasm';

export interface UtilityKeyRegistry {
	walletSecurity: {
		children: {
			antiPhishingArt: {};
		};
	};

	secretNetworkKeys: {
		children: {
			snip20ViewingKey: {};
			transactionEncryptionKey: {};
		};
	};
}

export type UtilityKeyType = keyof UtilityKeyRegistry;

export namespace UtilityKey {
	export type Children<
		si_root extends UtilityKeyType,
	> = keyof UtilityKeyRegistry[si_root]['children'] & string;
}

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
		 * The compressed, 33-byte public key as a base64-encoded string
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
		 * Assets belonging to this account
		 */
		assets: Record<ChainPath, {
			/**
			 * Ordered list of fungible tokens this account wants to appear in their balance screen
			 */
			fungibleTokens: Bech32[];

			/**
			 * Arbitrary data associated with the given account-contract pair
			 */
			data: Record<Bech32, {
				/**
				 * Path to the snip20's current viewing key
				 */
				viewingKeyPath?: SecretPath<'viewing_key'>;

				/**
				 * Cache of the allowances 
				 */
				allowances?: Record<Bech32, {
					/**
					 * Approved token amount
					 */
					amount: Cw.Uint128;

					/**
					 * Expiration of the entire allowance
					 */
					expiration: Cw.UnixTime;
				}>;
			}>;
		}>;

		/**
		 * Custom data extensions
		 */
		extra?: Dict<any>;
	}, Nameable, Pfpable];
}>;

export type AccountPath = Resource.Path<Account>;
export type AccountStruct = Account['struct'];


