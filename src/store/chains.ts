import type { Bech32, BlockExplorerConfig, Chain, ChainPath, Family, FamilyKey } from '#/meta/chain';
import type { Resource } from '#/meta/resource';

import {bech32} from 'bech32';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { R_BECH32, SI_STORE_CHAINS } from '#/share/constants';
import { yw_chain } from '#/app/mem';
import { Dict, ode } from '#/util/belt';
import { base64_to_buffer, ripemd160_sync, sha256_sync } from '#/util/data';
import { binToBase58, binToBech32Padded, encodeBech32, instantiateRipemd160, Ripemd160 } from '@solar-republic/wasm-secp256k1';

// type so = {
// 	pathArgs: [FamilyKey, string];
// 	resource: <a_args extends [FamilyKey, string]>() => Chain<a_args[0], a_args[1]>;
// 	test: <s_test extends string>(s: s_test) => s_test;
// };

// type T1 = <s_str extends string>(s: s_str) => s_str;
// type T2 = <s_str extends number>(s: s_str) => s_str;

// type homa = so['test'] extends T2? 'y': 'n';

// type test = so['test'];
// type wtf = test<'end'>;
// const fff: test = <S extends number>(s: S) => s;

class ChainLink {
	constructor(protected _g_res: Chain['interface']) {

	}

	get data() {
		return this._g_res;
	}
	
	
}

type PathFor<
	si_family extends FamilyKey,
	si_chain extends string,
> = `/family.${si_family}/chain.${si_chain}`;

type PathFrom<
	g_chain extends Chain['interface'],
> = PathFor<g_chain['family'], g_chain['id']>;

let y_ripemd: Ripemd160;
(async() => {
	y_ripemd = await instantiateRipemd160();
})();

export const Chains = create_store_class({
	store: SI_STORE_CHAINS,
	class: class ChainsI extends WritableStoreMap<typeof SI_STORE_CHAINS> {
		static pathFor(si_family: FamilyKey, si_chain: string): PathFor<typeof si_family, typeof si_chain> {
			return `/family.${si_family}/chain.${si_chain}`;
		}

		static pathFrom(g_chain: Chain['interface']): PathFrom<typeof g_chain> {
			return ChainsI.pathFor(g_chain.family, g_chain.id);
		}

		static addressFor(s_pubkey: string, g_chain: Chain['interface']=yw_chain.get(), g_bech32: Bech32=g_chain.bech32s.acc): string {
			// perform sha-256 hashing on the public key
			const atu8_sha256 = sha256_sync(base64_to_buffer(s_pubkey));

			// perform ripemd-160 hashing on the result
			const atu8_ripemd160 = ripemd160_sync(atu8_sha256);

			// const s_addr = binToBech32Padded(atu8_ripemd160);

			// return `${g_bech32.hrp}${g_bech32.separator}${s_addr}${s_checksum}`;

			// convert to bech32 string
			return bech32.encode(g_bech32.hrp, bech32.toWords(atu8_ripemd160));
		}

		static bech32(s_addr: string, g_chain: Chain['interface']=yw_chain.get(), g_bech32: Bech32=g_chain.bech32s.acc): string {
			return `${g_bech32.hrp}${g_bech32.separator}${s_addr}`;
		}

		static get(si_family: FamilyKey, si_chain: string): Promise<null | Chain['interface']> {
			return Chains.read().then(ks => ks.get(si_family, si_chain));
		}

		static at(p_chain: ChainPath): Promise<null | Chain['interface']> {
			return Chains.read().then(ks => ks.at(p_chain));
		}

		static blockExplorer(si_type: Exclude<keyof BlockExplorerConfig, 'base'>, g_data: Dict, g_chain: Chain['interface']=yw_chain.get()): string {
			let sx_url = g_chain.blockExplorer.base+g_chain.blockExplorer[si_type];

			for(const si_key in g_data) {
				sx_url = sx_url.replace(`{${si_key}}`, g_data[si_key]);
			}

			return sx_url;
		}

		static isValidAddressFor(g_chain: Chain['interface'], s_address: Chain.Bech32String<typeof g_chain['bech32s']>, si_purpose: keyof Family.Bech32s<typeof g_chain['family']>='acc') {
			if(g_chain.bech32s) {
				const m_bech32 = R_BECH32.exec(s_address);
				return m_bech32
					&& m_bech32[1] === g_chain.bech32s[si_purpose].hrp
					&& m_bech32[2] === g_chain.bech32s[si_purpose].separator;
			}
			else {
				// TODO: non-bech32 chains
				return false;
			}
		}

		static coinFromDenom(si_denom: string, g_chain=yw_chain.get()): string {
			for(const [si_coin, g_coin] of ode(g_chain.coins)) {
				if(si_denom === g_coin.denom) {
					return si_coin;
				}
			}

			return '';
		}

		* inFamily(si_family: FamilyKey): IterableIterator<[ChainPath, Chain['interface']]> {
			// create prefix
			const p_prefix = ChainsI.pathFor(si_family, '');

			// filter entriees
			for(const [p_chain, g_chain] of ode(this._w_cache)) {
				if(p_chain.startsWith(p_prefix)) {
					yield [p_chain, g_chain];
				}
			}
		}

		get(si_family: FamilyKey, si_chain: string): Chain['interface'] | null {
			// prepare path
			const p_res = ChainsI.pathFor(si_family, si_chain);

			// fetch
			return this._w_cache[p_res] ?? null;
		}

		async put(g_res: Chain['interface']): Promise<PathFrom<typeof g_res>> {
			// prepare app path
			const p_res = ChainsI.pathFrom(g_res);

			// update cache
			this._w_cache[p_res] = g_res;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}
	},
});
