import type Browser from 'webextension-polyfill';

import {B_IPHONE_IOS, G_USERAGENT, R_SCRT_COMPUTE_ERROR, R_TRANSFER_AMOUNT, XT_MINUTES} from '#/share/constants';

import type {Dict, JsonObject, JsonValue, Promisable} from '#/meta/belt';
import {F_NOOP, ode, timeout} from '#/util/belt';

import type {
	ExtToNative,
	IcsToService,
	IntraExt,
	ServiceToIcs,
} from './messages';

import IcsHost from './ics-host';
import McsRatifier from './mcs-ratifier';

import {
	set_keplr_compatibility_mode,
} from './scripts';

import type {Vocab} from '#/meta/vocab';
import {Vault} from '#/crypto/vault';
import {Apps} from '#/store/apps';
import {open_flow} from './msg-flow';
import {Chains} from '#/store/chains';
import {ActiveNetwork, Networks} from '#/store/networks';
import {fold_attrs, TypedEvent} from '#/chain/main';
import {Accounts} from '#/store/accounts';
import BigNumber from 'bignumber.js';
import {abbreviate_addr, format_amount} from '#/util/format';
import type {Bech32, Caip2, ChainInterface, ChainPath, NativeCoin} from '#/meta/chain';
import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import {global_broadcast, global_receive} from './msg-global';
import type {Network} from '#/meta/network';
import {syserr, syswarn} from '#/app/common';
import {Agents} from '#/store/agents';
import type {BlockInfoHeader} from './common';
import type {Account, AccountPath} from '#/meta/account';
import {Incidents} from '#/store/incidents';
import {WebResourceCache} from '#/store/web-resource-cache';
import {BroadcastMode} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
import type {Incident, IncidentPath, IncidentType, MsgEventRegistry, TxConfirmed} from '#/meta/incident';
import {to_fiat} from '#/chain/coin';
import type {Cw} from '#/meta/cosm-wasm';
import {stringify_params, uuid_v4} from '#/util/dom';
import {PublicStorage, storage_clear} from '#/extension/public-storage';
import type {InternalConnectionsResponse} from '#/provider/connection';
import {app_blocked, check_app_permissions, page_info_from_sender, parse_sender, position_widow_over_tab, request_advertisement, RetryCode, unlock_to_continue} from './service-apps';
import {process_permissions_request} from '#/extension/permissions';
import {base64_to_buffer, base93_to_buffer, buffer_to_base64, buffer_to_base93, buffer_to_hex, buffer_to_text, hex_to_buffer, sha256_sync, text_to_base64, text_to_buffer} from '#/util/data';
import {AppApiMode, type AppInterface} from '#/meta/app';
import {Secrets} from '#/store/secrets';
import {SecretWasm} from '#/crypto/secret-wasm';
import {decodeTxRaw} from '@cosmjs/proto-signing';
import {MsgExecuteContract as SecretMsgExecuteContract} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/msg';
import {bech32_to_pubkey, pubkey_to_bech32} from '#/crypto/bech32';
import {fromBech32, toBech32} from '@cosmjs/encoding';
import {Contracts} from '#/store/contracts';
import {H_HANDLERS_ICS_APP} from './service-handlers-ics-app';
import {SessionStorage} from '#/extension/session-storage';

