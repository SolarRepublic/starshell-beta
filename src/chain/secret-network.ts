import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {AccountStruct} from '#/meta/account';
import type {JsonObject} from '#/meta/belt';
import type {Bech32, ChainStruct, ContractStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';

import {
	QueryClientImpl as ComputeQueryClient,
	CodeInfoResponse,
	ContractInfoWithAddress,
} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';
import {
	QueryClientImpl as RegistrationQueryClient,
} from '@solar-republic/cosmos-grpc/dist/secret/registration/v1beta1/query';



import {CosmosNetwork} from './cosmos-network';


import {syserr} from '#/app/common';
import {SecretWasm} from '#/crypto/secret-wasm';
import {Chains} from '#/store/chains';
import {Secrets} from '#/store/secrets';
import {base64_to_buffer, base93_to_buffer, buffer_to_json, buffer_to_text} from '#/util/data';



interface Snip20TokenInfo extends JsonObject {
	name: Cw.String;
	symbol: Cw.String;
	decimals: Cw.NaturalNumber;
	total_supply: Cw.Uint128;
}

type Queryable = Merge<
	Pick<ContractStruct, 'bech32'>,
	Partial<
		Pick<ContractStruct, 'hash'>
	>
>;

export class SecretNetwork extends CosmosNetwork {
	static uuidForQueryPermit(g_chain: ChainStruct, s_permit_name: string): string {
		return `${Chains.caip2From(g_chain)}:#query_permit:${s_permit_name}`;
	}

	async secretConsensusIoPubkey(): Promise<Uint8Array> {
		if(!this._g_chain.features['secretwasm']) {
			throw new Error(`Cannot get consensus IO pubkey on non-secret chain "${this._g_chain.reference}"`);
		}

		return SecretWasm.extractConsensusIoPubkey((await new RegistrationQueryClient(this._y_grpc).registrationKey({})).key);
	}

	async secretWasm(g_account: AccountStruct, s_code_hash: string, h_msg: JsonObject): Promise<SecretWasm> {
		// resolve consensus io pubkey
		const sxb93_consensus_pk = this._g_chain.features.secretwasm?.consensusIoPubkey;
		if(!sxb93_consensus_pk) {
			throw syserr({
				title: 'Missing Chain Information',
				text: 'No consensus IO public key found.',
			});
		}

		// convert to buffer
		const atu8_consensus_pk = base93_to_buffer(sxb93_consensus_pk);

		// prep wasm instance
		let k_wasm!: SecretWasm;

		// account has signed a wasm seed; load secretwasm
		const p_secret_wasm = g_account.utilityKeys['secretWasmTx'];
		if(p_secret_wasm) {
			k_wasm = await Secrets.borrow(p_secret_wasm, kn_seed => new SecretWasm(atu8_consensus_pk, kn_seed.data));
		}

		// no pre-existing tx encryption key; generate a random seed
		if(!k_wasm) {
			k_wasm = new SecretWasm(atu8_consensus_pk);
		}

		return k_wasm;
	}

	async encryptContractMessage(g_account: AccountStruct, s_code_hash: string, h_msg: JsonObject): Promise<Uint8Array> {
		// get wasm instance
		const k_wasm = await this.secretWasm(g_account, s_code_hash, h_msg);

		// encrypt message for destination contract
		return await k_wasm.encrypt(s_code_hash, h_msg);
	}

	decryptContractMessage(g_account: AccountStruct, atu8_msg: Uint8Array): ReturnType<typeof SecretWasm['decryptMsg']> {
		return SecretWasm.decryptMsg(g_account, this._g_chain, atu8_msg);
	}


	async snip20Info(g_account: AccountStruct, g_contract: Queryable): Promise<Snip20TokenInfo> {
		return await this.queryContract<Snip20TokenInfo>(g_account, g_contract, {
			token_info: {},
		});
	}

	async queryContract<
		g_result extends JsonObject=JsonObject,
	>(g_account: AccountStruct, g_contract: Queryable, h_query: JsonObject): Promise<g_result> {
		let si_hash = g_contract.hash;
		if(!si_hash) {
			si_hash = await this.codeHashByContractAddress(g_contract.bech32);
		}

		// encrypt query
		const atu8_query = await this.encryptContractMessage(g_account, si_hash, h_query);

		// extract nonce from query
		const atu8_nonce = atu8_query.slice(0, 32);

		// submit to provider
		const g_response = await new ComputeQueryClient(this._y_grpc).querySecretContract({
			contractAddress: g_contract.bech32,
			query: atu8_query,
		});

		// decrypt response
		const atu8_plaintetxt = await SecretWasm.decryptBuffer(g_account, this._g_chain, g_response.data, atu8_nonce);

		// parse plaintext
		const sxb64_response = buffer_to_text(atu8_plaintetxt);
		const atu8_response = base64_to_buffer(sxb64_response);

		// parse and return json
		return buffer_to_json(atu8_response) as g_result;
	}
}
