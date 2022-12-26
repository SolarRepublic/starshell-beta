import type {Dict} from '#/meta/belt';
import type {ContractStruct} from '#/meta/chain';

export const F_CONTRACTS_SECRET_IBC = (H_LOOKUP_PFP: Dict): ContractStruct[] => [
	{
		name: 'Cosmos Hub',
		bech32: 'secret14mzwd0ps5q277l20ly2q3aetqe3ev4m4260gf4',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/atom.svg'],
		snip20: {
			symbol: 'sATOM',
			extra: {
				coingecko_id: 'cosmos',
			},
		},
	},
	{
		name: 'Crescent',
		bech32: 'secret1tatdlkyznf00m3a7hftw5daaq2nk38ugfphuyr',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/cre.svg'],
		snip20: {
			symbol: 'sCRE',
			extra: {
				coingecko_id: 'crescent-network',
			},
		},
	},
	{
		name: 'Sentinel',
		bech32: 'secret1k8cge73c3nh32d4u0dsd5dgtmk63shtlrfscj5',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/dvpn.png'],
		snip20: {
			symbol: 'sDVPN',
			extra: {
				coingecko_id: 'sentinel',
			},
		},
	},
	{
		name: 'Evmos',
		bech32: 'secret1grg9unv2ue8cf98t50ea45prce7gcrj2n232kq',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		decimals: 18,
		pfp: H_LOOKUP_PFP['/media/token/evmos.svg'],
		snip20: {
			symbol: 'sEVMOS',
			extra: {
				coingecko_id: 'evmos',
			},
		},
	},
	{
		name: 'Gravity Bridge',
		bech32: 'secret1dtghxvrx35nznt8es3fwxrv4qh56tvxv22z79d',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/grav.svg'],
		snip20: {
			symbol: 'sGRAV',
			extra: {
				coingecko_id: 'graviton',
			},
		},
	},
	{
		name: 'Chihuahua',
		bech32: 'secret1ntvxnf5hzhzv8g87wn76ch6yswdujqlgmjh32w',
		hash: '182D7230C396FA8F548220FF88C34CB0291A00046DF9FF2686E407C3B55692E9',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/huahua.svg'],
		snip20: {
			symbol: 'sHUAHUA',
			extra: {
				coingecko_id: 'chihuahua-chain',
			},
		},
	},
	{
		name: 'Injective',
		bech32: 'secret16cwf53um7hgdvepfp3jwdzvwkt5qe2f9vfkuwv',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		decimals: 18,
		pfp: H_LOOKUP_PFP['/media/token/inj.svg'],
		snip20: {
			symbol: 'sINJ',
			extra: {
				coingecko_id: 'injective-protocol',
			},
		},
	},
	{
		name: 'Juno',
		bech32: 'secret1smmc5k24lcn4j2j8f3w0yaeafga6wmzl0qct03',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/juno.svg'],
		snip20: {
			symbol: 'sJUNO',
			extra: {
				coingecko_id: 'juno-network',
			},
		},
	},
	{
		name: 'Kujira',
		bech32: 'secret1gaew7k9tv4hlx2f4wq4ta4utggj4ywpkjysqe8',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/kuji.svg'],
		snip20: {
			symbol: 'sKUJI',
			extra: {
				coingecko_id: 'kujira',
			},
		},
	},
	// {
	// 	name: 'Terra',
	// 	bech32: 'secret1w8d0ntrhrys4yzcfxnwprts7gfg5gfw86ccdpf',
	// 	hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
	// 	decimals: 6,
	// 	pfp: H_LOOKUP_PFP['/media/token/luna.svg'],
	// 	snip20: {
	// 		symbol: 'sLUNA',
	// 		extra: {
	// 			coingecko_id: 'terra-luna-2',
	// 		},
	// 	},
	// },
	{
		name: 'Osmosis',
		bech32: 'secret1zwwealwm0pcl9cul4nt6f38dsy6vzplw8lp3qg',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/osmo.svg'],
		snip20: {
			symbol: 'sOSMO',
			extra: {
				coingecko_id: 'osmosis',
			},
		},
	},
	// {
	// 	name: 'Sifchain',
	// 	bech32: 'secret159p22zvq2wzsdtqhm2plp4wg33srxp2hf0qudc',
	// 	hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
	// 	decimals: 18,
	// 	pfp: H_LOOKUP_PFP['/media/token/rowan.svg'],
	// 	snip20: {
	// 		symbol: 'sROWAN',
	// 		extra: {
	// 			coingecko_id: 'sifchain',
	// 		},
	// 	},
	// },
	{
		name: 'Stargaze',
		bech32: 'secret1x0dqckf2khtxyrjwhlkrx9lwwmz44k24vcv2vv',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/stars.svg'],
		snip20: {
			symbol: 'sSTARS',
			extra: {
				coingecko_id: 'stargaze',
			},
		},
	},
	{
		name: 'Stride',
		bech32: 'secret17gg8xcx04ldqkvkrd7r9w60rdae4ck8aslt9cf',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		decimals: 6,
		pfp: H_LOOKUP_PFP['/media/token/strd.png'],
		snip20: {
			symbol: 'sSTRD',
			extra: {
				coingecko_id: 'stride',
			},
		},
	},
].map(g => ({
	name: g.name,
	bech32: g.bech32,
	hash: g.hash,
	on: 0,
	pfp: g.pfp,
	chain: '/family.cosmos/chain.secret-4',
	origin: 'built-in',
	interfaces: {
		snip20: {
			decimals: g.decimals || 6,
			...g.snip20,
		},
		snip21: {},
		snip22: {},
		snip23: {},
		snip24: {},
	},
}) as ContractStruct);
