import type {DescribedMessage, MessageDict, SpendInfo} from './_types';

import type {Coin} from '@cosmjs/amino';
import type {AccessType} from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/types';
import type {CodeInfoResponse} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';

import type {JsonObject} from '#/meta/belt';
import type {Bech32} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';
import type {Snip24PermitMsg} from '#/schema/snip-24-def';

import {AminoJsonError, kv, MalforedMessageError} from './_util';

import {H_SNIP_HANDLERS} from './snip';
import {SecretNetwork} from '../secret-network';

import {JsonPreviewer} from '#/app/helper/json-previewer';
import {SecretWasm} from '#/crypto/secret-wasm';

import {R_SCRT_COMPUTE_ERROR} from '#/share/constants';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Providers} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {defer_many, is_dict, proper} from '#/util/belt';
import {base64_to_buffer, buffer_to_hex, buffer_to_text, sha256_sync} from '#/util/data';
import {abbreviate_addr} from '#/util/format';
import { dd } from '#/util/dom';
import { svelte_to_dom } from '#/app/svelte';
import PfpDisplay from '#/app/frag/PfpDisplay.svelte';
import type { MsgEventRegistry } from '#/meta/incident';


interface ExecContractMsg {
	contract: Bech32;
	msg: string;
	sent_funds: Coin[];
}

