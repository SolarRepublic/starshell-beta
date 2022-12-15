import type {AminoSignResponse} from '@cosmjs/amino';

import type {AccountPath} from '#/meta/account';
import type {Bech32, ChainStruct} from '#/meta/chain';

import {syserr} from '#/app/common';
import type {CosmosNetwork} from '#/chain/cosmos-network';
import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {base93_to_buffer, buffer_to_base93, buffer_to_text, sha256, text_to_buffer} from '#/util/data';


export function ecdh_nonce(a_data: string[]): Promise<Uint8Array> {
	return sha256(text_to_buffer(['StarShell', ...a_data].join('\0')));
}

export function encode_memo_ciphertext(atu8_ciphertext: Uint8Array): string {
	return '🔒1'+buffer_to_base93(atu8_ciphertext);
}

export function extract_memo_ciphertext(s_memo: string): Uint8Array {
	if(!s_memo.startsWith('🔒1')) {
		throw syserr({
			title: 'Memo Invalid',
			text: 'Attempted to decrypt invalid memo',
		});
	}

	return base93_to_buffer(s_memo.slice(3));
}

const X_BASE93_EXPANSION_MIN = 171 / 139;
const X_BASE93_EXPANSION_MAX = 167 / 135;

export async function encrypt_private_memo(
	s_memo: string,
	g_chain: ChainStruct,
	p_account: AccountPath,
	sa_recipient: Bech32,
	k_network: CosmosNetwork
): Promise<string> {
	// load account def from storage
	const g_account = (await Accounts.at(p_account))!;

	// compute sender's address on given chain
	const sa_sender = Chains.addressFor(g_account.pubkey, g_chain);

	// prep memo character limit
	let n_chars!: number;
	try {
		// fetch max memo chars param
		const g_param = await k_network.networkParam({
			key: 'MaxMemoCharacters',
			subspace: 'auth',
		});

		// parse amount
		n_chars = parseInt(JSON.parse(g_param?.value || '') as string);
	}
	catch(e_param) {}

	// invalid
	if(!Number.isInteger(n_chars)) {
		throw syserr({
			title: 'Network error',
			text: 'Unable to fetch the maximum memo length parameter from the chain',
		});
	}

	// locate recipient's public key
	let atu8_pubkey_65: Uint8Array;
	try {
		({
			pubkey: atu8_pubkey_65,
		} = await k_network.e2eInfoFor(sa_recipient));
	}
	catch(e_info) {
		throw syserr({
			title: 'Recipient Account Unpublished',
			error: e_info,
		});
	}

	// produce e2e nonce
	let s_sequence: string;
	try {
		({
			sequence: s_sequence,
		} = await k_network.e2eInfoFor(sa_sender));
	}
	catch(e_info) {
		throw syserr({
			title: 'Invalid account for private memos',
			error: e_info,
		});
	}

	// compute ecdh nonce with recipient
	const atu8_nonce = await ecdh_nonce([`${BigInt(s_sequence) + 1n}`]);

	// convert param effective to byte limit (3 bytes for preamble + base93_overhead(16 byte GCM tag + PAYLOAD_SIZE))
	const nb_max_memo = Math.floor((n_chars - 3) / X_BASE93_EXPANSION_MAX) - 16;

	// utf8-encode memo
	const atu8_memo_in = text_to_buffer(s_memo);

	// input is too long
	if(atu8_memo_in.byteLength > nb_max_memo) {
		throw syserr({
			title: 'Invalid memo',
			text: 'Your memo text exceeds the character limitation for private memos',
		});
	}

	// populate the plaintext buffer
	const atu8_plaintext = new Uint8Array(nb_max_memo);
	atu8_plaintext.set(atu8_memo_in, 0);

	// encrypt payload
	const atu8_ciphertext = await k_network.ecdhEncrypt(atu8_pubkey_65, atu8_plaintext, atu8_nonce);

	// exceeds chain length parameter
	if(atu8_ciphertext.byteLength > n_chars) {
		throw syserr({
			title: 'Private memo bug',
			text: 'There was a problem when calculating the memo payload size. Please report this bug',
		});
	}

	// encode ciphertext
	const s_memo_encrypted = encode_memo_ciphertext(atu8_ciphertext);

	// simulate decryption
	{
		if(!s_memo_encrypted.startsWith('🔒1')) {
			throw syserr({
				title: 'Faulty private memo encoding',
				text: `Unexpected preamble`,
			});
		}

		const atu8_published = base93_to_buffer(s_memo_encrypted.slice(3));

		const atu8_decrypted = await k_network.ecdhDecrypt(atu8_pubkey_65, atu8_published, atu8_nonce);

		const s_memo_decrypted = buffer_to_text(atu8_decrypted).replace(/\0+$/, '');
		if(s_memo_decrypted !== s_memo) {
			throw syserr({
				title: 'Quality assurance failure',
				text: `Simulated decrypted memo did not match original: ${s_memo_decrypted}`,
			});
		}
	}

	return s_memo_encrypted;
}

export async function decrypt_private_memo(
	s_memo_encrypted: string,
	k_network: CosmosNetwork,
	sa_other: Bech32,
	s_sequence: string
): Promise<string> {
	if(!s_memo_encrypted.startsWith('🔒1')) {
		throw new Error(`Unexpected preamble in encrypted memo ciphertext`);
	}

	const atu8_pubkey_65 = (await k_network.e2eInfoFor(sa_other)).pubkey;

	const atu8_published = base93_to_buffer(s_memo_encrypted.slice(3));

	const atu8_nonce = await ecdh_nonce([s_sequence]);

	const atu8_decrypted = await k_network.ecdhDecrypt(atu8_pubkey_65, atu8_published, atu8_nonce);

	return buffer_to_text(atu8_decrypted).replace(/\0+$/, '');
}
