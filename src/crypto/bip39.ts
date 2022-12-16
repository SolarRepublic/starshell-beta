import type {KeyProducer} from './runtime-key';

import {Argon2, Argon2Type as Argon2Type} from './argon2';
import RuntimeKey from './runtime-key';
import SensitiveBytes from './sensitive-bytes';

import {base64_to_buffer, buffer_to_base64, buffer_to_text, concat, sha256, sha256d, text_to_buffer, zero_out} from '#/util/data';

interface ExportedEntropy {
	description?: string;
	wordlist?: string;
	algorithm: string;
	argonType: number;
	saltBase64: string;
	tagLengthBytes: number;
	memorySizeKib: number;
	iterations: number;
	ciphertextBase64?: string;
}

// cache unicode space value
const XB_UNICODE_SPACE = ' '.charCodeAt(0);

// global, ephemeral wordlist to use
let A_WORDLIST: string[] = [];

// prefix for mnemonic salt
const ATU8_UTF8_CONST_MNEMONIC = text_to_buffer('mnemonic');

// resource integrity for the wordlists
const H_WORDLIST_SUPPLEMENTALS = {
	english: {
		hash: 'sha256-L17tU6Rye0v4iA2PPxme/JDlhQNkbZ/47/Oi7Tsk29o=',
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


// loads the word list from disk into memory
export async function load_word_list(s_variant='english'): Promise<string[]> {
	// not yet loaded
	if(!A_WORDLIST.length) {
		// acquire exclusive lock
		await navigator.locks.request('io:word-list', async() => {
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
				const a_words = s_words.trim().split(/\n/g);

				// assert it loaded correctly
				if(2048 !== a_words.length) throw new Error('Failed to load word list');

				// update global pointer 
				A_WORDLIST = a_words;
			}
			// intercept any errors
			catch(e_load) {
				// reset global pointer
				A_WORDLIST = [];

				// rethrow
				throw e_load;
			}
		});
	}

	return A_WORDLIST;
}


/**
 * Encode a mnemonic string into a buffer
 */
export function encodeMnemonicStringToBuffer(s_mnemonic: string): SensitiveBytes {
	return new SensitiveBytes(text_to_buffer(s_mnemonic.trim().split(/\s+/g).join(' ').normalize('NFKD')));
}

export function encodePassphrase(s_passphrase=''): Uint8Array {
	return text_to_buffer('mnemonic'+(s_passphrase || ''));
}

function locate_char(xb_find: number, ib_char: number, ib_lo: number, ib_hi: number): number {
	// binary search
	for(; ib_lo<ib_hi;) {
		// test index
		const ib_mid = (ib_lo + ib_hi) >>> 1;

		// deref value
		const xb_test = text_to_buffer(A_WORDLIST[ib_mid])[ib_char];

		// hit or miss high
		if(xb_test >= xb_find) {
			ib_hi = ib_mid;
		}
		// miss lo (including test undefined when word is too short)
		else {
			ib_lo = ib_mid + 1;
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
	let ib_hi = A_WORDLIST.length;

	// each char
	for(let ib_char=0; ib_char<nb_chars && ib_lo<ib_hi; ib_char++) {
		// ref the character to find
		const xb_find = atu8_word[ib_char];

		// locate start index
		ib_lo = locate_char(xb_find, ib_char, ib_lo, ib_hi);

		// locate stop index
		ib_hi = locate_char(xb_find+1, ib_char, ib_lo, ib_hi);
	}

	const fe_fail = () => {
		throw new Error(`Mnemonic word does not exist in word list: "${buffer_to_text(atu8_word)}"`);
	};

	// resolve
	const atu8_resolved = text_to_buffer(A_WORDLIST[ib_lo]);

	// check byte length
	if(nb_chars !== atu8_resolved.byteLength) fe_fail();

	// validate bytes match
	for(let ib_char=0; ib_char<nb_chars; ib_char++) {
		if(atu8_resolved[ib_char] !== atu8_word[ib_char]) fe_fail();
	}

	// return index
	return ib_lo;
}

// convert the concatenated bits to a sequence of wordlist indicies
function concated_bits_to_indicies(atu8_range): Uint16Array {
	return Uint16Array.from([
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

export const Bip39 = {
	encodeMnemonicStringToBuffer,
	encodePassphrase,

	/**
	 * Finds the lexicographical position of the given text in the wordlist, returning 0.5 to indicate where
	 * the given text _would_ go if it existed in the word list.
	 */
	findIndex(s_find: string, i_lo=0, i_hi=Infinity): number {
		// normalize hi
		if(!Number.isInteger(i_hi)) i_hi = A_WORDLIST.length;

		// binary search
		for(; i_lo<=i_hi;) {
			// compute midpoint search index (bias towards hi to avoid infinite loop)
			const i_mid = (i_lo + i_hi + 1) >>> 1;
			const s_mid = A_WORDLIST[i_mid];

			// miss low
			if(s_mid < s_find) {
				i_lo = i_mid + 1;
			}
			// miss high
			else if(s_mid > s_find) {
				i_hi = i_mid - 1;
			}
			// exact hit
			else {
				return i_mid;
			}
		}

		return (i_lo + i_hi) / 2;
	},

	trimPaddedMnemonic(kn_padded: SensitiveBytes, si_variant: WordlistVariant='english'): SensitiveBytes {
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

		// copy out filled portion of mnemonic (excluding terminal space)
		const kn_mnemonic = new SensitiveBytes(atu8_padded.slice(0, ib_end-1));

		// wipe original
		kn_padded.wipe();

		// return output mnemonic
		return kn_mnemonic;
	},

	/**
	 * Convert a decoded mnemonic key into a seed key
	 * @param atu8_mnemonic 
	 * @param atu8_salt 
	 * @returns 
	 */
	async mnemonicToSeed(fk_mnemonic: KeyProducer, fk_passphrase: KeyProducer): Promise<RuntimeKey> {
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
			salt: atu8_salt,
			iterations: 2048,
			hash: 'SHA-512',
		}, dk_mnemonic, 512));

		// wipe salt
		zero_out(atu8_salt);

		// turn into key
		return await RuntimeKey.create(() => atu8_derived, 512);
	},

	/**
	 * This verion expects exactly 32 bytes of entropy.
	 * @param fk_entropy 
	 * @returns 
	 */
	async entropyToExpanded(fk_entropy: KeyProducer): Promise<SensitiveBytes> {
		// load entropy bits
		const atu8_entropy = await fk_entropy();

		// assert length (must always be 256 bits); panic wipe and throw
		if(32 !== atu8_entropy.byteLength) {
			zero_out(atu8_entropy);
			throw new Error('Bip39 generator did not receieve the expected number of bytes (32 bytes for 256 bits of entropy)');
		}

		// start by hashing the entropy for the checksum
		const atu8_hash = await sha256(atu8_entropy);

		// produce expanded form: entropy || checksum
		const atu8_concat = concat([atu8_entropy, atu8_hash.subarray(0, 1)]);
		zero_out(atu8_entropy);
		zero_out(atu8_hash);

		// create runtime key
		return new SensitiveBytes(atu8_concat);
	},


	/**
	 * This verion expects exactly 32 bytes of entropy.
	 * @param fk_entropy 
	 * @returns 
	 */
	async entropyToPaddedMnemonic(kn_entropy: SensitiveBytes | null=null, si_variant: WordlistVariant='english'): Promise<SensitiveBytes> {
		// use or generate new random entropy and expand
		const kn_expanded = await Bip39.entropyToExpanded(() => kn_entropy?.data || SensitiveBytes.random(32).data);

		// wipe entropy if it was provided
		kn_entropy?.wipe();

		// validate expanded form
		if(!await Bip39.validateExpanded(kn_expanded)) {
			throw new Error(`Faild to validate new key immediately after creating it`);
		}

		// convert to mnemonic
		const kn_mnemonic = await Bip39.expandedToPaddedMnemonic(kn_expanded, si_variant);

		// wipe expanded data
		kn_expanded.wipe();

		// return mnemonic
		return kn_mnemonic;
	},


	async validateExpanded(kn_expanded: SensitiveBytes): Promise<boolean> {
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
	},

	async entropyToIndicies(kn_entropy: SensitiveBytes | null=null): Promise<Uint16Array> {
		// use or generate new random entropy and expand
		const kn_expanded = await Bip39.entropyToExpanded(() => kn_entropy?.data || SensitiveBytes.random(32).data);

		// wipe entropy if it was provided
		kn_entropy?.wipe();

		// validate expanded form
		if(!await Bip39.validateExpanded(kn_expanded)) {
			throw new Error(`Faild to validate new key immediately after creating it`);
		}

		// convert to indicies
		return await Bip39.expandedToIndicies(kn_expanded);
	},

	inndiciesToEntropy(atu16_indicies: Uint16Array): SensitiveBytes {
		// cache number of words
		const nl_words = atu16_indicies.length;

		// invalid word length; panic wipe and throw
		if(0 !== nl_words % 3) {
			zero_out(atu16_indicies);
			throw new Error('Mnemonic word count is not a multiple of 3');
		}

		// prep entropy buffer
		const atu8_entropy = new Uint8Array((nl_words * 11) >>> 3);

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

		// attempt to transcode bits
		try {
			for(let i_group=0; i_group<4; i_group++) {
				const atu16_read = atu16_indicies.subarray(i_group*8);
				const atu8_write = atu8_entropy.subarray(i_group*11);

				xb_secret = atu16_read[0];
				atu8_write[0] = xb_secret >>> 3;
				atu8_write[1] = (xb_secret & 0x07) << 5;

				xb_secret = atu16_read[1];
				atu8_write[1] |= xb_secret >>> 6;
				atu8_write[2] = (xb_secret & 0x3f) << 2;

				xb_secret = atu16_read[2];
				atu8_write[2] |= xb_secret >>> 9;
				atu8_write[3] = (xb_secret >>> 1) & 0xff;
				atu8_write[4] = (xb_secret & 0x01) << 7;

				xb_secret = atu16_read[3];
				atu8_write[4] |= xb_secret >>> 4;
				atu8_write[5] = (xb_secret & 0x0f) << 4;

				xb_secret = atu16_read[4];
				atu8_write[5] |= xb_secret >>> 7;
				atu8_write[6] = (xb_secret & 0x7f) << 1;

				xb_secret = atu16_read[5];
				atu8_write[6] |= xb_secret >>> 10;
				atu8_write[7] = (xb_secret >> 2) & 0xff;
				atu8_write[8] = (xb_secret & 0x03) << 6;

				xb_secret = atu16_read[6];
				atu8_write[8] |= xb_secret >>> 5;
				atu8_write[9] = (xb_secret & 0x1f) << 3;

				xb_secret = atu16_read[7];
				atu8_write[9] |= xb_secret >>> 8;
				atu8_write[10] = xb_secret & 0xff;
			}
		}
		// intercept any errors
		catch(e_any) {
			// wipe the indicies
			zero_out(atu16_indicies);

			// zero out any entropy that was partially decoded
			zero_out(atu8_entropy);

			// rethrow
			throw e_any;
		}

		// done with secret words, wipe indicies
		zero_out(atu16_indicies);

		return new SensitiveBytes(atu8_entropy);
	},

	async expandedToIndicies(kn_expanded: SensitiveBytes): Promise<Uint16Array> {
		// load the word list
		await load_word_list();

		// ref expanded data
		const atu8_expanded = kn_expanded.data;

		// intercept any errors in order to release the lock
		try {
			// convert concatenated key bits to indices
			const atu16_range_0 = concated_bits_to_indicies(atu8_expanded.subarray(0, 11));
			const atu16_range_1 = concated_bits_to_indicies(atu8_expanded.subarray(11, 22));
			const atu16_range_2 = concated_bits_to_indicies(atu8_expanded.subarray(22, 33));

			// wipe expanded data
			kn_expanded.wipe();

			// build contiguous indicies buffer
			const atu16_indicies = Uint16Array.from([
				...atu16_range_0,
				...atu16_range_1,
				...atu16_range_2,
			]);

			// zero out ranges
			zero_out(atu16_range_0);
			zero_out(atu16_range_1);
			zero_out(atu16_range_2);

			// return indicies
			return atu16_indicies;
		}
		// intercept any errors
		catch(e_any) {
			zero_out(atu8_expanded);

			throw new Error(`Unexpected error encountered while converting mnemonic`);
		}
	},


	async expandedToPaddedMnemonic(kn_expanded: SensitiveBytes, si_variant: WordlistVariant='english'): Promise<SensitiveBytes> {
		// intercept any errors in order to release the lock
		try {
			// upperbound byte length of mnemonic output buffer
			const nb_mnemonic = max_mnemonic_buffer_size('english', 24);

			// load indicies
			const atu16_indicies = await Bip39.expandedToIndicies(kn_expanded);

			// prep output buffer
			const atu8_mnemonic = new Uint8Array(nb_mnemonic);

			// build the mnemonic word by word
			let ib_write = 0;
			for(const i_index of atu16_indicies) {
				// encode the word, including terminal space delimiter
				const atu8_word = text_to_buffer(A_WORDLIST[i_index]+' ');

				// append it to the output buffer
				atu8_mnemonic.set(atu8_word, ib_write);
				ib_write += atu8_word.byteLength;

				// assert the write never exceeds buffer capacity
				if(ib_write > nb_mnemonic) {
					throw new Error('Critical mnemonic output error; potential bug');
				}
			}

			// wipe indicies
			zero_out(atu16_indicies);

			// return padded mnemonic
			return new SensitiveBytes(atu8_mnemonic);
		}
		// intercept any errors
		catch(e_any) {
			kn_expanded.wipe();

			throw e_any;
		}
	},

	async mnemonicToEntropy(fk_mnemonic: KeyProducer, nl_words=24): Promise<RuntimeKey> {
		// load the word list
		await load_word_list();

		// create runtime key
		return RuntimeKey.create(async() => {
			// convert mnemonic to indicies
			const atu16_indicies = await Bip39.mnemonicToIndicies(fk_mnemonic);

			// convert indicies to expanded form
			const atu8_expanded = Bip39.inndiciesToEntropy(atu16_indicies).data;

			// validate expanded
			if(!await Bip39.validateExpanded(new SensitiveBytes(atu8_expanded))) {
				zero_out(atu8_expanded);
				throw new Error(`Invalid mnemonic checksum`);
			}

			// remove checksum
			const atu8_entropy = atu8_expanded.slice(0, 32);
			zero_out(atu8_expanded);

			// create key around raw entropy
			return atu8_entropy;
		}, (nl_words * 11) - (nl_words / 3));
	},

	async mnemonicToIndicies(fk_mnemonic: KeyProducer): Promise<Uint16Array> {
		// load the word list
		await load_word_list();

		// intercept any errors in order wipe sensitive data
		let atu8_mnemonic = new Uint8Array(0);
		let atu16_indicies = new Uint16Array(0);
		try {
			// load mnemonic data
			atu8_mnemonic = await fk_mnemonic();

			// put bytes into sensitive container
			const kb_mnemonic = new SensitiveBytes(atu8_mnemonic);

			// split mnemonic into secret words by reference
			const a_secrets = kb_mnemonic.split(XB_UNICODE_SPACE);

			// convert to indices
			atu16_indicies = new Uint16Array(a_secrets.length).map((w_ignore, i_word) => locate_word(a_secrets[i_word]));

			// wipe mnemonic
			kb_mnemonic.wipe();

			// convert indicies to entropy
			return atu16_indicies;
		}
		// intercept any errors
		catch(e_any) {
			zero_out(atu8_mnemonic);
			zero_out(atu16_indicies);

			throw e_any;
		}
	},

	async validateMnemonic(fk_mnemonic: KeyProducer): Promise<boolean> {
		try {
			await Bip39.mnemonicToEntropy(fk_mnemonic);
		}
		catch(e_convert) {
			return false;
		}

		return true;
	},

	async exportMnemonic(fk_mnemonic: KeyProducer, atu8_phrase: Uint8Array): Promise<ExportedEntropy> {
		return Bip39.exportIndicies(() => Bip39.mnemonicToIndicies(fk_mnemonic), atu8_phrase);
	},

	/**
	 * Encrypts the 256 bits of entropy used to derive a mnemonic by using a one-time pad from the output
	 * hash of SHA-256d(Argon2id(passphrase)). 
	*/
	async exportIndicies(fk_indicies: KeyProducer<Uint16Array>, atu8_phrase: Uint8Array): Promise<ExportedEntropy> {
		// generate random salt
		const atu8_salt = crypto.getRandomValues(new Uint8Array(32));

		// prep param constants
		const nb_entropy = 33;
		const n_iterations = 64;
		const nkib_memory = 64;

		// prep params
		const g_params: ExportedEntropy = {
			description: `This JSON file represents an encrypted BIP-39 mnemonic exported from the StarShell wallet. It is protected by a passphrase, known only to the user. The ciphertext stores 33 bytes of the raw entropy used to derive the 24-word mnemonic.`,
			wordlist: 'english',
			algorithm: 'argon2',
			argonType: Argon2Type.Argon2id,
			saltBase64: buffer_to_base64(atu8_salt),
			tagLengthBytes: nb_entropy,
			memorySizeKib: nkib_memory,
			iterations: n_iterations,
		};

		// perform hashing
		const atu8_hash_phrase = await Argon2.hash({
			type: Argon2Type.Argon2id,
			phrase: atu8_phrase,
			salt: atu8_salt,
			hashLen: nb_entropy,
			mem: nkib_memory << 10,
			time: n_iterations,
		});

		// sha-256d
		const atu8_hash_out = await sha256d(atu8_hash_phrase);

		// convert indicies to entropy
		const kn_entropy = Bip39.inndiciesToEntropy(await fk_indicies());

		// access the entropy key and create "one-time" pad
		const kn_otp = new SensitiveBytes(atu8_hash_out).xor(kn_entropy);

		// wipe secret material
		zero_out(atu8_hash_phrase);
		zero_out(atu8_hash_out);
		kn_entropy.wipe();

		// create output json
		return {
			...g_params,
			ciphertextBase64: buffer_to_base64(kn_otp.data),
		};
	},

	async importEntopy(g_entropy: ExportedEntropy, atu8_phrase: Uint8Array): Promise<RuntimeKey> {
		const kn_cipertext = new SensitiveBytes(base64_to_buffer(g_entropy.ciphertextBase64!));

		// perform hashing
		const atu8_hash_phrase = await Argon2.hash({
			type: g_entropy.argonType,
			phrase: atu8_phrase,
			salt: base64_to_buffer(g_entropy.saltBase64),
			hashLen: g_entropy.tagLengthBytes,
			mem: g_entropy.memorySizeKib << 10,
			time: g_entropy.iterations,
		});

		// sha-256d
		const atu8_hash_out = await sha256d(atu8_hash_phrase);

		// xor result
		const kn_otp = new SensitiveBytes(atu8_hash_out).xor(kn_cipertext);

		// zero-out secret material
		zero_out(atu8_hash_phrase);
		zero_out(atu8_hash_out);
		kn_cipertext.wipe();

		// create runtime key
		return RuntimeKey.createRaw(kn_otp.data, 32 << 3);
	},
};
