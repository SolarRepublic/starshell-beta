import {syserr} from '#/app/common';
import {SecretWasm} from '#/crypto/secret-wasm';
import type {AccountPath} from '#/meta/account';
import type {AppChainConnection, AppInterface, AppPath} from '#/meta/app';
import type {JsonArray, JsonObject, Promisable} from '#/meta/belt';
import type {Bech32, ChainInterface, ChainPath} from '#/meta/chain';
import type {SecretInterface} from '#/meta/secret';
import type {Vocab} from '#/meta/vocab';
import type {AdaptedAminoResponse, AdaptedStdSignDoc, GenericAminoMessage} from '#/schema/amino';
import type {Snip24Permission, Snip24PermitMsg} from '#/schema/snip-24';
import {Snip24} from '#/schema/snip-24-const';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Networks} from '#/store/networks';
import {Secrets} from '#/store/secrets';
import {is_dict, ode} from '#/util/belt';
import {base93_to_buffer, buffer_to_base93, buffer_to_json} from '#/util/data';
import {uuid_v4} from '#/util/dom';
import type {IcsToService} from './messages';
import {open_flow, RegisteredFlowError} from './msg-flow';
import {page_info_from_sender, position_widow_over_tab} from './service-apps';

interface Resolved {
	app: AppInterface;
	appPath: AppPath;
	connection: AppChainConnection;
}

type AminoRequest = Vocab.MessageValue<IcsToService.AppVocab, 'requestCosmosSignatureAmino'>;

type AminoFlowCallback = (g_sanitized: AdaptedStdSignDoc, si_preset: string) => Promisable<AdaptedAminoResponse | undefined>;

async function use_secret_wasm<
	w_return extends any,
>(p_chain: ChainPath, p_account: AccountPath, fk_use: (k_wasm: SecretWasm) => Promisable<w_return>): Promise<w_return> {
	const g_chain = (await Chains.at(p_chain))!;

	let atu8_consensus_io_pk: Uint8Array;

	// load existing consensus pubkey
	const sx_consensus_io_pk = g_chain?.features.secretwasm?.consensusIoPubkey;
	if(sx_consensus_io_pk) {
		atu8_consensus_io_pk = base93_to_buffer(sx_consensus_io_pk);
	}
	// need to fetch consensus pubkey
	else {
		const k_network = await Networks.activateDefaultFor(g_chain);

		const atu8_cert = await k_network.secretConsensusIoPubkey();

		atu8_consensus_io_pk = SecretWasm.extractConsensusIoPubkey(atu8_cert);

		// serialize pubkey and save to cached object
		g_chain.features = {
			...g_chain.features,
			secretwasm: {
				...g_chain.features.secretwasm,
				consensusIoPubkey: buffer_to_base93(atu8_consensus_io_pk),
			},
		};

		// save to store
		await Chains.open(ks => ks.put(g_chain));
	}

	// fetch account's tx encryption seed
	const g_account = (await Accounts.at(p_account))!;
	const p_secret_wasm = g_account.utilityKeys.secretWasmTx;

	if(!p_secret_wasm) {
		throw syserr({
			title: 'No tx encryption seed',
			text: `Account "${p_account}" is missing a Secret WASM transaction encryption seed.`,
		});
	}

	// instantiate
	const k_wasm = await Secrets.borrowPlaintext(p_secret_wasm, kn_txk => new SecretWasm(atu8_consensus_io_pk, kn_txk.data));

	// attempt to use
	let w_return: w_return;
	try {
		w_return = await fk_use(k_wasm);
	}
	// no matter what happens; destroy wasm instance
	finally {
		k_wasm.destroy();
	}

	// return whatever the caller wanted
	return w_return;
}


const validation_error = (s: string) => new Error(s);

const JsonValidator = {
	object<w_subtype extends JsonObject=JsonObject>(g_thing: unknown, s_info: string): w_subtype {
		if(!is_dict(g_thing)) {
			throw validation_error(`JSON item should be plain object at ${s_info}`);
		}

		return g_thing as w_subtype;
	},

	array<w_subtype extends JsonArray=JsonArray>(a_thing: unknown, s_info: string): w_subtype {
		if(!Array.isArray(a_thing)) {
			throw validation_error(`JSON item should be an array at ${s_info}`);
		}

		return a_thing as w_subtype;
	},

	string<w_subtype extends string=string>(s_thing: unknown, s_info: string): w_subtype {
		if('string' !== typeof s_thing) {
			throw validation_error(`JSON item should be a string at ${s_info}`);
		}

		return s_thing as w_subtype;
	},
};



