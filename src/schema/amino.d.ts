import type {AminoSignResponse, StdSignature, StdSignDoc} from '@cosmjs/amino';

import type {Writable} from 'ts-toolbelt/out/Object/Writable';

import type {AsJson} from '#/meta/belt';

export interface GenericAminoMessage {
	type: string;
	value: JsonValue;
}

export interface AdaptedStdSignDoc<
	a_msgs extends GenericAminoMessage[]=GenericAminoMessage[],
> extends Writable<StdSignDoc, string, 'deep'> {
	msgs: AsJson<a_msgs>;
}

export interface AdaptedAminoResponse extends Writable<AminoSignResponse, string, 'deep'> {
	signed: AdaptedStdSignDoc;
}

export interface AdaptedStdSignature extends StdSignature {}
