import type {Bech32, ChainInterface} from '#/meta/chain';
import {base64_to_buffer, ripemd160_sync, sha256_sync} from '#/util/data';
import {fromBech32, toBech32} from '@cosmjs/encoding';


export function pubkey_to_bech32(z_pubkey: string | Uint8Array, z_context: ChainInterface | string): Bech32 {
	const atu8_pk = 'string' === typeof z_pubkey? base64_to_buffer(z_pubkey): z_pubkey;
	if(!(atu8_pk instanceof Uint8Array)) {
		throw new TypeError(`Pubkey argument must be a Uint8Array`);
	}

	let si_hrp: string;
	if('string' === typeof z_context) {
		si_hrp = z_context;
	}
	else {
		si_hrp = z_context.bech32s.acc;
	}

	// perform sha-256 hashing on the public key
	const atu8_sha256 = sha256_sync(atu8_pk);

	// perform ripemd-160 hashing on the result
	const atu8_ripemd160 = ripemd160_sync(atu8_sha256);

	// convert to bech32 string
	return toBech32(si_hrp, atu8_ripemd160) as Bech32;
}

export function bech32_to_pubkey(sa_addr: string): Uint8Array {
	return fromBech32(sa_addr).data;
}
