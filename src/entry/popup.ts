import SystemSvelte from '#/app/container/System.svelte';
import BlankSvelte from '#/app/screen/Blank.svelte';
import AuthenticateSvelte from '#/app/screen/Authenticate.svelte';


import type {SvelteComponent} from 'svelte';
import type {PageConfig} from '#/app/nav/page';
import {session_storage_clear, Vault} from '#/crypto/vault';
import {qs, qsa} from '#/util/dom';
import {initialize_caches, yw_navigator} from '#/app/mem';
import {ThreadId} from '#/app/def';
import {F_NOOP, microtask, ode} from '#/util/belt';
import {dm_log, domlog} from './fallback';
import PreRegisterSvelte from '#/app/screen/PreRegister.svelte';
import {global_receive} from '#/script/msg-global';
import {Accounts} from '#/store/accounts';
import CreateWalletSvelte from '#/app/screen/CreateWallet.svelte';
import {login, register} from '#/share/auth';
import {B_MOBILE, B_SAFARI_MOBILE, XT_SECONDS} from '#/share/constants';
import {check_restrictions} from '#/extension/restrictions';
import RestrictedSvelte from '#/app/screen/Restricted.svelte';
import type {Vocab} from '#/meta/vocab';
import type {IntraExt} from '#/script/messages';
import {storage_clear} from '#/extension/public-storage';

// parse search params from URL
const h_params = Object.fromEntries(new URLSearchParams(location.search.slice(1)).entries());

// wait for DOM
window.addEventListener('DOMContentLoaded', () => {
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
		await session_storage_clear();
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
	let h_context = {};

	// check if root key is accessible
	const dk_root = await Vault.getRootKey();

	// restrictions
	const a_restrictions = await check_restrictions();
	if(a_restrictions.length) {
		gc_page_start = {
			creator: RestrictedSvelte,
		};
	}
	// vault is unlocked
	else if(dk_root) {
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

		// load caches
		await initialize_caches();

		// check for account(s)
		const ks_accounts = await Accounts.read();

		// no accounts; load account creation
		if(!Object.keys(ks_accounts.raw).length) {
			gc_page_start = {
				creator: CreateWalletSvelte,
			};

			// set complete function in context
			h_context = {
				completed: reload,
				// completed: F_NOOP,
			};
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
		h_context = {
			// completed: reload,
			completed: F_NOOP,
		};
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
