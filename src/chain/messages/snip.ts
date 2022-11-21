import type {ReviewedMessage} from './_types';
import type {SecretNetwork} from '../secret-network';
import type {Coin} from '@cosmjs/amino';

import type {Promisable, Values} from '#/meta/belt';
import type {Bech32, ChainStruct, ContractPath, ContractStruct} from '#/meta/chain';
import type {Snip20} from '#/schema/snip-20-def';
import {Snip2xToken} from '#/schema/snip-2x-const';

import BigNumber from 'bignumber.js';

import {address_to_name} from './_util';

import type {LoadedAppContext} from '#/app/svelte';
import type {NotifyItemConfig} from '#/extension/notifications';

import {G_APP_STARSHELL} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Providers} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {fodemtv} from '#/util/belt';
import {text_to_buffer, uuid_v4} from '#/util/data';

import {format_amount} from '#/util/format';
import { Coins } from '../coin';


const XT_QUERY_TOKEN_INFO = 10e3;

interface ExecContractMsg {
	msg: string;
	contract: Bech32;
	sent_funds: Coin[];
}

type TokenInfoResponse = Snip20.BaseQueryResponse<'token_info'>;

interface Bundle<si_key extends Snip2x.AnyMessageKey=Snip2x.AnyMessageKey> extends LoadedAppContext {
	h_args: Snip2x.AnyMessageParameters<si_key>[si_key];
	g_exec: ExecContractMsg;
	p_contract: ContractPath;
	g_contract_loaded: ContractStruct | null;
	g_contract_pseudo: ContractStruct;
	g_snip20: NonNullable<ContractStruct['interfaces']['snip20']> | undefined;
	sa_owner: Bech32;
}

type SnipConfigs = {
	[si_each in Snip2x.AnyMessageKey]: (
		g_bundle: Bundle<si_each>
	) => Promisable<{
		apply?(si_txn: string): Promisable<NotifyItemConfig | void>;

		review?(b_pending: boolean): Promisable<ReviewedMessage>;
	} | void>;
};


type SnipHandlers = {
	[si_each in Snip2x.AnyMessageKey]: (
		h_args: Snip2x.AnyMessageParameters<si_each>[si_each],
		g_context: LoadedAppContext,
		g_exec: ExecContractMsg,
	) => Promisable<{
		apply?(si_txn: string): Promisable<NotifyItemConfig | void>;

		review?(b_pending: boolean): Promisable<ReviewedMessage>;
	} | void>;
};

function snip_info(g_contract: ContractStruct, g_chain: ChainStruct): string[] {
	const g_snip20 = g_contract.interfaces.snip20!;

	return [`${g_snip20.symbol} token on ${g_chain.name}`];
}

