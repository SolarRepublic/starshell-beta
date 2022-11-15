import type {Dict} from '#/meta/belt';
import type {ChainPath, ChainStruct, ContractPath, ContractStruct} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';

import {fromBech32} from '@cosmjs/encoding';

import {writableSync} from '../mem';

import {R_BECH32, R_CONTRACT_NAME, R_TOKEN_SYMBOL} from '#/share/constants';
import {Chains} from '#/store/chains';
import {Contracts, ContractType} from '#/store/contracts';


export function validate_contract(_p_contract: ContractPath) {
	// prep cache of existing contracts
	const h_exists_bech32s: Dict<[ContractType, string]> = {};
	const h_exists_names: Dict<ChainPath[]> = {};
	const h_exists_symbols: Dict<number> = {};

	// prep edittable stores
	const yw_contract = writableSync<ContractStruct | null>(null);
	const yw_contract_chain = writableSync<ChainStruct | null>(null);
	const yw_contract_name = writableSync('');
	const yw_contract_bech32 = writableSync('');
	const yw_contract_pfp = writableSync<PfpTarget>('');
	const yw_contract_on = writableSync<0 | 1>(0);
	const yw_contract_type = writableSync(ContractType.UNKNOWN);
	const yw_token_symbol = writableSync('');
	const yw_token_decimals = writableSync(0);
	const yw_token_coingecko = writableSync('');

	// prep validation stores
	const yw_err_contract_name = writableSync('');
	const yw_err_contract_bech32 = writableSync('');
	const yw_wrn_contract_bech32 = writableSync('');
	const yw_err_token_symbol = writableSync('');
	const yw_err_token_decimals = writableSync('');

	// form locked state
	const yw_locked = writableSync(true);

	// helper function
	const is_token = () => 0 !== (ContractType.TOKEN & yw_contract_type.get());

	// go async
	(async() => {
		// load contract from store
		const _g_contract = (await Contracts.at(_p_contract))!;
		yw_contract.set(_g_contract);

		// populate contract fields from contract def
		yw_contract_name.set(_g_contract.name);
		yw_contract_bech32.set(_g_contract.bech32);
		yw_contract_pfp.set(_g_contract.pfp);
		yw_contract_on.set(_g_contract.on);

		// ref chain
		const _p_chain = _g_contract.chain;

		// load chain
		const _g_chain = (await Chains.at(_p_chain))!;
		yw_contract_chain.set(_g_chain);

		// chain supports secret wasm
		if(_g_chain.features.secretwasm) {
			// contract implements secret fungible token
			if(_g_contract.interfaces.snip20) {
				// ref snip-20 def
				const g_snip20 = _g_contract.interfaces.snip20;

				// set contract type
				yw_contract_type.set(ContractType.FUNGIBLE);

				// populate token fields from snip-20 def
				yw_token_symbol.set(g_snip20.symbol);
				yw_token_decimals.set(g_snip20.decimals);
				yw_token_coingecko.set(g_snip20.extra?.coingecko_id || '');
			}
		}

		// cache all existing contract defintions to check for conflicts
		try {
			for(const [p_contract, g_contract] of (await Contracts.read()).entries()) {
				// do not conflict with itself
				if(_p_contract === p_contract) continue;

				// same chain
				if(_p_chain === g_contract.chain) {
					// already a token
					const g_snip20 = g_contract.interfaces.snip20;
					if(g_snip20) {
						// add to bech32 dict
						h_exists_bech32s[g_contract.bech32] = [ContractType.FUNGIBLE, g_snip20.symbol];

						// add to symbols dict
						h_exists_symbols[g_snip20.symbol.toLocaleLowerCase()] = 1;
					}
					// not yet a token
					else {
						// add to bech32 dict
						h_exists_bech32s[g_contract.bech32] = [ContractType.UNKNOWN, g_contract.name];
					}
				}

				// add to chains list
				(h_exists_names[g_contract.name] = h_exists_names[g_contract.name] || [])
					.push(g_contract.chain);
			}
		}
		finally {
			// unlock form
			yw_locked.set(false);
		}

		// conflict validation logic
		{
			// check the contract name for conflicts
			function check_contract_name(s_name: string) {
				// ref chains where contract name is defined
				const a_chains = h_exists_names[s_name];

				// contract name already defined on target chain
				if(a_chains?.includes(_p_chain)) {
					yw_err_contract_name.set(`${is_token()? 'Token': 'Contract'} name already in use on ${_g_chain.name}`);
				}
				// no conflict, but there was a previous validation error; force retest
				else if(yw_err_contract_name.get()) {
					test_contract_name(s_name);
				}
				// reset error
				else {
					yw_err_contract_name.set('');
				}
			}

			// subscribe to changes on contract name
			yw_contract_name.subscribe((s_name) => {
				// provide immediate validation feedback on naming conflict
				if(s_name) check_contract_name(s_name);
			});

			// check the contract's bech32 address
			function test_contract_bech32(sa_bech32=yw_contract_bech32.get()) {
				// prep error text
				let s_err_bech32 = '';

				// invalid address for chain
				if(!Chains.isValidAddressFor(_g_chain, sa_bech32)) {
					// address is incomplete
					if(!R_BECH32.exec(sa_bech32)) {
						s_err_bech32 = 'Incomplete address';
					}
					else {
						// see if parser throws
						try {
							fromBech32(sa_bech32);

							// didn't throw, must be hrp mismatch
							s_err_bech32 = `Account address should start with "${_g_chain.bech32s.acc}1"`;
						}
						// parser threw; invalid checksum
						catch(e_checksum) {
							s_err_bech32 = 'Invalid address checksum';
						}
					}
				}

				// set or clear error
				yw_err_contract_bech32.set(s_err_bech32);

				// no error
				if(!s_err_bech32) {
					// find existing contracts
					const a_defined = h_exists_bech32s[sa_bech32];

					// bech32 conflict
					if(a_defined) {
						// destructure its properties
						const [xc_contract, s_label] = a_defined;

						// other is the same type
						if(yw_contract_type.get() === xc_contract) {
							yw_err_contract_bech32.set(`${is_token()? 'Token': 'Contract'} already defined as ${s_label}`);
						}
						// other is different type
						else {
							yw_wrn_contract_bech32.set(`Contract already defined. Proceeding will overwrite`);
						}
					}
				}
			}

			// subscribe to changes on contract bech32
			yw_contract_bech32.subscribe((sa_bech32) => {
				test_contract_bech32(sa_bech32);
			});

			// check the token symbol for conflicts
			function check_token_symbol(s_symbol: string) {
				// ref state of token symbol defined elsewhere
				const xc_defined = h_exists_symbols[s_symbol];

				// token symbol already defined in wallet
				if(xc_defined) {
					yw_err_token_symbol.set('Token symbol already in use');
				}
				// no conflict; clear error
				else {
					yw_err_token_symbol.set('');
				}
			}

			// validate the token symbol
			function test_token_symbol(s_symbol=yw_token_symbol.get()) {
				// test symbol or set error
				if(!R_TOKEN_SYMBOL.test(s_symbol)) {
					yw_err_token_symbol.set('Invalid token symbol');
				}
				// check for conflicts
				else {
					check_token_symbol(s_symbol);
				}
			}

			// subscribe to changes on token symbol
			yw_token_symbol.subscribe((s_symbol) => {
				// provide immediate validation feedback on symbol conflict
				if(s_symbol) test_token_symbol(s_symbol);
			});
		}
	})();

	// validate the contract name
	function test_contract_name(s_name=yw_contract_name.get()) {
		// clear error
		yw_err_contract_name.set('');

		// test name or set error
		if(!R_CONTRACT_NAME.test(s_name)) {
			yw_err_contract_name.set(`Invalid ${is_token()? 'token': 'contract'} name`);
		}
	}

	return {
		yw_contract,
		yw_contract_name,
		yw_contract_bech32,
		yw_contract_pfp,
		yw_contract_on,
		yw_contract_type,
		yw_token_symbol,
		yw_token_decimals,
		yw_token_coingecko,
		yw_contract_chain,

		yw_err_contract_name,
		yw_err_contract_bech32,
		yw_wrn_contract_bech32,
		yw_err_token_symbol,
		yw_err_token_decimals,

		test_contract_name,

		yw_locked,
	};
}


// let s_err_name = '';
// function change_name() {
// 	if(s_token_name) test_name();
// }

// $: b_errd_name = b_errd_name || !!s_err_name;
// function input_name() {
// 	if(b_errd_name) test_name();
// }

// function test_symbol() {
// 	s_err_symbol = R_TOKEN_SYMBOL.test(s_symbol)? '': 'Invalid token symbol';

// 	if(!s_err_symbol && h_exists_symbols[s_symbol.toLocaleLowerCase()]) {
// 		s_err_symbol = `Token symbol already in use on ${$yw_chain.name}`;
// 	}
// }

// let s_err_symbol = '';
// function change_symbol() {
// 	if(s_symbol) test_symbol();

// 	// errored
// 	if(s_err_symbol) {
// 		// try upper-casing
// 		const s_original = s_symbol;
// 		s_symbol = s_symbol.toLocaleUpperCase();
// 		test_symbol();

// 		// stil an error, restore original
// 		if(s_err_symbol) s_symbol = s_original;
// 	}
// }

// $: b_errd_symbol = b_errd_symbol || !!s_err_symbol;
// function input_symbol() {
// 	if(b_errd_symbol) test_symbol();
// }

