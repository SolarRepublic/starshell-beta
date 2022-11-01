import type {AminoMsg, Coin} from '@cosmjs/amino';

import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {ChainStruct} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';
import type {MsgEventRegistry, SignedJsonEventRegistry} from '#/meta/incident';
import type {PfpPath, PfpTarget} from '#/meta/pfp';

import type {LocalAppContext} from '#/app/svelte';
import type {NotifyItemConfig} from '#/extension/notifications';
import type { WsTxResultError } from '#/store/providers';
import type { Resource } from '#/meta/resource';
import type { Nameable, Pfpable } from '#/meta/able';
import type { Any } from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';


export interface DescribedMessage {
	title: string;
	tooltip?: string;
	fields: FieldConfig[];
	spends?: SpendInfo[];
}

export interface ReviewedMessage {
	/**
	 * Title of the incident from the list
	 */
	title: string;

	/**
	 * Provides list of strings to use for secondary incident information
	 */
	infos?: string[];

	/**
	 * Specifies a resource to use for name / pfp
	 */
	resource: Nameable & Pfpable;

	fields: FieldConfig[];
}

export interface MessageInterpretter {
	/**
	 * Invoked when preparing to present the information to the user for signing
	 */
	describe(): Promisable<DescribedMessage>;

	/**
	 * Invoked once the message has been approved
	 */
	approve?(si_txn: string): Promisable<Partial<MsgEventRegistry> | Partial<SignedJsonEventRegistry> | void>;

	/**
	 * Invoked once the message has successfully processed on-chain
	 */
	apply?(nl_msgs: number): Promisable<NotifyItemConfig | undefined>;

	/**
	 * Invoked when the message is received to the account
	 */
	receive?(nl_msgs: number): Promisable<NotifyItemConfig | undefined>;

	/**
	 * Tests if the message affects the current user
	 */
	affects?(): Promisable<boolean>;

	/**
	 * Invoked if the transaction failed
	 */
	fail?(nl_msgs: number, g_error: WsTxResultError): Promisable<NotifyItemConfig | undefined>;

	/**
	 * Invoked when reviewing the incident details
	 */
	review?(b_pending: boolean, b_incoming?: boolean): Promisable<ReviewedMessage | undefined>;
}

export interface SpendInfo {
	pfp: PfpTarget;
	amounts: string[];
}

export interface AddCoinsConfig {
	g_chain: ChainStruct;
	coins: Coin[];
	label?: string;
	set?: Set<string>;
	label_prefix?: string;
}

export type MessageDict = Dict<(g_msg: JsonObject, g_context: LocalAppContext) => Promisable<MessageInterpretter>>;


export interface PrebuiltMessage {
	amino: AminoMsg;
	proto: Any;
}
