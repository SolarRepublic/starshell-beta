import type {O} from 'ts-toolbelt';
import type {Type} from 'ts-toolbelt/out/Any/Type';

import type {Dict, JsonObject} from '#/meta/belt';
import type {Bech32} from '#/meta/chain';

import {
	MsgSend,
	MsgMultiSend,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';

import {
	MsgFundCommunityPool,
} from '@solar-republic/cosmos-grpc/dist/cosmos/distribution/v1beta1/tx';

import {
	Deposit,
	Proposal,
	TextProposal,
	WeightedVoteOption,
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/gov';

import {
	MsgSubmitProposal,
	MsgVote,
	MsgVoteWeighted,
	MsgDeposit,
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/tx';
import {ParameterChangeProposal} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/params';

import {TxBody} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import {CancelSoftwareUpgradeProposal, SoftwareUpgradeProposal} from '@solar-republic/cosmos-grpc/dist/cosmos/upgrade/v1beta1/upgrade';

import {
	MsgExecuteContract as SecretMsgExecuteContract,
	MsgInstantiateContract as SecretMsgInstantiateContract,
	MsgStoreCode as SecretMsgStoreCode,
} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/msg';

import {bech32_to_buffer, buffer_to_bech32} from '#/crypto/bech32';
import {is_dict, oderom} from '#/util/belt';
import {base64_to_buffer, buffer_to_base64} from '#/util/data';
import {camel_to_snake, snake_to_camel} from '#/util/format';


export interface CanonicalBase {
	// id: `/${'cosmos' | 'secret'}.${string}`;
	id: string;
	data: object;
	encode(): {
		typeUrl: string;
		value: Uint8Array;
	};
}

export interface TypedValue {
	type: string;
	value: JsonObject;
}

export interface ProtoMsg {
	typeUrl: string;
	value: Uint8Array;
}

type ProtoPrimitive = string | Uint8Array | ProtoObject;

interface ProtoObject { // eslint-disable-line
	[k: string]: ProtoPrimitive | ProtoPrimitive[];
}

export type ProtoData = Type<ProtoObject, 'proto-data'>;


interface Methods {
	fromPartial(g_partial: object): ProtoData;
	fromJSON(g_json: JsonObject): ProtoData;
	toJSON(g_data: ProtoData): JsonObject;
	encode(g_data: ProtoData): {
		finish(): Uint8Array;
	};
	decode(atu8_input: Uint8Array): ProtoData;
}


const A_SECRET_CALLBACKS = [
	'callbackSig',
	'callbackCodeHash',
];

const H_ROOT_DEFS = {
	cosmos: {
		groups: {
			'cosmos-sdk': {
				'bank.v1beta1': {
					MsgSend: {
						methods: MsgSend,
					},

					MsgMultiSend: {
						methods: MsgMultiSend,
					},
				},

				'distribution.v1beta1': {
					MsgFundCommunityPool: {
						methods: MsgFundCommunityPool,
					},
				},

				'gov.v1beta1': {
					MsgSubmitProposal: {
						methods: MsgSubmitProposal,
					},
					MsgVote: {
						methods: MsgVote,
					},
					MsgVoteWeighted: {
						methods: MsgVoteWeighted,
					},
					MsgDeposit: {
						methods: MsgDeposit,
					},

					TextProposal: {
						methods: TextProposal,
					},
					WeightedVoteOption: {
						methods: WeightedVoteOption,
					},
					Deposit: {
						methods: Deposit,
					},
					Proposal: {
						methods: Proposal,
					},
				},

				'params.v1beta1': {
					ParameterChangeProposal: {
						methods: ParameterChangeProposal,
					},
				},

				'upgrade.v1beta': {
					SoftwareUpgradeProposal: {
						methods: SoftwareUpgradeProposal,
					},
					CancelSoftwareUpgradeProposal: {
						methods: CancelSoftwareUpgradeProposal,
					},
				},

				'tx.v1beta1': {
					TxBody: {
						methods: TxBody,
					},
				},
			},
		},
	},

	secret: {
		groups: {
			wasm: {
				'compute.v1beta1': {
					MsgStoreCore: {
						methods: SecretMsgStoreCode,
					},
					MsgInstantiateContract: {
						methods: SecretMsgInstantiateContract,
						amino: {
							omit: A_SECRET_CALLBACKS,
						},
					},
					MsgExecuteContract: {
						methods: SecretMsgExecuteContract,
						amino: {
							omit: A_SECRET_CALLBACKS,
						},
					},
				},
			},
		},
	},
} as unknown as Dict<{
	groups: Dict<Dict<Dict<{
		methods: Methods;
		amino?: {
			omit?: string[];
		};
	}>>>;
}>;


const H_MAP_PROTO_TO_AMINO = oderom(H_ROOT_DEFS, (si_root, {groups:h_groups}) => oderom(
	h_groups, (si_alias: string, h_modules) => oderom(
		h_modules, (si_module: string, h_messages) => oderom(
			h_messages, (si_message: string, {amino:gc_amino}) => ({
				[`/${si_root}.${si_module}.${si_message}`]: {
					id: `${si_alias}/${si_message}`,
					config: (gc_amino || {}) as {
						omit: string[];
					},
				},
			})
		)
	)
));


const H_MAP_AMINO_TO_PROTO = oderom(H_MAP_PROTO_TO_AMINO, (si_proto, {id:si_amino}) => ({
	[si_amino]: si_proto,
})) as Dict;


const H_METHODS_PROTO = oderom(H_ROOT_DEFS, (si_root, {groups:h_groups}) => oderom(
	h_groups, (si_alias, h_modules) => oderom(
		h_modules, (si_module: string, h_messages) => oderom(
			h_messages, (si_message: string, {methods:y_methods}) => ({
				[`/${si_root}.${si_module}.${si_message}`]: y_methods,
			})
		)
	)
));



function recase_keys_snake_to_camel(g_object: Dict<any>, f_transform?: null | ((si_key: string, w_value: any) => any)): Dict<any> {
	return oderom(g_object, (si_key, z_value) => {
		const w_value = f_transform? f_transform(si_key, z_value): z_value;

		const w_recased = w_value instanceof Uint8Array
			? buffer_to_base64(w_value)
			: is_dict(w_value)
				? recase_keys_snake_to_camel(w_value, f_transform)
				: w_value;

		return {
			[snake_to_camel(si_key)]: w_recased,
		};
	});
}

export function amino_to_base(g_msg: TypedValue): CanonicalBase {
	const {
		type: si_msg,
		value: g_value,
	} = g_msg;

	const si_proto = H_MAP_AMINO_TO_PROTO[si_msg];
	if(si_proto && si_proto in H_METHODS_PROTO) {
		const y_methods = H_METHODS_PROTO[si_proto];

		const g_recased = recase_keys_snake_to_camel(g_value, (si_key, w_value) => {
			// replace bech32 with address buffer
			if('string' === typeof w_value && ['sender', 'recipient', 'contract'].includes(si_key)) {
				return bech32_to_buffer(w_value as Bech32);
			}

			// keep as-is
			return w_value;
		});

		const g_data = y_methods.fromJSON(g_recased);

		return {
			id: si_proto,
			data: g_data,
			encode: () => ({
				typeUrl: si_proto,
				value: y_methods.encode(g_data).finish(),
			}),
		};
	}

	throw new Error(`Unable to remap amino msg "${si_msg}" to proto`);
}

export function encode_proto<
	y_methods extends {
		fromPartial(g: object): any;
	},
>(y_methods: y_methods, g_partial: O.Partial<ReturnType<y_methods['fromPartial']>, 'deep'>): Uint8Array {
	return (y_methods as unknown as Methods).encode((y_methods as unknown as Methods).fromPartial(g_partial)).finish();
}


const A_ADDRESSABLE_KEYS = ['sender', 'recipient', 'contract'];

function recase_item_camel_to_snake(w_value: any, f_transform?: null | ((si_key: string | number, w_value: any) => any)) {
	return is_dict(w_value) && !(w_value instanceof Uint8Array)
		? recase_keys_camel_to_snake(w_value, f_transform)
		: Array.isArray(w_value)
			? w_value.map((w_item, i_item) => f_transform
				? f_transform(i_item, w_item)
				: recase_item_camel_to_snake(w_item, f_transform))
			: w_value;
}

function recase_keys_camel_to_snake(g_object: Dict<any>, f_transform?: null | ((si_key: string | number, w_value: any) => any)): Dict<any> {
	return oderom(g_object, (si_key, z_value) => {
		const w_value = f_transform? f_transform(si_key, z_value): z_value;

		return {
			[camel_to_snake(si_key)]: recase_item_camel_to_snake(w_value, f_transform),
		};
	});
}

export function proto_to_amino<
	g_amino extends TypedValue=TypedValue,
>(g_msg: ProtoMsg, s_hrp: string | null): g_amino {
	const {
		typeUrl: si_proto,
		value: atu8_value,
	} = g_msg;

	if(si_proto in H_METHODS_PROTO) {
		const y_methods = H_METHODS_PROTO[si_proto];

		if(si_proto in H_MAP_PROTO_TO_AMINO) {
			const {
				id: si_amino,
				config: gc_amino,
			} = H_MAP_PROTO_TO_AMINO[si_proto];

			const g_decoded = y_methods.decode(atu8_value);

			const g_json = y_methods.toJSON(g_decoded);

			for(const si_delete of gc_amino.omit || []) {
				delete g_json[si_delete];
			}

			// recase dict keys
			const g_recased = recase_keys_camel_to_snake(g_json, s_hrp? (z_key, w_value) => {
				// sub message
				if(is_dict(w_value) && 'string' === typeof w_value.typeUrl && 'undefined' !== typeof w_value.value) {
					if('string' === typeof w_value.value) {
						return proto_to_amino({
							typeUrl: w_value.typeUrl,
							value: base64_to_buffer(w_value.value),
						}, s_hrp);
					}
					else {
						throw new Error(`Uncertain how to parse typed value with non-string value type: %o`, w_value);
					}
				}

				// object
				if('string' === typeof z_key) {
					// replace address buffer with bech32
					if('string' === typeof w_value && A_ADDRESSABLE_KEYS.includes(z_key)) {
						return buffer_to_bech32(base64_to_buffer(w_value), s_hrp);
					}
				}

				// keep as-is
				return w_value;
			}: null);

			return {
				type: si_amino,
				value: JSON.parse(JSON.stringify(g_recased)) as JsonObject,
			} as g_amino;
		}
	}

	throw new Error(`Unable to remap proto msg "${si_proto}" to amino`);
}
