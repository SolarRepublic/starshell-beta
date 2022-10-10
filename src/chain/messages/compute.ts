import {JsonPreviewer} from '#/app/helper/json-previewer';
import {SecretWasm} from '#/crypto/secret-wasm';
import type {JsonObject} from '#/meta/belt';
import type {Bech32} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';
import {Chains} from '#/store/chains';
import {Providers} from '#/store/providers';
import {defer_many, is_dict} from '#/util/belt';
import {base64_to_buffer, buffer_to_hex, sha256_sync} from '#/util/data';
import type {Coin} from '@cosmjs/amino';
import type {AccessType} from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/types';
import type {CodeInfoResponse} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';
import type {SecretNetwork} from '../secret-network';
import type {MessageDict, SpendInfo} from './_types';
import {AminoJsonError, kv, MalforedMessageError} from './_util';

export const ComputeMessages: MessageDict = {

	'wasm/MsgStoreCode'(g_msg, {g_chain}) {
		const g_upload = g_msg as unknown as {
			sender: Bech32;
			wasm_byte_code: string;
			instantiate_permissions?: {
				permission: AccessType;
				addresses: Bech32[];
			};
		};

		const a_fields: FieldConfig[] = [
			kv('Code Size', `${Math.round(base64_to_buffer(g_upload.wasm_byte_code).byteLength / 1024 / 10) * 10} KiB`),
			kv('Code Hash', buffer_to_hex(sha256_sync(base64_to_buffer(g_upload.wasm_byte_code)))),
		];

		if(g_upload.instantiate_permissions) {
			a_fields.push(JsonPreviewer.render({
				Access: [
					'Unspecified',
					'Nobody',
					'Only Address',
					'Everybody',
					'Any of Addresses',
				][g_upload.instantiate_permissions.permission],
				Addresses: g_upload.instantiate_permissions.addresses,
			}, {
				chain: g_chain,
			}, {
				title: 'Permissions',
			}));
		}

		return {
			title: 'Upload Code',
			tooltip: `Uploads code to the chain in order to be used later when instantiatiating smart contracts.`,
			fields: a_fields,
		};
	},

	async 'wasm/MsgInstantiateContract'(g_msg, {g_chain, p_account}) {
		const g_instantiate = g_msg as unknown as {
			sender: Bech32;
			code_id: `${bigint}`;
			label: string;
			init_msg: string;
			init_funds: Coin[];
		};

		// ref init message json
		let sx_json = g_instantiate.init_msg;

		// secret wasm
		if(g_chain.features.secretwasm) {
			// decrypt secret wasm amino message
			({
				message: sx_json,
			} = await SecretWasm.decodeSecretWasmAmino(p_account, g_chain, g_instantiate.init_msg));
		}

		// parse message
		let h_instantiate: JsonObject;
		try {
			h_instantiate = JSON.parse(sx_json) as JsonObject;
		}
		catch(e_parse) {
			throw new AminoJsonError(sx_json);
		}

		// ref code id
		const si_instantiate = g_instantiate.code_id;


		// map spends
		const a_spends: SpendInfo[] = [];
		const a_init_funds = g_instantiate.init_funds;
		if(a_init_funds?.length) {
			a_spends.push({
				pfp: g_chain.pfp,
				amounts: a_init_funds.map(g_coin => Chains.summarizeAmount(g_coin, g_chain)),
			});
		}

		return {
			title: 'Instantiate Contract',
			tooltip: `Creates a new contract using some code that is already on chain (given by its Code ID). The configuration below will forever be part of the contract's internal settings.`,
			fields: [
				// render with deferred values
				JsonPreviewer.render((() => {
					// defer in batch
					// eslint-disable-next-line @typescript-eslint/unbound-method
					const {
						promises: h_promises,
						resolve: fk_resolve,
					} = defer_many({
						creator: '',
						codeHash: '',
						source: '',
					});

					// go async
					(async() => {
						// instantiate network
						const k_network = await Providers.activateDefaultFor(g_chain) as SecretNetwork;

						// lookup code info
						const g_code = await k_network.codeInfo(si_instantiate) || {} as CodeInfoResponse;

						// resolve in batch
						fk_resolve(g_code);
					})();

					// return placeholders
					return {
						'Code ID': si_instantiate,
						'Creator': h_promises.creator,
						'Code Hash': h_promises.codeHash,
						'Source': h_promises.source,
					};
				})(), {
					chain: g_chain,
				}, {
					title: 'Code Info',
				}),
				{
					type: 'key_value',
					key: 'Contract label',
					value: g_instantiate.label,
					long: true,
				},
				JsonPreviewer.render(h_instantiate, {
					chain: g_chain,
				}, {
					title: 'Configuration',
				}),
			],
			spends: a_spends,
		};
	},

	async 'wasm/MsgExecuteContract'(g_msg, {g_chain, p_account, g_app}) {
		const g_exec = g_msg as unknown as {
			msg: string;
			contract: Bech32;
			sent_funds: Coin[];
		};

		// ref init message json
		let sx_json = g_exec.msg;

		// secret wasm
		if(g_chain.features.secretwasm) {
			// decrypt secret wasm amino message
			({
				message: sx_json,
			} = await SecretWasm.decodeSecretWasmAmino(p_account, g_chain, g_exec.msg));
		}

		let h_exec: JsonObject;
		let si_action: string;
		let h_params: JsonObject;
		try {
			h_exec = JSON.parse(sx_json) as JsonObject;
			if(!is_dict(h_exec)) throw new MalforedMessageError('Top-level parsed JSON value is not an object', h_exec);

			si_action = Object.keys(h_exec)[0];

			h_params = h_exec[si_action] as JsonObject;
			if(!is_dict(h_params)) throw new MalforedMessageError('Nested parsed JSON value is not an object', h_params);
		}
		catch(e_parse) {
			throw new AminoJsonError(sx_json);
		}

		// map spends
		const a_spends: SpendInfo[] = [];
		const a_sent_funds = g_exec.sent_funds;
		if(a_sent_funds?.length) {
			a_spends.push({
				pfp: g_chain.pfp,
				amounts: a_sent_funds.map(g_coin => Chains.summarizeAmount(g_coin, g_chain)),
			});
		}

		return {
			title: 'Execute Contract',
			tooltip: `Asks the smart contract to perform some predefined action, given the inputs defined below.`,
			fields: [
				{
					type: 'contracts',
					bech32s: [g_exec.contract],
					g_app,
					g_chain,
				},
				kv('Action', si_action),
				JsonPreviewer.render(h_params, {
					chain: g_chain,
				}, {
					title: 'Inputs',
				}),
			],
		};
	},
};
