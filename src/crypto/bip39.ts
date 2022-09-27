import AsyncLockPool from '#/util/async-lock-pool';
import {buffer_to_text, concat, sha256, text_to_buffer, zero_out} from '#/util/data';
import RuntimeKey, {KeyProducer} from './runtime-key';
import SensitiveBytes from './sensitive-bytes';

// cache unicode space value
const XB_UNICODE_SPACE = ' '.charCodeAt(0);

// global, ephemeral wordlist to use
let A_WORDS: string[] = [];

// prefix for mnemonic salt
const ATU8_UTF8_CONST_MNEMONIC = text_to_buffer('mnemonic');

// resource integrity for the wordlists
const H_WORDLIST_SUPPLEMENTALS = {
	english: {
		hash: 'sha256-GH2wSoad2bx76A0hqGSX1pLA22q9OqjLa+XWGP91f64=',
		min_word_length_bytes: 3,
		max_word_length_bytes: 8,
	},
};

type WordlistVariant = keyof typeof H_WORDLIST_SUPPLEMENTALS;

function min_mnemonic_buffer_size(si_variant: WordlistVariant, nl_words=24) {
	return nl_words * (H_WORDLIST_SUPPLEMENTALS[si_variant].min_word_length_bytes + 1);
}

function max_mnemonic_buffer_size(si_variant: WordlistVariant, nl_words=24) {
	return nl_words * (H_WORDLIST_SUPPLEMENTALS[si_variant].max_word_length_bytes + 1);
}

// async look pool for the wordlist global
const k_pool_wordlist = new AsyncLockPool(1);

// loads the word list from disk into memory
async function load_word_list(s_variant='english') {
	// acquire exclusive lock
	const f_release = await k_pool_wordlist.acquire();

	// intercept any errors in order to release the lock
	try {
		// request config
		const d_req = new Request(`/data/bip-0039-${s_variant}.txt`, {
			method: 'GET',
			integrity: H_WORDLIST_SUPPLEMENTALS[s_variant].hash,
		});

		// attempt to load the word list
		const s_words = await (await fetch(d_req)).text();

		// parse list
		const a_words = s_words.split(/\n/g);

		// assert it loaded correctly
		if(2048 !== a_words.length) throw new Error('Failed to load word list');

		// update global pointer 
		A_WORDS = a_words;
	}
	// intercept any errors
	catch(e_load) {
		// reset global pointer
		A_WORDS = [];

		// release lock
		f_release();

		// rethrow
		throw e_load;
	}

	// return lock releaser
	return (e_any?: Error) => {
		// reset global pointer
		A_WORDS = [];

		// release lock
		f_release();

		// this was called as part of an error being caught
		if(e_any) {
			// rethrow
			throw e_any;
		}
	};
}


/**
 * Encode a mnemonic string into a buffer
 */
export function encodeMnemonicStringToBuffer(s_mnemonic: string): SensitiveBytes {
	return new SensitiveBytes(text_to_buffer(s_mnemonic.trim().split(/\s+/g).join(' ').normalize('NFKD')));
}

export function trimPaddedMnemonic(kn_padded: SensitiveBytes, si_variant: WordlistVariant='english'): SensitiveBytes {
	// ref padded data
	const atu8_padded = kn_padded.data;

	// not correct length
	const nb_expect = max_mnemonic_buffer_size(si_variant, 24);
	if(nb_expect !== atu8_padded.byteLength) {
		throw new Error(`Expected padded mnemonic buffer to be ${nb_expect} bytes in length but received ${atu8_padded.byteLength}`);
	}

	// locate end (first null byte)
	let ib_end = atu8_padded.indexOf(0);
	if(-1 === ib_end) ib_end = atu8_padded.length;

	// mnemonic is too short
	if(ib_end < min_mnemonic_buffer_size(si_variant, 24)) {
		throw new Error('Invalid padded mnemonic format; data is too short');
	}

	// verify the preceeding byte is a space
	if(XB_UNICODE_SPACE !== atu8_padded[ib_end-1]) {
		throw new Error('Invalid padded mnemonic format; missing terminal space');
	}

	// count the number of words
	let c_words = 0;
	for(let ib_each=0; ib_each<ib_end; ib_each++) {
		if(XB_UNICODE_SPACE === atu8_padded[ib_each]) c_words++;
	}

	// assert word length
	if(24 !== c_words) {
		throw new Error('Invalid padded mnemonic format; not correct word length');
	}

	// copy out filled portion of mnemonic
	const kn_mnemonic = SensitiveBytes.empty(atu8_padded.byteLength);
	kn_mnemonic.data.set(atu8_padded, 0);

	// wipe original
	kn_padded.wipe();

	// return output mnemonic
	return kn_mnemonic;
}

