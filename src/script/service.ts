import type Browser from 'webextension-polyfill';

import {B_IPHONE_IOS, B_IOS_NATIVE, G_USERAGENT, R_CAIP_2, XT_TIMEOUT_APP_PERMISSIONS, XT_TIMEOUT_SERVICE_REQUEST} from '#/share/constants';

import {do_webkit_polyfill} from './webkit-polyfill';

if(B_IOS_NATIVE) {
	do_webkit_polyfill((s: string, ...a_args: any[]) => console.debug(`StarShell.background: ${s}`, ...a_args));
}

import type {
	ExtToNative,
	IcsToService,
	IntraExt,
	ServiceToIcs,
	SessionCommand,
} from './messages';


import type {AccountStruct, AccountPath} from '#/meta/account';
import {AppApiMode, type AppStruct} from '#/meta/app';
import type {JsonObject, JsonValue} from '#/meta/belt';
import type {Caip2, ChainStruct, ChainPath} from '#/meta/chain';
import type {IncidentPath} from '#/meta/incident';
import type {SecretStruct} from '#/meta/secret';
import type {Vocab} from '#/meta/vocab';

import {fromBech32, toBech32} from '@cosmjs/encoding';
import {decodeTxRaw} from '@cosmjs/proto-signing';
import {BroadcastMode} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
import {MsgExecuteContract} from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/tx';
import {MsgExecuteContract as SecretMsgExecuteContract} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/msg';

import IcsHost from './ics-host';
import McsRatifier from './mcs-ratifier';
import {open_flow} from './msg-flow';
import {global_broadcast, global_receive} from './msg-global';
import {set_keplr_compatibility_mode} from './scripts';
import {app_blocked, check_app_permissions, page_info_from_sender, parse_sender, position_widow_over_tab, request_advertisement, RetryCode, unlock_to_continue} from './service-apps';

import {NetworkFeed} from './service-feed';
import {H_HANDLERS_ICS_APP} from './service-handlers-ics-app';

import {amino_to_base, encode_proto, proto_to_amino} from '#/chain/cosmos-msgs';
import {pubkey_to_bech32} from '#/crypto/bech32';
import SensitiveBytes from '#/crypto/sensitive-bytes';
import {Vault} from '#/crypto/vault';
import type {NotificationConfig} from '#/extension/notifications';
import {process_permissions_request} from '#/extension/permissions';
import {PublicStorage, storage_clear, storage_get, storage_get_all, storage_remove, storage_set} from '#/extension/public-storage';
import {SessionStorage} from '#/extension/session-storage';
import type {InternalConnectionsResponse} from '#/provider/connection';
import {add_utility_key, import_private_key} from '#/share/account';
import {factory_reset, reinstall} from '#/share/auth';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Histories, Incidents} from '#/store/incidents';
import {NetworkTimeoutError, Providers} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {F_NOOP, ode, timeout, timeout_exec} from '#/util/belt';
import {base58_to_buffer, base64_to_buffer, base93_to_buffer, buffer_to_base58, buffer_to_base64, buffer_to_base93, buffer_to_hex, buffer_to_text, hex_to_buffer, sha256_sync, text_to_base64, text_to_buffer} from '#/util/data';
import {stringify_params, uuid_v4} from '#/util/dom';
import { system_notify } from '#/extension/browser';
import { EntropyProducer } from '#/crypto/entropy';
import {Settings, type SettingsRegistry} from '#/store/settings';
import BigNumber from 'bignumber.js';


const f_runtime_ios: () => Vocab.TypedRuntime<ExtToNative.MobileVocab> = () => chrome.runtime;

const f_scripting = () => chrome.scripting as Browser.Scripting.Static;



type MessageSender = chrome.runtime.MessageSender;

type SendResponse = (w_data?: any) => void;

type MessageHandler<w_msg=any> = (g_msg: w_msg, g_sender: MessageSender, fk_respond: SendResponse) => void | boolean;


/**
 * Generate a new private/shared secret key of the specified size in bytes (defaults to 512-bit key)
 */
