import type {TjrwsResult} from './tm-json-rpc-ws-def';

import type {Dict, JsonObject, JsonValue, Promisable} from '#/meta/belt';
import type {ProviderStruct} from '#/meta/provider';

import type {ReceiverHooks} from '#/script/service-tx-abcis';
import {F_NOOP, ode} from '#/util/belt';


interface CallStruct {
	data(w_data: TjrwsResult): Promisable<void>;
}

interface SubscriptionState {
	events: string[];
	receiver: (w_data: {}) => Promisable<void>;
	init: number;
	confirmed: number;
	activity: number;
}

export class TmJsonRpcWebsocket {
	static async open(_g_provider: ProviderStruct, g_hooks: ReceiverHooks): Promise<TmJsonRpcWebsocket> {
		return new Promise((fk_connect, fe_connect) => {
			try {
				// create connection
				const k_connection = new TmJsonRpcWebsocket(_g_provider, {
					...g_hooks,

					// intercept connect hooks
					connect() {
						// forward event to caller
						void g_hooks.connect?.call?.(this);

						// resolve promise for static method
						fk_connect(k_connection);
					},
				});
			}
			catch(e_create) {
				fe_connect(e_create);
			}
		});
	}

	protected _d_ws: WebSocket;

	// datetime of most recent message
	protected _xt_previous = 0;

	// flag for preventing double error callback
	protected _b_closed = false;

	protected _p_host: string;

	// message counter used for indexing
	protected _c_messages = 0;

	// call structs
	protected _h_calls: Dict<CallStruct> = {};

	// subscription states
	protected _h_subscriptions: Dict<SubscriptionState> = {};

	constructor(protected _g_provider: ProviderStruct, protected _g_hooks: ReceiverHooks) {
		const p_host = _g_provider.rpcHost;

		if(!p_host) throw new Error('Cannot open websocket; no RPC host configured on network');

		this._p_host = p_host;

		this.restart();
	}

	get provider(): ProviderStruct {
		return this._g_provider;
	}

	get host(): string {
		return this._p_host;
	}

	restart(): void {
		// destructure fields
		const {
			_p_host,
			_g_hooks,
			_h_subscriptions,
		} = this;

		// reset subscription counter
		this._c_messages = 0;

		// reset subscriptions
		this._h_subscriptions = {};

		// init websocket
		const d_ws = this._d_ws = new WebSocket(`wss://${_p_host}/websocket`);

		// handle open event
		d_ws.onopen = (d_event) => {
			// emit connect event
			void _g_hooks.connect?.call(this);
		};

		// handle messages
		d_ws.onmessage = (d_event: MessageEvent<string>) => {
			// log timestamp of most recent message
			this._xt_previous = Date.now();

			// attempt to parse message
			let g_msg: JsonObject;
			try {
				g_msg = JSON.parse(d_event.data || '{}');
			}
			// handle invalid JSON
			catch(e_parse) {
				console.error(`<${_p_host}> sent invalid JSON over Websocket:\n${d_event.data}`);
				return;
			}

			// ref call id
			const si_call = g_msg.id as string;

			// no call id
			if(!si_call) {
				// rpc error
				if(g_msg.error) {
					if(_g_hooks.error) {
						_g_hooks.error.call(this, g_msg.error);
					}
					else {
						console.error(`<${_p_host}> reported a JSON-RPC error:\n${g_msg.error}`);
					}

					return;
				}
				// other
				else {
					console.error(`Ignored unassociated JSON-RPC message: %o`, g_msg);
					return;
				}
			}

			// lookup call struct
			const g_call = this._h_calls[si_call];

			// call struct is present; emit data
			if(g_call) {
				g_call.data(g_msg.result);
			}

			// // attempt to access payload
			// let g_value: JsonObject;
			// let h_events: CosmosEvents;
			// try {
			// 	const g_result = g_msg.result! as Dict<JsonObject>;
			// 	g_value = g_result.data.value as JsonObject;
			// 	h_events = g_result.events as unknown as CosmosEvents;
			// }
			// catch(e_destructre) {
			// 	console.warn(`<${_p_host}> sent unrecognized JSON struct over Websocket:\n${d_event.data}`);
			// 	return;
			// }

			// // valid data
			// if(g_value) {
			// 	void _g_hooks.data?.call(this, g_value, {
			// 		si_txn: h_events['tx.hash']?.[0] || '',
			// 	});
			// }
		};

		// prep error event ref
		let d_error: Event;

		// handle socket error
		d_ws.onerror = (d_event) => {
			d_error = d_event;
		};

		// handle socket close
		d_ws.onclose = (d_event) => {
			// was not initiated by caller; emit error
			if(!this._b_closed) {
				// closed now
				this._b_closed = true;

				// prep error struct
				const g_error = {
					code: d_event.code,
					reason: d_event.reason,
					wasClean: d_event.wasClean,
					error: d_error,
				};

				// emit error event
				if(_g_hooks.error) {
					void _g_hooks.error.call(this, g_error);
				}
				// no listener, log error
				else {
					console.error(`Error on <${_p_host}> Websocket:\n%o`, g_error);
				}
			}
		};

		// redo all previous subscriptions
		for(const [, g_subscription] of ode(_h_subscriptions)) {
			void this.subscribe(g_subscription.events, g_subscription.receiver);
		}
	}