function wrap_handlers(h_configs: Partial<SnipConfigs>): SnipHandlers {
	return fodemtv(h_configs, (f_action, si_action) => async(
		h_args: Values<Snip2x.AnyMessageParameters>,
		g_context: LoadedAppContext,
		g_exec: ExecContractMsg
	) => {
		const {g_chain, p_chain, p_account, g_account, g_app, p_app} = g_context;

		// ref contract address
		const sa_contract = g_exec.contract;

		// construct contract path
		const p_contract = Contracts.pathFor(p_chain, sa_contract);

		// load contract def
		const g_contract_loaded = await Contracts.at(p_contract);

		// prep psuedo contract struct
		const g_contract_pseudo = g_contract_loaded!;

		// prep snip20 struct
		const g_snip20 = g_contract_loaded?.interfaces?.snip20;

		// TODO: the below code attempts to detect if a contract is a SNIP-20, but this should not happen automatically
		// // contract was not declared to be a SNIP-20
		// if(!g_snip20) {
		// 	let g_response: TokenInfoResponse | undefined;
		// 	let xc_timeout: 0 | 1;

		// 	const k_network = await Providers.activateDefaultFor(g_chain) as SecretNetwork;

		// 	// fetch code hash
		// 	const s_hash = await k_network.codeHashByContractAddress(sa_contract);

		// 	// attempt to query for token info
		// 	try {
		// 		[g_response, xc_timeout] = await timeout_exec(XT_QUERY_TOKEN_INFO, async() => {
		// 			const g_query: Snip20.BaseQueryParameters<'token_info'> = {
		// 				token_info: {},
		// 			};

		// 			return await k_network.queryContract<TokenInfoResponse>(g_account, {
		// 				bech32: sa_contract,
		// 				hash: s_hash,
		// 			}, g_query);
		// 		});

		// 		if(xc_timeout) {
		// 			return syswarn({
		// 				title: 'Token info query timed out',
		// 				text: `Failed to update internal SNIP-20 viewing key while attempting to query token info from ${sa_contract} because the query took more than ${XT_QUERY_TOKEN_INFO / XT_SECONDS} seconds`,
		// 			});
		// 		}
		// 	}
		// 	catch(e_query) {
		// 		return syswarn({
		// 			title: 'Token info query failed',
		// 			text: `Failed to update internal SNIP-20 viewing key while attempting to query token info from ${sa_contract}: ${e_query.message}`,
		// 		});
		// 	}

		// 	const g_token_info = g_response!.token_info;

		// 	// invalid token info
		// 	if(!Snip20Util.validate_token_info(g_token_info)) {
		// 		return;
		// 	}

		// 	g_snip20 = {
		// 		decimals: g_token_info.decimals as L.UnionOf<N.Range<0, 18>>,
		// 		symbol: g_token_info.symbol,
		// 	};

		// 	g_contract_pseudo = {
		// 		bech32: sa_contract,
		// 		chain: p_chain,
		// 		hash: s_hash,
		// 		interfaces: {
		// 			snip20: g_snip20,
		// 		},
		// 		name: g_token_info.name,
		// 		origin: 'domain',
		// 		pfp: g_app.pfp,
		// 	};
		// }

		return await f_action({
			h_args: h_args as Bundle['h_args'],
			p_app,
			g_app,
			p_chain,
			g_chain,
			p_account,
			g_account,
			p_contract,
			g_contract_loaded,
			g_contract_pseudo,
			g_snip20,
			g_exec,
			sa_owner: Chains.addressFor(g_account.pubkey, g_chain),
		});
	}) as SnipHandlers;
}

