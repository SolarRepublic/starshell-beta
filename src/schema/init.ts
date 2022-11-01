import type {Auto, Coalesce, Default} from '#/meta/belt';
import type {Chain, ChainNamespaceKey} from '#/meta/chain';
import type {Resource} from '#/meta/resource';
import type {JsonObject, JsonValue} from '#/meta/belt';
import type {String} from 'ts-toolbelt';

import type {
	Cast,
	Compute,
	Type,
} from 'ts-toolbelt/out/Any/_api';

import type {
	Append,
	Concat,
	Pop,
	Tail,
} from 'ts-toolbelt/out/List/_api';

import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type {MergeAll} from 'ts-toolbelt/out/Object/MergeAll';
import type {Join} from 'ts-toolbelt/out/String/Join';



namespace Segment {
	export type Bech32<
		g_chain extends Chain=Chain,
		as_spaces extends keyof g_chain['struct']['bech32s']=keyof g_chain['struct']['bech32s'],
	> = `bech32.${Chain.Bech32String<g_chain, as_spaces>}`;
}



type ss = Chain.Bech32String<Chain, keyof ChainStruct['bech32s']> extends infer s_yes? s_yes extends string? s_yes: never: never;
type wtt = Entity<SecretNetwork, 'acc', string>;
type show1 = Contract;

type inspp = Resource.Path<Contract<Chain>>;

type ContractTokenMap = DataMap<Contract, TokenSpecKey[]>;

type Snip20Entry = {

};

type TokenSnip20QueryResultCacheMap = DataMap<Token<TokenSpec.Chains<'snip-20'>, 'snip-20'>, {
	// TODO: implement TokenSpec methods to retrieve query types
	// balance: ; 
}>;


type HoldingEntry = {

};



interface TagEntry extends JsonObject {
	tagId: number;
}

type TagsMap = DataMap<TagEntry>;

type PfpEntry = {
	pfp: string;  // MediaResourceId;
};

type PfpMap = DataMap<PfpEntry>;

type UserDataSet = DataMapSet<[
	TagsMap,
	PfpMap,
]>;


type OtherZ = LinkTree.New<Entity, [
	[Contract, [
		[Token],
	]],
]>;


const test: OtherZ = {
	'/family.cosmos/chain.secret-4/bech32.secret1astuvyw': {
		'as.contract': {
			'token.snip-20': {},
		},
	},
};

const H_RESOURCES = {
	'family.cosmos': {
		'chain.secret-4': {
			'family': 'cosmos',
			'id': '',

			'bech32.secret1astuvywx': {
				'as.contract': {
					'token.snip-20': {

					},
				},
			},
		},
	},
};

const H_STORE: Store = {
	chains: {
		'/family.cosmos/chain.pulsar-2': {
			family: 'cosmos',
			id: 'pulsar-2',
			bech32s: {},
			bip44: {
				coinType: 529,
			},
			name: 'Secret Pulsar',
		},
		'/family.cosmos/chain.secret-4': {
			family: 'cosmos',
			id: 'secret-4',
			bech32s: {},
			bip44: {
				coinType: 529,
			},
			name: 'Secret Network',
		},
	},
	entities: {
		'/family.cosmos/chain.secret-4/bech32.secret1astuvx': {
			'as.contract': {
				'token.snip-20': {},
				'token.snip-721': {},
			},
		},
	},
};
