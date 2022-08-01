import type { App, AppPath } from '#/meta/app';
import { Contact, ContactAgentType, ContactPath } from '#/meta/contact';
import type { Network, NetworkPath } from '#/meta/network';
import type { Pfp, PfpPath } from '#/meta/pfp';
import type { Store, StoreKey } from '#/meta/store';

import {
	SI_STORE_ACCOUNTS,
	SI_STORE_AGENTS,
	SI_STORE_APPS,
	SI_STORE_APP_POLICIES,
	SI_STORE_CHAINS,
	SI_STORE_ENTITIES,
	SI_STORE_EVENTS,
	SI_STORE_MEDIA,
	SI_STORE_NETWORKS,
	SI_STORE_PFPS,
	SI_STORE_QUERY_CACHE,
	SI_STORE_SECRETS,
	SI_STORE_SETTINGS,
	SI_STORE_TAGS,
	SI_STORE_WEB_APIS,
	SI_STORE_WEB_RESOURCES,
} from '#/share/constants';
import { Dict, fold, ode, oderac } from '#/util/belt';
import { buffer_to_base64, sha256_sync, sha256_sync_insecure, text_to_buffer } from '#/util/data';


const type_check = <si_store extends StoreKey>(h_input: Store.Cache<si_store>): typeof h_input => h_input;

const H_MEDIA = __H_MEDIA_BUILTIN;
const H_MEDIA_LOOKUP = __H_MEDIA_LOOKUP;

export const H_STORE_INIT_MEDIA = type_check<typeof SI_STORE_MEDIA>(H_MEDIA);

const cosmos_bech32s = <s_prefix extends string=string>(s_prefix: s_prefix) => ({
	acc: {
		hrp: s_prefix,
		separator: '1',
	},
	accpub: {
		hrp: `${s_prefix}pub`,
		separator: '1',
	},
	valoper: {
		hrp: `${s_prefix}valoper`,
		separator: '1',
	},
	valoperpub: {
		hrp: `${s_prefix}valoperpub`,
		separator: '1',
	},
	valcons: {
		hrp: `${s_prefix}valcons`,
		separator: '1',
	},
	valconspub: {
		hrp: `${s_prefix}valconspub`,
		separator: '1',
	},
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
], (g_pfp, i_pfp) => ({
	[`/template.pfp/id.${i_pfp}`]: g_pfp,
})));

const H_LOOKUP_PFP: Dict<PfpPath> = {};
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
		family: 'cosmos',
		id: 'pulsar-2',
		bech32s: cosmos_bech32s('secret'),
		bip44: {
			coinType: 529,
		},
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
		tokenInterfaces: ['snip-20', 'snip-21', 'snip-721', 'snip-722'],
		testnet: true,
	},
	'/family.cosmos/chain.theta-testnet-001': {
		name: 'Cosmos Hub Theta',
		pfp: H_LOOKUP_PFP['/media/chain/cosmos-hub.svg'],
		family: 'cosmos',
		id: 'theta-testnet-001',
		bech32s: cosmos_bech32s('cosmos'),
		bip44: {
			coinType: 118,
		},
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
		tokenInterfaces: ['cw-20'],
		testnet: true,
	},
});

export const H_STORE_INIT_NETWORKS = type_check<typeof SI_STORE_NETWORKS>(fold([
	{
		name: '𝕊ecret 𝕊aturn',
		pfp: H_LOOKUP_PFP['/media/other/secret-saturn.png'],
		chain: '/family.cosmos/chain.pulsar-2',
		grpcWebUrl: 'https://grpc.testnet.secretsaturn.net',
		rpcHost: 'rpc.testnet.secretsaturn.net',
	},
	{
		name: 'Polypore',
		pfp: '' as PfpPath,
		chain: '/family.cosmos/chain.theta-testnet-001',
		// grpcWebUrl: 'https://grpc.sentry-01.theta-testnet.polypore.xyz',
		grpcWebUrl: 'https://cosmos-theta.starshell.net',
		rpcHost: 'rpc.sentry-01.theta-testnet.polypore.xyz',
	},
], g_each => ({
	[`/network.${buffer_to_base64(sha256_sync_insecure(text_to_buffer(g_each.grpcWebUrl)))}`]: g_each,
	// [Networks.pathFrom(g_each as Network['interface'])]: g_each,
})) as Record<NetworkPath, Network['interface']>);


export const H_STORE_INIT_APPS = type_check<typeof SI_STORE_APPS>(fold([
	{
		scheme: 'https',
		host: 'app.starshell.net',
		connections: {},
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
	},
	{
		scheme: 'https',
		host: 'faucet.secrettestnet.io',
		connections: {},
		pfp: '' as PfpPath,
	},
], g_each => ({
	[`/scheme.${g_each.scheme}/host.${g_each.host.replace(/:/g, '+')}`]: g_each,
})) as Record<AppPath, App['interface']>);


export const H_STORE_INIT_AGENTS = type_check<typeof SI_STORE_AGENTS>(fold([
	{
		name: 'supdoggie',
		notes: '',
		agentType: ContactAgentType.PERSON,
		space: 'acc',
		family: 'cosmos',
		chains: {},
		pfp: H_LOOKUP_PFP['/media/other/supdoggie.png'],
		address: '0mtm48ul5mcgjj4hm0a4j3td4l5pt590erl3k9',
		origin: 'built-in',
	} as Contact['interface'],
	{
		name: 'faucet.secrettestnet.io',
		notes: '',
		agentType: ContactAgentType.PERSON,
		space: 'acc',
		family: 'cosmos',
		chains: {},
		pfp: '' as PfpPath,
		address: '3fqtu0lxsvn8gtlf3mz5kt75spxv93ssa6vecf',
		origin: 'built-in',
	} as Contact['interface'],
], (g_contact) => ({
	[`/family.${g_contact.family}/agent.${g_contact.address}/as.contact`]: g_contact,
})) as Record<ContactPath, Contact['interface']>);


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
	[SI_STORE_NETWORKS]: H_STORE_INIT_NETWORKS,
	[SI_STORE_SETTINGS]: {},
	[SI_STORE_MEDIA]: H_STORE_INIT_MEDIA,
	[SI_STORE_PFPS]: H_STORE_INIT_PFPS,
	[SI_STORE_ENTITIES]: {},
	[SI_STORE_EVENTS]: [],
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