function generate_key(nb_size=64): string {
	// prep space in memory
	const atu8_secret = new Uint8Array(nb_size);

	// fill with crypto random values
	crypto.getRandomValues(atu8_secret);

	// convert to hex string
	return Array.from(atu8_secret).map(x => x.toString(16).padStart(2, '0')).join('');
}


const H_SESSION_STORAGE_POLYFILL: Vocab.Handlers<SessionCommand> = 'function' === typeof chrome.storage?.session?.get
	? {
		async get(si_key: string): Promise<JsonValue> {
			return (await chrome.storage.session.get([si_key]))[si_key];
		},

		set(h_set: JsonObject): Promise<void> {
			return chrome.storage.session.set(h_set);
		},

		remove(si_key: string): Promise<void> {
			return chrome.storage.session.remove(si_key);
		},

		clear(): Promise<void> {
			return chrome.storage.session.clear();
		},
	}
	: {
		get(si_key: string) {
			const w_value = sessionStorage.getItem(si_key);
			return w_value? JSON.parse(w_value): null;
		},

		set(h_set: JsonObject) {
			for(const [si_key, w_value] of ode(h_set)) {
				sessionStorage.setItem(si_key, JSON.stringify(w_value));
			}
		},

		remove(si_key: string) {
			sessionStorage.removeItem(si_key);
		},

		clear() {
			sessionStorage.clear();
		},
	};

/**
 * message handlers for the public vocab from ICS
 */
