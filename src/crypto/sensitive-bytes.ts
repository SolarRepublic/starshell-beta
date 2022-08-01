
function destroyed() {
	throw new Error('Method called on destroyed SensitiveBytes instance');
}


class SensitiveBytesContext {
	// list of instances
	private _a_biguints: SensitiveBytes[] = [];


	/**
	 * Wraps static random()
	 */
	random(nb_size: number): SensitiveBytes {
		const kn_random = SensitiveBytes.random(nb_size);
		this._a_biguints.push(kn_random);
		return kn_random;
	}


	/**
	 * Wraps static empty()
	 */
	empty(nb_size: number): SensitiveBytes {
		const kn_empty = SensitiveBytes.random(nb_size);
		this._a_biguints.push(kn_empty);
		return kn_empty;
	}


	/**
	 * Wraps default constructor.
	 */
	new(atu8_data: Uint8Array): SensitiveBytes {
		const kn_new = new SensitiveBytes(atu8_data, this);
		this._a_biguints.push(kn_new);
		return kn_new;
	}


	/**
	 * Wipes all instances
	 */
	wipe(): void {
		for(const kn_each of this._a_biguints) {
			kn_each.wipe();
		}
	}
}


/**
 * Provides wrapper for Uint8Array intended to hold sensitive data such as private key material.
 * Rather than allowing key material to possibly outlive garbage collection in memory by using hex strings
 * or BigInt during cryptographic operations, use Uint8Array in order to wipe all intermediate values by 
 * zeroing them out (overwriting all bytes with 0x00) immediately after use. Except for the `wipe` method,
 * instances are immutable.
 * 
 * Some may wonder why not use Uint32Array for more efficient computations with native 32-bit ints.
 * In Chromium, `Smi` can store 31 bit signed ints on 32-bit archs, and 32 bit signed ints on 64-bit archs.
 * <https://source.chromium.org/chromium/v8/v8.git/+/main:src/objects/smi.h;l=17;drc=bf096ec960eee18c916b4bcb4d96be7b39f732ad>
 * <https://stackoverflow.com/a/57426773/1641160>
 * Meaning that 32-bit unsigned integers will always end up being "boxed", i.e., represented by pointers to
 * heap objects in V8, leading to the potential for more sensitive garbage ending up in deallocated RAM.
 * 
 * As for Uint16Array, another issue arises. It would require the use of DataView to control for endianness
 * on the platform, which _may_ introduce temporary values (some of which may allocate on the heap) depending
 * on the runtime implementation. However, this has not been thoroughly investigated and indeed may offer the
 * same protection as Uint8Array with potentially more efficient computations on big-endian platforms (little-
 * endian platforms may or may not see performance hit from DataView's endian conversion).
 * 
 * In conclusion, Uint8Array offers the safest byte-wise calculations since all integer operations on their
 * values are most likely (given all options) to never leave CPU registers and thus never end up in the heap.
 * 
 * For sake of simplicity and in the interest of avoiding human errors, the `other` instance passed to any
 * method must have exactly the same byte length.
 * For example:
 * ```ts
 * const a = Uint8Array(32); a[0] = 0x01;
 * const b = Uint8Array(64); b[0] = 0x03;
 * const sa = new SensitiveBytes(a);
 * const sb = new SensitiveBytes(b);
 * sa.times(sb);  // throws Error since `sa` is 32 bytes while `sb` is 64 bytes
 * ```
 * 
 * One consideration that should be made is whether timing attacks are part of the user's threat model.
 * It is unclear how, or even if, the methods employed by this data structure make it susceptible to
 * timing attacks.
 */
export default class SensitiveBytes {
	/**
	 * Creates an instance that assists with creating and securely deallocating multple SensitiveBytess
	 */
	static context(): SensitiveBytesContext {
		return new SensitiveBytesContext();
	}


	/**
	 * Generate a cryptographically random value having the given number of bytes.
	 */
	static random(nb_size: number): SensitiveBytes {
		return new SensitiveBytes(crypto.getRandomValues(new Uint8Array(nb_size)));
	}


	/**
	 * Convenience method for creating nil-initialized number of given size in bytes.
	 */
	static empty(nb_size=0): SensitiveBytes {
		return new SensitiveBytes(new Uint8Array(nb_size));
	}


	/**
	 * 
	 * @param atu8_data 
	 */
	constructor(private readonly _atu8_data: Uint8Array, private readonly _kc_context: SensitiveBytesContext|null=null) {
		// this._kc_context = kc_context || null;
	}


	/**
	 * Getter for this instance's data
	 */
	get data(): Uint8Array {
		return this._atu8_data;
	}


	/**
	 * Clone this instance so that it can be destroyed without affecting the clone.
	 */
	clone(): SensitiveBytes {
		return new SensitiveBytes(Uint8Array.from(this._atu8_data), this._kc_context);
	}


	/**
	 * Mutably clear the contents of this object and mark as destroyed.
	 */
	wipe(): void {
		// overwrite contents with 0x00
		this._atu8_data.fill(0);

		// mark as destroyed
		// @ts-expect-error for overriding all methods
		this.clone = this.wipe = this.diff = this.compare = this.mod = destroyed;

		// override getters
		Object.defineProperties(this, {
			data: {
				get: destroyed,
			},
			digits: {
				get: destroyed,
			},
		});
	}


