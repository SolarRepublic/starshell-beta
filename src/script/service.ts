import type browser from 'webextension-polyfill';

import {Dict, F_NOOP, JsonValue, ode, Promisable, timeout} from '#/util/belt';

import type {
	ExtToNative,
	IcsToService,
	IntraExt,
	ServiceToIcs,
} from './messages';

import IcsHost from './ics-host';
import McsRatifier from './mcs-ratifier';

import {
	H_CONTENT_SCRIPT_DEFS,
} from './scripts';

import type {Vocab} from '#/meta/vocab';
import {Vault} from '#/crypto/vault';
import {Apps} from '#/store/apps';
import {Policies} from '#/store/policies';
import {Settings} from '#/store/settings';
import {flow_broadcast} from './msg-flow';
import {B_MOBILE, G_USERAGENT, R_DOMAIN_LOCALHOST, R_TRANSFER_AMOUNT, XT_MINUTES} from '#/share/constants';
import {Chains} from '#/store/chains';
import {ActiveNetwork, Networks} from '#/store/networks';
import {fold_attrs, TypedEvent} from '#/chain/main';
import {Accounts} from '#/store/accounts';
import BigNumber from 'bignumber.js';
import {abbreviate_addr, format_amount} from '#/util/format';
import type {Bech32, Chain, ChainPath, NativeCoin} from '#/meta/chain';
import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import {global_broadcast, global_receive} from './msg-global';
import type {Network} from '#/meta/network';
import {syserr, syswarn} from '#/app/common';
import {Agents} from '#/store/agents';
import type {BlockInfoHeader} from './common';
import type {Account} from '#/meta/account';
import {Incidents} from '#/store/incidents';
import {WebResourceCache} from '#/store/web-resource-cache';
import {BroadcastMode} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
import type {Incident, IncidentPath, IncidentType, MsgEventRegistry, TxConfirmed} from '#/meta/incident';
import {to_fiat} from '#/chain/coin';
import type {Cw} from '#/meta/cosm-wasm';
import {uuid_v4} from '#/util/dom';