const H_HANDLERS_ICS: Vocab.HandlersChrome<IcsToService.PublicVocab> = {
	async whoami(w_ignore, g_sender, fk_respond) {
		const i_window = g_sender.tab?.windowId;

		const g_window = await chrome.windows?.get(i_window!) || null;

		fk_respond({
			...g_sender,
			window: g_window,
		});
	},

	// 
	panic(g_msg, g_sender) {
		// TODO: handle
	},

	// page is requesting advertisement via ics-spotter
	async requestAdvertisement(g_msg, g_sender, fk_respond) {
		// TODO: not calling back respond handler causes issues with the receiver, create special return value for "ignore"


		const g_app = await request_advertisement(g_msg.profile, g_sender);

		// blocked or rejected
		if(!g_app) return;

		// ref tab id
		const i_tab = g_sender.tab!.id!;

		// secrets for this session
		const g_secrets: ServiceToIcs.SessionKeys = {
			session: generate_key(),
		};

		// execute isolated-world content script 'host'
		void f_scripting().executeScript({
			target: {
				tabId: i_tab,
			},
			func: IcsHost,
			args: [g_secrets],
			world: 'ISOLATED',
		});

		// execute main-world content script 'ratifier'
		void f_scripting().executeScript({
			target: {
				tabId: i_tab,
			},
			func: McsRatifier,
			args: [g_secrets],
			world: 'MAIN',
		});

		// respond to inpage content script with session secrets
		fk_respond(g_secrets);
	},

	async requestConnection(g_msg, g_sender, fk_respond) {
		// check app's permissions and normalize the object
		const g_check = await check_app_permissions(g_sender, g_msg.profile);

		// app does not have permissions; silently ignore
		if(!g_check) return;

		// destructure
		const {
			g_app,
			b_registered,
			g_page,
		} = g_check;

		// cache existing chains
		const ks_chains = await Chains.read();

		const h_chains_banned: Record<Caip2.String, ChainStruct> = {};

		// review requested chains
		const h_chains_manifest = g_msg.chains;
		for(const [si_caip2, g_chain_manifest] of ode(g_msg.chains)) {
			// lookup existing chain
			const p_chain = Chains.pathFrom(g_chain_manifest);
			const g_chain_existing = ks_chains.at(p_chain);

			// chain exists; replace request with existing one
			if(g_chain_existing) {
				h_chains_manifest[si_caip2] = g_chain_existing;
			}
			// chain does not yet exist
			else {
				// in beta, do not accept arbitrary chains
				delete h_chains_manifest[si_caip2];
				h_chains_banned[si_caip2] = g_chain_manifest;
			}
		}

		// chains were deleted
		if(Object.keys(h_chains_banned).length) {
			await open_flow({
				flow: {
					type: 'illegalChains',
					value: {
						app: g_app,
						chains: h_chains_banned,
					},
					page: g_page,
				},
				open: await position_widow_over_tab(g_sender.tab!.id!),
			});
		}

		// no valid chains
		if(!Object.keys(h_chains_manifest).length) {
			fk_respond({});
			return;
		}

		// app might already have connection
		if(b_registered) {
			// ref existing connections
			const h_connections_existing = g_app.connections;

			// fetch all connected accounts
			const as_account_paths = new Set<AccountPath>();
			for(const [, g_connection] of ode(h_connections_existing)) {
				for(const p_account of g_connection.accounts) {
					as_account_paths.add(p_account);
				}
			}

			// distill the request
			const {
				h_connections,
			} = process_permissions_request({
				a_account_paths: [...as_account_paths],
				h_chains: g_msg.chains,
				h_sessions: g_msg.sessions,
			});

			// create hypothetical connection set by copying current permissions onto requested ones
			for(const [p_chain, g_connection_existing] of ode(h_connections_existing)) {
				const g_connection = h_connections[p_chain];
				g_connection.permissions = g_connection_existing.permissions;
			}

			// connections are identical
			const sx_connections = JSON.stringify(h_connections);
			const sx_connections_existing = JSON.stringify(h_connections_existing);
			if(sx_connections === sx_connections_existing) {
				// prep approved connections response
				const h_connections_approved = h_connections_existing as InternalConnectionsResponse;

				// populate each connection with corresponding chain definition
				for(const [p_chain, g_connection] of ode(h_connections_approved)) {
					g_connection.chain = ks_chains.at(p_chain)!;
				}

				// preapprove requrest with existing connections
				fk_respond(h_connections_approved);
				return;
			}
		}

		// open flow
		const {answer:b_approved} = await open_flow({
			flow: {
				type: 'requestConnection',
				value: {
					app: g_app,
					chains: g_msg.chains,
					sessions: g_msg.sessions,
				},
				page: g_page,
			},
			open: await position_widow_over_tab(g_sender.tab!.id!),
		});

		if(b_approved) {
			// re-read chains since new ones may have been added
			const ks_chains_latest = await Chains.read();
			const p_app = Apps.pathFrom(g_app);
			const g_approved = await Apps.at(p_app);
			const h_connections = g_approved!.connections as InternalConnectionsResponse;

			// populate each connection with corresponding chain definition
			for(const [p_chain, g_connection] of ode(h_connections)) {
				g_connection.chain = ks_chains_latest.at(p_chain)!;
			}

			fk_respond(h_connections);
		}
	},

	// keplr was detected (similar to requestAdvertisement)
	async detectedKeplr(g_detected, g_sender, fk_respond) {
		// respond immediately, no need to wait
		fk_respond(null);

		// check if keplr is enabled
		CHECK_KEPLR_ENABLED:
		if('function' === typeof chrome.management?.get) {
			let g_keplr: chrome.management.ExtensionInfo;
			try {
				g_keplr = await chrome.management.get('dmkamcknogkgcdfhhbddcghachkejeap');
			}
			// not installed
			catch(e_get) {
				break CHECK_KEPLR_ENABLED;
			}

			// keplr is installed and enabled; do not interfere with it
			if(g_keplr.enabled) {
				console.debug(`Content Script at "${g_sender.url}" detected Keplr API but Keplr is installed and active, ignoring polyfill.`);
				return;
			}
		}

		// // check if wallet was locked before finding out app was already registered
		// const b_preauthed = await Vault.isUnlocked();

		// check for app permissions
		const g_status = await request_advertisement(g_detected.profile, g_sender, true);

		// blocked or rejected
		if(!g_status) return;

		// get page info
		const g_page = page_info_from_sender(g_sender);

		// app was previously registered
		if(g_status.b_registered) {
			const {g_app} = g_status;

			// 
			console.log('Suggesting to reload app %o', {
				g_app,
				g_sender,
			});

			// reload
			await open_flow({
				flow: {
					type: 'reloadAppTab',
					value: {
						app: g_app,
						page: g_page,
						preset: 'keplr',
					},
					page: g_page,
				},
				open: {
					...await position_widow_over_tab(g_page.tabId) || {},
					popover: g_page,
				},
			});
		}
	},

	async flowBroadcast(g_req, g_sender, fk_respond) {
		const {
			key: si_req,
			config: gc_prompt,
		} = g_req;

		// unknown source, silently reject
		if(!g_sender.url) {
			console.debug('Silently ignoring advertisement request from unknown source');
			return;
		}

		// get page info
		const g_page = page_info_from_sender(g_sender);

		// fallback
		if(!g_page.href) g_page.href = gc_prompt.flow.page?.href || '';

		// unlock wallet if locked
		const xc_retry = await unlock_to_continue(g_page);

		// non-zero retry code
		if(xc_retry) {
			// retry
			if(RetryCode.RETRY === xc_retry) {
				return await H_HANDLERS_ICS.flowBroadcast(g_req, g_sender, fk_respond);
			}

			// otherwise, cancel
			return;
		}

		// parse sender url
		const [s_scheme, s_host] = parse_sender(g_sender.url);

		// app is blocked; exit
		if(await app_blocked(s_scheme, s_host, g_sender)) return;

		console.info('app passed scheme check');

		// prep app descriptor
		const g_app = {
			scheme: s_scheme,
			host: s_host,
			connections: {},
		};

		gc_prompt.flow['value'].app = g_app;

		// forward request
		void open_flow(gc_prompt);
	},

	async sessionStorage(g_msg, g_sender, fk_respond) {
		const si_type = g_msg.type;
		const w_response = await H_SESSION_STORAGE_POLYFILL[si_type](g_msg.value);
		fk_respond(w_response);
	},
};

