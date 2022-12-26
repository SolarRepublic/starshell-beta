import type {Dict} from '#/meta/belt';
import type {ContractStruct} from '#/meta/chain';

export const F_CONTRACTS_SECRET_WRAPPED = (H_LOOKUP_PFP: Dict): ContractStruct[] => [
	{
		name: 'Wrapped BTC',
		bech32: 'secret1g7jfnxmxkjgqdts9wlmn238mrzxz5r92zwqv4a',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/wbtc.svg'],
		snip20: {
			symbol: 'WBTC',
			decimals: 8,
			extra: {
				coingecko_id: 'bitcoin',
			},
		},
	},

	{
		name: 'Ethereum',
		bech32: 'secret1wuzzjsdhthpvuyeeyhfq2ftsn3mvwf9rxy6ykw',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/eth.svg'],
		snip20: {
			symbol: 'sETH',
			decimals: 18,
			extra: {
				coingecko_id: 'ethereum',
			},
		},
	},
	{
		name: 'Ethereum (BSC)',
		bech32: 'secret1m6a72200733a7jnm76xrznh9cpmt4kf5ql0a6t',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/eth.svg'],
		snip20: {
			symbol: 'sETH(BSC)',
			decimals: 18,
			extra: {
				coingecko_id: 'ethereum',
			},
		},
	},

	{
		name: 'Cardano (BSC)',
		bech32: 'secret1t6228qgqgkwhnsegk84ahljgw2cj7f9xprk9zd',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/ada.svg'],
		snip20: {
			symbol: 'sADA(BSC)',
			decimals: 18,
			extra: {
				coingecko_id: 'cardano',
			},
		},
	},
	{
		name: 'Ethereum (BSC)',
		bech32: 'secret1m6a72200733a7jnm76xrznh9cpmt4kf5ql0a6t',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/eth.svg'],
		snip20: {
			symbol: 'sETH(BSC)',
			decimals: 18,
			extra: {
				coingecko_id: 'ethereum',
			},
		},
	},
	{
		name: 'Ethereum (BSC)',
		bech32: 'secret1m6a72200733a7jnm76xrznh9cpmt4kf5ql0a6t',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/eth.svg'],
		snip20: {
			symbol: 'sETH(BSC)',
			decimals: 18,
			extra: {
				coingecko_id: 'ethereum',
			},
		},
	},

	{
		name: 'DAI',
		bech32: 'secret1vnjck36ld45apf8u4fedxd5zy7f5l92y3w5qwq',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/dai.svg'],
		snip20: {
			symbol: 'sDAI',
			decimals: 18,
			extra: {
				coingecko_id: 'dai',
			},
		},
	},
	{
		name: 'Tether',
		bech32: 'secret18wpjn83dayu4meu6wnn29khfkwdxs7kyrz9c8f',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/usdt.svg'],
		snip20: {
			symbol: 'sUSDT',
			decimals: 6,
			extra: {
				coingecko_id: 'tether',
			},
		},
	},
	{
		name: 'Tether (BSC)',
		bech32: 'secret16euwqyntvsp0fp2rstmggw77w5xgz2z26cpwxj',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/usdt.svg'],
		snip20: {
			symbol: 'sUSDT(BSC)',
			decimals: 6,
			extra: {
				coingecko_id: 'tether',
			},
		},
	},
	{
		name: 'USD Coin',
		bech32: 'secret1h6z05y90gwm4sqxzhz4pkyp36cna9xtp7q0urv',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/usdc.svg'],
		snip20: {
			symbol: 'sUSDC',
			decimals: 6,
			extra: {
				coingecko_id: 'usd-coin',
			},
		},
	},
	{
		name: 'USD Coin (BSC)',
		bech32: 'secret1kf45vm4mg5004pgajuplcmkrzvsyp2qtvlklyg',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/usdc.svg'],
		snip20: {
			symbol: 'sUSDC(BSC)',
			decimals: 6,
			extra: {
				coingecko_id: 'usd-coin',
			},
		},
	},
	{
		name: 'TrueUSD',
		bech32: 'secret1ryh523y4e3233hphrkdslegszqz8syjfpthcpp',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/tusd.svg'],
		snip20: {
			symbol: 'sTUSD',
			decimals: 6,
			extra: {
				coingecko_id: 'true-usd',
			},
		},
	},
	{
		name: 'Binance USD',
		bech32: 'secret1793ctg56epnzjlv7t7mug2tv3s2zylhqssyjwe',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/bnb.svg'],
		snip20: {
			symbol: 'sBUSD',
			decimals: 18,
			extra: {
				coingecko_id: 'binance-usd',
			},
		},
	},
	
	{
		name: 'Aave',
		bech32: 'secret1yxwnyk8htvvq25x2z87yj0r5tqpev452fk6h5h',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/aave.svg'],
		snip20: {
			symbol: 'sAAVE',
			decimals: 18,
			extra: {
				coingecko_id: 'aave',
			},
		},
	},
	{
		name: 'Decentraland',
		bech32: 'secret178t2cp33hrtlthphmt9lpd25qet349mg4kcega',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/mana.svg'],
		snip20: {
			symbol: 'sMANA',
			decimals: 18,
			extra: {
				coingecko_id: 'decentraland',
			},
		},
	},
	{
		name: 'Monero',
		bech32: 'secret19ungtd2c7srftqdwgq0dspwvrw63dhu79qxv88',
		hash: '667A3DBEC9096DE530A5521A83E6090DF0956475BD4ACC8D05F382D4F8FFDD05',
		pfp: H_LOOKUP_PFP['/media/token/xmr.svg'],
		snip20: {
			symbol: 'sXMR',
			decimals: 12,
			extra: {
				coingecko_id: 'monero',
			},
		},
	},
	{
		name: 'Binance Coin',
		bech32: 'secret1tact8rxxrvynk4pwukydnle4l0pdmj0sq9j9d5',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/bnb.svg'],
		snip20: {
			symbol: 'sBNB',
			decimals: 18,
			extra: {
				coingecko_id: 'binancecoin',
			},
		},
	},

	{
		name: 'Compound',
		bech32: 'secret1szqzgpl9w42kekla57609y6dq2r39nf0ncx400',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		pfp: H_LOOKUP_PFP['/media/token/comp.svg'],
		snip20: {
			symbol: 'sCOMP',
			decimals: 18,
			extra: {
				coingecko_id: 'compound-governance-token',
			},
		},
	},

	{
		name: 'Dogecoin (BSC)',
		bech32: 'secret16nqax7x66z4efpu3y0kssdfnhg93va0h20yjre',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		pfp: H_LOOKUP_PFP['/media/token/doge.svg'],
		snip20: {
			symbol: 'sDOGE(BSC)',
			decimals: 18,
			extra: {
				coingecko_id: 'dogecoin',
			},
		},
	}


	// {
	// 	name: 'Secret Luna',
	// 	bech32: 'secret1ra7avvjh9fhr7dtr3djutugwj59ptctsrakyyw',
	// 	hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
	// 	pfp: H_LOOKUP_PFP['/media/token/luna.svg'],
	// 	snip20: {
	// 		symbol: 'sLUNA',
	// 		decimals: 6,
	// 		extra: {
	// 			coingecko_id: '',
	// 		},
	// 	},
	// },
	// {
	// 	name: 'UST',
	// 	bech32: 'secret129h4vu66y3gry6wzwa24rw0vtqjyn8tujuwtn9',
	// 	hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
	// 	pfp: H_LOOKUP_PFP['/media/token/ust.svg'],
	// 	snip20: {
	// 		symbol: 'sUST',
	// 		decimals: 6,
	// 		extra: {
	// 			coingecko_id: '',
	// 		},
	// 	},
	// },

	// {
	// 	name: 'Staked SCRT Derivative (Shade)',
	// 	bech32: 'secret1k6u0cy4feepm6pehnz804zmwakuwdapm69tuc4',
	// 	hash: 'F6BE719B3C6FEB498D3554CA0398EB6B7E7DB262ACB33F84A8F12106DA6BBB09',
	// 	pfp: H_LOOKUP_PFP['/media/token/tkd-scrt.svg'],
	// 	snip20: {
	// 		symbol: 'stkd-SCRT',
	// 		decimals: 6,
	// 		extra: {
	// 			coingecko_id: '',
	// 		},
	// 	},
	// },
	// {
	// 	name: 'StakeEasy staked SCRT',
	// 	bech32: 'secret16zfat8th6hvzhesj8f6rz3vzd7ll69ys580p2t',
	// 	hash: '91809B72CC6A7B4A62170698630B0B0848334F0403DBA1ABA7AEC94396AF7F95',
	// 	pfp: H_LOOKUP_PFP['/media/token/escrt.svg'],
	// 	snip20: {
	// 		symbol: 'seSCRT',
	// 		decimals: 6,
	// 		extra: {
	// 			coingecko_id: '',
	// 		},
	// 	},
	// },

].map(g => ({
	name: g.name,
	bech32: g.bech32,
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
	hash: g.hash,
}) as ContractStruct);
