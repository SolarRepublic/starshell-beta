
import type {AppStruct} from '#/meta/app';
import type {Nilable} from '#/meta/belt';
import type {Bech32, ChainStruct, ContractStruct} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';

import {load_app_profile} from './app';

import {H_STORE_INIT_CONTRACTS} from '#/store/_init';
import type {AppProfile} from '#/store/apps';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {ode} from '#/util/belt';
import { SessionStorage } from '#/extension/session-storage';


/**
 * Produces a of contract struct from the given address, either loading it from storage or creating it from session profile
 */
export async function produce_contract(sa_contract: Bech32, g_chain: ChainStruct, g_app?: Nilable<AppStruct>): Promise<ContractStruct> {
	return (await produce_contracts([sa_contract], g_chain, g_app))[0];
}

/**
 * Produces a list of contract structs from the given addresses, either loading them from storage or creating them from session profile
 */
export async function produce_contracts(a_contracts: Bech32[], g_chain: ChainStruct, g_app?: Nilable<AppStruct>): Promise<ContractStruct[]> {
	// prep list of loaded contracts
	const a_loaded: ContractStruct[] = [];

	// prep app profile
	let g_profile: AppProfile | undefined;

	const ks_contracts = await Contracts.read();

	// each bech32
	for(const sa_contract of a_contracts) {
		// create contract path
		const p_contract = Contracts.pathFor(Chains.pathFrom(g_chain), sa_contract);

		// prep contract struct
		let g_contract!: ContractStruct|null;

		// definition already exists in store; add to list and move on
		g_contract = ks_contracts.at(p_contract);
		if(g_contract) {
			a_loaded.push(g_contract);
			continue;
		}

		// contract is built-in; add to list and move on
		g_contract = H_STORE_INIT_CONTRACTS[p_contract];
		if(g_contract) {
			a_loaded.push(g_contract);
			continue;
		}

		// no app profile loaded
		if(g_app && !g_profile && 'wallet' !== g_app.scheme) {
			// acquire lock on profile
			// eslint-disable-next-line @typescript-eslint/no-loop-func
			await navigator.locks.request('ui:fields:profile', async() => {
				// save profile
				const g_profile_loaded = await load_app_profile(g_app);

				if(!g_profile_loaded) {
					throw new Error(`Missing referenced app profile: ${JSON.stringify(g_app)}`);
				}

				g_profile = g_profile_loaded;
			});
		}

		// find contract def in app profile
		const h_contracts = g_profile?.contracts;
		if(h_contracts) {
			for(const [, g_def] of ode(h_contracts)) {
				if(sa_contract === g_def.bech32) {
					// copy contract def from profile
					g_contract = g_def;

					// find its pfp
					FIND_PFP:
					if(g_app) {
						const sx_pfp_ctx = `${g_app.scheme}://${g_app.host}/${g_chain.namespace}:${g_chain.reference}`

						// search interfaces (caip-19)
						for(const si_interface in g_contract.interfaces) {
							// build full pfp target
							const p_test = `pfp:${sx_pfp_ctx}/${si_interface}:${g_contract.bech32}` as const;

							// test if app defined icon for contract as caip-19
							const sx_found = await SessionStorage.get(p_test);

							if(sx_found) {
								g_contract.pfp = p_test;
								break FIND_PFP;
							}
						}

						// then accounts (caip-10)
						{
							// build full pfp target
							const p_test = `pfp:${sx_pfp_ctx}:${g_contract.bech32}` as const;

							// test if app defined icon for contract as caip-10
							const sx_found = await SessionStorage.get(p_test);

							if(sx_found) {
								g_contract.pfp = p_test;
								break FIND_PFP;
							}
						}
					}
				}
			}
		}

		// add to list
		a_loaded.push({
			on: 1,
			chain: Chains.pathFrom(g_chain),
			hash: g_contract?.hash || '',
			bech32: sa_contract,
			interfaces: g_contract?.interfaces || {},
			name: g_contract?.name || `Unknown Contract${g_app? ` from ${g_app.host}`: ''}`,
			origin: `app:${Apps.pathFrom(g_app || G_APP_EXTERNAL)}`,
			pfp: g_contract?.pfp || '' as PfpTarget,
		});
	}

	return a_loaded;
}
