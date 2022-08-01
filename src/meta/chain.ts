import type { BalanceBundle } from '#/store/networks';
import type { Dict } from '#/util/belt';
import type { Compute, ComputeRaw } from 'ts-toolbelt/out/Any/Compute';
import type { Type } from 'ts-toolbelt/out/Any/Type';
import type { Concat } from 'ts-toolbelt/out/List/Concat';
import type { Tail } from 'ts-toolbelt/out/List/Tail';
import type { MergeAll } from 'ts-toolbelt/out/Object/MergeAll';
import type { Nameable, Pfpable } from './able';
import type { PfpPath } from './pfp';
import type { Resource } from './resource';
import type { TokenSpecKey } from './token';

/**
 * Represents an address space for a certain type of accounts (e.g., a bech32 extension)
 */
export type Bech32<
	s_hrp extends string=string,
	s_separator extends string=string,
> = {
	hrp: s_hrp;
	separator: s_separator;
};

export namespace Bech32 {
	export type Config = {
		hrp: string;
		separator?: string;
	};

	export type New<
		gc_space extends Config,
	> = Bech32<
		gc_space['hrp'],
		gc_space['separator'] extends string
			? gc_space['separator']
			: '1'
	>;

	export type String<
		g_space extends Bech32=Bech32,
		s_data extends string=string,
	> = `${g_space['hrp']}${g_space['separator']}${s_data}`;
}


/**
 * Represents a chain family and the defaults its chains may inherit.
 */
export type Family<
	h_bech32s extends Dict<Bech32>={},
> = {
	bech32s: h_bech32s;
};

export namespace Family {
	export type Config = {
		bech32s: Dict<Bech32.Config>;
	};

	export type New<
		gc_family extends Config,
	> = gc_family['bech32s'] extends infer h_bech32s
		? h_bech32s extends Config['bech32s']
			? Family<{
				[si_each in keyof h_bech32s]: Bech32.New<h_bech32s[si_each]>;
			}>
			: never
		: never;

	export type Bech32s<
		si_family extends FamilyKey=FamilyKey,
	> = FamilyRegistry[si_family]['bech32s'] extends infer h_bech32s
		? h_bech32s extends Dict<Bech32>
			? h_bech32s
			: never
		: never;

	export type Hrp<
		si_family extends FamilyKey,
		as_keys extends keyof Bech32s<si_family>=keyof Bech32s<si_family>,
	> = Bech32s<si_family>[as_keys]['hrp'];

	export type Segment<
		si_family extends FamilyKey,
	> = `family.${si_family}`;
}


export type FamilyRegistry = {
	cosmos: Family.New<{
		bech32s: {
			acc: {
				hrp: '';
			};
			accpub: {
				hrp: 'pub';
			};
			valoper: {
				hrp: 'valoper';
			};
			valoperpub: {
				hrp: 'valoperpub';
			};
			valcons: {
				hrp: 'valcons';
			};
			valconspub: {
				hrp: 'valconspub';
			};
		};
	}>;
	// ethereum: {
	// 	bech32s: {
	// 		acc: {
	// 			hrp: '';
	// 		};
	// 	};
	// };
};

export type FamilyKey = keyof FamilyRegistry;


export type Bip44<
	n_coin_type extends number=number,
> = {
	coinType: n_coin_type;
};

export namespace Bip44 {
	export type Config = {
		coinType: number;
	};

	export type New<
		gc_bip44 extends Config,
	> = Bip44<
		gc_bip44['coinType']
	>;
}

export type NativeCoin = {
	decimals: number;
	denom: string;
	name: string;
	pfp: PfpPath;
	extra?: Dict;
};

export type Chain<
	si_family extends FamilyKey=FamilyKey,
	si_chain extends string=string,
	h_bech32s extends Record<keyof Family.Bech32s<si_family>, Bech32>=Record<keyof Family.Bech32s<si_family>, Bech32>,  // Family.Bech32s<si_family>,
	g_bip44 extends Bip44=Bip44,
> = Resource.New<{
	segments: [Family.Segment<si_family>, Chain.Segment<si_chain>];
	interface: [{
		family: si_family;
		id: si_chain;
		bech32s: h_bech32s;
		bip44: g_bip44;
		coins: Dict<NativeCoin>;
		tokenInterfaces: TokenSpecKey[];
		testnet?: boolean;
	}, Nameable, Pfpable];
}>;

export type ChainPath = Resource.Path<Chain>;

