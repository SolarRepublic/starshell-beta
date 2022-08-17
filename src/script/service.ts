import type browser from 'webextension-polyfill';

import * as semver from 'semver';

import { Dict, JsonObject, JsonValue, ode, Promisable } from '#/util/belt';

import type {
	IcsToService,
	IntraExt,
	ServiceToIcs,
} from './messages';

import IcsHost from './ics-host';
import McsRatifier from './mcs-ratifier';

import {
	H_CONTENT_SCRIPT_DEFS,
} from './scripts';

import type { Vocab } from '#/meta/vocab';
import { Vault } from '#/crypto/vault';
import { Apps } from '#/store/apps';
import { Policies } from '#/store/policies';
import { Settings } from '#/store/settings';
import { flow_broadcast } from './msg-flow';
import { P_STARSHELL_DECREES, R_DOMAIN_LOCALHOST, R_TRANSFER_AMOUNT, SI_VERSION, XT_MINUTES } from '#/share/constants';
import { Chains } from '#/store/chains';
import { ActiveNetwork, BalanceBundle, Networks } from '#/store/networks';
import { CosmosNetwork, fold_attrs, PendingSend, TypedEvent } from '#/chain/main';
import { Accounts } from '#/store/accounts';
import BigNumber from 'bignumber.js';
import { abbreviate_addr, format_amount, format_fiat } from '#/util/format';
import type { Bech32, Chain, ChainPath, NativeCoin } from '#/meta/chain';
import type { Coin } from 'cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import { yw_network_active } from '#/app/mem';
import { global_broadcast, global_receive } from './msg-global';
import type { Network } from '#/meta/network';
import { buffer_to_base64, sha256_sync, text_to_buffer } from '#/util/data';
import { syserr, syswarn } from '#/app/common';
import { Agents } from '#/store/agents';
import type { BlockInfoHeader } from './common';
import type { Account } from '#/meta/account';
import { Incidents } from '#/store/incidents';
import type { LogEvent } from '#/meta/store';
import { Decree, WebResourceCache } from '#/store/web-resource-cache';
import { check_restrictions } from '#/extension/restrictions';
import { BroadcastMode } from 'cosmos-grpc/dist/cosmos/tx/v1beta1/service';

interface ServiceMessageHandler {
	(message: any, sender: MessageSender, sendResponse: (response?: any) => void): void;
}

// const N_PX_WIDTH_POPUP = 360;
// const N_PX_HEIGHT_POPUP = 600;



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
	? Record<keyof typeof H_STORAGE_SCHEMAS[si_area], {
		(g_change: StorageChange<SV_KeplrPolyfill>): Promise<void>;
	}>
	: void;