type ServiceMessageHandler = (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void;


const f_runtime_ios: () => Vocab.TypedRuntime<ExtToNative.MobileVocab> = () => chrome.runtime;

const f_scripting = () => chrome.scripting as Browser.Scripting.Static;



// type aliases
interface StorageChange<w_value extends JsonValue> extends chrome.storage.StorageChange {
	newValue?: w_value;
	oldValue?: w_value;
}

type StorageArea = 'local' | 'session' | 'sync' | 'managed';

const H_STORAGE_SCHEMAS = {
	sync: {
		keplr_polyfill: {},
	},
	local: {
		// apps: {},
	},
	session: {},
	managed: {},
} as const;

type StorageListener<
	si_area extends StorageArea,
> = si_area extends StorageArea
	? Record<keyof typeof H_STORAGE_SCHEMAS[si_area], (g_change: StorageChange<SV_KeplrPolyfill>) => Promise<void>>
	: void;

type StorageListenerMap = {
	[si_area in StorageArea]?: StorageListener<si_area>;
};

type SV_KeplrPolyfill = boolean;


type StorageChangeCallback = (g_change: chrome.storage.StorageChange) => Promisable<void>;

const g_awaiters: Record<StorageArea, Dict<StorageChangeCallback[]>> = {
	sync: {},
	local: {},
	session: {},
	managed: {},
};

export function once_storage_changes(si_area: StorageArea, si_key: string, xt_timeout=0): Promise<chrome.storage.StorageChange> {
	return new Promise((fk_resolve, fe_reject) => {
		const h_awaiters = g_awaiters[si_area];
		const a_awaiters = h_awaiters[si_key] = h_awaiters[si_key] || [];

		let i_awaiter = -1;
		let i_timeout = 0;
		if(xt_timeout > 0) {
			i_timeout = (globalThis as typeof window).setTimeout(() => {
				// remove awaiter
				a_awaiters.splice(i_awaiter, 1);

				// reject
				fe_reject(new Error(`Timed out`));
			}, xt_timeout);
		}

		i_awaiter = a_awaiters.push((g_change) => {
			globalThis.clearTimeout(i_timeout);
			fk_resolve(g_change);
		});
	});
}

function fire_storage_change(si_area: StorageArea, si_key: string, g_change: chrome.storage.StorageChange) {
	const h_awaiters = g_awaiters[si_area];
	const a_awaiters = h_awaiters[si_key];

	if(a_awaiters?.length) {
		// reset awaiters
		h_awaiters[si_key] = [];

		// call each listener
		for(const f_awaiter of a_awaiters) {
			void f_awaiter(g_change);
		}
	}
}

// 
chrome.storage.onChanged?.addListener((h_changes, si_area) => {
	const H_STORAGE_LISTENERS: StorageListenerMap = {
		sync: {
			// // 
			// keplr_polyfill(g_change) {
			// 	return set_keplr_polyfill(g_change.newValue || false);
			// },

		},

		// // local storage area change listener
		local: {},

		session: {},

		managed: {},
	};

	// lookup namespace-specific listener dict
	const h_listeners = H_STORAGE_LISTENERS[si_area];

	// listeners available
	if(h_listeners) {
		// each change changes
		for(const si_key in h_changes) {
			const g_change = h_changes[si_key];

			// fire awaiter callbacks first
			fire_storage_change(si_area, si_key, g_change);

			// listener exists for this key
			const f_listener = h_listeners[si_key];
			if(f_listener) {
				f_listener(g_change);
			}
		}
	}
});


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


const H_SESSION_STORAGE_POLYFILL: Vocab.Handlers<IcsToService.SessionCommand> = 'function' === typeof chrome.storage?.session?.get
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

		const h_chains_banned: Record<Caip2.String, ChainInterface> = {};

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
		// @ts-expect-error vocab handler types
		const w_response = await H_SESSION_STORAGE_POLYFILL[si_type](g_msg.value);
		fk_respond(w_response);
	},
};

/**
 * message handlers for service instructions from popup
 */
