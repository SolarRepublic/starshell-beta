import {App, AppApiMode, AppInterface, AppPath} from '#/meta/app';
import {Contact, ContactAgentType, ContactInterface, ContactPath} from '#/meta/contact';
import type {Network, NetworkPath} from '#/meta/network';
import type {Pfp, PfpTarget} from '#/meta/pfp';
import type {Store, StoreKey} from '#/meta/store';

import {
	SI_STORE_ACCOUNTS,
	SI_STORE_AGENTS,
	SI_STORE_APPS,
	SI_STORE_APP_POLICIES,
	SI_STORE_CHAINS,
	SI_STORE_ENTITIES,
	SI_STORE_EVENTS,
	SI_STORE_INCIDENTS,
	SI_STORE_HISTORIES,
	SI_STORE_MEDIA,
	SI_STORE_NETWORKS,
	SI_STORE_PFPS,
	SI_STORE_QUERY_CACHE,
	SI_STORE_SECRETS,
	SI_STORE_SETTINGS,
	SI_STORE_TAGS,
	SI_STORE_WEB_APIS,
	SI_STORE_WEB_RESOURCES,
	SI_STORE_CONTRACTS,
} from '#/share/constants';
import type {Dict} from '#/meta/belt';
import {fold, ode, oderac, oderom} from '#/util/belt';
import {buffer_to_base64, sha256_sync_insecure, text_to_buffer} from '#/util/data';
import type { ContractInterface, EntityInterface } from '#/meta/chain';


const type_check = <si_store extends StoreKey>(h_input: Store.Cache<si_store>): typeof h_input => h_input;

const H_MEDIA = __H_MEDIA_BUILTIN;
const H_MEDIA_LOOKUP = __H_MEDIA_LOOKUP;

export const H_STORE_INIT_MEDIA = type_check<typeof SI_STORE_MEDIA>(H_MEDIA);

const cosmos_bech32s = <s_prefix extends string=string>(s_prefix: s_prefix) => ({
	acc: s_prefix,
	accpub: `${s_prefix}pub`,
	valoper: `${s_prefix}valoper`,
	valoperpub: `${s_prefix}valoperpub`,
	valcons: `${s_prefix}valcons`,
	valconspub: `${s_prefix}valconspub`,
}) as const;

export const H_STORE_INIT_PFPS = type_check<typeof SI_STORE_PFPS>(fold<Pfp['interface'], Pfp['interface']>([
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/vendor/logo.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/chain/cosmos-hub.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/chain/secret-network.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/secret-secret.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/other/secret-saturn.png'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/other/supdoggie.png'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/secret-eth-eth.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/secret-usdc-eth.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/secret-doge-bsc.svg'],
		},
	},
], (g_pfp, i_pfp) => ({
	[`/template.pfp/uuid.${i_pfp}`]: g_pfp,
})));

export const H_LOOKUP_PFP: Dict<PfpTarget> = {};
for(const [p_pfp, g_pfp] of ode(H_STORE_INIT_PFPS)) {
	if('plain' === g_pfp.type) {
		const g_media = H_MEDIA[g_pfp.image.default];
		H_LOOKUP_PFP[g_media.data] = p_pfp;
	}
}

