import type { Union } from 'ts-toolbelt';
import type { At, Compute } from 'ts-toolbelt/out/Any/_api';
import type { Merge, MergeAll } from 'ts-toolbelt/out/Object/_api';
import type { Append } from 'ts-toolbelt/out/List/_api';

import type { JsonObject, JsonValue } from '#/util/belt';

import type { TypedMessage } from '#/script/messages';
import type { Coalesce, OmitUnknownKeys } from './belt';


/**
 * === _**@starshell/meta**_ ===
 * 
 * Describes a meta instance type that describes the range of message types defined over a certain exchange medium.
 */
export interface Vocab<
	g_type extends TypedMessage=TypedMessage,
	w_response extends JsonValue=JsonValue,
> {
	[si_key: string]: {
		message: g_type;
		response?: w_response;
	};
}


/**
 * === _**@starshell/meta**_ ===
 * 
 * Defines the meta methods and meta constructor for a {@link Vocab} instance.
 * 
 * Create using {@link Vocab.New}.
 */
export namespace Vocab {
	/**
	 * Struct of the input definition for a vocab.
	 */
	interface Source {
		[si_msg: string]: {
			value?: JsonValue;
			response?: JsonValue;
		};
	}


	/**
	 * Options for the {@link New} constructor.
	 */
	interface Config {
		each?: JsonObject;
	}


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.New<
	 * 	source: {
	 * 		[key: string]: {
	 * 			value?: JsonValue;
	 * 			response?: JsonValue;
	 * 		},
	 * 	},
	 * 	config?: {
	 * 		each?: JsonObject,
	 * 	},
	 * > ==> Vocab
	 * ```
	 * Creates a new Vocab
	 */
	export type New<
		h_source extends Source,
		gc_vocab extends Config={},
	> = Compute<{
		// use mapped type to transform each entry; destructure each entry's value into `g_source`
		[si_key in keyof h_source]: h_source[si_key] extends infer g_source
			? g_source extends h_source[si_key]
				? MergeAll<
					{
						// create the message struct; starting with the message `type` key
						message: MergeAll<{
							type: si_key;
						}, [
							// merge the `value` type if one was provided
							g_source extends {value:JsonValue}
								? {value:g_source['value']}
								: {},
							
							// // merge the 'each' type provided by config
							// gc_vocab['each'] extends JsonObject
							// 	? gc_vocab['each']
							// 	: {},
						]>;
					},
					[
						// append the response struct if one was provided
						g_source extends {response:JsonValue}
							? {response:g_source['response'];}
							: {},

						// merge the 'each' type provided by config
						gc_vocab['each'] extends JsonObject
							? gc_vocab['each']
							: {},
					],
					'deep'
				>
				: {}
			: {};
	}>;


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.Message<
	 * 	vocab: Vocab,
	 * 	type?: keyof Vocab,
	 * > ==> UnionOf<TypedMessage>
	 * ```
	 * 
	 * Extracts a union of the message structs for each contained entry, or only of the gvien `type`.
	 */
	export type Message<
		h_vocab extends Vocab,
		si_msg extends keyof h_vocab=keyof h_vocab,
	> = h_vocab[si_msg]['message'];


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.MessageValue<
	 * 	vocab: Vocab,
	 * 	type?: keyof Vocab,
	 * > ==> UnionOf<TypedMessage>
	 * ```
	 * 
	 * Extracts a union of the message structs for each contained entry, or only of the given `type`.
	 */
	export type MessageValue<
		h_vocab extends Vocab,
		si_msg extends keyof h_vocab=keyof h_vocab,
	> = Coalesce<
		Message<h_vocab, si_msg> extends infer g_msg
			? Union.Strict<Union.Select<g_msg, {value:JsonValue}>>['value']
			: null,
		[null]
	>;


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.MessagePart<
	 * 	vocab: Vocab,
	 * 	part?: keyof Vocab[*].message,
	 * > ==> UnionOf<TypedMessage>
	 * ```
	 * 
	 * Extracts the expected type of the given message `part`.
	 */
	export type MessagePart<
		h_vocab extends Vocab,
		si_part extends keyof Message<h_vocab, keyof h_vocab>,
	> = Message<h_vocab, keyof h_vocab>[si_part];


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.Response<
	 * 	vocab: Vocab,
	 * 	type?: keyof Vocab,
	 * > ==> UnionOf<TypedMessage>
	 * ```
	 * 
	 * Extracts a union of the response structs for each contained entry, or only of the given `type`.
	 */
	export type Response<
		h_vocab extends Vocab,
		si_msg extends keyof h_vocab=keyof h_vocab,
	> =  h_vocab[si_msg]['response'] extends infer w_response
		? w_response extends object
			? Union.Strict<w_response>
			: w_response
		: never;


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.TypedRuntime<
	 * 	outgoing: Vocab,
	 * 	incoming?: Vocab,
	 * >
	 * ```
	 * 
	 * Creates a typed {@link MessagePort} suitable for the given `outgoing` and optionally `incoming` vocabs.
	 */
	export interface TypedRuntime<
		h_outgoing extends Vocab,
		h_incoming extends Vocab=Vocab,
	> extends Merge<{}, typeof chrome['runtime']> {
		// outgoing messages
		sendMessage<g_msg extends Message<h_outgoing>>(g_msg: g_msg): Promise<Response<h_outgoing, g_msg['type']>>;
		sendMessage<g_msg extends Message<h_outgoing>>(g_msg: g_msg, fk_respond: (w_result: Response<h_outgoing, g_msg['type']>) => void | PromiseLike<void>): void;

		// incoming messages
		onMessage: chrome.events.Event<
			(g_msg: Message<h_incoming>, g_sender: chrome.runtime.MessageSender, fk_respond: (w_result?: any) => void) => void
		>;
	}


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.TypedRuntime<
	 * 	outgoing: Vocab,
	 * 	incoming?: Vocab,
	 * >
	 * ```
	 * 
	 * Creates a typed {@link MessagePort} suitable for the given `outgoing` and optionally `incoming` vocabs.
	 */
	export interface TypedTabs<
		h_outgoing extends Vocab,
		h_incoming extends Vocab=Vocab,
	> extends Merge<typeof chrome['tabs'], {}> {
		// outgoing messages
		sendMessage<g_msg extends Message<h_outgoing>>(i_tab: number, g_msg: g_msg, gc_send?: chrome.tabs.MessageSendOptions): Promise<Response<h_outgoing, g_msg['type']>>;
		sendMessage<g_msg extends Message<h_outgoing>>(i_tab: number, g_msg: g_msg, fk_respond?: (w_result: Response<h_outgoing, g_msg['type']>) => void): void;

		// // incoming messages
		// set onmessage(f_listener: (d_event: MessageEvent<Message<h_incoming>>) => void);
	}


	/**
	 * Create callback listener type for window events
	 */
	type WindowListenerCallback<
		si_event extends string,
		h_incoming extends Vocab,
	> = [si_event] extends ['message']
		? (d_event: MessageEvent<Message<h_incoming>>) => void | null
		: si_event extends keyof WindowEventMap
			? (this: Window, d_event: WindowEventMap[si_event]) => any
			: EventListenerOrEventListenerObject;

	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.TypedWindow<
	 * 	outgoing: Vocab,
	 * 	incoming?: Vocab,
	 * >
	 * ```
	 * 
	 * Creates a typed {@link MessagePort} suitable for the given `outgoing` and optionally `incoming` vocabs.
	 */
	export interface TypedWindow<
		h_outgoing extends Vocab,
		h_incoming extends Vocab=Vocab,
	> extends Window {
		// outgoing messages
		postMessage<g_msg extends Message<h_outgoing>>(g_msg: g_msg, sx_target: string, a_transfer?: Transferable[]): void;
		postMessage<g_msg extends Message<h_outgoing>>(g_msg: g_msg, gc_post: WindowPostMessageOptions): void;

		// incoming messages
		set onmessage(f_listener: ((d_event: MessageEvent<Message<h_incoming>> | null) => void) | null);
		addEventListener<si_event extends keyof WindowEventMap>(si_event: si_event, f_listener: WindowListenerCallback<si_event, h_incoming>);
		addEventListener(si_event: string, f_listener: EventListenerOrEventListenerObject, gc_add?: boolean | AddEventListenerOptions): void;
	}


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.TypedPort<
	 * 	outgoing: Vocab,
	 * 	incoming?: Vocab,
	 * >
	 * ```
	 * 
	 * Creates a typed {@link MessagePort} suitable for the given `outgoing` and optionally `incoming` vocabs.
	 */
	export interface TypedPort<
		h_outgoing extends Vocab,
		h_incoming extends Vocab=Vocab,
	> extends MessagePort {
		// outgoing messages
		postMessage<g_msg extends Message<h_outgoing>>(g_msg: g_msg);

		// incoming messages
		set onmessage(f_listener: ((d_event: MessageEvent<Message<h_incoming>>) => void) | null);
	}


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.BroadcastListener<
	 * 	incoming?: Vocab,
	 * 	event?: 'message' | 'messageerror' = 'message',
	 * >
	 * ```
	 * 
	 * Helper type for creating listeners on {@link TypedBroadcast}.
	 */
	export type BroadcastListener<
		h_incoming extends Vocab=Vocab,
		si_event extends keyof BroadcastChannelEventMap='message',
	> = (
		this: BroadcastChannel,
		d_event: {
			message: MessageEvent<Message<h_incoming>>;
			messageerror: MessageEvent;
		}[si_event],
	) => any;


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.TypedBroadcast<
	 * 	outgoing: Vocab,
	 * 	incoming?: Vocab,
	 * >
	 * ```
	 * 
	 * Creates a typed {@link BroadcastChannel} suitable for the given `outgoing` and optionally `incoming` vocabs.
	 */
	export interface TypedBroadcast<
		h_outgoing extends Vocab,
		h_incoming extends Vocab=Vocab,
	> extends BroadcastChannel {
		// outgoing messages
		postMessage<g_msg extends Message<h_outgoing>>(g_msg: g_msg);

		// incoming messages
		set onmessage(f_listener: ((d_event: MessageEvent<Message<h_incoming>>) => void) | null);

		// override
		addEventListener<
			si_event extends keyof BroadcastChannelEventMap,
		>(
			si_event: si_event,
			f_listener: BroadcastListener<h_incoming, keyof BroadcastChannelEventMap>,
			options?: boolean | AddEventListenerOptions
		): void;

		// default
		addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	}


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.Handler<
	 * 	messageValue: JsonValue,
	 * 	extraArgs?: any[],
	 * >
	 * ```
	 * 
	 * Creates handler type for the given `messageValue`, optionally injecting `extraArgs` into the callback signature.
	 */
	export type Handler<
		w_value extends JsonValue=JsonValue,
		a_args extends any[]=[],
		w_return=void | Promise<void>,
	> = At<{
		0: (
			w_value: w_value,
		) => w_return;
		1: (
			w_value: w_value,
			w_arg0: a_args[0],
		) => w_return;
		2: (
			w_value: w_value,
			w_arg0: a_args[0],
			w_arg1: a_args[1],
		) => w_return;
		3: (
			w_value: w_value,
			w_arg0: a_args[0],
			w_arg1: a_args[1],
			w_arg2: a_args[2],
		) => w_return;
	}, a_args['length']>;


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.HandlerPortReceivable<
	 * 	messageValue: JsonValue,
	 * 	extraArgs?: any[],
	 * >
	 * ```
	 * 
	 * Creates handler type for the given `messageValue` which receives ports,
	 * optionally injecting `extraArgs` into the handler signature.
	 */
	export type HandlerPortReceivable<
		w_value extends JsonValue=JsonValue,
		a_args extends any[]=[],
	> = Handler<
		w_value,
		Append<a_args, Readonly<MessagePort[]> | undefined>
	>;


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.HandlerChrome<
	 * 	messageValue: JsonValue,
	 * 	callbackData?: any,
	 * 	extraArgs?: any[],
	 * >
	 * ```
	 * 
	 * Creates handler type for the given `messageValue` for handling `chrome.runtime.sendMessage()`,
	 * optionally specifying `callbackData` type for responses and `extraArgs` for injecting into the
	 * handler signature.
	 */
	export type HandlerChrome<
		w_value extends JsonValue=JsonValue,
		w_callback_data extends any=any,
		a_args extends any[]=[],
	> = Handler<
		w_value,
		Append<
			Append<a_args, chrome.runtime.MessageSender>,
			((w_data: w_callback_data) => void)
		>
	>;


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.Handlers<
	 * 	vocab: Vocab,
	 * 	extraArgs?: any[],
	 * >
	 * ```
	 * 
	 * Adds typings to message handler dict, optionally injecting `extraArgs` into the handler signature.
	 */
	export type Handlers<
		h_vocab extends Vocab,
		a_args extends any[]=[],
	> = {
		[si_msg in keyof h_vocab]: Handler<
			MessageValue<h_vocab, si_msg>,
			a_args
		>;
	};


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.HandlersPortReceivable<
	 * 	vocab: Vocab,
	 * 	extraArgs?: any[],
	 * >
	 * ```
	 * 
	 * Adds typings to message handler dict where handlers can receive ports,
	 * optionally injecting `extraArgs` into the handler signature.
	 */
	export type HandlersPortReceivable<
		h_vocab extends Vocab,
		a_args extends any[]=[],
	> = {
		[si_msg in keyof h_vocab]: HandlerPortReceivable<
			MessageValue<h_vocab, si_msg>
		>;
	};


	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Vocab.HandlersChrome<
	 * 	vocab: Vocab,
	 * 	callbackData?: any,
	 * 	extraArgs?: any[],
	 * >
	 * ```
	 * 
	 * Adds typings to chrome extension message handler dict, optionally specifying `callbackData`
	 * for responses and `extraArgs` for injecting into the handler signature.
	 */
	export type HandlersChrome<
		h_vocab extends Vocab,
		w_callback_data extends any=any,
		a_args extends any[]=[],
	> = {
		[si_msg in keyof h_vocab]: HandlerChrome<
			MessageValue<h_vocab, si_msg>,
			Response<h_vocab, si_msg> extends infer z_response
				? z_response extends object
					? OmitUnknownKeys<z_response>
					: z_response
				: never
		>;
	};
}
