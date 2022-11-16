import type {AppStruct, AppPath} from '#/meta/app';
import {AppApiMode} from '#/meta/app';
import type {Dict} from '#/meta/belt';
import type {ContractStruct} from '#/meta/chain';
import type {ContactStruct, ContactPath} from '#/meta/contact';
import {ContactAgentType} from '#/meta/contact';
import type {PfpStruct, PfpTarget} from '#/meta/pfp';
import type {ProviderStruct, ProviderPath} from '#/meta/provider';
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
	SI_STORE_PROVIDERS,
	SI_STORE_PFPS,
	SI_STORE_QUERY_CACHE,
	SI_STORE_SECRETS,
	SI_STORE_SETTINGS,
	SI_STORE_TAGS,
	SI_STORE_WEB_APIS,
	SI_STORE_WEB_RESOURCES,
	SI_STORE_CONTRACTS,
} from '#/share/constants';

import {fodemtv, fold, ode, oderac, oderom} from '#/util/belt';
import {buffer_to_base64, sha256_sync_insecure, text_to_buffer} from '#/util/data';


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

export const H_STORE_INIT_PFPS = type_check<typeof SI_STORE_PFPS>(fold<PfpStruct, PfpStruct>([
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
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/dai.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/secret-bnb-bsc.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/usdt.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/wbtc.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/chain/monero.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/token/busd.svg'],
		},
	},
	{
		type: 'plain',
		image: {
			default: H_MEDIA_LOOKUP['/media/other/trivium.svg'],
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

const S_SNIP20_GAS_LIMIT_LOW = `${150_000n}` as const;
const S_SNIP20_GAS_LIMIT_MORE = `${175_000n}` as const;

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
		gasPrices: {
			default: 0.1,
			steps: [
				0.0125,
				0.1,
				0.25,
			],
		},
		features: {
			'secretwasm': {
				consensusIoPubkey: '|dB)LVfX1mgQ<eeI6X*Uxq]/H-KwnPj1dPZ30;iB',
				gasPadding: {
					stepSize: `${10_000n}`,
				},
				// gasLimits: fodemtv({
				// 	'cosmos-sdk/MsgSend': 13_000n,
				// }, xg => xg+''),
				snip20GasLimits: {
					transfer: `${180_000n}`,
					send: S_SNIP20_GAS_LIMIT_MORE,
					register_receive: S_SNIP20_GAS_LIMIT_LOW,
					create_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					set_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					increase_allowance: S_SNIP20_GAS_LIMIT_LOW,
					decrease_allowance: S_SNIP20_GAS_LIMIT_LOW,
					transfer_from: S_SNIP20_GAS_LIMIT_LOW,
					send_from: S_SNIP20_GAS_LIMIT_MORE,
					mint: S_SNIP20_GAS_LIMIT_LOW,
					set_minters: S_SNIP20_GAS_LIMIT_LOW,
					burn: S_SNIP20_GAS_LIMIT_LOW,
					burn_from: S_SNIP20_GAS_LIMIT_LOW,
					deposit: S_SNIP20_GAS_LIMIT_LOW,  // 150k
					redeem: S_SNIP20_GAS_LIMIT_LOW,
					revoke_permit: S_SNIP20_GAS_LIMIT_LOW,
				},
			},
			'ibc-go': {},
			'ibc-transfer': {},
		},
		fungibleTokenInterfaces: ['snip-20', 'snip-21', 'snip-22', 'snip23', 'snip-24'],
		nonFungibleTokenInterfaces: ['snip-721', 'snip-722'],
		blockExplorer: {
			base: 'https://secretnodes.com/{chain_prefix}',
			block: '/blocks/{height}',
			account: '/accounts/{address}',
			contract: '/contracts/{address}',
			validator: '/validators/{address}',
			transaction: '/transactions/{hash}#overview',
		},
		testnet: {
			faucets: [
				'https://faucet.starshell.net/',
				'https://faucet.pulsar.scrttestnet.com/',
				'https://pulsar.faucet.trivium.network/',
				'https://faucet.secrettestnet.io/',
			],
		},
		providers: [],
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
		gasPrices: {
			default: 0.025,
			steps: [
				0,
				0.025,
				0.04,
			],
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
		testnet: {
			faucets: [
				'https://discord.com/channels/669268347736686612/953697793476821092',
			],
		},
		providers: [],
	},
});

export const H_STORE_INIT_CONTRACTS = type_check<typeof SI_STORE_CONTRACTS>(fold([
	...[
		{
			name: 'Pulsar USD Coin',
			bech32: 'secret1rzz7q3us7zksy3la7hjup33gvtqxyfljpaya2r',
			pfp: H_LOOKUP_PFP['/media/token/secret-usdc-eth.svg'],
			snip20: {
				symbol: 'pUSDC',
				extra: {
					coingecko_id: 'usd-coin',
				},
			},
		},
		{
			name: 'Pulsar Ethereum',
			bech32: 'secret1zkqumk5l9efwlfprxl0zw8fqwxz0d0pvd020pr',
			pfp: H_LOOKUP_PFP['/media/token/secret-eth-eth.svg'],
			snip20: {
				symbol: 'pETH',
				extra: {
					coingecko_id: 'ethereum',
				},
			},
		},
		{
			name: 'Pulsar Tether',
			bech32: 'secret1na2lzyu27zwdkkd5xcdcgnrxawj5pzvm07fa0p',
			pfp: H_LOOKUP_PFP['/media/token/usdt.svg'],
			snip20: {
				symbol: 'pUSDT',
				extra: {
					coingecko_id: 'tether',
				},
			},
		},
		{
			name: 'Pulsar Binance',
			bech32: 'secret1cf8pvts87kp424larws7vqfgd3kpd8vm84e3v4',
			pfp: H_LOOKUP_PFP['/media/token/secret-bnb-bsc.svg'],
			snip20: {
				symbol: 'pBNB',
				extra: {
					coingecko_id: 'binancecoin',
				},
			},
		},
		{
			name: 'Pulsar Binance USD',
			bech32: 'secret18kfwq9d2k9xa7f6e40wutd6a85sjuecwk78hv8',
			pfp: H_LOOKUP_PFP['/media/token/busd.svg'],
			snip20: {
				symbol: 'pBUSD',
				extra: {
					coingecko_id: 'binance-usd',
				},
			},
		},
		{
			name: 'Pulsar Cosmos Hub',
			bech32: 'secret1phueq2prrrc6l0q5ye55csqr7zzrl99dvxqx7a',
			pfp: H_LOOKUP_PFP['/media/chain/cosmos-hub.svg'],
			snip20: {
				symbol: 'pATOM',
				extra: {
					coingecko_id: 'cosmos',
				},
			},
		},
		{
			name: 'Pulsar Dogecoin',
			bech32: 'secret1wsldxtnsrptfj447p0l32eepvdhap4wl6uh6hq',
			pfp: H_LOOKUP_PFP['/media/token/secret-doge-bsc.svg'],
			snip20: {
				symbol: 'pDOGE',
				extra: {
					coingecko_id: 'dogecoin',
				},
			},
		},
		{
			name: 'Pulsar DAI',
			bech32: 'secret1gc9wg4xz97muz6clxflgt69js94g26wqm8eqqh',
			pfp: H_LOOKUP_PFP['/media/token/dai.svg'],
			snip20: {
				symbol: 'pDAI',
				extra: {
					coingecko_id: 'dai',
				},
			},
		},
		{
			name: 'Pulsar Wrapped Bitcoin',
			bech32: 'secret1h0ehf7py5r0ejatvnrpwlnykl5qe9q997u5p4t',
			pfp: H_LOOKUP_PFP['/media/token/wbtc.svg'],
			snip20: {
				symbol: 'pWBTC',
				extra: {
					coingecko_id: 'bitcoin',
				},
			},
		},
		{
			name: 'Pulsar Monero',
			bech32: 'secret1um29h7me55nmwxswkp7p55rzm56vjkzsvrdlg7',
			pfp: H_LOOKUP_PFP['/media/chain/monero.svg'],
			snip20: {
				symbol: 'pXMR',
				extra: {
					coingecko_id: 'monero',
				},
			},
		},
	].map(g => ({
		name: g.name,
		bech32: g.bech32,
		on: 0,
		pfp: g.pfp,
		chain: '/family.cosmos/chain.pulsar-2',
		origin: 'built-in',
		interfaces: {
			snip20: {
				decimals: 6,
				...g.snip20,
			},
			snip21: {},
			snip22: {},
			snip23: {},
			snip24: {},
		},
		hash: '43eda3a25dfab766c6ad622828b4b780d5d31a77a344163358fffceaa136cfca',
	}) as ContractStruct),
], g_each => ({
	[`${g_each.chain}/bech32.${g_each.bech32}/as.contract`]: g_each,
})));

export const H_STORE_INIT_PROVIDERS = type_check<typeof SI_STORE_PROVIDERS>(fold([
	{
		name: 'Trivium',
		pfp: H_LOOKUP_PFP['/media/other/trivium.svg'],
		chain: '/family.cosmos/chain.pulsar-2',
		grpcWebUrl: 'https://pulsar-2.api.trivium.network:9091',
		rpcHost: 'pulsar-2.api.trivium.network:26657',
	},
	{
		name: '𝕊ecret 𝕊aturn',
		pfp: H_LOOKUP_PFP['/media/other/secret-saturn.png'],
		chain: '/family.cosmos/chain.pulsar-2',
		grpcWebUrl: 'https://grpc.testnet.secretsaturn.net',
		rpcHost: 'rpc.testnet.secretsaturn.net',
	},
	{
		name: 'SCRT Testnet Committee',
		pfp: H_LOOKUP_PFP['/media/chain/secret-network.svg'],
		chain: '/family.cosmos/chain.pulsar-2',
		grpcWebUrl: 'https://grpc.pulsar.scrttestnet.com',
		rpcHost: 'rpc.pulsar.scrttestnet.com',
	},
	{
		name: 'Polypore',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		chain: '/family.cosmos/chain.theta-testnet-001',
		grpcWebUrl: 'https://grpc.sentry-01.theta-testnet.polypore.xyz/',
		rpcHost: 'rpc.sentry-01.theta-testnet.polypore.xyz',
	},
	{
		name: 'StarShell',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		chain: '/family.cosmos/chain.theta-testnet-001',
		grpcWebUrl: 'https://grpc-web.tactus-1.cosmos-theta.starshell.net/',
		rpcHost: 'rpc.tactus-1.cosmos-theta.starshell.net',
	},
], g_each => ({
	[`/provider.${buffer_to_base64(sha256_sync_insecure(text_to_buffer(g_each.grpcWebUrl)))}`]: g_each,
	// [Provider.pathFrom(g_each as ProviderStruct)]: g_each,
})) as Record<ProviderPath, ProviderStruct>);


export const H_STORE_INIT_APPS = type_check<typeof SI_STORE_APPS>(fold([
	// {
	// 	host: 'app.starshell.net',
	// 	name: 'StarShell Web',
	// 	api: AppApiMode.STARSHELL,
	// 	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
	// },

	{
		host: 'faucet.starshell.net',
		name: 'StarShell Pulsar-2 Faucet',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
	},
	{
		host: 'faucet.pulsar.scrttestnet.com',
		name: 'Pulsar-2 Faucet',
	},
	{
		host: 'pulsar.faucet.trivium.network',
		name: 'Trivium Pulsar-2 Faucet',
	},
	{
		host: 'faucet.secrettestnet.io',
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
})) as Record<AppPath, AppStruct>);


export const H_STORE_INIT_AGENTS = type_check<typeof SI_STORE_AGENTS>(fold([
	{
		namespace: 'cosmos',
		chains: ['/family.cosmos/chain.pulsar-2'],
		agentType: ContactAgentType.PERSON,
		addressSpace: 'acc',
		addressData: '7zsfp55my52xv0qx2p0ryfull82cr3cm',
		origin: 'built-in',
		name: 'supdoggie',
		pfp: H_LOOKUP_PFP['/media/other/supdoggie.png'],
		notes: '',
	} as ContactStruct,
	{
		namespace: 'cosmos',
		chains: ['/family.cosmos/chain.pulsar-2'],
		agentType: ContactAgentType.ROBOT,
		addressSpace: 'acc',
		addressData: 'x0dh57m99fg2vwg49qxpuadhq4dz3gsv',
		origin: 'built-in',
		name: 'faucet.starshell.net',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		notes: '',
	} as ContactStruct,
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
	} as ContactStruct,
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
	} as ContactStruct,
], g_contact => ({
	[`/family.${g_contact.namespace}/agent.${g_contact.addressData}/as.contact`]: g_contact,
})) as Record<ContactPath, ContactStruct>);

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
	[SI_STORE_PROVIDERS]: H_STORE_INIT_PROVIDERS,
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
		seen: 0,
	},
	[SI_STORE_SECRETS]: {},
	[SI_STORE_TAGS]: {
		registry: oderac({
			// pink: '#D500F9',
			art: '#D500F9',
			hot: '#C51162',
			orange: '#FF4D21',
			// gold: '#FF8622',
			personal: '#FF8622',
			yellow: '#EEB521',
			// autum: '#7E9E24',
			business: '#7E9E24',
			// grass: '#3A6F16',
			trusted: '#3A6F16',
			// teal: '#009688',
			defi: '#009688',
			// sky: '#1976D2',,
			faucet: '#1976D2',
			violet: '#6200EA',
			// gray: '#607D8B',
			stablecoin: '#607D8B',
			// brown: '#795548',
			sellable: '#795548',
			bright: '#ffffff',
		}, (si_key, s_value, i_entry) => ({
			index: i_entry,
			color: s_value,
			name: si_key,
			info: '',
		})),
		map: {
			// faucet accounts
			...oderom(H_STORE_INIT_AGENTS, (p_agent, g_agent) => {
				const g_contact = g_agent as ContactStruct;
				if('robot' === g_contact.agentType) {
					return {
						[p_agent]: [8],
					};
				}
			}),

			// faucet apps
			...oderom(H_STORE_INIT_APPS, p_app => ({
				[p_app]: [8],
			})),

			// stablecoins
			...oderom(H_STORE_INIT_CONTRACTS, (p_contract, g_contract) => {
				if(['pUSDC', 'pUSDT', 'pBUSD', 'pDAI'].includes(g_contract.interfaces.snip20?.symbol)) {
					return {
						[p_contract]: [10],
					};
				}
			}),
		},
	},
	[SI_STORE_QUERY_CACHE]: {},
	[SI_STORE_WEB_RESOURCES]: {},
	[SI_STORE_WEB_APIS]: {},
};
