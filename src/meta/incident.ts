import type { JsonMsgSend, PendingSend } from '#/chain/main';
import type { Dict, JsonObject } from '#/util/belt';
import type { Coin } from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import type { Union } from 'ts-toolbelt';
import type { Cast } from 'ts-toolbelt/out/Any/Cast';
import type { Merge } from 'ts-toolbelt/out/Object/Merge';
import type {Nameable, Pfpable} from './able';
import type { AccountPath } from './account';
import type { Access, Values } from './belt';
import type {Bech32, ChainPath, Family, FamilyKey} from './chain';
import type { Cw } from './cosm-wasm';
import type {Resource} from './resource';
import type { Secret, SecretPath } from './secret';


export type MsgEventRegistry = {
	coin_received: {
		receiver: Cw.Bech32;
		amount: Cw.Amount;
	};

	coin_spent: {
		spender: Cw.Bech32;
		amount: Cw.Amount;
	};

	message: {
		action: Cw.String;
		sender: Cw.Bech32;
		module: Cw.String;
	};

	transfer: {
		recipient: Cw.Bech32;
		sender: Cw.Bech32;
		amount: Cw.Amount;
	};
};

export type MsgEventKey = keyof MsgEventRegistry;

export type MsgEvent<
	si_key extends MsgEventKey=MsgEventKey,
> = MsgEventRegistry[si_key];


export interface TxMsg extends JsonObject {
	events: Partial<MsgEventRegistry>;
}

export type TxModeInfo = {
	single: {
		mode: number;
	};
} | {
	multi: {
		bitarray: string;
		modeInfos: TxModeInfo[];
	};
};

export interface TxSigner extends JsonObject {
	pubkey: string;
	sequence: Cw.Uint128;
	mode_info: TxModeInfo;
}


export interface TxCore extends JsonObject {
	// chain that this transaction belongs to
	chain: ChainPath;

	// txResponse.code
	code: number;

	// txResponse.rawLog
	raw_log: string;

	// // addresses that this transaction is affiliated with
	// owners: Bech32.String[];

	// txResponse.txhash
	hash: string;

	// tx.authInfo.fee.gasLimit
	gas_limit: Cw.Uint128;

	// txResponse.gasWanted
	gas_wanted: Cw.Uint128;

	// txResponse.gasUsed
	gas_used: Cw.Uint128;

	// txResponse.logs[]
	msgs: TxMsg[];

	// coin: string;
	// msg: JsonMsgSend;
	// raw: string;
}

export interface TxPending extends TxCore {
	// indicates a pending outgoing transaction
	stage: 'pending';

	// // the account that initiated the transaction
	// owner: Bech32.String;
}

export interface TxPartial extends TxCore {
	// txResponse.height
	height: Cw.Uint128;

	// txResponse.timestamp
	timestamp: Cw.String;
}

export interface TxConfirmed extends TxPartial {
	stage: 'confirmed';
}

export interface TxSynced extends TxPartial {
	stage: 'synced';

	// tx.authInfo.signerInfos
	signers?: TxSigner[];

	// tx.authInfo.fee
	fee_amounts?: Cw.Coin[];

	// tx.authInfo.fee.payer
	payer?: Cw.Bech32 | '';

	// tx.authInfo.fee.granter
	granter?: Cw.Bech32 | '';

	// tx.body.memo
	memo: string;

	// approximate equivalent fiat values
	fiats: Dict<number>;
}

export type IncidentRegistry = {
	tx_out: TxPending | TxConfirmed | TxSynced;

	tx_in: TxConfirmed | TxSynced;

	account_created: {
		account: AccountPath;
	};
};

export type IncidentType = Cast<keyof IncidentRegistry, string>;

export namespace Incident {
	export type Struct<
		si_type extends IncidentType=IncidentType,
	> = {
		type: si_type;
		id: string;
		time: number;
		data: IncidentRegistry[si_type];
	};
}


// export type IncidentTypeRegistry = {
// 	account_created: {
// 		interface: {
// 			account: AccountPath;
// 		};
// 	};

// 	pending: {
// 		interface: PendingSend;
// 	};

// 	send: {
// 		interface: Merge<PendingSend, {
// 			height: string;
// 			gas_used: string;
// 			gas_wanted: string;
// 			recipient: string;
// 			sender: string;
// 			amount: string;
// 			memo: string;
// 			timestamp: string;
// 		}>;
// 	};

// 	receive: {
// 		interface: {
// 			chain: ChainPath;
// 			hash: string;
// 			coin: string;
// 			height: string;
// 			recipient: string;
// 			sender: string;
// 			amount: string;
// 			memo: string;
// 			timestamp: string;
// 		};
// 	};
// };

// export type IncidentTypeKey = keyof IncidentTypeRegistry;

// export interface LogEvent<
// 	si_type extends IncidentTypeKey=IncidentTypeKey,
// > extends JsonObject {
// 	time: number;
// 	type: si_type;
// 	data: IncidentTypeRegistry[si_type]['interface'];
// }



export type Incident<
	si_type extends IncidentType=IncidentType,
	si_id extends string=string,
> = Resource.New<{
	segments: [`incident.${si_type}`, `id.${si_id}`];
	interface: Incident.Struct<si_type>;
}>;

export type IncidentPath = Resource.Path<Incident>;
