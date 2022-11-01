import type {BlockInfoHeader} from './common';
import type {AbciConfig, CosmosEvents, ReceiverHooks} from './service-tx-abcis';

import type {AccountStruct} from '#/meta/account';
import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {ChainPath, ChainStruct} from '#/meta/chain';
import type {ProviderStruct, ProviderPath} from '#/meta/provider';

import {Chains} from './ics-witness-imports';
import {global_broadcast} from './msg-global';
import {account_abcis, tx_abcis} from './service-tx-abcis';

import {syserr} from '#/app/common';
import type {LocalAppContext} from '#/app/svelte';
import type {CosmosNetwork} from '#/chain/cosmos-network';
import type {NotificationConfig} from '#/extension/notifications';
import {Accounts} from '#/store/accounts';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {NetworkTimeoutError, Providers, WsTxResponse} from '#/store/providers';

import {ode, timeout_exec} from '#/util/belt';
import { buffer_to_base64 } from '#/util/data';


interface FeedHooks {
	notify?(gc_notify: NotificationConfig, k_feed: NetworkFeed): Promisable<void>;
}

const H_FEEDS: Record<ChainPath, NetworkFeed> = {};
export class NetworkFeed {
	static async createAll(gc_feed: FeedHooks): Promise<NetworkFeed[]> {
		// read from chains and providers stores
		const [
			ks_chains,
			ks_providers,
		] = await Promise.all([
			Chains.read(),
			Providers.read(),
		]);

		// 
		const a_feeds: Promise<NetworkFeed>[] = [];

		// each chain
		for(const [p_chain, g_chain] of ks_chains.entries()) {
			// list of contending providers
			const a_contenders: [ProviderPath, ProviderStruct][] = [];

			// each provider
			for(const [p_provider, g_provider] of ks_providers.entries()) {
				// provider serves this chain
				if(p_chain === g_provider.chain) {
					// add to contending list
					a_contenders.push([p_provider, g_provider]);
				}
			}

			// filter chain provider preferences by contenders
			const a_providers: ProviderStruct[] = g_chain.providers
				.filter((p_provider) => {
					// a preferred provider exists
					const i_provider = a_contenders.findIndex(([p]) => p_provider === p);
					if(i_provider >= 0) {
						// remove from contender list
						a_contenders.splice(i_provider, 1);

						return true;
					}

					return false;
				})
				.map(p => ks_providers.at(p)!);

			// append remainders in random order so as not to bias any one
			a_providers.push(...a_contenders.sort(() => Math.random() - 0.5).map(([, g]) => g));

			// destroy old feed
			if(H_FEEDS[p_chain]) {
				try {
					H_FEEDS[p_chain].destroy();
				}
				catch(e_destroy) {}
			}

			// create new feed for top chain
			a_feeds.push(NetworkFeed.create(g_chain, a_providers[0], gc_feed));
		}


		return await Promise.all(a_feeds);
	}

	static async create(g_chain: ChainStruct, g_provider: ProviderStruct, gc_feed: FeedHooks): Promise<NetworkFeed> {
		const k_feed = new NetworkFeed(g_chain, g_provider, gc_feed);

		// follow blocks
		await k_feed.followBlocks();

		// follow all accounts
		await k_feed.followAccounts();

		return k_feed;
	}

	protected _p_chain: ChainPath;
	protected _p_provider: ProviderPath;

	protected _k_network: CosmosNetwork;

	protected _kc_blocks: TendermintConnection;
	protected _a_accounts: TendermintConnection[] = [];

	protected _h_connections_incoming: Dict<TendermintConnection> = {};
	protected _h_connections_outgoing: Dict<TendermintConnection> = {};

	constructor(protected _g_chain: ChainStruct, protected _g_provider: ProviderStruct, protected _gc_hooks: FeedHooks) {
		// infer paths
		this._p_chain = Chains.pathFrom(_g_chain);
		this._p_provider = Providers.pathFrom(_g_provider);

		// create network
		this._k_network = Providers.activate(_g_provider, _g_chain);
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}

	get provider(): ProviderStruct {
		return this._g_provider;
	}

	/**
	 * Subscribes to Tendermint ABCI events on the exposed Websocket port
	 * @param a_events 
	 * @param g_hooks 
	 * @returns 
	 */
	async subscribeTendermintAbci(a_events: string[], g_hooks: ReceiverHooks): Promise<TendermintConnection> {
		const {
			_g_provider,
		} = this;

		return await TendermintConnection.connect(_g_provider, a_events, g_hooks);
	}