export namespace Chain {
	export type Config = {
		family: FamilyKey;
		id: string;
		bech32: Bech32.Config | {
			// provide explicit map of bech32s
			// bech32s: Dict<Bech32.Config>;
			bech32s: Record<keyof Family.Bech32s, Bech32.Config>;
		};
		bip44: Bip44.Config;
	};

	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Chain.New<{
	 * 	family: FamilyKey;
	 * 	id: string;
	 * 	bech32: {
	 * 		hrp: string;
	 * 		separator?: string;
	 * 	} | {
	 * 		bech32s: Dict<AddressSpace.Config>;
	 * 	};
	 * 	bip44: {
	 * 		coinType: number;
	 * 	};
	 * }>
	 * ```
	 * 
	 * 
	 */
	export type New<
		gc_chain extends Config,
	> = Chain<
		gc_chain['family'],
		gc_chain['id'],
		gc_chain['bech32'] extends Bech32.Config
			? Family.Bech32s<gc_chain['family']> extends infer h_bech32s
				? h_bech32s extends Dict<Bech32>
					? {
						[si_each in keyof h_bech32s]: Compute<Bech32.New<{
							hrp: `${gc_chain['bech32']['hrp']}${h_bech32s[si_each]['hrp']}`;
							separator: gc_chain extends {separator: string}
								? gc_chain['separator']
								: h_bech32s[si_each]['separator'];
						}>>
					}
					: never
				: never
			: never,
		gc_chain['bip44']
	>;

	export type Bech32String<
		h_bech32s extends Chain['interface']['bech32s']=Chain['interface']['bech32s'],
		as_keys extends keyof h_bech32s=keyof h_bech32s,
		s_data extends string=string,
	> = Compute<{
		[si_each in keyof h_bech32s]: h_bech32s[si_each] extends Bech32
			? `${Bech32.String<h_bech32s[si_each], s_data>}`
			: string;
	}[as_keys]>;

	export type Segment<
		si_chain extends string=string,
	> = `chain.${si_chain}`;

		// : [z_chain] extends [ChainLike]
		// 	? Segment<z_chain['interface']['id']>
		// 	: never;
}


export namespace KnownChain {
	export type SecretNetwork = Chain.New<{
		family: 'cosmos';
		id: 'secret-4';
		bech32: {
			hrp: 'secret';
		};
		bip44: {
			coinType: 529;
		};
	}>;
}


export type AgentOrEntityOrigin = 'user' | 'built-in' | 'domain';
	// data: string;  (for privacy, this should only come from historic records)



/**
 * === _**@starshell/meta**_ ===
 * 
 * ```ts
 * Agent<
 * 	family?: FamilyKey,
 * 	pubkey?: string,
 * >
 * ```
 * 
 * An agent is a cross-chain sender or recipient of transactions (it presumably holds a private key)
 */
export type Agent<
	si_family extends FamilyKey=FamilyKey,
	sa_agent extends string=string,
	si_space extends keyof Family.Bech32s<si_family>=keyof Family.Bech32s<si_family>,
> = Resource.New<{
	segments: [Family.Segment<si_family>, `agent.${sa_agent}`];
	interface: {
		address: sa_agent;

		origin: AgentOrEntityOrigin;
	};
}>;

export type AgentPath = Resource.Path<Agent>;

export namespace Agent {
	export type ProxyFromEntity = Resource.New<{
		extends: Entity;
		segment: 'as.agent';
		interface: {};
	}>;
}


/**
 * === _**@starshell/meta**_ ===
 * 
 * ```ts
 * Entity<
 * 	chain?: Chain,
 * 	spaces?: keyof chain['interfaces']['bech32s'],
 * 	pubkey?: string,
 * >
 * ```
 * 
 * Anything that is addressable on a specific chain
 */
export type Entity<
	g_chain extends Chain=Chain,
	as_spaces extends keyof g_chain['interface']['bech32s']=keyof g_chain['interface']['bech32s'],
	s_pubkey extends string=string,
> = Chain.Bech32String<g_chain['interface']['bech32s'], as_spaces, s_pubkey> extends infer s_addr
	? s_addr extends string
		? Resource.New<{
			segments: Concat<Tail<g_chain['segments']>, [`bech32.${s_addr}`]>;
			interface: {
				bech32: s_addr;

				// where the entity came from
				origin: AgentOrEntityOrigin;
			};
		}>
		: never
	: never;

export type EntityPath = Resource.Path<Entity>;


export type Holding<
	g_chain extends Chain=Chain,
	s_pubkey extends string=string,
	si_coin extends string=string,
> = Resource.New<{
	extends: Entity<g_chain, 'acc', s_pubkey>;

	segments: [`holding.${si_coin}`];

	interface: {
		chain: Resource.Path<g_chain>;
		balance: BalanceBundle;
	};
}>;

export type HoldingPath = Resource.Path<Holding>;

// a contract only exists on one specific chain
export type Contract<
	g_chain extends Chain=Chain,
	s_pubkey extends string=string,
> = Resource.New<{
	extends: Entity<g_chain, 'acc', s_pubkey>;

	segments: ['as.contract'];

	interface: [{
		// which chain the contract exists on
		chain: Resource.Path<g_chain>;

		// code hash
		hash: string;

		// log events associate this contract with sites that have used it
		// ...
	}, Nameable, Pfpable];
}>;


export type ContractPath = Resource.Path<Contract>;