export const ComputeMessages: MessageDict = {
	query_permit(g_msg, {g_chain, p_app, g_app}) {
		const g_permit = g_msg as Snip24PermitMsg['value'];

		return {
			describe() {
				return {
					title: 'Sign Query Permit',
					tooltip: 'Allows apps to view private data such as your token balance, ownership, etc. Scope and permissions are unique to each permit.',
					fields: [
						{
							type: 'key_value',
							key: 'Permissions',
							value: g_permit.permissions.map(proper).join(', '),
						},
						{
							type: 'key_value',
							key: 'Permit name',
							value: g_permit.permit_name,
						},
						{
							type: 'contracts',
							label: 'Tokens allowed to be queried',
							bech32s: g_permit.allowed_tokens,
							g_app,
							g_chain,
						},
					],
				} as DescribedMessage;
			},

			approve(si_txn) {
				return {
					query_permits: [{
						secret: Secrets.pathFrom({
							type: 'query_permit',
							uuid: SecretNetwork.uuidForQueryPermit(g_chain, g_permit.permit_name),
						}),
						action: {
							created: {
								app: p_app,
							},
						},
					}],
				};
			},
		};
	},

	'wasm/MsgStoreCode'(g_msg, {g_chain}) {
		const g_upload = g_msg as unknown as {
			sender: Bech32;
			wasm_byte_code: string;
			instantiate_permissions?: {
				permission: AccessType;
				addresses: Bech32[];
			};
		};

		return {
			describe() {
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

		return {
			describe() {
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
		};
	},

	async 'wasm/MsgExecuteContract'(g_msg, g_context) {
		// cast msg arg
		const g_exec = g_msg as unknown as ExecContractMsg;

		// destructure context arg
		const {
			g_chain,
			g_account,
			g_app,
			p_app,
		} = g_context;

		// ref init message json
		let sx_json = g_exec.msg;

		// prep nonce if on secret
		let atu8_nonce: Uint8Array;

		// secret wasm
		const g_secret_wasm = g_chain.features.secretwasm;
		if(g_secret_wasm) {
			// decrypt secret wasm amino message
			({
				message: sx_json,
				nonce: atu8_nonce,
			} = await SecretWasm.decryptMsg(g_account, g_chain, base64_to_buffer(sx_json)));
		}

		let h_exec: JsonObject;
		let si_action: string;
		let h_args: JsonObject;
		try {
			h_exec = JSON.parse(sx_json) as JsonObject;

			if(!is_dict(h_exec)) throw new MalforedMessageError('Top-level parsed JSON value is not an object', h_exec);

			si_action = Object.keys(h_exec)[0];

			h_args = h_exec[si_action] as JsonObject;
			if(!is_dict(h_args)) throw new MalforedMessageError('Nested parsed JSON value is not an object', h_args);
		}
		catch(e_parse) {
			throw new AminoJsonError(sx_json);
		}

		const sa_contract = g_exec.contract;

		const p_contract = Contracts.pathFor(g_context.p_chain, sa_contract);

		const g_contract = await Contracts.at(p_contract);

		const s_contract = g_contract?.name || abbreviate_addr(sa_contract);

		const a_sent_funds = g_exec.sent_funds;

		// map spends
		const a_spends: SpendInfo[] = [];
		if(a_sent_funds?.length) {
			a_spends.push({
				pfp: g_chain.pfp,
				amounts: a_sent_funds.map(g_coin => Chains.summarizeAmount(g_coin, g_chain)),
			});
		}

		return {
			async affects(h_events) {
				// on secret-wasm
				if(g_secret_wasm) {
					// contract
					const g_handled = await H_SNIP_HANDLERS[si_action]?.(h_args, g_context, g_exec);
					return await g_handled?.affects?.(h_events);
				}
			},

			describe() {
				return {
					title: 'Execute Contract',
					tooltip: `Asks the smart contract to perform some predefined action, given the inputs defined below.`,
					fields: [
						{
							type: 'contracts',
							bech32s: [g_exec.contract],
							label: 'Contract',
							g_app,
							g_chain,
						},
						kv('Action', si_action),
						JsonPreviewer.render(h_args, {
							chain: g_chain,
						}, {
							title: 'Inputs',
							unlabeled: true,
						}),
					],
					spends: a_spends,
				};
			},

			approve: () => ({
				executions: [
					{
						contract: g_exec.contract,
						msg: h_exec,
					},
				],
			}),

			async apply(nl_msgs, si_txn) {
				// on secret-wasm
				if(g_secret_wasm) {
					// contract
					const g_handled = await H_SNIP_HANDLERS[si_action]?.(h_args, g_context, g_exec);
					const g_applied = await g_handled?.apply?.(si_txn);

					// snip token
					if(g_applied) return g_applied;
				}

				return {
					group: nl => `Contract${1 === nl? '': 's'} Executed`,
					title: '🟢 Contract Executed',
					text: `${s_contract} → ${si_action} on ${g_chain.name}`,
				};
			},

			async review(b_pending, b_incoming) {
				let g_review = {};

				// on secret-wasm
				if(g_secret_wasm) {
					// contract 
					const g_handled = await H_SNIP_HANDLERS[si_action]?.(h_args, g_context, g_exec);
					g_review = await g_handled?.review?.(b_pending, b_incoming);
				}

				const a_funds_dom: HTMLSpanElement[] = [];
				if(a_spends?.length) {
					for(const g_spend of a_spends) {
						a_funds_dom.push(dd('span', {
							class: 'global_flex-auto',
							style: `
								gap: 6px;
							`,
						}, [
							await svelte_to_dom(PfpDisplay, {
								resource: g_chain,
								dim: 16,
							}, 'loaded'),
							g_spend.amounts.join(' + '),
						]));
					}
				}

				// merge with snip review
				return {
					title: `Execut${b_pending? 'ing': 'ed'} Contract`,
					infos: [
						`${s_contract.replace(/\s+((smart\s+)?contract|token|minter|d?app)$/i, '')} → ${si_action} on ${g_chain.name}`,
					],
					resource: g_contract,
					...g_review,
					fields: [
						...a_spends.length? [
							{
								type: 'key_value',
								key: 'Sent funds',
								value: dd('div', {
									class: `global_flex-auto`,
									style: `
										flex-direction: column;
									`,
								}, a_funds_dom),
							},
						]: [],
						{
							type: 'contracts',
							bech32s: [sa_contract],
							g_app,
							g_chain,
							label: 'Token / Contract',
						},
						{
							type: 'key_value',
							key: 'Action',
							value: si_action,
						},
						...g_review?.['fields'] || [
							JsonPreviewer.render(h_args, {
								chain: g_chain,
							}, {
								label: 'Inputs',
							}),
						],
					],
				};
			},

			async fail(nl_msgs, g_result) {
				debugger;

				// secret
				if(g_chain.features.secretwasm) {
					// parse contract error
					const m_error = R_SCRT_COMPUTE_ERROR.exec(g_result.log || '')!;
					if(m_error) {
						const [, , sxb64_error_ciphertext] = m_error;

						const atu8_ciphertext = base64_to_buffer(sxb64_error_ciphertext);

						// use nonce to decrypt
						const atu8_plaintext = await SecretWasm.decryptBuffer(g_account, g_chain, atu8_ciphertext, atu8_nonce);

						// utf-8 decode
						const sx_plaintext = buffer_to_text(atu8_plaintext);

						// parse json
						try {
							const g_error = JSON.parse(sx_plaintext);

							const w_msg = g_error.generic_err?.msg || sx_plaintext;

							// ⛔ 📩 ❌ 🚫 🪃 ⚠️
							return {
								title: '⚠️ Contract Denied Request',
								message: `${s_contract}: ${w_msg}`,
							};
						}
						catch(e) {}
					}
				}
			},
		};
	},
};