const a_feeds: NetworkFeed[] = [];

/**
 * message handlers for service instructions from popup
 */
const H_HANDLERS_INSTRUCTIONS: Vocab.HandlersChrome<IntraExt.ServiceInstruction> = {
	async sessionStorage(g_msg, g_sender, fk_respond) {
		const si_type = g_msg.type;
		const w_response = await H_SESSION_STORAGE_POLYFILL[si_type](g_msg.value);
		fk_respond(w_response);
	},

	async wake(_ignore, g_sender, fk_respond) {
		// ack
		fk_respond(true);

		// 
		for(const k_feed of a_feeds) {
			await navigator.locks.request(`net:feed:${k_feed.provider.rpcHost}`, async() => {
				// whether to recreate the feed
				let b_recreate = true;

				// 30 seconds of tolerance, wait for up to 5 seconds per socket, for a total of up to 30 seconds
				try {
					const [, xc_timeout] = await timeout_exec(30e3, () => k_feed.wake(30e3, 5e3));

					// feed is OK
					if(!xc_timeout) {
						b_recreate = false;
					}
				}
				catch(e_exec) {
					console.error(e_exec);
				}

				// recreate feed
				if(b_recreate) {
					console.warn(`Recreating delinquent network feed for ${k_feed.provider.rpcHost}`);

					// destroy existing feed
					k_feed.destroy();

					// remove from list
					a_feeds.splice(a_feeds.indexOf(k_feed), 1);

					// replace with new feed
					a_feeds.push(await k_feed.recreate());
				}
			});
		}
	},

	async whoisit(w_ignore, g_sender, fk_respond) {
		const a_tabs = await chrome.tabs.query({
			active: true,
			lastFocusedWindow: true,
			currentWindow: true,
		});

		if(1 === a_tabs?.length) {
			const g_tab = a_tabs[0];

			// prep app struct
			let g_app: AppStruct | null = null;

			// app registration state
			let b_registered = false;

			// logged in state
			let b_authed = false;

			// page has url
			const p_tab = g_tab.url;
			if(p_tab) {
				// parse page
				const [s_scheme, s_host] = parse_sender(p_tab);

				// foreign scheme
				if(!/^(file|https?)/.test(s_scheme)) {
					fk_respond(null);
					return;
				}

				// logged in
				if(await Vault.isUnlocked()) {
					b_authed = true;

					// lookup app in store
					g_app = await Apps.get(s_host, s_scheme);
				}

				// app definition exists
				if(g_app) {
					// app is registered and enabled; mark it such
					if(g_app.on) {
						b_registered = true;
					}
					// app is disabled
					else {
						// do nothing
					}
				}
				// app is not yet registered; create temporary app object in memory
				else {
					g_app = {
						on: 1,
						api: AppApiMode.UNKNOWN,
						name: (await SessionStorage.get(`profile:${new URL(p_tab).origin}`))?.name!
							|| g_tab.title || new URL(p_tab).host,
						scheme: s_scheme,
						host: s_host,
						connections: {},
						pfp: `pfp:${new URL(p_tab).origin}`,
					};
				}
			}

			const g_window = await chrome.windows?.get(g_tab.windowId) || null;

			fk_respond({
				tab: g_tab,
				window: g_window,
				app: g_app,
				registered: b_registered,
				authenticated: b_authed,
			});

			// done
			return;
		}

		fk_respond(null);
	},

	async reloadTab(gc_reload, g_sender, fk_respond) {
		// reload the tab
		await chrome.tabs.reload(gc_reload.tabId);

		// ack
		fk_respond(true);
	},

	async scheduleFlowResponse(gc_schedule, g_sender, fk_respond) {
		console.debug(`ServiceWorker::scheduleFlowResponse(${JSON.stringify(gc_schedule)})`);

		// destructure schedule config
		const {
			key: si_key,
			response: g_response,
		} = gc_schedule;

		// ack
		fk_respond(true);

		// allow window to close
		await timeout(500);

		// broadcast
		global_broadcast({
			type: 'flowResponse',
			value: {
				key: si_key,
				response: g_response,
			},
		});
	},

	async scheduleBroadcast(gc_schedule, g_sender, fk_respond) {
		console.debug(`ServiceWorker::scheduleBroadcast(${JSON.stringify(gc_schedule)})`);

		// ack
		fk_respond(true);

		// allow window to close
		await timeout(gc_schedule.delay || 1e3);

		// broadcast
		global_broadcast(gc_schedule.broadcast);
	},

	deepLink(gc_link, g_sender, fk_respond) {
		console.debug(`ServiceWorker::deepLink(${JSON.stringify(gc_link)})`);

		// ack
		fk_respond(true);

		// parse
		const d_url = new URL(gc_link.url);

		// valid deep link location
		if(['/qr'].includes(d_url.pathname)) {
			// parse hash
			const sx_hash = d_url.hash;

			// split into parts
			const a_parts = sx_hash.split('/');

			// // each part
			// switch(a_parts[0]) {
			// 	case 'chain': {
			// 		break;
			// 	}
			// }
		}
	},

	async bankSend(g_value, g_sender, fk_respond) {
		console.debug(`ServiceWorker::bankSend(${JSON.stringify(g_value)})`);

		// ack
		fk_respond(true);

		// dereference provider
		const g_provider = (await Providers.at(g_value.provider))!;

		// dereference chain
		const g_chain = (await Chains.at(g_provider.chain))!;

		// activate network
		const k_network = Providers.activate(g_provider, g_chain);

		// find account that owns address
		const [, g_account] = await Accounts.find(g_value.sender, g_chain);

		// ensure websocket is listening for transfers
		await await_transfer(`${g_provider.chain}\n${g_provider.rpcHost!}\n`, k_network, g_chain, g_account, g_value.sender, 'Send');

		console.debug(`awaiting transfer on ${g_provider.chain}...`);

		// execute transfer
		const g_attempt = await k_network.bankSend(
			g_value.sender,
			g_value.recipient,
			g_value.coin,
			BigInt(g_value.amount),
			BigInt(g_value.limit),
			g_value.price,
			g_value.memo,
			BroadcastMode.BROADCAST_MODE_SYNC,
			g_chain
		);

		console.debug(`Network received transaction`);

		// notification id
		const si_notifcation = `tx_out:${g_attempt.hash || uuid_v4()}`;
		let s_title = '';
		let s_message = '';

		// error
		if(0 !== g_attempt.code) {
			s_title = '❌ Network rejected transaction';
			s_message = `Error #${g_attempt.code}:: ${g_attempt.raw_log}`;
		}
		// no transaction hash
		else if(!g_attempt.hash) {
			s_title = '⚠️ Network issues';
			s_message = 'Transaction was accepted but might have gotten lost';
		}
		// success
		else {
			s_title = `Transaction sent to network`;
			s_message = `Waiting for confirmation on ${g_chain.name}...`;
		}

		// notify
		notify(si_notifcation, {
			title: s_title,
			message: s_message,
		});

		// record pending transaction as incident
		await Incidents.record({
			id: g_attempt.hash,
			type: 'tx_out',
			data: g_attempt,
		});
	},
};

