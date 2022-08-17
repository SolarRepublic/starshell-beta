import type {Chain, NativeCoin} from '#/meta/chain';
import type {Coin} from 'cosmos-grpc/dist/cosmos/base/v1beta1/coin';

import BigNumber from 'bignumber.js';
import {CoinGecko} from '#/store/web-apis';
import { R_TRANSFER_AMOUNT } from '#/share/constants';
import { ode } from '#/util/belt';

export function as_amount(g_balance: Coin, g_coin: NativeCoin): string {
	const s_norm = g_balance.amount.padStart(g_coin.decimals + 2, '0');

	return s_norm.slice(0, -g_coin.decimals).replace(/^0+/, '0')+'.'+s_norm.slice(-g_coin.decimals);

	// // g_coin.decimals
	// return g_balance.amount;
}

export async function to_fiat(g_balance: Coin, g_coin: NativeCoin, si_versus='usd'): Promise<BigNumber> {
	// zero
	if('0' === g_balance.amount) return new BigNumber(0);

	// lookup price
	const si_gecko = g_coin.extra!.coingecko_id;
	const g_versus = await CoinGecko.coinsVersus([si_gecko], si_versus);

	// parse balance and multiply by value
	return new BigNumber(g_balance.amount).shiftedBy(-g_coin.decimals).times(g_versus[si_gecko]);
}


export interface CoinFormats {
	/**
	 * The id of the fiat this coin is versus
	 */
	versus: string;

	/**
	 * The balance of the holding
	 */
	balance: BigNumber;

	/**
	 * The total 
	 */
	fiat: number;

	/**
	 * The worth of exactly 1 coin versus the given fiat
	 */
	worth: number;
}

export async function coin_formats(g_balance: Coin, g_coin: NativeCoin, si_versus='usd'): Promise<CoinFormats> {
	// lookup price
	const si_gecko = g_coin.extra!.coingecko_id;
	const g_versus = await CoinGecko.coinsVersus([si_gecko], si_versus);

	const x_worth = g_versus[si_gecko];

	const yg_balance = new BigNumber(g_balance.amount).shiftedBy(-g_coin.decimals).times(x_worth)

	// parse balance and multiply by value
	return {
		versus: si_versus,
		balance: yg_balance,
		fiat: yg_balance.times(x_worth).toNumber(),
		worth: x_worth,
	};
}


export class CoinParseError extends Error {}
export class DenomNotFoundError extends Error {}

export function parse_coin_amount(s_input: string, g_chain: Chain['interface']): [bigint, string, NativeCoin] {
	// attempt to parse amount
	const m_amount = R_TRANSFER_AMOUNT.exec(s_input);
	if(!m_amount) {
		throw new CoinParseError(`Failed to parse transfer amount "${s_input}"`);
	}
	else {
		// destructure into amount and denom
		const [, s_amount, si_denom] = m_amount;

		// locate coin
		for(const [si_coin_test, g_coin_test] of ode(g_chain.coins)) {
			if(si_denom === g_coin_test.denom) {
				return [
					BigInt(s_amount),
					si_coin_test,
					g_coin_test,
				];
			}
		}

		throw new DenomNotFoundError(`Did not find "${si_denom}" denomination in ${g_chain.name}`);
	}
}
