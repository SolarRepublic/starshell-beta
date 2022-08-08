import type { CoinGeckoFiat } from "#/store/web-apis";

const D_INTL_USD = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	currencyDisplay: 'symbol',
});

const D_INTL_USD_LT1 = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	currencyDisplay: 'symbol',
	minimumFractionDigits: 2,
	maximumFractionDigits: 5,
});

const A_NUMERIC_GT1 = [
	{
		order: 1e21,
		suffix: 'sept',
		metric: 'yotta',
		m: 'Y',
	},
	{
		order: 1e21,
		suffix: 'sext',
		metric: 'zetta',
		m: 'Z',
	},
	{
		order: 1e18,
		suffix: 'quint',
		metric: 'exa',
		m: 'E',
	},
	{
		order: 1e15,
		suffix: 'quad',
		metric: 'peta',
		m: 'P',
	},
	{
		order: 1e12,
		suffix: 'tril',
		metric: 'terra',
		m: 'T',
	},
	{
		order: 1e9,
		suffix: 'bil',
		metric: 'giga',
		m: 'G',
	},
	{
		order: 1e6,
		suffix: 'mil',
		metric: 'mega',
		m: 'M',
	},
];

const A_NUMERIC_LT1 = [
	{
		order: 1e-24,
		suffix: 'septh',
		metric: 'yocto',
		m: 'y',
	},
	{
		order: 1e-21,
		suffix: 'sexth',
		metric: 'zepto',
		m: 'z',
	},
	{
		order: 1e-18,
		suffix: 'quinth',
		metric: 'atto',
		m: 'a',
	},
	{
		order: 1e-15,
		suffix: 'quadth',
		metric: 'femto',
		m: 'f',
	},
	{
		order: 1e-12,
		suffix: 'trilth',
		metric: 'pico',
		m: 'p',
	},
	{
		order: 1e-9,
		suffix: 'bilth',
		metric: 'nano',
		m: 'n',
	},
	{
		order: 1e-6,
		suffix: 'milth',
		metric: 'mirco',
		m: 'μ',
	},
	{
		order: 1e-3,
		suffix: 'thsth',
		metric: 'milli',
		m: 'm',
	},
];

const D_INTL_AMOUNT_LT1 = new Intl.NumberFormat('en-US', {
	notation: 'standard',
	maximumSignificantDigits: 6,
});

const D_INTL_AMOUNT_GT1 = new Intl.NumberFormat('en-US', {
	notation: 'standard',
	maximumFractionDigits: 3,
});

const D_INTL_AMOUNT_GT1E3 = new Intl.NumberFormat('en-US', {
	notation: 'standard',
	maximumSignificantDigits: 6,
});

const D_INTL_AMOUNT_I1E3 = new Intl.NumberFormat('en-US', {
	notation: 'standard',
	maximumSignificantDigits: 4,
});

export function format_amount(x_amount: number, b_shorter=false): string {
	// if(b_shorter) debugger;

	// zero
	if(0 === x_amount) return '0';

	// left side of deimcal
	if(x_amount >= 1e6) {
		for(const gc_abbr of A_NUMERIC_GT1) {
			if(x_amount >= gc_abbr.order) {
				return (x_amount / gc_abbr.order).toPrecision(3)+' '+gc_abbr.suffix;
			}
		}
	}
	// right side of decimal
	else if(x_amount < 1) {
		for(const gc_abbr of A_NUMERIC_LT1) {
			if(x_amount <= gc_abbr.order) {
				return (x_amount * gc_abbr.order).toPrecision(3)+' '+gc_abbr.metric;
			}
		}

		// less than 1
		return D_INTL_AMOUNT_LT1.format(x_amount);
	}

	// between 1k and 1M
	if(x_amount >= 1e3) {
		// make thousands shorter
		if(b_shorter) {
			return D_INTL_AMOUNT_I1E3.format(x_amount / 1e3)+' k';
		}

		return D_INTL_AMOUNT_GT1E3.format(x_amount);
	}

	// greater than 1
	return D_INTL_AMOUNT_GT1.format(x_amount);
}

export function format_fiat(x_amount: number, si_fiat: CoinGeckoFiat='usd', b_omit_sign=false, n_decimals=2): string {
	const s_formatted = x_amount < 1? D_INTL_USD_LT1.format(x_amount): D_INTL_USD.format(x_amount);

	return b_omit_sign? s_formatted.replace(/^[$]/, ''): s_formatted;
}

// /**
//  * returns the fiat equivalent of the given token amount
//  */
// export function amount_to_fiat(x_amount: number, k_token: Token, b_omit_sign=false): string {
// 	return format_fiat(H_VERSUS_USD[k_token.def.iri].value * x_amount, b_omit_sign);
// }

export function abbreviate_addr(sa_addr: string) {
	return sa_addr.replace(/^(\w+1...).+(.{7})/, '$1[...]$2');
}
