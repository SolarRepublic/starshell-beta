import {hmac, text_to_buffer, zero_out} from '#/util/data';
import RuntimeKey, {KeyProducer} from './runtime-key';
import {Secp256k1Key} from './secp256k1';
import SensitiveBytes from './sensitive-bytes';

// create the master 'Bitcoin seed' hmac key
const DK_BIP32_KEY_MASTER_GEN = await crypto.subtle.importKey('raw', text_to_buffer('Bitcoin seed'), {
	name: 'HMAC',
	hash: {name:'SHA-512'},
}, false, ['sign']);

/**
 * 
 * <https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#Master_key_generation>
 */
export async function bip32MasterKey(fk_seed: KeyProducer): Promise<Bip32> {
	// initialize WASM module
	await Secp256k1Key.init();

	// generate the master `I`
	const atu8_i = new Uint8Array(await crypto.subtle.sign('HMAC', DK_BIP32_KEY_MASTER_GEN, await fk_seed()));

	// split into two 32-byte sequences `I_L` and `I_R`
	const atu8_il = atu8_i.subarray(0, 32);
	const atu8_ir = atu8_i.subarray(32);

	// invalid master secret key
	if(!Secp256k1Key.validatePrivateKey(atu8_il)) {
		// panic wipe
		zero_out(atu8_i);

		throw new Error('Invalid master key');
	}

	const kk_sk = await RuntimeKey.create(() => atu8_il);

	return Bip32.create(kk_sk, atu8_ir);
}


// 2^31
const N_BIP32_HARDENED = 0x80000000;

interface Bip32Fields {
	kk_sk: RuntimeKey;
	ks_sk: Secp256k1Key;
	atu8_pk33: Uint8Array;
	atu8_chain: Uint8Array;
	b_hardened: boolean;
	atu8_parent: Uint8Array;
}

const hm_privates = new WeakMap<Bip32, Bip32Fields>();

// TOOD: implement RIPEMD160
const CryptoJS_u8array = {
	stringify(g_words: CryptoJS.lib.WordArray) {
		const a_words = g_words.words;
		const nb_sig = g_words.sigBytes;
		const atu8_out = new Uint8Array(nb_sig);
		for(let ib_each=0; ib_each<nb_sig; ib_each++) {
			const xb_value = (a_words[ib_each >>> 2] >>> (24 - ((ib_each % 4) * 8))) & 0xff;
			atu8_out[ib_each] = xb_value;
		}

		return atu8_out;
	},

	parse(atu8_bytes: Uint8Array) {
		const nb_bytes = atu8_bytes.length;
		const a_words: number[] = [];
		for(let ib_each=0; ib_each<nb_bytes; ib_each++) {
			a_words[ib_each >>> 2] |= (atu8_bytes[ib_each] & 0xff) << (24 - ((ib_each % 4) * 8));
		}

		return CryptoJS.lib.WordArray.create(a_words, nb_bytes);
	},
};

const ATU8_FINGERPRINT_NIL = new Uint8Array(4).fill(0);

export class Bip32 {
	static async create(kk_sk: RuntimeKey, atu8_chain: Uint8Array, atu8_parent=ATU8_FINGERPRINT_NIL): Promise<Bip32> {
		const k_bip32 = new Bip32();

		return await k_bip32.init(kk_sk, atu8_chain, atu8_parent);
	}

	private constructor() {}  // eslint-disable-line @typescript-eslint/no-empty-function

	get identifier(): Uint8Array {
		return CryptoJS_u8array.stringify(CryptoJS.RIPEMD160(CryptoJS_u8array.parse(hm_privates.get(this)!.atu8_pk33)));
	}

	get fingerprint(): Uint8Array {
		return this.identifier.subarray(0, 4);
	}

	async init(kk_sk: RuntimeKey, atu8_chain: Uint8Array, atu8_parent: Uint8Array): Promise<this> {
		const ks_sk = await Secp256k1Key.import(kk_sk, true);

		await kk_sk.access((atu8_sk) => {
			hm_privates.set(this, {
				kk_sk,
				ks_sk,
				atu8_pk33: ks_sk.exportPublicKey(),
				atu8_chain,
				b_hardened: atu8_sk[0] > 0x80,
				atu8_parent,
			});
		});

		return this;
	}

	/**
	 * <https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#child-key-derivation-ckd-functions>
	 */
	async derive(i_child: number): Promise<Bip32> {
		// destructure private field
		const {
			kk_sk,
			ks_sk,
			atu8_pk33,
			atu8_chain,
		} = hm_privates.get(this)!;

		// initialize WASM module
		await Secp256k1Key.init();

		// prep data bytes
		const kn_data = SensitiveBytes.empty(1 + 32 + 4);
		const atu8_data = kn_data.data;

		// write ser32(i)
		new DataView(atu8_data).setUint32(33, i_child);

		// child is a hardened key
		if(i_child >= N_BIP32_HARDENED) {
			// > Data = 0x00 || ser256(kpar) || ser32(i)
			atu8_data[0] = 0x00;

			// access private key and copy it into data
			await kk_sk.access((atu8_sk) => {
				atu8_data.set(atu8_sk, 1);
			});
		}
		// child is a normal key
		else {
			// > Data = serP(point(kpar)) || ser32(i)
			atu8_data.set(atu8_pk33, 0);
		}

		// > let I = HMAC-SHA512(Key = cpar, Data
		const atu8_i = await hmac(atu8_chain, atu8_data, 'SHA-512');

		// clean up intermediate data
		kn_data.wipe();

		// > Split I into two 32-byte sequences, IL and IR.
		const atu8_il = atu8_i.subarray(0, 32);
		const atu8_ir = atu8_i.subarray(32);

		// > In case parse256(IL) ≥ n or ki = 0
		if(!Secp256k1Key.validatePrivateKey(atu8_i)) {
			// panic wipe
			zero_out(atu8_i);

			// > proceed with the next value for i
			return this.derive(i_child + 1);
		}

		// Private parent key → private child key
		{
			const atu8_ki = await ks_sk.add(atu8_il);

			// check ki is valid
			if(!Secp256k1Key.validatePrivateKey(atu8_ki)) {
				// panic wipe
				zero_out(atu8_i)
				zero_out(atu8_ki);

				// > proceed with the next value for i
				return this.derive(i_child + 1);
			}

			// create child key
			const kk_child = await RuntimeKey.createRaw(atu8_ki);

			return await Bip32.create(kk_child, atu8_ir, this.fingerprint);
		}
	}

	deriveHardened(i_child: number): Promise<Bip32> {
		return this.derive(i_child >= N_BIP32_HARDENED? i_child: i_child + N_BIP32_HARDENED);
	}

	derivePath(s_path: string) {
		const a_parts = s_path.split('/');

		if('m' === a_parts[0]) {

		}
	}
}