const H_AMINO_SANITIZERS = {
	async query_permit(g_request: AminoRequest, g_resolved: Resolved, g_chain: ChainInterface, fk_flow: AminoFlowCallback) {
		// guaranteed to only be one message
		const g_msg = g_request.doc.msgs[0];

		// validate query permit
		const g_value = JsonValidator.object<GenericAminoMessage['value']>(g_msg.value, `query permit's .value`);

		// name
		const s_name = JsonValidator.string(g_value.permit_name, `query permit's .permit_name`);

		// allowed_tokens
		const as_tokens = new Set<Bech32>();
		{
			const a_tokens = JsonValidator.array(g_value.allowed_tokens, `query permit's .value.allowed_tokens`);
			for(const z_entry of a_tokens) {
				// validate each entry
				const sa_token = JsonValidator.string<Bech32>(z_entry, `query permit's .value.allowed_tokens[], which contains a value that is not a string`);

				// token address is incompatible with chain
				if(!Chains.isValidAddressFor(g_chain, sa_token)) {
					throw validation_error(`Token address ${sa_token} is not a compatible bech32 with ${Chains.caip2From(g_chain)}`);
				}

				// accept
				as_tokens.add(sa_token);
			}
		}

		// permissions
		const as_permissions = new Set<Snip24Permission>();
		{
			const a_permissions = JsonValidator.array(g_msg.value.permissions, `query permit's .value.permissions`);
			for(const z_entry of a_permissions) {
				// validate each entry
				const si_permission = JsonValidator.string<Snip24Permission>(z_entry, `query permit's .value.permissions[], which contains a value that is not a string`);

				// // assert enum value
				// if(!Snip24.PERMISSIONS.includes(si_permission)) {
				// 	throw flow_error('EnumViolation', {
				// 		interface: 'SNIP-24',
				// 		actual: si_permission,
				// 		expected: Snip24.PERMISSIONS,
				// 	});
				// }

				// add to set
				as_permissions.add(si_permission);
			}
		}

		// type-check sanitized and canonicalized msg
		const g_permit_msg: Snip24PermitMsg = {
			type: 'query_permit',
			value: {
				permit_name: s_name,
				allowed_tokens: [...as_tokens].sort(),
				permissions: [...as_permissions].sort(),
			},
		};

		// search for existing permit
		const a_permits = await Secrets.filter({
			type: 'query_permit',
			chain: g_request.chainPath,
			name: s_name,
		});

		// a permit with the same name already exists on this chain
		CONSOLIDATE_PERMIT:
		if(a_permits.length) {
			const g_secret = a_permits[0] as SecretInterface<'query_permit'>;

			// contracts
			const h_contracts = g_secret.contracts;
			CHECK_REVOKED: {
				const a_entries = Object.entries(h_contracts);
				const a_revoked = a_entries.filter(([, si]) => si);

				// none of the contracts have revoked the permit
				if(!a_revoked.length) break CHECK_REVOKED;

				// permit has been revoked from all involved contracts
				if(a_entries.length === a_revoked.length) {
					// forcibly change the name
					g_permit_msg.value.permit_name += '_'+uuid_v4().slice(0, 6);
					break CONSOLIDATE_PERMIT;
				}

				// permit has been revoked from one of the involved contracts, but not all
				// TODO: prompt for decision about revoking from others

				// in the meantime, just change the name
				g_permit_msg.value.permit_name += '_'+uuid_v4().slice(0, 6);
				break CONSOLIDATE_PERMIT;
			}

			// serialize permit parameters
			const s_contracts_a = JSON.stringify(Object.keys(h_contracts).sort());
			const s_contracts_b = JSON.stringify(g_permit_msg.value.allowed_tokens);
			const s_permissions_a = JSON.stringify(g_secret.permissions);
			const s_permissions_b = JSON.stringify(g_permit_msg.value.permissions);

			// identical contracts
			if(s_contracts_a === s_contracts_b) {
				// identical permissions
				if(s_permissions_a === s_permissions_b) {
					// same app
					if(g_secret.app === g_resolved.appPath) {
						// return existing permit
						return await Secrets.borrowPlaintext(Secrets.pathFrom(g_secret), kn => buffer_to_json(kn.data)) as AdaptedAminoResponse;
					}
					// different app
					else {
						// ask if OK to share
						// TODO: implement
					}
				}
				// different permissions
				else {
					// additional permissions

					// less permissions
				}
			}
			// different contracts
			else {
				// search for intersection
				INTERSECTION: {
					for(const sa_contract of g_secret.contracts) {
						// there is an intersection of contracts
						if(as_tokens.has(sa_contract)) {
							// stop searching
							break INTERSECTION;
						}
					}

					// no intersection
				}
			}
		}

		return fk_flow(Snip24.construct(g_chain.reference, g_permit_msg), 'snip24');
	},
};



