import SystemSvelte from '##/container/System.svelte';
import AuthenticateSvelte from '##/screen/Authenticate.svelte';

import RequestAdvertisementSvelte from '##/screen/RequestAdvertisement.svelte';
import RequestConnectionSvelte from '##/screen/RequestConnection.svelte';

import {session_storage_remove, session_storage_set_isomorphic, Vault} from '#/crypto/vault';
import type {Vocab} from '#/meta/vocab';
import type {IntraExt} from '#/script/messages';
import {qs} from '#/util/dom';
import type {Union} from 'ts-toolbelt';
import type {ParametricSvelteConstructor} from '#/meta/svelte';
import {dm_log, domlog} from './fallback';
import type {PlainObject} from '#/meta/belt';
import type {SvelteComponent} from 'svelte';
import {ode} from '#/util/belt';
import PreRegister from '#/app/screen/PreRegister.svelte';
import IncidentView from '#/app/screen/IncidentView.svelte';
import ScanQrSvelte from '#/app/screen/ScanQr.svelte';

export type FlowMessage = Vocab.Message<IntraExt.FlowVocab>;

export type Page = Union.Merge<NonNullable<Vocab.MessagePart<IntraExt.FlowVocab, 'page'>>>;


export type Completed = (b_answer: boolean) => void;

export type CompletionResponse = (b_answer: boolean, g_page: null | Page) => void;


