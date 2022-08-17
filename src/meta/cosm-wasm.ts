import type { JsonValue } from "#/util/belt";
import type { Bech32 as B32 } from "./chain";

/**
 * === _**@starshell/meta**_ ===
 * 
 * Unique symbol used to create opaque types for CosmWasm messages. {@link Cw}.
 */
declare const cw_type: unique symbol;

export type CwTypeRegistry = {
	string: {};
	number: {};
	whole_number: {};
	natural_number: {};
	decimal: {};
	unix_time: {};
	padding: {};

	Uint128: {};
	Bech32: {};
	ViewingKey: {};
	Coin: {};
	Amount: {};
};

export type CwTypeKey = keyof CwTypeRegistry;

export type Cw<
	w_primitive extends JsonValue=JsonValue,
	si_type extends CwTypeKey=CwTypeKey,
> = {
	[cw_type]: si_type;
} & w_primitive;

export namespace Cw {
	export type Decimal = Cw<`${bigint}`, 'decimal'>;

	export type String = Cw<`${string}`, 'string'>;

	// int53
	export type Number = Cw<number, 'number'>;

	export type WholeNumber = Cw<number, 'whole_number'>;

	export type NaturalNumber = Cw<number, 'natural_number'>;


	export type Padding = Cw<`${string}`, 'padding'>;

	export type UnixTime = Cw<number, 'unix_time'>;

	export type Uint128 = Cw<`${bigint}`, 'Uint128'>;

	export type Bech32 = Cw<B32.String, 'Bech32'>;

	export type ViewingKey = Cw<`${string}`, 'ViewingKey'>;

	export type Coin = Cw<{
		amount: Uint128;
		denom: String;
	}, 'Coin'>;

	export type Amount = Cw<`${Uint128}${String}`, 'Amount'>;
}