const H_HANDLERS_INSTRUCTIONS: Vocab.HandlersChrome<IntraExt.ServiceInstruction> = {
	async sessionStorage(g_msg, g_sender, fk_respond) {
		const si_type = g_msg.type;
		// @ts-expect-error vocab handler types
		const w_response = await H_SESSION_STORAGE_POLYFILL[si_type](g_msg.value);
		fk_respond(w_response);
	},

	wake(_ignore, g_sender, fk_respond) {
		// ack
		fk_respond(true);

		void periodic_check();
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
			let g_app: AppInterface | null = null;

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
						name: (await SessionStorage.get(`profile:${new URL(p_tab).origin}`))?.name as string
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

		// dereference network
		const g_network = (await Networks.at(g_value.network))!;

		// dereference chain
		const g_chain = (await Chains.at(g_network.chain))!;

		// activate network
		const k_active = Networks.activate(g_network, g_chain);

		// find account that owns address
		const [, g_account] = await Accounts.find(g_value.sender, g_chain);

		// ensure websocket is listening for transfers
		await await_transfer(`${g_network.chain}\n${g_network.rpcHost!}\n`, k_active, g_chain, g_account, g_value.sender, 'Send');

		console.debug(`awaiting transfer on ${g_network.chain}...`);

		// execute transfer
		const g_attempt = await k_active.bankSend(
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
				(async() => {
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
				})();

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
			const z_response = f_handler(g_msg.value, g_sender, fk_respond);

			// async handler
			if(z_response && 'function' === typeof z_response['then']) {
				return true;
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

	// mark event
	await PublicStorage.installed();

	// migration; wipe everything
	if(await PublicStorage.isUpgrading('0.3.0')) {
		await storage_clear();
		await SessionStorage.clear();
	}

	// fresh install
	if(b_install) {
		// enable keplr compatibility mode
		await PublicStorage.keplrCompatibilityMode(true);

		// enable detection mode by default
		await PublicStorage.keplrDetectionMode(true);
	}

	// set compatibility mode based on apps and current settings
	await set_keplr_compatibility_mode();

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

type Notification = {
	type: 'balance';
	chain: ChainInterface;
	coin: string;
	cached: Coin | null;
	balance: Coin;
};

chrome.alarms?.clearAll(() => {
	console.warn('clear all');

	chrome.alarms.create('periodicChainQueries', {
		periodInMinutes: 1,
	});

	chrome.alarms.onAlarm.addListener((g_alarm) => {
		switch(g_alarm.name) {
			case 'periodicChainQueries': {
				void periodic_check();
				break;
			}

			default: {
				break;
			}
		}
	});

	void periodic_check();
});

let b_alive = false;
const h_sockets: Dict<VoidFunction> = {};

const auto_heal = () => setTimeout(() => {
	b_alive = false;
	void periodic_check();
}, 2*XT_MINUTES);

const i_auto_heal = auto_heal();

interface NotifyConfig {
	title: string;
	message: string;
}

interface MetaNotifyConfig {
	incident?: IncidentPath;
}

interface MetaHandler {
	click?: VoidFunction;
}

const h_meta_notifications = {};

chrome.notifications?.onClicked?.addListener((si_notif) => {
	const g_meta = h_meta_notifications[si_notif];

	if(g_meta?.click) {
		g_meta.click();
	}
});

const notify = B_IPHONE_IOS
	? function notify(si_notif: string, gc_notify: NotifyConfig) {
		const g_message = {
			type: 'notify',
			value: {
				...gc_notify,
				id: si_notif,
			},
		} as const;

		console.log(g_message);

		f_runtime_ios().sendNativeMessage('application.id', g_message, (w_response) => {
			console.debug(`Received response from native app: %o`, w_response);
		});
	}
	: chrome.notifications
		? function notify(si_notif: string, gc_notify: NotifyConfig) {
			chrome.notifications?.create(si_notif, {
				type: 'basic',
				priority: 1,
				iconUrl: '/media/vendor/logo-192px.png',
				isClickable: true,
				eventTime: Date.now(),
				...gc_notify,
			});
		}
		: F_NOOP;

function notify_incident_tx(si_notif: string, gc_notify: NotifyConfig, gc_meta: MetaNotifyConfig={}) {
	if(gc_meta) {
		const g_meta: MetaHandler = {};

		if(gc_meta.incident) {
			g_meta.click = () => {
				void open_flow({
					flow: {
						type: 'inspectIncident',
						page: null,
						value: {
							incident: gc_meta.incident!,
						},
					},
				});
			};
		}

		h_meta_notifications[si_notif] = g_meta;
	}

	return notify(si_notif, gc_notify);
}

async function transfer_notification(
	si_category: IncidentType,
	si_txn: string,
	g_transfer: MsgEventRegistry['transfer'],
	g_chain: ChainInterface,
	g_account: Account['interface'],
	k_network: ActiveNetwork
) {
	// default receive string
	let s_payload = g_transfer.amount;

	// attempt to parse amount
	let si_coin = '';
	let g_coin: NativeCoin;
	let g_amount: Coin;
	const m_amount = R_TRANSFER_AMOUNT.exec(g_transfer.amount);
	if(!m_amount) {
		syswarn({
			text: `Failed to parse transfer amount "${g_transfer.amount}"`,
		});
	}
	else {
		// destructure into amount and denom
		const [, s_amount, si_denom] = m_amount;
		g_amount = {
			denom: si_denom,
			amount: s_amount,
		};

		// locate coin
		for(const [si_coin_test, g_coin_test] of ode(g_chain.coins)) {
			if(si_denom === g_coin_test.denom) {
				const x_amount = new BigNumber(s_amount).shiftedBy(-g_coin_test.decimals).toNumber();
				s_payload = `${format_amount(x_amount, true)} ${si_coin_test}` as Cw.Amount;
				si_coin = si_coin_test;
				g_coin = g_coin_test;
				break;
			}
		}
	}

	let s_other: string = g_transfer.sender;
	const p_contact = Agents.pathForContactFromAddress(g_transfer.sender as Bech32, g_chain.namespace);
	const g_contact = await Agents.getContact(p_contact);
	if(g_contact) {
		s_other = g_contact.name;
	}
	else {
		s_other = abbreviate_addr(s_other);
	}

	const si_notif = `${si_category}:${si_txn}`;

	// notify
	if('tx_in' === si_category) {
		notify_incident_tx(si_notif, {
			title: `💸 Received ${s_payload} on ${g_chain.name}`,
			message: `${s_other} sent ${s_payload} to your ${g_account.name} account`,
		}, {
			incident: Incidents.pathFor('tx_in', si_txn),
		});
	}
	else if('tx_out' === si_category) {
		notify_incident_tx(si_notif, {
			title: `✅ Sent ${s_payload} on ${g_chain.name}`,
			message: `${s_payload} sent to ${s_other} from ${g_account.name} account`,
		}, {
			incident: Incidents.pathFor('tx_out', si_txn),
		});
	}


	// download receive txn
	const g_download = await k_network.downloadTxn(si_txn);

	// record incident
	const p_incident = await Incidents.record({
		id: si_txn,
		type: si_category,
		time: new Date(g_download.timestamp).getTime(),
		data: g_download,
	});

	global_broadcast({
		type: `transfer${'tx_out' === si_category? 'Send': 'Receive'}`,
		value: g_download,
	});

	// attempt to update fiat values
	try {
		const yg_fiat = await to_fiat(g_amount!, g_coin!, 'usd');

		await Incidents.mutateData(p_incident, {
			fiats: {
				usd: yg_fiat.toNumber(),
			},
		});
	}
	catch(e_fiat) {}
}

async function await_transfer(
	si_socket_group: string,
	k_network: ActiveNetwork,
	g_chain: ChainInterface,
	g_account: Account['interface'],
	sa_owner: Bech32,
	si_type: 'Receive' | 'Send'
): Promise<VoidFunction> {
	const si_socket = si_socket_group+':'+si_type;

	// socket already exists, attempt to close it
	if(h_sockets[si_socket]) {
		try {
			h_sockets[si_socket]();
		}
		catch(e_close) {}
	}

	// eslint-disable-next-line @typescript-eslint/no-loop-func
	return h_sockets[si_socket] = await k_network[`on${si_type}`](sa_owner, async(d_kill, g_tx) => {
		if(d_kill) {
			delete h_sockets[si_socket];
			console.error(d_kill);
			// syserr({
			// 	text: d_kill.,
			// });
		}
		else if(g_tx) {
			// ref transaction id
			const si_txn = g_tx.hash;

			// ref result
			const g_result = g_tx.result;

			// not ok tx
			if(g_result?.code) {
				let b_notified = false;

				const g_decoded_tx = decodeTxRaw(base64_to_buffer(g_tx.tx));

				const g_msg0 = g_decoded_tx.body.messages[0];

				if('/secret.compute.v1beta1.MsgExecuteContract' === g_msg0.typeUrl) {
					// decode msg
					const g_decoded_msg = SecretMsgExecuteContract.decode(g_msg0.value);

					// lookup contract name
					const sa_contract = toBech32(g_chain.bech32s.acc, g_decoded_msg.contract) as Bech32;
					const p_contract = Contracts.pathFor(Chains.pathFrom(g_chain), sa_contract);
					const g_contract = await Contracts.at(p_contract);

					// decrypt msg
					const g_decrypted = await SecretWasm.decryptMsg(g_account, g_chain, g_decoded_msg.msg);

					const m_error = R_SCRT_COMPUTE_ERROR.exec(g_result.log)!;
					if(m_error) {
						const [, , sxb64_error_ciphertext] = m_error;

						const atu8_ciphertext = base64_to_buffer(sxb64_error_ciphertext);

						// use nonce to decrypt
						const atu8_plaintext = await SecretWasm.decryptBuffer(g_account, g_chain, atu8_ciphertext, g_decrypted.nonce);

						// utf-8 decode
						const sx_plaintext = buffer_to_text(atu8_plaintext);

						// parse json
						try {
							const g_error = JSON.parse(sx_plaintext);

							const w_msg = g_error.generic_err?.msg || sx_plaintext;
							b_notified = true;

							// ⛔ 📩 ❌ 🚫 🪃 ⚠️
							notify_incident_tx(si_txn, {
								// title: '⚠️ Contract Execution Failed',
								title: '⚠️ Contract Denied Request',
								message: `${g_contract?.name || 'Unknown contract'}: ${w_msg}`,
							});
						}
						catch(e) {}
					}
				}

				// if('compute' === g_result.codespace) {
				// 	if(g_chain.features.secretwasm) {
				// 		// execute contract failed
				// 		if(3 === g_result.code) {
				// 			// TODO decode wasm tx data
				// 			console.debug(`recording failed execute contract %o`, g_tx);
				// 			debugger;

				// 			// log it
				// 			await Incidents.record({
				// 				type: 'tx_out',
				// 				data: {
				// 					stage: 'error',
				// 					chain: Chains.pathFrom(g_chain),
				// 					height: g_tx.height as Cw.Uint128,
				// 					code: g_result.code,
				// 					codespace: g_result.codespace,
				// 					hash: g_tx.hash,
				// 					gas_limit: '' as Cw.Uint128,
				// 					gas_wanted: g_result.gas_wanted as Cw.Uint128,
				// 					gas_used: g_result.gas_used as Cw.Uint128,
				// 					raw_log: '',
				// 					log: g_tx.result.log,
				// 					data: g_tx.tx,
				// 					msgs: [],
				// 				} as TxError,
				// 			});

				// 			// ⛔ 📩 ❌ 🚫 🪃 ⚠️
				// 			notify_incident_tx(si_txn, {
				// 				title: '⚠️ Contract Execution Failed',
				// 				message: '',
				// 			});

				// 			// global_broadcast({
				// 			// 	type: 'txFailure'
				// 			// });

				// 			return;
				// 		}
				// 		// insufficient gas
				// 		else if(7 === g_result.code) {
				// 			// 
				// 		}
				// 	}
				// }

				if(!b_notified) {
					throw syserr({
						title: `Tx error in ${g_result.codespace || 'unknown'} module`,
						text: g_result.log,
					});
				}
			}
			else {
				// ref logs
				const a_logs = JSON.parse(g_tx.result?.log || '[]');
				if(a_logs?.length) {
					// each event
					for(const g_event of a_logs[0].events) {
						// transfer
						if('transfer' === g_event.type) {
							const g_transfer = fold_attrs<MsgEventRegistry['transfer']>(g_event as TypedEvent);

							await transfer_notification('Receive' === si_type? 'tx_in': 'tx_out', si_txn, g_transfer, g_chain, g_account, k_network);
						}
					}
				}
			}
		}
	});
}

const XT_INTERVAL_HEARTBEAT = 1e3;
let i_heartbeat = 0;
let xt_last_hearbeat = 0;
function heartbeat() {
	// interval is dead
	if(Date.now() - xt_last_hearbeat > XT_INTERVAL_HEARTBEAT * 1.5) {
		// clear previous interval (if any)
		globalThis.clearInterval(i_heartbeat);

		// recreate interval
		i_heartbeat = (globalThis as typeof window).setInterval(() => {
			// broadcast service heartbeat
			global_broadcast({
				type: 'heartbeat',
			});

			// update last heartbeat marker
			xt_last_hearbeat = Date.now();
		}, XT_INTERVAL_HEARTBEAT);
	}
}



async function periodic_check(b_init=false) {
	// ensure heartbeat is alive
	heartbeat();

	// fetch latest decrees
	await WebResourceCache.updateAll();

	// not signed in; exit
	if(!await Vault.isUnlocked()) return;

	// service is already alive; exit
	if(b_alive) return;

	// service is now alive
	b_alive = true;

	// reset auto heal timeout
	clearTimeout(i_auto_heal);

	// read from stores
	const [
		ks_accounts,
		ks_chains,
		ks_networks,
	] = await Promise.all([
		Accounts.read(),
		Chains.read(),
		Networks.read(),
	]);

	// prep network => chain map
	const h_networks: Record<ChainPath, Network['interface']> = {};
	for(const [p_network, g_network] of ks_networks.entries()) {
		h_networks[g_network.chain] = h_networks[g_network.chain] || g_network;
	}


	// each chain w/ its default provider
	for(const [p_chain, g_network] of ode(h_networks)) {
		// skip broken cosmos
		if('/family.cosmos/chain.theta-testnet-001' === p_chain) continue;

		// already listening
		if(h_sockets[p_chain]) continue;

		// ref chain
		const g_chain = ks_chains.at(p_chain)!;

		// create network
		const p_network = Networks.pathFrom(g_network);
		const k_network = Networks.activate(g_network, g_chain);

		// listen for new blocks
		const a_recents: number[] = [];
		try {
			h_sockets[p_chain] = await k_network.listen([
				`tm.event='NewBlock'`,
			], (d_kill, g_value) => {
				if(d_kill) {
					delete h_sockets[p_chain];
				}
				else if(g_value) {
					a_recents.push(Date.now());

					const g_block = g_value.block as {
						header: BlockInfoHeader;
						data: {
							txs: [];
						};
					};

					while(a_recents.length > 16) {
						a_recents.shift();
					}

					global_broadcast({
						type: 'blockInfo',
						value: {
							header: g_block.header,
							chain: p_chain,
							network: p_network,
							recents: a_recents,
							txCount: g_block.data.txs.length,
						},
					});
				}
			});

			console.info({
				h_sockets,
			});
		}
		catch(e_listen) {
			syserr({
				title: 'Websocket Error',
				error: e_listen,
			});
		}

		// each account
		for(const [p_account, g_account] of ks_accounts.entries()) {
			const sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

			// chain is secretwasm
			const g_secretwasm = g_chain.features.secretwasm;
			if(g_secretwasm) {
				// missing consensus key
				if(!g_secretwasm.consensusIoPubkey) {
					// fetch
					const atu8_consensus_pk = await k_network.secretConsensusIoPubkey();

					// save to cached object
					g_secretwasm.consensusIoPubkey = buffer_to_base93(atu8_consensus_pk);

					// update chain
					await Chains.open(ks => ks.put(g_chain));
				}
			}

			if(k_network.hasRpc) {
				const si_socket_group = p_chain+'\n'+g_network.rpcHost!+'\n';

				// subscribe to websocket events
				const f_close = h_sockets[si_socket_group];
				if(!f_close) {
					try {
						await Promise.all([
							await_transfer(si_socket_group, k_network, g_chain, g_account, sa_owner, 'Receive'),
							await_transfer(si_socket_group, k_network, g_chain, g_account, sa_owner, 'Send'),
						]);
					}
					catch(e_receive) {
						syserr({
							title: 'Provider Error',
							error: e_receive,
						});
					}
				}

				const a_incoming: Incident.Struct<'tx_in'>[] = [];
				const a_outgoing: Incident.Struct<'tx_out'>[] = [];

				// conduct account sync
				for await(const g_incident of k_network.synchronizeAll(sa_owner)) {
					if('tx_in' === g_incident.type) {
						a_incoming.push(g_incident);
						global_broadcast({
							type: 'transferReceive',
							value: g_incident.data as TxConfirmed,
						});
					}
					else if('tx_out' === g_incident.type) {
						a_outgoing.push(g_incident);
						global_broadcast({
							type: 'transferSend',
							value: g_incident.data as TxConfirmed,
						});
					}
				}


				const nl_outgoing = a_outgoing.length;
				const nl_incoming = a_incoming.length;

				// outgoing txs synced
				if(nl_outgoing >= 1) {
					// only a few incidents
					if(nl_outgoing <= 3) {
						// ref incident
						for(const g_incident of a_outgoing) {
							const si_txn = g_incident.id;

							// single message
							const g_data = g_incident.data;
							const a_msgs = g_data.msgs;

							if(1 === a_msgs.length) {
								const h_events = a_msgs[0].events;

								if(h_events.transfer) {
									await transfer_notification('tx_in', si_txn, h_events.transfer, g_chain, g_account, k_network);
								}
							}
						}
					}
					// many incidents
					else {
						notify(uuid_v4(), {
							title: `✅ Sent ${1 === nl_outgoing? 'a transfer': `${nl_incoming} transfers`}`,
							message: 'While you were away...',
						});
					}
				}

				// incoming txs synced
				if(nl_incoming >= 1) {
					// only a few incidents
					if(nl_incoming <= 3) {
						// ref incident
						for(const g_incident of a_incoming) {
							const si_txn = g_incident.id;

							// single message
							const g_data = g_incident.data;
							const a_msgs = g_data.msgs;

							if(1 === a_msgs.length) {
								const h_events = a_msgs[0].events;

								if(h_events.transfer) {
									await transfer_notification('tx_in', si_txn, h_events.transfer, g_chain, g_account, k_network);
								}
							}
						}
					}
					// many incidents
					else {
						notify(uuid_v4(), {
							title: `💸 Received ${1 === nl_incoming? 'a transfer': `${nl_incoming} transfers`}`,
							message: 'While you were away...',
							// message: `${s_other} sent ${s_payload} to your ${g_account.name} account`,
						});
					}
				}
			}

			// // query all balances
			// void k_network.bankBalances(sa_owner).then((h_balances) => {  // eslint-disable-line @typescript-eslint/no-loop-func
			// 	// query succeeded
			// 	for(const [si_coin, g_bundle] of ode(h_balances)) {
			// 		const {
			// 			balance: g_balance,
			// 			cached: g_cached,
			// 		} = g_bundle;

			// 		// amount differs from cached
			// 		if(g_balance.amount !== g_cached?.amount) {
			// 			// notify
			// 			a_notifications.push({
			// 				type: 'balance',
			// 				chain: g_chain,
			// 				coin: si_coin,
			// 				cached: g_cached,
			// 				balance: g_balance,
			// 			});

			// 			let s_message = '';
			// 			let s_context = '';
			// 			if(1 === a_notifications.length) {
			// 				if(g_cached) {
			// 					const yg_change = new BigNumber(g_balance.amount).minus(g_cached.amount)
			// 						.shiftedBy(-g_chain.coins[si_coin].decimals);

			// 					// received coins
			// 					if(yg_change.gt(0)) {
			// 						s_message = `Balance increased +${format_amount(yg_change.toNumber(), true)} ${si_coin}`;
			// 						// s_context = `from `
			// 					}
			// 				}

			// 				chrome.notifications.create('bankBalanceChange', {
			// 					type: 'basic',
			// 					title: 'Balance Increased',
			// 					message: s_message,
			// 					contextMessage: s_context,
			// 					priority: 1,
			// 					iconUrl: '',
			// 					// eventTime: 
			// 				});
			// 			}
			// 		}
			// 	}
			// });
		}
	}

	// start countdown to un-alive the service flag
	auto_heal();
}

// global message handler
global_receive({
	// user has authenticated
	async login() {
		// update compatibility mode based on apps and current settings
		await set_keplr_compatibility_mode();

		// load apps


		// begin periodic checks
		void periodic_check(true);
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

	base93_to_buffer,
	buffer_to_base93,
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
	bech32_to_pubkey,
	SessionStorage,
	Contracts,
	Apps,
	G_USERAGENT,

	decodeTxRaw,
	set_keplr_compatibility_mode,
});


