import type { JsonValue } from '#/util/belt';
import { instantiateRipemd160, instantiateSha256, Ripemd160, Sha256 } from '@solar-republic/wasm-secp256k1';
import { createHash } from 'sha256-uint8array';

/**
 * Performs SHA-256 hash on the given data.
 * @param atu8_data data to hash
 * @returns the hash digest
 */
export async function sha256(atu8_data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', atu8_data));
}


/*
* Performs SHA-256 hash on the given data synchronously (only suitable for non-secure applications).
* @param atu8_data data to hash
* @returns the hash digest
*/
export const sha256_sync_insecure = (atu8_data: Uint8Array): Uint8Array => createHash().update(atu8_data).digest();


let y_sha256: Sha256;
void instantiateSha256().then(y => y_sha256 = y);

/*
* Performs SHA-256 hash on the given data synchronously
* @param atu8_data data to hash
* @returns the hash digest
*/
export const sha256_sync = (atu8_data: Uint8Array): Uint8Array => y_sha256.final(y_sha256.update(y_sha256.init(), atu8_data));

let y_ripemd: Ripemd160;
void instantiateRipemd160().then(y => y_ripemd = y);
export const ripemd160_sync = (atu8_data: Uint8Array): Uint8Array => y_ripemd.final(y_ripemd.update(y_ripemd.init(), atu8_data));

/**
 * Performs SHA-512 hash on the given data.
 * @param atu8_data data to hash
 * @returns the hash digest
 */
export async function sha512(atu8_data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-512', atu8_data));
}


/**
 * Performs HMAC signing of the given message, **not the digest**.
 * @param atu8_sk private key
 * @param atu8_message message to sign, **not the digest**.
 * @returns HMAC signature
 */
export async function hmac(atu8_sk: Uint8Array, atu8_message: Uint8Array, si_algo: 'SHA-256'|'SHA-512'='SHA-256'): Promise<Uint8Array> {
	// import signing private key
	const dk_sign = await crypto.subtle.importKey('raw', atu8_sk, {
		name: 'HMAC',
		hash: {name:si_algo},
	}, false, ['sign']);

	// construct hmac signature
	return new Uint8Array(await crypto.subtle.sign('HMAC', dk_sign, atu8_message));
}


/**
 * Wipe the contents of a buffer so that sensitive data does not outlive garbage collection.
 */
export function zero_out(atu8_data: number[] | Uint8Array): void {
	// overwrite the contents
	atu8_data.fill(0);

	// make sure the engine does not optimize away the above memory wipe instruction
	// @ts-expect-error signature IS compatible with both types
	if(0 !== atu8_data.reduce((c, x) => c + x, 0)) throw new Error('Failed to zero out sensitive memory region');
}


/**
 * UTF-8 encodes the given text to an Uint8Array.
 * @param s_text text to encode
 * @returns UTF-8 encoded Uint8Array
 */
export function text_to_buffer(s_text: string): Uint8Array {
	return new TextEncoder().encode(s_text);
}


/**
 * UTF-8 decodes the given Uint8Array to text.
 * @param atu8_text UTF-8 encoded data to decode
 * @returns text
 */
export function buffer_to_text(atu8_text: Uint8Array): string {
	return new TextDecoder().decode(atu8_text);
}


/**
 * Attempts to JSON stringify the given primitive/object and subsequently UTF-8 encode it.
 * @param w_json JSON-compatible value to encode
 * @returns UTF-8 encoded Uint8Array
 */
export function json_to_buffer(w_json: JsonValue): Uint8Array {
	return text_to_buffer(JSON.stringify(w_json));
}


/**
 * UTF-8 decodes the given Uint8Array and subsequently attempts to JSON parse it.
 * @param atu8_json UTF-8 encoded JSON string data
 * @returns parsed JSON value
 */
export function buffer_to_json(atu8_json: Uint8Array): JsonValue {
	return JSON.parse(buffer_to_text(atu8_json));
}


/**
 * Concatenate a sequence of Uint8Arrays.
 * @param a_buffers the data to concatenate in order
 * @returns the concatenated output Uint8Array
 */
export function concat(a_buffers: Uint8Array[]): Uint8Array {
	const nb_out = a_buffers.reduce((c_bytes, atu8_each) => c_bytes + atu8_each.byteLength, 0);
	const atu8_out = new Uint8Array(nb_out);
	let ib_write = 0;
	for(const atu8_each of a_buffers) {
		atu8_out.set(atu8_each, ib_write);
		ib_write += atu8_each.byteLength;
	}
	return atu8_out;
}


// cache function reference
const sfcc = String.fromCharCode;

/**
 * Converts the given buffer to a hex string format.
 * @param atu8_buffer input buffer
 * @returns output hex string
 */
export function buffer_to_hex(atu8_buffer: Uint8Array): string {
	let sx_hex = '';
	for(const xb_byte of atu8_buffer) {
		sx_hex += xb_byte.toString(16).padStart(2, '0');
	}

	return sx_hex;
}


/**
 * Converts the given hex string into a buffer.
 * @param sx_hex input hex string
 * @returns output buffer
 */
export function hex_to_buffer(sx_hex: string): Uint8Array {
	const nl_hex = sx_hex.length;
	if(0 !== nl_hex % 2) throw new Error(`Invalid hex string length is not a multiple of 2`);
	const nb_buffer = nl_hex / 2;
	const atu8_buffer = new Uint8Array(nb_buffer);
	for(let i_byte=0; i_byte<nb_buffer; i_byte++) {
		atu8_buffer[i_byte] = parseInt(sx_hex.slice(i_byte+i_byte, i_byte+i_byte+2), 16);
	}

	return atu8_buffer;
}


/**
 * Converts the given buffer to a base64-encoded string.
 * @param atu8_buffer input buffer
 * @returns output base64-encoded string
 */
export function buffer_to_base64(atu8_buffer: Uint8Array): string {
	return globalThis.btoa(buffer_to_string8(atu8_buffer));
}


/**
 * Converts the given base64-encoded string to a buffer.
 * @param sx_buffer input base64-encoded string
 * @returns output buffer
 */
export function base64_to_buffer(sx_buffer: string): Uint8Array {
	return string8_to_buffer(globalThis.atob(sx_buffer));
}


/**
 * Converts the given buffer to a UTF-8 friendly compact string.
 * @param atu8_buffer input buffer
 * @returns output string
 */
export function buffer_to_string8(atu8_buffer: Uint8Array): string {
	// benchmarks indicate string building performs better than array map/join
	let sx_buffer = '';
	for(const xb_byte of atu8_buffer) {
		sx_buffer += sfcc(xb_byte);
	}

	return sx_buffer;
}


/**
 * Converts the given UTF-8 friendly compact string to a buffer.
 * @param sx_buffer input string
 * @returns output buffer
 */
export function string8_to_buffer(sx_buffer: string): Uint8Array {
	const nl_pairs = sx_buffer.length;
	const atu8_buffer = new Uint8Array(nl_pairs);
	for(let i_read=0; i_read<nl_pairs; i_read++) {
		atu8_buffer[i_read] = sx_buffer.charCodeAt(i_read);
	}

	return atu8_buffer;
}
