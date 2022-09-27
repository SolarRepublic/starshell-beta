import type {Bech32, ChainInterface, KnownChain} from '#/meta/chain';
import type {JsonObject} from '#/meta/belt';
import type {AdaptedStdSignDoc} from './amino';

export type Snip24Permission =
	| 'allowance'
	| 'balance'
	| 'history'
	| 'owner';

export interface Snip24PermitMsg<
	g_chain extends ChainInterface=ChainInterface,
	si_hrp extends string=g_chain['bech32s']['acc'],
> extends JsonObject {
	type: 'query_permit';
	value: {
		permit_name: string;
		allowed_tokens: Bech32<si_hrp>[];
		permissions: Snip24Permission[];
	};
}

export interface Snip24Tx<
	g_chain extends ChainInterface=ChainInterface,
	si_hrp extends string=g_chain['bech32s']['acc'],
	g_permit_msg extends Snip24PermitMsg<g_chain, si_hrp>=Snip24PermitMsg<g_chain, si_hrp>,
> extends AdaptedStdSignDoc {
	chain_id: g_chain['reference'];
	account_number: '0';
	sequence: '0';
	fee: {
		gas: '1';
		amount: [
			{
				denom: 'uscrt';
				amount: '0';
			},
		];
	};
	msgs: [g_permit_msg];
	memo: '';
}
