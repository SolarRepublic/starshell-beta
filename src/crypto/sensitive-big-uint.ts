import SensitiveBytes from './sensitive-bytes';


/**
 * Provides select big integer operations intended for sensitive data such as private key material.
 * Rather than allowing key material to possibly outlive garbage collection in memory by using hex strings
 * or BigInt during cryptographic operations, use Uint8Array in order to wipe all intermediate values by 
 * zeroing them out (overwriting all bytes with 0x00) immediately after use. Except for `wipe`, all instance
 * methods are immutable.
 * 
 * Byte order for integer encoding assumes big-endian, e.g., [0xDE, 0xAD, 0xBE, 0xEF] === 3735928559.
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
 * const sa = new SensitiveBigUint(a);
 * const sb = new SensitiveBigUint(b);
 * sa.times(sb);  // throws Error since `sa` is 32 bytes while `sb` is 64 bytes
 * ```
 * 
 * One consideration that should be made is whether timing attacks are part of the user's threat model.
 * It is unclear how, or even if, the methods employed by this data structure make it susceptible to
 * timing attacks.
 */
export default class SensitiveBigUint extends SensitiveBytes {
	/**
	 * Generate a cryptographically random value having the given number of bytes.
	 */
	static override random(nb_size: number): SensitiveBigUint {
		return new SensitiveBigUint(crypto.getRandomValues(new Uint8Array(nb_size)));
	}


	/**
	 * Convenience method for creating nil-initialized number of given size in bytes.
	 */
	static override empty(nb_size=0): SensitiveBigUint {
		return new SensitiveBigUint(new Uint8Array(nb_size));
	}


	/**
	 * Returns the max between two instances.
	 */
	static max(kn_a: SensitiveBigUint, kn_b: SensitiveBigUint): SensitiveBigUint {
		if(kn_a.gte(kn_b)) {
			return kn_a.clone();
		}
		else {
			return kn_b.clone();
		}
	}


	/**
	 * Returns the min between two instances.
	 */
	static min(kn_a: SensitiveBigUint, kn_b: SensitiveBigUint): SensitiveBigUint {
		if(kn_a.lte(kn_b)) {
			return kn_a.clone();
		}
		else {
			return kn_b.clone();
		}
	}


	/**
	 * Clone this instance so that it can be destroyed without affecting the clone.
	 */
	override clone(): SensitiveBigUint {
		return new SensitiveBigUint(Uint8Array.from(this.data));
	}


	/**
	 * Compare this int value to some other's.
	 */
	compare(kn_other: SensitiveBigUint): number {
		// ref data
		const atu8_data_this = this.data;

		// cache byte length
		const nb_digits_this = atu8_data_this.byteLength;

		// ref other's data
		const atu8_data_other = kn_other.data;

		// and cache its byte length
		const nb_digits_other = atu8_data_other.byteLength;

		// digit count discrepancy (this check happens at the top of all operations)
		if(nb_digits_other !== nb_digits_this) {
			// panic wipes
			this.wipe();
			kn_other.wipe();

			// refuse operation
			throw new Error('Refusing to compare buffers of different byte length');
		}

		// each byte in both buffers
		for(let ib_each=0; ib_each<nb_digits_this; ib_each++) {
			// cache byte values
			const xb_a = atu8_data_this[ib_each];
			const xb_b = atu8_data_other[ib_each];

			// values differ
			if(xb_a !== xb_b) {
				// this is greater
				if(xb_a > xb_b) {
					return 1;
				}
				// other is greater
				else {
					return -1;
				}
			}
		}

		// they are equal
		return 0;
	}


	/**
	 * Equal to other.
	 */
	eq(kn_other: SensitiveBigUint): boolean {
		return this.compare(kn_other) === 0;
	}


	/**
	 * Greater than other.
	 */
	gt(kn_other: SensitiveBigUint): boolean {
		return this.compare(kn_other) > 0;
	}