// /**
//  * Encode a mnemonic string into a buffer
//  */
// export function encodeMnemonic(s_mnemonic: string): Uint8Array {
// 	return text_to_buffer(s_mnemonic.trim().split(/\s+/g).join(' ').normalize('NFKD'));
// }

export function encodePassphrase(s_passphrase=''): Uint8Array {
	return text_to_buffer('mnemonic'+(s_passphrase || ''));
}

/**
 * Convert a decoded mnemonic key into a seed key
 * @param atu8_mnemonic 
 * @param atu8_salt 
 * @returns 
 */
export async function bip39MnemonicToSeed(fk_mnemonic: KeyProducer, fk_passphrase: KeyProducer): Promise<RuntimeKey> {
	// load mnemonic data
	const atu8_mnemonic = await fk_mnemonic();

	// import mnemonic to key
	const dk_mnemonic = await crypto.subtle.importKey('raw', atu8_mnemonic, 'PBKDF2', false, ['deriveBits']);

	// wipe mnemonic data
	zero_out(atu8_mnemonic);

	// load passphrase
	const atu8_passphrase = await fk_passphrase();

	// produce salt
	const atu8_salt = concat([ATU8_UTF8_CONST_MNEMONIC, atu8_passphrase]);

	// wipe passphrase
	zero_out(atu8_passphrase);

	// derive 512-bits
	const atu8_derived = new Uint8Array(await crypto.subtle.deriveBits({
		name: 'PBKDF2',
		salt: atu8_passphrase,
		iterations: 2048,
		hash: 'SHA-512',
	}, dk_mnemonic, 512));

	// wipe salt
	zero_out(atu8_salt);

	// turn into key
	return await RuntimeKey.create(() => atu8_derived, 512);
}

function locate_char(xb_find: number, ib_lo: number, ib_hi: number): number {
	// binary search
	for(; ib_lo<ib_hi;) {
		// test index
		const ib_mid = (ib_lo + ib_hi) >>> 1;

		// deref value
		const xb_test = text_to_buffer(A_WORDS[ib_mid])[0];

		// miss low
		if(xb_test < xb_find) {
			ib_lo = ib_mid + 1;
		}
		// hit or miss high
		else {
			ib_hi = ib_mid;
		}
	}

	// return index
	return ib_lo;
}

function locate_word(atu8_word: Uint8Array): number {
	// cache byte length
	const nb_chars = atu8_word.byteLength;

	// index range
	let ib_lo = 0;
	let ib_hi = A_WORDS.length;

	// each char
	for(let ib_char=0; ib_char<nb_chars && ib_lo<ib_hi; ib_char++) {
		// ref the character to find
		const xb_find = atu8_word[ib_char];

		// locate start index
		ib_lo = locate_char(xb_find, ib_lo, ib_hi);

		// locate stop index
		ib_hi = locate_char(xb_find+1, ib_lo, ib_hi);
	}

	// resolve
	const atu8_resolved = text_to_buffer(A_WORDS[ib_lo]);

	// validate
	if(nb_chars !== atu8_resolved.byteLength) {
		throw new Error(`Mnemonic word does not exist in word list: "${buffer_to_text(atu8_word)}"`);
	}

	// compare words
	for(let ib_char=0; ib_char<nb_chars; ib_char++) {
		if(atu8_resolved[ib_char] !== atu8_word[ib_char]) {
			throw new Error(`Mnemonic word does not exist in word list: "${buffer_to_text(atu8_word)}"`);
		}
	}

	// return index
	return ib_lo;
}

// convert the concatenated bits to a sequence of wordlist indicies
function concated_bits_to_indicies(atu8_range) {
	return Uint8Array.from([
		0x7ff & ((atu8_range[0] << 3) | (atu8_range[1] >>> 5)),
		0x7ff & ((atu8_range[1] << 6) | (atu8_range[2] >>> 2)),
		0x7ff & ((atu8_range[2] << 9) | (atu8_range[3] << 1) | (atu8_range[4] >>> 7)),
		0x7ff & ((atu8_range[4] << 4) | (atu8_range[5] >>> 4)),
		0x7ff & ((atu8_range[5] << 7) | (atu8_range[6] >>> 1)),
		0x7ff & ((atu8_range[6] << 10) | (atu8_range[7] << 2) | (atu8_range[8] >>> 6)),
		0x7ff & ((atu8_range[8] << 5) | (atu8_range[9] >>> 3)),
		0x7ff & ((atu8_range[9] << 8) | atu8_range[10]),
	]);
}