type StorageListenerMap = {
	[si_area in StorageArea]?: StorageListener<si_area>;
}

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
			i_timeout = globalThis.setTimeout(() => {
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
chrome.storage.onChanged.addListener((h_changes, si_area) => {
	const H_STORAGE_LISTENERS: StorageListenerMap = {
		sync: {
			// 
			async keplr_polyfill(g_change) {
				const d_scripting = chrome.scripting as browser.Scripting.Static;
	
				// build the content script definition
				const gc_script = H_CONTENT_SCRIPT_DEFS.mcs_keplr();
	
				// check the current status of the script, i.e., whether or not it is enabled
				// zero length indicates no currently registered scripts match the given id
				const b_registered = !!(await d_scripting.getRegisteredContentScripts({
					ids: [gc_script.id],
				})).length;
	
				// Keplr polyfill option is now enabled
				if(true === g_change.newValue) {
					// script is not currently registered
					if(!b_registered) {
						// register the content script
						await d_scripting.registerContentScripts([
							gc_script,
						]);
					}
				}
				// Keplr polyfill option is now disabled
				else {
					// script is currently registered
					if(!b_registered) {
						// unregister the content script
						await d_scripting.unregisterContentScripts({
							ids: [gc_script.id]
						});
					}
				}
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

interface SendResponse {
	(w_data?: any): void;
}

interface MessageHandler<w_msg=any> {
	(g_msg: w_msg, g_sender: MessageSender, fk_respond: SendResponse): void | boolean
}

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
	async bankSend(g_value) {
		// dereference network
		const g_network = (await Networks.at(g_value.network))!;

		// dereference chain
		const g_chain = (await Chains.at(g_network.chain))!;

		// activate network
		const k_active = Networks.activate(g_network, g_chain);

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

		// notify
		const si_notifcation = buffer_to_base64(sha256_sync(text_to_buffer(g_attempt.hash)));
		chrome.notifications.create(si_notifcation, {
			type: 'basic',
			title: `Transaction sent to network`,
			message: `Waiting for confirmation on ${g_chain.name}...`,
			priority: 1,
			iconUrl: '/media/vendor/logo-192px.png',
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
	console.debug(`Service received message %o`, g_msg);

	// verify message structure
	if('object' === typeof g_msg && 'string' === typeof g_msg.type) {
		// default to ICS handlers
		let h_handlers: Vocab.HandlersChrome<IcsToService.PublicVocab | IntraExt.ServiceInstruction> = H_HANDLERS_ICS;

		// message does not originate from content script
		if(!g_sender.tab || 'number' !== typeof g_sender.tab.id) {
			// message originates from this extension
			if(g_sender.origin && chrome.runtime.id === g_sender.id) {
				h_handlers = H_HANDLERS_INSTRUCTIONS;
			}
			// reject unknown senders
			else {
				console.error(`Refusing request from unknown sender`);
				return;
			}
		}

		// ref message type
		const si_type = g_msg.type;

		// lookup handler
		const f_handler = h_handlers[si_type];

		// route message to handler
		if(f_handler) {
			const z_response = f_handler(g_msg.value, g_sender as MessageSender, fk_respond as SendResponse);

			// async handler
			if(z_response && 'function' === typeof z_response['then']) {
				return true;
			}
		}
	}
}

// bind message router listener
chrome.runtime.onMessage.addListener(message_router);


chrome.runtime.onInstalled.addListener(async() => {
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

chrome.alarms.clearAll(() => {
	console.warn('clear all');

	chrome.alarms.create('periodicChainQueries', {
		periodInMinutes: 2,
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
}, 3*XT_MINUTES);

let i_auto_heal = auto_heal();

function await_transfer(
	si_socket_group: string,
	k_network: ActiveNetwork,
	g_chain: Chain['interface'],
	g_account: Account['interface'],
	sa_owner: Bech32.String,
	si_type: 'Receive' | 'Send'
): VoidFunction {
	const si_socket = si_socket_group+':Receive';

	const p_chain = Chains.pathFrom(g_chain);

	// eslint-disable-next-line @typescript-eslint/no-loop-func
	return h_sockets[si_socket] = (k_network[`on${si_type}`] as ActiveNetwork['onReceive'] | ActiveNetwork['onSend'])(sa_owner, async(d_kill, g_tx) => {
		if(d_kill) {
			delete h_sockets[si_socket];
			console.error(d_kill);
			// syserr({
			// 	text: d_kill.,
			// });
		}
		else if(g_tx) {
			const a_logs = JSON.parse(g_tx.result?.log || '[]');
			if(a_logs?.length) {
				for(const g_event of a_logs[0].events) {
					if('transfer' === g_event.type) {
						const g_transfer = fold_attrs(g_event as TypedEvent);

						// default receive string
						let s_payload = g_transfer.amount;

						// attempt to parse amount
						let si_coin = '';
						let g_coin: NativeCoin;
						const m_amount = R_TRANSFER_AMOUNT.exec(g_transfer.amount);
						if(!m_amount) {
							syswarn({
								text: `Failed to parse transfer amount "${g_transfer.amount}"`,
							});
						}
						else {
							// destructure into amount and denom
							const [, s_amount, si_denom] = m_amount;

							// locate coin
							for(const [si_coin_test, g_coin_test] of ode(g_chain.coins)) {
								if(si_denom === g_coin_test.denom) {
									const x_amount = new BigNumber(s_amount).shiftedBy(-g_coin_test.decimals).toNumber();
									s_payload = `${format_amount(x_amount, true)} ${si_coin_test}`;
									si_coin = si_coin_test;
									g_coin = g_coin_test;
									break;
								}
							}
						}

						let s_other = g_transfer.sender;
						const p_contact = Agents.pathForContact(s_other, g_chain.family);
						const g_contact = await Agents.getContact(p_contact);
						if(g_contact) {
							s_other = g_contact.name;
						}
						else {
							s_other = abbreviate_addr(s_other);
						}

						// ref transaction id
						const si_txn = g_tx.hash;

						// hash tx to create notification id
						const si_notif = buffer_to_base64(sha256_sync(text_to_buffer(si_txn)));

						// notify
						if('Receive' === si_type) {
							chrome.notifications.create(si_notif, {
								type: 'basic',
								title: `Received ${s_payload} on ${g_chain.name}`,
								message: `${s_other} sent ${s_payload} to your ${g_account.name} account`,
								priority: 1,
								iconUrl: '/media/vendor/logo-192px.png',
							});

							// download receive txn
							const g_download = await k_network.downloadTxn(si_txn);

							// record incident
							await Incidents.record(si_txn, {
								type: 'tx_in',
								time: new Date(g_download.timestamp).getTime(),
								data: g_download,
							});
						}
						else if('Send' === si_type) {
							chrome.notifications.create(si_notif, {
								type: 'basic',
								title: `Sent ${s_payload} on ${g_chain.name}`,
								message: `${s_payload} sent to ${s_other} from ${g_account.name} account`,
								priority: 1,
								iconUrl: '/media/vendor/logo-192px.png',
							});

							// download send txn
							const g_download = await k_network.downloadTxn(si_txn);

							// record incident
							await Incidents.record(si_txn, {
								type: 'tx_out',
								time: new Date(g_download.timestamp).getTime(),
								data: g_download,
							});
						}
					}
				}
			}
		}
	});
}

async function periodic_check() {
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
		if(p_chain === '/family.cosmos/chain.theta-testnet-001') continue;

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
			h_sockets[p_chain] = k_network.listen([
				`tm.event='NewBlock'`,
			], (d_kill, g_value) => {
				if(d_kill) {
					delete h_sockets[p_chain];
				}
				else if(g_value) {
					a_recents.push(Date.now());

					const g_block = g_value.block as {
						header: BlockInfoHeader;
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
				let f_close = h_sockets[si_socket_group];
				if(!f_close) {
					try {
						await_transfer(si_socket_group, k_network, g_chain, g_account, sa_owner, 'Receive');
						await_transfer(si_socket_group, k_network, g_chain, g_account, sa_owner, 'Send');
					}
					catch(e_receive) {
						syserr({
							title: 'Provider Error',
							error: e_receive,
						});
					}
				}

				// conduct account sync
				await k_network.synchronizeAll(sa_owner);
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
		void periodic_check();
	},
});