type ServiceMessageHandler = (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void;


const d_runtime_ios: Vocab.TypedRuntime<ExtToNative.MobileVocab> = chrome.runtime;

const B_IPHONE = 'iPhone' === G_USERAGENT.device.model && 'iOS' === G_USERAGENT.os.name;
const B_ANDROID_FIREFOX = 'Android' === G_USERAGENT.os.name && 'Firefox' === G_USERAGENT.browser.name;


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

async function set_keplr_polyfill(b_enabled: boolean) {
	const d_scripting = chrome.scripting as browser.Scripting.Static;

	// debugger;

	// // build the content script definition
	// const gc_script = H_CONTENT_SCRIPT_DEFS.mcs_keplr();

	// // check the current status of the script, i.e., whether or not it is enabled
	// // zero length indicates no currently registered scripts match the given id
	// const b_registered = !!(await d_scripting.getRegisteredContentScripts({
	// 	ids: [gc_script.id],
	// })).length;

	// // Keplr polyfill option is now enabled
	// if(true === b_enabled) {
	// 	// script is not currently registered
	// 	if(!b_registered) {
	// 		// register the content script
	// 		await d_scripting.registerContentScripts([
	// 			gc_script,
	// 		]);
	// 	}
	// }
	// // Keplr polyfill option is now disabled
	// else {
	// 	// script is currently registered
	// 	if(!b_registered) {
	// 		// unregister the content script
	// 		await d_scripting.unregisterContentScripts({
	// 			ids: [gc_script.id],
	// 		});
	// 	}
	// }

}

// 
chrome.storage.onChanged?.addListener((h_changes, si_area) => {
	const H_STORAGE_LISTENERS: StorageListenerMap = {
		sync: {
			// 
			keplr_polyfill(g_change) {
				return set_keplr_polyfill(g_change.newValue || false);
			},

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

function parse_sender(p_sender: string) {
	// parse sender url
	const {
		protocol: s_protocol,
		host: s_host,
	} = new URL(p_sender);

	// normalize scheme
	const s_scheme = (s_protocol || '').replace(/:$/, '');

	return [s_scheme as 'file' | 'http' | 'https', s_host] as const;
}


function block_app(g_sender: MessageSender, s_msg: string): boolean {
	console.warn(`${s_msg}; blocked request from <${g_sender.url}>`);
	return true;
}

async function app_blocked(s_scheme: string, s_host: string, g_sender: MessageSender): Promise<boolean> {
	// non-secure contexts only allowed at localhost
	if('http' === s_scheme) {
		// not localhost
		if(!R_DOMAIN_LOCALHOST.test(s_host)) {
			return block_app(g_sender, 'Non-secure HTTP contexts are not allowed to connect to wallet except for localhost');
		}
	}
	// file
	else if('file' === s_scheme) {
		// check policy
		const b_allowed = await Settings.get('allow_file_urls');
		if(!b_allowed) {
			return block_app(g_sender, `File URLs are not allowed to connect to wallet, unless 'allow_file_urls' setting is enabled`);
		}
	}
	// anything else
	else if('https' !== s_scheme) {
		return block_app(g_sender, `Scheme not allowed "${s_scheme}"`);
	}

	return false;
}


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

/**
 * message handlers for the public vocab from ICS
 */
const H_HANDLERS_ICS: Vocab.HandlersChrome<IcsToService.PublicVocab> = {
	// 
	panic(g_msg, g_sender) {
		// TODO: handle
	},

	// page is requesting advertisement via ics-spotter
	async requestAdvertisement(g_msg, g_sender, fk_respond) {
		// ref tab id
		const i_tab = g_sender.tab!.id!;

		// unknown source, silently reject
		if(!g_sender.url) {
			console.debug('Silently ignoring advertisement request from unknown source');
			return;
		}

		// parse sender url
		const [s_scheme, s_host] = parse_sender(g_sender.url);

		// prep page descriptor for restores
		const g_page = {
			tabId: i_tab,
			href: g_sender.url+'',
		};

		console.info('get root key');
		// check if app is locked
		const dk_root = await Vault.getRootKey();
		if(!dk_root) {
			console.info('no root key');
			// ask user to login
			const b_finished = await flow_broadcast({
				flow: {
					type: 'authenticate',
					page: g_page,
				},
			});

			console.info('flow completed');
			// user cancelled; do not advertise
			if(!b_finished) {
				return;
			}

			// retry
			return await H_HANDLERS_ICS.requestAdvertisement(g_msg, g_sender, fk_respond);
		}

		console.info('root key exists');

		// app is blocked; exit
		if(await app_blocked(s_scheme, s_host, g_sender)) return;

		console.info('app passed scheme check');

		// check app's policy and registration status
		{
			// lookup app in store
			let g_app = await Apps.get(s_host, s_scheme);

			// app registrtion state
			let b_registered = false;

			// app is registered; mark it such
			if(g_app) {
				b_registered = true;
			}
			// app is not yet registered; initialize
			else {
				g_app = {
					scheme: s_scheme,
					host: s_host,
					connections: {},
				};
			}

			// lookup policy on app
			const g_policy = await Policies.forApp(g_app);

			console.info('got policy for app %o', g_policy);
			// a policy indicates this app is blocked
			if(g_policy.blocked) {
				return block_app(g_sender, 'App connection blocked by policy');
			}

			// // app does not have any connections
			// if(!Object.keys(g_app.connections).length) {

			// app is not registered and not trusted; requires user approval
			if(!b_registered && !g_policy.trusted) {
				// request approval from user
				const b_confirmed = await flow_broadcast({
					flow: {
						type: 'requestAdvertisement',
						value: {
							app: g_app,
						},
						page: g_page,
					},
				});

				// retry 
				if(b_confirmed) {
					return await H_HANDLERS_ICS.requestAdvertisement(g_msg, g_sender, fk_respond);
				}

				// abort
				console.debug('User cancelled request');
				return;
			}
		}

		// TODO: consider what will happen if prompt closes but serice worker becomes inactive

		// verbose
		console.debug(`Allowing <${g_sender.url}> to receive advertisement`);

		// secrets for this session
		const g_secrets: ServiceToIcs.SessionKeys = {
			session: generate_key(),
		};

		// execute isolated-world content script 'host'
		void chrome.scripting.executeScript({
			target: {
				tabId: i_tab,
			},
			func: IcsHost,
			args: [g_secrets],
			world: 'ISOLATED',
		});

		// execute main-world content script 'ratifier'
		void chrome.scripting.executeScript({
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

		// set the page from which the flow is being requested
		const g_page = gc_prompt.flow.page = {
			tabId: g_sender.tab!.id!,
			href: g_sender.url || gc_prompt.flow.page?.href || '',
		};

		console.info('get root key');
		// check if app is locked
		const dk_root = await Vault.getRootKey();
		if(!dk_root) {
			console.info('no root key');
			// ask user to login
			const b_finished = await flow_broadcast({
				flow: {
					type: 'authenticate',
					page: g_page,
				},
			});

			console.info('flow completed');
			// user cancelled; do not continue
			if(!b_finished) {
				return;
			}

			// retry
			return await H_HANDLERS_ICS.flowBroadcast(g_req, g_sender, fk_respond);
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
		void flow_broadcast(gc_prompt, si_req);
	},
};


/**
 * message handlers for service instructions from popup
 */
const H_HANDLERS_INSTRUCTIONS: Vocab.HandlersChrome<IntraExt.ServiceInstruction> = {
	wake(_ignore, g_sender, fk_respond) {
		// ack
		fk_respond(true);

		void periodic_check();
	},

	easter_notify() {
		notify('easter', {
			title: 'Easter Egg',
			message: 'This is a test notification',
		});
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
		await Incidents.record(g_attempt.hash, {
			type: 'tx_out',
			time: Date.now(),
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
		// default to ICS handlers
		let h_handlers: Vocab.HandlersChrome<IcsToService.PublicVocab | IntraExt.ServiceInstruction>;

		// ref message type
		const si_type = g_msg.type;

		// message originates from extension
		const b_origin_verified = g_sender.url? g_sender.url.startsWith(chrome.runtime.getURL('')): false;
		if(chrome.runtime.id === g_sender.id && (b_origin_verified || 'null' === g_sender.origin)) {
			h_handlers = H_HANDLERS_INSTRUCTIONS;
		}
		// message originates from tab (content script)
		else if(g_sender.tab && 'number' === typeof g_sender.tab.id) {
			h_handlers = H_HANDLERS_ICS;
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


chrome.runtime.onInstalled?.addListener(async() => {
	await timeout(1e3);

	// immediately open launcher on android
	if('Android' === G_USERAGENT.os.name) {
		// startup
		chrome.tabs.create({
			url: 'https://launch.starshell.net/?setup',
		}, F_NOOP);
	}
	// open start page on iOS
	else if(B_IPHONE) {
		// startup
		chrome.tabs.create({
			url: 'src/entry/popup.html?tab=launch&install',
		}, F_NOOP);

		// contact native application
		try {
			const w_response = await d_runtime_ios.sendNativeMessage('application.id', {
				type: 'greet',
			});

			console.debug(`Response from native app: %o`, w_response);
		}
		catch(e_native) {}
	}

	void set_keplr_polyfill(true);

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

	// const d_scripting = chrome.scripting as browser.Scripting.Static;


	// const g_waker = H_CONTENT_SCRIPT_DEFS.inpage_waker();

	// await d_scripting.registerContentScripts([
	// 	{
	// 		...g_waker,
	// 		// js: [
	// 		// 	's2r.signing.key#ae4261c',
	// 		// 	...g_waker.js,
	// 		// ],
	// 	},
	// ]);

	// const a_scripts = await d_scripting.getRegisteredContentScripts();
	// for(const g_script of a_scripts) {
	// 	console.log(g_script);
	// }
});

type Notification = {
	type: 'balance';
	chain: Chain['interface'];
	coin: string;
	cached: Coin | null;
	balance: Coin;
};

chrome.alarms?.clearAll(() => {
	console.warn('clear all');

	chrome.alarms.create('periodicChainQueries', {
		periodInMinutes: 0.25,
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

let i_auto_heal = auto_heal();

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

const notify = B_IPHONE
	? function notify(si_notif: string, gc_notify: NotifyConfig) {
		const g_message = {
			type: 'notify',
			value: {
				...gc_notify,
				id: si_notif,
			},
		} as const;

		console.log(g_message);

		d_runtime_ios.sendNativeMessage('application.id', g_message, (w_response) => {
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
				void flow_broadcast({
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
	g_chain: Chain['interface'],
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
	const p_contact = Agents.pathForContact(s_other, g_chain.family);
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
	const p_incident = await Incidents.record(si_txn, {
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
	g_chain: Chain['interface'],
	g_account: Account['interface'],
	sa_owner: Bech32.String,
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
	if(!await Vault.getRootKey()) return;

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
						a_incoming.push(g_incident as Incident.Struct<'tx_in'>);
						global_broadcast({
							type: 'transferReceive',
							value: g_incident.data as TxConfirmed,
						});
					}
					else if('tx_out' === g_incident.type) {
						a_outgoing.push(g_incident as Incident.Struct<'tx_out'>);
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

global_receive({
	login() {
		void periodic_check(true);
	},
});