/**
 * This verion expects exactly 32 bytes of entropy.
 * @param fk_entropy 
 * @returns 
 */
export async function bip39EntropyToExpanded(fk_entropy: KeyProducer): Promise<SensitiveBytes> {
	// load entropy bits
	const atu8_entropy = await fk_entropy();

	// assert length; panic wipe and throw
	if(32 !== atu8_entropy.byteLength) {
		zero_out(atu8_entropy);
		throw new Error('bip39 generator did not receieve the expected number of bytes');
	}

	// generate checksum by hashing the first 8 bits (for 256-bit entropy)
	const atu8_hash = await sha256(atu8_entropy);

	// concatenate entropy || checksum
	const atu8_concat = concat([atu8_entropy, atu8_hash.subarray(0, 1)]);
	zero_out(atu8_entropy);
	zero_out(atu8_hash);

	// create runtime key
	return new SensitiveBytes(atu8_concat);
}


export async function bip39ValidateExpanded(kn_expanded: SensitiveBytes): Promise<boolean> {
	// ref expanded data
	const atu8_expanded = kn_expanded.data;

	// exepect 256 bits of entropy || 8 bits of checksum
	if(33 !== atu8_expanded.byteLength) throw new Error(`Invalid StarShell bip39 expanded entropy; expected 33 bytes but received ${atu8_expanded.byteLength}`);

	// generate checksum
	const atu8_hash = await sha256(atu8_expanded.subarray(0, 32));

	// validity depends on checksums matching
	const b_valid = atu8_hash[0] === atu8_expanded[32];

	// zero out hash
	zero_out(atu8_hash);

	// assert validity
	if(!b_valid) throw new Error(`Invalid StarShell bip39 expanded entropy; checksums do not match`);

	// return validity
	return b_valid;
}

export async function bip39EntropyToPaddedMnemonic(kn_entropy: SensitiveBytes | null=null, si_variant: WordlistVariant='english'): Promise<SensitiveBytes> {
	// use or generate new random entropy and expand
	const kn_expanded = await bip39EntropyToExpanded(() => kn_entropy?.data || SensitiveBytes.random(32).data);

	// wipe entropy if it was provided
	kn_entropy?.wipe();

	// validate expanded form
	if(!await bip39ValidateExpanded(kn_expanded)) {
		throw new Error(`Faild to validate new key immediately after creating it`);
	}

	// convert to mnemonic
	const kn_mnemonic = await bip39ExpandedToPaddedMnemonic(kn_expanded, si_variant);

	// wipe expanded data
	kn_expanded.wipe();

	// return mnemonic
	return kn_mnemonic;
}

export async function bip39ExpandedToPaddedMnemonic(kn_expanded: SensitiveBytes, si_variant: WordlistVariant='english'): Promise<SensitiveBytes> {
	// load the word list
	const f_release = await load_word_list();

	// intercept any errors in order to release the lock
	try {
		// upperbound byte length of mnemonic output buffer
		const nb_mnemonic = max_mnemonic_buffer_size('english', 24);

		// ref expanded data
		const atu8_expanded = kn_expanded.data;

		// convert concatenated key bits to indices
		const atu8_range_0 = concated_bits_to_indicies(atu8_expanded.subarray(0, 11));
		const atu8_range_1 = concated_bits_to_indicies(atu8_expanded.subarray(12, 23));
		const atu8_range_2 = concated_bits_to_indicies(atu8_expanded.subarray(23, 34));

		// wipe expanded data
		kn_expanded.wipe();

		// build contiguous indicies buffer
		const atu8_indicies = concat([atu8_range_0, atu8_range_1, atu8_range_1]);

		// zero out ranges
		zero_out(atu8_range_0);
		zero_out(atu8_range_1);
		zero_out(atu8_range_2);

		// prep output buffer
		const atu8_mnemonic = new Uint8Array(nb_mnemonic);

		// build the mnemonic word by word
		let ib_write = 0;
		for(const i_index of atu8_indicies) {
			// encode the word, including terminal space delimiter
			const atu8_word = text_to_buffer(A_WORDS[i_index]+' ');

			// append it to the output buffer
			atu8_mnemonic.set(atu8_word, ib_write);
			ib_write += atu8_word.byteLength;

			// assert the write never exceeds buffer capacity
			if(ib_write > nb_mnemonic) {
				throw new Error('Critical mnemonic output error; potential bug');
			}
		}

		// zero out indicies
		zero_out(atu8_indicies);

		// release lock
		f_release();

		// return padded mnemonic
		return new SensitiveBytes(atu8_mnemonic);
	}
	// intercept any errors
	catch(e_any) {
		f_release(e_any as Error);
		throw new Error('Unreachable code');
	}
}

