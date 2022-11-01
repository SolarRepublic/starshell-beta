<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {ContractPath, EntityPath, HoldingPath} from '#/meta/chain';
	import type {PfpTarget} from '#/meta/pfp';
	
	import type {Resource} from '#/meta/resource';
	
	import {load_pfps} from '../svelte';
	
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	
	import {ode} from '#/util/belt';
	import {yw_chain, yw_chain_ref, yw_owner} from '##/mem';
	
	import Load from './Load.svelte';
	import StarSelect, {type SelectOption} from './StarSelect.svelte';


	export let assetPath: HoldingPath | ContractPath | '' = '';

	const si_chain = $yw_chain?.reference || '*';

	let h_asset_pfps: Record<PfpTarget, HTMLElement> = {};

	async function load_assets() {
		const a_items: SelectOption[] = [];

		const h_pfps: Record<Resource.Path, Nameable & Pfpable> = {
			...$yw_chain.coins,
		};

		// load native coins
		for(const [si_coin, g_coin] of ode($yw_chain.coins)) {
			a_items.push({
				value: Entities.holdingPathFor($yw_owner, si_coin),
				object: g_coin,
				primary: si_coin,
				secondary: g_coin.name,
				pfp: g_coin.pfp,
			});
		}

		// load tokens
		if($yw_chain.features.secretwasm) {
			// on secret-wasm; load snip-20s
			for(const g_contract of await Contracts.filterTokens({
				on: 1,
				chain: $yw_chain_ref,
				interfaces: {
					snip20: {},
				},
			})) {
				// ref snip-20 struct
				const g_snip20 = g_contract.interfaces.snip20!;

				// contract path
				const p_contract = Contracts.pathFrom(g_contract);

				h_pfps[p_contract] = g_contract;

				a_items.push({
					value: p_contract,
					object: g_contract,
					primary: g_snip20.symbol,
					secondary: g_contract.name,
					pfp: g_contract.pfp,
				});
			}
		}

		h_asset_pfps = await load_pfps(h_pfps, {
			dim: 19,
		});

		return a_items;
	}

	// the current item selected by user
	let g_item: SelectOption<EntityPath> = {
		value: assetPath as EntityPath,
		object: null!,
		primary: '',
		secondary: '',
		pfp: '' as PfpTarget,
	};
	$: {
		// propagate change back to exported binding
		assetPath = g_item?.value || '';
	}

	// async function load_tokens() {
	// 	// prep an output list of select items
	// 	const a_items = [];

	// 	// read all fungible tokens for this chain
	// 	const h_interfaces = await Entities.readFungibleTokens($yw_chain);

	// 	// each interface
	// 	for(const si_interface in h_interfaces) {
	// 		// ref token dict
	// 		const h_tokens = h_interfaces[si_interface as TokenSpecKey];

	// 		// each token
	// 		for(const p_token in h_tokens) {
	// 			// ref token
	// 			const g_token = h_tokens[p_token as TokenPath];

	// 			// add to select items list
	// 			a_items.push({
	// 				value: p_token,
	// 				label: `${g_token.bech32} ${g_token.symbol} ${g_token.name}`,
	// 			});
	// 		}
	// 	}
	// }

	// const a_tokens = oderaf(H_TOKENS, (_, k_token) => {
	// 	const k_chain = H_CHAINS[k_token.def.chainRef];

	// 	if(si_chain === k_chain.def.id) {
	// 		return [{
	// 			value: k_token.def.iri,
	// 			label: `${k_token.def.address} ${k_token.def.symbol} ${k_token.def.label}`,
	// 			primary: k_token.def.symbol,
	// 			secondary: k_token.def.label,
	// 			token: k_token,
	// 		}];
	// 	}

	// 	return [];
	// });

	// let g_token_select = k_token? a_tokens.find(g => g.value === k_token.def.iri): void 0;

</script>

<style lang="less">
</style>

<div class="asset">
	{#await load_assets()}
		<Load forever />
	{:then a_assets}
		<StarSelect id="asset-select"
			pfpMap={h_asset_pfps}
			placeholder="Select asset"
			items={a_assets}
			bind:value={g_item}
		/>
	{/await}
</div>