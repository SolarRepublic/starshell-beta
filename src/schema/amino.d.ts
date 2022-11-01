import type {SignDoc} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import type {AccountStruct, AccountPath} from '#/meta/account';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type {AminoSignResponse, StdSignature, StdSignDoc} from '@cosmjs/amino';
import type {Writable} from 'ts-toolbelt/out/Object/Writable';
import type {JsonObject} from '#/meta/belt';

export interface GenericAminoMessage extends JsonObject {
	type: string;
	value: JsonValue;
}

export interface AdaptedStdSignDoc<
	a_msgs extends GenericAminoMessage[]=GenericAminoMessage[],
> extends JsonObject, Writable<StdSignDoc, string, 'deep'> {
	msgs: a_msgs;
}

export interface AdaptedAminoResponse extends JsonObject, Writable<AminoSignResponse, string, 'deep'> {
	signed: AdaptedStdSignDoc;
}

export interface AdaptedStdSignature extends JsonObject, StdSignature {}