	get connections(): TendermintConnection[] {
		return [this._kc_blocks, ...this._a_accounts];
	}

	/**
	 * Performs a health check on the underlying sockets, recreating them if necessary
	 */
	async wake(xt_acceptable=0, xt_socket=Infinity): Promise<void> {
		if(this._kc_blocks) {
			for(const kc_account of this.connections) {
				const [, xc_timeout] = await timeout_exec(xt_socket || Infinity, () => kc_account.wake(xt_acceptable));

				if(xc_timeout) throw new NetworkTimeoutError();
			}
		}
		else {
			throw new Error('Network Feed was already destroyed');
		}
	}

	/**
	 * Recreates the current instance
	 * @returns 
	 */
	async recreate(): Promise<NetworkFeed> {
		return await NetworkFeed.create(this._g_chain, this._g_provider, this._gc_hooks);
	}

	destroy() {
		if(this._kc_blocks) {
			try {
				// destroy all connections
				for(const kc_each of this.connections) {
					kc_each.destroy();
				}

				// mark feed destroyed
				this._kc_blocks = null;
			}
			catch(e_destroy) {}
		}
	}

	async followBlocks(): Promise<void> {
		const {
			_p_chain,
			_p_provider,
		} = this;

		// listen for new blocks
		const a_recents: number[] = [];
		try {
			// assign block connection
			this._kc_blocks = await this.subscribeTendermintAbci([
				`tm.event='NewBlock'`,
			], {
				// // some error ocurred on socket
				// error(g_error) {
				// 	console.error(`Error on <${this._g_provider.rpcHost}> Websocket:\n%o`, g_error);

				// 	// delete h_sockets[p_chain];
				// },

				// response
				data(g_value, si_txn) {
					// push to recents list
					a_recents.push(Date.now());

					// cast-assign block struct
					const g_block = g_value.block as {
						header: BlockInfoHeader;
						data: {
							txs: [];
						};
					};

					// prune recents
					while(a_recents.length > 16) {
						a_recents.shift();
					}

					// broadcast
					global_broadcast({
						type: 'blockInfo',
						value: {
							header: g_block.header,
							chain: _p_chain,
							provider: _p_provider,
							recents: a_recents,
							txCount: g_block.data.txs.length,
						},
					});
				},
			});
		}
		catch(e_listen) {
			syserr({
				title: 'Websocket Error',
				error: e_listen,
			});
		}
	}

	async followBroadcasts() {
		const {
			_g_chain,
			_g_provider,
			_p_chain,
			_k_network,
		} = this;

		const h_abcis: Dict<AbciConfig> = {
			...tx_abcis(_g_chain, {
				gov: {
					filter: `message.action='submit_proposal'`,

					data() {
						const s_contact = 'Someone';
						const si_prop = '??';
						// TODO: finish

						const g_notify = {
							title: `📄 New Governance Proposal`,
							text: `Proposition ${si_prop}`,
						};
					},
				},
			}),
		};

		for(const [si_event, g_event] of ode(h_abcis)) {
			await this.subscribeTendermintAbci(g_event.filter, g_event.hooks);
		}
	}

	async followAccounts(): Promise<void> {
		const {
			_g_chain,
		} = this;

		// read accounts store
		const ks_accounts = await Accounts.read();

		// each account (on cosmos)
		for(const [p_account, g_account] of ks_accounts.entries()) {
			// follow address
			void this.followAccount(g_account);
		}
	}

