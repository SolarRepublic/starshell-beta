import type {AbciConfig, ReceiverError, ReceiverHooks} from './service-tx-abcis';

import type {AccountPath, AccountStruct} from '#/meta/account';
import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {Bech32, ChainPath, ChainStruct, ContractPath, ContractStruct} from '#/meta/chain';
import type {ProviderStruct, ProviderPath} from '#/meta/provider';

import {Chains} from './ics-witness-imports';
import {global_broadcast, global_receive, global_wait} from './msg-global';
import {account_abcis} from './service-tx-abcis';

import {syserr} from '#/app/common';
import type {LocalAppContext} from '#/app/svelte';
import type {CosmosNetwork} from '#/chain/cosmos-network';
import {TmJsonRpcWebsocket} from '#/cosmos/tm-json-rpc-ws-const';
import type {TjrwsValueNewBlock, TjrwsValueTxResult, WsTxResponse} from '#/cosmos/tm-json-rpc-ws-def';
import type {NotificationConfig} from '#/extension/notifications';
import {Accounts} from '#/store/accounts';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {ContractRole, Contracts} from '#/store/contracts';
import {NetworkTimeoutError, Providers} from '#/store/providers';
import {Snip2xToken} from '#/schema/snip-2x-const';

import {ode, timeout, timeout_exec} from '#/util/belt';
import {buffer_to_base64} from '#/util/data';
import type { SecretNetwork } from '#/chain/secret-network';
import { Limiter } from '#/util/limiter';


const XT_ERROR_THRESHOLD_RESTART = 120e3;
const XT_CONNECTION_TIMEOUT = 10e3;

const NL_WINDOW_BLOCKS = 16;

interface FeedHooks {
	notify?(gc_notify: NotificationConfig, k_feed: NetworkFeed): Promisable<void>;
}

interface TokenState {
	accounts: AccountStruct[];
}

