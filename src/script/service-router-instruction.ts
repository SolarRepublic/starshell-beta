import type {IntraExt, SessionCommand} from './messages';
import type {NetworkFeed} from './service-feed';

import type {AppStruct} from '#/meta/app';
import {AppApiMode} from '#/meta/app';
import type {Vocab} from '#/meta/vocab';

import {global_broadcast} from './msg-global';

import {parse_sender} from './service-apps';

import {Vault} from '#/crypto/vault';
import {SessionStorage} from '#/extension/session-storage';
import {Apps} from '#/store/apps';
import {remove, timeout, timeout_exec} from '#/util/belt';

const debug = (s: string, ...a_args: (string | number | object)[]) => console.debug(`StarShell.service: ${s}`, ...a_args);
// globalThis.debug = debug;


/**
 * message handlers for service instructions from popup
 */
export function instruction_handlers(
	h_session_storage_polyfill: Vocab.Handlers<SessionCommand>,
	a_feeds: NetworkFeed[]
): Vocab.HostHandlersChrome<IntraExt.ServiceInstruction> {
	return {
		async sessionStorage(g_msg): Promise<Vocab.Response<SessionCommand>> {
			return await h_session_storage_polyfill[g_msg.type](g_msg.value);
		},

		async wake(): Promise<void> {
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
						remove(a_feeds, k_feed);

						// replace with new feed
						a_feeds.push(await k_feed.recreate());
					}
				});
			}
		},

		async whoisit() {
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
						return null;
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
							name: (await SessionStorage.get(`profile:${new URL(p_tab).origin}`))?.name
								|| g_tab.title || new URL(p_tab).host,
							scheme: s_scheme,
							host: s_host,
							connections: {},
							pfp: `pfp:${new URL(p_tab).origin}`,
						};
					}
				}

				const g_window = await chrome.windows?.get(g_tab.windowId) || null;

				return {
					tab: g_tab,
					window: g_window,
					app: g_app,
					registered: b_registered,
					authenticated: b_authed,
				};
			}

			return null;
		},

		async reloadTab(gc_reload) {
			// reload the tab
			await chrome.tabs.reload(gc_reload.tabId);
		},

		async scheduleFlowResponse(gc_schedule) {
			// destructure schedule config
			const {
				key: si_key,
				response: g_response,
			} = gc_schedule;

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

		async scheduleBroadcast(gc_schedule) {
			debug(`scheduleBroadcast(${JSON.stringify(gc_schedule)})`);

			// allow window to close
			await timeout(gc_schedule.delay || 1e3);

			// broadcast
			global_broadcast(gc_schedule.broadcast);
		},

		deepLink(gc_link) {
			debug(`deepLink(${JSON.stringify(gc_link)})`);

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
	};
}
