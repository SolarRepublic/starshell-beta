import type {Bech32, ChainInterface} from '#/meta/chain';
import {base64_to_buffer, ripemd160_sync, sha256_sync} from '#/util/data';
import {fromBech32, toBech32} from '@cosmjs/encoding';


export function pubkey_to_bech32(sx64_pubkey: string, z_context: ChainInterface | string): Bech32 {
	let si_hrp: string;
	if('string' === typeof z_context) {
		si_hrp = z_context;
	}
	else {
		si_hrp = z_context.bech32s.acc;
	}

	// perform sha-256 hashing on the public key
	const atu8_sha256 = sha256_sync(base64_to_buffer(sx64_pubkey));

	// perform ripemd-160 hashing on the result
	const atu8_ripemd160 = ripemd160_sync(atu8_sha256);

	// convert to bech32 string
	return toBech32(si_hrp, atu8_ripemd160) as Bech32;
}

export function bech32_to_pubkey(sa_addr: string): Uint8Array {
	return fromBech32(sa_addr).data;
}