export async function bip39MnemonicToEntropy(fk_mnemonic: KeyProducer): Promise<RuntimeKey> {
	// load the word list
	const f_release = await load_word_list();

	// intercept any errors in order to release the lock
	try {
		// create runtime key
		return RuntimeKey.create(async() => {
			// load mnemonic data
			const atu8_mnemonic = await fk_mnemonic();

			// put bytes into sensitive container
			const kb_mnemonic = new SensitiveBytes(atu8_mnemonic);

			// split mnemonic into secret words by reference
			const a_secrets = kb_mnemonic.split(XB_UNICODE_SPACE);

			// cache number of secrets
			const nl_secrets = a_secrets.length;

			// invalid word length; panic wipe and throw
			if(0 !== nl_secrets % 3) {
				kb_mnemonic.wipe();
				throw new Error('Mnemonic word count is not a multiple of 3');
			}


			// prep entropy buffer
			const atu8_entropy = new Uint8Array((nl_secrets * 11) >>> 3);

			// // number of bits to fill in current byte
			// let ni_fill = 8;

			// // position of write head in bytes
			// let ib_write = 0;

			// // each secret word
			// for(let i_secret=0; i_secret<nl_secrets; i_secret++) {
			// 	const atu8_secret = a_secrets[i_secret];

			// 	// locate secret word in wordlist
			// 	const xb_secret = locate_word(atu8_secret);

			// 	// how many bits to trim off for first first
			// 	const ni_trim = (11 - ni_fill);

			// 	// write the lead byte value
			// 	atu8_entropy[ib_write++] |= (xb_secret >>> ni_trim);

			// 	// handle the mid byte
			// 	atu8_entropy[ib_write] = (xb_secret & (0x7ff >>> ni_fill)) << (8 - Math.min(8, ni_trim));

			// 	// closed mid byte
			// 	if(ni_trim >= 8) {
			// 		ib_write += 1;

			// 		// requires third write
			// 		if(ni_trim > 8) {
			// 			atu8_entropy[ib_write] = 
			// 		}
			// 	}

			// 	// modular add 11 bits
			// 	ni_fill = (8 - ni_fill + 11) % 8;
			// }

			// the pattern looks like this:
			//      8 8 8 8 8 8 8 8 8 8 8
			// 0 |  8+3                    = 11
			// 1 |    5+6                  = 11
			// 2 |      2+8+1              = 11
			// 3 |          7+4            = 11
			// 4 |            4+7          = 11
			// 5 |              1+8+2      = 11
			// 6 |                  6+5    = 11
			// 7 |                    3+8  = 11
			// 
			// mask values to get the bottom n bits:
			//   8: 0xff   4: 0x0f
			//   7: 0x7f   3: 0x07
			//   6: 0x3f   2: 0x03
			//   5: 0x1f   1: 0x0f

			// index value of the secret word
			let xb_secret = 0;

			// attempt to locate each word
			try {
				xb_secret = locate_word(a_secrets[0]);
				atu8_entropy[0] = xb_secret >>> 3;
				atu8_entropy[1] = (xb_secret & 0x07) << 5;

				xb_secret = locate_word(a_secrets[1]);
				atu8_entropy[1] |= xb_secret >>> 6;
				atu8_entropy[2] = (xb_secret & 0x3f) << 2;

				xb_secret = locate_word(a_secrets[2]);
				atu8_entropy[2] |= xb_secret >>> 9;
				atu8_entropy[3] = (xb_secret >>> 1) & 0xff;
				atu8_entropy[4] = (xb_secret & 0x01) << 7;

				xb_secret = locate_word(a_secrets[3]);
				atu8_entropy[4] |= xb_secret >>> 4;
				atu8_entropy[5] = xb_secret >>> 1;

				// TODO: finish implementation
			}
			// intercept any errors
			catch(e_any) {
				// wipe the mnemonic
				kb_mnemonic.wipe();

				// zero out any entropy that was partially decoded
				zero_out(atu8_entropy);

				// rethrow
				throw e_any;
			}

			// done with secret words, wipe mnemonic data
			kb_mnemonic.wipe();

			// release lock
			f_release();

			return atu8_entropy;
		});
	}
	// intercept any errors
	catch(e_any) {
		f_release(e_any as Error);
		throw new Error('Unreachable code');
	}
}

export async function bip39ValidateMnemonic(fk_mnemonic: KeyProducer): Promise<boolean> {
	try {
		mnemonicToEntropy(fk_mnemonic);
	}
	catch(e_convert) {
		return false;
	}

	return true;
}