export const H_STORE_INIT_CHAINS = type_check<typeof SI_STORE_CHAINS>({
	'/family.cosmos/chain.pulsar-2': {
		name: 'Secret Pulsar',
		pfp: H_LOOKUP_PFP['/media/chain/secret-network.svg'],
		namespace: 'cosmos',
		reference: 'pulsar-2',
		bech32s: cosmos_bech32s('secret'),
		slip44s: [
			{
				coinType: 529,
			},
			{
				coinType: 118,
			},
		],
		coins: {
			SCRT: {
				decimals: 6,
				denom: 'uscrt',
				name: 'Secret',
				pfp: H_LOOKUP_PFP['/media/chain/secret-network.svg'],
				extra: {
					coingecko_id: 'secret',
				},
			},
		},
		features: {
			'secretwasm': {
				consensusIoPubkey: '|dB)LVfX1mgQ<eeI6X*Uxq]/H-KwnPj1dPZ30;iB',
			},
			'ibc-go': {},
			'ibc-transfer': {},
		},
		tokenInterfaces: ['snip-20', 'snip-21', 'snip-721', 'snip-722'],
		blockExplorer: {
			base: 'https://secretnodes.com/{chain_prefix}',
			block: '/blocks/{height}',
			account: '/accounts/{address}',
			contract: '/contracts/{address}',
			validator: '/validators/{address}',
			transaction: '/transactions/{hash}#overview',
		},
		testnet: true,
	},
	'/family.cosmos/chain.theta-testnet-001': {
		name: 'Cosmos Hub Theta',
		pfp: H_LOOKUP_PFP['/media/chain/cosmos-hub.svg'],
		namespace: 'cosmos',
		reference: 'theta-testnet-001',
		bech32s: cosmos_bech32s('cosmos'),
		slip44s: [{
			coinType: 118,
		}],
		coins: {
			ATOM: {
				decimals: 6,
				denom: 'uatom',
				name: 'Cosmos',
				pfp: H_LOOKUP_PFP['/media/chain/cosmos-hub.svg'],
				extra: {
					coingecko_id: 'cosmos-hub',
				},
			},
		},
		features: {
			'ibc-go': {},
			'ibc-transfer': {},
		},
		tokenInterfaces: ['cw-20'],
		blockExplorer: {
			base: 'https://testnet.cosmos.bigdipper.live',
			block: '/blocks/{height}',
			account: '/accounts/{address}',
			contract: '/contracts/{address}',
			validator: '/validators/{address}',
			transaction: '/transactions/{hash}',
		},
		testnet: true,
	},
});

export const H_STORE_INIT_CONTRACTS = type_check<typeof SI_STORE_CONTRACTS>(fold([
	...[
		{
			name: 'Pulsar USDC',
			bech32: 'secret1rzz7q3us7zksy3la7hjup33gvtqxyfljpaya2r',
			pfp: H_LOOKUP_PFP['/media/token/secret-usdc-eth.svg'],
			snip20: {
				symbol: 'pUSDC',
			},
		},
		{
			name: 'Pulsar ETH',
			bech32: 'secret1zkqumk5l9efwlfprxl0zw8fqwxz0d0pvd020pr',
			pfp: H_LOOKUP_PFP['/media/token/secret-eth-eth.svg'],
			snip20: {
				symbol: 'pETH',
			},
		},
		{
			name: 'Pulsar DOGE',
			bech32: 'secret1wsldxtnsrptfj447p0l32eepvdhap4wl6uh6hq',
			pfp: H_LOOKUP_PFP['/media/token/secret-doge-bsc.svg'],
			snip20: {
				symbol: 'pDOGE',
			},
		},
	].map(g => ({
		name: g.name,
		bech32: g.bech32,
		pfp: g.pfp,
		chain: '/family.cosmos/chain.pulsar-2',
		origin: 'built-in',
		interfaces: {
			snip20: {
				viewingKey: '',
				...g.snip20,
			},
		},
		hash: '43eda3a25dfab766c6ad622828b4b780d5d31a77a344163358fffceaa136cfca',
	}) as ContractInterface),
], g_each => ({
	[`${g_each.chain}/bech32.${g_each.bech32}/as.contract`]: g_each,
})));

export const H_STORE_INIT_NETWORKS = type_check<typeof SI_STORE_NETWORKS>(fold([
	{
		name: '𝕊ecret 𝕊aturn',
		pfp: H_LOOKUP_PFP['/media/other/secret-saturn.png'],
		chain: '/family.cosmos/chain.pulsar-2',
		grpcWebUrl: 'https://grpc.testnet.secretsaturn.net',
		rpcHost: 'rpc.testnet.secretsaturn.net',
	},
	{
		name: 'StarShell',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		chain: '/family.cosmos/chain.theta-testnet-001',
		grpcWebUrl: 'https://grpc-web.cosmos-theta.starshell.net',
		rpcHost: 'rpc.cosmos-theta.starshell.net',
	},
], g_each => ({
	[`/network.${buffer_to_base64(sha256_sync_insecure(text_to_buffer(g_each.grpcWebUrl)))}`]: g_each,
	// [Networks.pathFrom(g_each as Network['interface'])]: g_each,
})) as Record<NetworkPath, Network['interface']>);


export const H_STORE_INIT_APPS = type_check<typeof SI_STORE_APPS>(fold([
	// {
	// 	host: 'app.starshell.net',
	// 	name: 'StarShell Web',
	// 	api: AppApiMode.STARSHELL,
	// 	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
	// },
	{
		host: 'faucet.secrettestnet.io',
		name: 'Pulsar-2 Faucet',
	},
	{
		host: 'faucet.pulsar.scrttestnet.com',
		name: 'Pulsar-2 Faucet Alternative',
	},
], g_each => ({
	[`/scheme.${g_each.scheme || 'https'}/host.${g_each.host.replace(/:/g, '+')}`]: {
		scheme: 'https',
		on: 1,
		connections: {},
		pfp: '' as PfpTarget,
		api: AppApiMode.UNKNOWN,
		...g_each,
	},
})) as Record<AppPath, AppInterface>);


