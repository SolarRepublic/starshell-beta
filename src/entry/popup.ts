import {dm_log, domlog} from './fallback';

domlog(`Pre-init: registering uncaught error handler`);
window.addEventListener('error', (d_event) => {
	domlog(`Fatal uncaught error: ${d_event.message}`);
	domlog(`${d_event.filename}:${d_event.lineno}:${d_event.colno}`);
	console.error(d_event.error);
});


import SystemSvelte from '#/app/container/System.svelte';
import BlankSvelte from '#/app/screen/Blank.svelte';
import AuthenticateSvelte from '#/app/screen/Authenticate.svelte';

import type {SvelteComponent} from 'svelte';
import type {PageConfig} from '#/app/nav/page';
import {Vault} from '#/crypto/vault';
import {qs} from '#/util/dom';
import {initialize_caches, yw_navigator} from '#/app/mem';
import {ThreadId} from '#/app/def';
import {F_NOOP, ode, timeout} from '#/util/belt';
import PreRegisterSvelte from '#/app/screen/PreRegister.svelte';
import {global_receive} from '#/script/msg-global';
import {Accounts} from '#/store/accounts';
import CreateWalletSvelte from '#/app/screen/CreateWallet.svelte';
import {login, register} from '#/share/auth';
import {B_MOBILE, XT_SECONDS} from '#/share/constants';
import {check_restrictions} from '#/extension/restrictions';
import RestrictedSvelte from '#/app/screen/Restricted.svelte';
import type {Vocab} from '#/meta/vocab';
import type {IntraExt} from '#/script/messages';
import {storage_clear} from '#/extension/public-storage';
import type {Dict} from '#/meta/belt';
import {Apps} from '#/store/apps';
import {AppApiMode, AppInterface} from '#/meta/app';
import {SessionStorage} from '#/extension/session-storage';

const debug = true? (s: string, ...a: any[]) => console.debug(`StarShell.popup: ${s}`, ...a): () => {};

// parse search params from URL
const h_params = Object.fromEntries(new URLSearchParams(location.search.slice(1)).entries());

