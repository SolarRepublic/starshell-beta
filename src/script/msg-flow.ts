import {
	N_PX_WIDTH_POPUP,
	N_PX_HEIGHT_POPUP,
} from './constants';
import type { IntraExt } from './messages';
import type { Vocab } from '#/meta/vocab';
import type { Dict, JsonObject } from '#/util/belt';
import { session_storage_get, session_storage_remove } from '#/crypto/vault';
import { XT_SECONDS } from '#/share/constants';
import { once_storage_changes } from './service';


type Flow = Vocab.Message<IntraExt.FlowVocab>;

export interface PromptConfig extends JsonObject {
	flow: Flow;
}

type FlowHandle = {
	window: chrome.windows.Window;
	tab: chrome.tabs.Tab;
};

interface ScreenInfo {
	width: number;
	height: number;
	availWidth: number;
	availHeight: number;
	orientation: JsonObject;
	devicePixelRatio: number,
}

export async function flow_generic(h_params: Dict): Promise<FlowHandle> {
	// get flow URL
	const p_flow = chrome.runtime.getURL('src/entry/flow.html');

	// indicate via query params method of communication
	const p_connect = p_flow+'?'+new URLSearchParams(h_params).toString();

	// fetch displays and screen info
	const [
		a_displays,
		g_screen_info,
	] = await Promise.all([
		chrome.system.display.getInfo(),

		(async(): Promise<ScreenInfo | undefined> => {
			// create popup to determine screen dimensions
			const g_info = (await chrome.storage.session.get(['display_info']))?.display_info;
			if(g_info) return g_info;

			void chrome.windows.create({
				type: 'popup',
				url: p_flow+'?'+new URLSearchParams({headless:'info'}).toString(),
				focused: true,
				width: N_PX_WIDTH_POPUP,
				height: N_PX_HEIGHT_POPUP,
			});

			try {
				return (await once_storage_changes('session', 'display_info', 5*XT_SECONDS))?.newValue;
			}
			catch(e_timeout) {}
		})(),
	]);

	// create displays dict
	const h_displays = {};
	for(const g_display of a_displays) {
		if(g_display.isEnabled) {
			h_displays[g_display.bounds.width+':'+g_display.bounds.height] = g_display;
		}
	}

	// set display propertiess to be center of screen
	let g_window_position = {};
	if(g_screen_info) {
		const si_display = g_screen_info.width+':'+g_screen_info.height;
		const g_display = h_displays[si_display];
		if(g_display) {
			g_window_position = {
				left: g_display.bounds.left + Math.round((g_screen_info.width / 2) - (N_PX_WIDTH_POPUP / 2)),
				top: g_display.bounds.top + Math.round((g_screen_info.height * 0.45) - (N_PX_HEIGHT_POPUP / 2)),
			};
		}
	}

	// create window
	const g_window = await chrome.windows.create({
		type: 'popup',
		url: p_connect,
		focused: true,
		width: N_PX_WIDTH_POPUP,
		height: N_PX_HEIGHT_POPUP,
		...g_window_position,
	});

	// window was not created
	if('number' !== typeof g_window.id) {
		throw new Error('Failed to create popup window');
	}

	// fetch its view
	const dv_popup = await chrome.windows.get(g_window.id, {
		windowTypes: ['popup'],
	});

	// no view
	if(!dv_popup) {
		throw new Error('Failed to locate popup window');
	}

	// wait for tab to load
	const dt_created: chrome.tabs.Tab = await new Promise((fk_created) => {
		// tab update event
		chrome.tabs.onUpdated.addListener(function tab_update(i_tab, g_info, dt_updated) {
			// is the target tab
			if(g_window.id === dt_updated.windowId && 'number' === typeof i_tab) {
				// loading compelted
				if('complete' === g_info.status) {
					// remove listener
					chrome.tabs.onUpdated.removeListener(tab_update);

					// resolve promise
					fk_created(dt_updated);
				}
			}
		});
	});

	return {
		window: g_window,
		tab: dt_created,
	};
}

export async function flow_broadcast(gc_prompt: PromptConfig, si_req=''): Promise<boolean> {
	// name to use for private broadcast channel
	const si_channel = `flow_${crypto.randomUUID()}`;

	// awaiting for a previous flow to complete
	const s_flow = await session_storage_get('flow') || '';
	if(s_flow) {
		// TODO: implement
	}

	// create flow tab
	const {
		window: g_window,
		tab: dt_flow,
	} = await flow_generic({
		comm: 'broadcast',
		name: si_channel,
	});

	// communicate with popup using broadcast channel
	const d_broadcast: Vocab.TypedBroadcast<IntraExt.FlowVocab, IntraExt.FlowResponseVocab> = new BroadcastChannel(si_channel);

	// go async
	return new Promise((fk_resolve) => {
		// when ready to resolve the pomise
		function shutdown(b_answer: boolean) {
			// remove window close listener
			chrome.windows.onRemoved.removeListener(close_listener);

			// remove broadcast listener
			d_broadcast.removeEventListener('message', message_listener);

			// clear flow
			void session_storage_remove('flow');

			// resolve with answer
			fk_resolve(b_answer);
		}

		// handle incoming messages
		function message_listener(d_event) {
			// parse response
			const g_msg = d_event.data;

			// flow completed
			if('completeFlow' === g_msg.type) {
				// kill the flow window (no need to wait for it to resolve)
				chrome.windows.remove(g_window.id!);

				// shutdown with answer
				shutdown(g_msg.value.answer);
			}
		}

		// listen for incoming messages on broadcast channel
		d_broadcast.onmessage = message_listener;

		// handle popup window being closed
		function close_listener(i_window) {
			// target window; shutdown with effective cancel answer
			if(i_window === g_window.id!) shutdown(false);
		}

		// listen for popup window being closed
		chrome.windows.onRemoved.addListener(close_listener, {
			windowTypes: ['popup'],
		});

		// send message
		d_broadcast.postMessage(gc_prompt.flow);
	});
}

