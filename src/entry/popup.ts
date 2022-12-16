import type {SvelteComponent} from 'svelte';

import type {AppStruct} from '#/meta/app';
import type {Dict} from '#/meta/belt';
import type {Vocab} from '#/meta/vocab';

import {dm_log, domlog} from './fallback';

domlog(`Pre-init: registering uncaught error handler`);
window.addEventListener('error', (d_event) => {
	domlog(`Fatal uncaught error: ${d_event.message}`);
	domlog(`${d_event.filename}:${d_event.lineno}:${d_event.colno}`);
	console.error(d_event.error);
});


import SystemSvelte from '#/app/container/System.svelte';
import {ThreadId} from '#/app/def';
import {initialize_caches, yw_navigator} from '#/app/mem';
import type {PageConfig} from '#/app/nav/page';
import AuthenticateSvelte from '#/app/screen/Authenticate.svelte';
import BlankSvelte from '#/app/screen/Blank.svelte';

import CreateWalletSvelte from '#/app/screen/CreateWallet.svelte';
import ImportMnemonicSvelte from '#/app/screen/ImportMnemonic.svelte';
import PreRegisterSvelte from '#/app/screen/PreRegister.svelte';
import RestrictedSvelte from '#/app/screen/Restricted.svelte';
import {Bip39} from '#/crypto/bip39';
import {Vault} from '#/crypto/vault';
import {check_restrictions} from '#/extension/restrictions';
import {ServiceClient} from '#/extension/service-comms';
import {SessionStorage} from '#/extension/session-storage';
import type {IntraExt} from '#/script/messages';
import {global_broadcast, global_receive} from '#/script/msg-global';
import {login, register} from '#/share/auth';
import {B_LOCALHOST, B_IOS_NATIVE, XT_SECONDS, P_STARSHELL_DEFAULTS, R_CAIP_2} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Providers} from '#/store/providers';
import type {StarShellDefaults} from '#/store/web-resource-cache';
import {WebResourceCache} from '#/store/web-resource-cache';
import {forever, F_NOOP, ode, timeout, timeout_exec} from '#/util/belt';
import {parse_params, qs} from '#/util/dom';
import {AppApiMode} from '#/meta/app';

const debug = true? (s: string, ...a: any[]) => console.debug(`StarShell.popup: ${s}`, ...a): () => {};

// parse search params from URL
const h_params = parse_params();

const b_dev = B_LOCALHOST && h_params.autoskip;

const dp_cause = (async() => {
	if(b_dev) return null;

	const a_tabs = await chrome.tabs?.query({
		active: true,
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
					name: (await SessionStorage.get(`profile:${d_url.origin}`))?.name!
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


// top-level system component
let yc_system: SvelteComponent | null = null;

// health check timer
let i_health = 0;

// busy reloading
let b_busy = false;

// init service client
const dp_connect = B_IOS_NATIVE? forever(): ServiceClient.connect('self');

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

			// update defaults
			try {
				const ks_providers = await Providers.read();

				const [g_defaults, xc_timeout] = await timeout_exec(10e3, () => WebResourceCache.get(P_STARSHELL_DEFAULTS));

				if(!xc_timeout) {
					const h_chains = (g_defaults as unknown as StarShellDefaults).chains;
					for(const si_caip2 in h_chains) {
						const {
							providers: a_providers,
						} = h_chains[si_caip2];

						for(const gc_provider of a_providers!) {
							const p_provider = Providers.pathFor(gc_provider.grpcWebUrl);

							// provider is defined locally
							const g_provider = ks_providers.at(p_provider);
							if(g_provider) {
								// state differs; update it
								if(g_provider.on !== gc_provider.on) {
									await Providers.update(p_provider, () => ({on:gc_provider.on}));
								}
							}
							// provider is not defined locally, adopt it
							else {
								const [, si_namespace, si_reference] = R_CAIP_2.exec(si_caip2)!;

								await Providers.putAt(p_provider, {
									...gc_provider,
									chain: Chains.pathFor(si_namespace as 'cosmos', si_reference),
									pfp: '',
								});
							}
						}
					}
				}
			}
			catch(e_update) {}
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
				void k_navigator.activateThread(ThreadId.TOKENS).then(async() => {
					// thread activated

					// development env
					if(B_LOCALHOST) {
						if(h_params.screen) {
							switch(h_params.screen) {
								case 'mnemonic': {
									const atu16_indicies = await Bip39.entropyToIndicies();

									k_navigator.activePage.push({
										creator: ImportMnemonicSvelte,
										props: {
											atu16_indicies,
										},
									});
									break;
								}

								default: {}
							}
						}
					}
				});
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
			if(!B_IOS_NATIVE) {
				const d_service: Vocab.TypedRuntime<IntraExt.ServiceInstruction> = chrome.runtime;
				let i_service_health = 0;
				function health_check() {
					clearTimeout(i_service_health);

					i_service_health = window.setTimeout(async() => {
						console.warn(`Waking idle service worker`);

						let k_client!: ServiceClient;
						const [, xc_timeout] = await timeout_exec(2e3, async() => {
							k_client = await dp_connect;

							await k_client.send({
								type: 'wake',
							});

							console.warn(`Service worker responded`);
						});

						if(xc_timeout) {
							console.warn(`⚠️ Service worker is unresponsive. Waiting for refresh... %O`, k_client || {});

							global_broadcast({
								type: 'unresponsiveService',
							});
						}
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
if(B_LOCALHOST) {
	if(h_params.autoskip) {
		console.log('Autoskipping registration');

		(async() => {
			try {
				await login('     ');
			}
			catch(e_login) {
				localStorage.clear();
				await register('     ');
				await login('     ');
			}

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
	i_health = (globalThis as typeof window).setTimeout(() => {
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