const dp_cause = (async() => {
	const a_tabs = await chrome.tabs?.query({
		active: true,
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
			const d_url = new URL(p_tab);
			const s_host = d_url.host;
			const s_scheme = d_url.protocol.replace(/:$/, '') as 'https';

			// foreign scheme
			if(!/^(file|https?)$/.test(s_scheme)) {
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
					name: (await SessionStorage.get(`profile:${d_url.origin}`))?.name as string
						|| g_tab.title || s_host,
					scheme: s_scheme,
					host: s_host,
					connections: {},
					pfp: `pfp:${d_url.origin}`,
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
})();


// wait for DOM
window.addEventListener('DOMContentLoaded', () => {
	debug('dom content loaded');
	// ref document element
	const dm_html = document.documentElement;

	const d_style_root = dm_html.style;

	// mobile
	if(B_MOBILE) {
		// use all available 


		// // in tab
		// if('tab' in h_params) {
		// 	// safari mobile
		// 	if(B_SAFARI_MOBILE) {
		// 		const d_viewport = globalThis.visualViewport;


		// 		d_style_root.setProperty('--app-window-width', d_viewport.width+'px');
		// 		d_style_root.setProperty('--app-window-height', d_viewport.height+'px');

		// 		// viewport is resized (e.g., from virtual keyboard overlay)
		// 		d_viewport.addEventListener('resize', () => {
		// 			// resize document to viewport
		// 			// d_style_root.setProperty('--app-window-width', '100%');
		// 			d_style_root.setProperty('--app-window-height', d_viewport.height+'px');

		// 			// dm_html.style.height = d_viewport.height+'px';

		// 			// scroll to top
		// 			dm_html.scrollTop = 0;
		// 		});
		// 	}

		// 	// debugger;
		// 	// Object.assign(document.documentElement.style, {

		// 	// });

		// 	// globalThis.addEventListener('scroll', () => {
		// 	// 	console.log('window#scroll');
		// 	// });

		// 	// document.addEventListener('scroll', (d_event) => {
		// 	// 	console.log('document#scroll: %o', d_event);
		// 	// });

		// 	// document.addEventListener('focus', )

		// 	// globalThis.addEventListener('resize', () => {
		// 	// 	console.log('#resize');
		// 	// });

		// 	// setTimeout(async() => {
		// 	// 	console.log('updating scroll');


		// 	// 	// dm_scroll.scrollTop = dm_scroll.scrollHeight;
		// 	// 	// await microtask();
		// 	// 	dm_html.style.height = (window.innerHeight - 52)+'px';
		// 	// 	await microtask();
		// 	// 	dm_html.scrollTop = 0;
		// 	// 	await microtask();
		// 	// 	qsa(document.body, '.thread>.bounds>.screen').map(dm => dm.scrollTop = dm.scrollHeight);
		// 	// }, 12e3);
		// }
	}

	// hide dom log
	if(dm_log) {
		dm_log.style.opacity = '0';

		// show it shortly
		setTimeout(() => {
			dm_log!.style.opacity = '1';
		}, 2e3);
	}

	// bind factory reset button
	document.getElementById('factory-reset')?.addEventListener('click', async() => {
		await SessionStorage.clear();
		await storage_clear();
		await reload();
	});
});

// top-level system component
let yc_system: SvelteComponent | null = null;

// health check timer
let i_health = 0;

// busy reloading
let b_busy = false;

// reload the entire system
async function reload() {
	debug(`reload called; busy: ${b_busy}`);
	if(b_busy) return;

	b_busy = true;

	// destroy previous system
	if(yc_system) {
		try {
			yc_system.$destroy();
		}
		catch(e_destroy) {}
	}

	// remove stale dom
	try {
		qs(document.body, 'main')?.remove();
	}
	catch(e_remove) {}

	// launch app
	let b_launch = false;

	// start page
	let gc_page_start: PageConfig;

	// context
	const g_cause = await Promise.race([
		dp_cause,
		timeout(300).then(() => null),
	]);

	const h_context: Dict<any> = {
		cause: g_cause,
	};
	debug('checking restrictions');
	// restrictions
	const a_restrictions = await check_restrictions();

	debug('checking vault');
	if(a_restrictions.length) {
		gc_page_start = {
			creator: RestrictedSvelte,
		};
	}
	// vault is unlocked
	else if(await Vault.isUnlocked()) {
		// register for global events
		const f_unregister = global_receive({
			// system received logout command
			logout() {
				// unregister this listener
				f_unregister();

				// reload system
				void reload();
			},
		});

		debug('initializing caches');
		// load caches
		await initialize_caches();

		debug('reading account');
		// check for account(s)
		const ks_accounts = await Accounts.read();

		// no accounts; load account creation
		if(!Object.keys(ks_accounts.raw).length) {
			gc_page_start = {
				creator: CreateWalletSvelte,
			};

			// set complete function in context
			h_context.completed = reload;
		}
		// account exists; load default homescreen
		else {
			gc_page_start = {
				creator: BlankSvelte,
			};

			// launch homescreen
			b_launch = true;
		}
	}
	// vault is locked
	else {
		// register for global events
		const f_unregister = global_receive({
			// system received login command
			login() {
				// unregister this listener
				f_unregister();

				// reload system
				void reload();
			},
		});

		debug('getting base');
		// retrieve root
		const g_root = await Vault.getBase();

		// no root set, need to register
		if(!g_root) {
			gc_page_start = {
				creator: PreRegisterSvelte,
			};
		}
		// root is set, need to authenticate
		else {
			gc_page_start = {
				creator: AuthenticateSvelte,
			};
		}

		// in either case, set complete function in context
		h_context.completed = F_NOOP;
	}

	// wait for navigator to be initialized
	let b_initialized = false;
	const f_unsubscribe = yw_navigator.subscribe((k_navigator) => {
		// runner gets called immediately, but system has not updated navigator yet
		if(!b_initialized) {
			b_initialized = true;
			return;
		}

		// system updated navigator
		if(k_navigator) {
			// unsubscribe from reactive updates
			f_unsubscribe();

			// launch to homescreen
			if(b_launch) {
				k_navigator.activateThread(ThreadId.TOKENS);
			}
			// launch to init thread
			else {
				k_navigator.activateThread(ThreadId.INIT);
			}

			// attempt to hide log
			try {
				dm_log!.style.display = 'none';
			}
			catch(e_hide) {}

			// listen for heartbeat
			const d_service: Vocab.TypedRuntime<IntraExt.ServiceInstruction> = chrome.runtime;
			let i_service_health = 0;
			function health_check() {
				clearTimeout(i_service_health);

				i_service_health = setTimeout(() => {
					void d_service.sendMessage({
						type: 'wake',
					});

					console.warn(`Waking idle service worker`);
				}, 2e3);
			}

			global_receive({
				heartbeat() {
					health_check();
				},
			});

			// user is logged in, ensure the service is running
			if(b_launch) {
				health_check();
			}
		}
	});
	debug('launching system');

	// create system component
	yc_system = new SystemSvelte({
		target: document.body,
		anchor: document.getElementById('terminus')!,
		props: {
			mode: 'app',
			page: gc_page_start,
		},
		context: new Map(ode(h_context)),
	});

	// clear health check
	clearTimeout(i_health);

	b_busy = false;
}


// dev
if('localhost' === location.hostname) {
	if(h_params['autoskip']) {
		console.log('Autoskipping registration');

		(async() => {
			localStorage.clear();
			await register('     ');
			await login('     ');
			void reload();
		})();
	}
	else {
		// start system
		void reload();
	}
}
else {
	// start health check timer
	i_health = globalThis.setTimeout(() => {
		domlog('Fatal time out, likely caused by an uncaught error.');
	}, 15*XT_SECONDS);

	try {
		// start system
		void reload();
	}
	catch(e_load) {
		debugger;
		console.error(e_load);
	}
}
