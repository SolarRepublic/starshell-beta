import type {O} from 'ts-toolbelt';

import type {AgentOrEntityOrigin, Bech32, ChainNamespaceKey, ChainPath, ContractStruct, ContractPath} from '#/meta/chain';

import type {PfpPath} from '#/meta/pfp';
import type {TokenStructDescriptor, TokenStructKey} from '#/meta/token';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {Chains} from './chains';

import {Pfps} from './pfps';

import {SI_STORE_CONTRACTS} from '#/share/constants';

import {is_dict, ode} from '#/util/belt';


export enum ContractType {
	// contract type has not yet been deduced
	UNKNOWN = 0b000,

	// fungible token
	FUNGIBLE = 0b001,

	// non-fungible token
	NONFUNGIBLE = 0b010,

	// any token
	TOKEN = 0b011,

	// not a token
	OTHER = 0b100,
}

export interface ContractFilterConfig {
	chain?: ChainPath;
	name?: string;
	hash?: string;
	bech32?: string;
	origin?: AgentOrEntityOrigin;
	on?: 0 | 1;
}

export interface TokenFilterConfig extends ContractFilterConfig {
	interfaces?: O.Partial<TokenStructDescriptor, 'deep'>;
}

export const Contracts = create_store_class({
	store: SI_STORE_CONTRACTS,
	extension: 'map',
	class: class ContractsI extends WritableStoreMap<typeof SI_STORE_CONTRACTS> {
		static pathFor(p_chain: ChainPath, sa_contract: Bech32): ContractPath {
			return `${p_chain}/bech32.${sa_contract}/as.contract`;
		}

		static pathOn(si_family: ChainNamespaceKey, si_chain: string, sa_contract: Bech32): ContractPath {
			return ContractsI.pathFor(Chains.pathFor(si_family, si_chain), sa_contract);
		}

		static pathFrom(g_contract: ContractStruct): ContractPath {
			return ContractsI.pathFor(g_contract.chain, g_contract.bech32);
		}

		static async filterTokens(gc_filter: TokenFilterConfig): Promise<ContractStruct[]> {
			return (await Contracts.read()).filterTokens(gc_filter);
		}

		static merge(g_contract: ContractStruct): Promise<[ContractPath, ContractStruct]> {
			return Contracts.open(ks => ks.merge(g_contract));
		}

		filterTokens(gc_filter: TokenFilterConfig): ContractStruct[] {
			// empty filter
			if(!Object.keys(gc_filter)) return Object.values(this._w_cache);

			const a_tokens: ContractStruct[] = [];

			FILTERING_TOKENS:
			for(const [, g_token] of ode(this._w_cache)) {
				// each criterion in filter
				for(const [si_key, z_expected] of ode(gc_filter)) {
					// ref actual value
					const z_actual = g_token[si_key];

					// primitive
					if(['string', 'number', 'boolean'].includes(typeof z_actual)) {
						// one of the filters doesn't match; skip it
						if(g_token[si_key] !== z_expected) continue FILTERING_TOKENS;
					}
					// interfaces
					else if('interfaces' === si_key && is_dict(z_expected)) {
						// each spec in interfaces filter
						for(const si_spec in z_expected) {
							// ref spec config
							const h_spec = z_actual[si_spec];

							// missing from actual; skip
							if(!h_spec) continue FILTERING_TOKENS;

							// each entry in spec dictionary
							for(const [si_config, s_expect] of ode(z_expected[si_spec])) {
								// one of the entries doesn't match; skip it
								if(s_expect !== h_spec[si_config]) continue FILTERING_TOKENS;
							}
						}
					}
				}

				// token passed filter criteria; add it to list
				a_tokens.push(g_token);
			}

			return a_tokens;
		}

		async merge(g_contract: ContractStruct): Promise<[ContractPath, ContractStruct]> {
			const p_contract = ContractsI.pathFrom(g_contract);

			const g_existing = this._w_cache[p_contract];
			if(g_existing) {
				Object.assign(g_existing, g_contract);
			}

			this._w_cache[p_contract] = g_contract;

			await this.save();

			return [p_contract, g_contract];
		}

		override async delete(p_contract: ContractPath): Promise<boolean> {
			const g_contract = this._w_cache[p_contract];

			if(!g_contract) return false;

			await Pfps.delete(g_contract.pfp as PfpPath);

			delete this._w_cache[p_contract];

			await this.save();

			return true;
		}

		// async put(g_contract: ContractStruct): Promise<ContractPath> {
		// 	const p_contract = Contracts.pathFrom(g_contract);

		// 	this._w_cache[p_contract] = g_contract;

		// 	await this.save();

		// 	return p_contract;
		// }
	},
});
