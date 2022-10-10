import type { JsonValue } from '#/meta/belt';
import type {FieldConfig} from '#/meta/field';
import {format_fiat} from '#/util/format';
import {Coins} from '../coin';
import type {AddCoinsConfig} from './_types';

export const kv = (si_key: string, w_value: string | HTMLElement, ...a_dom: HTMLElement[]): FieldConfig<'key_value'> => ({
	type: 'key_value',
	key: si_key,
	value: w_value,
	after: a_dom,
});

export function add_coins(gc_add_coins: AddCoinsConfig, a_fields: FieldConfig[]=[]): void {
	const {
		g_chain,
		coins: a_coins,
		set: as_coins,
		label: s_label,
		label_prefix: s_prefix,
	} = gc_add_coins;

	// each coin
	for(let i_coin=0, nl_coins=a_coins.length; i_coin<nl_coins; i_coin++) {
		const g_coin = a_coins[i_coin];

		as_coins?.add(Coins.idFromDenom(g_coin.denom, g_chain)!);

		a_fields.push({
			type: 'key_value',
			key: `${s_prefix ?? ''}${s_label ?? 'Amount'}${nl_coins > 1? ` #${i_coin+1}`: ''}`,
			value: Coins.summarizeAmount(g_coin, g_chain),
			subvalue: Coins.displayInfo(g_coin, g_chain).then(g => `=${format_fiat(g.fiat, g.versus)}`),
		});
	}
}

export class AminoJsonError extends Error {
	constructor(sx_json: string) {
		super(`Invalid CosmWasm Amino message, failed to parse JSON: \`${sx_json}\``);
	}
}

export class MalforedMessageError extends Error {
	constructor(s_info: string, z_item: JsonValue) {
		super(`${s_info}: \`${JSON.stringify(z_item)}\``);
	}
}