/**
 * Handle messages from content scripts
 */
const message_router: MessageHandler = (g_msg, g_sender, fk_respond) => {
	// verbose
	console.debug(`Service received message %o %o`, g_msg, g_sender);

	// verify message structure
	if('object' === typeof g_msg && 'string' === typeof g_msg.type) {
		// debug message
		if('debug' === g_msg.type) {
			console.warn(`Service received debug message %o`, g_msg);
			return;
		}

		// default to ICS handlers
		let h_handlers: Vocab.HandlersChrome<IcsToService.PublicVocab | IntraExt.ServiceInstruction>;

		// ref message type
		const si_type = g_msg.type;

		// message originates from extension
		const b_origin_verified = g_sender.url?.startsWith(chrome.runtime.getURL('')) || false;
		if(chrome.runtime.id === g_sender.id && (b_origin_verified || 'null' === g_sender.origin)) {
			console.debug(`Routing message from extension as instruction to '${si_type}'`);
			h_handlers = H_HANDLERS_INSTRUCTIONS;
		}
		// message originates from tab (content script)
		else if(g_sender.tab && 'number' === typeof g_sender.tab.id) {
			// app message
			if(si_type in H_HANDLERS_ICS_APP) {
				// go async
				timeout_exec(XT_TIMEOUT_APP_PERMISSIONS, async() => {
					// check app permissions
					const g_check = await check_app_permissions(g_sender);

					// app does not have permissions; silently ignore
					if(!g_check) return fk_respond(null);

					// destructure
					const {g_app} = g_check;

					// ref chain and account paths
					const {
						chainPath: p_chain,
						accountPath: p_account,
					} = g_msg.value as {chainPath: ChainPath; accountPath: AccountPath};

					// ref connection
					const g_connection = g_app.connections[p_chain];

					// no connections on this chain; silently ignore
					if(!g_connection) return fk_respond(null);

					// app is not authorized to access this account; silently ignore
					if(!g_connection.accounts.includes(p_account)) return fk_respond(null);

					// route message to handler
					let w_return: any;
					try {
						w_return = await H_HANDLERS_ICS_APP[si_type](g_msg.value, {
							app: g_app,
							appPath: Apps.pathFrom(g_app),
							connection: g_connection,
						}, g_sender);
					}
					// catch errors
					catch(z_error) {
						debugger;

						// TODO: respond?
						fk_respond({
							error: z_error.stack,
						});

						// if(z_error instanceof Error) {

						// }
						// else {
						// 	fk_respond({
						// 		error: z_error,
						// 	});
						// }

						// do not respond twice
						return;
					}

					// respond with return value
					fk_respond({
						ok: w_return,
					});
				}).then(([, xc_timeout]) => {
					// service response timeout exceeded; fail
					if(xc_timeout) {
						fk_respond({
							error: 'Timed out while waiting for app permissions check',
						});
					}
				}).catch((e_handle: Error) => {
					fk_respond({
						error: `Uncaught message handler error: ${e_handle.message}`,
					});
				});

				return true;
			}
			// public message
			else {
				h_handlers = H_HANDLERS_ICS;
			}
		}
		// reject unknown senders
		else {
			console.error(`Refusing request from unknown sender: ${JSON.stringify(g_sender)}`);
			return;
		}

		// lookup handler
		const f_handler = h_handlers[si_type];

		// route message to handler
		if(f_handler) {
			// flag set once request has been terminated
			let b_terminated = false;

			// force a timeout if handler doesn't respond for some time
			const i_unresponsive = setTimeout(() => {
				// prevent tardy handler response from executing callback
				b_terminated = true;

				// respond to request
				fk_respond();
			}, XT_TIMEOUT_SERVICE_REQUEST);

			// wrap responder
			const fk_response_wrapper = (w_data?: any) => {
				// already terminated; exit
				if(b_terminated) return;

				// cancel timeout handler
				clearTimeout(i_unresponsive);

				// respond to request
				fk_respond(w_data);
			};

			// invoke handler
			const z_response = f_handler(g_msg.value, g_sender, fk_response_wrapper);

			// async handler
			if(z_response && 'function' === typeof z_response['then']) {
				return true;
			}
			// synchronous; clear unresponsive timeout
			else {
				clearTimeout(i_unresponsive);
			}
		}
		else {
			console.warn(`No service handler for ${si_type}`);
		}
	}
};