export async function flow_query(gc_prompt: PromptConfig): Promise<void> {
	// create flow tab
	await flow_generic({
		comm: 'query',
		data: JSON.stringify(gc_prompt),
	});
}


// /**
//  * Generate a new private/shared secret key of the specified size in bytes (defaults to 512-bit key)
//  */
// export function generate_key(nb_size=64): string {
// 	// prep space in memory
// 	const atu8_secret = new Uint8Array(nb_size);

// 	// fill with crypto random values
// 	crypto.getRandomValues(atu8_secret);

// 	// convert to hex string
// 	return Array.from(atu8_secret).map(x => x.toString(16).padStart(2, '0')).join('');
// }

// export function block_app(g_sender: MessageSender, s_msg: string) {
// 	console.warn(`${s_msg}; blocked request from <${g_sender.url}>`);
// }

// // localhost pattern
// const R_LOCALHOST = /^(localhost|127.0.0.1)(:\d+)?$/;


// export namespace Isomorphic {
// 	export type Message<> = {
// 		g_sender: Pick<chrome.runtime.MessageSender, 'tab' | 'url'>;

// 	};
// }

// export async function requestAdvertisement({
// 	g_sender,
// }: Isomorphic.Message) {
// 	// no sender; silently reject
// 	if(!g_sender.tab || 'number' !== typeof g_sender.tab.id) {
// 		console.error(`Refusing to advertise to unknown sender`);
// 		return;
// 	}

// 	// ref tab id
// 	const i_tab = g_sender.tab.id;

// 	// unknown source, silently reject
// 	if(!g_sender.url) {
// 		console.debug('Silently ignoring advertisement request from unknown source');
// 		return;
// 	}

// 	// parse sender url
// 	const {
// 		protocol: s_protocol,
// 		host: s_host,
// 	} = new URL(g_sender.url);

// 	// normalize scheme
// 	const s_scheme = (s_protocol || '').replace(/:$/, '');

// 	// check if app is locked
// 	const b_unlocked = await session_storage_get('unlocked');
// 	if(!b_unlocked) {
// 		// ask user to login
// 		const b_finished = await flow_broadcast({
// 			flow: {
// 				type: 'login',
// 			},
// 		});

// 		// user cancelled; do not advertise
// 		if(!b_finished) {
// 			return;
// 		}
// 	}

// 	// open storage
// 	const k_storage = await ExtStorage.open();

// 	// non-secure contexts only allowed at localhost
// 	if('http' === s_scheme) {
// 		// not localhost
// 		if(!R_LOCALHOST.test(s_host)) {
// 			return block_app(g_sender, 'Non-secure HTTP contexts are not allowed to connect to wallet except for localhost');
// 		}
// 	}
// 	// file
// 	else if('file' === s_scheme) {
// 		// check policy
// 		if(!(await k_storage.getSetting('allow_file_urls'))) {
// 			return block_app(g_sender, `File URLs are not allowed to connect to wallet, unless 'allow_file_urls' setting is enabled`);
// 		}
// 	}
// 	// anything else
// 	else if('https' !== s_scheme) {
// 		return block_app(g_sender, `Scheme not allowed "${s_scheme}"`);
// 	}

// 	// checkout apps store
// 	await k_storage.borrow(['apps'], async(h_checkouts) => {
// 		const {
// 			apps: ks_apps,
// 		} = h_checkouts;

// 		// lookup app in store
// 		let g_app = await ks_apps.get(s_host, s_scheme);
	
// 		// app is not yet registered; initialize
// 		if(!g_app) {
// 			g_app = {
// 				scheme: s_scheme,
// 				host: s_host,
// 				connections: {},
// 			};
// 		}

// 		// lookup policy on app
// 		const g_policy = await k_storage.getPolicyForApp(g_app);

// 		// a policy indicates this app is blocked
// 		if(g_policy.blocked) {
// 			return block_app(g_sender, 'App connection blocked by policy');
// 		}

// 		// app does not have any connections
// 		if(!Object.keys(g_app.connections).length) {
// 			// app is not trusted; requires user approval
// 			if(!g_policy.trusted) {
// 				// request approval from user
// 				await flow_broadcast({
// 					flow: {
// 						type: 'requestAdvertisement',
// 						value: {
// 							tabId: i_tab,
// 							app: g_app,
// 						},
// 					},
// 				});

// 				// update store
// 				await ks_apps.put(g_app);
// 			}
// 		}
// 	});

// 	// TODO: consider what will happen if prompt closes but serice worker becomes inactive

// 	// verbose
// 	console.debug(`Allowing <${g_sender.url}> to receive advertisement`);

// 	// secrets for this session
// 	const g_secrets: ServiceToIcs.SessionKeys = {
// 		session: generate_key(),
// 	};

// 	// execute isolated-world content script 'host'
// 	chrome.scripting.executeScript({
// 		target: {
// 			tabId: i_tab,
// 		},
// 		func: IcsHost,
// 		args: [g_secrets],
// 		world: 'ISOLATED',
// 	});

// 	// execute main-world content script 'ratifier'
// 	chrome.scripting.executeScript({
// 		target: {
// 			tabId: i_tab,
// 		},
// 		func: McsRatifier,
// 		args: [g_secrets],
// 		world: 'MAIN',
// 	});

// 	// respond to inpage content script with session secrets
// 	return g_secrets;
// }