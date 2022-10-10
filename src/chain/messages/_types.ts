import type { AppContext } from '#/app/svelte';
import type { Dict, JsonObject, Promisable } from '#/meta/belt';
import type {ChainInterface} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';
import type {PfpTarget} from '#/meta/pfp';
import type {Coin} from '@cosmjs/amino';

export interface InterprettedMessage {
	title: string;
	tooltip?: string;
	fields: FieldConfig[];
	spends?: SpendInfo[];
}

export interface SpendInfo {
	pfp: PfpTarget;
	amounts: string[];
}

export interface AddCoinsConfig {
	g_chain: ChainInterface;
	coins: Coin[];
	label?: string;
	set?: Set<string>;
	label_prefix?: string;
}

export type MessageDict = Dict<(g_msg: JsonObject, g_context: AppContext) => Promisable<InterprettedMessage>>;