	async followAccount(g_account: AccountStruct): Promise<Dict<TendermintConnection>> {
		const {
			_g_chain,
			_g_provider,
			_p_chain,
			_k_network,
			_gc_hooks,
		} = this;

		const k_feed = this;

		const sa_agent = Chains.addressFor(g_account.pubkey, _g_chain);

		const g_context_vague: LocalAppContext = {
			g_app: G_APP_EXTERNAL,
			p_app: Apps.pathFrom(G_APP_EXTERNAL),
			g_chain: _g_chain,
			p_chain: Chains.pathFrom(_g_chain),
			g_account,
			p_account: Accounts.pathFrom(g_account),
			sa_owner: Chains.addressFor(g_account.pubkey, _g_chain),
		};

		const h_abcis: Dict<AbciConfig> = {
			...account_abcis(_k_network, g_context_vague, (gc_notify) => {
				void _gc_hooks.notify?.(gc_notify, k_feed);
			}),

			unbonding: {
				filter: [
					`complete_unbonding.delegator='${sa_agent}'`,
				],

				hooks: {
					data() {
						debugger;
						console.log(`<${_g_provider.rpcHost}> emitted ${si_event} event: %o`, g_data);
					},
				},
			},
		};

		const h_streams: Dict<TendermintConnection> = {};

		for(const [si_event, g_event] of ode(h_abcis)) {
			// start listening to events
			const kc_account = await this.subscribeTendermintAbci(g_event.filter, g_event.hooks);

			// add connection to list
			this._a_accounts.push(kc_account);

			// // start to synchronize all txs since previous sync height
			const di_synchronize = this._k_network.synchronize_v2('tx_out', g_event.filter, g_context_vague.p_account);
			for await(const {g_tx, g_result, g_synced} of di_synchronize) {
				// TODO: don't imitate websocket data, make a canonicalizer for the two different data sources instead

				// imitate websocket data
				const g_value: WsTxResponse = {
					height: g_result.height,
					tx: buffer_to_base64(g_result.tx!.value),
					result: {
						gas_used: g_result.gasUsed,
						gas_wanted: g_result.gasWanted,
						log: g_result.rawLog,
						...g_result,
						events: [],
					},
				};

				// apply
				await g_event.hooks.data?.({TxResult:g_value} as unknown as JsonObject, {
					si_txn: g_result.txhash,
					g_synced,
				});
			}
		}
	}
}


export class TendermintConnection {
	static async connect(_g_provider: ProviderStruct, a_events: string[], g_hooks: ReceiverHooks): Promise<TendermintConnection> {
		return new Promise((fk_connect, fe_connect) => {
			try {
				// create connection
				const k_connection = new TendermintConnection(_g_provider, a_events, {
					...g_hooks,

					// intercept connect hooks
					connect() {
						// forward event to caller
						void g_hooks.connect?.();

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

	protected _xt_previous = 0;

	// flag for preventing double error callback
	protected _b_closed = false;

	private constructor(protected _g_provider: ProviderStruct, _a_events: string[], g_hooks: ReceiverHooks) {
		const p_host = _g_provider.rpcHost;

		if(!p_host) throw new Error('Cannot subscribe to events; no RPC host configured on network');

		// init websocket
		const d_ws = this._d_ws = new WebSocket(`wss://${p_host}/websocket`);

		// handle open event
		d_ws.onopen = (d_event) => {
			// send Tendermint ABCI subscribe message
			d_ws.send(JSON.stringify({
				id: '0',
				jsonrpc: '2.0',
				method: 'subscribe',
				params: {
					query: _a_events.join(' AND '),
				},
			}));

			// emit connect event
			void g_hooks.connect?.();
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
				console.warn(`<${p_host}> sent invalid JSON over Websocket:\n${d_event.data}`);
				return;
			}

			// no data; exit
			if(!Object.keys(g_msg?.result ?? {}).length) return;

			// attempt to access payload
			let g_value: JsonObject;
			let h_events: CosmosEvents;
			try {
				const g_result = g_msg.result! as Dict<JsonObject>;
				g_value = g_result.data.value as JsonObject;
				h_events = g_result.events as unknown as CosmosEvents;
			}
			catch(e_destructre) {
				console.warn(`<${p_host}> sent unrecognized JSON struct over Websocket:\n${d_event.data}`);
				return;
			}

			// valid data; emit
			if(g_value) {
				void g_hooks.data(g_value, {
					si_txn: h_events['tx.hash']?.[0] || '',
				});
			}
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
				if(g_hooks.error) {
					void g_hooks.error(g_error);
				}
				// no listener, log error
				else {
					console.error(`Error on <${p_host}> Websocket:\n%o`, g_error);
				}
			}
		};
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
			if(Date.now() - xt_acceptable < this._xt_previous) return;

			// listen for message
			this._d_ws.addEventListener('message', () => {
				// resolve promise
				fk_resolve();
			}, {
				once: true,
			});

			// send health check message
			this._d_ws.send(JSON.stringify({
				id: '0',
				jsonrpc: '2.0',
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