const H_FEEDS: Record<ChainPath, NetworkFeed> = {};
const H_FEEDS_TOKENS: Record<ChainPath, NetworkFeed> = {};
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

		// list of feed creation promises
		const a_feeds: Promise<NetworkFeed>[] = [];

		// each chain
		for(const [p_chain, g_chain] of ks_chains.entries()) {
			// skip cosmos
			if('/family.cosmos/chain.theta-testnet-001' === p_chain) continue;

			// lock socket for chain
			await navigator.locks.request(`net:feed:${Chains.caip2From(g_chain)}`, async() => {
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

				// final provider selection
				let g_selected: ProviderStruct | null = null;

				// quick provider test
				const a_failures: [ProviderStruct, Error][] = [];
				for(let i_provider=0, nl_providers=a_providers.length; i_provider<nl_providers; i_provider++) {
					const g_provider = a_providers[i_provider];

					// skip disabled provider
					if(!g_provider.on) continue;

					// perform a quick test on provider
					try {
						await Providers.quickTest(g_provider, g_chain);

						// success, use it
						g_selected = g_provider;
						break;
					}
					// provider test failed
					catch(e_test) {
						a_failures.push([g_provider, e_test as Error]);
					}
				}

				// prep failure summary
				const s_provider_errors = `Encountered errors on providers:\n\n${a_failures.map(([g, e]) => `${g.name}: ${e.message}`).join('\n\n')}`;

				// no providers passed
				if(!g_selected) {
					console.error('All providers failed: %o', a_failures);

					throw syserr({
						title: 'All providers offline',
						text: s_provider_errors,
					});
				}

				// some failures with attempted providers
				if(a_failures.length) {
					console.warn(s_provider_errors);
				}

				// destroy old feed
				H_FEEDS[p_chain]?.destroy?.();

				console.debug(`🌊 Creating network feed for ${Chains.caip2From(g_chain)} on <${g_selected.grpcWebUrl}>`);

				// create new feed for top chain
				const dp_feed = NetworkFeed.create(g_chain, g_selected, gc_feed);

				// create a supplemental feed for tokens only
				{
					H_FEEDS_TOKENS[p_chain]?.destroy?.();
					const k_feed = new NetworkFeed(g_chain, g_selected, gc_feed);
					(async() => {
						await k_feed.open();
						await k_feed.followTokens();
						H_FEEDS_TOKENS[p_chain] = k_feed;
					})();
				}

				a_feeds.push(dp_feed.then(k_feed => H_FEEDS[p_chain] = k_feed));
			});
		}

		// return once they have all resolved
		return await Promise.all(a_feeds);
	}

	static async pickProvider(p_chain: ChainPath, p_provider: ProviderPath, gc_feed: FeedHooks): Promise<NetworkFeed> {
		const g_chain = (await Chains.at(p_chain))!;
		const g_provider = (await Providers.at(p_provider))!;

		H_FEEDS[p_chain]?.destroy?.();

		return await NetworkFeed.create(g_chain, g_provider, gc_feed);
	}

	/**
	 * Creates a network feed for an individual chain+provider
	 * @param g_chain 
	 * @param g_provider 
	 * @param gc_feed 
	 * @returns 
	 */
	static async create(g_chain: ChainStruct, g_provider: ProviderStruct, gc_feed: FeedHooks): Promise<NetworkFeed> {
		// instantiate feed
		const k_feed = new NetworkFeed(g_chain, g_provider, gc_feed);

		// open socket
		await k_feed.open();

		try {
			// follow blocks
			await k_feed.followBlocks();

			// follow all accounts
			await k_feed.followAccounts();

			// // follow fungible tokens
			// await k_feed.followTokens();
		}
		catch(e_follow) {
			console.error(e_follow);
		}


		return k_feed;
	}

	// path to chain resource
	protected _p_chain: ChainPath;

	// path to provider resource
	protected _p_provider: ProviderPath;

	// active network instance
	protected _k_network: CosmosNetwork;

	// active socket wrapper instance
	protected _kc_socket: TmJsonRpcWebsocket | null = null;

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

	open(fe_socket?: (this: TmJsonRpcWebsocket, e_socket: ReceiverError) => Promisable<void>): Promise<void> {
		const {
			_g_provider,
			_p_provider,
		} = this;

		// nil socket
		if(this._kc_socket) throw new Error(`Websocket resource already exists on NetworkFeed instance`);

		let xt_error_prev = 0;

		function bail(k_this: TmJsonRpcWebsocket, g_error: ReceiverError) {
			// forward error to caller
			if(fe_socket) {
				fe_socket.call(k_this, g_error);
			}
			// no handler in hook, propagate up call stack
			else {
				throw new Error(`Failed to heal from connection error in <${k_this.host}>: ${
					JSON.stringify({
						code: g_error.code,
						reason: g_error.reason,
						wasClean: g_error.wasClean,
					})
				}`);
			}
		}

		return new Promise((fk_resolve, fe_reject) => {
			// socket opened state
			let b_opened = false;

			let f_connected: VoidFunction;

			this._kc_socket = new TmJsonRpcWebsocket(_g_provider, {
				connect() {
					// websocket opened
					b_opened = true;

					f_connected?.();

					// resolve promise
					fk_resolve();
				},

				error(g_error) {
					// socket was never opened; reject promise
					if(!b_opened) return fe_reject(g_error);

					console.error(`Attempting to recover from connection error on <${this.host}>: %o`, g_error);
					debugger;

					// infrequent error
					if(Date.now() - xt_error_prev > XT_ERROR_THRESHOLD_RESTART) {
						// start waiting for connection
						(async() => {
							// wait for up to 10 seconds for connection to be established
							const [, xc_timeout] = await timeout_exec(XT_CONNECTION_TIMEOUT, () => new Promise(fk_resolve_connect => f_connected = () => {
								// resolve promise
								fk_resolve_connect(1);
							}));

							// timeout
							if(xc_timeout) {
								// destroy the connection
								this.destroy();

								// forward original error to caller
								bail(this, g_error);
							}
						})();

						b_opened = false;

						// attempt to restart the connection automatically
						this.restart();
					}
					else {
						bail(this, g_error);
					}

					xt_error_prev = Date.now();
				},
			});
		});
	}

	/**
	 * Performs a health check on the underlying socket, recreating it if necessary
	 * @param xt_acceptable - max age to consider sockets still awake
	 * @param xt_socket - amount of time to wait for ping response
	 */
	async wake(xt_acceptable=0, xt_socket=Infinity): Promise<void> {
		if(this._kc_socket) {
			const [, xc_timeout] = await timeout_exec(xt_socket || Infinity, () => this._kc_socket!.wake(xt_acceptable));

			if(xc_timeout) throw new NetworkTimeoutError();
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
		// destroy it
		this.destroy();

		// create new feed
		return await NetworkFeed.create(this._g_chain, this._g_provider, this._gc_hooks);
	}

	/**
	 * Destroys the underyling JSON-RPC websocket connection
	 */
	destroy(): void {
		const {
			_kc_socket,
		} = this;

		if(_kc_socket) {
			try {
				// destroy connection
				_kc_socket.destroy();

				// mark feed destroyed
				this._kc_socket = null;
			}
			catch(e_destroy) {}
		}
	}

	/**
	 * Subscribes to NewBlock events
	 */
	async followBlocks(): Promise<void> {
		const {
			_p_chain,
			_p_provider,
			_kc_socket,
		} = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

		// timestamps of recent blocks
		const a_recents: number[] = [];

		// subscribe to new blocks
		await _kc_socket.subscribe<TjrwsValueNewBlock>([
			`tm.event='NewBlock'`,
		], (g_result) => {
			// push to recents list
			a_recents.push(Date.now());

			// prune recents
			while(a_recents.length > NL_WINDOW_BLOCKS) {
				a_recents.shift();
			}

			// ref block
			const g_block = g_result.data.value.block;

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
		});
	}

	// async followBroadcasts() {
	// 	const {
	// 		_g_chain,
	// 		_g_provider,
	// 		_p_chain,
	// 		_k_network,
	// 	} = this;

	// 	// nil socket
	// 	if(!this._kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);


	// 	const h_abcis: Dict<AbciConfig> = {
	// 		...tx_abcis(_g_chain, {
	// 			gov: {
	// 				filter: `message.action='submit_proposal'`,

	// 				data() {
	// 					const s_contact = 'Someone';
	// 					const si_prop = '??';
	// 					// TODO: finish

	// 					const g_notify = {
	// 						title: `📄 New Governance Proposal`,
	// 						text: `Proposition ${si_prop}`,
	// 					};
	// 				},
	// 			},
	// 		}),
	// 	};

	// 	const kc_socket = this._kc_socket!;

	// 	await Promise.all(ode(h_abcis).map(([si_event, g_event]) => {
	// 		kc_socket.subscribe(g_event.filter, g_event.hooks.data);
	// 	}))

	// 	for(const [si_event, g_event] of ode(h_abcis)) {

	// 		await this.subscribeTendermintAbci(g_event.filter, g_event.hooks);
	// 	}
	// }

	async followAccounts(): Promise<void> {
		// read accounts store
		const ks_accounts = await Accounts.read();

		// each account (on cosmos)
		await Promise.all(ks_accounts.entries().map(([, g_account]) => this.followAccount(g_account)));
	}

	async followAccount(g_account: AccountStruct): Promise<Dict<TmJsonRpcWebsocket>> {
		const {
			_g_chain,
			_g_provider,
			_p_chain,
			_k_network,
			_gc_hooks,
			_kc_socket,
		} = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

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

			// unbonding: {
			// 	type: 'tx_in',

			// 	filter: [
			// 		`complete_unbonding.delegator='${sa_agent}'`,
			// 	],

			// 	hooks: {
			// 		data() {
			// 			debugger;
			// 			// console.log(`<${_g_provider.rpcHost}> emitted ${si_event} event: %o`, g_data);
			// 		},
			// 	},
			// },
		};

		const h_streams: Dict<TmJsonRpcWebsocket> = {};

		for(const [si_event, g_abci] of ode(h_abcis)) {
			// start listening to events
			const kc_account = await _kc_socket.subscribe<TjrwsValueTxResult>(g_abci.filter, (g_result) => {
				// call hook with destructured data
				g_abci.hooks.data.call(this, g_result.data.value, {
					si_txn: g_result.events['tx.hash'][0],
				});
			});

			// start to synchronize all txs since previous sync height
			const di_synchronize = this._k_network.synchronize(g_abci.type, g_abci.filter, g_context_vague.p_account);
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
				await g_abci.hooks.data?.call(kc_account, {TxResult:g_value} as unknown as JsonObject, {
					si_txn: g_result.txhash,
					g_synced,
				});
			}
		}

		return h_streams;
	}

	async followTokens() {
		const {
			_p_chain,
			_g_chain,
			_kc_socket,
		} = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

		// gather set of fungible tokens
		const h_tokens: Record<ContractPath, TokenState> = {};

		// load accounts
		const ks_accounts = await Accounts.read();

		// read contracts store
		const ks_contracts = await Contracts.read();

		// select fungible tokens on this chain that are enabled
		const a_candidates = await ks_contracts.filterRole(ContractRole.FUNGIBLE, {
			chain: _p_chain,
			on: 1,
		});

		// on secretwasm
		if(_g_chain.features.secretwasm) {
			// each token
			for(const [p_contract, g_contract] of a_candidates) {
				// prep list of accounts that follow this token
				const g_state = h_tokens[p_contract] = {
					accounts: [] as AccountStruct[],
				};

				const a_accounts = g_state.accounts;

				// each account
				for(const [, g_account] of ks_accounts.entries()) {
					const a_viewing_key = await Snip2xToken.viewingKeyFor(g_contract, _g_chain, g_account);

					// account does not hold this token
					if(!a_viewing_key) continue;

					// add account to list
					a_accounts.push(g_account);
				}

				await this._subscribe_contract(g_contract, a_accounts);
			}

			// new token added
			global_receive({
				async tokenAdded({p_contract, p_chain, p_account}) {
					const [
						g_contract,
						g_chain,
						g_account,
					] = await Promise.all([
						Contracts.at(p_contract),
						Chains.at(p_chain),
						Accounts.at(p_account),
					]);

					const a_viewing_key = await Snip2xToken.viewingKeyFor(g_contract!, g_chain!, g_account!);

					// account does not hold this token
					if(!a_viewing_key) return;

					// add account to existing list of accounts that subscribe to this token
					if(h_tokens[p_contract]) {
						h_tokens[p_contract].accounts.push(g_account!);
					}
					// create new subscription
					else {
						const a_accounts = [g_account!];

						h_tokens[p_contract] = {
							accounts: a_accounts,
						};

						await this._subscribe_contract(g_contract, a_accounts);
					}
				},
			})
		}
	}

	async _subscribe_contract(g_contract: ContractStruct, a_accounts: AccountStruct[]) {
		const {
			_kc_socket,
		} = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

		// prep limiter for checking contract state
		const k_limiter = new Limiter(() => {
			for(const g_account of a_accounts) {
				void this.checkSnip20(g_contract, g_account);
			}
		}, {
			resolution: 90e3,  // 90 second resolution
		});

		// subscribe to new executions
		await _kc_socket.subscribe<TjrwsValueNewBlock>([
			`wasm.contract_address='${g_contract.bech32}'`,
		], async() => {
			console.debug(`Sending notice to check on ${g_contract.name}`);

			await global_wait('blockInfo', ({chain:p_chain}) => p_chain === this._p_chain, 9e3);

			await timeout(1e3);

			// queue an update on this token for each account that owns it
			void k_limiter.notice();
		});

		// initialize
		void k_limiter.notice();
	}

	async checkSnip20(g_contract: ContractStruct, g_account: AccountStruct) {
		const {
			_k_network,
		} = this;

		const k_snip20 = Snip2xToken.from(g_contract, _k_network as SecretNetwork, g_account)!;
		if(!k_snip20) {
			console.error(`${g_contract.name} (${g_contract.bech32}) is not a SNIP-20 token`);
			return;
		}

		try {
			// transaction history method available on contract
			if(k_snip20.snip21) {
				await k_snip20.transactionHistory();
			}
			// fallback to transfer history
			else {
				const a_history = await k_snip20.transferHistory(16);

				debugger;
				console.log({
					a_history,
				});
			}
		}
		catch(e_query) {
			debugger;
			console.error(e_query);
		}
	}
}