// bind message router listener
chrome.runtime.onMessage?.addListener(message_router);



chrome.runtime.onInstalled?.addListener(async(g_installed) => {
	// whether or not this is a fresh install
	const b_install = 'install' === g_installed.reason;

	// reinstall
	await reinstall(b_install);

	// pause for ui
	await timeout(1e3);

	// immediately open launcher on android
	if('Android' === G_USERAGENT.os.name) {
		// startup
		if(b_install) {
			chrome.tabs.create({
				url: 'https://launch.starshell.net/?setup',
			}, F_NOOP);
		}
	}
	// open start page on iOS
	else if(B_IPHONE_IOS) {
		// startup
		chrome.tabs.create({
			url: `src/entry/popup.html?${stringify_params({
				within: 'tab',
			})}`,
		}, F_NOOP);

		// contact native application
		try {
			const w_response = await f_runtime_ios().sendNativeMessage('application.id', {
				type: 'greet',
			});

			console.debug(`Response from native app: %o`, w_response);
		}
		catch(e_native) {}
	}

	// // upon first install, walk the user through setup
	// await flow_broadcast({
	// 	flow: {
	// 		type: 'authenticate',
	// 		page: null,
	// 	},
	// });

	// await chrome.storage.session.setAccessLevel({
	// 	accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS,
	// });

	// console.log('ok');

	// const f_scripting() = chrome.scripting as browser.Scripting.Static;


	// const g_waker = H_CONTENT_SCRIPT_DEFS.inpage_waker();

	// await f_scripting().registerContentScripts([
	// 	{
	// 		...g_waker,
	// 		// js: [
	// 		// 	's2r.signing.key#ae4261c',
	// 		// 	...g_waker.js,
	// 		// ],
	// 	},
	// ]);

	// const a_scripts = await f_scripting().getRegisteredContentScripts();
	// for(const g_script of a_scripts) {
	// 	console.log(g_script);
	// }
});