// before this window is unloaded
async function unload() {
	// clear the flow value from session storage
	await session_storage_remove('flow');
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
addEventListener('beforeunload', unload);

// top-level system component
const yc_system: SvelteComponent | null = null;

function open_flow<
	dc_screen extends ParametricSvelteConstructor,
>(dc_screen: dc_screen, h_context: PlainObject, g_props?: Omit<ParametricSvelteConstructor.Parts<dc_screen>['params'], 'k_page'>) {
	// attempt to hide log
	try {
		dm_log!.style.display = 'none';
	}
	catch(e_hide) {}

	// destroy previous system
	if(yc_system) {
		try {
			yc_system.$destroy();
		}
		catch(e_destroy) {}

		try {
			qs(document.body, 'main')?.remove();
		}
		catch(e_remove) {}
	}

	// create system
	new SystemSvelte({
		target: document.body,
		props: {
			mode: 'flow',
			page: {
				creator: dc_screen,
				props: g_props || {},
			},
		},
		context: new Map(ode(h_context)),
	});
}


// authenticate the user
async function authenticate(fk_completed: Completed) {
	// verbose
	domlog(`Handling 'authenticate'.`);

	// check if root key is accessible
	const dk_root = await Vault.getRootKey();

	// already signed in
	if(dk_root) {
		// verbose
		domlog(`Vault is already unlocked.`);

		// TODO: consider "already authenticated" dom
		// open_flow(BlankSvelte, {});

		// callback
		fk_completed(true);

		// exit
		return;
	}

	// retrieve root
	const g_root = await Vault.getBase();

	// no root set, need to register
	if(!g_root) {
		// verbose
		domlog(`No root found. Prompting registration.`);

		open_flow(PreRegister, {
			completed() {
				void authenticate(fk_completed);
			},
		});
	}
	// root is set, login
	else {
		// verbose
		domlog(`Root found. Prompting login.`);

		open_flow(AuthenticateSvelte, {
			completed: fk_completed,
		});
	}
}


// prep handlers
const H_HANDLERS_AUTHED: Vocab.Handlers<Omit<IntraExt.FlowVocab, 'authenticate'>, [Completed]> = {
	requestAdvertisement(g_value, fk_completed) {
		// verbose
		domlog(`Handling 'requestAdvertisement' on ${JSON.stringify(g_value)}`);

		open_flow(RequestAdvertisementSvelte, {}, {
			completed: fk_completed,
			app: g_value.app,
		});
	},

	requestConnection(g_value, fk_completed) {
		// verbose
		domlog(`Handling 'requestConnection' on ${JSON.stringify(g_value)}`);

		open_flow(RequestConnectionSvelte, {
			completed: fk_completed,
			app: g_value.app,
			chains: g_value.chains,
		});
	},

	signTransaction(w_value) {

	},

	inspectIncident(g_value, fk_completed) {
		// verbose
		domlog(`Handling 'inspectIncident' on ${JSON.stringify(g_value)}`);

		open_flow(IncidentView, {
			completed: fk_completed,
		}, {
			incident: g_value.incident,
		});
	},

	scanQr(g_value, fk_completed) {
		// verbose
		domlog(`Handling 'scanQr' on ${JSON.stringify(g_value)}`);

		open_flow(ScanQrSvelte, {
			completed: fk_completed,
		}, g_value);
	},
} as const;


// message router
async function route_message(g_msg: FlowMessage, fk_respond: CompletionResponse) {
	// authenticate
	if('authenticate' === g_msg.type) {
		// verbose
		domlog(`Calling built-in handler for '${g_msg.type}'`);

		// authenticate
		return void authenticate((b_answer) => {
			fk_respond(b_answer, g_msg.page);
		});
	}

	// lookup handler
	const f_handler = H_HANDLERS_AUTHED[g_msg.type] as Vocab.Handler<FlowMessage, [Completed]> | undefined;

	// no such handler
	if(!f_handler) {
		return domlog(`No such handler registered for '${g_msg.type}'`);
	}

	// check if root key is accessible
	const dk_root = await Vault.getRootKey();

	// not signed in
	if(!dk_root) {
		// verbose
		domlog(`Vault is locked. Redirecting to login.`);

		// authenticate; retry
		return void authenticate(() => {
			void route_message(g_msg, fk_respond);
		});
	}

	// verbose
	domlog(`Calling registered handler for '${g_msg.type}'`);

	// call handler
	void f_handler(g_msg['value'] as FlowMessage, (b_answer) => {
		fk_respond(b_answer, g_msg.page);
	});
}


async function suggest_reload_page(g_page: Page) {
	// try to get the tab that initiated this action
	let g_tab!: chrome.tabs.Tab;
	try {
		g_tab = await chrome.tabs.get(g_page.tabId);
	}
	// ignore errors
	catch(e_get) {}

	// tab no longer exists
	if(!g_tab || !g_tab.url) return;

	// url has changed
	if(g_page.href !== g_tab.url) {
		return;
	}

	// suggest reload
	return new Promise((fk_resolve) => {
		// new SuggestReloadSvelte({
		// 	target: document.body,
		// 	props: {
		// 		page: g_page,
		// 		completed: fk_resolve,
		// 	},
		// });
	});
}

(function() {
	// verbose
	domlog('Flow script init');

	// parse query params
	const h_query = new URLSearchParams(location.search.slice(1));

	// environment capture
	const si_objective = h_query.get('headless');
	if(si_objective) {
		if('info' === si_objective) {
			return session_storage_set_isomorphic({
				display_info: {
					width: screen.width,
					height: screen.height,
					availHeight: screen.availHeight,
					availWidth: screen.availWidth,
					orientation: JSON.parse(JSON.stringify(screen.orientation ?? null)),
					devicePixelRatio: devicePixelRatio,
				},
			}).then(() => {
				window.close();
			});
		}

		window.close();
	}

	// depending on comm method
	const si_comm = h_query.get('comm');

	// use broadcast channel
	if('broadcast' === si_comm) {
		// verbose
		domlog('Using broadcast comm');

		// ref channel name
		const si_channel = h_query.get('name');

		// no channel name
		if('string' !== typeof si_channel || !si_channel) {
			return domlog('Invalid or missing channel name');
		}

		// verbose
		domlog(`Channel name: '${si_channel}'`);

		// create broadcast channel
		const d_broadcast: Vocab.TypedBroadcast<IntraExt.FlowResponseVocab, IntraExt.FlowVocab> = new BroadcastChannel(si_channel);
		const respond_broadcast: CompletionResponse = (b_answer, g_page) => {
			// post to broadcast
			d_broadcast.postMessage({
				type: 'completeFlow',
				value: {
					answer: b_answer,
				},
			});

			// if page still exists after some time, then service worker is dead
			setTimeout(async() => {
				// suggest reloading the page
				if(g_page) {
					await suggest_reload_page(g_page);
				}

				// unload
				await unload();

				// then exit
				window.close();
			}, 200);
		};

		// listen for message on broadcast channel
		d_broadcast.onmessage = function(d_event) {
			// ref message data
			const g_msg = d_event.data as typeof d_event.data | null | {type: undefined};

			// verbose
			domlog(`Received => ${JSON.stringify(g_msg)}`);

			// invalid event data
			if(!g_msg || !g_msg.type) {
				return domlog('Invalid message');
			}

			// save message to storage
			sessionStorage.setItem(`@flow:${si_channel}`, JSON.stringify(g_msg));

			// acknowledge receipt
			d_broadcast.postMessage({
				type: 'acknowledgeReceipt',
				value: g_msg,
			});

			// route message
			void route_message(g_msg, respond_broadcast);
		};

		// verbose
		domlog('Listening for message...');

		// read from session storage
		const s_reloaded = sessionStorage.getItem(`@flow:${si_channel}`);
		if(s_reloaded) {
			// verbose
			domlog('Attempting to restore message after reload...');

			// parse message from storage
			let g_parsed: FlowMessage;
			try {
				g_parsed = JSON.parse(s_reloaded);
			}
			catch(e_parse) {
				return domlog('Failed to parse message from session storage');
			}

			// route
			void route_message(g_parsed, respond_broadcast);
		}
	}
	// query comm
	else if('query' === si_comm) {
		// get response key
		const si_key = h_query.get('key');

		// get data
		const sx_data = h_query.get('data');

		// verbose
		domlog(`Received => ${sx_data}`);

		// missing data
		if(!sx_data) {
			return domlog(`Missing flow data`);
		}

		// parse data
		let g_flow: FlowMessage;
		try {
			g_flow = JSON.parse(sx_data) as FlowMessage;
		}
		catch(e_parse) {
			return domlog('Invalid message');
		}

		// invalid event data
		if(!g_flow || !g_flow.type) {
			return domlog('Invalid message');
		}

		// route message
		void route_message(g_flow, (b_answer, g_page) => {
			// schedule response
			(chrome.runtime as Vocab.TypedRuntime<IntraExt.ServiceInstruction>).sendMessage({
				type: 'scheduleFlowResponse',
				value: {
					key: si_key || '(none)',
					response: {
						type: 'completeFlow',
						value: {
							answer: b_answer,
						},
					},
				},
			}, async() => {
				// unload
				await unload();

				// close self
				window.close();
			});
		});
	}
	// unknown comm
	else {
		domlog(`Unknown comm '${h_query.get('comm') || '(null | undefined)'}'`);
	}
})();