	/**
	 * Left shift by the given number of bits, discarding excess bits shifted off to the left
	 * and adding new zero bits shifted in from the right.
	 */
	leftShift(ni_shift: number): SensitiveBytes {
		// invalid argument
		if(Number.isInteger(ni_shift) || ni_shift < 0) {
			// panic wipe
			this.wipe();

			// refuse operation
			throw new Error('Refusing to left shift by argument that is not a non-negative integer');
		}

		// no shift, just clone
		if(0 === ni_shift) return this.clone();

		// number of bytes
		const nb_digits_this = this._atu8_data.byteLength;

		// prep new buffer
		const atu8_output = new Uint8Array(nb_digits_this);

		// amount to shift in bytes
		const nb_shift = ni_shift >>> 3;
		
		// start with approximate subarray
		const atu8_sub = this._atu8_data.subarray(nb_shift);

		// remainder amount to left shift
		const ni_remainder = ni_shift % 8;

		// able to move bytes around
		if(0 === ni_remainder) {
			// set sub array in highest bit position
			atu8_output.set(atu8_sub);

			// return new instance
			return new SensitiveBytes(atu8_output);
		}

		// bitmask to truncate each byte
		const xm_truncate = 0xff >>> ni_remainder;

		// amount to right shift each byte in order to carry
		const ni_carry = 8 - ni_remainder;

		// each byte
		let ib_each = 0;
		for(; ib_each<nb_digits_this-1-nb_shift; ib_each++) {
			// this can be optimized
			atu8_output[ib_each] = ((atu8_sub[ib_each] & xm_truncate) << ni_remainder) | (atu8_sub[ib_each+1] >>> ni_carry);
		}
		
		// lowest byte has data
		if(0 === nb_shift) {
			atu8_output[ib_each] <<= ni_shift;
		}

		// return new instance
		return new SensitiveBytes(atu8_output);
	}


	/**
	 * Right shift by the given number of bits, discarding excess bits shifted off to the right
	 * and adding new zero bits shifted in from the left.
	 */
	rightShift(ni_shift: number): SensitiveBytes {
		// invalid argument
		if(Number.isInteger(ni_shift) || ni_shift < 0) {
			// panic wipe
			this.wipe();

			// refuse operation
			throw new Error('Refusing to left shift by argument that is not a non-negative integer');
		}

		// no shift, just clone
		if(0 === ni_shift) return this.clone();

		// ref data
		const atu8_data = this._atu8_data;

		// number of bytes
		const nb_digits_this = atu8_data.byteLength;

		// prep new buffer
		const atu8_output = new Uint8Array(nb_digits_this);

		// remainder amount to right shift
		const ni_remainder = ni_shift % 8;

		// amount to shift in bytes
		const nb_shift = ni_shift >>> 3;

		// able to move bytes around
		if(0 === ni_remainder) {
			// set sub array in appropriate bit position (allow excess bytes to be chopped off)
			atu8_output.set(atu8_data, nb_shift);

			// return new instance
			return new SensitiveBytes(atu8_output);
		}

		// start with approximate subarray
		const atu8_sub = atu8_data.subarray(0, nb_digits_this - (ni_shift >>> 3));

		// bitmask to truncate each byte
		const xm_truncate = (0xff >> ni_remainder) << ni_remainder;

		// amount to left shift each byte in order to carry
		const ni_carry = 8 - ni_remainder;

		// highest byte has data
		if(0 === nb_shift) {
			atu8_output[0] >>= ni_shift;
		}

		// each byte
		let ib_each = 1;
		for(; ib_each<nb_digits_this-1; ib_each++) {
			// check for accuracy
			atu8_output[ib_each] = ((atu8_sub[ib_each-1] << ni_carry) & 0xff) | (atu8_sub[ib_each] >>> ni_remainder);
		}

		// return new instance
		return new SensitiveBytes(atu8_output);
	}


	/**
	 * Perform byte-by-byte XOR with other instance.
	 */
	xor(kn_other: SensitiveBytes): SensitiveBytes {
		// ref data
		const atu8_data_this = this._atu8_data;
		const atu8_data_other = kn_other._atu8_data;

		// number of bytes
		const nb_digits_this = atu8_data_this.byteLength;

		// byte length discrepancy
		if(nb_digits_this !== atu8_data_other.byteLength) {
			// panic wipes
			this.wipe();
			kn_other.wipe();

			// refuse operation
			throw new Error('Refusing to XOR buffers of different byte length');
		}

		// prep new buffer
		const atu8_output = new Uint8Array(nb_digits_this);

		// xor one byte at a time
		for(let ib_each=0; ib_each<nb_digits_this; ib_each++) {
			atu8_output[ib_each] = atu8_data_this[ib_each] ^ atu8_data_other[ib_each];
		}

		// new instance
		return new SensitiveBytes(atu8_output);
	}


	/**
	 * Split a byte array into 'words' using the given delimiter
	 * @param xb_value the delimiter value to split by
	 * @returns list of words which will all be zeroed out when the parent instance is wiped
	 */
	split(xb_value: number): Uint8Array[] {
		const atu8_data = this.data;
		const nb_this = atu8_data.byteLength;

		// array of pointers to words as buffers
		const a_words = [];

		// byte index start of word
		let ib_start = 0;

		// each byte
		for(let ib_each=0; ib_each<nb_this; ib_each++) {
			// byte matches the target
			if(xb_value === atu8_data[ib_each]) {
				// without copying data, save a reference to the word
				a_words.push(atu8_data.subarray(ib_start, ib_each));

				// advanced the index for the start of the next word
				ib_start = ib_each + 1;
			}
		}

		// return list of words
		return a_words;
	}
}