chrome.alarms?.clearAll(() => {
	console.warn('clear all');

	chrome.alarms.create('periodicChainQueries', {
		periodInMinutes: 1,
	});

	chrome.alarms.onAlarm.addListener((g_alarm) => {
		switch(g_alarm.name) {
			case 'periodicChainQueries': {
				// void periodic_check();
				break;
			}

			default: {
				break;
			}
		}
	});
});

const R_NOTIFICATION_ID = /^@([a-z]+):(.*)+/;

chrome.notifications?.onClicked?.addListener((si_notif) => {
	// dismiss notification
	chrome.notifications.clear(si_notif);

	// parse notification id
	const m_routable = R_NOTIFICATION_ID.exec(si_notif);

	console.log(`${si_notif} :: %o`, m_routable);

	if(m_routable) {
		const [, si_category, s_data] = m_routable;

		if('incident' === si_category) {
			void open_flow({
				flow: {
					type: 'inspectIncident',
					page: null,
					value: {
						incident: s_data as IncidentPath,
					},
				},
			});
		}
	}
});




// global message handler
global_receive({
	// user has authenticated
	async login() {
		// update compatibility mode based on apps and current settings
		await set_keplr_compatibility_mode();

		// start feeds
		a_feeds.push(...await NetworkFeed.createAll({
			// wire up notification hook
			notify: system_notify,
		}));
	},

	// user has logged out
	logout() {
		// destroy all feeds
		for(const k_feed of a_feeds) {
			k_feed.destroy();
		}
	},

	debug(w_msg: JsonValue) {
		console.debug(`Service witnessed global debug message: %o`, w_msg);
	},
});