	subscribe<w_data extends {}>(a_events: string[], fk_data: (w_data: TjrwsResult<w_data>) => Promisable<void>): Promise<void> {
		return new Promise((fk_resolve, fe_reject) => {
			// create new subscription id
			const si_subscription = this._c_messages++ +'';

			// init connection state
			const g_subscription = this._h_subscriptions[si_subscription] = {
				events: a_events,
				receiver: fk_data,

				init: Date.now(),
				confirmed: 0,
				activity: 0,
			};

			// set up call struct
			const g_call = this._h_calls[si_subscription] = {
				// handle confirmation response
				data(w_data: {}) {
					// no data is the desired confirmation; evolve to next state
					if(!Object.keys(w_data ?? {}).length) {
						// set confirmation time
						g_subscription.activity = g_subscription.confirmed = Date.now();

						// forward data stream
						g_call.data = fk_data;

						// resolve promise
						fk_resolve();
					}
					// never got confirmation
					else {
						fe_reject(new Error(`Never receieved JSON-RPC confirmation to event subscription`));
					}
				},
			} as CallStruct;

			// send Tendermint ABCI subscribe message
			this._d_ws.send(JSON.stringify({
				jsonrpc: '2.0',
				id: si_subscription,
				method: 'subscribe',
				params: {
					query: a_events.join(' AND '),
				},
			}));
		});
	}

	/**
	 * Pings the active websocket to check that it is alive
	 * @param xt_acceptable - optionally specifies an acceptable span of time to consider the socket alive
	 */
	wake(xt_acceptable=0): Promise<void> {
		if(this._b_closed) {
			throw new Error(`Attempted to wake a websocket that was already closed`);
		}

		// go async
		return new Promise((fk_resolve) => {
			// no need to check; socket is considered alive
			if(Date.now() - this._xt_previous < xt_acceptable) return fk_resolve();

			// verbose
			console.warn(`Sending health check on websocket for <${this._p_host}>`);

			// health check message index
			const si_health_check = this._c_messages++ +'';

			// set up call struct
			const g_call = this._h_calls[si_health_check] = {
				data() {
					g_call.data = F_NOOP;

					// resolve promise
					fk_resolve();
				},
			};

			// send health check message
			this._d_ws.send(JSON.stringify({
				jsonrpc: '2.0',
				id: si_health_check,
				method: 'health',
			}));
		});
	}

	// closes the socket
	destroy(): void {
		if(!this._b_closed) {
			// signal that user intiated the close
			this._b_closed = true;

			// close socket
			this._d_ws.close();
		}
	}
}
