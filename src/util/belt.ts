import type { PlainObject } from "#/meta/belt";

/**
 * Shortcut for a very common type pattern
 */
export type Dict<w_value=string> = Record<string, w_value>;


/**
 * Shortcut for another common type pattern
 */
export type Promisable<w_value> = w_value | Promise<w_value>;


/**
 * Root type for all objects considered to be parsed JSON objects
 */
export interface JsonObject {  // eslint-disable-line
	[k: string]: JsonValue | undefined;
}

/**
 * Union of "valuable", primitive JSON value types
 */
export type JsonPrimitive =
	| boolean
	| number
	| string;

/**
 * All primitive JSON value types
 */
export type JsonPrimitiveNullable =
	| JsonPrimitive
	| null;

/**
 * All JSON value types
 */
export type JsonValue =
	| JsonPrimitiveNullable
	| JsonValue[]
	| JsonObject
	| undefined;


/**
 * The frequently-used "no-operation" function
 */
export const F_NOOP = () => {};  // eslint-disable-line


/**
 * Creates a proper-case string
 */
export const proper = (s_input: string): string => s_input.split(/\s+/g).map(s => s[0].toUpperCase()+s.slice(1)).join(' ');


/**
 * Compares two objects using keys and strict equality.
 */
export function objects_might_differ(h_a: PlainObject, h_b: PlainObject): boolean {
	const a_keys_a = Object.keys(h_a);
	const a_keys_b = Object.keys(h_b);

	const nl_keys = a_keys_a.length;

	if(nl_keys !== a_keys_b.length) return true;

	for(const si_key in h_a) {
		if(h_b[si_key] !== h_a[si_key]) return true;
	}

	return false;
}


/**
 * Fold array into an object
 */
export function fold<w_out, w_value>(a_in: w_value[], f_fold: (z_value: w_value, i_each: number) => Dict<w_out>): Dict<w_out> {
	const h_out = {};
	let i_each = 0;
	for(const z_each of a_in) {
		Object.assign(h_out, f_fold(z_each, i_each++));
	}

	return h_out;
}



/**
 * Escape all special regex characters to turn a string into a verbatim match pattern
 * @param s_input input string
 * @returns escaped string ready for RegExp constructor
 */
export const escape_regex = (s_input: string): string => s_input.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');


/**
 * Typed alias to `Object.entries`
 */
export function ode<
	h_object extends Record<string, any>,
	as_keys extends keyof h_object=keyof h_object,
>(h_object: h_object): Array<[as_keys, h_object[as_keys]]> {
	return Object.entries(h_object) as Array<[as_keys, h_object[as_keys]]>;
}

	// (o: {
	// 	[si_key in as_keys]: w_value;
	// }): {
	// 	[si_key in as_keys]: {
	// 		key: si_key;
	// 		value: w_value;
	// 	};
	// }[as_keys] extends infer as_pairs
	// 	? as_pairs extends {key: as_keys; value: w_value}
	// 		? Union.ListOf<as_pairs>
	// 		: never
	// 	: never;
// };

// const check = ode({a: '1', b: '2'} as const);

/**
 * Typed alias to `Object.fromEntries`
 */
export function ofe<
	as_keys extends string=string,
	w_values extends any=any,
>(a_entries: Array<[as_keys, w_values]>): Record<as_keys, w_values> {
	return Object.fromEntries(a_entries) as Record<as_keys, w_values>;
}


/**
 * Helper type for defining the expected type for `[].reduce` alias
 */
type ReduceParameters<
	w_value extends any=any,
> = Parameters<Array<w_value>['reduce']>;


/**
 * Reduce object entries to an arbitrary type
 */
export function oder<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_reduce: ReduceParameters[0], w_init: w_out): w_out {
	return ode(h_thing).reduce(f_reduce, w_init) as w_out;
}


/**
 * Reduce object entries to an array via concatenation
 */
export function oderac<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_concat: (si_key: string, w_value: w_value, i_entry: number) => w_out, b_add_undefs=false): w_out[] {
	return ode(h_thing).reduce((a_out, [si_key, w_value], i_entry) => [
		...a_out,
		f_concat(si_key, w_value, i_entry),
	], []);
}


/**
 * Reduce object entries to an array via flattening
 */
export function oderaf<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_concat: (si_key: string, w_value: w_value, i_entry: number) => w_out[]): w_out[] {
	return ode(h_thing).reduce((a_out, [si_key, w_value], i_entry) => [
		...a_out,
		...f_concat(si_key, w_value, i_entry),
	], []);
}


/**
 * Reduce object entries to an object via merging
 */
export function oderom<
	w_out extends any,
	h_thing extends Record<string | symbol, any>,
	as_keys_in extends keyof h_thing,
	w_value_in extends h_thing[as_keys_in],
	as_keys_out extends string | symbol,
>(h_thing: h_thing, f_merge: (si_key: as_keys_in, w_value: w_value_in) => Record<as_keys_out, w_out>): Record<as_keys_out, w_out> {
	return ode(h_thing).reduce((h_out, [si_key, w_value]) => ({
		...h_out,
		...f_merge(si_key as as_keys_in, w_value),
	}), {}) as Record<as_keys_out, w_out>;
}


/**
 * Reduce object entries to an object via transforming value function
 */
export function fodemtv<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_transform: (w_value: w_value, si_key?: string) => w_out): Dict<w_out> {
	return Object.fromEntries(
		ode(h_thing).map(([si_key, w_value]) => [si_key, f_transform(w_value, si_key)])
	);
}


/**
 * Promise-based version of `setTimeout()`
 */
export function timeout(xt_wait: number): Promise<void> {
	return new Promise((fk_resolve) => {
		setTimeout(() => {
			fk_resolve();
		}, xt_wait);
	});
}


/**
 * A Promise that never fulfills nor rejects
 */
export function forever<w_type=void>(w_type?: w_type): Promise<w_type> {
	return new Promise(F_NOOP);
}


/**
 * Promse-based version of `queueMicrotask()`
 */
export function microtask(): Promise<void> {
	return new Promise((fk_resolve) => {
		queueMicrotask(() => {
			fk_resolve();
		});
	});
}


/**
 * Cryptographically strong random number
 */
export const crypto_random = (): number => crypto.getRandomValues(new Uint32Array(1))[0] / (2**32);


/**
 * Generate a random int within a given range
 */
export function random_int(x_a: number, x_b=0): number {
	const x_min = Math.ceil(Math.min(x_a));
	const x_max = Math.floor(Math.max(x_b));

	// confine to range
	return Math.floor(Math.random() * (x_max - x_min + 1)) + x_min;
}


/**
 * Generate a cryptographically strong random int within a given range
 */
export function crypto_random_int(x_a: number, x_b=0): number {
	const x_min = Math.ceil(Math.min(x_a));
	const x_max = Math.floor(Math.max(x_b));

	// confine to range
	return Math.floor(crypto_random() * (x_max - x_min + 1)) + x_min;
}


/**
 * Shuffles an array
 */
export function shuffle<w_value>(a_items: w_value[], f_random=random_int): w_value[] {
	let i_item = a_items.length;

	while(i_item > 0) {
		const i_swap = f_random(--i_item);
		const w_item = a_items[i_item];
		a_items[i_item] = a_items[i_swap];
		a_items[i_swap] = w_item;
	}

	return a_items;
}