export const H_SNIP_HANDLERS: Partial<SnipHandlers> = wrap_handlers({
	create_viewing_key(h_args) {
		// TODO: fetch viewing key from contract once tx succeeds

		return {
			apply: () => ({
				title: '🔑 Viewing Key Created',
				message: '',
			}),
		};
	},

	decrease_allowance(h_args) {
		// TODO: implement

		return {
			apply: () => ({
				title: '🔻 Decreased Allowance',
				message: '',
			}),
		};
	},

	increase_allowance(h_args) {
		// TODO: implement

		return {
			apply: () => ({
				title: '🔺 Increased Allowance',
				message: '',
			}),
		};
	},

	set_viewing_key: ({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => ({
		async apply() {
			// contract exists
			if(g_contract_loaded) {
				// contract has snip-20 interface
				if(g_snip20) {
					// previous viewing key exists
					const a_viewing_key = await Snip2xToken.viewingKeyFor(g_contract_loaded, g_chain, g_account);
					if(a_viewing_key) {
						// delete old viewing key
						await Secrets.deleteByStruct(a_viewing_key[1]);
					}
				}
				// contract does not have snip-20 interface, exit
				else {
					return;
				}
			}
			// contract does not yet exist
			else {
				// create contract def from token info response
				[p_contract, g_contract_loaded] = await Contracts.merge(g_contract_pseudo);
			}

			// save new viewing key
			const p_viewing_key_new = await Secrets.put(text_to_buffer(h_args.key), {
				type: 'viewing_key',
				uuid: uuid_v4(),
				security: {
					type: 'none' as const,
				},
				name: `Viewing Key for ${g_snip20!.symbol}`,
				chain: p_chain,
				owner: Chains.addressFor(g_account.pubkey, g_chain),
				contract: g_contract_loaded.bech32,
				outlets: g_app === G_APP_STARSHELL? []: [p_app],
			});

			// update contract's viewing key path
			await Contracts.merge({
				...g_contract_loaded,
				interfaces: {
					...g_contract_loaded.interfaces,
					snip20: {
						...g_snip20,
						viewingKey: p_viewing_key_new,
					},
				},
			} as ContractStruct);

			// notification summary
			return {
				group: nl => `Viewing Key${1 === nl? '': 's'} Updated`,
				title: '🔑 Viewing Key Updated',
				message: `${g_contract_loaded.name} token (${g_snip20!.symbol}) has been updated on ${g_chain.name}`,
			};
		},

		review(b_pending) {
			return {
				title: `Updat${b_pending? 'ing': 'ed'} Viewing Key`,
				infos: snip_info(g_contract_pseudo, g_chain),
				fields: [
					{
						type: 'password',
						value: h_args.key,
						label: 'Viewing Key',
					},
				],
				resource: g_contract_pseudo,
			};
		},
	}),

	mint: ({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => {
		// attempt to parse the amount
		const xg_amount = BigNumber(h_args.amount).shiftedBy(-g_snip20!.decimals);

		const s_payload = `${format_amount(xg_amount.toNumber())} ${g_snip20!.symbol}`;

		return {
			apply() {
				// notification summary
				return {
					group: nl => `Token${1 === nl? '': 's'} Minted`,
					title: `🪙 Token Minted`,
					message: `Minted ${s_payload} on ${g_chain.name}`,
				};
			},

			review(b_pending) {
				return {
					title: `Mint${b_pending? 'ing': 'ed'} Token`,
					infos: snip_info(g_contract_pseudo, g_chain),
					fields: [
						{
							type: 'key_value',
							key: 'Amount',
							value: s_payload,
						},
					],
					resource: g_contract_pseudo,
				};
			},
		};
	},

	transfer: async({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => {
		// attempt to parse the amount
		const xg_amount = BigNumber(h_args.amount).shiftedBy(-g_snip20!.decimals);

		const s_payload = `${format_amount(xg_amount.toNumber())} ${g_snip20!.symbol}`;

		const s_recipient = await address_to_name(h_args.recipient, g_chain);

		return {
			apply() {
				// notification summary
				return {
					group: nl => `Token${1 === nl? '': 's'} Sent`,
					title: `✅ Sent Tokens`,
					message: `Transferred ${s_payload} to ${s_recipient} on ${g_chain.name}`,
				};
			},

			review(b_pending) {
				return {
					title: `Transferr${b_pending? 'ing': 'ed'} ${s_payload}`,
					infos: snip_info(g_contract_pseudo, g_chain),
					fields: [
						{
							type: 'key_value',
							key: 'Amount',
							value: s_payload,
						},
						{
							type: 'contacts',
							bech32s: [h_args.recipient],
							label: 'Recipient',
							g_chain,
						},
					],
					resource: g_contract_pseudo,
				};
			},
		};
	},

	revoke_permit: async({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract_pseudo,
		g_exec,
	}) => {
		const sa_contract = g_exec.contract;

		// load permit metadata
		const g_secret = (await Secrets.filter({
			type: 'query_permit',
			chain: p_chain,
			owner: Chains.addressFor(g_account.pubkey, g_chain),
			name: h_args.permit_name,
			contracts: [sa_contract],
		}))![0];

		// const g_outlet = await Apps.at(g_secret.outlets[0]);

		return {
			async apply(si_txn) {
				// update query permit secret
				g_secret.contracts[sa_contract] = si_txn;
				await Secrets.update(g_secret);

				// notification summary
				return {
					group: nl => `Permit${1 === nl? '': 's'} Revoked`,
					title: `🙅 Permit Revoked`,
					message: `Apps will no longer be able to use this permit to view your private data.`,
				};
			},

			review(b_pending) {
				return {
					title: `Revok${b_pending? 'ing': 'ed'} Permit`,
					infos: [
						`on ${g_contract_loaded?.name || 'Unknown Contract'}`,
					],
					fields: [
						{
							type: 'query_permit',
							secret: Secrets.pathFrom(g_secret),
						},
					],
					resource: {
						name: g_secret.name,
						pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
					},
				};
			},
		};
	},

	deposit: async({
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => {
		const sa_contract = g_exec.contract;

		const a_sent = g_exec.sent_funds;

		const s_coins = Array.from(new Set(a_sent.map(g => Chains.coinFromDenom(g.denom, g_chain)))).join(' & ');
		const a_spends = a_sent.map(g => Chains.summarizeAmount(g, g_chain));
		const s_sent = a_spends.join(' + ');
		const s_symbol = g_snip20!.symbol;
		const k_network = await Providers.activateDefaultFor(g_chain);
		const k_token = Snip2xToken.from(g_contract_pseudo, k_network as SecretNetwork, g_account);
		const {
			exchange_rate: g_rate,
		} = await k_token!.exchangeRate();

		const a_tokens = a_sent.map((g_sent) => {
			const [si_coin, g_coin] = Coins.infoFromDenom(g_sent.denom, g_chain)!;
			if(si_coin === g_rate.denom) {
				return BigNumber(g_sent.amount).shiftedBy(-g_coin.decimals).div(g_rate.rate).toString()+' '+s_symbol;
			}
			else {
				return `(${si_coin || '∅'}≠${g_rate.denom})`;
			}
		});

		const s_tokens = a_tokens.join(' + ');

		return {
			apply() {
				return {
					group: nl => `Asset${1 === nl? '': 's'} Wrapped`,
					title: `🥷 Wrapped ${s_sent}`,
					message: `by converting it into ${s_tokens}.`,
				};
			},

			review(b_pending) {
				return {
					title: `Wrapp${b_pending? 'ing': 'ed'} ${s_sent}`,
					infos: [
						`on ${g_contract_loaded?.name || 'Unknown Contract'}`,
					],
					fields: [],
					resource: {
						name: s_coins,
						pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
					},
				};
			},
		};
	},

	redeem: async({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => {
		const k_network = await Providers.activateDefaultFor(g_chain);
		const k_token = Snip2xToken.from(g_contract_pseudo, k_network as SecretNetwork, g_account);
		const {
			exchange_rate: g_rate,
		} = await k_token!.exchangeRate();

		const yg_amount = BigNumber(h_args.amount).shiftedBy(-g_contract_pseudo.interfaces.snip20!.decimals);

		const s_tokens = yg_amount.toString()+' '+g_snip20!.symbol;

		const si_coin = g_rate.denom;
		const s_coin_amount = yg_amount.times(g_rate.rate).toString();
		const s_coins = `${s_coin_amount} ${si_coin}`;

		return {
			affects: () => true,

			apply() {
				return {
					group: nl => `Asset${1 === nl? '': 's'} Wrapped`,
					title: `🎁 Unwrapped ${s_tokens}`,
					message: `by converting it back to ${si_coin}.`,
				};
			},

			review(b_pending, b_incoming) {
				if(b_incoming) {
					return {
						title: `Contract sent ${s_coins}`,
						infos: [
							`from ${g_contract_loaded?.name || 'Unknown Contract'}`,
						],
						fields: [
							{
								type: 'key_value',
								key: 'Amount',
								value: `${s_coins}`,
							},
						],
						resource: {
							name: s_coins,
							pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
						},
					};
				}
				else {
					return {
						title: `Unwrapp${b_pending? 'ing': 'ed'} ${s_tokens}`,
						infos: [
							`on ${g_contract_loaded?.name || 'Unknown Contract'}`,
						],
						fields: [
							{
								type: 'key_value',
								key: 'Amount',
								value: `${s_tokens} → ${s_coins}`,
							},
						],
						resource: {
							name: s_coins,
							pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
						},
					};
				}
			},
		};
	},
});