	/**
	 * Greater than or equal to other.
	 */
	gte(kn_other: SensitiveBigUint): boolean {
		return this.compare(kn_other) >= 0;
	}


	/**
	 * Less than other.
	 */
	lt(kn_other: SensitiveBigUint): boolean {
		return this.compare(kn_other) < 0;
	}


	/**
	 * Less than or equal to other
	 */
	lte(kn_other: SensitiveBigUint): boolean {
		return this.compare(kn_other) <= 0;
	}


	/**
	 * Calculate the absolute difference `|a - b|` between two values.
	 */
	diff(kn_other: SensitiveBigUint): SensitiveBigUint {
		// ref data
		const atu8_data_this = this.data;

		// cache byte length
		const nb_digits = atu8_data_this.byteLength;

		// compare to other
		const xc_compare = this.compare(kn_other);

		// wrong order
		if(xc_compare < 0) {
			return kn_other.diff(this);
		}
		// equal
		else if(0 === xc_compare) {
			return SensitiveBigUint.empty(nb_digits);
		}

		// ref other's data
		const atu8_data_other = kn_other.data;

		// prep output buffer
		const atu8_out = new Uint8Array(nb_digits);

		// borrow values
		let xb_borrow = 0;

		// each overlapping byte in both buffers from right to left
		for(let ib_each=nb_digits-1; ib_each>=0; ib_each--) {
			// calculate byte value difference
			let xb_diff = atu8_data_this[ib_each] - atu8_data_other[ib_each] - xb_borrow;

			// negative diff; borrow from next
			if(xb_diff < 0) {
				xb_diff += 0x100;
				xb_borrow = 1;
			}
			// non-negative diff; reset borrow
			else {
				xb_borrow = 0;
			}

			// set output
			atu8_out[ib_each] = xb_diff;
		}

		// wrap in object
		return new SensitiveBigUint(atu8_out);
	}


	/**
	 * Calculate this modulo of the given base (divisor).
	 */
	mod(kn_base: SensitiveBigUint): SensitiveBigUint {
		// ref data
		const atu8_data_this = this.data;

		// cache byte length
		const nb_digits_this = atu8_data_this.byteLength;

		// compare values
		let xc_compare = this.compare(kn_base);

		// base is greater in value; no need to compute modulo
		if(xc_compare < 0) {
			return this.clone();
		}
		// base is equal in value; modulo is zero
		else if(0 === xc_compare) {
			return SensitiveBigUint.empty(nb_digits_this);
		}

		// ref other's data
		const atu8_data_other = kn_base.data;

		// and cache its byte length
		const nb_digits_other = atu8_data_other.byteLength;


		// TODO: actually implement division otherwise it will hang


		// copy this value for rounds of division
		let kn_prev = this.clone();

		// while value is larger than base (divisor)
		for(;;) {
			// calculate difference
			const kn_diff = kn_prev.diff(kn_base);

			// wipe previous contents
			kn_prev.wipe();

			// compare values
			xc_compare = kn_diff.compare(kn_base);

			// within range
			if(xc_compare <= 0) {
				return kn_diff;
			}

			// repeat
			kn_prev = kn_diff;
		}
	}

	modulus(kn_divisor: SensitiveBigUint) {
		// ref data
		const atu8_data_this = this.data;

		// cache byte length
		const nb_digits_this = atu8_data_this.byteLength;

		// compare values
		let xc_compare = this.compare(kn_divisor);

		// base is greater in value; no need to compute modulo
		if(xc_compare < 0) {
			return this.clone();
		}
		// base is equal in value; modulo is zero
		else if(0 === xc_compare) {
			return SensitiveBigUint.empty(nb_digits_this);
		}

		// ref other's data
		const atu8_data_other = kn_divisor.data;

		// and cache its byte length
		const nb_digits_other = atu8_data_other.byteLength;
	}

}
