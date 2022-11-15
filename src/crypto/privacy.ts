import { syserr } from '#/app/common';
import {base93_to_buffer, buffer_to_base93, sha256, text_to_buffer} from '#/util/data';
import type { AminoSignResponse } from '@cosmjs/amino';

export function ecdhNonce(s_sequence: `${bigint}`, s_gas_wanted: `${bigint}`): Promise<Uint8Array> {
	return sha256(text_to_buffer(['StarShell', s_sequence, s_gas_wanted].join('\0')));
}

export function compileMemoPlaintext(atu8_ciphertext: Uint8Array): string {
	return '🔒1'+buffer_to_base93(atu8_ciphertext);
}

export function encodeMemoQueryPermit(g_permit: AminoSignResponse) {
	const sxb64_signature = g_permit.signature.signature;
	const g_msg_value = g_permit.signed.msgs[0].value;

	// TODO: reduce contract addresses to data only
	// g_msg_value.allowed_tokens.map()

	// encode permissions array

	// encode permit name

	// 
}

export function extractMemoCiphertext(s_memo: string): Uint8Array {
	if(!s_memo.startsWith('🔒1')) {
		throw syserr({
			title: 'Memo Invalid',
			text: 'Attempted to decrypt invalid memo',
		});
	}

	return base93_to_buffer(s_memo.slice(3));
}