// set compatibility mode based on apps and current settings
void set_keplr_compatibility_mode();

// development mode
console.log({
	'import.meta': import.meta,
});
if(import.meta.env?.DEV) {
	Object.assign(globalThis, {
		PublicStorage,
		Vault,
	});
}

Object.assign(globalThis, {
	async decrypt(si_store: string) {
		// fetch the root key
		const dk_root = await Vault.getRootKey();

		// derive the cipher key
		const dk_cipher = await Vault.cipherKey(dk_root!, true);

		// read from the store
		const kv_store = await Vault.readonly(si_store);

		// read the store as json
		const w_store = await kv_store.readJson(dk_cipher);

		return w_store;
	},

	Secrets,
	Accounts,
	Apps,
	Chains,
	Contracts,
	Histories,
	Incidents,
	Providers,

	EntropyProducer,

	base93_to_buffer,
	base58_to_buffer,
	buffer_to_base93,
	buffer_to_base58,
	base64_to_buffer,
	buffer_to_base64,
	sha256_sync,
	hex_to_buffer,
	buffer_to_hex,
	text_to_base64,
	text_to_buffer,
	buffer_to_text,
	pubkey_to_bech32,
	fromBech32,
	toBech32,
	SessionStorage,
	G_USERAGENT,

	add_utility_key,
	decodeTxRaw,
	set_keplr_compatibility_mode,
	SecretMsgExecuteContract,
	MsgExecuteContract,

	amino_to_base,
	proto_to_amino,
	encode_proto,

	global_broadcast,
	global_receive,

	factory_reset,

	storage_get,
	storage_get_all,
	storage_set,
	storage_remove,
	storage_clear,

	Settings,
	BigNumber,

	deep_seal(w_thing) {
		// blocking
		if(Object.isSealed(w_thing)) return w_thing;

		// anything else
		if('function' !== typeof w_thing && 'object' !== typeof w_thing) return;

		// seal this thing
		try {
			Object.seal(w_thing);
		}
		catch(e_seal) {
			console.log(`Cannot seal ${w_thing}`);
		}

		// each own property
		for(const [, g_descriptor] of Object.entries(Object.getOwnPropertyDescriptors(w_thing))) {
			// data descriptor
			if(g_descriptor.value) {
				deep_seal(g_descriptor.value);
			}
			// getter
			else if(g_descriptor.get) {
				const w_value = g_descriptor.get();

				if(w_value) {
					deep_seal(w_value);
				}
			}
		}

		// recurse on prototype
		deep_seal(Reflect.getPrototypeOf(w_thing));
	},

	async import_sk(sxb64_sk: string, s_name='Citizen '+uuid_v4().slice(0, 4)) {
		const atu8_sk = base64_to_buffer(sxb64_sk);

		const kn_sk = new SensitiveBytes(atu8_sk);

		return await import_private_key(kn_sk, s_name);
	},

	async import_account(g_account: AccountStruct): Promise<AccountPath> {
		return await Accounts.open(ks_accounts => ks_accounts.put(g_account));
	},

	async import_secrets(a_data: Array<number[]>, a_secrets: SecretStruct[]) {
		for(let i_secret=0; i_secret<a_secrets.length; i_secret++) {
			await Secrets.put(Uint8Array.from(a_data[i_secret]), a_secrets[i_secret]);
		}
	},

	async inspect_tx(si_tx: string, si_caip2: Caip2.String) {
		const [, si_namespace, si_reference] = R_CAIP_2.exec(si_caip2)!;
		const p_chain = Chains.pathFor(si_namespace as 'cosmos', si_reference);
		const g_chain = (await Chains.at(p_chain))!;
		const k_network = await Providers.activateDefaultFor(g_chain);
		return await k_network.fetchTx(si_tx);
	},
});