function sanitize_amino(
	g_request: AminoRequest,
	g_resolved: Resolved,
	g_chain: ChainInterface,
	fk_flow: AminoFlowCallback
) {
	// validate doc is dict
	const g_doc_dirty = JsonValidator.object<AdaptedStdSignDoc>(g_request.doc, 'top-level StdSignDoc');

	// destructure doc
	const {
		msgs: a_msgs=[],
		chain_id: si_chain,
	} = g_doc_dirty;

	// validate
	JsonValidator.array(a_msgs, '.msgs');
	JsonValidator.string(si_chain, '.chain_id');

	// single message
	if(1 === a_msgs.length) {
		const g_msg = a_msgs[0];

		// ref message type
		const si_type = g_msg.type;

		// 
		if(H_AMINO_SANITIZERS[si_type]) {
			return H_AMINO_SANITIZERS[si_type](g_request, g_resolved, g_chain, fk_flow);
		}
	}

	return fk_flow(g_request.doc, '');
}

/**
 * message handlers for the public vocab from ICS
 */
export const H_HANDLERS_ICS_APP: Vocab.HandlersChrome<IcsToService.AppVocab, any, [Resolved], true> = {

	async requestCosmosSignatureAmino(g_request, g_resolved, g_sender) {
		const p_chain = Chains.pathFor('cosmos', g_request.doc.chain_id);

		if(g_request.chainPath !== p_chain) {
			throw validation_error(`Mismatched chain_id and connection chain`);
		}

		const g_chain = await Chains.at(p_chain);

		if(!g_chain) {
			throw new Error(`Missing chain`);
		}

		const p_account = g_request.accountPath;

		// sanitize amino doc
		return await sanitize_amino(g_request, g_resolved, g_chain, async(g_doc: AdaptedStdSignDoc, si_preset?: string) => {
			let g_result: AdaptedAminoResponse;
			let b_approved: boolean;
			try {
				({
					answer: b_approved,
					data: g_result,
				} = await open_flow({
					flow: {
						type: 'signAmino',
						value: {
							props: {
								preset: si_preset,
								amino: g_doc,
							},
							appPath: g_resolved.appPath,
							chainPath: p_chain,
							accountPath: p_account,
						},
						page: page_info_from_sender(g_sender),
					},
					open: await position_widow_over_tab(g_sender.tab!.id!),
				}));
			}
			catch(e_flow) {
				if(e_flow instanceof RegisteredFlowError) {
					debugger;
				}

				debugger;
				// TODO: return error to app
				throw e_flow;
			}

			debugger;
			// signature was approved
			if(b_approved) {
				return g_result;
			}
		});
	},

	async requestCosmosSignatureDirect(g_request, g_resolved, g_sender) {
		const {answer:b_approved} = await open_flow({
			flow: {
				type: 'signTransaction',
				value: {
					accountPath: g_request.accountPath,
					doc: g_request.doc,
				},
				page: page_info_from_sender(g_sender),
			},
			open: await position_widow_over_tab(g_sender.tab!.id!),
		});

		console.log(g_request);
		debugger;
	},


	async requestAddTokens(g_request, g_resolved, g_sender) {
		const {answer:b_approved} = await open_flow({
			flow: {
				type: 'addSnip20s',
				value: {
					appPath: Apps.pathFrom(g_resolved.app),
					chainPath: g_request.chainPath,
					accountPath: g_request.accountPath,
					bech32s: g_request.bech32s,
				},
				page: page_info_from_sender(g_sender),
			},
			open: await position_widow_over_tab(g_sender.tab!.id!),
		});

		if(b_approved) {
			return void 0;
		}
		else {
			throw new Error('Request rejected');
		}
	},

	async requestEncrypt(g_encrypt, g_resolved, g_sender) {
		return await use_secret_wasm(g_encrypt.chainPath, g_encrypt.accountPath, async(k_wasm) => {
			// encrypt
			const atu8_ciphertext = await k_wasm.encrypt(g_encrypt.codeHash, g_encrypt.exec);

			// return serialized ciphertext
			return buffer_to_base93(atu8_ciphertext);
		});
	},

	async requestDecrypt(g_decrypt, g_resolved, g_sender) {
		return await use_secret_wasm(g_decrypt.chainPath, g_decrypt.accountPath, async(k_wasm) => {
			// decrypt
			const atu8_plaintext = await k_wasm.decrypt(base93_to_buffer(g_decrypt.ciphertext), base93_to_buffer(g_decrypt.nonce));

			// return serialized plaintext
			return buffer_to_base93(atu8_plaintext);
		});
	},
};