export const H_STORE_INIT_AGENTS = type_check<typeof SI_STORE_AGENTS>(fold([
	{
		namespace: 'cosmos',
		chains: ['/family.cosmos/chain.pulsar-2'],
		agentType: ContactAgentType.PERSON,
		addressSpace: 'acc',
		addressData: 'hnfs6m9vnxgylt97cnw665645pwnvqrs',
		origin: 'built-in',
		name: 'supdoggie',
		pfp: H_LOOKUP_PFP['/media/other/supdoggie.png'],
		notes: '',
	} as ContactInterface,
	{
		namespace: 'cosmos',
		chains: ['/family.cosmos/chain.pulsar-2'],
		agentType: ContactAgentType.ROBOT,
		addressSpace: 'acc',
		addressData: '3fqtu0lxsvn8gtlf3mz5kt75spxv93ss',
		origin: 'built-in',
		name: 'faucet.secrettestnet.io',
		pfp: H_LOOKUP_PFP['/media/token/secret-secret.svg'],
		notes: '',
	} as ContactInterface,
	{
		namespace: 'cosmos',
		chains: ['/family.cosmos/chain.pulsar-2'],
		agentType: ContactAgentType.ROBOT,
		addressSpace: 'acc',
		addressData: 'nhq5lntsfucw4fsj4q2rfdd5gwh593w3',
		origin: 'built-in',
		name: 'faucet.pulsar.scrttestnet.com',
		pfp: H_LOOKUP_PFP['/media/token/secret-secret.svg'],
		notes: '',
	} as ContactInterface,
], g_contact => ({
	[`/family.${g_contact.namespace}/agent.${g_contact.addressData}/as.contact`]: g_contact,
})) as Record<ContactPath, Contact['interface']>);

// export const H_STORE_INIT_ENTITIES = type_check<typeof SI_STORE_ENTITIES>(fold([]));


export const H_STORE_INITS: {
	[si_store in StoreKey]: Store[si_store] extends any[]
		? Store.Cache<si_store>
		: Partial<Store.Map<si_store>>;
} = {
	[SI_STORE_APPS]: H_STORE_INIT_APPS,
	[SI_STORE_APP_POLICIES]: {
		hq: [],
		user: [],
	},
	[SI_STORE_ACCOUNTS]: {},
	[SI_STORE_AGENTS]: H_STORE_INIT_AGENTS,
	[SI_STORE_CHAINS]: H_STORE_INIT_CHAINS,
	[SI_STORE_CONTRACTS]: H_STORE_INIT_CONTRACTS,
	[SI_STORE_NETWORKS]: H_STORE_INIT_NETWORKS,
	[SI_STORE_SETTINGS]: {},
	[SI_STORE_MEDIA]: H_STORE_INIT_MEDIA,
	[SI_STORE_PFPS]: H_STORE_INIT_PFPS,
	[SI_STORE_ENTITIES]: {},
	[SI_STORE_EVENTS]: [],
	[SI_STORE_INCIDENTS]: {},
	[SI_STORE_HISTORIES]: {
		order: [],
		syncs: oderom(H_STORE_INIT_CHAINS, p_chain => ({
			[p_chain]: {},
		})),
	},
	[SI_STORE_SECRETS]: {},
	[SI_STORE_TAGS]: {
		registry: oderac({
			pink: '#D500F9',
			hot: '#C51162',
			orange: '#FF4D21',
			gold: '#FF8622',
			yellow: '#EEB521',
			autum: '#7E9E24',
			grass: '#3A6F16',
			teal: '#009688',
			sky: '#1976D2',
			violet: '#6200EA',
			gray: '#607D8B',
			brown: '#795548',
			bright: '#ffffff',
		}, (si_key, s_value, i_entry) => ({
			index: i_entry,
			color: s_value,
			name: si_key,
			info: '',
		})),
		map: {},
	},
	[SI_STORE_QUERY_CACHE]: {},
	[SI_STORE_WEB_RESOURCES]: {},
	[SI_STORE_WEB_APIS]: {},
};
